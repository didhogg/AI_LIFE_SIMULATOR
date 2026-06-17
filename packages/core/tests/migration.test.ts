import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { describe, it, expect } from 'vitest';
import { migrate, buildV41Raw, applyPrefixRenames, backfillPackId, parseChineseDateToEpochMin, getTickMinutes } from '../migration/migrate.js';

const __dir = dirname(fileURLToPath(import.meta.url));
function loadFixture(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(__dir, '../../../docs/fixtures/', name), 'utf-8')) as Record<string, unknown>;
}

const richV31 = loadFixture('stat_data_v31_rich.json');
const blankV31 = loadFixture('stat_data_v31_blank.json');
const legacyV40 = loadFixture('mod_pack_legacy_v40.json');

// ── Helpers ────────────────────────────────────────────────────────────────────

function asRec(v: unknown): Record<string, unknown> {
  if (typeof v === 'object' && v !== null && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}
function asArr(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (typeof v === 'object' && v !== null) return Object.values(v as Record<string, unknown>);
  return [];
}
function asNum(v: unknown, fb = 0): number { const n = Number(v); return Number.isFinite(n) ? n : fb; }
function asStr(v: unknown, fb = ''): string { return typeof v === 'string' ? v : fb; }

// ── Basic: parse without throw ─────────────────────────────────────────────────

describe('migrate V3.1 → V4.1', () => {
  it('blank fixture: parses without throw', () => {
    expect(() => migrate(blankV31)).not.toThrow();
  });

  it('rich fixture: parses without throw', () => {
    expect(() => migrate(richV31)).not.toThrow();
  });

  it('output has _系统版本 4.1', () => {
    expect(migrate(richV31).state['_系统版本']).toBe('4.1');
  });

  it('rich fixture: 席位表.本机.焦点角色键 = 邓婉清', () => {
    const seat = asRec(asRec(migrate(richV31).state['_席位表'])['本机']);
    expect(seat['焦点角色键']).toBe('邓婉清');
  });

  // ── 防回归断言① ────────────────────────────────────────────────────────────────
  // All stored time fields ≥ protagonist birth date.
  // Exempt: 0-sentinel fields (死亡时间=0健在, 状态标签.到期=0永久, 上次互动=0未互动).
  it('断言①: worldEpochMin ≥ 出生日期 (rich)', () => {
    const result = migrate(richV31);
    const npcRec = asRec(result.state['NPC']);
    const protagonist = asRec(npcRec['邓婉清']);
    const 出生日期 = asNum(protagonist['出生日期']);
    const worldEpochMin = asNum(asRec(result.state['世界'])['纪元分钟']);

    expect(出生日期).toBeGreaterThan(0);
    expect(worldEpochMin).toBeGreaterThanOrEqual(出生日期);

    // Verify epoch calculation: 2000-10-02 < 2001-10-17
    expect(出生日期).toBe(parseChineseDateToEpochMin('2000年10月02日'));
    expect(worldEpochMin).toBe(parseChineseDateToEpochMin('2001年10月17日'));
    expect(worldEpochMin).toBeGreaterThan(出生日期);
  });

  it('断言①: 上次互动 ≥ 出生日期 for NPCs (non-zero)', () => {
    const result = migrate(richV31);
    const npcRec = asRec(result.state['NPC']);
    const 出生日期 = asNum(asRec(npcRec['邓婉清'])['出生日期']);

    for (const [key, npcVal] of Object.entries(npcRec)) {
      const npc = asRec(npcVal);
      const 上次互动 = asNum(npc['上次互动']);
      if (上次互动 > 0) {
        expect(上次互动, `NPC ${key} 上次互动`).toBeGreaterThanOrEqual(出生日期);
      }
    }
  });

  // ── 防回归断言② ────────────────────────────────────────────────────────────────
  // #2 拍板：截止型时刻字段统一 .default(0)，0 = 哨兵（永久/健在/未记录）
  // 迁移直接写 0，不依赖 Zod 回填
  it('断言②: 居留身份.到期 = 0 when 到期周期 = -1 (永久)', () => {
    const { raw } = buildV41Raw(richV31);
    const npcRec = asRec(raw['NPC']);
    const protagonist = asRec(npcRec['邓婉清']);
    const residencies = asArr(protagonist['居留身份']);

    expect(residencies.length).toBeGreaterThan(0);
    for (const r of residencies) {
      expect(asRec(r)['到期']).toBe(0); // 0 = 永久哨兵
    }
  });

  it('断言②: 死亡时间 = 0 for living protagonist (健在哨兵)', () => {
    const { raw } = buildV41Raw(richV31);
    const protagonist = asRec(asRec(raw['NPC'])['邓婉清']);
    expect(protagonist['死亡时间']).toBe(0); // 0 = 健在
  });

  // ── 防回归断言③ ────────────────────────────────────────────────────────────────
  // Protagonist NPC must have all five core fields.
  it('断言③: 主角NPC 有 技能/物品/衣物/爱好/信念 (rich)', () => {
    const result = migrate(richV31);
    const protagonist = asRec(asRec(result.state['NPC'])['邓婉清']);
    expect(protagonist['技能']).toBeDefined();
    expect(protagonist['物品']).toBeDefined();
    expect(protagonist['衣物']).toBeDefined();
    expect(protagonist['爱好']).toBeDefined();
    expect(protagonist['信念']).toBeDefined();
  });

  it('断言③: 主角NPC 有 技能/物品/衣物/爱好/信念 (blank)', () => {
    const result = migrate(blankV31);
    const focusKey = asStr(asRec(asRec(result.state['_席位表'])['本机'])['焦点角色键']);
    const protagonist = asRec(asRec(result.state['NPC'])[focusKey]);
    expect(protagonist['技能']).toBeDefined();
    expect(protagonist['物品']).toBeDefined();
    expect(protagonist['衣物']).toBeDefined();
    expect(protagonist['爱好']).toBeDefined();
    expect(protagonist['信念']).toBeDefined();
  });

  // ── 防回归断言④ ────────────────────────────────────────────────────────────────
  // 受制于 回归: every holder in old 受制于[] must appear in 秘密库.*.知情名单 with 立场=利用.
  it('断言④: 受制于 = [] → no "利用" 知情名单 entries (rich fixture, trivial pass)', () => {
    const result = migrate(richV31);
    const 秘密库 = asRec(asRec(result.state['全局'])['秘密库']);
    let 利用Count = 0;
    for (const secretVal of Object.values(秘密库)) {
      for (const item of asArr(asRec(secretVal)['知情名单'])) {
        if (asStr(asRec(item)['立场']) === '利用') 利用Count++;
      }
    }
    expect(利用Count).toBe(0); // 受制于 is empty in rich fixture
  });

  it('断言④: 受制于 holders appear in 秘密库.知情名单 (synthetic input)', () => {
    const syntheticV31: Record<string, unknown> = {
      ...richV31,
      主角: {
        ...asRec(richV31['主角']),
        秘密索引: { 把柄A: { 类型: '把柄', 目标: '', 进展: 10, 严重度: 50, 已暴露线索: [], 知情圈: {}, $谜底: '测试' } },
        受制于: [{ 秘密键: '把柄A', 持柄方: '反派甲' }],
      },
    };
    const result = migrate(syntheticV31);
    const 秘密库 = asRec(asRec(result.state['全局'])['秘密库']);
    const secret = asRec(秘密库['邓婉清_把柄A']);
    expect(secret).toBeDefined();
    const 知情名单 = asArr(secret['知情名单']);
    const holder = 知情名单.find(item => asStr(asRec(item)['对象']) === '反派甲' && asStr(asRec(item)['立场']) === '利用');
    expect(holder).toBeDefined();
  });

  // ── 幂等性 ────────────────────────────────────────────────────────────────────
  it('幂等性: migrate(migrate(rich)) deep-equals migrate(rich)', () => {
    const first = migrate(richV31).state;
    const second = migrate(first).state;
    expect(second).toEqual(first);
  });

  it('幂等性: migrate(migrate(blank)) deep-equals migrate(blank)', () => {
    const first = migrate(blankV31).state;
    const second = migrate(first).state;
    expect(second).toEqual(first);
  });

  // ── applyPrefixRenames 幂等性 ──────────────────────────────────────────────
  it('applyPrefixRenames: 二次迁移幂等（same input → byte-identical output）', () => {
    // Simulate an old V4.1 save with pre-rename key names
    const oldV41Raw: Record<string, unknown> = {
      状态机: { 当前态: 'PLAYING', 模态栈: [], timeMode: 'PAUSED', 双时钟: { 世界钟: 0, 镜头钟: 0 } },
      系统: { schema_version: 0, migration_version: 3, last_migration: 0, tick_log: [], 已结算标记: {}, 功能开关表: {}, 事件来源权重: { 事件包: 50, AI自发: 50 } },
      存档头: { 全局回滚计数器: 0 },
      席位表: { 本机: { 焦点角色键: 'hero', 控制者: '人类', 连接状态: '本地' } },
      全局: { 覆写日志: [], 作弊标记: false, 编年史: [] },
    };

    const once = applyPrefixRenames(oldV41Raw);
    const twice = applyPrefixRenames(once);

    // Result is identical on second application (idempotent)
    expect(twice).toEqual(once);

    // Confirm rename actually happened
    expect('_状态机' in once).toBe(true);
    expect('状态机' in once).toBe(false);
    expect('_系统' in once).toBe(true);
    expect('_存档头' in once).toBe(true);
    expect('_席位表' in once).toBe(true);
    const 全局 = once['全局'] as Record<string, unknown>;
    expect('_覆写日志' in 全局).toBe(true);
    expect('_编年史' in 全局).toBe(true);
    expect('_作弊标记' in 全局).toBe(true);

    // migration_version bumped exactly once (not twice)
    const sys = once['_系统'] as Record<string, unknown>;
    expect(sys['migration_version']).toBe(4); // 3 + 1
    const sys2 = twice['_系统'] as Record<string, unknown>;
    expect(sys2['migration_version']).toBe(4); // unchanged on second pass
  });

  // ── backfillPackId 幂等性（K6 批⑤·Step 2）─────────────────────────────────────
  it('backfillPackId: 空注册表 no-op（migration_version 不变）', () => {
    const raw = { mod注册表: {}, _系统: { migration_version: 5 } };
    const result = backfillPackId(raw);
    expect(result).toBe(raw);  // 同一引用 = 未产生新对象
    expect((result['_系统'] as Record<string, unknown>)['migration_version']).toBe(5);
  });

  it('backfillPackId: 缺 pack_id 的条目从 record key 回填·migration_version +1', () => {
    const raw = {
      mod注册表: { my_mod: { 版本: '1.0', 启用: true } },
      _系统: { migration_version: 2 },
    };
    const once = backfillPackId(raw);
    const reg = once['mod注册表'] as Record<string, Record<string, unknown>>;
    expect(reg['my_mod']?.['pack_id']).toBe('my_mod');
    expect((once['_系统'] as Record<string, unknown>)['migration_version']).toBe(3);
  });

  it('backfillPackId: 二次运行幂等·migration_version 不再 +1·pack_id 不变', () => {
    const raw = {
      mod注册表: { my_mod: { 版本: '1.0' } },
      _系统: { migration_version: 2 },
    };
    const once = backfillPackId(raw);
    const twice = backfillPackId(once);
    expect(twice).toBe(once);  // 同一引用 = 完全 no-op
    const reg = twice['mod注册表'] as Record<string, Record<string, unknown>>;
    expect(reg['my_mod']?.['pack_id']).toBe('my_mod');
    expect((twice['_系统'] as Record<string, unknown>)['migration_version']).toBe(3);
  });

  it('backfillPackId: 已有 pack_id 的条目不被覆盖', () => {
    const raw = {
      mod注册表: { key_a: { pack_id: 'existing_id' } },
      _系统: { migration_version: 0 },
    };
    const result = backfillPackId(raw);
    expect(result).toBe(raw);  // no-op：所有条目已有 pack_id
    const reg = result['mod注册表'] as Record<string, Record<string, unknown>>;
    expect(reg['key_a']?.['pack_id']).toBe('existing_id');
  });

  // ── 故障注入: 极端 / 空输入 ────────────────────────────────────────────────────
  it('故障注入: null input returns valid V4.1 state', () => {
    expect(() => migrate(null)).not.toThrow();
    expect(migrate(null).state['_系统版本']).toBe('4.1');
  });

  it('故障注入: empty object returns valid V4.1 state', () => {
    expect(() => migrate({})).not.toThrow();
    expect(migrate({}).state['_系统版本']).toBe('4.1');
  });

  it('故障注入: all-null fields still produces valid V4.1', () => {
    const broken: Record<string, unknown> = { _系统版本: '3.1', 主角: null, NPC: null, 世界: null };
    expect(() => migrate(broken)).not.toThrow();
  });

  // ── 映射表验证 ────────────────────────────────────────────────────────────────
  it('GAME_MODE_MAP: CHARACTER_CREATION → CHARACTER_CREATE', () => {
    const result = migrate(richV31); // rich fixture has CHARACTER_CREATION
    expect(asStr(asRec(result.state['_状态机'])['当前态'])).toBe('CHARACTER_CREATE');
  });

  it('REALISM_MAP: 轻度戏剧化 → 0.5', () => {
    const result = migrate(richV31);
    expect(asNum(asRec(result.state['$玩家偏好'])['写实程度'])).toBe(0.5);
  });

  it('PROSPERITY_MAP: 平稳 → 50', () => {
    const result = migrate(richV31);
    expect(asNum(asRec(asRec(result.state['货币系统'])['市场状态'])['大盘景气'])).toBe(50);
  });

  // ── 旧四天赋 union merge ───────────────────────────────────────────────────────
  it('旧四天赋 union merged into 特质{} (rich)', () => {
    const result = migrate(richV31);
    const 特质 = asRec(asRec(asRec(result.state['NPC'])['邓婉清'])['特质']);
    // Rich fixture: 正面天赋.语言天才, 负面天赋.容貌焦虑症, 先天缺陷.单耳听力障碍
    expect('语言天才' in 特质).toBe(true);
    expect('容貌焦虑症' in 特质).toBe(true);
    expect('单耳听力障碍' in 特质).toBe(true);
  });

  // ── 子嗣 → NPC 库 ──────────────────────────────────────────────────────────────
  it('子嗣 migrates to NPC[] with 亲子 extension (synthetic)', () => {
    const syntheticV31: Record<string, unknown> = {
      ...richV31,
      主角: {
        ...asRec(richV31['主角']),
        子嗣: {
          小明: { 称呼: '小明', 性别: '男', 年龄: 5, 人生阶段: '童年', 存活状态: '存活', 好感度: 70, 关系深度: 20, 性格: 'ENFP', 属性: { 体质: 8, 智慧: 9, 魅力: 7, 心理: 8 }, 继承意愿: '稳定', 子嗣工作记忆: [] },
        },
      },
    };
    const result = migrate(syntheticV31);
    const npcRec = asRec(result.state['NPC']);
    expect('小明' in npcRec).toBe(true);
    const 小明 = asRec(npcRec['小明']);
    expect(小明['亲子']).toBeDefined();
    expect(小明['继承预案']).toBeDefined();
  });

  // ── 约束状态 → 状态标签 ────────────────────────────────────────────────────────
  it('约束状态 migrates into 状态标签 with 到期=0 for -1 (永久)', () => {
    const result = migrate(richV31);
    const 状态标签 = asRec(asRec(asRec(result.state['NPC'])['邓婉清'])['状态标签']);
    // Rich fixture: 约束状态.上学 with 到期周期:-1
    expect('V3约束_上学' in 状态标签).toBe(true);
    const 上学 = asRec(状态标签['V3约束_上学']);
    expect(asNum(上学['到期'])).toBe(0); // 0 = 永久哨兵
    expect(asStr(上学['来源'])).toMatch(/强度:中/);
  });

  // ── 压力值 → 状态标签 (fix ⑤) ─────────────────────────────────────────────────
  it('压力值 → 状态标签 V3迁移_压力 with capped 强度 and 原值来源', () => {
    const syntheticV31: Record<string, unknown> = {
      ...richV31,
      主角: { ...asRec(richV31['主角']), 心理: { 情绪基调: '压抑', 压力值: 35, 心理韧性: 40, 活跃心理状态: '' } },
    };
    const result = migrate(syntheticV31);
    const 状态标签 = asRec(asRec(asRec(result.state['NPC'])['邓婉清'])['状态标签']);
    expect('V3迁移_压力' in 状态标签).toBe(true);
    const label = asRec(状态标签['V3迁移_压力']);
    const effects = asArr(label['效果']);
    expect(effects.length).toBeGreaterThan(0);
    const eff = asRec(effects[0]);
    // -min(20, round(35/5)) = -min(20,7) = -7
    expect(asNum(eff['强度'])).toBe(-7);
    expect(asStr(label['来源'])).toMatch(/原值:35/);
  });

  it('压力值 强度 caps at -20 for large values', () => {
    const syntheticV31: Record<string, unknown> = {
      ...richV31,
      主角: { ...asRec(richV31['主角']), 心理: { 情绪基调: '崩溃', 压力值: 200, 心理韧性: 10, 活跃心理状态: '' } },
    };
    const result = migrate(syntheticV31);
    const 状态标签 = asRec(asRec(asRec(result.state['NPC'])['状态标签']));
    const label = asRec(asRec(asRec(result.state['NPC'])['邓婉清'])['状态标签'])['V3迁移_压力'];
    const eff = asRec(asArr(asRec(label)['效果'])[0]);
    // -min(20, round(200/5)) = -min(20,40) = -20
    expect(asNum(eff['强度'])).toBe(-20);
    void 状态标签; // silence unused warning
  });

  // ── 货币系统 ──────────────────────────────────────────────────────────────────
  it('货币系统 market state 大盘景气 string → number', () => {
    const result = migrate(richV31);
    const 市场 = asRec(asRec(result.state['货币系统'])['市场状态']);
    expect(typeof 市场['大盘景气']).toBe('number');
  });

  // ── 时间工具 ──────────────────────────────────────────────────────────────────
  it('getTickMinutes: 月=43200, 日=1440, 年=518400, 即时=5', () => {
    expect(getTickMinutes('月')).toBe(43200);
    expect(getTickMinutes('日')).toBe(1440);
    expect(getTickMinutes('年')).toBe(518400);
    expect(getTickMinutes('即时')).toBe(5);
    expect(getTickMinutes('unknown')).toBe(43200); // fallback
  });

  it('parseChineseDateToEpochMin: 1970年01月01日 = 0', () => {
    expect(parseChineseDateToEpochMin('1970年01月01日')).toBe(0);
  });

  it('parseChineseDateToEpochMin: invalid returns 0', () => {
    expect(parseChineseDateToEpochMin('待初始化')).toBe(0);
    expect(parseChineseDateToEpochMin('')).toBe(0);
  });

  it('parseChineseDateToEpochMin: 2000年10月02日 consistent with world epoch', () => {
    const birth = parseChineseDateToEpochMin('2000年10月02日');
    const world = parseChineseDateToEpochMin('2001年10月17日');
    expect(birth).toBeGreaterThan(0);
    expect(world).toBeGreaterThan(birth);
    // ~1 year = ~12 months × 43200 = 518400 min (game calendar), or ~525960 min (Gregorian)
    expect(world - birth).toBeGreaterThan(400000);
    expect(world - birth).toBeLessThan(600000);
  });

  // ── K7: possible_years 原件入迁移日志 ──────────────────────────────────────────
  it('K7: possible_years preserved in migration log', () => {
    const syntheticV31: Record<string, unknown> = {
      ...richV31,
      $隐藏记忆库: {
        延时种子: {
          seed1: { 载荷: '伏笔A', 类型: '伏笔', 成熟日: -1, 权重: 10, era_label: '千禧年代', possible_years: { mode: 'range', min: 2010, max: 2020 } },
        },
        彩蛋池: {},
      },
    };
    const { log } = migrate(syntheticV31);
    const k7Entry = log.find(e => e['msg'].includes('possible_years'));
    expect(k7Entry).toBeDefined();
    expect(k7Entry?.['level']).toBe('info');
    expect(k7Entry?.['orig']).toEqual({ mode: 'range', min: 2010, max: 2020 });
  });

  // ── LOYALTY_MAP ───────────────────────────────────────────────────────────────
  it('LOYALTY_MAP: NPC 向背=稳定 → 忠诚.$真实值=70', () => {
    const syntheticV31: Record<string, unknown> = {
      ...richV31,
      NPC: {
        测试NPC: { 称呼: '测试NPC', 关系标签: '朋友', 标签: [], 性格: '', 背景: '', 备注: '', 好感度: 70, 基线: 70, 信任度: 60, 关系深度: 20, 是否在场: 1, 关联地点: '', 关系大类: '朋友', 性别: '男', 向背: '稳定' },
      },
    };
    const result = migrate(syntheticV31);
    const npc = asRec(asRec(result.state['NPC'])['测试NPC']);
    const 忠诚 = asRec(npc['忠诚']);
    const entry = asRec(忠诚['邓婉清']);
    expect(asNum(entry['$真实值'])).toBe(70);
  });

  // ── P0-2 Fix #1: 子嗣→家族树双亲边 ──────────────────────────────────────────

  it('子嗣→家族树双亲边写入 (with 配偶，世代=主角世代+1)', () => {
    const syntheticV31: Record<string, unknown> = {
      ...richV31,
      主角: {
        ...asRec(richV31['主角']),
        子嗣: {
          子一: { 称呼: '子一', 性别: '男', 好感度: 80, 关系深度: 30, 存活状态: '存活', 属性: {}, 子嗣工作记忆: [], 继承意愿: '' },
        },
      },
      家庭: { 父亲状态: '健在', 母亲状态: '健在', 婚姻: [{ 配偶: '配偶甲', 状态: '已婚', 缔结: 0, 终止: -1 }], 婚姻状态: '已婚', 配偶姓名: '配偶甲', 子女数量: 1, 子女名单: {} },
    };
    const result = migrate(syntheticV31);
    const 主角键 = asStr(asRec(asRec(result.state['_席位表'])['本机'])['焦点角色键']);
    const 家族树 = asRec(asRec(result.state['全局'])['家族树']);
    const 边 = asRec(家族树['边']);

    expect('子一' in 边).toBe(true);
    const 双亲边 = asArr(asRec(边['子一'])['双亲边']);
    expect(双亲边.some(e => asStr(asRec(e)['parent_id']) === 主角键)).toBe(true);
    expect(双亲边.some(e => asStr(asRec(e)['parent_id']) === '配偶甲')).toBe(true);

    const 主角世代 = asNum(asRec(asRec(result.state['NPC'])[主角键])['世代']);
    const 子一世代 = asNum(asRec(asRec(result.state['NPC'])['子一'])['世代']);
    expect(子一世代).toBe(主角世代 + 1);
  });

  it('子嗣→家族树: 无配偶时创建 6.30 幽灵节点', () => {
    const syntheticV31: Record<string, unknown> = {
      ...richV31,
      主角: {
        ...asRec(richV31['主角']),
        子嗣: {
          孤儿: { 称呼: '孤儿', 性别: '女', 好感度: 60, 关系深度: 20, 存活状态: '存活', 属性: {}, 子嗣工作记忆: [], 继承意愿: '' },
        },
      },
      家庭: { 父亲状态: '健在', 母亲状态: '健在', 婚姻: [], 婚姻状态: '未婚', 配偶姓名: '', 子女数量: 0, 子女名单: {} },
    };
    const result = migrate(syntheticV31);
    const 主角键 = asStr(asRec(asRec(result.state['_席位表'])['本机'])['焦点角色键']);
    const 家族树 = asRec(asRec(result.state['全局'])['家族树']);
    const 边 = asRec(家族树['边']);
    const 幽灵节点 = asRec(家族树['幽灵节点']);

    expect('孤儿' in 边).toBe(true);
    const 双亲边 = asArr(asRec(边['孤儿'])['双亲边']);
    expect(双亲边.some(e => asStr(asRec(e)['parent_id']) === 主角键)).toBe(true);
    const 鬼亲 = 双亲边.find(e => asStr(asRec(e)['parent_id']) !== 主角键);
    expect(鬼亲).toBeDefined();
    const ghostKey = asStr(asRec(鬼亲!)['parent_id']);
    expect(ghostKey in 幽灵节点).toBe(true);
  });

  // ── P0-2 Fix #2: 🗑️ 12键显式防回归 ─────────────────────────────────────────

  it('🗑️ 删键防回归: 11个旧顶层键迁移后消失；NPC无印象标签', () => {
    const syntheticInput: Record<string, unknown> = {
      ...richV31,
      NPC: {
        ...asRec(richV31['NPC']),
        有标签NPC: { ...asRec(asRec(richV31['NPC'])['邓照']), 印象标签: ['测试标签', '旧字段'] },
      },
    };
    const state = migrate(syntheticInput).state as Record<string, unknown>;

    // 11 个 V3.1 旧顶层键（Zod strip 模式静默丢弃）
    expect(state).not.toHaveProperty('主角');
    expect(state).not.toHaveProperty('家庭');
    expect(state).not.toHaveProperty('关系网');
    expect(state).not.toHaveProperty('约束状态');
    expect(state).not.toHaveProperty('待结算事件');
    expect(state).not.toHaveProperty('事件队列指针');
    expect(state).not.toHaveProperty('记忆库');
    expect(state).not.toHaveProperty('行动卡片池');
    expect(state).not.toHaveProperty('主角位置');
    expect(state).not.toHaveProperty('主角轨迹');
    expect(state).not.toHaveProperty('流程状态');

    // 无 NPC 应在迁移后含有 印象标签（V3.1 标签已归认知档案）
    for (const npcVal of Object.values(asRec(state['NPC']))) {
      expect(asRec(npcVal)).not.toHaveProperty('印象标签');
    }
  });

  // ── P0-2 Fix #3: 彩蛋池 / 工作记忆 ≥0 分支 ──────────────────────────────────

  it('彩蛋池 上次浮现周期 ≥0 → 上次浮现时间 = p2e(周期)', () => {
    const 世界 = asRec(richV31['世界']);
    const worldEpochMin = parseChineseDateToEpochMin(asStr(世界['当前日期']));
    const tickMin = getTickMinutes(asStr(世界['当前时间粒度']));
    const 周期数 = asNum(世界['周期数']);
    const targetPeriod = 5;
    const expected = worldEpochMin - (周期数 - targetPeriod) * tickMin;

    const syntheticV31: Record<string, unknown> = {
      ...richV31,
      $隐藏记忆库: {
        延时种子: {},
        彩蛋池: {
          egg1: { 原记忆id: 'mem1', 摘要: '测试彩蛋', 模糊钥匙: [], 关联地点: [], 关联物品: [], 关联意象: [], 关联NPC: [], 情绪基调: '', 录入时间: -1, 冷却到期: -1, 可浮现: 1, 已浮现: 0, 上次浮现时间: targetPeriod },
        },
      },
    };
    const result = migrate(syntheticV31);
    const egg1 = asRec(asRec(asRec(result.state['$隐藏记忆库'])['彩蛋池'])['egg1']);
    expect(asNum(egg1['上次浮现时间'])).toBe(expected);
  });

  it('工作记忆 上次浮现周期 ≥0 → 上次浮现时间 = p2e(周期)', () => {
    const 世界 = asRec(richV31['世界']);
    const worldEpochMin = parseChineseDateToEpochMin(asStr(世界['当前日期']));
    const tickMin = getTickMinutes(asStr(世界['当前时间粒度']));
    const 周期数 = asNum(世界['周期数']);
    const targetPeriod = 3;
    const expected = worldEpochMin - (周期数 - targetPeriod) * tickMin;

    const syntheticV31: Record<string, unknown> = {
      ...richV31,
      工作记忆: [{ 记忆id: 'wmem1', 周期: -1, 标题: '测试记忆', 摘要: '工作记忆测试', 上次浮现周期: targetPeriod }],
    };
    const result = migrate(syntheticV31);
    const 工作记忆 = asArr(result.state['工作记忆']);
    expect(工作记忆.length).toBeGreaterThan(0);
    expect(asNum(asRec(工作记忆[0])['上次浮现时间'])).toBe(expected);
  });

  // ── P0-2 Fix #4: 已故NPC归档·死亡时间 + 记忆.上次唤起时间 ─────────────────────

  it('已故NPC归档: 死亡周期>0 → 死亡时间=p2e；记忆.上次唤起周期>0 → 上次唤起时间=p2e', () => {
    const 周期数base = 10;
    const 世界 = asRec(richV31['世界']);
    const worldEpochMin = parseChineseDateToEpochMin(asStr(世界['当前日期']));
    const tickMin = getTickMinutes(asStr(世界['当前时间粒度']));
    const p2e = (n: number) => worldEpochMin - (周期数base - n) * tickMin;

    const syntheticV31: Record<string, unknown> = {
      ...richV31,
      世界: { ...世界, 周期数: 周期数base },
      NPC: {
        已故甲: {
          称呼: '已故甲', 关系标签: '邻居', 标签: [], 性格: '', 背景: '', 备注: '',
          好感度: 50, 基线: 50, 信任度: 40, 关系深度: 10, 是否在场: 0, 关联地点: '', 关系大类: '邻居', 性别: '男',
          死亡周期: 3,
          记忆: [{ 记忆id: 'nm1', 摘要: '旧事', 发生周期: 1, 类型: '互动', 情绪色彩: '', 重要度: 1, 权重: 50, 永久: false, 上次唤起周期: 7 }],
        },
      },
    };
    const result = migrate(syntheticV31);
    const npc = asRec(asRec(result.state['NPC'])['已故甲']);

    expect(asNum(npc['死亡时间'])).toBe(p2e(3));
    const memories = asArr(npc['记忆']);
    expect(memories.length).toBeGreaterThan(0);
    expect(asNum(asRec(memories[0])['上次唤起时间'])).toBe(p2e(7));
  });

  // ── P0-2 Fix #5: 认知档案方向 ────────────────────────────────────────────────

  it('认知档案方向: 主角为观察者，NPC为目标；来源=迁移推定；NPC不作为观察者顶层键', () => {
    const syntheticV31: Record<string, unknown> = {
      ...richV31,
      NPC: {
        测试观察目标: { 称呼: '测试观察目标', 关系标签: '朋友', 标签: ['乐观', '可靠'], 性格: '热情开朗', 背景: '商人之子', 备注: '', 好感度: 70, 基线: 70, 信任度: 60, 关系深度: 30, 是否在场: 1, 关联地点: '家', 关系大类: '朋友', 性别: '男' },
      },
    };
    const result = migrate(syntheticV31);
    const 主角键 = asStr(asRec(asRec(result.state['_席位表'])['本机'])['焦点角色键']);
    const 认知档案 = asRec(result.state['认知档案']);

    // 档案[主角键] 存在，主角是观察者
    expect(认知档案[主角键]).toBeDefined();
    const protagonistView = asRec(认知档案[主角键]);

    // NPC 作为目标出现在主角视图中
    expect(protagonistView['测试观察目标']).toBeDefined();
    const npcEntry = asRec(protagonistView['测试观察目标']);
    const impressions = asArr(npcEntry['印象']);
    expect(impressions.length).toBeGreaterThan(0);
    for (const imp of impressions) {
      expect(asStr(asRec(imp)['来源'])).toBe('迁移推定');
    }

    // NPC 不作为观察者顶层键（方向未颠倒）
    expect(认知档案['测试观察目标']).toBeUndefined();
  });

  // ── P0-2 Fix #6: V4.1 必有键 20 项 ──────────────────────────────────────────

  describe('V4.1 必有键 20 项 (rich fixture)', () => {
    const state = migrate(richV31).state as Record<string, unknown>;

    const TOP18 = [
      '_系统版本', '_tick', '_系统', '_叙事设置', '_状态机',
      '世界', '_席位表', 'NPC', '已故NPC归档', '认知档案',
      '全局', '地图', '货币系统', '工作记忆', '仲裁器',
      '$运气', '$隐藏记忆库', '$meta',
    ] as const;

    for (const key of TOP18) {
      it(`has ${key}`, () => { expect(state).toHaveProperty(key); });
    }

    it('has _叙事设置.叙事偏好', () => {
      expect(state).toHaveProperty(['_叙事设置', '叙事偏好']);
    });
    it('has 地图.区域物价', () => {
      expect(state).toHaveProperty(['地图', '区域物价']);
    });
  });

  // ── 3-8B 信念瘦身: 组织实体.信念.强制度/异端容忍 → 属性轴 ─────────────────────────
  it('3-8B fixture: 大明皇朝.信念.强制度=75 → 属性轴.强制度.数值=75', () => {
    const result = migrate(richV31);
    const 属性轴 = asRec(asRec(asRec(result.state['组织实体'])['大明皇朝'])['属性轴']);
    expect(asNum(asRec(属性轴['强制度'])['数值'])).toBe(75);
    expect(asStr(asRec(属性轴['强制度'])['域'])).toBe('信念');
  });

  it('3-8B fixture: 大明皇朝.信念.异端容忍=30 → 属性轴.异端容忍.数值=30', () => {
    const result = migrate(richV31);
    expect(asNum(asRec(asRec(asRec(asRec(result.state['组织实体'])['大明皇朝'])['属性轴'])['异端容忍'])['数值'])).toBe(30);
  });

  it('3-8B fixture: 大明皇朝.信念 迁移后不含 强制度/异端容忍 字段', () => {
    const result = migrate(richV31);
    const 信念 = asRec(asRec(asRec(result.state['组织实体'])['大明皇朝'])['信念']);
    expect(信念).not.toHaveProperty('强制度');
    expect(信念).not.toHaveProperty('异端容忍');
    expect(asStr(信念['官方体系'])).toBe('儒家');
    expect(asStr(信念['思潮派系'])).toBe('程朱理学');
  });

  it('3-8B 幂等: 已迁移档二次 migrate 不覆盖 属性轴.强制度', () => {
    const first = migrate(richV31).state;
    const second = migrate(first).state;
    const 属性轴 = asRec(asRec(asRec(second['组织实体'])['大明皇朝'])['属性轴']);
    expect(asNum(asRec(属性轴['强制度'])['数值'])).toBe(75);
    expect(asNum(asRec(属性轴['异端容忍'])['数值'])).toBe(30);
  });

  it('3-8B 合并保护: 已有 属性轴.强制度 时，旧 信念.强制度 不覆盖（幂等保护）', () => {
    const syntheticV31: Record<string, unknown> = {
      ...richV31,
      组织实体: {
        宗门: {
          类型: '宗教组织',
          信念: { 官方体系: '道教', 强制度: 60, 异端容忍: 40, 思潮派系: '全真' },
          属性轴: { 强制度: { 数值: 99, 域: '信念' } }, // 已有高值
        },
      },
    };
    const result = migrate(syntheticV31);
    const 属性轴 = asRec(asRec(asRec(result.state['组织实体'])['宗门'])['属性轴']);
    expect(asNum(asRec(属性轴['强制度'])['数值'])).toBe(99); // 不被覆写
    expect(asNum(asRec(属性轴['异端容忍'])['数值'])).toBe(40);
  });

  it('3-8B 无旧字段: 信念无强制度/异端容忍 → 属性轴不变', () => {
    const syntheticV31: Record<string, unknown> = {
      ...richV31,
      组织实体: {
        新组织: { 类型: '商会', 信念: { 官方体系: '基督教', 思潮派系: '新教' } },
      },
    };
    const result = migrate(syntheticV31);
    const 属性轴 = asRec(asRec(asRec(result.state['组织实体'])['新组织'])['属性轴']);
    expect('强制度' in 属性轴).toBe(false);
    expect('异端容忍' in 属性轴).toBe(false);
  });
});

// ── 播报队列迁移：旧条目缺 渠道 字段补默认值 '系统' ─────────────────────────────────
describe('播报队列 tagged union 迁移映射', () => {
  it('旧播报条目（无渠道）→ 迁移后 渠道=系统', () => {
    const oldSave = {
      ...richV31,
      仲裁器: {
        冷却表: {},
        本轮种子包: { 主种子id: '', 副种子ids: [] },
        播报队列: [
          { 播报id: 'b001', 内容: '事件爆发！', 重要度: '重要', 发生时间: 1000, 已读: false },
          { 播报id: 'b002', 内容: '战役开始', 重要度: '普通', 发生时间: 1001, 已读: true },
        ],
      },
    };
    const result = migrate(oldSave);
    const 队列 = result.state['仲裁器'].播报队列 as Array<Record<string, unknown>>;
    expect(队列.length).toBe(2);
    expect(队列[0]!['渠道']).toBe('系统');
    expect(队列[0]!['内容']).toBe('事件爆发！');
    expect(队列[1]!['渠道']).toBe('系统');
  });

  it('空播报队列 → 迁移后仍为空数组', () => {
    const result = migrate(richV31);
    const 队列 = result.state['仲裁器'].播报队列 as unknown[];
    expect(Array.isArray(队列)).toBe(true);
    expect(队列.length).toBe(0);
  });
});

// ── P0-1 Fix3 · migrate内容分级位置 (within-v4.1 migration) ─────────────────────────
describe('migrate内容分级位置 · 内容分级旧中文值映射', () => {
  function makeV41WithOldRating(旧值: string): Record<string, unknown> {
    return {
      _系统版本: '4.1',
      _系统: { 功能开关表: { 内容分级: 旧值 } },
    };
  }

  it('旧值 关 → off，移至 $玩家偏好.内容分级', () => {
    const result = migrate(makeV41WithOldRating('关'));
    expect(result.state.$玩家偏好.内容分级).toBe('off');
    expect((result.state._系统.功能开关表 as Record<string, unknown>)['内容分级']).toBeUndefined();
  });
  it('旧值 SFW → light', () => {
    const result = migrate(makeV41WithOldRating('SFW'));
    expect(result.state.$玩家偏好.内容分级).toBe('light');
  });
  it('旧值 NSFW → explicit', () => {
    const result = migrate(makeV41WithOldRating('NSFW'));
    expect(result.state.$玩家偏好.内容分级).toBe('explicit');
  });
  it('旧值 community → community', () => {
    const result = migrate(makeV41WithOldRating('community'));
    expect(result.state.$玩家偏好.内容分级).toBe('community');
  });
  it('旧 功能开关表 中无 内容分级 → $玩家偏好.内容分级 defaults to off', () => {
    const result = migrate({ _系统版本: '4.1' });
    expect(result.state.$玩家偏好.内容分级).toBe('off');
  });
  it('幂等：$玩家偏好 已有 内容分级 时不覆盖', () => {
    const input: Record<string, unknown> = {
      _系统版本: '4.1',
      _系统: { 功能开关表: { 内容分级: 'SFW' } },
      $玩家偏好: { 内容分级: 'explicit' },
    };
    const result = migrate(input);
    expect(result.state.$玩家偏好.内容分级).toBe('explicit');
  });
  it('未知旧值 fallback → off', () => {
    const result = migrate(makeV41WithOldRating('some-unknown'));
    expect(result.state.$玩家偏好.内容分级).toBe('off');
  });
});

// ══════════════════════════════════════════
// K6 pack_id 回填·fixture 级 pipeline + 双机迁移恒等（batch⑤ Step 3）
// 单元幂等（backfillPackId）已在 Step 2 覆盖；此处是 pipeline 级 + fixture 级双机恒等。
// ══════════════════════════════════════════
describe('K6 pack_id backfill — fixture pipeline + 双机恒等', () => {
  it('断言一: 迁移后 pack_id 等于 record key（verbatim）', () => {
    const result = migrate(legacyV40);
    const reg = asRec(result.state['mod注册表']);
    expect(asRec(reg['my_mod'])['pack_id']).toBe('my_mod');
    expect(asRec(reg['legacy_pack'])['pack_id']).toBe('legacy_pack');
  });

  it('断言二: schema 合规（migrate pipeline 不 throw·RootSchema.parse 已内置）', () => {
    expect(() => migrate(legacyV40)).not.toThrow();
    expect(migrate(legacyV40).state['_系统版本']).toBe('4.1');
  });

  it('断言三（双机恒等）: 第二次 migrate → migration_version 不再 +1·pack_id 不变', () => {
    const first = migrate(legacyV40);
    const mv1 = asNum(asRec(first.state['_系统'])['migration_version']);

    const second = migrate(first.state);
    const mv2 = asNum(asRec(second.state['_系统'])['migration_version']);

    expect(mv2).toBe(mv1);

    const reg = asRec(second.state['mod注册表']);
    expect(asRec(reg['my_mod'])['pack_id']).toBe('my_mod');
    expect(asRec(reg['legacy_pack'])['pack_id']).toBe('legacy_pack');
  });
});
