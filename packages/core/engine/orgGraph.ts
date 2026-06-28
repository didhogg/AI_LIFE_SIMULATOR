// orgGraph.ts — §九 组织实体层节点解析（additive · C2-2 · 宿主无关）
//
// 职责：
//   §八① 悬空 org 引用 → 潜在节点（占位形态·不传播/不计票/不计聚合）
//   §八③ 别名归一去重（NPC.所属组织 + 组织关系网 两侧）
//   §九  org 与 npc 统一节点解析入口（ghost 防护 + 已解散停中继由 relationGraph 侧消费）
//
// 红线：不改 propagateRipple 取材·不改 rng.ts·不改 gate.ts 本体。
// 确定性：无 Date.now / Math.random / window；ghost 节点由键名唯一决定，与调用顺序无关。
import type { RootState } from '../schema/index.js';
import { 组织实体Schema } from '../schema/org.js';

// ── §八③ 别名表构建 ──────────────────────────────────────────────────────────────

/** 从 组织实体[*].别名键 构建 aliasKey → canonicalKey 映射表 */
function buildAliasMap(state: RootState): Map<string, string> {
  const map = new Map<string, string>();
  for (const [canonical, org] of Object.entries(state.组织实体 ?? {})) {
    if (org.别名键) {
      for (const alias of org.别名键) {
        if (alias && alias !== canonical) {
          map.set(alias, canonical);
        }
      }
    }
  }
  return map;
}

/** §八① — 向 state.组织实体 注入幽灵节点（潜在节点·占位形态·additive） */
function ensureGhostOrg(state: RootState, orgKey: string): void {
  state.组织实体 ??= {};
  if (state.组织实体[orgKey]) return; // 已存在，无需创建
  // 通过 zod 解析获取全部 defaults 填充
  const ghostRecord = 组织实体Schema.parse({
    [orgKey]: {
      占位形态: { 名称: orgKey, 实体类型: '组织', 硬约束: [], 来源拍号: 0 },
    },
  });
  state.组织实体[orgKey] = ghostRecord[orgKey]!;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * §九 统一节点解析入口（C2-2 additive）
 *
 * 1. 构建别名表（§八③）
 * 2. 规范化 NPC.所属组织 别名键 → canonical 键
 * 3. 收集所有被引用的 org 键（NPC 侧 + 组织关系网 侧）
 * 4. 对悬空引用创建幽灵节点（§八①）
 *
 * 调用时机：RootSchema.parse() 之后、autoCompleteRelations() 之前。
 * 原地修改并返回同一 state 引用（与 autoCompleteRelations 一致）。
 */
export function resolveOrgNodes(state: RootState): RootState {
  const aliasMap = buildAliasMap(state);

  // ── 1. 规范化 NPC.所属组织 别名键 + 收集引用键 ──
  const referencedOrgKeys = new Set<string>();

  for (const npc of Object.values(state.NPC)) {
    for (const membership of npc.所属组织) {
      if (!membership.组织键) continue;
      const canonical = aliasMap.get(membership.组织键) ?? membership.组织键;
      if (canonical !== membership.组织键) {
        // §八③: 别名 → 规范键，原地改写
        (membership as { 组织键: string }).组织键 = canonical;
      }
      referencedOrgKeys.add(canonical);
    }
  }

  // ── 2. 收集 组织关系网 两端 org 键 ──
  for (const edge of Object.values(state.组织关系网 ?? {})) {
    const a = aliasMap.get(edge.A组织) ?? edge.A组织;
    const b = aliasMap.get(edge.B组织) ?? edge.B组织;
    if (a) referencedOrgKeys.add(a);
    if (b) referencedOrgKeys.add(b);
    // 规范化 edge 端点别名（additive·保持一致性）
    if (a !== edge.A组织) (edge as { A组织: string }).A组织 = a;
    if (b !== edge.B组织) (edge as { B组织: string }).B组织 = b;
  }

  // ── 3. 确保所有被引用 org 键存在（悬空→幽灵节点 §八①） ──
  for (const orgKey of referencedOrgKeys) {
    ensureGhostOrg(state, orgKey);
  }

  return state;
}
