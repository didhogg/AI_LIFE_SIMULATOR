/* eslint-disable @typescript-eslint/no-unused-vars */
// 受控接口能力集 [TOOL] 签名（对撞 stub·接线 P0-6）
// code → DSL/签名 Resolver（禁内嵌任意 JS）
// llm  → 过五道闸+世代号
// 内置 roll_dice, trigger, output_tag

export type ToolCapabilityType = 'code' | 'llm' | 'roll_dice' | 'trigger' | 'output_tag';

export interface ToolCapabilityDescriptor {
  readonly type:        ToolCapabilityType;
  /** 触发点: planning（拍前）/ post_pipeline（拍后） */
  readonly trigger?:    'planning' | 'post_pipeline';
  readonly outputTag?:  string;
  readonly namespace?:  string;
}

/** 执行能力调用（未实装）。 */
export function executeToolCapability(_desc: ToolCapabilityDescriptor, _params: Record<string, unknown>): never {
  throw new Error('未实装: [TOOL] 能力调用 (P0-6)');
}
