// M2 CLI 入口 — 拍3(小费) + 拍4(检定) + 拍5(结果落账) + 双跑验证
// 纪律：六禁全绿；API key 走 .env；零 Math.random；单写者；clampLedger H1
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// ── .env 加载 ─────────────────────────────────────────────────────────────────
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

import { buildWorld, PC, NPC_WANG, NPC_HONG, CURRENCY, LOC_NAME,
         RECIPE, RECIPE_KEY, SAVE_SEED, CREDIT_AMOUNT, CREDIT_REASON } from './fixture/world.js';
import { assemblePrompt }    from './assemble.js';
import { callNarrative }     from './adapter/openai-compatible.js';
import { callAccounting }    from './adapter/accounting.js';
import { gateStructural, gateCoverage, assertConservation, assertNetZero } from './ledger/gate.js';
import { TransferWorklist }  from './ledger/commit.js';
import { initBalances, snapshotBalances } from './ledger/state.js';
import { runD20Check }       from './engine/check.js';
import { createArchiveHeader } from './engine/archive.js';
import type { FlowRecord }   from './ledger/commit.js';

// ── Tick log（M2 最小版，M3 换 RootState.tick_log）──────────────────────────
interface SliceTickLog {
  tick_id:    string;
  拍计数:     number;
  结果摘要:   string;
  系数组指纹: string;
  盐值?:      number;
}
const tickLog: SliceTickLog[] = [];

// ── 工具函数 ─────────────────────────────────────────────────────────────────
function printSection(title: string): void {
  process.stdout.write(`\n${'═'.repeat(12)} ${title} ${'═'.repeat(12)}\n`);
}

function printBalances(label: string, before: Record<string,number>, after: Record<string,number>): void {
  process.stdout.write(`── ${label} 账本 ──\n`);
  for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const b = before[k] ?? 0, a = after[k] ?? 0;
    const arrow = a < b ? '📉' : a > b ? '📈' : '  ';
    process.stdout.write(`  ${arrow} ${k}: ${b}→${a} ${CURRENCY}\n`);
  }
}

function printFlows(records: FlowRecord[]): void {
  if (!records.length) { process.stdout.write('  (无账变)\n'); return; }
  for (const r of records) {
    const clampNote = r.clamped ? ` ⚠ 已钳制(请求${r.requestedAmt}→实落${r.actualAmt})` : '';
    process.stdout.write(`  ${r.from}(${r.before_from}→${r.after_from}) → ${r.to}(${r.before_to}→${r.after_to})  ${r.actualAmt}${CURRENCY}  "${r.reason}"${clampNote}\n`);
  }
}

async function runTick(
  tickNo: number,
  action: string,
  balances: ReturnType<typeof initBalances>,
  entityContext: string,
  state: ReturnType<typeof buildWorld>,
  archiveHeader: { seed: number; 全局回滚计数器: number },
  checkResult?: ReturnType<typeof runD20Check>,
): Promise<void> {
  const tickId = `tick-m2-0${tickNo}`;

  printSection(`拍 ${tickNo}`);
  process.stdout.write(`[动作] ${action}\n\n`);

  // ── 叙事调用 ────────────────────────────────────────────────────────────────
  const { systemPrompt } = assemblePrompt(state, { pcKey: PC, locName: LOC_NAME });
  const narrativeResp = await callNarrative({
    systemPrompt,
    userPrompt: action + (checkResult
      ? `\n\n[检定结果] 1d20=${checkResult.diceRoll}+魅力${checkResult.attrBonus}=${checkResult.total} vs DC${checkResult.dc} → ${checkResult.success ? '✅成功' : '❌失败'}`
      : ''),
  });
  const narrative = narrativeResp.text;
  process.stdout.write(narrative + '\n');

  // ── 记账调用 ────────────────────────────────────────────────────────────────
  let rawJson = await callAccounting({ narrative, entityContext });

  // ── 三道闸 ──────────────────────────────────────────────────────────────────
  let gate1 = gateStructural(rawJson);
  let isDegraded = false;

  if (!gate1.ok) {
    process.stderr.write(`  [闸①] Zod拒绝: ${gate1.reason}\n`);
    isDegraded = true;
  }

  if (gate1.ok) {
    const cov = gateCoverage(narrative, gate1.proposal);
    if (!cov.covered) {
      process.stderr.write(`  [闸③] 漏项 ${JSON.stringify(cov.missing)}，重写…\n`);
      rawJson = await callAccounting({ narrative, entityContext });
      gate1 = gateStructural(rawJson);
      if (!gate1.ok) { isDegraded = true; }
      else if (!gateCoverage(narrative, gate1.proposal).covered) {
        process.stderr.write(`  [闸③] 重写后仍漏，降级 ⚠\n`); isDegraded = true;
      }
    }
  }

  // 成功拍：强制注入赊账转账（覆盖 LLM 可能遗漏的账变）
  if (checkResult?.success && !isDegraded && gate1.ok) {
    const hasCredit = gate1.proposal.transfers.some(t => t.amount === CREDIT_AMOUNT && t.to === PC);
    if (!hasCredit) {
      gate1.proposal.transfers.push({ from: NPC_WANG, to: PC, amount: CREDIT_AMOUNT, reason: CREDIT_REASON });
    }
  }

  // ── 落账 ────────────────────────────────────────────────────────────────────
  const before = snapshotBalances(balances);
  const wl = new TransferWorklist();
  wl.load(gate1.ok && !isDegraded ? gate1.proposal.transfers : []);
  const records = wl.commit(balances);
  const after = snapshotBalances(balances);

  // 守恒断言
  assertConservation(records);
  assertNetZero(records);

  // clamp 广播
  for (const r of records) {
    if (r.clamped) process.stderr.write(`  ⚠ H1钳制: ${r.from}→${r.to} 请求${r.requestedAmt}→实落${r.actualAmt}\n`);
  }

  // ── tick_log 登记 ────────────────────────────────────────────────────────────
  const logEntry: SliceTickLog = {
    tick_id:    tickId,
    拍计数:     tickNo,
    结果摘要:   checkResult
      ? `检定 ${RECIPE_KEY}: ${checkResult.success ? '成功' : '失败'} (d20=${checkResult.diceRoll}+${checkResult.attrBonus}=${checkResult.total} vs DC${checkResult.dc})`
      : narrative.slice(0, 40),
    系数组指纹: '',
  };
  if (checkResult) logEntry.盐值 = checkResult.salt;
  tickLog.push(logEntry);

  // ── 渲染 ────────────────────────────────────────────────────────────────────
  printBalances(`拍${tickNo}`, before, after);
  printFlows(records);
  if (checkResult) {
    process.stdout.write(`\n── 检定 ${RECIPE_KEY} ──\n`);
    process.stdout.write(`  d20骰值: ${checkResult.diceRoll}  属性加成: +${checkResult.attrBonus}  合计: ${checkResult.total}  DC: ${checkResult.dc}\n`);
    process.stdout.write(`  结果: ${checkResult.success ? '✅ 成功' : '❌ 失败'}  rawU: ${checkResult.rawU}  盐值: ${checkResult.salt}\n`);
  }
  process.stdout.write(`  守恒: ✅\n`);
}

