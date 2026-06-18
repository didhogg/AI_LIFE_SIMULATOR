// P0-1x·接口冻结 stub 验收测试
import { describe, it, expect, expectTypeOf } from 'vitest';
import { ActionOptionSchema, ActionOptionListSchema } from '../schema/proposal.js';
import type { ActionOptionType } from '../schema/proposal.js';
import { replayIrreversible, assertNoRerollOnIrreversible } from '../interfaces/irreversibleGuard.js';
import type { IrreversiblePayload } from '../interfaces/irreversibleGuard.js';
import { executeToolCapability } from '../interfaces/toolCapability.js';
import type { ToolCapabilityDescriptor, ToolCapabilityType } from '../interfaces/toolCapability.js';
import { pickMutuallyExclusive, rollProbability } from '../engine/deterministicGuard.js';
import type { 核心调用条目Type, intervention_pack_v1Schema } from '../schema/memory.js';
import type { 聚合生效中内容包集哈希 } from '../interfaces/contentPackHash.js';
import { CombatResolver } from '../interfaces/combatResolver.js';
import type { 战局状态, CombatSettleResult } from '../interfaces/combatResolver.js';
import { 赌局Resolver } from '../interfaces/gamblingResolver.js';
import { 离场补结 } from '../interfaces/offstageSettler.js';
import type { 演化状态 } from '../interfaces/offstageSettler.js';
import { findRoute } from '../interfaces/findRoute.js';
import {
  提案单Schema,
  提案单条目Schema,
  方向槽枚举,
  指令信封Schema,
  失败工单条目Schema,
  失败工单Schema,
} from '../schema/proposal.js';
import type { 提案单条目Type, 提案单Type, FailureTicketType } from '../schema/proposal.js';
import type { FailureTicket } from '../replay/types.js';
import { 席位表Schema } from '../schema/actor.js';
import type { 席位表Type } from '../schema/actor.js';
import type { CheckInput } from '../engine/check.js';
import type { z } from 'zod';
import type {
  转移OptionSchema, 缔结OptionSchema, 解除OptionSchema, 赋予OptionSchema, 剥夺OptionSchema,
  调整OptionSchema, 披露OptionSchema, 移动OptionSchema, 施加OptionSchema, 植入OptionSchema,
  不可逆Schema,
} from '../schema/verb.js';
import type { 受治理路径Schema, 受治理句柄Schema } from '../schema/governedKeySpace.js';
import type { 组织属性轴条目Schema } from '../schema/org.js';
import type { 属性轴表Schema } from '../schema/preset.js';

describe('P0-1x Stub: CombatResolver（6.63·三段·未实装）', () => {
  it('init 签名抛出「未实装」', () => {
    expect(() => CombatResolver.init(['npc_a', 'npc_b'], '书房', 42)).toThrow('未实装');
  });
  it('step 签名抛出「未实装」', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => CombatResolver.step({} as any, ['攻击'], ['事件1'])).toThrow('未实装');
  });
  it('settle 签名抛出「未实装」', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => CombatResolver.settle({} as any)).toThrow('未实装');
  });
});

describe('P0-1x Stub: 赌局Resolver（6.31·与 CombatResolver 同构·未实装）', () => {
  it('resolve 签名抛出「未实装」', () => {
    expect(() => 赌局Resolver.resolve(['npc_a', 'npc_b'], '100两', '骰子')).toThrow('未实装');
  });
});

describe('P0-1x Stub: 离场补结（6.66·三段·未实装）', () => {
  it('初始化 签名抛出「未实装」', () => {
    expect(() => 离场补结.初始化({ org_a: {} }, { contract_1: {} }, 0)).toThrow('未实装');
  });
  it('推进 签名抛出「未实装」', () => {
    expect(() => 离场补结.推进({}, { 起: 0, 止: 43200 }, ['事件A'])).toThrow('未实装');
  });
  it('收束 签名抛出「未实装」', () => {
    expect(() => 离场补结.收束({})).toThrow('未实装');
  });
});

describe('P0-1x Stub: findRoute（寻路备忘·未实装）', () => {
  it('findRoute 签名抛出「未实装」', () => {
    expect(() => findRoute({}, '节点_书房', '节点_城门', '全NPC')).toThrow('未实装');
  });
});

