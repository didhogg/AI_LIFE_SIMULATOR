/**
 * AA6 指纹取材集双向 property 测试（gate）。B1 extended.
 *
 * Gate A-bundle: 判定面整包成员变 → bundle hash 变 → 指纹变
 * Gate A-snap:   快照锁定成员变 → 指纹变
 * Gate A-preset: 预设整包成员（生效中内容包集哈希/规则补丁哈希）变 → 指纹变
 * Gate B:        排除名单成员变 → 指纹不变
 * Gate C:        双跑逐位恒等 + canonicalize 防键序假阳性
 * Gate D:        检定配方表内 拓扑/宿主类型/副属性停用轴 变 → 指纹变（经 bundle 路径）
 */
import { describe, it, expect } from 'vitest';
import { hashPresetFingerprint, hashJudgmentBundle, rngFor } from '../engine/rng.js';
import { canonicalize } from '../engine/text/canonicalize.js';
import type { 暴击映射判定型 } from '../engine/rng.js';
import {
  FINGERPRINT_BUNDLE_MEMBERS,
  FINGERPRINT_PRESET_FIELDS,
  FINGERPRINT_SNAPSHOT_FIELDS,
  FINGERPRINT_EXCLUDED_FIELDS,
} from '../engine/fingerprintManifest.js';

// ── Local type aliases (kept in sync with manifest via import) ────────────────
type FingerprintBundleMember  = (typeof FINGERPRINT_BUNDLE_MEMBERS)[number];
type FingerprintPresetField   = (typeof FINGERPRINT_PRESET_FIELDS)[number];
type FingerprintSnapshotField = (typeof FINGERPRINT_SNAPSHOT_FIELDS)[number];
type FingerprintExcludedField = (typeof FINGERPRINT_EXCLUDED_FIELDS)[number];

// ── FullCtx: flat context carrying ALL fields ─────────────────────────────────
// Bundle fields + preset-level fields + snapshot fields + excluded fields.
// fingerprintOf() picks the right subsets for each step; excluded fields are
// simply NOT passed to hashJudgmentBundle / hashPresetFingerprint.
type FullCtx = {
  // B1d bundle members (passed to hashJudgmentBundle):
  历法皮肤: unknown;
  粒度模板覆盖: unknown;
  种族模板: unknown;
  母题配额: unknown;
  媒体渠道表: unknown;
  检定配方表: unknown;
  检定档切分表: unknown;
  欠债参数: unknown;
  换角许可?: unknown;
  世界遗产白名单出厂值?: unknown;
  赛事结构模板: unknown;
  派生量配方: unknown;        // 发现B·M·4
  概率域夹逼: unknown;        // H4
  // Preset-level members (passed directly to hashPresetFingerprint):
  生效中内容包集哈希: string;
  规则补丁哈希?: string;
  // Snapshot members (passed to hashPresetFingerprint.snapshot):
  难度系数组: unknown;
  判定骰型: 100 | 20;
  暴击映射: 暴击映射判定型;
  钳制表: unknown;
  预设数值面域上下界: unknown;
  // Excluded fields (NOT passed to any fingerprint function):
  显骰: unknown;
  叙事密度档: unknown;
  凸成本曲线: unknown;
  演出层草稿计数: unknown;
  渲染模式: unknown;
  采样参数: unknown;
  重试策略: unknown;
  切片预算覆盖: unknown;
  文风库: unknown;
  媒介登记表: unknown;
  叙事分发表: unknown;
  序章模板: unknown;
  '$模型画像禁词表': unknown;
  叙事偏好: unknown;
  启用文风键: unknown;
  生效锚点: unknown;
  基底契约: unknown;
  内容哈希: unknown;
  // P0-1 调批字段 exclusions
  最大回复tokens: unknown;
  思维链: unknown;
  切片预算: unknown;
  采样覆盖层: unknown;
  切片预算覆盖层: unknown;
  渲染模式覆盖: unknown;
  // B-1 lore exclusions
  lore能力集: unknown;
  'output_tag命名空间': unknown;
  [key: string]: unknown; // index sig for dynamic spread in loops
};

