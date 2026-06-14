// P0-1x·接口冻结 stub 验收测试
import { describe, it, expect } from 'vitest';
import { CombatResolver } from '../interfaces/combatResolver.js';
import { 赌局Resolver } from '../interfaces/gamblingResolver.js';
import { 离场补结 } from '../interfaces/offstageSettler.js';
import { findRoute } from '../interfaces/findRoute.js';
import {
  提案单Schema,
  提案单条目Schema,
  方向槽枚举,
  指令信封Schema,
} from '../schema/proposal.js';
import { 席位表Schema } from '../schema/actor.js';

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
