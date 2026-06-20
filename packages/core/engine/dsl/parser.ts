// DSL v1.0 string→AST parser — recursive descent · M·1 EBNF (freeze.md §M·1).
// fail-closed: parseExpr/parsePred throw DslParseError on any error.
// tryParseExpr/tryParsePred return null on error.
// No platform deps; pure string processing; cross-platform bit-exact (no Math).
// Import DslExpr/DslPred types from ./fuzzer.js (shared AST definition).
import type { DslExpr, DslPred, DslFn, DslBinOp, DslCmpOp, DslLogOp } from './fuzzer.js';

// ── Version constants (进指纹取材集·FINGERPRINT_PRESET_FIELDS[3]/[4]) ──────────

/** DSL 文法版本（FINGERPRINT_PRESET_FIELDS[3]·改版即改判定） */
export const DSL_GRAMMAR_VERSION = 'v1.0' as const;

/** 求值器函数库版本（FINGERPRINT_PRESET_FIELDS[4]·v1={min,max,clamp,pow,sqrt}·增列超越函数时 bump） */
export const DSL_EVALUATOR_VERSION = 'v1.0' as const;

// ── Error class ───────────────────────────────────────────────────────────────

export class DslParseError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'DslParseError';
  }
}

// ── Tokenizer ─────────────────────────────────────────────────────────────────

type TokenKind =
  | 'INT' | 'IDENT'
  | '+' | '-' | '*' | '/'
  | '(' | ')' | ',' | '.' | '%'
  | '==' | '!=' | '<=' | '>=' | '<' | '>'
  | 'and' | 'or' | 'in'
  | 'min' | 'max' | 'clamp' | 'pow' | 'sqrt'
  | 'EOF';

interface Token { readonly kind: TokenKind; readonly raw: string; }

// Keyword → token-kind map (non-IDENT identifiers in the DSL grammar)
const KEYWORDS = new Map<string, TokenKind>([
  ['and', 'and'], ['or', 'or'], ['in', 'in'],
  ['min', 'min'], ['max', 'max'], ['clamp', 'clamp'],
  ['pow', 'pow'], ['sqrt', 'sqrt'],
]);

// Regex for identifier start/continuation (Unicode letters + digits + underscore)
// Matches Chinese characters (BMP range) via \p{L}; 'u' flag required.
const IDENT_RE = /^[\p{L}_][\p{L}\p{N}_]*/u;

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;

  while (i < src.length) {
    const ch = src[i]!;

    // Skip whitespace
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') { i++; continue; }

    // Two-char operators (must check before single-char)
    const two = src.slice(i, i + 2);
    if (two === '==' || two === '!=' || two === '<=' || two === '>=') {
      out.push({ kind: two as '==' | '!=' | '<=' | '>=', raw: two });
      i += 2;
      continue;
    }

    // Single-char operators and punctuation
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' ||
        ch === '(' || ch === ')' || ch === ',' || ch === '.' ||
        ch === '%' || ch === '<' || ch === '>') {
      out.push({ kind: ch as TokenKind, raw: ch });
      i++;
      continue;
    }

    // Integer literal ([0-9]+)
    if (ch >= '0' && ch <= '9') {
      let j = i;
      while (j < src.length && src[j]! >= '0' && src[j]! <= '9') j++;
      out.push({ kind: 'INT', raw: src.slice(i, j) });
      i = j;
      continue;
    }

    // Identifier or keyword — handles Unicode letters (Chinese chars via \p{L})
    const identMatch = IDENT_RE.exec(src.slice(i));
    if (identMatch !== null) {
      const raw = identMatch[0];
      const kind = KEYWORDS.get(raw) ?? 'IDENT';
      out.push({ kind, raw });
      i += raw.length;
      continue;
    }

    throw new DslParseError(`DSL parse error: unexpected character '${ch}' at position ${i}`);
  }

  out.push({ kind: 'EOF', raw: '' });
  return out;
}

// ── Parser ────────────────────────────────────────────────────────────────────

// Sets for fast token-kind membership checks
const FN_SET   = new Set<TokenKind>(['min', 'max', 'clamp', 'pow', 'sqrt']);
const CMP_SET  = new Set<TokenKind>(['==', '!=', '<', '<=', '>', '>=', 'in']);
const LOG_SET  = new Set<TokenKind>(['and', 'or']);
// Token kinds valid as path segments after '.' (keywords may appear as segment names)
const PATH_SEG = new Set<TokenKind>(['IDENT', 'min', 'max', 'clamp', 'pow', 'sqrt', 'and', 'or', 'in']);

class Parser {
  private readonly toks: readonly Token[];
  private pos = 0;

  constructor(toks: readonly Token[]) { this.toks = toks; }

  private peek(): Token { return this.toks[this.pos] ?? { kind: 'EOF', raw: '' }; }

  private consume(): Token {
    const t = this.toks[this.pos++];
    return t ?? { kind: 'EOF', raw: '' };
  }

  private expect(kind: TokenKind): Token {
    const t = this.consume();
    if (t.kind !== kind) {
      throw new DslParseError(`DSL parse error: expected '${kind}' got '${t.kind}' ('${t.raw}')`);
    }
    return t;
  }

  // ── Expression parsers (follow EBNF precedence) ─────────────────────────────

  /** Top-level expr entry point — delegates to additive. */
  parseExpr(): DslExpr { return this.parseAddSub(); }

