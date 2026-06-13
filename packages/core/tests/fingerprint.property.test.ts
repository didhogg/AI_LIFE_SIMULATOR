/**
 * AA6 指纹取材集双向 property 测试（gate）。
 * 遍历枚举表全部条目，确保：
 *   (A) 成员变 → 指纹变      — 每个已入册字段改动都会改变指纹
 *   (B) 排除员变 → 指纹不变   — 排除名单字段改动不影响指纹
 *   (C) 双跑逐位恒等           — 同一组输入两次运行输出完全相同；canonicalize 防键序假阳性
 */
import { describe, it, expect } from 'vitest';
import { hashPresetFingerprint, rngFor } from '../engine/rng.js';
import { canonicalize } from '../engine/text/canonicalize.js';
import {
  FINGERPRINT_PRESET_FIELDS,
  FINGERPRINT_SNAPSHOT_FIELDS,
  FINGERPRINT_EXCLUDED_FIELDS,
} from '../engine/fingerprintManifest.js';

// ── Fixtures ─────────────────────────────────────────────────────────────────

/** Base preset-group values */
const BASE_PRESET = {
  检定配方表: { 魅力: { 主属性: '魅力', 副属性: [] } },
  检定档切分表: { 大胜下限: 40, 胜下限: 15, 惨胜下限: 1, 败下限: -24 },
};

/** Base snapshot-group values */
const BASE_SNAPSHOT: {
  难度系数组: unknown;
  判定骰型: 100 | 20;
  暴击映射?: unknown;
  钳制表: unknown;
} = {
  难度系数组: { 基础DC: 50 },
  判定骰型: 100,
  暴击映射: undefined,
  钳制表: {},
};

/**
 * FullCtx: preset + snapshot fields + excluded fields in one flat object.
 * fingerprintOf() picks only the enrolled fields — excluded ones are invisible to it.
 */
type FullCtx = {
  检定配方表: unknown;
  检定档切分表: unknown;
  难度系数组: unknown;
  判定骰型: 100 | 20;
  暴击映射?: unknown;
  钳制表: unknown;
  [key: string]: unknown;
};

const BASE_CTX: FullCtx = {
  ...BASE_PRESET,
  ...BASE_SNAPSHOT,
  // Excluded fields at representative baseline values:
  显骰: false,
  叙事分发表: {},
  媒介登记表: {},
  叙事偏好: '',
  演出层草稿计数: 0,
  叙事密度档: '中',
  启用文风键: [],
};

/** Extract fingerprint from a FullCtx — reads ONLY the two enrolled groups. */
function fingerprintOf(ctx: FullCtx): string {
  return hashPresetFingerprint({
    preset: {
      检定配方表: ctx['检定配方表'],
      检定档切分表: ctx['检定档切分表'],
    },
    snapshot: {
      难度系数组: ctx['难度系数组'],
      判定骰型: ctx['判定骰型'] as 100 | 20,
      暴击映射: ctx['暴击映射'],
      钳制表: ctx['钳制表'],
    },
  });
}

// ── Mutations ────────────────────────────────────────────────────────────────
// One distinct changed value per enrolled field; must differ meaningfully from BASE_CTX.

const PRESET_MUTATIONS: Record<FingerprintPresetField, unknown> = {
  检定配方表: { 力量: { 主属性: '力量', 副属性列: [] } },
  检定档切分表: { 大胜下限: 35, 胜下限: 15, 惨胜下限: 1, 败下限: -24 },
};
// Satisfying Record<FingerprintPresetField> ensures a compile-error if the preset manifest
// gains a new field without a corresponding mutation entry.
type _PresetMutationsExhaustive = typeof PRESET_MUTATIONS extends Record<
  FingerprintPresetField,
  unknown
>
  ? true
  : never;
const _checkPreset: _PresetMutationsExhaustive = true;
void _checkPreset;

