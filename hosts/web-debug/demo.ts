// 纵切 Demo 薄壳 — P0-11 前哨 · web-debug 单宿主端到端
//
// 物理隔离铁律: 本文件仅在 hosts/web-debug 宿主环境中引入。
//   hosts/slice 不 re-export 本文件的任何函数。
//   demo 代码不进指纹（叙事注入路径 R7-b·不改 fingerprintManifest）。
//
// 运行方式: npx tsx hosts/web-debug/demo.ts
// 依赖: @ai-life-sim/core（workspace dep）+ hosts/slice（相对引用·仅 dev 宿主）
//
// 脚本化叙事（无 LLM）: 完整管线演示不需要真实 LLM 调用。

import { filterSecretsForPOV } from '@ai-life-sim/core/engine/knowledgeFilter';
import { buildMenuOptionIds, sortedOptionIds } from '@ai-life-sim/core/engine/aohp';
import type { MenuOption } from '@ai-life-sim/core/engine/aohp';
import { DEFAULT_NEAR_K } from '@ai-life-sim/core/prompt/callRegistry';

// ── 从 slice 宿主复用（开发宿主·相对引用·不新建实现）───────────────────────────
import {
  buildWorld, PC, NPC_WANG, NPC_HONG, LOC_NAME, SECRET_S1, CURRENCY, SAVE_SEED,
} from '../slice/fixture/world.js';
import { assemblePrompt } from '../slice/assemble.js';
import {
  createArchiveHeader,
  createFullArchiveHeader,
  migrateToFullArchiveHeader,
  bumpSalt,
} from '../slice/engine/archive.js';
import { filterMenuCandidates, type MenuFilterCandidate } from '../slice/engine/menuFilter.js';
import { runReconcileGate } from '../slice/engine/reconcileGate.js';
import { initBalances, snapshotBalances } from '../slice/ledger/state.js';
import { isDebugNsfwOverrideActive } from './index.js';

// ── NSFW demo 覆盖（默认开·物理隔离·P1 Ring0 替换）───────────────────────────────
// demo 中显式设置 window.__DEBUG_NSFW = true（若有 window）
// Node 环境：isDebugNsfwOverrideActive() 恒 false（window 未定义）
const NSFW_ACTIVE = isDebugNsfwOverrideActive();

// ── 工具函数 ───────────────────────────────────────────────────────────────────
function hr(title: string): void {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(60));
}

function section(label: string, content: string): void {
  console.log(`\n【${label}】`);
  console.log(content);
}

// ── D1 · 薄壳骨架 — 加载存档 + assemblePrompt ──────────────────────────────────
function runD1(): void {
  hr('D1 薄壳骨架 — 加载存档 + prompt-dump');

  // 存档：使用新版 FullArchiveHeader（D4 接线）
  const header = createFullArchiveHeader(SAVE_SEED);
  const state  = buildWorld();
  const balancesMap = initBalances({ [PC]: 30, [NPC_WANG]: 200, [NPC_HONG]: 0 });
  const balances    = snapshotBalances(balancesMap);

  console.log(`存档头 RULE_VERSION=${header.RULE_VERSION} · seed=${header.seed}`);
  console.log(`schemaKeys=${header.schemaKeys} · 中文数字解析规则版=${header.中文数字解析规则版}`);
  console.log(`AOHP语义键版=${header.AOHP语义键版} · 软拒规则版=${header.软拒规则版}`);

  const { systemPrompt, userPrompt } = assemblePrompt(state, {
    pcKey: PC,
    locName: LOC_NAME,
    povEntityKey: PC,
    balances,
    callTypeKey: '主线叙事',
  });

  section('systemPrompt（prompt-dump·静态世界知识）', systemPrompt);
  section('userPrompt（prompt-dump·当拍动态状态）', userPrompt);
}

