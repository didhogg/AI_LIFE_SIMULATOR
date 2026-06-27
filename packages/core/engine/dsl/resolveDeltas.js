import { evalExpr } from './eval.js';
import { tryParseExpr } from './parser.js';
// ── 核心函数 ─────────────────────────────────────────────────────────────────────
/**
 * 将 intervention_pack deltas 中的 DSL expression string 求值为 number。
 *
 * 语义：
 *   · value 为 number → 直通（pass-through）
 *   · value 为 string → tryParseExpr → evalExpr → 必须为 isFinite number
 *
 * fail-closed：任一 delta 解析/求值失败（parse=null 或 !isFinite）→ 整包 ok:false。
 * 空 deltas → ok:true, resolved=[]（无 delta=pass-through·不报错）。
 */
export function resolveDeltaValues(deltas, ctx) {
    const resolved = [];
    for (const delta of deltas) {
        if (typeof delta.value === 'number') {
            // 直通
            const r = {
                path: delta.path,
                op: delta.op,
                value: delta.value,
            };
            if (delta.max_delta !== undefined)
                r.max_delta = delta.max_delta;
            resolved.push(r);
            continue;
        }
        // DSL expression string
        const ast = tryParseExpr(delta.value);
        if (ast === null) {
            return {
                ok: false,
                reason: `delta.value 表达式解析失败·path「${delta.path}」value="${delta.value}"`,
            };
        }
        const n = evalExpr(ast, ctx);
        if (!isFinite(n)) {
            return {
                ok: false,
                reason: `delta.value 求值结果非有限数 (${n})·path「${delta.path}」value="${delta.value}"`,
            };
        }
        const r = {
            path: delta.path,
            op: delta.op,
            value: n,
        };
        if (delta.max_delta !== undefined)
            r.max_delta = delta.max_delta;
        resolved.push(r);
    }
    return { ok: true, resolved };
}
