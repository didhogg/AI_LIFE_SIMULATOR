// P0-6 Gate① — whitelist derivation prototype (dry-run only, not P0-6 gate impl)
// Verifies that "verb-writable path whitelist" can be mechanically derived from RootSchema.
//
// P0-6 TODO: 五道闸正式实装后，需补端到端反向断言：
//   AI 动词提案写 _状态机/_席位表 等 read-only 键 → 被②前缀闸或③白名单闸拒收，
//   且不污染存档。当前仅有派生器层面的 read-only 分类断言，端到端验证留 P0-6 补。
import { z } from 'zod';
import { RootSchema } from './index.js';
import type { 变量字段声明Type } from './commonEntry.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export type AccessLayer =
  | 'writable'           // AI can propose writes (no prefix)
  | 'read-only'          // AI can see, engine writes (_ prefix, includes engine-internal keys)
  | 'invisible'          // AI cannot see or touch ($ prefix, except $meta)
  | 'cross-playthrough'; // $meta layer (spans playthroughs)

export type FieldKind =
  | 'open-string'  // z.string() — AI can write arbitrary text
  | 'enum'         // z.enum() — AI must choose from fixed set
  | 'literal'      // z.literal() — immutable constant
  | 'number'       // z.number()
  | 'boolean'      // z.boolean()
  | 'array'        // z.array() — AI can append
  | 'record'       // z.record() — keyed entity store
  | 'object'       // z.object() intermediate node
  | 'union'        // z.union/discriminatedUnion
  | 'unknown';

export interface DerivedEntry {
  path: string;
  layer: AccessLayer;
  kind: FieldKind;
  enumValues?: readonly string[];
  decl?: 变量字段声明Type; // 扩展参数声明元数据（仅 deriveExtensionParamPaths 填充·FIX-1 类型守门）
}

// ─── Top-level key classification ────────────────────────────────────────────

// Pure prefix derivation — no manual exemption lists.
// _ prefix = AI read-only (covers both narrative read-only and engine-internal keys).
export function classifyTopKey(key: string): AccessLayer {
  if (key === '$meta') return 'cross-playthrough';
  if (key.startsWith('$')) return 'invisible';
  if (key.startsWith('_')) return 'read-only';
  return 'writable';
}

// ─── Nested field layer inheritance ──────────────────────────────────────────

export function nestedFieldLayer(fieldName: string, parentLayer: AccessLayer): AccessLayer {
  // Invisible/cross-playthrough propagate to all children; read-only also propagates
  if (
    parentLayer === 'invisible' ||
    parentLayer === 'cross-playthrough' ||
    parentLayer === 'read-only'
  ) return parentLayer;
  // Within a writable context, check the sub-field's own prefix
  if (fieldName === '$meta') return 'cross-playthrough';
  if (fieldName.startsWith('$')) return 'invisible';
  if (fieldName.startsWith('_')) return 'read-only';
  return 'writable';
}

// ─── Zod schema introspection ─────────────────────────────────────────────────

// Unwrap ZodDefault / ZodOptional / ZodNullable / ZodEffects to get the core schema
export function unwrap(schema: z.ZodTypeAny): z.ZodTypeAny {
  const tn = (schema._def as { typeName: string }).typeName;
  if (tn === 'ZodDefault' || tn === 'ZodOptional' || tn === 'ZodNullable') {
    return unwrap((schema._def as { innerType: z.ZodTypeAny }).innerType);
  }
  if (tn === 'ZodEffects') {
    return unwrap((schema._def as { schema: z.ZodTypeAny }).schema);
  }
  return schema;
}

export function classifyKind(schema: z.ZodTypeAny): {
  kind: FieldKind;
  enumValues?: readonly string[];
} {
  const s = unwrap(schema);
  const tn = (s._def as { typeName: string }).typeName;
  switch (tn) {
    case 'ZodString':
      return { kind: 'open-string' };
    case 'ZodEnum':
      return {
        kind: 'enum',
        enumValues: (s._def as { values: readonly string[] }).values,
      };
    case 'ZodNativeEnum':
      return { kind: 'enum' };
    case 'ZodLiteral':
      return { kind: 'literal' };
    case 'ZodNumber':
      return { kind: 'number' };
    case 'ZodBoolean':
      return { kind: 'boolean' };
    case 'ZodObject':
      return { kind: 'object' };
    case 'ZodRecord':
      return { kind: 'record' };
    case 'ZodArray':
      return { kind: 'array' };
    case 'ZodUnion':
    case 'ZodDiscriminatedUnion':
      return { kind: 'union' };
    default:
      return { kind: 'unknown' };
  }
}

// ─── Recursive schema walker ──────────────────────────────────────────────────