describe('P0-1x Schema: 提案单（6.68·Zod schema·形状冻结）', () => {
  it('提案单: 空数组 parse 通过', () => {
    expect(提案单Schema.safeParse([]).success).toBe(true);
  });
  it('提案单: 最小合法条目', () => {
    expect(提案单Schema.safeParse([
      { 动作类别: '转账', 目标引用: 'npc_001' },
    ]).success).toBe(true);
  });
  it('提案单: 完整条目（含数值槽/方向槽/关联实体）', () => {
    expect(提案单条目Schema.safeParse({
      动作类别: '转账', 目标引用: 'npc_001',
      数值槽: 500, 方向槽: '转账收支方向', 关联实体: ['npc_002'],
    }).success).toBe(true);
  });
  it('方向槽: 五类全合法（Z2·6.68）', () => {
    for (const v of 方向槽枚举) {
      expect(提案单条目Schema.safeParse({ 动作类别: 'x', 方向槽: v }).success).toBe(true);
    }
  });
  it('方向槽: absent = optional', () => {
    expect(提案单条目Schema.parse({}).方向槽).toBeUndefined();
  });
  it('方向槽: 非法值拒收', () => {
    expect(提案单条目Schema.safeParse({ 方向槽: '未知方向' }).success).toBe(false);
  });
  it('数值槽: absent = optional', () => {
    expect(提案单条目Schema.parse({}).数值槽).toBeUndefined();
  });
  it('关联实体: 默认空数组', () => {
    expect(提案单条目Schema.parse({}).关联实体).toEqual([]);
  });
  it('提案单: strip 验证（未知字段被剥离）', () => {
    const res = 提案单条目Schema.parse({ 动作类别: 'x', 未知字段: 'y' });
    expect(res).not.toHaveProperty('未知字段');
  });
});

// ── P0-1 Batch 3: 指令信封（txn_id·组级原子事务）────────────────────────────────
describe('P0-1 Batch 3 Schema: 指令信封（txn_id 组级原子事务 ID）', () => {
  it('txn_id absent (optional·零迁移)', () => {
    const res = 指令信封Schema.parse({ 提案: {} });
    expect(res.txn_id).toBeUndefined();
  });
  it('txn_id present (string)', () => {
    expect(指令信封Schema.safeParse({
      txn_id: 'txn_20260614_001',
      提案: { 动作类别: '转账', 目标引用: 'npc_001' },
    }).success).toBe(true);
  });
  it('提案 字段必填', () => {
    // 缺 提案 字段时 parse 失败
    expect(指令信封Schema.safeParse({ txn_id: 'txn_001' }).success).toBe(false);
  });
  it('strip: 未知字段被剥离', () => {
    const res = 指令信封Schema.parse({ 提案: {}, 未知字段: 'y' });
    expect(res).not.toHaveProperty('未知字段');
  });
  it('提案血统 absent (optional·零迁移)', () => {
    const res = 指令信封Schema.parse({ 提案: {} });
    expect(res.提案血统).toBeUndefined();
  });
  it('提案血统 present (string·Z3·6.68)', () => {
    expect(指令信封Schema.safeParse({
      提案血统: 'pc_linjiu',
      提案: { 动作类别: '转账', 目标引用: 'npc_wang' },
    }).success).toBe(true);
  });
});

