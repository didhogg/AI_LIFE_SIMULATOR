// M3 存档层 v1 — 纯函数·dormant·零 window/document·零 IO
// serialize / deserialize + 信封校验 + 防白掷隔离（Fork A）+ 快照完整性（Fork B）
// 复用 migrate() 作为 load 单一权威；禁第二套 load 实现
// 六禁守恒：禁 Date.now/new Date/Math.random/window/document/localeCompare
import { z } from 'zod';
import { 存档头Schema } from '../schema/index.js';
import { 临时会话Schema } from '../schema/system.js';
import { canonicalize } from './text/canonicalize.js';
import { fnv1a32 } from './text/fnv1a32.js';
import { 聚合生效中内容包集哈希 } from '../interfaces/contentPackHash.js';
import { migrate } from '../migration/migrate.js';
// ── 8-char hex from fnv1a32 (internal helper) ────────────────────────────────
function hash8(s) {
    return fnv1a32(s).toString(16).padStart(8, '0');
}
// ── Archive envelope schema ───────────────────────────────────────────────────
// envelopeVersion literal guards against accidental cross-format parsing.
const ArchiveEnvelopeSchema = z.object({
    envelopeVersion: z.literal(1),
    meta: z.object({
        migration_version: z.number().int().min(0),
        contentPackSetHash: z.string(),
        snapshotHash: z.string(),
    }),
    header: 存档头Schema,
    snapshot: z.record(z.string(), z.unknown()),
});
// ── Internal helpers ──────────────────────────────────────────────────────────
/** Collect pack_ids from mod注册表 that have a non-empty 内容哈希 (these are "pinned"). */
function getPinnedPackIds(rawModReg) {
    if (rawModReg === null || rawModReg === undefined || typeof rawModReg !== 'object' || Array.isArray(rawModReg)) {
        return [];
    }
    const result = [];
    for (const [packId, entry] of Object.entries(rawModReg)) {
        if (typeof entry === 'object' && entry !== null && !Array.isArray(entry)) {
            const hash = entry['内容哈希'];
            if (typeof hash === 'string' && hash.length > 0) {
                result.push(packId);
            }
        }
    }
    return result;
}
// ── serializeArchive ──────────────────────────────────────────────────────────
/**
 * Serialize a RootState into a stable archive JSON string.
 *
 * Fork A: _存档头 goes into envelope.header (out-of-snapshot channel).
 * Fork B: snapshotHash = fnv1a32(canonicalize(snapshot)) stored in meta.
 * $临时会话 is excluded from the snapshot entirely (volatile, crash-discard).
 *
 * Returns { ok: false } only on unexpected internal error (schema never throws
 * on valid RootState, so this path is a safety net).
 */
export function serializeArchive(state) {
    try {
        const stateRecord = state;
        // Build snapshot: RootState minus $临时会话 minus _存档头
        const snapshot = {};
        for (const key of Object.keys(stateRecord)) {
            if (key !== '$临时会话' && key !== '_存档头') {
                snapshot[key] = stateRecord[key];
            }
        }
        const header = (stateRecord['_存档头'] ?? 存档头Schema.parse({}));
        // Fork B: snapshot integrity hash
        const snapshotHash = hash8(canonicalize(snapshot));
        // Content pack set hash: aggregate over mod注册表 entries that have 内容哈希
        const modReg = (state.mod注册表 ?? {});
        const modPackEntries = Object.values(modReg).map(e => {
            const r = {};
            if (e.内容哈希 !== undefined)
                r.content_hash = e.内容哈希;
            return r;
        });
        const contentPackSetHash = 聚合生效中内容包集哈希(modPackEntries);
        const migrationVersion = state._系统.migration_version ?? 0;
        const envelope = {
            envelopeVersion: 1,
            meta: {
                migration_version: migrationVersion,
                contentPackSetHash,
                snapshotHash,
            },
            header,
            snapshot,
        };
        return { ok: true, json: canonicalize(envelope) };
    }
    catch {
        return { ok: false, gate: 'archive-serialize' };
    }
}
// ── deserializeArchive ────────────────────────────────────────────────────────
/**
 * Deserialize an archive JSON string into a RootState via migrate().
 *
 * Steps (strict order):
 * 1. JSON.parse + envelope schema validation → archive-parse
 * 2. Fork B integrity: recompute snapshotHash → archive-integrity
 * 3. Re-resolve pack check against installedLibrary:
 *    - pinned pack missing → archive-pack-missing
 *    - aggregate hash mismatch → archive-hash
 * 4. Reconstruct migrate() input (Fork A: inject liveRollbackState counters)
 * 5. migrate() → archive-migrate on any throw
 */
export function deserializeArchive(json, ctx) {
    // ── Step 1: parse + shape validation ────────────────────────────────────
    let envelope;
    try {
        const parsed = JSON.parse(json);
        const result = ArchiveEnvelopeSchema.safeParse(parsed);
        if (!result.success)
            return { ok: false, gate: 'archive-parse' };
        envelope = result.data;
    }
    catch {
        return { ok: false, gate: 'archive-parse' };
    }
    // ── Step 2: Fork B integrity check ──────────────────────────────────────
    const recomputedSnapshotHash = hash8(canonicalize(envelope.snapshot));
    if (recomputedSnapshotHash !== envelope.meta.snapshotHash) {
        return { ok: false, gate: 'archive-integrity' };
    }
    // ── Step 3: re-resolve pack check ───────────────────────────────────────
    const library = ctx.installedLibrary.内容包库;
    const pinnedPackIds = getPinnedPackIds(envelope.snapshot['mod注册表']);
    for (const packId of pinnedPackIds) {
        if (!Object.prototype.hasOwnProperty.call(library, packId)) {
            return { ok: false, gate: 'archive-pack-missing' };
        }
    }
    // Recompute content pack set hash from installedLibrary (pinned packs only)
    const recomputedPacks = pinnedPackIds.map(id => {
        const r = {};
        const h = library[id]?.内容哈希;
        if (h !== undefined)
            r.content_hash = h;
        return r;
    });
    const recomputedHash = 聚合生效中内容包集哈希(recomputedPacks);
    if (recomputedHash !== envelope.meta.contentPackSetHash) {
        return { ok: false, gate: 'archive-hash' };
    }
    // ── Step 4: reconstruct migrate() input (Fork A) ─────────────────────────
    // Only 全局回滚计数器 and 系统事件镜像 are taken from liveRollbackState;
    // all other header fields (版本段记录, 迁移戳, 哈希链 …) come from the archive.
    const archivedHeader = envelope.header;
    const migrateInput = {
        ...envelope.snapshot,
        _存档头: {
            ...archivedHeader,
            全局回滚计数器: ctx.liveRollbackState.全局回滚计数器,
            系统事件镜像: ctx.liveRollbackState.系统事件镜像 ?? archivedHeader['系统事件镜像'],
        },
        // Volatile session state is always reset on load; never restored from archive.
        $临时会话: 临时会话Schema.parse(undefined),
    };
    // ── Step 5: migrate() ────────────────────────────────────────────────────
    try {
        const { state, log } = migrate(migrateInput);
        return { ok: true, state, log };
    }
    catch {
        return { ok: false, gate: 'archive-migrate' };
    }
}
