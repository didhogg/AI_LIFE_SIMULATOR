// 账面安全界限（H1·入账前 clamp·数值住预设）
// 键=字段路径（"属性.体质" / "货币.金币" 等）；越软顶→ clamp + ⚠播报
// 空表=仅依赖 kv 层约束；不进 hashJudgmentBundle（属安全执行层·非判定面）
// dormant: 不接 runTick · 不进 hashPresetFingerprint / hashJudgmentBundle
// 纯 schema·无副作用·禁 Date.now/Math.random/window/document
import { z } from 'zod';

const 账面安全界限条目Schema = z.object({
  硬底: z.number().optional(),                       // 低于则 clamp（兜底）
  软顶: z.number().optional(),                       // 超过则 clamp + 广播 ⚠
  硬顶: z.number().optional(),                       // 超过则 clamp（更严·无播报）
  年化增长率警戒线: z.number().min(0).optional(),   // warnAnnualRate 触发阈值（缺省 1.0）
}).strip();

export const 账面安全界限Schema = z.record(z.string(), 账面安全界限条目Schema).default({});
