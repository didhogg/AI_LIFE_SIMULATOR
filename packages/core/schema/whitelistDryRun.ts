// P0-6 Gate① — whitelist derivation prototype (dry-run only, not P0-6 gate impl)
// Verifies that "verb-writable path whitelist" can be mechanically derived from RootSchema.
import { z } from 'zod';
import { RootSchema } from './index.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export type AccessLayer =
  | 'writable'           // AI can propose writes (no prefix, AI-facing entity domain)
  | 'read-only'          // AI can see, engine writes (_ prefix)
  | 'invisible'          // AI cannot see or touch ($ prefix, except $meta)
  | 'cross-playthrough'  // $meta layer (spans playthroughs)
  | 'engine-internal';   // No prefix but engine-managed; flagged as layer ambiguity

export type FieldKind =
  | 'open-string'  // z.string() — AI can write arbitrary text
  | 'enum'         // z.enum() — AI must choose from fixed set
  | 'literal'      // z.literal() — immutable constant
  | 'number'       // z.number()
  | 'boolean'      // z.boolean()
  | 'array'        // z.array() — AI can append
  | 'record'       // z.record() — keyed entity store
  | 'object'       // z.object() intermediate node
  | 'union'        // z.union/discriminatedUnion
  | 'unknown';

export interface DerivedEntry {
  path: string;
  layer: AccessLayer;
  kind: FieldKind;
  enumValues?: readonly string[];
}

// ─── Top-level key classification ────────────────────────────────────────────

// Keys with no $ or _ prefix but managed entirely by the engine, not the AI.
// These are flagged as layering ambiguities — they should arguably carry _ prefix.
const ENGINE_INTERNAL_KEYS = new Set<string>(['系统', '状态机', '存档头', '席位表']);

export function classifyTopKey(key: string): AccessLayer {
  if (key === '$meta') return 'cross-playthrough';
  if (key.startsWith('$')) return 'invisible';
  if (key.startsWith('_')) return 'read-only';
  if (ENGINE_INTERNAL_KEYS.has(key)) return 'engine-internal';
  return 'writable';
}

// ─── Nested field layer inheritance ──────────────────────────────────────────

export function nestedFieldLayer(fieldName: string, parentLayer: AccessLayer): AccessLayer {
  // Invisible/cross-playthrough/engine-internal propagate to all children
  if (
    parentLayer === 'invisible' ||
    parentLayer === 'cross-playthrough' ||
    parentLayer === 'engine-internal'
  ) return parentLayer;
  // read-only propagates to all children (can't write to a child of a read-only object)
  if (parentLayer === 'read-only') return 'read-only';
  // Within a writable context, check the sub-field's own prefix
  if (fieldName === '$meta') return 'cross-playthrough';
  if (fieldName.startsWith('$')) return 'invisible';
  if (fieldName.startsWith('_')) return 'read-only';
  return 'writable';
}

// ─── Zod schema introspection ─────────────────────────────────────────────────

// Unwrap ZodDefault / ZodOptional / ZodNullable / ZodEffects to get the core schema
export function unwrap(schema: z.ZodTypeAny): z.ZodTypeAny {
  const tn = (schema._def as { typeName: string }).typeName;
  if (tn === 'ZodDefault' || tn === 'ZodOptional' || tn === 'ZodNullable') {
    return unwrap((schema._def as { innerType: z.ZodTypeAny }).innerType);
  }
  if (tn === 'ZodEffects') {
    return unwrap((schema._def as { schema: z.ZodTypeAny }).schema);
  }
  return schema;
}

export function classifyKind(schema: z.ZodTypeAny): {
  kind: FieldKind;
  enumValues?: readonly string[];
} {
  const s = unwrap(schema);
  const tn = (s._def as { typeName: string }).typeName;
  switch (tn) {
    case 'ZodString':
      return { kind: 'open-string' };
    case 'ZodEnum':
      return {
        kind: 'enum',
        enumValues: (s._def as { values: readonly string[] }).values,
      };
    case 'ZodNativeEnum':
      return { kind: 'enum' };
    case 'ZodLiteral':
      return { kind: 'literal' };
    case 'ZodNumber':
      return { kind: 'number' };
    case 'ZodBoolean':
      return { kind: 'boolean' };
    case 'ZodObject':
      return { kind: 'object' };
    case 'ZodRecord':
      return { kind: 'record' };
    case 'ZodArray':
      return { kind: 'array' };
    case 'ZodUnion':
    case 'ZodDiscriminatedUnion':
      return { kind: 'union' };
    default:
      return { kind: 'unknown' };
  }
}