async function main(): Promise<void> {
  const state   = buildWorld();
  const header  = createArchiveHeader(SAVE_SEED);
  const balances = initBalances({ [PC]: 30, [NPC_WANG]: 200, [NPC_HONG]: 0 });
  const entityContext = 'pc_linjiu=林九（主角）, npc_wang=王掌柜, npc_hong=红姨';

  // ── 拍 3：林九给红姨 2 文小费 ─────────────────────────────────────────────
  await runTick(3,
    '林九从钱袋里掏出两文铜钱，递给红姨："跑腿辛苦，拿去喝茶。"',
    balances, entityContext, state, header);

  // ── 拍 4：检定 chk_persuade_credit ───────────────────────────────────────
  const checkResult = runD20Check(
    header.seed, 4, RECIPE_KEY, RECIPE.attrBonus, RECIPE.dc, header,
  );

  await runTick(4,
    '林九打算向王掌柜请求赊一顿饭钱，说起了当年旧情。',
    balances, entityContext, state, header, checkResult);

  // ── 拍 5：按检定结果渲染 ──────────────────────────────────────────────────
  printSection(`拍 5 — 检定后果`);
  if (checkResult.success) {
    process.stdout.write(`  ✅ 说服成功！王掌柜叹了口气，赊账 ${CREDIT_AMOUNT}文。\n`);
    process.stdout.write(`  账本变动已在拍 4 落入（from npc_wang to pc_linjiu ${CREDIT_AMOUNT}${CURRENCY}）\n`);
  } else {
    process.stdout.write(`  ❌ 说服失败。王掌柜摇头："老哥，你欠的旧账还没还呢……"\n`);
    process.stdout.write(`  账本无变动。\n`);
  }

  // ── tick_log 输出 ─────────────────────────────────────────────────────────
  printSection('tick_log（含盐值）');
  for (const e of tickLog) {
    const saltStr = e.盐值 !== undefined ? `  盐值=${e.盐值}` : '';
    process.stdout.write(`  [${e.tick_id}] 拍${e.拍计数} — ${e.结果摘要}${saltStr}\n`);
  }

  // ── 双跑逐位恒等验证 ──────────────────────────────────────────────────────
  printSection('双跑逐位恒等');
  const r1 = runD20Check(header.seed, 4, RECIPE_KEY, RECIPE.attrBonus, RECIPE.dc, header);
  const r2 = runD20Check(header.seed, 4, RECIPE_KEY, RECIPE.attrBonus, RECIPE.dc, header);
  const eq = r1.rawU === r2.rawU && r1.diceRoll === r2.diceRoll && r1.success === r2.success;
  process.stdout.write(`  run1: rawU=${r1.rawU} diceRoll=${r1.diceRoll} success=${r1.success}\n`);
  process.stdout.write(`  run2: rawU=${r2.rawU} diceRoll=${r2.diceRoll} success=${r2.success}\n`);
  process.stdout.write(`  逐位恒等: ${eq ? '✅' : '❌ FAIL'}\n`);
  if (!eq) throw new Error('双跑逐位恒等断言失败');

  // ── 最终余额 ──────────────────────────────────────────────────────────────
  printSection('最终账本');
  for (const [k, v] of balances) {
    process.stdout.write(`  ${k}: ${v} ${CURRENCY}\n`);
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`[M2 ERROR] ${String(err)}\n`);
  process.exit(1);
});
