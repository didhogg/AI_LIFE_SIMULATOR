// PR-瘦身·选项集库 · additive · dormant · 进内容哈希 · 进指纹投影（0 重定基）
// schemaKeys 守恒 52：选项集库属装配层·不进 RootSchema
// 定义层（作者声明·动词选项条目 by-set 组织）⊥ preset.动词选项集（旧轨·z.array.optional·暂留·双轨剥离再迁移）
// 投影函数：投影选项集库(lib) → 动词选项条目[]（按 Object.values 插入序展平·回填 动词选项集 字段）
// 指纹等价：hashCanonical(投影选项集库(lib)) === hashCanonical(旧 动词选项集 数组)（0 重定基硬门）
// 命名避撞：preset.ts 无同名 Schema·本文件为唯一权威
// 纯 schema + 投影函数·无副作用·禁 Date.now / new Date / Math.random / window / document
import { z } from 'zod';

// ── 动词选项条目（AOHP preset 侧声明·无 option_id·由引擎派生）────────────────────────
// 口径：对应 ActionOptionSchema 去掉 option_id（该字段由 buildMenuOptionIds 确定性派生）
// 约束：≤99 条（受 rngFor [0,99] 精度·partialShuffleSample 无偏样本约束）
export const 动词选项条目Schema = z.object({
  verb:           z.string().default(''),           // 动词（来自 动词Id枚举·运行时校验）
  target_choices: z.array(z.string()).default([]),  // 目标变量全状态路径候选（变量驱动底座）
  tool_name:      z.string().default(''),           // 调用工具名（open string）
  params:         z.record(z.string(), z.unknown()).default({}), // 参数 map（含 关联实体[] 对手方路径）
  salient_args:   z.string().optional(),            // 显著参数文本·用于 option_id 派生
  value_slot:     z.string().optional(),            // 绑定的数值槽键
  min:            z.number().optional(),            // 数值槽最小值
  max:            z.number().optional(),            // 数值槽最大值
  display_text:   z.string().optional(),            // 显示标签（不纳入 option_id·纯展示）
}).strip();

export type 动词选项条目Type = z.infer<typeof 动词选项条目Schema>;

export const 选项集ID正则 = /^[a-z][a-z0-9_]*$/;

// ── 选项集定义条目 ── 两层：信封 + 动词选项条目列表（作者形态·保持 动词选项条目Schema 不变）────
// ① 信封 typed（resolve 三层校验 + content_hash 可复现面）
// ② 条目列表·作者形态（复用 动词选项条目Schema·无 option_id·由引擎派生）
//    max(99) 对应 preset.动词选项集 约束（受 rngFor [0,99] 精度·partialShuffleSample 无偏样本约束）
//    dormant·不进 hashJudgmentBundle·整库投影回填 动词选项集 → 进 PRESET 指纹
export const 选项集定义条目Schema = z.object({
  // ① 信封
  名称: z.string(),
  版本: z.string().optional(),
  作者: z.string().optional(),
  描述: z.string().optional(),
  内容哈希: z.string().optional(),    // mod 可复现面·进内容包哈希（computeEffectPackHash）

  // ② 动词选项条目列表（保持作者形态·复用 动词选项条目Schema·无 option_id）
  条目: z.array(动词选项条目Schema).max(99).optional(),
});

// ── 选项集库 = record<选项集ID, 选项集定义条目>.default({}) ─────────────────────────
export const 选项集库Schema = z.record(
  z.string().regex(选项集ID正则, { message: '选项集ID 须为蛇形 /^[a-z][a-z0-9_]*$/' }),
  选项集定义条目Schema,
).default({});

export type 选项集定义条目Type = z.infer<typeof 选项集定义条目Schema>;
export type 选项集库Type       = z.infer<typeof 选项集库Schema>;

// ── 投影函数：选项集库 → 动词选项条目[]（指纹等价·0 重定基） ──────────────────────────
// 投影序 = Object.values 插入序（键序即作者序·迁移时由旧数组顺序逐条写入）
// 投影丢弃 选项集ID（动词选项条目本就无此字段）→ ID 命名不影响指纹字节
// 调用方：在 preset resolve 阶段，将此函数产出回填 动词选项集 字段，
//   hashPresetFingerprint 原样读取 动词选项集 → 自动改算库成品（红线函数体零改动）
export function 投影选项集库(lib: 选项集库Type): 动词选项条目Type[] {
  const result: 动词选项条目Type[] = [];
  for (const entry of Object.values(lib)) {
    if (entry.条目) {
      for (const item of entry.条目) {
        result.push(item);
      }
    }
  }
  return result;
}
