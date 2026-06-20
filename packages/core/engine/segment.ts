// F-c层2: 版本分段机器（单台·U3·版本段⊕难度段共用·D1）
// 段头 = hashCanonical(引擎版本, Schema版本, 难度系数组指纹, 前段哈希)
// 哈希链：段N.前段哈希 = hashCanonical(段N-1.段头指纹)
// 断链→VerifyResult.valid=false → 调用方拒载 + 显式警示（D4）
// 观测史：只搬运·永不重算（C2·additive-only·零迁移）

import { hashCanonical } from './rng.js';

export interface VersionSegmentHead {
  段序号:           number;
  引擎版本?:        string;
  Schema版本?:      string;
  /** hashCanonical over (引擎版本, Schema版本, 难度系数组指纹, 前段哈希) */
  段头指纹:         string;
  /** hashCanonical(prev 段头指纹); genesis = '' */
  前段哈希:         string;
  /** M6·C5: difficulty coefficient snapshot fingerprint */
  难度系数组指纹?:  string;
}

export interface SegmentVerifyResult {
  valid:      boolean;
  /** Index of first broken link (1-based segment index in array) */
  brokenAt?:  number;
  message?:   string;
}

/** Deterministic hash for a segment head (excludes 段头指纹 to avoid self-reference). */
export function computeSegmentHeadHash(params: {
  引擎版本?:       string;
  Schema版本?:     string;
  难度系数组指纹?: string;
  前段哈希:        string;
}): string {
  return hashCanonical(params);
}

/**
 * Append a new segment record to 版本段记录. Pure function — returns updated array.
 * Genesis segment: call with empty/undefined 版本段记录 and first version params.
 */
export function openSegment(
  存档头: { 版本段记录?: VersionSegmentHead[] },
  params: { 引擎版本?: string; Schema版本?: string; 难度系数组指纹?: string },
): VersionSegmentHead[] {
  const records = 存档头.版本段记录 ?? [];
  const prevHead = records.length > 0 ? records[records.length - 1]! : null;
  const 前段哈希 = prevHead ? hashCanonical(prevHead.段头指纹) : '';
  const 段序号 = records.length;
  const hashParams: Parameters<typeof computeSegmentHeadHash>[0] = { 前段哈希 };
  if (params.引擎版本 !== undefined) hashParams.引擎版本 = params.引擎版本;
  if (params.Schema版本 !== undefined) hashParams.Schema版本 = params.Schema版本;
  if (params.难度系数组指纹 !== undefined) hashParams.难度系数组指纹 = params.难度系数组指纹;
  const 段头指纹 = computeSegmentHeadHash(hashParams);
  const newSeg: VersionSegmentHead = { 段序号, 段头指纹, 前段哈希 };
  if (params.引擎版本 !== undefined) newSeg.引擎版本 = params.引擎版本;
  if (params.Schema版本 !== undefined) newSeg.Schema版本 = params.Schema版本;
  if (params.难度系数组指纹 !== undefined) newSeg.难度系数组指纹 = params.难度系数组指纹;
  return [...records, newSeg];
}

/**
 * Verify hash chain integrity of 版本段记录.
 * Any broken link → valid=false + brokenAt index + human-readable message.
 * On load: if !result.valid → refuse load + display result.message (D4).
 */
export function verifySegmentChain(
  存档头: { 版本段记录?: VersionSegmentHead[] },
): SegmentVerifyResult {
  const records = 存档头.版本段记录 ?? [];
  for (let i = 1; i < records.length; i++) {
    const expected = hashCanonical(records[i - 1]!.段头指纹);
    if (records[i]!.前段哈希 !== expected) {
      return {
        valid: false,
        brokenAt: i,
        message: `版本段哈希链在段 ${i} 断链·前段哈希 ${records[i]!.前段哈希} ≠ 预期 ${expected}·拒载`,
      };
    }
  }
  return { valid: true };
}

/**
 * Decide whether to open a new segment for the current load.
 * Returns true if any version or difficulty dimension changed vs the last segment.
 * Genesis (no segments recorded): always returns true.
 */
export function shouldOpenNewSegment(
  存档头: { 版本段记录?: VersionSegmentHead[] },
  current: { 引擎版本?: string; Schema版本?: string; 难度系数组指纹?: string },
): boolean {
  const records = 存档头.版本段记录 ?? [];
  if (records.length === 0) return true;
  const last = records[records.length - 1]!;
  return (
    last.引擎版本 !== current.引擎版本 ||
    last.Schema版本 !== current.Schema版本 ||
    last.难度系数组指纹 !== current.难度系数组指纹
  );
}
