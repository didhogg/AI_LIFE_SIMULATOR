// PR-瘦身-A2 · resolve() 双轨并存 + 三层校验
// PR-瘦身-底座-2b · 规则库路径接线（rules 字段·规则成品·生效中规则集）
// PR-瘦身-底座-5 · 阶段C 转正（生产路径·含 shimThickPreset 兼容 shim）
// 新轨（模块键路由 + 内容包库）优先；旧轨（直接叠加）作等价验收基准
// 纯函数·无副作用·禁 Date.now / new Date / Math.random / window / document
import { computeLoadOrder } from '../../loader/modGraph.js';
import type { ModRegistry } from '../../loader/modGraph.js';
import { satisfies } from '../../loader/semver.js';
import { 聚合生效中内容包集哈希 } from '../../interfaces/contentPackHash.js';
import type { mod墓碑原因Type } from '../../schema/memory.js';
import type { 内容包条目Type, 内容包库Type } from './contentPack.js';
import type { 规则条目Type, 规则面Type, 规则库Type } from './ruleLibrary.js';
import { 种子视图 } from './seedView.js';
import { RootSchema } from '../../schema/index.js';

// ── 入参 ────────────────────────────────────────────────────────────────────────
/** 薄清单 = 引用包列表（按引用顺序）+ 可选基底版本（默认 '4.1.0'） */
export interface 薄清单 {
  packs: string[];        // 引用顺序 pack_id 列表（优先级无声明则按顺序后载覆盖先载）
  rules?: string[];       // 规则引用列表（按引用顺序·后列覆盖先载·底座-2b）
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
  /** 规则面叠加结果（规则库路径·底座-2b） */
  规则成品: Record<string, unknown>;
  /** 按负载顺序生效的规则条目列表 */
  生效中规则集: 规则条目Type[];
  /** 被拒规则的确定性审计记录 */
  _规则墓碑库: Record<string, 墓碑条目>;
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
export function resolve(manifest: 薄清单, library: 内容包库Type, ruleLib?: 规则库Type): 解析结果 {
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

  // ── 规则库路径（底座-2b）————————————————————————————————————————————————————
  let 规则成品: Record<string, unknown> = {};
  const 生效中规则集: 规则条目Type[] = [];
  const _规则墓碑库: Record<string, 墓碑条目> = {};

  if (ruleLib && manifest.rules && manifest.rules.length > 0) {
    // ── 规则 Layer 1: 单条目校验 ─────────────────────────────────────────────
    const ruleRegistry: ModRegistry = {};

    for (let i = 0; i < manifest.rules.length; i++) {
      const ruleId = manifest.rules[i]!;
      const rule = ruleLib[ruleId];
      if (!rule) continue;

      // key === rule_id（对齐 内容包库 key===pack_id 语义）
      if (rule.rule_id !== ruleId) {
        _规则墓碑库[ruleId] = {
          记录键: ruleId,
          pack_id: rule.rule_id,
          原因: 'key不等pack_id',
          诊断: `library key "${ruleId}" ≠ rule_id "${rule.rule_id}"`,
        };
        continue;
      }

      // 基底契约 semver
      const 基底契约r = (rule as unknown as { 基底契约?: string }).基底契约;
      if (基底契约r && 基底契约r !== '') {
        let ok = false;
        try { ok = satisfies(BASE_VERSION, 基底契约r); } catch { ok = false; }
        if (!ok) {
          _规则墓碑库[ruleId] = {
            记录键: ruleId,
            pack_id: rule.rule_id,
            原因: 'semver不兼容',
            诊断: `基底契约「${基底契约r}」与当前版本「${BASE_VERSION}」不兼容`,
          };
          continue;
        }
      }

      // 轨道一致性：轻轨禁带可写键
      const 轨道r = (rule as unknown as { 轨道?: string }).轨道;
      const 可写键r = (rule as unknown as { 可写键?: string[] }).可写键;
      if (轨道r && 轨道r !== 'gameplay' && (可写键r?.length ?? 0) > 0) {
        _规则墓碑库[ruleId] = {
          记录键: ruleId,
          pack_id: rule.rule_id,
          原因: '其他',
          诊断: `轨道「${轨道r}」为轻轨，禁带可写键`,
        };
        continue;
      }

      ruleRegistry[ruleId] = {
        依赖: rule.依赖,
        pack_id: rule.rule_id,
        启用: true,
        优先级: i,
        冲突: rule.冲突 ?? [],
      };
    }

    // ── 规则 Layer 2: 跨条目校验（computeLoadOrder） ─────────────────────────
    const ruleLoadResult = computeLoadOrder(ruleRegistry);

    for (const key of ruleLoadResult.graph.selfLoops) {
      if (!_规则墓碑库[key]) {
        const pid = ruleRegistry[key]?.pack_id;
        _规则墓碑库[key] = pid !== undefined
          ? { 记录键: key, pack_id: pid, 原因: '自环' }
          : { 记录键: key, 原因: '自环' };
      }
    }

    for (const key of ruleLoadResult.rejected) {
      if (!_规则墓碑库[key]) {
        const pid = ruleRegistry[key]?.pack_id;
        _规则墓碑库[key] = pid !== undefined
          ? { 记录键: key, pack_id: pid, 原因: '依赖被拒' }
          : { 记录键: key, 原因: '依赖被拒' };
      }
    }

    for (const conflict of ruleLoadResult.conflicts) {
      if (!_规则墓碑库[conflict.b]) {
        const pid = ruleRegistry[conflict.b]?.pack_id;
        const base = { 记录键: conflict.b, 原因: '冲突' as const, 诊断: `与「${conflict.a}」冲突` };
        _规则墓碑库[conflict.b] = pid !== undefined ? { ...base, pack_id: pid } : base;
      }
    }

    // ── 规则 Layer 3: 规则面叠加 → 规则成品 ──────────────────────────────────
    for (const ruleId of ruleLoadResult.flattenedLoadOrder) {
      if (_规则墓碑库[ruleId]) continue;
      const rule = ruleLib[ruleId];
      if (!rule) continue;
      if (rule.规则面) {
        规则成品 = deepMerge(规则成品, rule.规则面) as Record<string, unknown>;
      }
      生效中规则集.push(rule);
    }
  }

  return { 成品, _mod墓碑库: 墓碑库, 生效中包集, 生效中内容包集哈希, 规则成品, 生效中规则集, _规则墓碑库 };
}

// ── shimThickPreset — 厚预设存档 shim（C2 确定性迁移工具）────────────────────────
// 将含内联规则字段的旧格式预设 object 转为 {薄清单, 规则库条目}
// 调用方再: resolve(shim.manifest, {}, shim.ruleLib) → 规则成品 与旧厚预设规则字段等价
// 确定性：纯函数·不访问时间/随机/DOM·输出仅依赖输入。
export const 规则字段名集: readonly string[] = [
  '难度系数组', '属性轴表', '检定配方表', '派生量配方', '赛事结构模板',
  '规则补丁', '检定骰面', '检定档切分表', '钳制表', '概率域夹逼',
  '死亡拦截器条目', '换角许可', '归并表',
] as const;

export interface ShimResult {
  manifest: 薄清单;
  ruleLib: 规则库Type;
}

/**
 * shimThickPreset(oldPreset) → {manifest, ruleLib}
 *
 * 提取厚预设内联规则字段→单条 rule_id='shim' 规则条目入规则库。
 * resolve(manifest, {}, ruleLib).规则成品 与原厚预设规则字段等价（deepMerge 语义）。
 */
export function shimThickPreset(oldPreset: Record<string, unknown>): ShimResult {
  const 规则面: Record<string, unknown> = {};
  for (const key of 规则字段名集) {
    if (key in oldPreset && oldPreset[key] !== undefined) {
      规则面[key] = oldPreset[key];
    }
  }

  const 薄packs: string[] = Array.isArray(oldPreset['packs'])
    ? (oldPreset['packs'] as string[])
    : [];
  const 薄rules: string[] = Object.keys(规则面).length > 0 ? ['shim'] : [];

  const manifest: 薄清单 = {
    packs: 薄packs,
    ...(薄rules.length > 0 ? { rules: 薄rules } : {}),
  };

  const ruleLib: 规则库Type = {};
  if (薄rules.length > 0) {
    ruleLib['shim'] = {
      rule_id: 'shim',
      版本: '0.1.0',
      名称: '',
      作者: '',
      描述: '',
      依赖: [],
      冲突: [],
      规则面: 规则面 as 规则面Type,
    };
  }

  return { manifest, ruleLib };
}
