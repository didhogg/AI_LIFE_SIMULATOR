import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { describe, it, expect } from 'vitest';
import { migrate, checkS3WriteGate, checkL3PersonGate, buildV41Raw, applyPrefixRenames, backfillPackId, backfillSeedSourcePkgName, migrateS1S1b, parseChineseDateToEpochMin, getTickMinutes } from '../migration/migrate.js';
import { assertGovernedKeysNormalized } from '../interfaces/keyNormalize.js';
import { mod墓碑原因枚举 } from '../schema/memory.js';
const __dir = dirname(fileURLToPath(import.meta.url));
function loadFixture(name) {
    return JSON.parse(readFileSync(join(__dir, '../../../docs/fixtures/', name), 'utf-8'));
}
const richV31 = loadFixture('stat_data_v31_rich.json');
const blankV31 = loadFixture('stat_data_v31_blank.json');
const legacyV40 = loadFixture('mod_pack_legacy_v40.json');
// ── Helpers ────────────────────────────────────────────────────────────────────
function asRec(v) {
    if (typeof v === 'object' && v !== null && !Array.isArray(v))
        return v;
    return {};
}
function asArr(v) {
    if (Array.isArray(v))
        return v;
    if (typeof v === 'object' && v !== null)
        return Object.values(v);
    return [];
}
function asNum(v, fb = 0) { const n = Number(v); return Number.isFinite(n) ? n : fb; }
function asStr(v, fb = '') { return typeof v === 'string' ? v : fb; }
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
                if (asStr(asRec(item)['立场']) === '利用')
                    利用Count++;
            }
        }
        expect(利用Count).toBe(0); // 受制于 is empty in rich fixture
    });
    it('断言④: 受制于 holders appear in 秘密库.知情名单 (synthetic input)', () => {
        const syntheticV31 = {
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
        const oldV41Raw = {
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
        const 全局 = once['全局'];
        expect('_覆写日志' in 全局).toBe(true);
        expect('_编年史' in 全局).toBe(true);
        expect('_作弊标记' in 全局).toBe(true);
        // migration_version bumped exactly once (not twice)
        const sys = once['_系统'];
        expect(sys['migration_version']).toBe(4); // 3 + 1
        const sys2 = twice['_系统'];
        expect(sys2['migration_version']).toBe(4); // unchanged on second pass
    });
    // ── backfillPackId 幂等性（K6 批⑤·Step 2）─────────────────────────────────────
    it('backfillPackId: 空注册表 no-op（migration_version 不变）', () => {
        const raw = { mod注册表: {}, _系统: { migration_version: 5 } };
        const result = backfillPackId(raw);
        expect(result).toBe(raw); // 同一引用 = 未产生新对象
        expect(result['_系统']['migration_version']).toBe(5);
    });
    it('backfillPackId: 缺 pack_id 的条目从 record key 回填·migration_version +1', () => {
        const raw = {
            mod注册表: { my_mod: { 版本: '1.0', 启用: true } },
            _系统: { migration_version: 2 },
        };
        const once = backfillPackId(raw);
        const reg = once['mod注册表'];
        expect(reg['my_mod']?.['pack_id']).toBe('my_mod');
        expect(once['_系统']['migration_version']).toBe(3);
    });
    it('backfillPackId: 二次运行幂等·migration_version 不再 +1·pack_id 不变', () => {
        const raw = {
            mod注册表: { my_mod: { 版本: '1.0' } },
            _系统: { migration_version: 2 },
        };
        const once = backfillPackId(raw);
        const twice = backfillPackId(once);
        expect(twice).toBe(once); // 同一引用 = 完全 no-op
        const reg = twice['mod注册表'];
        expect(reg['my_mod']?.['pack_id']).toBe('my_mod');
        expect(twice['_系统']['migration_version']).toBe(3);
    });
    it('backfillPackId: pack_id === key 时幂等不覆盖', () => {
        const raw = {
            mod注册表: { key_a: { pack_id: 'key_a' } },
            _系统: { migration_version: 0 },
        };
        const result = backfillPackId(raw);
        expect(result).toBe(raw); // 同一引用 = 完全 no-op
        const reg = result['mod注册表'];
        expect(reg['key_a']?.['pack_id']).toBe('key_a');
    });
    it('backfillPackId: pack_id ≠ key 时强制覆盖为 key（K6⑤·温和对齐）', () => {
        const raw = {
            mod注册表: { key_a: { pack_id: 'existing_id' } },
            _系统: { migration_version: 0 },
        };
        const result = backfillPackId(raw);
        expect(result).not.toBe(raw); // 产生新对象
        const reg = result['mod注册表'];
        expect(reg['key_a']?.['pack_id']).toBe('key_a'); // 覆盖为 key，不保留 existing_id
        expect(result['_系统']['migration_version']).toBe(1);
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
        const broken = { _系统版本: '3.1', 主角: null, NPC: null, 世界: null };
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
        const syntheticV31 = {
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
        const syntheticV31 = {
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
        const syntheticV31 = {
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
        const syntheticV31 = {
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
        const syntheticV31 = {
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
        const syntheticV31 = {
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
        const syntheticV31 = {
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
        const ghostKey = asStr(asRec(鬼亲)['parent_id']);
        expect(ghostKey in 幽灵节点).toBe(true);
    });
    // ── P0-2 Fix #2: 🗑️ 12键显式防回归 ─────────────────────────────────────────
    it('🗑️ 删键防回归: 11个旧顶层键迁移后消失；NPC无印象标签', () => {
        const syntheticInput = {
            ...richV31,
            NPC: {
                ...asRec(richV31['NPC']),
                有标签NPC: { ...asRec(asRec(richV31['NPC'])['邓照']), 印象标签: ['测试标签', '旧字段'] },
            },
        };
        const state = migrate(syntheticInput).state;
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
        const syntheticV31 = {
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
        const syntheticV31 = {
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
        const p2e = (n) => worldEpochMin - (周期数base - n) * tickMin;
        const syntheticV31 = {
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
        const syntheticV31 = {
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
        const state = migrate(richV31).state;
        const TOP18 = [
            '_系统版本', '_tick', '_系统', '_叙事设置', '_状态机',
            '世界', '_席位表', 'NPC', '已故NPC归档', '认知档案',
            '全局', '地图', '货币系统', '工作记忆', '仲裁器',
            '$运气', '$隐藏记忆库', '$meta',
        ];
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
        const syntheticV31 = {
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
        const syntheticV31 = {
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
        const 队列 = result.state['仲裁器'].播报队列;
        expect(队列.length).toBe(2);
        expect(队列[0]['渠道']).toBe('系统');
        expect(队列[0]['内容']).toBe('事件爆发！');
        expect(队列[1]['渠道']).toBe('系统');
    });
    it('空播报队列 → 迁移后仍为空数组', () => {
        const result = migrate(richV31);
        const 队列 = result.state['仲裁器'].播报队列;
        expect(Array.isArray(队列)).toBe(true);
        expect(队列.length).toBe(0);
    });
});
// ── P0-1 Fix3 · migrate内容分级位置 (within-v4.1 migration) ─────────────────────────
describe('migrate内容分级位置 · 内容分级旧中文值映射', () => {
    function makeV41WithOldRating(旧值) {
        return {
            _系统版本: '4.1',
            _系统: { 功能开关表: { 内容分级: 旧值 } },
        };
    }
    it('旧值 关 → off，移至 $玩家偏好.内容分级', () => {
        const result = migrate(makeV41WithOldRating('关'));
        expect(result.state.$玩家偏好.内容分级).toBe('off');
        expect(result.state._系统.功能开关表['内容分级']).toBeUndefined();
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
        const input = {
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
// ══════════════════════════════════════════
// K4/K6① 墓碑写入（B2·S3）— migrate() 管线 + 双机恒等
// ══════════════════════════════════════════
describe('K4/K6① 墓碑写入 — migrate pipeline', () => {
    it('自环 mod → _mod墓碑库落墓碑（K6①·原因=自环）', () => {
        const result = migrate({
            _系统版本: '4.1',
            mod注册表: { cyclic: { 依赖: ['cyclic'] } }, // no pack_id → backfill sets 'cyclic'
        });
        const tombs = asRec(result.state['_mod墓碑库']);
        const t = asRec(tombs['cyclic']);
        expect(t['记录键']).toBe('cyclic');
        expect(t['pack_id']).toBe('cyclic');
        expect(t['原因']).toBe('自环');
    });
    it('级联依赖被拒 → 落墓碑（K6①·cascade·原因=依赖被拒）', () => {
        const result = migrate({
            _系统版本: '4.1',
            mod注册表: {
                cyclic: { 依赖: ['cyclic'] },
                dependent: { 依赖: ['cyclic'] },
            },
        });
        const tombs = asRec(result.state['_mod墓碑库']);
        const tc = asRec(tombs['cyclic']);
        const td = asRec(tombs['dependent']);
        expect(tc['原因']).toBe('自环');
        expect(td['原因']).toBe('依赖被拒');
        expect(typeof td['诊断']).toBe('string');
        expect(td['诊断'].includes('cyclic')).toBe(true);
    });
    it('无自环 → _mod墓碑库 为空/不存在', () => {
        const result = migrate({
            _系统版本: '4.1',
            mod注册表: { safe_mod: { pack_id: 'safe_mod' } },
        });
        const tombs = result.state['_mod墓碑库'];
        expect(tombs === undefined || Object.keys(tombs).length === 0).toBe(true);
    });
    it('双机恒等: 两次 migrate 产出相同墓碑（确定性·禁 wall-clock）', () => {
        const input = {
            _系统版本: '4.1',
            mod注册表: {
                loop_a: { 依赖: ['loop_a'] },
                dep_b: { 依赖: ['loop_a'] },
            },
        };
        const r1 = migrate(input);
        const r2 = migrate(input);
        expect(JSON.stringify(r1.state['_mod墓碑库'])).toBe(JSON.stringify(r2.state['_mod墓碑库']));
    });
});
describe('B3·K2 semver 基底契约 tombstone — migrate pipeline', () => {
    it('兼容基底契约 → 无 semver 墓碑', () => {
        const result = migrate({
            _系统版本: '4.1',
            mod注册表: { my_mod: { pack_id: 'my_mod', 基底契约: '>=4.0.0' } },
        });
        const tombs = result.state['_mod墓碑库'];
        expect(tombs === undefined || !('my_mod' in (tombs ?? {}))).toBe(true);
    });
    it('不兼容基底契约 → 落 semver不兼容 墓碑', () => {
        const result = migrate({
            _系统版本: '4.1',
            mod注册表: { old_mod: { pack_id: 'old_mod', 基底契约: '>=5.0.0' } },
        });
        const tombs = asRec(result.state['_mod墓碑库']);
        const t = asRec(tombs['old_mod']);
        expect(t['记录键']).toBe('old_mod');
        expect(t['pack_id']).toBe('old_mod');
        expect(t['原因']).toBe('semver不兼容');
        expect(typeof t['诊断']).toBe('string');
        expect(t['诊断'].includes('5.0.0')).toBe(true);
    });
    it('精确下界：引擎版本 = 基底契约下界 → 兼容', () => {
        const result = migrate({
            _系统版本: '4.1',
            mod注册表: { exact_mod: { pack_id: 'exact_mod', 基底契约: '>=4.1.0' } },
        });
        const tombs = result.state['_mod墓碑库'];
        expect(tombs === undefined || !('exact_mod' in (tombs ?? {}))).toBe(true);
    });
    it('两段区间：4.1 满足 >=4.0.0 <5.0.0', () => {
        const result = migrate({
            _系统版本: '4.1',
            mod注册表: { range_mod: { pack_id: 'range_mod', 基底契约: '>=4.0.0 <5.0.0' } },
        });
        const tombs = result.state['_mod墓碑库'];
        expect(tombs === undefined || !('range_mod' in (tombs ?? {}))).toBe(true);
    });
    it('两段区间：4.1 不满足 >=4.2.0 <5.0.0', () => {
        const result = migrate({
            _系统版本: '4.1',
            mod注册表: { strict_mod: { pack_id: 'strict_mod', 基底契约: '>=4.2.0 <5.0.0' } },
        });
        const tombs = asRec(result.state['_mod墓碑库']);
        expect(asRec(tombs['strict_mod'])['原因']).toBe('semver不兼容');
    });
    it('空基底契约 → 跳过（不落墓碑）', () => {
        const result = migrate({
            _系统版本: '4.1',
            mod注册表: { no_contract: { pack_id: 'no_contract' } },
        });
        const tombs = result.state['_mod墓碑库'];
        expect(tombs === undefined || !('no_contract' in (tombs ?? {}))).toBe(true);
    });
    it('幂等：两次 migrate 产出相同 semver 墓碑', () => {
        const input = {
            _系统版本: '4.1',
            mod注册表: { old_mod: { 基底契约: '>=5.0.0' } },
        };
        const r1 = migrate(input);
        const r2 = migrate(r1.state);
        expect(JSON.stringify(r2.state['_mod墓碑库'])).toBe(JSON.stringify(r1.state['_mod墓碑库']));
    });
    it('多 mod 混合：兼容+不兼容各自正确', () => {
        const result = migrate({
            _系统版本: '4.1',
            mod注册表: {
                compat_mod: { pack_id: 'compat_mod', 基底契约: '>=4.0.0' },
                incompat_mod: { pack_id: 'incompat_mod', 基底契约: '>=5.0.0' },
                no_contract: { pack_id: 'no_contract' },
            },
        });
        const tombs = asRec(result.state['_mod墓碑库']);
        expect('compat_mod' in tombs).toBe(false);
        expect('no_contract' in tombs).toBe(false);
        expect(asRec(tombs['incompat_mod'])['原因']).toBe('semver不兼容');
    });
    it('确定性：遍历码点序与 mod 声明顺序无关', () => {
        const input1 = {
            _系统版本: '4.1',
            mod注册表: {
                z_mod: { pack_id: 'z_mod', 基底契约: '>=5.0.0' },
                a_mod: { pack_id: 'a_mod', 基底契约: '>=5.0.0' },
            },
        };
        const input2 = {
            _系统版本: '4.1',
            mod注册表: {
                a_mod: { pack_id: 'a_mod', 基底契约: '>=5.0.0' },
                z_mod: { pack_id: 'z_mod', 基底契约: '>=5.0.0' },
            },
        };
        const r1 = migrate(input1);
        const r2 = migrate(input2);
        // Both mods rejected regardless of insertion order
        expect(asRec(asRec(r1.state['_mod墓碑库'])['a_mod'])['原因']).toBe('semver不兼容');
        expect(asRec(asRec(r2.state['_mod墓碑库'])['a_mod'])['原因']).toBe('semver不兼容');
        expect(asRec(asRec(r1.state['_mod墓碑库'])['z_mod'])['原因']).toBe('semver不兼容');
        expect(asRec(asRec(r2.state['_mod墓碑库'])['z_mod'])['原因']).toBe('semver不兼容');
    });
});
// ── B5·S1+S1b · migrateS1S1b 幂等验收（四条护栏③④）──────────────────────────────────
describe('B5·S1+S1b · migrateS1S1b 迁移函数', () => {
    const baseRaw = {
        _系统: { migration_version: 10 },
        _系统版本: '4.1',
    };
    it('老档（无 S1/S1b 键）→ 迁移后两键均存在', () => {
        const result = migrateS1S1b(baseRaw);
        expect('受治理键空间注册表' in result).toBe(true);
        expect('键空间归并表' in result).toBe(true);
    });
    it('老档→新档：migration_version +1', () => {
        const result = migrateS1S1b(baseRaw);
        expect(asNum(asRec(result['_系统'])['migration_version'])).toBe(11);
    });
    it('幂等：二次迁移 no-op（migration_version 不再 +1）', () => {
        const once = migrateS1S1b(baseRaw);
        const twice = migrateS1S1b(once);
        expect(asNum(asRec(twice['_系统'])['migration_version']))
            .toBe(asNum(asRec(once['_系统'])['migration_version']));
    });
    it('幂等：二次迁移结果与一次相同（deepEqual）', () => {
        const once = migrateS1S1b(baseRaw);
        const twice = migrateS1S1b(once);
        expect(twice).toEqual(once);
    });
    it('已含两键的存档：no-op，migration_version 不变', () => {
        const alreadyMigrated = {
            ...baseRaw,
            受治理键空间注册表: {},
            键空间归并表: {},
        };
        const result = migrateS1S1b(alreadyMigrated);
        expect(result).toBe(alreadyMigrated); // strict reference equality (no-op)
        expect(asNum(asRec(result['_系统'])['migration_version'])).toBe(10);
    });
    it('只缺 S1：单键迁移 migration_version +1，S1b 不覆盖', () => {
        const rawWithS1bOnly = { ...baseRaw, 键空间归并表: { 归并条目: [] } };
        const result = migrateS1S1b(rawWithS1bOnly);
        expect('受治理键空间注册表' in result).toBe(true);
        expect(asNum(asRec(result['_系统'])['migration_version'])).toBe(11);
        // 既存 S1b 内容保持不变
        expect(asRec(result['键空间归并表'])['归并条目']).toEqual([]);
    });
    it('🛡️ migrate() 输出包含 S1/S1b 键（全量迁移链覆盖）', () => {
        const { state } = migrate(richV31);
        expect('受治理键空间注册表' in state).toBe(true);
        expect('键空间归并表' in state).toBe(true);
    });
    it('🛡️ 迁移幂等：migrate(migrate(rich)).state deepEqual migrate(rich).state', () => {
        const r1 = migrate(richV31).state;
        const r2 = migrate(migrate(richV31).state).state;
        expect(r2).toEqual(r1);
    });
});
// ── B6·S1/S1b · 受治理键空間写卡口 regression lock ─────────────────────────────
describe('B6·S1/S1b · 受治理键空间写卡口 regression lock', () => {
    it('脏 registry（全角键名）→ 写卡口检出违例', () => {
        // Simulate dirty state reaching the write gate (read gate bypassed)
        const dirty = {
            受治理键空间注册表: {
                键条目: [{ 规范键: 'Ａ', 命名空间: '币种' }], // U+FF21 full-width A → normalizes to 'A'
            },
        };
        const violations = assertGovernedKeysNormalized(dirty);
        expect(violations.length).toBeGreaterThan(0);
        const first = violations[0]; // length checked above; noUncheckedIndexedAccess requires non-null assertion
        expect(first.raw).toBe('Ａ');
        expect(first.normalized).toBe('A');
        expect(first.field).toMatch(/受治理键空间注册表/);
    });
    it('空 registry → migrate 全链无 throw、写卡口零违例', () => {
        expect(() => migrate(richV31)).not.toThrow();
        const { state } = migrate(richV31);
        const violations = assertGovernedKeysNormalized(state);
        expect(violations).toEqual([]);
    });
    it('已归一 registry + 归并表 → 写卡口零违例（幂等）', () => {
        const clean = {
            受治理键空间注册表: {
                键条目: [{ 规范键: '文', 命名空间: '币种' }],
            },
            键空间归并表: {
                归并条目: [{ 别名: '钱', 规范键: '文', 命名空间: '币种' }],
            },
        };
        expect(assertGovernedKeysNormalized(clean)).toEqual([]);
    });
});
// ── E-e · 冻结键改名 enforcement ──────────────────────────────────────────────
describe('E-e · 冻结键改名 enforcement（mod-load 阶段）', () => {
    // 基底：用 blankV31 迁移后的 V4.1 state 作为 spread 基底，确保必填字段完整
    const base = migrate(blankV31).state;
    const frozenRegistry = {
        键条目: [{ 规范键: 'gold', 命名空间: '币种', 不可变: true }],
    };
    const modEntry = {
        pack_id: 'bad_mod', 版本: '1.0.0', 启用: true, 优先级: 0,
        依赖: [], 冲突: [], 命名空间: '', 作者: '', 轨道: 'gameplay',
    };
    it('case-1: key 未冻结时 → 归并别名通过，无墓碑', () => {
        const input = {
            ...base,
            受治理键空间注册表: { 键条目: [{ 规范键: 'silver', 命名空间: '币种' }] },
            键空间归并表: { 归并条目: [{ 别名: 'silver', 规范键: 'aurum', 命名空间: '币种', 来源包: 'bad_mod' }] },
            mod注册表: { bad_mod: modEntry },
        };
        const { state } = migrate(input);
        expect(state._mod墓碑库?.['bad_mod']).toBeUndefined();
    });
    it('case-2: 冻结 key 被声明为归并别名 → 写墓碑 reason=冻结键改名', () => {
        const input = {
            ...base,
            受治理键空间注册表: frozenRegistry,
            键空间归并表: { 归并条目: [{ 别名: 'gold', 规范键: 'aurum', 命名空间: '币种', 来源包: 'bad_mod' }] },
            mod注册表: { bad_mod: modEntry },
        };
        const { state } = migrate(input);
        const tomb = state._mod墓碑库?.['bad_mod'];
        expect(tomb?.原因).toBe('冻结键改名');
        expect(tomb?.pack_id).toBe('bad_mod');
        expect(tomb?.诊断).toContain('gold');
    });
    it('case-3: 规范键=冻结 key（仅加别名·非改名）→ 不误伤，无墓碑', () => {
        // 归并条目.规范键 = 冻结 key 表示「给冻结键加别名」，不是对其改名，不拦截
        const input = {
            ...base,
            受治理键空间注册表: frozenRegistry,
            键空间归并表: { 归并条目: [{ 别名: 'gilded', 规范键: 'gold', 命名空间: '币种', 来源包: 'good_mod' }] },
            mod注册表: { good_mod: { ...modEntry, pack_id: 'good_mod' } },
        };
        const { state } = migrate(input);
        expect(state._mod墓碑库?.['good_mod']).toBeUndefined();
    });
    it('case-4: mod墓碑原因枚举含「冻结键改名」且既有值不变', () => {
        const values = [...mod墓碑原因枚举];
        expect(values).toContain('冻结键改名');
        // 既有值完整性（顺序无关）
        expect(values).toContain('自环');
        expect(values).toContain('依赖被拒');
        expect(values).toContain('冲突');
        expect(values).toContain('key不等pack_id');
        expect(values).toContain('semver不兼容');
        expect(values).toContain('覆写授权越权');
        expect(values).toContain('其他');
        expect(values.length).toBe(8); // 7 原有 + 1 新增
    });
});
// ── S3·写卡口（导入闸·fail-open·JS保留键防护）────────────────────────────────
describe('S3·写卡口（fail-open·JS保留键检测·导入闸）', () => {
    const base = migrate(blankV31).state;
    it('case-1: 合法键直通——migrate 全链无 S3 error log', () => {
        const result = migrate(blankV31);
        const s3Errors = result.log.filter(e => e.level === 'error' && e.msg.startsWith('S3写卡口'));
        expect(s3Errors).toEqual([]);
    });
    it('case-2: NPC 区 __proto__ 键 → level:error log，不 throw，path 精确', () => {
        // JSON.parse 可将 __proto__ 创建为 own enumerable property（不同于对象字面量语法）
        const npcWithProto = JSON.parse('{"__proto__": {}}');
        const fakeState = { ...base, NPC: npcWithProto };
        const log = [];
        expect(() => checkS3WriteGate(fakeState, log)).not.toThrow();
        const entry = log.find(e => e.path === 'NPC.__proto__');
        expect(entry?.level).toBe('error');
        expect(entry?.msg).toContain('S3写卡口');
        expect(entry?.msg).toContain('__proto__');
    });
    it('case-3: mod注册表 constructor 键 → level:error log，fail-open 不 throw', () => {
        const modWithCtor = JSON.parse('{"constructor": {}}');
        const fakeState = { ...base, mod注册表: modWithCtor };
        const log = [];
        expect(() => checkS3WriteGate(fakeState, log)).not.toThrow();
        const entry = log.find(e => e.path === 'mod注册表.constructor');
        expect(entry?.level).toBe('error');
    });
    it('case-4: 三保留键同批检出 + state 纯观测不 mutate', () => {
        const withProto = JSON.parse('{"__proto__": {}}');
        const withCtor = JSON.parse('{"constructor": {}}');
        const withProto2 = JSON.parse('{"prototype": {}}');
        const fakeState = { ...base, NPC: withProto, mod注册表: withCtor, 调用类型注册表: withProto2 };
        const snapBefore = JSON.stringify(fakeState);
        const log = [];
        checkS3WriteGate(fakeState, log);
        // 三条 error（__proto__ / constructor / prototype）
        const s3Errors = log.filter(e => e.level === 'error' && e.msg.includes('S3写卡口'));
        expect(s3Errors.length).toBe(3);
        // 纯观测：state 未被 mutate
        expect(JSON.stringify(fakeState)).toBe(snapBefore);
    });
});
// ── L3·人称二元组合法性（导入闸·fail-open·warn/error 级）────────────────────────
describe('L3·人称二元组合法性（fail-open·导入闸·警示族）', () => {
    const base = migrate(blankV31).state;
    it('case-1: 全知×第一人称 → level:error log，不 throw，path 精确', () => {
        const fakeState = {
            ...base,
            _叙事设置: {
                ...base._叙事设置,
                人称: { ...base._叙事设置.人称, 视角宿主: '上帝/全知旁白', 人称: '一' },
            },
        };
        const log = [];
        expect(() => checkL3PersonGate(fakeState, log)).not.toThrow();
        const entry = log.find(e => e.level === 'error' && e.path === '_叙事设置.人称');
        expect(entry).toBeDefined();
        expect(entry?.msg).toContain('L3人称闸');
        expect(entry?.msg).toContain('第一人称');
    });
    it('case-2: 一人称视角宿主为空 → level:warn log，不 throw', () => {
        const fakeState = {
            ...base,
            _叙事设置: {
                ...base._叙事设置,
                人称: { ...base._叙事设置.人称, 视角宿主: '', 人称: '一' },
            },
        };
        const log = [];
        expect(() => checkL3PersonGate(fakeState, log)).not.toThrow();
        const entry = log.find(e => e.level === 'warn' && e.path === '_叙事设置.人称');
        expect(entry).toBeDefined();
        expect(entry?.msg).toContain('L3人称闸');
    });
    it('case-3: 合法组合（全知×三人称）→ 无 L3 log', () => {
        const fakeState = {
            ...base,
            _叙事设置: {
                ...base._叙事设置,
                人称: { ...base._叙事设置.人称, 视角宿主: '上帝/全知旁白', 人称: '三' },
            },
        };
        const log = [];
        checkL3PersonGate(fakeState, log);
        const l3Entries = log.filter(e => e.msg.includes('L3人称闸'));
        expect(l3Entries).toEqual([]);
    });
    it('case-4: migrate 全链 — 默认 state（二人称·宿主空）不产生 error，仅可能有 warn', () => {
        const result = migrate(blankV31);
        const l3Errors = result.log.filter(e => e.level === 'error' && e.msg.includes('L3人称闸'));
        expect(l3Errors).toEqual([]);
    });
});
// ── D-3: backfillSeedSourcePkgName（种子来源包名归一·幂等·additive）────────────────
describe('backfillSeedSourcePkgName — D-3 种子侧归一', () => {
    function makeRawWithSeeds(seeds, ver = 0) {
        return { $隐藏记忆库: { 延时种子: seeds }, _系统: { migration_version: ver } };
    }
    it('无 延时种子 容器 → 同引用 no-op', () => {
        const raw = { $隐藏记忆库: {}, _系统: { migration_version: 0 } };
        expect(backfillSeedSourcePkgName(raw)).toBe(raw);
    });
    it('空 延时种子 dict → 同引用 no-op', () => {
        const raw = makeRawWithSeeds({});
        expect(backfillSeedSourcePkgName(raw)).toBe(raw);
    });
    it('包id 为空串哨兵 → 跳过，no-op，version 不变', () => {
        const raw = makeRawWithSeeds({ s1: { 来源: { 包id: '', 命名空间: '' } } }, 3);
        const result = backfillSeedSourcePkgName(raw);
        expect(result).toBe(raw);
        expect(asNum(asRec(result['_系统'])['migration_version'])).toBe(3);
    });
    it('包id 非空·来源包 未设 → 写 来源包·包id 保留·version +1（旧档黄金样本场景）', () => {
        const raw = makeRawWithSeeds({ s1: { 来源: { 包id: 'my_mod', 命名空间: '', 事件id: '', 模块: '' } } }, 5);
        const result = backfillSeedSourcePkgName(raw);
        expect(result).not.toBe(raw);
        const src = asRec(asRec(asRec(asRec(result['$隐藏记忆库'])['延时种子'])['s1'])['来源']);
        expect(src['来源包']).toBe('my_mod'); // 新字段写入
        expect(src['包id']).toBe('my_mod'); // 旧字段保留
        expect(asNum(asRec(result['_系统'])['migration_version'])).toBe(6); // +1
    });
    it('幂等：来源包 已存在且非空 → 同引用 no-op·version 不变', () => {
        const raw = makeRawWithSeeds({ s1: { 来源: { 包id: 'my_mod', 来源包: 'my_mod' } } }, 6);
        const result = backfillSeedSourcePkgName(raw);
        expect(result).toBe(raw); // 同引用 = 完全 no-op
        expect(asNum(asRec(result['_系统'])['migration_version'])).toBe(6);
    });
    it('二次迁移 no-op：迁移结果再跑一次 → 同引用', () => {
        const raw = makeRawWithSeeds({ s1: { 来源: { 包id: 'mod_a' } } }, 2);
        const once = backfillSeedSourcePkgName(raw);
        const twice = backfillSeedSourcePkgName(once);
        expect(twice).toBe(once); // 第二次 = 完全 no-op
        expect(asNum(asRec(twice['_系统'])['migration_version'])).toBe(3); // only +1 total
    });
    it('双机迁移恒等：两次独立运行输出逐字节相同', () => {
        const raw = makeRawWithSeeds({ s1: { 来源: { 包id: 'mod_a' } }, s2: { 来源: { 包id: 'mod_b' } } });
        const r1 = backfillSeedSourcePkgName(raw);
        const r2 = backfillSeedSourcePkgName(JSON.parse(JSON.stringify(raw)));
        expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
    });
    it('sorted 恒等：多 seed 按字典序处理·输出顺序稳定', () => {
        const raw = makeRawWithSeeds({
            z_seed: { 来源: { 包id: 'z_mod' } },
            a_seed: { 来源: { 包id: 'a_mod' } },
        });
        const r1 = backfillSeedSourcePkgName(raw);
        const r2 = backfillSeedSourcePkgName(JSON.parse(JSON.stringify(raw)));
        expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
        // both seeds should have 来源包 filled
        const seeds = asRec(asRec(r1['$隐藏记忆库'])['延时种子']);
        expect(asRec(asRec(seeds['a_seed'])['来源'])['来源包']).toBe('a_mod');
        expect(asRec(asRec(seeds['z_seed'])['来源'])['来源包']).toBe('z_mod');
    });
    it('混合：部分已迁移·部分未迁移 → 只补未迁移的种子·version +1', () => {
        const raw = makeRawWithSeeds({
            old_seed: { 来源: { 包id: 'old_mod' } }, // needs backfill
            new_seed: { 来源: { 包id: 'new_mod', 来源包: 'new_mod' } }, // already migrated
        }, 1);
        const result = backfillSeedSourcePkgName(raw);
        expect(result).not.toBe(raw);
        const seeds = asRec(asRec(result['$隐藏记忆库'])['延时种子']);
        expect(asRec(asRec(seeds['old_seed'])['来源'])['来源包']).toBe('old_mod');
        expect(asRec(asRec(seeds['new_seed'])['来源'])['来源包']).toBe('new_mod');
        expect(asNum(asRec(result['_系统'])['migration_version'])).toBe(2);
    });
    it('migrate 全链：旧档含 包id → migrate 后 来源包 填充·包id 保留·黄金向量逐位恒等', () => {
        // 构造含延时种子 包id 的旧格式档
        const oldArchive = JSON.parse(JSON.stringify(blankV31));
        oldArchive['$隐藏记忆库'] ??= {};
        const hidden = oldArchive['$隐藏记忆库'];
        hidden['延时种子'] = { test_seed: { 来源: { 包id: 'test_pkg', 命名空间: '', 事件id: '', 模块: '' } } };
        const result = migrate(oldArchive);
        // 迁移后 来源包 应已填充
        const seeds = result.state.$隐藏记忆库?.['延时种子'];
        const srcAfter = seeds?.['test_seed']?.['来源'];
        expect(srcAfter?.['来源包']).toBe('test_pkg');
        expect(srcAfter?.['包id']).toBe('test_pkg'); // 旧字段保留
        // 二次 migrate 后 来源包 不变（幂等）
        const result2 = migrate(result.state);
        const seeds2 = result2.state.$隐藏记忆库?.['延时种子'];
        const srcAfter2 = seeds2?.['test_seed']?.['来源'];
        expect(srcAfter2?.['来源包']).toBe('test_pkg');
    });
});
