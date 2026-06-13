/* eslint-disable @typescript-eslint/no-unused-vars */
// P0-1x·CombatResolver 接口冻结 stub（6.63·🔴卡 P0-7 实装）
// 战局状态外置住 $战斗暂存（顶层键·不游离快照外）
// 参与方[]/意图(开放串)/回合事件[] 三处泛化
// 平局按节点键字典序；接线时签名不得变更

import type { $战斗暂存Type } from '../schema/index.js';

export type 五档 = '大胜' | '胜' | '惨胜' | '败' | '溃';

// 战局状态 = $战斗暂存（外置住存档顶层键）
export type 战局状态 = $战斗暂存Type;

export interface CombatSettleResult {
  五档: 五档;
  伤害: number;
  状态变更: string[];
}

export const CombatResolver = {
  /** 初始化战局：生成初始战局状态（写入 $战斗暂存） */
  init(_参与方: string[], _环境: string, _seed: number): 战局状态 {
    throw new Error('未实装');
  },

  /** 推进一回合：消费意图+外部事件，返回新战局状态与回合事件列表 */
  step(
    _战局状态: 战局状态,
    _意图: string[],
    _外部事件: string[],
  ): { 战局状态: 战局状态; 回合事件: string[] } {
    throw new Error('未实装');
  },

  /** 结算战局：返回五档结果/伤害/状态变更；调用后清空 $战斗暂存 */
  settle(_战局状态: 战局状态): CombatSettleResult {
    throw new Error('未实装');
  },
};
