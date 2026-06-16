/* =====================================================================
 * soak.ts — 确定性 bug 猎手（soak / fuzz harness）
 * ---------------------------------------------------------------------
 * 思路：引擎确定、可重放，所以“这算不算 bug”不用人判。脚本反复
 *       随机玩 N 局，每拍自动校验几条不变量；破任一条 = 抓到 bug，
 *       并把可复现的随机种子存下来。
 * 重要：本脚本只用【罐装叙事 + 罐装提案】驱动引擎单元函数，绝不调 live LLM
 *       —— 又快又便宜又确定，不烧 CC/DeepSeek 额度。
 * 跑法（从仓库根目录）：
 *   pnpm --filter @ai-life-sim/slice soak -- --runs 300 --ticks 8
 *   pnpm --filter @ai-life-sim/slice soak -- --seed 12345 --runs 1   // 复现失败种子
 *
 * 赊账/还账维度（本次新增）：
 *   结算公式严格照抄 server.ts 的 handleAction('检定'|'还账')（唯一口径，禁第二实现）：
 *     赊账成功：credit = min(CREDIT_AMOUNT, 王掌柜现金)；debt += credit；wangReceivable += credit
 *     还账：    repay  = min(debt, 林九现金)；debt -= repay；wangReceivable -= repay
 *   债务不进 ring 快照（快照只存现金账本），所以悔棋必须配一份与 ring 同步淘汰的
 *   旁路栈 auxStack（与 server.ts 的 auxStack 同一设计），按同一索引还原 debt/wangReceivable。
 * ===================================================================== */

import { writeFileSync, mkdirSync } from 'node:fs';

// 以下 import 的名字/路径均按你仓库 m1.test.ts / m3.test.ts / server.ts 里的真实用法对齐。
import {
	SnapshotRingBuffer,
	serializeArchive,
	deserializeArchive,
	assertClosedAccount,
	RING_K,
} from '../engine/snapshot.js';
import type { SliceSnapshot, SliceTickLog } from '../engine/snapshot.js';
import { rewindTick } from '../engine/rewind.js';
import { createArchiveHeader } from '../engine/archive.js';
import { initBalances, snapshotBalances, getBalance } from '../ledger/state.js';
import { gateStructural, gateCoverage, assertConservation, assertNetZero } from '../ledger/gate.js';
import { TransferWorklist } from '../ledger/commit.js';
import { runD20Check } from '../engine/check.js';
import { RootSchema } from '@ai-life-sim/core';
import { replayTick } from '@ai-life-sim/core/replay';
// 赊账金额/理由：唯一口径取自 fixture/world.ts（server.ts 同样从这里导入），禁止在本文件另写一份。
import { CREDIT_AMOUNT, CREDIT_REASON } from '../fixture/world.js';

// ---- 判定配方（按 testdemo §4.5）----
const RECIPE_KEY = 'chk_persuade_credit';
const ATTR_BONUS = 6;
const DC = 12;

// 初始账本（封闭经济，总额应恒定；总额由 INITIAL_TOTAL 动态算出，不写死字面值）。
// 王掌柜起始故意设小（13 = CREDIT_AMOUNT + 5）而非真实开局的 200：
//   200 文在 --ticks 20 的预算下，无论怎么挑动作，最多被掏走 20×8=160 文，永远到不了 0——
//   不变量③（债主清偿能力闸）测不到。13 文能在 2 次连续赊账成功内挨个走完三个分支：
//   第1次 credit=min(8,13)=8（全额不封顶）→ 第2次 credit=min(8,5)=5（部分封顶）→
//   王掌柜见底后第3次 credit=min(8,0)=0（清偿能力闸：借出必须为0）。
const INITIAL: Record<string, number> = { pc_linjiu: 30, npc_wang: 13, npc_hong: 0 };
const ENTITIES = Object.keys(INITIAL);
const INITIAL_TOTAL = Object.values(INITIAL).reduce((s, v) => s + v, 0);

