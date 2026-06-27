/**
 * 从 RootState 投影 DSL v1.0 求值上下文（纯·只读·确定性）。
 *
 * 命名空间（path max 2）：
 *   · 属性       = NPC[entityKey].属性   — 体质/智慧/感知/魅力/心理 等 number 轴
 *   · 技能       = NPC[entityKey].技能   — 各技能键→等级（number）
 *   · 账户       = 货币系统.账户[entityKey].持有 — 币种→余额（number）
 *   · 全局       = { 拍计数, 纪元分钟 }  — 始终可用
 *   · 自定义变量 = NPC[entityKey].扩展参数（数字型键·P9-3·串/布尔 skip）
 *
 * scope 缺省或 entityKey 对应 NPC 不存在 → 属性/技能/账户/自定义变量 = {}
 * 路径 miss → resolvePath 返回 0 → 谓词 fail-closed（evalPred 内已保证）
 */
export function projectStateCtx(state, scope) {
    const entityKey = scope?.entityKey;
    const npc = entityKey ? state.NPC[entityKey] : undefined;
    // 属性：NPC.属性 是固定键 object → 强转 Record<string,number>（schema 保证均为 number）
    const 属性 = npc?.属性 ? npc.属性 : {};
    // 技能：z.record(key, 技能条目) → 提取 .等级（number）
    const 技能Rec = {};
    if (npc?.技能) {
        for (const [k, v] of Object.entries(npc.技能)) {
            if (v !== null && typeof v === 'object' && typeof v.等级 === 'number') {
                技能Rec[k] = v.等级;
            }
        }
    }
    const 技能 = 技能Rec;
    // 账户：货币系统.账户[entityKey].持有 = z.record(账户键, number) → 直通
    const 账户 = entityKey
        ? (state.货币系统?.账户?.[entityKey]?.持有 ?? {})
        : {};
    // 全局：拍计数 + 纪元分钟（record·非求和）
    const 全局 = {
        拍计数: state._tick?.拍计数 ?? 0,
        纪元分钟: state.世界?.纪元分钟 ?? 0,
    };
    // 自定义变量：NPC.扩展参数 数字型键（串/布尔 skip·事实层·P9-3）
    // path = 自定义变量.<键>（2 段·符合 DSL v1 限深约束）
    const 自定义变量Rec = {};
    if (npc?.扩展参数) {
        for (const [k, v] of Object.entries(npc.扩展参数)) {
            if (typeof v === 'number')
                自定义变量Rec[k] = v;
        }
    }
    const 自定义变量 = 自定义变量Rec;
    return { 属性, 技能, 账户, 全局, 自定义变量 };
}
