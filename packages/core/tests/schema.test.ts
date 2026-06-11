import { describe, it, expect } from 'vitest';
import {
  // index / root
  RootSchema,
  BLUEPRINT_KEYS,
  // per-layer schemas
  SystemSchema,
  TickSchema,
  NarrativeSettingSchema,
  StateMachineSchema,
  世界Schema,
  世界域Schema,
  NpcSchema,
  NpcRecordSchema,
  已故NPC归档Schema,
  认知档案Schema,
  组织实体Schema,
  组织关系网Schema,
  全局Schema,
  地图Schema,
  战争状态Schema,
  赛事实例Schema,
  货币系统Schema,
  工作记忆Schema,
  长期归档Schema,
  日程Schema,
  行动卡库Schema,
  仲裁器Schema,
  mod注册表Schema,
  播报条目Schema,
  $运气Schema,
  $寿命预期Schema,
  $流速Schema,
  $战斗暂存Schema,
  $隐藏记忆库Schema,
  $天命重掷券Schema,
  $metaSchema,
} from '../schema/index.js';

// ══════════════════════════════════════════
// (a) Per-layer parse tests
// ══════════════════════════════════════════

describe('4.1 System layer', () => {
  it('valid empty parse', () => {
    expect(() => SystemSchema.parse({})).not.toThrow();
  });
  it('valid TickSchema', () => {
    expect(() => TickSchema.parse({ id: 'tick-1', 拍计数: 0, 难度系数组指纹: 'abc' })).not.toThrow();
  });
  it('valid NarrativeSettingSchema', () => {
    expect(() => NarrativeSettingSchema.parse({ 人称: '第三人称', 叙事偏好: '纪实风格，少用修辞' })).not.toThrow();
  });
  it('valid StateMachineSchema', () => {
    expect(() => StateMachineSchema.parse({
      当前态: 'PLAYING',
      模态栈: ['DIALOG'],
      timeMode: 'TURN',
    })).not.toThrow();
  });
  it('invalid: 拍计数 negative', () => {
    expect(TickSchema.safeParse({ 拍计数: -1 }).success).toBe(false);
  });
  it('invalid: timeMode wrong enum value', () => {
    expect(StateMachineSchema.safeParse({ timeMode: 'REALTIME' }).success).toBe(false);
  });
  it('invalid: 模态栈 exceeds max 4', () => {
    expect(StateMachineSchema.safeParse({
      模态栈: ['A', 'B', 'C', 'D', 'E'],
    }).success).toBe(false);
  });
  it('unknown keys stripped (not error) on SystemSchema', () => {
    const res = SystemSchema.safeParse({ unknownField: 'x' });
    expect(res.success).toBe(true);
  });
  it('unknown keys rejected in strict mode', () => {
    expect(SystemSchema.strict().safeParse({ unknownField: 'x' }).success).toBe(false);
  });
  // 拍板一：_叙事设置.叙事偏好
  it('valid NarrativeSettingSchema with 叙事偏好', () => {
    const res = NarrativeSettingSchema.safeParse({ 叙事偏好: '偏向宫斗与权谋，少写打斗细节' });
    expect(res.success).toBe(true);
    expect((res.data as { 叙事偏好: string }).叙事偏好).toBe('偏向宫斗与权谋，少写打斗细节');
  });
  it('valid: 叙事偏好 defaults to empty string', () => {
    const res = NarrativeSettingSchema.parse({});
    expect(res.叙事偏好).toBe('');
  });
  it('invalid: 叙事偏好 wrong type', () => {
    expect(NarrativeSettingSchema.safeParse({ 叙事偏好: 42 }).success).toBe(false);
  });
  // 收口防回归断言
  it('事件倾向 已从 NarrativeSettingSchema 移除', () => {
    expect('事件倾向' in NarrativeSettingSchema.shape).toBe(false);
  });
  it('写实度 已从 NarrativeSettingSchema 移除（→$玩家偏好.写实程度）', () => {
    expect('写实度' in NarrativeSettingSchema.shape).toBe(false);
  });
  it('叙事风格 已从 NarrativeSettingSchema 移除（并入叙事偏好）', () => {
    expect('叙事风格' in NarrativeSettingSchema.shape).toBe(false);
  });
  it('NarrativeSettingSchema 最终形态仅含 人称 + 叙事偏好', () => {
    expect(Object.keys(NarrativeSettingSchema.shape).sort()).toEqual(['人称', '叙事偏好'].sort());
  });
});

