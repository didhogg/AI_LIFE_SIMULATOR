// M1 记账提案单 schema — testdemo.md §4.7
// 叙事 LLM 不碰此结构；记账 LLM 独立调用才输出
import { z } from 'zod';

export const TransferSchema = z.object({
  from:   z.string(),
  to:     z.string(),
  amount: z.number().int().positive(), // 正整数，单位：文钱
  reason: z.string().default(''),
});

export const CheckIntentSchema = z.object({
  actor:  z.string(),
  recipe: z.string(),
  intent: z.string().default(''),
});

export const KnowledgeItemSchema = z.object({
  fact:    z.string(),
  knownBy: z.array(z.string()).default([]),
});

export const TickProposalSchema = z.object({
  transfers: z.array(TransferSchema).default([]),
  checks:    z.array(CheckIntentSchema).default([]),
  knowledge: z.array(KnowledgeItemSchema).default([]),
});

export type Transfer     = z.infer<typeof TransferSchema>;
export type CheckIntent  = z.infer<typeof CheckIntentSchema>;
export type KnowledgeItem = z.infer<typeof KnowledgeItemSchema>;
export type TickProposal = z.infer<typeof TickProposalSchema>;
