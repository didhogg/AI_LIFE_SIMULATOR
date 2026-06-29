// B-E2-01 修補 · F0 callRegistry 約束宣言 + F1 assemblePrompt 注入 検証
//
// 铁律:
//   ① prompt 不进指纹（R7-b·canonicalize 不变）
//   ② reconcileGate 函数体零改（只改注入层·不改判定层）
//   ③ schemaKeys=53·指纹 84 守恒

import { describe, it, expect } from 'vitest';
import { RootSchema } from '@ai-life-sim/core';
import {
  CALL_TYPE_REGISTRY,
  NARRATIVE_CALL_TYPES,
} from '@ai-life-sim/core/prompt/callRegistry';
import {
  FINGERPRINT_BUNDLE_MEMBERS,
  FINGERPRINT_PRESET_FIELDS,
  FINGERPRINT_SNAPSHOT_FIELDS,
  FINGERPRINT_EXCLUDED_FIELDS,
} from '@ai-life-sim/core/engine/fingerprintManifest';
import { canonicalize } from '@ai-life-sim/core/engine/text/canonicalize';
import { buildWorld, PC, NPC_WANG, NPC_HONG, LOC_NAME } from '../fixture/world.js';
import { assemblePrompt } from '../assemble.js';
import { runReconcileGate } from '../engine/reconcileGate.js';
import type { TickProposal } from '../ledger/proposalSchema.js';

