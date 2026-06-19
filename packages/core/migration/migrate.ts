// Pure V3.1 → V4.1 save migration.
// No IO, no Date.now, no Math.random (ESLint bans in packages/core/).

import { RootSchema, RootSchemaStrict, type RootState, type _mod墓碑库Type, type mod墓碑条目Type } from '../schema/index.js';
import { normalizeRegistryKeyNames, assertGovernedKeysNormalized } from '../interfaces/keyNormalize.js'; // B5·读卡口(normalizeRegistryKeyNames) / B6·S1S1b 写卡口(assertGovernedKeysNormalized)
import { 是JS保留键 } from '../schema/governedKeySpace.js'; // S3·写卡口 JS保留键检查
import { computeLoadOrder } from '../loader/modGraph.js';
import { deriveModAwareWhitelist } from '../loader/modWhitelist.js';
import { coerceSemver, satisfies as semverSatisfies } from '../loader/semver.js';
import { runDryRun } from '../schema/whitelistDryRun.js';
import {
  parseChineseDateToEpochMin,
  getTickMinutes,
  makePeriodConverter,
  writeEpochMinute,
} from '../engine/time.js';

// Re-export for migration tests that import these from migrate.ts
export { parseChineseDateToEpochMin, getTickMinutes } from '../engine/time.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MigLog {
  level: 'info' | 'warn' | 'error';
  path: string;
  msg: string;
  orig?: unknown;
}

export interface MigrateResult {
  state: RootState;
  log: MigLog[];
}

/** Pre-parse result — exported so tests can assert 断言② on raw field values. */
export interface MigrateRawResult {
  raw: Record<string, unknown>;
  log: MigLog[];
}

// ── Lookup maps ───────────────────────────────────────────────────────────────

const REALISM_MAP: Record<string, number> = {
  硬核写实: 0.9, 轻度戏剧化: 0.5, 幻想掺入: 0.25, 离谱魔幻: 0.05,
};

const LOYALTY_MAP: Record<string, number> = {
  极高: 90, 稳定: 70, 一般: 50, 下滑: 30, 危险: 10,
};

const GAME_MODE_MAP: Record<string, string> = {
  CHARACTER_CREATION: 'CHARACTER_CREATE',
  SCHEDULE: 'PLAYING', TIME_ADVANCE: 'PLAYING',
  EVENT_SETTLEMENT: 'PLAYING', RP_MODE: 'PLAYING', SUMMARY: 'PLAYING',
};

const PROSPERITY_MAP: Record<string, number> = {
  萧条: 10, 低迷: 30, 平稳: 50, 繁荣: 75, 泡沫: 90,
};

// ── Time helpers ──────────────────────────────────────────────────────────────
// Implementations live in engine/time.ts (single source of truth).
// parseChineseDateToEpochMin, getTickMinutes, makePeriodConverter imported above.

// ── Coercion helpers ──────────────────────────────────────────────────────────

function asRec(v: unknown): Record<string, unknown> {
  if (typeof v === 'object' && v !== null && !Array.isArray(v))
    return v as Record<string, unknown>;
  return {};
}

function asArr(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (typeof v === 'object' && v !== null) return Object.values(v as Record<string, unknown>);
  return [];
}

function asStr(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function asNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function asBool(v: unknown, fallback = false): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'undefined') return fallback;
  return Boolean(v);
}

// ── Trait migration: 旧四天赋 union merge → 特质{} ─────────────────────────────

function normalizeTraitEntry(raw: Record<string, unknown>): Record<string, unknown> {
  const ef = asRec(raw['效果']);
  return {
    类别: asStr(raw['类别'], '后天'),
    来源: asStr(raw['来源']),
    强度: asNum(raw['强度']),
    稀有度: asStr(raw['稀有度']),
    已觉醒: typeof raw['已觉醒'] === 'number' ? raw['已觉醒'] !== 0 : asBool(raw['已觉醒'], true),
    效果: {
      属性修正: asRec(ef['属性修正']),
      成长率或上限修正: asArr(ef['成长率或上限修正']),
      检定修正: asArr(ef['检定修正']),
      事件钩子: asStr(ef['事件钩子']),
    },
  };
}

function merge特质(base: Record<string, unknown>, ...sources: Record<string, unknown>[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(base)) result[k] = normalizeTraitEntry(asRec(v));
  for (const src of sources) {
    for (const [k, v] of Object.entries(src)) {
      if (!(k in result)) result[k] = normalizeTraitEntry(asRec(v));
    }
  }
  return result;
}

// ── State label migration (约束状态 → 状态标签) ────────────────────────────────

function migrate状态标签(
  v31: Record<string, unknown>,
  约束v31: Record<string, unknown>,
  压力值: number,
  p2e: (n: number) => number,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(v31)) {
    const e = asRec(v);
    result[k] = { 效果: asArr(e['效果']), 到期: asNum(e['到期']), 来源: asStr(e['来源']) };
  }

  for (const [k, v] of Object.entries(约束v31)) {
    const e = asRec(v);
    const 到期周期 = asNum(e['到期周期'], -1);
    // -1 (永久) → 0 (0=永久哨兵, per schema annotation); >0 → p2e
    result[`V3约束_${k}`] = {
      效果: [],
      到期: 到期周期 === -1 ? 0 : (到期周期 > 0 ? p2e(到期周期) : 0),
      来源: `V3.1约束迁移·类型:${asStr(e['类型'])}·强度:${asStr(e['强度'])}`,
    };
  }

  // Pressure value → state label (fix ⑤: −min(20,round(压力值/5)) + 原值写入来源)
  if (压力值 > 0) {
    result['V3迁移_压力'] = {
      效果: [{ 通道: '心理', op: '加', 强度: -Math.min(20, Math.round(压力值 / 5)) }],
      到期: 0,
      来源: `V3.1压力值迁移·原值:${压力值}`,
    };
  }

  return result;
}

// ── NPC memory migration ──────────────────────────────────────────────────────

function migrateNpcMemory(raw: Record<string, unknown>, p2e: (n: number) => number): Record<string, unknown> {
  const 发生周期 = asNum(raw['发生周期'], 0);
  const 上次唤起周期 = asNum(raw['上次唤起周期'], -1);
  return {
    记忆id: asStr(raw['记忆id']),
    摘要: asStr(raw['摘要']),
    发生时间: 发生周期 > 0 ? p2e(发生周期) : 0,
    类型: asStr(raw['类型'], '互动'),
    情绪色彩: asStr(raw['情绪色彩']),
    重要度: asNum(raw['重要度'], 1),
    权重: asNum(raw['权重'], 50),
    永久: typeof raw['永久'] === 'number' ? raw['永久'] !== 0 : asBool(raw['永久']),
    // -1 → 0 ("never"), ≥0 → p2e (fix ④: 已故NPC内部周期也过锚定函数)
    上次唤起时间: 上次唤起周期 === -1 ? 0 : p2e(上次唤起周期),
  };
}

// ── Work memory / archive migration ──────────────────────────────────────────

function migrateWorkMemItem(raw: Record<string, unknown>, p2e: (n: number) => number): Record<string, unknown> {
  const 周期 = asNum(raw['周期'], -1);
  const 上次浮现周期 = asNum(raw['上次浮现周期'], -1);
  return {
    记忆id: asStr(raw['记忆id']),
    发生时间: 周期 === -1 ? 0 : p2e(周期),
    标题: asStr(raw['标题']),
    摘要: asStr(raw['摘要']),
    涉及人物: asStr(raw['涉及人物']),
    涉及地点: asStr(raw['涉及地点']),
    重要度: asStr(raw['重要度'], '普通'),
    关联地点: asArr(raw['关联地点']).map(x => asStr(x)),
    关联物品: asArr(raw['关联物品']).map(x => asStr(x)),
    关联意象: asArr(raw['关联意象']).map(x => asStr(x)),
    关联NPC: asArr(raw['关联NPC']).map(x => asStr(x)),
    情绪基调: asStr(raw['情绪基调']),
    思念权重: asNum(raw['思念权重']),
    权重: asNum(raw['权重'], 50),
    // -1 → 0 ("never"), ≥0 → p2e (fix ③)
    上次浮现时间: 上次浮现周期 === -1 ? 0 : p2e(上次浮现周期),
    可浮现: typeof raw['可浮现'] === 'number' ? raw['可浮现'] !== 0 : asBool(raw['可浮现'], true),
    因果: asRec(raw['因果']),
  };
}

function migrateArchiveItem(raw: Record<string, unknown>, p2e: (n: number) => number): Record<string, unknown> {
  const base = migrateWorkMemItem(raw, p2e);
  const 归档周期 = asNum(raw['归档周期'], 0);
  return { ...base, 归档时间: 归档周期 > 0 ? p2e(归档周期) : 0, 来源时间范围: asStr(raw['来源时间范围']) };
}

// ── 延时种子 migration ─────────────────────────────────────────────────────────

