// DSL AI 创作层 — 谓词三层控制 resolver
// 纯函数·确定性·零 AI import·零 eval.ts 改动
// 铁律：求值器永不调 AI。本模块只决定「喂哪条串给 evalPredStr」。
// 三层优先级（高→低）：作者底线(false=红线锁死) > 玩家三态 > 全局开关
// 完整键格式：lore:{ns}:{id} / effectPack:{pack_id} / tool:{name} / achievement:{id}
// 六禁：禁 Date.now/new Date/Math.random/window/document/localeCompare
/**
 * 从三层控制解析谓词求值有效串（纯函数·确定性·无副作用）。
 *
 * 优先级规则：
 *   ① 作者控制表[key] === false → 永远返回 base（红线·玩家不可放开）
 *   ② 有效开关 = 玩家控制表[key] ?? 作者控制表[key] ?? 全局开关
 *   ③ 有效开关 OFF → base；ON → override表[key] ?? base（缺失 fail-safe 回 base）
 *
 * @param 完整键  谓词条目稳定键（lore:{ns}:{id} / effectPack:{pack_id} / tool:{name} / achievement:{id}）
 * @param base    条目声明的基础谓词串（来自 schema 字段·未命中则返回此值）
 * @param 全局开关 _系统.功能开关表['DSL受AI控制'] ?? true（passthrough·缺省开启）
 * @param 作者控制表 resolve() 聚合的 AI控制策略 map（false=红线锁死·true=明示允许·undefined=透传给下层）
 * @param 玩家控制表 $AI创作状态.条目AI控制表（玩家三态覆盖·进存档·不进指纹）
 * @param override表  $AI创作状态.谓词override表（AI 产物·进重放·进存档·铁律③）
 */
export function resolveEffectivePredicate(完整键, base, 全局开关, 作者控制表, 玩家控制表, override表) {
    // ① 作者红线：false 不可破（玩家覆盖无效）
    if (作者控制表?.[完整键] === false)
        return base;
    // ② 三态叠加：玩家 > 作者 > 全局
    const 有效开关 = 玩家控制表?.[完整键] ?? 作者控制表?.[完整键] ?? 全局开关;
    // ③ override 缺失 → fail-safe 回 base
    return 有效开关 ? (override表?.[完整键] ?? base) : base;
}
/**
 * 从 passthrough 功能开关表读取全局 DSL AI 控制开关。
 * 字段不存在 → 缺省 true（开启状态·向后兼容）。
 */
export function readGlobalDslSwitch(功能开关表) {
    const v = 功能开关表['DSL受AI控制'];
    return v === undefined ? true : Boolean(v);
}
