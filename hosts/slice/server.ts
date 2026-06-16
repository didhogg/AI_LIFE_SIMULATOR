// M4 极简网页 UI — pnpm dev → http://localhost:3000
// 同一引擎主循环（与 CLI index.ts 共用同一函数链，不另起一套）
// 知情过滤：filterSecretsForPOV 在出叙事之前过滤，$谜底 永不送 LLM
// 四个动作：对话 / 给钱 / 检定 / 悔棋
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// ── .env 加载（同 index.ts）────────────────────────────────────────────────────
function loadDotEnv(): void {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx < 1) continue;
    const key = line.slice(0, eqIdx).trim();
    const val = line
      .slice(eqIdx + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (key && !(key in process.env)) process.env[key] = val;
  }
}
loadDotEnv();

import {
  buildWorld,
  PC,
  NPC_WANG,
  NPC_HONG,
  LOC_NAME,
  RECIPE,
  RECIPE_KEY,
  SAVE_SEED,
  CREDIT_AMOUNT,
  CREDIT_REASON,
} from "./fixture/world.js";
import { assemblePrompt } from "./assemble.js";
import { callNarrative } from "./adapter/openai-compatible.js";
import { assertConservation, assertNetZero } from "./ledger/gate.js";
import { TransferWorklist } from "./ledger/commit.js";
import { initBalances, snapshotBalances } from "./ledger/state.js";
import { runD20Check } from "./engine/check.js";
import { createArchiveHeader, bumpSalt } from "./engine/archive.js";
import { SnapshotRingBuffer, assertClosedAccount, RING_K } from "./engine/snapshot.js";
import type { SliceTickLog, TickLifecycleState } from "./engine/snapshot.js";
import { rewindTick } from "./engine/rewind.js";
import { filterSecretsForPOV } from "@ai-life-sim/core/engine/knowledgeFilter";
import type { 秘密库条目Type } from "@ai-life-sim/core";

// ── 游戏状态单例 ───────────────────────────────────────────────────────────────
const state = buildWorld();
let header = createArchiveHeader(SAVE_SEED);
const INITIAL_BALANCES: Record<string, number> = {
  [PC]: 30,
  [NPC_WANG]: 200,
  [NPC_HONG]: 0,
};
const balances = initBalances(INITIAL_BALANCES);
// 网页测试壳的快照保留量：远大于引擎 RING_K（护城河的有界记忆模型）。
// 引擎/soak/重放仍用有界 RING_K（m3 测试依赖其淘汰行为）；此处只放宽「手玩时能一路悔棋回开局」。
const WEB_RING_CAP = Math.max(10_000, RING_K);
let ring = new SnapshotRingBuffer(WEB_RING_CAP);
// auxStack：与 ring 严格同步的旁路栈，保存每拍拍前债务三元组（赊账不动现金，无法只靠账本派生），悔棋按同一索引回滚
let auxStack: Array<{ debt: number; creditCount: number; wangReceivable: number }> = [];
const tickLog: SliceTickLog[] = [];
let tickCount = 2; // 从拍2开始（拍1=M0 世界初始化）
let lifecycle: TickLifecycleState = "空闲";
let lastNarrative = "欢迎来到悦来客栈。请选择你的行动。";
const narrativeHistory: string[] = []; // 叙事记忆：喂回 LLM，剧情才能前进
const actionHistory: string[] = []; // 动作序列：让叙事感知动作间的转折，NPC 才能对「刚做完X又来做Y」有反应

// 赊账债务状态（林九欠王掌柜）：现金借款模型——赊账=王掌柜把等值现金垫给林九
let debt = 0;            // 林九应付（负债）
let creditCount = 0;
let wangReceivable = 0;  // 王掌柜应收（资产）；任何时刻恒 == debt

