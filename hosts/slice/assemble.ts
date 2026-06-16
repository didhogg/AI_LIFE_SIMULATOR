// M0 最小 prompt 组装 — 主角 + 在场 NPC + 地点 + 近 K 拍历史
// M4: 新增 visibleSecrets 参数（知情过滤后才入组装·$谜底 永不送入 LLM）
import type { RootState } from '@ai-life-sim/core';
import type { VisibleSecret } from '@ai-life-sim/core/engine/knowledgeFilter';

export type { VisibleSecret };

export interface AssembleOptions {
  pcKey: string;
  locName: string;
  historyTicks?: string[];
  /**
   * M4 知情过滤结果：调用方通过 filterSecretsForPOV 预过滤后传入。
   * 缺省或空对象 → 不注入秘密节（existence-opaque：连该节存在都不暴露）。
   * 禁止传入未过滤的 全局.秘密库：过滤在进 prompt 之前做，不是事后打码。
   */
  visibleSecrets?: Record<string, VisibleSecret>;
}

export function assemblePrompt(state: RootState, opts: AssembleOptions): {
  systemPrompt: string;
  userPrompt: string;
} {
  const { pcKey, locName, visibleSecrets } = opts;

  // ── 主角 ──
  const pc = state.NPC?.[pcKey];
  if (!pc) throw new Error(`找不到主角 ${pcKey}`);
  const pcName = pc.姓名 ?? pcKey;
  const pcBio  = pc.背景 ?? '';
  const attrs  = pc.属性 as Record<string, number> | undefined;

  // ── 在场 NPC（同地点·排除主角）──
  const npcLines: string[] = [];
  for (const [key, npc] of Object.entries(state.NPC ?? {})) {
    if (key === pcKey) continue;
    if (npc.位置 !== (pc.位置 ?? '')) continue;
    const attrStr = npc.属性
      ? Object.entries(npc.属性 as Record<string, number>)
          .map(([k, v]) => `${k}${v}`)
          .join('/')
      : '';
    npcLines.push(
      `- ${npc.姓名 ?? key}（${npc.称呼 ?? ''}）：${npc.背景 ?? ''}${attrStr ? `  [${attrStr}]` : ''}`,
    );
  }

  // ── 主角属性摘要 ──
  const pcAttrStr = attrs
    ? `体质${attrs['体质'] ?? '?'} 智慧${attrs['智慧'] ?? '?'} 感知${attrs['感知'] ?? '?'} 魅力${attrs['魅力'] ?? '?'} 心理${attrs['心理'] ?? '?'}`
    : '';

  // ── 货币（货币系统.账户 = 主角单账户）──
  const currency   = state.货币系统?.基准币种 ?? '文钱';
  const pcHolding  = (state.货币系统?.账户?.持有 as Record<string, number> | undefined)?.[currency] ?? 0;

  // ── M4 已知秘密节（知情过滤后·$谜底 永不输出）────────────────────────────────
  // 铁律：非知情方连该节都不插入（existence-opaque）
  const secretSection: string[] = [];
  const visibleEntries = Object.entries(visibleSecrets ?? {});
  if (visibleEntries.length > 0) {
    secretSection.push('', '## 当前已知秘密（已知存在·勿在叙事中直接揭示）');
    for (const [id, s] of visibleEntries) {
      secretSection.push(`- [${id}] ${s.母题}（严重度${s.严重度}·暴露度${s.暴露度}）`);
    }
  }

  const systemPrompt = [
    '你是一款中文武侠模拟游戏的叙事 AI。请用简洁的第三人称为下面这一拍生成一段叙事（50-80 字），',
    '描述主角刚到客栈的第一印象。不要捏造不在场景中的人物或秘密。',
    '',
    `## 主角`,
    `姓名：${pcName}  称呼：${pc.称呼 ?? ''}`,
    `背景：${pcBio}`,
    `属性：${pcAttrStr}`,
    `身上：${pcHolding}${currency}`,
    '',
    `## 地点`,
    locName,
    '',
    `## 在场人物`,
    npcLines.join('\n') || '（无）',
    ...secretSection,
  ].join('\n');

  const userPrompt = `拍#${state._tick?.拍计数 ?? 1}：林九踏入悦来客栈，请描写他的第一印象与周围氛围。`;

  return { systemPrompt, userPrompt };
}