function migrateSeed(raw: Record<string, unknown>, p2e: (n: number) => number, log: MigLog[]): Record<string, unknown> {
  const 成熟日cycle = asNum(raw['成熟日'], -1);
  const 成熟日: number = 成熟日cycle === -1 ? 0 : p2e(成熟日cycle); // 0 = 立即成熟（无到期约束）

  // K7: preserve possible_years original in migration log
  if (raw['possible_years'] !== undefined) {
    log.push({ level: 'info', path: '延时种子.possible_years', msg: 'K7: possible_years原件存入迁移日志', orig: raw['possible_years'] });
  }

  return {
    载荷: asStr(raw['载荷']),
    类型: asStr(raw['类型'], '伏笔'),
    成熟日,
    权重: asNum(raw['权重'], 10),
    重要等级: asStr(raw['重要等级'], '中'),
    已结算标记: typeof raw['已结算标记'] === 'number' ? raw['已结算标记'] : (asBool(raw['已结算标记']) ? 1 : 0),
    幂等锚点: asStr(raw['幂等锚点']),
    冲突组: asStr(raw['冲突组']),
    冷却键: asStr(raw['冷却键']),
    可合并标签: asStr(raw['可合并标签']),
    后果层级: asStr(raw['后果层级'], '中'),
    era锚定: asStr(raw['era_label'] ?? raw['era锚定']),
    因果链id: asStr(raw['因果链id']),
    因果深度: asNum(raw['因果深度']),
    来源: {
      命名空间: asStr(asRec(raw['来源'])['命名空间']),
      包id: asStr(asRec(raw['来源'])['包id']),
      事件id: asStr(asRec(raw['来源'])['事件id']),
      模块: asStr(asRec(raw['来源'])['模块']),
    },
  };
}

// ── 彩蛋 migration ─────────────────────────────────────────────────────────────

function migrateEgg(raw: Record<string, unknown>, p2e: (n: number) => number): Record<string, unknown> {
  const 录入周期 = asNum(raw['录入周期'] ?? raw['录入时间'], -1);
  const 冷却到期周期 = asNum(raw['冷却到期周期'] ?? raw['冷却到期'], -1);
  const 上次浮现周期 = asNum(raw['上次浮现周期'] ?? raw['上次浮现时间'], -1);
  return {
    原记忆id: asStr(raw['原记忆id']),
    摘要: asStr(raw['摘要']),
    模糊钥匙: asArr(raw['模糊钥匙']).map(x => asStr(x)),
    关联地点: asArr(raw['关联地点']).map(x => asStr(x)),
    关联物品: asArr(raw['关联物品']).map(x => asStr(x)),
    关联意象: asArr(raw['关联意象']).map(x => asStr(x)),
    关联NPC: asArr(raw['关联NPC']).map(x => asStr(x)),
    情绪基调: asStr(raw['情绪基调']),
    录入时间: 录入周期 === -1 ? 0 : p2e(录入周期),
    冷却到期: 冷却到期周期 === -1 ? 0 : p2e(冷却到期周期),
    可浮现: typeof raw['可浮现'] === 'number' ? raw['可浮现'] !== 0 : asBool(raw['可浮现'], true),
    已浮现: typeof raw['已浮现'] === 'number' ? raw['已浮现'] !== 0 : asBool(raw['已浮现']),
    // -1 → 0 ("never"), ≥0 → p2e (fix ③)
    上次浮现时间: 上次浮现周期 === -1 ? 0 : p2e(上次浮现周期),
  };
}

// ── Secrets migration ─────────────────────────────────────────────────────────

function migrateSecretsToPool(
  entityKey: string,
  秘密索引: Record<string, unknown>,
  受制于: unknown[],
  秘密库: Record<string, unknown>,
  log: MigLog[],
): void {
  for (const [k, v] of Object.entries(秘密索引)) {
    const e = asRec(v);
    秘密库[`${entityKey}_${k}`] = {
      母题: asStr(e['类型'] ?? e['母题'], '未分类'),
      涉事方: [
        { 实体键: entityKey, 角色: '主谋' },
        ...(asStr(e['目标']) ? [{ 实体键: asStr(e['目标']), 角色: '目标' }] : []),
      ],
      进展: asNum(e['进展']),
      严重度: asNum(e['严重度']),
      暴露度: 0,
      $谜底: asStr(e['$谜底']),
      已暴露线索: asArr(e['已暴露线索']).map(c => ({ 线索: asStr(c), 暴露程度: 50, 状态: '存在', 关联地点键: '' })),
      知情名单: Object.entries(asRec(e['知情圈'])).map(([obj, deg]) => ({ 对象: obj, 知情程度: asNum(deg, 50), 立场: '', 掩护基调: '' })),
    };
  }

  // 受制于: write holder into 秘密库 知情名单 (fix: 持柄方也写入，不只是主角)
  for (const item of 受制于) {
    const hold = asRec(item);
    const 秘密键 = asStr(hold['秘密键'] ?? hold['把柄键']);
    const 持柄方 = asStr(hold['持柄方'] ?? hold['对象']);
    if (!持柄方) continue;
    const fullKey = `${entityKey}_${秘密键}`;
    if (fullKey in 秘密库) {
      asArr(asRec(秘密库[fullKey])['知情名单']).push({ 对象: 持柄方, 知情程度: 80, 立场: '利用', 掩护基调: '' });
    } else {
      秘密库[`${entityKey}_受制_${秘密键 || 持柄方}`] = {
        母题: '受制',
        涉事方: [{ 实体键: entityKey, 角色: '受害者' }, { 实体键: 持柄方, 角色: '主谋' }],
        进展: 0, 严重度: 50, 暴露度: 0, $谜底: '',
        已暴露线索: [],
        知情名单: [{ 对象: 持柄方, 知情程度: 80, 立场: '利用', 掩护基调: '' }],
      };
      log.push({ level: 'warn', path: `受制于.${秘密键}`, msg: '秘密键不在索引中，已创建占位条目' });
    }
  }
}

// ── 家族树 migration ───────────────────────────────────────────────────────────

function migrate家族树(
  主角键: string,
  血缘: Record<string, unknown>,
  树v31: Record<string, unknown>,
  出生日期: number,
): Record<string, unknown> {
  const 边 = { ...asRec(asRec(树v31)['边']) };
  const 幽灵节点 = { ...asRec(asRec(树v31)['幽灵节点']) };

  边[主角键] = {
    双亲边: [
      ...(asStr(血缘['父角色ID']) ? [{ parent_id: asStr(血缘['父角色ID']), 边类型: '血亲' }] : []),
      ...(asStr(血缘['母角色ID']) ? [{ parent_id: asStr(血缘['母角色ID']), 边类型: '血亲' }] : []),
    ],
    生卒: { 出生: 出生日期 },
    总评: '', 关键成就: [], 传家宝: [],
  };

  return { 边, 幽灵节点 };
}

// ── 认知档案 building ──────────────────────────────────────────────────────────

function build认知档案(
  主角键: string,
  npcV31: Record<string, unknown>,
  worldEpochMin: number,
): Record<string, unknown> {
  const 档案: Record<string, unknown> = {};
  const protagonistView: Record<string, unknown> = {};

  for (const [npcKey, npcVal] of Object.entries(npcV31)) {
    const npc = asRec(npcVal);
    const 印象: unknown[] = [];
    for (const tag of asArr(npc['标签'])) {
      const s = asStr(tag);
      if (s) 印象.push({ 标签: s, 极性: '中', 强度: 50, 来源: '迁移推定', 获知时间: writeEpochMinute(worldEpochMin), 衰减速率: 0 });
    }
    const 性格 = asStr(npc['性格']);
    if (性格) 印象.push({ 标签: 性格, 极性: '中', 强度: 50, 来源: '迁移推定', 获知时间: writeEpochMinute(worldEpochMin), 衰减速率: 0 });
    const 背景 = asStr(npc['背景']);
    if (背景) 印象.push({ 标签: 背景, 极性: '中', 强度: 30, 来源: '迁移推定', 获知时间: writeEpochMinute(worldEpochMin), 衰减速率: 0 });

    // 旧世界无姓名雾·默认已知姓名（视觉指代会让所有人变成「那个人」）
    protagonistView[npcKey] = { 了解度: Math.min(100, asNum(npc['关系深度'])), 误差表: {}, 印象, 时效: 0, 姓名知识: '已知姓名' };
  }

  if (Object.keys(protagonistView).length > 0) 档案[主角键] = protagonistView;
  return 档案;
}

// ── 货币系统 migration ────────────────────────────────────────────────────────

