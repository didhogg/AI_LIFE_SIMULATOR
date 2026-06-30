// 4.10 玩法预设 / 引擎配置层（不进存档）
// 校验用 schema；实际运行时由世界装配 WORLD_SETUP 注入引擎，不序列化进存档。
import { z } from 'zod';
import { 谓词串Schema } from './commonEntry.js';
import { 内容包内容ShapeSchema, 包引用Schema } from './contentPackSeed.js';
// ── 导入保真度三档（对撞·mod/卡导入检验口径）─────────────────────────────────────────
// compat_strict = 旧版严格兼容（禁任何新字段）
// compat_plus   = 兼容+扩展（允许已知扩展字段·禁未知字段）
// native        = 原生 V4.1（完整 schema·最严格验证）
export const 导入保真度枚举 = ['compat_strict', 'compat_plus', 'native'];
// 6.41⑦ 注入面防护：超过此长度的模板正文/风格提示词导入时拒收
export const 叙事模板正文长度上限 = 4000;
// ══════════════════════════════════════════
// 玩法预设根（顶层）
// ══════════════════════════════════════════
export const 玩法预设Schema = z.object({
    // ── ① 骨架（拼装器/冰箱清单·没声明=不存在）────────────────────────────────────
    预设ID: z.string().default(''),
    名称: z.string().default(''),
    版本: z.string().default('0.1.0'),
    作者: z.string().default(''),
    描述: z.string().default(''),
    migration_version: z.number().int().min(0).default(0),
    // ── 薄清单（装配层·规则引用·由 resolve() 处理）─────────────────────────────────
    rules: z.array(z.string()).optional(), // 规则引用列表（按顺序·后列覆盖先载）
    // ── PR-0 · 预设元数据 v2（additive·空跑·消费留 G2 / PR-1~5）───────────────────
    父预设: z.string().optional(),
    创建时预设版本: z.string().optional(),
    派生标记: z.boolean().optional(),
    默认模板: z.boolean().optional(),
    // LOD-B2.5 · 模块绑定策略（additive·主权层·不接线·不进指纹·缺省=自由）
    // record key '*' = 全模块默认；per-module key 覆盖全局默认
    模块绑定策略: z.record(z.string(), z.object({
        绑定: z.enum(['锁定', '建议', '自由']).default('自由'),
    })).optional(),
    // 局部覆盖（additive·内容层·稀疏覆盖引用包种子·剥 superRefine 取内层 deepPartial·不接线·不进引擎指纹·缺省=不覆盖）
    局部覆盖: 内容包内容ShapeSchema.deepPartial().optional(),
    // PR-8 R-c · 引用包（additive·结构化 pack_id@semver·semver dormant 不接线·缺省=不参与·旧档 raw packs 经 shim 路径兼容）
    引用包: z.array(包引用Schema).optional(),
    // ── ③C STOPPED（DSL 版本·常量不匹配·待用户拍板后删）──────────────────────────
    DSL文法版本: z.string().default('1.0'),
    // §十A 分层方案·v1={min,max,clamp,pow,sqrt}全逐位恒等固定实现·增列超越函数时 bump
    求值器函数库版本: z.number().int().min(1).default(1),
});
