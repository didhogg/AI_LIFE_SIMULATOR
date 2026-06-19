// 6.59 受治理键空间批（序②）· S1 注册表 schema
// 统一单表＋命名空间判别：不分表，靠 键条目.命名空间 字段区分子空间
// 本步纪律：纯加 schema，不写 refine 校验（留 Step 6/7）、不 fire 任何闸、
//   不改 fingerprintManifest.ts、不挂 RootSchema/BLUEPRINT_KEYS（留接线步）
// 前瞻约束（本步不做·schema 形态要兼容）：将来挂载走「新顶层 key」路径，
//   绝不挂进 preset.ts 等已在 FINGERPRINT_BUNDLE_MEMBERS 取材集的父结构——
//   新顶层 key 不写任何 fingerprint 数组 = 隐性排除·默认不进指纹。
import { z } from 'zod';
import { normalizeNFKC } from '../engine/text/normalize.js';
import { RE_ZERO_WIDTH } from '../engine/text/chineseNumber.js';

// ══════════════════════════════════════════
// 🎯② 码位规范化纯函数（S3·复用既有原语·不重写·不改其行为）
// 组合：normalizeNFKC（normalize.ts·全半角折叠+兼容分解，复用 chineseNumber.ts:21
//   prepareNarrative 同款原语·禁裸 .normalize()）→ 去零宽（chineseNumber.ts RE_ZERO_WIDTH）→ trim
// Step 5b：首步 NFC→NFKC（NFKC ⊋ NFC，既做规范组合又做兼容折叠，如 Ａ→A / １→1）。
// 纯函数：无 I/O·无副作用·无随机·无时间·无全局态·确定性·同输入恒同输出。
// 本步零接线：不进确定性引擎/指纹取材/结算热路径，不在任何闸/写入口调用。
// S3 双卡口已接：读 normalizeRegistryKeyNames @ migrate.ts:1157（5caaac9·B5）/ 写 assertGovernedKeysNormalized @ migrate.ts:1238（2872c24·B6）。
// TODO(P0-6)：繁简只警示非规范化·需简繁对照表·本步不做（已拍降级 P0-6）。
// ══════════════════════════════════════════

export function 规范化键码位(raw: string): string {
  let s = normalizeNFKC(raw);
  s = s.replace(RE_ZERO_WIDTH, '');
  return s.trim();
}

// ══════════════════════════════════════════
// AA4 JS 保留键黑名单（原型污染防护·常量 + helper）
// fire 已由 S3 写卡口实装（migration/migrate.ts · checkS3WriteGate · fail-open）。
// ══════════════════════════════════════════

export const JS保留键黑名单 = Object.freeze(['__proto__', 'constructor', 'prototype'] as const);

export function 是JS保留键(key: string): boolean {
  return (JS保留键黑名单 as readonly string[]).includes(key);
}

// ══════════════════════════════════════════
// 受治理路径 Schema（Step 6·effect 包 deltas[].path add-constraint·零迁移·fail-open）
// 拍板口径 (a)+(c)：本步 schema 期只做「形态」refine（归一非空 ∧ 非 JS 保留键 ∧ 符合命名正则），
//   不查具体注册表成员——registry 是 schema 形状，没有运行时「已注册键集合」可查，
//   天然 fail-open（无成员表即只验形态，永不因 registry 空而拒绝合法路径）。
// 存储形状不变：z.string() + .superRefine，z.infer 仍是 string，零迁移。
// TODO(P0-6)：against 受治理键空间注册表Schema 实际成员的导入闸 fire 留 P0-6·
//   registry 未populate 前 fail-open（成员表为空集 = 不拒绝任何已通过形态校验的 path）。
// ══════════════════════════════════════════

// 路径段命名正则：每段允许字母/数字/下划线/任意语言文字（含中文），不允许空段
const 路径段命名正则 = /^[\p{L}\p{N}_]+$/u;

export const 受治理路径Schema = z.string().superRefine((raw, ctx) => {
  const normalized = 规范化键码位(raw);
  if (normalized === '') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '受治理路径: 归一后为空（纯空白/纯零宽不可作路径）' });
    return;
  }
  const segments = normalized.split('.');
  for (const seg of segments) {
    if (seg === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: '受治理路径: 含空段（连续点号或首尾点号）' });
      return;
    }
    if (是JS保留键(seg)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `受治理路径: 路径段命中 JS 保留键黑名单「${seg}」` });
      return;
    }
    if (!路径段命名正则.test(seg)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `受治理路径: 路径段「${seg}」不符合命名正则` });
      return;
    }
  }
  // registry 成员级校验：本步不查（fail-open，留 P0-6 导入闸 fire）
});