const BASE_CTX: FullCtx = {
  // Bundle
  历法皮肤:           {},
  粒度模板覆盖:        {},
  种族模板:           {},
  母题配额:           {},
  媒体渠道表:          {},
  检定配方表:          { 魅力: { 主属性: '魅力', 副属性: [] } },
  检定档切分表:        { 大胜下限: 40, 胜下限: 15, 惨胜下限: 1, 败下限: -24 },
  欠债参数:           {},
  赛事结构模板:        {},
  派生量配方:          {},
  概率域夹逼:          { p_最小: 0.0001, p_最大: 0.9999 },
  // Preset-level
  生效中内容包集哈希:   '',
  // Snapshot
  难度系数组:          { 基础成功率调整: 0 },
  判定骰型:           100,
  暴击映射:           '关',
  钳制表:             {},
  预设数值面域上下界:   [{ 轴名: '魅力', 最大值: 100, 自然上限: 20 }],
  // Excluded
  显骰:               false,
  叙事密度档:          '中',
  凸成本曲线:          [],
  演出层草稿计数:      0,
  渲染模式:           '默认',
  采样参数:           {},
  重试策略:           {},
  切片预算覆盖:        {},
  文风库:             [],
  媒介登记表:          {},
  叙事分发表:          {},
  序章模板:           {},
  '$模型画像禁词表':   [],
  叙事偏好:           '',
  启用文风键:          [],
  生效锚点:           0,
  基底契约:           '',
  内容哈希:           '',
  // P0-1 调批字段 exclusions
  最大回复tokens:      1024,
  思维链:              {},
  切片预算:            {},
  采样覆盖层:          {},
  切片预算覆盖层:      {},
  渲染模式覆盖:        undefined,
  // B-1 lore exclusions
  lore能力集:          [],
  'output_tag命名空间': '',
};

/** Extract fingerprint from a FullCtx — excluded fields are invisible to the functions. */
function fingerprintOf(ctx: FullCtx): string {
  const bundleHash = hashJudgmentBundle({
    历法皮肤:           ctx['历法皮肤'],
    粒度模板覆盖:        ctx['粒度模板覆盖'],
    种族模板:           ctx['种族模板'],
    母题配额:           ctx['母题配额'],
    媒体渠道表:          ctx['媒体渠道表'],
    检定配方表:          ctx['检定配方表'],
    检定档切分表:        ctx['检定档切分表'],
    欠债参数:           ctx['欠债参数'],
    换角许可:           ctx['换角许可'],
    世界遗产白名单出厂值: ctx['世界遗产白名单出厂值'],
    赛事结构模板:        ctx['赛事结构模板'],
    派生量配方:          ctx['派生量配方'],
    概率域夹逼:          ctx['概率域夹逼'],
  });
  return hashPresetFingerprint({
    判定面整包:        bundleHash,
    生效中内容包集哈希: ctx['生效中内容包集哈希'] as string,
    ...(ctx['规则补丁哈希'] !== undefined ? { 规则补丁哈希: ctx['规则补丁哈希'] as string } : {}),
    snapshot: {
      难度系数组:       ctx['难度系数组'],
      判定骰型:        ctx['判定骰型'] as 100 | 20,
      暴击映射:        ctx['暴击映射'] as 暴击映射判定型,
      钳制表:          ctx['钳制表'],
      预设数值面域上下界: ctx['预设数值面域上下界'],
    },
  });
}

// ── Mutations ────────────────────────────────────────────────────────────────
// Each value must differ meaningfully from the corresponding BASE_CTX value.

