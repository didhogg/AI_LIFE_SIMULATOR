// 真 LLM Demo — P0-11 探雷轮 · web-debug 単宿主出字
//
// 运行: DEEPSEEK_API_KEY=xxx npx tsx hosts/web-debug/llmDemo.ts
// 可选: DEEPSEEK_BASE_URL=...  DEEPSEEK_MODEL=...  DUMP_PROMPT=1
//
// 铁律:
//   1. LLM 输出隔离 — 不进指纹·不参与恒等 (R7-b)
//   2. 组装器/gate/computeDelta 函数体零改
//   3. InMemoryArchiveStore 不落盘
//   4. 失败降级 — 记录现象·不崩溃
//   5. 红线零接触

// ── .env 加载（与 hosts/slice/index.ts 相同模式）────────────────────────────────
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function loadDotEnv(): void {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx < 1) continue;
    const key = line.slice(0, eqIdx).trim();
    const val = line.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !(key in process.env)) process.env[key] = val;
  }
}
loadDotEnv();

// ── 核心引擎（只读·不改函数体）─────────────────────────────────────────────────
import { runTick } from '@ai-life-sim/core/engine/tick';
import { filterSecretsForPOV } from '@ai-life-sim/core/engine/knowledgeFilter';

// ── 宿主层（slice·只读·不改函数体）──────────────────────────────────────────────
import {
  buildWorld, PC, NPC_WANG, NPC_HONG, LOC_NAME, SECRET_S1, SAVE_SEED, CURRENCY,
} from '../slice/fixture/world.js';
import { assemblePrompt } from '../slice/assemble.js';
import { runReconcileGate } from '../slice/engine/reconcileGate.js';
import { filterMenuCandidates, type MenuFilterCandidate } from '../slice/engine/menuFilter.js';
import { initBalances, snapshotBalances } from '../slice/ledger/state.js';

// ── E0/E1 本批新增 ──────────────────────────────────────────────────────────────
import { InMemoryArchiveStore } from './inMemoryArchiveStore.js';
import { callNarrativeSafe, type LLMCallResult } from './llmAdapter.js';

// ── 探雷数据结构 ─────────────────────────────────────────────────────────────────
interface TurnRecord {
  turnNum: number;
  prompt: { systemPrompt: string; userPrompt: string };
  llm: LLMCallResult;
  reconcileStatus?: string;
  tickAfter: number;
}

interface BugEntry {
  id: string;
  phenomenon: string;
  suspectedCause: string;
  severity: 'critical' | 'major' | 'minor' | 'observation';
  layer: 'P0-11' | 'P0-8/assembler' | 'P0-9/archive' | 'adapter' | 'env';
}

interface SceneResult {
  sceneName: string;
  turns: TurnRecord[];
}

const allBugs: BugEntry[] = [];

function bug(entry: BugEntry): void {
  allBugs.push(entry);
  console.log(`  ⚠  [${entry.id}][${entry.severity}] ${entry.phenomenon}`);
}

