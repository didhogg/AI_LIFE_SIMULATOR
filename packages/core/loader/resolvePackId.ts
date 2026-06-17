// packages/core/loader/resolvePackId.ts — B2·K6④ resolvePackId pure function
// effectiveId = pack_id ?? recordKey (B1 口径·K6⑤ 后 pack_id === recordKey 恒成立).
// No IO, no Date, no Math.random, no localeCompare (五禁④).
import type { ModRegistry } from './modGraph.js';

/**
 * Resolve the effective pack_id for a mod registry entry by record key.
 *
 * After B2·K6⑤, pack_id === recordKey for all entries in a migrated registry.
 * The effectiveId semantic (pack_id ?? recordKey) is preserved for pre-B2 callers.
 *
 * @param registry - The parsed mod注册表 (record key → ModEntry).
 * @param id - A record key to look up.
 * @returns The effective pack_id (= pack_id ?? recordKey), or undefined if the key is absent.
 */
export function resolvePackId(registry: ModRegistry, id: string): string | undefined {
  const entry = registry[id];
  if (entry === undefined) return undefined;
  return entry.pack_id ?? id;
}
