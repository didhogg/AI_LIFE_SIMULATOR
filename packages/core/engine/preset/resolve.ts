// PR-瘦身-A2 · resolve() 双轨并存 + 三层校验
// PR-瘦身-底座-2b · 规则库路径接线（rules 字段·规则成品·生效中规则集）
// PR-瘦身-底座-5 · 阶段C 转正（生产路径·含 shimThickPreset 兼容 shim）
// PR-瘦身-剥离③ · 7 冰箱路径 + 5 裸标量聚合（additive · dormant）
// 新轨（模块键路由 + 内容包库）优先；旧轨（直接叠加）作等价验收基准
// 纯函数·无副作用·禁 Date.now / new Date / Math.random / window / document
import { computeLoadOrder } from '../../loader/modGraph.js';
import type { ModRegistry } from '../../loader/modGraph.js';
import { satisfies } from '../../loader/semver.js';
import { 聚合生效中内容包集哈希 } from '../../interfaces/contentPackHash.js';
import type { mod墓碑原因Type } from '../../schema/memory.js';
import { 薄清单Schema } from './contentPack.js';
import type { 薄清单, 内容包条目Type, 内容包库Type } from './contentPack.js';
import type { 规则条目Type, 规则面Type, 规则库Type } from './ruleLibrary.js';
import type { UI条目Type, UI库Type } from './uiLibrary.js';
import type { 工具条目Type, 工具库Type } from '../../schema/toolLibrary.js';
import type { 成就条目Type, 成就库Type } from '../../schema/achievementLibrary.js';
import type { 物品定义条目Type, 物品库Type } from '../../schema/itemLibrary.js';
import type { 媒体定义条目Type, 媒体库Type } from '../../schema/mediaLibrary.js';
import type { 学业制式定义条目Type, 学业制式库Type } from '../../schema/academicSystemLibrary.js';
import type { 职级定义条目Type, 职级体系库Type } from '../../schema/rankSystemLibrary.js';
import type { 实体模板定义条目Type, 实体模板冰箱Type } from '../../schema/entityTemplateLibrary.js';
import type { 文风定义条目Type, 文风冰箱Type } from '../../schema/narrativeStyleLibrary.js';
import type { 二审维度定义条目Type, 二审维度库Type } from '../../schema/reviewDimensionLibrary.js';
import type { 小剧场剧本定义条目Type, 小剧场剧本库Type } from '../../schema/stageScriptLibrary.js';
import type { 选项集定义条目Type, 选项集库Type } from '../../schema/optionSetLibrary.js';
// 剥离③ 新增库类型
import type { 种族模板定义条目Type, 种族模板库Type } from '../../schema/raceTemplateLibrary.js';
import type { 战术包定义条目Type, 战术包库Type } from '../../schema/tacticPackLibrary.js';
import type { 叙事分发定义条目Type, 叙事分发库Type } from '../../schema/narrativeDistributionLibrary.js';
import type { 母题词汇定义条目Type, 母题词汇库Type } from '../../schema/motifVocabularyLibrary.js';
import type { 母题配额定义条目Type, 母题配额库Type } from '../../schema/motifQuotaLibrary.js';
import type { 离场演化契约定义条目Type, 离场演化契约库Type } from '../../schema/offstageContractLibrary.js';
import type { 社会角色定义条目Type, 社会角色库Type } from '../../schema/socialRoleLibrary.js';
// 剥离③ 裸标量类型（dormant·optional·unknown·test 侧验具体形态）
import { 种子视图 } from './seedView.js';
import { RootSchema } from '../../schema/index.js';
import { 是JS保留键 } from '../../schema/governedKeySpace.js';