function migrate货币(v31: Record<string, unknown>, worldEpochMin: number, log: MigLog[]): Record<string, unknown> {
  const 市场v31 = asRec(v31['市场状态']);
  const 景气raw = 市场v31['大盘景气'];
  let 大盘景气: number;
  if (typeof 景气raw === 'number') {
    大盘景气 = 景气raw;
  } else {
    const s = asStr(景气raw);
    大盘景气 = PROSPERITY_MAP[s] ?? 50;
    if (s && !(s in PROSPERITY_MAP)) log.push({ level: 'warn', path: '货币系统.市场状态.大盘景气', msg: `未识别档位 "${s}"，落默认 50` });
  }

  const 换汇登记 = asArr(v31['换汇登记']).map(entry => {
    if (typeof entry === 'string') return { 时间: writeEpochMinute(worldEpochMin), 从: '', 到: '', 金额: 0 };
    const e = asRec(entry);
    const t = asNum(e['时间']);
    return { 时间: t > 0 ? t : writeEpochMinute(worldEpochMin), 从: asStr(e['从']), 到: asStr(e['到']), 金额: asNum(e['金额']) };
  });

  const 账户v31 = asRec(v31['账户']);
  const 收入v31 = asRec(账户v31['本期收入']);
  const 支出v31 = asRec(账户v31['本期支出']);
  const 经济v31 = asRec(v31['经济依附']);

  return {
    币种定义: asRec(v31['币种定义']),
    基准币种: asStr(v31['基准币种']),
    汇率: asRec(v31['汇率']),
    换汇登记,
    经济依附: { 状态: asStr(经济v31['状态']), 对象: asStr(经济v31['对象']), 每期模式: asStr(经济v31['每期模式']) },
    账户: {
      持有: asRec(账户v31['持有']),
      储蓄: asRec(账户v31['储蓄']),
      本期收入: { 总额: asNum(收入v31['总额本位币'] ?? 收入v31['总额']), 明细: asRec(收入v31['明细']) },
      本期支出: { 总额: asNum(支出v31['总额本位币'] ?? 支出v31['总额']), 明细: asRec(支出v31['明细']) },
      _负债: asRec(账户v31['负债']),
      被动收入来源: asRec(账户v31['被动收入来源']),
      资产: asArr(账户v31['资产']).map(a => { const ae = asRec(a); return { 标的: asStr(ae['标的']), 类别: asStr(ae['类别']), 数量: asNum(ae['数量']), 成本价: asNum(ae['成本价']), 现价: asNum(ae['现价']) }; }),
    },
    市场状态: {
      激活: asBool(市场v31['激活']),
      大盘景气,
      通胀率: asNum(市场v31['通胀率']),
      基准利率: asNum(市场v31['基准利率']),
      行业景气: asRec(市场v31['行业景气']),
      时代风波: asStr(市场v31['时代风波']),
      // 区域物价 → 🗑️ (单源存储在地图侧)
    },
  };
}

// ── Protagonist NPC ───────────────────────────────────────────────────────────

function migrate主角NPC(
  主角: Record<string, unknown>,
  root: Record<string, unknown>,
  主角键: string,
  worldEpochMin: number,
  p2e: (n: number) => number,
  log: MigLog[],
): Record<string, unknown> {
  const 出生日期str = asStr(主角['出生日期']);
  const 出生日期 = parseChineseDateToEpochMin(出生日期str) || worldEpochMin;

  const 属性v31 = asRec(主角['属性']);
  const 派生v31 = asRec(主角['派生']);
  const 轴v31 = asRec(主角['性格轴']);
  const 心理v31 = asRec(主角['心理']);

  const 特质 = merge特质(
    asRec(主角['特质']),
    asRec(主角['正面天赋']),
    asRec(主角['负面天赋']),
    asRec(主角['隐藏天赋']),
    asRec(主角['先天缺陷']),
  );

  const 状态标签 = migrate状态标签(
    asRec(主角['状态标签']),
    asRec(root['约束状态']),
    asNum(心理v31['压力值']),
    p2e,
  );

  const 情绪栈: unknown[] = [...asArr(主角['情绪栈'])];
  const 活跃 = asStr(心理v31['活跃心理状态']);
  if (活跃) {
    情绪栈.push({ 情绪名: 活跃, 极性: '中', 数值: 50, 影响: [], 到期: 0, 来源: 'V3.1心理状态迁移', 可叠加: false });
  }

  const 居留身份 = asArr(主角['居留身份']).map(item => {
    const it = asRec(item);
    const 到期周期 = asNum(it['到期周期'], -1);
    return { 国籍: asStr(it['国籍']), 签证类型: asStr(it['签证类型']), 到期: 到期周期 === -1 ? 0 : p2e(到期周期) }; // 0 = 永久
  });

  const 学业v31 = asRec(主角['学业']);
  const 学籍v31 = asRec(学业v31['学籍']);
  const 概况v31 = asRec(学业v31['学业概况']);
  const 升学进度v31 = asRec(概况v31['升学进度']);

  // 拍板：学校画像归组织实体/地点侧，在校表现为派生量 — 不得静默丢弃
  if (学籍v31['学校画像'] !== undefined) {
    log.push({ level: 'info', path: 'NPC.学业.学籍.学校画像', msg: '拍板丢弃：学校画像归组织实体/地点侧存储，迁移不搬运', orig: 学籍v31['学校画像'] });
  }
  if (概况v31['在校表现'] !== undefined) {
    log.push({ level: 'info', path: 'NPC.学业.学业概况.在校表现', msg: '拍板丢弃：在校表现为派生量（引擎只读），迁移不搬运', orig: 概况v31['在校表现'] });
  }

  const 成就: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(asRec(主角['成就']))) {
    const e = asRec(v);
    const cy = asNum(e['解锁周期']);
    成就[k] = { 解锁时间: cy > 0 ? p2e(cy) : worldEpochMin, 描述: asStr(e['描述']) };
  }

  const 里程碑: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(asRec(主角['里程碑']))) {
    const e = asRec(v);
    const cy = asNum(e['周期']);
    里程碑[k] = { 时间: cy > 0 ? p2e(cy) : worldEpochMin, 标题: asStr(e['标题']), 描述: asStr(e['描述']) };
  }

  const 职业v31 = asRec(主角['职业']);
  const 体征v31 = asRec(主角['体征']);

  log.push({ level: 'info', path: `NPC.${主角键}`, msg: '主角已迁入 NPC 库' });

  return {
    姓名: asStr(主角['姓名']), 称呼: asStr(主角['姓名']),
    性别: asStr(主角['性别']), 种族: '人类', 角色ID: asStr(主角['角色ID']),
    世代: asNum(主角['世代'], 1), 出生日期,
    出生地: asStr(主角['出生地']), 外貌: asStr(主角['外貌描述']),
    背景: '', 备注: '', 存活状态: '在世',
    死亡时间: 0, // 0 = 健在
    死因: asStr(主角['死因']),
    位置: asStr(root['主角位置']),
    轨迹: asArr(root['主角轨迹']).map(n => ({ 节点: asStr(n), 时间: worldEpochMin })),
    属性: { 体质: asNum(属性v31['体质'], 10), 智慧: asNum(属性v31['智慧'], 10), 感知: 10, 魅力: asNum(属性v31['魅力'], 10), 心理: asNum(属性v31['心理'], 10) },
    派生: { HP: asNum(派生v31['HP'], 100), HP上限: asNum(派生v31['HP上限'], 100), 精力: asNum(派生v31['精力'], 100), 精力上限: asNum(派生v31['精力上限'], 100), 颜值: asNum(派生v31['颜值'], 50) },
    行动点: asRec(主角['行动点']),
    性格五轴: { 外向: asNum(轴v31['外向'], 50), 宜人: asNum(轴v31['亲和'], 50), 尽责: asNum(轴v31['尽责'], 50), 神经质: 100 - asNum(轴v31['情绪稳定'], 50), 开放: asNum(轴v31['开放'], 50) },
    特质, 情绪栈, 状态标签,
    技能: asRec(主角['技能']),
    疾病: asRec(主角['疾病']),
    体征: { 身高: asNum(体征v31['身高']), 体重: asNum(体征v31['体重']), _BMI: asNum(体征v31['_BMI']), 体型标签: asStr(体征v31['体型标签']), 体型效果: asArr(体征v31['体型效果']) },
    物品: asRec(主角['物品']),
    衣物: asRec(主角['衣物']),
    爱好: asRec(主角['爱好']),
    信念: asRec(主角['信念']),
    学业: {
      学籍: { 在学状态: asStr(学籍v31['在学状态']), 学段: asStr(学籍v31['学段']), 学校: asStr(学籍v31['学校']), 年级: asStr(学籍v31['年级']), 专业: asStr(学籍v31['专业']) },
      在修科目: asRec(学业v31['在修科目']),
      考试记录: asRec(学业v31['考试记录']),
      升学记录: asRec(学业v31['升学记录']),
      学历档案: asRec(学业v31['学历档案']),
      资质证书: asRec(学业v31['资质证书']),
      学业概况: { 当前阶段: asStr(概况v31['当前阶段']), 学业档位: asStr(概况v31['学业档位']), 升学进度: { 下一关卡: asStr(升学进度v31['下一关卡']), 目标: asStr(升学进度v31['目标']) } },
    },
    职业: {
      任职: asArr(职业v31['任职']).map(item => {
        const it = asRec(item);
        const cy = asNum(it['入职周期']);
        return { 体系ID: asStr(it['体系ID']), 级序: asNum(it['级序']), 职位: asStr(it['职位']), 雇主: asStr(it['雇主']), 性质: asStr(it['性质'], '主业'), 工时档: asStr(it['工时档']), 在职状态: asStr(it['在职状态'], '在职'), 报酬: asStr(it['报酬']), 绩效: asNum(it['绩效']), 入职时间: cy > 0 ? p2e(cy) : 0 };
      }),
      职业履历: asRec(职业v31['职业履历']),
    },
    目标: { 长期: asArr(asRec(主角['目标'])['长期']).map(x => asStr(x)), 短期: asArr(asRec(主角['目标'])['短期']).map(x => asStr(x)) },
    居留身份,
    头衔: asArr(主角['头衔爵位']).map(x => asStr(x)),
    称号: asStr(主角['称号']),
    成就, 里程碑,
    业力: asNum(主角['业力']),
    声誉: { 人望: asNum(主角['人望']), 知名度: asNum(主角['知名度']), 极性: '', 标签: asStr(主角['声望标签']) },
    婚姻: asArr(asRec(root['家庭'])['婚姻']).map(item => { const it = asRec(item); const 终止raw = asNum(it['终止'], -1); return { 配偶: asStr(it['配偶']), 状态: asStr(it['状态']), 缔结: asNum(it['缔结']), 终止: 终止raw <= 0 ? 0 : 终止raw }; }), // 0 = 未终止
    关系: [], // populated after NPC loop
    所属组织: asArr(主角['所属组织']).map(o => { const oe = asRec(o); return { 组织键: asStr(oe['组织键']), 职务: asStr(oe['职务']), 派系: asStr(oe['派系']) }; }),
    职务: [], 忠诚: {},
    重要等级: '核心', 召回权重: 100, 意象: [], 作息: {}, 当前作息模式: '常态', 履历: [],
    记忆: asArr(主角['记忆']).map(m => migrateNpcMemory(asRec(m), p2e)),
    上次互动: worldEpochMin, 复活点: 0, 死亡豁免前置: '',
  };
}

