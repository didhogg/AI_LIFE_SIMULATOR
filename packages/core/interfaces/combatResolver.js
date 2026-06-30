/* eslint-disable @typescript-eslint/no-unused-vars */
// P0-1x·CombatResolver 接口冻结 stub（6.63·🔴卡 P0-7 实装）
// P7-6e: 调用点按三段契约签名写死 + 回合边界外部事件最小载荷注入（R1/R3）
// 战局状态外置住 $战斗暂存（顶层键·不游离快照外）
// 参与方[]/意图(开放串)/回合事件[] 三处泛化
// 平局按节点键字典序；接线时签名不得变更
export const CombatResolver = {
    /**
     * 初始化战局：生成初始战局状态（写入 $战斗暂存）。
     * P7-6e R1: 签名冻结·调用点须严格按此三参签名调用。
     * _seed: 拍首快照锚种子（R5 确定性·G3 锚点 pin 来源）。
     */
    init(_参与方, _环境, _seed) {
        throw new Error('未实装');
    },
    /**
     * 推进一回合：消费意图 + 外部事件，返回新战局状态与回合事件列表。
     * P7-6e R1/R3: 签名冻结·外部事件走 ExternalRoundEvent[]（最小载荷）。
     */
    step(_战局状态, _意图, _外部事件) {
        throw new Error('未实装');
    },
    /**
     * 结算战局：返回五档结果/伤害/状态变更；调用后清空 $战斗暂存。
     * P7-6e R1: settle 任意回合可调（不强制跑满 N 回合·签名冻）。
     */
    settle(_战局状态) {
        throw new Error('未实装');
    },
};
