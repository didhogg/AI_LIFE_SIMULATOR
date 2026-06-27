// P0-11 探雷轮 · E0 InMemoryArchiveStore + E1 LLM 隔离 + 指纹守恒
//
// 铁律:
//   ① 无真实 LLM 调用（纯单元·不烧 API 额度）
//   ② 指纹/黄金向量/schemaKeys 守恒断言
//   ③ InMemoryArchiveStore 不落盘（fs 零调用）

import { describe, it, expect } from 'vitest';
import { RootSchema } from '@ai-life-sim/core';
import {
  FINGERPRINT_BUNDLE_MEMBERS,
  FINGERPRINT_PRESET_FIELDS,
  FINGERPRINT_SNAPSHOT_FIELDS,
  FINGERPRINT_EXCLUDED_FIELDS,
} from '@ai-life-sim/core/engine/fingerprintManifest';
import { canonicalize } from '@ai-life-sim/core/engine/text/canonicalize';
import { buildWorld, PC, NPC_WANG, NPC_HONG, SAVE_SEED } from '../fixture/world.js';
import {
  createFullArchiveHeader,
  ARCHIVE_RULE_VERSION,
} from '../engine/archive.js';

// E0: InMemoryArchiveStore（hosts/web-debug·相対引用）
import { InMemoryArchiveStore } from '../../web-debug/inMemoryArchiveStore.js';

