// REPLAY-01 重放核心 — 纯函数，零副作用，零 LLM 调用
// 断言③: 盐值/路由从 tick_log 记录值重放恒等
import { replayRoute } from '../prompt/index.js';
import type { ReplayTickInput, ReplayTickResult, FailureTicket } from './types.js';

// AA1: 丢弃世代号不等于当前世代的工单（stale 世代 = fork 前 / 悔棋前的在途调用）
function partitionTickets(
  tickets: FailureTicket[],
  currentGeneration: string,
): { valid: FailureTicket[]; discarded: FailureTicket[] } {
  const valid: FailureTicket[] = [];
  const discarded: FailureTicket[] = [];
  for (const t of tickets) {
    (t.callGeneration === currentGeneration ? valid : discarded).push(t);
  }
  return { valid, discarded };
}

// 单拍重放·纯函数·不修改 state·不调用 LLM
export function replayTick(input: ReplayTickInput): ReplayTickResult {
  const { tick_log条目, 当前世代号, 失败工单 } = input;

  // 断言③·N-2: 路由从 tick_log 冻结路由读，绝不读 live 偏好
  const 路由决策 = replayRoute(tick_log条目);

  // 盐值从 tick_log 读（结构性保证：不读 live _存档头.全局回滚计数器）
  const 盐值 = tick_log条目.盐值;

  // AA1: stale 世代工单丢弃
  const { valid: 有效工单, discarded: 丢弃的工单 } = partitionTickets(失败工单, 当前世代号);

  // 断言③验证: replayRoute 输出与 tick_log.路由快照逐字段比对
  const snap = tick_log条目.路由快照;
  const 路由一致 = snap != null
    && 路由决策 != null
    && 路由决策.routedVia === snap.routedVia
    && 路由决策.modelKey === snap.modelKey
    && 路由决策.explicitReason === snap.explicitReason;

  return {
    路由决策,
    盐值,
    路由一致,
    盐值源自tick_log: true, // 结构性保证：仅从 tick_log条目.盐值 读
    丢弃的工单,
    有效工单,
  };
}