// ---- 打桩动作池（罐装叙事 + 罐装提案，无 LLM）----
type ActKind = 'chat' | 'tip' | 'check' | 'repay' | 'uncovered';
const ACTIONS: { kind: ActKind; narrative: string; proposalJson?: string }[] = [
	{ kind: 'chat', narrative: '林九跟王掌柜打了招呼，没花一文。' },
	{
		kind: 'tip',
		narrative: '林九给了红姨2文小费。',
		proposalJson: JSON.stringify({
			transfers: [{ from: 'pc_linjiu', to: 'npc_hong', amount: 2, reason: '小费' }],
			checks: [],
			knowledge: [],
		}),
	},
	// check 给两个槛位，提高随机命中率：要在有限 ticks 内连续抽到才能把王掌柜掏到见底
	{ kind: 'check', narrative: '林九想赊一顿饭，试着说服王掌柜。' },
	{ kind: 'check', narrative: '林九又想赊账，软磨硬泡。' },
	{ kind: 'repay', narrative: '林九取出铜钱，归还先前赊欠的账。' },
	// 恶意拍：叙事里明明有 3文，提案却漏记→对账闸必须 fail-closed
	{
		kind: 'uncovered',
		narrative: '林九又付了3文茶钱。',
		proposalJson: JSON.stringify({ transfers: [], checks: [], knowledge: [] }),
	},
];