const SNAPSHOT_MUTATIONS: Record<FingerprintSnapshotField, unknown> = {
  难度系数组: { 基础DC: 70 },
  判定骰型: 20 as 100 | 20,
  暴击映射: { 胜转大胜阈值: 90 }, // from undefined → object (B1b field reserved)
  钳制表: { 按重要等级: { 路人: 10 } },
};
type _SnapshotMutationsExhaustive = typeof SNAPSHOT_MUTATIONS extends Record<
  FingerprintSnapshotField,
  unknown
>
  ? true
  : never;
const _checkSnapshot: _SnapshotMutationsExhaustive = true;
void _checkSnapshot;

const EXCLUDED_MUTATIONS: Record<FingerprintExcludedField, unknown> = {
  显骰: true,
  叙事分发表: { route: 'audio' },
  媒介登记表: { template: 'haiku' },
  叙事偏好: '希望更多战斗场景',
  演出层草稿计数: 7,
  叙事密度档: '高',
  启用文风键: ['武侠', '玄幻'],
};
type _ExcludedMutationsExhaustive = typeof EXCLUDED_MUTATIONS extends Record<
  FingerprintExcludedField,
  unknown
>
  ? true
  : never;
const _checkExcluded: _ExcludedMutationsExhaustive = true;
void _checkExcluded;

type FingerprintPresetField = (typeof FINGERPRINT_PRESET_FIELDS)[number];
type FingerprintSnapshotField = (typeof FINGERPRINT_SNAPSHOT_FIELDS)[number];
type FingerprintExcludedField = (typeof FINGERPRINT_EXCLUDED_FIELDS)[number];

// ── Gate A: 成员变 → 指纹变 ────────────────────────────────────────────────

describe('AA6 gate A: 预设整包成员变 → 指纹变', () => {
  for (const field of FINGERPRINT_PRESET_FIELDS) {
    it(`preset.${field} 改变 → 指纹改变`, () => {
      const base = fingerprintOf(BASE_CTX);
      const mutated: FullCtx = { ...BASE_CTX, [field]: PRESET_MUTATIONS[field as FingerprintPresetField] };
      expect(fingerprintOf(mutated)).not.toBe(base);
    });
  }
});

describe('AA6 gate A: 快照锁定成员变 → 指纹变', () => {
  for (const field of FINGERPRINT_SNAPSHOT_FIELDS) {
    it(`snapshot.${field} 改变 → 指纹改变`, () => {
      const base = fingerprintOf(BASE_CTX);
      const mutated: FullCtx = { ...BASE_CTX, [field]: SNAPSHOT_MUTATIONS[field as FingerprintSnapshotField] };
      expect(fingerprintOf(mutated)).not.toBe(base);
    });
  }
});

// ── Gate B: 排除员变 → 指纹不变 ─────────────────────────────────────────────

describe('AA6 gate B: 排除名单成员变 → 指纹不变', () => {
  for (const field of FINGERPRINT_EXCLUDED_FIELDS) {
    it(`excluded.${field} 改变 → 指纹不变`, () => {
      const base = fingerprintOf(BASE_CTX);
      const mutated: FullCtx = { ...BASE_CTX, [field]: EXCLUDED_MUTATIONS[field as FingerprintExcludedField] };
      expect(fingerprintOf(mutated)).toBe(base);
    });
  }
});

// ── Gate C: 双跑逐位恒等 ──────────────────────────────────────────────────────

