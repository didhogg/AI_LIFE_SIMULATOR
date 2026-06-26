// PR-瘦身·母题配额库 · additive · dormant · 进 hashJudgmentBundle · 投影回填
// schemaKeys 守恒 52：母题配额库属装配层·不进 RootSchema
// 进 BUNDLE：投影母题配额库() 产出 与旧 母题配额Schema 逐位等价的 record·零重定基
//    dormant·投影结果需调用方主动传入 hashJudgmentBundle 的 母题配额 参数
// 纯 schema + 投影函数·无副作用·禁 Date.now / new Date / Math.random / window / document
import { z } from 'zod';

export const 母题配额ID正则 = /^[a-z][a-z0-9_]*$/;

// ── 母题配额定义条目 = 信封 + 配额数据体（defaults 对齐旧 母题配额Schema value） ─────────
export const 母题配额定义条目Schema = z.object({
  // 信封
  名称: z.string(),
  版本: z.string().optional(),
  作者: z.string().optional(),
  描述: z.string().optional(),
  内容哈希: z.string().optional(),
  // 配额数据体（对齐 preset.ts 母题配额Schema value·含 defaults·dormant·进 BUNDLE 投影）
  基础权重: z.number().min(0).default(1),
  每游戏年上限: z.number().int().min(0).default(0),
  互斥组: z.string().default(''),
});

// ── 母题配额库 = record<母题配额ID, 母题配额定义条目>.default({}) ────────────────────────
export const 母题配额库Schema = z.record(
  z.string().regex(母题配额ID正则, { message: '母题配额ID 须为蛇形 /^[a-z][a-z0-9_]*$/' }),
  母题配额定义条目Schema,
).default({});

// ── 配额数据体 Type（投影函数返回类型·与旧 母题配额Schema value 等价） ─────────────────
export type 配额数据体Type = {
  基础权重: number;
  每游戏年上限: number;
  互斥组: string;
};

// ── 投影函数：record<母题ID, 母题配额定义条目> → record<母题ID, 配额数据体> ──────────────
// 剥离信封字段·还原旧 母题配额Schema value 形态
// 0 重定基硬门：hashCanonical(投影结果) === hashCanonical(旧 母题配额字段值)
export function 投影母题配额库(lib: 母题配额库Type): Record<string, 配额数据体Type> {
  const result: Record<string, 配额数据体Type> = {};
  for (const [id, entry] of Object.entries(lib)) {
    if (!Object.prototype.hasOwnProperty.call(lib, id)) continue;
    result[id] = {
      基础权重:    entry.基础权重,
      每游戏年上限: entry.每游戏年上限,
      互斥组:      entry.互斥组,
    };
  }
  return result;
}

export type 母题配额定义条目Type = z.infer<typeof 母题配额定义条目Schema>;
export type 母题配额库Type       = z.infer<typeof 母题配额库Schema>;