// ── Simple NPC ────────────────────────────────────────────────────────────────

function migrateSimpleNPC(
  npcKey: string,
  npc: Record<string, unknown>,
  主角键: string,
  worldEpochMin: number,
  p2e: (n: number) => number,
  主角关系: unknown[],
  log: MigLog[],
): Record<string, unknown> {
  const 好感度 = asNum(npc['好感度'], 50);
  const 信任度 = asNum(npc['信任度'], 50);
  const 关系深度 = asNum(npc['关系深度'], 0);
  const 关系标签 = asStr(npc['关系标签']);

  主角关系.push({ 对象键: npcKey, 类型: 关系标签, 强度: 好感度 - 50, 极性: 好感度 >= 50 ? '正' : '负', 信任: 信任度, 深度: 关系深度 });

  const 向背str = asStr(npc['向背']);
  const 忠诚: Record<string, unknown> = {};
  if (向背str) 忠诚[主角键] = { $真实值: LOYALTY_MAP[向背str] ?? 50, 伪装度: 0 };

  const 能力档v31 = asRec(npc['能力档']);
  const 属性简表 = asRec(能力档v31['属性简表']);
  const 技能: Record<string, unknown> = {};
  for (const skillEntry of asArr(能力档v31['技能'])) {
    const se = asRec(skillEntry);
    const 名 = asStr(se['名'] ?? se['名称']);
    if (名) 技能[名] = { 熟练度: asNum(se['熟练度']), 等级: 0, 类别: '通用', 来源: 'V3.1迁移', 施放: {} };
  }

  const 上次互动周期 = asNum(npc['上次互动周期'], 0);
  const 死亡周期 = asNum(npc['死亡周期'], -1);
  const 死亡时间: number = 死亡周期 === -1 ? 0 : p2e(死亡周期); // 0 = 健在

  if (asStr(npc['性格'])) log.push({ level: 'info', path: `NPC.${npcKey}.性格`, msg: '缺口#6: 派生量，已丢弃' });

  return {
    姓名: asStr(npc['称呼']), 称呼: asStr(npc['称呼']), 性别: asStr(npc['性别']),
    种族: '人类', 角色ID: '', 世代: 1, 出生日期: 0, 出生地: '', 外貌: '',
    背景: asStr(npc['背景']), 备注: asStr(npc['备注']),
    存活状态: 死亡周期 === -1 ? '在世' : '已故', 死亡时间, 死因: '',
    位置: asStr(npc['关联地点']), 轨迹: [],
    属性: { 体质: asNum(属性简表['体质'], 10), 智慧: asNum(属性简表['智慧'], 10), 感知: 10, 魅力: asNum(属性简表['魅力'], 10), 心理: asNum(属性简表['心理'], 10) },
    派生: { HP: 100, HP上限: 100, 精力: 100, 精力上限: 100, 颜值: 50 },
    行动点: { 当前: 15, 上限: 15 },
    性格五轴: { 外向: 50, 宜人: 50, 尽责: 50, 神经质: 50, 开放: 50 },
    特质: {}, 情绪栈: [], 状态标签: {},
    技能, 疾病: {},
    体征: { 身高: 0, 体重: 0, _BMI: 0, 体型标签: '', 体型效果: [] },
    物品: {}, 衣物: {}, 爱好: {}, 信念: {}, 学业: {}, 职业: {},
    目标: { 长期: [], 短期: [] }, 居留身份: [],
    头衔: [], 称号: '', 成就: {}, 里程碑: {}, 业力: 0,
    声誉: { 人望: 0, 知名度: 0, 极性: '', 标签: '' },
    婚姻: [],
    关系: [{ 对象键: 主角键, 类型: 关系标签, 强度: 好感度 - 50, 极性: 好感度 >= 50 ? '正' : '负', 信任: 信任度, 深度: 关系深度 }],
    所属组织: asArr(npc['所属组织']).map(o => { const oe = asRec(o); return { 组织键: asStr(oe['组织键']), 职务: asStr(oe['职务']), 派系: asStr(oe['派系']) }; }),
    职务: [], 忠诚,
    重要等级: '重要', 召回权重: 70, 意象: [], 作息: {}, 当前作息模式: '常态', 履历: [],
    记忆: asArr(npc['记忆']).map(m => migrateNpcMemory(asRec(m), p2e)),
    上次互动: 上次互动周期 > 0 ? p2e(上次互动周期) : writeEpochMinute(worldEpochMin),
    复活点: 0, 死亡豁免前置: '',
  };
}

// ── Child → NPC ───────────────────────────────────────────────────────────────

function migrateChild(
  childKey: string,
  child: Record<string, unknown>,
  主角键: string,
  worldEpochMin: number,
  p2e: (n: number) => number,
  主角关系: unknown[],
  log: MigLog[],
  主角世代: number,
): Record<string, unknown> {
  const 好感度 = asNum(child['好感度'], 50);
  const 关系深度 = asNum(child['关系深度'], 0);
  const 属性v31 = asRec(child['属性']);

  主角关系.push({ 对象键: childKey, 类型: '子嗣', 强度: 好感度 - 50, 极性: 好感度 >= 50 ? '正' : '负', 信任: 50, 深度: 关系深度 });
  log.push({ level: 'info', path: `NPC.${childKey}`, msg: '子嗣已迁入 NPC 库（含亲子扩展）' });

  return {
    姓名: asStr(child['称呼']), 称呼: asStr(child['称呼']), 性别: asStr(child['性别']),
    种族: '人类', 角色ID: '', 世代: 主角世代 + 1, 出生日期: 0, 出生地: '', 外貌: '',
    背景: '', 备注: '', 存活状态: asStr(child['存活状态'], '存活') !== '已故' && asStr(child['存活状态'], '存活') !== '死亡' ? '在世' : '已故',
    死亡时间: 0, 死因: '', // 0 = 健在哨兵（V3.1 子嗣无死亡时刻记录）
    位置: '', 轨迹: [],
    属性: { 体质: asNum(属性v31['体质'], 10), 智慧: asNum(属性v31['智慧'], 10), 感知: 10, 魅力: asNum(属性v31['魅力'], 10), 心理: asNum(属性v31['心理'], 10) },
    派生: { HP: 100, HP上限: 100, 精力: 100, 精力上限: 100, 颜值: 50 },
    行动点: { 当前: 15, 上限: 15 },
    性格五轴: { 外向: 50, 宜人: 50, 尽责: 50, 神经质: 50, 开放: 50 },
    特质: {}, 情绪栈: [], 状态标签: {}, 技能: {}, 疾病: {},
    体征: { 身高: 0, 体重: 0, _BMI: 0, 体型标签: '', 体型效果: [] },
    物品: {}, 衣物: {}, 爱好: {}, 信念: {}, 学业: {}, 职业: {},
    目标: { 长期: [], 短期: [] }, 居留身份: [],
    头衔: [], 称号: '', 成就: {}, 里程碑: {}, 业力: 0,
    声誉: { 人望: 0, 知名度: 0, 极性: '', 标签: '' },
    婚姻: [],
    关系: [{ 对象键: 主角键, 类型: '父母', 强度: 好感度 - 50, 极性: 好感度 >= 50 ? '正' : '负', 信任: 50, 深度: 关系深度 }],
    所属组织: [], 职务: [], 忠诚: {},
    重要等级: '次要', 召回权重: 50, 意象: [], 作息: {}, 当前作息模式: '常态', 履历: [],
    记忆: asArr(child['子嗣工作记忆']).map(m => migrateNpcMemory(asRec(m), p2e)),
    上次互动: worldEpochMin, 复活点: 0, 死亡豁免前置: '',
    亲子: { 来源: '血亲', 其他双亲: '', 入族时间: 0 },
    继承预案: { 继承顺位: 0, 指定继承人: false, 继承意愿: asStr(child['继承意愿']) },
  };
}