const BUNDLE_MUTATIONS: Record<FingerprintBundleMember, unknown> = {
  历法皮肤:           { 纪年法: '旧历', 纪元锚点: 525600 },
  粒度模板覆盖:        { 即时: { 跨度分钟: 60, 行动点上限: 8, 叙事粒度提示: '快节奏' } },
  种族模板:           { 精灵: { 寿命基准: 1000, 衰老系数: 0.1, 发育阶段表: [], 遗传参数: {}, 最小生育年龄分钟: 0 } },
  母题配额:           { 政治: { 基础权重: 2, 每游戏年上限: 3, 互斥组: '主线' } },
  媒体渠道表:          { 传言: { 名称: '小道消息', 受众选择器: '城区居民', 延迟分钟: 60, 失真率: 0.3 } },
  检定配方表:          { 力量: { 主属性: '力量', 副属性: [], 拓扑: '即掷', 宿主类型: '角色' } },
  检定档切分表:        { 大胜下限: 35, 胜下限: 10, 惨胜下限: 1, 败下限: -29 },
  欠债参数:           { 透支触发阈值: -500, 追债冷却分钟: 10080, 大额借贷下限: 5000, 利息周期分钟: 21600, 默认利率: 0.1 },
  换角许可:           { 候选选择器: 'NPC.存活', 冷却: 43200, 谢幕卡开关: true },
  世界遗产白名单出厂值: ['古城遗址', '传说宝剑'],
  赛事结构模板:        { 武术大赛: { 参与者选择器: '*.武者', 赛制: '淘汰', 轮次: 8, 检定配方引用: '武力', 排名表: {}, 奖励钩子: '' } },
  派生量配方:          { HP: { 配方名: 'HP', 主属性: '体质', 副属性列: [], 基础值: 10, 比例系数: 2 } },
  概率域夹逼:          { p_最小: 0.001, p_最大: 0.999 },
};
// Compile-time: ensures exhaustiveness whenever FINGERPRINT_BUNDLE_MEMBERS gains a new entry.
type _BundleMutationsExhaustive = typeof BUNDLE_MUTATIONS extends Record<FingerprintBundleMember, unknown> ? true : never;
const _checkBundle: _BundleMutationsExhaustive = true;
void _checkBundle;

const SNAPSHOT_MUTATIONS: Record<FingerprintSnapshotField, unknown> = {
  难度系数组:       { 基础成功率调整: 15, 秘密暴露系数: 2 },
  判定骰型:        20 as 100 | 20,
  暴击映射:        { 顶格升一档: true, 底格降一档: true } as 暴击映射判定型,
  钳制表:          { 按重要等级: { 路人: 5, 次要: 20 }, 按字段: {} },
  预设数值面域上下界: [{ 轴名: '魅力', 最大值: 200, 自然上限: 40 }],
};
type _SnapshotMutationsExhaustive = typeof SNAPSHOT_MUTATIONS extends Record<FingerprintSnapshotField, unknown> ? true : never;
const _checkSnapshot: _SnapshotMutationsExhaustive = true;
void _checkSnapshot;

// Preset-level fields tested explicitly (not via FullCtx loop — 判定面整包 is derived).
const PRESET_MUTATIONS: Record<FingerprintPresetField, unknown> = {
  判定面整包:        hashJudgmentBundle({ ...BASE_CTX as Parameters<typeof hashJudgmentBundle>[0], 历法皮肤: { 纪年法: '旧历' } }),
  生效中内容包集哈希: 'a1b2c3d4deadbeef',
  规则补丁哈希:      'patch0042',
};
type _PresetMutationsExhaustive = typeof PRESET_MUTATIONS extends Record<FingerprintPresetField, unknown> ? true : never;
const _checkPreset: _PresetMutationsExhaustive = true;
void _checkPreset;

