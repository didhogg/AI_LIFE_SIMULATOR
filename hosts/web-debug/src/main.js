// G1b3c · AOHP 调试控制台 · 浏览器入口 C1
// 铁律: 全部 UI 层 · 不进指纹 · core 函数体零 diff
// 只经 aohpDebugConsole / aohpDebugConsole2 合法 API 驱动
// 禁旁路校验闸 · 禁私写 core state · 确定性六禁全套
import { inspectMenu, runValidationChain, runTickWithDiff, runActionInDualMode, TimeController, DEMO_RAW_CANDIDATES, PHASE6_THRESHOLD, resolveSpanMinutes, formatSpanDisplay, SPAN_PRESET_LABELS, UNIT_LABELS, } from "../aohpDebugConsole.js";
import { PERSON_DEFAULT, STYLE_DEFAULT, STYLE_LABELS, PERSON_LABELS, sanitizePerson, sanitizeStyle, buildScriptedNarrative, } from "../narrativeStyle.js";
import { buildRelationGraph, buildStateTree, buildMapThumbnail, buildIncrementalView, povInspect, comparePOVs, ActionRecorder, SnapshotStore, groupNodesByLocation, buildEdgeDelta, buildActorPanel, buildWorldPanel, deriveWorldClock, computePovPersonalityProjection, } from "../aohpDebugConsole2.js";
import { getDebugFixture, DEBUG_FIXTURES } from "../fixtures/debugFixtures.js";
import { buildWorld, PC, NPC_WANG, SAVE_SEED, } from "../../slice/fixture/world.js";
// ── 应用全局状态 ──────────────────────────────────────────────────────────────
/** 最大保存的 diff 条数（防内存膨胀） */
const MAX_DIFFS = 50;
const S = {
    fixtureId: "base",
    state: buildWorld(),
    pcKey: PC,
    seed: SAVE_SEED,
    rawCandidates: DEMO_RAW_CANDIDATES,
    timeCtrl: null,
    recorder: null,
    snapshotStore: new SnapshotStore(),
    diffs: [],
    prevGraph: null,
    llmMode: "demo",
    forceFailure: false,
    activeTab: "menu",
    povA: PC,
    povB: NPC_WANG,
    validInput: "",
    lastChain: null,
    lastMenu: null,
    lastNarrative: null,
    narrativeLoading: false,
    snapshotLabel: "snap0",
    snapSelA: "",
    snapSelB: "",
    recActions: [],
    operatorKey: PC,
    freeText: "",
    lastFreeTextResult: null,
    freeTextLoading: false,
    narrativePerson: PERSON_DEFAULT,
    narrativeStyle: STYLE_DEFAULT,
    tickSpanPreset: "1day",
    tickSpanCustomQty: 1,
    tickSpanCustomUnit: "day",
    autoPlaySpeed: null,
    autoPlayTimer: null,
    povEntityKey: PC,
    showRipple: false,
    selectedDiffTick: null,
};
function initTime() {
    S.timeCtrl = new TimeController(S.seed, S.state);
    S.recorder = new ActionRecorder(S.seed, S.state);
}
// ── 时间调控：跨度 / 流速辅助 ────────────────────────────────────────────────────
function currentSpanMinutes() {
    return resolveSpanMinutes(S.state.世界?.纪元分钟 ?? 0, S.tickSpanPreset, S.tickSpanCustomQty, S.tickSpanCustomUnit);
}
const AUTO_PLAY_SPEEDS = [0.5, 1, 2, 4];
function startAutoPlay(speed) {
    stopAutoPlay();
    S.autoPlaySpeed = speed;
    const intervalMs = Math.round(1000 / speed);
    S.autoPlayTimer = setInterval(() => {
        if (!S.timeCtrl)
            return;
        const span = currentSpanMinutes();
        S.prevGraph = buildRelationGraph(S.state);
        const diffs = S.timeCtrl.step(1, span);
        S.state = S.timeCtrl.getCurrentState();
        S.diffs = [...S.diffs.slice(-(MAX_DIFFS - diffs.length)), ...diffs];
        renderApp();
    }, intervalMs);
}
function stopAutoPlay() {
    if (S.autoPlayTimer !== null) {
        clearInterval(S.autoPlayTimer);
        S.autoPlayTimer = null;
    }
    S.autoPlaySpeed = null;
}
// ── Fixture 切换 ──────────────────────────────────────────────────────────────
function switchFixture(id) {
    // fixtureId を先に確定させ buildCandidatesForOperator が正しく参照できるようにする
    S.fixtureId = id;
    if (id === "base") {
        S.state = buildWorld();
        S.pcKey = PC;
        S.seed = SAVE_SEED;
        S.povA = PC;
        S.povB = NPC_WANG;
    }
    else {
        const f = getDebugFixture(id);
        S.state = f.buildState();
        S.seed = f.seed;
        const npcKeys = Object.keys(S.state.NPC);
        S.pcKey = npcKeys[0] ?? "unknown";
        S.povA = npcKeys[0] ?? "";
        S.povB = npcKeys[1] ?? "";
    }
    S.snapshotStore = new SnapshotStore();
    S.diffs = [];
    S.prevGraph = null;
    S.showRipple = false;
    S.selectedDiffTick = null;
    S.lastChain = null;
    S.lastMenu = null;
    S.lastNarrative = null;
    S.recActions = [];
    S.snapSelA = "";
    S.snapSelB = "";
    S.operatorKey = S.pcKey;
    S.povEntityKey = S.pcKey;
    // operatorKey 確定後に候補を再構築（NPC 自身を候補から除外・在場者のみ対象）
    S.rawCandidates = buildCandidatesForOperator(S.pcKey);
    S.freeText = "";
    S.lastFreeTextResult = null;
    S.narrativePerson = PERSON_DEFAULT;
    S.narrativeStyle = STYLE_DEFAULT;
    stopAutoPlay();
    initTime();
}
// 初始化时间控制器
initTime();
// ── HTML 工具 ─────────────────────────────────────────────────────────────────
function esc(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
// ── UI 美化辅助：进度条 / 有符号条 / 标签 chip / 选定拍 diff ────────────────────
function bar(val, max, color = "#3fb950", width = 90) {
    const pct = max > 0 ? Math.max(0, Math.min(100, (val / max) * 100)) : 0;
    return `<span style="display:inline-block;width:${width}px;height:9px;background:#21262d;border-radius:4px;overflow:hidden;vertical-align:middle;margin:0 4px"><span style="display:block;height:100%;width:${pct.toFixed(1)}%;background:${color}"></span></span>`;
}
function signedBar(val, max = 100, width = 90) {
    const half = width / 2;
    const mag = Math.max(0, Math.min(half, (Math.abs(val) / max) * half));
    const pos = val >= 0;
    const color = pos ? "#3fb950" : "#f85149";
    const left = pos ? half : half - mag;
    return `<span style="position:relative;display:inline-block;width:${width}px;height:9px;background:#21262d;border-radius:4px;overflow:hidden;vertical-align:middle;margin:0 4px"><span style="position:absolute;left:${half}px;top:0;bottom:0;width:1px;background:#6e7681"></span><span style="position:absolute;top:0;height:100%;left:${left.toFixed(1)}px;width:${mag.toFixed(1)}px;background:${color}"></span></span>`;
}
function chip(txt, bg) {
    return `<span style="display:inline-block;padding:1px 7px;border-radius:9px;font-size:11px;background:${bg};color:#fff;margin-right:4px">${txt}</span>`;
}
/** 涟漪 / diff 当前查看拍：优先选定拍，回退到最新拍 */
function currentDiffForRipple() {
    if (S.diffs.length === 0)
        return null;
    if (S.selectedDiffTick) {
        const found = S.diffs.find((d) => d.tickId === S.selectedDiffTick);
        if (found)
            return found;
    }
    return S.diffs[S.diffs.length - 1] ?? null;
}
// ── 渲染：头部 + Tab 栏 ───────────────────────────────────────────────────────
function renderHeader() {
    const npcCount = Object.keys(S.state.NPC).length;
    const locCount = Object.keys(S.state.地图?.地点 ?? {}).length;
    const tickCount = S.state._tick?.拍计数 ?? 0;
    const clock = deriveWorldClock(S.state);
    return `
<header class="app-header" style="position:relative">
  <div class="world-clock" style="position:absolute;top:8px;right:12px;text-align:right;font-size:12px;line-height:1.45;color:#d29922;font-variant-numeric:tabular-nums">
    <div style="font-size:15px;font-weight:600">🕛 ${esc(clock.显示)}</div>
    <div style="color:#8b949e">纪元分钟 ${clock.纪元分钟} · ${esc(clock.纪年法)}${clock.年代背景 ? " · " + esc(clock.年代背景) : ""}${clock.气候带 ? " · " + esc(clock.气候带) : ""}</div>
  </div>
  <h1>AOHP 调试控制台 · G1b3c</h1>
  <div class="fixture-bar">
    <label>场景:
      <select id="fixture-sel">
        ${["base", "小城", "大陆", "整世界"]
        .map((id) => `<option value="${esc(id)}"${id === S.fixtureId ? " selected" : ""}>${esc(fixtureLabel(id))}</option>`)
        .join("")}
      </select>
    </label>
    <span class="fixture-info">
      NPC:${npcCount} · 地点:${locCount} · 种子:${S.seed} · tick:${tickCount} · 观察者:${esc(S.pcKey)}${S.operatorKey !== S.pcKey ? ` · <span style="color:#d29922">操纵者:${esc(S.operatorKey)}</span>` : ""}
    </span>
  </div>
</header>`;
}
function fixtureLabel(id) {
    const map = {
        base: "基础世界 (seed=42, buildWorld)",
        小城: "小城·玉华镇 (seed=100, 3 NPC)",
        大陆: "大陆·金陵商路 (seed=200, 6 NPC)",
        整世界: "整世界·五域图 (seed=300, 12 NPC)",
    };
    return map[id];
}
/**
 * operator が変わるたびに呼ぶ候補再構築ヘルパー。
 * - base fixture + operatorKey = pcKey → DEMO_RAW_CANDIDATES（元の PC 用候補をそのまま）
 * - それ以外 → operator の在場地点にいる他 NPC との 対話 候補を動的生成
 *   （自分自身は候補に入らない · 在場でない NPC は除外）
 */
function buildCandidatesForOperator(operatorKey) {
    if (S.fixtureId === "base" && operatorKey === S.pcKey) {
        return DEMO_RAW_CANDIDATES;
    }
    const opLoc = S.state.NPC[operatorKey]?.位置 ?? "";
    return Object.entries(S.state.NPC)
        .filter(([k, npc]) => k !== operatorKey && npc.位置 === opLoc)
        .map(([k, npc]) => ({
        verb: "对话",
        targetEntityId: k,
        displayText: `与${npc.姓名 ?? k}对话`,
    }));
}
function renderTabBar() {
    const tabs = [
        ["menu", "菜单·校验"],
        ["time", "时间控制"],
        ["graph", "关系网"],
        ["pov", "POV视角"],
        ["snapshot", "快照·回放"],
        ["tree", "状态树·地图"],
        ["世界", "🌍 世界"],
    ];
    return `<div class="tab-bar">${tabs
        .map(([id, label]) => `<button class="tab-btn${id === S.activeTab ? " active" : ""}" data-tab="${id}">${esc(label)}</button>`)
        .join("")}</div>`;
}
// ── Tab: 菜单·校验 ───────────────────────────────────────────────────────────
function renderMenuTab() {
    const menuHtml = renderMenuSection();
    const chainHtml = renderChainSection();
    const freeTextHtml = renderFreeTextSection();
    const hasDiff = S.diffs.length > 0;
    const hasNarrative = S.lastNarrative !== null || S.narrativeLoading;
    const bottomHtml = hasDiff || hasNarrative
        ? `<div class="section"><h2>当拍结果：State Diff · 叙事·出字</h2><div class="diff-narrative-grid">${hasDiff ? renderLatestDiffPanel() : '<div class="diff-col"><span class="dim">（尚无拍记录）</span></div>'}${renderNarrativePanel()}</div></div>`
        : "";
    return `<div class="tab-content">${menuHtml}${chainHtml}${freeTextHtml}${bottomHtml}</div>`;
}
function renderMenuSection() {
    let inner = `
<div class="section">
  <h2>菜单生成检视</h2>
  ${renderOperatorBanner()}
  <div class="btn-group">
    <button class="btn btn-primary" id="btn-inspect-menu">检视当前菜单</button>
  </div>`;
    if (S.lastMenu) {
        const r = S.lastMenu;
        inner += `<div class="result-box">`;
        inner += `<span class="ok">原始候选 ${r.rawCandidates.length} 项</span> → option_id <span class="ok">${r.menuWithIds.length}</span> 项\n`;
        inner += `\n<span class="dim">── 过滤前列表 ──</span>\n`;
        for (const o of r.menuWithIds) {
            inner += `  [${esc(o.option_id)}]  ${esc(o.displayText ?? "")}\n`;
        }
        inner += `\n<span class="dim">── 过滤结果 permitted=${r.filterResult.permitted.length} / denied=${r.filterResult.denied.length} ──</span>\n`;
        for (const p of r.filterResult.permitted) {
            inner += `  <span class="ok">✅ permitted: ${esc(p.displayText ?? p.verb)}</span>\n`;
        }
        for (const d of r.filterResult.denied) {
            const dr = r.deniedReasons.find((x) => x.secretRef === d.secretRef);
            inner += `  <span class="err">❌ denied:    ${esc(d.displayText ?? d.verb)}  [${esc(dr?.reasonCode ?? "KNOWLEDGE_DENIED")}  secretRef=${esc(d.secretRef ?? "?")}]</span>\n`;
        }
        if (r.filterResult.rollHint) {
            inner += `\n  <span class="warn">rollHint: ${esc(r.filterResult.rollHint.ui提示)}</span>`;
        }
        inner += `</div>`;
        // 可点击的 permitted 按钮
        if (r.filterResult.permitted.length > 0) {
            inner += `<div class="section"><h3>点击 permitted 选项驱动 runTick:</h3><div class="btn-group">`;
            for (const p of r.filterResult.permitted) {
                const ids = r.menuWithIds.filter((o) => o.verb === p.verb && o.targetEntityId === p.targetEntityId);
                for (const opt of ids) {
                    inner += `<button class="btn btn-action" data-run-option="${esc(opt.option_id)}">${esc(opt.option_id)}</button>`;
                }
            }
            inner += `</div></div>`;
        }
    }
    inner += `</div>`;
    return inner;
}
function renderChainSection() {
    const quickTests = S.fixtureId === "base"
        ? [
            ["对话:npc_wang", "合法(GATE_SKIPPED)"],
            ["malformed", "格式错误(BAD_FORMAT)"],
            ["飞行:npc_wang", "非法(NOT_IN_MENU)"],
            ["询问:npc_wang", "越权(KNOWLEDGE_DENIED)"],
        ]
        : [];
    let inner = `
<div class="section">
  <h2>option_id 校验链</h2>
  <div class="input-row">
    <input type="text" id="opt-input" class="text-input" placeholder="输入 option_id (如 对话:npc_wang)" value="${esc(S.validInput)}"/>
    <button class="btn btn-primary" id="btn-validate">校验</button>
  </div>`;
    if (quickTests.length > 0) {
        inner += `<div class="helper-text">快速测试（仅基础 fixture）:</div><div class="btn-group">`;
        for (const [optId, label] of quickTests) {
            inner += `<button class="btn btn-sm" data-quick="${esc(optId)}">${esc(label)}</button>`;
        }
        inner += `</div>`;
    }
    if (S.lastChain) {
        const r = S.lastChain;
        inner += `<div class="chain-result ${r.passed ? "chain-pass" : "chain-fail"}">`;
        for (const s of r.steps) {
            const icon = s.pass ? "✅" : "❌";
            const code = s.reasonCode
                ? ` <span class="warn">[${esc(s.reasonCode)}]</span>`
                : "";
            const det = s.detail
                ? ` <span class="dim">· ${esc(s.detail)}</span>`
                : "";
            inner += `<div class="chain-step">${icon} <strong>${esc(s.stepName)}</strong>${code}${det}</div>`;
        }
        inner += r.passed
            ? `<div class="chain-verdict ok">→ ✅ 全链通过</div>`
            : `<div class="chain-verdict err">→ ❌ 拒绝于「${esc(r.rejectStep ?? "")}」 原因码: ${esc(r.rejectCode ?? "")}</div>`;
        inner += `</div>`;
    }
    inner += `</div>`;
    return inner;
}
function renderLatestDiffPanel() {
    const d = S.diffs[S.diffs.length - 1];
    return `<div class="diff-col"><div class="panel-label">State Diff（第 ${S.diffs.length} 拍·最新）</div><div class="result-box">${diffToHtml(d)}</div></div>`;
}
function renderNarrativePanel() {
    const modeLabel = S.llmMode === "llm" ? "llmDemo 真 LLM" : "demo scriptedNarrative";
    const modeClass = S.llmMode === "llm" ? "mode-tag-llm" : "mode-tag-demo";
    let inner = `<div class="panel-label">叙事·出字</div>`;
    inner += `<div class="narrative-meta"><span class="mode-tag ${modeClass}">${esc(modeLabel)}</span>`;
    if (S.forceFailure)
        inner += `<span class="mode-tag mode-tag-warn">强制失败注入:开</span>`;
    inner += `<span class="mode-tag mode-tag-render">${esc(PERSON_LABELS[S.narrativePerson])} · ${esc(STYLE_LABELS[S.narrativeStyle])}</span>`;
    inner += `</div>`;
    if (S.narrativeLoading) {
        inner += `<div class="narrative-loading">⏳ 生成叙事中…</div>`;
    }
    else if (S.lastNarrative) {
        const r = S.lastNarrative;
        const fallbackBadge = r.isFallback
            ? `<span class="fallback-badge fallback-on">⚠ isFallback=true · LLM 降级·走默认 option</span>`
            : `<span class="fallback-badge fallback-off">isFallback=false</span>`;
        const usedDefaultBadge = r.usedDefault
            ? `<span class="fallback-badge fallback-on">usedDefault=true</span>`
            : "";
        inner += `<div class="narrative-badges">${fallbackBadge}${usedDefaultBadge}</div>`;
        inner += `<div class="narrative-option-id dim">option: ${esc(r.optionId)}</div>`;
        inner += `<div class="prose-box">${esc(r.narrative)}</div>`;
    }
    else if (S.lastChain && !S.lastChain.passed) {
        inner += `<div class="narrative-rejected"><span class="err">✗ 校验失败 → 无叙事</span><br/><span class="dim">拒绝于「${esc(S.lastChain.rejectStep ?? "")}」 原因码: ${esc(S.lastChain.rejectCode ?? "")}</span></div>`;
    }
    else {
        inner += `<div class="dim narrative-empty">（点击 permitted 选项后出字）</div>`;
    }
    return `<div class="narrative-col">${inner}</div>`;
}
function diffToHtml(d) {
    let s = `<span class="dim">tickId:</span> ${esc(d.tickId)}\n`;
    s += `<span class="dim">phases:</span> ${esc(d.settledPhases.join(" → "))}\n`;
    s += `\n<span class="dim">认知变更 (${d.cognitiveChanges.length}):</span>\n`;
    if (d.cognitiveChanges.length === 0) {
        s += `  <span class="dim">（无变更）</span>\n`;
    }
    else {
        for (const c of d.cognitiveChanges) {
            const bef = c.before !== undefined
                ? `${c.before}→`
                : '<span class="ok">新增</span>→';
            s += `  ${esc(c.observer)}→${esc(c.target)} <span class="warn">[${esc(c.tag)}/${esc(c.polarity)}]</span> 强度: ${bef}${c.after}${c.isNew ? ' <span class="ok">★新</span>' : ""}\n`;
        }
    }
    s += `\n<span class="dim">关系 Phase6 候选 (score≥${PHASE6_THRESHOLD}, ${d.relationHits.length} 条):</span>\n`;
    if (d.relationHits.length === 0) {
        s += `  <span class="dim">（无边达 Phase6 阈值）</span>\n`;
    }
    else {
        for (const r of d.relationHits) {
            s += `  <span class="ok">★</span> ${esc(r.from)} ─[${esc(r.type)} ${r.strength}×${r.trust}/100=score<span class="ok">${r.score.toFixed(1)}</span>]→ ${esc(r.to)}\n`;
        }
    }
    s += `\n<span class="dim">资源变更 (${d.resourceChanges.length}):</span>\n`;
    if (d.resourceChanges.length === 0) {
        s += `  <span class="dim">（无变更）</span>`;
    }
    else {
        for (const r of d.resourceChanges) {
            const sign = r.delta > 0 ? "+" : "";
            s += `  ${esc(r.entity)} ${esc(r.currency)}: ${r.before}→${r.after} <span class="${r.delta > 0 ? "ok" : "err"}">(${sign}${r.delta})</span>\n`;
        }
    }
    return s;
}
// ── Tab: 时间控制 ─────────────────────────────────────────────────────────────
function renderTimeTab() {
    const tc = S.timeCtrl;
    const tickCount = tc?.getTickCount() ?? S.state._tick?.拍计数 ?? 0;
    const worldTime = tc ? tc.worldTimeAt(tickCount) : "—";
    const timeline = buildIncrementalView(S.diffs);
    let html = `<div class="tab-content">`;
    // 旋钮①：每拍跨度
    const spanMin = currentSpanMinutes();
    const spanDisplay = formatSpanDisplay(spanMin);
    const customUnitOpts = Object.keys(UNIT_LABELS)
        .map((u) => `<option value="${esc(u)}"${u === S.tickSpanCustomUnit ? " selected" : ""}>${esc(UNIT_LABELS[u])}</option>`)
        .join("");
    html += `
<div class="section">
  <h2>旋钮① 每拍跨度 <span class="debug-badge">不进指纹·走 computeTickSpan</span></h2>
  <div class="span-knob">
    <div class="btn-group">
      ${Object.entries(SPAN_PRESET_LABELS)
        .map(([p, label]) => `<button class="btn${S.tickSpanPreset === p ? " btn-action" : ""}" id="span-preset-${esc(p)}">${esc(label)}</button>`)
        .join("")}
    </div>
    ${S.tickSpanPreset === "custom"
        ? `
    <div class="span-custom-row">
      <input type="number" id="span-custom-qty" value="${S.tickSpanCustomQty}" min="0.01" step="0.5" style="width:75px"/>
      <select id="span-custom-unit">${customUnitOpts}</select>
    </div>`
        : ""}
    <div class="span-result-display">= <strong>${esc(spanDisplay)}</strong>（${spanMin} 纪元分钟/拍）</div>
  </div>
</div>`;
    // 旋钮②：流速（AUTO 播放）
    html += `
<div class="section">
  <h2>旋钮② 流速（AUTO 播放） <span class="debug-badge">纯前端·不进指纹</span></h2>
  <div class="speed-knob">
    <div class="btn-group">
      <button class="btn${S.autoPlaySpeed === null ? " btn-action" : ""}" id="btn-speed-stop">■ 停止</button>
      ${AUTO_PLAY_SPEEDS.map((s) => `<button class="btn${S.autoPlaySpeed === s ? " btn-action" : ""}" id="btn-speed-${String(s).replace(".", "_")}">×${s}</button>`).join("")}
    </div>
    <div class="speed-status dim">
      ${S.autoPlaySpeed !== null
        ? `▶ ×${S.autoPlaySpeed} · 每 ${Math.round(1000 / S.autoPlaySpeed)}ms 自动推进一拍 · $流速.速度档=${S.autoPlaySpeed}`
        : "（已停止·点 ×N 开始 AUTO 播放）"}
    </div>
  </div>
</div>`;
    // 时间控制面板
    html += `
<div class="section">
  <h2>时间推进控制</h2>
  <div class="time-controls">
    <span class="tick-display">拍 ${tickCount}</span>
    <span class="dim">${esc(worldTime)}</span>
    <button class="btn btn-action" id="btn-step1">下一拍 +1</button>
    <button class="btn" id="btn-step5">跳 +5 拍</button>
    <label>跳 N 拍:
      <input type="number" id="step-n" value="3" min="1" max="50" style="width:55px"/>
      <button class="btn" id="btn-stepn">→</button>
    </label>
    <label>跳至拍号:
      <input type="number" id="jump-tick" value="${tickCount}" min="0" style="width:60px"/>
      <button class="btn" id="btn-jump">跳</button>
    </label>
    <button class="btn btn-warn" id="btn-replay">重置重放</button>
  </div>
</div>`;
    // LLM 模式 + 失败注入
    html += `
<div class="section">
  <h2>LLM 模式 + 失败注入</h2>
  <div class="btn-group">
    <button class="btn${S.llmMode === "demo" ? " btn-action" : ""}" id="btn-llm-demo">demo（脚本叙事）</button>
    <button class="btn${S.llmMode === "llm" ? " btn-action" : ""}" id="btn-llm-real">llm（真实 LLM）</button>
    <button class="btn${S.forceFailure ? " btn-warn" : ""}" id="btn-force-fail">
      强制 LLM 失败: ${S.forceFailure ? "开" : "关"}
    </button>
  </div>
  <div class="dim" style="font-size:11px;margin-top:6px;">
    ${S.llmMode === "llm"
        ? "⚠ LLM 模式需在 .env 配置 VITE_DEEPSEEK_API_KEY（配置后重启 npm run dev）"
        : "✓ demo 模式：脚本占位叙事，不调用 LLM，完全确定性"}
  </div>
</div>`;
    // 叙事渲染参数（人称 + 文风）
    html += `
<div class="section">
  <h2>叙事渲染参数 <span class="debug-badge">不进指纹·纯渲染层</span></h2>
  <div class="render-param-row">
    <label>人称:
      <select id="narrative-person-sel">
        ${Object.keys(PERSON_LABELS)
        .map((p) => `<option value="${esc(p)}"${p === S.narrativePerson ? " selected" : ""}>${esc(PERSON_LABELS[p])}</option>`)
        .join("")}
      </select>
    </label>
    <label>文风:
      <select id="narrative-style-sel">
        ${Object.keys(STYLE_LABELS)
        .map((s) => `<option value="${esc(s)}"${s === S.narrativeStyle ? " selected" : ""}>${esc(STYLE_LABELS[s])}</option>`)
        .join("")}
      </select>
    </label>
    <span class="dim" style="font-size:11px">切换后下次叙事生效（demo 模式立即重渲染）</span>
  </div>
</div>`;
    // 时间线增量视图
    html += `<div class="section"><h2>时间线增量视图（${timeline.length} 拍）</h2>`;
    if (timeline.length === 0) {
        html += `<div class="dim" style="padding:8px">（尚无拍记录·点「单步」推进）</div>`;
    }
    else {
        html += `<div class="timeline-log">`;
        for (const entry of [...timeline].reverse()) {
            const hasChanges = entry.cognitiveChangesCount > 0 || entry.resourceChangesCount > 0;
            html += `<div class="timeline-entry${hasChanges ? " has-changes" : ""}">
        [${esc(entry.tickId)}] ${esc(entry.summary)}
        <span class="dim">新印象×${entry.newImpressions} 强增×${entry.strengthIncreases} 关系触发×${entry.relationHitsCount}</span>
      </div>`;
        }
        html += `</div>`;
    }
    html += `</div>`;
    // 拍结果栏 + 可选拍 State Diff（点击查看任意拍与上一拍的差异）
    if (S.diffs.length > 0) {
        const sel = currentDiffForRipple();
        const headline = `${chip(`认知×${sel.cognitiveChanges.length}`, "#1f6feb")}${chip(`关系触发×${sel.relationHits.length}`, "#bb8009")}${chip(`资源×${sel.resourceChanges.length}`, "#238636")}`;
        html += `<div class="section"><h2>拍结果栏 · State Diff <span class="debug-badge">选拍查看与上一拍差异</span></h2>`;
        html += `<div class="diff-pick-row" style="margin-bottom:6px"><label>查看拍: <select id="diff-tick-sel">`;
        for (const d of [...S.diffs].reverse()) {
            html += `<option value="${esc(d.tickId)}"${d.tickId === sel.tickId ? " selected" : ""}>${esc(d.tickId)} · 认知${d.cognitiveChanges.length}/关系${d.relationHits.length}/资源${d.resourceChanges.length}</option>`;
        }
        html += `</select></label></div>`;
        html += `<div style="margin:6px 0">${headline}</div>`;
        html += `<div class="result-box">${diffToHtml(sel)}</div>`;
        html += `</div>`;
    }
    html += `</div>`;
    return html;
}
// ── Tab: 关系网（C2 实装·此处骨架） ──────────────────────────────────────────
function renderGraphTab() {
    const graph = buildRelationGraph(S.state);
    return `<div class="tab-content">${renderGraphSection(graph, S.prevGraph)}</div>`;
}
function renderGraphSection(graph, prevGraph) {
    const W = 620, H = 420;
    const cx = W / 2, cy = H / 2;
    const N = graph.nodes.length;
    // 确定性圆形布局（禁 Math.random）
    const positions = graph.nodes.map((_, i) => {
        const angle = N > 1 ? (2 * Math.PI * i) / N - Math.PI / 2 : 0;
        const r = N <= 1 ? 0 : Math.min(W, H) * 0.37;
        return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    });
    const posMap = new Map(graph.nodes.map((n, i) => [n.key, positions[i]]));
    let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;margin:auto">`;
    svg += `<defs>
    <marker id="arrow-weak" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#6e7681"/></marker>
    <marker id="arrow-high" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#ff6b35"/></marker>
    <marker id="arrow-ripple" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#f0c674"/></marker>
  </defs>`;
    // 边（先画��，节点在上层）
    for (const e of graph.edges) {
        const p1 = posMap.get(e.from);
        const p2 = posMap.get(e.to);
        if (!p1 || !p2)
            continue;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        const R = 22; // 缩短到节点边缘外·让箭头不被圆盖住
        const x1 = (p1.x + ux * R).toFixed(1);
        const y1 = (p1.y + uy * R).toFixed(1);
        const x2 = (p2.x - ux * R).toFixed(1);
        const y2 = (p2.y - uy * R).toFixed(1);
        const signColor = e.strength < 0 ? "#f85149" : "#3fb950";
        const color = e.isHighlighted ? "#ff6b35" : signColor;
        const width = e.isHighlighted ? 2.5 : 1.2;
        const opacity = e.isHighlighted ? "0.95" : "0.45";
        const marker = e.isHighlighted ? "arrow-high" : "arrow-weak";
        svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" opacity="${opacity}" marker-end="url(#${marker})"/>`;
        // 关系类型标签（高亮边附 score）
        const tx = (p1.x + dx * 0.4).toFixed(1);
        const ty = (p1.y + dy * 0.4 - 2).toFixed(1);
        svg += `<text x="${tx}" y="${ty}" text-anchor="middle" fill="${e.isHighlighted ? "#ff9d6e" : "#8b949e"}" font-size="8" font-family="sans-serif">${esc(e.type)}${e.isHighlighted ? " " + e.score.toFixed(0) : ""}</text>`;
    }
    // 节点
    for (const n of graph.nodes) {
        const pos = posMap.get(n.key);
        if (!pos)
            continue;
        const hasClusters = n.orgKeys.length > 0;
        const fill = hasClusters ? "#1f3a5c" : "#1e2a1e";
        const stroke = hasClusters ? "#4a9eff" : "#3fb950";
        const name = n.name.length > 5 ? n.name.slice(0, 4) + "…" : n.name;
        svg += `<circle cx="${pos.x.toFixed(1)}" cy="${pos.y.toFixed(1)}" r="20" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
        svg += `<text x="${pos.x.toFixed(1)}" y="${(pos.y - 4).toFixed(1)}" text-anchor="middle" fill="#c9d1d9" font-size="9" font-family="sans-serif">${esc(name)}</text>`;
        svg += `<text x="${pos.x.toFixed(1)}" y="${(pos.y + 8).toFixed(1)}" text-anchor="middle" fill="#8b949e" font-size="8" font-family="monospace">${esc(n.key.slice(0, 8))}</text>`;
    }
    if (N === 0) {
        svg += `<text x="${cx}" y="${cy}" text-anchor="middle" fill="#8b949e" font-size="14">无 NPC 节点</text>`;
    }
    // 涟漪传播路径叠加（点亮本拍 / 选定拍的因果链）
    if (S.showRipple) {
        const rd = currentDiffForRipple();
        if (rd) {
            const drawRipple = (from, to, label) => {
                const a = posMap.get(from);
                const b = posMap.get(to);
                if (!a || !b || from === to)
                    return;
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const len = Math.hypot(dx, dy) || 1;
                const ux = dx / len;
                const uy = dy / len;
                const R = 24;
                const x1 = (a.x + ux * R).toFixed(1);
                const y1 = (a.y + uy * R).toFixed(1);
                const x2 = (b.x - ux * R).toFixed(1);
                const y2 = (b.y - uy * R).toFixed(1);
                svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#f0c674" stroke-width="3" opacity="0.9" stroke-dasharray="5 3" marker-end="url(#arrow-ripple)"><animate attributeName="stroke-dashoffset" from="16" to="0" dur="0.6s" repeatCount="indefinite"/></line>`;
                if (label) {
                    const lx = (a.x + dx * 0.5).toFixed(1);
                    const ly = (a.y + dy * 0.5 + 9).toFixed(1);
                    svg += `<text x="${lx}" y="${ly}" text-anchor="middle" fill="#f0c674" font-size="8">${esc(label)}</text>`;
                }
            };
            for (const r of rd.relationHits)
                drawRipple(r.from, r.to, r.type);
            for (const c of rd.cognitiveChanges)
                drawRipple(c.observer, c.target, "");
        }
    }
    svg += `</svg>`;
    let html = `<div class="section"><h2>关系网拓扑图</h2>`;
    html += `<div class="graph-container">${svg}
  <div class="graph-legend">
    <span class="legend-item"><svg width="24" height="4"><line x1="0" y1="2" x2="24" y2="2" stroke="#ff6b35" stroke-width="2.5"/></svg> 高亮边 score≥${PHASE6_THRESHOLD}（涟漪可触发）×${graph.highlightedEdgeCount}</span>
    <span class="legend-item"><svg width="24" height="4"><line x1="0" y1="2" x2="24" y2="2" stroke="#3a4050" stroke-width="1.2"/></svg> 弱边×${graph.weakEdgeCount}</span>
    <span class="legend-item"><svg width="14" height="14"><circle cx="7" cy="7" r="6" fill="#1f3a5c" stroke="#4a9eff" stroke-width="1.5"/></svg> 有组织节点</span>
    <span class="legend-item"><svg width="14" height="14"><circle cx="7" cy="7" r="6" fill="#1e2a1e" stroke="#3fb950" stroke-width="1.5"/></svg> 无组织节点</span>
  </div>
  </div></div>`;
    // A1: 节点明细按地点分组
    const locGroups = groupNodesByLocation(S.state);
    html += `<div class="section"><h2>节点明细 · 按地点分组（${graph.nodes.length} NPC / ${locGroups.length} 地点）</h2>`;
    if (locGroups.length === 0) {
        html += `<div class="dim" style="padding:8px">（无 NPC 节点）</div>`;
    }
    else {
        html += `<div class="loc-groups">`;
        for (const g of locGroups) {
            html += `<div class="loc-group">`;
            html += `<div class="loc-group-header">📍 ${esc(g.location)} <span class="dim">×${g.nodes.length}</span></div>`;
            html += `<div class="loc-group-body">`;
            for (const n of g.nodes) {
                const orgBadge = n.orgKeys.length > 0
                    ? `<span class="loc-node-org dim">[${n.orgKeys.map(esc).join(",")}]</span>`
                    : "";
                const secretBadge = n.knownSecretCount > 0
                    ? `<span class="loc-secret-badge ok">秘×${n.knownSecretCount}</span>`
                    : "";
                html += `<div class="loc-node-row"><span class="loc-node-name">${esc(n.name)}</span><code class="loc-node-key dim">${esc(n.key)}</code>${orgBadge}${secretBadge}</div>`;
            }
            html += `</div></div>`;
        }
        html += `</div>`;
    }
    html += `</div>`;
    // A2: 边明细可视化（强度进度条 + 跨拍增减高亮）
    const edgeDeltaMap = prevGraph
        ? buildEdgeDelta(prevGraph.edges, graph.edges)
        : new Map();
    html += `<div class="section"><h2>边明细（${graph.edges.length}）</h2>`;
    if (graph.edges.length === 0) {
        html += `<div class="dim" style="padding:8px">（无关系边）</div>`;
    }
    else {
        html += `<div class="edge-list">`;
        for (const e of graph.edges) {
            const absStr = Math.abs(e.strength);
            const pct = absStr; // strength max = 100
            const barClass = absStr >= 50 ? "edge-bar-high" : "";
            const scoreStr = e.isHighlighted
                ? `<span class="ok">★ score=${e.score.toFixed(1)}</span>`
                : `<span class="dim">score=${e.score.toFixed(1)}</span>`;
            const ripple = absStr >= 50 ? `<span class="ripple-hint">涟漪可触发</span>` : "";
            const pa = e.from < e.to ? e.from : e.to;
            const pb = e.from < e.to ? e.to : e.from;
            const pk = `${pa}\x00${pb}`;
            const delta = edgeDeltaMap.get(pk);
            let deltaHtml = "";
            if (delta && delta.strengthDelta > 0)
                deltaHtml = `<span class="delta-up">↑${delta.strengthDelta}</span>`;
            if (delta && delta.strengthDelta < 0)
                deltaHtml = `<span class="delta-down">↓${Math.abs(delta.strengthDelta)}</span>`;
            html += `<div class="edge-row">
  <span class="edge-endpoints">${esc(e.from)} ─[<span class="dim">${esc(e.type)}</span>]→ ${esc(e.to)}</span>
  <div class="edge-strength-section">
    <div class="edge-strength-wrap"><div class="edge-strength-bar ${barClass}" style="width:${pct}%"></div></div>
    <span class="edge-strength-num${e.strength < 0 ? " err" : ""}">${e.strength}</span>
    ${ripple}${deltaHtml}
  </div>
  <span class="edge-meta dim">信任${e.trust}% ${scoreStr}</span>
</div>`;
        }
        html += `</div>`;
    }
    html += `</div>`;
    // 涟漪传播路径 · 本拍因果链可视化（与拓扑图叠加联动）
    const rippleDiff = currentDiffForRipple();
    html += `<div class="section"><h2>涟漪传播路径 <span class="debug-badge">本拍因果链·点亮后叠加到拓扑图</span></h2>`;
    html += `<div class="btn-group"><button class="btn${S.showRipple ? " btn-action" : ""}" id="btn-toggle-ripple">${S.showRipple ? "✓ 已点亮传播路径" : "显示本拍涟漪传播路径"}</button></div>`;
    if (!rippleDiff) {
        html += `<div class="dim" style="padding:6px">（尚无拍记录·在「时间控制」推进或在「菜单·校验」点 permitted 选项触发涟漪）</div>`;
    }
    else {
        html += `<div class="ripple-path" style="font-family:monospace;font-size:12px">`;
        html += `<div style="font-weight:600;color:#f0c674;padding:4px 0">⚡ 涟漪源 [${esc(rippleDiff.tickId)}]：操纵者 <code>${esc(S.operatorKey)}</code> 本拍行为</div>`;
        if (rippleDiff.cognitiveChanges.length > 0) {
            html += `<div style="margin:4px 0;border-left:2px solid #30363d;padding-left:8px"><span class="dim">① 认知传播（${rippleDiff.cognitiveChanges.length}）:</span>`;
            for (const c of rippleDiff.cognitiveChanges) {
                html += `<div style="padding-left:14px">${esc(c.observer)} ⟶ ${esc(c.target)} <span class="warn">[${esc(c.tag)}/${esc(c.polarity)}]</span> ${c.before !== undefined ? `${c.before}→` : "新增→"}${c.after}${c.isNew ? ' <span class="ok">★新</span>' : ""}</div>`;
            }
            html += `</div>`;
        }
        if (rippleDiff.relationHits.length > 0) {
            html += `<div style="margin:4px 0;border-left:2px solid #30363d;padding-left:8px"><span class="dim">② 关系触发 Phase6（${rippleDiff.relationHits.length}）:</span>`;
            for (const r of rippleDiff.relationHits) {
                html += `<div style="padding-left:14px"><span class="ok">★</span> ${esc(r.from)} ─[${esc(r.type)} ${r.strength}×${r.trust}/100=<span class="ok">${r.score.toFixed(1)}</span>]⟶ ${esc(r.to)}</div>`;
            }
            html += `</div>`;
        }
        if (rippleDiff.resourceChanges.length > 0) {
            html += `<div style="margin:4px 0;border-left:2px solid #30363d;padding-left:8px"><span class="dim">③ 资源涟漪（${rippleDiff.resourceChanges.length}）:</span>`;
            for (const rc of rippleDiff.resourceChanges) {
                const sign = rc.delta > 0 ? "+" : "";
                html += `<div style="padding-left:14px">${esc(rc.entity)} ${esc(rc.currency)}: ${rc.before}→${rc.after} <span class="${rc.delta > 0 ? "ok" : "err"}">(${sign}${rc.delta})</span></div>`;
            }
            html += `</div>`;
        }
        if (rippleDiff.cognitiveChanges.length === 0 &&
            rippleDiff.relationHits.length === 0 &&
            rippleDiff.resourceChanges.length === 0) {
            html += `<div class="dim" style="padding-left:14px">（本拍无可见涟漪变更）</div>`;
        }
        html += `</div>`;
    }
    html += `</div>`;
    return html;
}
// ── 操纵主体标注 ──────────────────────────────────────────────────────────────
function renderOperatorBanner() {
    if (S.operatorKey === S.pcKey) {
        return `<div class="operator-banner operator-default">操纵主体: <strong>${esc(S.operatorKey)}</strong>（默认 PC）</div>`;
    }
    return `<div class="operator-banner operator-switched">⚠ 操纵主体已切换 → <strong>${esc(S.operatorKey)}</strong>（NPC 身份·原 PC ${esc(S.pcKey)}）</div>`;
}
// ── 自由文本映射 ──────────────────────────────────────────────────────────────
function tryMapToOptionId(text, menuWithIds) {
    const t = text.trim();
    if (!t)
        return { optionId: null, matchType: "none" };
    const exact = menuWithIds.find((o) => o.option_id === t);
    if (exact)
        return { optionId: exact.option_id, matchType: "exact" };
    for (const o of menuWithIds) {
        const dt = o.displayText ?? "";
        if (dt && dt.includes(t))
            return { optionId: o.option_id, matchType: "display" };
    }
    for (const o of menuWithIds) {
        const dt = o.displayText ?? "";
        if (dt.length >= 3 && t.includes(dt))
            return { optionId: o.option_id, matchType: "display" };
    }
    for (const o of menuWithIds) {
        const verb = o.option_id.split(":")[0] ?? "";
        if (verb && t.startsWith(verb))
            return { optionId: o.option_id, matchType: "verb" };
    }
    return { optionId: null, matchType: "none" };
}
// ── 自由文本面板 ──────────────────────────────────────────────────────────────
function renderFreeTextSection() {
    let inner = `<div class="section">
  <h2>自由文本输入框 <span class="debug-badge">debug 近似匹配·真词释留 G4</span></h2>
  <div class="helper-text">输入自然语言描述，自动映射到最近 option_id；若映射失败则降级为纯叙事（不写账）。</div>
  <div class="input-row">
    <input type="text" id="free-text-input" class="text-input" placeholder="如：和王掌柜聊聊 / 向王掌柜问好" value="${esc(S.freeText)}"/>
    <button class="btn btn-primary" id="btn-free-submit">提交</button>
  </div>`;
    if (S.freeTextLoading) {
        inner += `<div class="narrative-loading">⏳ 处理中…</div>`;
    }
    else if (S.lastFreeTextResult) {
        inner += renderFreeTextResultHtml(S.lastFreeTextResult);
    }
    inner += `</div>`;
    return inner;
}
function renderFreeTextResultHtml(r) {
    const mapBadgeClass = r.isRpOnly
        ? "map-badge map-rp"
        : "map-badge map-success";
    const mapLabel = r.isRpOnly
        ? "纯RP·未映射 → 不写账"
        : `映射成功(${esc(r.matchType)}): ${esc(r.matchedOptionId ?? "")}`;
    let s = `<div class="free-text-result">`;
    s += `<div class="free-text-header">输入: <code>${esc(r.input)}</code> <span class="${mapBadgeClass}">${mapLabel}</span></div>`;
    if (!r.isRpOnly && r.chain) {
        if (!r.chain.passed) {
            s += `<div class="free-chain-fail"><span class="err">✗ 校验失败</span> 拒绝于「${esc(r.chain.rejectStep ?? "")}」 原因码: ${esc(r.chain.rejectCode ?? "")}</div>`;
        }
        else if (r.diff) {
            s += `<div class="free-diff"><span class="ok">✓ 写账成功</span> tickId: <code class="dim">${esc(r.diff.tickId)}</code></div>`;
        }
    }
    if (r.isRpOnly) {
        s += `<div class="dim" style="font-size:11px;margin-top:4px">纯RP模式：仅出字·不写账·不驱动 runTick</div>`;
    }
    if (r.narrative && r.narrative.narrative) {
        s += `<div class="narrative-meta" style="margin-top:8px"><span class="mode-tag mode-tag-demo">叙事·出字</span>`;
        if (r.narrative.isFallback)
            s += `<span class="fallback-badge fallback-on">isFallback=true</span>`;
        s += `</div>`;
        s += `<div class="prose-box">${esc(r.narrative.narrative)}</div>`;
    }
    s += `</div>`;
    return s;
}
// ── Tab: POV 视角 / 操纵主体 ────────────────────────────────────────────────────
//
// 设计原则：切换 POV = 切换操纵主体。
//   pov-entity-sel 同时驱动 S.povEntityKey 和 S.operatorKey，二者恒等。
//   菜单·校验·叙事·runTick 均以当前所选实体身份执行。
//   选谁的 POV 就是在操纵谁，无独立「操纵主体」选择器。
function renderPOVTab() {
    const npcKeys = Object.keys(S.state.NPC);
    const npcOpts = (sel) => npcKeys
        .map((k) => `<option value="${esc(k)}"${k === sel ? " selected" : ""}>${esc(k)} · ${esc(S.state.NPC[k].姓名)}</option>`)
        .join("");
    // 主实体：POV = 操纵主体（单一真相源·两字段恒等）
    const povKey = S.povEntityKey && S.state.NPC[S.povEntityKey]
        ? S.povEntityKey
        : (npcKeys[0] ?? "");
    const rPov = povKey ? povInspect(S.state, povKey) : null;
    // 并排比对（二级功能·独立 A/B 选择器·只读）
    const rA = S.povA && S.state.NPC[S.povA] ? povInspect(S.state, S.povA) : null;
    const rB = S.povB && S.state.NPC[S.povB] ? povInspect(S.state, S.povB) : null;
    const isNonPC = povKey !== S.pcKey;
    const statusBadge = isNonPC
        ? `<span class="operator-status operator-switched">⚠ 非默认 PC · 菜单·叙事以 ${esc(povKey)} 身份执行</span>`
        : `<span class="operator-status operator-default">${esc(S.pcKey)}（默认 PC）</span>`;
    let html = `<div class="tab-content">`;
    // ── 1. 当前 POV / 操纵主体（主选择器）────────────────────────────────────────
    html += `
<div class="section">
  <h2>POV · 操纵主体 <span class="debug-badge">选谁就操纵谁 · ���跑 runTick</span></h2>
  <div class="pov-primary-row">
    <label>当前实体:
      <select id="pov-entity-sel">${npcOpts(povKey)}</select>
    </label>
    <button class="btn" id="btn-reset-operator">重置为 PC (${esc(S.pcKey)})</button>
    ${statusBadge}
  </div>`;
    if (rPov) {
        html += povProjectionHtml(rPov, S.state, povKey);
    }
    else {
        html += `<div class="dim" style="padding:8px">（无有效 NPC 节点）</div>`;
    }
    html += `</div>`;
    // ── 2. 并排 POV 比对（二级·只读）─────────────────────────────────────────────
    html += `
<div class="section">
  <h2>POV 并排比对（二级·只读）</h2>
  <div class="input-row">
    <label>POV A: <select id="pov-a-sel">${npcOpts(S.povA)}</select></label>
    <label>POV B: <select id="pov-b-sel">${npcOpts(S.povB)}</select></label>
    <button class="btn btn-primary" id="btn-pov-compare">更新比对</button>
  </div>
  <div class="pov-grid">
    <div class="pov-col"><h3>POV A: ${esc(S.povA)}</h3>${rA ? povHtml(rA) : '<span class="dim">—</span>'}</div>
    <div class="pov-col"><h3>POV B: ${esc(S.povB)}</h3>${rB ? povHtml(rB) : '<span class="dim">—</span>'}</div>
  </div>`;
    if (rA && rB) {
        const cmp = comparePOVs(S.state, S.povA, S.povB);
        html += `<div class="pov-diff"><h3>diff A(${esc(S.povA)}) vs B(${esc(S.povB)}):</h3>`;
        html += `<div class="result-box">`;
        html += `只有 A 可见秘密: <span class="ok">${cmp.onlyA.join(", ") || "（无）"}</span>\n`;
        html += `只有 B 可见秘密: <span class="ok">${cmp.onlyB.join(", ") || "（无）"}</span>\n`;
        html += `双方均可见:       <span class="warn">${cmp.both.join(", ") || "（无）"}</span>\n`;
        html += `\n认知 A 多: <span class="dim">${cmp.cognitiveOnlyA.join(", ") || "无"}</span>\n`;
        html += `认知 B 多: <span class="dim">${cmp.cognitiveOnlyB.join(", ") || "无"}</span>`;
        html += `</div></div>`;
    }
    html += `</div>`;
    html += `</div>`; // tab-content
    return html;
}
/** 主 POV 投影面板（6 组字段·投影值 ⊥ 真值并列显示）
 *
 * 铁律：真值列仅在此调试面板显示为 spoiler，绝不渗入正常游玩的 POV 渲染路径。
 * 不进 runTick · 不进指纹 · 纯只读 · 不改 operatorKey。
 */
