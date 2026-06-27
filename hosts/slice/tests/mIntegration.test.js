// M-a 纵切体检 — P0-6 真件集成验证
// 验证 runProposalGate / computeDelta / clampLedger / mergeInterventionDeltas
// 可在 hosts/slice 域内以 RootSchema.parse() 构造的 RootState 上正确调用。
// 红线：不改 packages/core 任何文件。
import { describe, it, expect } from 'vitest';
import { RootSchema, } from '@ai-life-sim/core';
import { runProposalGate } from '@ai-life-sim/core/engine/proposal/runProposalGate';
import { computeDelta } from '@ai-life-sim/core/engine/proposal/computeDelta';
import { clampLedger } from '@ai-life-sim/core/engine/math/ledger';
import { mergeInterventionDeltas } from '@ai-life-sim/core/interfaces/interventionMerge';
import { buildWorld, PC, NPC_WANG } from '../fixture/world.js';
// ── 构造一个含 per-entity 账本的最小 RootState ────────────────────────────────
function makeStateWithAccounts() {
    return RootSchema.parse({
        货币系统: {
            基准币种: '文',
            账户: {
                [PC]: { 持有: { '文': 100 } },
                [NPC_WANG]: { 持有: { '文': 200 } },
            },
        },
    });
}
// 指令信封 rawEnvelope 最小合法结构（提案 字段必填·所有子字段有 default）
const MINIMAL_ENVELOPE = { 提案: {} };
describe('M-a · P0-6 真件集成验证', () => {
    it('RootSchema.parse 产出完整 RootState（buildWorld 类型债已清）', () => {
        const state = buildWorld();
        // NPC 字段在位
        expect(state.NPC[PC]?.姓名).toBe('林九');
        expect(state.NPC[PC]?.位置).toBe('loc_yuelai_inn');
        // 体质/魅力 嵌于 NPC.属性 子对象（actor.ts: 属性Schema）
        expect(state.NPC[PC]?.属性?.体质).toBe(5);
        expect(state.NPC[PC]?.属性?.魅力).toBe(6);
        // 顶层 core 字段由 Zod 默认填充
        expect(state._系统版本).toBe('4.1');
        expect(state._tick).toBeDefined();
        // 秘密库
        expect(state.全局.秘密库['S1']?.母题).toBe('窝藏通缉旧友');
    });
    it('clampLedger 从 core 正常调用（返回 {value, exceeded} 对象·已导入真件）', () => {
        // clampLedger returns { value, exceeded, ceiling, label } not a raw number
        expect(clampLedger(250, 0, 200, 'test').value).toBe(200);
        expect(clampLedger(250, 0, 200, 'test').exceeded).toBe(true);
        expect(clampLedger(-10, 0, 200, 'test').value).toBe(0);
        expect(clampLedger(50, 0, 200, 'test').value).toBe(50);
        expect(clampLedger(50, 0, 200, 'test').exceeded).toBe(false);
    });
    it('computeDelta 只算不写（add op·返回 proposedValue·原 state 零改）', () => {
        const state = makeStateWithAccounts();
        const result = computeDelta(state, { path: `货币系统.账户.${PC}.持有.文`, op: 'add', value: 50 });
        expect(result.proposedValue).toBe(150); // 100 + 50
        // original state unchanged
        expect(state.货币系统?.账户?.[PC]?.持有?.['文']).toBe(100);
    });
    it('mergeInterventionDeltas 取严合并（约束 clamp 取严·内容后载覆盖）', () => {
        const pack1 = [{ path: '货币系统.账户.pc_a.持有.文', op: 'add', value: 100, max_delta: 80 }];
        const pack2 = [{ path: '货币系统.账户.pc_a.持有.文', op: 'add', value: 100, max_delta: 120 }];
        const merged = mergeInterventionDeltas([pack1, pack2]);
        // 约束类 max_delta 取严（最小值 = 80）
        expect(merged[0]?.max_delta).toBe(80);
    });
    it('runProposalGate 端到端：packs delta → state 更新·原 state 不变', () => {
        const state = makeStateWithAccounts();
        // Signature: runProposalGate(rawEnvelope, state, seatId, 授权源, packs?)
        // rawEnvelope must satisfy 指令信封Schema（提案 字段必填·子字段均有 default）
        const result = runProposalGate(MINIMAL_ENVELOPE, state, 'seat-local', // seatId
        '系统', // 授权源
        [[{ path: `货币系统.账户.${PC}.持有.文`, op: 'add', value: 30 }]]);
        expect(result.ok).toBe(true);
        if (result.ok) {
            const newBal = result.state.货币系统?.账户?.[PC]?.持有?.['文'];
            expect(newBal).toBe(130); // 100 + 30
            // 原 state 不可变（structuredClone 原子回滚保证）
            expect(state.货币系统?.账户?.[PC]?.持有?.['文']).toBe(100);
        }
    });
    it('runProposalGate reject：M2 越权授权源 → fail-closed·Gate③-M2', () => {
        const state = makeStateWithAccounts();
        const result = runProposalGate(MINIMAL_ENVELOPE, state, 'seat-local', '天命', // ← 非法授权源（VALID_OVERWRITE_AUTH_SOURCES = ['系统','裁判','玩家确认']）
        [[{ path: `货币系统.账户.${PC}.持有.文`, op: 'add', value: 30 }]]);
        expect(result.ok).toBe(false);
        expect(result.gate).toBe('③-M2');
        // state 零改
        expect(state.货币系统?.账户?.[PC]?.持有?.['文']).toBe(100);
    });
});