// ── 入参 ────────────────────────────────────────────────────────────────────────
// 薄清单 单一权威已迁至 contentPack.ts · 本地导入后 re-export 向后兼容（PR-5d）
export type { 薄清单 };
export { 薄清单Schema };

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
  /** 按 UI_ID 索引的 UI条目集合（BFS 展开·含子组件·UI库路径） */
  UI成品: Record<string, UI条目Type>;
  /** BFS 遍历顺序的生效 UI条目列表 */
  生效中UI集: UI条目Type[];
  /** 被跳过 UI_ID 的审计记录（UI库中不存在的引用） */
  _UI墓碑库: Record<string, 墓碑条目>;
  /** 按 工具ID 索引的工具条目集合（by-ID·工具库路径·dormant·不进 hashJudgmentBundle） */
  工具成品: Record<string, 工具条目Type>;
  /** 引用顺序的生效工具条目列表 */
  生效中工具集: 工具条目Type[];
  /** 被跳过 工具ID 的审计记录（工具库中不存在的引用） */
  _工具墓碑库: Record<string, 墓碑条目>;
  /** 按 成就ID 索引的成就条目集合（by-ID·成就库路径·dormant·不进 hashJudgmentBundle） */
  成就成品: Record<string, 成就条目Type>;
  /** 引用顺序的生效成就条目列表 */
  生效中成就集: 成就条目Type[];
  /** 被跳过 成就ID 的审计记录（成就库中不存在的引用） */
  _成就墓碑库: Record<string, 墓碑条目>;
  /** 按 物品ID 索引的物品定义条目集合（by-ID·物品库路径·dormant·不进 hashJudgmentBundle） */
  物品成品: Record<string, 物品定义条目Type>;
  /** 引用顺序的生效物品定义条目列表 */
  生效中物品集: 物品定义条目Type[];
  /** 被跳过 物品ID 的审计记录（物品库中不存在的引用） */
  _物品墓碑库: Record<string, 墓碑条目>;
  /** 按 媒体ID 索引的媒体定义条目集合（by-ID·媒体库路径·dormant·不进 hashJudgmentBundle） */
  媒体成品: Record<string, 媒体定义条目Type>;
  /** 引用顺序的生效媒体定义条目列表 */
  生效中媒体集: 媒体定义条目Type[];
  /** 被跳过 媒体ID 的审计记录（媒体库中不存在的引用） */
  _媒体墓碑库: Record<string, 墓碑条目>;
  /** 按 学业制式ID 索引的学业制式定义条目集合（by-ID·学业制式库路径·dormant·不进 hashJudgmentBundle） */
  学业制式成品: Record<string, 学业制式定义条目Type>;
  /** 引用顺序的生效学业制式定义条目列表 */
  生效中学业制式集: 学业制式定义条目Type[];
  /** 被跳过 学业制式ID 的审计记录 */
  _学业制式墓碑库: Record<string, 墓碑条目>;
  /** 按 职级体系ID 索引的职级定义条目集合（by-ID·职级体系库路径·dormant·不进 hashJudgmentBundle） */
  职级体系成品: Record<string, 职级定义条目Type>;
  /** 引用顺序的生效职级定义条目列表 */
  生效中职级体系集: 职级定义条目Type[];
  /** 被跳过 职级体系ID 的审计记录 */
  _职级体系墓碑库: Record<string, 墓碑条目>;
  /** 按 实体模板ID 索引的实体模板定义条目集合（by-ID·实体模板库路径·dormant·不进 hashJudgmentBundle） */
  实体模板成品: Record<string, 实体模板定义条目Type>;
  /** 引用顺序的生效实体模板定义条目列表 */
  生效中实体模板集: 实体模板定义条目Type[];
  /** 被跳过 实体模板ID 的审计记录 */
  _实体模板墓碑库: Record<string, 墓碑条目>;
  /** 按 文风ID 索引的文风定义条目集合（by-ID·文风库路径·dormant·不进 hashJudgmentBundle） */
  文风成品: Record<string, 文风定义条目Type>;
  /** 引用顺序的生效文风定义条目列表 */
  生效中文风集: 文风定义条目Type[];
  /** 被跳过 文风ID 的审计记录 */
  _文风墓碑库: Record<string, 墓碑条目>;
  /** 按 二审维度ID 索引的二审维度定义条目集合（by-ID·二审维度库路径·dormant·不进 hashJudgmentBundle） */
  二审维度成品: Record<string, 二审维度定义条目Type>;
  /** 引用顺序的生效二审维度定义条目列表 */
  生效中二审维度集: 二审维度定义条目Type[];
  /** 被跳过 二审维度ID 的审计记录 */
  _二审维度墓碑库: Record<string, 墓碑条目>;
  /** 按 小剧场剧本ID 索引的小剧场剧本定义条目集合（by-ID·小剧场剧本库路径·dormant·不进 hashJudgmentBundle） */
  小剧场剧本成品: Record<string, 小剧场剧本定义条目Type>;
  /** 引用顺序的生效小剧场剧本定义条目列表 */
  生效中小剧场剧本集: 小剧场剧本定义条目Type[];
  /** 被跳过 小剧场剧本ID 的审计记录 */
  _小剧场剧本墓碑库: Record<string, 墓碑条目>;
  /** 按 选项集ID 索引的选项集定义条目集合（by-ID·选项集库路径·dormant·不进 hashJudgmentBundle） */
  选项集成品: Record<string, 选项集定义条目Type>;
  /** 引用顺序的生效选项集定义条目列表 */
  生效中选项集集: 选项集定义条目Type[];
  /** 被跳过 选项集ID 的审计记录 */
  _选项集墓碑库: Record<string, 墓碑条目>;
  // ── 剥离③ 新增库字段（additive · dormant） ──────────────────────────────────────
  /** 按 种族ID 索引的种族模板定义条目集合（by-ID·进 hashJudgmentBundle 投影·dormant） */
  种族模板成品: Record<string, 种族模板定义条目Type>;
  生效中种族模板集: 种族模板定义条目Type[];
  _种族模板墓碑库: Record<string, 墓碑条目>;
  /** 按 战术包ID 索引的战术包定义条目集合（by-ID·不进 hashJudgmentBundle·dormant） */
  战术包成品: Record<string, 战术包定义条目Type>;
  生效中战术包集: 战术包定义条目Type[];
  _战术包墓碑库: Record<string, 墓碑条目>;
  /** 按 叙事分发ID 索引的叙事分发定义条目集合（by-ID·不进 hashJudgmentBundle·dormant） */
  叙事分发成品: Record<string, 叙事分发定义条目Type>;
  生效中叙事分发集: 叙事分发定义条目Type[];
  _叙事分发墓碑库: Record<string, 墓碑条目>;
  /** 按 母题词汇ID 索引的母题词汇定义条目集合（by-ID·不进 hashJudgmentBundle·dormant） */
  母题词汇成品: Record<string, 母题词汇定义条目Type>;
  生效中母题词汇集: 母题词汇定义条目Type[];
  _母题词汇墓碑库: Record<string, 墓碑条目>;
  /** 按 母题配额ID 索引的母题配额定义条目集合（by-ID·进 hashJudgmentBundle 投影·dormant） */
  母题配额成品: Record<string, 母题配额定义条目Type>;
  生效中母题配额集: 母题配额定义条目Type[];
  _母题配额墓碑库: Record<string, 墓碑条目>;
  /** 按 离场演化契约ID 索引的离场演化契约定义条目集合（by-ID·不进 hashJudgmentBundle·dormant·P2） */
  离场演化契约成品: Record<string, 离场演化契约定义条目Type>;
  生效中离场演化契约集: 离场演化契约定义条目Type[];
  _离场演化契约墓碑库: Record<string, 墓碑条目>;
  /** 按 社会角色ID 索引的社会角色定义条目集合（by-ID·不进存档·不进 hashJudgmentBundle·dormant） */
  社会角色成品: Record<string, 社会角色定义条目Type>;
  生效中社会角色集: 社会角色定义条目Type[];
  _社会角色墓碑库: Record<string, 墓碑条目>;
  // ── 剥离③ 裸标量聚合（last-write-wins over pack load order · dormant · optional） ─
  /** 历法皮肤 (last-write-wins · dormant · 进 hashJudgmentBundle 投影·勿直接接线) */
  聚合历法皮肤?:     unknown;
  /** 财富分档参数 (last-write-wins · dormant · 不进 hashJudgmentBundle) */
  聚合财富分档参数?: unknown;
  /** 欠债参数 (last-write-wins · dormant · 进 hashJudgmentBundle 投影·勿直接接线) */
  聚合欠债参数?:     unknown;
  /** 穿越契约 (last-write-wins · dormant · 不进 hashJudgmentBundle) */
  聚合穿越契约?:     unknown;
  /** 开局装配数据 (last-write-wins · dormant · 不进 hashJudgmentBundle) */
  聚合开局装配数据?: unknown;
  /** 経済生成規則 (last-write-wins · dormant · 不进 hashJudgmentBundle) */
  聚合経済生成規則?: unknown;
}