// ---- harness 自己的 fuzz RNG（mulberry32）----
// 注意：这只用来“随机选动作”，与引擎的 runD20Check/盐值完全无关，
// 不参与游戏判定，不违反确定性铁律。
function mulberry32(seed: number) {
	let a = seed >>> 0;
	return function () {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// 稳定序列化（键序无关）用于深比较
function stable(o: unknown): string {
	if (o && typeof o === 'object' && !Array.isArray(o)) {
		const rec = o as Record<string, unknown>;
		return (
			'{' +
			Object.keys(rec)
				.sort()
				.map((k) => JSON.stringify(k) + ':' + stable(rec[k]))
				.join(',') +
			'}'
		);
	}
	return JSON.stringify(o);
}

type Failure = { run: number; tick: number; seed: number; invariant: string; detail: string };

function totalBalances(balances: Map<string, number>): number {
	return ENTITIES.reduce((s, k) => s + getBalance(balances, k), 0);
}

function makeTickLog(tick: number, salt: number, summary: string): SliceTickLog {
	return {
		tick_id: `tick-soak-${tick}`,
		拍计数: tick,
		结果摘要: summary,
		系数组指纹: '',
		盐值: salt,
		路由快照: { routedVia: 'default', modelKey: null, explicitReason: '关态' },
	};
}

// 债务侧旁路状态（与 server.ts 的 debt/wangReceivable/creditCount 同一口径）
interface DebtState {
	debt: number;
	wangReceivable: number;
	creditCount: number;
}

/** 赊账结算：与 server.ts handleAction('检定') 成功分支逐行同构，禁第二实现/禁重算账本。 */
function settleCredit(
	balances: Map<string, number>,
	d: DebtState,
	tick: number,
	add: (tick: number, invariant: string, detail: string) => void,
): void {
	const wangCashBefore = getBalance(balances, 'npc_wang');
	const pcCashBefore = getBalance(balances, 'pc_linjiu');
	const debtBefore = d.debt;
	const credit = Math.min(CREDIT_AMOUNT, wangCashBefore);

	// 不变量③：债主清偿能力闸（fail-closed）—— 王掌柜现金为0时必须借出0，不得凭空生债
	if (wangCashBefore === 0 && credit !== 0) {
		add(tick, '清偿能力闸', `王掌柜现金为0，竟借出 ${credit}`);
	}

	if (credit > 0) {
		const wl = new TransferWorklist();
		wl.load([{ from: 'npc_wang', to: 'pc_linjiu', amount: credit, reason: CREDIT_REASON }]);
		const records = wl.commit(balances);
		try {
			assertConservation(records);
			assertNetZero(records);
		} catch (e) {
			add(tick, '守恒', `赊账转账报错：${String(e)}`);
		}
		d.debt += credit;
		d.wangReceivable += credit;
		d.creditCount += 1;
	} else if (d.debt !== debtBefore) {
		// 理论上不可达（debt 只在 credit>0 分支变动），留作回归哨兵
		add(tick, '清偿能力闸', '借出 0 却仍产生了债务变化');
	}

	// 不变量②：现金+债务方向一致（三者增减同额、方向敏感）
	const wangCashAfter = getBalance(balances, 'npc_wang');
	const pcCashAfter = getBalance(balances, 'pc_linjiu');
	const wangDelta = wangCashBefore - wangCashAfter;
	const pcDelta = pcCashAfter - pcCashBefore;
	const debtDelta = d.debt - debtBefore;
	if (wangDelta !== credit || pcDelta !== credit || debtDelta !== credit) {
		add(
			tick,
			'现金债务方向',
			`赊账方向不一致：王掌柜−${wangDelta}/林九+${pcDelta}/债务+${debtDelta}（应同为 ${credit}）`,
		);
	}

	// 不变量①：试算平衡（债务对称）
	if (d.wangReceivable !== d.debt) {
		add(tick, '试算平衡', `王掌柜应收(${d.wangReceivable}) ≠ 林九应付(${d.debt})`);
	}
}

/** 还账结算：与 server.ts handleAction('还账') 逐行同构，禁第二实现/禁重算账本。 */
function settleRepay(
	balances: Map<string, number>,
	d: DebtState,
	tick: number,
	add: (tick: number, invariant: string, detail: string) => void,
): void {
	const debtBefore = d.debt;
	const pcCashBefore = getBalance(balances, 'pc_linjiu');
	const wangCashBefore = getBalance(balances, 'npc_wang');

	// 还账闸：无欠账、或无现金可还，静默跳过（与 server.ts 一致：不可还时不动账本）
	if (debtBefore <= 0 || pcCashBefore <= 0) return;

	const repay = Math.min(debtBefore, pcCashBefore);
	const wl = new TransferWorklist();
	wl.load([{ from: 'pc_linjiu', to: 'npc_wang', amount: repay, reason: CREDIT_REASON }]);
	const records = wl.commit(balances);
	try {
		assertConservation(records);
		assertNetZero(records);
	} catch (e) {
		add(tick, '守恒', `还账转账报错：${String(e)}`);
	}
	d.debt -= repay;
	d.wangReceivable -= repay;

	const pcCashAfter = getBalance(balances, 'pc_linjiu');
	const wangCashAfter = getBalance(balances, 'npc_wang');
	const pcDelta = pcCashBefore - pcCashAfter;
	const wangDelta = wangCashAfter - wangCashBefore;
	const debtDelta = debtBefore - d.debt;
	if (pcDelta !== repay || wangDelta !== repay || debtDelta !== repay) {
		add(
			tick,
			'现金债务方向',
			`还账方向不一致：林九−${pcDelta}/王掌柜+${wangDelta}/债务−${debtDelta}（应同为 ${repay}）`,
		);
	}

	if (d.wangReceivable !== d.debt) {
		add(tick, '试算平衡', `王掌柜应收(${d.wangReceivable}) ≠ 林九应付(${d.debt})`);
	}
}

/* ---- 跑一整局 ---- */
function runOne(runIdx: number, seed: number, ticks: number): Failure[] {
	const fails: Failure[] = [];
	const rng = mulberry32(seed);
	const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)]!;
	const add = (tick: number, invariant: string, detail: string) =>
		fails.push({ run: runIdx, tick, seed, invariant, detail });

	let balances = initBalances({ ...INITIAL });
	let header = createArchiveHeader(seed);
	let expectedCounter = header.全局回滚计数器 ?? 0;
	const ring = new SnapshotRingBuffer();
	let tickLog: SliceTickLog[] = [];

	// 债务旁路状态 + 与 ring 同步淘汰的 auxStack（赊账不动现金，悔棋时无法只靠 ring 还原）
	const debtState: DebtState = { debt: 0, wangReceivable: 0, creditCount: 0 };
	const auxStack: DebtState[] = [];

	for (let tick = 1; tick <= ticks; tick++) {
		// 拍前快照：仅关账态可写；快照记下本拍之前的账本与 tick_log
		try {
			assertClosedAccount('空闲');
		} catch (e) {
			add(tick, '关账态门规', `空闲态被误拒：${String(e)}`);
		}
		const preBalances = snapshotBalances(balances);
		const preTickLog = [...tickLog];
		ring.push({
			tick,
			balances: preBalances,
			tick_log: preTickLog,
			observationTable: [],
			pendingQueue: [],
		});
		// auxStack 与 ring 严格同序、同容量淘汰（同 RING_K），保存拍前债务，悔棋按同一索引还原
		auxStack.push({ ...debtState });
		if (auxStack.length > RING_K) auxStack.shift();

		const action = pick(ACTIONS);

		// 不变量：关账态门规——非空闲态写盘必被拒
		let refusedMidTick = false;
		try {
			assertClosedAccount('结算中');
		} catch {
			refusedMidTick = true;
		}
		if (!refusedMidTick) add(tick, '关账态门规', '“结算中”半拍态竟然允许写盘');

		if (action.kind === 'tip' && action.proposalJson) {
			const g = gateStructural(action.proposalJson);
			if (g.ok) {
				const cov = gateCoverage(action.narrative, g.proposal);
				if (cov.covered) {
					const wl = new TransferWorklist();
					wl.load(g.proposal.transfers);
					const records = wl.commit(balances);
					try {
						assertConservation(records);
					} catch (e) {
						add(tick, '守恒', `assertConservation 报错：${String(e)}`);
					}
					tickLog.push(makeTickLog(tick, expectedCounter, '转账'));
				}
			}
		} else if (action.kind === 'uncovered' && action.proposalJson) {
			const g = gateStructural(action.proposalJson);
			if (g.ok) {
				const cov = gateCoverage(action.narrative, g.proposal);
				// fail-closed：叙事有金额、提案为空→必须 covered:false
				if (cov.covered) {
					add(tick, '对账闸 fail-closed', `叙事含金额但提案漏记，闸却放行：${action.narrative}`);
				}
			}
		} else if (action.kind === 'check') {
			const chk = runD20Check(seed, tick, RECIPE_KEY, ATTR_BONUS, DC, header);
			const entry = makeTickLog(tick, chk.salt, `检定:${chk.success ? '成功' : '失败'}`);
			tickLog.push(entry);

			// 不变量：重放恒等——读冻结盐值重跑逐位相同
			const r = replayTick({
				初始快照: RootSchema.parse({}),
				预设指纹: '',
				意图标签: [],
				tick_log条目: entry,
				失败工单: [],
				当前世代号: 'gen-1',
				外部注入序: [],
				落账记录: [],
			});
			if (r.盐值源自tick_log !== true) {
				add(tick, '重放恒等', '盐值未标记为源自 tick_log（可能误读 live 计数器）');
			}
			if (r.盐值 !== chk.salt) {
				add(tick, '重放恒等', `重放盐值 ${r.盐值} ≠ 原拍 ${chk.salt}`);
			}
			const frozenHeader = { seed, 全局回滚计数器: r.盐值! };
			const rep = runD20Check(seed, tick, RECIPE_KEY, ATTR_BONUS, DC, frozenHeader);
			if (rep.rawU !== chk.rawU || rep.diceRoll !== chk.diceRoll || rep.success !== chk.success) {
				add(tick, '重放恒等', '冻结盐值重跑 D20 与原拍不一致');
			}

			// 赊账结算（与 server.ts 同一公式，唯一口径）
			if (chk.success) {
				settleCredit(balances, debtState, tick, add);
			}
		} else if (action.kind === 'repay') {
			settleRepay(balances, debtState, tick, add);
			if (debtState.wangReceivable === debtState.debt) {
				tickLog.push(makeTickLog(tick, expectedCounter, `还账·余欠${debtState.debt}文`));
			}
		}

		// 不变量①（每拍兜底）：试算平衡恒成立，不论本拍动作是什么
		if (debtState.wangReceivable !== debtState.debt) {
			add(tick, '试算平衡', `王掌柜应收(${debtState.wangReceivable}) ≠ 林九应付(${debtState.debt})`);
		}

		// 不变量：守恒（总额恒定，含现金+应收应付不进总额——这里只校现金总额）+ 账面非负
		const total = totalBalances(balances);
		if (total !== INITIAL_TOTAL) add(tick, '守恒', `总铜钱 ${total} ≠ 初始 ${INITIAL_TOTAL}`);
		for (const k of ENTITIES) {
			const v = getBalance(balances, k);
			if (v < 0) add(tick, '账面非负', `${k} 余额为负：${v}`);
		}

		// 偏好随机抖动（N-2 验证用：不影响冻结路由）——不产生副作用，仅抽样
		void (rng() < 0.5);

		// 25% 概率穿插悔棋：回滚到拍前快照，账本精确恢复 + 计数器 +1；债务侧旁路栈同步还原
		if (tick > 1 && rng() < 0.25) {
			const idx = ring.size - 1;
			const aux = auxStack[idx];
			const rw = rewindTick(ring, idx, header);
			if (stable(Object.fromEntries(rw.balances)) !== stable(preBalances)) {
				add(tick, '悔棋恒等', '回滚后账本与拍前快照不一致');
			}
			if ((rw.header.全局回滚计数器 ?? -1) !== expectedCounter + 1) {
				add(tick, '悔棋计数器', `计数器未 +1：${rw.header.全局回滚计数器}`);
			}
			expectedCounter += 1;
			balances = rw.balances;
			header = rw.header;
			tickLog = [...rw.tick_log];

			// 债务不进 ring 快照，必须按同一索引从 auxStack 还原（与 server.ts 悔棋分支同设计）
			debtState.debt = aux ? aux.debt : 0;
			debtState.wangReceivable = aux ? aux.wangReceivable : 0;
			debtState.creditCount = aux ? aux.creditCount : 0;
			if (debtState.wangReceivable !== debtState.debt) {
				add(
					tick,
					'试算平衡',
					`悔棋后王掌柜应收(${debtState.wangReceivable}) ≠ 林九应付(${debtState.debt})`,
				);
			}
		}

		// 不变量：存读往返 + 篡改必拒载（关账态可存）
		if (rng() < 0.5) {
			const snap: SliceSnapshot = {
				tick,
				balances: snapshotBalances(balances),
				tick_log: [...tickLog],
				observationTable: [],
				pendingQueue: [],
			};
			try {
				const raw = serializeArchive(snap);
				const loaded = deserializeArchive(raw);
				if (stable(loaded.balances) !== stable(snap.balances) || loaded.tick !== tick) {
					add(tick, '存读往返', '存档→读档后主体不一致');
				}
				const parsed = JSON.parse(raw) as { checksum: string; body: SliceSnapshot };
				parsed.checksum = 'deadbeef';
				let threw = false;
				try {
					deserializeArchive(JSON.stringify(parsed));
				} catch {
					threw = true;
				}
				if (!threw) add(tick, '篡改未拒载', '改坏校验和后竟然读档成功（应 fail-closed）');
			} catch (e) {
				add(tick, '存档异常', `关账态存读报错：${String(e)}`);
			}
		}
	}
	return fails;
}