// ── 校验⑧ 语义双写核查: P0-1 新字段均非可派生真相 ──────────────────────────────────
// 「能派生的不存储」规则（AA8）：以下字段是配置/血统元数据/调用参数，
// 不是 域钟/当前纪元/累计活跃区间表 等可从游戏状态推算的派生量。
// 机械断言：新字段名不在已知可派生量集合中。
// 语义注释见各行·静态文档·人工维护。
describe('校验⑧ 语义双写核查: P0-1 新字段不存储可派生真相', () => {
  // 已知可派生量（域钟/当前纪元/活跃区间等）的代表性键名；
  // 若新字段名与此集合有交集则说明可能存在双写。
  const KNOWN_DERIVABLE = new Set([
    '域钟', '当前纪元', '累计活跃区间表', '活跃区间',
    '当前拍号', '当前绝对时刻', '当前时刻', '滴答计数',
    '当前位置', '当前HP', '当前精力', '当前好感',
  ]);

  const P0_1_NEW_FIELDS: Array<[string, string]> = [
    // [字段名, 分类说明]
    ['最大回复tokens',   'LLM路由参数·调用配置·不可从游戏状态派生'],
    ['思维链',           'LLM路由参数·调用配置·不可派生'],
    ['切片预算',         'token预算上限·调用配置·不可派生'],
    ['采样覆盖层',       '$预算控制台覆盖配置·不可派生'],
    ['切片预算覆盖层',   '$预算控制台覆盖配置·不可派生'],
    ['渲染模式覆盖',     '叙事渲染偏好·玩家配置·不可派生'],
    ['时间线分块版本戳', '存档写入时刻的引擎版本戳·元数据·不可从游戏状态派生'],
    ['txn_id',           '调用方分配的事务ID·过程元数据·不可派生'],
    ['_模板引用',        '来源模板键·血统元数据·不可从实体状态派生'],
    ['_模板快照',        '脱包兜底快照·原始数据·不可从当前状态派生'],
    ['_来源包',          'mod归属键·血统元数据·不可派生'],
    ['$模型画像采样参数','provider级调参·玩家/社区配置·不可派生'],
    // P0-1 Batch A 新字段（酒馆功能·叙事/LLM路由层·均不可从游戏状态派生）
    ['top_k',            'LLM采样参数·调用配置·不可派生'],
    ['附加采样参数',     '自由透传采样参数(MinP/TypicalP/TFS/DRY/XTC/Mirostat)·LLM路由·不可派生'],
    ['停止序列',         'LLM停止序列·调用配置·不可派生'],
    ['内容分级',         'B桶叙事内容评级·功能开关·不可从游戏状态派生'],
    ['内容容忍度',       'provider级内容容忍配置·玩家配置·不可派生'],
    ['硬审查标注',       'provider级强制审查规则·玩家配置·不可派生'],
    ['解禁提示词',       '叙事风格补正/解禁追加提示词·玩家配置·不可派生'],
    ['情绪键',           '叙事注解·单次叙事调用产出·供立绘/BGM/Live2D消费·不进判定'],
    ['表情键',           '叙事注解·同上·不进判定'],
    ['视觉锚定特征',     '人物生图提示词锚定特征表·玩家/社区配置·不可派生'],
    ['声线',             'RVC声线模型ID·语音配置·不可派生'],
    // P0-1 Batch B 新字段
    ['标的',             '条款标的(字面量或DSL v1.0表达式)·约定配置·不可从游戏状态派生'],
    // P0-1 Batch ① 🎚️🎬🤖 字段（玩家主权+破限引擎化·叙事层·不可从游戏状态派生）
    ['疲劳系数',           'NSFW疲劳倍率·$玩家偏好·偏好层权重·不可从游戏状态派生'],
    ['允许玩家覆盖SystemPrompt', '专家模式门控·叙事调用类型·玩家配置·不可派生'],
    ['玩家SystemPrompt覆盖', '覆盖串·叙事层专用·玩家配置·不可派生'],
    ['assistant预填',     '预填串/continue prefill·叙事专用·不可从游戏状态派生'],
    ['破限引子',          'per-provider破限引子表·$模型画像·引擎控·不可派生'],
  ];

  it('P0-1 新字段名均不在已知可派生量集合中', () => {
    for (const [field] of P0_1_NEW_FIELDS) {
      expect(KNOWN_DERIVABLE.has(field),
        `'${field}' 疑似可派生量·违反 AA8「能派生的不存储」`,
      ).toBe(false);
    }
  });

  it('P0-1 新字段均已分类为配置/元数据/血统（语义注释完整性）', () => {
    for (const [field, note] of P0_1_NEW_FIELDS) {
      expect(note.length, `'${field}' 缺语义注释`).toBeGreaterThan(0);
    }
  });
});

// ── P0-1 Batch 5: 席位表退化结构（6.53 C1·单机=「本机」席位）─────────────────────
describe('P0-1 Batch 5 Schema: 席位表退化结构（6.53 C1）', () => {
  it('单机退化结构 parse 通过（键=本机）', () => {
    expect(席位表Schema.safeParse({
      '本机': { 焦点角色键: 'npc_主角', 控制者: '人类', 连接状态: '本地' },
    }).success).toBe(true);
  });
  it('多席位（多人）零迁移 parse 通过', () => {
    expect(席位表Schema.safeParse({
      '本机':    { 焦点角色键: 'npc_甲', 控制者: '人类',   连接状态: '本地' },
      '玩家B':   { 焦点角色键: 'npc_乙', 控制者: 'AI',     连接状态: '在线' },
      '旁观者C': { 焦点角色键: '',       控制者: '空',      连接状态: '旁观' },
    }).success).toBe(true);
  });
  it('控制者: 三类合法（人类/AI/空）', () => {
    for (const v of ['人类', 'AI', '空'] as const) {
      expect(席位表Schema.safeParse({ s: { 控制者: v } }).success).toBe(true);
    }
  });
  it('控制者: 非法值拒收', () => {
    expect(席位表Schema.safeParse({ s: { 控制者: '系统' } }).success).toBe(false);
  });
  it('空表 = 无焦点（零席位）parse 通过', () => {
    expect(席位表Schema.safeParse({}).success).toBe(true);
    expect(席位表Schema.parse({})).toEqual({});
  });
});