// 游戏内时间：从 tickCount 确定性派生。悔棋还原 tickCount 后时间自动跟着回退，绝不漂移。
// 每个推进动作消耗一个时段；时段用满自动进入第二天（带「入夜·本日结束」旁白）。
const 时段表 = ["清晨", "上午", "晌午", "午后", "傍晚", "入夜"] as const;
const TICKS_PER_DAY = 时段表.length;
function gameClock(tc: number) {
  const elapsed = Math.max(0, tc - 2);
  const slot = elapsed % TICKS_PER_DAY;
  const day = Math.floor(elapsed / TICKS_PER_DAY) + 1;
  return {
    day,
    slot,
    label: 时段表[slot]!,
    isDayEnd: slot === TICKS_PER_DAY - 1,
  };
}

// ── 拍前快照 ─────────────────────────────────────────────────────────────────
function takeSnapshot(): void {
  assertClosedAccount(lifecycle);
  ring.push({
    tick: tickCount,
    balances: snapshotBalances(balances),
    tick_log: [...tickLog],
    observationTable: [],
    pendingQueue: [],
  });
  // auxStack 与 ring 严格同步（含同样的 WEB_RING_CAP 淘汰），保存拍前债务，悔棋时按同一索引还原
  auxStack.push({ debt, creditCount, wangReceivable });
  if (auxStack.length > WEB_RING_CAP) auxStack.shift();
}

// ── 试算平衡（会计恒等式·双分录自检闸）────────────────────────────────────────
// 有借必有贷、借贷必相等：赊账=「借 王掌柜应收 / 贷 林九应付」同额；还账另含现金那一对腿。
// 1) 两腿恒等：王掌柜应收 == 林九应付(debt)
// 2) 净资产守恒：Σ现金 + Σ应收 − Σ应付 恒 = 初始总额（230）
const INITIAL_NET_WORTH = Object.values(INITIAL_BALANCES).reduce((a, b) => a + b, 0);
function assertTrialBalance(): void {
  if (wangReceivable !== debt) {
    throw new Error(`试算平衡失败：王掌柜应收(${wangReceivable}) ≠ 林九应付(${debt})`);
  }
  let cash = 0;
  for (const v of balances.values()) cash += v;
  const net = cash + wangReceivable - debt;
  if (net !== INITIAL_NET_WORTH) {
    throw new Error(
      `净资产守恒失败：现金${cash}+应收${wangReceivable}−应付${debt}=${net}，应为${INITIAL_NET_WORTH}`,
    );
  }
}

