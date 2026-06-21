// G1b3a · 调试 fixture 三规模（小城 / 大陆 / 整世界）
//
// 铁律:
//   - 仅用于 web-debug / 测试调试目的；不进 core 包·不进黄金 fixture
//   - 每个 fixture 使用独立 seed（100/200/300），与黄金 seed=42 严格隔离
//   - 同 seed 同 presetVersion 两次调用 → 逐位恒等（确定性）
//   - 所有随机性走 autoCompleteRelations(rng.ts)·禁 Math.random/Date.now
//   - 明确标注「调试 fixture · 非真预设」；不替代真预设装载（WORLD_SETUP 空壳留 PR-0）
//
// 规模说明:
//   小城 (seed=100): 3 NPC · 1 地点 — 与 world.js 同规模（仅参数不同）
//   大陆 (seed=200): 6 NPC · 3 地点 — 含组织 → NPC.所属组织 产生 score≥60 关系边（Phase6 可见）
//   整世界(seed=300): 12 NPC · 5 地点 — 含 2 组织·关系图稠密·压力测试规模
//
// Schema 对齐（重要）:
//   地点数据放 地图.地点（z.record 键→地点条目Schema）；全局Schema 无 地点 字段
//   组织成员走 NPC.所属组织[]；autoCompleteRelations 读该字段·不读全局Schema

import { RootSchema } from '@ai-life-sim/core';
import { autoCompleteRelations } from '@ai-life-sim/core/engine/relationGraph';
import type { RootState } from '@ai-life-sim/core';
import type { DebugFixture, FixtureName } from '../aohpDebugConsole.js';
import { DEBUG_FIXTURE_LABEL } from '../aohpDebugConsole.js';

// ── 种子常量（与黄金向量 seed=42 隔离·不得使用 42） ─────────────────────────────

export const SMALL_SEED  = 100;
export const MEDIUM_SEED = 200;
export const LARGE_SEED  = 300;

// ── 小城 fixture （seed=100 · 3 NPC · 1 地点）───────────────────────────────────

/** 小城：玉华镇茶馆 · 3 NPC（共址·无组织·关系边 score max=40·不触发 Phase6） */
export function buildDebugFixtureSmall(): RootState {
  const world = RootSchema.parse({
    全局: { 秘密库: {} },
    地图: {
      地点: {
        loc_yuhua_tea: { 名称: '玉华镇茶馆', 类别: '室内', 大小: '小型' },
      },
    },
    NPC: {
      npc_tea_master: {
        姓名: '茶博士',
        位置: 'loc_yuhua_tea',
        属性: { 体质: 4, 魅力: 7 },
      },
      npc_storyteller: {
        姓名: '说书人',
        位置: 'loc_yuhua_tea',
        属性: { 体质: 5, 魅力: 6 },
      },
      npc_merchant: {
        姓名: '赶路商人',
        位置: 'loc_yuhua_tea',
        属性: { 体质: 6, 魅力: 5 },
      },
    },
    货币系统: {
      基准币种: '文',
      账户: {
        npc_tea_master:  { 持有: { 文: 150 } },
        npc_storyteller: { 持有: { 文: 30 } },
        npc_merchant:    { 持有: { 文: 200 } },
        _sink:           { 持有: { 文: 0 } },
      },
    },
  });
  return autoCompleteRelations(world, SMALL_SEED, 0);
}

// ── 大陆 fixture （seed=200 · 6 NPC · 3 地点 · 含同组织 NPC）──────────────────────

/**
 * 大陆：金陵商路 · 6 NPC · 3 地点。
 * 3 名商会 NPC 共处 loc_fengwei_tavern + 同属 org_merchant_guild
 * → autoCompleteRelations: colocated + sameOrg → strength ≥ 60 (COLOC_BASE+ORG_BONUS=60) → score≥60 ≥ 50
 * → Phase6 关系触发可见（G1a/G1b 成果肉眼可见）
 */