// ── P0-1x 签名冻结断言 stub（三件套第③件）────────────────────────────────────────
// 前两件: 签名(interface文件) + 未实装抛错(throw stub) ← 已在 457aab2/77cb28c
// 第三件: expectTypeOf 编译期断言——签名变动则此块报错，防接线期悄悄改口径
describe('P0-1x 签名冻结断言 stub（三件套第③件·编译期口径锁）', () => {
  // ── findRoute ───────────────────────────────────────────────────────────────
  it('findRoute 返回类型冻结: string[] | null', () => {
    expectTypeOf(findRoute).returns.toEqualTypeOf<string[] | null>();
  });
  it('findRoute 参数口径冻结: (unknown, string, string, string)', () => {
    expectTypeOf(findRoute).parameters.toEqualTypeOf<[unknown, string, string, string]>();
  });

  // ── CombatResolver ──────────────────────────────────────────────────────────
  it('CombatResolver.init 返回类型冻结: 战局状态', () => {
    expectTypeOf(CombatResolver.init).returns.toEqualTypeOf<战局状态>();
  });
  it('CombatResolver.step 返回类型冻结: { 战局状态; 回合事件: string[] }', () => {
    expectTypeOf(CombatResolver.step).returns.toEqualTypeOf<{ 战局状态: 战局状态; 回合事件: string[] }>();
  });
  it('CombatResolver.settle 返回类型冻结: CombatSettleResult', () => {
    expectTypeOf(CombatResolver.settle).returns.toEqualTypeOf<CombatSettleResult>();
  });

  // ── 赌局Resolver ────────────────────────────────────────────────────────────
  it('赌局Resolver.resolve 返回类型冻结: CombatSettleResult（同构）', () => {
    expectTypeOf(赌局Resolver.resolve).returns.toEqualTypeOf<CombatSettleResult>();
  });

  // ── 离场补结 ────────────────────────────────────────────────────────────────
  it('离场补结.初始化 返回类型冻结: 演化状态', () => {
    expectTypeOf(离场补结.初始化).returns.toEqualTypeOf<演化状态>();
  });
  it('离场补结.推进 返回类型冻结: { 演化状态; 区间事实: unknown[] }', () => {
    expectTypeOf(离场补结.推进).returns.toEqualTypeOf<{ 演化状态: 演化状态; 区间事实: unknown[] }>();
  });
  it('离场补结.收束 返回类型冻结: { 事实包: unknown; 各组织升格快照: unknown }', () => {
    expectTypeOf(离场补结.收束).returns.toEqualTypeOf<{ 事实包: unknown; 各组织升格快照: unknown }>();
  });

  // ── 提案单 Schema ───────────────────────────────────────────────────────────
  it('提案单条目Type 含必要字段口径冻结', () => {
    expectTypeOf<提案单条目Type>().toMatchTypeOf<{
      动作类别: string;
      目标引用: string;
      关联实体: string[];
    }>();
  });
  it('提案单Type 为 提案单条目Type[] 口径冻结', () => {
    expectTypeOf<提案单Type>().toEqualTypeOf<提案单条目Type[]>();
  });

  // ── 席位表 Schema ───────────────────────────────────────────────────────────
  it('席位表Type 为 record 含焦点角色键/控制者/连接状态 口径冻结', () => {
    expectTypeOf<席位表Type>().toMatchTypeOf<Record<string, {
      焦点角色键?: string;
      控制者?: string;
      连接状态?: string;
    }>>();
  });
});

// ── Fix 2 · 叙事专用字段 TS 编译期隔离 ───────────────────────────────────────────────
// 核心调用条目Type（记账/检定/谜底校准/结算）结构上不含允许玩家覆盖/SystemPrompt覆盖/assistant预填
// 若有人往 核心调用条目Schema 加入这三字段，下方断言编译报错
type _HasProp<T, K extends string> = K extends keyof T ? true : false;
type _Expect<T extends true> = T;
type _Not<T extends boolean> = T extends true ? false : true;

describe('P0-1 scope: 叙事专用字段 TS 编译期隔离（核心调用条目结构上不含）', () => {
  it('核心调用条目Type 不含 允许玩家覆盖SystemPrompt', () => {
    type Assert = _Expect<_Not<_HasProp<核心调用条目Type, '允许玩家覆盖SystemPrompt'>>>;
    const _: Assert = true;
    expect(_).toBe(true);
  });
  it('核心调用条目Type 不含 玩家SystemPrompt覆盖', () => {
    type Assert = _Expect<_Not<_HasProp<核心调用条目Type, '玩家SystemPrompt覆盖'>>>;
    const _: Assert = true;
    expect(_).toBe(true);
  });
  it('核心调用条目Type 不含 assistant预填', () => {
    type Assert = _Expect<_Not<_HasProp<核心调用条目Type, 'assistant预填'>>>;
    const _: Assert = true;
    expect(_).toBe(true);
  });
});