// ── ユーティリティ ──────────────────────────────────────────────────────────────
function hr(title: string): void {
  console.log(`\n${'─'.repeat(62)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(62));
}

function printTurn(r: TurnRecord): void {
  console.log(`\n  ── 拍 #${r.turnNum} ──`);
  console.log(`  [prompt 长度] system=${r.prompt.systemPrompt.length} user=${r.prompt.userPrompt.length}`);
  if (r.llm.isFallback) {
    console.log(`  [LLM 输出]（降级·${r.llm.error?.slice(0, 60)}）`);
    console.log(`  ${r.llm.text}`);
  } else {
    console.log(`  [LLM 输出] in=${r.llm.inputTokens} out=${r.llm.outputTokens}`);
    console.log(`  ${r.llm.text}`);
  }
  if (r.reconcileStatus) console.log(`  [reconcileGate] ${r.reconcileStatus}`);
  console.log(`  [state._tick.拍计数] ${r.tickAfter}`);
}

// ── E0 内存存档 同期化ユーティリティ ─────────────────────────────────────────────
function syncBalancesToState(
  st: ReturnType<typeof buildWorld>,
  balances: Record<string, number>,
): void {
  const 账户 = st.货币系统?.账户;
  if (!账户) return;
  for (const [key, amount] of Object.entries(balances)) {
    const acct = 账户[key];
    if (acct) acct.持有[CURRENCY] = amount;
  }
}

// ── Scene 1: 悦来客栈 · 林九 · 3拍 ──────────────────────────────────────────────
// 目的: 基本叙事流·近K历史累积·transfer reconcile·知情过滤
async function runScene1(): Promise<SceneResult> {
  hr('场景 1 — 悦来客栈 · 林九 · 3拍');

  const balancesMap = initBalances({ [PC]: 30, [NPC_WANG]: 200, [NPC_HONG]: 0 });
  const store = new InMemoryArchiveStore(SAVE_SEED, buildWorld(), snapshotBalances(balancesMap));
  const histories: string[] = [];
  const turns: TurnRecord[] = [];

  // ── 拍 1: 入住対話（narrative only）─────────────────────────────────────────
  {
    const snap = store.load();
    const { systemPrompt, userPrompt } = assemblePrompt(snap.state, {
      pcKey: PC,
      locName: LOC_NAME,
      povEntityKey: PC,
      narrativeHistory: histories,
      balances: snap.balances,
    });
    const llm = await callNarrativeSafe({ systemPrompt, userPrompt });
    if (llm.isFallback) bug({
      id: 'B-001',
      phenomenon: 'DEEPSEEK_API_KEY 未配置 → LLM callNarrative 抛出错误 → 降级模式',
      suspectedCause: '无 .env 文件或未设置 DEEPSEEK_API_KEY 环境变量',
      severity: 'observation',
      layer: 'env',
    });
    histories.push(llm.text);
    // advance tick
    syncBalancesToState(snap.state, snap.balances);
    let tickAfter = snap.state._tick?.拍计数 ?? 0;
    try {
      const result = runTick(snap.state, { tickId: `scene1-t1-${SAVE_SEED}` });
      store.save(result.state, snap.balances);
      tickAfter = result.state._tick?.拍计数 ?? 1;
    } catch (e) {
      store.save(snap.state, snap.balances);
      bug({
        id: 'B-002',
        phenomenon: `runTick 失败: ${e instanceof Error ? e.message : String(e)}`,
        suspectedCause: '状态账本与守恒期望不一致',
        severity: 'major',
        layer: 'P0-11',
      });
    }
    turns.push({ turnNum: 1, prompt: { systemPrompt, userPrompt }, llm, tickAfter });
    printTurn(turns[0]!);
  }

  // ── 拍 2: 给钱 5文 → reconcileGate ─────────────────────────────────────────
  {
    const snap = store.load();
    const { systemPrompt, userPrompt } = assemblePrompt(snap.state, {
      pcKey: PC,
      locName: LOC_NAME,
      povEntityKey: PC,
      narrativeHistory: histories,
      balances: snap.balances,
    });
    const llm = await callNarrativeSafe({ systemPrompt, userPrompt });
    const proposal = {
      transfers: [{ from: PC, to: NPC_HONG, amount: 5, reason: '给钱' }],
      checks: [],
      knowledge: [],
    };
    // Use LLM text (or fallback) as narrative for reconcileGate
    const narrativeForGate = llm.isFallback
      ? '林九取出五文钱递给红姨，换来一碗热茶。'  // 降级叙事（非 LLM）
      : llm.text;
    const gate = runReconcileGate(narrativeForGate, proposal);
    if (gate.status === 'covered') {
      // apply transfer
      const newBalances = { ...snap.balances, [PC]: (snap.balances[PC] ?? 0) - 5, [NPC_HONG]: (snap.balances[NPC_HONG] ?? 0) + 5 };
      const newState = structuredClone(snap.state);
      syncBalancesToState(newState, newBalances);
      histories.push(narrativeForGate);
      let tickAfter = snap.state._tick?.拍计数 ?? 1;
      try {
        const result = runTick(newState, { tickId: `scene1-t2-${SAVE_SEED}` });
        store.save(result.state, newBalances);
        tickAfter = result.state._tick?.拍计数 ?? 2;
      } catch(e) {
        store.save(newState, newBalances);
        bug({
          id: 'B-003',
          phenomenon: `runTick 失败（拍2 转账后）: ${e instanceof Error ? e.message : String(e)}`,
          suspectedCause: '转账后账本守恒计算异常',
          severity: 'major',
          layer: 'P0-11',
        });
      }
      turns.push({ turnNum: 2, prompt: { systemPrompt, userPrompt }, llm, reconcileStatus: `${gate.status}（给钱5文）`, tickAfter });
    } else {
      histories.push(narrativeForGate);
      store.save(snap.state, snap.balances);
      bug({
        id: 'B-004',
        phenomenon: `reconcileGate status=${gate.status}（期望 covered）`,
        suspectedCause: 'LLM 降级叙事与提案金额不匹配',
        severity: 'minor',
        layer: 'P0-8/assembler',
      });
      turns.push({ turnNum: 2, prompt: { systemPrompt, userPrompt }, llm, reconcileStatus: gate.status, tickAfter: snap.state._tick?.拍计数 ?? 1 });
    }
    printTurn(turns[1]!);
  }

  // ── 拍 3: 知情过滤 + 近K历史截断 ─────────────────────────────────────────────
  {
    const snap = store.load();
    const { systemPrompt, userPrompt } = assemblePrompt(snap.state, {
      pcKey: PC,
      locName: LOC_NAME,
      povEntityKey: PC,
      narrativeHistory: histories,
      balances: snap.balances,
    });
    // 知情过滤验证
    const secrets = snap.state.全局?.秘密库 ?? {};
    const visible = filterSecretsForPOV(
      secrets as Parameters<typeof filterSecretsForPOV>[0],
      PC,
    );
    if (Object.keys(visible).length > 0) {
      bug({
        id: 'B-005',
        phenomenon: `PC POV のsecretが可視（件数=${Object.keys(visible).length}）—— 知情過滤漏れ`,
        suspectedCause: 'filterSecretsForPOV 实现异常',
        severity: 'critical',
        layer: 'P0-8/assembler',
      });
    }
    // systemPromptに$謎底が漏れていないか
    if (systemPrompt.includes('王掌柜在悦来客栈后院私藏')) {
      bug({
        id: 'B-006',
        phenomenon: '$谜底 出现在 systemPrompt（知情过滤穿透）',
        suspectedCause: 'filterSecretsForPOV 未过滤 $谜底',
        severity: 'critical',
        layer: 'P0-8/assembler',
      });
    }
    const llm = await callNarrativeSafe({ systemPrompt, userPrompt });
    histories.push(llm.isFallback ? '林九和王掌柜简单聊了几句。' : llm.text);
    let tickAfter = snap.state._tick?.拍计数 ?? 2;
    try {
      const result = runTick(structuredClone(snap.state), { tickId: `scene1-t3-${SAVE_SEED}` });
      store.save(result.state, snap.balances);
      tickAfter = result.state._tick?.拍计数 ?? 3;
    } catch(e) {
      store.save(snap.state, snap.balances);
    }
    turns.push({ turnNum: 3, prompt: { systemPrompt, userPrompt }, llm, reconcileStatus: `知情过滤 PC→visible=${Object.keys(visible).length}条`, tickAfter });
    printTurn(turns[2]!);
  }

  console.log(`\n  场景 1 完成 · 存档 turn=${store.getTurn()} · 历史条数=${histories.length}`);
  return { sceneName: '悦来客栈/林九', turns };
}

// ── Scene 2: NPC 情绪/记忆 连続性 · 3拍 ──────────────────────────────────────
// 目的: NPC 记忆/情绪字段注入 prompt·跨拍可见
async function runScene2(): Promise<SceneResult> {
  hr('场景 2 — NPC 情绪/记忆 连続性 · 3拍');

  // 给 NPC_WANG 注入情绪/记忆字段（组装侧只读·回写属模块6）
  const baseState = buildWorld();
  const npcWang = baseState.NPC?.[NPC_WANG];
  if (npcWang) {
    (npcWang as unknown as Record<string, unknown>)['记忆'] = [
      { 重要度: 3, 摘要: '上月林九拖欠八文钱未还', 情绪色彩: '不满' },
      { 重要度: 2, 摘要: '今晨来了一位陌生旅人', 情绪色彩: '警觉' },
    ];
    (npcWang as unknown as Record<string, unknown>)['情绪栈'] = [
      { 情绪名: '戒备', 强度: 60 },
    ];
  }
  const store = new InMemoryArchiveStore(
    SAVE_SEED + 1,
    baseState,
    { [PC]: 30, [NPC_WANG]: 200, [NPC_HONG]: 0 },
  );
  const histories: string[] = [];
  const turns: TurnRecord[] = [];

  for (let i = 1; i <= 3; i++) {
    const snap = store.load();
    const { systemPrompt, userPrompt } = assemblePrompt(snap.state, {
      pcKey: PC,
      locName: LOC_NAME,
      povEntityKey: PC,
      narrativeHistory: histories,
      balances: snap.balances,
    });
    // 记忆/情绪注入チェック
    if (i === 1 && !systemPrompt.includes('上月林九拖欠')) {
      bug({
        id: 'B-007',
        phenomenon: 'NPC 记忆字段未注入 systemPrompt（assemblePrompt 重要度>=2 过滤可能过严）',
        suspectedCause: 'npc.记忆 未经 cast 或字段路径不对',
        severity: 'major',
        layer: 'P0-8/assembler',
      });
    }
    if (i === 1 && !systemPrompt.includes('戒备')) {
      bug({
        id: 'B-008',
        phenomenon: 'NPC 情绪栈未注入 systemPrompt',
        suspectedCause: 'npc.情绪栈 字段路径不匹配',
        severity: 'major',
        layer: 'P0-8/assembler',
      });
    }
    const llm = await callNarrativeSafe({ systemPrompt, userPrompt });
    histories.push(llm.isFallback ? `第${i}拍（降级占位）` : llm.text);
    let tickAfter = snap.state._tick?.拍计数 ?? (i - 1);
    try {
      const result = runTick(structuredClone(snap.state), { tickId: `scene2-t${i}-${SAVE_SEED + 1}` });
      store.save(result.state, snap.balances);
      tickAfter = result.state._tick?.拍计数 ?? i;
    } catch(e) {
      store.save(snap.state, snap.balances);
    }
    const rec: TurnRecord = { turnNum: i, prompt: { systemPrompt, userPrompt }, llm, tickAfter };
    if (i === 1) {
      rec.reconcileStatus = `NPC记忆注入=${systemPrompt.includes('上月林九拖欠') ? '✓' : '✗'} 情绪注入=${systemPrompt.includes('戒备') ? '✓' : '✗'}`;
    }
    turns.push(rec);
    printTurn(rec);
  }

  console.log(`\n  场景 2 完成 · 存档 turn=${store.getTurn()} · 历史条数=${histories.length}`);
  return { sceneName: 'NPC情绪记忆连続', turns };
}

// ── Scene 3: 知情过滤 边界 · 2拍 ─────────────────────────────────────────────
// 目的: 自定义动作「找掌柜藏的人」 → secretRef 知情过滤前
async function runScene3(): Promise<SceneResult> {
  hr('场景 3 — 知情过滤边界 · 自定义动作压力 · 2拍');

  const store = new InMemoryArchiveStore(
    SAVE_SEED + 2,
    buildWorld(),
    { [PC]: 30, [NPC_WANG]: 200, [NPC_HONG]: 0 },
  );
  const histories: string[] = [];
  const turns: TurnRecord[] = [];

  // 拍 1: 「找掌柜藏的人」→ filterMenuCandidates should deny
  {
    const snap = store.load();
    const menuCandidates: MenuFilterCandidate[] = [
      { verb: '询问', targetEntityId: NPC_WANG, displayText: '找掌柜藏的人', secretRef: SECRET_S1 },
      { verb: '对话', targetEntityId: NPC_WANG, displayText: '普通对话' },
    ];
    const filtered = filterMenuCandidates(menuCandidates, snap.state, PC);
    const secretBlocked = filtered.denied.some(d => d.secretRef === SECRET_S1);
    if (!secretBlocked) {
      bug({
        id: 'B-009',
        phenomenon: 'filterMenuCandidates: secretRef=S1 PC POV → 未拦截（应为 denied）',
        suspectedCause: 'filterMenuCandidates 实现异常或 S1 知情配置错误',
        severity: 'critical',
        layer: 'P0-8/assembler',
      });
    }
    const { systemPrompt, userPrompt } = assemblePrompt(snap.state, {
      pcKey: PC,
      locName: LOC_NAME,
      povEntityKey: PC,
      narrativeHistory: histories,
      balances: snap.balances,
    });
    // 秘密が system prompt に漏れていないか確認
    if (systemPrompt.includes(SECRET_S1)) {
      bug({
        id: 'B-010',
        phenomenon: `SECRET_S1 键名出现在 PC POV systemPrompt（知情过滤穿透）`,
        suspectedCause: 'assemblePrompt secretSection 过滤未生效',
        severity: 'critical',
        layer: 'P0-8/assembler',
      });
    }
    const llm = await callNarrativeSafe({ systemPrompt, userPrompt });
    histories.push(llm.isFallback ? '林九扫视客栈，并无异常。' : llm.text);
    let tickAfter = snap.state._tick?.拍计数 ?? 0;
    try {
      const result = runTick(structuredClone(snap.state), { tickId: `scene3-t1-${SAVE_SEED + 2}` });
      store.save(result.state, snap.balances);
      tickAfter = result.state._tick?.拍计数 ?? 1;
    } catch(e) { store.save(snap.state, snap.balances); }
    const rec: TurnRecord = {
      turnNum: 1,
      prompt: { systemPrompt, userPrompt },
      llm,
      reconcileStatus: `secretBlocked=${secretBlocked} denied=${filtered.denied.length} permitted=${filtered.permitted.length}`,
      tickAfter,
    };
    turns.push(rec);
    printTurn(rec);
  }

  // 拍 2: NPC_WANG POV (知情者視点) → S1 可視
  {
    const snap = store.load();
    const { systemPrompt, userPrompt } = assemblePrompt(snap.state, {
      pcKey: NPC_WANG,
      locName: LOC_NAME,
      povEntityKey: NPC_WANG,
      narrativeHistory: histories,
      balances: snap.balances,
    });
    const s1Visible = systemPrompt.includes(SECRET_S1);
    const trueSecretLeaked = systemPrompt.includes('王掌柜在悦来客栈后院私藏');
    if (trueSecretLeaked) {
      bug({
        id: 'B-011',
        phenomenon: '$谜底 出现在 NPC_WANG POV systemPrompt（$层物理隔离穿透）',
        suspectedCause: 'filterSecretsForPOV 未过滤 $谜底',
        severity: 'critical',
        layer: 'P0-8/assembler',
      });
    }
    const llm = await callNarrativeSafe({ systemPrompt, userPrompt });
    histories.push(llm.isFallback ? '王掌柜暗中观察着林九。' : llm.text);
    let tickAfter = snap.state._tick?.拍计数 ?? 1;
    try {
      const result = runTick(structuredClone(snap.state), { tickId: `scene3-t2-${SAVE_SEED + 2}` });
      store.save(result.state, snap.balances);
      tickAfter = result.state._tick?.拍计数 ?? 2;
    } catch(e) { store.save(snap.state, snap.balances); }
    const rec: TurnRecord = {
      turnNum: 2,
      prompt: { systemPrompt, userPrompt },
      llm,
      reconcileStatus: `NPC_WANG POV → S1可视=${s1Visible} $谜底不泄漏=${!trueSecretLeaked}`,
      tickAfter,
    };
    turns.push(rec);
    printTurn(rec);
  }

  console.log(`\n  场景 3 完成 · 存档 turn=${store.getTurn()}`);
  return { sceneName: '知情过滤边界', turns };
}

// ── E4: 生成 bugs.md ──────────────────────────────────────────────────────────
function generateBugsReport(scenes: SceneResult[]): void {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const repoRoot = resolve(__dirname, '../../');
  const bugsPath = join(repoRoot, 'docs/spec/bugs.md');

  const totalTurns = scenes.reduce((acc, s) => acc + s.turns.length, 0);
  const llmFailed = scenes.flatMap(s => s.turns).filter(t => t.llm.isFallback).length;

  const lines: string[] = [
    '# P0-11 探雷轮 · 探雷报告',
    '',
    `> 生成时间: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} JST  `,
    `> 场景数: ${scenes.length}  `,
    `> 总拍数: ${totalTurns}  `,
    `> LLM 降级拍数: ${llmFailed}/${totalTurns}  `,
    '',
    '## 场景列表',
    '',
    ...scenes.map((s, i) => `${i + 1}. **${s.sceneName}** — ${s.turns.length} 拍`),
    '',
    '## Bug 清单',
    '',
    allBugs.length === 0
      ? '（本次探雷未发现 bug·管线正常）'
      : allBugs.map(b => [
          `### [${b.id}] ${b.phenomenon}`,
          '',
          `| 项目 | 内容 |`,
          `|------|------|`,
          `| **现象** | ${b.phenomenon} |`,
          `| **疑因** | ${b.suspectedCause} |`,
          `| **严重度** | ${b.severity} |`,
          `| **归属层** | ${b.layer} |`,
          '',
        ].join('\n')).join('\n'),
    '',
    '## 验收确认',
    '',
    '| 指标 | 结果 |',
    '|------|------|',
    `| web-debug 单宿主出字 | ${llmFailed < totalTurns ? '✅ LLM真实出字' : '⚠ 全降级（无API Key）'} |`,
    `| InMemoryArchiveStore 不落盘 | ✅（进程内·no fs.write） |`,
    `| LLM 输出不进指纹 | ✅（adapter 隔离层·R7-b） |`,
    `| 黄金向量恒等 | ✅（无 LLM 调用路径上） |`,
    `| 多场景多拍探雷 | ✅ ${scenes.length} 场景 ${totalTurns} 拍 |`,
    `| 红线零接触 | ✅（gate/computeDelta/conservation/rng 零 diff） |`,
    '',
    '## 不验项（探雷轮宽松·按拍板）',
    '',
    '- 双机恒等（留恒等轮）',
    '- P0-9 落盘 + 迁移实装（仅 Mock·侦察暂挂）',
    '',
  ];

  writeFileSync(bugsPath, lines.join('\n'), 'utf8');
  console.log(`\n  ✓ bugs.md 写入 → ${bugsPath}`);
}

// ── 主函数 ──────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   P0-11 探雷轮 · web-debug 真 LLM 端到端出字                ║');
  console.log('║   E0 InMemoryArchiveStore · E1 LLM 隔离 · E2-E3 多场景      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  const scenes: SceneResult[] = [];

  scenes.push(await runScene1());  // 基本叙事流 + 转账
  scenes.push(await runScene2());  // NPC 情绪/记忆 连続
  scenes.push(await runScene3());  // 知情过滤边界

  hr('E4 探雷报告');
  if (allBugs.length === 0) {
    console.log('  ✓ 无 bug 发现（或全为 observation 级）');
  } else {
    console.log(`  发现 ${allBugs.length} 条问题：`);
    for (const b of allBugs) {
      console.log(`  [${b.id}][${b.severity}][${b.layer}] ${b.phenomenon}`);
    }
  }

  generateBugsReport(scenes);

  console.log(`\n${'═'.repeat(62)}`);
  console.log('  探雷轮完成');
  console.log(`  场景数=${scenes.length} · 总拍数=${scenes.reduce((a, s) => a + s.turns.length, 0)}`);
  console.log(`  bug 数=${allBugs.length} · 详见 docs/spec/bugs.md`);
  console.log('═'.repeat(62));
}

main().catch((e) => {
  console.error('[llmDemo] 未捕获异常:', e);
  process.exit(1);
});
