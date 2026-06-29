// 路径模板占位符解析
// 支持：{seatId} / {target} / {ccy} / {关联实体.N}（N 为非负整数索引）
function resolvePathTmpl(tmpl, seatId, target, ccy, 关联实体) {
    let failed = false;
    const path = tmpl.replace(/\{([^}]+)\}/g, (_, key) => {
        if (key === 'seatId')
            return seatId;
        if (key === 'target')
            return target;
        if (key === 'ccy')
            return ccy;
        const m = /^关联实体\.(\d+)$/.exec(key);
        if (m) {
            const v = 关联实体[Number(m[1])];
            if (v === undefined) {
                failed = true;
                return '';
            }
            return v;
        }
        failed = true;
        return '';
    });
    if (failed)
        return null;
    // 不得含空路径段（占位符解析为空串 or 模板本身含连续点号）
    if (path.split('.').some(s => s === ''))
        return null;
    return path;
}
export function deriveVerbDelta(envelope, state, seatId) {
    const 提案 = envelope.提案;
    const decls = 提案.effect_decls;
    // 无 effect_decls → 可观测 no-op（mod/预设作者须在 option 里声明 effect_decls）
    if (!decls || decls.length === 0)
        return [];
    const ccy = state.货币系统?.基准币种 ?? '';
    const target = 提案.目标引用;
    const 关联 = 提案.关联实体;
    const entries = [];
    for (const decl of decls) {
        const path = resolvePathTmpl(decl.path_tmpl, seatId, target, ccy, 关联);
        if (path === null)
            continue; // 占位符无法解析 → 跳过此条
        // value 来源映射：数值槽取提案运行值，常量取声明值
        const rawVal = decl.value_src === '数值槽' ? 提案.数值槽 : decl.value;
        if (rawVal === undefined)
            continue;
        // add/sub 要求整数（computeDelta 亦校验；此处提前 guard 防浮点混入）
        if ((decl.op === 'add' || decl.op === 'sub') && !Number.isInteger(rawVal))
            continue;
        const entry = decl.max_delta !== undefined
            ? { path, op: decl.op, value: rawVal, max_delta: decl.max_delta }
            : { path, op: decl.op, value: rawVal };
        entries.push(entry);
    }
    if (entries.length === 0)
        return [];
    // 单包：一条提案所有 effect_decls 产出的 entries 归一包（过闸时原子处理）
    return [entries];
}