const EXCLUDED_MUTATIONS: Record<FingerprintExcludedField, unknown> = {
  显骰:               true,
  叙事密度档:          '高',
  凸成本曲线:          [{ 档: 1, 成本: 10 }],
  演出层草稿计数:      7,
  渲染模式:           '沉浸式',
  采样参数:           { temperature: 0.9, top_p: 0.95 },
  重试策略:           { 叙事质量二审: { 自动重试上限: 5, 超时秒数: 60, 失败后行为: '降级继续' } },
  切片预算覆盖:        { 本月叙事上限: 20 },
  文风库:             [{ 键: '武侠', 名称: '武侠风格', 风格提示词: '刀光剑影', 默认开: true }],
  媒介登记表:          { 日报: { 模板正文: '今日头条：{{事件}}', 必填槽位: ['事件'], 引擎槽位: [] } },
  叙事分发表:          { 战斗: { 媒介键引用: '日报', 优先级: 1 } },
  序章模板:           { 模式: '固定文本', 正文: '故事开始了……' },
  '$模型画像禁词表':   ['系统提示', '注意', '指令'],
  叙事偏好:           '希望更多政治阴谋情节',
  启用文风键:          ['武侠', '玄幻', '都市'],
  生效锚点:           9999,
  基底契约:           'base-contract-v2',
  内容哈希:           'cafebabe0102',
  // P0-1 调批字段 exclusions
  最大回复tokens:      4096,
  思维链:              { 启用: true, 努力档: 'high' },
  切片预算:            { 软上限tokens: 2000, 硬上限tokens: 4000, 截断优先级: ['叙事', '对话'] },
  采样覆盖层:          { 叙事质量二审: { 温度: 0.3, top_p: 0.9 } },
  切片预算覆盖层:      { 叙事质量二审: { 软上限tokens: 3000, 硬上限tokens: 6000, 截断优先级: [] } },
  渲染模式覆盖:        '占位整达',
  // B-1 lore exclusions
  lore能力集:          [{ 类型: 'output_tag', 输出命名空间: 'cuisine:flavor_tag' }],
  'output_tag命名空间': 'cuisine:flavor_tag',
};
type _ExcludedMutationsExhaustive = typeof EXCLUDED_MUTATIONS extends Record<FingerprintExcludedField, unknown> ? true : never;
const _checkExcluded: _ExcludedMutationsExhaustive = true;
void _checkExcluded;

// ── Gate A-bundle: 判定面整包成员变 → 指纹变 ─────────────────────────────────
describe('AA6 gate A-bundle: 判定面整包成员变 → bundle hash 变 → 指纹变', () => {
  for (const field of FINGERPRINT_BUNDLE_MEMBERS) {
    it(`bundle.${field} 改变 → 指纹改变`, () => {
      const base = fingerprintOf(BASE_CTX);
      const mutated: FullCtx = { ...BASE_CTX, [field]: BUNDLE_MUTATIONS[field as FingerprintBundleMember] };
      expect(fingerprintOf(mutated)).not.toBe(base);
    });
  }
});

// ── Gate A-snap: 快照锁定成员变 → 指纹变 ─────────────────────────────────────
describe('AA6 gate A-snap: 快照锁定成员变 → 指纹变', () => {
  for (const field of FINGERPRINT_SNAPSHOT_FIELDS) {
    it(`snapshot.${field} 改变 → 指纹改变`, () => {
      const base = fingerprintOf(BASE_CTX);
      const mutated: FullCtx = { ...BASE_CTX, [field]: SNAPSHOT_MUTATIONS[field as FingerprintSnapshotField] };
      expect(fingerprintOf(mutated)).not.toBe(base);
    });
  }
});

// ── Gate A-preset: 预设整包成员变 → 指纹变 ──────────────────────────────────
describe('AA6 gate A-preset: 预设整包成员（生效中内容包集哈希/规则补丁哈希）变 → 指纹变', () => {
  it('B1c: 生效中内容包集哈希 改变 → 指纹改变', () => {
    const base = fingerprintOf(BASE_CTX);
    const mutated: FullCtx = { ...BASE_CTX, 生效中内容包集哈希: PRESET_MUTATIONS['生效中内容包集哈希'] as string };
    expect(fingerprintOf(mutated)).not.toBe(base);
  });

  it('K5: 规则补丁哈希 存在 → 指纹改变', () => {
    const base = fingerprintOf(BASE_CTX);
    const mutated: FullCtx = { ...BASE_CTX, 规则补丁哈希: PRESET_MUTATIONS['规则补丁哈希'] as string };
    expect(fingerprintOf(mutated)).not.toBe(base);
  });

  it('判定面整包: 直接传不同 hash → 指纹改变', () => {
    // Direct call to hashPresetFingerprint bypassing bundle computation
    const baseFP = hashPresetFingerprint({
      判定面整包: hashJudgmentBundle({ ...BASE_CTX as Parameters<typeof hashJudgmentBundle>[0] }),
      生效中内容包集哈希: '',
      snapshot: { 难度系数组: BASE_CTX.难度系数组, 判定骰型: BASE_CTX.判定骰型, 暴击映射: BASE_CTX.暴击映射, 钳制表: BASE_CTX.钳制表, 预设数值面域上下界: BASE_CTX.预设数值面域上下界 },
    });
    const otherFP = hashPresetFingerprint({
      判定面整包: PRESET_MUTATIONS['判定面整包'] as string,
      生效中内容包集哈希: '',
      snapshot: { 难度系数组: BASE_CTX.难度系数组, 判定骰型: BASE_CTX.判定骰型, 暴击映射: BASE_CTX.暴击映射, 钳制表: BASE_CTX.钳制表, 预设数值面域上下界: BASE_CTX.预设数值面域上下界 },
    });
    expect(baseFP).not.toBe(otherFP);
  });
});

