// P0-8 Batch 4: AOHP option_id — Action Option Hash Primary key
//
// セマンティックキー: verb:targetEntityId:canonicalSalientArgs
// 確定性邊界（拍板②）：option_id 進指纹（与 computeDelta 同律·additive-only）
//   → 调用方将 sortedOptionIds(options) 排序后传入 hashPresetFingerprint 的 'AOHP選項id集'
//
// 同义归一：verb+target+canonicalArgs 相同 → 合并为一项（保留首个·消除意图重复）
// 碰撞消歧：归一后同键但 canonical payload 不同
//            → 追加 '#' + hashCanonical(semanticFields) 8 位 hex 尾缀
//            → 只读复用 hashCanonical（rng.ts 函数体零改·additive-only）
//
// 稳定性：纯内容派生·不含菜单序号/计数·同菜单重渲染 → 同 id
// 确定性六禁继承：禁 Date.now/Math.random/localeCompare/裸 JSON.stringify/NFC normalize

import {
  extractMoneyAmounts,
  isCanonicalUnit,
  prepareNarrative,
} from './text/chineseNumber.js';
import { hashCanonical } from './rng.js';

// ── 接口定义 ───────────────────────────────────────────────────────────────────

export interface MenuOption {
  /** 动作动词（enum，如 '给钱'/'对话'/'还账'） */
  verb: string;
  /** 目标实体稳定 id（非显示名） */
  targetEntityId: string;
  /** 显著参数原始文本（金额/物品/方向；经 chineseNumber+CANONICAL_UNITS 归一） */
  salientArgs?: string;
  /** 显示标签（不纳入语义键·纯展示用） */
  displayText?: string;
  [key: string]: unknown;
}

export interface MenuOptionWithId extends MenuOption {
  option_id: string;
}

// ── 语义键工具 ──────────────────────────────────────────────────────────────────

/**
 * salientArgs 规范化（Batch 3 chineseNumber+CANONICAL_UNITS 归一·禁第二解析路径）。
 *
 * 优先：货币金额 → 提取全部规范单位金额 → 排序 → 归一为「N文」格式
 * 回退：非货币文本 → prepareNarrative（NFKC+空白折叠）后 trim
 */
function canonicalizeSalientArgs(raw: string | undefined): string {
  if (!raw || !raw.trim()) return '';

  const prepared = prepareNarrative(raw);

  // 货币金额（规范单位：文/文钱 → 统一输出为「N文」）
  const amounts = extractMoneyAmounts(prepared);
  const canonical = amounts
    .filter(a => isCanonicalUnit(a.unit))
    .sort((a, b) => a.value - b.value)
    .map(a => `${a.value}文`)
    .join('+');
  if (canonical) return canonical;

  // 非货币文本归一
  return prepared.trim();
}

/**
 * 为单个菜单选项构建语义键（基础键·不含碰撞尾缀）。
 * 纯函数 — 无随机·无 Date·无副作用。
 */
export function buildOptionId(
  verb: string,
  targetEntityId: string,
  salientArgs?: string,
): string {
  const canonical = canonicalizeSalientArgs(salientArgs);
  return canonical
    ? `${verb}:${targetEntityId}:${canonical}`
    : `${verb}:${targetEntityId}`;
}

// ── 批量菜单 option_id 分配 ───────────────────────────────────────────────────

/**
 * 为菜单选项列表分配稳定 option_id。
 *
 * 同义归一规则：
 *   baseKey 相同 + canonical payload 相同（意图重复）→ 合并·仅输出首个
 *
 * 碰撞消歧规则：
 *   baseKey 相同 + canonical payload 不同（意图不同·键碰撞）
 *   → option_id = `${baseKey}#${hashCanonical(semanticFields)}`
 *
 * 零误撞断言：最终输出的 option_id 全局唯一（测试层断言 Set.size === result.length）
 *
 * 稳定性保证：
 *   - 不包含序号/计数·纯内容派生
 *   - 同菜单同内容重渲染 → 恒相同 id
 */
export function buildMenuOptionIds(options: MenuOption[]): MenuOptionWithId[] {
  // Step 1: 预计算每个选项的基础键 + 规范化语义字段哈希
  const annotated = options.map(opt => {
    const canonicalSalient = canonicalizeSalientArgs(opt.salientArgs);
    const baseKey = canonicalSalient
      ? `${opt.verb}:${opt.targetEntityId}:${canonicalSalient}`
      : `${opt.verb}:${opt.targetEntityId}`;
    // canonical payload = 规范化后的语义字段（排除纯展示的 displayText + raw salientArgs）
    // salientArgs 替换为 canonicalSalient，确保「五文」与「5文」视为相同意图
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { displayText: _dt, salientArgs: _sa, ...restFields } = opt as Record<string, unknown>;
    const canonicalPayload = {
      verb: opt.verb,
      targetEntityId: opt.targetEntityId,
      salientArgs: canonicalSalient,
      ...restFields,
    };
    const payloadHash = hashCanonical(canonicalPayload);
    return { opt, baseKey, payloadHash };
  });

  // Step 2: 按 baseKey 分组·检测各组是否存在 payload 多样性（碰撞 vs 同义）
  const keyGroups = new Map<string, Set<string>>(); // baseKey → Set<payloadHash>
  for (const { baseKey, payloadHash } of annotated) {
    const group = keyGroups.get(baseKey) ?? new Set<string>();
    group.add(payloadHash);
    keyGroups.set(baseKey, group);
  }

  // Step 3: 分配最终 option_id
  const result: MenuOptionWithId[] = [];
  // 跟踪已输出的 (baseKey, payloadHash) 对·用于同义去重
  const emittedSynonyms = new Set<string>();

  for (const { opt, baseKey, payloadHash } of annotated) {
    const group = keyGroups.get(baseKey)!;

    if (group.size === 1) {
      // 单一 payload → 同义组·去重（仅输出首个）
      if (!emittedSynonyms.has(baseKey)) {
        emittedSynonyms.add(baseKey);
        result.push({ ...opt, option_id: baseKey });
      }
      // 后续同义项：跳过（消除意图重复）
    } else {
      // 多 payload → 碰撞消歧：追加 8 位 hex 尾缀
      result.push({ ...opt, option_id: `${baseKey}#${payloadHash}` });
    }
  }

  return result;
}

/**
 * 提取排序后的 option_id 数组（供 hashPresetFingerprint 的 'AOHP選項id集' 字段传入）。
 * 排序后纳入指纹 → 选项重排不破指纹（顺序无关·multiset 语义）。
 */
export function sortedOptionIds(options: MenuOptionWithId[]): string[] {
  return options.map(o => o.option_id).slice().sort();
}
