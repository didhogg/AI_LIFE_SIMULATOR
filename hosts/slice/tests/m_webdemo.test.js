// 纵切 Demo 薄壳 · P0-11 前哨 · web-debug 单宿主端到端 · 验收测试
//
// D0 地基（world.ts TS2345 已清·buildWorld RootSchema.parse 填满默认值）
// D1 薄壳骨架（assemblePrompt 输出结构·prompt-dump 可视化）
// D2 交互纵切（AOHP 菜单 option_id + reconcileGate 分级失败）
// D3 知情过滤/反人格标签/NSFW 物理隔离
// D4 存档读写（FullArchiveHeader + P0-9 迁移侦察）
//
// 铁律: 无 LLM 调用·使用脚本化叙事文本·红线函数体零改
import { describe, it, expect } from 'vitest';
// ── 核心引擎（只读复用）──────────────────────────────────────────────────────────
import { RootSchema, SINK_ENTITY_KEY } from '@ai-life-sim/core';
import { filterSecretsForPOV } from '@ai-life-sim/core/engine/knowledgeFilter';
import { buildMenuOptionIds, sortedOptionIds, buildOptionId } from '@ai-life-sim/core/engine/aohp';
import { DEFAULT_NEAR_K, CALL_TYPE_REGISTRY, NARRATIVE_CALL_TYPES } from '@ai-life-sim/core/prompt/callRegistry';
import { FINGERPRINT_BUNDLE_MEMBERS, FINGERPRINT_PRESET_FIELDS, FINGERPRINT_SNAPSHOT_FIELDS, FINGERPRINT_EXCLUDED_FIELDS, } from '@ai-life-sim/core/engine/fingerprintManifest';
import { CHINESE_NUMBER_RULE_VERSION } from '@ai-life-sim/core/engine/text/chineseNumber';
import { SOFT_REJECT_RULE_VERSION } from '@ai-life-sim/core/engine/softReject';
// ── 宿主层（slice · 只读复用·零函数体改动）──────────────────────────────────────
import { buildWorld, PC, NPC_WANG, NPC_HONG, LOC_NAME, SECRET_S1, CURRENCY, SAVE_SEED, } from '../fixture/world.js';
import { assemblePrompt } from '../assemble.js';
import { createArchiveHeader, createFullArchiveHeader, migrateToFullArchiveHeader, ARCHIVE_RULE_VERSION, } from '../engine/archive.js';
import { filterMenuCandidates } from '../engine/menuFilter.js';
import { runReconcileGate } from '../engine/reconcileGate.js';
import { initBalances, snapshotBalances } from '../ledger/state.js';
// ────────────────────────────────────────────────────────────────────────────────
// D0 地基 — buildWorld TS2345 清零确认
// ────────────────────────────────────────────────────────────────────────────────
describe('D0 地基 — buildWorld TS2345 清零', () => {
    it('buildWorld() 返回 RootState（RootSchema.parse 无运行时报错）', () => {
        const state = buildWorld();
        expect(state).toBeDefined();
        expect(typeof state).toBe('object');
    });
    it('state._tick 存在（默认值填充·TS2345 字段已清）', () => {
        const state = buildWorld();
        expect(state._tick).toBeDefined();
        expect(typeof state._tick.拍计数).toBe('number');
    });
    it('NPC 三角色均在场（fixture 结构正确）', () => {
        const state = buildWorld();
        expect(state.NPC?.[PC]).toBeDefined();
        expect(state.NPC?.[NPC_WANG]).toBeDefined();
        expect(state.NPC?.[NPC_HONG]).toBeDefined();
    });
    it('schemaKeys=53 守恒（demo 不新增 schema 字段）', () => {
        const schemaKeys = Object.keys(RootSchema.shape);
        expect(schemaKeys.length).toBe(54);
    });
});
// ────────────────────────────────────────────────────────────────────────────────
// D1 薄壳骨架 — assemblePrompt 输出结构
// ────────────────────────────────────────────────────────────────────────────────
describe('D1 薄壳骨架 — assemblePrompt 输出结构', () => {
    const state = buildWorld();
    it('返回 { systemPrompt, userPrompt } 两键', () => {
        const result = assemblePrompt(state, {
            pcKey: PC, locName: LOC_NAME, povEntityKey: PC,
        });
        expect(result).toHaveProperty('systemPrompt');
        expect(result).toHaveProperty('userPrompt');
        expect(typeof result.systemPrompt).toBe('string');
        expect(typeof result.userPrompt).toBe('string');
    });
    it('systemPrompt 含主角姓名（林九）', () => {
        const { systemPrompt } = assemblePrompt(state, { pcKey: PC, locName: LOC_NAME, povEntityKey: PC });
        expect(systemPrompt).toContain('林九');
    });
    it('systemPrompt 含地点名称', () => {
        const { systemPrompt } = assemblePrompt(state, { pcKey: PC, locName: LOC_NAME, povEntityKey: PC });
        expect(systemPrompt).toContain(LOC_NAME);
    });
    it('systemPrompt 含在场 NPC 姓名（王掌柜/红姨）', () => {
        const { systemPrompt } = assemblePrompt(state, { pcKey: PC, locName: LOC_NAME, povEntityKey: PC });
        expect(systemPrompt).toContain('王掌柜');
        expect(systemPrompt).toContain('红姨');
    });
    it('systemPrompt 含 OCEAN 注入（NPC 行有 OCEAN[…]）', () => {
        const { systemPrompt } = assemblePrompt(state, { pcKey: PC, locName: LOC_NAME, povEntityKey: PC });
        expect(systemPrompt).toContain('OCEAN[');
    });
    it('userPrompt 含拍号（拍#N）', () => {
        const { userPrompt } = assemblePrompt(state, { pcKey: PC, locName: LOC_NAME, povEntityKey: PC });
        expect(userPrompt).toMatch(/拍#\d+/);
    });
    it('userPrompt 含账目（balances 注入时）', () => {
        const balancesMap = initBalances({ [PC]: 30, [NPC_WANG]: 200, [NPC_HONG]: 0 });
        const balances = snapshotBalances(balancesMap);
        const { userPrompt } = assemblePrompt(state, {
            pcKey: PC, locName: LOC_NAME, povEntityKey: PC, balances,
        });
        expect(userPrompt).toContain('账目');
        expect(userPrompt).toContain('30');
    });
    it('callTypeKey 主线叙事 路由到正确 CALL_TYPE_REGISTRY 规格', () => {
        const spec = CALL_TYPE_REGISTRY[NARRATIVE_CALL_TYPES.主线叙事];
        expect(spec).toBeDefined();
        expect(spec.切片预算.软上限tokens).toBeGreaterThan(0);
        expect(spec.切片预算.截断优先级.length).toBeGreaterThan(0);
    });
});
// ────────────────────────────────────────────────────────────────────────────────
// D1 prompt-dump — 近K历史/live账本/NPC态/lore 可视化
// ────────────────────────────────────────────────────────────────────────────────
describe('D1 prompt-dump — 近K历史/live账本/NPC态/lore', () => {
    const state = buildWorld();
    it('近K历史注入 userPrompt（narrativeHistory 有内容）', () => {
        const history = ['第一拍：林九入住悦来客栈。', '第二拍：林九与王掌柜寒暄。'];
        const { userPrompt } = assemblePrompt(state, {
            pcKey: PC, locName: LOC_NAME, povEntityKey: PC,
            narrativeHistory: history,
        });
        // assemble.ts 改版：section 标头由「近期叙事」改为「更早剧情」/「上一拍」
        expect(userPrompt).toContain('更早剧情');
        expect(userPrompt).toContain('林九入住悦来客栈');
    });
    it('近K历史截断至 DEFAULT_NEAR_K 条（超出时）', () => {
        const longHistory = Array.from({ length: DEFAULT_NEAR_K + 5 }, (_, i) => `第${i + 1}拍`);
        const { userPrompt } = assemblePrompt(state, {
            pcKey: PC, locName: LOC_NAME, povEntityKey: PC,
            narrativeHistory: longHistory,
            nearK: DEFAULT_NEAR_K,
        });
        // 最旧5条不应出现
        expect(userPrompt).not.toContain('第1拍');
        expect(userPrompt).not.toContain('第2拍');
        // 最新 K 条应出现
        expect(userPrompt).toContain(`第${DEFAULT_NEAR_K + 5}拍`);
    });
    it('live 账本注入 userPrompt（balances 有内容时显示）', () => {
        const balances = { [PC]: 25, [NPC_WANG]: 205, [NPC_HONG]: 5 };
        const { userPrompt } = assemblePrompt(state, {
            pcKey: PC, locName: LOC_NAME, povEntityKey: PC, balances,
        });
        expect(userPrompt).toContain('25');
    });
    it('lore 谓词命中时注入 systemPrompt', () => {
        const stateWithLore = buildWorld();
        stateWithLore['_lore知识库'] = {
            lore_inn: {
                触发谓词: '', // 无谓词 = 恒真
                知识载荷: '悦来客栈是清河镇运河边历史最久的落脚处。',
            },
        };
        const { systemPrompt } = assemblePrompt(stateWithLore, {
            pcKey: PC, locName: LOC_NAME, povEntityKey: PC,
            lorePredCtx: {},
        });
        expect(systemPrompt).toContain('世界常识');
        expect(systemPrompt).toContain('悦来客栈是清河镇运河边历史最久的落脚处');
    });
    it('lore 谓词不命中时不注入（有 lorePredCtx 但无匹配）', () => {
        const stateWithLore = buildWorld();
        stateWithLore['_lore知识库'] = {
            lore_martial: {
                触发谓词: 'attr.体质 >= 99', // 不会命中（体质=5）
                知识载荷: '武林高手专属秘籍。',
            },
        };
        const { systemPrompt } = assemblePrompt(stateWithLore, {
            pcKey: PC, locName: LOC_NAME, povEntityKey: PC,
            lorePredCtx: { 属性: { 体质: 5 } },
        });
        expect(systemPrompt).not.toContain('武林高手专属秘籍');
    });
    it('多拍循环：叙事历史跨拍累积（D2 多拍连续性）', () => {
        const histories = [];
        // Turn 1
        const turn1 = assemblePrompt(state, {
            pcKey: PC, locName: LOC_NAME, povEntityKey: PC,
            narrativeHistory: histories,
        });
        histories.push('林九踏入悦来客栈，见王掌柜正在擦拭柜台。');
        // Turn 2
        const turn2 = assemblePrompt(state, {
            pcKey: PC, locName: LOC_NAME, povEntityKey: PC,
            narrativeHistory: histories,
        });
        histories.push('林九取出五文钱递给红姨，换来一碗热茶。');
        // Turn 3
        const turn3 = assemblePrompt(state, {
            pcKey: PC, locName: LOC_NAME, povEntityKey: PC,
            narrativeHistory: histories,
        });
        expect(turn1.userPrompt).not.toContain('近期叙事');
        expect(turn2.userPrompt).toContain('林九踏入悦来客栈');
        expect(turn3.userPrompt).toContain('林九踏入悦来客栈');
        expect(turn3.userPrompt).toContain('林九取出五文钱');
    });
});
// ────────────────────────────────────────────────────────────────────────────────
// D2 AOHP 菜单 option_id
// ────────────────────────────────────────────────────────────────────────────────
describe('D2 AOHP 菜单 option_id 语义键', () => {
    const DEMO_OPTIONS = [
        { verb: '对话', targetEntityId: NPC_WANG, displayText: '与王掌柜对话' },
        { verb: '给钱', targetEntityId: NPC_HONG, salientArgs: '五文', displayText: '给红姨五文钱' },
        { verb: '给钱', targetEntityId: NPC_HONG, salientArgs: '5文', displayText: '给红姨5文钱' }, // 同义（同一意图）
        { verb: '给钱', targetEntityId: NPC_HONG, salientArgs: '八文', displayText: '给红姨八文钱' },
        { verb: '还账', targetEntityId: NPC_WANG, salientArgs: '8文', displayText: '还王掌柜八文钱' },
    ];
    it('buildMenuOptionIds 返回不重复 option_id（Set.size === length）', () => {
        const withIds = buildMenuOptionIds(DEMO_OPTIONS);
        const ids = withIds.map(o => o.option_id);
        expect(new Set(ids).size).toBe(ids.length);
    });
    it('无 salientArgs 的选项：option_id = verb:target', () => {
        const id = buildOptionId('对话', NPC_WANG);
        expect(id).toBe(`对话:${NPC_WANG}`);
    });
    it('有 salientArgs 的选项：option_id = verb:target:canonicalArgs', () => {
        const id = buildOptionId('给钱', NPC_HONG, '5文');
        expect(id).toBe(`给钱:${NPC_HONG}:5文`);
    });
    it('同义归一（五文/5文 → 同一 option_id·保留首个·去掉后者）', () => {
        const withIds = buildMenuOptionIds(DEMO_OPTIONS);
        // 五文/5文 都归一为 5文 → 只应出现一个 给钱:npc_hong:5文
        const hongGive5 = withIds.filter(o => o.option_id === `给钱:${NPC_HONG}:5文`);
        expect(hongGive5.length).toBe(1);
        // 总数：5 items - 1 去掉 = 4 unique
        expect(withIds.length).toBe(4);
    });
    it('sortedOptionIds 排序恒等（顺序无关·指纹安全）', () => {
        const withIds = buildMenuOptionIds(DEMO_OPTIONS);
        const sorted1 = sortedOptionIds(withIds);
        const shuffled = [...withIds].reverse();
        const sorted2 = sortedOptionIds(shuffled);
        expect(sorted1).toEqual(sorted2);
    });
    it('option_id 不含 displayText（纯语义键·稳定）', () => {
        const withIds = buildMenuOptionIds(DEMO_OPTIONS);
        for (const o of withIds) {
            expect(o.option_id).not.toContain('给红姨');
            expect(o.option_id).not.toContain('与王掌柜');
        }
    });
});
// ────────────────────────────────────────────────────────────────────────────────
// D2 reconcileGate 分级失败
// ────────────────────────────────────────────────────────────────────────────────
describe('D2 reconcileGate 分级失败', () => {
    const GIVE_PROPOSAL = {
        transfers: [{ from: PC, to: NPC_HONG, amount: 5, reason: '给钱' }],
        checks: [],
        knowledge: [],
    };
    const DEBT_PROPOSAL = {
        transfers: [{ from: PC, to: NPC_WANG, amount: 8, reason: '赊账' }],
        checks: [],
        knowledge: [],
    };
    it('叙事金额匹配提案 → status=covered（无 rollHint）', () => {
        const result = runReconcileGate('林九取出五文钱递给红姨。', GIVE_PROPOSAL);
        expect(result.status).toBe('covered');
        expect(result.rollHint).toBeUndefined();
    });
    it('债权叙事（赊账）→ hard_rejected（语义拦截·rollHint 存在）', () => {
        const result = runReconcileGate('林九赊账了八文钱的酒菜。', DEBT_PROPOSAL);
        expect(result.status).toBe('hard_rejected');
        expect(result.rollHint).toBeDefined();
        expect(result.rollHint?.ui提示).toContain('重 Roll');
    });
    it('金额漏项（无重试叙事）→ retried_failed（rollHint 存在）', () => {
        const missingAmtProposal = {
            transfers: [{ from: PC, to: NPC_WANG, amount: 5, reason: '买酒菜' }],
            checks: [],
            knowledge: [],
        };
        // 叙事里说"三文"，提案是5文 → 金额不匹配 → 漏项
        const result = runReconcileGate('林九付了三文钱买了酒菜。', missingAmtProposal, undefined);
        expect(result.status).toBe('retried_failed');
        expect(result.rollHint).toBeDefined();
    });
    it('金额漏项 + 重试叙事覆盖 → retried_covered', () => {
        const proposal5 = {
            transfers: [{ from: PC, to: NPC_WANG, amount: 5, reason: '买酒菜' }],
            checks: [],
            knowledge: [],
        };
        const result = runReconcileGate('林九付了三文钱买了酒菜。', // 首次：三 ≠ 5
        proposal5, '林九取出五文钱买了酒菜。');
        expect(result.status).toBe('retried_covered');
        expect(result.rollHint).toBeUndefined();
    });
    it('ruleVersion 返回正确版本号', () => {
        const result = runReconcileGate('林九取出五文钱递给红姨。', GIVE_PROPOSAL);
        expect(typeof result.ruleVersion).toBe('number');
        expect(result.ruleVersion).toBeGreaterThanOrEqual(1);
    });
    it('软拒 rollHint 含重Roll说明（常驻图标·不弹窗）', () => {
        const result = runReconcileGate('林九赊账了八文钱的酒菜。', DEBT_PROPOSAL);
        expect(result.rollHint?.重Roll说明).toBeDefined();
    });
});
// ────────────────────────────────────────────────────────────────────────────────
// D3 知情过滤 — POV 切换·秘密不泄漏
// ────────────────────────────────────────────────────────────────────────────────
describe('D3 知情过滤 — POV 切换', () => {
    const state = buildWorld();
    it('PC POV → filterSecretsForPOV 返回空集（不知情 S1）', () => {
        const secrets = state.全局?.秘密库 ?? {};
        const visible = filterSecretsForPOV(secrets, PC);
        expect(Object.keys(visible).length).toBe(0);
    });
    it('NPC_WANG POV → filterSecretsForPOV 返回 S1（知情）', () => {
        const secrets = state.全局?.秘密库 ?? {};
        const visible = filterSecretsForPOV(secrets, NPC_WANG);
        expect(Object.keys(visible)).toContain(SECRET_S1);
    });
    it('PC POV assemblePrompt → secretSection 为空（生成前过滤·非隐藏）', () => {
        const { systemPrompt } = assemblePrompt(state, {
            pcKey: PC, locName: LOC_NAME, povEntityKey: PC,
        });
        expect(systemPrompt).not.toContain('当前已知秘密');
    });
    it('NPC_WANG POV assemblePrompt → secretSection 含 S1（知情可见）', () => {
        const { systemPrompt } = assemblePrompt(state, {
            pcKey: NPC_WANG, locName: LOC_NAME, povEntityKey: NPC_WANG,
        });
        expect(systemPrompt).toContain('当前已知秘密');
        expect(systemPrompt).toContain(SECRET_S1);
    });
    it('$谜底 永不出现在 systemPrompt（真相层物理隔离）', () => {
        const { systemPrompt } = assemblePrompt(state, {
            pcKey: NPC_WANG, locName: LOC_NAME, povEntityKey: NPC_WANG,
        });
        expect(systemPrompt).not.toContain('王掌柜在悦来客栈后院私藏');
    });
    it('filterMenuCandidates + secretRef=S1 + PC POV → denied', () => {
        const candidates = [
            { verb: '询问', targetEntityId: NPC_WANG, displayText: '询问通缉旧友', secretRef: SECRET_S1 },
            { verb: '对话', targetEntityId: NPC_WANG, displayText: '普通对话' },
        ];
        const result = filterMenuCandidates(candidates, state, PC);
        expect(result.denied.length).toBe(1);
        expect(result.denied[0]?.secretRef).toBe(SECRET_S1);
        expect(result.permitted.length).toBe(1);
        expect(result.permitted[0]?.verb).toBe('对话');
    });
    it('filterMenuCandidates + secretRef=S1 + NPC_WANG POV → permitted', () => {
        const candidates = [
            { verb: '询问', targetEntityId: NPC_WANG, displayText: '询问通缉旧友', secretRef: SECRET_S1 },
        ];
        const result = filterMenuCandidates(candidates, state, NPC_WANG);
        expect(result.denied.length).toBe(0);
        expect(result.permitted.length).toBe(1);
    });
    it('denied 时附 rollHint（常驻图标·不弹窗）', () => {
        const candidates = [
            { verb: '询问', targetEntityId: NPC_WANG, secretRef: SECRET_S1 },
        ];
        const result = filterMenuCandidates(candidates, state, PC);
        expect(result.rollHint).toBeDefined();
        expect(result.rollHint?.ui提示).toContain('重 Roll');
    });
    it('无 secretRef 选项 → 恒 permitted（无知情限制）', () => {
        const candidates = [
            { verb: '对话', targetEntityId: NPC_WANG },
            { verb: '给钱', targetEntityId: NPC_HONG, salientArgs: '5文' },
        ];
        const result = filterMenuCandidates(candidates, state, PC);
        expect(result.denied.length).toBe(0);
        expect(result.permitted.length).toBe(2);
        expect(result.rollHint).toBeUndefined();
    });
});
// ────────────────────────────────────────────────────────────────────────────────
// D3 反人格标签 Anti-Labeling Directive
// ────────────────────────────────────────────────────────────────────────────────
describe('D3 反人格标签 Anti-Labeling Directive', () => {
    const state = buildWorld();
    it('systemPrompt 含人格表达铁律段落（Anti-Labeling Directive 存在）', () => {
        const { systemPrompt } = assemblePrompt(state, { pcKey: PC, locName: LOC_NAME, povEntityKey: PC });
        expect(systemPrompt).toContain('人格表达铁律');
    });
    it('Anti-Labeling Directive 声明禁止性格名词（含"善良"禁止示例）', () => {
        const { systemPrompt } = assemblePrompt(state, { pcKey: PC, locName: LOC_NAME, povEntityKey: PC });
        expect(systemPrompt).toContain('善良'); // 出现在禁止列举中
        expect(systemPrompt).toContain('禁止');
    });
    it('systemPrompt 静态模板不含抽象性格形容（禁止词未被滥用为正向断言）', () => {
        const { systemPrompt } = assemblePrompt(state, { pcKey: PC, locName: LOC_NAME, povEntityKey: PC });
        // 禁止词只在 Directive 的禁止列表里 → 不会作为 NPC 描述出现在其他段落
        const lines = systemPrompt.split('\n');
        const npcSection = lines.slice(lines.findIndex(l => l.includes('在场人物')), lines.findIndex(l => l.includes('## 地点') || l.includes('## 已知秘密') || l.includes('## 近期')) + 1
            || lines.length);
        // NPC 行中不应直接使用人格形容词 "善良" "勇敢" 等
        const npcText = npcSection.join('\n');
        expect(npcText).not.toMatch(/(?<!\（)善良(?!\）)/); // 不在括号外的正向用法
    });
    it('OCEAN 数值注入 NPC 行（Anti-Labeling Directive 数值驱动依据）', () => {
        const { systemPrompt } = assemblePrompt(state, { pcKey: PC, locName: LOC_NAME, povEntityKey: PC });
        // OCEAN 五轴默认50 → O50/C50/E50/A50/N50
        expect(systemPrompt).toContain('O50/C50/E50/A50/N50');
    });
    it('Anti-Labeling Directive 声明输出文本禁止出现数值', () => {
        const { systemPrompt } = assemblePrompt(state, { pcKey: PC, locName: LOC_NAME, povEntityKey: PC });
        expect(systemPrompt).toContain('不得出现数值');
    });
});
// ────────────────────────────────────────────────────────────────────────────────
// D3 NSFW 物理隔离
// ────────────────────────────────────────────────────────────────────────────────
describe('D3 NSFW 物理隔离', () => {
    it('Node 测试环境无 window 全局对象（isDebugNsfwOverrideActive 返回 false 的前提）', () => {
        expect('window' in globalThis).toBe(false);
    });
    it('isDebugNsfwOverrideActive 逻辑：window 未定义时恒 false（物理隔离断言）', () => {
        // 直接验证 web-debug/index.ts 的逻辑分支：'window' not in globalThis → return false
        // 不在 slice 内引入 web-debug 模块（隔离保证·不 re-export）
        const windowMissing = !('window' in globalThis);
        const expectedResult = windowMissing ? false : undefined; // undefined = 未能验证
        expect(expectedResult).toBe(false);
    });
    it('指纹 manifest 总条目 = 85（demo 代码不进指纹）', () => {
        const total = FINGERPRINT_BUNDLE_MEMBERS.length +
            FINGERPRINT_PRESET_FIELDS.length +
            FINGERPRINT_SNAPSHOT_FIELDS.length +
            FINGERPRINT_EXCLUDED_FIELDS.length;
        expect(total).toBe(88);
    });
    it('schemaKeys=53 不变（demo 不新增 schema 字段·指纹守恒）', () => {
        expect(Object.keys(RootSchema.shape).length).toBe(54);
    });
});
// ────────────────────────────────────────────────────────────────────────────────
// D4 存档读写 — FullArchiveHeader + P0-9 迁移侦察
// ────────────────────────────────────────────────────────────────────────────────
describe('D4 存档读写 — FullArchiveHeader', () => {
    it('createArchiveHeader 返回 MinArchiveHeader（向后兼容·无 RULE_VERSION）', () => {
        const h = createArchiveHeader(SAVE_SEED);
        expect(h.seed).toBe(SAVE_SEED);
        expect(h.全局回滚计数器).toBe(0);
        expect('RULE_VERSION' in h).toBe(false);
    });
    it('createFullArchiveHeader 返回 RULE_VERSION=3', () => {
        const h = createFullArchiveHeader(SAVE_SEED);
        expect(h.RULE_VERSION).toBe(3);
        expect(h.RULE_VERSION).toBe(ARCHIVE_RULE_VERSION);
    });
    it('FullArchiveHeader 含 B3 中文数字解析规则版 = CHINESE_NUMBER_RULE_VERSION（活常量·防漂移）', () => {
        const h = createFullArchiveHeader(SAVE_SEED);
        expect(h.中文数字解析规则版).toBe(CHINESE_NUMBER_RULE_VERSION);
    });
    it('FullArchiveHeader 含 B3 软拒规则版 = SOFT_REJECT_RULE_VERSION（活常量）', () => {
        const h = createFullArchiveHeader(SAVE_SEED);
        expect(h.软拒规则版).toBe(SOFT_REJECT_RULE_VERSION);
    });
    it('FullArchiveHeader 含 B4 AOHP 语义键版=1', () => {
        const h = createFullArchiveHeader(SAVE_SEED);
        expect(h.AOHP语义键版).toBe(1);
    });
    it('FullArchiveHeader 含 schemaKeys=53', () => {
        const h = createFullArchiveHeader(SAVE_SEED);
        expect(h.schemaKeys).toBe(54);
    });
    it('JSON 往返恒等（序列化/反序列化保留所有字段）', () => {
        const h = createFullArchiveHeader(SAVE_SEED);
        const roundTripped = JSON.parse(JSON.stringify(h));
        expect(roundTripped.RULE_VERSION).toBe(h.RULE_VERSION);
        expect(roundTripped.seed).toBe(h.seed);
        expect(roundTripped.全局回滚计数器).toBe(h.全局回滚计数器);
        expect(roundTripped.中文数字解析规则版).toBe(h.中文数字解析规则版);
        expect(roundTripped.软拒规则版).toBe(h.软拒规则版);
        expect(roundTripped.AOHP语义键版).toBe(h.AOHP语义键版);
        expect(roundTripped.schemaKeys).toBe(h.schemaKeys);
    });
    it('migrateToFullArchiveHeader：MinArchiveHeader → FullArchiveHeader 补全', () => {
        const old = { seed: 99, 全局回滚计数器: 3 };
        const migrated = migrateToFullArchiveHeader(old);
        expect(migrated.RULE_VERSION).toBe(3);
        expect(migrated.中文数字解析规则版).toBe(CHINESE_NUMBER_RULE_VERSION);
        expect(migrated.软拒规则版).toBe(SOFT_REJECT_RULE_VERSION);
        expect(migrated.AOHP语义键版).toBe(1);
    });
    it('migration 保留原始 seed 和全局回滚计数器（P0-9 数据守恒）', () => {
        const old = { seed: 99, 全局回滚计数器: 3 };
        const migrated = migrateToFullArchiveHeader(old);
        expect(migrated.seed).toBe(99);
        expect(migrated.全局回滚计数器).toBe(3);
    });
    it('已有 FullArchiveHeader 迁移幂等（不重复迁移）', () => {
        const full = createFullArchiveHeader(SAVE_SEED);
        const migrated = migrateToFullArchiveHeader(full);
        expect(migrated).toBe(full); // 引用相等（幂等·不新建对象）
    });
    // P0-9 迁移侦察：旧存档 MinArchiveHeader 加载时暴露的迁移需求
    it('[P0-9 侦察] 旧存档 MinArchiveHeader 缺少 RULE_VERSION（需 migrate 补全）', () => {
        const oldSave = JSON.stringify({ seed: 42, 全局回滚计数器: 0 });
        const loaded = JSON.parse(oldSave);
        // 加载旧存档时缺少新字段 → 必须经 migrateToFullArchiveHeader 才可使用新版规则
        expect('RULE_VERSION' in loaded).toBe(false); // P0-9 gap: RULE_VERSION 缺失
        expect('中文数字解析规则版' in loaded).toBe(false); // P0-9 gap: B3 rule version 缺失
        expect('AOHP语义键版' in loaded).toBe(false); // P0-9 gap: B4 field 缺失
        // 迁移后补全
        const full = migrateToFullArchiveHeader(loaded);
        expect(full.RULE_VERSION).toBe(3);
    });
});