// ── Task 4A: AOHP option_id 稳定键 ───────────────────────────────────────────

describe('Task 4A stub: AOHP option_id 稳定键（编译期锁·重渲逐字节恒等）', () => {
  it('ActionOptionSchema parse 通过', () => {
    expect(ActionOptionSchema.safeParse({ option_id: 'attack::npc_guard::damage_5' }).success).toBe(true);
  });

  it('option_id 必填（禁 undefined）', () => {
    expect(ActionOptionSchema.safeParse({}).success).toBe(false);
  });

  it('ActionOptionListSchema 默认空数组', () => {
    expect(ActionOptionListSchema.parse(undefined)).toEqual([]);
  });

  it('ActionOptionType 口径冻结: 含 option_id/tool_name/params/target_choices', () => {
    expectTypeOf<ActionOptionType>().toMatchTypeOf<{
      option_id: string;
      tool_name: string;
      params: Record<string, unknown>;
      target_choices: string[];
    }>();
  });

  it('重渲不变量: 相同 ActionOption → option_id 逐字节恒等', () => {
    const opt1: ActionOptionType = ActionOptionSchema.parse({ option_id: 'attack::npc_guard::melee', tool_name: 'attack', params: { type: 'melee' }, target_choices: ['npc_guard'] });
    const opt2: ActionOptionType = ActionOptionSchema.parse({ option_id: 'attack::npc_guard::melee', tool_name: 'attack', params: { type: 'melee' }, target_choices: ['npc_guard'] });
    expect(opt1.option_id).toBe(opt2.option_id);
  });
});

// ── Task 4B: irreversible 重放守卫 ───────────────────────────────────────────

describe('Task 4B stub: irreversible 重放守卫（对撞⑤·未实装）', () => {
  it('replayIrreversible 抛出「未实装」', () => {
    const p: IrreversiblePayload = { tick_id: 'tick-1', call_type: 'web_search', frozen_at: 0, output: null };
    expect(() => replayIrreversible(p)).toThrow('未实装');
  });

  it('assertNoRerollOnIrreversible 抛出「未实装」', () => {
    expect(() => assertNoRerollOnIrreversible('tick-1', true)).toThrow('未实装');
  });

  it('IrreversiblePayload 类型口径冻结', () => {
    expectTypeOf<IrreversiblePayload>().toMatchTypeOf<{
      tick_id: string;
      call_type: string;
      frozen_at: number;
      output: unknown;
    }>();
  });

  it('replayIrreversible 返回类型冻结: never', () => {
    expectTypeOf(replayIrreversible).returns.toBeNever();
  });
});

// ── Task 4C: 受控接口能力集 [TOOL] ───────────────────────────────────────────

describe('Task 4C stub: 受控接口能力集 [TOOL]（对撞·未实装）', () => {
  const VALID_TYPES: ToolCapabilityType[] = ['code', 'llm', 'roll_dice', 'trigger', 'output_tag'];

  it('executeToolCapability 抛出「未实装」', () => {
    const d: ToolCapabilityDescriptor = { type: 'roll_dice' };
    expect(() => executeToolCapability(d, {})).toThrow('未实装');
  });

  it('ToolCapabilityType 包含全部五类', () => {
    for (const t of VALID_TYPES) {
      const d: ToolCapabilityDescriptor = { type: t };
      expect(() => executeToolCapability(d, {})).toThrow('未实装');
    }
  });

  it('ToolCapabilityDescriptor 口径冻结', () => {
    expectTypeOf<ToolCapabilityDescriptor>().toMatchTypeOf<{ type: ToolCapabilityType }>();
  });
});

// ── Task 4D: 互斥组/probability 确定性总纲 ───────────────────────────────────