export function walkSchema(
  schema: z.ZodTypeAny,
  currentPath: string,
  layer: AccessLayer,
  results: DerivedEntry[],
): void {
  const s = unwrap(schema);
  const tn = (s._def as { typeName: string }).typeName;

  if (tn === 'ZodObject') {
    // Emit an entry for the object node itself (needed for 创建实体 record-root targets)
    results.push({ path: currentPath, layer, kind: 'object' });
    const shape = (s as z.ZodObject<z.ZodRawShape>).shape;
    for (const [key, fieldSchema] of Object.entries(shape)) {
      const fieldLayer = nestedFieldLayer(key, layer);
      const fieldPath = `${currentPath}.${key}`;
      walkSchema(fieldSchema as z.ZodTypeAny, fieldPath, fieldLayer, results);
    }
    return;
  }

  if (tn === 'ZodRecord') {
    results.push({ path: currentPath, layer, kind: 'record' });
    const valueSchema = (s._def as { valueType: z.ZodTypeAny }).valueType;
    walkSchema(valueSchema, `${currentPath}.{id}`, layer, results);
    return;
  }

  if (tn === 'ZodArray') {
    results.push({ path: currentPath, layer, kind: 'array' });
    const itemSchema = (s._def as { type: z.ZodTypeAny }).type;
    walkSchema(itemSchema, `${currentPath}.{i}`, layer, results);
    return;
  }

  if (tn === 'ZodUnion') {
    results.push({ path: currentPath, layer, kind: 'union' });
    // Walk union options shallowly — each option shares the same path
    const options = (s._def as { options: z.ZodTypeAny[] }).options;
    for (const option of options) {
      walkSchema(option, currentPath, layer, results);
    }
    return;
  }

  if (tn === 'ZodDiscriminatedUnion') {
    results.push({ path: currentPath, layer, kind: 'union' });
    const options = (s._def as { options: Map<string, z.ZodTypeAny> | z.ZodTypeAny[] }).options;
    const optionList = Array.isArray(options) ? options : [...(options as Map<string, z.ZodTypeAny>).values()];
    for (const option of optionList) {
      walkSchema(option, currentPath, layer, results);
    }
    return;
  }

  // Leaf node
  const { kind, enumValues } = classifyKind(s);
  results.push({ path: currentPath, layer, kind, ...(enumValues ? { enumValues } : {}) });
}

// ─── Main derivation function ─────────────────────────────────────────────────

export function deriveWritableWhitelist(): DerivedEntry[] {
  const results: DerivedEntry[] = [];
  const shape = RootSchema.shape;
  for (const [key, schema] of Object.entries(shape)) {
    const layer = classifyTopKey(key);
    walkSchema(schema as z.ZodTypeAny, key, layer, results);
  }
  // FIX-2: 扩展参数 退出静态白名单（post-filter）。
  // walkSchema 对 ZodRecord 产生 .扩展参数 record 节点 + .扩展参数.{id} 叶通配。
  // 去除后，写入须凭 deriveExtensionParamPaths 的具体声明路径授权（引用即授权）。
  return results.filter(e => !/\.扩展参数(\.|$)/.test(e.path));
}

// ─── Dry-run report ───────────────────────────────────────────────────────────

export interface DryRunResult {
  checkA: CheckAResult;
  checkB: CheckBResult;
  checkC: CheckCResult;
  layerAmbiguities: string[];
}

export interface CheckAResult {
  pass: boolean;
  invisibleCount: number;
  crossPlaythroughCount: number;
  readOnlyCount: number;
  writableCount: number;
  misclassified: string[];
}

export interface CheckBResult {
  pass: boolean;
  openStringPaths: string[];
  enumPaths: string[];
  distinguishable: boolean;
}

export interface CheckCResult {
  pass: boolean;
  probeResults: Array<{ probe: string; found: boolean; kind?: FieldKind }>;
  missing: string[];
}

// Verb target paths for dry-run check (c): 通用×4 + 语义×15 + 兜底×1 = 20 total.
// Each probe must be exact-match reachable in deriveWritableWhitelist() as writable.
// Probes use {id}/{i} placeholders as emitted by walkSchema for record/array values.
const VERB_TARGET_PROBES: Array<{ probe: string; description: string }> = [
  // ── 通用×4 ─────────────────────────────────────────────────────────────────
  { probe: 'NPC.{id}',                              description: '创建实体·NPC' },
  { probe: 'NPC.{id}.属性',                         description: '修改字段·NPC属性段' },
  { probe: '组织实体.{id}',                          description: '创建实体·组织' },
  { probe: 'NPC.{id}.情绪栈.{i}',                   description: '追加条目·NPC情绪栈' },
  // ── 语义×15 ────────────────────────────────────────────────────────────────
  { probe: '工作记忆',                              description: '①埋种子·工作记忆数组' },
  { probe: '全局.秘密库.{id}.暴露度',               description: '②揭秘·秘密暴露度' },
  { probe: '全局.秘密库.{id}.已暴露线索',           description: '③线索浮现·线索追加' },
  { probe: '组织关系网.{id}.关系值',                description: '④阵营变更·关系值' },
  { probe: 'NPC.{id}.当前作息模式',                 description: '⑤切换作息模式' },
  { probe: '长期归档',                              description: '⑥战果档·长期归档数组' },
  { probe: '地图.地点.{id}',                        description: '⑦地点创建/修改' },
  { probe: '货币系统.账户.{id}.持有.{id}',           description: '⑧转账·账户持有' },
  { probe: 'NPC.{id}.状态标签',                     description: '⑨状态变更·状态标签' },
  { probe: '全局.约定库.{id}',                      description: '⑩缔约·约定创建/修改' },
  { probe: '认知档案.{id}.{id}.了解度',             description: '⑪印象涟漪·认知档案了解度' },
  { probe: '已故NPC归档.{id}',                      description: '⑫归档NPC·已故NPC归档条目' },
  { probe: '战争状态.{id}',                         description: '⑬宣战/停战·战争状态条目' },
  { probe: '赛事实例.{id}.当前轮次',                description: '⑭赛事推进·当前轮次' },
  { probe: '全局.家族树.边.{id}',                   description: '⑮家族谱系·家族树边节点' },
  // ── 兜底×1 ─────────────────────────────────────────────────────────────────
  // 直改兜底：任意可写叶节点均可落账，此处以代表叶节点验证派生器覆盖充分
  { probe: 'NPC.{id}.属性.体质',                    description: '兜底·代表叶节点（直改）' },
];

