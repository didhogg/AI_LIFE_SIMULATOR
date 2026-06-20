// G7: 死亡拦截器引擎级硬顶 — 一次死亡至多拦截一次
// 单次扫描取首命中即停·禁多重拦截叠加
// 触发通道: '天命:生死判定' (rng.ts FATE_PREFIX 规范·天命通道专属)
// 接线点: 宿主收到「发起死亡拦截扫描」效果指令后调用此函数
// 红线: 不 import rng.ts / gate.ts / fixed.ts
/** 死亡拦截专用触发标识（G7 协议·区分普通 trigger DSL·天命通道命名规范） */
export const DEATH_INTERCEPT_TRIGGER = '天命:生死判定';
/**
 * G7: 扫描死亡拦截包 — 单次扫描取首命中即停。
 *
 * 返回首个命中拦截包的 pack_id；无命中返回 null。
 *
 * 硬顶纪律：
 *   · 每次死亡事件只允许一次拦截（一次死亡≤1拦截·不叠加）。
 *   · 宿主负责按优先级降序排列 packs；本函数只取 first hit。
 *   · 纯函数·不调 LLM·不产生副作用·确定性。
 */
export function scanDeathIntercept(packs) {
    for (const pack of packs) {
        if (pack.trigger === DEATH_INTERCEPT_TRIGGER) {
            return pack.pack_id; // 首命中即停
        }
    }
    return null;
}