// ── 3-8B 信念瘦身迁移: 组织实体.信念.强制度/异端容忍 → 属性轴 ──────────────────────────
// 幂等保护: 若属性轴已含该键则跳过；若信念里没有旧字段则原样返回。
function migrate组织信念轴(org: Record<string, unknown>): Record<string, unknown> {
  const 信念Raw = asRec(org['信念']);
  if (!('强制度' in 信念Raw) && !('异端容忍' in 信念Raw)) return org;

  const 属性轴: Record<string, unknown> = { ...asRec(org['属性轴']) };
  const 信念New: Record<string, unknown> = { ...信念Raw };

  if ('强制度' in 信念Raw && !('强制度' in 属性轴)) {
    属性轴['强制度'] = { 数值: asNum(信念Raw['强制度']), 域: '信念' };
  }
  delete 信念New['强制度'];

  if ('异端容忍' in 信念Raw && !('异端容忍' in 属性轴)) {
    属性轴['异端容忍'] = { 数值: asNum(信念Raw['异端容忍']), 域: '信念' };
  }
  delete 信念New['异端容忍'];

  const result: Record<string, unknown> = { ...org, 信念: 信念New };
  if (Object.keys(属性轴).length > 0) result['属性轴'] = 属性轴;
  return result;
}

// ── buildV41Raw ───────────────────────────────────────────────────────────────

