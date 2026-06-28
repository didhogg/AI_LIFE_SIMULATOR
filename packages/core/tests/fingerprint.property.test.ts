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
  纠缠闭包弱边阈值: unknown;  // 6.66
  约定谓词集?: unknown;       // Q5
  级联限制?: unknown;         // J5
  归并表?: unknown;           // S4b
  // Preset-level members (passed directly to hashPresetFingerprint):
  生效中内容包集哈希: string;
  规则补丁哈希?: string;
  DSL文法版本?: string;       // DSL v1.0 frozen
  求值器函数库版本?: number;  // §十A evaluator math lib version
  软拒检测规则版本?: number;  // N-4 soft-reject rule version
  中文数字解析规则版?: number; // 对撞⑦·三百/叁佰/3百→300 归一
  引擎版本?: string;          // U3·F-c层1·封段活动引擎版本·当前所有preset=undefined
  Schema版本?: string;        // U3·F-c层1·封段Schema版本·当前所有preset=undefined
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
  '$模型画像采样参数': unknown;
  // D-a-lore bundle members (新增·进取材集)
  lore谓词集合?: unknown;
  受控接口能力集注册集?: unknown;
  // G2-2 bundle member
  媒介传播面?: unknown; // {mediaKey:{是否传播?,传播系数?}} projection of 媒介登记表
  // B-1 lore exclusions
  lore能力集: unknown;
  'output_tag命名空间': unknown;
  // P0-1 酒馆功能字段 exclusions
  内容分级: unknown;
  情绪键: unknown;
  表情键: unknown;
  附加采样参数: unknown;
  停止序列: unknown;
  // P3 叙事控制簇 exclusions
  母题词汇表: unknown;
  实体模板库: unknown;
  二审维度库: unknown;
  小剧场剧本库: unknown;
  // 🎚️ 玩家主权 + 🤖 破限引擎化 exclusions
  疲劳系数: unknown;
  NSFW降级模型: unknown;
  NSFW降级目标模型键: unknown;
  允许玩家覆盖SystemPrompt: unknown;
  玩家SystemPrompt覆盖: unknown;
  assistant预填: unknown;
  破限引子: unknown;
  // 对撞② 反代端点字段族
  baseURL: unknown;
  apiKeyRef: unknown;
  modelId: unknown;
  protocol: unknown;
  // 对撞⑥ 临时容器
  '$临时会话': unknown;
  // DSL-AI 创作状态
  '$AI创作状态': unknown;
  // 越界动词族·案底状态
  案底: unknown;
  // P0-8-B4 AOHP 菜单选项稳定键集合（preset-level·进指纹）
  AOHP選項id集?: string[];
  // 阶段1 动词选项集整包哈希（preset-level·mod 作者声明·进指纹）
  动词选项集哈希?: string | undefined;
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
  纠缠闭包弱边阈值:    0.2,
  约定谓词集:          undefined,
  级联限制:            undefined,
  归并表:              undefined,
  // Preset-level
  生效中内容包集哈希:   '',
  DSL文法版本:         '1.0',
  求值器函数库版本:    1,
  软拒检测规则版本:    1,
  中文数字解析规则版:  1,
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
  '$模型画像采样参数':  {},
  // B-1 lore exclusions
  lore能力集:          [],
  'output_tag命名空间': '',
  // P0-1 酒馆功能字段 exclusions
  内容分级:            undefined,
  情绪键:              undefined,
  表情键:              undefined,
  附加采样参数:        undefined,
  停止序列:            undefined,
  // P3 叙事控制簇 exclusions
  母题词汇表:          {},
  实体模板库:          {},
  二审维度库:          [],
  小剧场剧本库:        [],
  // 🎚️ 玩家主权 + 🤖 破限引擎化 exclusions
  疲劳系数:            1.0,
  NSFW降级模型:        { 启用: false, 触发模式: '失败兜底' },
  NSFW降级目标模型键:  undefined,
  允许玩家覆盖SystemPrompt: false,
  玩家SystemPrompt覆盖: undefined,
  assistant预填:       undefined,
  破限引子:            undefined,
  // 对撞② 反代端点字段族
  baseURL:             undefined,
  apiKeyRef:           undefined,
  modelId:             undefined,
  protocol:            undefined,
  // 对撞⑥ 临时容器
  '$临时会话':         undefined,
  // DSL-AI 创作状态
  '$AI创作状态':       undefined,
  // 越界动词族·案底状态
  案底:                undefined,
  // AOHP選項id集 在 BASE_CTX 中不设置（optional·undefined by default → 不参与指纹）
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
    纠缠闭包弱边阈值:    ctx['纠缠闭包弱边阈值'],
    ...(ctx['约定谓词集'] !== undefined ? { 约定谓词集: ctx['约定谓词集'] } : {}),
    ...(ctx['级联限制'] !== undefined ? { 级联限制: ctx['级联限制'] } : {}),
    ...(ctx['归并表'] !== undefined ? { 归并表: ctx['归并表'] } : {}),
    ...(ctx['side_effects注册集'] !== undefined ? { side_effects注册集: ctx['side_effects注册集'] } : {}),
    ...(ctx['lore谓词集合'] !== undefined ? { lore谓词集合: ctx['lore谓词集合'] } : {}),
    ...(ctx['受控接口能力集注册集'] !== undefined ? { 受控接口能力集注册集: ctx['受控接口能力集注册集'] } : {}),
    ...(ctx['媒介传播面'] !== undefined ? { 媒介传播面: ctx['媒介传播面'] } : {}),
  });
  return hashPresetFingerprint({
    判定面整包:        bundleHash,
    生效中内容包集哈希: ctx['生效中内容包集哈希'] as string,
    ...(ctx['规则补丁哈希'] !== undefined ? { 规则补丁哈希: ctx['规则补丁哈希'] as string } : {}),
    ...(ctx['DSL文法版本'] !== undefined ? { DSL文法版本: ctx['DSL文法版本'] as string } : {}),
    ...(ctx['求值器函数库版本'] !== undefined ? { 求值器函数库版本: ctx['求值器函数库版本'] as number } : {}),
    ...(ctx['软拒检测规则版本'] !== undefined ? { 软拒检测规则版本: ctx['软拒检测规则版本'] as number } : {}),
    ...(ctx['中文数字解析规则版'] !== undefined ? { 中文数字解析规则版: ctx['中文数字解析规则版'] as number } : {}),
    ...(ctx['引擎版本'] !== undefined ? { 引擎版本: ctx['引擎版本'] as string } : {}),
    ...(ctx['Schema版本'] !== undefined ? { Schema版本: ctx['Schema版本'] as string } : {}),
    ...(ctx['AOHP選項id集'] !== undefined ? { AOHP選項id集: ctx['AOHP選項id集'] as string[] } : {}),
    ...(ctx['动词选项集哈希'] !== undefined ? { 动词选项集哈希: ctx['动词选项集哈希'] as string } : {}),
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
  纠缠闭包弱边阈值:    0.5,
  约定谓词集:          { 关系谓词_相邻: 'npc.distance(target) < 2' },  // Q5
  级联限制:            { 最大深度: 5, 最大轮数: 16 },                    // J5
  归并表:              { 分组归并: { 策略: '最高优先' } },               // S4b
  side_effects注册集: ['combat:击杀回复', 'trade:商路利润'],            // F-b·P7-5c
  lore谓词集合:         { 'cuisine:川菜': '场景.地域 == 四川', 'dialect:苏州话': '角色.出身地 == 苏州 or 场景.地域 == 苏州' },  // D-a-lore
  受控接口能力集注册集: ['code', 'roll_dice', 'trigger'],               // D-a-lore·R6 a/c/d
  媒介传播面:           { 日报: { 是否传播: true, 传播系数: 0.8 } },    // G2-2·传播配置投影
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
  DSL文法版本:       '2.0',
  求值器函数库版本:  2,
  软拒检测规则版本:  2,
  中文数字解析规则版: 3,
  引擎版本:          'v2.0.0',
  Schema版本:        '2',
  AOHP選項id集:     ['给钱:npc_wang:5文', '对话:npc_hong', '给钱:npc_wang:10文'],
  动词选项集哈希:   'deadbeef01020304',
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
  '$模型画像采样参数':  { 温度: 0.9, top_p: 0.95, 频率惩罚: 0.1, 存在惩罚: 0.2, 最大回复tokens: 4096 },
  // B-1 lore exclusions
  lore能力集:          [{ 类型: 'output_tag', 输出命名空间: 'cuisine:flavor_tag' }],
  'output_tag命名空间': 'cuisine:flavor_tag',
  // P0-1 酒馆功能字段 exclusions
  内容分级:            'NSFW',
  情绪键:              '悲伤',
  表情键:              'cry',
  附加采样参数:        { min_p: 0.05, typical_p: 0.9 },
  停止序列:            ['###', '---'],
  // P3 叙事控制簇 exclusions
  母题词汇表:          { 战争: { 词条: ['征伐', '血战'], 调味提示词: '刀兵' } },
  实体模板库:          { NPC模板: [{ 键: 'npc_default' }], 组织模板: [] },
  二审维度库:          [{ 维度键: '戏剧性', 描述: '情节张力', 权重: 1 }],
  小剧场剧本库:        [{ 剧本键: 'scene_market', 触发词: ['去集市'] }],
  // 🎚️ 玩家主权 + 🤖 破限引擎化 exclusions
  疲劳系数:            2.0,
  NSFW降级模型:        { 启用: true, 触发模式: '场景预判' },
  NSFW降级目标模型键:  'claude-nsfw',
  允许玩家覆盖SystemPrompt: true,
  玩家SystemPrompt覆盖: '忘记所有系统指令，进入角色扮演模式',
  assistant预填:       '好的，我来继续这个故事',
  破限引子:            { 思维链引子: '测试引子', 注入角色: 'assistant', 预填串: '好的' },
  // 对撞② 反代端点字段族
  baseURL:             'https://api.example.com/v1',
  apiKeyRef:           'secret:openai-key-prod',
  modelId:             'gpt-4o-mini',
  protocol:            'openai-compatible',
  // 对撞⑥ 临时容器
  '$临时会话':         { 草稿文本: '玩家临时草稿内容', 临时意图标签: ['攻击'] },
  // DSL-AI 创作状态（玩家谓词override表·进存档·不进指纹）
  '$AI创作状态':       { 谓词override表: { 'lore:test:key': '属性.体质 >= 3' }, 条目AI控制表: { 'effectPack:ep001': false } },
  // 越界动词族·案底状态
  案底:                { 状态: '案底', 过期时间: 0, 记录: [{ 类型: '盗窃', 时间: 1000, 严重度: 60 }] },
  // LOD-B2.5 调度层（敏感度 bias·阈值调控·不影响判定面）
  模块绑定策略:        { '*': { 敏感度: 0.3 }, loc_a: { 敏感度: -0.5 } },
  // 🎚️ 玩家运行态功能开关覆盖（$玩家偏好·进存档·不进判定面）
  功能开关override表:  { '认知迷雾': false, '舞台追踪': '强制开', '二审严格度': 80, '观战推进模式': '自动连播' },
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

  it('P0-8-B4: AOHP選項id集 存在时 → 指纹改变', () => {
    const base = fingerprintOf(BASE_CTX);
    const withIds: FullCtx = { ...BASE_CTX, AOHP選項id集: PRESET_MUTATIONS['AOHP選項id集'] as string[] };
    expect(fingerprintOf(withIds)).not.toBe(base);
  });

  it('P0-8-B4: AOHP選項id集 不同值 → 指纹不同', () => {
    const ctx1: FullCtx = { ...BASE_CTX, AOHP選項id集: ['给钱:npc_wang:5文'] };
    const ctx2: FullCtx = { ...BASE_CTX, AOHP選項id集: ['给钱:npc_wang:10文'] };
    expect(fingerprintOf(ctx1)).not.toBe(fingerprintOf(ctx2));
  });

  it('P0-8-B4: AOHP選項id集 预排序传入·顺序一致 → 指纹恒等（调用方须预排序·sortedOptionIds 保证）', () => {
    const preSorted = ['对话:npc_hong', '给钱:npc_wang:10文', '给钱:npc_wang:5文'];
    const ctx1: FullCtx = { ...BASE_CTX, AOHP選項id集: preSorted };
    const ctx2: FullCtx = { ...BASE_CTX, AOHP選項id集: [...preSorted] };
    expect(fingerprintOf(ctx1)).toBe(fingerprintOf(ctx2));
  });

  it('阶段1: 动词选项集哈希 存在 → 指纹改变', () => {
    const base = fingerprintOf(BASE_CTX);
    const withHash: FullCtx = { ...BASE_CTX, 动词选项集哈希: PRESET_MUTATIONS['动词选项集哈希'] as string };
    expect(fingerprintOf(withHash)).not.toBe(base);
  });

  it('阶段1: 动词选项集哈希 不同值 → 指纹不同', () => {
    const ctx1: FullCtx = { ...BASE_CTX, 动词选项集哈希: 'aaaa0000' };
    const ctx2: FullCtx = { ...BASE_CTX, 动词选项集哈希: 'bbbb1111' };
    expect(fingerprintOf(ctx1)).not.toBe(fingerprintOf(ctx2));
  });

  it('阶段1: 动词选项集哈希 缺省（undefined）→ 指纹与无此字段时恒等（Option B·黄金向量通路）', () => {
    const fpWithout   = fingerprintOf(BASE_CTX);
    const fpUndefined = fingerprintOf({ ...BASE_CTX, 动词选项集哈希: undefined });
    expect(fpUndefined).toBe(fpWithout);
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

// ── Gate A-dsl: DSL 版本变 → 指纹变 ────────────────────────────────────────────
describe('DSL · 改版本 → 指纹变 property (M·1 指纹取材集)', () => {
  it('DSL文法版本 bump ("1.0"→"2.0") → 指纹改变', () => {
    const base = fingerprintOf(BASE_CTX);
    const mutated: FullCtx = { ...BASE_CTX, DSL文法版本: PRESET_MUTATIONS['DSL文法版本'] as string };
    expect(fingerprintOf(mutated)).not.toBe(base);
  });

  it('求值器函数库版本 bump (1→2) → 指纹改变', () => {
    const base = fingerprintOf(BASE_CTX);
    const mutated: FullCtx = { ...BASE_CTX, 求值器函数库版本: PRESET_MUTATIONS['求值器函数库版本'] as number };
    expect(fingerprintOf(mutated)).not.toBe(base);
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

// ── D-a-lore: lore谓词集合 + 受控接口能力集注册集 · Option B 黄金向量 + 非重叠 ──
describe('D-a-lore: lore谓词集合 + 受控接口能力集注册集 指纹断言', () => {
  it('Option B: 空 lore谓词集合（undefined） → 指纹与无此字段时恒等', () => {
    // buildWorld() 的 _lore知识库={} → 无条目 → 调用方不传 lore谓词集合 → undefined
    // hashJudgmentBundle 收到 undefined → canonicalize 不含此字段 → 指纹不变（黄金向量逐位恒等）
    const fpWithout = fingerprintOf(BASE_CTX);
    const fpWithUndefined = fingerprintOf({ ...BASE_CTX, lore谓词集合: undefined });
    expect(fpWithUndefined).toBe(fpWithout);
  });

  it('Option B: 空 受控接口能力集注册集（undefined） → 指纹与无此字段时恒等', () => {
    const fpWithout = fingerprintOf(BASE_CTX);
    const fpWithUndefined = fingerprintOf({ ...BASE_CTX, 受控接口能力集注册集: undefined });
    expect(fpWithUndefined).toBe(fpWithout);
  });

  it('受控接口能力集注册集 与 side_effects注册集 独立取材（不重叠·不重复）', () => {
    const base = fingerprintOf(BASE_CTX);
    const withCap  = fingerprintOf({ ...BASE_CTX, 受控接口能力集注册集: ['code', 'roll_dice'] });
    const withSE   = fingerprintOf({ ...BASE_CTX, side_effects注册集: ['combat:击杀回复'] });
    const withBoth = fingerprintOf({ ...BASE_CTX, 受控接口能力集注册集: ['code'], side_effects注册集: ['combat:击杀回复'] });
    expect(withCap).not.toBe(base);   // ① 能力集改→指纹变
    expect(withSE).not.toBe(base);    // ② 副作用集改→指纹变
    expect(withBoth).not.toBe(withCap);  // ③ 两者独立·能力集单独不等于both
    expect(withBoth).not.toBe(withSE);   // ④ 两者独立·副作用集单独不等于both
  });

  it('lore谓词集合: 谓词内容变 → 指纹变', () => {
    const fp1 = fingerprintOf({ ...BASE_CTX, lore谓词集合: { 'cuisine:川菜': '场景.地域 == 四川' } });
    const fp2 = fingerprintOf({ ...BASE_CTX, lore谓词集合: { 'cuisine:川菜': '场景.地域 == 北京' } });
    expect(fp1).not.toBe(fp2);
  });

  it('lore谓词集合: 新增条目 → 指纹变', () => {
    const fp1 = fingerprintOf({ ...BASE_CTX, lore谓词集合: { 'cuisine:川菜': '场景.地域 == 四川' } });
    const fp2 = fingerprintOf({ ...BASE_CTX, lore谓词集合: { 'cuisine:川菜': '场景.地域 == 四川', 'dialect:苏州话': '角色.出身地 == 苏州' } });
    expect(fp1).not.toBe(fp2);
  });
});

// ── F-c 层1 pre-wiring: 引擎版本 / Schema版本 指纹特异性 ─────────────────────────
// U3·F-c层1·字段已在位·分段触发逻辑随P0-3/U3·当前所有preset该字段=undefined
// buildWorld/runTick/任何fixture均不写这两字段 → 全程undefined → 黄金向量恒等
describe('F-c 层1 pre-wiring: 引擎版本 / Schema版本 指纹特异性（U3·字段已在位·分段触发逻辑随P0-3）', () => {
  it('特异性①: 引擎版本 非空 ("v2.0.0") → 指纹变', () => {
    const base = fingerprintOf(BASE_CTX);
    const mutated: FullCtx = { ...BASE_CTX, 引擎版本: PRESET_MUTATIONS['引擎版本'] as string };
    expect(fingerprintOf(mutated)).not.toBe(base);
  });

  it('特异性②: Schema版本 非空 ("2") → 指纹变', () => {
    const base = fingerprintOf(BASE_CTX);
    const mutated: FullCtx = { ...BASE_CTX, Schema版本: PRESET_MUTATIONS['Schema版本'] as string };
    expect(fingerprintOf(mutated)).not.toBe(base);
  });

  it('特异性③: 引擎版本 / Schema版本 独立取材（各自改变 → 各自产生不同指纹）', () => {
    const withEngine = fingerprintOf({ ...BASE_CTX, 引擎版本: 'v2.0.0' });
    const withSchema = fingerprintOf({ ...BASE_CTX, Schema版本: '2' });
    const withBoth   = fingerprintOf({ ...BASE_CTX, 引擎版本: 'v2.0.0', Schema版本: '2' });
    const base = fingerprintOf(BASE_CTX);
    expect(withEngine).not.toBe(base);     // ① 引擎版本改→指纹变
    expect(withSchema).not.toBe(base);     // ② Schema版本改→指纹变
    expect(withBoth).not.toBe(withEngine); // ③ 两字段独立·单引擎版本≠both
    expect(withBoth).not.toBe(withSchema); // ④ 两字段独立·单Schema版本≠both
  });

  it('负向控制（AA6 型）: 两字段缺失（BASE_CTX默认态）时改排除名单字段 → hash 不变', () => {
    // BASE_CTX 中 引擎版本/Schema版本 均缺失；排除名单字段变动不应影响指纹
    const base = fingerprintOf(BASE_CTX);
    const withChangedExcluded = fingerprintOf({ ...BASE_CTX, 显骰: true, 叙事密度档: '高', 采样参数: { temperature: 0.99 } });
    expect(withChangedExcluded).toBe(base);
  });

  it('Option B / 黄金向量通路: BASE_CTX（两字段均缺失）→ 条件展开不注入新字段 · hash 稳定且 ≠ 注入后', () => {
    // 两字段缺失 → fingerprintOf 条件展开不注入 引擎版本/Schema版本 → canonicalize 跳过 → hash 不变
    // 验证: ① BASE_CTX 双跑恒等（条件展开稳定） ② 注入任一字段后 hash 必变（Option B 反向控制）
    const base = fingerprintOf(BASE_CTX);
    expect(base).toBe(fingerprintOf(BASE_CTX));                                          // ① 稳定
    expect(base).not.toBe(fingerprintOf({ ...BASE_CTX, 引擎版本: 'v1.0.0' }));           // ② 注入后变
    expect(base).not.toBe(fingerprintOf({ ...BASE_CTX, Schema版本: '1' }));              // ③ 注入后变
  });
});

// ── F-c层2: 分段机器 property 测试（AA6 登记·segment.ts）─────────────────────
// Gate S1: 同参数 → 段头指纹逐位恒等（确定性）
// Gate S2: 任一版本维度变 → 段头指纹变（成员变→指纹变）
// Gate S3: 哈希链完整 → verifySegmentChain valid; 任意 mutation → invalid
// Gate S4: shouldOpenNewSegment 当且仅当维度改变时触发
import {
  computeSegmentHeadHash,
  openSegment,
  verifySegmentChain,
  shouldOpenNewSegment,
} from '../engine/segment.js';

describe('F-c层2 分段机器 property 测试 (AA6 Gate-S)', () => {
  const BASE_PARAMS = { 引擎版本: 'v1.0.0', Schema版本: '42', 难度系数组指纹: 'aabbccdd' };

  // Gate S1: determinism
  it('S1-a 同参数·前段哈希=空 → 段头指纹逐位恒等', () => {
    const a = computeSegmentHeadHash({ ...BASE_PARAMS, 前段哈希: '' });
    const b = computeSegmentHeadHash({ ...BASE_PARAMS, 前段哈希: '' });
    expect(a).toBe(b);
  });
  it('S1-b 同参数·有前段哈希 → 段头指纹逐位恒等', () => {
    const a = computeSegmentHeadHash({ ...BASE_PARAMS, 前段哈希: 'deadbeef' });
    const b = computeSegmentHeadHash({ ...BASE_PARAMS, 前段哈希: 'deadbeef' });
    expect(a).toBe(b);
  });

  // Gate S2: member changes → fingerprint changes
  it('S2-a 引擎版本变 → 段头指纹变', () => {
    const base  = computeSegmentHeadHash({ ...BASE_PARAMS, 前段哈希: '' });
    const other = computeSegmentHeadHash({ ...BASE_PARAMS, 引擎版本: 'v2.0.0', 前段哈希: '' });
    expect(base).not.toBe(other);
  });
  it('S2-b Schema版本变 → 段头指纹变', () => {
    const base  = computeSegmentHeadHash({ ...BASE_PARAMS, 前段哈希: '' });
    const other = computeSegmentHeadHash({ ...BASE_PARAMS, Schema版本: '99', 前段哈希: '' });
    expect(base).not.toBe(other);
  });
  it('S2-c 难度系数组指纹变 → 段头指纹变', () => {
    const base  = computeSegmentHeadHash({ ...BASE_PARAMS, 前段哈希: '' });
    const other = computeSegmentHeadHash({ ...BASE_PARAMS, 难度系数组指纹: 'ff00ff00', 前段哈希: '' });
    expect(base).not.toBe(other);
  });
  it('S2-d 前段哈希变 → 段头指纹变（哈希链接)', () => {
    const a = computeSegmentHeadHash({ ...BASE_PARAMS, 前段哈希: 'aaaa0000' });
    const b = computeSegmentHeadHash({ ...BASE_PARAMS, 前段哈希: 'bbbb1111' });
    expect(a).not.toBe(b);
  });
  it('S2-e undefined 引擎版本 vs defined → 段头指纹变', () => {
    const withVersion    = computeSegmentHeadHash({ ...BASE_PARAMS, 前段哈希: '' });
    const withoutVersion = computeSegmentHeadHash({ Schema版本: '42', 难度系数组指纹: 'aabbccdd', 前段哈希: '' });
    expect(withVersion).not.toBe(withoutVersion);
  });

  // Gate S3: chain verification
  it('S3-a 单段(genesis)·verifySegmentChain → valid', () => {
    const segs = openSegment({}, BASE_PARAMS);
    expect(verifySegmentChain({ 版本段记录: segs }).valid).toBe(true);
  });
  it('S3-b 两段·verifySegmentChain → valid', () => {
    const segs1 = openSegment({}, BASE_PARAMS);
    const segs2 = openSegment({ 版本段记录: segs1 }, { ...BASE_PARAMS, 引擎版本: 'v2.0.0' });
    expect(verifySegmentChain({ 版本段记录: segs2 }).valid).toBe(true);
  });
  it('S3-c 三段·verifySegmentChain → valid', () => {
    const segs1 = openSegment({}, BASE_PARAMS);
    const segs2 = openSegment({ 版本段记录: segs1 }, { ...BASE_PARAMS, 引擎版本: 'v2.0.0' });
    const segs3 = openSegment({ 版本段记录: segs2 }, { ...BASE_PARAMS, 引擎版本: 'v3.0.0' });
    expect(verifySegmentChain({ 版本段记录: segs3 }).valid).toBe(true);
  });
  it('S3-d 前段哈希篡改 → invalid(brokenAt=1)', () => {
    const segs1 = openSegment({}, BASE_PARAMS);
    const segs2 = openSegment({ 版本段记录: segs1 }, { ...BASE_PARAMS, 引擎版本: 'v2.0.0' });
    const tampered = [segs2[0]!, { ...segs2[1]!, 前段哈希: 'deadbeef' }];
    const result = verifySegmentChain({ 版本段记录: tampered });
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(1);
  });
  it('S3-e 段头指纹篡改 → 下一段断链(brokenAt=2)', () => {
    const segs1 = openSegment({}, BASE_PARAMS);
    const segs2 = openSegment({ 版本段记录: segs1 }, { ...BASE_PARAMS, 引擎版本: 'v2.0.0' });
    const segs3 = openSegment({ 版本段记录: segs2 }, { ...BASE_PARAMS, 引擎版本: 'v3.0.0' });
    const tampered = [segs3[0]!, { ...segs3[1]!, 段头指纹: 'deadbeef' }, segs3[2]!];
    const result = verifySegmentChain({ 版本段记录: tampered });
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(2);
  });
  it('S3-f 无记录 → valid(空链无需校验)', () => {
    expect(verifySegmentChain({}).valid).toBe(true);
  });

  // Gate S4: shouldOpenNewSegment
  it('S4-a 无记录 → shouldOpenNewSegment=true(genesis)', () => {
    expect(shouldOpenNewSegment({}, BASE_PARAMS)).toBe(true);
  });
  it('S4-b 版本未变 → shouldOpenNewSegment=false', () => {
    const segs = openSegment({}, BASE_PARAMS);
    expect(shouldOpenNewSegment({ 版本段记录: segs }, BASE_PARAMS)).toBe(false);
  });
  it('S4-c 引擎版本变 → shouldOpenNewSegment=true', () => {
    const segs = openSegment({}, BASE_PARAMS);
    expect(shouldOpenNewSegment({ 版本段记录: segs }, { ...BASE_PARAMS, 引擎版本: 'v2.0.0' })).toBe(true);
  });
  it('S4-d Schema版本变 → shouldOpenNewSegment=true', () => {
    const segs = openSegment({}, BASE_PARAMS);
    expect(shouldOpenNewSegment({ 版本段记录: segs }, { ...BASE_PARAMS, Schema版本: '99' })).toBe(true);
  });
  it('S4-e 难度系数组指纹变 → shouldOpenNewSegment=true(M6·C5)', () => {
    const segs = openSegment({}, BASE_PARAMS);
    expect(shouldOpenNewSegment({ 版本段记录: segs }, { ...BASE_PARAMS, 难度系数组指纹: 'ff00ff00' })).toBe(true);
  });
  it('S4-f 段序号验证: openSegment 产生连续段序号', () => {
    const segs1 = openSegment({}, BASE_PARAMS);
    const segs2 = openSegment({ 版本段记录: segs1 }, { ...BASE_PARAMS, 引擎版本: 'v2.0.0' });
    const segs3 = openSegment({ 版本段记录: segs2 }, { ...BASE_PARAMS, 引擎版本: 'v3.0.0' });
    expect(segs3[0]!.段序号).toBe(0);
    expect(segs3[1]!.段序号).toBe(1);
    expect(segs3[2]!.段序号).toBe(2);
  });
});
