// PR-瘦身-A2 · resolve() 双轨并存 + 三层校验
// 新轨（模块键路由 + 内容包库）优先；旧轨（直接叠加）作等价验收基准
// dormant: 不接 runTick · 不进生产路径 · 纯函数·无副作用
// 禁 Date.now / new Date / Math.random / window / document
import { computeLoadOrder } from '../../loader/modGraph.js';
import type { ModRegistry } from '../../loader/modGraph.js';
import { satisfies } from '../../loader/semver.js';
import { 聚合生效中内容包集哈希 } from '../../interfaces/contentPackHash.js';
import type { mod墓碑原因Type } from '../../schema/memory.js';
import type { 内容包条目Type, 内容包库Type } from './contentPack.js';
import { 种子视图 } from './seedView.js';
import { RootSchema } from '../../schema/index.js';

// ── 入参 ────────────────────────────────────────────────────────────────────────
/** 薄清单 = 引用包列表（按引用顺序）+ 可选基底版本（默认 '4.1.0'） */
export interface 薄清单 {
  packs: string[];        // 引用顺序 pack_id 列表（优先级无声明则按顺序后载覆盖先载）
  基底版本?: string;      // 用于 基底契约 semver 校验（默认 '4.1.0'）
}

// ── 产出 ────────────────────────────────────────────────────────────────────────
export interface 墓碑条目 {
  记录键: string;
  pack_id?: string;
  原因: mod墓碑原因Type;
  诊断?: string;
}

export interface 解析结果 {
  /** 叠完的模块种子（各模块键 → partial 载荷·0 default 污染） */
  成品: Record<string, unknown>;
  /** 被拒包的确定性审计记录（AA3·禁静默丢弃） */
  _mod墓碑库: Record<string, 墓碑条目>;
  /** 按负载顺序生效的包列表 */
  生效中包集: 内容包条目Type[];
  /** 聚合内容包集哈希，直接喂 hashPresetFingerprint.生效中内容包集哈希 */
  生效中内容包集哈希: string;
}

// ── 确定性深合并（无 Date/random/副作用·对象递归展开·数组/叶节点后载覆盖） ───
function deepMerge(base: unknown, next: unknown): unknown {
  if (
    typeof base === 'object' && base !== null && !Array.isArray(base) &&
    typeof next === 'object' && next !== null && !Array.isArray(next)
  ) {
    const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const [k, v] of Object.entries(next as Record<string, unknown>)) {
      result[k] = k in result ? deepMerge(result[k], v) : v;
    }
    return result;
  }
  return next; // 数组/叶节点：后载覆盖先载
}

// ── 旧轨叠加（不走 种子视图·直接 deep merge·双轨等价验收基准） ─────────────────
export function 旧轨叠加(
  base: Record<string, unknown>,
  新数据: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!新数据) return { ...base };
  return deepMerge(base, 新数据) as Record<string, unknown>;
}

// ── 新轨叠加（经 种子视图 解析后 deep merge·0 default 污染·与旧轨等价） ─────────
function 新轨叠加(
  base: Record<string, unknown>,
  模块种子: Record<string, unknown>,
): Record<string, unknown> {
  const shape = RootSchema.shape;
  let result: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(模块种子)) {
    if (!(k in shape)) continue;
    // 种子视图 passthrough → 解析结果与输入逐位恒等（幂等·断言⑤）
    const seedSchema = 种子视图(shape[k as keyof typeof shape]);
    const parsed = seedSchema.safeParse(v);
    const value = parsed.success ? parsed.data : v;
    result = deepMerge(result, { [k]: value }) as Record<string, unknown>;
  }
  return result;
}

// ── 三层校验 + 双轨 resolve ──────────────────────────────────────────────────────
/**
 * resolve(薄清单, 内容包库) → 解析结果
 *
 * 三层校验：
 *   ① 单包（拼装前）：key===pack_id · 基底契约 semver · 轨道一致性（轻轨禁可写键）
 *   ② 拼装（跨包）：computeLoadOrder → 自环/依赖被拒/冲突 → 确定性进墓碑库
 *   ③ 成品（拼装后）：聚合生效中内容包集哈希 → 可直接喂 hashPresetFingerprint
 *
 * 新轨（模块键路由·种子视图解析）优先；旧轨叠加()提供等价基准供双轨验收。
 */
