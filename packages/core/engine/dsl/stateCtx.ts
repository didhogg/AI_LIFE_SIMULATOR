// P7-7.a · projectStateCtx — 从 RootState 投影 DSL 求值上下文
// 纯函数·确定性·Ring 0·六禁：禁 Date.now/new Date/Math.random/localeCompare/裸JSON.stringify/NFC
// path max 2 ↔ DSL v1.0 限深1约束；scope 缺省/NPC不存在 → 属性/技能/账户 = {} (fail-closed)
import type { RootState } from '../../schema/index.js';
import type { DslContext } from './eval.js';

/** 投影范围（scopedTo entityKey 时补 NPC 属性/技能/账户；缺省=纯全局） */
export interface ProjectionScope {
  entityKey?: string | undefined;
}

/**
 * 从 RootState 投影 DSL v1.0 求值上下文（纯·只读·确定性）。
 *
 * 命名空间（path max 2）：
 *   · 属性   = NPC[entityKey].属性   — 体质/智慧/感知/魅力/心理 等 number 轴
 *   · 技能   = NPC[entityKey].技能   — 各技能键→等级（number）
 *   · 账户   = 货币系统.账户[entityKey].持有 — 币种→余额（number）
 *   · 全局   = { 拍计数, 纪元分钟 }  — 始终可用
 *
 * scope 缺省或 entityKey 对应 NPC 不存在 → 属性/技能/账户 = {}
 * 路径 miss → resolvePath 返回 0 → 谓词 fail-closed（evalPred 内已保证）
 */
export function projectStateCtx(
  state: RootState,
  scope?: ProjectionScope,
): DslContext {
  const entityKey = scope?.entityKey;
  const npc       = entityKey ? state.NPC[entityKey] : undefined;

  // 属性：NPC.属性 是固定键 object → 强转 Record<string,number>（schema 保证均为 number）
  const 属性: Readonly<Record<string, number>> =
    npc?.属性 ? (npc.属性 as unknown as Record<string, number>) : {};

  // 技能：z.record(key, 技能条目) → 提取 .等级（number）
  const 技能Rec: Record<string, number> = {};
  if (npc?.技能) {
    for (const [k, v] of Object.entries(npc.技能)) {
      if (v !== null && typeof v === 'object' && typeof v.等级 === 'number') {
        技能Rec[k] = v.等级;
      }
    }
  }
  const 技能: Readonly<Record<string, number>> = 技能Rec;

  // 账户：货币系统.账户[entityKey].持有 = z.record(账户键, number) → 直通
  const 账户: Readonly<Record<string, number>> =
    entityKey
      ? ((state.货币系统?.账户 as Record<string, { 持有: Record<string, number> }>)
          ?.[entityKey]?.持有 ?? {})
      : {};

  // 全局：拍计数 + 纪元分钟（record·非求和）
  const 全局: Readonly<Record<string, number>> = {
    拍计数:   (state._tick as { 拍计数?: number } | undefined)?.拍计数   ?? 0,
    纪元分钟: (state.世界  as { 纪元分钟?: number } | undefined)?.纪元分钟 ?? 0,
  };

  return { 属性, 技能, 账户, 全局 };
}
