// P0-8 Batch 2: 校验闸族验收测试
// ① 信念派生 P–R–B（gate 双轨·R7-b 指纹边界）
// ② PANGeA 叙事语义校验（越权知情/凭空物品/在场矛盾/时序错乱·纠偏重试·软拒）
// ③ 玩家主权（失败不自动重生·不替玩家选·token不升·设置项切换自动重生）
// ④ WhatELSE 动机校验（情绪矛盾/记忆违背·依赖①信念态·失败通软拒通道）
// ⑤ 校验闸见真相·输出过滤·无后门（物理隔离断言）
import { describe, it, expect } from 'vitest';
import { RootSchema } from '@ai-life-sim/core';
import { FINGERPRINT_BUNDLE_MEMBERS } from '@ai-life-sim/core/engine/fingerprintManifest';
import { deriveBeliefState, } from '@ai-life-sim/core/engine/beliefDerive';
import { validateNarrativeSemantics, makeEmptyValidationSlice, DEFAULT_RETRY_MODE, } from '@ai-life-sim/core/engine/narrativeValidator';
import { validateMotivations, buildMotivationAnchor, } from '@ai-life-sim/core/engine/motivationValidator';
import { runValidationGate, deriveBeliefFromState, } from '../engine/validationGate.js';
import { buildWorld, PC, NPC_WANG, NPC_HONG, LOC_NAME, } from '../fixture/world.js';
// ── fixtures ─────────────────────────────────────────────────────────────────
const BASE_STATE = buildWorld();
// 认知档案：PC 对 npc_wang 有吝啬（负·强度75）+勤劳（正·强度50）印象
function makeCogArchiveForPC() {
    return {
        [NPC_WANG]: {
            了解度: 70,
            误差表: {},
            印象: [
                { 标签: '吝啬', 极性: '负', 强度: 75, 来源: '直接观察', 获知时间: 0, 衰减速率: 0 },
                { 标签: '勤劳', 极性: '正', 强度: 50, 来源: '耳闻', 获知时间: 0, 衰减速率: 0 },
            ],
            时效: 0, 姓名知识: '已知姓名',
        },
    };
}
function makeStateWithCogArchiveAndNPCState() {
    const cogData = { [PC]: makeCogArchiveForPC() };
    return RootSchema.parse({
        ...BASE_STATE,
        认知档案: cogData,
        NPC: {
            ...BASE_STATE.NPC,
            [NPC_WANG]: {
                ...BASE_STATE.NPC?.[NPC_WANG],
                情绪栈: [
                    { 情绪名: '警惕', 强度: 70, 触发条件: '', 衰减速率: 0 },
                    { 情绪名: '好奇', 强度: 40, 触发条件: '', 衰减速率: 0 },
                ],
                记忆: [
                    { 记忆id: 'm1', 摘要: '林九赊账了三次', 重要度: 3, 情绪色彩: '不满', 权重: 70, 发生时间: 0, 类型: '互动', 永久: false, 上次唤起时间: 0 },
                ],
            },
        },
    });
}
// ValidationSlice fixtures
const SECRET_MOTIF = '窝藏通缉旧友'; // S1 母题
const SLICE_PC_POV = {
    allSecretMotifs: [SECRET_MOTIF], // 真值层（PC 不该知道）
    povKnownMotifs: [], // PC 不知情
    presentNpcNames: ['王掌柜', '红姨'],
    absentNpcNames: [],
    tickCount: 5,
};
const SLICE_WANG_POV = {
    allSecretMotifs: [SECRET_MOTIF],
    povKnownMotifs: [SECRET_MOTIF], // 王掌柜知情
    presentNpcNames: ['林九', '红姨'],
    absentNpcNames: [],
    tickCount: 5,
};
const SLICE_WITH_ABSENT = {
    ...SLICE_PC_POV,
    presentNpcNames: ['王掌柜'],
    absentNpcNames: ['红姨'], // 红姨不在场
};
// 叙事 fixtures
const NARRATIVE_VALID = '王掌柜在柜台后擦拭杯盏，林九坐在角落里慢饮着淡酒。';
const NARRATIVE_OVERREACH = `王掌柜提到了${SECRET_MOTIF}，令林九大为惊讶。`; // PC POV 越权
const NARRATIVE_PRESENCE_CONFLICT = '红姨走进客栈，对着林九拱手道：「掌柜不在呢。」'; // 红姨不在场
const NARRATIVE_INVENTED_ITEM = '林九从桌上拿起了【凭空物品:飞天宝剑】，挥舞了几下。';
const NARRATIVE_TEMPORAL_ANOMALY = '林九想起了【未来拍:10】时会发生的大事。'; // 未来拍（当前拍5）
const NARRATIVE_EMOTION_CONFLICT = '王掌柜欣然同意了林九的所有要求，毫无戒心地一一答应。'; // 与警惕情绪矛盾
const NARRATIVE_MEMORY_VIOLATION = '王掌柜毫不介意林九过去的赊账，慷慨地又垫了一轮茶钱。'; // 违背不满记忆
const NARRATIVE_WANG_VALID = '王掌柜警觉地打量了林九一眼，没有立即作答。'; // 与情绪一致
// ── ① 信念派生 P–R–B ─────────────────────────────────────────────────────────
describe('P0-8 ① 信念派生 P–R–B', () => {
    it('从认知档案派生出 BeliefState（含感知/推理/信念三层）', () => {
        const cogArchive = makeCogArchiveForPC();
        const state = makeStateWithCogArchiveAndNPCState();
        const filteredSecrets = {}; // PC 不知情·空
        const bs = deriveBeliefState(cogArchive, filteredSecrets, PC, 'narrative');
        expect(bs.povKey).toBe(PC);
        expect(bs.感知.length).toBeGreaterThan(0);
        expect(bs.信念.length).toBeGreaterThan(0);
    });
    it('感知层包含吝啬印象（来自认知档案）', () => {
        const cogArchive = makeCogArchiveForPC();
        const bs = deriveBeliefState(cogArchive, {}, PC, 'narrative');
        const hasLingse = bs.感知.some(p => p.fact.includes('吝啬'));
        expect(hasLingse).toBe(true);
    });
    it('强度>60 的负面印象 → 推理层生成「需保持警惕」推断', () => {
        const cogArchive = makeCogArchiveForPC();
        const bs = deriveBeliefState(cogArchive, {}, PC, 'narrative');
        const hasWary = bs.推理.some(r => r.inference.includes('需保持警惕'));
        expect(hasWary).toBe(true);
    });
    it('trackPath=narrative → 信念全部标 narrative（不进指纹路径）', () => {
        const cogArchive = makeCogArchiveForPC();
        const bs = deriveBeliefState(cogArchive, {}, PC, 'narrative');
        expect(bs.信念.every(b => b.trackPath === 'narrative')).toBe(true);
    });
    it('trackPath=gate → 信念全部标 gate（进指纹路径·gate 消费）', () => {
        const cogArchive = makeCogArchiveForPC();
        const bs = deriveBeliefState(cogArchive, {}, PC, 'gate');
        expect(bs.信念.every(b => b.trackPath === 'gate')).toBe(true);
    });
    it('同入参→同输出（纯函数·确定性·R7-b gate路径可重放）', () => {
        const cogArchive = makeCogArchiveForPC();
        const bs1 = deriveBeliefState(cogArchive, {}, PC, 'gate');
        const bs2 = deriveBeliefState(cogArchive, {}, PC, 'gate');
        // 确定性：同入参输出等价
        expect(bs1.感知.length).toBe(bs2.感知.length);
        expect(bs1.推理.length).toBe(bs2.推理.length);
        expect(bs1.信念.length).toBe(bs2.信念.length);
        expect(bs1.信念[0]?.trackPath).toBe(bs2.信念[0]?.trackPath);
    });
    it('信念派生 BeliefState 不进 FINGERPRINT_BUNDLE_MEMBERS（叙事召回·R7-b）', () => {
        const members = FINGERPRINT_BUNDLE_MEMBERS.map(m => m.toLowerCase());
        for (const m of members) {
            expect(m).not.toContain('beliefstate');
            expect(m).not.toContain('belief_derive');
            expect(m).not.toContain('narrative_belief');
        }
    });
    it('知情秘密 → 信念层派生「知晓秘密」条目', () => {
        const filteredSecrets = { S1: { 母题: SECRET_MOTIF, 严重度: 70, 暴露度: 0 } };
        const bs = deriveBeliefState(undefined, filteredSecrets, NPC_WANG, 'narrative');
        const hasSecret = bs.信念.some(b => b.content.includes('知晓秘密') && b.content.includes('S1'));
        expect(hasSecret).toBe(true);
    });
    it('自我条目跳过（POV 实体自己不派生对自己的信念）', () => {
        const cogArchive = { [PC]: makeCogArchiveForPC()[NPC_WANG] }; // PC 对自己的档案
        const bs = deriveBeliefState(cogArchive, {}, PC, 'narrative');
        const selfBelief = bs.信念.some(b => b.subjectKey === PC);
        expect(selfBelief).toBe(false);
    });
});
// ── ② PANGeA 叙事语义校验 ──────────────────────────────────────────────────────
describe('P0-8 ② PANGeA 叙事语义校验', () => {
    it('越权知情 fixture → 检出 conflict(type=越权知情)', () => {
        const result = validateNarrativeSemantics(NARRATIVE_OVERREACH, SLICE_PC_POV);
        expect(result.valid).toBe(false);
        expect(result.conflicts.some(c => c.type === '越权知情')).toBe(true);
    });
    it('王掌柜 POV 提及 S1 → 合法·无冲突（知情名单在内）', () => {
        const result = validateNarrativeSemantics(NARRATIVE_OVERREACH, SLICE_WANG_POV);
        // 王掌柜知情 → 越权知情不触发
        expect(result.conflicts.filter(c => c.type === '越权知情').length).toBe(0);
    });
    it('在场矛盾 fixture（红姨不在场但叙事有进入动作）→ 检出 conflict', () => {
        const result = validateNarrativeSemantics(NARRATIVE_PRESENCE_CONFLICT, SLICE_WITH_ABSENT);
        expect(result.valid).toBe(false);
        expect(result.conflicts.some(c => c.type === '在场矛盾')).toBe(true);
    });
    it('凭空物品 fixture → 检出 conflict(type=凭空物品)', () => {
        const result = validateNarrativeSemantics(NARRATIVE_INVENTED_ITEM, SLICE_PC_POV);
        expect(result.valid).toBe(false);
        expect(result.conflicts.some(c => c.type === '凭空物品')).toBe(true);
    });
    it('时序错乱 fixture（引用未来拍）→ 检出 conflict(type=时序错乱)', () => {
        const result = validateNarrativeSemantics(NARRATIVE_TEMPORAL_ANOMALY, SLICE_PC_POV);
        expect(result.valid).toBe(false);
        expect(result.conflicts.some(c => c.type === '时序错乱')).toBe(true);
    });
    it('有效叙事 → valid=true·conflicts为空', () => {
        const result = validateNarrativeSemantics(NARRATIVE_VALID, SLICE_PC_POV);
        expect(result.valid).toBe(true);
        expect(result.conflicts.length).toBe(0);
        expect(result.retriedOnce).toBe(false);
    });
    it('纠偏重试：首次失败+重试叙事通过 → valid=true·retriedOnce=true', () => {
        const result = validateNarrativeSemantics(NARRATIVE_OVERREACH, SLICE_PC_POV, NARRATIVE_VALID);
        expect(result.valid).toBe(true);
        expect(result.retriedOnce).toBe(true);
        expect(result.softReject).toBeUndefined();
    });
    it('单次纠偏重试：首次+重试均失败 → valid=false·软拒·retriedOnce=true', () => {
        const result = validateNarrativeSemantics(NARRATIVE_OVERREACH, SLICE_PC_POV, NARRATIVE_OVERREACH, // 重试仍然越权
        'single_retry_soft_reject');
        expect(result.valid).toBe(false);
        expect(result.softReject).toBeDefined();
        expect(result.softReject.ui提示).toContain('重 Roll');
        expect(result.retriedOnce).toBe(true);
    });
    it('DEFAULT_RETRY_MODE 是 single_retry_soft_reject（玩家主权默认）', () => {
        expect(DEFAULT_RETRY_MODE).toBe('single_retry_soft_reject');
    });
});
// ── ③ 玩家主权断言 ────────────────────────────────────────────────────────────
describe('P0-8 ③ 玩家主权断言', () => {
    it('default 模式失败不自动重生（softReject 而非 autoRegen）', () => {
        const result = validateNarrativeSemantics(NARRATIVE_OVERREACH, SLICE_PC_POV, NARRATIVE_OVERREACH, 'single_retry_soft_reject');
        // 断言: softReject 存在 = 还权玩家；不是自动重生
        expect(result.softReject).toBeDefined();
        expect(result.valid).toBe(false);
    });
    it('失败时 ui提示 不包含「自动重生」字样（不替玩家做选择）', () => {
        const result = validateNarrativeSemantics(NARRATIVE_OVERREACH, SLICE_PC_POV, NARRATIVE_OVERREACH, 'single_retry_soft_reject');
        expect(result.softReject?.ui提示).not.toContain('自动重生');
    });
    it('单次纠偏重试模式：retriedOnce=true 说明只重试了一次（不升 token 预算）', () => {
        const result = validateNarrativeSemantics(NARRATIVE_OVERREACH, SLICE_PC_POV, NARRATIVE_OVERREACH, 'single_retry_soft_reject');
        // retriedOnce=true = 消耗了 1 次重试·不会继续消耗更多（玩家主权：不升预算）
        expect(result.retriedOnce).toBe(true);
    });
    it('auto_regen 模式：双失败时无软拒（接口就位·模式切换有效）', () => {
        const result = validateNarrativeSemantics(NARRATIVE_OVERREACH, SLICE_PC_POV, NARRATIVE_OVERREACH, 'auto_regen');
        // auto_regen 模式: 不立即软拒·由调用方继续生成（接口就位）
        expect(result.softReject).toBeUndefined();
        expect(result.valid).toBe(false); // 仍然失败（需调用方再次尝试）
    });
    it('重试成功时 softReject 不出现（只有真失败才还权玩家）', () => {
        const result = validateNarrativeSemantics(NARRATIVE_OVERREACH, SLICE_PC_POV, NARRATIVE_VALID, 'single_retry_soft_reject');
        expect(result.valid).toBe(true);
        expect(result.softReject).toBeUndefined();
    });
});
// ── ④ WhatELSE 动机校验 ──────────────────────────────────────────────────────
describe('P0-8 ④ WhatELSE 动机校验', () => {
    it('情绪矛盾 fixture → 检出 MotivationConflict(type=情绪矛盾)', () => {
        const dummyBeliefState = { povKey: PC, 感知: [], 推理: [], 信念: [] };
        const anchor = buildMotivationAnchor(NPC_WANG, '王掌柜', dummyBeliefState, ['警惕', '好奇'], // topEmotions: 警惕（负面）
        ['不满']);
        const conflicts = validateMotivations(NARRATIVE_EMOTION_CONFLICT, [anchor]);
        expect(conflicts.some(c => c.conflictType === '情绪矛盾')).toBe(true);
        expect(conflicts[0]?.npcKey).toBe(NPC_WANG);
    });
    it('记忆违背 fixture → 检出 MotivationConflict(type=记忆违背)', () => {
        const dummyBeliefState = { povKey: PC, 感知: [], 推理: [], 信念: [] };
        const anchor = buildMotivationAnchor(NPC_WANG, '王掌柜', dummyBeliefState, [], // 无负面情绪（只测记忆违背）
        ['不满']);
        const conflicts = validateMotivations(NARRATIVE_MEMORY_VIOLATION, [anchor]);
        expect(conflicts.some(c => c.conflictType === '记忆违背')).toBe(true);
    });
    it('信念动机缺失 fixture（【动机缺失:npcKey】标记）→ 检出', () => {
        const dummyBeliefState = { povKey: PC, 感知: [], 推理: [], 信念: [] };
        const anchor = buildMotivationAnchor(NPC_WANG, '王掌柜', dummyBeliefState, [], []);
        const narrative = `王掌柜突然做出了大事【动机缺失:${NPC_WANG}】`;
        const conflicts = validateMotivations(narrative, [anchor]);
        expect(conflicts.some(c => c.conflictType === '信念动机缺失')).toBe(true);
    });
    it('①信念态 BeliefState 被 buildMotivationAnchor 正确消费（beliefs 字段映射）', () => {
        // 从 cogArchive 派生①信念态
        const cogArchive = makeCogArchiveForPC();
        const bs = deriveBeliefState(cogArchive, {}, PC, 'narrative');
        // buildMotivationAnchor 正确从 beliefState 取 beliefs（①→④ 依赖链接）
        const anchor = buildMotivationAnchor(NPC_WANG, '王掌柜', bs, [], []);
        // 信念态中 NPC_WANG 有吝啬/勤劳印象 → anchor.beliefs 包含对应条目
        expect(anchor.beliefs.some(b => b.subjectKey === NPC_WANG)).toBe(true);
    });
    it('无动机冲突（与情绪一致的叙事）→ 空 conflicts', () => {
        const dummyBeliefState = { povKey: PC, 感知: [], 推理: [], 信念: [] };
        const anchor = buildMotivationAnchor(NPC_WANG, '王掌柜', dummyBeliefState, ['警惕'], ['不满']);
        const conflicts = validateMotivations(NARRATIVE_WANG_VALID, [anchor]);
        expect(conflicts.length).toBe(0);
    });
    it('动机 conflict detail 不含原始真值内容（物理隔离）', () => {
        const dummyBeliefState = { povKey: PC, 感知: [], 推理: [], 信念: [] };
        const anchor = buildMotivationAnchor(NPC_WANG, '王掌柜', dummyBeliefState, ['警惕'], []);
        const conflicts = validateMotivations(NARRATIVE_EMOTION_CONFLICT, [anchor]);
        for (const c of conflicts) {
            // detail 不含 $谜底 或具体秘密母题
            expect(c.detail).not.toContain(SECRET_MOTIF);
            expect(c.detail).not.toContain('$谜底');
        }
    });
    it('依赖①：deriveBeliefState 输出喂入 validateMotivations 完整链路绿', () => {
        const state = makeStateWithCogArchiveAndNPCState();
        // ①派生
        const bs = deriveBeliefFromState(state, PC);
        // ④校验（NPC_WANG 有警惕情绪·叙事有欣然同意）
        const anchor = buildMotivationAnchor(NPC_WANG, '王掌柜', bs, ['警惕'], ['不满']);
        const conflicts = validateMotivations(NARRATIVE_EMOTION_CONFLICT, [anchor]);
        expect(conflicts.length).toBeGreaterThan(0);
        // 链路完整：①→④ 一致性
        expect(conflicts[0]?.npcKey).toBe(NPC_WANG);
    });
});
// ── ⑤ 校验闸见真相·输出过滤·无后门 ─────────────────────────────────────────────
describe('P0-8 ⑤ 校验闸·见真相输出过滤·物理隔离', () => {
    it('PC POV：越权知情叙事经校验闸→ valid=false·检出冲突（内部见真相）', () => {
        const result = runValidationGate(NARRATIVE_OVERREACH, BASE_STATE, { povKey: PC });
        expect(result.valid).toBe(false);
        expect(result.conflicts.some(c => c.type === '越权知情')).toBe(true);
    });
    it('outputFilteredSecrets 不含 PC 不知情的 S1（输出侧 POV 过滤）', () => {
        const result = runValidationGate(NARRATIVE_VALID, BASE_STATE, { povKey: PC });
        // PC 不知情 → outputFilteredSecrets 无 S1
        expect(Object.keys(result.outputFilteredSecrets)).not.toContain('S1');
    });
    it('outputFilteredSecrets 含 WANG 知情的 S1（王掌柜 POV 合法可见）', () => {
        const result = runValidationGate(NARRATIVE_VALID, BASE_STATE, { povKey: NPC_WANG });
        expect(Object.keys(result.outputFilteredSecrets)).toContain('S1');
    });
    it('conflict.detail 不含原始秘密母题（$谜底 不出现·无后门）', () => {
        const result = runValidationGate(NARRATIVE_OVERREACH, BASE_STATE, { povKey: PC });
        for (const c of result.conflicts) {
            expect(c.detail).not.toContain(SECRET_MOTIF);
            expect(c.detail).not.toContain('$谜底');
            expect(c.detail).not.toContain('通缉犯'); // $谜底 中的真值内容
        }
    });
    it('真值泄漏 fixture：越权叙事经校验闸后 outputFilteredSecrets 仍无 S1（无后门）', () => {
        // 即使叙事违反了知情规则，输出侧不因此泄露 S1 内容
        const result = runValidationGate(NARRATIVE_OVERREACH, BASE_STATE, { povKey: PC });
        expect(result.outputFilteredSecrets['S1']).toBeUndefined();
    });
    it('校验闸完整链路：PANGeA + WhatELSE 协同（带 NPC 情绪状态）', () => {
        const state = makeStateWithCogArchiveAndNPCState();
        // 同时触发越权知情 + 情绪矛盾的叙事
        const narrative = `${NARRATIVE_OVERREACH} ${NARRATIVE_EMOTION_CONFLICT}`;
        const result = runValidationGate(narrative, state, { povKey: PC });
        expect(result.valid).toBe(false);
        // PANGeA 检出越权知情
        expect(result.conflicts.some(c => c.type === '越权知情')).toBe(true);
        // WhatELSE 检出情绪矛盾
        expect(result.motConflicts.some(c => c.conflictType === '情绪矛盾')).toBe(true);
    });
    it('纠偏重试链路：校验闸 retryNarrative 合法 → valid=true', () => {
        const result = runValidationGate(NARRATIVE_OVERREACH, BASE_STATE, { povKey: PC, retryNarrative: NARRATIVE_VALID });
        expect(result.valid).toBe(true);
        expect(result.retriedOnce).toBe(true);
    });
    it('双失败软拒：校验闸 retryNarrative 也越权 → softReject 出现', () => {
        const result = runValidationGate(NARRATIVE_OVERREACH, BASE_STATE, { povKey: PC, retryNarrative: NARRATIVE_OVERREACH, retryMode: 'single_retry_soft_reject' });
        expect(result.valid).toBe(false);
        expect(result.softReject).toBeDefined();
        expect(result.softReject.ui提示).toContain('重 Roll');
    });
});
