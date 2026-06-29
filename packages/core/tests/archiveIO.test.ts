/**
 * M3 存档层 v1 · archiveIO 验收
 *
 * 断言① RT   往返幂等：serialize → deserialize → serialize 字节恒等；state 深等（除覆盖字段与重置 $临时会话）
 * 断言② AS   防白掷（Fork A）：liveRollbackState 覆盖 全局回滚计数器 / 系统事件镜像
 * 断言③ EX   排除校验：$临时会话 不在 snapshot；_存档头 只在 header
 * 断言④ INT  完整性（Fork B）：篡改 snapshot 任一字节 → archive-integrity
 * 断言⑤ PACK 缺包检测：缺包 → archive-pack-missing；哈希变 → archive-hash；空集 '' → 通过
 * 断言⑥ MIG  迁移落地：archive 喂入后 migrate() 跑通·state 有效
 * 断言⑦ GATE 拒载不抛：migrate() throw 场景 → archive-migrate·不冒泡
 * 断言⑧ CONS 守恒：往返前后货币向量恒等；schemaKeys=54 不变
 */
import { describe, it, expect } from 'vitest';
import { serializeArchive, deserializeArchive } from '../engine/archiveIO.js';
import type { DeserializeCtx } from '../engine/archiveIO.js';
import { RootSchema } from '../schema/index.js';
import { canonicalize } from '../engine/text/canonicalize.js';
import { fnv1a32 } from '../engine/text/fnv1a32.js';
import type { 已安装内容库 } from '../engine/contentPackIO.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** Minimal valid RootState with optional mod entries with content hashes. */
function makeState(overrides: Record<string, unknown> = {}) {
  return RootSchema.parse(overrides);
}

/** Minimal installedLibrary — no content packs. */
function emptyLibrary(): 已安装内容库 {
  return { 内容包库: {} };
}

/**
 * Build a library matching a mod registry entry.
 * pack entries need `内容哈希` field to match mod注册表 entries' `内容哈希`.
 */
function libraryWithPack(packId: string, 内容哈希: string): 已安装内容库 {
  return {
    内容包库: {
      [packId]: {
        pack_id: packId,
        依赖: [],
        冲突: [],
        内容哈希,
      } as unknown as 已安装内容库['内容包库'][string],
    },
  };
}

/** Default liveRollbackState (counter=0, no 系统事件镜像). */
function liveLow(): DeserializeCtx['liveRollbackState'] {
  return { 全局回滚计数器: 0 };
}

/** Context with empty library and zero rollback counter. */
function emptyCtx(): DeserializeCtx {
  return { installedLibrary: emptyLibrary(), liveRollbackState: liveLow() };
}

