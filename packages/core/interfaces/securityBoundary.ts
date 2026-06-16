/* eslint-disable @typescript-eslint/no-unused-vars */
// 批④ 安全边界钉死 · 薄壳模块（外层声明·零运行时·零 import·零接线）
//
// 四样纯声明 / 签名 stub，对应四个安全子域：
//   子域1 导出剥离敏感键集合
//   子域2 IM4 同源隔离契约常量
//   子域3 主权地板事件集合（集合声明侧；真 schema 占位 Step 3 落·actor.ts 添字段）
//   子域4 effect 五道闸契约签名 stub
//
// 编译期断言（活绑 dollar.ts·正交核心调用·主权集覆盖）落独立 test 文件：
//   packages/core/tests/securityBoundary.test.ts（core 侧·5 条断言）
//   hosts/slice/tests/securityBoundaryOrthogonality.test.ts（slice 侧·3 条正交断言）
//
// Defer-P0-6/P0-7 逐条明文：
//   A. 导出剥离 fire（子域1）：存档导出/分享/封存时真剥离 $模型画像层或显式掩盖 baseURL/apiKeyRef/modelId/protocol—留 P0-6 导出管线。
//   B. CSP 响应头 + sandbox iframe + 声明式 HTML/CSS 净化器（子域2）：IM4 沙箱 iframe / HTML 净化 / CSP 响应头禁 unsafe-inline—留 P0-6 导入闸 + P1 前端。
//   C. 强制降级「需确认」fire + 凌驾抢话档（子域3）：不可逆事件运行时 fire—留 P0-7 主体（复用 N-8 自动暂停演出层）·P0-5 配合。
//   D. effect deltas 过五道闸钳制 fire + 受补丁 clamp/lock 约束（子域4）：① Zod 形状 → ② 白名单 → ③ 前缀权限 → ④ 钳制 → ⑤ 原子提交。
//      钳制细则：单次Δ上限·补丁 clamp/lock 取严先于内容·money_delta 不穿透账面下界锁—留 P0-6。
//
// 红线：本文件绝不 import 任何模块（含 rng.ts/gate.ts/fingerprintManifest.ts/RootSchema/intervention_pack）。

// ══════════════════════════════════════════
// 子域1 · 导出剥离敏感键集合
// ══════════════════════════════════════════
// 契约：存档导出/分享/封存时这些键必须剥离或掩盖（bugs.md:303·对撞②）。
// 字段名取自 $模型画像Schema.反代端点档 实测（dollar.ts:201-204）。
// 真剥离 fire 留 P0-6（导出管线）；本常量仅供编译期断言与 P0-6 取用。

export const 导出剥离敏感键 = ['baseURL', 'apiKeyRef', 'modelId', 'protocol'] as const;
export type 导出剥离敏感键名 = (typeof 导出剥离敏感键)[number];

// ══════════════════════════════════════════
// 子域3 · 主权地板事件集合（集合声明侧）
// ══════════════════════════════════════════
// 契约：这些事件强制降「需确认」凌驾抢话档（new handbook.md:366）。
// 关键 NPC 离场 = MVP OUT·不列入；强制降级 fire 留 P0-7 主体·P0-5 schema 占位 Step 3 落。

export const 主权地板事件 = ['死亡', '婚姻', '血脉绑定', '绑架', '永久失核心资产'] as const;
export type 主权地板事件名 = (typeof 主权地板事件)[number];

// ══════════════════════════════════════════
// 子域2 · IM4 同源隔离契约常量
// ══════════════════════════════════════════
// 契约：永禁第三方 JS 主页面同源裸跑（泄 API key／篡改存档／冒充玩家发请求）。
// 两条合法开法：
//   ① 声明式 HTML/CSS（IM4 净化·无 script·纯展示）
//   ② 沙箱 iframe（跨域隔离·JS 拿不到 token/DOM/存档·同 Notion HTML 附件机制）
// CSP/sandbox 实装留 P0-6 导入闸/P1 前端。

export const IM4同源隔离契约 = {
  永禁第三方JS同源裸跑: true,
  安全开法: ['声明式HTML_CSS净化无script', '沙箱iframe跨域隔离'],
} as const;

// ══════════════════════════════════════════
// 子域4 · effect 五道闸契约签名 stub
// ══════════════════════════════════════════
// 五道闸接入口径（详规留 P0-6·此处注释占位）：
//   ① Zod 形状校验（intervention_pack_delta 条目 schema 已有形态 refine）
//   ② 白名单（schema 派生·path 须在受治理键空间内）
//   ③ 前缀权限（$ 层字段禁写）
//   ④ 钳制：单次Δ上限（max_delta）·补丁取严先于内容·money_delta 不穿透账面下界锁
//   ⑤ 原子提交 + 覆写日志
// 真钳制 fire / 白名单 fire 留 P0-6；本 stub 只冻结入参形态契约供编译期断言。

export function 校验effect包过五道闸(
  _包: {
    deltas?: ReadonlyArray<{
      path?: string;
      value?: unknown;
      max_delta?: number;
    }>;
  },
): string {
  throw new Error('校验effect包过五道闸：未接线·留 P0-6（焊死前批④ 仅签名 stub）');
}
