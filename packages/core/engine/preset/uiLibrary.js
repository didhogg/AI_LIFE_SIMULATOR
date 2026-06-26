// PR-瘦身·UI库 · additive · dormant · 进内容哈希 · 不进 hashJudgmentBundle
// schemaKeys 守恒 52：UI库属装配层·不进 RootSchema
// 渲染面：引擎零 dispatch·前端按开放键路由·配置/渲染位完全 opaque
// 纯 schema + 类型·无副作用·禁 Date.now / new Date / Math.random / window / document
import { z } from 'zod';
const UI_ID正则 = /^[a-z][a-z0-9_]*$/;
// ── UI条目 ── typed 信封 + open-typed 渲染载荷 ──────────────────────────────────
// 信封字段 typed（resolve 三层校验 + json_schema 闸可跑）
// 渲染位/配置 = opaque z.record(z.string(), z.unknown())·引擎绝不校验内部
export const UI条目Schema = z.object({
    // 薄信封（typed·供 resolve/导入校验·非判定）
    名称: z.string(),
    版本: z.string().optional(),
    作者: z.string().optional(),
    描述: z.string().optional(),
    内容哈希: z.string().optional(), // mod 可复现面·进内容包哈希（computeEffectPackHash）
    // 开放类型（去枚举·铁律②③·引擎零 dispatch·前端按开放键路由）
    类型: z.string(),
    // 引用即授权（按 ID 引用·走命名空间前缀·R10-b）
    // 工具库/媒体库/option_set库 尚未建 → 解析器键 undefined → 解引用 fail-open 返 null
    option引用: z.array(z.string()).optional(), // option_id → option_set库
    工具引用: z.array(z.string()).optional(), // 工具ID → 工具库
    媒体引用: z.array(z.string()).optional(), // 媒体ID → 媒体库
    子组件: z.array(z.string()).optional(), // UI_ID → 嵌套其它 UI条目（resolve BFS 展开）
    // 渲染载荷（不透明·引擎零解释·不进指纹·守作者 UI 自由）
    渲染位: z.record(z.string(), z.unknown()).optional(), // 媒体/子组件填充位（对接 PR-5f-2 渲染位）
    配置: z.record(z.string(), z.unknown()).optional(), // props/样式/主题 token·完全开放
});
// ── UI库 = record<UI_ID, UI条目>.default({}) ──────────────────────────────────
export const UI库Schema = z.record(z.string().regex(UI_ID正则, { message: 'UI_ID 须为蛇形 /^[a-z][a-z0-9_]*$/' }), UI条目Schema).default({});
// 导出正则供测试/导入闸复用
export { UI_ID正则 };