// ══════════════════════════════════════════
// 受治理句柄 Schema（Step 7·handlerRef add-constraint·零迁移·fail-open）
// 拍板：① 解除通道 已收紧为受治理句柄（B6·拦截器句柄第13槽·本批落）；② 扁平单 token（禁内部点号）；
//   ③ 单一共享 schema（side_effects·cascade_on_change·解除通道 共用）。
// 与 受治理路径Schema 同构，但整串当单段校验（不 .split('.')）——handler 键必须恰好一个合法段。
// 同样不查 registry 成员，天然 fail-open；存储形状不变：z.string() + .superRefine，z.infer 仍 string。
// TODO(P0-6)：against 受治理键空间注册表Schema 实际成员
//   （命名空间='sideEffect句柄'/'cascade句柄'/'拦截器句柄'）
//   的导入闸 fire 留 P0-6·registry 未 populate 前 fail-open。
// ══════════════════════════════════════════

export const 受治理句柄Schema = z.string().superRefine((raw, ctx) => {
  const normalized = 规范化键码位(raw);
  if (normalized === '') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '受治理句柄: 归一后为空（纯空白/纯零宽不可作句柄）' });
    return;
  }
  if (是JS保留键(normalized)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `受治理句柄: 命中 JS 保留键黑名单「${normalized}」` });
    return;
  }
  if (!路径段命名正则.test(normalized)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `受治理句柄: 「${normalized}」不符合扁平命名正则（禁内部点号等符号·扁平单 token 纪律）` });
    return;
  }
  // registry 成员级校验：本步不查（fail-open，留 P0-6 导入闸 fire）
});

// ══════════════════════════════════════════
// 命名空间枚举（封闭·13 项·到此锁定；B2·S4 解锁：+mod包；B6 +拦截器句柄）
// ══════════════════════════════════════════

export const 命名空间枚举 = [
  '币种',            // 引用既有 economy.ts:71 币种定义键·本步不重建
  '单位',            // economy.ts:9 嵌币种内·入册为子空间
  '稀有度',          // 统一 actor.ts:70 + map.ts:14 两处·消重
  '地点类别',        // 合并「地图节点类型」与「地点.类别(区域级)·审计#13」为同一空间
  '标的类型',
  '特质子类',
  '状态子类',
  'sideEffect句柄',  // verb.ts side_effects 的 handlerRef
  'cascade句柄',     // cascade_on_change 的 handlerRef
  '母题',            // 保留槽·fail-open 下 mod 自带母题天然放行·本步不 fire 不收紧
  '纪元',            // 保留占位·本步不入册数据
  'mod包',           // B2·S4·K6②：mod 条目命名空间化；mod 条目.命名空间 强约束 defer B2 拍板④
  '拦截器句柄',      // B6·verb.ts 不可逆Schema.解除通道·拦截解除机制受治理引用（成员级校验 fail-open·留 P0-6）
] as const;
export type 命名空间Type = (typeof 命名空间枚举)[number];

// ══════════════════════════════════════════
// 键条目 Schema（.strict() 防多余键）
// ══════════════════════════════════════════

export const 键条目Schema = z.object({
  规范键: z.string(),
  显示名: z.string().optional(),
  别名: z.array(z.string()).optional(),
  命名空间: z.enum(命名空间枚举),
  来源包: z.string().optional(),
  停用: z.boolean().optional(),
  不可变: z.boolean().optional(),
}).strict();
export type 键条目Type = z.infer<typeof 键条目Schema>;

// ══════════════════════════════════════════
// 注册表 Schema（统一单表·整体可空）
// ══════════════════════════════════════════

export const 受治理键空间注册表Schema = z.object({
  键条目: z.array(键条目Schema).optional(),
}).strict();
export type 受治理键空间注册表Type = z.infer<typeof 受治理键空间注册表Schema>;

// ══════════════════════════════════════════
// 归并条目 Schema（S1b·独立别名声明，补 S1 的 per-entry 键条目.别名[]）
// 用途：mod/包可在不重定义键条目的前提下，单独声明「别名→已存在规范键」的归并；
//   与 键条目.别名[] 并存，二者在 P0-6 归一时合并为同一别名图（本步不归一）。
// ══════════════════════════════════════════