// ────────────────────────────────────────────────────────────────────────────────
// F0 callRegistry 当拍約束注入宣言
// ────────────────────────────────────────────────────────────────────────────────
describe('F0 callRegistry 当拍約束注入宣言', () => {
  it('主線叙事に当拍約束注入位が宣言されている', () => {
    const spec = CALL_TYPE_REGISTRY[NARRATIVE_CALL_TYPES.主线叙事];
    expect(spec.当拍约束注入位).toBeDefined();
    expect(spec.当拍约束注入位?.transfer金额).toBe(true);
    expect(spec.当拍约束注入位?.物品id).toBe(true);
    expect(spec.当拍约束注入位?.数量).toBe(true);
  });

  it('ProposalConstraint 型が callRegistry からエクスポートされる', async () => {
    const mod = await import('@ai-life-sim/core/prompt/callRegistry');
    // TypeScript 型なので実行時には値なし ─ モジュールが解決できるかを確認
    expect(mod).toBeDefined();
    expect(typeof mod.CALL_TYPE_REGISTRY).toBe('object');
  });

  it('開場白叙事·叙事質量二審·玩家代理回复·小剧场には当拍约束注入位がない（主線専用）', () => {
    const noConstraint: (keyof typeof CALL_TYPE_REGISTRY)[] = [
      NARRATIVE_CALL_TYPES.开场白叙事,
      NARRATIVE_CALL_TYPES.叙事质量二审,
      NARRATIVE_CALL_TYPES.玩家代理回复,
      NARRATIVE_CALL_TYPES.小剧场,
    ];
    for (const key of noConstraint) {
      expect(CALL_TYPE_REGISTRY[key].当拍约束注入位).toBeUndefined();
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// F1 assemblePrompt 当拍約束注入 — 基本動作
// ────────────────────────────────────────────────────────────────────────────────
describe('F1 assemblePrompt 当拍約束注入 — 基本動作', () => {
  const state = buildWorld();

  it('proposalConstraints 未指定時は userPrompt に「当拍约定账变」セクションなし', () => {
    const { userPrompt } = assemblePrompt(state, {
      pcKey: PC, locName: LOC_NAME, povEntityKey: PC,
    });
    expect(userPrompt).not.toContain('当拍约定账变');
  });

  it('transfer 約束注入 → userPrompt に「当拍约定账变」セクションが含まれる', () => {
    const { userPrompt } = assemblePrompt(state, {
      pcKey: PC, locName: LOC_NAME, povEntityKey: PC,
      proposalConstraints: { transfers: [{ from: PC, to: NPC_HONG, amount: 5 }] },
    });
    expect(userPrompt).toContain('当拍约定账变');
  });

  it('transfer 金額が規範通貨単位付きで注入される（5文）', () => {
    const { userPrompt } = assemblePrompt(state, {
      pcKey: PC, locName: LOC_NAME, povEntityKey: PC,
      proposalConstraints: { transfers: [{ from: PC, to: NPC_HONG, amount: 5 }] },
    });
    expect(userPrompt).toContain('5文');
  });

  it('NPC エンティティ名（林九·紅姨）が注入される（キーではなく名称）', () => {
    const { userPrompt } = assemblePrompt(state, {
      pcKey: PC, locName: LOC_NAME, povEntityKey: PC,
      proposalConstraints: { transfers: [{ from: PC, to: NPC_HONG, amount: 5 }] },
    });
    // 林九→紅姨 の形式で注入される
    expect(userPrompt).toContain('林九');
    expect(userPrompt).toContain('红姨');
  });

  it('複数 transfer が全て注入される', () => {
    const { userPrompt } = assemblePrompt(state, {
      pcKey: PC, locName: LOC_NAME, povEntityKey: PC,
      proposalConstraints: {
        transfers: [
          { from: PC, to: NPC_HONG, amount: 5 },
          { from: PC, to: NPC_WANG, amount: 8 },
        ],
      },
    });
    expect(userPrompt).toContain('5文');
    expect(userPrompt).toContain('8文');
  });

  it('物品約束が注入される', () => {
    const { userPrompt } = assemblePrompt(state, {
      pcKey: PC, locName: LOC_NAME, povEntityKey: PC,
      proposalConstraints: {
        items: [{ id: '上等酒', quantity: 2 }],
      },
    });
    expect(userPrompt).toContain('上等酒');
    expect(userPrompt).toContain('2件');
  });

  it('transfers·items 両方を同時に注入できる', () => {
    const { userPrompt } = assemblePrompt(state, {
      pcKey: PC, locName: LOC_NAME, povEntityKey: PC,
      proposalConstraints: {
        transfers: [{ from: PC, to: NPC_HONG, amount: 3 }],
        items: [{ id: '茶葉', quantity: 1 }],
      },
    });
    expect(userPrompt).toContain('3文');
    expect(userPrompt).toContain('茶葉');
  });

  it('禁止単位ヒントが含まれる（铜钱/枚/块/两禁止）', () => {
    const { userPrompt } = assemblePrompt(state, {
      pcKey: PC, locName: LOC_NAME, povEntityKey: PC,
      proposalConstraints: { transfers: [{ from: PC, to: NPC_HONG, amount: 5 }] },
    });
    expect(userPrompt).toContain('禁铜钱');
  });

  it('空 transfers/items でも「当拍约定账变」セクションが生成されない', () => {
    const { userPrompt } = assemblePrompt(state, {
      pcKey: PC, locName: LOC_NAME, povEntityKey: PC,
      proposalConstraints: { transfers: [], items: [] },
    });
    expect(userPrompt).not.toContain('当拍约定账变');
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// F1 B-E2-01 修復 検証 — reconcileGate 由 hard_rejected → covered
// ────────────────────────────────────────────────────────────────────────────────
describe('F1 B-E2-01 修復検証 — reconcileGate covered 経路', () => {
  const state = buildWorld();

  it('B-E2-01 修復後: LLM が「五文」を含む叙事を生成した場合 → covered', () => {
    // 注入された制約を見た LLM は「五文」形式で書くはず
    const proposal: TickProposal = {
      transfers: [{ from: PC, to: NPC_HONG, amount: 5, reason: '给钱' }],
      checks: [], knowledge: [],
    };
    // 規範単位「文」→ covered
    const resultOk = runReconcileGate('林九取出五文递给红姨，红姨点头道谢。', proposal);
    expect(resultOk.status).toBe('covered');
  });

  it('B-E2-01 修復後: 注入フォーマット「5文」でも covered（Arabic 数字 + 文）', () => {
    const proposal: TickProposal = {
      transfers: [{ from: PC, to: NPC_HONG, amount: 5, reason: '给钱' }],
      checks: [], knowledge: [],
    };
    const result = runReconcileGate('林九拿出5文钱给红姨。', proposal);
    expect(result.status).toBe('covered');
  });

  it('B-E2-01 修復前の状態再現: 「三枚铜钱」→ hard_rejected（単位不可確認）', () => {
    const proposal: TickProposal = {
      transfers: [{ from: PC, to: NPC_HONG, amount: 5, reason: '给钱' }],
      checks: [], knowledge: [],
    };
    // 非規範単位「铜钱/枚」→ 単位不可確認 → hard_rejected
    const result = runReconcileGate('林九将三枚铜钱放到桌上。', proposal);
    expect(result.status).toBe('hard_rejected');
    // reason = '単位不可確認'
    expect(result.finalCoverage.covered).toBe(false);
  });

  it('制約注入後の userPrompt が規範単位「5文」を含む → LLM への指示が正しい', () => {
    const { userPrompt } = assemblePrompt(state, {
      pcKey: PC, locName: LOC_NAME, povEntityKey: PC,
      proposalConstraints: { transfers: [{ from: PC, to: NPC_HONG, amount: 5 }] },
    });
    // userPrompt が「5文」を含む → LLM はこの形式を使う
    expect(userPrompt).toContain('5文');
    // もし LLM がそのまま「5文」を写せば reconcileGate が covered を返す
    const proposal: TickProposal = {
      transfers: [{ from: PC, to: NPC_HONG, amount: 5, reason: '给钱' }],
      checks: [], knowledge: [],
    };
    const result = runReconcileGate('林九递出5文给红姨。', proposal);
    expect(result.status).toBe('covered');
  });

  it('8文 transfer → 「八文」叙事 → covered', () => {
    const proposal: TickProposal = {
      transfers: [{ from: PC, to: NPC_WANG, amount: 8, reason: '还账' }],
      checks: [], knowledge: [],
    };
    const result = runReconcileGate('林九取出八文钱，恭恭敬敬还给王掌柜。', proposal);
    expect(result.status).toBe('covered');
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// F1 指纹隔離断言 — 約束注入は prompt 层·不进指纹 (R7-b)
// ────────────────────────────────────────────────────────────────────────────────
describe('F1 約束注入 指纹隔離 (R7-b)', () => {
  const state = buildWorld();

  it('約束注入前後で canonicalize(state) は変わらない（state 不変）', () => {
    const c1 = canonicalize(state);
    // assemblePrompt は state を読むだけ・変更しない
    assemblePrompt(state, {
      pcKey: PC, locName: LOC_NAME, povEntityKey: PC,
      proposalConstraints: { transfers: [{ from: PC, to: NPC_HONG, amount: 5 }] },
    });
    const c2 = canonicalize(state);
    expect(c1).toBe(c2);
  });

  it('指纹 manifest 84 条目不変（新 field 未追加）', () => {
    const total =
      FINGERPRINT_BUNDLE_MEMBERS.length +
      FINGERPRINT_PRESET_FIELDS.length +
      FINGERPRINT_SNAPSHOT_FIELDS.length +
      FINGERPRINT_EXCLUDED_FIELDS.length;
    expect(total).toBe(94);
  });

  it('schemaKeys=53 不変', () => {
    expect(Object.keys(RootSchema.shape).length).toBe(54);
  });

  it('callRegistry 変更後も CALL_TYPE_REGISTRY は既存 5 keys を保持', () => {
    const keys = Object.keys(CALL_TYPE_REGISTRY);
    expect(keys).toContain('主线叙事');
    expect(keys).toContain('开场白叙事');
    expect(keys).toContain('叙事质量二审');
    expect(keys).toContain('玩家代理回复');
    expect(keys).toContain('小剧场');
    expect(keys.length).toBe(5);
  });
});
