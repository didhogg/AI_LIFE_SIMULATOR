// 金融守恒断言 — core 权威实现（纯函数·零副作用·与债务模型解耦）
// 净值口径由注入的 getNetAsset 全权决定；core 不解析 _负债/_应收 等任何字段语义。
// 风格对齐 engine/assertFinite.ts（自定义 Error + throw）。
// slice 侧 assertTrialBalance / soak assertConservation 是 demo 适配层，本函数是 core 权威；
// slice rewire 到本函数属临界步（触 hosts/**），留独立 ALERT 批（P0-7）。
export class ConservationError extends Error {
    detail;
    constructor(message, detail) {
        super(message);
        this.name = 'ConservationError';
        this.detail = detail;
    }
}
/**
 * Assert Σ getNetAsset(account) over all entities === expectedNetAsset.
 *
 * Throws {@link ConservationError} on violation with per-entity diagnostics.
 * Keys are iterated in Unicode code-point order for deterministic output.
 *
 * Pure function: no I/O, no mutation, no wall-clock, no randomness.
 */
export function assertConservation(accounts, expectedNetAsset, getNetAsset) {
    const keys = [...Object.keys(accounts)].sort(); // 码点序·确定性·禁 localeCompare
    const perEntity = keys.map((key) => ({ key, netAsset: getNetAsset(accounts[key]) }));
    const actual = perEntity.reduce((sum, e) => sum + e.netAsset, 0);
    if (actual !== expectedNetAsset) {
        throw new ConservationError(`守恒断言失败: Σ净值 ${actual} ≠ 期望 ${expectedNetAsset}`, { expected: expectedNetAsset, actual, perEntity });
    }
}