/* ---- 确定性场景子测试：纯「借 N → 一次性还清」，不放进随机 fuzz ----
 * 固定种子、固定动作序列（仅 check/repay，中间无其它现金动作）：
 *   连续发起赊账检定直到累计 2 次成功（13文起始本金下，恰好走完“全额→部分封顶”两档），
 *   随后立刻一次性还清。断言：debt 归零、三人现金逐位回到借前数值（cash-loan 模型必须精确复原，
 *   否则就是「白送」泄漏）。
 */
const SCENARIO_SEED = 999;
const SCENARIO_MAX_TICKS = 200; // 安全上限，防止异常 RNG 序列导致死循环
const SCENARIO_TARGET_CREDITS = 2;

function runBorrowRepayScenario(): Failure[] {
	const fails: Failure[] = [];
	const seed = SCENARIO_SEED;
	const add = (tick: number, invariant: string, detail: string) =>
		fails.push({ run: -1, tick, seed, invariant, detail: `[借还闭环] ${detail}` });

	const balances = initBalances({ ...INITIAL });
	const beforeBalances = snapshotBalances(balances); // 借前现金快照，周期末用于逐位比对
	const header = createArchiveHeader(seed);
	const debtState: DebtState = { debt: 0, wangReceivable: 0, creditCount: 0 };

	let tick = 1;
	for (; tick <= SCENARIO_MAX_TICKS && debtState.creditCount < SCENARIO_TARGET_CREDITS; tick++) {
		const chk = runD20Check(seed, tick, RECIPE_KEY, ATTR_BONUS, DC, header);
		if (chk.success) {
			settleCredit(balances, debtState, tick, add);
		}
		// 失败拍不动现金、不计入“其它现金动作”，纯粹是序列里的空轮
	}

	if (debtState.creditCount < SCENARIO_TARGET_CREDITS) {
		add(tick, '场景搭建失败', `${SCENARIO_MAX_TICKS} 拍内未凑够 ${SCENARIO_TARGET_CREDITS} 次成功赊账`);
		return fails;
	}

	// 一次性还清（此刻应有 debt = 8 + 5 = 13，恰好耗尽王掌柜全部本金）
	settleRepay(balances, debtState, tick, add);
	tick += 1;

	if (debtState.debt !== 0) {
		add(tick, '借还闭环', `还清后 debt 应为 0，实际 ${debtState.debt}`);
	}
	if (debtState.wangReceivable !== 0) {
		add(tick, '借还闭环', `还清后 wangReceivable 应为 0，实际 ${debtState.wangReceivable}`);
	}
	const afterBalances = snapshotBalances(balances);
	for (const k of ENTITIES) {
		const before = beforeBalances[k] ?? 0;
		const after = afterBalances[k] ?? 0;
		if (before !== after) {
			add(tick, '现金复原', `${k} 借前 ${before} 文 ≠ 还清后 ${after} 文（cash-loan 模型必须精确复原）`);
		}
	}

	return fails;
}

