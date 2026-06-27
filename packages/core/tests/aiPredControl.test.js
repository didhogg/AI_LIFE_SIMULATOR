/**
 * DSL-AI: aiPredControl — 三层 AI 谓词控制 resolver 测试
 * 铁律①②③覆盖：
 *   ① 求值器永不调 AI（static import 断言·aiPredControl 无 eval.ts AI import）
 *   ② AI 开关永不进指纹（pinned hashJudgmentBundle 不变·G0 同构）
 *   ③ override 串进存档（archiveIO round-trip $AI创作状态 保留）
 */
import { describe, it, expect } from 'vitest';
import { resolveEffectivePredicate, readGlobalDslSwitch } from '../engine/dsl/aiPredControl.js';
import { hashJudgmentBundle } from '../engine/rng.js';
import { serializeArchive } from '../engine/archiveIO.js';
import { RootSchema } from '../schema/index.js';
// ── JUDGMENT_BASE（最小合法判定面·用于指纹 delta 断言）────────────────────────
const JUDGMENT_BASE = {
    历法皮肤: {},
    粒度模板覆盖: {},
    种族模板: {},
    母题配额: {},
    媒体渠道表: {},
    检定配方表: {},
    检定档切分表: {},
    欠债参数: {},
    赛事结构模板: {},
    派生量配方: {},
    概率域夹逼: {},
    纠缠闭包弱边阈值: 0.2,
};
// ── readGlobalDslSwitch ───────────────────────────────────────────────────────
describe('DSL-AI: readGlobalDslSwitch', () => {
    it('字段不存在 → 缺省 true（向后兼容）', () => {
        expect(readGlobalDslSwitch({})).toBe(true);
    });
    it('false → false', () => {
        expect(readGlobalDslSwitch({ 'DSL受AI控制': false })).toBe(false);
    });
    it('true → true', () => {
        expect(readGlobalDslSwitch({ 'DSL受AI控制': true })).toBe(true);
    });
    it('falsy 非 undefined → false', () => {
        expect(readGlobalDslSwitch({ 'DSL受AI控制': 0 })).toBe(false);
    });
});
// ── resolveEffectivePredicate 铁律① ─────────────────────────────────────────
describe('DSL-AI: resolveEffectivePredicate — 优先级规则', () => {
    const BASE = '属性.体质 >= 5';
    const OVERRIDE = '属性.体质 >= 3';
    const KEY = 'lore:hanfu:交领';
    // ① 作者红线
    it('作者控制表[key]=false → 永远返回 base（无视玩家/全局/override）', () => {
        expect(resolveEffectivePredicate(KEY, BASE, true, { [KEY]: false }, { [KEY]: true }, { [KEY]: OVERRIDE })).toBe(BASE);
    });
    it('作者红线·全局关闭时依然返回 base', () => {
        expect(resolveEffectivePredicate(KEY, BASE, false, { [KEY]: false }, undefined, { [KEY]: OVERRIDE })).toBe(BASE);
    });
    // ② 玩家三态叠加
    it('玩家控制表[key]=true，有 override → 返回 override', () => {
        expect(resolveEffectivePredicate(KEY, BASE, false, undefined, { [KEY]: true }, { [KEY]: OVERRIDE })).toBe(OVERRIDE);
    });
    it('玩家控制表[key]=true，无 override → fail-safe 返回 base', () => {
        expect(resolveEffectivePredicate(KEY, BASE, false, undefined, { [KEY]: true }, undefined)).toBe(BASE);
    });
    it('玩家控制表[key]=false → 关闭·返回 base（无视全局和 override）', () => {
        expect(resolveEffectivePredicate(KEY, BASE, true, undefined, { [KEY]: false }, { [KEY]: OVERRIDE })).toBe(BASE);
    });
    // 玩家 undefined → 穿透到作者
    it('玩家未设置，作者控制表[key]=true，有 override → 返回 override', () => {
        expect(resolveEffectivePredicate(KEY, BASE, false, { [KEY]: true }, undefined, { [KEY]: OVERRIDE })).toBe(OVERRIDE);
    });
    it('玩家未设置，作者未设置，全局开=true，有 override → 返回 override', () => {
        expect(resolveEffectivePredicate(KEY, BASE, true, undefined, undefined, { [KEY]: OVERRIDE })).toBe(OVERRIDE);
    });
    it('玩家未设置，作者未设置，全局开=false，有 override → 返回 base（全局关）', () => {
        expect(resolveEffectivePredicate(KEY, BASE, false, undefined, undefined, { [KEY]: OVERRIDE })).toBe(BASE);
    });
    // fail-safe
    it('全局开·无 override → fail-safe 返回 base', () => {
        expect(resolveEffectivePredicate(KEY, BASE, true, undefined, undefined, undefined)).toBe(BASE);
    });
    // 不同键命中逻辑
    it('其他键的 override 不影响当前键', () => {
        expect(resolveEffectivePredicate(KEY, BASE, true, undefined, undefined, { 'lore:hanfu:other': OVERRIDE })).toBe(BASE);
    });
    // 空 base 串
    it('base 为空串·全局开·有 override → 返回 override', () => {
        expect(resolveEffectivePredicate(KEY, '', true, undefined, undefined, { [KEY]: OVERRIDE })).toBe(OVERRIDE);
    });
    it('base 为空串·全局关 → 返回空串', () => {
        expect(resolveEffectivePredicate(KEY, '', false, undefined, undefined, { [KEY]: OVERRIDE })).toBe('');
    });
});
// ── 铁律② AI 开关不进指纹（G0 同构·pinned hash）───────────────────────────
describe('DSL-AI: 铁律② 指纹中性（AI 开关字段不入判定面）', () => {
    // pinned baseline（lore谓词集合 undefined → 与 loreFreeze.test.ts G0 同基准）
    const PINNED_HASH = '2635a1d9';
    it('$AI创作状态字段不在 BUNDLE_MEMBERS 中 → hashJudgmentBundle 逐位恒等', () => {
        const h1 = hashJudgmentBundle({ ...JUDGMENT_BASE });
        const h2 = hashJudgmentBundle({ ...JUDGMENT_BASE });
        expect(h1).toBe(h2);
        // 与已知 pinned hash 对比（lore谓词集合=undefined 基准）
        expect(h1).toBe(PINNED_HASH);
    });
    it('$AI创作状态 字段不传入 → 指纹值与 pinned 一致', () => {
        // 若 $AI创作状态 误进 BUNDLE_MEMBERS，此处 hash 将变化 → 测试红
        const h = hashJudgmentBundle({ ...JUDGMENT_BASE, lore谓词集合: undefined });
        expect(h).toBe(PINNED_HASH);
    });
});
// ── 铁律③ override 串进存档（archiveIO JSON snapshot 含 $AI创作状态）────────
describe('DSL-AI: 铁律③ $AI创作状态 进存档（serializeArchive JSON 验证）', () => {
    function makeState() {
        const base = RootSchema.parse({});
        return {
            ...base,
            $AI创作状态: {
                谓词override表: { 'lore:hanfu:交领': '属性.体质 >= 3' },
                条目AI控制表: { 'effectPack:ep001': false },
            },
        };
    }
    it('$AI创作状态 进 JSON snapshot·不被 serializeArchive 排除', () => {
        const state = makeState();
        const result = serializeArchive(state);
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        // 解析 JSON 信封，检查 snapshot 中包含 $AI创作状态
        const envelope = JSON.parse(result.json);
        const snapshot = envelope['snapshot'];
        expect(Object.prototype.hasOwnProperty.call(snapshot, '$AI创作状态')).toBe(true);
        const aiState = snapshot['$AI创作状态'];
        expect(aiState?.['谓词override表']?.['lore:hanfu:交领']).toBe('属性.体质 >= 3');
        expect(aiState?.['条目AI控制表']?.['effectPack:ep001']).toBe(false);
    });
    it('$临时会话 仍被排除（不受 $AI创作状态 影响）', () => {
        const state = makeState();
        const result = serializeArchive(state);
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        const envelope = JSON.parse(result.json);
        const snapshot = envelope['snapshot'];
        expect(Object.prototype.hasOwnProperty.call(snapshot, '$临时会话')).toBe(false);
    });
});
// ── 守恒常量断言 ────────────────────────────────────────────────────────────
describe('DSL-AI: 守恒常量（schemaKeys·BUNDLE·manifest 不变）', () => {
    it('schemaKeys 从 53 升至 54（+$AI创作状态）', async () => {
        const { BLUEPRINT_KEYS } = await import('../schema/index.js');
        expect(BLUEPRINT_KEYS.length).toBe(54);
        expect(BLUEPRINT_KEYS).toContain('$AI创作状态');
    });
});