// ── Gate B: 排除名单成员变 → 指纹不变 ───────────────────────────────────────
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
    const objA = { 检定配方表: BASE_CTX.检定配方表, 历法皮肤: BASE_CTX.历法皮肤 };
    const objB = { 历法皮肤: BASE_CTX.历法皮肤, 检定配方表: BASE_CTX.检定配方表 };
    expect(canonicalize(objA)).toBe(canonicalize(objB));
  });

  it('hashJudgmentBundle 双跑逐位恒等', () => {
    const fields = { ...BASE_CTX as Parameters<typeof hashJudgmentBundle>[0] };
    expect(hashJudgmentBundle(fields)).toBe(hashJudgmentBundle(fields));
  });

  it('hashJudgmentBundle 键序无关: 乱序输入 → 相同 bundle hash', () => {
    const h1 = hashJudgmentBundle({ 历法皮肤: {}, 粒度模板覆盖: {}, 种族模板: {}, 母题配额: {}, 媒体渠道表: {}, 检定配方表: BASE_CTX.检定配方表, 检定档切分表: BASE_CTX.检定档切分表, 欠债参数: {}, 赛事结构模板: {}, 派生量配方: {}, 概率域夹逼: {} });
    const h2 = hashJudgmentBundle({ 检定档切分表: BASE_CTX.检定档切分表, 检定配方表: BASE_CTX.检定配方表, 欠债参数: {}, 赛事结构模板: {}, 历法皮肤: {}, 粒度模板覆盖: {}, 种族模板: {}, 母题配额: {}, 媒体渠道表: {}, 概率域夹逼: {}, 派生量配方: {} });
    expect(h1).toBe(h2);
  });

  it('hashPresetFingerprint 双跑逐位恒等', () => {
    const fp = fingerprintOf(BASE_CTX);
    expect(fp).toBe(fingerprintOf(BASE_CTX));
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

// ── Gate D: 检定配方表内 拓扑/宿主类型/停用轴 变 → 指纹变（via bundle 路径）──
// 拓扑 and 宿主类型 live inside 检定配方表 (bundle member → B1d).
describe('AA6 gate D: 检定配方表内 拓扑/宿主类型 变 → bundle hash 变 → 指纹变', () => {
  const BASE_RECIPE = {
    魅力: { 主属性: '魅力', 副属性: [], 拓扑: '即掷', 宿主类型: '角色' },
  };

  function fpWith检定配方表(配方表: unknown): string {
    return fingerprintOf({ ...BASE_CTX, 检定配方表: 配方表 });
  }

  it('拓扑 即掷→骰池 → 指纹改变', () => {
    const h1 = fpWith检定配方表(BASE_RECIPE);
    const h2 = fpWith检定配方表({ 魅力: { ...BASE_RECIPE['魅力'], 拓扑: '骰池' } });
    expect(h1).not.toBe(h2);
  });

  it('宿主类型 角色→组织 → 指纹改变', () => {
    const h1 = fpWith检定配方表(BASE_RECIPE);
    const h2 = fpWith检定配方表({ 魅力: { ...BASE_RECIPE['魅力'], 宿主类型: '组织' } });
    expect(h1).not.toBe(h2);
  });

  it('宿主类型 角色→世界域 → 指纹改变', () => {
    const h1 = fpWith检定配方表(BASE_RECIPE);
    const h2 = fpWith检定配方表({ 魅力: { ...BASE_RECIPE['魅力'], 宿主类型: '世界域' } });
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
