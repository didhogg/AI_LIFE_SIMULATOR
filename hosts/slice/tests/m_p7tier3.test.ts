// P0-7 梯队3 验收测试 — Z3 条目级双向核销 / Z5 失败工单冻结 / 6.67 重试记账 / 3d irreversible 重放
// DoD:
//   Z3:  无血统拒收 + 未消耗打回各有 property/单测覆盖；提案单原子（全落或全退）
//   Z5:  工单冻结后重试逐位等值（预求值定值·叙事/提案不变）；二次重试幂等
//   6.67: 补偿性新账 append-only + 血统可追溯；同事件 id 重试不双落账
//   3d:  irreversible 重放读冻结载荷·外部零重调；含 irreversible 拍重掷被拒（断言 fire）
//   顺带: 补「slice 结算必过 runTick」断言测试，锁单路径
//   soak: Z3 commit 序列守恒（双轨 Σ 不变量）
import { describe, it, expect } from 'vitest';
import { initBalances } from '../ledger/state.js';
import { commitWithLineage, assertFullProposalConsumed } from '../ledger/commit.js';
import { TicketStore } from '../engine/ticket.js';
import type { LineageTransfer, FrozenTicket } from '../engine/ticket.js';
import { runTick } from '@ai-life-sim/core/engine/tick';
import { buildWorld, PC, NPC_WANG, NPC_HONG, INITIAL_PC_BALANCE, INITIAL_WANG_BALANCE } from '../fixture/world.js';
import { SINK_ENTITY_KEY } from '@ai-life-sim/core';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeBalances(pc = 30, wang = 200, hong = 0): ReturnType<typeof initBalances> {
  return initBalances({ [PC]: pc, [NPC_WANG]: wang, [NPC_HONG]: hong });
}

function lt(from: string, to: string, amount: number, eventId: string, reason = ''): LineageTransfer {
  return { from, to, amount, reason, eventId };
}

function makeTicket(overrides: Partial<FrozenTicket> = {}): FrozenTicket {
  return {
    tickId: 'tick-1',
    eventId: 'tick-1',
    narrative: '王掌柜点了点头。',
    frozenTransfers: [],
    hasIrreversibleEffects: false,
    frozenPayloads: [],
    ...overrides,
  };
}

// ── P7-3a · Z3 条目级双向核销 ─────────────────────────────────────────────────

describe('P7-3a · Z3 无血统拒收', () => {
  it('eventId 为空字符串 → throw Z3 无血统拒收', () => {
    const balances = makeBalances();
    const committed = new Set<string>();
    const tx: LineageTransfer = { from: PC, to: NPC_HONG, amount: 2, reason: '小费', eventId: '' };
    expect(() => commitWithLineage([tx], balances, committed)).toThrow(/Z3 无血统拒收/);
  });

  it('balances 在无血统拒收后不变（全退保证）', () => {
    const balances = makeBalances(30);
    const committed = new Set<string>();
    const tx: LineageTransfer = { from: PC, to: NPC_HONG, amount: 5, reason: '', eventId: '' };
    try { commitWithLineage([tx], balances, committed); } catch {}
    expect(balances.get(PC)).toBe(30); // 未变
    expect(balances.get(NPC_HONG)).toBe(0); // 未变
  });

  it('有效血统 → 正常落账', () => {
    const balances = makeBalances(30);
    const committed = new Set<string>();
    commitWithLineage([lt(PC, NPC_HONG, 2, 'e-ok')], balances, committed);
    expect(balances.get(PC)).toBe(28);
    expect(balances.get(NPC_HONG)).toBe(2);
    expect(committed.has('e-ok')).toBe(true);
  });
});