export function buildV41Raw(input: unknown): MigrateRawResult {
  const log: MigLog[] = [];
  const root = asRec(input);

  // Idempotency: V4.1 input → pass through (second migrate call)
  if (asStr(root['_系统版本']) === '4.1') return { raw: root, log };

  if (asStr(root['_系统版本']) !== '3.1') {
    log.push({ level: 'warn', path: '_系统版本', msg: `未知版本 "${asStr(root['_系统版本'])}"，按 V3.1 尝试迁移` });
  }

  // ── Time context ─────────────────────────────────────────────────────────────
  const 世界v31 = asRec(root['世界']);
  const 当前粒度 = asStr(世界v31['当前时间粒度'], '月');
  const 周期数 = asNum(世界v31['周期数']);
  const tickMinutes = getTickMinutes(当前粒度);
  const 当前日期 = asStr(世界v31['当前日期']);
  const worldEpochMin = parseChineseDateToEpochMin(当前日期);

  if (worldEpochMin === 0 && 当前日期 && 当前日期 !== '待初始化') {
    log.push({ level: 'warn', path: '世界.当前日期', msg: `无法解析 "${当前日期}"，纪元分钟锚点落 0` });
  }

  const p2e = makePeriodConverter(worldEpochMin, 周期数, tickMinutes);

  // ── 主角 ──────────────────────────────────────────────────────────────────────
  const 主角v31 = asRec(root['主角']);
  const rawId = asStr(主角v31['角色ID']);
  const rawName = asStr(主角v31['姓名']).replace(/\s+/g, '');
  const 主角键 = rawId || rawName || 'protagonist';

  const 主角NPC = migrate主角NPC(主角v31, root, 主角键, worldEpochMin, p2e, log);

  // ── NPC ───────────────────────────────────────────────────────────────────────
  const npcV31 = asRec(root['NPC']);
  const npcV41: Record<string, unknown> = {};
  const 主角关系: unknown[] = [];

  for (const [npcKey, npcVal] of Object.entries(npcV31)) {
    npcV41[npcKey] = migrateSimpleNPC(npcKey, asRec(npcVal), 主角键, worldEpochMin, p2e, 主角关系, log);
  }

  // ── 子嗣 → NPC 库 ──────────────────────────────────────────────────────────
  const 主角世代 = asNum(主角v31['世代'], 1);
  const 子嗣键列表: string[] = [];
  for (const [childKey, childVal] of Object.entries(asRec(主角v31['子嗣']))) {
    npcV41[childKey] = migrateChild(childKey, asRec(childVal), 主角键, worldEpochMin, p2e, 主角关系, log, 主角世代);
    子嗣键列表.push(childKey);
  }

  // Populate protagonist 关系[] and register in NPC map
  asRec(主角NPC)['关系'] = 主角关系;
  npcV41[主角键] = 主角NPC;

  // ── 已故NPC归档 (fix ④: 死亡时间 through p2e) ───────────────────────────────
  const 已故v41: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(asRec(root['已故NPC归档']))) {
    const g = asRec(v);
    const 死亡周期 = asNum(g['死亡周期'], 0);
    已故v41[k] = {
      称呼: asStr(g['称呼']),
      死亡时间: 死亡周期 > 0 ? p2e(死亡周期) : (死亡周期 === 0 ? writeEpochMinute(worldEpochMin) : 0),
      关键记忆指针: asStr(g['关键记忆指针']),
      幽灵形态: asBool(g['幽灵形态']),
    };
  }

  // ── 全局 ──────────────────────────────────────────────────────────────────────
  const 全局v31 = asRec(root['全局']);
  const 秘密库: Record<string, unknown> = {};
  const 约定库: Record<string, unknown> = {};

  migrateSecretsToPool(主角键, asRec(主角v31['秘密索引']), asArr(主角v31['受制于']), 秘密库, log);
  for (const [npcKey, npcVal] of Object.entries(npcV31)) {
    migrateSecretsToPool(npcKey, asRec(asRec(npcVal)['秘密索引']), [], 秘密库, log);
  }

  const 出生日期 = parseChineseDateToEpochMin(asStr(主角v31['出生日期'])) || worldEpochMin;
  const 家族树 = migrate家族树(主角键, asRec(主角v31['血缘']), 全局v31, 出生日期);

  // Fix P0-2 #1: write child nodes + double-parent edges into 家族树
  if (子嗣键列表.length > 0) {
    // In V3.1, ongoing marriage has 终止 = -1
    const 家庭v31 = asRec(root['家庭']);
    const 当前婚姻 = asArr(家庭v31['婚姻']).find(m => {
      const it = asRec(m); return asNum(it['终止'], -1) === -1 && asStr(it['配偶']);
    });
    const 当前配偶键 = 当前婚姻 ? asStr(asRec(当前婚姻)['配偶']) : '';
    const 树边 = asRec(家族树['边']);
    const 树幽灵 = asRec(家族树['幽灵节点']);
    let 配偶幽灵键 = '';
    for (const childKey of 子嗣键列表) {
      const 他方 = 当前配偶键 || (() => {
        if (!配偶幽灵键) {
          配偶幽灵键 = `幽灵_${主角键}_配偶`;
          树幽灵[配偶幽灵键] = { 称谓: '配偶', 姓氏: '', 生卒约束: '' };
          log.push({ level: 'info', path: `全局.家族树.幽灵节点.${配偶幽灵键}`, msg: '子嗣无已知另一方双亲，按 6.30 创建幽灵节点' });
        }
        return 配偶幽灵键;
      })();
      树边[childKey] = {
        双亲边: [
          { parent_id: 主角键, 边类型: '血亲' },
          { parent_id: 他方, 边类型: '血亲' },
        ],
        生卒: { 出生: 0 }, // V3.1 子嗣无出生日期字段
        总评: '', 关键成就: [], 传家宝: [],
      };
    }
  }

  // ── 组织关系网 (条约 → 约定库) ─────────────────────────────────────────────
  const 组织关系网v41: Record<string, unknown> = {};
  for (const [edgeId, edgeVal] of Object.entries(asRec(root['组织关系网']))) {
    const edge = asRec(edgeVal);
    const 条约str = asStr(edge['条约']);
    let 约定引用键 = '';
    if (条约str) {
      const ck = `covenant_${edgeId}`;
      约定库[ck] = {
        缔约方: [{ 实体键: asStr(edge['A组织']), 角色: '甲方' }, { 实体键: asStr(edge['B组织']), 角色: '乙方' }],
        形式: '条约', 条款: [{ 内容: 条约str, 履行状态: '待履行' }],
        约束力: 0, 维系手段: '', 状态: '有效',
      };
      约定引用键 = ck;
    }
    组织关系网v41[edgeId] = { A组织: asStr(edge['A组织']), B组织: asStr(edge['B组织']), 关系: asStr(edge['关系']), 关系值: asNum(edge['关系值']), 约定引用键 };
  }

  // ── 货币系统 ─────────────────────────────────────────────────────────────────
  const 货币v41 = migrate货币(asRec(root['货币系统']), worldEpochMin, log);

  // ── 工作记忆 / 长期归档 ────────────────────────────────────────────────────────
  const 工作记忆v41 = asArr(root['工作记忆']).map(item => migrateWorkMemItem(asRec(item), p2e));
  const 长期归档v41 = asArr(root['长期归档']).map(item => migrateArchiveItem(asRec(item), p2e));

  // ── 仲裁器 ────────────────────────────────────────────────────────────────────
  const 仲裁器v31 = asRec(root['仲裁器']);
  const 冷却表v41: Record<string, number> = {};
  for (const [k, v] of Object.entries(asRec(仲裁器v31['冷却表']))) 冷却表v41[k] = p2e(asNum(v));

  const 种子包v31 = asRec(仲裁器v31['本轮种子包']);
  const 主种子 = asStr(种子包v31['主种子id']);
  const 副种子 = asArr(种子包v31['副种子ids']).map(x => asStr(x));
  const 本轮种子包 = [主种子, ...副种子].filter(s => s !== '');

  // 播报队列迁移：旧条目缺 渠道 字段时补默认值 '系统'（tagged union 升格·§10）
  const 播报队列v41 = asArr(仲裁器v31['播报队列']).map(item => {
    const it = asRec(item);
    if (asStr(it['渠道']) === '') return { 渠道: '系统', 内容: asStr(it['内容']), 播报id: asStr(it['播报id']), 重要度: asStr(it['重要度'], '普通'), 发生时间: asNum(it['发生时间']), 已读: asBool(it['已读']) };
    return it;
  });

  // ── $隐藏记忆库 ───────────────────────────────────────────────────────────────
  const 隐v31 = asRec(root['$隐藏记忆库']);
  const 延时种子v41: Record<string, unknown> = {};
  for (const [id, val] of Object.entries(asRec(隐v31['延时种子']))) {
    延时种子v41[id] = migrateSeed(asRec(val), p2e, log);
  }
  const 彩蛋池v41: Record<string, unknown> = {};
  for (const [id, val] of Object.entries(asRec(隐v31['彩蛋池']))) {
    彩蛋池v41[id] = migrateEgg(asRec(val), p2e);
  }

  // ── 叙事 / 状态机 / _tick ─────────────────────────────────────────────────────
  const 叙v31 = asRec(root['_叙事设置']);
  const 流程v31 = asRec(root['流程状态']);
  const 游戏模式 = asStr(流程v31['游戏模式']);
  const 当前态 = GAME_MODE_MAP[游戏模式] ?? 'PLAYING';
  if (游戏模式 && !(游戏模式 in GAME_MODE_MAP)) {
    log.push({ level: 'warn', path: '流程状态.游戏模式', msg: `未识别态 "${游戏模式}"，坍缩到 PLAYING` });
  }

  const 写实程度str = asStr(流程v31['写实程度']);
  let 写实程度 = REALISM_MAP[写实程度str] ?? 0.5;
  if (写实程度str && !(写实程度str in REALISM_MAP)) {
    log.push({ level: 'warn', path: '流程状态.写实程度', msg: `未识别档位 "${写实程度str}"，落默认 0.5` });
    写实程度 = 0.5;
  }

  const tickV31 = asRec(root['_tick']);
  const tickPeriod = asNum(tickV31['period'], -1);
  const 难度str = asStr(流程v31['难度'] ?? tickV31['difficulty']);

  // ── 系统 ──────────────────────────────────────────────────────────────────────
  const 系统v31 = asRec(root['系统']);
  const 已结算标记: Record<string, unknown> = {};
  for (const id of asArr(系统v31['settled_event_ids'])) {
    已结算标记[asStr(id)] = { 即时分量: 1, 延时分量: {} };
  }

  // ── $meta ─────────────────────────────────────────────────────────────────────
  const $metav31 = asRec(root['$meta']);
  const 峰值v31 = asRec(主角v31['峰值记录']);
  const 峰值记录: Record<string, number> = {};
  const 峰值keyMap: [string, string][] = [
    ['最高体质', '体质'], ['最高智慧', '智慧'], ['最高魅力', '魅力'],
    ['最高心理', '心理'], ['最高金钱', '金钱'],
  ];
  for (const [oldK, newK] of 峰值keyMap) {
    if (oldK in 峰值v31) 峰值记录[newK] = asNum(峰值v31[oldK]);
  }

  // ── $RP暂存 ────────────────────────────────────────────────────────────────────
  const $RPv31 = asRec(root['$RP本场暂存']);
  const 起始周期 = asNum($RPv31['起始周期'], -1);

  // ── Assemble output ───────────────────────────────────────────────────────────
  const raw: Record<string, unknown> = {
    _系统版本: '4.1',
    _tick: { id: asStr(tickV31['id']), 拍计数: tickPeriod <= 0 ? 0 : tickPeriod, 难度系数组指纹: 难度str ? `difficulty:${难度str}` : '' },
    _系统: {
      schema_version: asNum(系统v31['schema_version']),
      migration_version: asNum(系统v31['migration_version']),
      last_migration: p2e(asNum(系统v31['last_migration_cycle'])),
      tick_log: asArr(系统v31['tick_log']).map(e => { const ev = asRec(e); return { tick_id: asStr(ev['tick_id']), 拍计数: asNum(ev['周期数']), 结果摘要: asStr(ev['结果摘要']), 系数组指纹: asStr(ev['难度快照'] ?? ev['系数组指纹']) }; }),
      已结算标记,
      功能开关表: {},
      事件来源权重: { 事件包: 50, AI自发: 50 },
    },
    _叙事设置: { 人称: {}, 叙事偏好: asStr(叙v31['叙事风格']) },
    _状态机: { 当前态, 模态栈: [], timeMode: 'PAUSED', 双时钟: { 世界钟: writeEpochMinute(worldEpochMin), 镜头钟: writeEpochMinute(worldEpochMin) } },
    世界: {
      纪元分钟: writeEpochMinute(worldEpochMin),
      历法: {},
      年代背景: asStr(世界v31['年代背景']),
      气候带: asStr(世界v31['气候']),
      当前粒度,
      粒度栈: [],
      周期数,
      _本拍跨度: tickMinutes,
      _粒度模板: {},
    },
    世界域: {},
    // 6.53 C1: 旧 镜头焦点角色 字符串指针升格为席位表（单机退化为单席位「本机」）
    _席位表: { 本机: { 焦点角色键: 主角键, 控制者: '人类', 连接状态: '本地' } },
    NPC: npcV41,
    已故NPC归档: 已故v41,
    认知档案: build认知档案(主角键, npcV31, worldEpochMin),
    组织实体: (() => { const out: Record<string, unknown> = {}; for (const [k, v] of Object.entries(asRec(root['组织实体']))) out[k] = migrate组织信念轴(asRec(v)); return out; })(),
    组织关系网: 组织关系网v41,
    全局: { 秘密库, 约定库, 继承包: asRec(全局v31['继承包']), 家族树, _覆写日志: [], _作弊标记: false },
    地图: { 地点: asRec(asRec(root['地图'])['地点']), 战役: asRec(asRec(root['地图'])['战役']), 区域物价: asRec(asRec(root['地图'])['区域物价']) },
    战争状态: {},
    赛事实例: {},
    货币系统: 货币v41,
    工作记忆: 工作记忆v41,
    长期归档: 长期归档v41,
    日程: asRec(root['日程']),
    行动卡库: asRec(root['行动卡库']),
    仲裁器: { 冷却表: 冷却表v41, 本轮种子包, 播报队列: 播报队列v41 },
    mod注册表: asRec(root['事件库注册表']),
    $运气: asNum(root['$运气'], 50),
    $寿命预期: asNum(root['$寿命预期'], 75),
    $聆听心声触发: asBool(root['$聆听心声触发']),
    $浮现记忆ID: asStr(root['$浮现记忆ID']),
    $涟漪候选: {},
    $RP暂存: { 本场摘要: asStr($RPv31['本场摘要']), 起始时间: 起始周期 === -1 ? 0 : p2e(起始周期), 本场新登场: asArr($RPv31['本场新登场']).map(item => { const it = asRec(item); return { 类型: asStr(it['类型'], 'NPC'), 名称: asStr(it['名称']), 摘要: asStr(it['摘要']) }; }), 聚合行动摘要: '' },
    $隐藏记忆库: { 延时种子: 延时种子v41, 彩蛋池: 彩蛋池v41 },
    $流速: { 模式: '回合制', 速度档: 1, 自动暂停触发: [] },
    $战斗暂存: { 局部网格: '', 单位: [], 回合order: [] },
    $玩家偏好: { 母题权重: asRec(叙v31['事件倾向']), 写实程度, 写实度权重: 50, 事件偏好权重: {} },
    $会话状态: { 最后交互时间戳: 0, 未读播报数: 0, 崩溃恢复指针: '' },
    $预算控制台: {},
    $模型画像: {},
    $沉浸模式: false,
    $meta: {
      总回合数: asNum($metav31['总回合数']),
      上帝之手次数: asNum($metav31['上帝之手次数']),
      聆听心声次数: asNum($metav31['聆听心声次数']),
      历代角色数: Math.max(1, asNum($metav31['历代角色数'], 1)),
      周目谱系: {},
      峰值记录,
    },
  };

  return { raw, log };
}