// ── 叙事调用（带知情过滤·fail-open 短路：无 key 返回 stub）───────────────────
async function narrativeWithFilter(
  action: string,
  checkInfo?: string,
): Promise<string> {
  const secrets = (state.全局?.秘密库 ?? {}) as Record<string, 秘密库条目Type>;
  const visible = filterSecretsForPOV(secrets, PC);
  const { systemPrompt } = assemblePrompt(state, {
    pcKey: PC,
    locName: LOC_NAME,
    visibleSecrets: visible,
  });
  // 结构化记忆：账目快照 + 从账本派生的历程次数。
  // 次数直接从账本算（红姨只从「给钱」收钱、王掌柜只在赊账成功时付钱），悔棋回滚账本后自动跟着回退，绝不算错。
  const bal = snapshotBalances(balances);
  const linjiuBal = bal[PC] ?? 0;
  const wangBal = bal[NPC_WANG] ?? 0;
  const hongBal = bal[NPC_HONG] ?? 0;
  const payCount = Math.max(
    0,
    Math.round((hongBal - (INITIAL_BALANCES[NPC_HONG] ?? 0)) / 2),
  );
  // 债务从 auxStack 同步而来（赊账不动现金，无法只靠账本派生），悔棋会一并回滚。
  const debtLine =
    debt > 0
      ? `林九尚欠王掌柜 ${debt} 文（已赊账 ${creditCount} 次，未还清）。`
      : `林九目前没有欠王掌柜的账。`;
  // 最近动作顺序：让 NPC 能对「刚给完钱又来赊账」这种转折作出反应，而不只是数次数。
  const recentActions = actionHistory.slice(-6).join(" → ");
  const recap =
    `【当前账目】林九 ${linjiuBal} 文、王掌柜 ${wangBal} 文、红姨 ${hongBal} 文。\n` +
    `【赊欠】${debtLine}\n` +
    `【已发生】林九先前已给红姨钱 ${payCount} 次。` +
    (recentActions ? `\n【最近动作顺序】${recentActions}` : "");
  // 游戏内时间：随拍确定性推进，到「入夜」收束当天。
  const clock = gameClock(tickCount);
  const timeLine = `第 ${clock.day} 天 · ${clock.label}`;
  // 上一幕：只喂回最近 1 条，供��气衔接；严禁照抄，否则叙事会收敛成同一段文字、卡死推不动。
  const lastScene = narrativeHistory[narrativeHistory.length - 1] ?? "";
  const userPrompt =
    `【此刻】${timeLine}\n${recap}\n\n` +
    (lastScene
      ? `【上一幕·仅供语气衔接，严禁照抄或改写其措辞、对白与情节】\n${lastScene}\n\n`
      : "") +
    `【本拍行动】${action}` +
    (checkInfo ? `\n[检定结果] ${checkInfo}` : "") +
    `\n\n【场景铁律】故事永远固定在悦来客栈，在场只有林九、王掌柜、红姨三人。严禁引入任何新人物、新到的客人、新任务、新差事或新地��，也不要让任何人引导林九离开客栈去别处接活。\n` +
    `\n写作要求：\n` +
    `1. 必须正面回应林九最近的动作顺序，尤其是自相矛盾的行为（例如先给红姨赏钱、转头又向王掌柜赊账，或赊账后又给钱）——让王掌柜或红姨当��点破、调侃或起疑，而不是无视。\n` +
    `2. 推进的是时间与三人之间的情绪与关系，而非引入新事件：结合「${timeLine}」让光线、客流、人物状态随时辰自然变化。\n` +
    (clock.isDayEnd
      ? `3. 现在已是入夜，这是今天最后一刻——请把这一天明确收束（点明天色已暗、客栈打烊、本日结束），不要再起新话头。\n`
      : `3. 严禁重复或改写上一幕的句子、对白与情节，写出尚未出现过的新内容；不要新开支线，顺着当前处境往下写。\n`) +
    `4. 不要重新自我介绍或重复开场，写 2-4 句白话叙事即可。`;
  if (!process.env["DEEPSEEK_API_KEY"]) {
    return `（无 API key·叙事短路）${action.slice(0, 20)}…`;
  }
  const resp = await callNarrative({ systemPrompt, userPrompt });
  return resp.text;
}

