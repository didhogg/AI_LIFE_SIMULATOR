// B5 · S3 受治理键码位规范化（纯·双卡口辅助·接 03d502c）
//
// 读卡口：normalizeRegistryKeyNames — migrate.ts 读入卡口（B5·Step4 已接线）
//   范围：仅对 受治理键空间注册表.键条目[].规范键/别名 和 键空间归并表.归并条目[].别名/规范键 规范化。
//   不波及任意用户数据键（游戏属性/NPC键/事件ID等），不改 object 顶层 key。
//   对既有已规范化数据为 no-op → 指纹/黄金向量零漂移。
//
// 写卡口：assertGovernedKeysNormalized — 纯断言·发现非规范态即返回违例·不静默改写。
//   写卡口已接·migrate.ts:1238（2872c24）。
//
// 红线：不 import rng/hashPresetFingerprint/gate/fingerprintManifest；不碰 hosts/。

import { 规范化键码位 } from '../schema/governedKeySpace.js';

// ── 违例类型（写卡口断言返回） ─────────────────────────────────────────────────

export type GovernedKeyViolation = {
  readonly field: string;       // 字段路径描述 e.g. '受治理键空间注册表.键条目[0].规范键'
  readonly raw: string;         // 原始非规范态值
  readonly normalized: string;  // 规范化后期望值
};

// ── 内部辅助 ─────────────────────────────────────────────────────────────────

function isRec(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function normAliasArray(aliases: unknown): { value: unknown; changed: boolean } {
  if (!Array.isArray(aliases)) return { value: aliases, changed: false };
  let changed = false;
  const result = (aliases as unknown[]).map((a) => {
    if (typeof a !== 'string') return a;
    const n = 规范化键码位(a);
    if (n !== a) changed = true;
    return n;
  });
  return { value: changed ? result : aliases, changed };
}

function normalizeRegistryEntries(registry: unknown): { value: unknown; changed: boolean } {
  if (!isRec(registry)) return { value: registry, changed: false };
  const arr = registry['键条目'];
  if (!Array.isArray(arr) || arr.length === 0) return { value: registry, changed: false };
  let changed = false;
  const newArr = (arr as unknown[]).map((entry) => {
    if (!isRec(entry)) return entry;
    const normKey = typeof entry['规范键'] === 'string' ? 规范化键码位(entry['规范键']) : entry['规范键'];
    const { value: normAlias, changed: aliasChanged } = normAliasArray(entry['别名']);
    const keyChanged = normKey !== entry['规范键'];
    if (!keyChanged && !aliasChanged) return entry;
    changed = true;
    const updated: Record<string, unknown> = { ...entry, 规范键: normKey };
    if (aliasChanged) updated['别名'] = normAlias;
    return updated;
  });
  if (!changed) return { value: registry, changed: false };
  return { value: { ...registry, 键条目: newArr }, changed: true };
}

function normalizeMergeEntries(mergeTable: unknown): { value: unknown; changed: boolean } {
  if (!isRec(mergeTable)) return { value: mergeTable, changed: false };
  const arr = mergeTable['归并条目'];
  if (!Array.isArray(arr) || arr.length === 0) return { value: mergeTable, changed: false };
  let changed = false;
  const newArr = (arr as unknown[]).map((entry) => {
    if (!isRec(entry)) return entry;
    const normAlias = typeof entry['别名'] === 'string' ? 规范化键码位(entry['别名']) : entry['别名'];
    const normKey = typeof entry['规范键'] === 'string' ? 规范化键码位(entry['规范键']) : entry['规范键'];
    const aliasChanged = normAlias !== entry['别名'];
    const keyChanged = normKey !== entry['规范键'];
    if (!aliasChanged && !keyChanged) return entry;
    changed = true;
    return { ...entry, 别名: normAlias, 规范键: normKey };
  });
  if (!changed) return { value: mergeTable, changed: false };
  return { value: { ...mergeTable, 归并条目: newArr }, changed: true };
}

// ── 读卡口 ────────────────────────────────────────────────────────────────────

/**
 * 读卡口：对 rawMigrated 中受治理键空间注册表 + 归并表里的规范键/别名值跑 规范化键码位()。
 * 纯函数·幂等·不改 object 顶层 key·只改注册条目字符串值。
 * 对既有已规范化数据为 no-op → 指纹/黄金向量零漂移。
 */
export function normalizeRegistryKeyNames(raw: Record<string, unknown>): Record<string, unknown> {
  const { value: newReg, changed: rc } = normalizeRegistryEntries(raw['受治理键空间注册表']);
  const { value: newMerge, changed: mc } = normalizeMergeEntries(raw['键空间归并表']);
  if (!rc && !mc) return raw;
  return { ...raw, 受治理键空间注册表: newReg, 键空间归并表: newMerge };
}

// ── 写卡口（纯断言·已接·migrate.ts:1238·2872c24） ───────────────────────────────

function collectRegViolations(registry: unknown, out: GovernedKeyViolation[]): void {
  if (!isRec(registry)) return;
  const arr = registry['键条目'];
  if (!Array.isArray(arr)) return;
  (arr as unknown[]).forEach((entry, i) => {
    if (!isRec(entry)) return;
    if (typeof entry['规范键'] === 'string') {
      const n = 规范化键码位(entry['规范键']);
      if (n !== entry['规范键'])
        out.push({ field: `受治理键空间注册表.键条目[${i}].规范键`, raw: entry['规范键'], normalized: n });
    }
    if (Array.isArray(entry['别名'])) {
      (entry['别名'] as unknown[]).forEach((a, j) => {
        if (typeof a !== 'string') return;
        const n = 规范化键码位(a);
        if (n !== a)
          out.push({ field: `受治理键空间注册表.键条目[${i}].别名[${j}]`, raw: a, normalized: n });
      });
    }
  });
}

function collectMergeViolations(mergeTable: unknown, out: GovernedKeyViolation[]): void {
  if (!isRec(mergeTable)) return;
  const arr = mergeTable['归并条目'];
  if (!Array.isArray(arr)) return;
  (arr as unknown[]).forEach((entry, i) => {
    if (!isRec(entry)) return;
    if (typeof entry['别名'] === 'string') {
      const n = 规范化键码位(entry['别名']);
      if (n !== entry['别名'])
        out.push({ field: `键空间归并表.归并条目[${i}].别名`, raw: entry['别名'], normalized: n });
    }
    if (typeof entry['规范键'] === 'string') {
      const n = 规范化键码位(entry['规范键']);
      if (n !== entry['规范键'])
        out.push({ field: `键空间归并表.归并条目[${i}].规范键`, raw: entry['规范键'], normalized: n });
    }
  });
}

/**
 * 写卡口断言：检查 raw 中受治理键名是否均已规范化。
 * 返回违例列表（空 = 全规范·通过）；不静默改写。
 * 纯函数·确定性·无副作用。供 B6 写卡口活线消费。
 */
export function assertGovernedKeysNormalized(raw: Record<string, unknown>): GovernedKeyViolation[] {
  const violations: GovernedKeyViolation[] = [];
  collectRegViolations(raw['受治理键空间注册表'], violations);
  collectMergeViolations(raw['键空间归并表'], violations);
  return violations;
}
