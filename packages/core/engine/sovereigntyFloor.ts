// H-c-3: 主权降级「需确认」fire
// P1 自动代写重大不可逆决策安全地板（死亡/婚姻/血脉绑定/绑架/永久失核心资产）
// 主权地板事件集 ← securityBoundary.ts·子域3（常量已锁·零改）
// 红线：不 import rng.ts / gate.ts / fixed.ts

import {
  主权地板事件,
  type 主权地板事件名,
} from '../interfaces/securityBoundary.js';

/** 主权降级授权级别（与 verb.ts 不可逆Schema.主权降级 字段同口径） */
export type 主权授权 = '需确认' | '凌驾抢话档' | undefined;

/** 主权地板检查结果 */
export interface SovereigntyCheckResult {
  readonly blocked: boolean;           // true = 拦截·拒绝继续
  readonly eventType: string;
  readonly required: '凌驾抢话档' | null; // 所需最低授权级别
  readonly reason?: string;
}

/**
 * H-c-3: 检查动作是否触碰主权地板。
 *
 * 主权地板事件集（子域3 securityBoundary.ts:39）：
 *   ['死亡', '婚姻', '血脉绑定', '绑架', '永久失核心资产']
 *
 * 规则：
 *   · 事件不在集合 → blocked=false（直通）
 *   · 事件在集合 + authorization='凌驾抢话档' → blocked=false（玩家已明确授权·放行）
 *   · 事件在集合 + authorization≠'凌驾抢话档' → blocked=true（拦截·必须先取得授权）
 *
 * @param eventType     触发的事件类型字符串
 * @param authorization 当前已持有的授权级别（来源：不可逆Schema.主权降级）
 */
export function checkSovereigntyFloor(
  eventType: string,
  authorization: 主权授权,
): SovereigntyCheckResult {
  const isFloor = (主权地板事件 as readonly string[]).includes(eventType);
  if (!isFloor) {
    return { blocked: false, eventType, required: null };
  }
  if (authorization === '凌驾抢话档') {
    return { blocked: false, eventType, required: '凌驾抢话档' };
  }
  return {
    blocked: true,
    eventType,
    required: '凌驾抢话档',
    reason: `主权地板[H-c-3]: 事件「${eventType}」须玩家「凌驾抢话档」明确授权（当前: ${authorization ?? '未设置'}）`,
  };
}

/**
 * P1 安全地板自动代写：为主权地板事件强制插入「凌驾抢话档」授权占位。
 * 仅供 P1 AI 代写场景；玩家主动操作流程须走 checkSovereigntyFloor + 明确确认。
 * 非地板事件时直接返回原值。
 */
export function autoFloorAuthorization(
  eventType: string,
  current: 主权授权,
): 主权授权 {
  if (
    (主权地板事件 as readonly string[]).includes(eventType) &&
    current !== '凌驾抢话档'
  ) {
    return '凌驾抢话档'; // P1 自动代写安全地板
  }
  return current;
}

/** 判断给定字符串是否为主权地板事件 */
export function isFloorEvent(eventType: string): eventType is 主权地板事件名 {
  return (主权地板事件 as readonly string[]).includes(eventType);
}