export function resolve(manifest: 薄清单, library: 内容包库Type): 解析结果 {
  const BASE_VERSION = manifest.基底版本 ?? '4.1.0';
  const 墓碑库: Record<string, 墓碑条目> = {};

  // ── Layer 1: 单包校验 ────────────────────────────────────────────────────────
  const registry: ModRegistry = {};

  for (let i = 0; i < manifest.packs.length; i++) {
    const packId = manifest.packs[i]!;
    const pack = library[packId];
    if (!pack) continue;  // 不在库中 → 静默跳过（不入墓碑·后续 computeLoadOrder 处理悬空依赖）

    // key === pack_id（对齐 memory.ts:342 mod注册表 superRefine）
    if (pack.pack_id !== packId) {
      墓碑库[packId] = {
        记录键: packId,
        pack_id: pack.pack_id,
        原因: 'key不等pack_id',
        诊断: `library key "${packId}" ≠ pack_id "${pack.pack_id}"`,
      };
      continue;
    }

    // 基底契约 semver（仅当字段有值时校验）
    const 基底契约 = (pack as unknown as { 基底契约?: string }).基底契约;
    if (基底契约 && 基底契约 !== '') {
      let semverOk = false;
      try { semverOk = satisfies(BASE_VERSION, 基底契约); } catch { semverOk = false; }
      if (!semverOk) {
        墓碑库[packId] = {
          记录键: packId,
          pack_id: pack.pack_id,
          原因: 'semver不兼容',
          诊断: `基底契约「${基底契约}」与当前版本「${BASE_VERSION}」不兼容`,
        };
        continue;
      }
    }

    // 轨道一致性：轻轨禁带可写键（对齐 memory.ts:328 mod条目 superRefine）
    const 轨道 = (pack as unknown as { 轨道?: string }).轨道;
    const 可写键 = (pack as unknown as { 可写键?: string[] }).可写键;
    if (轨道 && 轨道 !== 'gameplay' && (可写键?.length ?? 0) > 0) {
      墓碑库[packId] = {
        记录键: packId,
        pack_id: pack.pack_id,
        原因: '其他',
        诊断: `轨道「${轨道}」为轻轨，禁带可写键`,
      };
      continue;
    }

    registry[packId] = {
      依赖: pack.依赖,
      pack_id: pack.pack_id,
      启用: true,
      优先级: i,   // manifest 位置 = 优先级（后列覆盖先列·后载覆盖先载）
      冲突: pack.冲突 ?? [],
    };
  }

  // ── Layer 2: 跨包校验（computeLoadOrder） ───────────────────────────────────
  const loadResult = computeLoadOrder(registry);

  // 自环 → 墓碑（exactOptionalPropertyTypes：pack_id 仅在已知时写入）
  for (const key of loadResult.graph.selfLoops) {
    if (!墓碑库[key]) {
      const pid = registry[key]?.pack_id;
      墓碑库[key] = pid !== undefined
        ? { 记录键: key, pack_id: pid, 原因: '自环' }
        : { 记录键: key, 原因: '自环' };
    }
  }

  // 依赖被拒（级联）→ 墓碑
  for (const key of loadResult.rejected) {
    if (!墓碑库[key]) {
      const pid = registry[key]?.pack_id;
      墓碑库[key] = pid !== undefined
        ? { 记录键: key, pack_id: pid, 原因: '依赖被拒' }
        : { 记录键: key, 原因: '依赖被拒' };
    }
  }

  // 冲突 → 后者（b 端）入墓碑（codepoint-larger key 失败）
  for (const conflict of loadResult.conflicts) {
    if (!墓碑库[conflict.b]) {
      const pid = registry[conflict.b]?.pack_id;
      const base = { 记录键: conflict.b, 原因: '冲突' as const, 诊断: `与「${conflict.a}」冲突` };
      墓碑库[conflict.b] = pid !== undefined ? { ...base, pack_id: pid } : base;
    }
  }

  // ── Layer 3: 新轨叠加 → canonical 成品 ──────────────────────────────────────
  let 成品: Record<string, unknown> = {};
  const 生效中包集: 内容包条目Type[] = [];

  for (const packId of loadResult.flattenedLoadOrder) {
    if (墓碑库[packId]) continue;
    const pack = library[packId];
    if (!pack) continue;
    if (pack.模块种子) {
      成品 = 新轨叠加(成品, pack.模块种子 as Record<string, unknown>);
    }
    生效中包集.push(pack);
  }

  // Layer 3 最终：聚合生效中内容包集哈希（喂 hashPresetFingerprint）
  // 仅传入有值的条目（exactOptionalPropertyTypes 不允许 content_hash: undefined）
  const 生效中内容包集哈希 = 聚合生效中内容包集哈希(
    生效中包集.map(p => p.内容哈希 !== undefined ? { content_hash: p.内容哈希 } : {}),
  );

  return { 成品, _mod墓碑库: 墓碑库, 生效中包集, 生效中内容包集哈希 };
}
