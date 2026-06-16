// 互斥组/probability 确定性总纲（对撞 4-G·最重要）
// 禁 Math.random()——winner 走锚拍号的 seeded RNG（排除墙钟/提交序）
// 盐值记 tick_log（参见 TickLogEntrySchema.盐值）

import { rngFor } from './rng.js';

/** 互斥组胜出者·seeded deterministic pick（未实装完整版本·P0 仅 stub 签名） */
export function pickMutuallyExclusive(
  candidates: string[],
  _tickId:    string,
  tickCount:  number,
  channel:    string,
  salt:       number,
): string {
  if (candidates.length === 0) throw new Error('互斥组候选为空');
  if (candidates.length === 1) return candidates[0]!;
  const roll = rngFor(salt, tickCount, channel, 0);
  return candidates[roll % candidates.length]!;
}

/** 概率门控·seeded deterministic（未实装完整版本·P0 仅 stub 签名） */
export function rollProbability(
  probability: number, // [0,1]
  _tickId:     string,
  tickCount:   number,
  channel:     string,
  salt:        number,
): boolean {
  if (probability <= 0) return false;
  if (probability >= 1) return true;
  const roll = rngFor(salt, tickCount, channel, 0);
  return roll < Math.round(probability * 100);
}