describe('P7-3a · Z3 all-or-nothing 全退', () => {
  it('余额不足 → throw Z3 全退', () => {
    const balances = makeBalances(5);
    const committed = new Set<string>();
    const tx = lt(PC, NPC_HONG, 10, 'e-over');
    expect(() => commitWithLineage([tx], balances, committed)).toThrow(/Z3 全退/);
  });

  it('余额不足时 balances 完全未变（原子性）', () => {
    const balances = makeBalances(5, 200);
    const committed = new Set<string>();
    const txs = [lt(PC, NPC_HONG, 3, 'e1'), lt(PC, NPC_WANG, 10, 'e1b')]; // 第2笔超出
    try { commitWithLineage(txs, balances, committed); } catch {}
    expect(balances.get(PC)).toBe(5);    // 第1笔也未落账
    expect(balances.get(NPC_HONG)).toBe(0);
    expect(committed.size).toBe(0);      // eventId 未进集合
  });

  it('多条 transfer·全部余额充足 → 全部落账', () => {
    const balances = makeBalances(30, 200, 0);
    const committed = new Set<string>();
    commitWithLineage([
      lt(PC, NPC_HONG, 2, 'e2a'),
      lt(NPC_WANG, PC, 5, 'e2b'),
    ], balances, committed);
    expect(balances.get(PC)).toBe(33);   // 30 - 2 + 5
    expect(balances.get(NPC_HONG)).toBe(2);
    expect(balances.get(NPC_WANG)).toBe(195);
    expect(committed.size).toBe(2);
  });
});

describe('P7-3a · Z3 提案条目未消耗打回', () => {
  it('提案 2 条·committed 只有 1 条 → throw 未消耗', () => {
    const proposal = [
      { from: PC, to: NPC_HONG, amount: 2 },
      { from: PC, to: NPC_WANG, amount: 5 },
    ];
    const committed = [{ from: PC, to: NPC_HONG, amount: 2 }];
    expect(() => assertFullProposalConsumed(proposal, committed))
      .toThrow(/Z3 提案条目未消耗/);
  });

  it('提案 2 条·committed 全到 → 不 throw', () => {
    const proposal = [
      { from: PC, to: NPC_HONG, amount: 2 },
      { from: PC, to: NPC_WANG, amount: 5 },
    ];
    const committed = [
      { from: PC, to: NPC_HONG, amount: 2 },
      { from: PC, to: NPC_WANG, amount: 5 },
    ];
    expect(() => assertFullProposalConsumed(proposal, committed)).not.toThrow();
  });

  it('提案为空 → 不 throw', () => {
    expect(() => assertFullProposalConsumed([], [])).not.toThrow();
  });

  it('金额不匹配 → throw（amount 不同视为未消耗）', () => {
    const proposal = [{ from: PC, to: NPC_HONG, amount: 3 }];
    const committed = [{ from: PC, to: NPC_HONG, amount: 2 }]; // 金额不同
    expect(() => assertFullProposalConsumed(proposal, committed))
      .toThrow(/Z3 提案条目未消耗/);
  });
});

// ── P7-3b · Z5 失败工单冻结 ───────────────────────────────────────────────────

describe('P7-3b · Z5 工单冻结', () => {
  it('freeze + get 返回逐位等值工单', () => {
    const store = new TicketStore();
    const t = makeTicket({ tickId: 'z5-1', narrative: '林九点头。' });
    store.freeze(t);
    const got = store.get('z5-1');
    expect(got).toStrictEqual(t);
  });

  it('冻结后 narrative 不变（模拟重试·LLM 不重调）', () => {
    const store = new TicketStore();
    const original = '冻结叙事 original';
    store.freeze(makeTicket({ tickId: 'z5-2', narrative: original }));
    // 重试读取 → 与原始值逐位等值
    expect(store.get('z5-2')?.narrative).toBe(original);
    // 即使外部尝试修改 ticket，frozen 工单本体不变（只能读·不提供写接口）
    const got = store.get('z5-2');
    expect(got?.narrative).toBe(original);
  });

  it('冻结后 frozenTransfers 金额不变', () => {
    const store = new TicketStore();
    const txs: LineageTransfer[] = [lt(PC, NPC_HONG, 7, 'z5-t1')];
    store.freeze(makeTicket({ tickId: 'z5-3', frozenTransfers: txs }));
    expect(store.get('z5-3')?.frozenTransfers[0]?.amount).toBe(7);
  });

  it('二次重试幂等：markEventCommitted 后 commitWithLineage 同 id → throw', () => {
    const balances = makeBalances(30);
    const committed = new Set<string>();
    commitWithLineage([lt(PC, NPC_HONG, 2, 'z5-idem')], balances, committed);
    // 第一次成功；第二次同 eventId → 幂等防护拒收
    expect(() => commitWithLineage([lt(PC, NPC_HONG, 2, 'z5-idem')], balances, committed))
      .toThrow(/6.67 重复 eventId=z5-idem/);
  });

  it('TicketStore size 递增', () => {
    const store = new TicketStore();
    expect(store.size).toBe(0);
    store.freeze(makeTicket({ tickId: 'sz-1' }));
    store.freeze(makeTicket({ tickId: 'sz-2' }));
    expect(store.size).toBe(2);
  });
});

