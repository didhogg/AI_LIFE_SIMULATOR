// 内容包内容内层形状（单一源·供 preset 局部覆盖取 deepPartial）
// 仅 import z·无 RootSchema·无 superRefine·无环
// dormant: 不接 runTick·不进 hashPresetFingerprint / hashJudgmentBundle
import { z } from 'zod';
export const 内容包内容ShapeSchema = z.object({
    模块种子: z.record(z.string(), z.unknown()).optional(),
});
