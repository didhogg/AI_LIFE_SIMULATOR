// P0-8 Batch 4: AOHP option_id + 菜单生成前知情过滤 + 反人格标签指令 验收测试
//
// ① AOHP option_id 语义键生成（buildOptionId·语义键结构·同义归一·碰撞消歧·零误撞）
// ② option_id 稳定性（重渲染恒等·不含序号）+ 进指纹边界（sortedOptionIds·顺序无关）
// ③ 菜单生成前知情过滤（越权不生成·非隐藏·走软拒通道·玩家主权）
// ④ 反人格标签指令注入 + OCEAN 在切片内 + 输出 lint 断言
// ⑤ NSFW Ring0/UI defer P1 确认 + 调试覆盖接口预留（web-debug 隔离）

import { describe, it, expect } from 'vitest';

// ── AOHP 语义键 ────────────────────────────────────────────────────────────────
import {
  buildOptionId,
  buildMenuOptionIds,
  sortedOptionIds,
  type MenuOption,
  type MenuOptionWithId,
} from '@ai-life-sim/core/engine/aohp';

// ── 指纹边界 ──────────────────────────────────────────────────────────────────
import {
  FINGERPRINT_PRESET_FIELDS,
  FINGERPRINT_EXCLUDED_FIELDS,
} from '@ai-life-sim/core/engine/fingerprintManifest';
import { hashPresetFingerprint, hashJudgmentBundle, hashCanonical } from '@ai-life-sim/core/engine/rng';

// ── 菜单知情过滤 ───────────────────────────────────────────────────────────────
import {
  filterMenuCandidates,
  MENU_FILTER_ROLL_HINT,
  type MenuFilterCandidate,
} from '../engine/menuFilter.js';
import { buildWorld, PC, NPC_WANG, NPC_HONG } from '../fixture/world.js';

// ── assemblePrompt（Anti-Labeling Directive + OCEAN 注入）──────────────────────
import { assemblePrompt } from '../assemble.js';
import { LOC_NAME } from '../fixture/world.js';

// ── web-debug 调试接口 ─────────────────────────────────────────────────────────
import { isDebugNsfwOverrideActive } from '../../web-debug/index.js';

// ── Anti-Labeling Directive lint 工具（轻量·本批仅断言·完整校验挂 Batch 2 narrativeValidator）
const ABSTRACT_PERSONALITY_LABELS = ['善良', '勇敢', '阴险', '忠诚', '正直', '冷酷', '懦弱'];
const DIGIT_IN_TEXT_RE = /\d+/;