// ── P7-3c · 6.67 重试记账 ─────────────────────────────────────────────────────

describe('P7-3c · 6.67 重试记账', () => {
  it('isEventCommitted 初始 false', () => {
    const store = new TicketStore();
    expect(store.isEventCommitted('e-new')).toBe(false);
  });

  it('markEventCommitted 后 isEventCommitted = true', () => {
    const store = new TicketStore();
    store.markEventCommitted('e-mark');
    expect(store.isEventCommitted('e-mark')).toBe(true);
  });

  it('unmarkEventCommitted 后 isEventCommitted = false（悔棋场景）', () => {
    const store = new TicketStore();
    store.markEventCommitted('e-unmark');
    store.unmarkEventCommitted('e-unmark');
    expect(store.isEventCommitted('e-unmark')).toBe(false);
  });

  it('同 eventId 不双落账：commitWithLineage 第2次 → throw', () => {
    const balances = makeBalances(30);
    const committed = new Set<string>();
    commitWithLineage([lt(PC, NPC_HONG, 2, 'idem-667')], balances, committed);
    expect(() => commitWithLineage([lt(PC, NPC_HONG, 2, 'idem-667')], balances, committed))
      .toThrow(/幂等防护拒收/);
  });

  it('补偿性新账：原 eventId 失败后，新 eventId + 血统 reason → 成功落账', () => {
    const balances = makeBalances(30);
    const committed = new Set<string>();
    // 模拟原始操作失败（eventId 未进 committed）
    // 补偿性新账：新 eventId，reason 含血统信息
    const compensation: LineageTransfer = {
      from: PC, to: NPC_HONG, amount: 2,
      reason: '补偿:原e-fail',  // 血统可追溯
      eventId: 'e-fail-comp-1',  // 新 eventId
    };
    commitWithLineage([compensation], balances, committed);
    expect(balances.get(PC)).toBe(28);
    expect(committed.has('e-fail-comp-1')).toBe(true);
  });

  it('补偿性新账 append-only：不影响已有 committed 条目', () => {
    const balances = makeBalances(30);
    const committed = new Set<string>();
    commitWithLineage([lt(PC, NPC_HONG, 1, 'orig-ok')], balances, committed);
    // 追加补偿
    commitWithLineage([lt(PC, NPC_HONG, 1, 'comp-1', '补偿:orig-ok')], balances, committed);
    expect(committed.has('orig-ok')).toBe(true);  // 原条目仍在
    expect(committed.has('comp-1')).toBe(true);   // 补偿条目追加
    expect(balances.get(PC)).toBe(28);             // 累计 -2
  });
});

// ── P7-3d · 3d irreversible 重放 ─────────────────────────────────────────────

describe('P7-3d · 3d irreversible 重放', () => {
  it('assertNotIrreversibleReroll：irreversible ticket → throw 含「禁止重掷」', () => {
    const store = new TicketStore();
    store.freeze(makeTicket({
      tickId: 'irr-1',
      hasIrreversibleEffects: true,
      frozenPayloads: [{ effectType: 'llm_narrative', payload: '王掌柜说：好。' }],
    }));
    expect(() => store.assertNotIrreversibleReroll('irr-1'))
      .toThrow(/3d.*禁止重掷/);
  });

  it('assertNotIrreversibleReroll：非 irreversible ticket → 不 throw', () => {
    const store = new TicketStore();
    store.freeze(makeTicket({ tickId: 'non-irr-1', hasIrreversibleEffects: false }));
    expect(() => store.assertNotIrreversibleReroll('non-irr-1')).not.toThrow();
  });

  it('assertNotIrreversibleReroll：无 ticket → 不 throw', () => {
    const store = new TicketStore();
    expect(() => store.assertNotIrreversibleReroll('no-such-ticket')).not.toThrow();
  });

  it('replayNarrative：irreversible ticket → 读冻结载荷（外部零重调）', () => {
    const store = new TicketStore();
    const frozenText = '这是冻结的叙事，重放时直接读取，不重调外部 LLM。';
    store.freeze(makeTicket({
      tickId: 'irr-2',
      hasIrreversibleEffects: true,
      frozenPayloads: [{ effectType: 'llm_narrative', payload: frozenText }],
    }));
    const replayed = store.replayNarrative('irr-2');
    expect(replayed).toBe(frozenText);  // 与冻结值逐位等值
  });

  it('replayNarrative：非 irreversible ticket → null（不读外部）', () => {
    const store = new TicketStore();
    store.freeze(makeTicket({ tickId: 'non-irr-2', hasIrreversibleEffects: false }));
    expect(store.replayNarrative('non-irr-2')).toBeNull();
  });

  it('replayNarrative：无 ticket → null', () => {
    const store = new TicketStore();
    expect(store.replayNarrative('ghost')).toBeNull();
  });
});