describe('4.2 World layer', () => {
  it('valid empty parse', () => {
    expect(() => 世界Schema.parse({})).not.toThrow();
    expect(() => 世界域Schema.parse({})).not.toThrow();
  });
  it('valid 世界 with calendar', () => {
    expect(() => 世界Schema.parse({
      纪元分钟: 525600,
      历法: { 纪年法: '年号', 纪元锚点: 0, 年号表: [], 月制: '农历', 显示模板: '{年}{月}{日}' },
      年代背景: '明末',
      气候带: '温带季风',
      当前粒度: '日常',
    })).not.toThrow();
  });
  it('valid 世界域 with entries', () => {
    expect(() => 世界域Schema.parse({
      主世界: { 玩法预设引用: 'preset-01', 域时钟: 0, 封存状态: false },
    })).not.toThrow();
  });
  it('invalid: 纪元分钟 negative', () => {
    expect(世界Schema.safeParse({ 纪元分钟: -1 }).success).toBe(false);
  });
  it('invalid: 纪元分钟 wrong type', () => {
    expect(世界Schema.safeParse({ 纪元分钟: '1000' }).success).toBe(false);
  });
  it('unknown key strict rejection', () => {
    expect(世界Schema.strict().safeParse({ 季节: '春' }).success).toBe(false); // 季节 is derived
  });
});

describe('4.3 Actor layer', () => {
  it('valid empty NpcSchema parse', () => {
    expect(() => NpcSchema.parse({})).not.toThrow();
  });
  it('valid NPC with attributes', () => {
    expect(() => NpcSchema.parse({
      姓名: '李明',
      性别: '男',
      属性: { 体质: 12, 智慧: 15, 感知: 10, 魅力: 8, 心理: 14 },
      派生: { HP: 100, HP上限: 100, 精力: 80, 精力上限: 100, 颜值: 60 },
      性格五轴: { 开放: 70, 尽责: 80, 外向: 40, 宜人: 60, 神经质: 30 },
    })).not.toThrow();
  });
  it('valid NpcRecordSchema', () => {
    expect(() => NpcRecordSchema.parse({
      npc_001: { 姓名: '王芳' },
    })).not.toThrow();
  });
  it('valid 认知档案 with 印象', () => {
    expect(() => 认知档案Schema.parse({
      npc_001: {
        npc_002: {
          了解度: 45,
          误差表: { 魅力: -5 },
          印象: [{ 标签: '热情', 极性: '正', 强度: 70, 来源: 'event-001', 获知时间: 1000, 衰减速率: 0.1 }],
          时效: 5000,
        },
      },
    })).not.toThrow();
  });
  it('invalid: 性格五轴 value out of range', () => {
    expect(NpcSchema.safeParse({ 性格五轴: { 开放: 150 } }).success).toBe(false);
  });
  it('invalid: 了解度 out of range', () => {
    expect(认知档案Schema.safeParse({
      a: { b: { 了解度: 200 } },
    }).success).toBe(false);
  });
  it('invalid: 印象 强度 out of range', () => {
    expect(认知档案Schema.safeParse({
      a: { b: { 印象: [{ 强度: -1 }] } },
    }).success).toBe(false);
  });
  it('valid empty 已故NPC归档', () => {
    expect(() => 已故NPC归档Schema.parse({})).not.toThrow();
  });
  it('unknown key strict rejection on NpcSchema', () => {
    expect(NpcSchema.strict().safeParse({ 性格标签: 'ENTJ' }).success).toBe(false); // 派生字段
  });
});

