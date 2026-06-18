// REPLAY-01 · §九 十类输入集（冻结 2026-06-15）
// 重放核心: 从初始快照出发，逐拍喂入，纯函数重跑，比对路由/盐值（断言③）
// LLM 全短路读账（不重调模型·读失败工单/落账记录）

import type { RootState } from '../schema/index.js';
import type { TickLogEntry } from '../schema/system.js';
import type { ModelRouteDecision } from '../prompt/index.js';
import type { FailureTicketType } from '../schema/proposal.js';

// ── §九 十类输入集 ─────────────────────────────────────────────────────────────

/** ⑦ 外部注入序·本拍到达的外部事件 */
export interface ExternalInjection {
  tickId: string;
  payload: unknown;
}

/** ⑤ 失败工单·LLM 调用短路用·callGeneration 供 AA1 stale 丢弃判断
 *  单源派生自 proposal.ts 失败工单条目Schema（禁两份手维护）*/
export type FailureTicket = FailureTicketType;

/** ⑧ 选择器 extensional 展开落账·预录 LLM 输出 */
export interface AccountingRecord {
  tickId: string;
  callGeneration: string;
  result: unknown;
}

/** 单拍重放输入（十类输入中适用于单拍的全部分量） */
export interface ReplayTickInput {
  /** ① 初始快照·本拍前的状态快照（⑨⑩ 观测值表/域累计活跃区间从此推导） */
  初始快照: RootState;
  /** ② 指纹取材集·调用方预计算后传入（hashPresetFingerprint 输出） */
  预设指纹: string;
  /** ③ 意图序列·本拍意图标签；txnGroup 标注 AA1 事务组边界 */
  意图标签: string[];
  txnGroup?: string;
  /** ④ 盐值从 tick_log 条目读·绝不读 live _存档头.全局回滚计数器 */
  tick_log条目: TickLogEntry;
  /** ⑤ 失败工单（本拍相关） */
  失败工单: FailureTicket[];
  /** ⑥ 调用世代号（AA1 当前世代·用于丢弃 stale 工单） */
  当前世代号: string;
  /** ⑦ 外部注入序（本拍到达的外部事件） */
  外部注入序: ExternalInjection[];
  /** ⑧ 落账记录（选择器 extensional 展开·预录） */
  落账记录: AccountingRecord[];
}

/** 单拍重放结果 */
export interface ReplayTickResult {
  /** N-2: 路由决策从 tick_log 冻结路由读，绝不读 live 偏好 */
  路由决策: ModelRouteDecision | null;
  /** 盐值·从 tick_log 条目读（断言④: 不读 live _存档头.全局回滚计数器） */
  盐值: number | undefined;
  /** 断言③: 路由与 tick_log 路由快照逐位恒等 */
  路由一致: boolean;
  /** 盐值来源确认·永远为 true（由实现结构保证） */
  盐值源自tick_log: boolean;
  /** AA1 世代号过滤结果 */
  丢弃的工单: FailureTicket[];
  有效工单: FailureTicket[];
}

/** 三场景类型标注（端到端测试用） */
export type ReplayScenario = '悔棋后旧任务迟到' | 'fork瞬间在途AA1丢弃' | '快进多任务乱序';