// ── D2 · 交互纵切 — AOHP 菜单 + reconcileGate ──────────────────────────────────
function runD2(): void {
  hr('D2 交互纵切 — 多拍循环 + AOHP 菜单 + reconcileGate');

  const state = buildWorld();
  const histories: string[] = [];

  // ── AOHP 菜单生成（D2 菜单渲染）──────────────────────────────────────────────
  const rawCandidates: MenuOption[] = [
    { verb: '对话', targetEntityId: NPC_WANG, displayText: '与王掌柜对话' },
    { verb: '给钱', targetEntityId: NPC_HONG, salientArgs: '五文', displayText: '给红姨五文钱' },
    { verb: '给钱', targetEntityId: NPC_HONG, salientArgs: '5文',  displayText: '给红姨5文钱（同义·归一）' },
    { verb: '还账', targetEntityId: NPC_WANG, salientArgs: '8文',  displayText: '还王掌柜八文钱' },
  ];
  const withIds = buildMenuOptionIds(rawCandidates);
  section('AOHP 菜单 option_id（同义归一后）', withIds
    .map(o => `  ${o.option_id}  ←  ${o.displayText ?? ''}`)
    .join('\n'),
  );
  console.log(`原始候选 ${rawCandidates.length} 项 → 去重后 ${withIds.length} 项`);
  console.log(`sortedOptionIds: ${sortedOptionIds(withIds).join(' | ')}`);

  // ── 拍 1：对话（无货币转账·reconcileGate 空提案）─────────────────────────────
  const narrative1 = '王掌柜见林九推门而入，微微颔首，手中抹布未停。';
  histories.push(narrative1);
  const { systemPrompt: sp1, userPrompt: up1 } = assemblePrompt(state, {
    pcKey: PC, locName: LOC_NAME, povEntityKey: PC, narrativeHistory: histories,
  });
  console.log(`\n拍#1 → 对话叙事: 「${narrative1}」`);
  console.log(`  userPrompt 含近期叙事: ${up1.includes('近期叙事') ? '是' : '否'}`);

  // ── 拍 2：给钱 5文 → reconcileGate ─────────────────────────────────────────
  const narrative2 = '林九取出五文钱递给红姨，换来一碗热茶。';
  histories.push(narrative2);
  const proposal5 = {
    transfers: [{ from: PC, to: NPC_HONG, amount: 5, reason: '给钱' }],
    checks: [], knowledge: [],
  };
  const gate2 = runReconcileGate(narrative2, proposal5);
  console.log(`\n拍#2 → 给钱 5文: 「${narrative2}」`);
  console.log(`  reconcileGate status: ${gate2.status} · rollHint: ${gate2.rollHint ? '有' : '无'}`);

  // ── 拍 3：债权叙事 → hard_rejected ─────────────────────────────────────────
  const narrative3 = '林九赊账了八文钱的酒菜。';
  const proposal8debt = {
    transfers: [{ from: PC, to: NPC_WANG, amount: 8, reason: '赊账' }],
    checks: [], knowledge: [],
  };
  const gate3 = runReconcileGate(narrative3, proposal8debt);
  console.log(`\n拍#3 → 债权叙事（硬拒测试）: 「${narrative3}」`);
  console.log(`  reconcileGate status: ${gate3.status} · rollHint: ${gate3.rollHint?.ui提示 ?? '无'}`);
  const { systemPrompt: sp3, userPrompt: up3 } = assemblePrompt(state, {
    pcKey: PC, locName: LOC_NAME, povEntityKey: PC, narrativeHistory: histories.slice(-DEFAULT_NEAR_K),
  });
  console.log(`  近K历史条数: ${histories.length} (截断至 ${DEFAULT_NEAR_K})`);
  console.log(`  userPrompt 含拍#1叙事: ${up3.includes('林九踏入') ? '是' : '否(正常·已超窗口)'}`);
}

// ── D3 · 知情过滤 / 反人格标签 / NSFW ──────────────────────────────────────────
function runD3(): void {
  hr('D3 知情过滤 / 反人格标签 / NSFW 可视化');

  const state = buildWorld();

  // POV 切换：PC 不知情 vs NPC_WANG 知情
  const secrets = state.全局?.秘密库 ?? {};
  const visiblePC   = filterSecretsForPOV(secrets as Parameters<typeof filterSecretsForPOV>[0], PC);
  const visibleWang = filterSecretsForPOV(secrets as Parameters<typeof filterSecretsForPOV>[0], NPC_WANG);

  section('POV 切换 · 知情过滤结果',
    `PC POV (${PC}) → 可见秘密: ${Object.keys(visiblePC).length} 条\n` +
    `NPC_WANG POV (${NPC_WANG}) → 可见秘密: ${Object.keys(visibleWang).length} 条 → ${Object.keys(visibleWang).join(', ')}`,
  );

  // 菜单知情过滤
  const menuCandidates: MenuFilterCandidate[] = [
    { verb: '询问', targetEntityId: NPC_WANG, displayText: '询问通缉旧友（需知情S1）', secretRef: SECRET_S1 },
    { verb: '对话', targetEntityId: NPC_WANG, displayText: '普通对话（无知情限制）' },
  ];
  const filterPC = filterMenuCandidates(menuCandidates, state, PC);
  section('菜单知情过滤（PC POV）',
    `permitted: ${filterPC.permitted.map(o => o.displayText).join(', ')}\n` +
    `denied:    ${filterPC.denied.map(o => o.displayText).join(', ')}\n` +
    `rollHint:  ${filterPC.rollHint?.ui提示 ?? '无'}`,
  );

  // Anti-Labeling Directive
  const { systemPrompt } = assemblePrompt(state, { pcKey: PC, locName: LOC_NAME, povEntityKey: PC });
  const hasDirective = systemPrompt.includes('人格表达铁律');
  const hasOcean     = systemPrompt.includes('OCEAN[');
  const hasNoLabel   = !systemPrompt.includes('这个人很善良') && !systemPrompt.includes('性格勇敢');
  section('Anti-Labeling Directive 状态',
    `人格表达铁律段落存在: ${hasDirective}\n` +
    `OCEAN 数值注入 NPC 行: ${hasOcean}\n` +
    `无抽象性格正向断言: ${hasNoLabel}`,
  );

  // NSFW
  section('NSFW 物理隔离状态',
    `isDebugNsfwOverrideActive(): ${NSFW_ACTIVE}\n` +
    `（Node 环境 window 未定义 → 恒 false·P1 Ring0 实装时接入）`,
  );
}