describe('AA6 gate C: 双跑逐位恒等 + canonicalize 防键序假阳性', () => {
  it('canonicalize: 键序不同的等值对象 → 相同规范形', () => {
    const objA = { z: 2, preset: BASE_PRESET, snapshot: BASE_SNAPSHOT };
    const objB = { preset: BASE_PRESET, snapshot: BASE_SNAPSHOT, z: 2 };
    expect(canonicalize(objA)).toBe(canonicalize(objB));
  });

  it('hashPresetFingerprint 双跑逐位恒等', () => {
    const input = { preset: BASE_PRESET, snapshot: BASE_SNAPSHOT };
    expect(hashPresetFingerprint(input)).toBe(hashPresetFingerprint(input));
  });

  it('hashPresetFingerprint 键序无关: 乱序输入 → 相同指纹', () => {
    const h1 = hashPresetFingerprint({
      preset: { 检定配方表: BASE_PRESET.检定配方表, 检定档切分表: BASE_PRESET.检定档切分表 },
      snapshot: { 难度系数组: { 基础DC: 50 }, 判定骰型: 100, 钳制表: {} },
    });
    const h2 = hashPresetFingerprint({
      preset: { 检定档切分表: BASE_PRESET.检定档切分表, 检定配方表: BASE_PRESET.检定配方表 },
      snapshot: { 钳制表: {}, 判定骰型: 100, 难度系数组: { 基础DC: 50 } },
    });
    expect(h1).toBe(h2);
  });

  it('rngFor 双跑逐位恒等', () => {
    const u1 = rngFor(42, 7, '检定:魅力', 3);
    const u2 = rngFor(42, 7, '检定:魅力', 3);
    expect(u1).toBe(u2);
  });

  it('rngFor 100 次循环无漂移', () => {
    const ref = rngFor(99, 5, '检定:智慧', 0);
    for (let i = 0; i < 99; i++) {
      expect(rngFor(99, 5, '检定:智慧', 0)).toBe(ref);
    }
  });
});

// ── Gate D: 检定配方表中 拓扑/宿主类型 自动进指纹 (6.45) ────────────────────
// 拓扑 and 宿主类型 live inside 检定配方表 (preset group).
// Changing either one changes 检定配方表 → changes the fingerprint.

describe('AA6 gate D: 检定配方表内 拓扑/宿主类型 变 → 指纹变', () => {
  const BASE_RECIPE = {
    魅力: { 主属性: '魅力', 副属性: [], 拓扑: '即掷', 宿主类型: '角色' },
  };

  function fpWith检定配方表(配方表: unknown): string {
    return hashPresetFingerprint({
      preset: { 检定配方表: 配方表, 检定档切分表: BASE_PRESET.检定档切分表 },
      snapshot: BASE_SNAPSHOT,
    });
  }

  it('拓扑 即掷→骰池 → 指纹改变', () => {
    const h1 = fpWith检定配方表(BASE_RECIPE);
    const h2 = fpWith检定配方表({
      魅力: { ...BASE_RECIPE['魅力'], 拓扑: '骰池' },
    });
    expect(h1).not.toBe(h2);
  });

  it('宿主类型 角色→组织 → 指纹改变', () => {
    const h1 = fpWith检定配方表(BASE_RECIPE);
    const h2 = fpWith检定配方表({
      魅力: { ...BASE_RECIPE['魅力'], 宿主类型: '组织' },
    });
    expect(h1).not.toBe(h2);
  });

  it('宿主类型 角色→世界域 → 指纹改变', () => {
    const h1 = fpWith检定配方表(BASE_RECIPE);
    const h2 = fpWith检定配方表({
      魅力: { ...BASE_RECIPE['魅力'], 宿主类型: '世界域' },
    });
    expect(h1).not.toBe(h2);
  });

  it('副属性列 停用=false→true → 指纹改变（停用轴配置也进指纹）', () => {
    const h1 = fpWith检定配方表({
      魅力: { 主属性: '魅力', 副属性列: [{ 轴名: '智慧', 权重: 0.5, 停用: false }], 拓扑: '即掷', 宿主类型: '角色' },
    });
    const h2 = fpWith检定配方表({
      魅力: { 主属性: '魅力', 副属性列: [{ 轴名: '智慧', 权重: 0.5, 停用: true, 中性缺省: 30 }], 拓扑: '即掷', 宿主类型: '角色' },
    });
    expect(h1).not.toBe(h2);
  });
});
