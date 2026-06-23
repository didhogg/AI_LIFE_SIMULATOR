// 动词表（语义动词收敛·8 根/10 标识·P0-6 焊死前 schema-only 黄金窗口预埋）
// 口径：转移·缔结·解除·赋予·剥夺·调整·披露·移动·施加·植入
// 本批 = Step 1–5（verbId 枚举 + 各动词 option schema 占位 + 目标槽字段 +
//   side_effects 两层槽 + 不可逆 flag + 通道 A 五类「形」+ 通道 B 占位）
// 纪律：纯声明·禁内联任意 JS（R6-a）·本批零接线·零迁移
//   — 不挂 RootSchema（未被任何 index.ts BLUEPRINT_KEYS/RootSchema 字段引用）
//   — 不写/不改 migrate.ts，不影响任何既有存档数据形状
//
// 通道 A 五类扩展点（设计稿 §十四·锚定不再加第六类）—— Step 5 起五类「形」全部到位：
//   1. 标的类型：动词 option 的 标的类型? 键（本节下方）
//   2. 特质/状态标签子类：复用 actor.ts 特质条目Schema/状态标签条目Schema 的 不可逆? 宿主，
//      新增 子类键? 占位（不新建表，见 actor.ts 改动）
//   3. side_effect 选键：动词 option.side_effects?（Step 3-B 已落）
//   4. 选择器：动词目标槽Schema（Step 2 已落）
//   5. option 参数：各 xxxOptionSchema 现有 .strict() 占位结构（Step 1 已落）
// 本步只落占位「形」+ TODO 注释，不写任何校验/派生/闸逻辑。
//
// 键空间踢出：币种/单位/纪元/地图节点类型/稀有度枚举等「定义型记录」（被 option 引用的值域本身）
// 不属于动词活壳，也不在本步落地，统一归 6.59 受治理键空间批（序②）。
//
// 通道 B（签名代码插件）：接口占位见 interfaces/verbSignedCodePlugin.ts，默认关、未实装、
// 本批不接任何真实执行逻辑。
import { z } from 'zod';
import { 受治理句柄Schema } from './governedKeySpace.js';
// ══════════════════════════════════════════
// verbId 枚举（10 标识·冻结集合·不开放扩展）
// ══════════════════════════════════════════
export const 动词Id枚举 = [
    '转移', '缔结', '解除', '赋予', '剥夺', '调整', '披露', '移动', '施加', '植入',
];
// ══════════════════════════════════════════
// 目标槽（两态合一·开放串）
// 单实体字面键 | 受众选择器串 —— 与既有 受众选择器/参与者选择器/成员 同口径
// （schema/secret.ts 受众选择器、schema/preset.ts 受众选择器/参与者选择器、
//   schema/org.ts 成员、engine/knowledgeFilter.ts MVP 字面键匹配）
// schema 层不分叉：是否为选择器（含通配符/谓词关键字）由运行时判别式区分，
// 按实体真键字典序展开·无随机源 —— 展开逻辑本批不接线，留 P0-6/P0-7。
// ══════════════════════════════════════════
export const 动词目标槽Schema = z.string().default('');
// ══════════════════════════════════════════
// 各动词 option schema（通道 A·option 参数 + side_effect 选键扩展点）
// 每个动词独立 schema，便于后续批次按动词语义各自 .extend()，不互相牵连。
// .strict()：除 side_effects 外未拍板任何字段前，禁止裸写任意键，
//   防止悄悄塞进未经治理的参数。
//
// side_effects（B 轴·动作耦合）：由动作语义本身触发的级联 handler 键列表。
// 元素(handlerRef) Step 7(6.59)：形态 refine 已收紧（归一非空∧非JS保留键∧扁平命名正则）·
//   成员校验 against registry 留 P0-6（命名空间='sideEffect句柄'）。
// ══════════════════════════════════════════
const 动词Option基础Schema = z.object({
    side_effects: z.array(受治理句柄Schema).optional(), // Step 7：形态 refine 已收紧·成员校验留 P0-6（sideEffect句柄）
    // 通道 A·标的类型（单态串·不分叉·沿用既有选择器惯例，不新造文法）
    // 序②(6.59) 已收紧为受治理句柄Schema（形态约束·成员校验 defer P0-6·B6·Phase B-d）
    标的类型: 受治理句柄Schema.optional(),
    // L-9 · 前置条件（谓词列表·V3 单态目标槽配对·接线留 P0-7·⊥ side_effects）
    precond: z.array(z.string()).optional(),
    // L-9 · 效果声明（自我声明将触发的变更路径·V5 对称性·接线留 P0-7·⊥ side_effects受治理句柄）
    effect_decls: z.array(z.string()).optional(),
}).strict();
export const 转移OptionSchema = 动词Option基础Schema.optional();
export const 缔结OptionSchema = 动词Option基础Schema.optional();
export const 解除OptionSchema = 动词Option基础Schema.optional();
export const 赋予OptionSchema = 动词Option基础Schema.optional();
export const 剥夺OptionSchema = 动词Option基础Schema.optional();
export const 调整OptionSchema = 动词Option基础Schema.optional();
export const 披露OptionSchema = 动词Option基础Schema.optional();
export const 移动OptionSchema = 动词Option基础Schema.optional();
export const 施加OptionSchema = 动词Option基础Schema.optional();
export const 植入OptionSchema = 动词Option基础Schema.optional();
// verbId → option schema 的映射（按 动词Id枚举 同序排列·供后续批次按 id 索引取用）
// 注意：本对象本身不是 zod schema，不参与解析/校验，仅作编译期/运行时查表用的纯常量。
export const 动词OptionSchema表 = {
    转移: 转移OptionSchema,
    缔结: 缔结OptionSchema,
    解除: 解除OptionSchema,
    赋予: 赋予OptionSchema,
    剥夺: 剥夺OptionSchema,
    调整: 调整OptionSchema,
    披露: 披露OptionSchema,
    移动: 移动OptionSchema,
    施加: 施加OptionSchema,
    植入: 植入OptionSchema,
};
// ══════════════════════════════════════════
// 不可逆 flag（Step 4·本体不可逆子类·挂在 特质条目/状态标签条目 上，不挂动词）
// 分级靠「解除通道」有无（运行时契约，schema 只持有这两字段，零新增轴）：
//   无解除通道（死亡/血脉/种族等本体不可逆）→ 锁 "禁用"，不可下调；
//   有解除通道（断肢/灵根等）→ 默认 "禁用"，允许预设调到 "警示"。
// flag 只贴本体不可逆子类实例（死亡/断肢/致残/灵根/种族/血脉），
// 轻伤等可治愈项不带 flag（§十一 防过度标记）。
// ══════════════════════════════════════════
export const 重掷策略枚举Schema = z.enum(['禁用', '警示']);
export const 不可逆Schema = z.object({
    解除通道: 受治理句柄Schema.optional(), // B6·拦截器句柄第13槽·fail-open·成员级校验留P0-6
    重掷策略: 重掷策略枚举Schema.default('禁用'),
    主权降级: z.enum(['需确认', '凌驾抢话档']).optional(), // 主权地板占位·P0-7 fire（强制确认/凌驾抢话档·复用 N-8）·语义/层级 fire 时终定·全 .optional 无 default＝零迁移
}).strict();
