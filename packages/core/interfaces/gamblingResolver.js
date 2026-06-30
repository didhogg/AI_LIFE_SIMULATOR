/* eslint-disable @typescript-eslint/no-unused-vars */
// P0-1x·赌局Resolver 接口冻结 stub（6.31·🔴卡 P0-7 实装）
// 与 CombatResolver 同构可替换；settle 输出同形（五档/伤害/状态变更）
export const 赌局Resolver = {
    /** 解算赌局：参与者列表/赌注描述/玩法键 → 五档同形结算结果 */
    resolve(_参与者, _赌注, _玩法) {
        throw new Error('未实装');
    },
};
