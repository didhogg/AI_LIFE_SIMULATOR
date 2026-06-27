// P0-6 Gate① — Whitelist derivation dry-run
// Verifies that path whitelist can be auto-derived from RootSchema and covers
// all verb target paths.
import { describe, it, expect } from 'vitest';
import { classifyTopKey, nestedFieldLayer, deriveWritableWhitelist, runDryRun, } from '../schema/whitelistDryRun.js';
// ─── classifyTopKey ───────────────────────────────────────────────────────────
describe('P0-6 gate① · classifyTopKey 前缀分层', () => {
    it('$ prefix keys → invisible (except $meta)', () => {
        expect(classifyTopKey('$运气')).toBe('invisible');
        expect(classifyTopKey('$寿命预期')).toBe('invisible');
        expect(classifyTopKey('$隐藏记忆库')).toBe('invisible');
    });
    it('$meta → cross-playthrough', () => {
        expect(classifyTopKey('$meta')).toBe('cross-playthrough');
    });
    it('_ prefix keys → read-only', () => {
        expect(classifyTopKey('_系统版本')).toBe('read-only');
        expect(classifyTopKey('_tick')).toBe('read-only');
        expect(classifyTopKey('_叙事设置')).toBe('read-only');
    });
    it('_ prefixed engine-internal keys → read-only (pure prefix derivation)', () => {
        expect(classifyTopKey('_状态机')).toBe('read-only');
        expect(classifyTopKey('_存档头')).toBe('read-only');
        expect(classifyTopKey('_系统')).toBe('read-only');
        expect(classifyTopKey('_席位表')).toBe('read-only');
    });
    it('AI-facing entity domain keys → writable', () => {
        const writableKeys = [
            'NPC', '已故NPC归档', '认知档案',
            '组织实体', '组织关系网',
            '世界', '世界域',
            '全局', '地图', '战争状态', '赛事实例',
            '货币系统',
            '工作记忆', '长期归档', '日程', '行动卡库',
            '仲裁器', 'mod注册表', '调用类型注册表', 'Ring2在途调用信封',
        ];
        for (const k of writableKeys) {
            expect(classifyTopKey(k), k).toBe('writable');
        }
    });
});
// ─── nestedFieldLayer ─────────────────────────────────────────────────────────
describe('P0-6 gate① · nestedFieldLayer 嵌套前缀继承', () => {
    it('_ nested field inside writable parent → read-only', () => {
        expect(nestedFieldLayer('_本拍跨度', 'writable')).toBe('read-only');
        expect(nestedFieldLayer('_粒度模板', 'writable')).toBe('read-only');
    });
    it('$ nested field inside writable parent → invisible', () => {
        expect(nestedFieldLayer('$谜底', 'writable')).toBe('invisible');
    });
    it('normal field inside read-only parent → read-only (propagates)', () => {
        expect(nestedFieldLayer('体质', 'read-only')).toBe('read-only');
    });
    it('normal field inside writable parent → writable', () => {
        expect(nestedFieldLayer('属性', 'writable')).toBe('writable');
        expect(nestedFieldLayer('体质', 'writable')).toBe('writable');
    });
    it('invisible parent propagates to children', () => {
        expect(nestedFieldLayer('subfield', 'invisible')).toBe('invisible');
    });
});
// ─── deriveWritableWhitelist ──────────────────────────────────────────────────
describe('P0-6 gate① · deriveWritableWhitelist 全量路径派生', () => {
    it('produces non-empty path list', () => {
        const entries = deriveWritableWhitelist();
        expect(entries.length).toBeGreaterThan(100);
    });
    it('every $ top-level key entry is invisible (or cross-playthrough for $meta)', () => {
        const entries = deriveWritableWhitelist();
        const dollarTopEntries = entries.filter(e => {
            const top = e.path.split('.')[0];
            return top.startsWith('$');
        });
        for (const e of dollarTopEntries) {
            const top = e.path.split('.')[0];
            const expected = top === '$meta' ? 'cross-playthrough' : 'invisible';
            expect(e.layer, e.path).toBe(expected);
        }
    });
    it('every _ top-level key entry is read-only', () => {
        const entries = deriveWritableWhitelist();
        const underscoreTopEntries = entries.filter(e => e.path.split('.')[0].startsWith('_'));
        expect(underscoreTopEntries.length).toBeGreaterThan(0);
        for (const e of underscoreTopEntries) {
            expect(e.layer, e.path).toBe('read-only');
        }
    });
    it('_lore知识库 top-level key is read-only (AI 不可提案改世界常识库)', () => {
        const entries = deriveWritableWhitelist();
        const lore = entries.find(e => e.path === '_lore知识库');
        expect(lore).toBeDefined();
        expect(lore.layer).toBe('read-only');
    });
    it('_lore知识库.{id} 以下子路径全部继承 read-only（触发谓词/知识载荷均不可写）', () => {
        const entries = deriveWritableWhitelist();
        const loreSubPaths = entries.filter(e => e.path.startsWith('_lore知识库.'));
        // lore is optional so may produce 0 entries; if present, none must be writable
        for (const e of loreSubPaths) {
            expect(e.layer, `${e.path} should not be writable`).not.toBe('writable');
        }
    });
    it('nested $ field inside writable parent (全局.秘密库.{id}.$谜底) is invisible', () => {
        const entries = deriveWritableWhitelist();
        const 谜底 = entries.find(e => e.path === '全局.秘密库.{id}.$谜底');
        expect(谜底).toBeDefined();
        expect(谜底.layer).toBe('invisible');
    });
    it('全局.秘密库.{id}.暴露度 is writable number', () => {
        const entries = deriveWritableWhitelist();
        const e = entries.find(p => p.path === '全局.秘密库.{id}.暴露度');
        expect(e).toBeDefined();
        expect(e.layer).toBe('writable');
        expect(e.kind).toBe('number');
    });
    it('NPC.{id}.属性.体质 is writable number', () => {
        const entries = deriveWritableWhitelist();
        const e = entries.find(p => p.path === 'NPC.{id}.属性.体质');
        expect(e).toBeDefined();
        expect(e.layer).toBe('writable');
        expect(e.kind).toBe('number');
    });
    it('NPC.{id}.当前作息模式 is writable open-string', () => {
        const entries = deriveWritableWhitelist();
        const e = entries.find(p => p.path === 'NPC.{id}.当前作息模式');
        expect(e).toBeDefined();
        expect(e.layer).toBe('writable');
        expect(e.kind).toBe('open-string');
    });
    it('组织关系网.{id}.关系值 is writable number', () => {
        const entries = deriveWritableWhitelist();
        const e = entries.find(p => p.path === '组织关系网.{id}.关系值');
        expect(e).toBeDefined();
        expect(e.layer).toBe('writable');
        expect(e.kind).toBe('number');
    });
    it('enum fields have enumValues populated', () => {
        const entries = deriveWritableWhitelist();
        const enumEntries = entries.filter(e => e.kind === 'enum' && e.enumValues !== undefined);
        expect(enumEntries.length).toBeGreaterThan(0);
        // All enum entries must have at least one value
        for (const e of enumEntries) {
            expect(e.enumValues.length, e.path).toBeGreaterThan(0);
        }
    });
});
// ─── Check (b): open-string vs enum distinguishable ──────────────────────────
describe('P0-6 gate① · Check B · 开放串 vs 枚举机械可辨', () => {
    it('open-string and enum paths both exist and have distinct kind values', () => {
        const entries = deriveWritableWhitelist();
        const writeable = entries.filter(e => e.layer === 'writable');
        const openStrings = writeable.filter(e => e.kind === 'open-string');
        const enums = writeable.filter(e => e.kind === 'enum');
        expect(openStrings.length).toBeGreaterThan(0);
        expect(enums.length).toBeGreaterThan(0);
        // Prove they're distinguishable: no overlap
        const openStringPaths = new Set(openStrings.map(e => e.path));
        const enumPaths = new Set(enums.map(e => e.path));
        const overlap = [...openStringPaths].filter(p => enumPaths.has(p));
        expect(overlap).toHaveLength(0);
    });
    it('known open-string field (全局.秘密库.{id}.母题) is open-string not enum', () => {
        const entries = deriveWritableWhitelist();
        const e = entries.find(p => p.path === '全局.秘密库.{id}.母题');
        expect(e).toBeDefined();
        expect(e.kind).toBe('open-string');
    });
    it('known enum field (_叙事设置.人称.人称) is enum', () => {
        const entries = deriveWritableWhitelist();
        const e = entries.find(p => p.path === '_叙事设置.人称.人称');
        expect(e).toBeDefined();
        expect(e.kind).toBe('enum');
        expect(e.enumValues).toContain('一');
        expect(e.enumValues).toContain('二');
        expect(e.enumValues).toContain('三');
    });
});
// ─── Check (c): verb target path coverage ────────────────────────────────────
describe('P0-6 gate① · Check C · 动词目标路径白名单覆盖', () => {
    it('runDryRun check C passes — all probe paths covered', () => {
        const report = runDryRun();
        if (!report.checkC.pass) {
            // Report which probes are missing to help debug
            console.error('Missing verb target paths:', report.checkC.missing);
        }
        expect(report.checkC.pass).toBe(true);
    });
    it('创建实体·NPC: NPC.{id} is writable record', () => {
        const entries = deriveWritableWhitelist();
        const e = entries.find(p => p.path === 'NPC.{id}');
        expect(e).toBeDefined();
        expect(e.layer).toBe('writable');
        expect(e.kind).toBe('object');
    });
    it('修改·NPC属性段: NPC.{id}.属性 is writable object', () => {
        const entries = deriveWritableWhitelist();
        const e = entries.find(p => p.path === 'NPC.{id}.属性');
        expect(e).toBeDefined();
        expect(e.layer).toBe('writable');
    });
    it('全局._编年史 is read-only array (engine-written chronicle)', () => {
        const entries = deriveWritableWhitelist();
        const e = entries.find(p => p.path === '全局._编年史');
        expect(e).toBeDefined();
        expect(e.layer).toBe('read-only');
        expect(e.kind).toBe('array');
    });
    it('埋种子: 工作记忆 array is writable', () => {
        const entries = deriveWritableWhitelist();
        const e = entries.find(p => p.path === '工作记忆');
        expect(e).toBeDefined();
        expect(e.layer).toBe('writable');
        expect(e.kind).toBe('array');
    });
    // ── 新增语义×5（⑪~⑮）────────────────────────────────────────────────────────
    it('⑪印象涟漪: 认知档案.{id}.{id}.了解度 is writable number', () => {
        const entries = deriveWritableWhitelist();
        const e = entries.find(p => p.path === '认知档案.{id}.{id}.了解度');
        expect(e).toBeDefined();
        expect(e.layer).toBe('writable');
        expect(e.kind).toBe('number');
    });
    it('⑫归档NPC: 已故NPC归档.{id} is writable object', () => {
        const entries = deriveWritableWhitelist();
        const e = entries.find(p => p.path === '已故NPC归档.{id}');
        expect(e).toBeDefined();
        expect(e.layer).toBe('writable');
        expect(e.kind).toBe('object');
    });
    it('⑬宣战/停战: 战争状态.{id} is writable object', () => {
        const entries = deriveWritableWhitelist();
        const e = entries.find(p => p.path === '战争状态.{id}');
        expect(e).toBeDefined();
        expect(e.layer).toBe('writable');
        expect(e.kind).toBe('object');
    });
    it('⑭赛事推进: 赛事实例.{id}.当前轮次 is writable number', () => {
        const entries = deriveWritableWhitelist();
        const e = entries.find(p => p.path === '赛事实例.{id}.当前轮次');
        expect(e).toBeDefined();
        expect(e.layer).toBe('writable');
        expect(e.kind).toBe('number');
    });
    it('⑮家族谱系: 全局.家族树.边.{id} is writable object', () => {
        const entries = deriveWritableWhitelist();
        const e = entries.find(p => p.path === '全局.家族树.边.{id}');
        expect(e).toBeDefined();
        expect(e.layer).toBe('writable');
        expect(e.kind).toBe('object');
    });
});
// ─── Full dry-run report ──────────────────────────────────────────────────────
describe('P0-6 gate① · Full dry-run report', () => {
    it('check A passes (prefix layer correctness)', () => {
        const report = runDryRun();
        if (!report.checkA.pass) {
            console.error('Misclassified keys:', report.checkA.misclassified);
        }
        expect(report.checkA.pass).toBe(true);
    });
    it('check B passes (open-string vs enum distinguishable)', () => {
        const report = runDryRun();
        expect(report.checkB.pass).toBe(true);
        expect(report.checkB.distinguishable).toBe(true);
        expect(report.checkB.openStringPaths.length).toBeGreaterThan(0);
        expect(report.checkB.enumPaths.length).toBeGreaterThan(0);
    });
    it('check C passes (verb target coverage)', () => {
        const report = runDryRun();
        expect(report.checkC.pass).toBe(true);
        expect(report.checkC.missing).toHaveLength(0);
        // 通用×4 + 语义×15 + 兜底×1 = 20 probes total
        expect(report.checkC.probeResults).toHaveLength(20);
    });
    it('no engine-internal ambiguities — pure prefix derivation resolves all', () => {
        const report = runDryRun();
        // After adding _ prefix to all engine-internal keys, layerAmbiguities is
        // purely informational (nested $ fields note). No "missing _ prefix" entries.
        const hasAmbiguity = report.layerAmbiguities.some(a => a.includes('has no prefix but is engine-managed'));
        expect(hasAmbiguity).toBe(false);
    });
    it('layerAmbiguities may contain informational nested $ note', () => {
        const report = runDryRun();
        // The note about nested $ fields correctly handled should mention OK:
        if (report.layerAmbiguities.length > 0) {
            expect(report.layerAmbiguities.every(a => a.startsWith('OK:'))).toBe(true);
        }
    });
});