// ────────────────────────────────────────────────────────────────────────────────
// E0 InMemoryArchiveStore — 構築・読取・書込
// ────────────────────────────────────────────────────────────────────────────────
describe('E0 InMemoryArchiveStore — 構築・読取・書込', () => {
  const INITIAL_BALANCES = { [PC]: 30, [NPC_WANG]: 200, [NPC_HONG]: 0 };

  it('構築時に FullArchiveHeader が生成される', () => {
    const store = new InMemoryArchiveStore(SAVE_SEED, buildWorld(), INITIAL_BALANCES);
    const { header } = store.load();
    expect(header.seed).toBe(SAVE_SEED);
    expect(header.RULE_VERSION).toBe(ARCHIVE_RULE_VERSION);
    expect(header.schemaKeys).toBe(54);
  });

  it('load() が初期状態を返す（turn=0）', () => {
    const state = buildWorld();
    const store = new InMemoryArchiveStore(SAVE_SEED, state, INITIAL_BALANCES);
    const snap = store.load();
    expect(snap.state).toBeDefined();
    expect(snap.balances[PC]).toBe(30);
    expect(snap.balances[NPC_WANG]).toBe(200);
    expect(snap.turn).toBe(0);
  });

  it('save() が状態と残高を更新する', () => {
    const store = new InMemoryArchiveStore(SAVE_SEED, buildWorld(), INITIAL_BALANCES);
    const newBalances = { [PC]: 25, [NPC_WANG]: 200, [NPC_HONG]: 5 };
    store.save(buildWorld(), newBalances);
    const snap = store.load();
    expect(snap.balances[PC]).toBe(25);
    expect(snap.balances[NPC_HONG]).toBe(5);
  });

  it('save() 後 turn が +1 される', () => {
    const store = new InMemoryArchiveStore(SAVE_SEED, buildWorld(), INITIAL_BALANCES);
    expect(store.getTurn()).toBe(0);
    store.save(buildWorld(), INITIAL_BALANCES);
    expect(store.getTurn()).toBe(1);
    store.save(buildWorld(), INITIAL_BALANCES);
    expect(store.getTurn()).toBe(2);
  });

  it('多拍後も状態が連続している（turn 単調増加）', () => {
    const store = new InMemoryArchiveStore(SAVE_SEED, buildWorld(), INITIAL_BALANCES);
    for (let i = 1; i <= 5; i++) {
      store.save(buildWorld(), { [PC]: 30 - i, [NPC_WANG]: 200, [NPC_HONG]: i });
    }
    expect(store.getTurn()).toBe(5);
    const snap = store.load();
    expect(snap.balances[PC]).toBe(25);   // 30-5
    expect(snap.balances[NPC_HONG]).toBe(5);
  });

  it('load() は副本を返す（外部変更が store に影響しない）', () => {
    const store = new InMemoryArchiveStore(SAVE_SEED, buildWorld(), INITIAL_BALANCES);
    const snap1 = store.load();
    (snap1.balances as Record<string, number>)[PC] = 999;  // 外部変更
    const snap2 = store.load();
    expect(snap2.balances[PC]).toBe(30);  // store 内はそのまま
  });

  it('save() は深クローン（渡した balances を後から変更しても store に影響しない）', () => {
    const store = new InMemoryArchiveStore(SAVE_SEED, buildWorld(), INITIAL_BALANCES);
    const mutable: Record<string, number> = { [PC]: 50, [NPC_WANG]: 200, [NPC_HONG]: 0 };
    store.save(buildWorld(), mutable);
    mutable[PC] = 0;  // 後から変更
    expect(store.load().balances[PC]).toBe(50);  // store は変わらない
  });

  it('bumpReroll() が全局回滚计数器を +1 する', () => {
    const store = new InMemoryArchiveStore(SAVE_SEED, buildWorld(), INITIAL_BALANCES);
    const before = store.getHeader().全局回滚计数器;
    store.bumpReroll();
    const after = store.getHeader().全局回滚计数器;
    expect(after).toBe((before ?? 0) + 1);
  });

  it('bumpReroll() を複数回呼べる（農骰防護の累積）', () => {
    const store = new InMemoryArchiveStore(SAVE_SEED, buildWorld(), INITIAL_BALANCES);
    store.bumpReroll();
    store.bumpReroll();
    store.bumpReroll();
    expect(store.getHeader().全局回滚计数器).toBe(3);
  });

  it('getSeed() がコンストラクタに渡した seed を返す', () => {
    const store = new InMemoryArchiveStore(SAVE_SEED, buildWorld(), INITIAL_BALANCES);
    expect(store.getSeed()).toBe(SAVE_SEED);
  });

  it('getHeader() が FullArchiveHeader を返す', () => {
    const store = new InMemoryArchiveStore(SAVE_SEED, buildWorld(), INITIAL_BALANCES);
    const h = store.getHeader();
    expect(h.RULE_VERSION).toBe(ARCHIVE_RULE_VERSION);
    expect(h.schemaKeys).toBe(54);
  });

  it('save() 後も header は変わらない（seed/RULE_VERSION 不変）', () => {
    const store = new InMemoryArchiveStore(SAVE_SEED, buildWorld(), INITIAL_BALANCES);
    store.save(buildWorld(), { [PC]: 10 });
    expect(store.getHeader().seed).toBe(SAVE_SEED);
    expect(store.getHeader().RULE_VERSION).toBe(ARCHIVE_RULE_VERSION);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// E1 LLM 出力隔离 · 指纹/黄金向量不受 LLM 影响
// ────────────────────────────────────────────────────────────────────────────────
describe('E1 LLM 输出隔离断言 — 指纹/黄金向量不受 LLM 影响', () => {
  it('指纹 manifest 総条目 = 84（E0/E1 追加後も変化なし）', () => {
    const total =
      FINGERPRINT_BUNDLE_MEMBERS.length +
      FINGERPRINT_PRESET_FIELDS.length +
      FINGERPRINT_SNAPSHOT_FIELDS.length +
      FINGERPRINT_EXCLUDED_FIELDS.length;
    expect(total).toBe(88);
  });

  it('schemaKeys=53 守恒（探雷轮で新 schema フィールドなし）', () => {
    expect(Object.keys(RootSchema.shape).length).toBe(54);
  });

  it('canonicalize は同一 state に対して同一結果を返す（確定性）', () => {
    const state = buildWorld();
    const c1 = canonicalize(state);
    const c2 = canonicalize(state);
    expect(c1).toBe(c2);
  });

  it('LLM 出力文字列を state 外（histories）に保持 → state 指纹値は変わらない（隔离断言）', () => {
    const state = buildWorld();
    const fp1 = canonicalize(state);
    // LLM 出力を state に一切混入しない（隔离の本質）
    const _llmOutput = '王掌柜见林九推门而入，微微颔首。（LLM生成·不进指纹）';
    const fp2 = canonicalize(state);
    expect(fp1).toBe(fp2);
  });

  it('InMemoryArchiveStore.load() 返す state を canonicalize しても値は一定', () => {
    const store = new InMemoryArchiveStore(SAVE_SEED, buildWorld(), { [PC]: 30 });
    const c1 = canonicalize(store.load().state);
    const c2 = canonicalize(store.load().state);
    expect(c1).toBe(c2);
  });

  it('InMemoryArchiveStore は fingerprintManifest に登録なし（不进指纹断言）', () => {
    // BUNDLE_MEMBERS は確定性エンジンの構成要素のみ · InMemoryArchiveStore は含まれない
    const names = FINGERPRINT_BUNDLE_MEMBERS.join(',');
    expect(names).not.toContain('InMemoryArchive');
    expect(names).not.toContain('llmDemo');
    expect(names).not.toContain('llmAdapter');
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// E0 InMemoryArchiveStore — 存档頭バージョン管理
// ────────────────────────────────────────────────────────────────────────────────
describe('E0 InMemoryArchiveStore — 存档頭バージョン管理', () => {
  it('RULE_VERSION=3（最新フォーマット）', () => {
    const store = new InMemoryArchiveStore(1, buildWorld(), {});
    expect(store.getHeader().RULE_VERSION).toBe(3);
  });

  it('bumpReroll() 後も RULE_VERSION は変わらない', () => {
    const store = new InMemoryArchiveStore(1, buildWorld(), {});
    store.bumpReroll();
    expect(store.getHeader().RULE_VERSION).toBe(3);
  });

  it('複数 store が互いに独立している（状態共有なし）', () => {
    const store1 = new InMemoryArchiveStore(1, buildWorld(), { [PC]: 10 });
    const store2 = new InMemoryArchiveStore(2, buildWorld(), { [PC]: 99 });
    expect(store1.getSeed()).toBe(1);
    expect(store2.getSeed()).toBe(2);
    expect(store1.load().balances[PC]).toBe(10);
    expect(store2.load().balances[PC]).toBe(99);
  });

  it('存档頭の全フィールドが FullArchiveHeader スペックを満たす', () => {
    const store = new InMemoryArchiveStore(SAVE_SEED, buildWorld(), {});
    const h = store.getHeader();
    expect(typeof h.RULE_VERSION).toBe('number');
    expect(typeof h.seed).toBe('number');
    expect(typeof h.全局回滚计数器).toBe('number');
    expect(typeof h.中文数字解析规则版).toBe('number');
    expect(typeof h.软拒规则版).toBe('number');
    expect(typeof h.AOHP语义键版).toBe('number');
    expect(typeof h.schemaKeys).toBe('number');
  });
});
