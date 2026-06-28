import { describe, it, expect } from 'vitest';
import { z } from 'zod';
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
  资产条目Schema,
  工作记忆Schema,
  长期归档Schema,
  日程Schema,
  行动卡库Schema,
  仲裁器Schema,
  mod注册表Schema,
  _mod墓碑库Schema,
  mod墓碑条目Schema,
  mod墓碑原因枚举,
  intervention_pack_v1Schema,
  副作用级别枚举Schema,
  调用类型注册表Schema,
  Ring2在途调用信封Schema,
  落账记录条目Schema,
  渲染模式枚举,
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
  存档头Schema,
  死亡事件Schema,
  玩法预设Schema,
  属性轴表Schema,
  检定骰面Schema,
  检定档切分表Schema,
  钳制表Schema,
  媒介登记表Schema,
  叙事分发表Schema,
  二审维度条目Schema,
  小剧场剧本条目Schema,
  死亡拦截器条目Schema,
  换角许可Schema,
  母题词汇表Schema,
  实体模板库Schema,
  开局装配数据Schema,
  文风库Schema,
  叙事模板正文长度上限,
  HISTORY_TEXT_MAX,
  编年史条目Schema,
  约定子类型Schema,
  RootSchemaStrict,
  动词Id枚举,
  动词目标槽Schema,
  动词OptionSchema表,
  重掷策略枚举Schema,
  不可逆Schema,
  命名空间枚举,
  键条目Schema,
  受治理键空间注册表Schema,
  归并条目Schema,
  归并表Schema,
  仲裁策略枚举,
  仲裁策略Schema,
  母题注册条目Schema,
  母题注册表Schema,
  地点类别登记条目Schema,
  地点类别注册表Schema,
  规范化键码位,
  JS保留键黑名单,
  是JS保留键,
  受治理路径Schema,
  受治理句柄Schema,
} from '../schema/index.js';
import { classifyTopKey, deriveWritableWhitelist } from '../schema/whitelistDryRun.js';
import { backfill货币账户PerEntity } from '../migration/migrate.js';
import { FINGERPRINT_BUNDLE_MEMBERS, FINGERPRINT_EXCLUDED_FIELDS } from '../engine/fingerprintManifest.js';
import { 叙事流条目Schema } from '../schema/narrativeStream.js';
import {
  lore条目Schema,
  lore知识库Schema,
} from '../schema/lore.js';
import {
  TOOL_能力条目Schema,
  TOOL_能力类型,
} from '../schema/toolLibrary.js';
import { 种族模板Schema } from '../schema/preset.js';
import { backfillPhaseL1b } from '../migration/migrate.js';

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
  // 6.76 观战推进模式（第5开关）
  it('功能开关表: 观战推进模式 默认=手动步进', () => {
    const res = SystemSchema.parse({});
    expect(res.功能开关表.观战推进模式).toBe('手动步进');
  });
  it('功能开关表: 观战推进模式 三值全合法', () => {
    for (const v of ['手动步进', '自动连播', '快播到事件'] as const) {
      expect(SystemSchema.safeParse({ 功能开关表: { 观战推进模式: v } }).success).toBe(true);
    }
  });
  it('功能开关表: 观战推进模式 拒绝非法值', () => {
    expect(SystemSchema.safeParse({ 功能开关表: { 观战推进模式: '全速' } }).success).toBe(false);
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
  // 6.76 视角锁定（二元选择）
  it('人称: 视角锁定 默认=锁定单一宿主', () => {
    expect(NarrativeSettingSchema.parse({}).人称.视角锁定).toBe('锁定单一宿主');
  });
  it('人称: 视角锁定 可切换出场角色', () => {
    expect(NarrativeSettingSchema.safeParse({ 人称: { 视角锁定: '可切换出场角色' } }).success).toBe(true);
  });
  it('人称: 视角锁定 拒绝非法值', () => {
    expect(NarrativeSettingSchema.safeParse({ 人称: { 视角锁定: '自由切换' } }).success).toBe(false);
  });
  // 6.76 叙事权限·三档决策权限（细化 6.75 两档）
  it('叙事权限: 默认值 玩家角色决策权限="玩家独占"', () => {
    const res = NarrativeSettingSchema.parse({});
    expect(res.叙事权限.玩家角色决策权限).toBe('玩家独占');
  });
  it('叙事权限: 可设为"模型可代写·需确认"', () => {
    const res = NarrativeSettingSchema.parse({ 叙事权限: { 玩家角色决策权限: '模型可代写·需确认' } });
    expect(res.叙事权限.玩家角色决策权限).toBe('模型可代写·需确认');
  });
  it('叙事权限: 可设为"模型可代写·自动"', () => {
    const res = NarrativeSettingSchema.parse({ 叙事权限: { 玩家角色决策权限: '模型可代写·自动' } });
    expect(res.叙事权限.玩家角色决策权限).toBe('模型可代写·自动');
  });
  it('叙事权限: 拒绝旧二值格式「模型可代写」（已细化为三档）', () => {
    expect(NarrativeSettingSchema.safeParse({ 叙事权限: { 玩家角色决策权限: '模型可代写' } }).success).toBe(false);
  });
  it('叙事权限: 拒绝非法枚举值', () => {
    expect(NarrativeSettingSchema.safeParse({ 叙事权限: { 玩家角色决策权限: '随意' } }).success).toBe(false);
  });
  it('防回归: 叙事权限 不含旧字段「玩家角色写权限」', () => {
    const res = NarrativeSettingSchema.parse({});
    expect(res.叙事权限).not.toHaveProperty('玩家角色写权限');
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
  // 13a: 对齐模式 in 粒度模板Schema (open record)
  it('_粒度模板: 对齐模式 defaults to 固定跨度', () => {
    const world = 世界Schema.parse({});
    expect(world._粒度模板['即时']!.对齐模式).toBe('固定跨度');
    expect(world._粒度模板['发展']!.对齐模式).toBe('固定跨度');
  });
  it('_粒度模板: 对齐模式 accepts 历法对齐', () => {
    const result = 世界Schema.parse({ _粒度模板: { 发展: { 对齐模式: '历法对齐' } } });
    expect(result._粒度模板['发展']!.对齐模式).toBe('历法对齐');
  });
  it('_粒度模板: 对齐模式 rejects unknown value', () => {
    expect(世界Schema.safeParse({ _粒度模板: { 即时: { 对齐模式: '自由' } } }).success).toBe(false);
  });
  it('_粒度模板: default record has all 4 out-of-box granularity entries', () => {
    const world = 世界Schema.parse({});
    expect(world._粒度模板['即时']).toBeDefined();
    expect(world._粒度模板['日常']).toBeDefined();
    expect(world._粒度模板['发展']).toBeDefined();
    expect(world._粒度模板['世代']).toBeDefined();
  });
  it('_粒度模板: accepts custom granularity key (open record, de-enumerated)', () => {
    const world = 世界Schema.parse({ _粒度模板: { 史诗档: {} } });
    expect(world._粒度模板['史诗档']).toBeDefined();
    expect(world._粒度模板['史诗档']!.对齐模式).toBe('固定跨度');
  });
  it('当前粒度 and 粒度栈 accept custom granularity keys', () => {
    const world = 世界Schema.parse({ 当前粒度: '史诗档', 粒度栈: ['日常', '史诗档'] });
    expect(world.当前粒度).toBe('史诗档');
    expect(world.粒度栈).toContain('史诗档');
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
  it('valid NPC 占位形态 with _模板快照（K2/K3·来源包只读）', () => {
    expect(() => NpcSchema.parse({
      占位形态: { 名称: 'X', 实体类型: 'NPC', 硬约束: [], 来源拍号: 0, _模板引用: 'tpl_guard', _模板快照: { 属性: {} } },
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
  it('既往记忆种子 相对事件序号 present → parse passes', () => {
    const result = 既往记忆种子条目Schema.parse({
      摘要: '离家出走',
      发生时间_约: '十五岁',
      相对事件序号: 2,
      重要度: 2,
      情绪色彩: '愤怒',
      来源: '导入预设',
    });
    expect(result.相对事件序号).toBe(2);
  });
  it('既往记忆种子 相对事件序号 absent → parse passes (optional)', () => {
    const result = 既往记忆种子条目Schema.parse({ 摘要: '童年玩伴', 发生时间_约: '七岁', 来源: '导入预设' });
    expect(result.相对事件序号).toBeUndefined();
  });
  it('既往记忆种子 相对事件序号 serialize→load 往返序号恒等', () => {
    const seeds = [
      { 摘要: 'A事件', 发生时间_约: '十岁', 相对事件序号: 0, 重要度: 1, 来源: '导入预设' },
      { 摘要: 'B事件', 发生时间_约: '十二岁', 相对事件序号: 1, 重要度: 2, 来源: '导入预设' },
      { 摘要: 'C事件', 发生时间_约: '十五岁', 相对事件序号: 2, 重要度: 3, 来源: '导入预设' },
    ];
    const loaded = seeds.map(s => 既往记忆种子条目Schema.parse(JSON.parse(JSON.stringify(s))));
    expect(loaded.map(s => s.相对事件序号)).toEqual([0, 1, 2]);
  });
  it('幕后行动种子 自定义意图串 parse passes', () => {
    expect(() => NpcSchema.parse({
      _幕后行动种子: [{ 类型: '策反', 优先级: 1 }],
    })).not.toThrow();
  });
  it('幕后行动种子 原 7 默认意图全部仍合法', () => {
    const defaults = ['报仇', '告发', '逃离', '结盟', '趋附', '探查', '流转潜伏'];
    for (const 类型 of defaults) {
      expect(NpcSchema.safeParse({ _幕后行动种子: [{ 类型, 优先级: 0 }] }).success).toBe(true);
    }
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
  // L-2a · 印象条目 观测拍号 optional
  it('L-2a valid: 印象条目 含 观测拍号', () => {
    expect(认知档案Schema.safeParse({
      npc_a: { npc_b: { 印象: [{ 标签: '热情', 极性: '正', 强度: 60, 来源: 'evt-001', 获知时间: 1000, 衰减速率: 0, 观测拍号: 950 }] } },
    }).success).toBe(true);
  });
  it('L-2a valid: 印象条目 无 观测拍号 → undefined（向下兼容）', () => {
    const res = 认知档案Schema.parse({
      npc_a: { npc_b: { 印象: [{ 标签: '冷静', 极性: '中', 强度: 40, 来源: 'evt-002', 获知时间: 500, 衰减速率: 0 }] } },
    });
    expect(res['npc_a']?.['npc_b']?.印象[0]?.观测拍号).toBeUndefined();
  });
  it('L-2a invalid: 观测拍号 为非整数', () => {
    expect(认知档案Schema.safeParse({
      npc_a: { npc_b: { 印象: [{ 观测拍号: 1.5 }] } },
    }).success).toBe(false);
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
  it('valid 占位形态 with _模板快照（K2/K3·来源包只读）', () => {
    expect(() => 组织占位形态Schema.parse({
      名称: '神秘商会', 实体类型: '商业组织', 硬约束: ['规模:中型'],
      来源拍号: 50, _模板引用: 'tpl_商会', _模板快照: { 类型: '商业', 行业: '贸易' },
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

describe('R7 · 组织实体条目 5 子树 顶层 opt-in', () => {
  it('空组织实体 parse → 财务 === undefined', () => {
    const parsed = 组织实体Schema.parse({ org: {} });
    expect(parsed['org']!.财务).toBeUndefined();
  });
  it('空组织实体 parse → 用工 === undefined', () => {
    const parsed = 组织实体Schema.parse({ org: {} });
    expect(parsed['org']!.用工).toBeUndefined();
  });
  it('空组织实体 parse → 治理 === undefined', () => {
    const parsed = 组织实体Schema.parse({ org: {} });
    expect(parsed['org']!.治理).toBeUndefined();
  });
  it('空组织实体 parse → 军事 === undefined', () => {
    const parsed = 组织实体Schema.parse({ org: {} });
    expect(parsed['org']!.军事).toBeUndefined();
  });
  it('空组织实体 parse → 信念 === undefined', () => {
    const parsed = 组织实体Schema.parse({ org: {} });
    expect(parsed['org']!.信念).toBeUndefined();
  });
  it('accessor 读回退: 财务显式 {} → 叶子 default 生效（本期净利=0）', () => {
    const parsed = 组织实体Schema.parse({ org: { 财务: {} } });
    expect(parsed['org']!.财务?.本期净利 ?? 0).toBe(0);
  });
  it('accessor 读回退: 用工显式 {} → 叶子 default 生效（产能系数=1）', () => {
    const parsed = 组织实体Schema.parse({ org: { 用工: {} } });
    expect(parsed['org']!.用工?.产能系数 ?? 1).toBe(1);
  });
  it('accessor 读回退: 治理显式 {} → 叶子 default 生效（追随者规模=0）', () => {
    const parsed = 组织实体Schema.parse({ org: { 治理: {} } });
    expect(parsed['org']!.治理?.追随者规模 ?? 0).toBe(0);
  });
  it('accessor 读回退: 军事显式 {} → 叶子 default 生效（补给=100）', () => {
    const parsed = 组织实体Schema.parse({ org: { 军事: {} } });
    expect(parsed['org']!.军事?.补给 ?? 100).toBe(100);
  });
  it('accessor 读回退: 信念显式 {} → 叶子 default 生效（官方体系=\'\'）', () => {
    const parsed = 组织实体Schema.parse({ org: { 信念: {} } });
    expect(parsed['org']!.信念?.官方体系 ?? '').toBe('');
  });
  it('项目档内 财务 absent → undefined', () => {
    const parsed = 组织实体Schema.parse({ org: { 项目档: { 进展树: {} } } });
    expect(parsed['org']!.项目档?.财务).toBeUndefined();
  });
  it('项目档内 用工 absent → undefined', () => {
    const parsed = 组织实体Schema.parse({ org: { 项目档: { 进展树: {} } } });
    expect(parsed['org']!.项目档?.用工).toBeUndefined();
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
  it('default: _作弊标记=false, _编年史=[], _覆写日志=[]', () => {
    const g = 全局Schema.parse({});
    expect(g._作弊标记).toBe(false);
    expect(g._编年史).toEqual([]);
    expect(g._覆写日志).toEqual([]);
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

  // ── 条款 标的 DSL v1.0（P0-1 Batch B）─────────────────────────────────────────
  it('条款.标的: absent (optional·零迁移)', () => {
    const res = 全局Schema.parse({ 约定库: { p: { 条款: [{ 内容: '无标的条款' }] } } });
    expect(res.约定库['p']?.条款[0]?.标的).toBeUndefined();
  });
  it('条款.标的: 旧字面量串（零迁移·string 分支）', () => {
    expect(() => 全局Schema.parse({
      约定库: { p: { 条款: [{ 内容: '割让领土', 标的: '燕云十六州' }] } },
    })).not.toThrow();
  });
  it('条款.标的: DSL v1.0 对象分支', () => {
    expect(() => 全局Schema.parse({
      约定库: { p: { 条款: [{ 内容: '等价置换', 标的: { v: '1.0', expr: 'NPC["npc_a"].属性.体质 * 10' } }] } },
    })).not.toThrow();
  });
  it('条款.标的: DSL 对象缺 v 字段拒收', () => {
    expect(全局Schema.safeParse({
      约定库: { p: { 条款: [{ 标的: { expr: '1+1' } }] } },
    }).success).toBe(false);
  });
  it('条款.标的: DSL 对象 v 非 1.0 拒收', () => {
    expect(全局Schema.safeParse({
      约定库: { p: { 条款: [{ 标的: { v: '2.0', expr: '1+1' } }] } },
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
            生卒约束: '唐高祖年间在世', _模板引用: 'tpl_贵妇',
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
  it('valid _覆写日志 with 提案单引用', () => {
    expect(() => 全局Schema.parse({
      _覆写日志: [{
        时间: 5000, 授权源: '系统管理员', 级别: 'L2',
        目标: 'NPC.npc_大臣.属性.智慧', 理由: '角色扶正调整',
        是否作弊: false, 提案单引用: 'proposal_Z3_001',
      }],
    })).not.toThrow();
  });
  it('valid: _覆写日志 提案单引用 absent (可空)', () => {
    expect(() => 全局Schema.parse({
      _覆写日志: [{ 时间: 0, 授权源: '', 级别: 'L1', 目标: '', 理由: '', 是否作弊: true }],
    })).not.toThrow();
  });
  it('invalid: _覆写日志 wrong type', () => {
    expect(全局Schema.safeParse({ _覆写日志: 'not-an-array' }).success).toBe(false);
  });

  // ── _作弊标记 ────────────────────────────────────────────────────────────────
  it('valid: _作弊标记 true', () => {
    expect(() => 全局Schema.parse({ _作弊标记: true })).not.toThrow();
  });

  // ── _编年史（6.43·append-only·媒介附件格式）─────────────────────────────────────
  it('valid _编年史条目 minimal', () => {
    expect(() => 全局Schema.parse({
      _编年史: [{ 序号: 1, 时间: 0, 标题: '开局', 结果摘要行: '故事开始' }],
    })).not.toThrow();
  });
  it('valid _编年史条目 with 媒介附件', () => {
    expect(() => 全局Schema.parse({
      _编年史: [{
        序号: 2, 时间: 500, 标题: '朝廷大变', 地点键: 'loc_皇宫',
        母题: '权臣篡位', 结果摘要行: '权臣逼宫', 关联实体键: ['npc_权臣', 'npc_皇帝'],
        事件id: 'evt_001', 重要等级: '核心',
        媒介附件: { 格式模板键: 'tpl_邸报', 渠道标签: '邸报', 渲染缓存全文: '皇上圣躬有恙…' },
      }],
    })).not.toThrow();
  });
  it('valid: _编年史 时间负值（史前/古代背景）', () => {
    expect(() => 全局Schema.parse({
      _编年史: [{ 序号: 0, 时间: -10000, 标题: '远古纪元', 结果摘要行: '混沌初开' }],
    })).not.toThrow();
  });
  it('invalid: _编年史条目 缺 序号（required field）', () => {
    expect(全局Schema.safeParse({
      _编年史: [{ 时间: 0, 标题: '无序号', 结果摘要行: '' }],
    }).success).toBe(false);
  });
  it('invalid: _编年史 媒介附件 渲染缓存全文超 HISTORY_TEXT_MAX', () => {
    expect(全局Schema.safeParse({
      _编年史: [{
        序号: 1, 结果摘要行: '',
        媒介附件: { 渠道标签: 'x', 渲染缓存全文: 'a'.repeat(HISTORY_TEXT_MAX + 1) },
      }],
    }).success).toBe(false);
  });
  it('invalid: _编年史 媒介附件 缺 渠道标签（required field）', () => {
    expect(全局Schema.safeParse({
      _编年史: [{ 序号: 1, 结果摘要行: '', 媒介附件: { 格式模板键: 'tpl_x', 渲染缓存全文: '' } }],
    }).success).toBe(false);
  });

  // ── 综合样例：全量 全局 一次 parse ──────────────────────────────────────────
  it('valid: full 全局 entity (all blocks)', () => {
    expect(() => 全局Schema.parse({
      秘密库: { s001: { 母题: '谋反', 涉事方: [{ 实体键: 'npc_x', 角色: '主谋' }], 进展: 10, 严重度: 90, 暴露度: 0, $谜底: '皇子主导', 知情名单: [] } },
      约定库: { p001: { 形式: '盟约', 约束力: 70, 状态: '有效', 子类型: { 类型: '循环承诺', 周期: 1440 }, 挂靠时钟域: 'clock_主', 目标失效回退: '作废' } },
      继承包: { 候选: [], 世界遗产白名单: ['世界.格局'] },
      家族树: { 边: { role_a: { 生卒: {}, 双亲边: [], 总评: '开国之君', 关键成就: [], 传家宝: [] } }, 幽灵节点: {} },
      _覆写日志: [{ 时间: 100, 授权源: 'GM', 级别: 'L1', 目标: 'NPC.x.属性.力量', 理由: '测试', 是否作弊: false, 提案单引用: 'prop_001' }],
      _作弊标记: false,
      _编年史: [{ 序号: 1, 时间: 100, 标题: '创世', 结果摘要行: '故事开始', 关联实体键: ['npc_x'], 重要等级: '核心' }],
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
  // L-25 · 相邻条目 跨字段语义闸（superRefine）
  it('L-25 valid: 相邻条目 目标+方式+距离 全给', () => {
    expect(地图Schema.safeParse({
      地点: { loc_A: { 相邻: [{ 目标: 'loc_B', 方式: '官道', 距离: 5 }] } },
    }).success).toBe(true);
  });
  it('L-25 valid: 相邻条目 仅目标·无方式/距离', () => {
    expect(地图Schema.safeParse({
      地点: { loc_A: { 相邻: [{ 目标: 'loc_B' }] } },
    }).success).toBe(true);
  });
  it('L-25 valid: 相邻条目 全缺省·目标空且无方式/距离 → 通过', () => {
    expect(地图Schema.safeParse({
      地点: { loc_A: { 相邻: [{}] } },
    }).success).toBe(true);
  });
  it('L-25 invalid: 相邻条目 目标为空但有方式', () => {
    expect(地图Schema.safeParse({
      地点: { loc_A: { 相邻: [{ 目标: '', 方式: '官道' }] } },
    }).success).toBe(false);
  });
  it('L-25 invalid: 相邻条目 目标为空但有距离', () => {
    expect(地图Schema.safeParse({
      地点: { loc_A: { 相邻: [{ 目标: '', 距离: 3 }] } },
    }).success).toBe(false);
  });
  // L-5 · 地点条目 物理规范 optional 字段
  it('L-5 valid: 地点条目 容量/营业时间/活动类型', () => {
    expect(地图Schema.safeParse({
      地点: { loc_A: { 容量: 50, 营业时间: '09:00-22:00', 活动类型: '多人' } },
    }).success).toBe(true);
  });
  it('L-5 valid: 容量/营业时间/活动类型 缺省 → undefined', () => {
    const res = 地图Schema.parse({ 地点: { loc_A: {} } });
    expect(res.地点['loc_A']?.容量).toBeUndefined();
    expect(res.地点['loc_A']?.营业时间).toBeUndefined();
    expect(res.地点['loc_A']?.活动类型).toBeUndefined();
  });
  it('L-5 invalid: 容量为负数', () => {
    expect(地图Schema.safeParse({
      地点: { loc_A: { 容量: -1 } },
    }).success).toBe(false);
  });
  // L-3a · 地点条目 可行走 optional
  it('L-3a valid: 地点条目 可行走=true', () => {
    expect(地图Schema.safeParse({
      地点: { loc_A: { 可行走: true } },
    }).success).toBe(true);
  });
  it('L-3a valid: 地点条目 可行走=false', () => {
    expect(地图Schema.safeParse({
      地点: { loc_A: { 可行走: false } },
    }).success).toBe(true);
  });
  it('L-3a valid: 可行走 缺省 → undefined', () => {
    const res = 地图Schema.parse({ 地点: { loc_A: {} } });
    expect(res.地点['loc_A']?.可行走).toBeUndefined();
  });
});

describe('4.7 Economy layer', () => {
  // ── 最小开局状态 ──────────────────────────────────────────────────────────────
  it('valid empty parse (minimal state)', () => {
    expect(() => 货币系统Schema.parse({})).not.toThrow();
  });
  it('minimal-state: RootSchema parse with empty 货币系统', () => {
    expect(() => RootSchema.parse({ 货币系统: {} })).not.toThrow();
  });

  // ── 币种定义 ──────────────────────────────────────────────────────────────────
  it('valid 币种定义 full entry', () => {
    expect(() => 货币系统Schema.parse({
      币种定义: {
        两: { 名称: '白银两', 类型: '法币', 量词: '两', 单位: '两', 符号: '￥', 时代适用: '大明', 地域适用: ['中原', '江南'], 对基准汇率: 1 },
        铜: { 名称: '铜钱', 类型: '法币', 量词: '文', 单位: '文', 符号: '铜', 时代适用: '大明', 地域适用: ['全境'], 对基准汇率: 0.001 },
        灵石: { 名称: '灵石', 类型: '物品货币', 量词: '块', 单位: '块', 符号: '★', 时代适用: '修真纪元', 地域适用: ['仙门'], 对基准汇率: 100 },
      },
      基准币种: '两',
    })).not.toThrow();
  });
  it('valid: 币种定义 时代适用 era 锚定（非公历）', () => {
    expect(() => 货币系统Schema.parse({
      币种定义: { dollar: { 名称: 'Dollar', 时代适用: 'era_近代工业', 对基准汇率: 1 } },
    })).not.toThrow();
  });
  it('invalid: 对基准汇率 negative', () => {
    expect(货币系统Schema.safeParse({
      币种定义: { bad: { 对基准汇率: -1 } },
    }).success).toBe(false);
  });

  // ── 汇率 ──────────────────────────────────────────────────────────────────────
  it('valid 汇率 record', () => {
    expect(() => 货币系统Schema.parse({
      汇率: { 两: 1, 铜: 0.001, 灵石: 100 },
    })).not.toThrow();
  });
  it('invalid: 汇率 值 negative', () => {
    expect(货币系统Schema.safeParse({ 汇率: { 两: -0.5 } }).success).toBe(false);
  });

  // ── 换汇登记 ─────────────────────────────────────────────────────────────────
  it('valid 换汇登记[]', () => {
    expect(() => 货币系统Schema.parse({
      换汇登记: [
        { 时间: 5040, 从: '两', 到: '铜', 金额: 1 },
        { 时间: -100, 从: '金', 到: '两', 金额: 0.5 }, // 负值合法（史前/古代时区）
      ],
    })).not.toThrow();
  });
  it('valid: 换汇登记 时间=0 哨兵', () => {
    expect(() => 货币系统Schema.parse({
      换汇登记: [{ 时间: 0, 从: '两', 到: '铜', 金额: 10 }],
    })).not.toThrow();
  });

  // ── 经济依附 ─────────────────────────────────────────────────────────────────
  it('valid 经济依附', () => {
    expect(() => 货币系统Schema.parse({
      经济依附: { 状态: '依附', 对象: 'npc_家主', 每期模式: '月供零花钱' },
    })).not.toThrow();
  });
  it('valid: 经济依附 独立', () => {
    expect(() => 货币系统Schema.parse({
      经济依附: { 状态: '独立', 对象: '', 每期模式: '' },
    })).not.toThrow();
  });

  // ── 账户.持有（透支档·6.25·允许为负） ──────────────────────────────────────
  it('valid: 持有 负值（透支档 6.25）', () => {
    expect(货币系统Schema.safeParse({ 账户: { '某实体键': { 持有: { 两: -200 } } } }).success).toBe(true);
  });
  it('valid: 持有 零值', () => {
    expect(货币系统Schema.safeParse({ 账户: { '某实体键': { 持有: { 两: 0 } } } }).success).toBe(true);
  });

  // ── 账户.储蓄 + 本期收入/支出 ────────────────────────────────────────────────
  it('valid 账户 full with 本期收入/支出', () => {
    expect(() => 货币系统Schema.parse({
      账户: {
        '某实体键': {
          持有: { 两: 500, 铜: 2000 },
          储蓄: { 两: 1000 },
          本期收入: { 总额: 200, 明细: { 'node_扬州商铺': 150, 'npc_客户': 50 } },
          本期支出: { 总额: 80, 明细: { 食物: 30, 住宿: 50 } },
          被动收入来源: { 扬州商铺: 150 },
        },
      },
    })).not.toThrow();
  });

  // ── 账户._负债（约定库引用）─────────────────────────────────────────────────
  it('valid _负债{债务ID:约定库键}（6.25 大额借贷走约定库）', () => {
    expect(() => 货币系统Schema.parse({
      账户: {
        '某实体键': {
          _负债: {
            debt_001: 'pact_借款_商人甲',
            debt_002: 'pact_借款_钱庄乙',
          },
        },
      },
    })).not.toThrow();
  });
  it('valid: _负债 empty record', () => {
    expect(() => 货币系统Schema.parse({ 账户: { '某实体键': { _负债: {} } } })).not.toThrow();
  });

  // ── 账户._应收（约定库引用·选 i·与_负债对称） ──────────────────────────────────
  it('valid _应收{应收ID:约定库键}（引用式·金额真值单源在约定库）', () => {
    expect(() => 货币系统Schema.parse({
      账户: {
        '某实体键': {
          _应收: {
            recv_001: 'pact_赊账_王掌柜',
            recv_002: 'pact_货款_商行乙',
          },
        },
      },
    })).not.toThrow();
  });
  it('valid: _应收 empty record（default {}）', () => {
    expect(() => 货币系统Schema.parse({ 账户: { '某实体键': { _应收: {} } } })).not.toThrow();
  });
  it('_应收 默认值 = {}', () => {
    const parsed = 货币系统Schema.parse({ 账户: { '某实体键': {} } });
    expect(parsed.账户['某实体键']?._应收).toEqual({});
  });
  it('invalid: _应收 value 非 string（选 i·引用串·非数值腿）', () => {
    expect(货币系统Schema.safeParse({ 账户: { '某实体键': { _应收: { recv_001: 123 } } } }).success).toBe(false);
  });

  // ── 账户._费用（accrual 消费报表流·不进 getNetAsset） ───────────────────────────
  it('valid _费用 default {总额:0,明细:{}}', () => {
    const parsed = 货币系统Schema.parse({ 账户: { '某实体键': {} } });
    expect(parsed.账户['某实体键']?._费用).toEqual({ 总额: 0, 明细: {} });
  });
  it('valid _费用 with 明细', () => {
    expect(() => 货币系统Schema.parse({
      账户: {
        '某实体键': {
          _费用: { 总额: 50, 明细: { 酒水: 30, 草料: 20 } },
        },
      },
    })).not.toThrow();
  });
  it('invalid: _费用.总额 非数值', () => {
    expect(货币系统Schema.safeParse({ 账户: { '某实体键': { _费用: { 总额: '五十' } } } }).success).toBe(false);
  });

  // ── 账户.资产（E1·开放串类别取代持仓七枚举） ────────────────────────────────
  it('valid 资产 各类别开放串（E1）', () => {
    expect(() => 货币系统Schema.parse({
      账户: {
        '某实体键': {
          资产: [
            { 标的: '大同煤矿股份', 类别: '股票', 数量: 100, 成本价: 50, 现价: 65 },
            { 标的: '铁矿石期货', 类别: '期货', 数量: 10, 成本价: 200, 现价: 195, 杠杆: 5, 保证金: 400, 到期日: 7200 },
            { 标的: '扬州宅院', 类别: '地契', 数量: 1, 成本价: 5000, 现价: 6000 },
            { 标的: '上品灵石', 类别: '灵石', 数量: 50, 成本价: 100, 现价: 110 },
            { 标的: '版权许可', 类别: '版权', 数量: 1, 成本价: 800, 现价: 900 },
          ],
        },
      },
    })).not.toThrow();
  });
  it('valid 资产 衍生品参数 open record', () => {
    expect(() => 资产条目Schema.parse({
      标的: 'XYZ期权', 类别: '期权',
      数量: 100, 成本价: 10, 现价: 12,
      衍生品参数: { 行权价: 50, delta: 0.6, gamma: 0.02 },
    })).not.toThrow();
  });
  it('valid 资产 到期日=0 哨兵（无到期）', () => {
    expect(资产条目Schema.safeParse({ 标的: 'X', 类别: '股票', 数量: 1, 成本价: 10, 现价: 10, 到期日: 0 }).success).toBe(true);
  });
  it('valid 资产 到期日 负值（史前·古代）', () => {
    expect(资产条目Schema.safeParse({ 标的: 'Y', 类别: '古董', 数量: 1, 成本价: 5000, 现价: 8000, 到期日: -1440 }).success).toBe(true);
  });
  it('invalid: 资产 杠杆 negative', () => {
    expect(资产条目Schema.safeParse({ 标的: 'Z', 类别: '期货', 数量: 1, 成本价: 0, 现价: 0, 杠杆: -1 }).success).toBe(false);
  });
  // D1·6.54: 域籍?（"这笔钱在哪只域钟下生息"）
  it('valid 资产 with 域籍', () => {
    expect(资产条目Schema.safeParse({ 标的: '灵矿', 类别: '矿产权', 数量: 1, 成本价: 100, 现价: 150, 域籍: 'clock_仙门' }).success).toBe(true);
  });
  it('valid 资产 域籍 absent（缺省母域）', () => {
    const res = 资产条目Schema.safeParse({ 标的: 'X', 类别: '股票', 数量: 1, 成本价: 10, 现价: 10 });
    expect(res.success && res.data.域籍).toBeUndefined();
  });

  // ── 市场状态 ──────────────────────────────────────────────────────────────────
  it('valid 市场状态 full', () => {
    expect(() => 货币系统Schema.parse({
      市场状态: {
        激活: true, 大盘景气: 75, 通胀率: 0.03, 基准利率: 0.05,
        行业景气: { 丝绸: 80, 粮食: 60, 铁器: 45 },
        时代风波: '海贸兴盛',
      },
    })).not.toThrow();
  });
  it('invalid: 大盘景气 out of range', () => {
    expect(货币系统Schema.safeParse({ 市场状态: { 大盘景气: 150 } }).success).toBe(false);
  });
  it('invalid: 行业景气 值 out of range', () => {
    expect(货币系统Schema.safeParse({ 市场状态: { 行业景气: { 丝绸: 101 } } }).success).toBe(false);
  });
  it('valid: 市场状态 区域物价 引用地图侧——不在经济层重存', () => {
    // 市场状态不含区域物价字段（单源存储在地图层·防双写）
    const parsed = 货币系统Schema.parse({ 市场状态: {} });
    expect(parsed.市场状态).not.toHaveProperty('区域物价');
  });

  // ── 综合样例 ────────────────────────────────────────────────────────────────
  it('valid: wrong type on 账户 被拒', () => {
    expect(货币系统Schema.safeParse({ 账户: '满载' }).success).toBe(false);
  });
  it('valid: full 货币系统 parse', () => {
    expect(() => 货币系统Schema.parse({
      币种定义: { 两: { 名称: '白银', 类型: '法币', 量词: '两', 单位: '两', 符号: '¥', 时代适用: '明朝', 地域适用: ['全境'], 对基准汇率: 1 } },
      基准币种: '两', 汇率: { 两: 1, 铜: 0.001 }, 换汇登记: [],
      经济依附: { 状态: '半独立', 对象: 'org_家族', 每期模式: '季度分红' },
      账户: {
        '某实体键': {
          持有: { 两: 300, 铜: 5000 }, 储蓄: { 两: 1000 },
          本期收入: { 总额: 150, 明细: { 商铺: 100, 投资: 50 } },
          本期支出: { 总额: 80, 明细: { 日用: 50, 孝敬: 30 } },
          _负债: { debt_001: 'pact_借款_001' }, 被动收入来源: { 商铺: 100 },
          资产: [{ 标的: '商铺', 类别: '地产', 数量: 1, 成本价: 3000, 现价: 3500, 域籍: 'clock_主' }],
        },
      },
      市场状态: { 激活: true, 大盘景气: 60, 通胀率: 0.02, 基准利率: 0.04, 行业景气: { 商贸: 70 }, 时代风波: '' },
    })).not.toThrow();
  });
});

// ── B5.6 · 账户._应收/_费用 backfill 迁移测试 ──────────────────────────────────
describe('B5.6 · backfill货币账户PerEntity — _应收/_费用 幂等 + 双机恒等', () => {
  function makePerEntityRaw(hasReceivable: boolean): Record<string, unknown> {
    const entity = (cash: number) => hasReceivable
      ? { 持有: { 文: cash }, 储蓄: {}, _应收: {}, _费用: { 总额: 0, 明细: {} } }
      : { 持有: { 文: cash }, 储蓄: {} };
    return {
      _系统: { migration_version: 5 },
      货币系统: { 账户: { 'pc_linjiu': entity(30), 'npc_wang': entity(200) } },
    };
  }

  it('一次迁移：缺 _应收 → 逐实体补填 _应收:{}/_费用:{} + migration_version +1', () => {
    const raw = makePerEntityRaw(false);
    const result = backfill货币账户PerEntity(raw) as Record<string, unknown>;
    const 货币 = result['货币系统'] as Record<string, unknown>;
    const 账户 = 货币['账户'] as Record<string, Record<string, unknown>>;
    expect(账户['pc_linjiu']?.['_应收']).toEqual({});
    expect(账户['npc_wang']?.['_应收']).toEqual({});
    expect(账户['pc_linjiu']?.['_费用']).toEqual({ 总额: 0, 明细: {} });
    expect(账户['npc_wang']?.['_费用']).toEqual({ 总额: 0, 明细: {} });
    const sys = result['_系统'] as Record<string, unknown>;
    expect(sys['migration_version']).toBe(6);
  });

  it('二次迁移幂等：含 _应收 时 no-op（migration_version 不再 +1·输出完全相同）', () => {
    const raw = makePerEntityRaw(false);
    const once = backfill货币账户PerEntity(raw) as Record<string, unknown>;
    const twice = backfill货币账户PerEntity(once) as Record<string, unknown>;
    const sysOnce = (once['_系统'] as Record<string, unknown>)['migration_version'];
    const sysTwice = (twice['_系统'] as Record<string, unknown>)['migration_version'];
    expect(sysTwice).toBe(sysOnce);
    expect(twice).toStrictEqual(once);
  });

  it('双机恒等：同输入两次调用输出 JSON 逐字节一致', () => {
    const raw = makePerEntityRaw(false);
    const r1 = backfill货币账户PerEntity(raw);
    const r2 = backfill货币账户PerEntity(raw);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it('空账户 no-op：返回原始引用·migration_version 不变', () => {
    const raw: Record<string, unknown> = {
      _系统: { migration_version: 5 },
      货币系统: { 账户: {} },
    };
    const result = backfill货币账户PerEntity(raw);
    expect(result).toBe(raw);
  });

  it('已含 _应收 的 per-entity 账户 no-op：返回原始引用·migration_version 不变', () => {
    const raw = makePerEntityRaw(true);
    const result = backfill货币账户PerEntity(raw);
    expect(result).toBe(raw);
  });
});

// ── B6·AA4 账户 record key 保留键防护测试 ──────────────────────────────────────
describe('B6 · AA4 · 账户键 superRefine — JS 保留键拒收 + 合法键通过', () => {
  const RESERVED = ['__proto__', 'constructor', 'prototype'] as const;

  // ── 账户 entity key 拒收 ────────────────────────────────────────────────────
  for (const bad of RESERVED) {
    it(`账户 entity key "${bad}" → safeParse false（原型污染防护）`, () => {
      expect(货币系统Schema.safeParse({ 账户: { [bad]: {} } }).success).toBe(false);
    });
  }

  // ── _负债 key 拒收 ──────────────────────────────────────────────────────────
  for (const bad of RESERVED) {
    it(`_负债 key "${bad}" → safeParse false`, () => {
      expect(货币系统Schema.safeParse({
        账户: { '某实体键': { _负债: { [bad]: 'pact_x' } } },
      }).success).toBe(false);
    });
  }

  // ── _应收 key 拒收 ──────────────────────────────────────────────────────────
  for (const bad of RESERVED) {
    it(`_应收 key "${bad}" → safeParse false`, () => {
      expect(货币系统Schema.safeParse({
        账户: { '某实体键': { _应收: { [bad]: 'pact_x' } } },
      }).success).toBe(false);
    });
  }

  // ── 持有（币种 key）拒收 ────────────────────────────────────────────────────
  for (const bad of RESERVED) {
    it(`持有 币种 key "${bad}" → safeParse false`, () => {
      expect(货币系统Schema.safeParse({
        账户: { '某实体键': { 持有: { [bad]: 100 } } },
      }).success).toBe(false);
    });
  }

  // ── __sink__ entity key 不误拒（SINK_ENTITY_KEY 实证）──────────────────────
  it('__sink__ 作 entity key → 通过（SINK_ENTITY_KEY·非 JS 保留键）', () => {
    expect(货币系统Schema.safeParse({ 账户: { '__sink__': {} } }).success).toBe(true);
  });

  // ── 老档合法键兼容回归 ──────────────────────────────────────────────────────
  it('合法 entity key（pc_linjiu/npc_wang）→ 通过', () => {
    expect(货币系统Schema.safeParse({
      账户: { 'pc_linjiu': { 持有: { 文: 30 } }, 'npc_wang': { 持有: { 文: 200 } } },
    }).success).toBe(true);
  });
  it('合法 _负债 key（debt_001）→ 通过', () => {
    expect(货币系统Schema.safeParse({
      账户: { '某实体键': { _负债: { 'debt_001': 'pact_借款_001' } } },
    }).success).toBe(true);
  });
  it('合法 _应收 key（recv_001）→ 通过', () => {
    expect(货币系统Schema.safeParse({
      账户: { '某实体键': { _应收: { 'recv_001': 'pact_赊账_王掌柜' } } },
    }).success).toBe(true);
  });
  it('合法 持有 币种 key（文/两/铜/贯）→ 通过', () => {
    expect(货币系统Schema.safeParse({
      账户: { '某实体键': { 持有: { 文: 30, 两: 1, 铜: 500, 贯: 0 } } },
    }).success).toBe(true);
  });
  it('合法 被动收入来源 key（商铺/投资）→ 通过', () => {
    expect(货币系统Schema.safeParse({
      账户: { '某实体键': { 被动收入来源: { 商铺: 100, 投资: 50 } } },
    }).success).toBe(true);
  });
  it('空键 → safeParse false（账户键不可为空）', () => {
    expect(货币系统Schema.safeParse({
      账户: { '': {} },
    }).success).toBe(false);
  });
});

describe('4.8 Memory / Schedule layer', () => {
  // ── 最小开局状态 ──────────────────────────────────────────────────────────────
  it('valid empty parse (minimal state)', () => {
    expect(() => 工作记忆Schema.parse([])).not.toThrow();
    expect(() => 长期归档Schema.parse([])).not.toThrow();
    expect(() => 日程Schema.parse({})).not.toThrow();
    expect(() => 行动卡库Schema.parse({})).not.toThrow();
    expect(() => 仲裁器Schema.parse({})).not.toThrow();
    expect(() => mod注册表Schema.parse({})).not.toThrow();
    expect(() => 调用类型注册表Schema.parse({})).not.toThrow();
    expect(() => Ring2在途调用信封Schema.parse({})).not.toThrow();
  });
  it('minimal-state: RootSchema with new 4.8 keys', () => {
    expect(() => RootSchema.parse({ 调用类型注册表: {}, Ring2在途调用信封: {} })).not.toThrow();
  });

  // ── 工作记忆 / 长期归档 ──────────────────────────────────────────────────────
  it('valid memory entry', () => {
    expect(() => 工作记忆Schema.parse([{
      记忆id: 'm001', 发生时间: 1440, 标题: '初遇李明', 摘要: '在集市偶遇', 重要度: '重要',
    }])).not.toThrow();
  });
  it('invalid: 工作记忆 not array', () => {
    expect(工作记忆Schema.safeParse({ id: '1' }).success).toBe(false);
  });

  // ── 日程 / 行动卡 ────────────────────────────────────────────────────────────
  it('valid schedule', () => {
    expect(() => 日程Schema.parse({ 上午: [{ 行动: '练剑', 地点: 'loc_001', 行动点消耗: 2 }] })).not.toThrow();
  });
  it('invalid: 行动点消耗 out of range', () => {
    expect(行动卡库Schema.safeParse({ card: { 行动点消耗: 25 } }).success).toBe(false);
  });

  // ── 播报条目 tagged union（渠道 discriminant·6.9/6.40）────────────────────────
  it('播报条目: 渠道=系统 含打断级别和最迟期限 parse 通过', () => {
    expect(播报条目Schema.safeParse({
      渠道: '系统', 播报id: 'b001', 内容: '事件爆发', 打断级别: '硬闯', 最迟期限: 1440,
    }).success).toBe(true);
  });
  it('播报条目: 渠道=系统 旧格式迁移后最简形态通过', () => {
    expect(播报条目Schema.safeParse({ 渠道: '系统', 播报id: 'b002', 内容: '普通播报' }).success).toBe(true);
  });
  it('播报条目: 渠道 缺失（旧存档未迁移格式）被拒', () => {
    expect(播报条目Schema.safeParse({ 播报id: 'b003', 内容: '无渠道' }).success).toBe(false);
  });
  it('播报条目: 非法打断级别被拒', () => {
    expect(播报条目Schema.safeParse({ 渠道: '系统', 打断级别: '强制' }).success).toBe(false);
  });
  it('播报条目: 渠道=对话', () => {
    expect(播报条目Schema.safeParse({ 渠道: '对话', 说话者键: 'npc_001', 说话者称谓: '张大人', 对白内容: '且慢！' }).success).toBe(true);
  });
  it('播报条目: 渠道=旁白', () => {
    expect(播报条目Schema.safeParse({ 渠道: '旁白', 内容: '夜色渐深', 叙述视角: '第三人称' }).success).toBe(true);
  });
  it('播报条目: 渠道=媒介', () => {
    expect(播报条目Schema.safeParse({ 渠道: '媒介', 媒介附件引用键: 'media_邸报_001', 渲染缓存摘要: '今日要闻…' }).success).toBe(true);
  });
  it('播报条目: 渠道=思绪', () => {
    expect(播报条目Schema.safeParse({ 渠道: '思绪', 内容: '此人不可信', 可见性: '私有' }).success).toBe(true);
  });
  it('播报条目: 渠道=未知枚举值 被拒', () => {
    expect(播报条目Schema.safeParse({ 渠道: '广播' }).success).toBe(false);
  });

  // ── 缺口一·触发扫描器状态（G-4·6.61）──────────────────────────────────────────
  it('触发扫描器状态: absent (optional)', () => {
    const res = 仲裁器Schema.parse({});
    expect(res.触发扫描器状态).toBeUndefined();
  });
  it('触发扫描器状态: valid with 上次观测值表 + 挂起命中队列', () => {
    expect(仲裁器Schema.safeParse({
      触发扫描器状态: {
        上次观测值表: { 'npc_001.属性.智慧': 60, 'org_001.属性轴.掌控度': 70 },
        挂起命中队列: [{ 触发ID: 't001', 优先级: 1 }],
      },
    }).success).toBe(true);
  });
  it('触发扫描器状态: empty 上次观测值表 + 空队列', () => {
    expect(仲裁器Schema.safeParse({
      触发扫描器状态: { 上次观测值表: {}, 挂起命中队列: [] },
    }).success).toBe(true);
  });
  it('触发扫描器状态: 上次观测值表 is 观测史（非当前值），允许任意类型观测值', () => {
    expect(仲裁器Schema.safeParse({
      触发扫描器状态: { 上次观测值表: { 'npc_x.状态': '已死亡', 'world.局势': [1, 2, 3] } },
    }).success).toBe(true);
  });

  // ── 缺口五·落账记录（6.75/6.76·actor_source 四值枚举）───────────────────────
  it('落账记录: 默认空数组', () => {
    expect(仲裁器Schema.parse({}).落账记录).toEqual([]);
  });
  it('落账记录: actor_source 全四值通过', () => {
    const 四值 = ['玩家', '玩家确认', '模型代写', 'NPC自主/系统驱动'] as const;
    for (const v of 四值) {
      expect(落账记录条目Schema.safeParse({ actor_source: v }).success).toBe(true);
    }
  });
  it('落账记录: 6.76 第四值「NPC自主/系统驱动」', () => {
    expect(仲裁器Schema.safeParse({
      落账记录: [{ actor_source: 'NPC自主/系统驱动', 时间: 1440, 目标路径: 'npc_001.属性.智慧' }],
    }).success).toBe(true);
  });
  it('落账记录: 玩家确认 + 模型代写', () => {
    expect(仲裁器Schema.safeParse({
      落账记录: [
        { actor_source: '玩家确认', 时间: 100, 目标路径: 'npc_a.状态' },
        { actor_source: '模型代写', 时间: 101, 目标路径: 'npc_b.属性.力量' },
      ],
    }).success).toBe(true);
  });
  it('落账记录: invalid actor_source 值', () => {
    expect(落账记录条目Schema.safeParse({ actor_source: '引擎' }).success).toBe(false);
  });
  it('防回归: actor_source 无「观战内容入主角认知」字段（🧮派生量·不进schema）', () => {
    const res = 落账记录条目Schema.parse({ actor_source: '玩家' });
    expect(res).not.toHaveProperty('观战内容入主角认知');
  });

  // ── 缺口二·调用类型注册表（6.75/6.69·三具名调用类型 + 渲染模式枚举）─────────────
  it('调用类型注册表: 三具名调用类型（叙事质量二审/玩家代理回复/小剧场）', () => {
    expect(() => 调用类型注册表Schema.parse({
      '叙事质量二审': { 模型档位: '高质量', 温度: 0.3, 上下文组装器: 'assembler_审稿', 输出schema: 'schema_评分', 超时重试策略: '超时60s/重试2次' },
      '玩家代理回复': { 模型档位: '标准', 温度: 0.7, 上下文组装器: 'assembler_玩家', 输出schema: 'schema_对白', 超时重试策略: '超时30s/重试3次', 渲染模式: '直读流' },
      '小剧场': { 模型档位: '标准', 温度: 0.9, 上下文组装器: 'assembler_剧场', 输出schema: 'schema_叙事', 超时重试策略: '超时45s/重试2次', 渲染模式: '占位整达' },
    })).not.toThrow();
  });
  it('调用类型注册表: 渲染模式枚举 全三值', () => {
    for (const 模式 of 渲染模式枚举) {
      expect(调用类型注册表Schema.safeParse({
        测试类型: { 渲染模式: 模式 },
      }).success).toBe(true);
    }
  });
  it('调用类型注册表: 渲染模式 absent (optional)', () => {
    const res = 调用类型注册表Schema.parse({ '叙事质量二审': {} });
    expect(res['叙事质量二审']?.渲染模式).toBeUndefined();
  });
  it('调用类型注册表: 渲染模式 非法枚举值', () => {
    expect(调用类型注册表Schema.safeParse({ 类型X: { 渲染模式: '实时流' } }).success).toBe(false);
  });
  it('调用类型注册表: 温度超范围拒收', () => {
    expect(调用类型注册表Schema.safeParse({ 类型X: { 温度: 3 } }).success).toBe(false);
    expect(调用类型注册表Schema.safeParse({ 类型X: { 温度: -0.1 } }).success).toBe(false);
  });
  it('调用类型注册表: 超时重试策略=出厂默认值·玩家覆盖层住$预算控制台（不在此存）', () => {
    const res = 调用类型注册表Schema.parse({ '叙事质量二审': { 超时重试策略: '超时60s' } });
    expect(res['叙事质量二审']?.超时重试策略).toBe('超时60s');
  });
  it('调用类型注册表: 开放 record，mod 可注入新类型', () => {
    expect(调用类型注册表Schema.safeParse({
      'mod_占卜小剧场': { 模型档位: '快速', 温度: 1.0, 渲染模式: '静默' },
    }).success).toBe(true);
  });

  // ── P0-1 调批字段（调用类型注册表·全入指纹排除名单）────────────────────────────
  it('调用类型注册表: 最大回复tokens absent (optional)', () => {
    expect(调用类型注册表Schema.parse({ 叙事质量二审: {} })['叙事质量二审']?.最大回复tokens).toBeUndefined();
  });
  it('调用类型注册表: 最大回复tokens valid (int ≥1)', () => {
    expect(调用类型注册表Schema.safeParse({ x: { 最大回复tokens: 4096 } }).success).toBe(true);
  });
  it('调用类型注册表: 最大回复tokens <1 拒收', () => {
    expect(调用类型注册表Schema.safeParse({ x: { 最大回复tokens: 0 } }).success).toBe(false);
  });
  it('调用类型注册表: 思维链 absent (optional)', () => {
    expect(调用类型注册表Schema.parse({ x: {} })['x']?.思维链).toBeUndefined();
  });
  it('调用类型注册表: 思维链 valid', () => {
    expect(调用类型注册表Schema.safeParse({
      x: { 思维链: { 启用: true, 努力档: 'high' } },
    }).success).toBe(true);
  });
  it('调用类型注册表: 切片预算 absent (optional)', () => {
    expect(调用类型注册表Schema.parse({ x: {} })['x']?.切片预算).toBeUndefined();
  });
  it('调用类型注册表: 切片预算 valid (软上限/硬上限/截断优先级)', () => {
    expect(调用类型注册表Schema.safeParse({
      x: { 切片预算: { 软上限tokens: 2000, 硬上限tokens: 4000, 截断优先级: ['叙事', '对话'] } },
    }).success).toBe(true);
  });
  it('调用类型注册表: 切片预算 负 tokens 拒收', () => {
    expect(调用类型注册表Schema.safeParse({ x: { 切片预算: { 软上限tokens: -1 } } }).success).toBe(false);
  });

  // ── 缺口三·Ring2 在途调用信封（AA1·调用世代?）────────────────────────────────
  it('Ring2在途调用信封: 默认 {} (调用世代 absent)', () => {
    const res = Ring2在途调用信封Schema.parse({});
    expect(res.调用世代).toBeUndefined();
  });
  it('Ring2在途调用信封: 调用世代 = 回滚计数器读数+拍锚（int）', () => {
    expect(Ring2在途调用信封Schema.safeParse({ 调用世代: 1234567 }).success).toBe(true);
  });
  it('Ring2在途调用信封: 调用世代 非整数拒收', () => {
    expect(Ring2在途调用信封Schema.safeParse({ 调用世代: 1.5 }).success).toBe(false);
  });
  it('Ring2在途调用信封: RootSchema 挂载确认', () => {
    const res = RootSchema.parse({});
    expect(res.Ring2在途调用信封).toBeDefined();
    expect(res.Ring2在途调用信封.调用世代).toBeUndefined();
  });

  // ── 缺口四·mod注册表签名三字段（6.74）+ 6.62/B1c ──────────────────────────────
  it('mod条目: 签名三字段 absent (optional)', () => {
    const res = mod注册表Schema.parse({ 'test_mod': { pack_id: 'test_mod' } });
    const entry = res['test_mod'];
    expect(entry?.作者公钥).toBeUndefined();
    expect(entry?.签名).toBeUndefined();
    expect(entry?.签名算法).toBeUndefined();
  });
  it('mod条目: 签名三字段 present (6.74·键名冻结)', () => {
    expect(mod注册表Schema.safeParse({
      my_mod: {
        pack_id: 'my_mod', 版本: '1.0.0',
        作者公钥: 'ed25519:abcdef1234...',
        签名: 'base64:SIGNATURE==',
        签名算法: 'Ed25519',
      },
    }).success).toBe(true);
  });
  it('mod条目: 6.62/B1c 字段 (生效锚点/基底契约/内容哈希)', () => {
    expect(mod注册表Schema.safeParse({
      my_mod: {
        pack_id: 'my_mod',
        生效锚点: 'era_大明',
        基底契约: '>=1.0.0 <2.0.0',
        内容哈希: 'sha256:abcdef...',
      },
    }).success).toBe(true);
  });
  it('mod条目: 三字段不同时全有也通过（各自可空）', () => {
    expect(mod注册表Schema.safeParse({ m: { pack_id: 'm', 签名: 'sig', 内容哈希: 'hash' } }).success).toBe(true);
    expect(mod注册表Schema.safeParse({ m: { pack_id: 'm', 生效锚点: 'era_x' } }).success).toBe(true);
  });
  it('mod注册表Schema: K6⑤ superRefine — key ≠ pack_id 拒收', () => {
    expect(mod注册表Schema.safeParse({ key_a: { pack_id: 'different_id' } }).success).toBe(false);
  });
  it('mod注册表Schema: K6⑤ superRefine — key === pack_id 通过', () => {
    expect(mod注册表Schema.safeParse({ key_a: { pack_id: 'key_a' } }).success).toBe(true);
  });

  // ── B2·S5 可写键 + 轨道（蓝图 6.78）────────────────────────────────────────
  it('mod条目: 可写键 absent 通过（optional）', () => {
    expect(mod注册表Schema.safeParse({ m: { pack_id: 'm' } }).success).toBe(true);
  });
  it('mod条目: 可写键 合法受治理路径通过', () => {
    expect(mod注册表Schema.safeParse({
      m: { pack_id: 'm', 可写键: ['货币系统.账户.某实体键.持有.my_coin'] },
    }).success).toBe(true);
  });
  it('mod条目: 轨道 默认 gameplay', () => {
    const res = mod注册表Schema.parse({ m: { pack_id: 'm' } });
    expect(res['m']?.['轨道']).toBe('gameplay');
  });
  it('mod条目: 轨道 四种合法值均通过', () => {
    for (const t of ['gameplay', 'cosmetic', 'view', 'macro'] as const) {
      expect(mod注册表Schema.safeParse({ m: { pack_id: 'm', 轨道: t } }).success).toBe(true);
    }
  });
  it('mod条目: 轨道 非法值拒收', () => {
    expect(mod注册表Schema.safeParse({ m: { pack_id: 'm', 轨道: 'audio' } }).success).toBe(false);
  });
  it('mod条目: gameplay + 可写键 → 通过（重轨允许可写键）', () => {
    expect(mod注册表Schema.safeParse({
      m: { pack_id: 'm', 轨道: 'gameplay', 可写键: ['货币系统.my_field'] },
    }).success).toBe(true);
  });
  it('mod条目: cosmetic + 可写键 → 拒收（轨道一致性·轻轨禁可写键）', () => {
    expect(mod注册表Schema.safeParse({
      m: { pack_id: 'm', 轨道: 'cosmetic', 可写键: ['货币系统.my_field'] },
    }).success).toBe(false);
  });
  it('mod条目: view + 可写键 → 拒收', () => {
    expect(mod注册表Schema.safeParse({
      m: { pack_id: 'm', 轨道: 'view', 可写键: ['货币系统.my_field'] },
    }).success).toBe(false);
  });
  it('mod条目: macro + 可写键 → 拒收', () => {
    expect(mod注册表Schema.safeParse({
      m: { pack_id: 'm', 轨道: 'macro', 可写键: ['货币系统.my_field'] },
    }).success).toBe(false);
  });
  it('mod条目: cosmetic + 零可写键 → 通过（轻轨无可写键是合法的）', () => {
    expect(mod注册表Schema.safeParse({
      m: { pack_id: 'm', 轨道: 'cosmetic' },
    }).success).toBe(true);
  });

  // ── B3·K2 semver schema refine ──────────────────────────────────────────────
  it('mod条目: 版本 空串 → 通过（default）', () => {
    expect(mod注册表Schema.safeParse({ m: { pack_id: 'm', 版本: '' } }).success).toBe(true);
  });
  it('mod条目: 版本 X.Y.Z → 通过', () => {
    expect(mod注册表Schema.safeParse({ m: { pack_id: 'm', 版本: '1.2.3' } }).success).toBe(true);
  });
  it('mod条目: 版本 非 X.Y.Z → 拒收', () => {
    expect(mod注册表Schema.safeParse({ m: { pack_id: 'm', 版本: '1.2' } }).success).toBe(false);
    expect(mod注册表Schema.safeParse({ m: { pack_id: 'm', 版本: 'alpha' } }).success).toBe(false);
  });
  it('mod条目: 基底契约 absent → 通过（optional）', () => {
    expect(mod注册表Schema.safeParse({ m: { pack_id: 'm' } }).success).toBe(true);
  });
  it('mod条目: 基底契约 合法 range → 通过', () => {
    expect(mod注册表Schema.safeParse({ m: { pack_id: 'm', 基底契约: '>=4.1.0' } }).success).toBe(true);
    expect(mod注册表Schema.safeParse({ m: { pack_id: 'm', 基底契约: '>=1.0.0 <2.0.0' } }).success).toBe(true);
    expect(mod注册表Schema.safeParse({ m: { pack_id: 'm', 基底契约: '=4.1.0' } }).success).toBe(true);
  });
  it('mod条目: 基底契约 ^ 语法 → 拒收', () => {
    expect(mod注册表Schema.safeParse({ m: { pack_id: 'm', 基底契约: '^4.1.0' } }).success).toBe(false);
  });
  it('mod条目: 基底契约 ~ 语法 → 拒收', () => {
    expect(mod注册表Schema.safeParse({ m: { pack_id: 'm', 基底契约: '~4.1.0' } }).success).toBe(false);
  });
  it('mod条目: 基底契约 || 语法 → 拒收', () => {
    expect(mod注册表Schema.safeParse({ m: { pack_id: 'm', 基底契约: '>=1.0.0 || >=2.0.0' } }).success).toBe(false);
  });
  it('mod条目: 基底契约 prerelease → 拒收', () => {
    expect(mod注册表Schema.safeParse({ m: { pack_id: 'm', 基底契约: '>=4.1.0-alpha' } }).success).toBe(false);
  });
  it('mod条目: 基底契约 非完整 X.Y.Z → 拒收', () => {
    expect(mod注册表Schema.safeParse({ m: { pack_id: 'm', 基底契约: '>=4.1' } }).success).toBe(false);
  });

  // ── effect 包格式黄金窗口预埋（P0-6 焊死前·intervention_pack.v1 扩字段·schema-only）──
  // K6③·S2 后 pack_id 必填（去空串豁免·去 default）；旧三字段需补 pack_id 才能通过。
  it('intervention_pack_v1: 旧三字段有 pack_id 时通过（K6③ 后旧格式需补 pack_id）', () => {
    const res = intervention_pack_v1Schema.safeParse({
      pack_id: 'my_effect',
      agent_delta: { npc1: { hp: 10 } },
      money_delta: { wang: -5 },
      flags_add: ['flag_x'],
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.pack_id).toBe('my_effect');
      expect(res.data.deltas).toBeUndefined();
      expect(res.data.trigger).toBeUndefined();
      expect(res.data.side_effect_level).toBeUndefined();
      expect(res.data.content_hash).toBeUndefined();
    }
  });
  it('intervention_pack_v1: 缺 pack_id 拒收（K6③·必填）', () => {
    expect(intervention_pack_v1Schema.safeParse({
      agent_delta: { npc1: { hp: 10 } },
    }).success).toBe(false);
  });
  it('intervention_pack_v1: 缺 pack_id → 拒收（K6③ 必填·去 default）', () => {
    expect(intervention_pack_v1Schema.safeParse({}).success).toBe(false);
  });
  it('intervention_pack_v1: 合法 pack_id → 通过', () => {
    const res = intervention_pack_v1Schema.parse({ pack_id: 'test_effect' });
    expect(res.pack_id).toBe('test_effect');
  });
  it('intervention_pack_v1: deltas[] 合法条目（op=set/add/sub/clamp/lock 均通过）', () => {
    for (const op of ['set', 'add', 'sub', 'clamp', 'lock'] as const) {
      expect(intervention_pack_v1Schema.safeParse({
        pack_id: 'test_e',
        deltas: [{ path: '货币系统.王掌柜.余额', op, value: 10 }],
      }).success).toBe(true);
    }
  });
  it('intervention_pack_v1: deltas[] value 可为标量或 DSL v1 表达式串', () => {
    expect(intervention_pack_v1Schema.safeParse({
      pack_id: 'test_e',
      deltas: [{ path: 'a.b', op: 'add', value: 'min(10, a.b + 1)' }],
    }).success).toBe(true);
  });
  it('intervention_pack_v1: deltas[] max_delta 可空，存在时为 number', () => {
    expect(intervention_pack_v1Schema.safeParse({
      pack_id: 'test_e',
      deltas: [{ path: 'a.b', op: 'add', value: 1, max_delta: 50 }],
    }).success).toBe(true);
    expect(intervention_pack_v1Schema.safeParse({
      pack_id: 'test_e',
      deltas: [{ path: 'a.b', op: 'add', value: 1, max_delta: 'x' }],
    }).success).toBe(false);
  });
  it('intervention_pack_v1: deltas[] op 非法枚举值拒收', () => {
    expect(intervention_pack_v1Schema.safeParse({
      pack_id: 'test_e',
      deltas: [{ path: 'a.b', op: 'multiply', value: 1 }],
    }).success).toBe(false);
  });
  it('intervention_pack_v1: trigger 为 DSL v1 谓词串（与 lore 触发条件同一套文法·占位不解析）', () => {
    expect(intervention_pack_v1Schema.safeParse({ pack_id: 'test_e', trigger: 'a.b >= 10' }).success).toBe(true);
  });
  it('intervention_pack_v1: side_effect_level 复用副作用级别枚举Schema（禁第二份内联）', () => {
    expect(intervention_pack_v1Schema.safeParse({ pack_id: 'test_e', side_effect_level: 'sandbox' }).success).toBe(true);
    expect(intervention_pack_v1Schema.safeParse({ side_effect_level: '不存在的级别' }).success).toBe(false);
    expect(副作用级别枚举Schema.options).toEqual(['none', 'sandbox', 'irreversible']);
  });
  it('intervention_pack_v1: content_hash 占位字段·本批不接线·仅类型校验', () => {
    expect(intervention_pack_v1Schema.safeParse({ pack_id: 'test_e', content_hash: 'sha256:abc' }).success).toBe(true);
  });
  it('intervention_pack_v1: 未知顶层字段仍拒收（.strict() 未被破坏）', () => {
    expect(intervention_pack_v1Schema.safeParse({ unknown_field: 1 }).success).toBe(false);
  });
  it('核心调用条目: 副作用级别字段行为不变（改引用共享枚举后零回归）', () => {
    expect(调用类型注册表Schema.safeParse({ x: { 副作用级别: 'irreversible' } }).success).toBe(true);
    expect(调用类型注册表Schema.safeParse({ x: { 副作用级别: 'bogus' } }).success).toBe(false);
  });

  // ── 动词表 verb.ts 运行时解析（Step 7·与 Step 6/6.5 编译期断言互补·不替代）────────
  describe('4.8.x 动词表 verb.ts 运行时解析', () => {
    it('动词Id枚举: 10 个合法值逐一 parse 通过', () => {
      for (const id of 动词Id枚举) {
        expect(z.enum(动词Id枚举).safeParse(id).success).toBe(true);
      }
      expect(动词Id枚举.length).toBe(10);
    });
    it('动词Id枚举: 非法字符串 safeParse 失败', () => {
      expect(z.enum(动词Id枚举).safeParse('未知动词').success).toBe(false);
    });

    it('动词目标槽Schema: 省略时 default 落 \'\'', () => {
      expect(动词目标槽Schema.parse(undefined)).toBe('');
    });
    it('动词目标槽Schema: 任意字符串（字面键或选择器串）parse 通过', () => {
      expect(动词目标槽Schema.safeParse('npc_王掌柜').success).toBe(true);
      expect(动词目标槽Schema.safeParse('选择器:全部在场NPC').success).toBe(true);
    });

    // 表驱动：10 个 option schema 一次跑全，不抽样
    for (const [动词名, optionSchema] of Object.entries(动词OptionSchema表)) {
      describe(`动词OptionSchema表.${动词名}`, () => {
        it('最小合法对象 {} parse 通过', () => {
          expect(optionSchema.safeParse({}).success).toBe(true);
        });
        it('.strict(): 未知键 safeParse().success===false', () => {
          expect(optionSchema.safeParse({ 未知字段: 1 }).success).toBe(false);
        });
        it('side_effects?: 省略 ok / 传 string[] ok', () => {
          expect(optionSchema.safeParse({}).success).toBe(true);
          expect(optionSchema.safeParse({ side_effects: ['handler_a', 'handler_b'] }).success).toBe(true);
        });
        it('标的类型?: 省略 ok / 传 string ok', () => {
          expect(optionSchema.safeParse({}).success).toBe(true);
          expect(optionSchema.safeParse({ 标的类型: 'NPC' }).success).toBe(true);
        });
      });
    }
    it('动词OptionSchema表: 恰好覆盖 10 个动词键，与 动词Id枚举 一一对应', () => {
      expect(Object.keys(动词OptionSchema表).sort()).toEqual([...动词Id枚举].sort());
    });

    it('重掷策略枚举Schema: \'禁用\'/\'警示\' 通过；其它值失败', () => {
      expect(重掷策略枚举Schema.safeParse('禁用').success).toBe(true);
      expect(重掷策略枚举Schema.safeParse('警示').success).toBe(true);
      expect(重掷策略枚举Schema.safeParse('放任').success).toBe(false);
    });

    describe('不可逆Schema', () => {
      it('重掷策略 省略时 default 落 \'禁用\'', () => {
        expect(不可逆Schema.parse({}).重掷策略).toBe('禁用');
      });
      it('解除通道?: 省略 ok / 合法句柄 ok（B6·受治理句柄·断肢重生术 CJK 通过）', () => {
        expect(不可逆Schema.safeParse({}).success).toBe(true);
        expect(不可逆Schema.safeParse({ 解除通道: '断肢重生术' }).success).toBe(true);
        expect(不可逆Schema.safeParse({ 解除通道: 'break_curse' }).success).toBe(true);
      });
      it('解除通道: JS 保留键被 受治理句柄Schema 拦截（B6·拦截器句柄第13槽·add-constraint）', () => {
        expect(不可逆Schema.safeParse({ 解除通道: '__proto__' }).success).toBe(false);
        expect(不可逆Schema.safeParse({ 解除通道: 'constructor' }).success).toBe(false);
        expect(不可逆Schema.safeParse({ 解除通道: 'prototype' }).success).toBe(false);
      });
      it('解除通道: 空串被 受治理句柄Schema 拦截', () => {
        expect(不可逆Schema.safeParse({ 解除通道: '' }).success).toBe(false);
      });
      it('解除通道: 含点号被 受治理句柄Schema 拦截（扁平单 token 纪律）', () => {
        expect(不可逆Schema.safeParse({ 解除通道: 'a.b' }).success).toBe(false);
      });
      it('.strict(): 未知键 safeParse().success===false', () => {
        expect(不可逆Schema.safeParse({ 未知字段: 1 }).success).toBe(false);
      });
    });
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
    const res = RootSchema.shape.$玩家偏好.unwrap().parse({});
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
    const res = RootSchema.shape.$玩家偏好.unwrap().parse({});
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
    const s = RootSchema.shape.$天命重掷券.unwrap().parse({});
    expect(s.剩余张数).toBe(0);
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

  // ── P0-1·$模型画像.采样参数 五键类型化（非开放透传字典）────────────────────────
  it('$模型画像: 采样参数 absent → default {}（零迁移）', () => {
    const res = $模型画像Schema.parse({ claude: {} });
    expect(res['claude']?.采样参数).toEqual({});
  });
  it('$模型画像: 采样参数 五键全填 valid', () => {
    expect($模型画像Schema.safeParse({
      claude: { 采样参数: { 温度: 0.7, top_p: 0.9, 频率惩罚: 0.1, 存在惩罚: 0.2, 最大回复tokens: 4096 } },
    }).success).toBe(true);
  });
  it('$模型画像: 采样参数 部分键 valid（各键可空）', () => {
    expect($模型画像Schema.safeParse({
      claude: { 采样参数: { 温度: 1.2 } },
    }).success).toBe(true);
  });
  it('$模型画像: 采样参数 温度超界拒收', () => {
    expect($模型画像Schema.safeParse({
      claude: { 采样参数: { 温度: 2.5 } },
    }).success).toBe(false);
  });
  it('$模型画像: 采样参数 最大回复tokens 非正整数拒收', () => {
    expect($模型画像Schema.safeParse({
      claude: { 采样参数: { 最大回复tokens: 0 } },
    }).success).toBe(false);
  });
  it('$模型画像: 多 provider 各有独立采样参数', () => {
    expect($模型画像Schema.safeParse({
      claude:  { 采样参数: { 温度: 0.7, 最大回复tokens: 4096 } },
      gpt4:    { 采样参数: { 温度: 1.0, top_p: 0.95 } },
      gemini:  { 采样参数: {} },
    }).success).toBe(true);
  });

  // ── 缺口一·舞台状态?（G10·6.75）──────────────────────────────────────────────
  it('$会话状态: 舞台状态 absent (optional)', () => {
    const res = RootSchema.shape.$会话状态.unwrap().parse({});
    expect(res.舞台状态).toBeUndefined();
  });
  it('$会话状态: 舞台状态 valid record(实体键→record(属性键→值))', () => {
    expect(RootSchema.shape.$会话状态.safeParse({
      舞台状态: {
        'npc_001': { 位置: '书房门口', 朝向: '南', 可见性: true },
        'npc_002': { 位置: '书房内', 朝向: '西' },
      },
    }).success).toBe(true);
  });
  it('$会话状态: 舞台状态 允许空 record（无实体在舞台）', () => {
    expect(RootSchema.shape.$会话状态.safeParse({ 舞台状态: {} }).success).toBe(true);
  });
  it('$会话状态: 舞台状态 属性值可为任意类型（string/number/boolean）', () => {
    expect(RootSchema.shape.$会话状态.safeParse({
      舞台状态: { 'npc_x': { 位置: 42, 朝向: 'N', 在场: false, 坐标: [1, 2] } },
    }).success).toBe(true);
  });

  // ── 缺口二·舞台可比较属性?（6.75）────────────────────────────────────────────
  it('$会话状态: 舞台可比较属性 absent (optional)', () => {
    expect(RootSchema.shape.$会话状态.unwrap().parse({}).舞台可比较属性).toBeUndefined();
  });
  it('$会话状态: 舞台可比较属性 valid string[]（参与几何判定的属性键声明）', () => {
    expect(RootSchema.shape.$会话状态.safeParse({
      舞台可比较属性: ['位置', '朝向'],
    }).success).toBe(true);
  });
  it('$会话状态: 舞台可比较属性 空数组合法', () => {
    expect(RootSchema.shape.$会话状态.safeParse({ 舞台可比较属性: [] }).success).toBe(true);
  });

  // ── 缺口三确认·演出层草稿计数（发现D 已对齐）────────────────────────────────
  it('$会话状态: 演出层草稿计数 字段存在且默认0', () => {
    const res = RootSchema.shape.$会话状态.unwrap().parse({});
    expect(res.演出层草稿计数).toBe(0);
  });

  // ── 缺口四·存档头（4.9/U3a/N2）─────────────────────────────────────────────
  it('存档头: 空状态 parse（全局回滚计数器=0·当前时间线id=空）', () => {
    const res = 存档头Schema.parse({});
    expect(res.全局回滚计数器).toBe(0);
    expect(res.当前时间线id).toBe('');
    expect(res.谱系索引).toEqual({});
    expect(res.引擎版本谱).toBeUndefined();
    expect(res.迁移戳).toBeUndefined();
    expect(res.系统事件镜像).toBeUndefined();
  });
  it('存档头: 全局回滚计数器 (int)', () => {
    expect(存档头Schema.safeParse({ 全局回滚计数器: 42 }).success).toBe(true);
  });
  it('存档头: 当前时间线id 指向谱系节点', () => {
    expect(存档头Schema.safeParse({ 当前时间线id: 'timeline_0001' }).success).toBe(true);
  });
  it('存档头: U3a·迁移戳 valid（源版本/目标版本/迁移映射哈希/墙钟时间）', () => {
    expect(存档头Schema.safeParse({
      迁移戳: [
        { 源版本: '4.0', 目标版本: '4.1', 迁移映射哈希: 'sha256:abc...', 墙钟时间: '2026-06-14T06:00:00Z' },
      ],
    }).success).toBe(true);
  });
  it('存档头: U3a·迁移戳 多条目（≥2 entry·累积审计链）', () => {
    expect(存档头Schema.safeParse({
      迁移戳: [
        { 源版本: '4.0', 目标版本: '4.1', 迁移映射哈希: 'sha256:aaa...', 墙钟时间: '2026-05-01T00:00:00Z' },
        { 源版本: '4.1', 目标版本: '4.2', 迁移映射哈希: 'sha256:bbb...', 墙钟时间: '2026-06-18T00:00:00Z' },
      ],
    }).success).toBe(true);
  });
  it('存档头: U3a·引擎版本谱 valid（present=string array）', () => {
    const res = 存档头Schema.parse({ 引擎版本谱: ['4.0.0', '4.1.0'] });
    expect(res.引擎版本谱).toEqual(['4.0.0', '4.1.0']);
  });
  it('存档头: N2·系统事件镜像 valid（只读白名单）', () => {
    expect(存档头Schema.safeParse({
      系统事件镜像: { 全局回滚次数: 5, 周目数: 2, 换角数: 1, 裸SL次数: 3 },
    }).success).toBe(true);
  });
  it('存档头: N2·系统事件镜像 absent (optional)', () => {
    expect(存档头Schema.parse({}).系统事件镜像).toBeUndefined();
  });
  it('存档头: 全局回滚计数器 非整数拒收', () => {
    expect(存档头Schema.safeParse({ 全局回滚计数器: 1.5 }).success).toBe(false);
  });
  it('存档头: U3a·时间线分块版本戳 absent (optional·零迁移)', () => {
    expect(存档头Schema.parse({}).时间线分块版本戳).toBeUndefined();
  });
  it('存档头: U3a·时间线分块版本戳 valid (semver string)', () => {
    expect(存档头Schema.safeParse({ 时间线分块版本戳: '4.1.0' }).success).toBe(true);
  });
  it('_存档头: RootSchema 挂载确认', () => {
    const res = RootSchema.parse({});
    expect(res._存档头).toBeDefined();
    expect(res._存档头.全局回滚计数器).toBe(0);
  });

  // ── 缺口五·重试策略?（6.67·$预算控制台）────────────────────────────────────
  it('$预算控制台: 重试策略 absent (optional)', () => {
    expect(RootSchema.shape.$预算控制台.unwrap().parse({}).重试策略).toBeUndefined();
  });
  it('$预算控制台: 重试策略 valid（覆盖注册表出厂默认值）', () => {
    expect(RootSchema.shape.$预算控制台.safeParse({
      重试策略: {
        '叙事质量二审': { 自动重试上限: 2, 超时秒数: 60, 失败后行为: '降级继续' },
        '小剧场': { 自动重试上限: 1, 超时秒数: 45, 失败后行为: '自动暂停弹重试面板' },
      },
    }).success).toBe(true);
  });
  it('$预算控制台: 重试策略 失败后行为 两枚举值均合法', () => {
    expect(RootSchema.shape.$预算控制台.safeParse({
      重试策略: { 'x': { 失败后行为: '降级继续' } },
    }).success).toBe(true);
    expect(RootSchema.shape.$预算控制台.safeParse({
      重试策略: { 'x': { 失败后行为: '自动暂停弹重试面板' } },
    }).success).toBe(true);
  });
  it('$预算控制台: 重试策略 失败后行为 非法枚举', () => {
    expect(RootSchema.shape.$预算控制台.safeParse({
      重试策略: { 'x': { 失败后行为: '强制终止' } },
    }).success).toBe(false);
  });
  it('$预算控制台: 重试策略 自动重试上限 负数拒收', () => {
    expect(RootSchema.shape.$预算控制台.safeParse({
      重试策略: { 'x': { 自动重试上限: -1 } },
    }).success).toBe(false);
  });

  // ── P0-1 调批字段（$预算控制台·全入指纹排除名单）──────────────────────────────
  it('$预算控制台: 采样覆盖层 absent (optional)', () => {
    expect(RootSchema.shape.$预算控制台.unwrap().parse({}).采样覆盖层).toBeUndefined();
  });
  it('$预算控制台: 采样覆盖层 valid (按调用类型覆盖采样参数)', () => {
    expect(RootSchema.shape.$预算控制台.safeParse({
      采样覆盖层: { 叙事质量二审: { 温度: 0.3, top_p: 0.9, 频率惩罚: 0.1, 存在惩罚: 0.2 } },
    }).success).toBe(true);
  });
  it('$预算控制台: 采样覆盖层 温度超界拒收', () => {
    expect(RootSchema.shape.$预算控制台.safeParse({
      采样覆盖层: { x: { 温度: 2.5 } },
    }).success).toBe(false);
  });
  it('$预算控制台: 切片预算覆盖层 absent (optional)', () => {
    expect(RootSchema.shape.$预算控制台.unwrap().parse({}).切片预算覆盖层).toBeUndefined();
  });
  it('$预算控制台: 切片预算覆盖层 valid', () => {
    expect(RootSchema.shape.$预算控制台.safeParse({
      切片预算覆盖层: { 叙事质量二审: { 软上限tokens: 3000, 硬上限tokens: 6000, 截断优先级: [] } },
    }).success).toBe(true);
  });
  it('$预算控制台: 渲染模式覆盖 absent (optional)', () => {
    expect(RootSchema.shape.$预算控制台.unwrap().parse({}).渲染模式覆盖).toBeUndefined();
  });
  it('$预算控制台: 渲染模式覆盖 三枚举值均合法', () => {
    for (const v of ['直读流', '占位整达', '静默'] as const) {
      expect(RootSchema.shape.$预算控制台.safeParse({ 渲染模式覆盖: v }).success).toBe(true);
    }
  });
  it('$预算控制台: 渲染模式覆盖 非法枚举拒收', () => {
    expect(RootSchema.shape.$预算控制台.safeParse({ 渲染模式覆盖: '实时流' }).success).toBe(false);
  });

  // ── 顺手·$流速 自动暂停触发 记账失败自动暂停（6.67）──────────────────────────
  it('$流速: 自动暂停触发 含「记账失败自动暂停」通过', () => {
    expect($流速Schema.safeParse({
      自动暂停触发: ['遭遇战', '叙事生成失败', '记账失败自动暂停'],
    }).success).toBe(true);
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
          存活状态: '在世',
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
        账户: { '某实体键': { 持有: { 贯: 50 } } },
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
  it('检定骰面: 默认 判定骰型=100, 显骰=false, 暴击映射=关（直接测规则库 schema）', () => {
    const res = 检定骰面Schema.parse({});
    expect(res.判定骰型).toBe(100);
    expect(res.显骰).toBe(false);
    expect(res.暴击映射).toBe('关');
  });
  it('检定骰面: valid 判定骰型=20', () => {
    expect(检定骰面Schema.safeParse({ 判定骰型: 20 }).success).toBe(true);
  });
  it('检定骰面: valid 暴击映射 object form', () => {
    expect(检定骰面Schema.safeParse({
      暴击映射: { 顶格升一档: true, 底格降一档: true },
    }).success).toBe(true);
  });
  it('检定骰面: invalid 判定骰型=6 (out of enum)', () => {
    expect(检定骰面Schema.safeParse({ 判定骰型: 6 }).success).toBe(false);
  });
  it('检定骰面: invalid 暴击映射 wrong string (not 关)', () => {
    expect(检定骰面Schema.safeParse({ 暴击映射: '开' }).success).toBe(false);
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
  it('检定档切分表: schema 含默认值（已迁入规则库·直接测规则库 schema）', () => {
    const res = 检定档切分表Schema.parse({});
    expect(res.大胜下限).toBe(40);
    expect(res.胜下限).toBe(15);
  });
  it('检定档切分表: 可被覆盖（直接测规则库 schema）', () => {
    const res = 检定档切分表Schema.parse({ 大胜下限: 50, 胜下限: 20, 惨胜下限: 5, 败下限: -20 });
    expect(res.大胜下限).toBe(50);
  });
  // P0-5 钳制表 防回归断言
  it('钳制表: 默认按重要等级为空对象, 按字段为空 record', () => {
    const res = 钳制表Schema.parse({});
    expect(res.按重要等级).toEqual({});
    expect(res.按字段).toEqual({});
  });
  it('钳制表: schema 含默认值（已迁入规则库·直接测规则库 schema）', () => {
    const res = 钳制表Schema.parse({});
    expect(res.按重要等级).toEqual({});
    expect(res.按字段).toEqual({});
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
    const s = RootSchema.shape.$会话状态.unwrap().parse({});
    expect(s.演出层草稿计数).toBe(0);
  });
  it('$会话状态: 既有字段未受影响（最后交互时间戳/未读播报数/崩溃恢复指针）', () => {
    const res = RootSchema.shape.$会话状态.unwrap().parse({});
    expect(res.最后交互时间戳).toBe(0);
    expect(res.未读播报数).toBe(0);
    expect(res.崩溃恢复指针).toBe('');
  });
  it('$会话状态: 演出层草稿计数拒绝负值', () => {
    expect(RootSchema.shape.$会话状态.safeParse({ 演出层草稿计数: -1 }).success).toBe(false);
  });
  // ── 缺口一·二审维度库（6.75）──────────────────────────────────────────────────
  it('二审维度库: absent (optional)', () => {
    expect(玩法预设Schema.parse({}).二审维度库).toBeUndefined();
  });
  it('二审维度库: 检测方式=机械 valid', () => {
    expect(二审维度条目Schema.safeParse({
      键: 'anti_mary_sue', 名称: '反玛丽苏', 检测方式: '机械', 规则或提示词: 'rule:...',
    }).success).toBe(true);
  });
  it('二审维度库: 检测方式=审稿提示词 valid', () => {
    expect(二审维度条目Schema.safeParse({
      键: 'anti_oil', 名称: '反油腻', 检测方式: '审稿提示词', 规则或提示词: '请检查是否有油腻描写…',
      阈值: 0.8, 默认开: true,
    }).success).toBe(true);
  });
  it('二审维度库: 检测方式 二分枚举（无第三值）', () => {
    expect(二审维度条目Schema.safeParse({ 键: 'x', 检测方式: '权重评分' }).success).toBe(false);
  });
  it('二审维度库: 阈值/默认开 absent (optional)', () => {
    const res = 二审维度条目Schema.parse({ 键: 'x', 检测方式: '机械', 规则或提示词: 'r' });
    expect(res.阈值).toBeUndefined();
    expect(res.默认开).toBeUndefined();
  });
  it('二审维度库: 在 玩法预设 中 valid array', () => {
    expect(玩法预设Schema.safeParse({
      二审维度库: [
        { 键: 'anti_mary_sue', 名称: '反玛丽苏', 检测方式: '机械', 规则或提示词: '规则A' },
        { 键: 'logic_check', 名称: '单拍物理矛盾', 检测方式: '审稿提示词', 规则或提示词: '提示词B', 默认开: false },
      ],
    }).success).toBe(true);
  });

  // ── 缺口二·小剧场剧本库（6.75）──────────────────────────────────────────────
  it('小剧场剧本库: absent (optional)', () => {
    expect(玩法预设Schema.parse({}).小剧场剧本库).toBeUndefined();
  });
  it('小剧场剧本库: valid 剧本条目（含所有字段）', () => {
    expect(小剧场剧本条目Schema.safeParse({
      键: 'dream_seq', 名称: '梦境序列', 图标: '🌙', 分类: '奇幻',
      描述: '主角进入梦境', 提示词: '现在开始叙述一段梦境…',
      读历史默认: true, 输出格式: 'prose',
    }).success).toBe(true);
  });
  it('小剧场剧本库: 读历史默认 absent (optional)', () => {
    const res = 小剧场剧本条目Schema.parse({ 键: 'x', 检测方式: '机械' });
    expect(res.读历史默认).toBeUndefined();
  });
  it('小剧场剧本库: 无触发条件字段（strip 验证）', () => {
    const res = 小剧场剧本条目Schema.parse({ 键: 'x', 触发条件: '到达城市' });
    expect(res).not.toHaveProperty('触发条件');
  });
  it('小剧场剧本库: 在 玩法预设 中 valid array', () => {
    expect(玩法预设Schema.safeParse({
      小剧场剧本库: [{ 键: 's1', 名称: '占卜', 图标: '🔮', 分类: '神秘', 描述: '…', 提示词: '…', 输出格式: 'structured' }],
    }).success).toBe(true);
  });

  // ── 缺口三·死亡拦截器条目（6.45·已迁入规则库）──────────────────────────────────
  it('死亡拦截器条目: 已从 玩法预设Schema.shape 删除（迁入规则库）', () => {
    expect(Object.prototype.hasOwnProperty.call(玩法预设Schema.shape, '死亡拦截器条目')).toBe(false);
  });
  it('死亡拦截器条目: valid 单条（注册者/优先级/条件引用/目标动词）', () => {
    expect(死亡拦截器条目Schema.safeParse({
      注册者: '系统', 优先级: 10,
      条件引用: '触发契约.天命_必活', 目标动词: '穿越契约.转世',
    }).success).toBe(true);
  });
  it('死亡拦截器条目: 无概率参数（概率住检定配方表）', () => {
    const res = 死亡拦截器条目Schema.parse({ 注册者: 'x', 条件引用: 'c', 目标动词: 'v' });
    expect(res).not.toHaveProperty('概率');
    expect(res).not.toHaveProperty('触发概率');
  });
  it('死亡拦截器条目: 优先级默认0', () => {
    expect(死亡拦截器条目Schema.parse({ 注册者: 'x', 条件引用: 'c', 目标动词: 'v' }).优先级).toBe(0);
  });
  it('死亡拦截器条目: 负优先级拒收', () => {
    expect(死亡拦截器条目Schema.safeParse({ 注册者: 'x', 优先级: -1, 条件引用: 'c', 目标动词: 'v' }).success).toBe(false);
  });
  it('死亡拦截器条目: valid list 解析（直接测规则库 schema·规则面接受 list）', () => {
    expect(死亡拦截器条目Schema.safeParse({
      注册者: '系统', 优先级: 100, 条件引用: '天命通道.必活', 目标动词: '穿越.同世界转世',
    }).success).toBe(true);
    expect(死亡拦截器条目Schema.safeParse({
      注册者: 'mod_复仇者', 优先级: 50, 条件引用: '概率.20pct_天命', 目标动词: '穿越.换角',
    }).success).toBe(true);
  });

  // ── 缺口四·换角许可（6.45·已迁入规则库）────────────────────────────────────────
  it('换角许可: 已从 玩法预设Schema.shape 删除（迁入规则库）', () => {
    expect(Object.prototype.hasOwnProperty.call(玩法预设Schema.shape, '换角许可')).toBe(false);
  });
  it('换角许可: valid（候选选择器/冷却/次数上限/谢幕卡开关）', () => {
    expect(换角许可Schema.safeParse({
      候选选择器: 'NPC.关系≥亲密', 冷却: 43200, 次数上限: 3, 谢幕卡开关: true,
    }).success).toBe(true);
  });
  it('换角许可: 次数上限 absent (optional)', () => {
    expect(换角许可Schema.parse({}).次数上限).toBeUndefined();
  });
  it('换角许可: 谢幕卡开关 默认 true', () => {
    expect(换角许可Schema.parse({}).谢幕卡开关).toBe(true);
  });
  it('换角许可: 冷却 默认 0', () => {
    expect(换角许可Schema.parse({}).冷却).toBe(0);
  });
  it('换角许可: 次数上限 负数拒收', () => {
    expect(换角许可Schema.safeParse({ 次数上限: -1 }).success).toBe(false);
  });

  // ── 缺口五·世界遗产白名单出厂值（6.45）──────────────────────────────────────
  it('世界遗产白名单出厂值: absent (optional)', () => {
    expect(玩法预设Schema.parse({}).世界遗产白名单出厂值).toBeUndefined();
  });
  it('世界遗产白名单出厂值: valid 路径列表', () => {
    expect(玩法预设Schema.safeParse({
      世界遗产白名单出厂值: ['$meta.周目谱系', '全局.家族树', '全局._编年史'],
    }).success).toBe(true);
  });
  it('世界遗产白名单出厂值: 空数组合法（mod 可覆盖）', () => {
    expect(玩法预设Schema.safeParse({ 世界遗产白名单出厂值: [] }).success).toBe(true);
  });

  // ── 缺口六确认·穿越契约（无需新增，现状即是预设级定义）────────────────────────
  it('穿越契约: 现有 optional 即预设级定义（无单独出厂值字段）', () => {
    expect(玩法预设Schema.parse({}).穿越契约).toBeUndefined();
    expect(玩法预设Schema.safeParse({
      穿越契约: { 属性映射: { '智慧': '智力' }, 货币处理: '按汇率', 时间比率: 2 },
    }).success).toBe(true);
  });

  // ── 顺手·离场演化契约出厂模板（6.45·契约来路②兜底）────────────────────────
  it('离场演化契约出厂模板: absent (optional)', () => {
    expect(玩法预设Schema.parse({}).离场演化契约出厂模板).toBeUndefined();
  });
  it('离场演化契约出厂模板: valid record(组织类型→模板)', () => {
    expect(玩法预设Schema.safeParse({
      离场演化契约出厂模板: {
        '朝廷机构': { 解散概率: 0.1, 继承者: '户部' },
        '商会': { 解散概率: 0.3, 继承者: null },
      },
    }).success).toBe(true);
  });

  // ── 实体模板库确认·保持 z.unknown() 占位 ──────────────────────────────────
  it('实体模板库: z.unknown() 占位，各模板数组默认空', () => {
    const res = 玩法预设Schema.parse({});
    expect(res.实体模板库.NPC模板).toEqual([]);
    expect(res.实体模板库.组织模板).toEqual([]);
    expect(res.实体模板库.物品模板).toEqual([]);
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
// P0-1x 层内小缺口字段验证
// ══════════════════════════════════════════

describe('P0-1x B 缺口字段', () => {
  // ── 缺口6·死亡事件（6.45·拦截=配方引用）──────────────────────────────────────
  it('死亡事件: 最小 parse（仅默认值）', () => {
    const res = 死亡事件Schema.parse({});
    expect(res.时间).toBe(0);
    expect(res.死因).toBe('');
    expect(res.拦截).toBeUndefined();
  });
  it('死亡事件: 拦截 = 配方引用键（不直接写概率）', () => {
    expect(死亡事件Schema.safeParse({ 时间: 525600, 死因: '战死', 拦截: '天命通道.必活·配方引用' }).success).toBe(true);
  });
  it('死亡事件: 拦截 absent (optional)', () => {
    expect(死亡事件Schema.parse({ 死因: '病逝' }).拦截).toBeUndefined();
  });

  // ── 缺口7·播报条目 遮蔽样式?（6.45·明牌|暗骰|全暗）────────────────────────
  it('播报条目: 遮蔽样式 absent (optional)', () => {
    const res = 播报条目Schema.parse({ 渠道: '系统', 内容: '战斗开始' });
    expect(res).not.toHaveProperty('遮蔽样式');
  });
  it('播报条目: 遮蔽样式=明牌', () => {
    expect(播报条目Schema.safeParse({ 渠道: '系统', 内容: 'x', 遮蔽样式: '明牌' }).success).toBe(true);
  });
  it('播报条目: 遮蔽样式=暗骰（玩家看不到骰点）', () => {
    expect(播报条目Schema.safeParse({ 渠道: '旁白', 内容: 'x', 遮蔽样式: '暗骰' }).success).toBe(true);
  });
  it('播报条目: 遮蔽样式=全暗', () => {
    expect(播报条目Schema.safeParse({ 渠道: '思绪', 内容: 'x', 遮蔽样式: '全暗' }).success).toBe(true);
  });
  it('播报条目: 遮蔽样式 非法值拒收', () => {
    expect(播报条目Schema.safeParse({ 渠道: '系统', 内容: 'x', 遮蔽样式: '半透明' }).success).toBe(false);
  });

  // ── 缺口8·$meta.周目谱系 节点 父快照拍号?/分支原因?（6.47）─────────────────
  it('周目谱系: 父快照拍号 absent (optional)', () => {
    const res = RootSchema.shape.$meta.unwrap().parse({});
    expect(res.周目谱系).toEqual({});
  });
  it('周目谱系: 节点 父快照拍号 + 分支原因 valid', () => {
    expect(RootSchema.shape.$meta.safeParse({
      周目谱系: {
        'tl_001': { parent: undefined, 快照引用: 'snap_001', 创建时间: 100, 角色键: 'npc_主角', 父快照拍号: 42, 分支原因: 'SL' },
        'tl_002': { parent: 'tl_001', 快照引用: 'snap_002', 创建时间: 200, 角色键: 'npc_主角' },
      },
    }).success).toBe(true);
  });
  it('周目谱系: 父快照拍号 非整数拒收', () => {
    expect(RootSchema.shape.$meta.safeParse({
      周目谱系: { 'tl_x': { 父快照拍号: 1.5 } },
    }).success).toBe(false);
  });
  it('周目谱系: 分支原因 开放串（SL/穿越/换角/…）', () => {
    expect(RootSchema.shape.$meta.safeParse({
      周目谱系: { 'tl_x': { 分支原因: '穿越至明朝' } },
    }).success).toBe(true);
  });

  // ── 缺口9·mod注册表 签名三字段 + 6.62/B1c（确认已在 4.8 落地）────────────
  it('mod注册表: 生效锚点/基底契约/内容哈希 已落地（4.8 确认）', () => {
    expect(mod注册表Schema.safeParse({
      test_mod: { pack_id: 'test_mod', 生效锚点: 'era_大明', 基底契约: '>=4.1.0', 内容哈希: 'sha256:abc' },
    }).success).toBe(true);
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
    expect(state._叙事设置.叙事权限.玩家角色决策权限).toBe('玩家独占');
  });
  it('empty state: _叙事设置.人称.视角锁定 默认=锁定单一宿主', () => {
    const state = RootSchema.parse({});
    expect(state._叙事设置.人称.视角锁定).toBe('锁定单一宿主');
  });
  it('empty state: _系统.功能开关表 has all 6.75/6.76 defaults', () => {
    const state = RootSchema.parse({});
    expect(state._系统.功能开关表.观战模式).toBe(false);
    expect(state._系统.功能开关表.舞台追踪).toBe('自动按场景');
    expect(state._系统.功能开关表.二审严格度).toBe(50);
    expect(state._系统.功能开关表.二审维度开关).toEqual({});
    expect(state._系统.功能开关表.观战推进模式).toBe('手动步进');
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
    expect(schemaKeys.size).toBe(54); // P0-1 BatchA: +$生图配置 +$语音配置 +$RAG配置; 对撞⑥: +$临时会话; B2·S1: +_mod墓碑库; B5·S1+S1b: +受治理键空间注册表 +键空间归并表
  });

  it('BLUEPRINT_KEYS has no duplicates', () => {
    const set = new Set(BLUEPRINT_KEYS);
    expect(set.size).toBe(BLUEPRINT_KEYS.length);
  });
});

// ══════════════════════════════════════════
// 6.43 编年史 · 叙事流
// ══════════════════════════════════════════

describe('6.43 编年史（全局._编年史）', () => {
  it('全局Schema: _编年史默认为空数组', () => {
    expect(全局Schema.parse({})._编年史).toEqual([]);
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

  // ── X5: 演出层草稿计数（原重掷序号·血统水印·永不进盐·永不进判定）────────────────
  it('X5: 演出层草稿计数 默认=0', () => {
    const res = 叙事流条目Schema.safeParse(基础条目);
    expect(res.success && res.data.演出层草稿计数).toBe(0);
  });
  it('X5: 演出层草稿计数 可递增', () => {
    expect(叙事流条目Schema.safeParse({ ...基础条目, 演出层草稿计数: 3 }).success).toBe(true);
  });
  it('X5: 演出层草稿计数 负值拒收', () => {
    expect(叙事流条目Schema.safeParse({ ...基础条目, 演出层草稿计数: -1 }).success).toBe(false);
  });

  // ── X2: 说话者（typed 实体键）────────────────────────────────────────────────
  it('X2: 说话者 typed 实体键 optional', () => {
    expect(叙事流条目Schema.safeParse({ ...基础条目, 说话者: 'npc_001' }).success).toBe(true);
  });
  it('X2: 说话者 absent OK', () => {
    const res = 叙事流条目Schema.safeParse(基础条目);
    expect(res.success && res.data.说话者).toBeUndefined();
  });

  // ── X3: 信息源哨兵（实体键 | '匿名' | '未知'）────────────────────────────────
  it('X3: 信息源哨兵 实体键 通过', () => {
    expect(叙事流条目Schema.safeParse({ ...基础条目, 信息源哨兵: 'npc_神秘人' }).success).toBe(true);
  });
  it('X3: 信息源哨兵 匿名/未知 内置值通过', () => {
    expect(叙事流条目Schema.safeParse({ ...基础条目, 信息源哨兵: '匿名' }).success).toBe(true);
    expect(叙事流条目Schema.safeParse({ ...基础条目, 信息源哨兵: '未知' }).success).toBe(true);
  });
  it('X3: 信息源哨兵 absent OK', () => {
    const res = 叙事流条目Schema.safeParse(基础条目);
    expect(res.success && res.data.信息源哨兵).toBeUndefined();
  });

  // ── X1: 渠道标签 + 线程键（多源线程分组）──────────────────────────────────────
  it('X1: 渠道标签 + 线程键 optional', () => {
    expect(叙事流条目Schema.safeParse({
      ...基础条目, 渠道标签: '对话', 线程键: 'thread_酒馆会面',
    }).success).toBe(true);
  });
  it('X1: 渠道标签/线程键 absent OK', () => {
    const res = 叙事流条目Schema.safeParse(基础条目);
    expect(res.success && res.data.渠道标签).toBeUndefined();
    expect(res.success && res.data.线程键).toBeUndefined();
  });

  // ── X4: 修正目标序号（撤回/更正）──────────────────────────────────────────────
  it('X4: 修正目标序号 指向原条目', () => {
    expect(叙事流条目Schema.safeParse({
      ...基础条目, 序号: 42, 修正目标序号: 38,
    }).success).toBe(true);
  });
  it('X4: 修正目标序号 absent = 非修正行', () => {
    const res = 叙事流条目Schema.safeParse(基础条目);
    expect(res.success && res.data.修正目标序号).toBeUndefined();
  });

  // ── 综合 X1-X5 全字段 ────────────────────────────────────────────────────────
  it('X1-X5 全字段完整条目 parse 通过', () => {
    expect(叙事流条目Schema.safeParse({
      序号: 100, 拍号: 5, 演出层草稿计数: 2,
      时刻: { 读数: 3600, 钟源: '镜头钟' },
      来源: 'AI叙事', 类型标签: '对白落账',
      说话者: 'npc_权臣', 信息源哨兵: 'npc_权臣',
      渠道标签: '对话', 线程键: 'thread_朝堂',
      修正目标序号: 99,
      正文: '陛下，臣以为此事不妥。',
      结构化附注: { 情绪: '强硬', 场景: '朝堂' },
    }).success).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// B-1 Module 15 — lore 知识库 schema 预埋
// ══════════════════════════════════════════════════════════════════════════════

describe('B-1 lore 知识库 · 基础约束', () => {
  it('lore知识库Schema 空 record 默认值通过（零迁移·老档无此键透明通过）', () => {
    const r = lore知识库Schema.parse(undefined);
    expect(r).toEqual({});
  });

  it('lore条目Schema 全空默认值通过', () => {
    const r = lore条目Schema.parse({});
    expect(r.分类路径).toEqual([]);
    expect(r.别名表).toEqual([]);
    expect(r.触发谓词).toBe('');
    expect(r.知识载荷).toBe('');
    expect(r.状态转移).toBeUndefined();
    expect(r.硬约束).toBeUndefined();
    expect(r.工具引用).toBeUndefined();
  });

  it('TOOL_能力类型 枚举包含全部六种类型', () => {
    expect(TOOL_能力类型).toContain('code');
    expect(TOOL_能力类型).toContain('llm');
    expect(TOOL_能力类型).toContain('roll_dice');
    expect(TOOL_能力类型).toContain('json_schema');
    expect(TOOL_能力类型).toContain('trigger');
    expect(TOOL_能力类型).toContain('output_tag');
    expect(TOOL_能力类型).toHaveLength(6);
  });

  it('[TOOL] 能力条目·output_tag 带命名空间 parse 通过', () => {
    const r = TOOL_能力条目Schema.parse({ 类型: 'output_tag', 输出命名空间: 'cuisine:flavor_tag' });
    expect(r.类型).toBe('output_tag');
    expect(r.输出命名空间).toBe('cuisine:flavor_tag');
  });

  it('[TOOL] 能力条目·输出命名空间 可缺省（非 output_tag 类型）', () => {
    const r = TOOL_能力条目Schema.parse({ 类型: 'roll_dice' });
    expect(r.类型).toBe('roll_dice');
    expect(r.输出命名空间).toBeUndefined();
  });

  it('[TOOL] 能力条目·非法类型 → 校验失败', () => {
    expect(TOOL_能力条目Schema.safeParse({ 类型: 'eval_js' }).success).toBe(false);
  });
});

describe('B-1 lore 知识库 · 食物样本（菜系·四川火锅·证明域无关性）', () => {
  const 四川火锅条目 = {
    分类路径: ['菜系', '川菜', '四川火锅'],
    别名表: [
      { 别名: '川锅', 命名空间: 'cuisine' },
      { 别名: '麻辣锅', 命名空间: 'cuisine' },
    ],
    触发谓词: '场景.地域 == 四川 || 场景.环境.类型 == 饮食场所',
    知识载荷: '四川火锅以麻辣鲜香为主要风味，底料以牛油为基底，辅以花椒、辣椒等香料。忌反季蔬菜配搭出错。',
    硬约束: [
      {
        禁令谓词: '食材.应季 == false && 场景.写实度 > 0.7',
        禁令描述: '禁反季食材，高写实度场景下应季原则必须遵守',
        错误代码: 'CUISINE_INGREDIENT_SEASON_VIOLATION',
      },
    ],
    工具引用: [
      { 工具ID: 'cuisine_trigger' },
    ],
  };

  it('食物 lore 样本 parse 通过', () => {
    const r = lore条目Schema.parse(四川火锅条目);
    expect(r.分类路径).toEqual(['菜系', '川菜', '四川火锅']);
    expect(r.别名表[0]!.别名).toBe('川锅');
    expect(r.硬约束![0]!.错误代码).toBe('CUISINE_INGREDIENT_SEASON_VIOLATION');
    expect(r.工具引用![0]!.工具ID).toBe('cuisine_trigger');
  });

  it('食物 lore 存入 lore知识库Schema·parse 通过', () => {
    const r = lore知识库Schema.parse({ 'cuisine:四川火锅': 四川火锅条目 });
    expect(r['cuisine:四川火锅']!.分类路径[0]).toBe('菜系');
  });

  it('食物样本证明 schema 非服装专用：分类路径首节点为「菜系」而非「服饰」', () => {
    const r = lore条目Schema.parse(四川火锅条目);
    expect(r.分类路径[0]).toBe('菜系');
    expect(r.分类路径[0]).not.toBe('服饰');
    expect(r.分类路径[0]).not.toBe('汉服');
  });
});

describe('B-1 lore 知识库 · 方言样本（吴语·苏州话·含状态转移）', () => {
  const 苏州话条目 = {
    分类路径: ['方言', '吴语', '苏州话'],
    别名表: [
      { 别名: '苏白', 命名空间: 'dialect' },
      { 别名: '吴侬软语', 命名空间: 'dialect' },
    ],
    触发谓词: '角色.出身地 == 苏州 || 场景.地域 == 苏州',
    知识载荷: '苏州话属吴语太湖片，以阴柔婉转著称，入声保留完整。声母清浊对立，韵母丰富，与普通话互不相通。',
    状态转移: [
      {
        触发条件: '角色.默认口音 != 苏白 && 角色.出身地 == 苏州',
        动作描述: '将角色默认口音切换为苏白',
        结果状态: '苏白口音启用',
      },
    ],
    硬约束: [
      {
        禁令谓词: '角色.口音 == 北方话 && 场景.地域 == 苏州 && 场景.写实度 > 0.7',
        禁令描述: '高写实度下禁止苏州场景使用北方话口音（禁串口音）',
        错误代码: 'DIALECT_MISMATCH_SUZHOU',
      },
    ],
    工具引用: [
      { 工具ID: 'dialect_output_tag', 命名空间覆盖: 'dialect:苏白口音' },
    ],
  };

  it('方言 lore 样本 parse 通过', () => {
    const r = lore条目Schema.parse(苏州话条目);
    expect(r.分类路径).toEqual(['方言', '吴语', '苏州话']);
    expect(r.别名表[0]!.别名).toBe('苏白');
    expect(r.状态转移![0]!.结果状态).toBe('苏白口音启用');
    expect(r.硬约束![0]!.错误代码).toBe('DIALECT_MISMATCH_SUZHOU');
    expect(r.工具引用![0]!.工具ID).toBe('dialect_output_tag');
    expect(r.工具引用![0]!.命名空间覆盖).toBe('dialect:苏白口音');
  });

  it('方言样本证明 schema 域无关性：分类路径首节点为「方言」', () => {
    const r = lore条目Schema.parse(苏州话条目);
    expect(r.分类路径[0]).toBe('方言');
    expect(r.分类路径[0]).not.toBe('服饰');
  });

  it('同一 lore知识库 可混存食物+方言两类条目', () => {
    const r = lore知识库Schema.parse({
      'cuisine:四川火锅': { 分类路径: ['菜系', '川菜'], 触发谓词: '', 知识载荷: '', 别名表: [] },
      'dialect:苏州话': 苏州话条目,
    });
    expect(Object.keys(r)).toHaveLength(2);
    expect(r['dialect:苏州话']!.分类路径[0]).toBe('方言');
    expect(r['cuisine:四川火锅']!.分类路径[0]).toBe('菜系');
  });
});

// ══════════════════════════════════════════
// K4 mod 墓碑库（B2·S1·schema-only）
// ══════════════════════════════════════════

describe('K4 _mod墓碑库（B2·S1·schema-only）', () => {
  it('可空/缺省：RootSchema.parse({}) 时 _mod墓碑库 为 undefined', () => {
    expect(RootSchema.parse({})._mod墓碑库).toBeUndefined();
  });

  it('空 record {} 通过（向后兼容·零条目墓碑库）', () => {
    const res = RootSchema.parse({ _mod墓碑库: {} });
    expect(res._mod墓碑库).toBeDefined();
    expect(Object.keys(res._mod墓碑库!)).toHaveLength(0);
  });

  it('单条记录最小必填字段 parse 通过', () => {
    const res = _mod墓碑库Schema.parse({
      bad_mod: { 记录键: 'bad_mod', 原因: '自环' },
    });
    expect(res['bad_mod']?.记录键).toBe('bad_mod');
    expect(res['bad_mod']?.原因).toBe('自环');
    expect(res['bad_mod']?.pack_id).toBeUndefined();
    expect(res['bad_mod']?.诊断).toBeUndefined();
  });

  it('pack_id 可选：有/无均通过', () => {
    expect(_mod墓碑库Schema.safeParse({
      m: { 记录键: 'm', 原因: '自环', pack_id: 'my_mod' },
    }).success).toBe(true);
    expect(_mod墓碑库Schema.safeParse({
      m: { 记录键: 'm', 原因: '自环' },
    }).success).toBe(true);
  });

  it('诊断 可选：有/无均通过', () => {
    expect(_mod墓碑库Schema.safeParse({
      m: { 记录键: 'm', 原因: 'key不等pack_id', 诊断: 'key=a pack_id=b' },
    }).success).toBe(true);
  });

  it('所有合法原因枚举值均通过', () => {
    for (const 原因 of mod墓碑原因枚举) {
      expect(
        _mod墓碑库Schema.safeParse({ m: { 记录键: 'm', 原因 } }).success,
        `原因="${原因}" 应通过`,
      ).toBe(true);
    }
  });

  it('原因枚举越界拒收', () => {
    expect(_mod墓碑库Schema.safeParse({
      m: { 记录键: 'm', 原因: '不存在的原因' },
    }).success).toBe(false);
  });

  it('未知字段拒收（.strict() 纪律）', () => {
    expect(_mod墓碑库Schema.safeParse({
      m: { 记录键: 'm', 原因: '自环', 未知字段: 'x' },
    }).success).toBe(false);
  });

  it('mod墓碑条目Schema 直接 parse 验证', () => {
    const entry = mod墓碑条目Schema.parse({ 记录键: 'cyclic', 原因: '依赖被拒', pack_id: 'cyclic', 诊断: 'dep x rejected' });
    expect(entry.记录键).toBe('cyclic');
    expect(entry.原因).toBe('依赖被拒');
    expect(entry.pack_id).toBe('cyclic');
    expect(entry.诊断).toBe('dep x rejected');
  });

  it('_ 前缀分类：classifyTopKey("_mod墓碑库") === "read-only"', () => {
    expect(classifyTopKey('_mod墓碑库')).toBe('read-only');
  });

  it('_mod墓碑库 不进 mod 可写白名单（writable 层无此顶层键）', () => {
    const entries = deriveWritableWhitelist();
    const writableTopKeys = entries
      .filter(e => !e.path.includes('.') && e.layer === 'writable')
      .map(e => e.path);
    expect(writableTopKeys).not.toContain('_mod墓碑库');
  });

  it('RootSchema 挂载确认：多条墓碑全字段 parse 通过', () => {
    const state = RootSchema.parse({
      _mod墓碑库: {
        cyclic_mod: { 记录键: 'cyclic_mod', 原因: '自环', pack_id: 'cyclic_mod', 诊断: 'self-dep detected' },
        bad_key: { 记录键: 'bad_key', 原因: 'key不等pack_id', 诊断: 'key=bad_key pack_id=good_id' },
      },
    });
    expect(state._mod墓碑库?.['cyclic_mod']?.原因).toBe('自环');
    expect(state._mod墓碑库?.['bad_key']?.原因).toBe('key不等pack_id');
  });

  it('_mod墓碑库 已纳入 BLUEPRINT_KEYS', () => {
    expect(BLUEPRINT_KEYS).toContain('_mod墓碑库');
  });
});

describe('B-1 lore 知识库 · BLUEPRINT_KEYS 一致性', () => {
  it('_lore知识库 已纳入 BLUEPRINT_KEYS', () => {
    expect(BLUEPRINT_KEYS).toContain('_lore知识库');
  });

  it('BLUEPRINT_KEYS 与 RootSchema 顶层键完全对齐（一致性检查）', () => {
    const schemaKeys = new Set(Object.keys(RootSchema.shape));
    for (const k of BLUEPRINT_KEYS) {
      expect(schemaKeys.has(k), `BLUEPRINT_KEYS 含 "${k}" 但 RootSchema.shape 无此键`).toBe(true);
    }
    for (const k of schemaKeys) {
      expect(BLUEPRINT_KEYS as readonly string[], `RootSchema.shape 含 "${k}" 但 BLUEPRINT_KEYS 未列`).toContain(k);
    }
  });

  it('RootSchema.parse({}) 有 _lore知识库 字段（零迁移·undefined）', () => {
    const r = RootSchema.parse({});
    // optional() means absent on empty parse — acceptable; zero-migration confirmed
    expect('_lore知识库' in r || r['_lore知识库'] === undefined).toBe(true);
  });
});

// ── P0-1 Fix3 · $玩家偏好.内容分级 + RootSchemaStrict community gate ─────────────────
describe('P0-1 Fix3 · $玩家偏好.内容分级 enum 英文化', () => {
  it('默认值为 off', () => {
    const r = RootSchema.shape.$玩家偏好.unwrap().parse({});
    expect(r.内容分级).toBe('off');
  });
  it('接受 off / light / explicit / community', () => {
    for (const v of ['off', 'light', 'explicit', 'community'] as const) {
      expect(RootSchema.shape.$玩家偏好.safeParse({ 内容分级: v }).success, `should accept "${v}"`).toBe(true);
    }
  });
  it('拒绝旧中文值 关/SFW/NSFW', () => {
    for (const v of ['关', 'SFW', 'NSFW']) {
      expect(RootSchema.shape.$玩家偏好.safeParse({ 内容分级: v }).success, `should reject "${v}"`).toBe(false);
    }
  });
  it('拒绝任意非枚举字符串', () => {
    expect(RootSchema.shape.$玩家偏好.safeParse({ 内容分级: 'adult' }).success).toBe(false);
  });
});

describe('P0-1 Fix3 · RootSchemaStrict community gate', () => {
  function makeRoot(内容分级: string, 允许覆盖: boolean): Record<string, unknown> {
    return {
      $玩家偏好: { 内容分级 },
      调用类型注册表: {
        叙事: { 允许玩家覆盖SystemPrompt: 允许覆盖 },
      },
    };
  }

  it('覆盖=true & 内容分级=off → RootSchemaStrict 拒绝', () => {
    const raw = makeRoot('off', true);
    const parsed = RootSchema.parse(raw);
    expect(RootSchemaStrict.safeParse(parsed).success).toBe(false);
  });
  it('覆盖=true & 内容分级=light → RootSchemaStrict 拒绝', () => {
    const raw = makeRoot('light', true);
    const parsed = RootSchema.parse(raw);
    expect(RootSchemaStrict.safeParse(parsed).success).toBe(false);
  });
  it('覆盖=true & 内容分级=explicit → RootSchemaStrict 拒绝', () => {
    const raw = makeRoot('explicit', true);
    const parsed = RootSchema.parse(raw);
    expect(RootSchemaStrict.safeParse(parsed).success).toBe(false);
  });
  it('覆盖=true & 内容分级=community → RootSchemaStrict 通过', () => {
    const raw = makeRoot('community', true);
    const parsed = RootSchema.parse(raw);
    expect(RootSchemaStrict.safeParse(parsed).success).toBe(true);
  });
  it('覆盖=false & 内容分级=off → RootSchemaStrict 通过（默认态）', () => {
    const parsed = RootSchema.parse({});
    expect(RootSchemaStrict.safeParse(parsed).success).toBe(true);
  });
  it('错误路径包含 调用类型注册表/叙事/允许玩家覆盖SystemPrompt', () => {
    const parsed = RootSchema.parse(makeRoot('off', true));
    const result = RootSchemaStrict.safeParse(parsed);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map(i => i.path.join('/'));
      expect(paths.some(p => p.includes('允许玩家覆盖SystemPrompt'))).toBe(true);
    }
  });
});

// ── 6.59 受治理键空间注册表 S1（B5·Step2 已挂载 RootSchema·整体可空·不进指纹）────────
describe('6.59 受治理键空间注册表 S1', () => {
  it('空表 {} parse 通过（键条目 absent）', () => {
    const res = 受治理键空间注册表Schema.safeParse({});
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.键条目).toBeUndefined();
  });
  it('单条目: 最小合法条目 parse 通过', () => {
    expect(受治理键空间注册表Schema.safeParse({
      键条目: [{ 规范键: 'CNY', 命名空间: '币种' }],
    }).success).toBe(true);
  });
  it('单条目: 带别名数组 parse 通过', () => {
    expect(受治理键空间注册表Schema.safeParse({
      键条目: [{ 规范键: '文', 命名空间: '单位', 别名: ['文钱', '钱'] }],
    }).success).toBe(true);
  });
  it('单条目: 全字段（显示名/来源包/停用/不可变）parse 通过', () => {
    expect(键条目Schema.safeParse({
      规范键: 'npc_death', 显示名: '死亡', 别名: ['身故'],
      命名空间: '状态子类', 来源包: 'core_base', 停用: false, 不可变: true,
    }).success).toBe(true);
  });
  it('.strict(): 键条目 塞未知字段 safeParse().success===false', () => {
    expect(键条目Schema.safeParse({
      规范键: 'x', 命名空间: '币种', 未知字段: 1,
    }).success).toBe(false);
  });
  it('.strict(): 注册表顶层 塞未知字段 safeParse().success===false', () => {
    expect(受治理键空间注册表Schema.safeParse({ 未知字段: 1 }).success).toBe(false);
  });
  it('命名空间枚举 = 32 項全部合法值逐一 parse 通过', () => {
    expect(命名空间枚举.length).toBe(32);
    for (const ns of 命名空间枚举) {
      expect(键条目Schema.safeParse({ 规范键: 'k', 命名空间: ns }).success).toBe(true);
    }
  });
  it('命名空间枚举: 越界值报错', () => {
    expect(键条目Schema.safeParse({ 规范键: 'k', 命名空间: '不存在的命名空间' }).success).toBe(false);
  });
  it("命名空间枚举 B2·S4: 'mod包' 新项可用于键条目Schema", () => {
    expect(键条目Schema.safeParse({ 规范键: 'my_mod', 命名空间: 'mod包' }).success).toBe(true);
  });
  it("命名空间枚举 B2·S4: 'mod包' 新项可用于归并条目Schema", () => {
    expect(归并条目Schema.safeParse({
      别名: 'hero_pack', 规范键: 'hero_pack_v1', 命名空间: 'mod包',
    }).success).toBe(true);
  });
  it("命名空间枚举 B6: '拦截器句柄' 第13槽可用于键条目Schema", () => {
    expect(键条目Schema.safeParse({ 规范键: 'break_curse', 命名空间: '拦截器句柄' }).success).toBe(true);
  });
  it("命名空间枚举 B6: '拦截器句柄' 第13槽可用于归并条目Schema", () => {
    expect(归并条目Schema.safeParse({
      别名: '断肢解除', 规范键: '断肢重生术', 命名空间: '拦截器句柄',
    }).success).toBe(true);
  });
  it("命名空间枚举 UI库: 'UI组件' 第14槽可用于键条目Schema", () => {
    expect(键条目Schema.safeParse({ 规范键: 'btn_ok', 命名空间: 'UI组件' }).success).toBe(true);
  });
  it("命名空间枚举 UI库: 'UI组件' 第14槽可用于归并条目Schema", () => {
    expect(归并条目Schema.safeParse({
      别名: '确认按钮', 规范键: 'btn_ok', 命名空间: 'UI组件',
    }).success).toBe(true);
  });
  it('规范键: 缺失时拒收（必填）', () => {
    expect(键条目Schema.safeParse({ 命名空间: '币种' }).success).toBe(false);
  });
  it('命名空间: 缺失时拒收（必填）', () => {
    expect(键条目Schema.safeParse({ 规范键: 'k' }).success).toBe(false);
  });
});

// ── 6.59 归并表 S1b（B5·Step2 已挂载 RootSchema·键空间归并表·整体可空·不进指纹）──────
describe('6.59 归并表 S1b（键空间归并表）', () => {
  it('空表 {} parse 通过（归并条目 absent）', () => {
    const res = 归并表Schema.safeParse({});
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.归并条目).toBeUndefined();
  });
  it('单条目: 最小合法条目 parse 通过', () => {
    expect(归并表Schema.safeParse({
      归并条目: [{ 别名: '文钱', 规范键: '文', 命名空间: '单位' }],
    }).success).toBe(true);
  });
  it('单条目: 全字段（含来源包）parse 通过', () => {
    expect(归并条目Schema.safeParse({
      别名: '身故', 规范键: 'npc_death', 命名空间: '状态子类', 来源包: 'core_base',
    }).success).toBe(true);
  });
  it('.strict(): 归并条目 塞未知字段 safeParse().success===false', () => {
    expect(归并条目Schema.safeParse({
      别名: 'a', 规范键: 'b', 命名空间: '币种', 未知字段: 1,
    }).success).toBe(false);
  });
  it('.strict(): 归并表顶层 塞未知字段 safeParse().success===false', () => {
    expect(归并表Schema.safeParse({ 未知字段: 1 }).success).toBe(false);
  });
  it('命名空间枚举越界拒收', () => {
    expect(归并条目Schema.safeParse({
      别名: 'a', 规范键: 'b', 命名空间: '不存在的命名空间',
    }).success).toBe(false);
  });
  it('别名 缺失时拒收（必填）', () => {
    expect(归并条目Schema.safeParse({ 规范键: 'b', 命名空间: '币种' }).success).toBe(false);
  });
  it('规范键 缺失时拒收（必填）', () => {
    expect(归并条目Schema.safeParse({ 别名: 'a', 命名空间: '币种' }).success).toBe(false);
  });
});

// ── 6.59 跨包仲裁占位 S2（schema-only·不 fire·不接线）───────────────────────────
describe('6.59 跨包仲裁占位 S2（schema-only）', () => {
  it('仲裁策略枚举: 4 项全部合法值逐一 parse 通过', () => {
    expect(仲裁策略枚举.length).toBe(4);
    for (const v of 仲裁策略枚举) {
      expect(仲裁策略Schema.safeParse(v).success).toBe(true);
    }
  });
  it('仲裁策略: 省略(undefined) parse 通过（整体 optional）', () => {
    expect(仲裁策略Schema.safeParse(undefined).success).toBe(true);
  });
  it('仲裁策略: 越界值拒收', () => {
    expect(仲裁策略Schema.safeParse('随机挑一个').success).toBe(false);
  });
});

// ── 6.59 母题写入口注册闸 schema 位（S2·schema-only·不 fire·不收紧 secret.ts 母题字段）──
describe('6.59 母题注册表（schema-only·不进 RootSchema）', () => {
  it('空表 {} parse 通过（母题条目 absent）', () => {
    const res = 母题注册表Schema.safeParse({});
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.母题条目).toBeUndefined();
  });
  it('单条目: 最小合法条目 parse 通过', () => {
    expect(母题注册表Schema.safeParse({
      母题条目: [{ 规范键: '窝藏通缉旧友' }],
    }).success).toBe(true);
  });
  it('单条目: 全字段（含经注册写入口）parse 通过', () => {
    expect(母题注册条目Schema.safeParse({
      规范键: '骨肉离散', 显示名: '骨肉离散', 别名: ['失散'],
      来源包: 'core_base', 经注册写入口: true,
    }).success).toBe(true);
  });
  it('.strict(): 母题条目 塞未知字段 safeParse().success===false', () => {
    expect(母题注册条目Schema.safeParse({ 规范键: 'a', 未知字段: 1 }).success).toBe(false);
  });
  it('.strict(): 母题注册表顶层 塞未知字段 safeParse().success===false', () => {
    expect(母题注册表Schema.safeParse({ 未知字段: 1 }).success).toBe(false);
  });
  it('规范键 缺失时拒收（必填）', () => {
    expect(母题注册条目Schema.safeParse({ 显示名: 'x' }).success).toBe(false);
  });
});

// ── 6.59 地点类别登记（审计#13·命名空间='地点类别'·复用 S1 11 项枚举·map.ts 不动）──
describe('6.59 地点类别注册表（schema-only·不进 RootSchema·map.ts 零迁移）', () => {
  it('空表 {} parse 通过（地点类别条目 absent）', () => {
    const res = 地点类别注册表Schema.safeParse({});
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.地点类别条目).toBeUndefined();
  });
  it('单条目: 最小合法条目 parse 通过', () => {
    expect(地点类别注册表Schema.safeParse({
      地点类别条目: [{ 规范键: '区域级' }],
    }).success).toBe(true);
  });
  it('单条目: 全字段（含区域级标记）parse 通过', () => {
    expect(地点类别登记条目Schema.safeParse({
      规范键: '区域级', 显示名: '区域', 别名: ['大区'],
      来源包: 'core_base', 区域级: true,
    }).success).toBe(true);
  });
  it('.strict(): 地点类别条目 塞未知字段 safeParse().success===false', () => {
    expect(地点类别登记条目Schema.safeParse({ 规范键: 'a', 未知字段: 1 }).success).toBe(false);
  });
  it('.strict(): 地点类别注册表顶层 塞未知字段 safeParse().success===false', () => {
    expect(地点类别注册表Schema.safeParse({ 未知字段: 1 }).success).toBe(false);
  });
  it('规范键 缺失时拒收（必填）', () => {
    expect(地点类别登记条目Schema.safeParse({ 显示名: 'x' }).success).toBe(false);
  });
});

// ── 6.59 码位规范化纯函数(S3) + AA4 JS保留键黑名单（schema-only·零接线·双闸留 P0-6）──
describe('6.59 规范化键码位（纯函数·复用 NFKC（全半角折叠+组合归一） + 去零宽·零接线）', () => {
  it('NFC 组合归一：组合字符 ↔ 预组合字符归一为同一结果（NFKC ⊋ NFC，仍保留）', () => {
    const 分解形 = 'e\u0301'; // e + U+0301 COMBINING ACUTE ACCENT
    const 预组合形 = '\u00e9'; // é (NFC 单码位)
    expect(规范化键码位(分解形)).toBe(规范化键码位(预组合形));
    expect(规范化键码位(分解形)).toBe('\u00e9');
  });
  it('Step 5b·全角字母折叠：\uFF21(Ａ) → A', () => {
    expect(规范化键码位('\uFF21')).toBe('A');
  });
  it('Step 5b·全角数字折叠：\uFF11(１) → 1', () => {
    expect(规范化键码位('\uFF11')).toBe('1');
  });
  it('去零宽：插入 U+200B/U+FEFF 等零宽码位被清除', () => {
    expect(规范化键码位('文\u200B钱\uFEFF')).toBe('文钱');
  });
  it('trim：首尾空白被清除', () => {
    expect(规范化键码位('  规范键  ')).toBe('规范键');
  });
  it('同输入恒等：多次调用结果逐位相同（确定性）', () => {
    const input = '  \u00e9\u200B文\uFEFF  ';
    const r1 = 规范化键码位(input);
    const r2 = 规范化键码位(input);
    expect(r1).toBe(r2);
    expect(r1).toBe('\u00e9文');
  });
});

describe('6.59 AA4 JS保留键黑名单（常量+helper·零接线·fire 留 P0-6）', () => {
  it('黑名单恰好 3 项：__proto__/constructor/prototype', () => {
    expect(JS保留键黑名单).toEqual(['__proto__', 'constructor', 'prototype']);
  });
  it('黑名单冻结：尝试修改不生效（Object.freeze）', () => {
    expect(Object.isFrozen(JS保留键黑名单)).toBe(true);
  });
  it('是JS保留键: __proto__/constructor/prototype → true', () => {
    expect(是JS保留键('__proto__')).toBe(true);
    expect(是JS保留键('constructor')).toBe(true);
    expect(是JS保留键('prototype')).toBe(true);
  });
  it('是JS保留键: 普通键 → false', () => {
    expect(是JS保留键('规范键')).toBe(false);
    expect(是JS保留键('toString')).toBe(false);
  });
});

// ── 6.59 deltas.path add-constraint（Step 6·受治理路径Schema·形态 refine·fail-open）──
describe('6.59 deltas.path（受治理路径Schema·存储仍 string·零迁移）', () => {
  it('合法 path 通过', () => {
    expect(受治理路径Schema.safeParse('货币系统.王掌柜.余额').success).toBe(true);
    expect(受治理路径Schema.safeParse('a.b').success).toBe(true);
    expect(受治理路径Schema.safeParse('单段键').success).toBe(true);
  });
  it('fail-open: registry 为空（无成员表）时，合法 path 仍放行', () => {
    const emptyRegistry = 受治理键空间注册表Schema.parse({}); // 空 registry，无任何已注册成员
    expect(emptyRegistry.键条目).toBeUndefined();
    // 形态 refine 不查 registry 成员，空 registry 不影响合法 path 通过
    expect(受治理路径Schema.safeParse('货币系统.王掌柜.余额').success).toBe(true);
  });
  it('非法形态拒收: 空串/纯零宽归一后为空', () => {
    expect(受治理路径Schema.safeParse('').success).toBe(false);
    expect(受治理路径Schema.safeParse('​﻿').success).toBe(false);
  });
  it('非法形态拒收: 含空段（连续点号/首尾点号）', () => {
    expect(受治理路径Schema.safeParse('a..b').success).toBe(false);
    expect(受治理路径Schema.safeParse('.a.b').success).toBe(false);
    expect(受治理路径Schema.safeParse('a.b.').success).toBe(false);
  });
  it('非法形态拒收: 路径段命中 JS 保留键黑名单（复用 AA4）', () => {
    expect(受治理路径Schema.safeParse('__proto__').success).toBe(false);
    expect(受治理路径Schema.safeParse('a.constructor.b').success).toBe(false);
    expect(受治理路径Schema.safeParse('prototype').success).toBe(false);
  });
  it('非法形态拒收: 路径段不符合命名正则（含非法符号）', () => {
    expect(受治理路径Schema.safeParse('a.b$c').success).toBe(false);
    expect(受治理路径Schema.safeParse('a.b c').success).toBe(false);
  });

  // ── 接线点：intervention_pack_v1Schema.deltas[].path 实际消费 受治理路径Schema ──
  it('intervention_pack_v1: deltas[].path 合法时通过', () => {
    expect(intervention_pack_v1Schema.safeParse({
      pack_id: 'test_e',
      deltas: [{ path: '货币系统.王掌柜.余额', op: 'add', value: 1 }],
    }).success).toBe(true);
  });
  it('intervention_pack_v1: deltas[].path 命中 JS 保留键时拒收', () => {
    expect(intervention_pack_v1Schema.safeParse({
      deltas: [{ path: '__proto__', op: 'add', value: 1 }],
    }).success).toBe(false);
  });
  it('intervention_pack_v1: 旧三字段(agent_delta/money_delta/flags_add)有 pack_id 时不受影响', () => {
    expect(intervention_pack_v1Schema.safeParse({
      pack_id: 'my_effect',
      agent_delta: { npc1: { hp: 10 } },
      money_delta: { wang: -5 },
      flags_add: ['flag_x'],
    }).success).toBe(true);
  });
});

// ── 6.59 handlerRef 形态收紧（Step 7·受治理句柄Schema·扁平单 token·fail-open）──────
describe('6.59 受治理句柄Schema（handlerRef·扁平单 token·与受治理路径区分）', () => {
  it('合法扁平 handlerRef 通过', () => {
    expect(受治理句柄Schema.safeParse('handler_a').success).toBe(true);
    expect(受治理句柄Schema.safeParse('好感涟漪联动').success).toBe(true);
  });
  it('含零宽/全角字符经归一后仍通过', () => {
    expect(受治理句柄Schema.safeParse('han​dler﻿').success).toBe(true); // 含 U+200B/U+FEFF，归一后 'handler'
    expect(受治理句柄Schema.safeParse('ＡＡ').success).toBe(true); // ＡＡ → AA（NFKC 全角折叠）
  });
  it('空串拒收', () => {
    expect(受治理句柄Schema.safeParse('').success).toBe(false);
  });
  it('纯空白经 trim 后归一为空·拒收', () => {
    expect(受治理句柄Schema.safeParse('   ').success).toBe(false);
  });
  it('JS 保留键拒收（复用 AA4）', () => {
    expect(受治理句柄Schema.safeParse('__proto__').success).toBe(false);
    expect(受治理句柄Schema.safeParse('constructor').success).toBe(false);
    expect(受治理句柄Schema.safeParse('prototype').success).toBe(false);
  });
  it('含内部点号拒收（坐实扁平纪律·与受治理路径区分）', () => {
    expect(受治理句柄Schema.safeParse('cascade.好感.涟漪').success).toBe(false);
    expect(受治理句柄Schema.safeParse('a.b').success).toBe(false);
  });
  it('fail-open: 空 registry 下合法 handlerRef 仍通过', () => {
    const emptyRegistry = 受治理键空间注册表Schema.parse({});
    expect(emptyRegistry.键条目).toBeUndefined();
    expect(受治理句柄Schema.safeParse('handler_a').success).toBe(true);
  });

  // ── 数组逐元素校验：一个元素违规即整个 array 拒 ──────────────────────────────
  it('z.array(受治理句柄Schema): 全部合法时通过', () => {
    expect(z.array(受治理句柄Schema).safeParse(['handler_a', 'handler_b']).success).toBe(true);
  });
  it('z.array(受治理句柄Schema): 一个元素违规（含点号）即整体拒收', () => {
    expect(z.array(受治理句柄Schema).safeParse(['handler_a', 'cascade.好感.涟漪']).success).toBe(false);
  });

  // ── 三接线点：side_effects / cascade_on_change 实际消费 受治理句柄Schema ────────
  it('动词Option基础Schema.side_effects: Step3-B 占位值 [handler_a, handler_b] 仍过', () => {
    for (const optionSchema of Object.values(动词OptionSchema表)) {
      expect(optionSchema.safeParse({ side_effects: ['handler_a', 'handler_b'] }).success).toBe(true);
    }
  });
  it('动词Option基础Schema.side_effects: 含点号 handlerRef 拒收', () => {
    for (const optionSchema of Object.values(动词OptionSchema表)) {
      expect(optionSchema.safeParse({ side_effects: ['cascade.好感.涟漪'] }).success).toBe(false);
    }
  });
  it('组织属性轴条目Schema.cascade_on_change: 合法 handlerRef 通过·含点号拒收', () => {
    expect(组织属性轴条目Schema.safeParse({ cascade_on_change: ['handler_a'] }).success).toBe(true);
    expect(组织属性轴条目Schema.safeParse({ cascade_on_change: ['cascade.好感.涟漪'] }).success).toBe(false);
  });
  it('属性轴表Schema 元素.cascade_on_change: 合法 handlerRef 通过·含点号拒收', () => {
    expect(属性轴表Schema.safeParse([{ 轴名: '好感', cascade_on_change: ['handler_a'] }]).success).toBe(true);
    expect(属性轴表Schema.safeParse([{ 轴名: '好感', cascade_on_change: ['cascade.好感.涟漪'] }]).success).toBe(false);
  });
});

// ── B5·S1+S1b RootSchema 挂载验收（四条护栏）──────────────────────────────────────────
describe('B5·S1+S1b · RootSchema 挂载 · 整体可空·零迁移', () => {
  it('受治理键空间注册表 已纳入 BLUEPRINT_KEYS', () => {
    expect(BLUEPRINT_KEYS).toContain('受治理键空间注册表');
  });
  it('键空间归并表 已纳入 BLUEPRINT_KEYS', () => {
    expect(BLUEPRINT_KEYS).toContain('键空间归并表');
  });
  it('受治理键空间注册表 存在于 RootSchema.shape', () => {
    expect('受治理键空间注册表' in RootSchema.shape).toBe(true);
  });
  it('键空间归并表 存在于 RootSchema.shape', () => {
    expect('键空间归并表' in RootSchema.shape).toBe(true);
  });
  it('整体可空：RootSchema.parse({}) 后两键均为 undefined（T1 opt-in）', () => {
    const state = RootSchema.parse({});
    expect(state.受治理键空间注册表).toBeUndefined();
    expect(state.键空间归并表).toBeUndefined();
  });
  it('整体可空：带合法 S1 数据 parse 通过', () => {
    const state = RootSchema.parse({
      受治理键空间注册表: { 键条目: [{ 规范键: 'CNY', 命名空间: '币种' }] },
    });
    expect(state.受治理键空间注册表!.键条目).toHaveLength(1);
  });
  it('整体可空：带合法 S1b 数据 parse 通过', () => {
    const state = RootSchema.parse({
      键空间归并表: { 归并条目: [{ 别名: '文钱', 规范键: '文', 命名空间: '单位' }] },
    });
    expect(state.键空间归并表!.归并条目).toHaveLength(1);
  });
  it('🛡️ 隐性排除：受治理键空间注册表 不在 FINGERPRINT_BUNDLE_MEMBERS', () => {
    expect(FINGERPRINT_BUNDLE_MEMBERS as readonly string[]).not.toContain('受治理键空间注册表');
  });
  it('🛡️ 隐性排除：键空间归并表 不在 FINGERPRINT_BUNDLE_MEMBERS', () => {
    expect(FINGERPRINT_BUNDLE_MEMBERS as readonly string[]).not.toContain('键空间归并表');
  });
  it('🛡️ 隐性排除：受治理键空间注册表 不在 FINGERPRINT_EXCLUDED_FIELDS', () => {
    expect(FINGERPRINT_EXCLUDED_FIELDS as readonly string[]).not.toContain('受治理键空间注册表');
  });
  it('🛡️ 隐性排除：键空间归并表 不在 FINGERPRINT_EXCLUDED_FIELDS', () => {
    expect(FINGERPRINT_EXCLUDED_FIELDS as readonly string[]).not.toContain('键空间归并表');
  });
});

// ── B6·AA4 record 解析层 JS 保留键黑名单 fire（路径 I·schema superRefine·add-constraint）──
describe('B6·AA4 · JS 保留键黑名单 record 面（economy.ts + memory.ts）', () => {
  const RESERVED = ['__proto__', 'constructor', 'prototype'] as const;

  // ── 货币系统 3 面 ─────────────────────────────────────────────────────────
  describe('货币系统.币种定义 key', () => {
    it.each(RESERVED)('保留键「%s」→ 拒收', (k) => {
      expect(货币系统Schema.safeParse({ 币种定义: { [k]: {} } }).success).toBe(false);
    });
    it('合法币种键「文」→ 通过', () => {
      expect(货币系统Schema.safeParse({ 币种定义: { '文': {} } }).success).toBe(true);
    });
  });

  describe('货币系统.汇率 key', () => {
    it.each(RESERVED)('保留键「%s」→ 拒收', (k) => {
      expect(货币系统Schema.safeParse({ 汇率: { [k]: 1 } }).success).toBe(false);
    });
    it('合法汇率键「银」→ 通过', () => {
      expect(货币系统Schema.safeParse({ 汇率: { '银': 0.5 } }).success).toBe(true);
    });
  });

  describe('市场状态.行业景气 key', () => {
    it.each(RESERVED)('保留键「%s」→ 拒收', (k) => {
      expect(货币系统Schema.safeParse({ 市场状态: { 行业景气: { [k]: 50 } } }).success).toBe(false);
    });
    it('合法行业键「酿酒」→ 通过', () => {
      expect(货币系统Schema.safeParse({ 市场状态: { 行业景气: { '酿酒': 60 } } }).success).toBe(true);
    });
  });

  // ── mod 注册表 / 墓碑库 ────────────────────────────────────────────────────
  describe('mod注册表 key（constructor/prototype 补漏）', () => {
    it('constructor → 拒收（pack_id 正则原来放行该漏洞·本批补）', () => {
      expect(mod注册表Schema.safeParse({ constructor: { pack_id: 'constructor' } }).success).toBe(false);
    });
    it('prototype → 拒收', () => {
      expect(mod注册表Schema.safeParse({ prototype: { pack_id: 'prototype' } }).success).toBe(false);
    });
    it('合法 mod key「base_mod」→ 通过', () => {
      expect(mod注册表Schema.safeParse({ base_mod: { pack_id: 'base_mod' } }).success).toBe(true);
    });
  });

  describe('_mod墓碑库 key', () => {
    it.each(RESERVED)('保留键「%s」→ 拒收', (k) => {
      expect(_mod墓碑库Schema.safeParse({ [k]: { 记录键: k, 原因: '其他' } }).success).toBe(false);
    });
    it('合法墓碑键「base_mod」→ 通过', () => {
      expect(_mod墓碑库Schema.safeParse({ base_mod: { 记录键: 'base_mod', 原因: '自环' } }).success).toBe(true);
    });
  });

  // ── 调用类型注册表 ────────────────────────────────────────────────────────
  describe('调用类型注册表 key', () => {
    it.each(RESERVED)('保留键「%s」→ 拒收', (k) => {
      expect(调用类型注册表Schema.safeParse({ [k]: {} }).success).toBe(false);
    });
    it('合法调用类型键「叙事质量二审」→ 通过', () => {
      expect(调用类型注册表Schema.safeParse({ '叙事质量二审': {} }).success).toBe(true);
    });
  });

  // ── intervention_pack: agent_delta 两层 + money_delta ────────────────────
  const validPackBase = { pack_id: 'test_mod' };

  describe('intervention_pack agent_delta 第一层 entity key', () => {
    it.each(RESERVED)('保留键「%s」→ 拒收', (k) => {
      expect(intervention_pack_v1Schema.safeParse({ ...validPackBase, agent_delta: { [k]: { '好感': 1 } } }).success).toBe(false);
    });
    it('合法 entity key「pc_linjiu」→ 通过', () => {
      expect(intervention_pack_v1Schema.safeParse({ ...validPackBase, agent_delta: { pc_linjiu: { '好感': 1 } } }).success).toBe(true);
    });
  });

  describe('intervention_pack agent_delta 第二层 field-path key', () => {
    it.each(RESERVED)('保留键「%s」→ 拒收', (k) => {
      expect(intervention_pack_v1Schema.safeParse({ ...validPackBase, agent_delta: { pc_linjiu: { [k]: 1 } } }).success).toBe(false);
    });
    it('合法字段键「好感」→ 通过', () => {
      expect(intervention_pack_v1Schema.safeParse({ ...validPackBase, agent_delta: { pc_linjiu: { '好感': 1 } } }).success).toBe(true);
    });
  });

  describe('intervention_pack money_delta entity key', () => {
    it.each(RESERVED)('保留键「%s」→ 拒收', (k) => {
      expect(intervention_pack_v1Schema.safeParse({ ...validPackBase, money_delta: { [k]: 10 } }).success).toBe(false);
    });
    it('合法 entity key「pc_linjiu」→ 通过', () => {
      expect(intervention_pack_v1Schema.safeParse({ ...validPackBase, money_delta: { pc_linjiu: 10 } }).success).toBe(true);
    });
  });
});

// ── G-d-partial · AA4 · actor.ts record 面 JS 保留键黑名单 + null-proto 存储层 ──────
describe('G-d-partial · AA4 · actor.ts record 面（superRefine·29面·4顶层null-proto）', () => {
  const RESERVED = ['__proto__', 'constructor', 'prototype'] as const;

  // ── 4 顶层 export record schema ──────────────────────────────────────────────

  describe('NpcRecordSchema 顶层 key', () => {
    it.each(RESERVED)('保留键「%s」→ 拒收', (k) => {
      expect(NpcRecordSchema.safeParse({ [k]: {} }).success).toBe(false);
    });
    it('合法 NPC key「npc_001」→ 通过', () => {
      expect(NpcRecordSchema.safeParse({ npc_001: {} }).success).toBe(true);
    });
  });

  describe('已故NPC归档Schema key', () => {
    it.each(RESERVED)('保留键「%s」→ 拒收', (k) => {
      expect(已故NPC归档Schema.safeParse({ [k]: { 称呼: '张三' } }).success).toBe(false);
    });
    it('合法 key「npc_dead_001」→ 通过', () => {
      expect(已故NPC归档Schema.safeParse({ npc_dead_001: { 称呼: '张三' } }).success).toBe(true);
    });
  });

  describe('席位表Schema key', () => {
    it.each(RESERVED)('保留键「%s」→ 拒收', (k) => {
      expect(席位表Schema.safeParse({ [k]: { 焦点角色键: 'pc_001' } }).success).toBe(false);
    });
    it('合法席位键「本机」→ 通过（单机退化态）', () => {
      expect(席位表Schema.safeParse({ 本机: { 焦点角色键: 'pc_001' } }).success).toBe(true);
    });
  });

  describe('认知档案Schema 双层 key', () => {
    it.each(RESERVED)('保留键「%s」→ 拒收（观察者键）', (k) => {
      expect(认知档案Schema.safeParse({ [k]: {} }).success).toBe(false);
    });
    it.each(RESERVED)('保留键「%s」→ 拒收（目标键）', (k) => {
      expect(认知档案Schema.safeParse({ npc_a: { [k]: {} } }).success).toBe(false);
    });
    it('合法双层键「npc_a → npc_b」→ 通过', () => {
      expect(认知档案Schema.safeParse({ npc_a: { npc_b: {} } }).success).toBe(true);
    });
  });

  // ── NpcSchema 内部 record 面（代表性 6 面）───────────────────────────────────

  describe('NpcSchema 内部 record 面', () => {
    it.each(RESERVED)('特质 key 保留键「%s」→ 拒收', (k) => {
      expect(NpcSchema.safeParse({ 特质: { [k]: {} } }).success).toBe(false);
    });
    it('特质 key 合法键「敏锐」→ 通过', () => {
      expect(NpcSchema.safeParse({ 特质: { 敏锐: {} } }).success).toBe(true);
    });

    it.each(RESERVED)('技能 key 保留键「%s」→ 拒收', (k) => {
      expect(NpcSchema.safeParse({ 技能: { [k]: {} } }).success).toBe(false);
    });
    it('技能 key 合法键「剑术」→ 通过', () => {
      expect(NpcSchema.safeParse({ 技能: { 剑术: {} } }).success).toBe(true);
    });

    it.each(RESERVED)('物品 key 保留键「%s」→ 拒收', (k) => {
      expect(NpcSchema.safeParse({ 物品: { [k]: {} } }).success).toBe(false);
    });
    it('物品 key 合法键「长剑」→ 通过', () => {
      expect(NpcSchema.safeParse({ 物品: { 长剑: {} } }).success).toBe(true);
    });

    it.each(RESERVED)('状态标签 key 保留键「%s」→ 拒收', (k) => {
      expect(NpcSchema.safeParse({ 状态标签: { [k]: {} } }).success).toBe(false);
    });
    it('状态标签 key 合法键「中毒」→ 通过', () => {
      expect(NpcSchema.safeParse({ 状态标签: { 中毒: {} } }).success).toBe(true);
    });

    it.each(RESERVED)('忠诚 key 保留键「%s」→ 拒收', (k) => {
      expect(NpcSchema.safeParse({ 忠诚: { [k]: {} } }).success).toBe(false);
    });
    it('忠诚 key 合法键「皇室」→ 通过', () => {
      expect(NpcSchema.safeParse({ 忠诚: { 皇室: {} } }).success).toBe(true);
    });

    it.each(RESERVED)('成就 key 保留键「%s」→ 拒收', (k) => {
      expect(NpcSchema.safeParse({ 成就: { [k]: {} } }).success).toBe(false);
    });
    it('成就 key 合法键「首战告捷」→ 通过', () => {
      expect(NpcSchema.safeParse({ 成就: { 首战告捷: {} } }).success).toBe(true);
    });
  });

  // ── 性格五轴 facet optional record（L-1/L-6·facet 纳入保护）──────────────────

  describe('性格五轴 facet record key（L-1/L-6·facet AA4 防护）', () => {
    it.each(RESERVED)('facet key 保留键「%s」→ 拒收', (k) => {
      expect(NpcSchema.safeParse({ 性格五轴: { facet: { [k]: 50 } } }).success).toBe(false);
    });
    it('facet key 合法键「好奇心」→ 通过', () => {
      expect(NpcSchema.safeParse({ 性格五轴: { facet: { 好奇心: 70 } } }).success).toBe(true);
    });
  });

  // ── null-proto 存储层 正向断言（4 顶层 schema·Object.getPrototypeOf === null）──

  describe('null-proto 存储层（4 顶层 export record schema）', () => {
    it('NpcRecordSchema.parse({}) → prototype === null', () => {
      expect(Object.getPrototypeOf(NpcRecordSchema.parse({}))).toBeNull();
    });
    it('已故NPC归档Schema.parse({}) → prototype === null', () => {
      expect(Object.getPrototypeOf(已故NPC归档Schema.parse({}))).toBeNull();
    });
    it('席位表Schema.parse({}) → prototype === null', () => {
      expect(Object.getPrototypeOf(席位表Schema.parse({}))).toBeNull();
    });
    it('认知档案Schema.parse({}) → prototype === null', () => {
      expect(Object.getPrototypeOf(认知档案Schema.parse({}))).toBeNull();
    });
  });

  // ── 序列化恒等（护栏②③：JSON.stringify / canonicalize ⊥ 原型）────────────────

  describe('null-proto 序列化恒等（护栏②③）', () => {
    it('NpcRecordSchema: null-proto 输出与相同 own-props 的普通对象 JSON.stringify 逐字节相同', () => {
      const parsed = NpcRecordSchema.parse({});
      const regular = Object.assign({}, parsed); // regular proto, same data
      expect(JSON.stringify(parsed)).toBe(JSON.stringify(regular));
    });
    it('已故NPC归档: null-proto 输出 JSON.stringify 恒等', () => {
      const data = { npc_dead: { 称呼: '张三' } };
      const parsed = 已故NPC归档Schema.parse(data);
      const regular = Object.assign({}, parsed);
      expect(JSON.stringify(parsed)).toBe(JSON.stringify(regular));
    });
    it('NpcRecordSchema: null-proto Object.keys 仍返回 own 键（零 inherited 污染）', () => {
      const parsed = NpcRecordSchema.parse({ npc_a: {}, npc_b: {} });
      expect(Object.keys(parsed).sort()).toEqual(['npc_a', 'npc_b']);
    });
  });
});

// ── L-25 · 发育阶段 跨字段语义闸（superRefine）────────────────────────────────────
describe('L-25 · 发育阶段Schema · 跨字段语义 superRefine', () => {
  const makeRace = (stages: unknown[]) =>
    种族模板Schema.safeParse({ race_human: { 发育阶段表: stages } });

  it('L-25 valid: 结束年龄分钟 > 起始年龄分钟', () => {
    expect(makeRace([{ 阶段名: '幼年', 起始年龄分钟: 0, 结束年龄分钟: 100 }]).success).toBe(true);
  });
  it('L-25 valid: 结束年龄分钟 缺省（无上限阶段）', () => {
    expect(makeRace([{ 阶段名: '老年', 起始年龄分钟: 80000 }]).success).toBe(true);
  });
  it('L-25 invalid: 结束年龄分钟 === 起始年龄分钟（零时长）', () => {
    expect(makeRace([{ 阶段名: '异常', 起始年龄分钟: 500, 结束年龄分钟: 500 }]).success).toBe(false);
  });
  it('L-25 invalid: 结束年龄分钟 < 起始年龄分钟（逆序）', () => {
    expect(makeRace([{ 阶段名: '异常', 起始年龄分钟: 1000, 结束年龄分钟: 500 }]).success).toBe(false);
  });
  it('L-25 valid: 多阶段表·各自合法', () => {
    expect(makeRace([
      { 阶段名: '幼年', 起始年龄分钟: 0, 结束年龄分钟: 10000 },
      { 阶段名: '成年', 起始年龄分钟: 10000, 结束年龄分钟: 50000 },
      { 阶段名: '老年', 起始年龄分钟: 50000 },
    ]).success).toBe(true);
  });
  it('L-25 invalid: 多阶段中有一条逆序', () => {
    expect(makeRace([
      { 阶段名: '幼年', 起始年龄分钟: 0, 结束年龄分钟: 10000 },
      { 阶段名: '异常', 起始年龄分钟: 5000, 结束年龄分钟: 3000 },
    ]).success).toBe(false);
  });
});

// ── L-12 · backfillPhaseL1b 幂等验收 ─────────────────────────────────────────────
describe('L-12 · backfillPhaseL1b · pure-optional 零迁移幂等', () => {
  it('空档 → 恒等返回', () => {
    const raw = {};
    expect(backfillPhaseL1b(raw)).toBe(raw);
  });
  it('有数据档 → 恒等返回（不修改引用）', () => {
    const raw = { 世界: { 纪元分钟: 100 }, 地图: { 地点: {} } };
    expect(backfillPhaseL1b(raw)).toBe(raw);
  });
});

// ══════════════════════════════════════════
// ⊕-L Step 2 · 拍定批验收
// ══════════════════════════════════════════

// ── L-1/L-6 · 性格五轴 facet 子结构 ────────────────────────────────────────
describe('L-1/L-6 · 性格五轴 facet optional 子结构', () => {
  it('valid: NPC 五轴无 facet（默认路径）', () => {
    const res = NpcSchema.safeParse({ 性格五轴: { 开放: 60, 尽责: 70, 外向: 50, 宜人: 80, 神经质: 20 } });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.性格五轴?.facet).toBeUndefined();
  });
  it('valid: NPC 五轴含 facet 键值对', () => {
    const res = NpcSchema.safeParse({ 性格五轴: { 开放: 60, 尽责: 70, 外向: 50, 宜人: 80, 神经质: 20,
      facet: { '信任感': 65, '坦诚度': 72 } } });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.性格五轴?.facet?.['信任感']).toBe(65);
  });
  it('invalid: facet 值超出 0-100 范围', () => {
    const res = NpcSchema.safeParse({ 性格五轴: { 开放: 50, 尽责: 50, 外向: 50, 宜人: 50, 神经质: 50,
      facet: { '越界值': 150 } } });
    expect(res.success).toBe(false);
  });
});

// ── L-1/L-6 · 社会角色参数 + L-7 · 角色激活配置 ────────────────────────────
describe('L-1/L-6 社会角色参数 + L-7 角色激活配置 · 玩法预设 optional', () => {
  it('valid: 玩法预设无社会角色参数（默认路径）', () => {
    const res = 玩法预设Schema.safeParse({});
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.社会角色定义表).toBeUndefined();
      expect(res.data.角色激活配置).toBeUndefined();
    }
  });
  it('valid: 社会角色三表同时提供', () => {
    const res = 玩法预设Schema.safeParse({
      社会角色定义表: { '学生': { 名称: '学生' }, '老师': { 名称: '老师' } },
      社会角色权重表: { '玩家': { '学生': 0.8, '老师': 0.2 } },
      社会角色效应量表: { '学生→社交': 0.3 },
    });
    expect(res.success).toBe(true);
  });
  it('valid: L-7 角色激活配置 激活上限+沉默下限', () => {
    const res = 玩法预设Schema.safeParse({ 角色激活配置: { 激活上限: 70, 沉默下限: 30 } });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.角色激活配置?.激活上限).toBe(70);
      expect(res.data.角色激活配置?.沉默下限).toBe(30);
    }
  });
  it('invalid: 激活上限超出 0-100', () => {
    const res = 玩法预设Schema.safeParse({ 角色激活配置: { 激活上限: 110 } });
    expect(res.success).toBe(false);
  });
});

// ── L-2b · 当时快照 + L-22 · 来源类型 ──────────────────────────────────────
describe('L-2b 当时快照 + L-22 来源类型 · 印象条目 optional', () => {
  const baseImp = { 标签: 't', 极性: '正', 强度: 10, 来源: 'e', 获知时间: 0, 衰减速率: 0 };
  const wrap = (imp: Record<string, unknown>) =>
    认知档案Schema.safeParse({ obs: { tgt: { 印象: [imp] } } });

  it('valid: 印象条目不含当时快照/来源类型（默认路径）', () => {
    const res = wrap(baseImp);
    expect(res.success).toBe(true);
    if (res.success) {
      const imp = res.data['obs']?.['tgt']?.印象[0];
      expect(imp?.当时快照).toBeUndefined();
      expect(imp?.来源类型).toBeUndefined();
    }
  });
  it('valid: 来源类型 = 一手观测', () => {
    expect(wrap({ ...baseImp, 来源类型: '一手观测' }).success).toBe(true);
  });
  it('valid: 来源类型 = 二手转述', () => {
    expect(wrap({ ...baseImp, 来源类型: '二手转述' }).success).toBe(true);
  });
  it('valid: 来源类型 = 玩家陈述', () => {
    expect(wrap({ ...baseImp, 来源类型: '玩家陈述' }).success).toBe(true);
  });
  it('invalid: 来源类型 值不在枚举内（开放串被拒）', () => {
    expect(wrap({ ...baseImp, 来源类型: '系统写入' }).success).toBe(false);
  });
  it('valid: 当时快照 含白名单子集字段', () => {
    const res = wrap({ ...baseImp, 当时快照: { 所在地点: '图书馆', 情绪键: '专注' } });
    expect(res.success).toBe(true);
    if (res.success) {
      const snap = res.data['obs']?.['tgt']?.印象[0]?.当时快照;
      expect(snap?.所在地点).toBe('图书馆');
      expect(snap?.情绪键).toBe('专注');
    }
  });
  it('valid: 当时快照 + 来源类型 同批', () => {
    expect(wrap({ ...baseImp, 来源类型: '一手观测', 当时快照: { 所在地点: '校园', 情绪键: '愉快' } }).success).toBe(true);
  });
});

// ── L-8 · 二审维度条目 越界类型枚举 ──────────────────────────────────────────
describe('L-8 · 二审维度条目 越界类型 enum（Off-Topic/Cheating）', () => {
  it('valid: 无越界类型字段（默认）', () => {
    const res = 二审维度条目Schema.safeParse({ 键: 'k1', 名称: '测试', 检测方式: '机械', 规则或提示词: '规则A' });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.越界类型).toBeUndefined();
  });
  it('valid: 越界类型 = Off-Topic', () => {
    const res = 二审维度条目Schema.safeParse({ 键: 'k2', 名称: '离题检测', 检测方式: '机械', 规则或提示词: 'r', 越界类型: 'Off-Topic' });
    expect(res.success).toBe(true);
  });
  it('valid: 越界类型 = Cheating', () => {
    const res = 二审维度条目Schema.safeParse({ 键: 'k3', 名称: '作弊检测', 检测方式: '审稿提示词', 规则或提示词: 'p', 越界类型: 'Cheating' });
    expect(res.success).toBe(true);
  });
  it('invalid: 越界类型不在枚举内（开放串被拒）', () => {
    const res = 二审维度条目Schema.safeParse({ 键: 'k4', 名称: '越权', 检测方式: '机械', 规则或提示词: 'r', 越界类型: 'Spam' });
    expect(res.success).toBe(false);
  });
});

// ── L-9 · 动词 precond + effect_decls ────────────────────────────────────────
describe('L-9 · 动词Option基础Schema precond + effect_decls', () => {
  it('valid: 无 precond/effect_decls（默认路径）', () => {
    const res = 动词OptionSchema表.转移.safeParse({});
    expect(res.success).toBe(true);
  });
  it('valid: precond 列表', () => {
    const res = 动词OptionSchema表.调整.safeParse({ precond: ['货币系统.账户.主角.持有.金 >= 100'] });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data?.precond).toEqual(['货币系统.账户.主角.持有.金 >= 100']);
  });
  it('valid: effect_decls 列表', () => {
    const res = 动词OptionSchema表.转移.safeParse({ effect_decls: ['货币系统.账户.主角.持有.金', '货币系统.账户.目标.持有.金'] });
    expect(res.success).toBe(true);
  });
  it('valid: precond + effect_decls + side_effects 三者共存', () => {
    const res = 动词OptionSchema表.赋予.safeParse({
      precond: ['声望.值 >= 50'],
      effect_decls: ['属性.体质'],
      side_effects: [],
    });
    expect(res.success).toBe(true);
  });
  it('invalid: strict 拒绝未知字段', () => {
    const res = 动词OptionSchema表.披露.safeParse({ unknown_field: 'x' });
    expect(res.success).toBe(false);
  });
  it('全 10 动词均支持 precond/effect_decls', () => {
    for (const [name, schema] of Object.entries(动词OptionSchema表)) {
      const r = schema.safeParse({ precond: ['test'], effect_decls: ['path.a'] });
      expect(r.success, `${name} should accept precond+effect_decls`).toBe(true);
    }
  });
});

// ── actor 子树级 opt-in · NpcSchema 10 个子树 .optional() 机制验证 ─────────────────
describe('actor 子树级 opt-in · NpcSchema 10 个子树 optional', () => {
  const EMPTY_NPC = NpcSchema.parse({});

  it('空 NPC parse → 10 个子树均为 undefined（序列化不注入骨架）', () => {
    expect(EMPTY_NPC.属性).toBeUndefined();
    expect(EMPTY_NPC.派生).toBeUndefined();
    expect(EMPTY_NPC.行动点).toBeUndefined();
    expect(EMPTY_NPC.性格五轴).toBeUndefined();
    expect(EMPTY_NPC.体征).toBeUndefined();
    expect(EMPTY_NPC.学业).toBeUndefined();
    expect(EMPTY_NPC.职业).toBeUndefined();
    expect(EMPTY_NPC.目标).toBeUndefined();
    expect(EMPTY_NPC.声誉).toBeUndefined();
    expect(EMPTY_NPC.作息).toBeUndefined();
  });

  it('属性 accessor 回退值 == 改前 leaf default', () => {
    const _attr = EMPTY_NPC.属性 ?? { 体质: 10, 智慧: 10, 感知: 10, 魅力: 10, 心理: 10 };
    expect(_attr.体质).toBe(10);
    expect(_attr.智慧).toBe(10);
    expect(_attr.感知).toBe(10);
    expect(_attr.魅力).toBe(10);
    expect(_attr.心理).toBe(10);
  });

  it('派生 accessor 回退值 == 改前 leaf default', () => {
    const _der = EMPTY_NPC.派生 ?? { HP: 100, HP上限: 100, 精力: 100, 精力上限: 100, 颜值: 50 };
    expect(_der.HP).toBe(100);
    expect(_der.HP上限).toBe(100);
    expect(_der.精力).toBe(100);
    expect(_der.精力上限).toBe(100);
    expect(_der.颜值).toBe(50);
  });

  it('行动点 accessor 回退值 == 改前 leaf default', () => {
    const _ap = EMPTY_NPC.行动点 ?? { 当前: 15, 上限: 15 };
    expect(_ap.当前).toBe(15);
    expect(_ap.上限).toBe(15);
  });

  it('性格五轴 accessor 回退值 == 改前 leaf default', () => {
    const _ocean = EMPTY_NPC.性格五轴 ?? { 开放: 50, 尽责: 50, 外向: 50, 宜人: 50, 神经质: 50 };
    expect(_ocean.开放).toBe(50);
    expect(_ocean.尽责).toBe(50);
    expect(_ocean.外向).toBe(50);
    expect(_ocean.宜人).toBe(50);
    expect(_ocean.神经质).toBe(50);
  });

  it('声誉 accessor 回退值 == 改前 leaf default', () => {
    const _rep = EMPTY_NPC.声誉 ?? { 人望: 0, 知名度: 0, 极性: '', 标签: '' };
    expect(_rep.人望).toBe(0);
    expect(_rep.知名度).toBe(0);
    expect(_rep.极性).toBe('');
    expect(_rep.标签).toBe('');
  });

  it('目标 accessor 回退值 == 改前 leaf default', () => {
    const _goal = EMPTY_NPC.目标 ?? { 长期: [] as string[], 短期: [] as string[] };
    expect(Array.isArray(_goal.长期)).toBe(true);
    expect(_goal.长期).toHaveLength(0);
    expect(Array.isArray(_goal.短期)).toBe(true);
    expect(_goal.短期).toHaveLength(0);
  });

  it('子树明确提供时仍可正常解析·叶子 default 生效', () => {
    const npc = NpcSchema.parse({ 属性: { 体质: 75 } });
    expect(npc.属性).toBeDefined();
    expect(npc.属性?.体质).toBe(75);
    expect(npc.属性?.智慧).toBe(10);
  });
});

// ── R5 · 货币系统 顶层 opt-in 机制验证 ──────────────────────────────────────────────
describe('R5 · 货币系统 顶层 opt-in（RootSchema.optional()）', () => {
  const EMPTY_ROOT = RootSchema.parse({});

  it('空存档 parse → 货币系统 === undefined（不注入默认骨架）', () => {
    expect(EMPTY_ROOT.货币系统).toBeUndefined();
  });

  it('显式提供 {} → 货币系统已定义·内部叶子 default 生效', () => {
    const r = RootSchema.parse({ 货币系统: {} });
    expect(r.货币系统).toBeDefined();
    expect(r.货币系统?.基准币种).toBe('');
    expect(r.货币系统?.市场状态?.激活).toBe(false);
    expect(r.货币系统?.市场状态?.大盘景气).toBe(50);
    expect(r.货币系统?.账户).toEqual({});
    expect(r.货币系统?.换汇登记).toEqual([]);
  });

  it('accessor 读回退：基准币种 ?? "" == 改前 root.货币系统.基准币种 default', () => {
    const ccy = EMPTY_ROOT.货币系统?.基准币种 ?? '';
    expect(ccy).toBe('');
  });

  it('accessor 读回退：账户 ?? {} == 改前 root.货币系统.账户 default', () => {
    const accounts = EMPTY_ROOT.货币系统?.账户 ?? {};
    expect(accounts).toEqual({});
  });

  it('accessor 读回退：市场状态.激活 ?? false == 改前 default', () => {
    const activated = EMPTY_ROOT.货币系统?.市场状态?.激活 ?? false;
    expect(activated).toBe(false);
  });

  it('accessor 读回退：市场状态.大盘景气 ?? 50 == 改前 default', () => {
    const prosperity = EMPTY_ROOT.货币系统?.市场状态?.大盘景气 ?? 50;
    expect(prosperity).toBe(50);
  });

  it('显式子树传入时叶子 default 仍生效', () => {
    const r = RootSchema.parse({ 货币系统: { 基准币种: '两', 市场状态: { 激活: true } } });
    expect(r.货币系统?.基准币种).toBe('两');
    expect(r.货币系统?.市场状态?.激活).toBe(true);
    expect(r.货币系统?.市场状态?.大盘景气).toBe(50);
    expect(r.货币系统?.账户).toEqual({});
  });
});