export const 归并条目Schema = z.object({
  别名: z.string(),
  规范键: z.string(),
  命名空间: z.enum(命名空间枚举), // 复用 12 项枚举（B2·S4 加 mod包）
  来源包: z.string().optional(),
}).strict();
export type 归并条目Type = z.infer<typeof 归并条目Schema>;

// ══════════════════════════════════════════
// 归并表 Schema（整体可空·命名空间靠条目字段判别·不分表，与 S1 单表风格一致）
// ══════════════════════════════════════════

export const 归并表Schema = z.object({
  归并条目: z.array(归并条目Schema).optional(),
}).strict();
export type 归并表Type = z.infer<typeof 归并表Schema>;

// ══════════════════════════════════════════
// 跨包仲裁占位（S2·只埋位＋TODO·绝不实装·绝不接线）
// TODO(P0-6·S2)：跨包别名→规范键冲突的导入期仲裁 fire 逻辑·本步只埋 schema 位·不实装·不接线
// ══════════════════════════════════════════

export const 仲裁策略枚举 = ['先到先得', '来源包优先', '显式优先级', '报错待人工'] as const;
export type 仲裁策略Type = (typeof 仲裁策略枚举)[number];
export const 仲裁策略Schema = z.enum(仲裁策略枚举).optional();

// ══════════════════════════════════════════
// 母题写入口注册（S2·schema 位＋TODO·绝不 fire·绝不收紧 secret.ts 母题字段）
// 设计页 §十八.A 拍板：母题历史上从 9 类枚举主动开放化
//   （secret.ts:37 + dollar.ts:75-76「事件包可自带新母题·无需改 schema」＝有意为之的扩展口），
// 这是 §母题 命名空间（复用 Step1 命名空间='母题'）的可选登记结构，
// 与 secret.ts 开放 string 母题字段并存·不替换、不收紧；fail-open 下 mod 自带母题天然放行。
// TODO(P0-6·S2)：母题写入口注册闸 fire 逻辑（登记/校验/与 secret.ts 母题字段归一）留 P0-6·
//   本步只埋 schema 位·不 fire·不收紧 secret.ts 母题字段（保持开放·fail-open 下 mod 自带母题放行）·不接线。
// ══════════════════════════════════════════

export const 母题注册条目Schema = z.object({
  规范键: z.string(),
  显示名: z.string().optional(),
  别名: z.array(z.string()).optional(),
  来源包: z.string().optional(),
  // 写入口标记：仅声明该母题「期望经注册写入口登记」，本步不消费、不强制
  经注册写入口: z.boolean().optional(),
}).strict();
export type 母题注册条目Type = z.infer<typeof 母题注册条目Schema>;

export const 母题注册表Schema = z.object({
  母题条目: z.array(母题注册条目Schema).optional(),
}).strict();
export type 母题注册表Type = z.infer<typeof 母题注册表Schema>;

// ══════════════════════════════════════════
// 地点类别登记（审计#13·命名空间='地点类别'·复用 S1 11 项枚举，未新立命名空间）
// 勘察确认「地图节点类型」与「地点.类别(区域级)」概念重叠，合并为同一「地点类别」命名空间。
// map.ts:33-36 地点条目.类别 字段保持开放 string 不改形状——本步零迁移、不动 map.ts。
// 本特化 schema 只补「区域级标记」声明位，对应 map.ts 注释里
//   『类别取值为区域级的节点即区域』的隐性约定，本步不消费、不强制。
// TODO(P0-6/Step6-7)：map.ts 地点条目.类别 string→registry 收紧（add-constraint·fail-open）留后·
//   本步只登记 schema 位·不动 map.ts 存储形状·区域级判定 fire 留 P0-6。
// ══════════════════════════════════════════

export const 地点类别登记条目Schema = z.object({
  规范键: z.string(), // 即 map.ts 地点条目.类别 取值（如 '区域级'/'城镇'/...）
  显示名: z.string().optional(),
  别名: z.array(z.string()).optional(),
  来源包: z.string().optional(),
  区域级: z.boolean().optional(), // 仅声明·本步不消费·不强制
}).strict();
export type 地点类别登记条目Type = z.infer<typeof 地点类别登记条目Schema>;

export const 地点类别注册表Schema = z.object({
  地点类别条目: z.array(地点类别登记条目Schema).optional(),
}).strict();
export type 地点类别注册表Type = z.infer<typeof 地点类别注册表Schema>;