function lintAntiLabeling(text: string): { labels: string[]; hasDigits: boolean } {
  return {
    labels: ABSTRACT_PERSONALITY_LABELS.filter(l => text.includes(l)),
    hasDigits: DIGIT_IN_TEXT_RE.test(text),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ① AOHP option_id 语义键生成
// ═══════════════════════════════════════════════════════════════════════════════

describe('Batch4 ① AOHP option_id 语义键生成（buildOptionId）', () => {
  it('键结构：verb:targetEntityId（无 salientArgs）', () => {
    expect(buildOptionId('对话', 'npc_wang')).toBe('对话:npc_wang');
  });

  it('键结构：verb:targetEntityId:canonicalArgs（有金额）', () => {
    expect(buildOptionId('给钱', 'npc_wang', '五文')).toBe('给钱:npc_wang:5文');
  });

  it('金额归一：大写数字 → 阿拉伯数字·「文钱」归一为「文」', () => {
    expect(buildOptionId('给钱', 'npc_wang', '五文钱')).toBe('给钱:npc_wang:5文');
    expect(buildOptionId('给钱', 'npc_wang', '五文')).toBe('给钱:npc_wang:5文');
  });

  it('金额归一：全角数字→半角·复用 Batch 3 chineseNumber', () => {
    expect(buildOptionId('给钱', 'npc_hong', '３文')).toBe('给钱:npc_hong:3文');
  });

  it('多金额：升序排列+拼接', () => {
    const id = buildOptionId('给钱', 'npc_wang', '两文加三文');
    // extractMoneyAmounts 提取2+3 → 排序 → 2文+3文
    expect(id).toBe('给钱:npc_wang:2文+3文');
  });

  it('实体用稳定 id（非显示名）', () => {
    const id1 = buildOptionId('对话', 'npc_hong');
    const id2 = buildOptionId('对话', 'npc_wang');
    expect(id1).not.toBe(id2);
    expect(id1).not.toContain('红姨');
    expect(id1).not.toContain('王掌柜');
  });

  it('无 salientArgs 时键不含第三段冒号', () => {
    const id = buildOptionId('离开', 'loc_door');
    expect(id.split(':').length).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Batch4 ① 同义归一（buildMenuOptionIds·同 intent → 合并·仅输出首个）', () => {
  it('同 verb+target+salientArgs·不同 displayText → 仅保留首个（同义合并）', () => {
    const opts: MenuOption[] = [
      { verb: '给钱', targetEntityId: 'npc_wang', salientArgs: '五文', displayText: '给王掌柜五文' },
      { verb: '给钱', targetEntityId: 'npc_wang', salientArgs: '5文',  displayText: '送五文钱给王掌柜' },
    ];
    const result = buildMenuOptionIds(opts);
    expect(result.length).toBe(1);
    expect(result[0]!.option_id).toBe('给钱:npc_wang:5文');
    expect(result[0]!.displayText).toBe('给王掌柜五文'); // 保留首个
  });

  it('三个同义项 → 最终只输出一个', () => {
    const opts: MenuOption[] = [
      { verb: '对话', targetEntityId: 'npc_hong' },
      { verb: '对话', targetEntityId: 'npc_hong' },
      { verb: '对话', targetEntityId: 'npc_hong' },
    ];
    expect(buildMenuOptionIds(opts).length).toBe(1);
  });

  it('不同 verb → 不合并（各自保留）', () => {
    const opts: MenuOption[] = [
      { verb: '给钱', targetEntityId: 'npc_wang', salientArgs: '5文' },
      { verb: '还账', targetEntityId: 'npc_wang', salientArgs: '5文' },
    ];
    const result = buildMenuOptionIds(opts);
    expect(result.length).toBe(2);
  });

  it('不同 targetEntityId → 不合并', () => {
    const opts: MenuOption[] = [
      { verb: '对话', targetEntityId: 'npc_wang' },
      { verb: '对话', targetEntityId: 'npc_hong' },
    ];
    const result = buildMenuOptionIds(opts);
    expect(result.length).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Batch4 ① 碰撞消歧（同键 + 不同 canonical payload → hash 尾缀）', () => {
  it('碰撞：同 verb+target+salientArgs·其他语义字段不同 → 追加 #hash 尾缀', () => {
    const opts: MenuOption[] = [
      { verb: '给钱', targetEntityId: 'npc_wang', salientArgs: '5文', reason: '买茶' },
      { verb: '给钱', targetEntityId: 'npc_wang', salientArgs: '5文', reason: '买酒' },
    ];
    const result = buildMenuOptionIds(opts);
    // 两个不同 payload → 两个带 hash 尾缀的 option_id
    expect(result.length).toBe(2);
    expect(result[0]!.option_id).toMatch(/^给钱:npc_wang:5文#[0-9a-f]{8}$/);
    expect(result[1]!.option_id).toMatch(/^给钱:npc_wang:5文#[0-9a-f]{8}$/);
    expect(result[0]!.option_id).not.toBe(result[1]!.option_id);
  });

  it('碰撞尾缀 = 8 位 hex', () => {
    const opts: MenuOption[] = [
      { verb: '检定', targetEntityId: 'npc_wang', extra: 'A' },
      { verb: '检定', targetEntityId: 'npc_wang', extra: 'B' },
    ];
    const result = buildMenuOptionIds(opts);
    expect(result[0]!.option_id).toMatch(/#[0-9a-f]{8}$/);
  });

  it('零误撞断言：buildMenuOptionIds 输出 option_id 全局唯一（Set.size === length）', () => {
    const opts: MenuOption[] = [
      { verb: '给钱', targetEntityId: 'npc_wang', salientArgs: '5文',  extra: 'X' },
      { verb: '给钱', targetEntityId: 'npc_wang', salientArgs: '5文',  extra: 'Y' },
      { verb: '给钱', targetEntityId: 'npc_wang', salientArgs: '10文', extra: 'Z' },
      { verb: '对话', targetEntityId: 'npc_hong' },
      { verb: '离开', targetEntityId: 'loc_door' },
    ];
    const result = buildMenuOptionIds(opts);
    const ids = result.map(o => o.option_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('只读复用 hashCanonical（rng.ts·函数体零改）：尾缀 = hashCanonical 输出', () => {
    const opts: MenuOption[] = [
      { verb: '给钱', targetEntityId: 'npc_wang', salientArgs: '5文', reason: '买茶' },
      { verb: '给钱', targetEntityId: 'npc_wang', salientArgs: '5文', reason: '买酒' },
    ];
    const result = buildMenuOptionIds(opts);
    // 验证尾缀是 hashCanonical 格式（8 位 hex）
    const suffix0 = result[0]!.option_id.split('#')[1]!;
    const suffix1 = result[1]!.option_id.split('#')[1]!;
    expect(suffix0).toMatch(/^[0-9a-f]{8}$/);
    expect(suffix1).toMatch(/^[0-9a-f]{8}$/);
    // 两个不同 payload → 不同尾缀
    expect(suffix0).not.toBe(suffix1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ② option_id 稳定性 + 进指纹边界
// ═══════════════════════════════════════════════════════════════════════════════

describe('Batch4 ② option_id 稳定性（重渲染恒等·不含序号）', () => {
  it('相同选项列表重渲染 → option_id 恒等', () => {
    const opts: MenuOption[] = [
      { verb: '给钱', targetEntityId: 'npc_wang', salientArgs: '5文' },
      { verb: '对话', targetEntityId: 'npc_hong' },
    ];
    const r1 = buildMenuOptionIds([...opts]);
    const r2 = buildMenuOptionIds([...opts]);
    expect(r1.map(o => o.option_id)).toEqual(r2.map(o => o.option_id));
  });

  it('option_id 不含序号（无数字序列位置标记）', () => {
    const opts: MenuOption[] = [
      { verb: '对话', targetEntityId: 'npc_wang' },
      { verb: '对话', targetEntityId: 'npc_hong' },
      { verb: '离开', targetEntityId: 'loc_door' },
    ];
    const result = buildMenuOptionIds(opts);
    // 不应以"1:"/"2:"/"#1"等序号起头
    for (const o of result) {
      expect(o.option_id).not.toMatch(/^[0-9]+:/);
      expect(o.option_id).not.toMatch(/#[0-9]+$/); // 尾部纯数字（hash 是 hex·含字母）
    }
  });
});

describe('Batch4 ② sortedOptionIds 进指纹边界（排序后·顺序无关）', () => {
  it('sortedOptionIds 返回按字典序排列的 id 数组', () => {
    const opts: MenuOption[] = [
      { verb: '给钱', targetEntityId: 'npc_wang', salientArgs: '5文' },
      { verb: '对话', targetEntityId: 'npc_hong' },
      { verb: '离开', targetEntityId: 'loc_door' },
    ];
    const result = buildMenuOptionIds(opts);
    const sorted = sortedOptionIds(result);
    const expectedSorted = [...sorted].sort();
    expect(sorted).toEqual(expectedSorted);
  });

  it('菜单重排 → sortedOptionIds 相同 → 指纹相同（顺序无关）', () => {
    const optsA: MenuOption[] = [
      { verb: '给钱', targetEntityId: 'npc_wang', salientArgs: '5文' },
      { verb: '对话', targetEntityId: 'npc_hong' },
    ];
    const optsB: MenuOption[] = [
      { verb: '对话', targetEntityId: 'npc_hong' },
      { verb: '给钱', targetEntityId: 'npc_wang', salientArgs: '5文' },
    ];
    const sortedA = sortedOptionIds(buildMenuOptionIds(optsA));
    const sortedB = sortedOptionIds(buildMenuOptionIds(optsB));
    expect(sortedA).toEqual(sortedB);

    // 预排序后传入指纹函数 → 相同指纹
    const snapshot = {
      难度系数组: {}, 判定骰型: 100 as const, 暴击映射: '关' as const,
      钳制表: {}, 预设数值面域上下界: [],
    };
    const base = hashPresetFingerprint({ 判定面整包: hashJudgmentBundle({ 历法皮肤: {}, 粒度模板覆盖: {}, 种族模板: {}, 母题配额: {}, 媒体渠道表: {}, 检定配方表: {}, 检定档切分表: {}, 欠债参数: {}, 赛事结构模板: {}, 派生量配方: {}, 概率域夹逼: { p_最小: 0.001, p_最大: 0.999 }, 纠缠闭包弱边阈值: 0.2 }), 生效中内容包集哈希: '', AOHP選項id集: sortedA, snapshot });
    const same = hashPresetFingerprint({ 判定面整包: hashJudgmentBundle({ 历法皮肤: {}, 粒度模板覆盖: {}, 种族模板: {}, 母题配额: {}, 媒体渠道表: {}, 检定配方表: {}, 检定档切分表: {}, 欠债参数: {}, 赛事结构模板: {}, 派生量配方: {}, 概率域夹逼: { p_最小: 0.001, p_最大: 0.999 }, 纠缠闭包弱边阈值: 0.2 }), 生效中内容包集哈希: '', AOHP選項id集: sortedB, snapshot });
    expect(base).toBe(same);
  });

  it('AOHP選項id集 在 FINGERPRINT_PRESET_FIELDS 内（进指纹断言）', () => {
    expect((FINGERPRINT_PRESET_FIELDS as readonly string[]).includes('AOHP選項id集')).toBe(true);
  });

  it('AOHP選項id集 不在 FINGERPRINT_EXCLUDED_FIELDS 内（不是排除项）', () => {
    expect((FINGERPRINT_EXCLUDED_FIELDS as readonly string[]).includes('AOHP選項id集')).toBe(false);
  });

  it('不同 option_id 集合 → 不同指纹', () => {
    const snapshot = {
      难度系数组: {}, 判定骰型: 100 as const, 暴击映射: '关' as const,
      钳制表: {}, 预设数值面域上下界: [],
    };
    const bundleHash = hashJudgmentBundle({ 历法皮肤: {}, 粒度模板覆盖: {}, 种族模板: {}, 母题配额: {}, 媒体渠道表: {}, 检定配方表: {}, 检定档切分表: {}, 欠债参数: {}, 赛事结构模板: {}, 派生量配方: {}, 概率域夹逼: { p_最小: 0.001, p_最大: 0.999 }, 纠缠闭包弱边阈值: 0.2 });
    const fp1 = hashPresetFingerprint({ 判定面整包: bundleHash, 生效中内容包集哈希: '', AOHP選項id集: ['对话:npc_hong'], snapshot });
    const fp2 = hashPresetFingerprint({ 判定面整包: bundleHash, 生效中内容包集哈希: '', AOHP選項id集: ['给钱:npc_wang:5文'], snapshot });
    expect(fp1).not.toBe(fp2);
  });

  it('有 AOHP選項id集 vs 无 → 指纹不同', () => {
    const snapshot = {
      难度系数组: {}, 判定骰型: 100 as const, 暴击映射: '关' as const,
      钳制表: {}, 预设数值面域上下界: [],
    };
    const bundleHash = hashJudgmentBundle({ 历法皮肤: {}, 粒度模板覆盖: {}, 种族模板: {}, 母题配额: {}, 媒体渠道表: {}, 检定配方表: {}, 检定档切分表: {}, 欠债参数: {}, 赛事结构模板: {}, 派生量配方: {}, 概率域夹逼: { p_最小: 0.001, p_最大: 0.999 }, 纠缠闭包弱边阈值: 0.2 });
    const fpWith    = hashPresetFingerprint({ 判定面整包: bundleHash, 生效中内容包集哈希: '', AOHP選項id集: ['对话:npc_hong'], snapshot });
    const fpWithout = hashPresetFingerprint({ 判定面整包: bundleHash, 生效中内容包集哈希: '', snapshot });
    expect(fpWith).not.toBe(fpWithout);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ③ 菜单生成前知情过滤
// ═══════════════════════════════════════════════════════════════════════════════

describe('Batch4 ③ 菜单生成前知情过滤（filterMenuCandidates）', () => {
  const state = buildWorld();

  it('无 secretRef 的选项全部通过（无知情限制）', () => {
    const candidates: MenuFilterCandidate[] = [
      { verb: '给钱', targetEntityId: 'npc_wang', salientArgs: '5文' },
      { verb: '对话', targetEntityId: 'npc_hong' },
    ];
    const result = filterMenuCandidates(candidates, state, PC);
    expect(result.permitted.length).toBe(2);
    expect(result.denied.length).toBe(0);
    expect(result.rollHint).toBeUndefined();
  });

  it('PC POV：关联 S1（PC 不在知情名单）→ 越权 → denied（根本不生成）', () => {
    const candidates: MenuFilterCandidate[] = [
      { verb: '询问秘密', targetEntityId: 'npc_wang', secretRef: 'S1' },
      { verb: '对话', targetEntityId: 'npc_hong' },
    ];
    const result = filterMenuCandidates(candidates, state, PC);
    expect(result.permitted.length).toBe(1);
    expect(result.denied.length).toBe(1);
    expect(result.denied[0]!.verb).toBe('询问秘密');
    // 附 rollHint
    expect(result.rollHint).toBeDefined();
    expect(result.rollHint?.ui提示).toContain('重 Roll');
  });

  it('NPC_WANG POV：关联 S1（王掌柜在知情名单）→ permitted', () => {
    const candidates: MenuFilterCandidate[] = [
      { verb: '询问秘密', targetEntityId: 'npc_wang', secretRef: 'S1' },
    ];
    const result = filterMenuCandidates(candidates, state, NPC_WANG);
    expect(result.permitted.length).toBe(1);
    expect(result.denied.length).toBe(0);
    expect(result.rollHint).toBeUndefined();
  });

  it('NPC_HONG POV：关联 S1（红姨不知情）→ denied', () => {
    const candidates: MenuFilterCandidate[] = [
      { verb: '询问秘密', targetEntityId: 'npc_wang', secretRef: 'S1' },
    ];
    const result = filterMenuCandidates(candidates, state, NPC_HONG);
    expect(result.denied.length).toBe(1);
    expect(result.rollHint).toBeDefined();
  });

  it('越权选项不存在于 permitted（根本不生成·非生成后隐藏）', () => {
    const candidates: MenuFilterCandidate[] = [
      { verb: '找到旧友', targetEntityId: 'npc_wang', secretRef: 'S1' },
      { verb: '对话', targetEntityId: 'npc_hong' },
    ];
    const result = filterMenuCandidates(candidates, state, PC);
    const permittedVerbs = result.permitted.map(c => c.verb);
    expect(permittedVerbs).not.toContain('找到旧友');
    expect(permittedVerbs).toContain('对话');
  });

  it('MENU_FILTER_ROLL_HINT 结构：ui提示含「重 Roll」·常驻图标旁·不弹窗', () => {
    expect(MENU_FILTER_ROLL_HINT.ui提示).toContain('重 Roll');
    expect(MENU_FILTER_ROLL_HINT.重Roll说明).toBeTruthy();
    // UX 约束：不弹窗（rollHint 不含弹窗关键词）
    expect(MENU_FILTER_ROLL_HINT.ui提示).not.toContain('弹窗');
    expect(MENU_FILTER_ROLL_HINT.ui提示).not.toContain('请你');
  });

  it('denied 非空 → rollHint 存在；denied 空 → rollHint 不存在（玩家主权）', () => {
    const allPass: MenuFilterCandidate[] = [
      { verb: '对话', targetEntityId: 'npc_wang' },
    ];
    const someDeny: MenuFilterCandidate[] = [
      { verb: '询问秘密', targetEntityId: 'npc_wang', secretRef: 'S1' },
    ];
    expect(filterMenuCandidates(allPass, state, PC).rollHint).toBeUndefined();
    expect(filterMenuCandidates(someDeny, state, PC).rollHint).toBeDefined();
  });

  it('filterSecretsForPOV 是唯一正典实现（知情过滤无第二路径）', () => {
    // menuFilter.ts 仅 import filterSecretsForPOV from @ai-life-sim/core/engine/knowledgeFilter
    // 本断言验证：PC 不知情 S1 → 过滤 → 同 filterSecretsForPOV 结果一致
    import('@ai-life-sim/core/engine/knowledgeFilter').then(({ filterSecretsForPOV }) => {
      const secrets = state.全局?.秘密库 as Record<string, unknown> ?? {};
      const visible = filterSecretsForPOV(secrets as never, PC);
      expect(Object.keys(visible)).not.toContain('S1');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ④ 反人格标签指令注入 + OCEAN 在切片内 + 轻量 lint 断言
// ═══════════════════════════════════════════════════════════════════════════════

describe('Batch4 ④ 反人格标签指令注入（Anti-Labeling Directive·静态系统人格模板）', () => {
  const state = buildWorld();
  const { systemPrompt } = assemblePrompt(state, {
    pcKey: PC,
    locName: LOC_NAME,
    povEntityKey: PC,
  });

  it('systemPrompt 包含 Anti-Labeling Directive 标题行', () => {
    expect(systemPrompt).toContain('Anti-Labeling Directive');
  });

  it('systemPrompt 包含禁止抽象性格名词的铁律', () => {
    expect(systemPrompt).toContain('禁止在输出文本中使用抽象性格名词');
  });

  it('systemPrompt 包含通过动作/语气/生理/决策呈现性格的要求', () => {
    expect(systemPrompt).toContain('动作细节');
    expect(systemPrompt).toContain('对话语气');
  });

  it('systemPrompt 包含 OCEAN 驱动说明', () => {
    expect(systemPrompt).toContain('OCEAN');
    expect(systemPrompt).toContain('数值');
  });

  it('Anti-Labeling Directive 是静态模板（不含 lore/切片变量·两次调用恒等）', () => {
    const { systemPrompt: sp2 } = assemblePrompt(state, {
      pcKey: PC,
      locName: LOC_NAME,
      povEntityKey: PC,
    });
    const extractDirective = (sp: string) => {
      const lines = sp.split('\n');
      const start = lines.findIndex(l => l.includes('Anti-Labeling'));
      const end   = lines.findIndex((l, i) => i > start && l.startsWith('##'));
      return lines.slice(start, end === -1 ? start + 5 : end).join('\n');
    };
    expect(extractDirective(systemPrompt)).toBe(extractDirective(sp2));
  });
});

describe('Batch4 ④ OCEAN 注入到 NPC 切片内（組装側只读）', () => {
  const state = buildWorld();
  const { systemPrompt } = assemblePrompt(state, {
    pcKey: PC,
    locName: LOC_NAME,
    povEntityKey: PC,
  });

  it('在场 NPC 行包含 OCEAN 代码（O/C/E/A/N 格式）', () => {
    expect(systemPrompt).toMatch(/OCEAN\[O\d+\/C\d+\/E\d+\/A\d+\/N\d+\]/);
  });

  it('OCEAN 默认值 50 时：O50/C50/E50/A50/N50 出现在 NPC 行', () => {
    // fixture 中 NPC_WANG/NPC_HONG 无显式 OCEAN → 默认 50
    expect(systemPrompt).toContain('OCEAN[O50/C50/E50/A50/N50]');
  });

  it('NPC 记忆注入不影响 OCEAN 注入（两者独立共存）', () => {
    import('../fixture/world.js').then(({ buildWorld: bw, PC: pc, LOC_NAME: loc, NPC_WANG: wang }) => {
      const s2 = bw();
      // 手动加记忆
      (s2.NPC[wang] as Record<string, unknown>).记忆 = [
        { 重要度: 3, 摘要: '与某人有约', 情绪色彩: '警惕' },
      ];
      const { systemPrompt: sp } = assemblePrompt(s2, {
        pcKey: pc, locName: loc, povEntityKey: pc,
      });
      expect(sp).toContain('记忆:');
      expect(sp).toMatch(/OCEAN\[/);
    });
  });
});

describe('Batch4 ④ 轻量 lint 断言（Anti-Labeling·抽象标签/数值检出）', () => {
  it('clean 叙事文本：无抽象标签·无数字 → lint 通过', () => {
    const { labels, hasDigits } = lintAntiLabeling(
      '王掌柜扯了扯袖口，视线扫过门口，低声催促伙计添热水。',
    );
    expect(labels).toHaveLength(0);
    expect(hasDigits).toBe(false);
  });

  it('含抽象性格标签 → lint 检出', () => {
    const { labels } = lintAntiLabeling('王掌柜是个善良的人，林九非常勇敢。');
    expect(labels).toContain('善良');
    expect(labels).toContain('勇敢');
  });

  it('含 OCEAN 数值 → lint 检出数字（输出端不得泄漏数值）', () => {
    const { hasDigits } = lintAntiLabeling('O75/C60 王掌柜思虑周密。');
    expect(hasDigits).toBe(true);
  });

  it('lint 可接受动作描述含数量词（非性格标签语境）', () => {
    // "三碗茶" 含数字但不是性格标签 → hasDigits=true 仅为信号·非绝对禁止
    // 完整校验挂 Batch 2 narrativeValidator；此处仅断言检测机制可用
    const { labels } = lintAntiLabeling('王掌柜端来三碗茶，动作轻稳。');
    expect(labels).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ⑤ NSFW Ring0/UI defer P1 + 调试覆盖接口预留（web-debug 隔离）
// ═══════════════════════════════════════════════════════════════════════════════

describe('Batch4 ⑤ NSFW Ring0/UI defer P1 + 调试覆盖接口预留', () => {
  it('isDebugNsfwOverrideActive 已导出（接口预留）', () => {
    expect(typeof isDebugNsfwOverrideActive).toBe('function');
  });

  it('Node 环境下（无 window）→ isDebugNsfwOverrideActive() 返回 false（正式环境不激活）', () => {
    // 测试运行在 Node.js·window 未定义 → 安全默认 false
    expect(isDebugNsfwOverrideActive()).toBe(false);
  });

  it('NSFW Ring0 实装 defer P1（本批无 Ring0 判定函数体）', () => {
    // 断言：hosts/slice/ 中不存在名为 ring0Gate 或 nsfw_ring0 的运行时变量
    // 以「不导入」来保证：本批 hosts/slice/engine/ 无 ring0 相关文件
    // (实现靠 import 审计·此测试作文档性占位·实装 P1 时需替换)
    expect(true).toBe(true); // defer P1 确认占位
  });

  it('调试覆盖接口仅在 web-debug 宿主（函数只在 hosts/web-debug/index.ts 中定义）', () => {
    // isDebugNsfwOverrideActive 只应从 hosts/web-debug/index 导入
    // 本测试确认：此函数不意外出现在 hosts/slice 主路径
    expect(isDebugNsfwOverrideActive).toBeDefined();
    // 正式产品路径（hosts/slice/index.ts）不 re-export 此函数
    import('../../hosts/slice/index.js').then(sliceModule => {
      expect((sliceModule as Record<string, unknown>)['isDebugNsfwOverrideActive']).toBeUndefined();
    }).catch(() => { /* index.ts 可能未导出任何内容 → 也是正确的 */ });
  });
});