// ── 动作处理器 ────────────────────────────────────────────────────────────────
async function handleAction(action: string, text?: string): Promise<{
  narrative: string;
  status: ReturnType<typeof getStatus>;
  checkResult?: {
    diceRoll: number;
    attrBonus: number;
    total: number;
    dc: number;
    success: boolean;
  };
  rewindOk?: boolean;
  error?: string;
}> {
  try {
    switch (action) {
      case "对话": {
        takeSnapshot();
        tickCount++;
        lifecycle = "结算中";
        const narrative = await narrativeWithFilter(
          `拍${tickCount}：林九与在场人物交谈。`,
        );
        lastNarrative = narrative;
        narrativeHistory.push(narrative);
        actionHistory.push("对话");
        tickLog.push({
          tick_id: `tick-web-${tickCount}`,
          拍计数: tickCount,
          结果摘要: narrative.slice(0, 40),
          系数组指纹: "",
          盐值: header.全局回滚计数器,
        });
        lifecycle = "空闲";
        return { narrative, status: getStatus() };
      }

      case "给钱": {
        // 余额闸：林九兜里不够 2 文就给不出——账本不许透支（账面非负不变量），别再假装能给
        if ((balances.get(PC) ?? 0) < 2) {
          return {
            narrative:
              "林九摸了摸钱袋，指尖只触到空荡荡的布角——一文铜钱也不剩了。这钱，今日是给不出去了。",
            status: getStatus(),
            error: "林九余额不足，无法给钱",
          };
        }
        takeSnapshot();
        tickCount++;
        lifecycle = "结算中";
        const narrative = await narrativeWithFilter(
          `拍${tickCount}：林九掏出2文铜钱递给红姨，作为跑腿酬劳。`,
        );
        lastNarrative = narrative;
        narrativeHistory.push(narrative);
        actionHistory.push("给钱");
        const wl = new TransferWorklist();
        wl.load([{ from: PC, to: NPC_HONG, amount: 2, reason: "小费" }]);
        const records = wl.commit(balances);
        assertConservation(records);
        assertNetZero(records);
        tickLog.push({
          tick_id: `tick-web-${tickCount}`,
          拍计数: tickCount,
          结果摘要: "给红姨2文小费",
          系数组指纹: "",
          盐值: header.全局回滚计数器,
        });
        lifecycle = "空闲";
        return { narrative, status: getStatus() };
      }

      case "检定": {
        takeSnapshot();
        tickCount++;
        lifecycle = "结算中";
        const checkResult = runD20Check(
          SAVE_SEED,
          tickCount,
          RECIPE_KEY,
          RECIPE.attrBonus,
          RECIPE.dc,
          header,
        );
        const checkInfo = `1d20=${checkResult.diceRoll}+魅力${checkResult.attrBonus}=${checkResult.total} vs DC${checkResult.dc} → ${checkResult.success ? "✅成功" : "❌失败"}`;
        const narrative = await narrativeWithFilter(
          `拍${tickCount}：林九向王掌柜请求赊账，说起了当年旧情。`,
          checkInfo,
        );
        lastNarrative = narrative;
        narrativeHistory.push(narrative);
        actionHistory.push(checkResult.success ? "赊账成功" : "赊账失败");
        if (checkResult.success) {
          // 真·赊账：王掌柜把 CREDIT_AMOUNT 文的等值（酒菜）垫给林九——现金账本里体现为一笔守恒的
          // 王掌柜→林九 转账（林九拿到等值、王掌柜垫出本钱），同时记一对债权债务腿：
          //   借：王掌柜应收 ↑   贷：林九应付 ↑（同额）。
          // 还账时林九→王掌柜原路转回并冲销这对腿，整周期后王掌柜精确回到本金、绝不凭空多出。
          // 垫资以王掌柜兜里现金为上限（账面非负），实际记账金额 = 能垫出的数。
          const credit = Math.min(CREDIT_AMOUNT, balances.get(NPC_WANG) ?? 0);
          if (credit > 0) {
            const wl = new TransferWorklist();
            wl.load([{ from: NPC_WANG, to: PC, amount: credit, reason: CREDIT_REASON }]);
            const records = wl.commit(balances);
            assertConservation(records);
            assertNetZero(records);
            debt += credit; // 贷：林九应付 ↑
            wangReceivable += credit; // 借：王掌柜应收 ↑（同额）
            creditCount += 1;
          }
        }
        assertTrialBalance();
        header = bumpSalt(header);
        tickLog.push({
          tick_id: `tick-web-${tickCount}`,
          拍计数: tickCount,
          结果摘要: checkResult.success
            ? `赊账成功·欠款累计${debt}文`
            : "赊账失败",
          系数组指纹: "",
          盐值: checkResult.salt,
        });
        lifecycle = "空闲";
        return {
          narrative,
          status: getStatus(),
          checkResult: {
            diceRoll: checkResult.diceRoll,
            attrBonus: checkResult.attrBonus,
            total: checkResult.total,
            dc: checkResult.dc,
            success: checkResult.success,
          },
        };
      }

      case "还账": {
        // 还账闸：没欠账、或兜里没钱，就还不了——别假装结清
        if (debt <= 0) {
          return {
            narrative: "林九并未欠王掌柜分文，无账可还。",
            status: getStatus(),
            error: "无欠账可还",
          };
        }
        if ((balances.get(PC) ?? 0) <= 0) {
          return {
            narrative: "林九翻遍钱袋，一文不剩，纵想还账，此刻也无从还起。",
            status: getStatus(),
            error: "林九余额不足，无法还账",
          };
        }
        takeSnapshot();
        tickCount++;
        lifecycle = "结算中";
        // 实还金额 = min(欠款, 林���现金)，做一笔守恒的 林九→王掌柜 转账
        const repay = Math.min(debt, balances.get(PC) ?? 0);
        const narrative = await narrativeWithFilter(
          `拍${tickCount}：林九取出${repay}文铜钱，归还先前向王掌柜赊欠的账。`,
        );
        lastNarrative = narrative;
        narrativeHistory.push(narrative);
        actionHistory.push("还账");
        const wl = new TransferWorklist();
        wl.load([
          { from: PC, to: NPC_WANG, amount: repay, reason: CREDIT_REASON },
        ]);
        const records = wl.commit(balances);
        assertConservation(records);
        assertNetZero(records);
        debt -= repay;           // 借：林九应付 ↓
        wangReceivable -= repay; // 贷：王掌柜应收 ↓（镜像同额）
        assertTrialBalance();
        tickLog.push({
          tick_id: `tick-web-${tickCount}`,
          拍计数: tickCount,
          结果摘要: `还账${repay}文·余欠${debt}文`,
          系数组指纹: "",
          盐值: header.全局回滚计数器,
        });
        lifecycle = "空闲";
        return { narrative, status: getStatus() };
      }

      case "悔棋": {
        if (ring.size === 0) {
          return {
            narrative: "（没有可悔棋的快照）",
            status: getStatus(),
            rewindOk: false,
          };
        }
        // 关键修复：rewindTick 只读快照 + 计数器 +1，并不会把已消费的快照移出 ring。
        // 若每次都对 ring.size-1 悔棋而不缩 ring，size-1 永远指向同一个最新快照 → 只能回退一拍。
        // 所以这里记下目标索引，悔棋后用 ring.all() 重建一个去掉该快照的新 ring，下次悔棋自然指向上一拍。
        const idx = ring.size - 1;
        const rw = rewindTick(ring, idx, header);
        // 还原现金账本
        balances.clear();
        for (const [k, v] of rw.balances) balances.set(k, v);
        // 还原债务（赊账不动现金，必须从 auxStack 按同一索引取回拍前值）
        const aux = auxStack[idx];
        debt = aux ? aux.debt : 0;
        creditCount = aux ? aux.creditCount : 0;
        wangReceivable = aux ? aux.wangReceivable : 0;
        assertTrialBalance();
        // 还原 tick 计数和 tick_log（不还原全局回滚计数器）；游戏内时间随 tickCount 自动回退
        tickCount = rw.tick;
        narrativeHistory.length = Math.max(0, rw.tick - 2);
        actionHistory.length = Math.max(0, rw.tick - 2);
        tickLog.length = 0;
        for (const e of rw.tick_log) tickLog.push(e);
        header = rw.header; // 全局回滚计数器 +1（已在 rewindTick 中 bumpSalt）
        // 缩 ring + auxStack：丢掉刚消费的快照，使下次悔棋指向更早一拍（多步回退，上限 WEB_RING_CAP）
        const kept = ring.all().slice(0, idx);
        ring = new SnapshotRingBuffer(WEB_RING_CAP);
        for (const s of kept) ring.push(s);
        auxStack.length = idx;
        lastNarrative = `（悔棋成功·已回滚到拍${rw.tick}·全局回滚计数器=${rw.header.全局回滚计数器}）`;
        lifecycle = "空闲";
        return {
          narrative: lastNarrative,
          status: getStatus(),
          rewindOk: true,
        };
      }

      case "自定义对话": {
        // 叙事专用：自由文本只推进叙事与时间，绝不触碰账本（钱/债务只能由按钮经账本闸改动）。
        const input = (text ?? "").trim();
        if (!input) {
          return {
            narrative: "（请先输入一句你想让林九做或说的话）",
            status: getStatus(),
            error: "空输入",
          };
        }
        takeSnapshot();
        tickCount++;
        lifecycle = "结算中";
        const narrative = await narrativeWithFilter(`拍${tickCount}：${input}`);
        lastNarrative = narrative;
        narrativeHistory.push(narrative);
        actionHistory.push(`自定义：${input.slice(0, 20)}`);
        tickLog.push({
          tick_id: `tick-web-${tickCount}`,
          拍计数: tickCount,
          结果摘要: `自定义对话：${input.slice(0, 30)}`,
          系数组指纹: "",
          盐值: header.全局回滚计数器,
        });
        lifecycle = "空闲";
        return { narrative, status: getStatus() };
      }

      default:
        return {
          narrative: `未知动作：${action}`,
          status: getStatus(),
          error: `unknown action`,
        };
    }
  } catch (err) {
    lifecycle = "空闲";
    return {
      narrative: `[错误] ${String(err)}`,
      status: getStatus(),
      error: String(err),
    };
  }
}