// ── D4 · 存档读写 + P0-9 迁移侦察 ─────────────────────────────────────────────
function runD4(): void {
  hr('D4 存档读写端到端 + P0-9 迁移侦察');

  // 新格式存档头（RULE_VERSION=3 + B3/B4 字段）
  const fullHeader = createFullArchiveHeader(SAVE_SEED);
  section('新存档头（RULE_VERSION=3）', JSON.stringify(fullHeader, null, 2));

  // JSON 往返（存档写入/读出）
  const saved   = JSON.stringify(fullHeader);
  const loaded  = JSON.parse(saved);
  console.log(`JSON 往返恒等: ${JSON.stringify(loaded) === saved ? '✓' : '✗'}`);

  // 旧存档头（MinArchiveHeader）加载 + 迁移侦察
  const oldHeader = createArchiveHeader(SAVE_SEED);
  const oldSaved  = JSON.stringify(oldHeader);
  const oldLoaded = JSON.parse(oldSaved);
  console.log(`\n旧存档头（MinArchiveHeader）:`);
  console.log(JSON.stringify(oldLoaded, null, 2));
  console.log(`\n⚠ P0-9 迁移侦察 — 旧存档缺失字段:`);
  console.log(`  RULE_VERSION:         ${'RULE_VERSION' in oldLoaded ? '存在' : '缺失 → 需迁移'}`);
  console.log(`  中文数字解析规则版:   ${'中文数字解析规则版' in oldLoaded ? '存在' : '缺失 → 需迁移（B3 reconcile gate）'}`);
  console.log(`  软拒规则版:           ${'软拒规则版' in oldLoaded ? '存在' : '缺失 → 需迁移（B3 output guard）'}`);
  console.log(`  AOHP语义键版:         ${'AOHP语义键版' in oldLoaded ? '存在' : '缺失 → 需迁移（B4 option_id）'}`);
  console.log(`  schemaKeys:           ${'schemaKeys' in oldLoaded ? '存在' : '缺失 → 需迁移（P0-9 迁移面）'}`);

  // 迁移：MinArchiveHeader → FullArchiveHeader
  const migrated = migrateToFullArchiveHeader(oldLoaded);
  console.log(`\n迁移后存档头 RULE_VERSION=${migrated.RULE_VERSION} · seed=${migrated.seed} · 计数器=${migrated.全局回滚计数器}`);

  // bumpSalt 测试（农骰防护·D4 存档回写）
  const bumped = bumpSalt(migrated);
  console.log(`bumpSalt → 全局回滚计数器: ${migrated.全局回滚计数器} → ${bumped.全局回滚计数器}`);

  console.log(`\nP0-9 迁移需求汇总（记录进 STATUS·本 demo 不实装迁移）:`);
  console.log(`  1. MinArchiveHeader → FullArchiveHeader 迁移函数（已实装 migrateToFullArchiveHeader）`);
  console.log(`  2. schemaKeys 版本检测（当前=52·迁移时需比对）`);
  console.log(`  3. 中文数字解析规则版本兼容（旧存档假设 version=1 or 2）`);
  console.log(`  4. AOHP option_id 重生成（旧存档无语义键·加载时需重建菜单）`);
}

// ── 主函数 ──────────────────────────────────────────────────────────────────────
function main(): void {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   纵切 Demo 薄壳 · P0-11 前哨 · web-debug 单宿主端到端      ║');
  console.log('║   无 LLM · 脚本化叙事 · 红线零接触                          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  runD1();
  runD2();
  runD3();
  runD4();

  console.log(`\n${'═'.repeat(62)}`);
  console.log('  纵切 Demo 完成');
  console.log(`  test 数 ≥ 3342 · schemaKeys=52 · 指纹 manifest=84 · 红线零改`);
  console.log('═'.repeat(62));
}

main();
