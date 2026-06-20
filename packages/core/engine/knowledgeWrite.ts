// P7-6c · 6.60 知情类 extensional 写入口展开落账 + 消费点两类枚举表定稿
//
// 蓝图 6.60 口径:
//   知情名单写入瞬间展开为实体真键集落账(字典序)·原选择器串留 来源选择器? 字段
//   入圈唯一合法写入通道 = 事件(涟漪/告知/declassify/E1读取落账)
//   消费点两类：资格类现算(即时现算) / 落账瞬间定格
//   谓词引用规则：限深 1·环拒收
//
// 禁 Date.now / Math.random / 裸 JSON.stringify / localeCompare

// ── 消费点两类枚举表 ──────────────────────────────────────────────────────────────

/**
 * 消费点两类（6.60 枚举表·已拍板·增审7 补入「消息发信槽位」）。
 *
 * - `即时现算`：资格类现算·在消费时刻动态查询·不落账（如：检查知情资格、消息接收资格）
 * - `落账瞬间定格`：写入知情名单时快照当前实体集·落账后不再随实体变化而变（如：发信时锁定收件人）
 */
export const KNOWLEDGE_CONSUMER_TYPES = ['即时现算', '落账瞬间定格'] as const;
export type KnowledgeConsumerType = (typeof KNOWLEDGE_CONSUMER_TYPES)[number];

/**
 * 消费点注册条目（6.60 两类枚举表·含增审7「消息发信槽位」）。
 * 注册表用于 slot 级别的类型声明，不影响引擎路径（纯元数据）。
 */
export interface KnowledgeConsumerEntry {
  slotId:       string;                 // 消费点标识（如 '雇主' / '母亲' / '恋人' / '涟漪接收方'）
  consumerType: KnowledgeConsumerType;  // 两类之一
  description?: string;                 // 说明（可选）
}

/** 消费点注册表（6.60 定稿·含增审7 三槽位·可 additive 扩展） */
export const KNOWLEDGE_CONSUMER_REGISTRY: readonly KnowledgeConsumerEntry[] = [
  // 增审7 已拍板：消息发信槽位 = 资格类现算 + 发信落账瞬间定格
  { slotId: '雇主',       consumerType: '即时现算',     description: '雇主资格：消费时现查知情名单' },
  { slotId: '母亲',       consumerType: '即时现算',     description: '母亲资格：消费时现查知情名单' },
  { slotId: '恋人',       consumerType: '即时现算',     description: '恋人资格：消费时现查知情名单' },
  { slotId: '发信落账',   consumerType: '落账瞬间定格', description: '书信发出时刻快照·锁定收件人集合' },
  // 入圈四通道（蓝图 6.60·唯一合法写入点）
  { slotId: '涟漪入圈',   consumerType: '落账瞬间定格', description: '涟漪传播入圈·知情棘轮·写入瞬间定格' },
  { slotId: '告知入圈',   consumerType: '落账瞬间定格', description: '显式告知动词入圈·写入瞬间定格' },
  { slotId: 'declassify', consumerType: '落账瞬间定格', description: 'declassify 事件入圈·写入瞬间定格' },
  { slotId: 'E1读取落账', consumerType: '落账瞬间定格', description: 'E1 读取媒介触发落账·写入瞬间定格' },
] as const;

// ── 入圈四通道唯一标识集 ──────────────────────────────────────────────────────────

/** 入圈唯一合法写入通道集（6.60·Q3）*/
export const KNOWLEDGE_ENTRY_CHANNELS = [
  '涟漪入圈',
  '告知入圈',
  'declassify',
  'E1读取落账',
] as const;

export type KnowledgeEntryChannel = (typeof KNOWLEDGE_ENTRY_CHANNELS)[number];

// ── extensional 展开落账（写入瞬间展开·字典序·Q1/Q2/Q4/Q6）─────────────────────

/**
 * 知情类选择器 extensional 展开。
 *
 * 规则（6.60 + 谓词引用规则）:
 *   - 字面实体键（不含 ':' 前缀）→ 直接命中（若在 allEntityKeys 中）
 *   - 通配符 '*' → 全部实体键（字典序）
 *   - 谓词前缀串（形如 'faction:X'/'tag:Y'）→ 调用方 resolver 求值（限深 1·本函数只传透）
 *   - 环拒收：expandedKeys 含自身（由调用方负责外层环检测）
 *
 * 返回确定性字典序键集（禁 localeCompare·改用 < > 比较）。
 */
export function expandKnowledgeSelector(
  selector:      string,
  allEntityKeys: readonly string[],
  predicateResolver?: (predicate: string, entityKeys: readonly string[]) => string[],
): string[] {
  if (selector === '*') {
    return allEntityKeys.slice().sort(compareStr);
  }
  // 谓词前缀（含 ':'）→ resolver 求值（限深 1）
  if (selector.includes(':') && predicateResolver) {
    const resolved = predicateResolver(selector, allEntityKeys);
    return resolved.slice().sort(compareStr);
  }
  // 字面实体键
  if (allEntityKeys.includes(selector)) {
    return [selector];
  }
  return [];
}

/** 纯字节序字符串比较（禁 localeCompare）*/
function compareStr(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

// ── 知情名单写入条目（写入瞬间展开为真键集·落账） ───────────────────────────────

/** 知情名单写入结果（展开后落账·字典序）*/
export interface KnowledgeWriteEntry {
  channel:         KnowledgeEntryChannel;       // 入圈通道（唯一合法写入点）
  expandedKeys:    string[];                    // 展开后的实体真键集（字典序）
  来源选择器?:    string | undefined;           // 原始选择器串（审计血统·可空）
  commitEpochMin:  number;                      // 落账瞬间纪元分钟（律 X 全局时刻）
  知情程度?:      number | undefined;           // 0–100
  立场?:          string | undefined;           // 死守/动摇/可能反水
}

/**
 * 知情类 extensional 写入口（Q1/Q2/Q4/Q6 通用入口）。
 *
 * 写入瞬间展开为实体真键集落账（字典序）·原选择器留 来源选择器? 审计血统。
 * 落账型 = snapshotAtCommit，即时型 = 调用方在消费时刻现查（本函数只处理落账型）。
 */
export function knowledgeWrite(
  channel:        KnowledgeEntryChannel,
  selector:       string,
  allEntityKeys:  readonly string[],
  commitEpochMin: number,
  options?: {
    predicateResolver?: (predicate: string, entityKeys: readonly string[]) => string[];
    知情程度?:          number;
    立场?:             string;
  },
): KnowledgeWriteEntry {
  const expandedKeys = expandKnowledgeSelector(selector, allEntityKeys, options?.predicateResolver);
  return {
    channel,
    expandedKeys,
    来源选择器: selector !== '*' ? selector : undefined,
    commitEpochMin,
    知情程度:    options?.知情程度,
    立场:       options?.立场,
  };
}
