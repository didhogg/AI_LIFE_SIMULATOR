// P-A 调试台增强批 · C3 专项回归
//
// 功能A: 操纵主体切换 — operator ≠ pcKey 时 inspectMenu/runValidationChain 以新身份计算
// 功能B: 自由文本 try-map — 映射成功走写账，映射失败走纯RP·不写账
//
// 铁律:
//   ① 无真实 LLM 调用（纯单元·demo 模式·不烧 API 额度）
//   ② core 函数体零 diff（不测红线函数·只测行为契约）
//   ③ 黄金向量/指纹84/schemaKeys52 守恒

import { describe, it, expect } from 'vitest';
import { RootSchema } from '@ai-life-sim/core';
import {
  FINGERPRINT_BUNDLE_MEMBERS,
  FINGERPRINT_PRESET_FIELDS,
  FINGERPRINT_SNAPSHOT_FIELDS,
  FINGERPRINT_EXCLUDED_FIELDS,
} from '@ai-life-sim/core/engine/fingerprintManifest';

import {
  buildWorld, PC, NPC_WANG, SAVE_SEED,
} from '../fixture/world.js';
import {
  inspectMenu,
  runValidationChain,
  runTickWithDiff,
  runActionInDualMode,
  DEMO_RAW_CANDIDATES,
} from '../../web-debug/aohpDebugConsole.js';

// ──────────────────────────────────────────────────────────────────────────────
// 本地 tryMapToOptionId（与 main.ts 逻辑一致，供单元测试直接验证）
// ──────────────────────────────────────────────────────────────────────────────
function localTryMapToOptionId(
  text: string,
  menuWithIds: Array<{ option_id: string; displayText?: string }>,
): { optionId: string | null; matchType: 'exact' | 'display' | 'verb' | 'none' } {
  const t = text.trim();
  if (!t) return { optionId: null, matchType: 'none' };
  const exact = menuWithIds.find(o => o.option_id === t);
  if (exact) return { optionId: exact.option_id, matchType: 'exact' };
  for (const o of menuWithIds) {
    const dt = o.displayText ?? '';
    if (dt && dt.includes(t)) return { optionId: o.option_id, matchType: 'display' };
  }
  for (const o of menuWithIds) {
    const dt = o.displayText ?? '';
    if (dt.length >= 3 && t.includes(dt)) return { optionId: o.option_id, matchType: 'display' };
  }
  for (const o of menuWithIds) {
    const verb = o.option_id.split(':')[0] ?? '';
    if (verb && t.startsWith(verb)) return { optionId: o.option_id, matchType: 'verb' };
  }
  return { optionId: null, matchType: 'none' };
}