// ── applyPrefixRenames (V4.1 in-place key rename migration) ──────────────────
// Renames the 7 engine-internal keys to carry explicit _ prefix.
// Idempotent: if _状态机 already exists the migration is skipped.
// migration_version bumped by 1 on rename.

const TOP_RENAMES: Array<[string, string]> = [
  ['状态机', '_状态机'],
  ['系统',   '_系统'],
  ['存档头', '_存档头'],
  ['席位表', '_席位表'],
];

const 全局_RENAMES: Array<[string, string]> = [
  ['覆写日志', '_覆写日志'],
  ['编年史',   '_编年史'],
  ['作弊标记', '_作弊标记'],
];

export function applyPrefixRenames(raw: Record<string, unknown>): Record<string, unknown> {
  if ('_状态机' in raw) return raw;  // idempotent guard

  const result: Record<string, unknown> = { ...raw };

  for (const [oldKey, newKey] of TOP_RENAMES) {
    if (oldKey in result) {
      result[newKey] = result[oldKey];
      delete result[oldKey];
    }
  }

  const 全局Src = result['全局'];
  if (typeof 全局Src === 'object' && 全局Src !== null && !Array.isArray(全局Src)) {
    const g: Record<string, unknown> = { ...(全局Src as Record<string, unknown>) };
    for (const [oldKey, newKey] of 全局_RENAMES) {
      if (oldKey in g) {
        g[newKey] = g[oldKey];
        delete g[oldKey];
      }
    }
    result['全局'] = g;
  }

  const 系统Src = result['_系统'];
  if (typeof 系统Src === 'object' && 系统Src !== null) {
    const sys: Record<string, unknown> = { ...(系统Src as Record<string, unknown>) };
    sys['migration_version'] = asNum(sys['migration_version']) + 1;
    result['_系统'] = sys;
  }

  return result;
}

// ── 内容分级 位置迁移（within-v4.1·906e89b → 当前·enum 英文化）─────────────────────────
// 旧位置：_系统.功能开关表.内容分级（中文值 关/SFW/NSFW/community）
// 新位置：$玩家偏好.内容分级（英文值 off/light/explicit/community）
// 幂等保护：$玩家偏好 已含 内容分级 键时跳过（不覆盖用户已迁移的值）
const 内容分级映射: Record<string, string> = {
  '关': 'off', 'SFW': 'light', 'NSFW': 'explicit', 'community': 'community',
};

function migrate内容分级位置(raw: Record<string, unknown>): Record<string, unknown> {
  const sys = asRec(raw['_系统']);
  const 功能开关表 = asRec(sys['功能开关表']);
  const oldVal = 功能开关表['内容分级'];
  if (oldVal === undefined || oldVal === null) return raw;

  const pref = asRec(raw['$玩家偏好']);
  if ('内容分级' in pref) return raw;  // 幂等：已迁移则跳过

  const mappedVal = 内容分级映射[asStr(oldVal)] ?? 'off';
  const newFunctionSwitch: Record<string, unknown> = { ...功能开关表 };
  delete newFunctionSwitch['内容分级'];

  return {
    ...raw,
    $玩家偏好: { ...pref, 内容分级: mappedVal },
    _系统: { ...sys, 功能开关表: newFunctionSwitch },
  };
}

// ── K6 pack_id 回填（批⑤·within-v4.1·幂等·只补 mod注册表）─────────────────────────────
// 迁移纪律：只处理 mod注册表；effect包/事件包/战术包/补丁集/纪元包一律不迁移。
// 幂等：pack_id === key 时跳过；pack_id ≠ key（含空串）时强制覆盖为 key（K6⑤·温和对齐）。
// migration_version 仅在有实际写入时 +1；verbatim 回填不归一化、不加工。

export function backfillPackId(raw: Record<string, unknown>): Record<string, unknown> {
  const modReg = asRec(raw['mod注册表']);
  if (Object.keys(modReg).length === 0) return raw;  // 空注册表 → 幂等 no-op

  let anyChanged = false;
  const newReg: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(modReg)) {
    const entry = asRec(val);
    if (asStr(entry['pack_id']) !== key) {  // covers '' and any mismatched pack_id (K6⑤)
      newReg[key] = { ...entry, pack_id: key };
      anyChanged = true;
    } else {
      newReg[key] = entry;
    }
  }

  if (!anyChanged) return raw;  // 全已对齐 → 幂等 no-op，不 bump migration_version

  const sys = asRec(raw['_系统']);
  const newSys = { ...sys, migration_version: asNum(sys['migration_version']) + 1 };
  return { ...raw, mod注册表: newReg, _系统: newSys };
}

// ── S1/S1b 键空间注册初挂（B5·Step2·within-v4.1·幂等）─────────────────────────────────
// 新顶层 key 两枚（受治理键空间注册表 · 键空间归并表）首次出现于 B5·Step2。
// 幂等：两键均已存在则 no-op（migration_version 不 bump）。
// 零数据迁移：新 key 填 {}；RootSchema.parse 的 .default({}) 与此口径相同。
// migration_version bump 仅在至少一个新 key 缺失时触发（确定性·字段级检测）。

export function migrateS1S1b(raw: Record<string, unknown>): Record<string, unknown> {
  const hasS1  = '受治理键空间注册表' in raw;
  const hasS1b = '键空间归并表' in raw;
  if (hasS1 && hasS1b) return raw;  // 幂等：两键均存在 → no-op

  const sys    = asRec(raw['_系统']);
  const newSys = { ...sys, migration_version: asNum(sys['migration_version']) + 1 };
  return {
    ...raw,
    ...(hasS1  ? {} : { 受治理键空间注册表: {} }),
    ...(hasS1b ? {} : { 键空间归并表: {} }),
    _系统: newSys,
  };
}

// ── backfill 货币账户 per-entity（B5.6·账本迁移批） ─────────────────────────────
// Shape嗅探幂等门：账户首值含 持有/储蓄 key → 已是 per-entity。
//   已含 _应收 → 完全对齐（_应收+_费用 同批写入·只查前者） → no-op。
//   缺 _应收 → B5.6 补填 _应收:{}/_费用:{总额,明细} 到每个实体（bump version）。
// 旧单例形态：账户顶层含 持有/储蓄 → 清空为 {}（Option B·零假设·余额存 slice Map）。
// 空 map → no-op（已是 per-entity 初始态）。

export function backfill货币账户PerEntity(raw: Record<string, unknown>): Record<string, unknown> {
  const 货币 = asRec(raw['货币系统']);
  const 账户 = asRec(货币['账户']);

  // 空 map → 已是 per-entity 初始态，no-op
  const vals = Object.values(账户);
  if (vals.length === 0) return raw;

  const firstRec = typeof vals[0] === 'object' && vals[0] !== null
    ? vals[0] as Record<string, unknown>
    : {};

  if ('持有' in firstRec || '储蓄' in firstRec) {
    // 已 per-entity：检查 _应收 是否已补填（_应收+_费用 同批写入·只查前者）
    if ('_应收' in firstRec) return raw; // 完全对齐 → no-op

    // _应收/_费用 缺失 → 逐实体补填（旧 应收/负债 key 由 RootSchema.parse 完成 strip+default）
    const new账户: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(账户)) {
      const entity = typeof v === 'object' && v !== null ? v as Record<string, unknown> : {};
      new账户[k] = { ...entity, _应收: {}, _费用: { 总额: 0, 明细: {} } };
    }
    const new货币 = { ...货币, 账户: new账户 };
    const sys = asRec(raw['_系统']);
    const newSys = { ...sys, migration_version: asNum(sys['migration_version']) + 1 };
    return { ...raw, 货币系统: new货币, _系统: newSys };
  }

  // 旧单例形态：账户本层含 持有/储蓄 → 清空（Option B）
  if ('持有' in 账户 || '储蓄' in 账户) {
    const new货币 = { ...货币, 账户: {} };
    const sys = asRec(raw['_系统']);
    const newSys = { ...sys, migration_version: asNum(sys['migration_version']) + 1 };
    return { ...raw, 货币系统: new货币, _系统: newSys };
  }

  return raw; // 其他未知形态 → no-op
}

// ── Phase-L Step-1b 新字段幂等说明（L-12 横切·零 migration_version bump）──────────────────
// 涉及字段：印象条目.观测拍号 / 地点条目.{容量,营业时间,活动类型,可行走}
// 全为 .optional()·旧档经 RootSchema.parse 后对应字段 = undefined·Zod 自动处理·无需结构写入。
// 幂等：字段已存在则 no-op；不 bump migration_version（pure-optional·零迁移 = L-12 约束已满足）。
// 「迁移推定」标注：印象条目已有 来源 字段承载来源（旧档迁移时标「迁移推定」·见 build认知档案）；
// 观测拍号/地点三字段为工具占位字段·无独立来源标注需求。
export function backfillPhaseL1b(raw: Record<string, unknown>): Record<string, unknown> {
  // pure-optional fields — Zod parse handles absence; no structural write needed
  return raw;
}

