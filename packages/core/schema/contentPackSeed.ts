// 内容包内容内层形状（单一源·供 preset 局部覆盖取 deepPartial）
// 仅 import z·无 RootSchema·无 superRefine·无环
// dormant: 不接 runTick·不进 hashPresetFingerprint / hashJudgmentBundle
import { z } from 'zod';

export const 内容包内容ShapeSchema = z.object({
  模块种子: z.record(z.string(), z.unknown()).optional(),
});

export type 内容包内容ShapeType = z.infer<typeof 内容包内容ShapeSchema>;

// PR-8 R-c · 结构化包引用（pack_id 必填·semver dormant 不接线·单一源）
export const 包引用Schema = z.object({
  pack_id: z.string(),
  semver: z.string().optional(), // dormant·本轮只存不读·接线留后续
});
export type 包引用Type = z.infer<typeof 包引用Schema>;