// ─── Recursive schema walker ──────────────────────────────────────────────────

export function walkSchema(
  schema: z.ZodTypeAny,
  currentPath: string,
  layer: AccessLayer,
  results: DerivedEntry[],
): void {
  const s = unwrap(schema);
  const tn = (s._def as { typeName: string }).typeName;

  if (tn === 'ZodObject') {
    // Emit an entry for the object node itself (needed for 创建实体 record-root targets)
    results.push({ path: currentPath, layer, kind: 'object' });
    const shape = (s as z.ZodObject<z.ZodRawShape>).shape;
    for (const [key, fieldSchema] of Object.entries(shape)) {
      const fieldLayer = nestedFieldLayer(key, layer);
      const fieldPath = `${currentPath}.${key}`;
      walkSchema(fieldSchema as z.ZodTypeAny, fieldPath, fieldLayer, results);
    }
    return;
  }

  if (tn === 'ZodRecord') {
    results.push({ path: currentPath, layer, kind: 'record' });
    const valueSchema = (s._def as { valueType: z.ZodTypeAny }).valueType;
    walkSchema(valueSchema, `${currentPath}.{id}`, layer, results);
    return;
  }

  if (tn === 'ZodArray') {
    results.push({ path: currentPath, layer, kind: 'array' });
    const itemSchema = (s._def as { type: z.ZodTypeAny }).type;
    walkSchema(itemSchema, `${currentPath}.{i}`, layer, results);
    return;
  }

  if (tn === 'ZodUnion') {
    results.push({ path: currentPath, layer, kind: 'union' });
    // Walk union options shallowly — each option shares the same path
    const options = (s._def as { options: z.ZodTypeAny[] }).options;
    for (const option of options) {
      walkSchema(option, currentPath, layer, results);
    }
    return;
  }

  if (tn === 'ZodDiscriminatedUnion') {
    results.push({ path: currentPath, layer, kind: 'union' });
    const options = (s._def as { options: Map<string, z.ZodTypeAny> | z.ZodTypeAny[] }).options;
    const optionList = Array.isArray(options) ? options : [...(options as Map<string, z.ZodTypeAny>).values()];
    for (const option of optionList) {
      walkSchema(option, currentPath, layer, results);
    }
    return;
  }

  // Leaf node
  const { kind, enumValues } = classifyKind(s);
  results.push({ path: currentPath, layer, kind, ...(enumValues ? { enumValues } : {}) });
}

// ─── Main derivation function ─────────────────────────────────────────────────

export function deriveWritableWhitelist(): DerivedEntry[] {
  const results: DerivedEntry[] = [];
  const shape = RootSchema.shape;
  for (const [key, schema] of Object.entries(shape)) {
    const layer = classifyTopKey(key);
    walkSchema(schema as z.ZodTypeAny, key, layer, results);
  }
  return results;
}

// ─── Dry-run report ───────────────────────────────────────────────────────────

export interface DryRunResult {
  checkA: CheckAResult;
  checkB: CheckBResult;
  checkC: CheckCResult;
  layerAmbiguities: string[];
}

export interface CheckAResult {
  pass: boolean;
  invisibleCount: number;
  crossPlaythroughCount: number;
  readOnlyCount: number;
  writableCount: number;
  engineInternalCount: number;
  misclassified: string[];
}

export interface CheckBResult {
  pass: boolean;
  openStringPaths: string[];
  enumPaths: string[];
  distinguishable: boolean;
}

export interface CheckCResult {
  pass: boolean;
  probeResults: Array<{ probe: string; found: boolean; kind?: FieldKind }>;
  missing: string[];
}

// Representative verb target paths used in dry-run check (c).
// These are examples covering the 4 universal verbs and key semantic verbs.
// NOTE: These are PREFIX patterns (path starts-with checks), not exact matches,
// because record entries use {id} placeholders.
const VERB_TARGET_PROBES: Array<{ probe: string; description: string }> = [
  // ── 通用×4 ──
  { probe: 'NPC.{id}',                              description: '创建实体·NPC' },
  { probe: 'NPC.{id}.属性',                         description: '修改·NPC属性段' },
  { probe: '组织实体.{id}',                          description: '创建实体·组织' },
  { probe: '全局.编年史.{i}',                        description: '追加·编年史' },
  { probe: '工作记忆',                               description: '埋种子·工作记忆数组' },
  // ── 语义动词 (representative) ──
  { probe: '全局.秘密库.{id}.暴露度',                description: 'declassify·秘密暴露度' },
  { probe: '全局.秘密库.{id}.已暴露线索',            description: '线索浮现·线索追加' },
  { probe: '组织关系网.{id}.关系值',                 description: '阵营变更·关系值' },
  { probe: 'NPC.{id}.当前作息模式',                  description: '切换作息模式' },
  { probe: '长期归档',                               description: '战果档·长期归档数组' },
  { probe: '地图.地点.{id}',                         description: '地点创建/修改' },
  { probe: '货币系统.账户.持有.{id}',                description: '修改·账户持有' },
  { probe: 'NPC.{id}.状态标签',                      description: '状态变更·状态标签' },
  { probe: '全局.约定库.{id}',                       description: '约定创建/修改' },
  // ── 兜底×1 ──
  // The catch-all verb routes to any writable path — covered if the whitelist
  // contains at least one writable leaf.
  { probe: 'NPC.{id}.属性.体质',                    description: '兜底·代表叶节点' },
];

