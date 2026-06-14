// P0-6 Gate① — Whitelist derivation dry-run
// Verifies that path whitelist can be auto-derived from RootSchema and covers
// all verb target paths.
import { describe, it, expect } from 'vitest';
import {
  classifyTopKey,
  nestedFieldLayer,
  deriveWritableWhitelist,
  runDryRun,
  type AccessLayer,
} from '../schema/whitelistDryRun.js';

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

  it('engine-internal keys → engine-internal', () => {
    expect(classifyTopKey('状态机')).toBe('engine-internal');
    expect(classifyTopKey('存档头')).toBe('engine-internal');
    expect(classifyTopKey('系统')).toBe('engine-internal');
    expect(classifyTopKey('席位表')).toBe('engine-internal');
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

  it('engine-internal parent propagates to children', () => {
    expect(nestedFieldLayer('当前态', 'engine-internal')).toBe('engine-internal');
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
      const top = e.path.split('.')[0]!;
      return top.startsWith('$');
    });
    for (const e of dollarTopEntries) {
      const top = e.path.split('.')[0]!;
      const expected: AccessLayer = top === '$meta' ? 'cross-playthrough' : 'invisible';
      expect(e.layer, e.path).toBe(expected);
    }
  });

  it('every _ top-level key entry is read-only', () => {
    const entries = deriveWritableWhitelist();
    const underscoreTopEntries = entries.filter(e => e.path.split('.')[0]!.startsWith('_'));
    expect(underscoreTopEntries.length).toBeGreaterThan(0);
    for (const e of underscoreTopEntries) {
      expect(e.layer, e.path).toBe('read-only');
    }
  });

  it('nested $ field inside writable parent (全局.秘密库.{id}.$谜底) is invisible', () => {
    const entries = deriveWritableWhitelist();
    const 谜底 = entries.find(e => e.path === '全局.秘密库.{id}.$谜底');
    expect(谜底).toBeDefined();
    expect(谜底!.layer).toBe('invisible');
  });

  it('全局.秘密库.{id}.暴露度 is writable number', () => {
    const entries = deriveWritableWhitelist();
    const e = entries.find(p => p.path === '全局.秘密库.{id}.暴露度');
    expect(e).toBeDefined();
    expect(e!.layer).toBe('writable');
    expect(e!.kind).toBe('number');
  });

  it('NPC.{id}.属性.体质 is writable number', () => {
    const entries = deriveWritableWhitelist();
    const e = entries.find(p => p.path === 'NPC.{id}.属性.体质');
    expect(e).toBeDefined();
    expect(e!.layer).toBe('writable');
    expect(e!.kind).toBe('number');
  });

  it('NPC.{id}.当前作息模式 is writable open-string', () => {
    const entries = deriveWritableWhitelist();
    const e = entries.find(p => p.path === 'NPC.{id}.当前作息模式');
    expect(e).toBeDefined();
    expect(e!.layer).toBe('writable');
    expect(e!.kind).toBe('open-string');
  });

  it('组织关系网.{id}.关系值 is writable number', () => {
    const entries = deriveWritableWhitelist();
    const e = entries.find(p => p.path === '组织关系网.{id}.关系值');
    expect(e).toBeDefined();
    expect(e!.layer).toBe('writable');
    expect(e!.kind).toBe('number');
  });

  it('enum fields have enumValues populated', () => {
    const entries = deriveWritableWhitelist();
    const enumEntries = entries.filter(e => e.kind === 'enum' && e.enumValues !== undefined);
    expect(enumEntries.length).toBeGreaterThan(0);
    // All enum entries must have at least one value
    for (const e of enumEntries) {
      expect(e.enumValues!.length, e.path).toBeGreaterThan(0);
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
    expect(e!.kind).toBe('open-string');
  });

  it('known enum field (_叙事设置.人称.人称) is enum', () => {
    const entries = deriveWritableWhitelist();
    const e = entries.find(p => p.path === '_叙事设置.人称.人称');
    expect(e).toBeDefined();
    expect(e!.kind).toBe('enum');
    expect(e!.enumValues).toContain('一');
    expect(e!.enumValues).toContain('二');
    expect(e!.enumValues).toContain('三');
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
    expect(e!.layer).toBe('writable');
    expect(e!.kind).toBe('object');
  });

  it('修改·NPC属性段: NPC.{id}.属性 is writable object', () => {
    const entries = deriveWritableWhitelist();
    const e = entries.find(p => p.path === 'NPC.{id}.属性');
    expect(e).toBeDefined();
    expect(e!.layer).toBe('writable');
  });

  it('追加·编年史: 全局.编年史 is writable array', () => {
    const entries = deriveWritableWhitelist();
    const e = entries.find(p => p.path === '全局.编年史');
    expect(e).toBeDefined();
    expect(e!.layer).toBe('writable');
    expect(e!.kind).toBe('array');
  });

  it('埋种子: 工作记忆 array is writable', () => {
    const entries = deriveWritableWhitelist();
    const e = entries.find(p => p.path === '工作记忆');
    expect(e).toBeDefined();
    expect(e!.layer).toBe('writable');
    expect(e!.kind).toBe('array');
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
  });

  it('engine-internal ambiguities are flagged', () => {
    const report = runDryRun();
    // At minimum 状态机, 存档头, 系统, 席位表 should be flagged
    expect(report.layerAmbiguities.some(a => a.includes('状态机'))).toBe(true);
    expect(report.layerAmbiguities.some(a => a.includes('存档头'))).toBe(true);
  });
});