// ── 确定性深合并（无 Date/random/副作用·对象递归展开·数组/叶节点后载覆盖） ───
function deepMerge(base: unknown, next: unknown): unknown {
  if (
    typeof base === 'object' && base !== null && !Array.isArray(base) &&
    typeof next === 'object' && next !== null && !Array.isArray(next)
  ) {
    const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const [k, v] of Object.entries(next as Record<string, unknown>)) {
      if (是JS保留键(k)) continue;
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
export function resolve(
  manifest: 薄清单,
  library: 内容包库Type,
  ruleLib?: 规则库Type,
  uiLib?: UI库Type,
  toolLib?: 工具库Type,
  achLib?: 成就库Type,
  itemLib?: 物品库Type,
  mediaLib?: 媒体库Type,
  academicLib?: 学业制式库Type,
  rankLib?: 职级体系库Type,
  entityTplLib?: 实体模板冰箱Type,
  styleLib?: 文风冰箱Type,
  reviewDimLib?: 二审维度库Type,
  stageScriptLib?: 小剧场剧本库Type,
  optionSetLib?: 选项集库Type,
  // 剥离③ 新增（additive · dormant）
  raceTemplateLib?: 种族模板库Type,
  tacticPackLib?: 战术包库Type,
  narrativeDistLib?: 叙事分发库Type,
  motifVocabLib?: 母题词汇库Type,
  motifQuotaLib?: 母题配额库Type,
  offstageContractLib?: 离场演化契约库Type,
  socialRoleLib?: 社会角色库Type,
): 解析结果 {
  const BASE_VERSION = manifest.基底版本 ?? '4.1.0';
  const 墓碑库: Record<string, 墓碑条目> = {};

  // ── Layer 1: 单包校验 ────────────────────────────────────────────────────────
  const registry: ModRegistry = {};

  // PR-8 R-c · 双读分支：引用包 present → 用其 pack_id 列表；absent → 原 packs 路径不变
  // semver dormant·本轮只存不读·接线留后续；两路同时 present 时引用包优先、packs 忽略
  const _packIds: string[] = manifest.引用包 !== undefined
    ? manifest.引用包.map(r => r.pack_id)
    : manifest.packs;

  for (let i = 0; i < _packIds.length; i++) {
    const packId = _packIds[i]!;
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

  // ── UI库路径 ─────────────────────────────────────────────────────────────────
  // BFS 展开：从 manifest.ui[] 出发，递归收集 子组件 IDs（自有属性 guard·防原型污染）
  // dormant：不进 hashJudgmentBundle·不进指纹·渲染面专用
  const UI成品: Record<string, UI条目Type> = {};
  const 生效中UI集: UI条目Type[] = [];
  const _UI墓碑库: Record<string, 墓碑条目> = {};

  if (uiLib && manifest.ui && manifest.ui.length > 0) {
    const visited = new Set<string>();
    const queue = [...manifest.ui];

    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);

      // own-property guard（防原型链污染·constructor/__proto__ 等 → 跳过）
      if (!Object.prototype.hasOwnProperty.call(uiLib, id)) continue;
      const entry = uiLib[id];
      if (!entry) continue;

      UI成品[id] = entry;
      生效中UI集.push(entry);

      // 子组件 BFS 展开（多层嵌套·无环保护由 visited Set 守卫）
      for (const childId of entry.子组件 ?? []) {
        if (!visited.has(childId)) queue.push(childId);
      }
    }
  }

  // ── 工具库路径 ──────────────────────────────────────────────────────────────────
  // by-ID 加载：从 manifest.tools 出发，按 工具ID 直接查 toolLib（无 BFS·无子组件）
  // dormant：不进 hashJudgmentBundle·不进指纹·路由面专用
  const 工具成品: Record<string, 工具条目Type> = {};
  const 生效中工具集: 工具条目Type[] = [];
  const _工具墓碑库: Record<string, 墓碑条目> = {};

  if (toolLib && manifest.tools && manifest.tools.length > 0) {
    for (const toolId of manifest.tools) {
      // own-property guard（防原型链污染·constructor/__proto__ 等 → 跳过）
      if (!Object.prototype.hasOwnProperty.call(toolLib, toolId)) continue;
      const entry = toolLib[toolId];
      if (!entry) continue;
      工具成品[toolId] = entry;
      生效中工具集.push(entry);
    }
  }

  // ── 成就库路径 ──────────────────────────────────────────────────────────────────
  // by-ID 加载：从 manifest.achievements 出发，按 成就ID 直接查 achLib（无 BFS·无子组件）
  // dormant：不进 hashJudgmentBundle·不进指纹·定义层专用·解锁求值接线留 P0-6
  const 成就成品: Record<string, 成就条目Type> = {};
  const 生效中成就集: 成就条目Type[] = [];
  const _成就墓碑库: Record<string, 墓碑条目> = {};

  if (achLib && manifest.achievements && manifest.achievements.length > 0) {
    for (const achId of manifest.achievements) {
      // own-property guard（防原型链污染·constructor/__proto__ 等 → 跳过）
      if (!Object.prototype.hasOwnProperty.call(achLib, achId)) continue;
      const entry = achLib[achId];
      if (!entry) continue;
      成就成品[achId] = entry;
      生效中成就集.push(entry);
    }
  }

  // ── 物品库路径 ──────────────────────────────────────────────────────────────────
  // by-ID 加载：从 manifest.items 出发，按 物品ID 直接查 itemLib（无 BFS·无子组件）
  // dormant：不进 hashJudgmentBundle·不进指纹·定义层专用·actor 端运行期实例不受影响
  const 物品成品: Record<string, 物品定义条目Type> = {};
  const 生效中物品集: 物品定义条目Type[] = [];
  const _物品墓碑库: Record<string, 墓碑条目> = {};

  if (itemLib && manifest.items && manifest.items.length > 0) {
    for (const itemId of manifest.items) {
      // own-property guard（防原型链污染·constructor/__proto__ 等 → 跳过）
      if (!Object.prototype.hasOwnProperty.call(itemLib, itemId)) continue;
      const entry = itemLib[itemId];
      if (!entry) continue;
      物品成品[itemId] = entry;
      生效中物品集.push(entry);
    }
  }

  // ── 媒体库路径 ──────────────────────────────────────────────────────────────────
  // by-ID 加载：从 manifest.media 出发，按 媒体ID 直接查 mediaLib（无 BFS·无子组件）
  // dormant：不进 hashJudgmentBundle·不进指纹·渲染面+传播面占位专用
  const 媒体成品: Record<string, 媒体定义条目Type> = {};
  const 生效中媒体集: 媒体定义条目Type[] = [];
  const _媒体墓碑库: Record<string, 墓碑条目> = {};

  if (mediaLib && manifest.media && manifest.media.length > 0) {
    for (const mediaId of manifest.media) {
      // own-property guard（防原型链污染·constructor/__proto__ 等 → 跳过）
      if (!Object.prototype.hasOwnProperty.call(mediaLib, mediaId)) continue;
      const entry = mediaLib[mediaId];
      if (!entry) continue;
      媒体成品[mediaId] = entry;
      生效中媒体集.push(entry);
    }
  }

  // ── 学业制式库路径 ────────────────────────────────────────────────────────────────
  // by-ID 加载：从 manifest.学业制式 出发，按 学业制式ID 直接查 academicLib（无 BFS·无子组件）
  // dormant：不进 hashJudgmentBundle·不进指纹·定义层专用
  const 学业制式成品: Record<string, 学业制式定义条目Type> = {};
  const 生效中学业制式集: 学业制式定义条目Type[] = [];
  const _学业制式墓碑库: Record<string, 墓碑条目> = {};

  if (academicLib && manifest.学业制式 && manifest.学业制式.length > 0) {
    for (const id of manifest.学业制式) {
      // own-property guard（防原型链污染·constructor/__proto__ 等 → 跳过）
      if (!Object.prototype.hasOwnProperty.call(academicLib, id)) continue;
      const entry = academicLib[id];
      if (!entry) continue;
      学业制式成品[id] = entry;
      生效中学业制式集.push(entry);
    }
  }

  // ── 职级体系库路径 ────────────────────────────────────────────────────────────────
  // by-ID 加载：从 manifest.职级体系 出发，按 职级体系ID 直接查 rankLib（无 BFS·无子组件）
  // dormant：不进 hashJudgmentBundle·不进指纹·定义层专用
  const 职级体系成品: Record<string, 职级定义条目Type> = {};
  const 生效中职级体系集: 职级定义条目Type[] = [];
  const _职级体系墓碑库: Record<string, 墓碑条目> = {};

  if (rankLib && manifest.职级体系 && manifest.职级体系.length > 0) {
    for (const id of manifest.职级体系) {
      // own-property guard（防原型链污染·constructor/__proto__ 等 → 跳过）
      if (!Object.prototype.hasOwnProperty.call(rankLib, id)) continue;
      const entry = rankLib[id];
      if (!entry) continue;
      职级体系成品[id] = entry;
      生效中职级体系集.push(entry);
    }
  }

  // ── 实体模板库路径 ────────────────────────────────────────────────────────────────
  // by-ID 加载：从 manifest.实体模板 出发，按 实体模板ID 直接查 entityTplLib（无 BFS·无子组件）
  // dormant：不进 hashJudgmentBundle·不进指纹·黑洞面（NPC/组织 opaque·无物品模板）
  const 实体模板成品: Record<string, 实体模板定义条目Type> = {};
  const 生效中实体模板集: 实体模板定义条目Type[] = [];
  const _实体模板墓碑库: Record<string, 墓碑条目> = {};

  if (entityTplLib && manifest.实体模板 && manifest.实体模板.length > 0) {
    for (const id of manifest.实体模板) {
      // own-property guard（防原型链污染·constructor/__proto__ 等 → 跳过）
      if (!Object.prototype.hasOwnProperty.call(entityTplLib, id)) continue;
      const entry = entityTplLib[id];
      if (!entry) continue;
      实体模板成品[id] = entry;
      生效中实体模板集.push(entry);
    }
  }

  // ── 文风库路径 ────────────────────────────────────────────────────────────────────
  // by-ID 加载：从 manifest.文风 出发，按 文风ID 直接查 styleLib（无 BFS·无子组件）
  // dormant：不进 hashJudgmentBundle·不进指纹·渲染面 opaque 专用
  const 文风成品: Record<string, 文风定义条目Type> = {};
  const 生效中文风集: 文风定义条目Type[] = [];
  const _文风墓碑库: Record<string, 墓碑条目> = {};

  if (styleLib && manifest.文风 && manifest.文风.length > 0) {
    for (const id of manifest.文风) {
      // own-property guard（防原型链污染·constructor/__proto__ 等 → 跳过）
      if (!Object.prototype.hasOwnProperty.call(styleLib, id)) continue;
      const entry = styleLib[id];
      if (!entry) continue;
      文风成品[id] = entry;
      生效中文风集.push(entry);
    }
  }

  // ── 二审维度库路径 ────────────────────────────────────────────────────────────────
  // by-ID 加载：从 manifest.二审维度 出发，按 二审维度ID 直接查 reviewDimLib（无 BFS·无子组件）
  // dormant：不进 hashJudgmentBundle·不进指纹·事实层（检测方式/越界类型 typed）
  const 二审维度成品: Record<string, 二审维度定义条目Type> = {};
  const 生效中二审维度集: 二审维度定义条目Type[] = [];
  const _二审维度墓碑库: Record<string, 墓碑条目> = {};

  if (reviewDimLib && manifest.二审维度 && manifest.二审维度.length > 0) {
    for (const id of manifest.二审维度) {
      // own-property guard（防原型链污染·constructor/__proto__ 等 → 跳过）
      if (!Object.prototype.hasOwnProperty.call(reviewDimLib, id)) continue;
      const entry = reviewDimLib[id];
      if (!entry) continue;
      二审维度成品[id] = entry;
      生效中二审维度集.push(entry);
    }
  }

  // ── 小剧场剧本库路径 ──────────────────────────────────────────────────────────────
  // by-ID 加载：从 manifest.小剧场剧本 出发，按 小剧场剧本ID 直接查 stageScriptLib（无 BFS·无子组件）
  // dormant：不进 hashJudgmentBundle·不进指纹·渲染面 opaque 专用
  const 小剧场剧本成品: Record<string, 小剧场剧本定义条目Type> = {};
  const 生效中小剧场剧本集: 小剧场剧本定义条目Type[] = [];
  const _小剧场剧本墓碑库: Record<string, 墓碑条目> = {};

  if (stageScriptLib && manifest.小剧场剧本 && manifest.小剧场剧本.length > 0) {
    for (const id of manifest.小剧场剧本) {
      // own-property guard（防原型链污染·constructor/__proto__ 等 → 跳过）
      if (!Object.prototype.hasOwnProperty.call(stageScriptLib, id)) continue;
      const entry = stageScriptLib[id];
      if (!entry) continue;
      小剧场剧本成品[id] = entry;
      生效中小剧场剧本集.push(entry);
    }
  }

  // ── 选项集库路径 ──────────────────────────────────────────────────────────────────
  // by-ID 加载：从 manifest.选项集 出发，按 选项集ID 直接查 optionSetLib（无 BFS·无子组件）
  // dormant：不进 hashJudgmentBundle·不进指纹·动词选项条目 by-set 组织·调用方经 投影选项集库() 回填 动词选项集
  const 选项集成品: Record<string, 选项集定义条目Type> = {};
  const 生效中选项集集: 选项集定义条目Type[] = [];
  const _选项集墓碑库: Record<string, 墓碑条目> = {};

  if (optionSetLib && manifest.选项集 && manifest.选项集.length > 0) {
    for (const id of manifest.选项集) {
      // own-property guard（防原型链污染·constructor/__proto__ 等 → 跳过）
      if (!Object.prototype.hasOwnProperty.call(optionSetLib, id)) continue;
      const entry = optionSetLib[id];
      if (!entry) continue;
      选项集成品[id] = entry;
      生效中选项集集.push(entry);
    }
  }

  // ── 剥离③ 新增 by-ID 库路径（additive · dormant） ──────────────────────────────

  // ── 种族模板库路径 ─────────────────────────────────────────────────────────────────
  // 进 hashJudgmentBundle·调用方经 投影种族模板库() 回填 种族模板参数·dormant
  const 种族模板成品: Record<string, 种族模板定义条目Type> = {};
  const 生效中种族模板集: 种族模板定义条目Type[] = [];
  const _种族模板墓碑库: Record<string, 墓碑条目> = {};

  if (raceTemplateLib && manifest.种族模板 && manifest.种族模板.length > 0) {
    for (const id of manifest.种族模板) {
      if (!Object.prototype.hasOwnProperty.call(raceTemplateLib, id)) continue;
      const entry = raceTemplateLib[id];
      if (!entry) continue;
      种族模板成品[id] = entry;
      生效中种族模板集.push(entry);
    }
  }

  // ── 战术包库路径 ───────────────────────────────────────────────────────────────────
  // 不进 hashJudgmentBundle·dormant·战斗辅助
  const 战术包成品: Record<string, 战术包定义条目Type> = {};
  const 生效中战术包集: 战术包定义条目Type[] = [];
  const _战术包墓碑库: Record<string, 墓碑条目> = {};

  if (tacticPackLib && manifest.战术包 && manifest.战术包.length > 0) {
    for (const id of manifest.战术包) {
      if (!Object.prototype.hasOwnProperty.call(tacticPackLib, id)) continue;
      const entry = tacticPackLib[id];
      if (!entry) continue;
      战术包成品[id] = entry;
      生效中战术包集.push(entry);
    }
  }

  // ── 叙事分发库路径 ─────────────────────────────────────────────────────────────────
  // 不进 hashJudgmentBundle·dormant·叙事面
  const 叙事分发成品: Record<string, 叙事分发定义条目Type> = {};
  const 生效中叙事分发集: 叙事分发定义条目Type[] = [];
  const _叙事分发墓碑库: Record<string, 墓碑条目> = {};

  if (narrativeDistLib && manifest.叙事分发 && manifest.叙事分发.length > 0) {
    for (const id of manifest.叙事分发) {
      if (!Object.prototype.hasOwnProperty.call(narrativeDistLib, id)) continue;
      const entry = narrativeDistLib[id];
      if (!entry) continue;
      叙事分发成品[id] = entry;
      生效中叙事分发集.push(entry);
    }
  }

  // ── 母题词汇库路径 ─────────────────────────────────────────────────────────────────
  // 不进 hashJudgmentBundle·dormant·叙事面词汇
  const 母题词汇成品: Record<string, 母题词汇定义条目Type> = {};
  const 生效中母题词汇集: 母题词汇定义条目Type[] = [];
  const _母题词汇墓碑库: Record<string, 墓碑条目> = {};

  if (motifVocabLib && manifest.母题词汇 && manifest.母题词汇.length > 0) {
    for (const id of manifest.母题词汇) {
      if (!Object.prototype.hasOwnProperty.call(motifVocabLib, id)) continue;
      const entry = motifVocabLib[id];
      if (!entry) continue;
      母题词汇成品[id] = entry;
      生效中母题词汇集.push(entry);
    }
  }

  // ── 母题配额库路径 ─────────────────────────────────────────────────────────────────
  // 进 hashJudgmentBundle·调用方经 投影母题配额库() 回填 母题配额参数·dormant
  const 母题配额成品: Record<string, 母题配额定义条目Type> = {};
  const 生效中母题配额集: 母题配额定义条目Type[] = [];
  const _母题配额墓碑库: Record<string, 墓碑条目> = {};

  if (motifQuotaLib && manifest.母题配额 && manifest.母题配额.length > 0) {
    for (const id of manifest.母题配额) {
      if (!Object.prototype.hasOwnProperty.call(motifQuotaLib, id)) continue;
      const entry = motifQuotaLib[id];
      if (!entry) continue;
      母题配额成品[id] = entry;
      生效中母题配额集.push(entry);
    }
  }

  // ── 离场演化契约库路径 ─────────────────────────────────────────────────────────────
  // 不进 hashJudgmentBundle·dormant·P2 offstageSettler consumer
  const 离场演化契约成品: Record<string, 离场演化契约定义条目Type> = {};
  const 生效中离场演化契约集: 离场演化契约定义条目Type[] = [];
  const _离场演化契约墓碑库: Record<string, 墓碑条目> = {};

  if (offstageContractLib && manifest.离场演化契约 && manifest.离场演化契约.length > 0) {
    for (const id of manifest.离场演化契约) {
      if (!Object.prototype.hasOwnProperty.call(offstageContractLib, id)) continue;
      const entry = offstageContractLib[id];
      if (!entry) continue;
      离场演化契约成品[id] = entry;
      生效中离场演化契约集.push(entry);
    }
  }

  // ── 社会角色库路径 ─────────────────────────────────────────────────────────────────
  // 不进存档·不进 hashJudgmentBundle·dormant·合并旧三表
  const 社会角色成品: Record<string, 社会角色定义条目Type> = {};
  const 生效中社会角色集: 社会角色定义条目Type[] = [];
  const _社会角色墓碑库: Record<string, 墓碑条目> = {};

  if (socialRoleLib && manifest.社会角色 && manifest.社会角色.length > 0) {
    for (const id of manifest.社会角色) {
      if (!Object.prototype.hasOwnProperty.call(socialRoleLib, id)) continue;
      const entry = socialRoleLib[id];
      if (!entry) continue;
      社会角色成品[id] = entry;
      生效中社会角色集.push(entry);
    }
  }

  // ── 剥离③ 裸标量聚合（last-write-wins over pack load order · dormant） ────────────
  // 扫 生效中包集（已按 computeLoadOrder 排序）·取最后声明该字段的包的值
  let 聚合历法皮肤:     unknown = undefined;
  let 聚合财富分档参数: unknown = undefined;
  let 聚合欠债参数:     unknown = undefined;
  let 聚合穿越契约:     unknown = undefined;
  let 聚合开局装配数据: unknown = undefined;
  let 聚合経済生成規則: unknown = undefined;

  for (const pack of 生效中包集) {
    const p = pack as Record<string, unknown>;
    if (p['历法皮肤']     !== undefined) 聚合历法皮肤     = p['历法皮肤'];
    if (p['财富分档参数'] !== undefined) 聚合财富分档参数 = p['财富分档参数'];
    if (p['欠债参数']     !== undefined) 聚合欠债参数     = p['欠债参数'];
    if (p['穿越契约']     !== undefined) 聚合穿越契约     = p['穿越契约'];
    if (p['开局装配数据'] !== undefined) 聚合开局装配数据 = p['开局装配数据'];
    if (p['経済生成規則'] !== undefined) 聚合経済生成規則 = p['経済生成規則'];
  }

  return {
    成品, _mod墓碑库: 墓碑库, 生效中包集, 生效中内容包集哈希,
    规则成品, 生效中规则集, _规则墓碑库,
    UI成品, 生效中UI集, _UI墓碑库,
    工具成品, 生效中工具集, _工具墓碑库,
    成就成品, 生效中成就集, _成就墓碑库,
    物品成品, 生效中物品集, _物品墓碑库,
    媒体成品, 生效中媒体集, _媒体墓碑库,
    学业制式成品, 生效中学业制式集, _学业制式墓碑库,
    职级体系成品, 生效中职级体系集, _职级体系墓碑库,
    实体模板成品, 生效中实体模板集, _实体模板墓碑库,
    文风成品, 生效中文风集, _文风墓碑库,
    二审维度成品, 生效中二审维度集, _二审维度墓碑库,
    小剧场剧本成品, 生效中小剧场剧本集, _小剧场剧本墓碑库,
    选项集成品, 生效中选项集集, _选项集墓碑库,
    // 剥离③
    种族模板成品, 生效中种族模板集, _种族模板墓碑库,
    战术包成品, 生效中战术包集, _战术包墓碑库,
    叙事分发成品, 生效中叙事分发集, _叙事分发墓碑库,
    母题词汇成品, 生效中母题词汇集, _母题词汇墓碑库,
    母题配额成品, 生效中母题配额集, _母题配额墓碑库,
    离场演化契约成品, 生效中离场演化契约集, _离场演化契约墓碑库,
    社会角色成品, 生效中社会角色集, _社会角色墓碑库,
    ...(聚合历法皮肤     !== undefined ? { 聚合历法皮肤 }     : {}),
    ...(聚合财富分档参数 !== undefined ? { 聚合财富分档参数 } : {}),
    ...(聚合欠债参数     !== undefined ? { 聚合欠债参数 }     : {}),
    ...(聚合穿越契约     !== undefined ? { 聚合穿越契约 }     : {}),
    ...(聚合开局装配数据 !== undefined ? { 聚合开局装配数据 } : {}),
    ...(聚合経済生成規則 !== undefined ? { 聚合経済生成規則 } : {}),
  };
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
  // PR-8 R-c · 透传引用包（只认 array·逐字搬运·不校验内容·缺省不写入）
  const 引用包Raw = oldPreset['引用包'];

  const manifest: 薄清单 = {
    packs: 薄packs,
    ...(薄rules.length > 0 ? { rules: 薄rules } : {}),
    ...(Array.isArray(引用包Raw) ? { 引用包: 引用包Raw as NonNullable<薄清单['引用包']> } : {}),
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