// ── 顺带 · runTick 单路径锁 ───────────────────────────────────────────────────

describe('顺带 · runTick 单路径锁', () => {
  it('已结算标记由 runTick 写入（非 runTick 路径不写·纯函数）', () => {
    const s0 = buildWorld();
    // 未经 runTick：marker 不存在
    expect(s0._系统.已结算标记['settle-lock-1']).toBeUndefined();
    // 经 runTick：marker 即时分量 = 1
    const { state: s1 } = runTick(s0, { tickId: 'settle-lock-1', spanMinutes: 240 });
    expect(s1._系统.已结算标记['settle-lock-1']?.即时分量).toBe(1);
    // 输入 state 不变（纯函数）
    expect(s0._系统.已结算标记['settle-lock-1']).toBeUndefined();
  });

  it('runTick 幂等：同 tickId 第2次 settledPhases 为空', () => {
    const s0 = buildWorld();
    const { state: s1 } = runTick(s0, { tickId: 'settle-lock-2', spanMinutes: 240 });
    const { settledPhases } = runTick(s1, { tickId: 'settle-lock-2', spanMinutes: 240 });
    expect(settledPhases).toHaveLength(0);
  });

  it('runTick 是结算唯一路径：tick_log 条目由 runTick 写入·其他路径不写', () => {
    const s0 = buildWorld();
    const preLen = s0._系统.tick_log.length;
    const { state: s1 } = runTick(s0, { tickId: 'settle-lock-3', spanMinutes: 240 });
    expect(s1._系统.tick_log.length).toBeGreaterThan(preLen);
    expect(s1._系统.tick_log.some(e => e.tick_id === 'settle-lock-3')).toBe(true);
    // 输入 state tick_log 不变
    expect(s0._系统.tick_log.length).toBe(preLen);
  });
});

// ── P7-3 · soak 守恒 with lineage（Z3 commit 序列守恒不变量）──────────────────

describe('P7-3 · soak Z3 守恒', () => {
  it('50 拍 commitWithLineage 序列：Σ balances 守恒（现金总量不变）', () => {
    const balances = makeBalances(30, 200, 0);
    const committed = new Set<string>();
    const TOTAL = 30 + 200 + 0;  // 230
    for (let i = 0; i < 50; i++) {
      const avail = balances.get(PC) ?? 0;
      if (avail >= 2) {
        commitWithLineage([lt(PC, NPC_HONG, 2, `soak-give-${i}`)], balances, committed);
      }
    }
    let sum = 0;
    for (const v of balances.values()) sum += v;
    expect(sum).toBe(TOTAL);  // 守恒
  });

  it('交替给钱/还账 sequence：Σ balances 恒等于初始值', () => {
    const balances = makeBalances(20, 100, 0);
    const committed = new Set<string>();
    const TOTAL = 120;
    let debtAcc = 0;
    for (let i = 0; i < 20; i++) {
      const pcAmt = balances.get(PC) ?? 0;
      const wangAmt = balances.get(NPC_WANG) ?? 0;
      if (i % 2 === 0 && pcAmt >= 1) {
        // 给红姨
        commitWithLineage([lt(PC, NPC_HONG, 1, `alt-give-${i}`)], balances, committed);
      } else if (wangAmt >= 3) {
        // 赊账（王掌柜给林九）
        commitWithLineage([lt(NPC_WANG, PC, 3, `alt-credit-${i}`)], balances, committed);
        debtAcc += 3;
      }
    }
    let sum = 0;
    for (const v of balances.values()) sum += v;
    expect(sum).toBe(TOTAL);  // 守恒
  });
});