describe('4.4 Org layer', () => {
  it('valid empty parse', () => {
    expect(() => 组织实体Schema.parse({})).not.toThrow();
    expect(() => 组织关系网Schema.parse({})).not.toThrow();
  });
  it('valid org entity', () => {
    expect(() => 组织实体Schema.parse({
      org_001: {
        名称: '天下商行',
        类型: '商业',
        规模: '大型',
      },
    })).not.toThrow();
  });
  it('invalid: 占股 out of range', () => {
    expect(组织实体Schema.safeParse({ org: { 占股: 200 } }).success).toBe(false);
  });
});

describe('4.5 Global layer', () => {
  it('valid empty parse', () => {
    expect(() => 全局Schema.parse({})).not.toThrow();
  });
  it('valid secret entry', () => {
    expect(() => 全局Schema.parse({
      秘密库: {
        secret_001: {
          母题: '谋杀',
          涉事方: [{ 实体键: 'npc_001', 角色: '主谋' }],
          进展: 20,
          严重度: 80,
          暴露度: 5,
          $谜底: '是继母下的毒',
          知情名单: [{ 对象: 'npc_002', 知情程度: 30, 立场: '动摇', 掩护基调: '' }],
        },
      },
    })).not.toThrow();
  });
  it('invalid: 进展 out of range', () => {
    expect(全局Schema.safeParse({
      秘密库: { s: { 进展: 150 } },
    }).success).toBe(false);
  });
  it('invalid: 覆写日志 wrong type', () => {
    expect(全局Schema.safeParse({ 覆写日志: 'not-an-array' }).success).toBe(false);
  });
});

describe('4.6 Map / War layer', () => {
  it('valid empty parse', () => {
    expect(() => 地图Schema.parse({})).not.toThrow();
    expect(() => 战争状态Schema.parse({})).not.toThrow();
    expect(() => 赛事实例Schema.parse({})).not.toThrow();
  });
  it('valid location entry', () => {
    expect(() => 地图Schema.parse({
      地点: {
        loc_001: { 名称: '京城', 类型: '城市', 控制度: 80 },
      },
    })).not.toThrow();
  });
  it('invalid: 探索度 out of range', () => {
    expect(地图Schema.safeParse({
      地点: { loc: { 探索度: 150 } },
    }).success).toBe(false);
  });
  it('invalid: 战争状态 wrong type', () => {
    expect(战争状态Schema.safeParse({ war: '交战' }).success).toBe(false);
  });
  // 拍板二：地点.相邻 / 显示坐标
  it('valid: 地点 with 相邻 entries', () => {
    expect(地图Schema.safeParse({
      地点: {
        loc_A: {
          名称: '东京汴梁',
          相邻: [
            { 目标: 'loc_B', 方式: '官道', 距离: 3 },
            { 目标: 'loc_C' },
          ],
        },
      },
    }).success).toBe(true);
  });
  it('valid: 地点 with 显示坐标', () => {
    expect(地图Schema.safeParse({
      地点: {
        loc_A: { 显示坐标: { x: 120.5, y: -30.2 } },
      },
    }).success).toBe(true);
  });
  it('valid: 相邻 defaults to empty array', () => {
    const res = 地图Schema.parse({ 地点: { loc_A: {} } });
    expect(res.地点['loc_A']?.相邻).toEqual([]);
  });
  it('valid: 显示坐标 is optional (absent = ok)', () => {
    const res = 地图Schema.parse({ 地点: { loc_A: {} } });
    expect(res.地点['loc_A']?.显示坐标).toBeUndefined();
  });
  it('invalid: 相邻 距离 negative', () => {
    expect(地图Schema.safeParse({
      地点: { loc_A: { 相邻: [{ 目标: 'loc_B', 距离: -1 }] } },
    }).success).toBe(false);
  });
  it('invalid: 显示坐标 missing y', () => {
    expect(地图Schema.safeParse({
      地点: { loc_A: { 显示坐标: { x: 10 } } },
    }).success).toBe(false);
  });
  // P0-1.2：地点.边界
  it('valid: 地点 with 边界 polygon', () => {
    expect(地图Schema.safeParse({
      地点: {
        loc_A: {
          边界: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
        },
      },
    }).success).toBe(true);
  });
  it('valid: 边界 is optional (absent = ok)', () => {
    const res = 地图Schema.parse({ 地点: { loc_A: {} } });
    expect(res.地点['loc_A']?.边界).toBeUndefined();
  });
  it('invalid: 边界 element missing y', () => {
    expect(地图Schema.safeParse({
      地点: { loc_A: { 边界: [{ x: 5 }] } },
    }).success).toBe(false);
  });
});