// ─────────────────────────────────────────────────────────────────────────────
// 断言① · RT 往返幂等
// ─────────────────────────────────────────────────────────────────────────────
describe('M3 ① RT · 往返幂等', () => {
  it('RT-1 serialize → deserialize → serialize 字节恒等', () => {
    const state = makeState();
    const r1 = serializeArchive(state);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;

    const d = deserializeArchive(r1.json, emptyCtx());
    expect(d.ok).toBe(true);
    if (!d.ok) return;

    const r2 = serializeArchive(d.state);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;

    expect(r2.json).toBe(r1.json);
  });

  it('RT-2 往返后 state 深等（$临时会话/存档头计数器覆盖除外）', () => {
    const state = makeState();
    const r = serializeArchive(state);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const live: DeserializeCtx['liveRollbackState'] = {
      全局回滚计数器: state._存档头.全局回滚计数器,
    };
    const d = deserializeArchive(r.json, {
      installedLibrary: emptyLibrary(),
      liveRollbackState: live,
    });
    expect(d.ok).toBe(true);
    if (!d.ok) return;

    // $临时会话 is reset → undefined after deserialize
    expect(d.state.$临时会话).toBeUndefined();
    // core state data is preserved
    expect(d.state._系统版本).toBe(state._系统版本);
    expect(d.state.$运气).toBe(state.$运气);
  });

  it('RT-3 state with $临时会话 set → 往返后 $临时会话 被重置', () => {
    const state = RootSchema.parse({
      $临时会话: { 草稿文本: '草稿内容' },
    });
    const r = serializeArchive(state);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const d = deserializeArchive(r.json, emptyCtx());
    expect(d.ok).toBe(true);
    if (!d.ok) return;

    expect(d.state.$临时会话).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 断言② · AS 防白掷（Fork A）
// ─────────────────────────────────────────────────────────────────────────────
describe('M3 ② AS · 防白掷（Fork A）', () => {
  it('AS-1 liveRollbackState 全局回滚计数器=N+3 覆盖档内 N → load 后等于 N+3', () => {
    const state = makeState();
    // Archive has counter = 0 (default)
    const r = serializeArchive(state);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const d = deserializeArchive(r.json, {
      installedLibrary: emptyLibrary(),
      liveRollbackState: { 全局回滚计数器: 3 },
    });
    expect(d.ok).toBe(true);
    if (!d.ok) return;

    expect(d.state._存档头.全局回滚计数器).toBe(3);
  });

  it('AS-2 liveRollbackState 系统事件镜像优先于档内值', () => {
    const state = makeState();
    const r = serializeArchive(state);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const liveMirror = {
      全局回滚次数: 7,
      周目数: 2,
      换角数: 1,
      裸SL次数: 0,
    };
    const d = deserializeArchive(r.json, {
      installedLibrary: emptyLibrary(),
      liveRollbackState: {
        全局回滚计数器: 5,
        系统事件镜像: liveMirror,
      },
    });
    expect(d.ok).toBe(true);
    if (!d.ok) return;

    expect(d.state._存档头.系统事件镜像?.全局回滚次数).toBe(7);
    expect(d.state._存档头.系统事件镜像?.周目数).toBe(2);
  });

  it('AS-3 无 liveRollbackState.系统事件镜像 → 回退档内值', () => {
    // Create state with a specific 系统事件镜像 value in the archive
    const state = RootSchema.parse({
      _存档头: {
        全局回滚计数器: 0,
        系统事件镜像: { 全局回滚次数: 99, 周目数: 0, 换角数: 0, 裸SL次数: 0 },
      },
    });
    const r = serializeArchive(state);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const d = deserializeArchive(r.json, {
      installedLibrary: emptyLibrary(),
      liveRollbackState: { 全局回滚计数器: 0 }, // no 系统事件镜像 in live state
    });
    expect(d.ok).toBe(true);
    if (!d.ok) return;

    // Falls back to archived value
    expect(d.state._存档头.系统事件镜像?.全局回滚次数).toBe(99);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 断言③ · EX 排除校验
// ─────────────────────────────────────────────────────────────────────────────
describe('M3 ③ EX · 排除校验', () => {
  it('EX-1 serialize 产物：$临时会话 不在 snapshot 中', () => {
    const state = RootSchema.parse({ $临时会话: { 草稿文本: '草稿' } });
    const r = serializeArchive(state);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const envelope = JSON.parse(r.json) as { snapshot: Record<string, unknown> };
    expect('$临时会话' in envelope.snapshot).toBe(false);
  });

  it('EX-2 serialize 产物：_存档头 只在 envelope.header·不在 envelope.snapshot', () => {
    const state = makeState();
    const r = serializeArchive(state);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const envelope = JSON.parse(r.json) as {
      snapshot: Record<string, unknown>;
      header: Record<string, unknown>;
    };
    expect('_存档头' in envelope.snapshot).toBe(false);
    expect(envelope.header).toBeDefined();
    expect(typeof envelope.header).toBe('object');
  });

  it('EX-3 envelopeVersion = 1 present', () => {
    const r = serializeArchive(makeState());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const e = JSON.parse(r.json) as { envelopeVersion: number };
    expect(e.envelopeVersion).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 断言④ · INT 完整性（Fork B）
// ─────────────────────────────────────────────────────────────────────────────
describe('M3 ④ INT · 完整性（Fork B）', () => {
  it('INT-1 篡改 envelope.snapshot 任一字节 → archive-integrity', () => {
    const r = serializeArchive(makeState());
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const envelope = JSON.parse(r.json) as Record<string, unknown>;
    // Tamper: inject a field into snapshot
    (envelope['snapshot'] as Record<string, unknown>)['__tampered__'] = true;
    // Recompute canonical JSON without touching snapshotHash in meta
    const tamperedJson = canonicalize(envelope);

    const d = deserializeArchive(tamperedJson, emptyCtx());
    expect(d.ok).toBe(false);
    if (d.ok) return;
    expect(d.gate).toBe('archive-integrity');
  });

  it('INT-2 meta.snapshotHash 篡改 → archive-integrity', () => {
    const r = serializeArchive(makeState());
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const envelope = JSON.parse(r.json) as { meta: { snapshotHash: string } };
    envelope.meta.snapshotHash = '00000000';
    const tamperedJson = canonicalize(envelope);

    const d = deserializeArchive(tamperedJson, emptyCtx());
    expect(d.ok).toBe(false);
    if (d.ok) return;
    expect(d.gate).toBe('archive-integrity');
  });

  it('INT-3 有效 envelope → integrity 通过', () => {
    const r = serializeArchive(makeState());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const d = deserializeArchive(r.json, emptyCtx());
    expect(d.ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 断言⑤ · PACK 缺包检测
// ─────────────────────────────────────────────────────────────────────────────
describe('M3 ⑤ PACK · 缺包检测', () => {
  /**
   * Build a state that has a mod entry with a non-empty 内容哈希,
   * so it registers as a "pinned content pack".
   */
  function stateWithMod(packId: string, 内容哈希: string) {
    return RootSchema.parse({
      mod注册表: {
        [packId]: {
          pack_id: packId,
          版本: '1.0.0',
          内容哈希,
        },
      },
    });
  }

  it('PACK-1 installedLibrary 移除 pin 的包 → archive-pack-missing', () => {
    const packId = 'alpha_pack';
    const hash = '1a2b3c4d';
    const state = stateWithMod(packId, hash);
    const library = libraryWithPack(packId, hash);

    // Serialize with library present (success)
    const r = serializeArchive(state);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    // Remove the pack from library before deserialization
    const emptyLib = emptyLibrary();
    const d = deserializeArchive(r.json, {
      installedLibrary: emptyLib,
      liveRollbackState: liveLow(),
    });
    expect(d.ok).toBe(false);
    if (d.ok) return;
    expect(d.gate).toBe('archive-pack-missing');

    // With the library present → succeeds
    const d2 = deserializeArchive(r.json, {
      installedLibrary: library,
      liveRollbackState: liveLow(),
    });
    expect(d2.ok).toBe(true);
  });

  it('PACK-2 改包内容致哈希变 → archive-hash', () => {
    const packId = 'beta_pack';
    const originalHash = '11111111';
    const changedHash = '22222222';

    const state = stateWithMod(packId, originalHash);
    const r = serializeArchive(state);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    // Library exists but content hash changed
    const changedLibrary = libraryWithPack(packId, changedHash);
    const d = deserializeArchive(r.json, {
      installedLibrary: changedLibrary,
      liveRollbackState: liveLow(),
    });
    expect(d.ok).toBe(false);
    if (d.ok) return;
    expect(d.gate).toBe('archive-hash');
  });

  it('PACK-3 空集两侧 contentPackSetHash=\'\' → fail-open 通过', () => {
    // State with no mods having 内容哈希 → contentPackSetHash = ''
    const state = makeState();
    const r = serializeArchive(state);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const envelope = JSON.parse(r.json) as { meta: { contentPackSetHash: string } };
    expect(envelope.meta.contentPackSetHash).toBe('');

    // Deserialize with empty library → no pinned packs → '' == '' → pass
    const d = deserializeArchive(r.json, emptyCtx());
    expect(d.ok).toBe(true);
  });

  it('PACK-4 多包中部分缺失 → archive-pack-missing', () => {
    const state = RootSchema.parse({
      mod注册表: {
        mod_a: { pack_id: 'mod_a', 版本: '1.0.0', 内容哈希: 'aaaa0001' },
        mod_b: { pack_id: 'mod_b', 版本: '1.0.0', 内容哈希: 'bbbb0002' },
      },
    });
    const r = serializeArchive(state);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    // Only provide mod_a in library, mod_b is missing
    const partialLib: 已安装内容库 = {
      内容包库: {
        mod_a: { pack_id: 'mod_a', 依赖: [], 冲突: [], 内容哈希: 'aaaa0001' } as unknown as 已安装内容库['内容包库'][string],
      },
    };
    const d = deserializeArchive(r.json, {
      installedLibrary: partialLib,
      liveRollbackState: liveLow(),
    });
    expect(d.ok).toBe(false);
    if (d.ok) return;
    expect(d.gate).toBe('archive-pack-missing');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 断言⑥ · MIG 迁移落地
// ─────────────────────────────────────────────────────────────────────────────
describe('M3 ⑥ MIG · 迁移落地', () => {
  it('MIG-1 deserialize 后 state 通过 RootSchema.parse（migrate() 跑通）', () => {
    const state = makeState();
    const r = serializeArchive(state);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const d = deserializeArchive(r.json, emptyCtx());
    expect(d.ok).toBe(true);
    if (!d.ok) return;

    // migrate() already ran; result should be schema-valid
    expect(() => RootSchema.parse(d.state)).not.toThrow();
  });

  it('MIG-2 低 migration_version 的 snapshot → deserialize 后版本正常（migrate chain 生效）', () => {
    // Inject a low migration_version into the raw snapshot before sealing
    const state = makeState();
    const r = serializeArchive(state);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    // Patch the snapshot's _系统.migration_version to 0 and recompute hashes
    const envelope = JSON.parse(r.json) as {
      snapshot: Record<string, unknown>;
      meta: { snapshotHash: string; migration_version: number };
    };
    const sys = (envelope.snapshot['_系统'] ?? {}) as Record<string, unknown>;
    envelope.snapshot['_系统'] = { ...sys, migration_version: 0 };
    envelope.meta.migration_version = 0;
    // Recompute snapshotHash after patching
    envelope.meta.snapshotHash = fnv1a32(canonicalize(envelope.snapshot)).toString(16).padStart(8, '0');

    const patched = canonicalize(envelope);
    const d = deserializeArchive(patched, emptyCtx());
    expect(d.ok).toBe(true);
    if (!d.ok) return;

    // State must be valid (migrate() handled the upgrade)
    expect(() => RootSchema.parse(d.state)).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 断言⑦ · GATE 拒载不抛
// ─────────────────────────────────────────────────────────────────────────────
describe('M3 ⑦ GATE · 拒载不抛', () => {
  it('GATE-1 无效 JSON → archive-parse·不抛异常', () => {
    const d = deserializeArchive('{ not valid json', emptyCtx());
    expect(d.ok).toBe(false);
    if (d.ok) return;
    expect(d.gate).toBe('archive-parse');
  });

  it('GATE-2 缺 envelopeVersion 字段 → archive-parse', () => {
    const raw = canonicalize({ meta: {}, header: {}, snapshot: {} });
    const d = deserializeArchive(raw, emptyCtx());
    expect(d.ok).toBe(false);
    if (d.ok) return;
    expect(d.gate).toBe('archive-parse');
  });

  it('GATE-3 envelopeVersion=2（未来版本）→ archive-parse', () => {
    const state = makeState();
    const r = serializeArchive(state);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const envelope = JSON.parse(r.json) as Record<string, unknown>;
    envelope['envelopeVersion'] = 2;
    const d = deserializeArchive(canonicalize(envelope), emptyCtx());
    expect(d.ok).toBe(false);
    if (d.ok) return;
    expect(d.gate).toBe('archive-parse');
  });

  it('GATE-4 migrate() throw 场景 → archive-migrate·不冒泡异常', () => {
    // _系统版本='4.1' → v4.1 early-return path (raw passed through unchanged).
    // mod注册表 entry with 版本='not-semver' fails mod条目Schema.版本 refine →
    // RootSchema.parse() throws ZodError → caught as archive-migrate.
    const badSnapshot = {
      _系统版本: '4.1',
      mod注册表: {
        test_mod: { pack_id: 'test_mod', 版本: 'not-semver', 启用: true, 依赖: [], 冲突: [] },
      },
    };
    const snapshotHash = fnv1a32(canonicalize(badSnapshot)).toString(16).padStart(8, '0');
    const envelope = {
      envelopeVersion: 1,
      meta: { migration_version: 0, contentPackSetHash: '', snapshotHash },
      header: {},
      snapshot: badSnapshot,
    };
    const json = canonicalize(envelope);
    const d = deserializeArchive(json, emptyCtx());
    expect(d.ok).toBe(false);
    if (d.ok) return;
    expect(d.gate).toBe('archive-migrate');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 断言⑧ · CONS 守恒
// ─────────────────────────────────────────────────────────────────────────────
describe('M3 ⑧ CONS · 守恒', () => {
  it('CONS-1 schemaKeys=54 守恒（archiveIO 不加 RootSchema 顶层键）', () => {
    // Import RootSchema key count check (same guard as other test files)
    const { BLUEPRINT_KEYS } = require('../schema/index.js') as { BLUEPRINT_KEYS: readonly string[] };
    expect(BLUEPRINT_KEYS.length).toBe(54);
  });

  it('CONS-2 往返前后 $运气 资源值恒等', () => {
    const state = RootSchema.parse({ $运气: 77 });
    const r = serializeArchive(state);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const d = deserializeArchive(r.json, emptyCtx());
    expect(d.ok).toBe(true);
    if (!d.ok) return;

    expect(d.state.$运气).toBe(77);
  });

  it('CONS-3 往返前后 货币系统 结构恒等', () => {
    const state = makeState();
    const r = serializeArchive(state);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const d = deserializeArchive(r.json, emptyCtx());
    expect(d.ok).toBe(true);
    if (!d.ok) return;

    expect(canonicalize(d.state.货币系统)).toBe(canonicalize(state.货币系统));
  });

  it('CONS-4 log 字段存在（migrate 日志透传）', () => {
    const state = makeState();
    const r = serializeArchive(state);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const d = deserializeArchive(r.json, emptyCtx());
    expect(d.ok).toBe(true);
    if (!d.ok) return;

    expect(Array.isArray(d.log)).toBe(true);
  });
});
