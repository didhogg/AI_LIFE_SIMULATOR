// P7-6d · G3·6.49 指令组锚点快照 pin
//
// 断言② 前置：重掷整组重跑恒等（F1 组内隔离实证）依赖本锚点。
// 锚点 pin = 指令组开始时刻的确定性快照哈希 + 全局纪元分钟锚。
// 同一 groupId 第二次 pin 抛出（pinOnce 语义·防意外覆盖）。
//
// 禁 Date.now / Math.random / 裸 JSON.stringify / localeCompare
import { canonicalize } from './text/canonicalize.js';

// fnv1a32 独立实现（不 import rng.ts·红线）
function fnv1a32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

// ── 指令组锚点快照 ────────────────────────────────────────────────────────────────

/** 指令组锚点快照（G3·6.49）*/
export interface GroupAnchorPin {
  groupId:      string;  // 指令组唯一 ID（调用方生成·禁空串）
  tickId:       string;  // 锚拍号（全局唯一拍 id·幂等键）
  epochMin:     number;  // 锚点纪元分钟（全局时刻·唯一时间真相主键）
  snapshotHash: string;  // 锚点快照 fnv1a32 哈希（canonicalize(snapshot)）
}

/**
 * 生成并 pin 指令组锚点快照。
 *
 * 一次语义：同一 groupId 调用第二次 → throw（防意外覆盖锚点）。
 * 调用方持有 registry（Map<groupId, GroupAnchorPin>），pin 后传入此函数 + registry。
 */
export function pinGroupAnchor(
  registry:  Map<string, GroupAnchorPin>,
  groupId:   string,
  tickId:    string,
  epochMin:  number,
  snapshot:  unknown,
): GroupAnchorPin {
  if (!groupId) throw new Error('pinGroupAnchor: groupId 不得为空串');
  if (registry.has(groupId)) {
    throw new Error(`pinGroupAnchor: groupId「${groupId}」已有锚点，禁止覆盖`);
  }
  const snapshotHash = fnv1a32(canonicalize(snapshot)).toString(16).padStart(8, '0');
  const pin: GroupAnchorPin = { groupId, tickId, epochMin, snapshotHash };
  registry.set(groupId, pin);
  return pin;
}

/**
 * 断言组锚点存在（P7-6g 断言② 前置守卫）。
 * 锚点不存在 → throw（调用方须先 pinGroupAnchor）。
 */
export function assertGroupAnchorExists(
  registry: ReadonlyMap<string, GroupAnchorPin>,
  groupId:  string,
): GroupAnchorPin {
  const pin = registry.get(groupId);
  if (!pin) {
    throw new Error(`assertGroupAnchorExists: groupId「${groupId}」无锚点，须先 pinGroupAnchor`);
  }
  return pin;
}

/**
 * 验证重跑恒等：同一组两次结果的锚点哈希须逐位相同。
 * snapshotA = 首次运行快照；snapshotB = 重跑快照。
 * 返回 true = 逐位恒等；false = 不等（调用方 throw）。
 */
export function verifyGroupReplayIdempotency(
  snapshotA: unknown,
  snapshotB: unknown,
): boolean {
  const hashA = fnv1a32(canonicalize(snapshotA));
  const hashB = fnv1a32(canonicalize(snapshotB));
  return hashA === hashB;
}