export function buildDebugFixtureMedium(): RootState {
  const world = RootSchema.parse({
    全局: { 秘密库: {} },
    地图: {
      地点: {
        loc_jinling_inn:    { 名称: '金陵驿站',   类别: '室内', 大小: '中型' },
        loc_fengwei_tavern: { 名称: '丰味酒楼',   类别: '室内', 大小: '中型' },
        loc_east_market:    { 名称: '东市集',     类别: '室外', 大小: '大型' },
      },
    },
    NPC: {
      // 同地点 + 同组织 → score ≥ 60 → Phase6 触发
      npc_guild_master: {
        姓名: '赵会长',
        位置: 'loc_fengwei_tavern',
        属性: { 体质: 5, 魅力: 8 },
        所属组织: [{ 组织键: 'org_merchant_guild', 职务: '会长', 派系: '主流' }],
      },
      npc_silk_trader: {
        姓名: '李丝商',
        位置: 'loc_fengwei_tavern',
        属性: { 体质: 4, 魅力: 6 },
        所属组织: [{ 组织键: 'org_merchant_guild', 职务: '理事', 派系: '主流' }],
      },
      npc_grain_broker: {
        姓名: '孙粮行',
        位置: 'loc_fengwei_tavern',
        属性: { 体质: 6, 魅力: 5 },
        所属组织: [{ 组织键: 'org_merchant_guild', 职务: '理事', 派系: '主流' }],
      },
      // 驿站两位 NPC（共址·无组织·score max=40）
      npc_innkeeper: {
        姓名: '驿站掌柜',
        位置: 'loc_jinling_inn',
        属性: { 体质: 5, 魅力: 6 },
      },
      npc_traveler_a: {
        姓名: '过路旅人甲',
        位置: 'loc_jinling_inn',
        属性: { 体质: 7, 魅力: 4 },
      },
      // 市集独行 NPC
      npc_market_seller: {
        姓名: '市集小贩',
        位置: 'loc_east_market',
        属性: { 体质: 5, 魅力: 5 },
      },
    },
    货币系统: {
      基准币种: '文',
      账户: {
        npc_guild_master:  { 持有: { 文: 500 } },
        npc_silk_trader:   { 持有: { 文: 300 } },
        npc_grain_broker:  { 持有: { 文: 250 } },
        npc_innkeeper:     { 持有: { 文: 200 } },
        npc_traveler_a:    { 持有: { 文: 80 } },
        npc_market_seller: { 持有: { 文: 100 } },
        _sink:             { 持有: { 文: 0 } },
      },
    },
  });
  return autoCompleteRelations(world, MEDIUM_SEED, 0);
}

// ── 整世界 fixture （seed=300 · 12 NPC · 5 地点 · 2 组织）──────────────────────────

/**
 * 整世界：五域图 · 12 NPC · 5 地点 · 2 组织（朝廷/江湖）
 * 多组织多地点 → 关系图稠密 → 压力测试规模
 */