describe('Task 4D: 互斥组/probability 确定性总纲（禁 Math.random·seeded RNG）', () => {
  it('pickMutuallyExclusive: 空候选抛错', () => {
    expect(() => pickMutuallyExclusive([], 'tick-1', 1, '互斥组:A', 42)).toThrow();
  });

  it('pickMutuallyExclusive: 单候选直接返回', () => {
    expect(pickMutuallyExclusive(['only'], 'tick-1', 1, '互斥组:A', 42)).toBe('only');
  });

  it('pickMutuallyExclusive: 双跑逐位恒等（纯函数·seeded）', () => {
    const c = ['事件A', '事件B', '事件C'];
    const r1 = pickMutuallyExclusive(c, 'tick-5', 5, '互斥组:母题', 99);
    const r2 = pickMutuallyExclusive(c, 'tick-5', 5, '互斥组:母题', 99);
    expect(r1).toBe(r2);
  });

  it('pickMutuallyExclusive: 不同 salt → 可能不同（非退化）', () => {
    const c = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const results = new Set<string>();
    for (let s = 0; s < 20; s++) results.add(pickMutuallyExclusive(c, 'tick-x', 1, 'ch', s));
    expect(results.size).toBeGreaterThan(1);
  });

  it('rollProbability: p≤0 → false', () => {
    expect(rollProbability(0, 'tick-1', 1, 'ch', 1)).toBe(false);
  });

  it('rollProbability: p≥1 → true', () => {
    expect(rollProbability(1, 'tick-1', 1, 'ch', 1)).toBe(true);
  });

  it('rollProbability: 双跑逐位恒等', () => {
    const r1 = rollProbability(0.7, 'tick-3', 3, '概率:攻击', 55);
    const r2 = rollProbability(0.7, 'tick-3', 3, '概率:攻击', 55);
    expect(r1).toBe(r2);
  });

  it('rollProbability: _notice_chance/_dodge_chance 走 rngFor·禁 Math.random（lint 保证）', () => {
    const noticeChance = rollProbability(0.3, 'tick-7', 7, '越界:notice_chance', 101);
    const dodgeChance  = rollProbability(0.5, 'tick-7', 7, '越界:dodge_chance',  202);
    expect(typeof noticeChance).toBe('boolean');
    expect(typeof dodgeChance).toBe('boolean');
  });
});

// ── Task 4E: 动词表/植入字段「够不到账本」编译期断言（schema-only·零运行时） ──────────
// 目标：证明记账/检定/结算的核心调用类型结构上不含动词表字段，AI 调动词/植入也写不进真相层。
// 复用 Fix2 同款 _HasProp/_Not/_Expect 三件套，新增按 keyof 排除的批量版本 _NoForbiddenKeys：
// 对某 Target 类型，若「动词表禁用字段集」与 keyof Target 有交集，类型不通过、编译报错。
type _NoForbiddenKeys<Target, Forbidden extends string> =
  Extract<Forbidden, keyof Target> extends never ? true : false;

// Step 6.5 任务 B（优选·自动派生·防"焊死后假安全"）：
// 禁字段集不再手列字符串字面量，改从 verb.ts 实际导出的 schema 联合 keyof 推导——
// 任何人往任一动词 option / 不可逆Schema 加新字段，下方联合自动变长，断言自动跟着覆盖新字段，
// 不必有人记得同步改字符串清单。
// 注意 keyof(A|B) ≠ keyof A | keyof B（前者是交集），所以逐个 keyof 再用 | 取并集。
type 动词Option自动Key =
  | keyof NonNullable<z.infer<typeof 转移OptionSchema>>
  | keyof NonNullable<z.infer<typeof 缔结OptionSchema>>
  | keyof NonNullable<z.infer<typeof 解除OptionSchema>>
  | keyof NonNullable<z.infer<typeof 赋予OptionSchema>>
  | keyof NonNullable<z.infer<typeof 剥夺OptionSchema>>
  | keyof NonNullable<z.infer<typeof 调整OptionSchema>>
  | keyof NonNullable<z.infer<typeof 披露OptionSchema>>
  | keyof NonNullable<z.infer<typeof 移动OptionSchema>>
  | keyof NonNullable<z.infer<typeof 施加OptionSchema>>
  | keyof NonNullable<z.infer<typeof 植入OptionSchema>>;

// 不可逆Schema 自身内部字段（解除通道/重掷策略）——同样自动派生，将来加字段自动跟上。
type 不可逆内部自动Key = keyof z.infer<typeof 不可逆Schema>;

// cascade_on_change 的两个宿主（org.ts 实例级 / preset.ts 轴级声明）均已导出，可自动派生。
type 属性轴Cascade自动Key =
  | keyof z.infer<typeof 组织属性轴条目Schema>
  | keyof z.infer<typeof 属性轴表Schema>[number];

// 残留两项无法从 verb.ts/org.ts/preset.ts 的导出联合自动推出，仍手列，理由各自不同：
//   '不可逆' —— 这是「外部把 不可逆Schema 挂载在某宿主上时用的键名」，不是 不可逆Schema 自身
//               的 key，语义上不可能 keyof 自推导（self-reference 无意义）。
//   '子类键' —— 宿主是 actor.ts 的 特质条目Schema/状态标签条目Schema，目前未 export（私有
//               const），无法跨文件 keyof 联合；若未来需要也自动化，得先在 actor.ts 加一行
//               export（本批"不改 actor.ts 任何 schema"红线内不做，留 6.59/下一批顺手补）。
type 手列残留Key = '不可逆' | '子类键';