describe('4.7 Economy layer', () => {
  it('valid empty parse', () => {
    expect(() => 货币系统Schema.parse({})).not.toThrow();
  });
  it('valid economy with accounts', () => {
    expect(() => 货币系统Schema.parse({
      基准币种: '两',
      账户: {
        持有: { 两: 100, 铜: 500 },
        储蓄: { 两: 50 },
      },
    })).not.toThrow();
  });
  it('valid: negative 持有 (透支档 6.25)', () => {
    const res = 货币系统Schema.safeParse({
      账户: { 持有: { 两: -200 } },
    });
    expect(res.success).toBe(true);
  });
  it('invalid: wrong type on 账户', () => {
    expect(货币系统Schema.safeParse({ 账户: '满载' }).success).toBe(false);
  });
});

describe('4.8 Memory / Schedule layer', () => {
  it('valid empty parse', () => {
    expect(() => 工作记忆Schema.parse([])).not.toThrow();
    expect(() => 长期归档Schema.parse([])).not.toThrow();
    expect(() => 日程Schema.parse({})).not.toThrow();
    expect(() => 行动卡库Schema.parse({})).not.toThrow();
    expect(() => 仲裁器Schema.parse({})).not.toThrow();
    expect(() => mod注册表Schema.parse({})).not.toThrow();
  });
  it('valid memory entry', () => {
    expect(() => 工作记忆Schema.parse([{
      记忆id: 'm001',
      发生时间: 1440,
      标题: '初遇李明',
      摘要: '在集市偶遇',
      重要度: '重要',
    }])).not.toThrow();
  });
  it('valid schedule', () => {
    expect(() => 日程Schema.parse({
      上午: [{ 行动: '练剑', 地点: 'loc_001', 行动点消耗: 2 }],
    })).not.toThrow();
  });
  it('invalid: 行动点消耗 out of range', () => {
    expect(行动卡库Schema.safeParse({
      card: { 行动点消耗: 25 },
    }).success).toBe(false);
  });
  it('invalid: 工作记忆 not array', () => {
    expect(工作记忆Schema.safeParse({ id: '1' }).success).toBe(false);
  });
  // P0-1.1 收口：播报条目 打断级别 / 最迟期限 预埋
  it('播报条目: 含打断级别和最迟期限的条目 parse 通过', () => {
    expect(播报条目Schema.safeParse({
      播报id: 'b001', 内容: '事件爆发', 打断级别: '硬闯', 最迟期限: 1440,
    }).success).toBe(true);
  });
  it('播报条目: 不含打断级别/最迟期限的旧格式条目兼容通过', () => {
    expect(播报条目Schema.safeParse({ 播报id: 'b002', 内容: '普通播报' }).success).toBe(true);
  });
  it('播报条目: 非法打断级别被拒', () => {
    expect(播报条目Schema.safeParse({ 打断级别: '强制' }).success).toBe(false);
  });
});