export function buildDebugFixtureLarge(): RootState {
  const world = RootSchema.parse({
    全局: { 秘密库: {} },
    地图: {
      地点: {
        loc_imperial_city:   { 名称: '皇城',     类别: '室内', 大小: '超大型' },
        loc_border_fort:     { 名称: '边关',     类别: '室外', 大小: '大型' },
        loc_wulin_town:      { 名称: '江湖名镇', 类别: '室外', 大小: '大型' },
        loc_harbor:          { 名称: '海港',     类别: '室外', 大小: '大型' },
        loc_mountain_temple: { 名称: '深山寺庙', 类别: '室外', 大小: '小型' },
      },
    },
    NPC: {
      // 朝廷组织（同地点loc_imperial_city + 同组织 → score≥60）
      npc_general: {
        姓名: '陈将军',
        位置: 'loc_imperial_city',
        属性: { 体质: 9, 魅力: 6 },
        所属组织: [{ 组织键: 'org_court', 职务: '将军', 派系: '主战' }],
      },
      npc_official_a: {
        姓名: '钱御史',
        位置: 'loc_imperial_city',
        属性: { 体质: 4, 魅力: 8 },
        所属组织: [{ 组织键: 'org_court', 职务: '御史', 派系: '主和' }],
      },
      npc_spy_master: {
        姓名: '影统领',
        位置: 'loc_imperial_city',
        属性: { 体质: 7, 魅力: 7 },
        所属组织: [{ 组织键: 'org_court', 职务: '密探', 派系: '主和' }],
      },
      // 边关（共址·无组织）
      npc_border_commander: {
        姓名: '关口校尉',
        位置: 'loc_border_fort',
        属性: { 体质: 8, 魅力: 5 },
      },
      npc_border_merchant: {
        姓名: '边境商人',
        位置: 'loc_border_fort',
        属性: { 体质: 6, 魅力: 6 },
      },
      // 江湖组织（同地点loc_wulin_town + 同组织 → score≥60）
      npc_swordsman: {
        姓名: '剑客宗主',
        位置: 'loc_wulin_town',
        属性: { 体质: 9, 魅力: 7 },
        所属组织: [{ 组织键: 'org_jianghu', 职务: '盟主', 派系: '正道' }],
      },
      npc_assassin: {
        姓名: '暗杀者',
        位置: 'loc_wulin_town',
        属性: { 体质: 8, 魅力: 4 },
        所属组织: [{ 组织键: 'org_jianghu', 职务: '杀手', 派系: '邪道' }],
      },
      npc_medicine_man: {
        姓名: '游方医',
        位置: 'loc_wulin_town',
        属性: { 体质: 5, 魅力: 7 },
        所属组织: [{ 组织键: 'org_jianghu', 职务: '医师', 派系: '中立' }],
      },
      // 海港（共址·无组织）
      npc_harbor_captain: {
        姓名: '港口船长',
        位置: 'loc_harbor',
        属性: { 体质: 7, 魅力: 6 },
      },
      npc_harbor_smuggler: {
        姓名: '走私商',
        位置: 'loc_harbor',
        属性: { 体质: 6, 魅力: 5 },
      },
      // 深山（共址）
      npc_monk_abbot: {
        姓名: '方丈',
        位置: 'loc_mountain_temple',
        属性: { 体质: 4, 魅力: 9 },
      },
      npc_hermit: {
        姓名: '隐士',
        位置: 'loc_mountain_temple',
        属性: { 体质: 5, 魅力: 6 },
      },
    },
    货币系统: {
      基准币种: '文',
      账户: {
        npc_general:          { 持有: { 文: 800 } },
        npc_official_a:       { 持有: { 文: 600 } },
        npc_spy_master:       { 持有: { 文: 400 } },
        npc_border_commander: { 持有: { 文: 300 } },
        npc_border_merchant:  { 持有: { 文: 250 } },
        npc_swordsman:        { 持有: { 文: 350 } },
        npc_assassin:         { 持有: { 文: 500 } },
        npc_medicine_man:     { 持有: { 文: 150 } },
        npc_harbor_captain:   { 持有: { 文: 400 } },
        npc_harbor_smuggler:  { 持有: { 文: 700 } },
        npc_monk_abbot:       { 持有: { 文: 50 } },
        npc_hermit:           { 持有: { 文: 30 } },
        _sink:                { 持有: { 文: 0 } },
      },
    },
  });
  return autoCompleteRelations(world, LARGE_SEED, 0);
}

// ── fixture 注册表 ─────────────────────────────────────────────────────────────

export const DEBUG_FIXTURES: DebugFixture[] = [
  {
    name: '小城' as FixtureName,
    label: `小城·玉华镇茶馆 ${DEBUG_FIXTURE_LABEL}`,
    seed: SMALL_SEED,
    npcCount: 3,
    locationCount: 1,
    buildState: buildDebugFixtureSmall,
  },
  {
    name: '大陆' as FixtureName,
    label: `大陆·金陵商路 ${DEBUG_FIXTURE_LABEL}`,
    seed: MEDIUM_SEED,
    npcCount: 6,
    locationCount: 3,
    buildState: buildDebugFixtureMedium,
  },
  {
    name: '整世界' as FixtureName,
    label: `整世界·五域图 ${DEBUG_FIXTURE_LABEL}`,
    seed: LARGE_SEED,
    npcCount: 12,
    locationCount: 5,
    buildState: buildDebugFixtureLarge,
  },
];

/** 按名称获取调试 fixture */
export function getDebugFixture(name: FixtureName): DebugFixture {
  const f = DEBUG_FIXTURES.find(x => x.name === name);
  if (!f) throw new Error(`[debugFixtures] unknown fixture name: '${name}'`);
  return f;
}
