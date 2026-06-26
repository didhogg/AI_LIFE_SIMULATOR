// PR-瘦身·成就库 · additive · dormant · 进内容哈希 · 不进 hashJudgmentBundle
// schemaKeys 守恒 52：成就库属装配层·不进 RootSchema
// 成就定义层（作者声明）⊥ actor.成就（per-actor 运行期解锁状态）·零打架
// 纯 schema + 类型·无副作用·禁 Date.now / new Date / Math.random / window / document
import { z } from 'zod';
import { 谓词串Schema } from './commonEntry.js';
export const 成就ID正则 = /^[a-z][a-z0-9_]*$/;
// ── 成就条目 ── 四层：信封 + 解锁判定层 + 展示层（opaque）──────────────────────
// ① 信封 typed（resolve 三层校验 + content_hash 可复现面）
// ② 解锁判定层·事实（typed seam·求值接线留 P0-6·本轮库 dormant·无消费者）
// ③ 徽章展示层·认知 opaque（显示名/图标/稀有度/flavor·引擎零解释·不进指纹）
export const 成就条目Schema = z.object({
    // ① 信封
    名称: z.string(),
    版本: z.string().optional(),
    作者: z.string().optional(),
    描述: z.string().optional(),
    内容哈希: z.string().optional(), // mod 可复现面·进内容包哈希（computeEffectPackHash）
    // ② 解锁判定层（typed seam·dormant·P0-6 接线求值器）
    解锁条件引用: 谓词串Schema.optional(), // DSL gate·纯数值/限深1·求值接线留 P0-6
    成就类型: z.string().optional(), // 开放字符串·去枚举·守玩家主权③
    // 解锁后果：复用 intervention_pack_delta 形态（op=set/add/sub/clamp/lock）·不新造后果枚举
    // 完整校验留 P0-6 接线时与 intervention_pack_delta条目Schema 对齐
    解锁后果引用: z.array(z.unknown()).optional(),
    // ③ 徽章展示层·认知 opaque（引擎零解释·不进指纹·守作者自由）
    徽章展示: z.record(z.string(), z.unknown()).optional(),
});
// ── 成就库 = record<成就ID, 成就条目>.default({}) ─────────────────────────────
export const 成就库Schema = z.record(z.string().regex(成就ID正则, { message: '成就ID 须为蛇形 /^[a-z][a-z0-9_]*$/' }), 成就条目Schema).default({});
