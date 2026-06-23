export function deriveVerbDelta(envelope, state, seatId) {
    const 提案 = envelope.提案;
    // future-registry: G4 verb handler 注册表就位时迁移至 callRegistry 路由
    switch (提案.动作类别) {
        case '转移':
            return derive转移(提案, state, seatId);
        case '缔结':
            // TODO: 缔结 → _应收/_负债 双边（G4/PR-2 缔约库就绪时实装）
            return [];
        case '解除':
            // TODO: 解除 → 撤销缔约（G4 就绪时实装）
            return [];
        case '赋予':
            return derive赋予(提案, state, seatId);
        case '剥夺':
            // TODO: 剥夺 → 物品强制回收（G4 就绪时实装）
            return [];
        case '调整':
            // TODO: 调整 → 数值属性直接改写（G4 就绪时实装）
            return [];
        case '披露':
            // TODO: 披露 → 秘密暴露度写回（G4 access 场读数就绪时实装）
            return [];
        case '移动':
            // TODO: 移动 → 位置/区域变更（G4 就绪时实装）
            return [];
        case '施加':
            // TODO: 施加 → 状态效果附加（G4 就绪时实装）
            return [];
        case '植入':
            // TODO: 植入 → 认知层事实注入（T1 真相层就绪时实装）
            return [];
        default:
            // 未知动词 → no-op（防静默漏账）
            return [];
    }
}
function derive转移(提案, state, seatId) {
    const amt = 提案.数值槽;
    if (amt === undefined || amt <= 0)
        return [];
    const receiver = 提案.目标引用;
    if (!receiver || !seatId || receiver === seatId)
        return [];
    // 币种：取基准币种；空串 → no-op（多币种支持留后续 additive）
    const ccy = state.货币系统?.基准币种 ?? '';
    if (!ccy)
        return [];
    // 双方必须已持有该币种键；缺键 gated init 留后续 additive
    const accounts = (state.货币系统?.账户 ?? {});
    const payerHolding = accounts[seatId]?.持有 ?? {};
    const receiverHolding = accounts[receiver]?.持有 ?? {};
    if (!(ccy in payerHolding) || !(ccy in receiverHolding))
        return [];
    // 方向固定：支出方向（seatId sub / receiver add）
    // 收款方向 / 其他方向枚举值留后续 additive
    const payerPath = `货币系统.账户.${seatId}.持有.${ccy}`;
    const receiverPath = `货币系统.账户.${receiver}.持有.${ccy}`;
    const pack = [
        { path: payerPath, op: 'sub', value: amt },
        { path: receiverPath, op: 'add', value: amt },
    ];
    return [pack];
}
/**
 * derive赋予 — SINK-balanced production path (阶段1·additive)
 *
 * 语义：seatId = 显式 SINK 来源方（world_sink 或指定捐赠方）；
 *       提案.目标引用 = 受赠方（recipient）。
 * 守恒：SINK 持有[ccy] -= amt · recipient 持有[ccy] += amt → Σ净值不变。
 * 约束：SINK 账户键须无 _ 或 $ 前缀（computeDelta Gate③）·双方须已持有基准币种。
 */
function derive赋予(提案, state, seatId) {
    const amt = 提案.数值槽;
    if (amt === undefined || amt <= 0)
        return [];
    const recipient = 提案.目标引用;
    if (!recipient || !seatId || recipient === seatId)
        return [];
    const ccy = state.货币系统?.基准币种 ?? '';
    if (!ccy)
        return [];
    const accounts = (state.货币系统?.账户 ?? {});
    const sinkHolding = accounts[seatId]?.持有 ?? {};
    const recipientHolding = accounts[recipient]?.持有 ?? {};
    if (!(ccy in sinkHolding) || !(ccy in recipientHolding))
        return [];
    const sinkPath = `货币系统.账户.${seatId}.持有.${ccy}`;
    const recipientPath = `货币系统.账户.${recipient}.持有.${ccy}`;
    const pack = [
        { path: sinkPath, op: 'sub', value: amt },
        { path: recipientPath, op: 'add', value: amt },
    ];
    return [pack];
}