function getStatus() {
  const bal = snapshotBalances(balances);
  const inScene = Object.entries(state.NPC ?? {})
    .filter(([, npc]) => (npc.位置 ?? "") === (state.NPC?.[PC]?.位置 ?? ""))
    .map(([, npc]) => npc.姓名 ?? "?");
  const clock = gameClock(tickCount);
  return {
    拍计数: tickCount,
    balances: bal,
    debt,
    应收: wangReceivable,
    creditCount,
    day: clock.day,
    时段: clock.label,
    inScene,
    ringSize: ring.size,
    lifecycle,
  };
}

// ── 极简 HTML（内联）──────────────────────────────────────────────────────────
const HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI 文游人生模拟器 M4</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #1a1a2e; color: #e0d8c8; font-family: 'Noto Serif SC', serif; min-height: 100vh; }
  .container { max-width: 760px; margin: 0 auto; padding: 24px 16px; }
  h1 { font-size: 1.4rem; color: #c9a86c; margin-bottom: 16px; letter-spacing: 2px; }
  .status-bar {
    background: #16213e; border: 1px solid #344; border-radius: 6px;
    padding: 10px 14px; margin-bottom: 16px; font-size: 0.85rem; color: #aab;
    display: flex; gap: 16px; flex-wrap: wrap;
  }
  .status-bar span { color: #c9a86c; font-weight: bold; }
  .narrative {
    background: #0f0f23; border: 1px solid #344; border-radius: 6px;
    padding: 16px; min-height: 160px; margin-bottom: 16px;
    line-height: 1.9; font-size: 1rem; white-space: pre-wrap; color: #d8ccb8;
  }
  .actions { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
  button {
    background: #c9a86c; color: #1a1a2e; border: none; border-radius: 5px;
    padding: 10px 20px; font-size: 1rem; cursor: pointer; font-weight: bold;
    transition: background .15s;
  }
  button:hover { background: #e0c080; }
  button:disabled { background: #555; color: #888; cursor: not-allowed; }
  .check-result {
    background: #0f1a10; border: 1px solid #2a4; border-radius: 6px;
    padding: 10px 14px; font-size: 0.9rem; color: #9f9; margin-bottom: 12px;
    display: none;
  }
  .check-result.show { display: block; }
  .log { font-size: 0.78rem; color: #667; margin-top: 8px; }
</style>
</head>
<body>
<div class="container">
  <h1>⚔ 文游人生模拟器 · M4 纵切</h1>
  <div class="status-bar" id="status">加载中…</div>
  <div class="narrative" id="narrative">欢迎来到悦来客栈。请选择你的行动。</div>
  <div class="check-result" id="check-result"></div>
  <div class="actions">
    <button onclick="doAction('对话')">💬 对话</button>
    <button id="btn-pay" onclick="doAction('给钱')">💰 给红姨钱（2文）</button>
    <button onclick="doAction('检定')">🎲 检定（赊账）</button>
    <button id="btn-repay" onclick="doAction('还账')">📜 还账</button>
    <button onclick="doAction('悔棋')">↩ 悔棋</button>
  </div>
  <div style="display:flex;gap:8px;margin-bottom:12px;">
    <input id="custom-text" type="text" placeholder="输入一句自定义对话/动作（仅推进叙事，不动账目）…" style="flex:1;padding:10px;border-radius:5px;border:1px solid #344;background:#0f0f23;color:#e0d8c8;font-size:0.95rem;" onkeydown="if(event.key==='Enter')doCustom();" />
    <button onclick="doCustom()">发送</button>
  </div>
  <div class="log" id="log"></div>
</div>
<script>
let lastLinjiu = 0;
let lastDebt = 0;
function applyPayGuard(linjiu) {
  const btn = document.getElementById('btn-pay');
  if (btn) btn.disabled = linjiu < 2;
  const rb = document.getElementById('btn-repay');
  if (rb) rb.disabled = lastDebt <= 0 || linjiu <= 0;
}
async function loadState() {
  const r = await fetch('/api/state');
  const s = await r.json();
  renderStatus(s);
}

function renderStatus(s) {
  const bar = document.getElementById('status');
  const bal = s.balances;
  const inScene = (s.inScene || []).join('、');
  bar.innerHTML =
    \`<span>第\${s.day ?? 1}天·\${s.时段 ?? ''}</span>
     <span>拍#\${s.拍计数}</span>
     <span>林九: \${bal['pc_linjiu'] ?? 0} 文</span>
     <span>王掌柜: \${bal['npc_wang'] ?? 0} 文</span>
     <span>红姨: \${bal['npc_hong'] ?? 0} 文</span>
     <span>欠账: \${s.debt ?? 0} 文</span>
     <span>应收: \${s.应收 ?? 0} 文</span>
     <span>在场: \${inScene}</span>
     <span>快照: \${s.ringSize}拍</span>
     <span>\${s.lifecycle}</span>\`;
  lastLinjiu = bal['pc_linjiu'] ?? 0;
  lastDebt = s.debt ?? 0;
  applyPayGuard(lastLinjiu);
}

async function doAction(action, text) {
  const btns = document.querySelectorAll('button');
  btns.forEach(b => b.disabled = true);
  document.getElementById('log').textContent = \`发送动作：\${action}…\`;
  document.getElementById('check-result').className = 'check-result';

  try {
    const r = await fetch('/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, text }),
    });
    const data = await r.json();
    document.getElementById('narrative').textContent = data.narrative || '';
    renderStatus(data.status);
    if (data.checkResult) {
      const cr = data.checkResult;
      const el = document.getElementById('check-result');
      el.textContent = \`🎲 1d20=\${cr.diceRoll} + 魅力\${cr.attrBonus} = \${cr.total} vs DC\${cr.dc} → \${cr.success ? '✅ 成功' : '❌ 失败'}\`;
      el.className = 'check-result show';
    }
    document.getElementById('log').textContent = data.error ? \`[错误] \${data.error}\` : '';
  } catch (e) {
    document.getElementById('narrative').textContent = \`[网络错误] \${e}\`;
  } finally {
    btns.forEach(b => b.disabled = false);
    applyPayGuard(lastLinjiu);
  }
}

function doCustom() {
  const el = document.getElementById('custom-text');
  const t = (el.value || '').trim();
  if (!t) return;
  doAction('自定义对话', t);
  el.value = '';
}

loadState();
</script>
</body>
</html>`;

// ── HTTP 服务器 ────────────────────────────────────────────────────────────────
const PORT = Number(process.env["PORT"] ?? 3000);

const server = createServer((req, res) => {
  const url = req.url ?? "/";
  const method = req.method ?? "GET";

  // 公共 CORS header（本机开发用）
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (url === "/" && method === "GET") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(HTML);
    return;
  }

  if (url === "/api/state" && method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(getStatus()));
    return;
  }

  if (url === "/api/action" && method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += String(chunk);
    });
    req.on("end", () => {
      let parsed: { action?: string; text?: string };
      try {
        parsed = JSON.parse(body) as { action?: string };
      } catch {
        res.writeHead(400);
        res.end(JSON.stringify({ error: "bad JSON" }));
        return;
      }
      const act = parsed.action ?? "";
      handleAction(act, parsed.text)
        .then((result) => {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(result));
        })
        .catch((err) => {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: String(err),
              narrative: `[500] ${String(err)}`,
              status: getStatus(),
            }),
          );
        });
    });
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(PORT, "127.0.0.1", () => {
  process.stdout.write(`🎮 M4 纵切 Web UI → http://localhost:${PORT}\n`);
  process.stdout.write(`   动作：对话 / 给钱 / 检定 / 还账 / 悔棋 / 自定义对话\n`);
  process.stdout.write(`   知情过滤：S1 对主角不可见（existence-opaque）\n`);
});