/* ---- CLI ---- */
function parseArgs(argv: string[]) {
	const get = (name: string, def: number) => {
		const i = argv.indexOf(`--${name}`);
		return i >= 0 && argv[i + 1] ? Number(argv[i + 1]) : def;
	};
	return { runs: get('runs', 200), ticks: get('ticks', 8), seed: get('seed', -1) };
}

function main() {
	const { runs, ticks, seed: fixedSeed } = parseArgs(process.argv.slice(2));
	const all: Failure[] = [];
	let firstBadSeed: number | null = null;

	// 确定性借还闭环场景：独立于随机 fuzz 跑，先跑、先报
	const scenarioFails = runBorrowRepayScenario();
	if (scenarioFails.length) {
		all.push(...scenarioFails);
		firstBadSeed = SCENARIO_SEED;
	}

	for (let r = 0; r < runs; r++) {
		const seed = fixedSeed >= 0 ? fixedSeed : (r * 2654435761) >>> 0;
		const fails = runOne(r, seed, ticks);
		if (fails.length) {
			all.push(...fails);
			if (firstBadSeed === null) firstBadSeed = seed;
		}
	}

	if (all.length === 0) {
		console.log(`✅ soak 全绿：借还闭环场景 1 个 + ${runs} 局 × ${ticks} 拍随机 fuzz，无不变量被破。`);
		return;
	}

	mkdirSync('.soak-failures', { recursive: true });
	const file = `.soak-failures/seed-${firstBadSeed}.json`;
	writeFileSync(file, JSON.stringify(all, null, 2));

	console.error(`❌ 抓到 ${all.length} 处不变量破坏（${runs} 局 + 借还闭环场景）。`);
	console.error(`   首个失败种子：${firstBadSeed}`);
	console.error(
		`   复现：pnpm --filter @ai-life-sim/slice soak -- --seed ${firstBadSeed} --runs 1`,
	);
	console.error(`   现场已转储：hosts/slice/${file}`);
	process.exit(1);
}

main();