describe('4.9 $ layer', () => {
  it('valid $运气', () => {
    expect(() => $运气Schema.parse(75)).not.toThrow();
  });
  it('invalid: $运气 out of range', () => {
    expect($运气Schema.safeParse(0).success).toBe(false);
    expect($运气Schema.safeParse(101).success).toBe(false);
  });
  it('invalid: $寿命预期 wrong type', () => {
    expect($寿命预期Schema.safeParse('immortal').success).toBe(false);
  });
  it('valid $流速', () => {
    expect(() => $流速Schema.parse({ 模式: '自动', 速度档: 2, 自动暂停触发: ['遭遇战'] })).not.toThrow();
  });
  it('invalid: $流速 模式 wrong enum', () => {
    expect($流速Schema.safeParse({ 模式: 'REALTIME' }).success).toBe(false);
  });
  it('valid $战斗暂存', () => {
    expect(() => $战斗暂存Schema.parse({
      单位: [{ NPC键: 'npc_001', q: 2, r: -1, 朝向: 3, 临时HP: 45 }],
    })).not.toThrow();
  });
  it('invalid: $战斗暂存 朝向 out of range', () => {
    expect($战斗暂存Schema.safeParse({ 单位: [{ 朝向: 9 }] }).success).toBe(false);
  });
  it('valid empty $隐藏记忆库', () => {
    expect(() => $隐藏记忆库Schema.parse({})).not.toThrow();
  });
  it('valid $meta', () => {
    expect(() => $metaSchema.parse({ 总回合数: 100, 历代角色数: 3 })).not.toThrow();
  });
  it('invalid: $meta 历代角色数 below min', () => {
    expect($metaSchema.safeParse({ 历代角色数: 0 }).success).toBe(false);
  });
  // 拍板一：$玩家偏好 结构化权重（开放键，引擎加权用）
  it('valid $玩家偏好 with open-string 母题权重', () => {
    const RootRef = { $玩家偏好: RootSchema.shape.$玩家偏好 };
    const res = RootRef.$玩家偏好.safeParse({
      母题权重: { 宫斗: 2.0, 克苏鲁: 1.5, 修真: 0.5 },
      写实度权重: 60,
      事件偏好权重: { 战斗: 0.8, 爱情: 1.2 },
    });
    expect(res.success).toBe(true);
  });
  it('valid: $玩家偏好 empty defaults', () => {
    const res = RootSchema.shape.$玩家偏好.parse({});
    expect(res.母题权重).toEqual({});
    expect(res.写实度权重).toBe(50);
    expect(res.事件偏好权重).toEqual({});
  });
  it('invalid: $玩家偏好 写实度权重 out of range', () => {
    expect(RootSchema.shape.$玩家偏好.safeParse({ 写实度权重: 200 }).success).toBe(false);
  });
  it('invalid: $玩家偏好 母题权重 negative value', () => {
    expect(RootSchema.shape.$玩家偏好.safeParse({ 母题权重: { 宫斗: -1 } }).success).toBe(false);
  });
  // P0-1.2：$玩家偏好.写实程度（0–1）
  it('valid: $玩家偏好 写实程度 boundary values', () => {
    expect(RootSchema.shape.$玩家偏好.safeParse({ 写实程度: 0 }).success).toBe(true);
    expect(RootSchema.shape.$玩家偏好.safeParse({ 写实程度: 1 }).success).toBe(true);
    expect(RootSchema.shape.$玩家偏好.safeParse({ 写实程度: 0.5 }).success).toBe(true);
  });
  it('valid: $玩家偏好 写实程度 defaults to 0.5', () => {
    const res = RootSchema.shape.$玩家偏好.parse({});
    expect(res.写实程度).toBe(0.5);
  });
  it('invalid: $玩家偏好 写实程度 > 1', () => {
    expect(RootSchema.shape.$玩家偏好.safeParse({ 写实程度: 1.01 }).success).toBe(false);
  });
  it('invalid: $玩家偏好 写实程度 < 0', () => {
    expect(RootSchema.shape.$玩家偏好.safeParse({ 写实程度: -0.1 }).success).toBe(false);
  });
  // P0-1.1 收口：$天命重掷券
  it('$天命重掷券: 空状态 parse 后剩余张数=0', () => {
    const res = $天命重掷券Schema.parse({});
    expect(res.剩余张数).toBe(0);
    expect(res.已用记录).toEqual([]);
  });
  it('$天命重掷券: 带已用记录 parse 通过', () => {
    expect($天命重掷券Schema.safeParse({
      剩余张数: 2, 已用记录: [{ 拍号: 5, 事由: '复活' }],
    }).success).toBe(true);
  });
  it('$天命重掷券: 剩余张数为负被拒', () => {
    expect($天命重掷券Schema.safeParse({ 剩余张数: -1 }).success).toBe(false);
  });
  it('RootSchema: 空状态 parse 后含 $天命重掷券 且剩余张数=0', () => {
    const state = RootSchema.parse({});
    expect(state.$天命重掷券.剩余张数).toBe(0);
  });
});