type VerbTableForbiddenKey = 动词Option自动Key | 不可逆内部自动Key | 属性轴Cascade自动Key | 手列残留Key;

// 退一步 guard（任务 B 兜底）：旧版手列五字段必须仍是新派生集合的子集——
// 防止"自动派生"重构本身悄悄丢字段，造成真正的假安全。
type _IsSubsetOf<A extends string, B extends string> = Exclude<A, B> extends never ? true : false;
type 旧版手列五字段 = '标的类型' | '子类键' | 'side_effects' | 'cascade_on_change' | '不可逆';

describe('Task 4E guard: 禁字段集自动派生未丢字段（任务 B 兜底）', () => {
  it('旧版手列五字段 ⊆ 新派生 VerbTableForbiddenKey', () => {
    type Assert = _Expect<_IsSubsetOf<旧版手列五字段, VerbTableForbiddenKey>>;
    const _: Assert = true;
    expect(_).toBe(true);
  });
});

describe('Task 4E: 动词表/植入字段 TS 编译期隔离（核心调用条目 结构上不含）', () => {
  // ── ① 记账（核心调用条目Type 本身·本批 verb.ts 字段从未写入此类型）────────────────
  it('核心调用条目Type 不含任一动词表字段', () => {
    type Assert = _Expect<_NoForbiddenKeys<核心调用条目Type, VerbTableForbiddenKey>>;
    const _: Assert = true;
    expect(_).toBe(true);
  });

  // ── ② 检定（CheckInput·Ring 0 纯函数判定输入·engine/check.ts）────────────────────
  it('CheckInput 不含任一动词表字段', () => {
    type Assert = _Expect<_NoForbiddenKeys<CheckInput, VerbTableForbiddenKey>>;
    const _: Assert = true;
    expect(_).toBe(true);
  });

  // ── ④ 植入专项（§六 DoD）：植入OptionSchema 的可达字段够不到 ①/② 两类核心调用入参 ──
  // 植入 option 本批继承 动词Option基础Schema（side_effects?/标的类型?·Step 1/3-A/3-B/5），
  // 尚未接线，唯一合法落点留给未来「派生认知层」（认知档案条目Schema.误差表 /
  // 信念条目Schema.动摇度 / $涟漪候选Schema 条目），不是账本/判定输入——
  // 下方断言证明：植入 option 自身字段名，与 核心调用条目Type / CheckInput 的字段名零交集。
  it('植入OptionSchema 字段 与 核心调用条目Type 字段名零交集', () => {
    type 植入OptionKey = keyof NonNullable<z.infer<typeof 植入OptionSchema>>;
    type Assert = _Expect<_NoForbiddenKeys<核心调用条目Type, 植入OptionKey>>;
    const _: Assert = true;
    expect(_).toBe(true);
  });
  it('植入OptionSchema 字段 与 CheckInput 字段名零交集', () => {
    type 植入OptionKey = keyof NonNullable<z.infer<typeof 植入OptionSchema>>;
    type Assert = _Expect<_NoForbiddenKeys<CheckInput, 植入OptionKey>>;
    const _: Assert = true;
    expect(_).toBe(true);
  });
  it('不可逆Schema 字段（解除通道/重掷策略） 与 核心调用条目Type/CheckInput 字段名零交集', () => {
    type 不可逆Key = keyof z.infer<typeof 不可逆Schema>;
    type Assert1 = _Expect<_NoForbiddenKeys<核心调用条目Type, 不可逆Key>>;
    type Assert2 = _Expect<_NoForbiddenKeys<CheckInput, 不可逆Key>>;
    const a: Assert1 = true;
    const b: Assert2 = true;
    expect(a).toBe(true);
    expect(b).toBe(true);
  });
});

// 6.59 受治理键空间 registry 键空间字段 forbidden 集（distinctive·registry-only）
type KeySpaceForbiddenKey =
  | '规范键' | '命名空间' | '来源包'
  | '键条目' | '归并条目' | '母题条目' | '仲裁策略';

describe('6.59 registry 键空间够不到核心调用（编译期断言·钉死）', () => {
  it('记账核心 核心调用条目Type 不含任一 registry 键空间字段', () => {
    type Assert = _Expect<_NoForbiddenKeys<核心调用条目Type, KeySpaceForbiddenKey>>;
    const _: Assert = true;
    expect(_).toBe(true);
  });
  it('检定核心 CheckInput 不含任一 registry 键空间字段', () => {
    type Assert = _Expect<_NoForbiddenKeys<CheckInput, KeySpaceForbiddenKey>>;
    const _: Assert = true;
    expect(_).toBe(true);
  });

  // add-constraint 零迁移类型级证据：受治理路径/句柄 z.infer 仍 = 裸 string
  // （双向 extends = 互相可赋 = 相等，只用 _Expect 不引第二工具）
  it('受治理路径Schema.infer === string（Step6 零迁移类型证）', () => {
    type P = z.infer<typeof 受治理路径Schema>;
    type Assert = _Expect<P extends string ? (string extends P ? true : false) : false>;
    const _: Assert = true;
    expect(_).toBe(true);
  });
  it('受治理句柄Schema.infer === string（Step7 零迁移类型证）', () => {
    type H = z.infer<typeof 受治理句柄Schema>;
    type Assert = _Expect<H extends string ? (string extends H ? true : false) : false>;
    const _: Assert = true;
    expect(_).toBe(true);
  });
});

