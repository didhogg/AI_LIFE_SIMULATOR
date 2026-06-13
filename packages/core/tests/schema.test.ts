import { describe, it, expect } from 'vitest';
import {
  // index / root
  RootSchema,
  BLUEPRINT_KEYS,
  // per-layer schemas
  SystemSchema,
  TickSchema,
  TickLogEntrySchema,
  NarrativeSettingSchema,
  StateMachineSchema,
  世界Schema,
  世界域Schema,
  活跃区间条目Schema,
  席位表Schema,
  NpcSchema,
  NpcRecordSchema,
  已故NPC归档Schema,
  认知档案Schema,
  关系声明条目Schema,
  既往记忆种子条目Schema,
  占位解析槽Schema,
  组织实体Schema,
  组织关系网Schema,
  组织属性轴条目Schema,
  离场演化契约Schema,
  组织占位形态Schema,
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
  $存档种子Schema,
  $流速Schema,
  $战斗暂存Schema,
  $隐藏记忆库Schema,
  $天命重掷券Schema,
  $metaSchema,
  $模型画像Schema,
  玩法预设Schema,
  检定档切分表Schema,
  钳制表Schema,
  媒介登记表Schema,
  叙事分发表Schema,
  母题词汇表Schema,
  实体模板库Schema,
  开局装配数据Schema,
  文风库Schema,
  叙事模板正文长度上限,
  HISTORY_TEXT_MAX,
  编年史条目Schema,
  约定子类型Schema,
} from '../schema/index.js';
import { 叙事流条目Schema } from '../schema/narrativeStream.js';

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
    expect(() => NarrativeSettingSchema.parse({ 人称: { 视角宿主: '主角', 人称: '三' }, 叙事偏好: '纪实风格，少用修辞' })).not.toThrow();
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
  // 6.75 功能开关表 新增开关
  it('功能开关表: 默认值正确', () => {
    const res = SystemSchema.parse({});
    expect(res.功能开关表.认知迷雾).toBe(true);
    expect(res.功能开关表.上帝视角).toBe(false);
    expect(res.功能开关表.观战模式).toBe(false);
    expect(res.功能开关表.舞台追踪).toBe('自动按场景');
    expect(res.功能开关表.二审严格度).toBe(50);
    expect(res.功能开关表.二审维度开关).toEqual({});
  });
  it('功能开关表: 舞台追踪 接受合法枚举值', () => {
    const r1 = SystemSchema.parse({ 功能开关表: { 舞台追踪: '强制开' } });
    expect(r1.功能开关表.舞台追踪).toBe('强制开');
    const r2 = SystemSchema.parse({ 功能开关表: { 舞台追踪: '关' } });
    expect(r2.功能开关表.舞台追踪).toBe('关');
  });
  it('功能开关表: 舞台追踪 拒绝非法枚举值', () => {
    expect(SystemSchema.safeParse({ 功能开关表: { 舞台追踪: '手动' } }).success).toBe(false);
  });
  it('功能开关表: 二审严格度 接受 0–100', () => {
    expect(SystemSchema.safeParse({ 功能开关表: { 二审严格度: 0 } }).success).toBe(true);
    expect(SystemSchema.safeParse({ 功能开关表: { 二审严格度: 100 } }).success).toBe(true);
  });
  it('功能开关表: 二审严格度 拒绝越界值', () => {
    expect(SystemSchema.safeParse({ 功能开关表: { 二审严格度: -1 } }).success).toBe(false);
    expect(SystemSchema.safeParse({ 功能开关表: { 二审严格度: 101 } }).success).toBe(false);
  });
  it('功能开关表: 二审维度开关 接受任意维度键', () => {
    const res = SystemSchema.parse({ 功能开关表: { 二审维度开关: { 道德: true, 逻辑: false } } });
    expect(res.功能开关表.二审维度开关).toEqual({ 道德: true, 逻辑: false });
  });
  it('功能开关表: passthrough 允许 mod 注入自定义键', () => {
    const res = SystemSchema.parse({ 功能开关表: { mod_自定义特性: true } });
    expect((res.功能开关表 as Record<string, unknown>)['mod_自定义特性']).toBe(true);
  });
  // 6.75 tick_log 盐值
  it('TickLogEntrySchema: 盐值 absent → valid (optional)', () => {
    expect(TickLogEntrySchema.safeParse({ tick_id: 't1', 拍计数: 0, 结果摘要: '', 系数组指纹: '' }).success).toBe(true);
  });
  it('TickLogEntrySchema: 盐值 整数 → valid', () => {
    const res = TickLogEntrySchema.parse({ 盐值: 7 });
    expect(res.盐值).toBe(7);
  });
  it('TickLogEntrySchema: 盐值 允许负值（回滚计数器不限符号）', () => {
    expect(TickLogEntrySchema.safeParse({ 盐值: -1 }).success).toBe(true);
  });
  it('TickLogEntrySchema: 盐值 拒绝非整数', () => {
    expect(TickLogEntrySchema.safeParse({ 盐值: 1.5 }).success).toBe(false);
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
  it('NarrativeSettingSchema 含 人称 + 叙事偏好 + 启用文风键 + 叙事权限（6.75）', () => {
    expect(Object.keys(NarrativeSettingSchema.shape).sort()).toEqual(['人称', '叙事偏好', '启用文风键', '叙事权限'].sort());
  });
  // 6.75 人称结构化
  it('人称: 默认值 视角宿主="" 人称="二"', () => {
    const res = NarrativeSettingSchema.parse({});
    expect(res.人称.视角宿主).toBe('');
    expect(res.人称.人称).toBe('二');
  });
  it('人称: 视角宿主接受任意字符串（含特殊值"上帝/全知旁白"）', () => {
    const res = NarrativeSettingSchema.parse({ 人称: { 视角宿主: '上帝/全知旁白', 人称: '三' } });
    expect(res.人称.视角宿主).toBe('上帝/全知旁白');
    expect(res.人称.人称).toBe('三');
  });
  it('人称: 枚举拒绝非法值', () => {
    expect(NarrativeSettingSchema.safeParse({ 人称: { 人称: '四' } }).success).toBe(false);
  });
  it('人称: 旧版字符串格式拒绝（无法向前兼容）', () => {
    expect(NarrativeSettingSchema.safeParse({ 人称: '第三人称' }).success).toBe(false);
  });
  // 6.75 叙事权限
  it('叙事权限: 默认值 玩家角色写权限="玩家独占"', () => {
    const res = NarrativeSettingSchema.parse({});
    expect(res.叙事权限.玩家角色写权限).toBe('玩家独占');
  });
  it('叙事权限: 可设为"模型可代写"', () => {
    const res = NarrativeSettingSchema.parse({ 叙事权限: { 玩家角色写权限: '模型可代写' } });
    expect(res.叙事权限.玩家角色写权限).toBe('模型可代写');
  });
  it('叙事权限: 拒绝非法枚举值', () => {
    expect(NarrativeSettingSchema.safeParse({ 叙事权限: { 玩家角色写权限: '随意' } }).success).toBe(false);
  });
  // 2. _叙事设置.启用文风键 (6.42)
  it('启用文风键: 缺省 parse 得 []', () => {
    expect(NarrativeSettingSchema.parse({}).启用文风键).toEqual([]);
  });
  it('启用文风键: 字符串数组通过', () => {
    expect(NarrativeSettingSchema.safeParse({ 启用文风键: ['wuxia', 'noir'] }).success).toBe(true);
  });
  it('启用文风键: 非字符串元素拒收', () => {
    expect(NarrativeSettingSchema.safeParse({ 启用文风键: [42] }).success).toBe(false);
  });
  // 5. 骰面量化层①：判定骰型快照
  it('TickSchema: 判定骰型快照 absent → valid (optional)', () => {
    expect(TickSchema.safeParse({ id: 't1', 拍计数: 0, 难度系数组指纹: '' }).success).toBe(true);
  });
  it('TickSchema: 判定骰型快照=100 → valid', () => {
    expect(TickSchema.safeParse({ 判定骰型快照: 100 }).success).toBe(true);
  });
  it('TickSchema: 判定骰型快照=20 → valid', () => {
    expect(TickSchema.safeParse({ 判定骰型快照: 20 }).success).toBe(true);
  });
  it('TickSchema: invalid 判定骰型快照=6 (out of enum)', () => {
    expect(TickSchema.safeParse({ 判定骰型快照: 6 }).success).toBe(false);
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
      主世界: { 玩法预设引用: 'preset-01', 封存状态: false },
    })).not.toThrow();
  });
  it('世界域: 域时钟 已从 世界域 条目移除（派生展示量，不存储）', () => {
    const res = 世界域Schema.parse({ 主世界: {} });
    expect('域时钟' in (res['主世界'] ?? {})).toBe(false);
  });
  it('世界域: 默认包含空的 累计活跃区间表', () => {
    const res = 世界域Schema.parse({ 主世界: {} });
    expect(res['主世界']?.累计活跃区间表).toEqual([]);
  });
  it('世界域: 累计活跃区间表 接受合法条目', () => {
    const res = 世界域Schema.parse({
      主世界: {
        累计活跃区间表: [
          { 起始纪元分钟: 0, 终止纪元分钟: 1440, 版本号: 0 },
          { 起始纪元分钟: 2880, 终止纪元分钟: null, 版本号: 1 },
        ],
      },
    });
    expect(res['主世界']?.累计活跃区间表).toHaveLength(2);
    expect(res['主世界']?.累计活跃区间表[1]?.终止纪元分钟).toBeNull();
  });
  it('世界域: 活跃区间 起始纪元分钟 允许负值', () => {
    expect(世界域Schema.safeParse({
      主世界: { 累计活跃区间表: [{ 起始纪元分钟: -525600, 终止纪元分钟: 0, 版本号: 0 }] },
    }).success).toBe(true);
  });
  it('世界域: 活跃区间 版本号 拒绝负值', () => {
    expect(世界域Schema.safeParse({
      主世界: { 累计活跃区间表: [{ 版本号: -1 }] },
    }).success).toBe(false);
  });
  it('valid: 纪元分钟 accepts negative (pre-1970 ancient-date absolute timestamp)', () => {
    expect(世界Schema.safeParse({ 纪元分钟: -1 }).success).toBe(true);
  });
  it('invalid: 纪元分钟 wrong type', () => {
    expect(世界Schema.safeParse({ 纪元分钟: '1000' }).success).toBe(false);
  });
  it('unknown key strict rejection', () => {
    expect(世界Schema.strict().safeParse({ 季节: '春' }).success).toBe(false); // 季节 is derived
  });
  // 13a: 对齐模式 in GranularityTemplateSchema
  it('_粒度模板: 对齐模式 defaults to 固定跨度', () => {
    const world = 世界Schema.parse({});
    expect(world._粒度模板.即时.对齐模式).toBe('固定跨度');
    expect(world._粒度模板.发展.对齐模式).toBe('固定跨度');
  });
  it('_粒度模板: 对齐模式 accepts 历法对齐', () => {
    const result = 世界Schema.parse({ _粒度模板: { 发展: { 对齐模式: '历法对齐' } } });
    expect(result._粒度模板.发展.对齐模式).toBe('历法对齐');
  });
  it('_粒度模板: 对齐模式 rejects unknown value', () => {
    expect(世界Schema.safeParse({ _粒度模板: { 即时: { 对齐模式: '自由' } } }).success).toBe(false);
  });
});