// ══════════════════════════════════════════
// (b) Minimum playable state fixture
// ══════════════════════════════════════════

describe('minimum playable state', () => {
  it('RootSchema.parse({}) passes with all defaults', () => {
    expect(() => RootSchema.parse({})).not.toThrow();
  });

  it('parsed empty state has correct _系统版本', () => {
    const state = RootSchema.parse({});
    expect(state._系统版本).toBe('4.1');
  });

  it('full minimal fixture parses', () => {
    const fixture = {
      _系统版本: '4.1' as const,
      世界: {
        纪元分钟: 525600, // 1 year
        年代背景: '北宋·元佑年间',
        气候带: '温带季风',
        当前粒度: '日常',
      },
      状态机: {
        当前态: 'PLAYING',
        timeMode: 'PAUSED' as const,
        双时钟: { 世界钟: 525600, 镜头钟: 525600 },
      },
      镜头焦点角色: 'npc_主角',
      NPC: {
        npc_主角: {
          姓名: '苏青',
          性别: '女',
          种族: '人类',
          出生日期: 0,
          位置: 'loc_东京汴梁',
          存活状态: '存活',
          属性: { 体质: 10, 智慧: 16, 感知: 12, 魅力: 14, 心理: 11 },
          派生: { HP: 80, HP上限: 80, 精力: 70, 精力上限: 100, 颜值: 72 },
          性格五轴: { 开放: 85, 尽责: 60, 外向: 55, 宜人: 70, 神经质: 40 },
          行动点: { 当前: 3, 上限: 4 },
          重要等级: '主角',
        },
      },
      地图: {
        地点: {
          loc_东京汴梁: {
            名称: '东京汴梁',
            类别: '都城',
            控制方: 'org_宋廷',
            探索度: 100,
          },
        },
      },
      全局: {
        家族树: { 边: {}, 幽灵节点: {} },
      },
      货币系统: {
        基准币种: '贯',
        账户: { 持有: { 贯: 50 } },
      },
      $运气: 55,
      $寿命预期: 65,
    };
    expect(() => RootSchema.parse(fixture)).not.toThrow();
  });
});

// ══════════════════════════════════════════
// (c) Blueprint ↔ schema consistency check
// ══════════════════════════════════════════

describe('blueprint ↔ schema consistency', () => {
  it('RootSchema.shape keys match blueprint 4.0 (diff = zero)', () => {
    const schemaKeys = new Set(Object.keys(RootSchema.shape));
    const blueprintKeys = new Set<string>(BLUEPRINT_KEYS);

    const inSchemaNotBlueprint = [...schemaKeys].filter(k => !blueprintKeys.has(k));
    const inBlueprintNotSchema = [...blueprintKeys].filter(k => !schemaKeys.has(k));

    expect(inSchemaNotBlueprint).toEqual([]);
    expect(inBlueprintNotSchema).toEqual([]);
    expect(schemaKeys.size).toBe(40);
  });

  it('BLUEPRINT_KEYS has no duplicates', () => {
    const set = new Set(BLUEPRINT_KEYS);
    expect(set.size).toBe(BLUEPRINT_KEYS.length);
  });
});