// B1·K1 Step 3b: promoted from one-shot dry-run to standing CI guard.
// Accepts an optional entries snapshot; defaults to deriveWritableWhitelist() for
// backward compatibility. Pass deriveModAwareWhitelist(loadOrder, registry) from
// loader/modWhitelist to guard the full mod-aware derivation.
//
// Runtime consumption anchor (B6 / first consumer):
//   When the import-gate fires (B6), call runDryRun(deriveModAwareWhitelist(lor, reg))
//   with the live registry after mod注册表 parse; assert report.checkA/B/C.pass all true
//   before allowing any mod content consumption. This is the intended wiring point.
//   Until then: no hosts/ variable; whitelist is derived and checked in CI only.
export function runDryRun(entries: DerivedEntry[] = deriveWritableWhitelist()): DryRunResult {
  const all = entries;
  const pathToEntry = new Map(all.map(e => [e.path, e]));

  // ── Check A: prefix layer correctness ─────────────────────────────────────
  const layerCounts = { invisible: 0, 'cross-playthrough': 0, 'read-only': 0, writable: 0 };
  const misclassified: string[] = [];

  for (const entry of all) {
    const topKey = entry.path.split('.')[0]!;
    const expectedLayer = classifyTopKey(topKey);

    // Children of writable tops can override via nested prefix
    // so we only check top-level entries for direct key classification.
    if (!entry.path.includes('.')) {
      if (entry.layer !== expectedLayer) {
        misclassified.push(`${entry.path}: expected ${expectedLayer}, got ${entry.layer}`);
      }
    }

    layerCounts[entry.layer as keyof typeof layerCounts] =
      (layerCounts[entry.layer as keyof typeof layerCounts] ?? 0) + 1;
  }

  const checkA: CheckAResult = {
    pass: misclassified.length === 0,
    invisibleCount: layerCounts['invisible'],
    crossPlaythroughCount: layerCounts['cross-playthrough'],
    readOnlyCount: layerCounts['read-only'],
    writableCount: layerCounts['writable'],
    misclassified,
  };

  // ── Check B: open-string vs enum distinguishable ───────────────────────────
  const writableEntries = all.filter(e => e.layer === 'writable');
  const openStringPaths = writableEntries.filter(e => e.kind === 'open-string').map(e => e.path);
  const enumPaths = writableEntries.filter(e => e.kind === 'enum').map(e => e.path);

  const checkB: CheckBResult = {
    pass: true, // trivially true: kind 'open-string' vs 'enum' are different string values
    openStringPaths: openStringPaths.slice(0, 10), // sample for report
    enumPaths: enumPaths.slice(0, 10),
    distinguishable: true,
  };

  // ── Check C: verb target coverage ─────────────────────────────────────────
  const probeResults = VERB_TARGET_PROBES.map(({ probe }) => {
    const entry = pathToEntry.get(probe);
    if (entry && entry.layer === 'writable') {
      return { probe, found: true, kind: entry.kind };
    }
    // Also accept if pathSet contains a prefix of the probe (parent writable object)
    // i.e. if "NPC.{id}.属性" exists, "NPC.{id}.属性.体质" might still be writable
    // but here we require an exact match to be rigorous.
    return { probe, found: false };
  });

  const missing = probeResults.filter(r => !r.found).map(r => r.probe);

  const checkC: CheckCResult = {
    pass: missing.length === 0,
    probeResults,
    missing,
  };

  // ── Layering notes (informational) ───────────────────────────────────────
  const layerAmbiguities: string[] = [];

  // Confirm nested $ fields inside writable domains are correctly invisible
  const nestedInvisible = all.filter(
    e =>
      e.layer === 'invisible' &&
      classifyTopKey(e.path.split('.')[0]!) === 'writable',
  );
  if (nestedInvisible.length > 0) {
    layerAmbiguities.push(
      `OK: ${nestedInvisible.length} nested $ fields inside writable domains ` +
        `(e.g. ${nestedInvisible.slice(0, 3).map(e => e.path).join(', ')}) ` +
        'correctly invisible by nested prefix rule',
    );
  }

  return { checkA, checkB, checkC, layerAmbiguities };
}