describe('4.3 Actor layer', () => {
  // ── 席位表（6.53 C1）────────────────────────────────────────────────────────
  describe('席位表', () => {
    it('valid: empty record (no players yet)', () => {
      expect(() => 席位表Schema.parse({})).not.toThrow();
    });
    it('valid: 单机 single seat 本机', () => {
      expect(() => 席位表Schema.parse({
        本机: { 焦点角色键: 'npc_主角', 控制者: '人类', 连接状态: '本地' },
      })).not.toThrow();
    });
    it('valid: 控制者=AI', () => {
      expect(() => 席位表Schema.parse({
        seat_01: { 焦点角色键: 'npc_bot', 控制者: 'AI', 连接状态: '在线' },
      })).not.toThrow();
    });
    it('valid: 控制者=空 (unoccupied seat)', () => {
      expect(() => 席位表Schema.parse({
        seat_02: { 控制者: '空' },
      })).not.toThrow();
    });
    it('invalid: 控制者 illegal value', () => {
      expect(席位表Schema.safeParse({
        本机: { 控制者: '玩家' }, // 非枚举值
      }).success).toBe(false);
    });
    it('minimal-state parse: RootSchema with empty 席位表', () => {
      // 最小开局状态：席位表为空 record，schema defaults 填充其他字段
      expect(() => RootSchema.parse({ 席位表: {} })).not.toThrow();
    });
    it('minimal-state: 单机单席位整合 parse', () => {
      expect(() => RootSchema.parse({
        席位表: { 本机: { 焦点角色键: '', 控制者: '人类', 连接状态: '本地' } },
        NPC: {},
      })).not.toThrow();
    });
  });

  // ── NPC 全组件 ──────────────────────────────────────────────────────────────
  it('valid empty NpcSchema parse', () => {
    expect(() => NpcSchema.parse({})).not.toThrow();
  });
  it('valid NPC with 属性五轴 + 性格五轴 + 派生', () => {
    expect(() => NpcSchema.parse({
      姓名: '李明',
      性别: '男',
      属性: { 体质: 12, 智慧: 15, 感知: 10, 魅力: 8, 心理: 14 },
      派生: { HP: 100, HP上限: 100, 精力: 80, 精力上限: 100, 颜值: 60 },
      性格五轴: { 开放: 70, 尽责: 80, 外向: 40, 宜人: 60, 神经质: 30 },
    })).not.toThrow();
  });
  it('valid NPC with 特质/情绪栈/状态标签/技能/物品/信念/声誉/婚姻/关系/组织/忠诚', () => {
    expect(() => NpcSchema.parse({
      姓名: '王芳',
      特质: { 敏锐: { 类别: '天赋', 来源: '天生', 强度: 80, 稀有度: '稀有', 已觉醒: true, 效果: {} } },
      情绪栈: [{ 情绪名: '喜悦', 极性: '正', 数值: 60, 影响: [], 到期: 0, 来源: 'event-1', 可叠加: false }],
      状态标签: { 受伤: { 效果: [], 到期: 10000, 来源: 'combat' } },
      技能: { 剑术: { 熟练度: 40, 等级: 2, 类别: '战斗', 来源: '自学', 施放: {} } },
      物品: { 长剑: { 数量: 1, 重要级别: '重要', 类别: '武器', 效果: {}, 到期: 0, 遗失保护: true, 可携意象: [] } },
      信念: { 儒家: { 类型: '价值观体系', 虔诚或认同: 70, 核心主张: ['仁'], 戒律: [], 立场轴: '中立', 动摇度: 10 } },
      声誉: { 人望: 20, 知名度: 30, 极性: '正面', 标签: '侠义' },
      婚姻: [{ 配偶: 'npc_配偶', 状态: '已婚', 缔结: 5000, 终止: 0 }],
      关系: [{ 对象键: 'npc_师父', 类型: '师徒', 强度: 80, 极性: '正', 信任: 90, 深度: 70 }],
      所属组织: [{ 组织键: 'org_001', 职务: '学徒', 派系: '' }],
      忠诚: { 师门: { $真实值: 80, 伪装度: 0 } },
    })).not.toThrow();
  });
  it('valid NpcRecordSchema', () => {
    expect(() => NpcRecordSchema.parse({
      npc_001: { 姓名: '王芳' },
    })).not.toThrow();
  });

  // ── 占位形态（K4/6.52）─────────────────────────────────────────────────────
  it('valid NPC with 占位形态', () => {
    expect(() => NpcSchema.parse({
      姓名: '神秘信使',
      占位形态: { 名称: '神秘信使', 实体类型: 'NPC', 硬约束: ['性别:男'], 来源拍号: 100 },
    })).not.toThrow();
  });
  it('valid NPC 占位形态 with 模板快照', () => {
    expect(() => NpcSchema.parse({
      占位形态: { 名称: 'X', 实体类型: 'NPC', 硬约束: [], 来源拍号: 0, 模板引用: 'tpl_guard', 模板快照: { 属性: {} } },
    })).not.toThrow();
  });

  // ── 6.72 卡格式可空段 ───────────────────────────────────────────────────────
  it('valid 关系声明 Z2 五类方向槽', () => {
    expect(() => 关系声明条目Schema.parse({ 对象: 'npc_hero', 方向: '双向', 类型: '朋友', 强度: 70 })).not.toThrow();
    expect(() => 关系声明条目Schema.parse({ 对象: 'user', 方向: '从属', 类型: '主仆', 强度: -30 })).not.toThrow();
    expect(() => 关系声明条目Schema.parse({ 对象: 'char', 方向: '敌对', 类型: '仇家', 强度: -80 })).not.toThrow();
  });
  it('invalid: 关系声明 方向 illegal value', () => {
    expect(关系声明条目Schema.safeParse({ 方向: '横向' }).success).toBe(false);
  });
  it('valid 既往记忆种子 with 来源=导入预设', () => {
    expect(() => 既往记忆种子条目Schema.parse({
      摘要: '童年被抛弃，在孤儿院长大',
      发生时间_约: '十二岁以前',
      重要度: 2,
      情绪色彩: '悲伤',
      来源: '导入预设',
    })).not.toThrow();
  });
  it('invalid: 既往记忆种子 重要度 out of range', () => {
    expect(既往记忆种子条目Schema.safeParse({ 重要度: 4 }).success).toBe(false);
  });
  it('valid NPC with 开场白[] (素材包数组)', () => {
    expect(() => NpcSchema.parse({
      开场白: ['你好，旅人。', '我们是否在哪里见过？'],
    })).not.toThrow();
  });
  it('valid 占位解析槽 user/char → 实体键', () => {
    expect(() => 占位解析槽Schema.parse({ user: 'npc_主角', char: 'npc_林小雨' })).not.toThrow();
    expect(() => 占位解析槽Schema.parse({})).not.toThrow(); // both optional
  });
  it('valid NPC with all 6.72 optional fields', () => {
    expect(() => NpcSchema.parse({
      关系声明: [{ 对象: 'user', 方向: '单向→', 类型: '崇拜', 强度: 60, 备注: '' }],
      既往记忆种子: [{ 摘要: '幼年丧母', 发生时间_约: '五岁', 重要度: 3, 情绪色彩: '悲', 来源: '导入预设' }],
      开场白: ['初次见面，请多关照。'],
      占位解析槽: { user: 'npc_主角', char: 'npc_林小雨' },
    })).not.toThrow();
  });

  // ── 认知档案（6.12/6.37）────────────────────────────────────────────────────
  it('valid 认知档案 with 印象 (来源=事件id)', () => {
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
  it('valid 认知档案 来源=导入预设 (6.72)', () => {
    expect(() => 认知档案Schema.parse({
      npc_hero: {
        npc_hero: { 印象: [{ 标签: '自信', 极性: '正', 强度: 50, 来源: '导入预设', 获知时间: 0, 衰减速率: 0 }] },
      },
    })).not.toThrow();
  });
  it('valid 自我认知 [主角][主角] (含自我认知规范)', () => {
    expect(() => 认知档案Schema.parse({
      npc_主角: {
        npc_主角: { 了解度: 80, 误差表: { 体质: 5 }, 印象: [], 时效: 0 },
      },
    })).not.toThrow();
  });
  it('invalid: 性格五轴 value out of range', () => {
    expect(NpcSchema.safeParse({ 性格五轴: { 开放: 150 } }).success).toBe(false);
  });
  it('invalid: 了解度 out of range', () => {
    expect(认知档案Schema.safeParse({ a: { b: { 了解度: 200 } } }).success).toBe(false);
  });
  it('invalid: 印象 强度 out of range', () => {
    expect(认知档案Schema.safeParse({ a: { b: { 印象: [{ 强度: -1 }] } } }).success).toBe(false);
  });

  // ── 已故NPC归档（L2冻结层）──────────────────────────────────────────────────
  it('valid empty 已故NPC归档', () => {
    expect(() => 已故NPC归档Schema.parse({})).not.toThrow();
  });
  it('valid 已故NPC归档 entry', () => {
    expect(() => 已故NPC归档Schema.parse({
      npc_旧主: { 称呼: '旧主', 死亡时间: 52560, 关键记忆指针: 'mem-001', 幽灵形态: false },
    })).not.toThrow();
  });

  // ── 纪律检查 ────────────────────────────────────────────────────────────────
  it('unknown key strict rejection on NpcSchema (派生字段不进 schema)', () => {
    expect(NpcSchema.strict().safeParse({ 性格标签: 'ENTJ' }).success).toBe(false);
  });
  it('invalid: 复活点 negative (min=0)', () => {
    expect(NpcSchema.safeParse({ 复活点: -1 }).success).toBe(false);
  });
  it('time fields: 出生日期 allows negative (史前允许负值)', () => {
    expect(() => NpcSchema.parse({ 出生日期: -525960 })).not.toThrow();
  });
  it('time fields: 到期 allows 0 (哨兵=永不过期)', () => {
    expect(() => NpcSchema.parse({
      情绪栈: [{ 情绪名: '平静', 极性: '中', 数值: 20, 影响: [], 到期: 0, 来源: '', 可叠加: false }],
    })).not.toThrow();
  });
});

describe('4.4 Org layer', () => {
  // ── 最小开局状态 ─────────────────────────────────────────────────────────────
  it('valid empty parse (minimal state)', () => {
    expect(() => 组织实体Schema.parse({})).not.toThrow();
    expect(() => 组织关系网Schema.parse({})).not.toThrow();
  });
  it('minimal-state: RootSchema parse with empty 组织实体', () => {
    expect(() => RootSchema.parse({ 组织实体: {}, 组织关系网: {} })).not.toThrow();
  });

  // ── 身份骨架 ─────────────────────────────────────────────────────────────────
  it('valid org entity with identity fields', () => {
    expect(() => 组织实体Schema.parse({
      org_001: { 父组织: 'org_parent', 类型: '商业', 行业: '贸易', 状态: '运营', 占股: 30, 经营范围: ['丝绸', '茶叶'], 风险: 20, 币种: '金两' },
    })).not.toThrow();
  });
  it('valid: 父组织 absent (顶层实体)', () => {
    expect(() => 组织实体Schema.parse({ org_001: {} })).not.toThrow();
  });
  it('invalid: 占股 out of range', () => {
    expect(组织实体Schema.safeParse({ org: { 占股: 200 } }).success).toBe(false);
  });

  // ── 财务 ─────────────────────────────────────────────────────────────────────
  it('valid 财务 block', () => {
    expect(() => 组织实体Schema.parse({
      org: { 财务: { 投入本金: 50000, 估值: 200000, 本期营收: 10000, 本期成本: 7000, 本期净利: 3000, 累计盈亏: 15000 } },
    })).not.toThrow();
  });
  it('valid: 财务 allows negative values (亏损)', () => {
    expect(() => 组织实体Schema.parse({
      org: { 财务: { 累计盈亏: -5000, 本期净利: -1000 } },
    })).not.toThrow();
  });

  // ── 用工（士气🗑️已收编出厂轴）───────────────────────────────────────────────
  it('valid 用工 block without 士气', () => {
    expect(() => 组织实体Schema.parse({
      org: { 用工: { 员工数: 50, 岗位: { 账房: { 人数: 5, 月薪: 200, 技能等级: '中级' } }, 人力成本: 1000, 产能系数: 1.2, 关键员工: ['npc_boss'] } },
    })).not.toThrow();
  });
  it('invalid: 用工.员工数 negative', () => {
    expect(组织实体Schema.safeParse({ org: { 用工: { 员工数: -1 } } }).success).toBe(false);
  });

  // ── 属性轴?（6.45/6.48·出厂七轴·可扩可休眠·键名冻结）──────────────────────
  it('valid 属性轴 with 出厂七轴', () => {
    expect(() => 组织属性轴条目Schema.parse({ 数值: 60, 域: '治理' })).not.toThrow();
    expect(() => 组织实体Schema.parse({
      org: {
        属性轴: {
          掌控度: { 数值: 70, 域: '治理' },
          合法性: { 数值: 60, 域: '治理' },
          民心: { 数值: 50, 域: '治理' },
          凝聚力: { 数值: 65, 域: '治理' },
          士气: { 数值: 80, 域: '军事' },
          强制度: { 数值: 40, 域: '信念' },
          异端容忍: { 数值: 55, 域: '信念' },
        },
      },
    })).not.toThrow();
  });
  it('valid 属性轴 显示名 (仅换皮，修真「香火」=民心)', () => {
    expect(() => 组织属性轴条目Schema.parse({ 数值: 50, 显示名: '香火', 域: '治理' })).not.toThrow();
  });
  it('valid 属性轴 停用=true (休眠出厂轴)', () => {
    expect(() => 组织属性轴条目Schema.parse({ 数值: 0, 停用: true, 域: '信念' })).not.toThrow();
  });
  it('valid 属性轴 自定义扩展轴', () => {
    expect(() => 组织实体Schema.parse({
      org: { 属性轴: { 民主程度: { 数值: 30, 域: '治理' }, 军工能力: { 数值: 60, 域: '军事' } } },
    })).not.toThrow();
  });
  it('valid: 属性轴 absent (optional)', () => {
    expect(() => 组织实体Schema.parse({ org: {} })).not.toThrow();
    const parsed = 组织实体Schema.parse({ org: {} });
    expect(parsed['org']!.属性轴).toBeUndefined();
  });
  it('invalid: 属性轴.衰减速率 negative', () => {
    expect(组织属性轴条目Schema.safeParse({ 数值: 50, 衰减速率: -1 }).success).toBe(false);
  });

  // ── 治理（连续数值已收编出厂轴，只保留结构性字段）──────────────────────────────
  it('valid 治理 block (no 掌控度/合法性/民心/凝聚力)', () => {
    expect(() => 组织实体Schema.parse({
      org: { 治理: { 追随者规模: 5000, 控制区: ['node_都城', 'node_边境'], 关联职级体系ID: 'rank_官制' } },
    })).not.toThrow();
  });
  it('invalid: 治理.追随者规模 negative', () => {
    expect(组织实体Schema.safeParse({ org: { 治理: { 追随者规模: -1 } } }).success).toBe(false);
  });
  it('防回归: 治理 无 掌控度/合法性/民心/凝聚力 字段（已收编出厂轴）', () => {
    const parsed = 组织实体Schema.parse({ org: { 治理: {} } });
    const 治理 = parsed['org']!.治理;
    expect(治理).not.toHaveProperty('掌控度');
    expect(治理).not.toHaveProperty('合法性');
    expect(治理).not.toHaveProperty('民心');
    expect(治理).not.toHaveProperty('凝聚力');
  });

  // ── 军事（士气🗑️已收编出厂轴）───────────────────────────────────────────────
  it('valid 军事 block', () => {
    expect(() => 组织实体Schema.parse({
      org: {
        军事: { 兵力: 10000, 战力档: '精锐', 装备: '重装步兵', 补给: 80, 兵种: '步骑混合', 主将: 'npc_大将军', 驻地: 'node_军营',
          部队: [{ 编制: '先锋营', 姿态: '强攻', 战术引用: 'tactic_001' }] },
      },
    })).not.toThrow();
  });
  it('防回归: 军事 无 士气 字段（已收编出厂轴）', () => {
    const parsed = 组织实体Schema.parse({ org: { 军事: {} } });
    expect(parsed['org']!.军事).not.toHaveProperty('士气');
  });
  it('invalid: 军事.补给 out of range', () => {
    expect(组织实体Schema.safeParse({ org: { 军事: { 补给: 101 } } }).success).toBe(false);
  });

  // ── 信念（6.45/6.48 瘦身·强制度/异端容忍收编出厂轴）────────────────────────
  it('valid 信念 瘦身形态 {官方体系, 思潮派系}', () => {
    expect(() => 组织实体Schema.parse({
      org: { 信念: { 官方体系: '儒家', 思潮派系: '保守派' } },
    })).not.toThrow();
  });
  it('防回归: 信念 无 强制度/异端容忍 字段（已收编出厂轴）', () => {
    const parsed = 组织实体Schema.parse({ org: { 信念: {} } });
    const 信念 = parsed['org']!.信念;
    expect(信念).not.toHaveProperty('强制度');
    expect(信念).not.toHaveProperty('异端容忍');
  });

  // ── 离场演化契约?（6.45/6.66）────────────────────────────────────────────────
  it('valid 离场演化契约 optional', () => {
    expect(() => 离场演化契约Schema.parse({
      演化速率: 0.5,
      随机事件表: 'event_table_朝廷',
      晋升倾轧规则: '每10拍随机晋升一名下属',
      关联声明: ['全局.皇帝死亡', '外部.战争爆发'],
    })).not.toThrow();
  });
  it('valid: 离场演化契约 absent (optional)', () => {
    const parsed = 组织实体Schema.parse({ org: {} });
    expect(parsed['org']!.离场演化契约).toBeUndefined();
  });
  it('valid: 离场演化契约.关联声明 absent', () => {
    expect(() => 离场演化契约Schema.parse({ 演化速率: 1.0 })).not.toThrow();
  });
  it('invalid: 离场演化契约.演化速率 negative', () => {
    expect(离场演化契约Schema.safeParse({ 演化速率: -0.1 }).success).toBe(false);
  });

  // ── 进展树 ───────────────────────────────────────────────────────────────────
  it('valid 进展树 DAG + 当前节点', () => {
    expect(() => 组织实体Schema.parse({
      org: { 进展树: { 政体: { nodes: { 封建制: { 前置: [], 进度: 100, 投入: '100年积累', 解锁效果: '增强掌控度' }, 君主立宪: { 前置: ['封建制'], 进度: 30, 投入: '改革浪潮', 解锁效果: '提升合法性' } }, 当前节点: '封建制' } } },
    })).not.toThrow();
  });

  // ── 派系登记 ─────────────────────────────────────────────────────────────────
  it('valid 派系登记[]', () => {
    expect(() => 组织实体Schema.parse({
      org: { 派系登记: [{ 诉求: '保守主义', 领袖: 'npc_保守派', 成员: 'role:大臣&态度:保守' }] },
    })).not.toThrow();
  });

  // ── 网点 & 传播 ──────────────────────────────────────────────────────────────
  it('valid 网点[] + 传播{}', () => {
    expect(() => 组织实体Schema.parse({
      org: {
        网点: [{ 地点键: 'node_扬州', 营收: 5000, 规模: 70, 风险: 20, 状态: '正常', 生产方式: '贸易' }],
        传播: { region_江南: 60, region_塞北: 10 },
      },
    })).not.toThrow();
  });
  it('invalid: 传播 渗透度 out of range', () => {
    expect(组织实体Schema.safeParse({ org: { 传播: { 江南: 101 } } }).success).toBe(false);
  });

  // ── 项目档?（6.34）───────────────────────────────────────────────────────────
  it('valid 项目档 with 进展树/财务/传播/用工', () => {
    expect(() => 组织实体Schema.parse({
      org: {
        项目档: {
          进展树: { 研究: { nodes: { 基础研究: { 前置: [], 进度: 50, 投入: '时间', 解锁效果: '' } }, 当前节点: '基础研究' } },
          财务: { 投入本金: 1000, 累计盈亏: -200 },
          传播: { region_本地: 80 },
          用工: { 员工数: 3, 关键员工: ['npc_研究员'] },
        },
      },
    })).not.toThrow();
  });
  it('valid: 项目档 absent (optional)', () => {
    const parsed = 组织实体Schema.parse({ org: {} });
    expect(parsed['org']!.项目档).toBeUndefined();
  });

  // ── 占位形态?（6.33/6.52）────────────────────────────────────────────────────
  it('valid 占位形态 with 模板快照', () => {
    expect(() => 组织占位形态Schema.parse({
      名称: '神秘商会', 实体类型: '商业组织', 硬约束: ['规模:中型'],
      来源拍号: 50, 模板引用: 'tpl_商会', 模板快照: { 类型: '商业', 行业: '贸易' },
    })).not.toThrow();
  });
  it('valid: 占位形态 absent', () => {
    const parsed = 组织实体Schema.parse({ org: {} });
    expect(parsed['org']!.占位形态).toBeUndefined();
  });

  // ── 组织关系网 ───────────────────────────────────────────────────────────────
  it('valid 组织关系网 edge', () => {
    expect(() => 组织关系网Schema.parse({
      edge_001: { A组织: 'org_汉', B组织: 'org_匈奴', 关系: '敌对', 关系值: -80, 约定引用键: 'pact_和亲' },
    })).not.toThrow();
  });
  it('invalid: 组织关系网 关系值 out of range', () => {
    expect(组织关系网Schema.safeParse({ e: { 关系值: 150 } }).success).toBe(false);
  });

  // ── 综合样例：完整组织实体一次 parse ───────────────────────────────────────────
  it('valid: full org entity (all blocks)', () => {
    expect(() => 组织实体Schema.parse({
      org_大汉: {
        类型: '政权', 行业: '统治', 状态: '运营', 占股: 0, 经营范围: ['军事', '税收'], 风险: 15, 币种: '五铢钱',
        财务: { 投入本金: 0, 估值: 1000000, 本期营收: 100000, 本期成本: 80000, 本期净利: 20000, 累计盈亏: 500000 },
        用工: { 员工数: 10000, 关键员工: ['npc_丞相'] },
        属性轴: {
          掌控度: { 数值: 80, 域: '治理' },
          合法性: { 数值: 90, 域: '治理' },
          民心: { 数值: 60, 域: '治理' },
          凝聚力: { 数值: 70, 域: '治理' },
          士气: { 数值: 85, 域: '军事' },
          强制度: { 数值: 50, 域: '信念' },
          异端容忍: { 数值: 30, 域: '信念' },
        },
        治理: { 追随者规模: 50000000, 控制区: ['node_长安'], 关联职级体系ID: 'rank_汉官制' },
        军事: { 兵力: 500000, 战力档: '精锐', 装备: '骑兵+步兵', 补给: 90, 兵种: '混合', 主将: 'npc_卫青', 驻地: 'node_长城', 部队: [] },
        信念: { 官方体系: '儒家', 思潮派系: '今文经学' },
        进展树: {},
        派系登记: [{ 诉求: '强干弱枝', 领袖: 'npc_丞相', 成员: 'role:重臣' }],
        网点: [{ 地点键: 'node_长安', 营收: 100000, 规模: 100, 风险: 5, 状态: '正常', 生产方式: '税收' }],
        传播: { region_中原: 95, region_西域: 40 },
        离场演化契约: { 演化速率: 0.1, 随机事件表: 'evt_table_皇朝演化', 晋升倾轧规则: '每20拍一次权臣事件' },
      },
    })).not.toThrow();
  });
});

describe('4.5 Global layer', () => {
  // ── 最小开局状态 ──────────────────────────────────────────────────────────────
  it('valid empty parse (minimal state)', () => {
    expect(() => 全局Schema.parse({})).not.toThrow();
  });
  it('minimal-state: RootSchema parse with empty 全局', () => {
    expect(() => RootSchema.parse({ 全局: {} })).not.toThrow();
  });
  it('default: 作弊标记=false, 编年史=[], 覆写日志=[]', () => {
    const g = 全局Schema.parse({});
    expect(g.作弊标记).toBe(false);
    expect(g.编年史).toEqual([]);
    expect(g.覆写日志).toEqual([]);
  });

  // ── 秘密库 ────────────────────────────────────────────────────────────────────
  it('valid 秘密库 full entry', () => {
    expect(() => 全局Schema.parse({
      秘密库: {
        secret_001: {
          母题: '身世之谜',
          涉事方: [
            { 实体键: 'npc_001', 角色: '主谋' },
            { 实体键: 'npc_002', 角色: '受害者' },
            { 实体键: 'npc_003', 角色: '见证' },
          ],
          进展: 30, 严重度: 80, 暴露度: 5,
          $谜底: '是继母下的毒',
          已暴露线索: [{ 线索: '血迹', 暴露程度: 10, 状态: '存在', 关联地点键: 'loc_书房' }],
          知情名单: [{ 对象: 'npc_002', 来源选择器: 'role:亲历者', 知情程度: 30, 立场: '动摇', 掩护基调: '装不知情' }],
        },
      },
    })).not.toThrow();
  });
  it('valid: 涉事方.角色 全五类', () => {
    const 角色列表 = ['主谋', '共犯', '受害者', '目标', '见证'] as const;
    for (const 角色 of 角色列表) {
      expect(() => 全局Schema.parse({
        秘密库: { s: { 涉事方: [{ 实体键: 'npc_x', 角色 }] } },
      })).not.toThrow();
    }
  });
  it('invalid: 涉事方.角色 非枚举值', () => {
    expect(全局Schema.safeParse({
      秘密库: { s: { 涉事方: [{ 实体键: 'npc_x', 角色: '其他' }] } },
    }).success).toBe(false);
  });
  it('valid: 知情名单 来源选择器 absent (可空)', () => {
    expect(() => 全局Schema.parse({
      秘密库: { s: { 知情名单: [{ 对象: 'npc_001', 知情程度: 50, 立场: '死守', 掩护基调: '' }] } },
    })).not.toThrow();
  });
  it('invalid: 秘密库 进展 out of range', () => {
    expect(全局Schema.safeParse({ 秘密库: { s: { 进展: 150 } } }).success).toBe(false);
  });
  it('invalid: 秘密库 暴露度 negative', () => {
    expect(全局Schema.safeParse({ 秘密库: { s: { 暴露度: -1 } } }).success).toBe(false);
  });

  // ── 约定库（基础字段）────────────────────────────────────────────────────────────
  it('valid 约定库 full entry (no 子类型)', () => {
    expect(() => 全局Schema.parse({
      约定库: {
        pact_001: {
          缔约方: [{ 实体键: 'npc_a', 角色: '承诺方' }, { 实体键: 'npc_b', 角色: '受益方' }],
          形式: '婚约', 条款: [{ 内容: '互不攻伐', 标的: '领土', 履行状态: '待履行' }],
          约束力: 80, 维系手段: '质子互换', 期限: 12000, 状态: '有效',
        },
      },
    })).not.toThrow();
  });
  it('invalid: 约定库 约束力 out of range', () => {
    expect(全局Schema.safeParse({ 约定库: { p: { 约束力: 110 } } }).success).toBe(false);
  });

  // ── 约定库·子类型 discriminated union（6.58）──────────────────────────────────
  it('valid 子类型=一次性缺省', () => {
    expect(() => 约定子类型Schema.parse({ 类型: '一次性缺省' })).not.toThrow();
    expect(() => 全局Schema.parse({
      约定库: { p: { 子类型: { 类型: '一次性缺省' } } },
    })).not.toThrow();
  });
  it('valid 子类型=循环承诺 with 周期+终止条件', () => {
    expect(() => 约定子类型Schema.parse({
      类型: '循环承诺', 周期: 720, 终止条件: '主角死亡 OR 纪元>1000',
    })).not.toThrow();
  });
  it('valid 子类型=循环承诺 fields absent (optional)', () => {
    expect(() => 约定子类型Schema.parse({ 类型: '循环承诺' })).not.toThrow();
  });
  it('valid 子类型=条件挂起 with 触发条件+失败策略', () => {
    expect(() => 约定子类型Schema.parse({
      类型: '条件挂起', 触发条件: '皇帝驾崩', 失败策略: '欠账',
    })).not.toThrow();
  });
  it('valid 子类型=条件挂起 失败策略 全三值', () => {
    for (const 策略 of ['跳过', '欠账', '作废'] as const) {
      expect(() => 约定子类型Schema.parse({ 类型: '条件挂起', 失败策略: 策略 })).not.toThrow();
    }
  });
  it('invalid: 子类型 未知类型值', () => {
    expect(约定子类型Schema.safeParse({ 类型: '其他类型' }).success).toBe(false);
  });
  it('valid: 挂靠时钟域 + 目标失效回退', () => {
    expect(() => 全局Schema.parse({
      约定库: {
        p: {
          子类型: { 类型: '循环承诺', 周期: 360 },
          挂靠时钟域: 'clock_朝廷',
          目标失效回退: '法定序列',
        },
      },
    })).not.toThrow();
  });
  it('invalid: 目标失效回退 非枚举值', () => {
    expect(全局Schema.safeParse({
      约定库: { p: { 目标失效回退: '随便处理' } },
    }).success).toBe(false);
  });

  // ── 继承包（世界遗产白名单·缺口4·6.45）────────────────────────────────────────
  it('valid 继承包 with 候选 + 抓取载荷', () => {
    expect(() => 全局Schema.parse({
      继承包: {
        候选: [{ NPC键: 'npc_继承人', 权限级别: '全权限', 白名单: ['属性', '人际关系'] }],
        抓取载荷: { 属性: { 智慧: 70, 武力: 50 } },
      },
    })).not.toThrow();
  });
  it('valid: 继承包 世界遗产白名单 optional', () => {
    expect(() => 全局Schema.parse({
      继承包: { 世界遗产白名单: ['世界.国际形势', 'NPC.主要人物.*'] },
    })).not.toThrow();
  });
  it('valid: 继承包 世界遗产白名单 absent', () => {
    const g = 全局Schema.parse({ 继承包: {} });
    expect(g.继承包.世界遗产白名单).toBeUndefined();
  });

  // ── 家族树（6.27/6.30）────────────────────────────────────────────────────────
  it('valid 家族树 DAG node', () => {
    expect(() => 全局Schema.parse({
      家族树: {
        边: {
          role_玄宗: {
            双亲边: [{ parent_id: 'role_睿宗', 边类型: '血亲' }],
            生卒: { 出生: -8640, 死亡: 5040 },
            总评: '开元盛世开创者',
            关键成就: ['开元盛世', '平定韦后之乱'],
            传家宝: ['item_传国玉玺'],
          },
        },
        幽灵节点: {
          ghost_武则天母亲: {
            称谓: '荣国夫人', 姓氏: '杨',
            生卒约束: '唐高祖年间在世', 模板引用: 'tpl_贵妇',
          },
        },
      },
    })).not.toThrow();
  });
  it('valid: 家族树 生卒.死亡 absent (健在/未记录)', () => {
    expect(() => 全局Schema.parse({
      家族树: { 边: { role_001: { 生卒: { 出生: 1000 } } } },
    })).not.toThrow();
  });
  it('valid: 家族树 双亲边 边类型 开放串', () => {
    expect(() => 全局Schema.parse({
      家族树: { 边: { role_x: { 双亲边: [{ parent_id: 'role_y', 边类型: '领养' }] } } },
    })).not.toThrow();
  });

  // ── 覆写日志（附录H·提案单引用·Z3·6.68）─────────────────────────────────────
  it('valid 覆写日志 with 提案单引用', () => {
    expect(() => 全局Schema.parse({
      覆写日志: [{
        时间: 5000, 授权源: '系统管理员', 级别: 'L2',
        目标: 'NPC.npc_大臣.属性.智慧', 理由: '角色扶正调整',
        是否作弊: false, 提案单引用: 'proposal_Z3_001',
      }],
    })).not.toThrow();
  });
  it('valid: 覆写日志 提案单引用 absent (可空)', () => {
    expect(() => 全局Schema.parse({
      覆写日志: [{ 时间: 0, 授权源: '', 级别: 'L1', 目标: '', 理由: '', 是否作弊: true }],
    })).not.toThrow();
  });
  it('invalid: 覆写日志 wrong type', () => {
    expect(全局Schema.safeParse({ 覆写日志: 'not-an-array' }).success).toBe(false);
  });

  // ── 作弊标记 ─────────────────────────────────────────────────────────────────
  it('valid: 作弊标记 true', () => {
    expect(() => 全局Schema.parse({ 作弊标记: true })).not.toThrow();
  });

  // ── 编年史（6.43·append-only·媒介附件格式）──────────────────────────────────────
  it('valid 编年史条目 minimal', () => {
    expect(() => 全局Schema.parse({
      编年史: [{ 序号: 1, 时间: 0, 标题: '开局', 结果摘要行: '故事开始' }],
    })).not.toThrow();
  });
  it('valid 编年史条目 with 媒介附件', () => {
    expect(() => 全局Schema.parse({
      编年史: [{
        序号: 2, 时间: 500, 标题: '朝廷大变', 地点键: 'loc_皇宫',
        母题: '权臣篡位', 结果摘要行: '权臣逼宫', 关联实体键: ['npc_权臣', 'npc_皇帝'],
        事件id: 'evt_001', 重要等级: '核心',
        媒介附件: { 格式模板键: 'tpl_邸报', 渠道标签: '邸报', 渲染缓存全文: '皇上圣躬有恙…' },
      }],
    })).not.toThrow();
  });
  it('valid: 编年史 时间负值（史前/古代背景）', () => {
    expect(() => 全局Schema.parse({
      编年史: [{ 序号: 0, 时间: -10000, 标题: '远古纪元', 结果摘要行: '混沌初开' }],
    })).not.toThrow();
  });
  it('invalid: 编年史条目 缺 序号（required field）', () => {
    expect(全局Schema.safeParse({
      编年史: [{ 时间: 0, 标题: '无序号', 结果摘要行: '' }],
    }).success).toBe(false);
  });
  it('invalid: 编年史 媒介附件 渲染缓存全文超 HISTORY_TEXT_MAX', () => {
    expect(全局Schema.safeParse({
      编年史: [{
        序号: 1, 结果摘要行: '',
        媒介附件: { 渠道标签: 'x', 渲染缓存全文: 'a'.repeat(HISTORY_TEXT_MAX + 1) },
      }],
    }).success).toBe(false);
  });
  it('invalid: 编年史 媒介附件 缺 渠道标签（required field）', () => {
    expect(全局Schema.safeParse({
      编年史: [{ 序号: 1, 结果摘要行: '', 媒介附件: { 格式模板键: 'tpl_x', 渲染缓存全文: '' } }],
    }).success).toBe(false);
  });

  // ── 综合样例：全量 全局 一次 parse ──────────────────────────────────────────
  it('valid: full 全局 entity (all blocks)', () => {
    expect(() => 全局Schema.parse({
      秘密库: { s001: { 母题: '谋反', 涉事方: [{ 实体键: 'npc_x', 角色: '主谋' }], 进展: 10, 严重度: 90, 暴露度: 0, $谜底: '皇子主导', 知情名单: [] } },
      约定库: { p001: { 形式: '盟约', 约束力: 70, 状态: '有效', 子类型: { 类型: '循环承诺', 周期: 1440 }, 挂靠时钟域: 'clock_主', 目标失效回退: '作废' } },
      继承包: { 候选: [], 世界遗产白名单: ['世界.格局'] },
      家族树: { 边: { role_a: { 生卒: {}, 双亲边: [], 总评: '开国之君', 关键成就: [], 传家宝: [] } }, 幽灵节点: {} },
      覆写日志: [{ 时间: 100, 授权源: 'GM', 级别: 'L1', 目标: 'NPC.x.属性.力量', 理由: '测试', 是否作弊: false, 提案单引用: 'prop_001' }],
      作弊标记: false,
      编年史: [{ 序号: 1, 时间: 100, 标题: '创世', 结果摘要行: '故事开始', 关联实体键: ['npc_x'], 重要等级: '核心' }],
    })).not.toThrow();
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
  // 4a. 占位形态 (6.33)
  it('valid: 地点 with 占位形态', () => {
    expect(地图Schema.safeParse({
      地点: {
        loc_A: {
          占位形态: { 名称: '未开发地带', 父节点: 'loc_城市', 相对方位: '北门外', seed: 'abc123' },
        },
      },
    }).success).toBe(true);
  });
  it('valid: 占位形态 absent → undefined (optional)', () => {
    const res = 地图Schema.parse({ 地点: { loc_A: {} } });
    expect(res.地点['loc_A']?.占位形态).toBeUndefined();
  });
  it('invalid: 占位形态 wrong type (string)', () => {
    expect(地图Schema.safeParse({
      地点: { loc_A: { 占位形态: '北门外' } },
    }).success).toBe(false);
  });
  // 4b. 分区键 (6.42)
  it('valid: 地点 with 分区键', () => {
    expect(地图Schema.safeParse({
      地点: { loc_A: { 分区键: 'zone_northern' } },
    }).success).toBe(true);
  });
  it('valid: 分区键 absent → undefined (optional)', () => {
    const res = 地图Schema.parse({ 地点: { loc_A: {} } });
    expect(res.地点['loc_A']?.分区键).toBeUndefined();
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
  // 3. $模型画像 禁词表 (6.41)
  it('$模型画像: entry with 禁词表 → valid', () => {
    expect($模型画像Schema.safeParse({
      claude: { 风格补正提示词: '简洁', 采样参数: {}, 禁词表: ['意境', '古风'] },
    }).success).toBe(true);
  });
  it('$模型画像: 禁词表 defaults to [] when absent', () => {
    const res = $模型画像Schema.parse({ claude: { 风格补正提示词: '' } });
    expect(res['claude']?.禁词表).toEqual([]);
  });
  it('$模型画像: invalid 禁词表 wrong type (string instead of array)', () => {
    expect($模型画像Schema.safeParse({
      claude: { 禁词表: '八股' },
    }).success).toBe(false);
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
// 4.10 Preset layer (4.11 · 6.41 · 6.42 additive fields)
// ══════════════════════════════════════════

describe('4.10 Preset layer', () => {
  // 1a. 检定骰面
  it('玩法预设: 空对象 parse 通过（全新字段含默认值）', () => {
    expect(() => 玩法预设Schema.parse({})).not.toThrow();
  });
  it('检定骰面: 默认 判定骰型=100, 显骰=false, 暴击映射=关', () => {
    const res = 玩法预设Schema.parse({});
    expect(res.检定骰面.判定骰型).toBe(100);
    expect(res.检定骰面.显骰).toBe(false);
    expect(res.检定骰面.暴击映射).toBe('关');
  });
  it('检定骰面: valid 判定骰型=20', () => {
    expect(玩法预设Schema.safeParse({ 检定骰面: { 判定骰型: 20 } }).success).toBe(true);
  });
  it('检定骰面: valid 暴击映射 object form', () => {
    expect(玩法预设Schema.safeParse({
      检定骰面: { 暴击映射: { 顶格升一档: true, 底格降一档: true } },
    }).success).toBe(true);
  });
  it('检定骰面: invalid 判定骰型=6 (out of enum)', () => {
    expect(玩法预设Schema.safeParse({ 检定骰面: { 判定骰型: 6 } }).success).toBe(false);
  });
  it('检定骰面: invalid 暴击映射 wrong string (not 关)', () => {
    expect(玩法预设Schema.safeParse({ 检定骰面: { 暴击映射: '开' } }).success).toBe(false);
  });
  // 1b. 媒介登记表（6.44）
  it('媒介登记表: 默认 parse 为空 record', () => {
    const res = 玩法预设Schema.parse({});
    expect(res.媒介登记表).toEqual({});
  });
  it('媒介登记表: valid 含媒介条目', () => {
    expect(媒介登记表Schema.safeParse({
      报纸: { 模板正文: '{{日期}}号外', 必填槽位: ['日期'], 引擎槽位: [], 渠道标签: '公开' },
    }).success).toBe(true);
  });
  it('媒介登记表: invalid 模板正文超长度上限', () => {
    expect(媒介登记表Schema.safeParse({
      日记: { 模板正文: 'x'.repeat(叙事模板正文长度上限 + 1) },
    }).success).toBe(false);
  });
  it('媒介登记表: invalid 缺少必填 模板正文 字段', () => {
    expect(媒介登记表Schema.safeParse({
      告示板: { 必填槽位: ['地点'] },
    }).success).toBe(false);
  });
  // 1b-2. 叙事分发表（6.44）
  it('叙事分发表: 默认 parse 为空 record', () => {
    const res = 玩法预设Schema.parse({});
    expect(res.叙事分发表).toEqual({});
  });
  it('叙事分发表: valid 含分发条目', () => {
    expect(叙事分发表Schema.safeParse({
      战斗开始: { 媒介键引用: '报纸', 优先级: 1 },
      市场交易: { 媒介键引用: '告示板' },
    }).success).toBe(true);
  });
  it('叙事分发表: invalid 优先级非整数', () => {
    expect(叙事分发表Schema.safeParse({
      锚点A: { 媒介键引用: '日记', 优先级: 1.5 },
    }).success).toBe(false);
  });
  // 1c. 母题词汇表
  it('母题词汇表: 默认 parse 为空 record', () => {
    const res = 玩法预设Schema.parse({});
    expect(res.母题词汇表).toEqual({});
  });
  it('母题词汇表: valid 含词条', () => {
    expect(母题词汇表Schema.safeParse({
      权谋: { 词条: ['阴谋', '暗算', '联盟'], 调味提示词: '尔虞我诈' },
    }).success).toBe(true);
  });
  it('母题词汇表: invalid 词条 wrong type (string instead of array)', () => {
    expect(母题词汇表Schema.safeParse({ 权谋: { 词条: '阴谋' } }).success).toBe(false);
  });
  // 1d. 实体模板库
  it('实体模板库: 默认 parse 含空数组', () => {
    const res = 玩法预设Schema.parse({});
    expect(res.实体模板库.NPC模板).toEqual([]);
    expect(res.实体模板库.组织模板).toEqual([]);
    expect(res.实体模板库.物品模板).toEqual([]);
  });
  it('实体模板库: invalid NPC模板 wrong type (object instead of array)', () => {
    expect(实体模板库Schema.safeParse({ NPC模板: {}, 组织模板: [], 物品模板: [] }).success).toBe(false);
  });
  // 1e. 开局装配数据
  it('开局装配数据: 默认 parse 通过', () => {
    const res = 玩法预设Schema.parse({});
    expect(res.开局装配数据.家境装配包).toEqual([]);
    expect(res.开局装配数据.序章模板.模式).toBe('AI自由');
  });
  it('开局装配数据: valid 序章模板.模式=固定文本', () => {
    expect(开局装配数据Schema.safeParse({
      序章模板: { 模式: '固定文本', 正文: '你出生在一个普通家庭' },
    }).success).toBe(true);
  });
  it('开局装配数据: invalid 序章模板.模式 非法枚举值', () => {
    expect(开局装配数据Schema.safeParse({
      序章模板: { 模式: '自由发挥' },
    }).success).toBe(false);
  });
  // 1f. 文风库（6.44，原叙事风格预设库更名）
  it('文风库: 默认 parse 为空数组', () => {
    const res = 玩法预设Schema.parse({});
    expect(res.文风库).toEqual([]);
  });
  it('文风库: valid 含风格条目', () => {
    expect(文风库Schema.safeParse([
      { 键: 'wuxia', 名称: '武侠', 风格提示词: '古典武侠，意境深远', 默认开: true },
    ]).success).toBe(true);
  });
  it('文风库: invalid 风格提示词超长度上限', () => {
    expect(文风库Schema.safeParse([
      { 键: 'a', 名称: 'b', 风格提示词: 'x'.repeat(叙事模板正文长度上限 + 1) },
    ]).success).toBe(false);
  });
  it('文风库: invalid 风格提示词缺失 (required field)', () => {
    expect(文风库Schema.safeParse([
      { 键: 'a', 名称: 'b' },
    ]).success).toBe(false);
  });
  // P0-5 检定档切分表 防回归断言
  it('检定档切分表: 默认切分界 大胜下限=40, 胜下限=15, 惨胜下限=1, 败下限=-24', () => {
    const res = 检定档切分表Schema.parse({});
    expect(res.大胜下限).toBe(40);
    expect(res.胜下限).toBe(15);
    expect(res.惨胜下限).toBe(1);
    expect(res.败下限).toBe(-24);
  });
  it('检定档切分表: 在 玩法预设 中存在并含默认值', () => {
    const res = 玩法预设Schema.parse({});
    expect(res.检定档切分表.大胜下限).toBe(40);
    expect(res.检定档切分表.胜下限).toBe(15);
  });
  it('检定档切分表: 可被预设覆盖', () => {
    const res = 玩法预设Schema.parse({
      检定档切分表: { 大胜下限: 50, 胜下限: 20, 惨胜下限: 5, 败下限: -20 },
    });
    expect(res.检定档切分表.大胜下限).toBe(50);
  });
  // P0-5 钳制表 防回归断言
  it('钳制表: 默认按重要等级为空对象, 按字段为空 record', () => {
    const res = 钳制表Schema.parse({});
    expect(res.按重要等级).toEqual({});
    expect(res.按字段).toEqual({});
  });
  it('钳制表: 在 玩法预设 中存在并含默认值', () => {
    const res = 玩法预设Schema.parse({});
    expect(res.钳制表.按重要等级).toEqual({});
    expect(res.钳制表.按字段).toEqual({});
  });
  it('钳制表: valid 双层结构', () => {
    expect(钳制表Schema.safeParse({
      按重要等级: { 路人: 5, 次要: 10, 重要: 20, 核心: 30 },
      按字段: { '属性.智慧': { 单次Δ上限: 5, 最小值: 0, 最大值: 100 } },
    }).success).toBe(true);
  });
  // P0-5 $存档种子 防回归断言
  it('$存档种子: 默认值为 0（哨兵）', () => {
    expect($存档种子Schema.parse(undefined)).toBe(0);
  });
  it('$存档种子: 在 RootSchema 中存在且默认值=0', () => {
    const state = RootSchema.parse({});
    expect(state.$存档种子).toBe(0);
  });
  it('$存档种子: 可接受整数', () => {
    expect($存档种子Schema.safeParse(12345).success).toBe(true);
  });
  it('$存档种子: 拒绝非整数', () => {
    expect($存档种子Schema.safeParse(1.5).success).toBe(false);
  });
  // P0-5 $会话状态.演出层草稿计数 防回归断言（发现D: 原「本拍重掷序号」改名）
  it('$会话状态: 含 演出层草稿计数 字段，默认=0', () => {
    const state = RootSchema.parse({});
    expect(state.$会话状态.演出层草稿计数).toBe(0);
  });
  it('$会话状态: 既有字段未受影响（最后交互时间戳/未读播报数/崩溃恢复指针）', () => {
    const res = RootSchema.parse({});
    expect(res.$会话状态.最后交互时间戳).toBe(0);
    expect(res.$会话状态.未读播报数).toBe(0);
    expect(res.$会话状态.崩溃恢复指针).toBe('');
  });
  it('$会话状态: 演出层草稿计数拒绝负值', () => {
    expect(RootSchema.shape.$会话状态.safeParse({ 演出层草稿计数: -1 }).success).toBe(false);
  });
  // 6.44 防回归断言：旧键名已从 玩法预设 和文风条目中删除
  it('防回归: 玩法预设Schema.shape 不含旧键「叙事格式表」', () => {
    expect('叙事格式表' in 玩法预设Schema.shape).toBe(false);
  });
  it('防回归: 玩法预设Schema.shape 不含旧键「叙事风格预设库」', () => {
    expect('叙事风格预设库' in 玩法预设Schema.shape).toBe(false);
  });
  it('防回归: 文风库条目 parse 后不含已删字段「适用场景」（strip 验证）', () => {
    const res = 文风库Schema.parse([
      { 键: 'a', 名称: 'b', 风格提示词: '测试', 适用场景: '武侠世界' },
    ]);
    expect(res[0]).not.toHaveProperty('适用场景');
  });
});

// ══════════════════════════════════════════
// P0-1 minimum empty state fixture
// ══════════════════════════════════════════

describe('P0-1 minimum empty state', () => {
  it('RootSchema.parse({}) succeeds — all defaults cascade', () => {
    expect(() => RootSchema.parse({})).not.toThrow();
  });
  it('empty state: _叙事设置.人称 is structured object with defaults', () => {
    const state = RootSchema.parse({});
    expect(state._叙事设置.人称.人称).toBe('二');
    expect(state._叙事设置.人称.视角宿主).toBe('');
  });
  it('empty state: _叙事设置.叙事权限 has default', () => {
    const state = RootSchema.parse({});
    expect(state._叙事设置.叙事权限.玩家角色写权限).toBe('玩家独占');
  });
  it('empty state: 系统.功能开关表 has all 6.75 defaults', () => {
    const state = RootSchema.parse({});
    expect(state.系统.功能开关表.观战模式).toBe(false);
    expect(state.系统.功能开关表.舞台追踪).toBe('自动按场景');
    expect(state.系统.功能开关表.二审严格度).toBe(50);
    expect(state.系统.功能开关表.二审维度开关).toEqual({});
  });
  it('empty state: 世界域 defaults to {}', () => {
    const state = RootSchema.parse({});
    expect(state.世界域).toEqual({});
  });
  it('活跃区间条目Schema: 终止纪元分钟 默认 null（域仍活跃）', () => {
    const res = 活跃区间条目Schema.parse({});
    expect(res.终止纪元分钟).toBeNull();
  });
  it('活跃区间条目Schema: 起始纪元分钟 允许负值（无 .min(0)）', () => {
    expect(活跃区间条目Schema.safeParse({ 起始纪元分钟: -1 }).success).toBe(true);
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
    expect(schemaKeys.size).toBe(41); // P0-5 +$存档种子; P0-1 镜头焦点角色→席位表(rename, count unchanged)
  });

  it('BLUEPRINT_KEYS has no duplicates', () => {
    const set = new Set(BLUEPRINT_KEYS);
    expect(set.size).toBe(BLUEPRINT_KEYS.length);
  });
});

// ══════════════════════════════════════════
// 6.43 编年史 · 叙事流
// ══════════════════════════════════════════

describe('6.43 编年史（全局.编年史）', () => {
  it('全局Schema: 编年史默认为空数组', () => {
    expect(全局Schema.parse({}).编年史).toEqual([]);
  });
  it('编年史条目: 时间负值（史前/古代背景）必须通过', () => {
    expect(编年史条目Schema.safeParse({
      序号: 1,
      时间: -525600, // 公元前1年附近
      标题: '大战爆发',
      结果摘要行: '联军击溃蛮族',
    }).success).toBe(true);
  });
  it('编年史条目: 时间=0（哨兵）通过', () => {
    expect(编年史条目Schema.safeParse({ 序号: 1, 标题: '创世', 结果摘要行: '' }).success).toBe(true);
  });
  it('编年史条目: 媒介附件 渲染缓存全文超 HISTORY_TEXT_MAX 拒收', () => {
    expect(编年史条目Schema.safeParse({
      序号: 2,
      标题: '头版',
      结果摘要行: '',
      媒介附件: { 渠道标签: '邸报', 渲染缓存全文: 'x'.repeat(HISTORY_TEXT_MAX + 1) },
    }).success).toBe(false);
  });
  it('媒介附件: 缺渠道标签拒收', () => {
    expect(编年史条目Schema.safeParse({
      序号: 3,
      标题: '号外',
      结果摘要行: '',
      媒介附件: { 格式模板键: 'tpl_01', 渲染缓存全文: '正文' },
    }).success).toBe(false);
  });
  it('媒介附件: 渠道标签存在且正文在限内通过', () => {
    expect(编年史条目Schema.safeParse({
      序号: 4,
      标题: '要闻',
      结果摘要行: '天下太平',
      媒介附件: { 渠道标签: '邸报', 渲染缓存全文: '正文' },
    }).success).toBe(true);
  });
  it('HISTORY_TEXT_MAX 与 叙事模板正文长度上限 是不同常量', () => {
    expect(HISTORY_TEXT_MAX).toBe(8000);
    expect(叙事模板正文长度上限).toBe(4000);
    expect(HISTORY_TEXT_MAX).not.toBe(叙事模板正文长度上限);
  });
  it('SystemSchema: 叙事流高水位序号 默认=0', () => {
    expect(SystemSchema.parse({}).叙事流高水位序号).toBe(0);
  });
});

describe('6.43 叙事流条目Schema（不进 RootSchema）', () => {
  const 基础条目 = { 序号: 1, 来源: 'AI叙事' as const, 正文: '一行叙事' };

  it('叙事流: 时刻.读数负值（史前）必须通过', () => {
    expect(叙事流条目Schema.safeParse({
      ...基础条目,
      时刻: { 读数: -1440, 钟源: '世界钟' },
    }).success).toBe(true);
  });
  it('叙事流: 时刻.读数=0（哨兵）通过', () => {
    expect(叙事流条目Schema.safeParse(基础条目).success).toBe(true);
  });
  it('叙事流正文超 HISTORY_TEXT_MAX 拒收', () => {
    expect(叙事流条目Schema.safeParse({
      ...基础条目,
      正文: 'x'.repeat(HISTORY_TEXT_MAX + 1),
    }).success).toBe(false);
  });
  it('叙事流: 来源合法枚举全部通过', () => {
    const sources = ['AI叙事', '玩家输入', '引擎系统行', '降级文本'] as const;
    for (const 来源 of sources) {
      expect(叙事流条目Schema.safeParse({ ...基础条目, 来源 }).success).toBe(true);
    }
  });
  it('叙事流: 来源非法枚举拒收', () => {
    expect(叙事流条目Schema.safeParse({ ...基础条目, 来源: '未知' }).success).toBe(false);
  });
  it('叙事流: strip 姿态——未知字段被剥除不报错', () => {
    const res = 叙事流条目Schema.safeParse({ ...基础条目, 未知字段: '应被剥除' });
    expect(res.success).toBe(true);
    if (res.success) expect((res.data as Record<string, unknown>)['未知字段']).toBeUndefined();
  });
  it('叙事流: 缺 序号 拒收', () => {
    expect(叙事流条目Schema.safeParse({ 来源: 'AI叙事', 正文: '正文' }).success).toBe(false);
  });
  it('叙事流: 缺 正文 拒收', () => {
    expect(叙事流条目Schema.safeParse({ 序号: 1, 来源: 'AI叙事' }).success).toBe(false);
  });
});