  /** 加减式 = 乘除式 , { ("+" | "-") , 乘除式 } */
  private parseAddSub(): DslExpr {
    let left = this.parseMulDiv();
    while (this.peek().kind === '+' || this.peek().kind === '-') {
      const op = this.consume().kind as DslBinOp;
      left = { kind: 'binary', op, left, right: this.parseMulDiv() };
    }
    return left;
  }

  /** 乘除式 = 一元式 , { ("*" | "/") , 一元式 } */
  private parseMulDiv(): DslExpr {
    let left = this.parseUnary();
    while (this.peek().kind === '*' || this.peek().kind === '/') {
      const op = this.consume().kind as DslBinOp;
      left = { kind: 'binary', op, left, right: this.parseUnary() };
    }
    return left;
  }

  /** 一元式 = [ "-" ] , 基本式 */
  private parseUnary(): DslExpr {
    if (this.peek().kind === '-') {
      this.consume();
      return { kind: 'unary', op: '-', expr: this.parsePrimary() };
    }
    return this.parsePrimary();
  }

  /**
   * 基本式 = 整数 | 百分比 | 函数调用 | 路径 | "(" , 表达式 , ")"
   * Disambiguation: fn-name followed by '(' → function call; otherwise → path segment.
   */
  private parsePrimary(): DslExpr {
    const t = this.peek();

    // 整数 or 百分比
    if (t.kind === 'INT') {
      this.consume();
      const value = parseInt(t.raw, 10);
      if (this.peek().kind === '%') { this.consume(); return { kind: 'percent', value }; }
      return { kind: 'int', value };
    }

    // "(" , 表达式 , ")"
    if (t.kind === '(') {
      this.consume();
      const expr = this.parseAddSub();
      this.expect(')');
      return expr;
    }

    // 函数调用: fn-name immediately followed by '('
    if (FN_SET.has(t.kind) && this.toks[this.pos + 1]?.kind === '(') {
      const fn = this.consume().kind as DslFn;
      this.expect('(');
      const args: DslExpr[] = [this.parseAddSub()];
      while (this.peek().kind === ',') { this.consume(); args.push(this.parseAddSub()); }
      this.expect(')');
      return { kind: 'call', fn, args };
    }

    // 路径: IDENT or keyword-as-path-start followed by optional ".segment" chain
    if (t.kind === 'IDENT' || FN_SET.has(t.kind)) {
      const parts: string[] = [this.consume().raw];
      while (this.peek().kind === '.') {
        this.consume();
        const seg = this.peek();
        if (!PATH_SEG.has(seg.kind)) {
          throw new DslParseError(`DSL parse error: expected identifier after '.' got '${seg.kind}'`);
        }
        parts.push(this.consume().raw);
      }
      return { kind: 'path', parts };
    }

    throw new DslParseError(`DSL parse error: unexpected '${t.kind}' ('${t.raw}') in expression`);
  }

  // ── Predicate parsers ──────────────────────────────────────────────────────

  /**
   * 谓词 = 比较式 , { ("and" | "or") , 比较式 }
   * 限深 1 (静态约束 2): at most ONE and/or — nesting logical nodes is prohibited.
   * Three-term chains (a > 0 and b > 0 and c > 0) throw DslParseError.
   */
  parsePred(): DslPred {
    const left = this.parseCompare();
    const op = this.peek().kind;
    if (!LOG_SET.has(op)) return left;

    this.consume();
    const right = this.parseCompare();

    // Enforce depth-1: reject further and/or tokens
    if (LOG_SET.has(this.peek().kind)) {
      throw new DslParseError('DSL parse error: 谓词限深 1 — 不支持三元 and/or 链');
    }

    return { kind: 'logical', op: op as DslLogOp, left, right };
  }

  /** 比较式 = 表达式 , 比较符 , 表达式  (比较符 includes "in") */
  private parseCompare(): DslPred {
    const left = this.parseAddSub();
    const op = this.peek().kind;
    if (!CMP_SET.has(op)) {
      throw new DslParseError(`DSL parse error: expected comparison operator got '${op}'`);
    }
    this.consume();
    return { kind: 'compare', op: op as DslCmpOp, left, right: this.parseAddSub() };
  }

  // ── EOF enforcement ────────────────────────────────────────────────────────

  expectEOF(): void {
    const t = this.peek();
    if (t.kind !== 'EOF') {
      throw new DslParseError(`DSL parse error: trailing input '${t.kind}' ('${t.raw}')`);
    }
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/** Parse DSL v1.0 numeric expression. Throws DslParseError on any error (fail-closed). */
export function parseExpr(src: string): DslExpr {
  const p = new Parser(tokenize(src));
  const e = p.parseExpr();
  p.expectEOF();
  return e;
}

/** Parse DSL v1.0 predicate. Throws DslParseError on any error (fail-closed). */
export function parsePred(src: string): DslPred {
  const p = new Parser(tokenize(src));
  const pred = p.parsePred();
  p.expectEOF();
  return pred;
}

/** Try parse DSL v1.0 expression. Returns null on any error. */
export function tryParseExpr(src: string): DslExpr | null {
  try { return parseExpr(src); } catch { return null; }
}

/** Try parse DSL v1.0 predicate. Returns null on any error. */
export function tryParsePred(src: string): DslPred | null {
  try { return parsePred(src); } catch { return null; }
}