function povProjectionHtml(r, state, entityKey) {
    const npcRaw = state.NPC?.[entityKey];
    let s = `<div class="pov-projection">`;
    // ── Section 1: 可见秘密 ──────────────────────────────────────────────────────
    s += `<div class="pov-proj-section"><span class="pov-proj-label">① 可见秘密</span>`;
    s += `<span class="pov-proj-count">${r.visibleSecretIds.length} 条</span></div>`;
    s += `<div class="result-box" style="font-size:11px">`;
    if (r.visibleSecretIds.length === 0) {
        s += `<span class="dim">（无可见秘密·existence-opaque）</span>\n`;
    }
    else {
        for (const id of r.visibleSecretIds) {
            const sec = r.visibleSecrets[id];
            s += `<span class="ok">${esc(id)}</span>`;
            if (sec)
                s += ` 母题=${esc(sec.母题 ?? "—")} 严重度=${sec.严重度 ?? "—"} 暴露度=${sec.暴露度 ?? "—"}`;
            s += `\n`;
        }
    }
    s += `<span class="dim">隐藏(existence-opaque): ${r.hiddenSecretCount}</span>\n`;
    s += `</div>`;
    // ── Section 2: 认知档案投影 ──────────────────────────────────────────────────
    s += `<div class="pov-proj-section"><span class="pov-proj-label">② 认知档案投影</span>`;
    s += `<span class="pov-proj-count">${r.cognitiveTargetKeys.length} 目标</span></div>`;
    s += `<div class="result-box" style="font-size:11px">`;
    if (r.cognitiveTargetKeys.length === 0) {
        s += `<span class="dim">（无认知条目）</span>\n`;
    }
    else {
        for (const [tgt, proj] of Object.entries(r.cognitiveProjection)) {
            s += `→ <code>${esc(tgt)}</code> 了解度=<span class="warn">${proj.了解度}</span> 印象×${proj.impressionCount}\n`;
        }
    }
    s += `</div>`;
    // ── Section 3: 关系投影（直读 NPC 关系字段·只读·不进指纹）─────────────────
    const relations = npcRaw?.关系 ?? [];
    s += `<div class="pov-proj-section"><span class="pov-proj-label">③ 关系投影</span>`;
    s += `<span class="pov-proj-count">${relations.length} 条</span></div>`;
    s += `<div class="result-box" style="font-size:11px">`;
    if (relations.length === 0) {
        s += `<span class="dim">（无关系数据）</span>\n`;
    }
    else {
        for (const rel of relations) {
            const col = rel.强度 > 0 ? "ok" : rel.强度 < 0 ? "err" : "dim";
            s += `→ <code>${esc(rel.对象键)}</code> [${esc(rel.类型)}] 强度=<span class="${col}">${rel.强度}</span> 信任=${rel.信任}\n`;
        }
    }
    s += `</div>`;
    // ── Section 4: 五轴人格投影（投影值 vs 真值并列·偏差项可见）────────────────
    let pp = null;
    try {
        pp = computePovPersonalityProjection(state, entityKey);
    }
    catch {
        pp = null;
    }
    s += `<div class="pov-proj-section"><span class="pov-proj-label">④ 五轴人格投影</span>`;
    if (pp) {
        const biasLabel = pp.totalBias === 0
            ? `<span class="ok">偏差=0（投影=真值）</span>`
            : `<span class="warn">偏差Δ${pp.totalBias >= 0 ? "+" : ""}${pp.totalBias}</span>`;
        s += `<span class="pov-proj-count">${biasLabel}</span>`;
    }
    s += `</div>`;
    s += `<div class="result-box" style="font-size:11px">`;
    if (pp) {
        s += `<div class="pov-two-col-header"><span class="dim">轴</span><span class="warn">投影值</span><span class="pov-spoiler-head">真值(spoiler)</span></div>`;
        const axes = ["开放", "尽责", "外向", "宜人", "神经质"];
        for (const axis of axes) {
            const axData = pp[axis];
            const biasStr = axData.bias !== 0
                ? ` <span class="warn">(Δ${axData.bias >= 0 ? "+" : ""}${axData.bias})</span>`
                : "";
            s += `<div class="pov-two-col-row">`;
            s += `<span class="dim">${esc(axis)}</span>`;
            s += `<span class="${axData.bias !== 0 ? "warn" : "ok"}">${axData.projected}</span>${biasStr}`;
            s += `<span class="pov-spoiler">${axData.true}</span>`;
            s += `</div>\n`;
        }
    }
    else {
        s += `<span class="dim">（五轴数据不可用）</span>\n`;
    }
    s += `</div>`;
    // ── Section 5: 已知物品（POV 视角所知·投影值=认知库持有量 vs 真值=实际持有）──
    const items = Object.entries(npcRaw?.物品 ?? {});
    s += `<div class="pov-proj-section"><span class="pov-proj-label">⑤ 已知物品</span>`;
    s += `<span class="pov-proj-count">${items.length} 件</span></div>`;
    s += `<div class="result-box" style="font-size:11px">`;
    if (items.length === 0) {
        s += `<span class="dim">（无物品）</span>\n`;
    }
    else {
        s += `<div class="pov-two-col-header"><span class="dim">物品键</span><span class="warn">投影(已知)</span><span class="pov-spoiler-head">真值(spoiler)</span></div>`;
        for (const [key, item] of items) {
            s += `<div class="pov-two-col-row">`;
            s += `<code class="dim">${esc(key)}</code>`;
            s += `<span class="ok">×${item.数量} [${esc(item.类别)}]</span>`;
            s += `<span class="pov-spoiler">×${item.数量} [${esc(item.重要级别)}]</span>`;
            s += `</div>\n`;
        }
    }
    s += `</div>`;
    // ── Section 6: 已知目标（自身目标 + 认知对象·投影vs真值）────────────────────
    const goals = npcRaw?.目标 ?? { 长期: [], 短期: [] };
    const cogTargets = r.cognitiveTargetKeys;
    const totalGoals = (goals.长期?.length ?? 0) + (goals.短期?.length ?? 0);
    s += `<div class="pov-proj-section"><span class="pov-proj-label">⑥ 已知目标</span>`;
    s += `<span class="pov-proj-count">${totalGoals} 目标 · ${cogTargets.length} 认知对象</span></div>`;
    s += `<div class="result-box" style="font-size:11px">`;
    if (totalGoals === 0 && cogTargets.length === 0) {
        s += `<span class="dim">（无目标·无认知对象）</span>\n`;
    }
    else {
        if ((goals.长期?.length ?? 0) > 0) {
            s += `<div class="pov-two-col-header"><span class="dim">长期目标</span><span class="warn">投影</span><span class="pov-spoiler-head">真值(spoiler)</span></div>`;
            for (const g of goals.长期 ?? []) {
                s += `<div class="pov-two-col-row">`;
                s += `<span class="dim">📌</span>`;
                s += `<span class="warn">${esc(g)}</span>`;
                s += `<span class="pov-spoiler">${esc(g)}</span>`;
                s += `</div>\n`;
            }
        }
        if ((goals.短期?.length ?? 0) > 0) {
            s += `<div class="pov-two-col-header"><span class="dim">短期目标</span><span class="warn">投影</span><span class="pov-spoiler-head">真值(spoiler)</span></div>`;
            for (const g of goals.短期 ?? []) {
                s += `<div class="pov-two-col-row">`;
                s += `<span class="dim">⚡</span>`;
                s += `<span class="warn">${esc(g)}</span>`;
                s += `<span class="pov-spoiler">${esc(g)}</span>`;
                s += `</div>\n`;
            }
        }
        if (cogTargets.length > 0) {
            s += `<div class="pov-two-col-header" style="margin-top:6px"><span class="dim">认知对象</span><span class="warn">投影(了解度)</span><span class="pov-spoiler-head">真值(spoiler)</span></div>`;
            for (const tgt of cogTargets) {
                const proj = r.cognitiveProjection[tgt];
                const trueName = state.NPC?.[tgt]?.姓名 ?? tgt;
                s += `<div class="pov-two-col-row">`;
                s += `<code class="dim">${esc(tgt)}</code>`;
                s += `<span class="warn">了解度=${proj?.了解度 ?? 0} 印象×${proj?.impressionCount ?? 0}</span>`;
                s += `<span class="pov-spoiler">${esc(trueName)}</span>`;
                s += `</div>\n`;
            }
        }
    }
    s += `</div>`;
    s += `</div>`; // pov-projection
    return s;
}
function povHtml(r) {
    let s = `<div class="result-box" style="font-size:11px">`;
    s += `可见秘密 (${r.visibleSecretIds.length}): <span class="ok">${r.visibleSecretIds.join(", ") || "无"}</span>\n`;
    s += `隐藏秘密 (existence-opaque): <span class="dim">${r.hiddenSecretCount}</span>\n`;
    s += `认知目标数: <span class="warn">${r.cognitiveTargetKeys.length}</span>\n`;
    for (const [tgt, proj] of Object.entries(r.cognitiveProjection)) {
        s += `  → ${esc(tgt)}: 了解度=${proj.了解度} 印象×${proj.impressionCount}\n`;
    }
    s += `</div>`;
    return s;
}
// ── Tab: 快照·回放 ────────────────────────────────────────────────────────────
function renderSnapshotTab() {
    const savedSnaps = S.snapshotStore.list();
    let html = `<div class="tab-content">`;
    // 保存快照
    html += `<div class="section"><h2>全局状态快照</h2>
  <div class="snapshot-row">
    <input type="text" id="snap-label" value="${esc(S.snapshotLabel)}" style="width:120px" placeholder="快照标签"/>
    <button class="btn btn-primary" id="btn-snap-save">保存快照</button>
  </div>`;
    if (savedSnaps.length > 0) {
        html += `<div class="helper-text">已保存快照（${savedSnaps.length}）:</div><ul class="snapshot-list">`;
        for (const label of savedSnaps) {
            const snap = S.snapshotStore.get(label);
            html += `<li><span>${esc(label)}</span><span class="dim">tick=${snap?.tickCount} NPC=${snap?.npcCount}</span></li>`;
        }
        html += `</ul>`;
        if (savedSnaps.length >= 2) {
            html += `<div class="input-row">
        比对:
        <select id="snap-sel-a">${savedSnaps.map((l) => `<option${l === S.snapSelA ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>
        vs
        <select id="snap-sel-b">${savedSnaps.map((l) => `<option${l === S.snapSelB ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>
        <button class="btn btn-primary" id="btn-snap-compare">比对</button>
      </div>`;
        }
        if (S.snapSelA && S.snapSelB && S.snapSelA !== S.snapSelB) {
            try {
                const diff = S.snapshotStore.compare(S.snapSelA, S.snapSelB);
                html += `<div class="result-box">`;
                html += `比对 [${esc(diff.labelA)}] vs [${esc(diff.labelB)}]\n`;
                html += `摘要: <span class="ok">${esc(diff.summary)}</span>\n`;
                html += `变更字段数: ${diff.changedFields.length}\n`;
                for (const f of diff.changedFields) {
                    html += `  ${esc(f.field)}: <span class="err">${esc(JSON.stringify(f.before))}</span> → <span class="ok">${esc(JSON.stringify(f.after))}</span>\n`;
                }
                html += `</div>`;
            }
            catch {
                // snapshots may have been cleared
            }
        }
    }
    html += `</div>`;
    // 动作序列记录器
    html += `<div class="section"><h2>动作序列记录与重放</h2>`;
    html += `<div class="helper-text">使用菜单·校验 tab 中的 permitted 按钮点击动作，记录后在此重放。</div>`;
    html += `<div class="btn-group">
    <button class="btn btn-warn" id="btn-rec-reset">重置记录器</button>
    <button class="btn btn-primary" id="btn-rec-replay">从基态重放</button>
  </div>`;
    html += `<div class="helper-text">已记录动作: ${S.recActions.length} 步</div>`;
    if (S.recActions.length > 0) {
        html += `<div class="replay-log">`;
        S.recActions.forEach((a, i) => {
            html += `  [${i}] ${esc(a)}\n`;
        });
        html += `</div>`;
    }
    html += `</div></div>`;
    return html;
}
// ── Tab: 状态树·地图 ─────────────────────────────────────────────────────────
function renderTreeTab() {
    const tree = buildStateTree(S.state);
    const map = buildMapThumbnail(S.state);
    let html = `<div class="tab-content">`;
    // A3: 角色面板（随操纵主体更新·POV 过滤·字段全枚举）
    if (S.operatorKey && S.state.NPC[S.operatorKey]) {
        try {
            const ap = buildActorPanel(S.state, S.operatorKey);
            const isSwapped = S.operatorKey !== S.pcKey;
            html += `<div class="section"><h2>角色面板 · ${esc(ap.name)} (${esc(ap.entityKey)})</h2>`;
            if (isSwapped) {
                html += `<div class="operator-banner operator-switched" style="margin-bottom:8px">⚠ 视角已切换 → ${esc(S.operatorKey)}（非默认 PC ${esc(S.pcKey)}）</div>`;
            }
            html += `<div class="actor-panel-wrap">${renderActorPanelHtml(ap)}</div>`;
            html += `</div>`;
        }
        catch {
            // operatorKey not in this fixture
        }
    }
    // 地图缩略图
    html += `<div class="section"><h2>地图缩略图（LOD 占位·待 G7）</h2>`;
    html += `<table class="map-table"><thead><tr><th>地点键</th><th>名称</th><th>类别</th><th>大小</th><th>NPC数</th><th>LOD</th></tr></thead><tbody>`;
    for (const loc of map.locations) {
        html += `<tr>
      <td><code>${esc(loc.key)}</code></td>
      <td>${esc(loc.name)}</td>
      <td>${esc(loc.category)}</td>
      <td>${esc(loc.size)}</td>
      <td>${loc.npcCount}</td>
      <td><span class="lod-placeholder">${esc(loc.lodStatus)}（待 G7）</span></td>
    </tr>`;
    }
    if (map.locations.length === 0) {
        html += `<tr><td colspan="6" class="dim">（无地图数据）</td></tr>`;
    }
    html += `</tbody></table>`;
    html += `<div class="dim" style="font-size:11px;margin-top:6px">lodSystemStatus: ${esc(map.lodSystemStatus)}（灰显占位·不伪造·待 G7 实装）</div>`;
    html += `</div>`;
    // 可折叠状态树
    html += `<div class="section"><h2>世界状态树</h2><div class="tree-root">${renderTreeNode(tree)}</div></div>`;
    html += `</div>`;
    return html;
}
// ── A3: 详细角色面板渲染（所有可显示字段 + POV 过滤） ─────────────────────────────
function renderActorPanelHtml(panel) {
    let h = "";
    // 身份头部
    const aliveClass = panel.存活状态 === "在世" ? "ok" : "err";
    h += `<div class="actor-id-block">`;
    h += `<span class="actor-name-big">${esc(panel.name)}</span>`;
    if (panel.称呼)
        h += ` <span class="dim">（${esc(panel.称呼)}）</span>`;
    h += ` <code class="dim">${esc(panel.entityKey)}</code>`;
    h += ` <span class="${aliveClass}">${esc(panel.存活状态)}</span>`;
    h += `</div>`;
    h += `<div class="actor-meta-row">`;
    h += `<span>${esc(panel.性别 || "—")} · ${esc(panel.种族)}</span>`;
    if (panel.位置)
        h += ` · 位置: <span class="warn">${esc(panel.位置)}</span>`;
    if (panel.称号)
        h += ` · 称号: <span class="ok">${esc(panel.称号)}</span>`;
    if (panel.头衔.length > 0)
        h += ` · 头衔: ${panel.头衔.map((t) => `<span class="ok">${esc(t)}</span>`).join(" ")}`;
    if (panel.业力 !== 0)
        h += ` · 业力: <span class="${panel.业力 > 0 ? "ok" : "err"}">${panel.业力}</span>`;
    h += `</div>`;
    if (panel.背景)
        h += `<div class="actor-bg dim">${esc(panel.背景)}</div>`;
    // 数值面
    h += `<div class="actor-section-h">数值</div>`;
    h += `<div class="attr-grid">`;
    for (const [k, v] of Object.entries(panel.attributes)) {
        h += `<div class="attr-cell"><div class="attr-name">${esc(k)}</div><div class="attr-val">${v}</div></div>`;
    }
    h += `</div>`;
    h += `<div class="actor-derived-row">`;
    h += `<div style="margin:2px 0">HP ${bar(panel.派生.HP, panel.派生.HP上限, "#3fb950")}<b>${panel.派生.HP}</b>/${panel.派生.HP上限}</div>`;
    h += `<div style="margin:2px 0">精力 ${bar(panel.派生.精力, panel.派生.精力上限, "#58a6ff")}<b>${panel.派生.精力}</b>/${panel.派生.精力上限}</div>`;
    h += `<div style="margin:2px 0">行动点 ${bar(panel.行动点.当前, panel.行动点.上限, "#d29922")}${panel.行动点.当前}/${panel.行动点.上限}</div>`;
    h += `<div style="margin:2px 0">颜值 ${bar(panel.派生.颜值, 100, "#bc8cff")}${panel.派生.颜值}</div>`;
    h += `</div>`;
    if (panel.声誉.知名度 > 0 || panel.声誉.人望 !== 0) {
        h += `<div class="actor-derived-row dim">声誉: 人望 ${signedBar(panel.声誉.人望)}${panel.声誉.人望} · 知名度 ${bar(panel.声誉.知名度, 100, "#d29922")}${panel.声誉.知名度}${panel.声誉.标签 ? ` [${esc(panel.声誉.标签)}]` : ""}</div>`;
    }
    // 性格五轴进度条
    h += `<div class="actor-section-h">性格五轴</div><div class="personality-grid">`;
    const axes = ["开放", "尽责", "外向", "宜人", "神经质"];
    for (const axis of axes) {
        const val = panel.性格五轴[axis];
        h += `<div class="personality-row">`;
        h += `<span class="personality-label">${esc(axis)}</span>`;
        h += `<div class="personality-bar-wrap"><div class="personality-bar" style="width:${val}%"></div></div>`;
        h += `<span class="personality-val dim">${val}</span>`;
        h += `</div>`;
    }
    h += `</div>`;
    // 货币
    const ccyEntries = Object.entries(panel.currencies);
    if (ccyEntries.length > 0) {
        h += `<div class="actor-section-h">货币</div>`;
        h += `<div class="actor-inline-row">${ccyEntries.map(([c, a]) => `<span class="ok">${a}${esc(c)}</span>`).join(" · ")}</div>`;
    }
    // 可见秘密（POV 过滤）
    h += `<div class="actor-section-h">可见秘密（POV 过滤·${panel.可见秘密ID.length} 条）</div>`;
    h +=
        panel.可见秘密ID.length > 0
            ? `<div class="actor-inline-row">${panel.可见秘密ID.map((id) => `<code class="ok">${esc(id)}</code>`).join(" ")}</div>`
            : `<div class="dim actor-inline-row">（POV 无可见秘密）</div>`;
    // 关系
    if (panel.关系.length > 0) {
        h += `<details class="actor-details"><summary class="actor-section-h">关系（${panel.关系.length}）</summary><div class="actor-list">`;
        for (const r of panel.关系) {
            const col = r.强度 > 0 ? "ok" : r.强度 < 0 ? "err" : "dim";
            const sc = ((Math.abs(r.强度) * r.信任) / 100).toFixed(1);
            h += `<div class="actor-list-item">→ <code>${esc(r.对象键)}</code> [<span class="warn">${esc(r.类型)}</span>] 强度 ${signedBar(r.强度)}<span class="${col}">${r.强度}</span> · 信任 ${bar(r.信任, 100, "#58a6ff", 60)}${r.信任} · score=${sc}</div>`;
        }
        h += `</div></details>`;
    }
    // 认知档案
    if (panel.认知概览.length > 0) {
        h += `<details class="actor-details"><summary class="actor-section-h">认知档案（观察者·${panel.认知概览.length} 目标）</summary><div class="actor-list">`;
        for (const c of panel.认知概览) {
            h += `<div class="actor-list-item">→ <code>${esc(c.目标键)}</code> 了解度 ${bar(c.了解度, 100, "#d29922", 70)}<span class="warn">${c.了解度}</span> 印象×${c.印象数} <span class="dim">[${esc(c.姓名知识)}]</span></div>`;
        }
        h += `</div></details>`;
    }
    // 情绪栈
    if (panel.情绪栈.length > 0) {
        h += `<details class="actor-details"><summary class="actor-section-h">情绪栈（${panel.情绪栈.length}）</summary><div class="actor-list">`;
        for (const e of panel.情绪栈) {
            const col = e.极性 === "正" ? "ok" : e.极性 === "负" ? "err" : "warn";
            h += `<div class="actor-list-item"><span class="${col}">${esc(e.情绪名)}</span> ${e.数值} <span class="dim">来源:${esc(e.来源)}</span></div>`;
        }
        h += `</div></details>`;
    }
    // 状态标签
    if (panel.状态标签.length > 0) {
        h += `<details class="actor-details"><summary class="actor-section-h">状态标签（${panel.状态标签.length}）</summary><div class="actor-list">`;
        for (const st of panel.状态标签) {
            h += `<div class="actor-list-item"><code class="warn">${esc(st.key)}</code> <span class="dim">${esc(st.来源)}</span></div>`;
        }
        h += `</div></details>`;
    }
    // 特质
    if (panel.特质.length > 0) {
        h += `<details class="actor-details"><summary class="actor-section-h">特质（${panel.特质.length}）</summary><div class="actor-list">`;
        for (const tr of panel.特质) {
            h += `<div class="actor-list-item"><code>${esc(tr.key)}</code> [${esc(tr.类别)}] 强度 ${tr.强度}</div>`;
        }
        h += `</div></details>`;
    }
    // 技能
    if (panel.技能.length > 0) {
        h += `<details class="actor-details"><summary class="actor-section-h">技能（${panel.技能.length}）</summary><div class="actor-list">`;
        for (const sk of panel.技能) {
            h += `<div class="actor-list-item"><code>${esc(sk.key)}</code> Lv${sk.等级} 熟练 <span class="ok">${sk.熟练度}</span> [${esc(sk.类别)}]</div>`;
        }
        h += `</div></details>`;
    }
    // 信念
    if (panel.信念.length > 0) {
        h += `<details class="actor-details"><summary class="actor-section-h">信念（${panel.信念.length}）</summary><div class="actor-list">`;
        for (const b of panel.信念) {
            h += `<div class="actor-list-item"><code>${esc(b.key)}</code> [${esc(b.类型)}] 虔诚 <span class="warn">${b.虔诚或认同}</span></div>`;
        }
        h += `</div></details>`;
    }
    // 物品
    if (panel.物品.length > 0) {
        h += `<details class="actor-details"><summary class="actor-section-h">物品（${panel.物品.length}）</summary><div class="actor-list">`;
        for (const it of panel.物品) {
            h += `<div class="actor-list-item"><code>${esc(it.key)}</code> ×${it.数量} [${esc(it.类别)}/${esc(it.重要级别)}]</div>`;
        }
        h += `</div></details>`;
    }
    // 目标
    if (panel.目标.长期.length > 0 || panel.目标.短期.length > 0) {
        h += `<details class="actor-details"><summary class="actor-section-h">目标</summary><div class="actor-list">`;
        if (panel.目标.长期.length > 0)
            h += `<div class="actor-list-item"><span class="dim">长期:</span> ${panel.目标.长期.map(esc).join(" · ")}</div>`;
        if (panel.目标.短期.length > 0)
            h += `<div class="actor-list-item"><span class="dim">短期:</span> ${panel.目标.短期.map(esc).join(" · ")}</div>`;
        h += `</div></details>`;
    }
    // 所属组织
    if (panel.所属组织.length > 0) {
        h += `<div class="actor-section-h">所属组织</div>`;
        h += `<div class="actor-inline-row">${panel.所属组织.map((o) => `<code>${esc(o.组织键)}</code> [${esc(o.职务)}]`).join(" · ")}</div>`;
    }
    // 记忆
    if (panel.记忆.length > 0) {
        h += `<details class="actor-details"><summary class="actor-section-h">记忆（${panel.记忆.length}）</summary><div class="actor-list">`;
        for (const m of panel.记忆) {
            h += `<div class="actor-list-item"><span class="dim">重${m.重要度}${m.情绪色彩 ? ` [${esc(m.情绪色彩)}]` : ""}</span> ${esc(m.摘要)}</div>`;
        }
        h += `</div></details>`;
    }
    // 意象
    if (panel.意象.length > 0) {
        h += `<details class="actor-details"><summary class="actor-section-h">意象（${panel.意象.length}）</summary><div class="actor-list">`;
        for (const img of panel.意象) {
            h += `<div class="actor-list-item"><span class="warn">${esc(img.标签)}</span> ${esc(img.情绪色彩)} 强度 ${img.强度}</div>`;
        }
        h += `</div></details>`;
    }
    // ── 富化批 P-A·UI：补全字段 ──────────────────────────────────────────────
    // 体征 · 介绍策略
    {
        const t = panel.体征;
        if (t.身高 || t.体重 || t.体型标签 || panel.介绍策略) {
            const segs = [];
            if (t.身高)
                segs.push(`身高 ${t.身高}cm`);
            if (t.体重)
                segs.push(`体重 ${t.体重}kg`);
            if (t.BMI)
                segs.push(`BMI ${t.BMI}`);
            if (t.体型标签)
                segs.push(`体型 ${esc(t.体型标签)}`);
            if (panel.介绍策略)
                segs.push(`介绍策略 <span class="warn">${esc(panel.介绍策略)}</span>`);
            h += `<div class="actor-section-h">体征 · 介绍策略</div><div class="actor-inline-row dim">${segs.join(" · ")}</div>`;
        }
    }
    // 职务 · 局部权力
    if (panel.职务详.length > 0) {
        h += `<div class="actor-section-h">职务 · 局部权力</div><div class="actor-list">`;
        for (const j of panel.职务详) {
            h += `<div class="actor-list-item"><code>${esc(j.组织节点键)}</code> ${esc(j.职务名)} · 权力 <span class="ok">${j.局部权力值}</span></div>`;
        }
        h += `</div>`;
    }
    // 🔒 忠诚双层 — debug spoiler（真值/伪装度/表象 并列）
    if (panel.忠诚.length > 0) {
        h += `<div class="actor-section-h">🔒 忠诚双层 · debug spoiler</div>`;
        h += `<div class="pov-two-col-header" style="display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;gap:4px;font-size:11px;color:#8b949e;padding:2px 4px"><span>对象</span><span>真值($)</span><span>伪装度</span><span>对外表象</span></div>`;
        for (const l of panel.忠诚) {
            h += `<div class="pov-two-col-row" style="display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;gap:4px;padding:2px 4px;border-top:1px solid #21262d">`;
            h += `<code>${esc(l.对象键)}</code>`;
            h += `<span class="pov-spoiler" style="color:#f85149;font-weight:600">${l.真实值}</span>`;
            h += `<span class="warn">${l.伪装度}</span>`;
            h += `<span class="dim">${l.表象}</span>`;
            h += `</div>`;
        }
        h += `<div class="helper-text" style="font-size:10px">真值=$真实值（引擎维护·AI 不可见）；表象≈真值向中性靠拢 by 伪装度（debug 近似·真实模糊化由认知投影现算）</div>`;
    }
    // 🔒 认知误差表 + 印象明细（观察者→目标·debug spoiler）
    if (panel.认知明细.length > 0) {
        h += `<details class="actor-details"><summary class="actor-section-h">🔒 认知误差表 · 印象明细（${panel.认知明细.length} 目标·debug spoiler）</summary><div class="actor-list">`;
        for (const c of panel.认知明细) {
            h += `<div class="actor-list-item">→ <code>${esc(c.目标键)}</code> 了解度 ${bar(c.了解度, 100, "#d29922", 70)}<span class="warn">${c.了解度}</span> <span class="dim">[${esc(c.姓名知识)}]</span>`;
            if (c.误差表.length > 0) {
                h +=
                    ` · 误差: ` +
                        c.误差表
                            .map((e) => `${esc(e.字段)}<span class="pov-spoiler" style="color:#f85149">${e.偏差 >= 0 ? "+" : ""}${e.偏差}</span>`)
                            .join(" ");
            }
            for (const im of c.印象) {
                h += `<div style="padding-left:14px" class="dim">· ${esc(im.标签)} [${esc(im.极性)}/${im.强度}] 来源 ${esc(im.来源)}${im.来源类型 ? `(${esc(im.来源类型)})` : ""}</div>`;
            }
            h += `</div>`;
        }
        h += `</div></details>`;
    }
    // 爱好
    if (panel.爱好.length > 0) {
        h += `<details class="actor-details"><summary class="actor-section-h">爱好（${panel.爱好.length}）</summary><div class="actor-list">`;
        for (const hb of panel.爱好) {
            h += `<div class="actor-list-item"><code>${esc(hb.key)}</code> [${esc(hb.类别)}/${esc(hb.极性)}] 投入 ${bar(hb.投入度, 100, "#3fb950", 60)}${hb.投入度} <span class="dim">${esc(hb.状态)}${hb.描述 ? "·" + esc(hb.描述) : ""}</span></div>`;
        }
        h += `</div></details>`;
    }
    // 案底
    if (panel.案底 &&
        (panel.案底.状态 !== "清白" || panel.案底.记录.length > 0)) {
        const cls = panel.案底.状态 === "案底"
            ? "err"
            : panel.案底.状态 === "过期"
                ? "warn"
                : "dim";
        h += `<details class="actor-details"><summary class="actor-section-h">案底 · <span class="${cls}">${esc(panel.案底.状态)}</span>（${panel.案底.记录.length}）</summary><div class="actor-list">`;
        for (const r of panel.案底.记录) {
            h += `<div class="actor-list-item"><span class="err">${esc(r.类型)}</span> 严重度 ${r.严重度} <span class="dim">@${r.时间}</span></div>`;
        }
        h += `</div></details>`;
    }
    // 既往记忆种子
    if (panel.既往记忆种子.length > 0) {
        h += `<details class="actor-details"><summary class="actor-section-h">既往记忆种子（${panel.既往记忆种子.length}）</summary><div class="actor-list">`;
        for (const s of panel.既往记忆种子) {
            h += `<div class="actor-list-item"><span class="dim">[${esc(s.发生时间_约)}·重${s.重要度}${s.情绪色彩 ? "·" + esc(s.情绪色彩) : ""}]</span> ${esc(s.摘要)}</div>`;
        }
        h += `</div></details>`;
    }
    return h;
}
// ── Tab: 🌍 世界（富化批 P-A·UI·历法/经济/战役/区域物价/地点详情） ─────────────
function renderWorldTab() {
    const w = buildWorldPanel(S.state);
    let html = `<div class="tab-content">`;
    // 历法 / 时间
    const c = w.时钟;
    html += `<div class="section"><h2>🕛 世界历法 · 时间</h2>`;
    html += `<div class="actor-meta-row"><span class="ok" style="font-size:16px">${esc(c.显示)}</span></div>`;
    html += `<div class="actor-inline-row dim">纪元分钟 ${c.纪元分钟} · ${esc(c.纪年法)}${c.年号 ? "·" + esc(c.年号) : ""} · 粒度 ${esc(c.当前粒度)} · 周期 ${c.周期数} · 本拍跨度 ${c.本拍跨度}min · ${esc(c.年代背景)}${c.气候带 ? "·" + esc(c.气候带) : ""}</div>`;
    html += `</div>`;
    // 经济
    const e = w.经济;
    html += `<div class="section"><h2>💰 经济</h2>`;
    html += `<div class="actor-section-h">市场状态</div><div class="actor-inline-row">激活 ${e.市场.激活 ? '<span class="ok">是</span>' : '<span class="dim">否</span>'} · 大盘景气 ${bar(e.市场.大盘景气, 100, "#3fb950", 80)}${e.市场.大盘景气} · 通胀率 ${e.市场.通胀率} · 基准利率 ${e.市场.基准利率}${e.市场.时代风波 ? ` · <span class="warn">${esc(e.市场.时代风波)}</span>` : ""}</div>`;
    if (e.市场.行业景气.length > 0) {
        html += `<div class="actor-inline-row dim">行业景气: ${e.市场.行业景气.map((x) => `${esc(x.行业)} ${bar(x.值, 100, "#58a6ff", 50)}${x.值}`).join(" · ")}</div>`;
    }
    html += `<div class="actor-section-h">币种 · 汇率（基准 ${esc(e.基准币种)}）</div><div class="actor-inline-row">${e.币种.map((x) => `<code>${esc(x.符号 || x.key)}</code> ${esc(x.名称)}[${esc(x.类型)}] ×${x.对基准汇率}`).join(" · ") || '<span class="dim">（无）</span>'}</div>`;
    html += `<div class="actor-section-h">账户 · 资产（${e.账户.length}）</div>`;
    for (const a of e.账户) {
        html += `<div class="actor-list-item"><code>${esc(a.实体)}</code> 持有 ${a.持有.map((x) => `${x.额}${esc(x.币)}`).join(" / ") || "—"}${a.储蓄.length ? ` · 储蓄 ${a.储蓄.map((x) => `${x.额}${esc(x.币)}`).join(" / ")}` : ""}`;
        if (a.资产.length > 0) {
            html += `<div style="padding-left:14px" class="dim">${a.资产.map((z) => `${esc(z.标的)}[${esc(z.类别)}] ×${z.数量} 成本${z.成本价}/现价${z.现价}${z.杠杆 ? `·杠杆${z.杠杆}x` : ""}`).join("<br>")}</div>`;
        }
        html += `</div>`;
    }
    html += `</div>`;
    // 战役
    html += `<div class="section"><h2>⚔️ 战役（${w.战役.length}）</h2>`;
    if (w.战役.length === 0)
        html += `<div class="dim">（无战役）</div>`;
    for (const b of w.战役) {
        html += `<div class="actor-list-item"><code class="err">${esc(b.key)}</code> [${esc(b.所属战争键)}] 态势 <span class="warn">${esc(b.态势)}</span> · 交战方 ${b.交战方.map(esc).join(" vs ")} · 起拍#${b.起拍}`;
        for (const z of b.争夺区域) {
            html += `<div style="padding-left:14px" class="dim">▸ ${esc(z.区域id)} 控制方 <span class="ok">${esc(z.当前控制方)}</span> · 压力榜 ${z.压力榜.map((p) => `${esc(p.阵营键)}:${p.压力值}`).join(" / ")}</div>`;
        }
        html += `</div>`;
    }
    html += `</div>`;
    // 区域物价
    html += `<div class="section"><h2>🏷️ 区域物价（${w.区域物价.length} 区域）</h2>`;
    if (w.区域物价.length === 0)
        html += `<div class="dim">（无）</div>`;
    for (const r of w.区域物价) {
        html += `<div class="actor-list-item"><code>${esc(r.区域)}</code>: ${r.品类.map((p) => `${esc(p.品类)} 基准${p.基准价} ${signedBar(p.供需, 100, 50)}<span class="${p.供需 > 0 ? "ok" : p.供需 < 0 ? "err" : "dim"}">(供需${p.供需 >= 0 ? "+" : ""}${p.供需})</span>`).join(" · ")}</div>`;
    }
    html += `</div>`;
    // 地点详情
    html += `<div class="section"><h2>📍 地点详情（${w.地点.length}）</h2>`;
    html += `<table class="map-table"><thead><tr><th>键</th><th>名称</th><th>类别</th><th>地形</th><th>控制方</th><th>社交</th><th>危险</th><th>探索</th><th>容量</th></tr></thead><tbody>`;
    for (const l of w.地点) {
        html += `<tr><td><code>${esc(l.key)}</code></td><td>${esc(l.名称)}</td><td>${esc(l.类别)}</td><td>${esc(l.地形)}</td><td>${esc(l.控制方) || "—"}</td><td>${esc(l.社交开放度)}</td><td>${esc(l.危险度)}</td><td>${bar(l.探索度, 100, "#3fb950", 50)}${l.探索度}</td><td>${l.容量 ?? "—"}</td></tr>`;
    }
    html += `</tbody></table>`;
    for (const l of w.地点) {
        const hasDetail = l.产出.L1.length || l.产出.L2.length || l.产出.L3.length || l.相邻.length;
        if (!hasDetail)
            continue;
        html += `<details class="actor-details"><summary class="actor-section-h">${esc(l.名称)} · 产出·拓扑</summary><div class="actor-list">`;
        html += `<div class="actor-list-item dim">结构 ${esc(l.结构) || "—"} · 状态 ${esc(l.状态) || "—"} · 人口 ${esc(l.人口规模) || "—"} · 营业 ${esc(l.营业时间) || "—"} · 可达 ${esc(l.可达性)}</div>`;
        if (l.产出.L1.length)
            html += `<div class="actor-list-item">L1 产业氛围: ${l.产出.L1.map(esc).join("·")}</div>`;
        for (const o of l.产出.L2)
            html += `<div class="actor-list-item">L2 ${esc(o.物品名)} <span class="dim">${esc(o.获取方式)}·${esc(o.稀有度)}${o.季节 ? "·" + esc(o.季节) : ""}</span></div>`;
        for (const rr of l.产出.L3)
            html += `<div class="actor-list-item">L3 <span class="warn">${esc(rr.资源大类)}</span> 储量${esc(rr.储量档)}·开采${rr.开采度}·产能${esc(rr.产能)}</div>`;
        if (l.相邻.length)
            html += `<div class="actor-list-item dim">相邻: ${l.相邻.map((n) => `${esc(n.目标)}${n.方式 ? `(${esc(n.方式)}${n.距离 != null ? "·" + n.距离 : ""})` : ""}`).join(" · ")}</div>`;
        html += `</div></details>`;
    }
    html += `</div>`;
    html += `</div>`;
    return html;
}
function renderTreeNode(node, depth = 0) {
    if (!node.children || node.children.length === 0) {
        const val = node.value !== undefined
            ? `: <span class="ok">${esc(String(node.value))}</span>`
            : "";
        return `<div class="tree-leaf">${esc(node.label)}${val}</div>`;
    }
    const open = !node.collapsed || depth === 0 ? " open" : "";
    const children = node.children
        .map((c) => renderTreeNode(c, depth + 1))
        .join("");
    return `<details${open}><summary>${esc(node.label)}</summary><div class="tree-body">${children}</div></details>`;
}
// ── 主渲染器 ──────────────────────────────────────────────────────────────────
function renderApp() {
    const app = document.getElementById("app");
    if (!app)
        return;
    let tabContent = "";
    switch (S.activeTab) {
        case "menu":
            tabContent = renderMenuTab();
            break;
        case "time":
            tabContent = renderTimeTab();
            break;
        case "graph":
            tabContent = renderGraphTab();
            break;
        case "pov":
            tabContent = renderPOVTab();
            break;
        case "snapshot":
            tabContent = renderSnapshotTab();
            break;
        case "tree":
            tabContent = renderTreeTab();
            break;
        case "世界":
            tabContent = renderWorldTab();
            break;
    }
    app.innerHTML = renderHeader() + renderTabBar() + tabContent;
    attachEventListeners();
    // S.povEntityKey と S.operatorKey は常に同値のため pov-entity-sel の value 同期のみ行う。
    // (ブラウザのフォーム復元による selected 属性上書き防止)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const _app = app;
    const _povEntityEl = _app?.querySelector?.("#pov-entity-sel");
    if (_povEntityEl)
        _povEntityEl.value = S.povEntityKey;
}
// ── 事件绑定 ──────────────────────────────────────────────────────────────────
function attachEventListeners() {
    // fixture 切换
    document.getElementById("fixture-sel")?.addEventListener("change", (e) => {
        switchFixture(e.target.value);
        renderApp();
    });
    // tab 切换
    document.querySelectorAll(".tab-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            S.activeTab = btn.dataset["tab"];
            renderApp();
        });
    });
    // 菜单检视
    document.getElementById("btn-inspect-menu")?.addEventListener("click", () => {
        S.lastMenu = inspectMenu(S.state, S.operatorKey, S.rawCandidates);
        renderApp();
    });
    // permitted 选项点击 → runValidationChain → runTickWithDiff + runActionInDualMode
    document.querySelectorAll("[data-run-option]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const optId = btn.dataset["runOption"];
            S.validInput = optId;
            S.lastNarrative = null;
            S.narrativeLoading = false;
            S.lastChain = runValidationChain(optId, S.state, S.operatorKey, S.rawCandidates);
            if (S.lastChain.passed) {
                S.prevGraph = buildRelationGraph(S.state);
                // 捕获 pre-tick 状态用于叙事组装（assemblePrompt 需要行动前的世界）
                const preTick = S.state;
                const tid = `debug:${S.seed}:tick:${S.state._tick?.拍计数 ?? S.diffs.length}`;
                const diff = runTickWithDiff(preTick, tid);
                S.diffs = [...S.diffs.slice(-(MAX_DIFFS - 1)), diff];
                S.state = diff.afterState;
                S.recorder?.record(optId);
                S.recActions = [...S.recActions, optId];
                // 异步叙事生成（校验已通过·走合法路径）
                S.narrativeLoading = true;
                renderApp();
                runActionInDualMode(preTick, S.operatorKey, optId, S.rawCandidates, S.llmMode, {
                    forceFailure: S.forceFailure,
                    narrativePerson: S.narrativePerson,
                    narrativeStyle: S.narrativeStyle,
                })
                    .then((result) => {
                    S.lastNarrative = result;
                    S.narrativeLoading = false;
                    renderApp();
                })
                    .catch((err) => {
                    console.error("[G1b3c] runActionInDualMode error:", err);
                    S.lastNarrative = {
                        narrative: `[叙事生成异常] ${err instanceof Error ? err.message : String(err)}`,
                        isFallback: true,
                        optionId: optId,
                        usedDefault: false,
                    };
                    S.narrativeLoading = false;
                    renderApp();
                });
                return;
            }
            renderApp();
        });
    });
    // 校验链输入
    const optInput = document.getElementById("opt-input");
    optInput?.addEventListener("input", () => {
        S.validInput = optInput.value;
    });
    document.getElementById("btn-validate")?.addEventListener("click", () => {
        const val = document.getElementById("opt-input")
            ?.value ?? "";
        S.validInput = val;
        if (val) {
            S.lastChain = runValidationChain(val, S.state, S.operatorKey, S.rawCandidates);
            renderApp();
        }
    });
    // 快速测试按钮
    document.querySelectorAll("[data-quick]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const optId = btn.dataset["quick"];
            S.validInput = optId;
            S.lastChain = runValidationChain(optId, S.state, S.operatorKey, S.rawCandidates);
            renderApp();
        });
    });
    // 旋钮① 每拍跨度 preset 按钮
    Object.keys(SPAN_PRESET_LABELS).forEach((preset) => {
        document
            .getElementById(`span-preset-${preset}`)
            ?.addEventListener("click", () => {
            S.tickSpanPreset = preset;
            renderApp();
        });
    });
    // 自定义跨度数量 / 单位
    document
        .getElementById("span-custom-qty")
        ?.addEventListener("change", (e) => {
        const v = parseFloat(e.target.value);
        if (!isNaN(v) && v > 0)
            S.tickSpanCustomQty = v;
        renderApp();
    });
    document
        .getElementById("span-custom-unit")
        ?.addEventListener("change", (e) => {
        S.tickSpanCustomUnit = e.target.value;
        renderApp();
    });
    // 旋钮② 流速按钮
    document.getElementById("btn-speed-stop")?.addEventListener("click", () => {
        stopAutoPlay();
        renderApp();
    });
    AUTO_PLAY_SPEEDS.forEach((s) => {
        const btnId = `btn-speed-${String(s).replace(".", "_")}`;
        document.getElementById(btnId)?.addEventListener("click", () => {
            startAutoPlay(s);
            renderApp();
        });
    });
    // 时间控制
    document.getElementById("btn-step1")?.addEventListener("click", () => {
        if (!S.timeCtrl)
            return;
        const span = currentSpanMinutes();
        S.prevGraph = buildRelationGraph(S.state);
        const diffs = S.timeCtrl.step(1, span);
        S.state = S.timeCtrl.getCurrentState();
        S.diffs = [...S.diffs.slice(-(MAX_DIFFS - diffs.length)), ...diffs];
        renderApp();
    });
    document.getElementById("btn-step5")?.addEventListener("click", () => {
        if (!S.timeCtrl)
            return;
        const span = currentSpanMinutes();
        S.prevGraph = buildRelationGraph(S.state);
        const diffs = S.timeCtrl.step(5, span);
        S.state = S.timeCtrl.getCurrentState();
        S.diffs = [...S.diffs.slice(-(MAX_DIFFS - diffs.length)), ...diffs];
        renderApp();
    });
    document.getElementById("btn-stepn")?.addEventListener("click", () => {
        if (!S.timeCtrl)
            return;
        const span = currentSpanMinutes();
        S.prevGraph = buildRelationGraph(S.state);
        const n = parseInt(document.getElementById("step-n")?.value ??
            "1", 10);
        const diffs = S.timeCtrl.step(Math.max(1, Math.min(50, n)), span);
        S.state = S.timeCtrl.getCurrentState();
        S.diffs = [...S.diffs.slice(-(MAX_DIFFS - diffs.length)), ...diffs];
        renderApp();
    });
    document.getElementById("btn-jump")?.addEventListener("click", () => {
        if (!S.timeCtrl)
            return;
        const target = parseInt(document.getElementById("jump-tick")
            ?.value ?? "0", 10);
        S.state = S.timeCtrl.jumpTo(Math.max(0, target));
        renderApp();
    });
    document.getElementById("btn-replay")?.addEventListener("click", () => {
        if (!S.timeCtrl)
            return;
        stopAutoPlay();
        S.state = S.timeCtrl.replay();
        S.diffs = [];
        S.prevGraph = null;
        renderApp();
    });
    // LLM 模式
    document.getElementById("btn-llm-demo")?.addEventListener("click", () => {
        S.llmMode = "demo";
        renderApp();
    });
    document.getElementById("btn-llm-real")?.addEventListener("click", () => {
        S.llmMode = "llm";
        renderApp();
    });
    document.getElementById("btn-force-fail")?.addEventListener("click", () => {
        S.forceFailure = !S.forceFailure;
        renderApp();
    });
    // 叙事渲染参数（人称 + 文风）
    document
        .getElementById("narrative-person-sel")
        ?.addEventListener("change", (e) => {
        S.narrativePerson = sanitizePerson(e.target.value);
        // demo 模式：立即重生成脚本叙事（无 LLM 调用·确定性）
        if (S.llmMode === "demo" && S.lastNarrative) {
            const pcName = S.state.NPC?.[S.operatorKey]
                ?.姓名 ?? S.operatorKey;
            S.lastNarrative = {
                ...S.lastNarrative,
                narrative: buildScriptedNarrative(S.narrativePerson, S.narrativeStyle, pcName, S.lastNarrative.optionId),
            };
        }
        renderApp();
    });
    document
        .getElementById("narrative-style-sel")
        ?.addEventListener("change", (e) => {
        S.narrativeStyle = sanitizeStyle(e.target.value);
        // demo 模式：立即重生成脚本叙事
        if (S.llmMode === "demo" && S.lastNarrative) {
            const pcName = S.state.NPC?.[S.operatorKey]
                ?.姓名 ?? S.operatorKey;
            S.lastNarrative = {
                ...S.lastNarrative,
                narrative: buildScriptedNarrative(S.narrativePerson, S.narrativeStyle, pcName, S.lastNarrative.optionId),
            };
        }
        renderApp();
    });
    // POV / 操纵主体切换（pov-entity-sel = 操纵主体切换·povEntityKey と operatorKey を恒等同期）
    // 切換時に rawCandidates を再構築：NPC 自身を候補から除外し在場 NPC との対話を生成
    document.getElementById("pov-entity-sel")?.addEventListener("change", (e) => {
        const val = e.target.value;
        S.povEntityKey = val;
        S.operatorKey = val;
        S.rawCandidates = buildCandidatesForOperator(val);
        S.lastMenu = null;
        S.lastChain = null;
        S.lastNarrative = null;
        S.lastFreeTextResult = null;
        renderApp();
    });
    // 重置为默认 PC（povEntityKey / operatorKey / rawCandidates 同時歸位）
    document
        .getElementById("btn-reset-operator")
        ?.addEventListener("click", () => {
        S.povEntityKey = S.pcKey;
        S.operatorKey = S.pcKey;
        S.rawCandidates = buildCandidatesForOperator(S.pcKey);
        S.lastMenu = null;
        S.lastChain = null;
        S.lastNarrative = null;
        S.lastFreeTextResult = null;
        renderApp();
    });
    // POV 并排比对（二级·A/B·只读）
    document.getElementById("pov-a-sel")?.addEventListener("change", (e) => {
        S.povA = e.target.value;
        renderApp();
    });
    document.getElementById("pov-b-sel")?.addEventListener("change", (e) => {
        S.povB = e.target.value;
        renderApp();
    });
    document
        .getElementById("btn-pov-compare")
        ?.addEventListener("click", () => renderApp());
    // 快照
    document.getElementById("btn-snap-save")?.addEventListener("click", () => {
        const label = document.getElementById("snap-label")
            ?.value ?? "snap";
        S.snapshotLabel = label;
        S.snapshotStore.save(label, S.state, {
            narrativePerson: S.narrativePerson,
            narrativeStyle: S.narrativeStyle,
        });
        renderApp();
    });
    document.getElementById("snap-sel-a")?.addEventListener("change", (e) => {
        S.snapSelA = e.target.value;
    });
    document.getElementById("snap-sel-b")?.addEventListener("change", (e) => {
        S.snapSelB = e.target.value;
    });
    document.getElementById("btn-snap-compare")?.addEventListener("click", () => {
        S.snapSelA =
            document.getElementById("snap-sel-a")
                ?.value ?? "";
        S.snapSelB =
            document.getElementById("snap-sel-b")
                ?.value ?? "";
        renderApp();
    });
    // 记录器
    document.getElementById("btn-rec-reset")?.addEventListener("click", () => {
        S.recorder = new ActionRecorder(S.seed, S.state);
        S.recActions = [];
        renderApp();
    });
    document.getElementById("btn-rec-replay")?.addEventListener("click", () => {
        if (!S.recorder)
            return;
        const replayState = S.recorder.replay();
        const orig = S.recorder.getCurrentState();
        const ok = JSON.stringify(replayState) === JSON.stringify(orig);
        alert(`重放完成 · 逐位恒等: ${ok ? "✅ YES" : "❌ NO"}`);
    });
    // 自由文本输入（Feature B）
    document.getElementById("free-text-input")?.addEventListener("input", (e) => {
        S.freeText = e.target.value;
    });
    document.getElementById("btn-free-submit")?.addEventListener("click", () => {
        const text = S.freeText.trim();
        if (!text)
            return;
        S.lastFreeTextResult = null;
        S.freeTextLoading = true;
        renderApp();
        const menu = S.lastMenu ?? inspectMenu(S.state, S.operatorKey, S.rawCandidates);
        const { optionId, matchType } = tryMapToOptionId(text, menu.menuWithIds);
        if (optionId) {
            const chain = runValidationChain(optionId, S.state, S.operatorKey, S.rawCandidates);
            if (chain.passed) {
                S.prevGraph = buildRelationGraph(S.state);
                const preTick = S.state;
                const tid = `debug:${S.seed}:free:${S.diffs.length}`;
                const diff = runTickWithDiff(preTick, tid);
                S.diffs = [...S.diffs.slice(-(MAX_DIFFS - 1)), diff];
                S.state = diff.afterState;
                S.recorder?.record(optionId);
                S.recActions = [...S.recActions, optionId];
                runActionInDualMode(preTick, S.operatorKey, optionId, S.rawCandidates, S.llmMode, {
                    forceFailure: S.forceFailure,
                    narrativePerson: S.narrativePerson,
                    narrativeStyle: S.narrativeStyle,
                })
                    .then((narrative) => {
                    S.lastFreeTextResult = {
                        input: text,
                        matchedOptionId: optionId,
                        matchType,
                        isRpOnly: false,
                        chain,
                        diff,
                        narrative,
                    };
                    S.freeTextLoading = false;
                    renderApp();
                })
                    .catch((err) => {
                    const narrative = {
                        narrative: `[异常] ${err instanceof Error ? err.message : String(err)}`,
                        isFallback: true,
                        optionId,
                        usedDefault: false,
                    };
                    S.lastFreeTextResult = {
                        input: text,
                        matchedOptionId: optionId,
                        matchType,
                        isRpOnly: false,
                        chain,
                        diff,
                        narrative,
                    };
                    S.freeTextLoading = false;
                    renderApp();
                });
            }
            else {
                const narrative = {
                    narrative: "",
                    isFallback: false,
                    optionId,
                    usedDefault: false,
                };
                S.lastFreeTextResult = {
                    input: text,
                    matchedOptionId: optionId,
                    matchType,
                    isRpOnly: false,
                    chain,
                    diff: null,
                    narrative,
                };
                S.freeTextLoading = false;
                renderApp();
            }
        }
        else {
            const preTick = S.state;
            const rpOpts = S.llmMode === "demo"
                ? {
                    scriptedNarrative: text,
                    narrativePerson: S.narrativePerson,
                    narrativeStyle: S.narrativeStyle,
                }
                : {
                    narrativePerson: S.narrativePerson,
                    narrativeStyle: S.narrativeStyle,
                };
            runActionInDualMode(preTick, S.operatorKey, "__rp_only__", S.rawCandidates, S.llmMode, rpOpts)
                .then((narrative) => {
                S.lastFreeTextResult = {
                    input: text,
                    matchedOptionId: null,
                    matchType: "none",
                    isRpOnly: true,
                    chain: null,
                    diff: null,
                    narrative,
                };
                S.freeTextLoading = false;
                renderApp();
            })
                .catch((err) => {
                const narrative = {
                    narrative: `[异常] ${err instanceof Error ? err.message : String(err)}`,
                    isFallback: true,
                    optionId: "__rp_only__",
                    usedDefault: false,
                };
                S.lastFreeTextResult = {
                    input: text,
                    matchedOptionId: null,
                    matchType: "none",
                    isRpOnly: true,
                    chain: null,
                    diff: null,
                    narrative,
                };
                S.freeTextLoading = false;
                renderApp();
            });
        }
    });
    // 涟漪传播路径开关
    document
        .getElementById("btn-toggle-ripple")
        ?.addEventListener("click", () => {
        S.showRipple = !S.showRipple;
        renderApp();
    });
    // 拍 diff 选择器（时间控制 tab·查看任意拍与上一拍差异）
    document.getElementById("diff-tick-sel")?.addEventListener("change", (e) => {
        const v = e.target.value;
        S.selectedDiffTick = v || null;
        renderApp();
    });
}
// ── 启动 ──────────────────────────────────────────────────────────────────────
window.addEventListener("unhandledrejection", (e) => {
    console.error("[G1b3c] 未处���异常:", e.reason);
});
document.addEventListener("DOMContentLoaded", () => {
    renderApp();
});
