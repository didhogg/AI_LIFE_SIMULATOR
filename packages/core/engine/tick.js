// runTick — core settlement engine (纯函数·Ring 0·无 IO·无 LLM 调用)
import { assertConservation } from './conservation.js';
import { getNetAsset } from './netAsset.js';

const TICK_LOG_MAX = 8;
const RIPPLE_DECAY = 0.5;
const RIPPLE_MIN = 1;

export const SETTLEMENT_PHASES = [
    '日程结算', '事件种子萌发',
    '阈值触发', '日期触发', '标志触发', '关系触发',
    '衰减批', '涟漪传播', '原子提交',
];

export function runTick(state, input) {
    const s = structuredClone(state);
    if (s._系统.已结算标记[input.tickId]?.即时分量 === 1) {
        return { state: s, settledPhases: [], matureSeeds: [] };
    }
    const spanMin = input.spanMinutes ?? (s.世界?._本拍跨度 ?? 43200);
    const nowEpochMin = s.世界?.纪元分钟 ?? 0;
    const 账户 = s.货币系统?.账户;
    const preNetAsset = 账户 && Object.keys(账户).length > 0
        ? Object.values(账户).reduce((sum, acct) => sum + getNetAsset(acct), 0)
        : null;
    const settledPhases = [];
    const matureSeeds = [];
    if (!s._系统.已结算标记[input.tickId]) {
        s._系统.已结算标记[input.tickId] = { 即时分量: 0, 延时分量: {} };
    }
    const phaseMap = s._系统.已结算标记[input.tickId].延时分量;
    function runPhase(phase, fn) {
        if (phaseMap[phase] === 1) return;
        fn();
        phaseMap[phase] = 1;
        settledPhases.push(phase);
    }
    // Phase 1 · 日程结算（stub）
    runPhase('日程结算', () => { });
    // Phase 2 · 事件种子萌发 — D4 纪元分钟成熟锚
    runPhase('事件种子萌发', () => {
        const seeds = s.$隐藏记忆库?.延时种子 ?? {};
        for (const [key, seed] of Object.entries(seeds)) {
            if (seed.已结算标记 === 1) continue;
            const matured = seed.成熟日 === 0 || seed.成熟日 <= nowEpochMin;
            if (matured) {
                seed.已结算标记 = 1;
                matureSeeds.push(key);
            }
        }
    });
    // Phase 3–6 · 四类触发（stub）
    runPhase('阈值触发', () => { });
    runPhase('日期触发', () => { });
    runPhase('标志触发', () => { });
    runPhase('关系触发', () => { });
    // Phase 7 · 衰减批
    runPhase('衰减批', () => {
        for (const observerRec of Object.values(s.认知档案)) {
            for (const targetRec of Object.values(observerRec)) {
                for (const imp of targetRec.印象) {
                    if (imp.衰减速率 > 0) {
                        imp.强度 = Math.max(0, imp.强度 - imp.衰减速率 * spanMin);
                    }
                }
                targetRec.印象 = targetRec.印象.filter(imp => imp.强度 > 0);
            }
        }
        for (const npc of Object.values(s.NPC)) {
            for (const img of npc.意象) {
                if (img.衰减速率 > 0) {
                    img.强度 = Math.max(0, img.强度 - img.衰减速率 * spanMin);
                }
            }
            npc.意象 = npc.意象.filter(img => img.强度 > 0);
        }
    });
    // Phase 8 · 涟漪传播
    runPhase('涟漪传播', () => { propagateRipple(s, nowEpochMin); });
    // Phase 9 · 原子提交
    runPhase('原子提交', () => {
        if (账户 && preNetAsset !== null) {
            assertConservation(账户, preNetAsset, getNetAsset);
        }
        if (s.世界) {
            s.世界.纪元分钟 = nowEpochMin + spanMin;
            s.世界.周期数 = (s.世界.周期数 ?? 0) + 1;
        }
        if (s._tick) {
            s._tick.拍计数 = (s._tick.拍计数 ?? 0) + 1;
        }
        const logEntry = {
            tick_id: input.tickId,
            拍计数: s._tick?.拍计数 ?? 0,
            结果摘要: `phases:${settledPhases.length} seeds:${matureSeeds.length}`,
            系数组指纹: s._tick?.难度系数组指纹 ?? '',
        };
        s._系统.tick_log.push(logEntry);
        if (s._系统.tick_log.length > TICK_LOG_MAX) {
            s._系统.tick_log = s._系统.tick_log.slice(-TICK_LOG_MAX);
        }
        s._系统.已结算标记[input.tickId].即时分量 = 1;
    });
    return { state: s, settledPhases, matureSeeds };
}

function propagateRipple(s, nowEpochMin) {
    const pending = s.$涟漪候选;
    if (!pending || Object.keys(pending).length === 0) return;
    const npcs = s.NPC;
    for (const [targetKey, impressions] of Object.entries(pending)) {
        for (const imp of impressions) {
            const covert = imp.可见性 === '隐秘';
            const targetLoc = npcs[targetKey]?.位置 ?? '';
            const presentKeys = targetLoc
                ? Object.entries(npcs)
                    .filter(([k, npc]) => k !== targetKey && npc.位置 === targetLoc)
                    .map(([k]) => k)
                : [];
            for (const obs1 of presentKeys) {
                writeImpressionMax(s.认知档案, obs1, targetKey, {
                    标签: imp.标签, 极性: imp.极性, 强度: imp.强度,
                    来源: `tick:${imp.来源拍号}`, 获知时间: nowEpochMin,
                    衰减速率: 0, 来源类型: '一手观测',
                });
                if (covert) continue;
                const obs1Npc = npcs[obs1];
                if (!obs1Npc) continue;
                for (const rel of obs1Npc.关系) {
                    const obs2 = rel.对象键;
                    if (!obs2 || obs2 === targetKey || presentKeys.includes(obs2)) continue;
                    const strength2 = imp.强度 * RIPPLE_DECAY * (rel.信任 / 100);
                    if (strength2 < RIPPLE_MIN) continue;
                    writeImpressionMax(s.认知档案, obs2, targetKey, {
                        标签: imp.标签, 极性: imp.极性, 强度: strength2,
                        来源: `听闻自:${obs1}`, 获知时间: nowEpochMin,
                        衰减速率: 0, 来源类型: '二手转述',
                    });
                }
            }
        }
    }
    s.$涟漪候选 = {};
}

function writeImpressionMax(认知, observerKey, targetKey, entry) {
    if (!认知[observerKey]) 认知[observerKey] = {};
    if (!认知[observerKey][targetKey]) {
        认知[observerKey][targetKey] = { 了解度: 0, 误差表: {}, 印象: [], 时效: 0, 姓名知识: '已知姓名' };
    }
    const 印象 = 认知[observerKey][targetKey].印象;
    const existing = 印象.find(i => i.标签 === entry.标签 && i.极性 === entry.极性);
    if (existing) {
        if (entry.强度 > existing.强度) {
            existing.强度 = entry.强度;
            existing.来源 = entry.来源;
            existing.获知时间 = entry.获知时间;
        }
    } else {
        印象.push(entry);
    }
}