// ── Z5·失败工单 Schema（6.68·地基·零迁移·逻辑实装 P0-7）────────────────────────────

describe('Z5 失败工单 Schema（6.68·Zod 地基·proposal.ts）', () => {
  it('最小合法条目（旧字段·Z5 字段全缺省）', () => {
    expect(失败工单条目Schema.safeParse({
      tickId: 'tick-001', callGeneration: 'gen-0', errorCode: 'timeout',
    }).success).toBe(true);
  });
  it('Z5 字段全填 parse 通过', () => {
    expect(失败工单条目Schema.safeParse({
      tickId: 'tick-002', callGeneration: 'gen-1', errorCode: 'soft-reject',
      detail: '模型拒绝',
      提案单引用: 'prop_20260618_001',
      叙事段引用: '42',
      表达式预求值: 8,
      已冻结: true,
    }).success).toBe(true);
  });
  it('Z5 字段全 absent（可空·零迁移）', () => {
    const res = 失败工单条目Schema.parse({ tickId: 'tick-003', callGeneration: 'gen-2', errorCode: 'ctx-overflow' });
    expect(res.提案单引用).toBeUndefined();
    expect(res.叙事段引用).toBeUndefined();
    expect(res.表达式预求值).toBeUndefined();
    expect(res.已冻结).toBeUndefined();
  });
  it('表达式预求值 拒收浮点（.int() 约束）', () => {
    expect(失败工单条目Schema.safeParse({
      tickId: 'tick-004', callGeneration: 'gen-3', errorCode: 'err',
      表达式预求值: 3.14,
    }).success).toBe(false);
  });
  it('失败工单Schema 默认空数组', () => {
    expect(失败工单Schema.parse(undefined)).toEqual([]);
  });
  // ── 单源派生编译期断言：FailureTicket ≡ FailureTicketType ────────────────────
  it('FailureTicket（replay） ≡ FailureTicketType（proposal）编译期逐字节同型', () => {
    type Assert1 = _Expect<FailureTicket extends FailureTicketType ? true : false>;
    type Assert2 = _Expect<FailureTicketType extends FailureTicket ? true : false>;
    const _1: Assert1 = true;
    const _2: Assert2 = true;
    expect(_1 && _2).toBe(true);
  });
});

// ── 批③ Step2 · content_hash 编译期断言 ─────────────────────────────────────────────
type ContentHashForbiddenKey = 'content_hash';

describe('批③ content_hash 编译期断言（零源改动·test-only）', () => {
  // ① 聚合函数输出 === string（import type + ReturnType·不触发 throw body）
  it('聚合生效中内容包集哈希 返回类型 === string', () => {
    type R = ReturnType<typeof 聚合生效中内容包集哈希>;
    type Assert = _Expect<R extends string ? (string extends R ? true : false) : false>;
    const _: Assert = true;
    expect(_).toBe(true);
  });

  // ② content_hash z.infer === string（.optional() 故剥 undefined·NonNullable）
  it('intervention_pack_v1Schema.content_hash infer === string（.optional() 故剥 undefined）', () => {
    type Raw = z.infer<typeof intervention_pack_v1Schema>['content_hash']; // string | undefined
    type Stripped = NonNullable<Raw>;
    type Assert = _Expect<Stripped extends string ? (string extends Stripped ? true : false) : false>;
    const _: Assert = true;
    expect(_).toBe(true);
  });

  // ③ content_hash ⊥ 核心调用类型（core 侧·防泄进核心调用）
  it('核心调用条目Type 不含 content_hash 键', () => {
    type Assert = _Expect<_NoForbiddenKeys<核心调用条目Type, ContentHashForbiddenKey>>;
    const _: Assert = true;
    expect(_).toBe(true);
  });
  it('CheckInput 不含 content_hash 键', () => {
    type Assert = _Expect<_NoForbiddenKeys<CheckInput, ContentHashForbiddenKey>>;
    const _: Assert = true;
    expect(_).toBe(true);
  });
});