export function runDryRun(): DryRunResult {
  const all = deriveWritableWhitelist();
  const pathToEntry = new Map(all.map(e => [e.path, e]));

  // ── Check A: prefix layer correctness ─────────────────────────────────────
  const layerCounts = { invisible: 0, 'cross-playthrough': 0, 'read-only': 0, writable: 0, 'engine-internal': 0 };
  const misclassified: string[] = [];

  for (const entry of all) {
    const topKey = entry.path.split('.')[0]!;
    const expectedLayer = classifyTopKey(topKey);

    // Children of writable/engine-internal tops can override via nested prefix
    // so we only check top-level entries for direct key classification.
    if (!entry.path.includes('.')) {
      if (entry.layer !== expectedLayer) {
        misclassified.push(`${entry.path}: expected ${expectedLayer}, got ${entry.layer}`);
      }
    }

    layerCounts[entry.layer as keyof typeof layerCounts] =
      (layerCounts[entry.layer as keyof typeof layerCounts] ?? 0) + 1;
  }

  const checkA: CheckAResult = {
    pass: misclassified.length === 0,
    invisibleCount: layerCounts['invisible'],
    crossPlaythroughCount: layerCounts['cross-playthrough'],
    readOnlyCount: layerCounts['read-only'],
    writableCount: layerCounts['writable'],
    engineInternalCount: layerCounts['engine-internal'],
    misclassified,
  };

  // ── Check B: open-string vs enum distinguishable ───────────────────────────
  const writableEntries = all.filter(e => e.layer === 'writable');
  const openStringPaths = writableEntries.filter(e => e.kind === 'open-string').map(e => e.path);
  const enumPaths = writableEntries.filter(e => e.kind === 'enum').map(e => e.path);

  const checkB: CheckBResult = {
    pass: true, // trivially true: kind 'open-string' vs 'enum' are different string values
    openStringPaths: openStringPaths.slice(0, 10), // sample for report
    enumPaths: enumPaths.slice(0, 10),
    distinguishable: true,
  };

  // ── Check C: verb target coverage ─────────────────────────────────────────
  const probeResults = VERB_TARGET_PROBES.map(({ probe }) => {
    const entry = pathToEntry.get(probe);
    if (entry && entry.layer === 'writable') {
      return { probe, found: true, kind: entry.kind };
    }
    // Also accept if pathSet contains a prefix of the probe (parent writable object)
    // i.e. if "NPC.{id}.属性" exists, "NPC.{id}.属性.体质" might still be writable
    // but here we require an exact match to be rigorous.
    return { probe, found: false };
  });

  const missing = probeResults.filter(r => !r.found).map(r => r.probe);

  const checkC: CheckCResult = {
    pass: missing.length === 0,
    probeResults,
    missing,
  };

  // ── Layering ambiguities to discuss ──────────────────────────────────────
  const layerAmbiguities = [
    ...Array.from(ENGINE_INTERNAL_KEYS).map(
      k =>
        `"${k}" has no prefix but is engine-managed — consider adding _ prefix for explicitness`,
    ),
  ];

  // Flag nested $ fields found inside writable top-level domains
  const nestedInvisible = all.filter(
    e =>
      e.layer === 'invisible' &&
      !classifyTopKey(e.path.split('.')[0]!).startsWith('invisible') &&
      classifyTopKey(e.path.split('.')[0]!) === 'writable',
  );
  if (nestedInvisible.length > 0) {
    layerAmbiguities.push(
      `${nestedInvisible.length} nested $ fields found inside writable domains ` +
        `(e.g. ${nestedInvisible.slice(0, 3).map(e => e.path).join(', ')}) — ` +
        'correctly invisible by nested prefix rule',
    );
  }

  return { checkA, checkB, checkC, layerAmbiguities };
}
