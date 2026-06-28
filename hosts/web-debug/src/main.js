// G1b3c · AOHP 调试控制台 · 浏览器入口 C1
// 铁律: 全部 UI 层 · 不进指纹 · core 函数体零 diff
// 只经 aohpDebugConsole / aohpDebugConsole2 合法 API 驱动
// 禁旁路校验闸 · 禁私写 core state · 确定性六禁全套
import { inspectMenu, runValidationChain, runTickWithDiff, runActionInDualMode, TimeController, DEMO_RAW_CANDIDATES, PHASE6_THRESHOLD, resolveSpanMinutes, formatSpanDisplay, SPAN_PRESET_LABELS, UNIT_LABELS, } from '../aohpDebugConsole.js';
import { PERSON_DEFAULT, STYLE_DEFAULT, STYLE_LABELS, PERSON_LABELS, sanitizePerson, sanitizeStyle, buildScriptedNarrative, } from '../narrativeStyle.js';
import { buildRelationGraph, buildStateTree, buildMapThumbnail, buildIncrementalView, povInspect, comparePOVs, ActionRecorder, SnapshotStore, groupNodesByLocation, buildEdgeDelta, buildActorPanel, computePovPersonalityProjection, } from '../aohpDebugConsole2.js';
import { getDebugFixture, DEBUG_FIXTURES, } from '../fixtures/debugFixtures.js';
import { buildWorld, PC, NPC_WANG, SAVE_SEED } from '../../slice/fixture/world.js';
// ── 应用全局状态 ──────────────────────────────────────────────────────────────
/** 最大保存的 diff 条数（防内存膨胀） */
const MAX_DIFFS = 50;
const S = {
    fixtureId: 'base',
    state: buildWorld(),
    pcKey: PC,
    seed: SAVE_SEED,
    rawCandidates: DEMO_RAW_CANDIDATES,
    timeCtrl: null,
    recorder: null,
    snapshotStore: new SnapshotStore(),
    diffs: [],
    prevGraph: null,
    llmMode: 'demo',
    forceFailure: false,
    activeTab: 'menu',
    povA: PC,
    povB: NPC_WANG,
    validInput: '',
    lastChain: null,
    lastMenu: null,
    lastNarrative: null,
    narrativeLoading: false,
    snapshotLabel: 'snap0',
    snapSelA: '',
    snapSelB: '',
    recActions: [],
    operatorKey: PC,
    freeText: '',
    lastFreeTextResult: null,
    freeTextLoading: false,
    narrativePerson: PERSON_DEFAULT,
    narrativeStyle: STYLE_DEFAULT,
    tickSpanPreset: '1day',
    tickSpanCustomQty: 1,
    tickSpanCustomUnit: 'day',
    autoPlaySpeed: null,
    autoPlayTimer: null,
    povEntityKey: PC,
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
    if (id === 'base') {
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
        S.pcKey = npcKeys[0] ?? 'unknown';
        S.povA = npcKeys[0] ?? '';
        S.povB = npcKeys[1] ?? '';
    }
    S.snapshotStore = new SnapshotStore();
    S.diffs = [];
    S.prevGraph = null;
    S.lastChain = null;
    S.lastMenu = null;
    S.lastNarrative = null;
    S.recActions = [];
    S.snapSelA = '';
    S.snapSelB = '';
    S.operatorKey = S.pcKey;
    S.povEntityKey = S.pcKey;
    // operatorKey 確定後に候補を再構築（NPC 自身を候補から除外・在場者のみ対象）
    S.rawCandidates = buildCandidatesForOperator(S.pcKey);
    S.freeText = '';
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
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
// ── 渲染：头部 + Tab 栏 ───────────────────────────────────────────────────────
function renderHeader() {
    const npcCount = Object.keys(S.state.NPC).length;
    const locCount = Object.keys(S.state.地图?.地点 ?? {}).length;
    const tickCount = S.state._tick?.拍计数 ?? 0;
    return `
<header class="app-header">
  <h1>AOHP 调试控制台 · G1b3c</h1>
  <div class="fixture-bar">
    <label>场景:
      <select id="fixture-sel">
        ${['base', '小城', '大陆', '整世界'].map(id => `<option value="${esc(id)}"${id === S.fixtureId ? ' selected' : ''}>${esc(fixtureLabel(id))}</option>`).join('')}
      </select>
    </label>
    <span class="fixture-info">
      NPC:${npcCount} · 地点:${locCount} · 种子:${S.seed} · tick:${tickCount} · 观察者:${esc(S.pcKey)}${S.operatorKey !== S.pcKey ? ` · <span style="color:#d29922">操纵者:${esc(S.operatorKey)}</span>` : ''}
    </span>
  </div>
</header>`;
}
function fixtureLabel(id) {
    const map = {
        'base': '基础世界 (seed=42, buildWorld)',
        '小城': '小城·玉华镇 (seed=100, 3 NPC)',
        '大陆': '大陆·金陵商路 (seed=200, 6 NPC)',
        '整世界': '整世界·五域图 (seed=300, 12 NPC)',
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
    if (S.fixtureId === 'base' && operatorKey === S.pcKey) {
        return DEMO_RAW_CANDIDATES;
    }
    const opLoc = S.state.NPC[operatorKey]?.位置 ?? '';
    return Object.entries(S.state.NPC)
        .filter(([k, npc]) => k !== operatorKey && npc.位置 === opLoc)
        .map(([k, npc]) => ({
        verb: '对话',
        targetEntityId: k,
        displayText: `与${npc.姓名 ?? k}对话`,
    }));
}
function renderTabBar() {
    const tabs = [
        ['menu', '菜单·校验'],
        ['time', '时间控制'],
        ['graph', '关系网'],
        ['pov', 'POV视角'],
        ['snapshot', '快照·回放'],
        ['tree', '状态树·地图'],
    ];
    return `<div class="tab-bar">${tabs.map(([id, label]) => `<button class="tab-btn${id === S.activeTab ? ' active' : ''}" data-tab="${id}">${esc(label)}</button>`).join('')}</div>`;
}
// ── Tab: 菜单·校验 ───────────────────────────────────────────────────────────
function renderMenuTab() {
    const menuHtml = renderMenuSection();
    const chainHtml = renderChainSection();
    const freeTextHtml = renderFreeTextSection();
    const hasDiff = S.diffs.length > 0;
    const hasNarrative = S.lastNarrative !== null || S.narrativeLoading;
    const bottomHtml = (hasDiff || hasNarrative)
        ? `<div class="section"><h2>当拍结果：State Diff · 叙事·出字</h2><div class="diff-narrative-grid">${hasDiff ? renderLatestDiffPanel() : '<div class="diff-col"><span class="dim">（尚无拍记录）</span></div>'}${renderNarrativePanel()}</div></div>`
        : '';
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
            inner += `  [${esc(o.option_id)}]  ${esc(o.displayText ?? '')}\n`;
        }
        inner += `\n<span class="dim">── 过滤结果 permitted=${r.filterResult.permitted.length} / denied=${r.filterResult.denied.length} ──</span>\n`;
        for (const p of r.filterResult.permitted) {
            inner += `  <span class="ok">✅ permitted: ${esc(p.displayText ?? p.verb)}</span>\n`;
        }
        for (const d of r.filterResult.denied) {
            const dr = r.deniedReasons.find(x => x.secretRef === d.secretRef);
            inner += `  <span class="err">❌ denied:    ${esc(d.displayText ?? d.verb)}  [${esc(dr?.reasonCode ?? 'KNOWLEDGE_DENIED')}  secretRef=${esc(d.secretRef ?? '?')}]</span>\n`;
        }
        if (r.filterResult.rollHint) {
            inner += `\n  <span class="warn">rollHint: ${esc(r.filterResult.rollHint.ui提示)}</span>`;
        }
        inner += `</div>`;
        // 可点击的 permitted 按钮
        if (r.filterResult.permitted.length > 0) {
            inner += `<div class="section"><h3>点击 permitted 选项驱动 runTick:</h3><div class="btn-group">`;
            for (const p of r.filterResult.permitted) {
                const ids = r.menuWithIds.filter(o => o.verb === p.verb && o.targetEntityId === p.targetEntityId);
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
    const quickTests = S.fixtureId === 'base'
        ? [
            ['对话:npc_wang', '合法(GATE_SKIPPED)'],
            ['malformed', '格式错误(BAD_FORMAT)'],
            ['飞行:npc_wang', '非法(NOT_IN_MENU)'],
            ['询问:npc_wang', '越权(KNOWLEDGE_DENIED)'],
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
        inner += `<div class="chain-result ${r.passed ? 'chain-pass' : 'chain-fail'}">`;
        for (const s of r.steps) {
            const icon = s.pass ? '✅' : '❌';
            const code = s.reasonCode ? ` <span class="warn">[${esc(s.reasonCode)}]</span>` : '';
            const det = s.detail ? ` <span class="dim">· ${esc(s.detail)}</span>` : '';
            inner += `<div class="chain-step">${icon} <strong>${esc(s.stepName)}</strong>${code}${det}</div>`;
        }
        inner += r.passed
            ? `<div class="chain-verdict ok">→ ✅ 全链通过</div>`
            : `<div class="chain-verdict err">→ ❌ 拒绝于「${esc(r.rejectStep ?? '')}」 原因码: ${esc(r.rejectCode ?? '')}</div>`;
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
    const modeLabel = S.llmMode === 'llm' ? 'llmDemo 真 LLM' : 'demo scriptedNarrative';
    const modeClass = S.llmMode === 'llm' ? 'mode-tag-llm' : 'mode-tag-demo';
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
            : '';
        inner += `<div class="narrative-badges">${fallbackBadge}${usedDefaultBadge}</div>`;
        inner += `<div class="narrative-option-id dim">option: ${esc(r.optionId)}</div>`;
        inner += `<div class="prose-box">${esc(r.narrative)}</div>`;
    }
    else if (S.lastChain && !S.lastChain.passed) {
        inner += `<div class="narrative-rejected"><span class="err">✗ 校验失败 → 无叙事</span><br/><span class="dim">拒绝于「${esc(S.lastChain.rejectStep ?? '')}」 原因码: ${esc(S.lastChain.rejectCode ?? '')}</span></div>`;
    }
    else {
        inner += `<div class="dim narrative-empty">（点击 permitted 选项后出字）</div>`;
    }
    return `<div class="narrative-col">${inner}</div>`;
}
function diffToHtml(d) {
    let s = `<span class="dim">tickId:</span> ${esc(d.tickId)}\n`;
    s += `<span class="dim">phases:</span> ${esc(d.settledPhases.join(' → '))}\n`;
    s += `\n<span class="dim">认知变更 (${d.cognitiveChanges.length}):</span>\n`;
    if (d.cognitiveChanges.length === 0) {
        s += `  <span class="dim">（无变更）</span>\n`;
    }
    else {
        for (const c of d.cognitiveChanges) {
            const bef = c.before !== undefined ? `${c.before}→` : '<span class="ok">新增</span>→';
            s += `  ${esc(c.observer)}→${esc(c.target)} <span class="warn">[${esc(c.tag)}/${esc(c.polarity)}]</span> 强度: ${bef}${c.after}${c.isNew ? ' <span class="ok">★新</span>' : ''}\n`;
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
            const sign = r.delta > 0 ? '+' : '';
            s += `  ${esc(r.entity)} ${esc(r.currency)}: ${r.before}→${r.after} <span class="${r.delta > 0 ? 'ok' : 'err'}">(${sign}${r.delta})</span>\n`;
        }
    }
    return s;
}
// ── Tab: 时间控制 ─────────────────────────────────────────────────────────────
function renderTimeTab() {
    const tc = S.timeCtrl;
    const tickCount = tc?.getTickCount() ?? (S.state._tick?.拍计数 ?? 0);
    const worldTime = tc ? tc.worldTimeAt(tickCount) : '—';
    const timeline = buildIncrementalView(S.diffs);
    let html = `<div class="tab-content">`;
    // 旋钮①：每拍跨度
    const spanMin = currentSpanMinutes();
    const spanDisplay = formatSpanDisplay(spanMin);
    const customUnitOpts = Object.keys(UNIT_LABELS).map(u => `<option value="${esc(u)}"${u === S.tickSpanCustomUnit ? ' selected' : ''}>${esc(UNIT_LABELS[u])}</option>`).join('');
    html += `
<div class="section">
  <h2>旋钮① 每拍跨度 <span class="debug-badge">不进指纹·走 computeTickSpan</span></h2>
  <div class="span-knob">
    <div class="btn-group">
      ${Object.entries(SPAN_PRESET_LABELS).map(([p, label]) => `<button class="btn${S.tickSpanPreset === p ? ' btn-action' : ''}" id="span-preset-${esc(p)}">${esc(label)}</button>`).join('')}
    </div>
    ${S.tickSpanPreset === 'custom' ? `
    <div class="span-custom-row">
      <input type="number" id="span-custom-qty" value="${S.tickSpanCustomQty}" min="0.01" step="0.5" style="width:75px"/>
      <select id="span-custom-unit">${customUnitOpts}</select>
    </div>` : ''}
    <div class="span-result-display">= <strong>${esc(spanDisplay)}</strong>（${spanMin} 纪元分钟/拍）</div>
  </div>
</div>`;
    // 旋钮②：流速（AUTO 播放）
    html += `
<div class="section">
  <h2>旋钮② 流速（AUTO 播放） <span class="debug-badge">纯前端·不进指纹</span></h2>
  <div class="speed-knob">
    <div class="btn-group">
      <button class="btn${S.autoPlaySpeed === null ? ' btn-action' : ''}" id="btn-speed-stop">■ 停止</button>
      ${AUTO_PLAY_SPEEDS.map(s => `<button class="btn${S.autoPlaySpeed === s ? ' btn-action' : ''}" id="btn-speed-${String(s).replace('.', '_')}">×${s}</button>`).join('')}
    </div>
    <div class="speed-status dim">
      ${S.autoPlaySpeed !== null
        ? `▶ ×${S.autoPlaySpeed} · 每 ${Math.round(1000 / S.autoPlaySpeed)}ms 自动推进一拍 · $流速.速度档=${S.autoPlaySpeed}`
        : '（已停止·点 ×N 开始 AUTO 播放）'}
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
    <button class="btn${S.llmMode === 'demo' ? ' btn-action' : ''}" id="btn-llm-demo">demo（脚本叙事）</button>
    <button class="btn${S.llmMode === 'llm' ? ' btn-action' : ''}" id="btn-llm-real">llm（真实 LLM）</button>
    <button class="btn${S.forceFailure ? ' btn-warn' : ''}" id="btn-force-fail">
      强制 LLM 失败: ${S.forceFailure ? '开' : '关'}
    </button>
  </div>
  <div class="dim" style="font-size:11px;margin-top:6px;">
    ${S.llmMode === 'llm'
        ? '⚠ LLM 模式需在 .env 配置 VITE_DEEPSEEK_API_KEY（配置后重启 npm run dev）'
        : '✓ demo 模式：脚本占位叙事，不调用 LLM，完全确定性'}
  </div>
</div>`;
    // 叙事渲染参数（人称 + 文风）
    html += `
<div class="section">
  <h2>叙事渲染参数 <span class="debug-badge">不进指纹·纯渲染层</span></h2>
  <div class="render-param-row">
    <label>人称:
      <select id="narrative-person-sel">
        ${Object.keys(PERSON_LABELS).map(p => `<option value="${esc(p)}"${p === S.narrativePerson ? ' selected' : ''}>${esc(PERSON_LABELS[p])}</option>`).join('')}
      </select>
    </label>
    <label>文风:
      <select id="narrative-style-sel">
        ${Object.keys(STYLE_LABELS).map(s => `<option value="${esc(s)}"${s === S.narrativeStyle ? ' selected' : ''}>${esc(STYLE_LABELS[s])}</option>`).join('')}
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
            html += `<div class="timeline-entry${hasChanges ? ' has-changes' : ''}">
        [${esc(entry.tickId)}] ${esc(entry.summary)}
        <span class="dim">新印象×${entry.newImpressions} 强增×${entry.strengthIncreases} 关系触发×${entry.relationHitsCount}</span>
      </div>`;
        }
        html += `</div>`;
    }
    html += `</div>`;
    // 最新 diff
    if (S.diffs.length > 0) {
        html += `<div class="section"><h2>最新拍 State Diff</h2><div class="result-box">${diffToHtml(S.diffs[S.diffs.length - 1])}</div></div>`;
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
    // 边（先画边，节点在上层）
    for (const e of graph.edges) {
        const p1 = posMap.get(e.from);
        const p2 = posMap.get(e.to);
        if (!p1 || !p2)
            continue;
        const color = e.isHighlighted ? '#ff6b35' : '#3a4050';
        const width = e.isHighlighted ? 2.5 : 1.2;
        const opacity = e.isHighlighted ? '0.9' : '0.5';
        svg += `<line x1="${p1.x.toFixed(1)}" y1="${p1.y.toFixed(1)}" x2="${p2.x.toFixed(1)}" y2="${p2.y.toFixed(1)}" stroke="${color}" stroke-width="${width}" opacity="${opacity}"/>`;
        // score label on highlighted edges
        if (e.isHighlighted) {
            const mx = ((p1.x + p2.x) / 2).toFixed(1);
            const my = ((p1.y + p2.y) / 2).toFixed(1);
            svg += `<text x="${mx}" y="${my}" text-anchor="middle" fill="#ff9d6e" font-size="9" font-family="monospace">${e.score.toFixed(0)}</text>`;
        }
    }
    // 节点
    for (const n of graph.nodes) {
        const pos = posMap.get(n.key);
        if (!pos)
            continue;
        const hasClusters = n.orgKeys.length > 0;
        const fill = hasClusters ? '#1f3a5c' : '#1e2a1e';
        const stroke = hasClusters ? '#4a9eff' : '#3fb950';
        const name = n.name.length > 5 ? n.name.slice(0, 4) + '…' : n.name;
        svg += `<circle cx="${pos.x.toFixed(1)}" cy="${pos.y.toFixed(1)}" r="20" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
        svg += `<text x="${pos.x.toFixed(1)}" y="${(pos.y - 4).toFixed(1)}" text-anchor="middle" fill="#c9d1d9" font-size="9" font-family="sans-serif">${esc(name)}</text>`;
        svg += `<text x="${pos.x.toFixed(1)}" y="${(pos.y + 8).toFixed(1)}" text-anchor="middle" fill="#8b949e" font-size="8" font-family="monospace">${esc(n.key.slice(0, 8))}</text>`;
    }
    if (N === 0) {
        svg += `<text x="${cx}" y="${cy}" text-anchor="middle" fill="#8b949e" font-size="14">无 NPC 节点</text>`;
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
                    ? `<span class="loc-node-org dim">[${n.orgKeys.map(esc).join(',')}]</span>`
                    : '';
                const secretBadge = n.knownSecretCount > 0
                    ? `<span class="loc-secret-badge ok">秘×${n.knownSecretCount}</span>`
                    : '';
                html += `<div class="loc-node-row"><span class="loc-node-name">${esc(n.name)}</span><code class="loc-node-key dim">${esc(n.key)}</code>${orgBadge}${secretBadge}</div>`;
            }
            html += `</div></div>`;
        }
        html += `</div>`;
    }
    html += `</div>`;
    // A2: 边明细可视化（强度进度条 + 跨拍增减高亮）
    const edgeDeltaMap = prevGraph ? buildEdgeDelta(prevGraph.edges, graph.edges) : new Map();
    html += `<div class="section"><h2>边明细（${graph.edges.length}）</h2>`;
    if (graph.edges.length === 0) {
        html += `<div class="dim" style="padding:8px">（无关系边）</div>`;
    }
    else {
        html += `<div class="edge-list">`;
        for (const e of graph.edges) {
            const absStr = Math.abs(e.strength);
            const pct = absStr; // strength max = 100
            const barClass = absStr >= 50 ? 'edge-bar-high' : '';
            const scoreStr = e.isHighlighted
                ? `<span class="ok">★ score=${e.score.toFixed(1)}</span>`
                : `<span class="dim">score=${e.score.toFixed(1)}</span>`;
            const ripple = absStr >= 50 ? `<span class="ripple-hint">涟漪可触发</span>` : '';
            const pa = e.from < e.to ? e.from : e.to;
            const pb = e.from < e.to ? e.to : e.from;
            const pk = `${pa}\x00${pb}`;
            const delta = edgeDeltaMap.get(pk);
            let deltaHtml = '';
            if (delta && delta.strengthDelta > 0)
                deltaHtml = `<span class="delta-up">↑${delta.strengthDelta}</span>`;
            if (delta && delta.strengthDelta < 0)
                deltaHtml = `<span class="delta-down">↓${Math.abs(delta.strengthDelta)}</span>`;
            html += `<div class="edge-row">
  <span class="edge-endpoints">${esc(e.from)} ─[<span class="dim">${esc(e.type)}</span>]→ ${esc(e.to)}</span>
  <div class="edge-strength-section">
    <div class="edge-strength-wrap"><div class="edge-strength-bar ${barClass}" style="width:${pct}%"></div></div>
    <span class="edge-strength-num${e.strength < 0 ? ' err' : ''}">${e.strength}</span>
    ${ripple}${deltaHtml}
  </div>
  <span class="edge-meta dim">信任${e.trust}% ${scoreStr}</span>
</div>`;
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
        return { optionId: null, matchType: 'none' };
    const exact = menuWithIds.find(o => o.option_id === t);
    if (exact)
        return { optionId: exact.option_id, matchType: 'exact' };
    for (const o of menuWithIds) {
        const dt = o.displayText ?? '';
        if (dt && dt.includes(t))
            return { optionId: o.option_id, matchType: 'display' };
    }
    for (const o of menuWithIds) {
        const dt = o.displayText ?? '';
        if (dt.length >= 3 && t.includes(dt))
            return { optionId: o.option_id, matchType: 'display' };
    }
    for (const o of menuWithIds) {
        const verb = o.option_id.split(':')[0] ?? '';
        if (verb && t.startsWith(verb))
            return { optionId: o.option_id, matchType: 'verb' };
    }
    return { optionId: null, matchType: 'none' };
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
    const mapBadgeClass = r.isRpOnly ? 'map-badge map-rp' : 'map-badge map-success';
    const mapLabel = r.isRpOnly
        ? '纯RP·未映射 → 不写账'
        : `映射成功(${esc(r.matchType)}): ${esc(r.matchedOptionId ?? '')}`;
    let s = `<div class="free-text-result">`;
    s += `<div class="free-text-header">输入: <code>${esc(r.input)}</code> <span class="${mapBadgeClass}">${mapLabel}</span></div>`;
    if (!r.isRpOnly && r.chain) {
        if (!r.chain.passed) {
            s += `<div class="free-chain-fail"><span class="err">✗ 校验失败</span> 拒绝于「${esc(r.chain.rejectStep ?? '')}」 原因码: ${esc(r.chain.rejectCode ?? '')}</div>`;
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
    const npcOpts = (sel) => npcKeys.map(k => `<option value="${esc(k)}"${k === sel ? ' selected' : ''}>${esc(k)} · ${esc(S.state.NPC[k].姓名)}</option>`).join('');
    // 主实体：POV = 操纵主体（单一真相源·两字段恒等）
    const povKey = S.povEntityKey && S.state.NPC[S.povEntityKey] ? S.povEntityKey : (npcKeys[0] ?? '');
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
  <h2>POV · 操纵主体 <span class="debug-badge">选谁就操纵谁 · 不跑 runTick</span></h2>
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
        html += `只有 A 可见秘密: <span class="ok">${cmp.onlyA.join(', ') || '（无）'}</span>\n`;
        html += `只有 B 可见秘密: <span class="ok">${cmp.onlyB.join(', ') || '（无）'}</span>\n`;
        html += `双方均可见:       <span class="warn">${cmp.both.join(', ') || '（无）'}</span>\n`;
        html += `\n认知 A 多: <span class="dim">${cmp.cognitiveOnlyA.join(', ') || '无'}</span>\n`;
        html += `认知 B 多: <span class="dim">${cmp.cognitiveOnlyB.join(', ') || '无'}</span>`;
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
                s += ` 母题=${esc(sec.母题 ?? '—')} 严重度=${sec.严重度 ?? '—'} 暴露度=${sec.暴露度 ?? '—'}`;
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
            const col = rel.强度 > 0 ? 'ok' : rel.强度 < 0 ? 'err' : 'dim';
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
            : `<span class="warn">偏差Δ${pp.totalBias >= 0 ? '+' : ''}${pp.totalBias}</span>`;
        s += `<span class="pov-proj-count">${biasLabel}</span>`;
    }
    s += `</div>`;
    s += `<div class="result-box" style="font-size:11px">`;
    if (pp) {
        s += `<div class="pov-two-col-header"><span class="dim">轴</span><span class="warn">投影值</span><span class="pov-spoiler-head">真值(spoiler)</span></div>`;
        const axes = ['开放', '尽责', '外向', '宜人', '神经质'];
        for (const axis of axes) {
            const axData = pp[axis];
            const biasStr = axData.bias !== 0 ? ` <span class="warn">(Δ${axData.bias >= 0 ? '+' : ''}${axData.bias})</span>` : '';
            s += `<div class="pov-two-col-row">`;
            s += `<span class="dim">${esc(axis)}</span>`;
            s += `<span class="${axData.bias !== 0 ? 'warn' : 'ok'}">${axData.projected}</span>${biasStr}`;
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
    s += `可见秘密 (${r.visibleSecretIds.length}): <span class="ok">${r.visibleSecretIds.join(', ') || '无'}</span>\n`;
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
        <select id="snap-sel-a">${savedSnaps.map(l => `<option${l === S.snapSelA ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>
        vs
        <select id="snap-sel-b">${savedSnaps.map(l => `<option${l === S.snapSelB ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>
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
    let h = '';
    // 身份头部
    const aliveClass = panel.存活状态 === '在世' ? 'ok' : 'err';
    h += `<div class="actor-id-block">`;
    h += `<span class="actor-name-big">${esc(panel.name)}</span>`;
    if (panel.称呼)
        h += ` <span class="dim">（${esc(panel.称呼)}）</span>`;
    h += ` <code class="dim">${esc(panel.entityKey)}</code>`;
    h += ` <span class="${aliveClass}">${esc(panel.存活状态)}</span>`;
    h += `</div>`;
    h += `<div class="actor-meta-row">`;
    h += `<span>${esc(panel.性别 || '—')} · ${esc(panel.种族)}</span>`;
    if (panel.位置)
        h += ` · 位置: <span class="warn">${esc(panel.位置)}</span>`;
    if (panel.称号)
        h += ` · 称号: <span class="ok">${esc(panel.称号)}</span>`;
    if (panel.头衔.length > 0)
        h += ` · 头衔: ${panel.头衔.map(t => `<span class="ok">${esc(t)}</span>`).join(' ')}`;
    if (panel.业力 !== 0)
        h += ` · 业力: <span class="${panel.业力 > 0 ? 'ok' : 'err'}">${panel.业力}</span>`;
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
    h += `HP <b>${panel.派生.HP}</b>/${panel.派生.HP上限}`;
    h += ` · 精力 <b>${panel.派生.精力}</b>/${panel.派生.精力上限}`;
    h += ` · 颜值 ${panel.派生.颜值}`;
    h += ` · 行动点 ${panel.行动点.当前}/${panel.行动点.上限}`;
    h += `</div>`;
    if (panel.声誉.知名度 > 0 || panel.声誉.人望 !== 0) {
        h += `<div class="actor-derived-row dim">声誉: 人望 ${panel.声誉.人望} · 知名度 ${panel.声誉.知名度}${panel.声誉.标签 ? ` [${esc(panel.声誉.标签)}]` : ''}</div>`;
    }
    // 性格五轴进度条
    h += `<div class="actor-section-h">性格五轴</div><div class="personality-grid">`;
    const axes = ['开放', '尽责', '外向', '宜人', '神经质'];
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
        h += `<div class="actor-inline-row">${ccyEntries.map(([c, a]) => `<span class="ok">${a}${esc(c)}</span>`).join(' · ')}</div>`;
    }
    // 可见秘密（POV 过滤）
    h += `<div class="actor-section-h">可见秘密（POV 过滤·${panel.可见秘密ID.length} 条）</div>`;
    h += panel.可见秘密ID.length > 0
        ? `<div class="actor-inline-row">${panel.可见秘密ID.map(id => `<code class="ok">${esc(id)}</code>`).join(' ')}</div>`
        : `<div class="dim actor-inline-row">（POV 无可见秘密）</div>`;
    // 关系
    if (panel.关系.length > 0) {
        h += `<details class="actor-details"><summary class="actor-section-h">关系（${panel.关系.length}）</summary><div class="actor-list">`;
        for (const r of panel.关系) {
            const col = r.强度 > 0 ? 'ok' : r.强度 < 0 ? 'err' : 'dim';
            const sc = (Math.abs(r.强度) * r.信任 / 100).toFixed(1);
            h += `<div class="actor-list-item">→ <code>${esc(r.对象键)}</code> [${esc(r.类型)}] 强度 <span class="${col}">${r.强度}</span> 信任 ${r.信任} score=${sc}</div>`;
        }
        h += `</div></details>`;
    }
    // 认知档案
    if (panel.认知概览.length > 0) {
        h += `<details class="actor-details"><summary class="actor-section-h">认知档案（观察者·${panel.认知概览.length} 目标）</summary><div class="actor-list">`;
        for (const c of panel.认知概览) {
            h += `<div class="actor-list-item">→ <code>${esc(c.目标键)}</code> 了解度 <span class="warn">${c.了解度}</span> 印象×${c.印象数} <span class="dim">[${esc(c.姓名知识)}]</span></div>`;
        }
        h += `</div></details>`;
    }
    // 情绪栈
    if (panel.情绪栈.length > 0) {
        h += `<details class="actor-details"><summary class="actor-section-h">情绪栈（${panel.情绪栈.length}）</summary><div class="actor-list">`;
        for (const e of panel.情绪栈) {
            const col = e.极性 === '正' ? 'ok' : e.极性 === '负' ? 'err' : 'warn';
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
            h += `<div class="actor-list-item"><span class="dim">长期:</span> ${panel.目标.长期.map(esc).join(' · ')}</div>`;
        if (panel.目标.短期.length > 0)
            h += `<div class="actor-list-item"><span class="dim">短期:</span> ${panel.目标.短期.map(esc).join(' · ')}</div>`;
        h += `</div></details>`;
    }
    // 所属组织
    if (panel.所属组织.length > 0) {
        h += `<div class="actor-section-h">所属组织</div>`;
        h += `<div class="actor-inline-row">${panel.所属组织.map(o => `<code>${esc(o.组织键)}</code> [${esc(o.职务)}]`).join(' · ')}</div>`;
    }
    // 记忆
    if (panel.记忆.length > 0) {
        h += `<details class="actor-details"><summary class="actor-section-h">记忆（${panel.记忆.length}）</summary><div class="actor-list">`;
        for (const m of panel.记忆) {
            h += `<div class="actor-list-item"><span class="dim">重${m.重要度}${m.情绪色彩 ? ` [${esc(m.情绪色彩)}]` : ''}</span> ${esc(m.摘要)}</div>`;
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
    return h;
}
function renderTreeNode(node, depth = 0) {
    if (!node.children || node.children.length === 0) {
        const val = node.value !== undefined ? `: <span class="ok">${esc(String(node.value))}</span>` : '';
        return `<div class="tree-leaf">${esc(node.label)}${val}</div>`;
    }
    const open = !node.collapsed || depth === 0 ? ' open' : '';
    const children = node.children.map(c => renderTreeNode(c, depth + 1)).join('');
    return `<details${open}><summary>${esc(node.label)}</summary><div class="tree-body">${children}</div></details>`;
}
// ── 主渲染器 ──────────────────────────────────────────────────────────────────
function renderApp() {
    const app = document.getElementById('app');
    if (!app)
        return;
    let tabContent = '';
    switch (S.activeTab) {
        case 'menu':
            tabContent = renderMenuTab();
            break;
        case 'time':
            tabContent = renderTimeTab();
            break;
        case 'graph':
            tabContent = renderGraphTab();
            break;
        case 'pov':
            tabContent = renderPOVTab();
            break;
        case 'snapshot':
            tabContent = renderSnapshotTab();
            break;
        case 'tree':
            tabContent = renderTreeTab();
            break;
    }
    app.innerHTML = renderHeader() + renderTabBar() + tabContent;
    attachEventListeners();
    // S.povEntityKey と S.operatorKey は常に同値のため pov-entity-sel の value 同期のみ行う。
    // (ブラウザのフォーム復元による selected 属性上書き防止)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const _app = app;
    const _povEntityEl = _app?.querySelector?.('#pov-entity-sel');
    if (_povEntityEl)
        _povEntityEl.value = S.povEntityKey;
}
// ── 事件绑定 ──────────────────────────────────────────────────────────────────
function attachEventListeners() {
    // fixture 切换
    document.getElementById('fixture-sel')?.addEventListener('change', e => {
        switchFixture(e.target.value);
        renderApp();
    });
    // tab 切换
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            S.activeTab = btn.dataset['tab'];
            renderApp();
        });
    });
    // 菜单检视
    document.getElementById('btn-inspect-menu')?.addEventListener('click', () => {
        S.lastMenu = inspectMenu(S.state, S.operatorKey, S.rawCandidates);
        renderApp();
    });
    // permitted 选项点击 → runValidationChain → runTickWithDiff + runActionInDualMode
    document.querySelectorAll('[data-run-option]').forEach(btn => {
        btn.addEventListener('click', () => {
            const optId = btn.dataset['runOption'];
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
                }).then(result => {
                    S.lastNarrative = result;
                    S.narrativeLoading = false;
                    renderApp();
                }).catch(err => {
                    console.error('[G1b3c] runActionInDualMode error:', err);
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
    const optInput = document.getElementById('opt-input');
    optInput?.addEventListener('input', () => { S.validInput = optInput.value; });
    document.getElementById('btn-validate')?.addEventListener('click', () => {
        const val = document.getElementById('opt-input')?.value ?? '';
        S.validInput = val;
        if (val) {
            S.lastChain = runValidationChain(val, S.state, S.operatorKey, S.rawCandidates);
            renderApp();
        }
    });
    // 快速测试按钮
    document.querySelectorAll('[data-quick]').forEach(btn => {
        btn.addEventListener('click', () => {
            const optId = btn.dataset['quick'];
            S.validInput = optId;
            S.lastChain = runValidationChain(optId, S.state, S.operatorKey, S.rawCandidates);
            renderApp();
        });
    });
    Object.keys(SPAN_PRESET_LABELS).forEach(preset => {
        document.getElementById(`span-preset-${preset}`)?.addEventListener('click', () => {
            S.tickSpanPreset = preset;
            renderApp();
        });
    });
    // 自定义跨度数量 / 单位
    document.getElementById('span-custom-qty')?.addEventListener('change', e => {
        const v = parseFloat(e.target.value);
        if (!isNaN(v) && v > 0)
            S.tickSpanCustomQty = v;
        renderApp();
    });
    document.getElementById('span-custom-unit')?.addEventListener('change', e => {
        S.tickSpanCustomUnit = e.target.value;
        renderApp();
    });
    // 旋钮② 流速按钮
    document.getElementById('btn-speed-stop')?.addEventListener('click', () => { stopAutoPlay(); renderApp(); });
    AUTO_PLAY_SPEEDS.forEach(s => {
        const btnId = `btn-speed-${String(s).replace('.', '_')}`;
        document.getElementById(btnId)?.addEventListener('click', () => { startAutoPlay(s); renderApp(); });
    });
    // 时间控制
    document.getElementById('btn-step1')?.addEventListener('click', () => {
        if (!S.timeCtrl)
            return;
        const span = currentSpanMinutes();
        S.prevGraph = buildRelationGraph(S.state);
        const diffs = S.timeCtrl.step(1, span);
        S.state = S.timeCtrl.getCurrentState();
        S.diffs = [...S.diffs.slice(-(MAX_DIFFS - diffs.length)), ...diffs];
        renderApp();
    });
    document.getElementById('btn-step5')?.addEventListener('click', () => {
        if (!S.timeCtrl)
            return;
        const span = currentSpanMinutes();
        S.prevGraph = buildRelationGraph(S.state);
        const diffs = S.timeCtrl.step(5, span);
        S.state = S.timeCtrl.getCurrentState();
        S.diffs = [...S.diffs.slice(-(MAX_DIFFS - diffs.length)), ...diffs];
        renderApp();
    });
    document.getElementById('btn-stepn')?.addEventListener('click', () => {
        if (!S.timeCtrl)
            return;
        const span = currentSpanMinutes();
        S.prevGraph = buildRelationGraph(S.state);
        const n = parseInt(document.getElementById('step-n')?.value ?? '1', 10);
        const diffs = S.timeCtrl.step(Math.max(1, Math.min(50, n)), span);
        S.state = S.timeCtrl.getCurrentState();
        S.diffs = [...S.diffs.slice(-(MAX_DIFFS - diffs.length)), ...diffs];
        renderApp();
    });
    document.getElementById('btn-jump')?.addEventListener('click', () => {
        if (!S.timeCtrl)
            return;
        const target = parseInt(document.getElementById('jump-tick')?.value ?? '0', 10);
        S.state = S.timeCtrl.jumpTo(Math.max(0, target));
        renderApp();
    });
    document.getElementById('btn-replay')?.addEventListener('click', () => {
        if (!S.timeCtrl)
            return;
        stopAutoPlay();
        S.state = S.timeCtrl.replay();
        S.diffs = [];
        S.prevGraph = null;
        renderApp();
    });
    // LLM 模式
    document.getElementById('btn-llm-demo')?.addEventListener('click', () => { S.llmMode = 'demo'; renderApp(); });
    document.getElementById('btn-llm-real')?.addEventListener('click', () => { S.llmMode = 'llm'; renderApp(); });
    document.getElementById('btn-force-fail')?.addEventListener('click', () => { S.forceFailure = !S.forceFailure; renderApp(); });
    // 叙事渲染参数（人称 + 文风）
    document.getElementById('narrative-person-sel')?.addEventListener('change', e => {
        S.narrativePerson = sanitizePerson(e.target.value);
        // demo 模式：立即重生成脚本叙事（无 LLM 调用·确定性）
        if (S.llmMode === 'demo' && S.lastNarrative) {
            const pcName = S.state.NPC?.[S.operatorKey]?.姓名 ?? S.operatorKey;
            S.lastNarrative = {
                ...S.lastNarrative,
                narrative: buildScriptedNarrative(S.narrativePerson, S.narrativeStyle, pcName, S.lastNarrative.optionId),
            };
        }
        renderApp();
    });
    document.getElementById('narrative-style-sel')?.addEventListener('change', e => {
        S.narrativeStyle = sanitizeStyle(e.target.value);
        // demo 模式：立即重生成脚本叙事
        if (S.llmMode === 'demo' && S.lastNarrative) {
            const pcName = S.state.NPC?.[S.operatorKey]?.姓名 ?? S.operatorKey;
            S.lastNarrative = {
                ...S.lastNarrative,
                narrative: buildScriptedNarrative(S.narrativePerson, S.narrativeStyle, pcName, S.lastNarrative.optionId),
            };
        }
        renderApp();
    });
    // POV / 操纵主体切换（pov-entity-sel = 操纵主体切换·povEntityKey と operatorKey を恒等同期）
    // 切換時に rawCandidates を再構築：NPC 自身を候補から除外し在場 NPC との対話を生成
    document.getElementById('pov-entity-sel')?.addEventListener('change', e => {
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
    document.getElementById('btn-reset-operator')?.addEventListener('click', () => {
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
    document.getElementById('pov-a-sel')?.addEventListener('change', e => {
        S.povA = e.target.value;
        renderApp();
    });
    document.getElementById('pov-b-sel')?.addEventListener('change', e => {
        S.povB = e.target.value;
        renderApp();
    });
    document.getElementById('btn-pov-compare')?.addEventListener('click', () => renderApp());
    // 快照
    document.getElementById('btn-snap-save')?.addEventListener('click', () => {
        const label = document.getElementById('snap-label')?.value ?? 'snap';
        S.snapshotLabel = label;
        S.snapshotStore.save(label, S.state, {
            narrativePerson: S.narrativePerson,
            narrativeStyle: S.narrativeStyle,
        });
        renderApp();
    });
    document.getElementById('snap-sel-a')?.addEventListener('change', e => { S.snapSelA = e.target.value; });
    document.getElementById('snap-sel-b')?.addEventListener('change', e => { S.snapSelB = e.target.value; });
    document.getElementById('btn-snap-compare')?.addEventListener('click', () => {
        S.snapSelA = document.getElementById('snap-sel-a')?.value ?? '';
        S.snapSelB = document.getElementById('snap-sel-b')?.value ?? '';
        renderApp();
    });
    // 记录器
    document.getElementById('btn-rec-reset')?.addEventListener('click', () => {
        S.recorder = new ActionRecorder(S.seed, S.state);
        S.recActions = [];
        renderApp();
    });
    document.getElementById('btn-rec-replay')?.addEventListener('click', () => {
        if (!S.recorder)
            return;
        const replayState = S.recorder.replay();
        const orig = S.recorder.getCurrentState();
        const ok = JSON.stringify(replayState) === JSON.stringify(orig);
        alert(`重放完成 · 逐位恒等: ${ok ? '✅ YES' : '❌ NO'}`);
    });
    // 自由文本输入（Feature B）
    document.getElementById('free-text-input')?.addEventListener('input', e => {
        S.freeText = e.target.value;
    });
    document.getElementById('btn-free-submit')?.addEventListener('click', () => {
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
                }).then(narrative => {
                    S.lastFreeTextResult = { input: text, matchedOptionId: optionId, matchType, isRpOnly: false, chain, diff, narrative };
                    S.freeTextLoading = false;
                    renderApp();
                }).catch(err => {
                    const narrative = { narrative: `[异常] ${err instanceof Error ? err.message : String(err)}`, isFallback: true, optionId, usedDefault: false };
                    S.lastFreeTextResult = { input: text, matchedOptionId: optionId, matchType, isRpOnly: false, chain, diff, narrative };
                    S.freeTextLoading = false;
                    renderApp();
                });
            }
            else {
                const narrative = { narrative: '', isFallback: false, optionId, usedDefault: false };
                S.lastFreeTextResult = { input: text, matchedOptionId: optionId, matchType, isRpOnly: false, chain, diff: null, narrative };
                S.freeTextLoading = false;
                renderApp();
            }
        }
        else {
            const preTick = S.state;
            const rpOpts = S.llmMode === 'demo'
                ? { scriptedNarrative: text, narrativePerson: S.narrativePerson, narrativeStyle: S.narrativeStyle }
                : { narrativePerson: S.narrativePerson, narrativeStyle: S.narrativeStyle };
            runActionInDualMode(preTick, S.operatorKey, '__rp_only__', S.rawCandidates, S.llmMode, rpOpts).then(narrative => {
                S.lastFreeTextResult = { input: text, matchedOptionId: null, matchType: 'none', isRpOnly: true, chain: null, diff: null, narrative };
                S.freeTextLoading = false;
                renderApp();
            }).catch(err => {
                const narrative = { narrative: `[异常] ${err instanceof Error ? err.message : String(err)}`, isFallback: true, optionId: '__rp_only__', usedDefault: false };
                S.lastFreeTextResult = { input: text, matchedOptionId: null, matchType: 'none', isRpOnly: true, chain: null, diff: null, narrative };
                S.freeTextLoading = false;
                renderApp();
            });
        }
    });
}
// ── 启动 ──────────────────────────────────────────────────────────────────────
window.addEventListener('unhandledrejection', e => {
    console.error('[G1b3c] 未处理异常:', e.reason);
});
document.addEventListener('DOMContentLoaded', () => {
    renderApp();
});