// ── S3·写卡口（导入闸·fail-open·defense-in-depth）─────────────────────────────
//
// 检查 RootState 7 个动态字典区域（z.record<string,*>·外来键）的键名是否命中
// JS 保留键黑名单（__proto__/constructor/prototype）。
// fail-open：命中 → push level:'error' log + 放行；绝不 throw；绝不 mutate state。
// 覆盖面：NPC / 已故NPC归档 / 组织实体 / mod注册表 / _mod墓碑库 / 调用类型注册表 / $模型画像。
// 排除：货币系统.账户——账户键Schema 已内置 是JS保留键() Zod 级保护，无需重复。
// 实装说明（govKeySpace.ts:31 TODO 已由此函数完成）。
export function checkS3WriteGate(state: RootState, log: MigLog[]): void {
  const areas: Array<[string, object]> = [
    ['NPC',           state.NPC],
    ['已故NPC归档',   state.已故NPC归档],
    ['组织实体',      state.组织实体],
    ['mod注册表',     state.mod注册表],
    ['_mod墓碑库',    state._mod墓碑库 ?? {}],
    ['调用类型注册表', state.调用类型注册表],
    ['$模型画像',     state.$模型画像],
  ];
  for (const [area, dict] of areas) {
    for (const key of Object.keys(dict)) {
      if (是JS保留键(key)) {
        log.push({
          level: 'error',
          path: `${area}.${key}`,
          msg: `S3写卡口: JS保留键「${key}」命中黑名单（原型污染防护·fail-open放行）`,
        });
      }
    }
  }
}

// ── migrate (public entry) ─────────────────────────────────────────────────────

export function migrate(input: unknown): MigrateResult {
  const { raw, log } = buildV41Raw(input);
  // buildV41Raw already emits new key names; applyPrefixRenames is a no-op here
  // but is exported for callers who load existing V4.1 saves with old key names.
  // Within-v4.1 migrations run here (after buildV41Raw v4.1 early-return path).
  const rawMigrated = backfillPhaseL1b(backfill货币账户PerEntity(backfillPackId(migrateS1S1b(migrate内容分级位置(raw)))));
  let state: RootState = RootSchema.parse(normalizeRegistryKeyNames(rawMigrated)); // S3 读卡口

  // Community-gate self-heal: 内容分级 !== 'community' 时强制 允许玩家覆盖=false，不 throw
  const strict = RootSchemaStrict.safeParse(state);
  if (!strict.success) {
    const healedRegistry = { ...state.调用类型注册表 };
    for (const issue of strict.error.issues) {
      log.push({ level: 'warn', path: issue.path.join('/'), msg: issue.message });
      const key = issue.path[1];
      if (typeof key === 'string' && key in healedRegistry) {
        healedRegistry[key] = { ...healedRegistry[key]!, 允许玩家覆盖SystemPrompt: false };
      }
    }
    state = { ...state, 调用类型注册表: healedRegistry };
  }

  // K6①: derive load order; write tombstones for self-loop and cascade-rejected mods.
  // Determinism: tombstone map is keyed by record key; diagnostic dep lists are codepoint-sorted.
  const lor = computeLoadOrder(state.mod注册表);
  if (lor.rejected.length > 0) {
    const selfLoopSet = new Set(lor.graph.selfLoops);
    const rejectedSet = new Set(lor.rejected);
    const tombstones = { ...(state._mod墓碑库 ?? {}) } as _mod墓碑库Type;
    for (const key of lor.rejected) {
      const entry = state.mod注册表[key];
      const isSelfLoop = selfLoopSet.has(key);
      const packId = entry?.pack_id;
      const causal: string[] = (!isSelfLoop && entry)
        ? entry.依赖.filter(d => rejectedSet.has(d)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
        : [];
      const tomb: mod墓碑条目Type = {
        记录键: key,
        原因: isSelfLoop ? '自环' : '依赖被拒',
        ...(packId ? { pack_id: packId } : {}),
        ...(causal.length > 0 ? { 诊断: `依赖 [${causal.join(', ')}] 被拒` } : {}),
      };
      tombstones[key] = tomb;
    }
    state = { ...state, _mod墓碑库: tombstones };
  }

  // B3·K2: 基底契约 semver hard-reject.
  // For each enabled mod with a non-empty 基底契约, check against the current engine version.
  // Determinism: iterate registry keys in codepoint order; inputs are 基底契约 + _系统版本 only.
  // Mods already tombstoned (self-loop/cascade) are still checked — idempotent merge.
  {
    const engineVersion = typeof state._系统版本 === 'string' ? state._系统版本 : '';
    if (engineVersion !== '') {
      const coercedEngine = coerceSemver(engineVersion);
      const regKeys = Object.keys(state.mod注册表).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      const semverTombs = { ...(state._mod墓碑库 ?? {}) } as _mod墓碑库Type;
      let changed = false;
      for (const key of regKeys) {
        const entry = state.mod注册表[key];
        const contract = entry?.基底契约;
        if (!contract || contract.trim() === '') continue;
        let compatible: boolean;
        try {
          compatible = semverSatisfies(coercedEngine, contract);
        } catch {
          // Malformed range in 基底契约 — treat as incompatible; schema refine catches at parse time.
          compatible = false;
        }
        if (!compatible) {
          const packId = entry?.pack_id;
          const tomb: mod墓碑条目Type = {
            记录键: key,
            原因: 'semver不兼容',
            ...(packId ? { pack_id: packId } : {}),
            诊断: `基底契约 "${contract}" 不满足引擎版本 ${coercedEngine}`,
          };
          semverTombs[key] = tomb;
          changed = true;
        }
      }
      if (changed) state = { ...state, _mod墓碑库: semverTombs };
    }
  }

  // E-e: 冻结键改名 enforcement（mod-load 阶段·load 期硬拦·确定性）
  // 检出归并条目.别名 = 已冻结规范键（受治理键空间注册表.不可变:true）且 来源包 在 mod注册表 内 → 拒收 + 墓碑。
  // fail 行为：拒绝该条 mod 变更，不 crash 全局（与 semver/K6 同形）；多条违例合并为一条诊断串（确定性排序）。
  {
    const frozenKeys = new Set<string>(
      (state.受治理键空间注册表.键条目 ?? [])
        .filter((e) => e.不可变 === true)
        .map((e) => e.规范键),
    );
    if (frozenKeys.size > 0) {
      const violators = new Map<string, string[]>(); // modKey → violated aliases
      for (const entry of (state.键空间归并表.归并条目 ?? [])) {
        if (frozenKeys.has(entry.别名) && entry.来源包 !== undefined && entry.来源包 in state.mod注册表) {
          const list = violators.get(entry.来源包) ?? [];
          list.push(entry.别名);
          violators.set(entry.来源包, list);
        }
      }
      if (violators.size > 0) {
        const eeTombs = { ...(state._mod墓碑库 ?? {}) } as _mod墓碑库Type;
        for (const [modKey, aliases] of violators) {
          const packId = state.mod注册表[modKey]?.pack_id;
          const tomb: mod墓碑条目Type = {
            记录键: modKey,
            原因: '冻结键改名',
            ...(packId !== undefined ? { pack_id: packId } : {}),
            诊断: `冻结键 [${[...aliases].sort().join(', ')}] 被声明为归并别名，mod 拒收`,
          };
          eeTombs[modKey] = tomb;
        }
        state = { ...state, _mod墓碑库: eeTombs };
      }
    }
  }

  // K1·B6: derive mod-aware whitelist and run dry-run assertion (fail-closed).
  // lor was computed above (after self-loop/cascade/semver tombstone passes).
  // Empty registry → flattenedLoadOrder = [] → modPaths = {} → trivially passes.
  {
    const whitelist = deriveModAwareWhitelist(lor, state.mod注册表);
    const dr = runDryRun(whitelist);
    const failing = (['checkA', 'checkB', 'checkC'] as const).filter(k => !dr[k].pass);
    if (failing.length > 0) {
      const detail = failing.map(k => `${k}: ${JSON.stringify(dr[k])}`).join('; ');
      throw new Error(`K1·白名单干跑失败（B6·import-gate）: ${detail}`);
    }
  }

  // B6·S1/S1b write gate: read gate (line above RootSchema.parse) must have normalized all keys first.
  // Any violations here = regression (future write path bypassed normalizeRegistryKeyNames).
  const _gwViolations = assertGovernedKeysNormalized(state as unknown as Record<string, unknown>);
  if (_gwViolations.length > 0) {
    const detail = _gwViolations.map(v => `${v.field}: "${v.raw}" → "${v.normalized}"`).join('; ');
    throw new Error(`受治理键空间写卡口（B6·S1/S1b）: 未归一键名 [${detail}]`);
  }

  // S3·写卡口（fail-open·最靠后·state 已定型·绝不 mutate）
  checkS3WriteGate(state, log);

  return { state, log };
}