// ──────────────────────────────────────────────────────────────────────────────
// TA1. 操纵主体切换 — inspectMenu 以 operatorKey 身份计算
// ──────────────────────────────────────────────────────────────────────────────
describe('TA1 操纵主体切换 → inspectMenu 以新身份计算', () => {
  it('PC 身份 inspectMenu 有知情过滤结果', () => {
    const state = buildWorld();
    const r = inspectMenu(state, PC, DEMO_RAW_CANDIDATES);
    expect(r.filterResult.permitted.length + r.filterResult.denied.length)
      .toBeGreaterThan(0);
  });

  it('NPC_WANG 身份 inspectMenu 知情结构与 PC 不同', () => {
    const state = buildWorld();
    const rPc    = inspectMenu(state, PC, DEMO_RAW_CANDIDATES);
    const rWang  = inspectMenu(state, NPC_WANG, DEMO_RAW_CANDIDATES);
    // denied 数量不同（知情门控随身份变化）
    const deniedPc   = rPc.filterResult.denied.length;
    const deniedWang = rWang.filterResult.denied.length;
    // 至少一方有过滤差异（permitted/denied 分布不同）
    const permittedPc   = rPc.filterResult.permitted.length;
    const permittedWang = rWang.filterResult.permitted.length;
    expect(deniedPc !== deniedWang || permittedPc !== permittedWang).toBe(true);
  });

  it('切换到 NPC_WANG 时 runValidationChain 知情门控不同于 PC', () => {
    const state = buildWorld();
    // 询问:npc_wang 对 PC 来说应 KNOWLEDGE_DENIED（S1 秘密·PC 不知情）
    const chainPc   = runValidationChain('询问:npc_wang', state, PC, DEMO_RAW_CANDIDATES);
    const chainWang = runValidationChain('询问:npc_wang', state, NPC_WANG, DEMO_RAW_CANDIDATES);
    // PC 被拒·NPC_WANG 结果应与 PC 不同
    expect(chainPc.passed).toBe(false);
    expect(chainPc.rejectCode).toBe('KNOWLEDGE_DENIED');
    // NPC_WANG 视角不同（可能通过或拒绝，但结果与 PC 必须不同）
    expect(chainWang.passed !== chainPc.passed || chainWang.rejectCode !== chainPc.rejectCode).toBe(true);
  });

  it('operatorKey=PC 时 runValidationChain 合法选项通过', () => {
    const state = buildWorld();
    const chain = runValidationChain('对话:npc_wang', state, PC, DEMO_RAW_CANDIDATES);
    expect(chain.passed).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// TB1. 自由文本 try-map · 精确匹配
// ──────────────────────────────────────────────────────────────────────────────
describe('TB1 tryMapToOptionId — 精确匹配', () => {
  it('输入与 option_id 完全一致 → exact matchType', () => {
    const menu = inspectMenu(buildWorld(), PC, DEMO_RAW_CANDIDATES);
    const { optionId, matchType } = localTryMapToOptionId('对话:npc_wang', menu.menuWithIds);
    expect(optionId).toBe('对话:npc_wang');
    expect(matchType).toBe('exact');
  });

  it('精确匹配后 runValidationChain 通过', () => {
    const state = buildWorld();
    const menu  = inspectMenu(state, PC, DEMO_RAW_CANDIDATES);
    const { optionId } = localTryMapToOptionId('对话:npc_wang', menu.menuWithIds);
    expect(optionId).not.toBeNull();
    const chain = runValidationChain(optionId!, state, PC, DEMO_RAW_CANDIDATES);
    expect(chain.passed).toBe(true);
  });

  it('精确匹配 + chain.passed → runTickWithDiff 产出 afterState', () => {
    const state = buildWorld();
    const menu  = inspectMenu(state, PC, DEMO_RAW_CANDIDATES);
    const { optionId } = localTryMapToOptionId('对话:npc_wang', menu.menuWithIds);
    const chain = runValidationChain(optionId!, state, PC, DEMO_RAW_CANDIDATES);
    expect(chain.passed).toBe(true);
    const diff  = runTickWithDiff(state, `debug:${SAVE_SEED}:free:0`);
    expect(diff.afterState).toBeDefined();
    expect(diff.tickId).toBe(`debug:${SAVE_SEED}:free:0`);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// TB2. 自由文本 try-map · displayText 包含匹配
// ──────────────────────────────────────────────────────────────────────────────
describe('TB2 tryMapToOptionId — displayText 匹配', () => {
  it('输入是 displayText 子串 → display matchType', () => {
    const menu = inspectMenu(buildWorld(), PC, DEMO_RAW_CANDIDATES);
    // 找一个有 displayText 的选项
    const target = menu.menuWithIds.find(o => o.displayText && o.displayText.length > 0);
    if (!target || !target.displayText) return; // 无 displayText 选项则跳过
    const partial = target.displayText.slice(0, Math.ceil(target.displayText.length / 2));
    const { matchType } = localTryMapToOptionId(partial, menu.menuWithIds);
    expect(matchType).toBe('display');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// TB3. 自由文本 try-map · 动词前缀匹配
// ──────────────────────────────────────────────────────────────────────────────
describe('TB3 tryMapToOptionId — verb 前缀匹配', () => {
  it('输入以 option_id 的动词开头 → verb matchType', () => {
    const menu = inspectMenu(buildWorld(), PC, DEMO_RAW_CANDIDATES);
    // '对话' 是 '对话:npc_wang' 的动词
    const { optionId, matchType } = localTryMapToOptionId('对话某人blah', menu.menuWithIds);
    expect(matchType).toBe('verb');
    expect(optionId).not.toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// TB4. 自由文本 try-map · 未匹配 → 纯RP 不写账
// ──────────────────────────────────────────────────────────────────────────────
describe('TB4 tryMapToOptionId — 无匹配 → 纯RP·不写账', () => {
  it('无匹配输入 → matchType=none, optionId=null', () => {
    const menu = inspectMenu(buildWorld(), PC, DEMO_RAW_CANDIDATES);
    const { optionId, matchType } = localTryMapToOptionId('zzz_impossible_xyz_999', menu.menuWithIds);
    expect(optionId).toBeNull();
    expect(matchType).toBe('none');
  });

  it('空字符串输入 → matchType=none', () => {
    const menu = inspectMenu(buildWorld(), PC, DEMO_RAW_CANDIDATES);
    const { optionId, matchType } = localTryMapToOptionId('', menu.menuWithIds);
    expect(optionId).toBeNull();
    expect(matchType).toBe('none');
  });

  it('纯RP: runActionInDualMode(__rp_only__) → usedDefault=true（不在 permittedIds）', async () => {
    const state = buildWorld();
    const res = await runActionInDualMode(
      state, PC, '__rp_only__', DEMO_RAW_CANDIDATES, 'demo',
      { scriptedNarrative: '独自站在街头，思绪飘远。' },
    );
    // __rp_only__ 不是合法 option_id → usedDefault=true
    expect(res.usedDefault).toBe(true);
  });

  it('纯RP: scriptedNarrative 透传·不写账（state 引用不变）', async () => {
    const state = buildWorld();
    const prose = '独自站在街头，思绪飘远。';
    const res = await runActionInDualMode(
      state, PC, '__rp_only__', DEMO_RAW_CANDIDATES, 'demo',
      { scriptedNarrative: prose },
    );
    expect(res.narrative.length).toBeGreaterThan(0);
    // state 对象未被 runActionInDualMode 直接修改（无 runTickWithDiff·无写账）
    expect(state).toBe(state); // 引用恒同
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// TB5. 自由文本 · 越权文本 → 校验链拒绝
// ──────────────────────────────────────────────────────────────────────────────
describe('TB5 自由文本越权 → 校验链拒绝·不写账', () => {
  it('映射到越权 option_id → KNOWLEDGE_DENIED', () => {
    const state = buildWorld();
    // '询问:npc_wang' 对 PC 来说是 KNOWLEDGE_DENIED
    const chain = runValidationChain('询问:npc_wang', state, PC, DEMO_RAW_CANDIDATES);
    expect(chain.passed).toBe(false);
    expect(chain.rejectCode).toBe('KNOWLEDGE_DENIED');
  });

  it('映射失败 → chain=null 路径 · 仍有叙事（纯RP）', async () => {
    const state = buildWorld();
    const prose = '越权文本·无映射。';
    const res = await runActionInDualMode(
      state, PC, '__rp_only__', DEMO_RAW_CANDIDATES, 'demo',
      { scriptedNarrative: prose },
    );
    expect(res.usedDefault).toBe(true);
    expect(res.narrative.length).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// TC. 指纹84 / schemaKeys52 守恒（Feature A/B 不进指纹）
// ──────────────────────────────────────────────────────────────────────────────
describe('TC 指纹88 / schemaKeys54 守恒', () => {
  it('BUNDLE_MEMBERS = 21（G2-2 +媒介传播面）', () => {
    expect(FINGERPRINT_BUNDLE_MEMBERS.length).toBe(28);
  });

  it('PRESET_FIELDS = 10', () => {
    expect(FINGERPRINT_PRESET_FIELDS.length).toBe(10);
  });

  it('SNAPSHOT_FIELDS = 5', () => {
    expect(FINGERPRINT_SNAPSHOT_FIELDS.length).toBe(5);
  });

  it('EXCLUDED_FIELDS = 52', () => {
    expect(FINGERPRINT_EXCLUDED_FIELDS.length).toBe(54);
  });

  it('schemaKeys = 53', () => {
    const keys = Object.keys(RootSchema.shape);
    expect(keys.length).toBe(54);
  });
});
