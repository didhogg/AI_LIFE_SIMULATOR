// G1b3c · AOHP 调试控制台 · 浏览器入口 C1
// 铁律: 全部 UI 层 · 不进指纹 · core 函数体零 diff
// 只经 aohpDebugConsole / aohpDebugConsole2 合法 API 驱动
// 禁旁路校验闸 · 禁私写 core state · 确定性六禁全套

import type { RootState } from '@ai-life-sim/core'
import {
  inspectMenu,
  runValidationChain,
  runTickWithDiff,
  runActionInDualMode,
  TimeController,
  DEMO_RAW_CANDIDATES,
  PHASE6_THRESHOLD,
  type TickDiffResult,
  type ValidationChainResult,
  type MenuInspectResult,
  type ActionResult,
} from '../aohpDebugConsole.js'
import {
  buildRelationGraph,
  buildPCPanel,
  buildStateTree,
  buildMapThumbnail,
  takeStateSnapshot,
  buildIncrementalView,
  povInspect,
  comparePOVs,
  ActionRecorder,
  SnapshotStore,
  type RelationGraph,
  type StateTreeNode,
  type StateSnapshot,
} from '../aohpDebugConsole2.js'
import {
  getDebugFixture,
  DEBUG_FIXTURES,
} from '../fixtures/debugFixtures.js'
import { buildWorld, PC, NPC_WANG, SAVE_SEED } from '../../slice/fixture/world.js'
import type { MenuFilterCandidate } from '../../slice/engine/menuFilter.js'

// ── 类型定义 ─────────────────────────────────────────────────────────────────

type FixtureId = 'base' | '小城' | '大陆' | '整世界'
type TabId = 'menu' | 'time' | 'graph' | 'pov' | 'snapshot' | 'tree'

// ── 应用全局状态 ──────────────────────────────────────────────────────────────

/** 最大保存的 diff 条数（防内存膨胀） */
const MAX_DIFFS = 50

const S = {
  fixtureId: 'base' as FixtureId,
  state: buildWorld() as RootState,
  pcKey: PC as string,
  seed: SAVE_SEED as number,
  rawCandidates: DEMO_RAW_CANDIDATES as MenuFilterCandidate[],
  timeCtrl: null as TimeController | null,
  recorder: null as ActionRecorder | null,
  snapshotStore: new SnapshotStore(),
  diffs: [] as TickDiffResult[],
  llmMode: 'demo' as 'demo' | 'llm',
  forceFailure: false,
  activeTab: 'menu' as TabId,
  povA: PC as string,
  povB: NPC_WANG as string,
  validInput: '',
  lastChain: null as ValidationChainResult | null,
  lastMenu: null as MenuInspectResult | null,
  lastNarrative: null as ActionResult | null,
  narrativeLoading: false,
  snapshotLabel: 'snap0',
  snapSelA: '',
  snapSelB: '',
  recActions: [] as string[],
}

function initTime(): void {
  S.timeCtrl = new TimeController(S.seed, S.state)
  S.recorder  = new ActionRecorder(S.seed, S.state)
}

// ── Fixture 切换 ──────────────────────────────────────────────────────────────

function switchFixture(id: FixtureId): void {
  if (id === 'base') {
    S.state           = buildWorld()
    S.pcKey           = PC
    S.seed            = SAVE_SEED
    S.rawCandidates   = DEMO_RAW_CANDIDATES as MenuFilterCandidate[]
    S.povA            = PC
    S.povB            = NPC_WANG
  } else {
    const f           = getDebugFixture(id as '小城' | '大陆' | '整世界')
    S.state           = f.buildState()
    S.seed            = f.seed
    const npcKeys     = Object.keys(S.state.NPC)
    S.pcKey           = npcKeys[0] ?? 'unknown'
    S.rawCandidates   = npcKeys.slice(1).map(k => ({
      verb: '对话',
      targetEntityId: k,
      displayText: `与${S.state.NPC[k]!.姓名}对话`,
    }))
    S.povA = npcKeys[0] ?? ''
    S.povB = npcKeys[1] ?? ''
  }
  S.fixtureId      = id
  S.snapshotStore  = new SnapshotStore()
  S.diffs          = []
  S.lastChain      = null
  S.lastMenu       = null
  S.recActions     = []
  S.snapSelA       = ''
  S.snapSelB       = ''
  initTime()
}

// 初始化时间控制器
initTime()

// ── HTML 工具 ─────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── 渲染：头部 + Tab 栏 ───────────────────────────────────────────────────────

function renderHeader(): string {
  const npcCount  = Object.keys(S.state.NPC).length
  const locCount  = Object.keys(S.state.地图?.地点 ?? {}).length
  const tickCount = S.state._tick?.拍计数 ?? 0
  return `
<header class="app-header">
  <h1>AOHP 调试控制台 · G1b3c</h1>
  <div class="fixture-bar">
    <label>场景:
      <select id="fixture-sel">
        ${(['base','小城','大陆','整世界'] as FixtureId[]).map(id =>
          `<option value="${esc(id)}"${id === S.fixtureId ? ' selected' : ''}>${esc(fixtureLabel(id))}</option>`
        ).join('')}
      </select>
    </label>
    <span class="fixture-info">
      NPC:${npcCount} · 地点:${locCount} · 种子:${S.seed} · tick:${tickCount} · 观察者:${esc(S.pcKey)}
    </span>
  </div>
</header>`
}

function fixtureLabel(id: FixtureId): string {
  const map: Record<FixtureId, string> = {
    'base': '基础世界 (seed=42, buildWorld)',
    '小城': '小城·玉华镇 (seed=100, 3 NPC)',
    '大陆': '大陆·金陵商路 (seed=200, 6 NPC)',
    '整世界': '整世界·五域图 (seed=300, 12 NPC)',
  }
  return map[id]
}

function renderTabBar(): string {
  const tabs: [TabId, string][] = [
    ['menu',     '菜单·校验'],
    ['time',     '时间控制'],
    ['graph',    '关系网'],
    ['pov',      'POV视角'],
    ['snapshot', '快照·回放'],
    ['tree',     '状态树·地图'],
  ]
  return `<div class="tab-bar">${tabs.map(([id, label]) =>
    `<button class="tab-btn${id === S.activeTab ? ' active' : ''}" data-tab="${id}">${esc(label)}</button>`
  ).join('')}</div>`
}

// ── Tab: 菜单·校验 ───────────────────────────────────────────────────────────

function renderMenuTab(): string {
  const menuHtml  = renderMenuSection()
  const chainHtml = renderChainSection()
  const hasDiff = S.diffs.length > 0
  const hasNarrative = S.lastNarrative !== null || S.narrativeLoading
  const bottomHtml = (hasDiff || hasNarrative)
    ? `<div class="section"><h2>当拍结果：State Diff · 叙事·出字</h2><div class="diff-narrative-grid">${hasDiff ? renderLatestDiffPanel() : '<div class="diff-col"><span class="dim">（尚无拍记录）</span></div>'}${renderNarrativePanel()}</div></div>`
    : ''
  return `<div class="tab-content">${menuHtml}${chainHtml}${bottomHtml}</div>`
}

function renderMenuSection(): string {
  let inner = `
<div class="section">
  <h2>菜单生成检视</h2>
  <div class="btn-group">
    <button class="btn btn-primary" id="btn-inspect-menu">检视当前菜单</button>
  </div>`

  if (S.lastMenu) {
    const r = S.lastMenu
    inner += `<div class="result-box">`
    inner += `<span class="ok">原始候选 ${r.rawCandidates.length} 项</span> → option_id <span class="ok">${r.menuWithIds.length}</span> 项\n`
    inner += `\n<span class="dim">── 过滤前列表 ──</span>\n`
    for (const o of r.menuWithIds) {
      inner += `  [${esc(o.option_id)}]  ${esc(o.displayText ?? '')}\n`
    }
    inner += `\n<span class="dim">── 过滤结果 permitted=${r.filterResult.permitted.length} / denied=${r.filterResult.denied.length} ──</span>\n`
    for (const p of r.filterResult.permitted) {
      inner += `  <span class="ok">✅ permitted: ${esc(p.displayText ?? p.verb)}</span>\n`
    }
    for (const d of r.filterResult.denied) {
      const dr = r.deniedReasons.find(x => x.secretRef === d.secretRef)
      inner += `  <span class="err">❌ denied:    ${esc(d.displayText ?? d.verb)}  [${esc(dr?.reasonCode ?? 'KNOWLEDGE_DENIED')}  secretRef=${esc(d.secretRef ?? '?')}]</span>\n`
    }
    if (r.filterResult.rollHint) {
      inner += `\n  <span class="warn">rollHint: ${esc(r.filterResult.rollHint.ui提示)}</span>`
    }
    inner += `</div>`

    // 可点击的 permitted 按钮
    if (r.filterResult.permitted.length > 0) {
      inner += `<div class="section"><h3>点击 permitted 选项驱动 runTick:</h3><div class="btn-group">`
      for (const p of r.filterResult.permitted) {
        const ids = r.menuWithIds.filter(o => o.verb === p.verb && o.targetEntityId === p.targetEntityId)
        for (const opt of ids) {
          inner += `<button class="btn btn-action" data-run-option="${esc(opt.option_id)}">${esc(opt.option_id)}</button>`
        }
      }
      inner += `</div></div>`
    }
  }

  inner += `</div>`
  return inner
}

function renderChainSection(): string {
  const quickTests = S.fixtureId === 'base'
    ? [
        ['对话:npc_wang',    '合法(GATE_SKIPPED)'],
        ['malformed',        '格式错误(BAD_FORMAT)'],
        ['飞行:npc_wang',    '非法(NOT_IN_MENU)'],
        ['询问:npc_wang',    '越权(KNOWLEDGE_DENIED)'],
      ] as [string, string][]
    : []

  let inner = `
<div class="section">
  <h2>option_id 校验链</h2>
  <div class="input-row">
    <input type="text" id="opt-input" class="text-input" placeholder="输入 option_id (如 对话:npc_wang)" value="${esc(S.validInput)}"/>
    <button class="btn btn-primary" id="btn-validate">校验</button>
  </div>`

  if (quickTests.length > 0) {
    inner += `<div class="helper-text">快速测试（仅基础 fixture）:</div><div class="btn-group">`
    for (const [optId, label] of quickTests) {
      inner += `<button class="btn btn-sm" data-quick="${esc(optId)}">${esc(label)}</button>`
    }
    inner += `</div>`
  }

  if (S.lastChain) {
    const r = S.lastChain
    inner += `<div class="chain-result ${r.passed ? 'chain-pass' : 'chain-fail'}">`
    for (const s of r.steps) {
      const icon  = s.pass ? '✅' : '❌'
      const code  = s.reasonCode ? ` <span class="warn">[${esc(s.reasonCode)}]</span>` : ''
      const det   = s.detail ? ` <span class="dim">· ${esc(s.detail)}</span>` : ''
      inner += `<div class="chain-step">${icon} <strong>${esc(s.stepName)}</strong>${code}${det}</div>`
    }
    inner += r.passed
      ? `<div class="chain-verdict ok">→ ✅ 全链通过</div>`
      : `<div class="chain-verdict err">→ ❌ 拒绝于「${esc(r.rejectStep ?? '')}」 原因码: ${esc(r.rejectCode ?? '')}</div>`
    inner += `</div>`
  }

  inner += `</div>`
  return inner
}

function renderLatestDiffPanel(): string {
  const d = S.diffs[S.diffs.length - 1]!
  return `<div class="diff-col"><div class="panel-label">State Diff（第 ${S.diffs.length} 拍·最新）</div><div class="result-box">${diffToHtml(d)}</div></div>`
}

function renderNarrativePanel(): string {
  const modeLabel = S.llmMode === 'llm' ? 'llmDemo 真 LLM' : 'demo scriptedNarrative'
  const modeClass = S.llmMode === 'llm' ? 'mode-tag-llm' : 'mode-tag-demo'

  let inner = `<div class="panel-label">叙事·出字</div>`
  inner += `<div class="narrative-meta"><span class="mode-tag ${modeClass}">${esc(modeLabel)}</span>`
  if (S.forceFailure) inner += `<span class="mode-tag mode-tag-warn">强制失败注入:开</span>`
  inner += `</div>`

  if (S.narrativeLoading) {
    inner += `<div class="narrative-loading">⏳ 生成叙事中…</div>`
  } else if (S.lastNarrative) {
    const r = S.lastNarrative
    const fallbackBadge = r.isFallback
      ? `<span class="fallback-badge fallback-on">⚠ isFallback=true · LLM 降级·走默认 option</span>`
      : `<span class="fallback-badge fallback-off">isFallback=false</span>`
    const usedDefaultBadge = r.usedDefault
      ? `<span class="fallback-badge fallback-on">usedDefault=true</span>`
      : ''
    inner += `<div class="narrative-badges">${fallbackBadge}${usedDefaultBadge}</div>`
    inner += `<div class="narrative-option-id dim">option: ${esc(r.optionId)}</div>`
    inner += `<div class="prose-box">${esc(r.narrative)}</div>`
  } else if (S.lastChain && !S.lastChain.passed) {
    inner += `<div class="narrative-rejected"><span class="err">✗ 校验失败 → 无叙事</span><br/><span class="dim">拒绝于「${esc(S.lastChain.rejectStep ?? '')}」 原因码: ${esc(S.lastChain.rejectCode ?? '')}</span></div>`
  } else {
    inner += `<div class="dim narrative-empty">（点击 permitted 选项后出字）</div>`
  }

  return `<div class="narrative-col">${inner}</div>`
}

function diffToHtml(d: TickDiffResult): string {
  let s = `<span class="dim">tickId:</span> ${esc(d.tickId)}\n`
  s += `<span class="dim">phases:</span> ${esc(d.settledPhases.join(' → '))}\n`
  s += `\n<span class="dim">认知变更 (${d.cognitiveChanges.length}):</span>\n`
  if (d.cognitiveChanges.length === 0) {
    s += `  <span class="dim">（无变更）</span>\n`
  } else {
    for (const c of d.cognitiveChanges) {
      const bef = c.before !== undefined ? `${c.before}→` : '<span class="ok">新增</span>→'
      s += `  ${esc(c.observer)}→${esc(c.target)} <span class="warn">[${esc(c.tag)}/${esc(c.polarity)}]</span> 强度: ${bef}${c.after}${c.isNew ? ' <span class="ok">★新</span>' : ''}\n`
    }
  }
  s += `\n<span class="dim">关系 Phase6 候选 (score≥${PHASE6_THRESHOLD}, ${d.relationHits.length} 条):</span>\n`
  if (d.relationHits.length === 0) {
    s += `  <span class="dim">（无边达 Phase6 阈值）</span>\n`
  } else {
    for (const r of d.relationHits) {
      s += `  <span class="ok">★</span> ${esc(r.from)} ─[${esc(r.type)} ${r.strength}×${r.trust}/100=score<span class="ok">${r.score.toFixed(1)}</span>]→ ${esc(r.to)}\n`
    }
  }
  s += `\n<span class="dim">资源变更 (${d.resourceChanges.length}):</span>\n`
  if (d.resourceChanges.length === 0) {
    s += `  <span class="dim">（无变更）</span>`
  } else {
    for (const r of d.resourceChanges) {
      const sign = r.delta > 0 ? '+' : ''
      s += `  ${esc(r.entity)} ${esc(r.currency)}: ${r.before}→${r.after} <span class="${r.delta > 0 ? 'ok' : 'err'}">(${sign}${r.delta})</span>\n`
    }
  }
  return s
}

// ── Tab: 时间控制 ─────────────────────────────────────────────────────────────

function renderTimeTab(): string {
  const tc = S.timeCtrl
  const tickCount = tc?.getTickCount() ?? (S.state._tick?.拍计数 ?? 0)
  const worldTime = tc ? tc.worldTimeAt(tickCount) : '—'

  const timeline = buildIncrementalView(S.diffs)

  let html = `<div class="tab-content">`

  // 时间控制面板
  html += `
<div class="section">
  <h2>时间推进控制</h2>
  <div class="time-controls">
    <span class="tick-display">拍 ${tickCount}</span>
    <span class="dim">${esc(worldTime)}</span>
    <button class="btn btn-action" id="btn-step1">单步 +1</button>
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
</div>`

  // LLM 模式 + 失败注入
  html += `
<div class="section">
  <h2>LLM 模式 + 失败注入</h2>
  <div class="btn-group">
    <button class="btn${S.llmMode === 'demo' ? ' btn-action' : ''}" id="btn-llm-demo">demo（脚本叙事）</button>
    <button class="btn${S.llmMode === 'llm'  ? ' btn-action' : ''}" id="btn-llm-real">llm（真实 LLM）</button>
    <button class="btn${S.forceFailure ? ' btn-warn' : ''}" id="btn-force-fail">
      强制 LLM 失败: ${S.forceFailure ? '开' : '关'}
    </button>
  </div>
  <div class="dim" style="font-size:11px;margin-top:6px;">
    ${S.llmMode === 'llm'
      ? '⚠ LLM 模式需 DEEPSEEK_API_KEY（浏览器无密钥→自动降级 isFallback=true）'
      : '✓ demo 模式：脚本占位叙事，不调用 LLM，完全确定性'}
  </div>
</div>`

  // 时间线增量视图
  html += `<div class="section"><h2>时间线增量视图（${timeline.length} 拍）</h2>`
  if (timeline.length === 0) {
    html += `<div class="dim" style="padding:8px">（尚无拍记录·点「单步」推进）</div>`
  } else {
    html += `<div class="timeline-log">`
    for (const entry of [...timeline].reverse()) {
      const hasChanges = entry.cognitiveChangesCount > 0 || entry.resourceChangesCount > 0
      html += `<div class="timeline-entry${hasChanges ? ' has-changes' : ''}">
        [${esc(entry.tickId)}] ${esc(entry.summary)}
        <span class="dim">新印象×${entry.newImpressions} 强增×${entry.strengthIncreases} 关系触发×${entry.relationHitsCount}</span>
      </div>`
    }
    html += `</div>`
  }
  html += `</div>`

  // 最新 diff
  if (S.diffs.length > 0) {
    html += `<div class="section"><h2>最新拍 State Diff</h2><div class="result-box">${diffToHtml(S.diffs[S.diffs.length - 1]!)}</div></div>`
  }

  html += `</div>`
  return html
}

// ── Tab: 关系网（C2 实装·此处骨架） ──────────────────────────────────────────

function renderGraphTab(): string {
  const graph = buildRelationGraph(S.state)
  return `<div class="tab-content">${renderGraphSection(graph)}</div>`
}

function renderGraphSection(graph: RelationGraph): string {
  const W = 620, H = 420
  const cx = W / 2, cy = H / 2
  const N  = graph.nodes.length

  // 确定性圆形布局（禁 Math.random）
  const positions = graph.nodes.map((_, i) => {
    const angle = N > 1 ? (2 * Math.PI * i) / N - Math.PI / 2 : 0
    const r = N <= 1 ? 0 : Math.min(W, H) * 0.37
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
  })
  const posMap = new Map(graph.nodes.map((n, i) => [n.key, positions[i]!]))

  let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;margin:auto">`

  // 边（先画边，节点在上层）
  for (const e of graph.edges) {
    const p1 = posMap.get(e.from)
    const p2 = posMap.get(e.to)
    if (!p1 || !p2) continue
    const color  = e.isHighlighted ? '#ff6b35' : '#3a4050'
    const width  = e.isHighlighted ? 2.5 : 1.2
    const opacity = e.isHighlighted ? '0.9' : '0.5'
    svg += `<line x1="${p1.x.toFixed(1)}" y1="${p1.y.toFixed(1)}" x2="${p2.x.toFixed(1)}" y2="${p2.y.toFixed(1)}" stroke="${color}" stroke-width="${width}" opacity="${opacity}"/>`
    // score label on highlighted edges
    if (e.isHighlighted) {
      const mx = ((p1.x + p2.x) / 2).toFixed(1)
      const my = ((p1.y + p2.y) / 2).toFixed(1)
      svg += `<text x="${mx}" y="${my}" text-anchor="middle" fill="#ff9d6e" font-size="9" font-family="monospace">${e.score.toFixed(0)}</text>`
    }
  }

  // 节点
  for (const n of graph.nodes) {
    const pos = posMap.get(n.key)
    if (!pos) continue
    const hasClusters = n.orgKeys.length > 0
    const fill   = hasClusters ? '#1f3a5c' : '#1e2a1e'
    const stroke = hasClusters ? '#4a9eff' : '#3fb950'
    const name   = n.name.length > 5 ? n.name.slice(0, 4) + '…' : n.name
    svg += `<circle cx="${pos.x.toFixed(1)}" cy="${pos.y.toFixed(1)}" r="20" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`
    svg += `<text x="${pos.x.toFixed(1)}" y="${(pos.y - 4).toFixed(1)}" text-anchor="middle" fill="#c9d1d9" font-size="9" font-family="sans-serif">${esc(name)}</text>`
    svg += `<text x="${pos.x.toFixed(1)}" y="${(pos.y + 8).toFixed(1)}" text-anchor="middle" fill="#8b949e" font-size="8" font-family="monospace">${esc(n.key.slice(0, 8))}</text>`
  }

  if (N === 0) {
    svg += `<text x="${cx}" y="${cy}" text-anchor="middle" fill="#8b949e" font-size="14">无 NPC 节点</text>`
  }

  svg += `</svg>`

  let html = `<div class="section"><h2>关系网拓扑图</h2>`
  html += `<div class="graph-container">${svg}
  <div class="graph-legend">
    <span class="legend-item"><svg width="24" height="4"><line x1="0" y1="2" x2="24" y2="2" stroke="#ff6b35" stroke-width="2.5"/></svg> 高亮边 score≥${PHASE6_THRESHOLD}（涟漪可触发）×${graph.highlightedEdgeCount}</span>
    <span class="legend-item"><svg width="24" height="4"><line x1="0" y1="2" x2="24" y2="2" stroke="#3a4050" stroke-width="1.2"/></svg> 弱边×${graph.weakEdgeCount}</span>
    <span class="legend-item"><svg width="14" height="14"><circle cx="7" cy="7" r="6" fill="#1f3a5c" stroke="#4a9eff" stroke-width="1.5"/></svg> 有组织节点</span>
    <span class="legend-item"><svg width="14" height="14"><circle cx="7" cy="7" r="6" fill="#1e2a1e" stroke="#3fb950" stroke-width="1.5"/></svg> 无组织节点</span>
  </div>
  </div></div>`

  // 节点·边明细表
  html += `<div class="section"><h2>节点明细（${graph.nodes.length}）</h2><div class="result-box">`
  for (const n of graph.nodes) {
    const orgStr = n.orgKeys.length > 0 ? ` [org: ${esc(n.orgKeys.join(', '))}]` : ''
    html += `  ${esc(n.key)} · ${esc(n.name)}${n.location ? ` @ ${esc(n.location)}` : ''}${orgStr}\n`
  }
  html += `</div></div>`

  html += `<div class="section"><h2>边明细（${graph.edges.length}）</h2><div class="result-box">`
  for (const e of graph.edges) {
    const hi = e.isHighlighted ? `<span class="ok">★ score=${e.score.toFixed(1)}</span>` : `<span class="dim">score=${e.score.toFixed(1)}</span>`
    html += `  ${esc(e.from)} ─[${esc(e.type)} 强度=${e.strength}×信任${e.trust}/100]→ ${esc(e.to)} ${hi}\n`
  }
  if (graph.edges.length === 0) html += `  <span class="dim">（无关系边）</span>`
  html += `</div></div>`

  return html
}

// ── Tab: POV 视角 ─────────────────────────────────────────────────────────────

function renderPOVTab(): string {
  const npcKeys = Object.keys(S.state.NPC)
  const selOpts = npcKeys.map(k => `<option value="${esc(k)}"${k === S.povA ? ' selected' : ''}>${esc(k)} · ${esc(S.state.NPC[k]!.姓名)}</option>`).join('')
  const selOptsB = npcKeys.map(k => `<option value="${esc(k)}"${k === S.povB ? ' selected' : ''}>${esc(k)} · ${esc(S.state.NPC[k]!.姓名)}</option>`).join('')

  const rA = S.povA && S.state.NPC[S.povA] ? povInspect(S.state, S.povA) : null
  const rB = S.povB && S.state.NPC[S.povB] ? povInspect(S.state, S.povB) : null

  let html = `<div class="tab-content"><div class="section"><h2>NPC 视角（POV）切换</h2>`

  html += `<div class="input-row">
    <label>POV A: <select id="pov-a-sel">${selOpts}</select></label>
    <label>POV B: <select id="pov-b-sel">${selOptsB}</select></label>
    <button class="btn btn-primary" id="btn-pov-compare">并排比对</button>
  </div>`

  html += `<div class="pov-grid">`

  html += `<div class="pov-col"><h3>POV A: ${esc(S.povA)}</h3>${rA ? povHtml(rA) : '<span class="dim">—</span>'}</div>`
  html += `<div class="pov-col"><h3>POV B: ${esc(S.povB)}</h3>${rB ? povHtml(rB) : '<span class="dim">—</span>'}</div>`

  html += `</div>` // pov-grid

  if (rA && rB) {
    const cmp = comparePOVs(S.state, S.povA, S.povB)
    html += `<div class="pov-diff"><h3>并排 diff A(${esc(S.povA)}) / B(${esc(S.povB)}):</h3>`
    html += `<div class="result-box">`
    html += `只有 A 可见秘密: <span class="ok">${cmp.onlyA.join(', ') || '（无）'}</span>\n`
    html += `只有 B 可见秘密: <span class="ok">${cmp.onlyB.join(', ') || '（无）'}</span>\n`
    html += `双方均可见:       <span class="warn">${cmp.both.join(', ') || '（无）'}</span>\n`
    html += `\n认知 A 多: <span class="dim">${cmp.cognitiveOnlyA.join(', ') || '无'}</span>\n`
    html += `认知 B 多: <span class="dim">${cmp.cognitiveOnlyB.join(', ') || '无'}</span>`
    html += `</div></div>`
  }

  html += `</div></div>` // section + tab-content
  return html
}

function povHtml(r: ReturnType<typeof povInspect>): string {
  let s = `<div class="result-box" style="font-size:11px">`
  s += `可见秘密 (${r.visibleSecretIds.length}): <span class="ok">${r.visibleSecretIds.join(', ') || '无'}</span>\n`
  s += `隐藏秘密 (existence-opaque): <span class="dim">${r.hiddenSecretCount}</span>\n`
  s += `认知目标数: <span class="warn">${r.cognitiveTargetKeys.length}</span>\n`
  for (const [tgt, proj] of Object.entries(r.cognitiveProjection)) {
    s += `  → ${esc(tgt)}: 了解度=${proj.了解度} 印象×${proj.impressionCount}\n`
  }
  s += `</div>`
  return s
}

// ── Tab: 快照·回放 ────────────────────────────────────────────────────────────

function renderSnapshotTab(): string {
  const savedSnaps = S.snapshotStore.list()

  let html = `<div class="tab-content">`

  // 保存快照
  html += `<div class="section"><h2>全局状态快照</h2>
  <div class="snapshot-row">
    <input type="text" id="snap-label" value="${esc(S.snapshotLabel)}" style="width:120px" placeholder="快照标签"/>
    <button class="btn btn-primary" id="btn-snap-save">保存快照</button>
  </div>`

  if (savedSnaps.length > 0) {
    html += `<div class="helper-text">已保存快照（${savedSnaps.length}）:</div><ul class="snapshot-list">`
    for (const label of savedSnaps) {
      const snap = S.snapshotStore.get(label)
      html += `<li><span>${esc(label)}</span><span class="dim">tick=${snap?.tickCount} NPC=${snap?.npcCount}</span></li>`
    }
    html += `</ul>`

    if (savedSnaps.length >= 2) {
      html += `<div class="input-row">
        比对:
        <select id="snap-sel-a">${savedSnaps.map(l => `<option${l === S.snapSelA ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>
        vs
        <select id="snap-sel-b">${savedSnaps.map(l => `<option${l === S.snapSelB ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>
        <button class="btn btn-primary" id="btn-snap-compare">比对</button>
      </div>`
    }

    if (S.snapSelA && S.snapSelB && S.snapSelA !== S.snapSelB) {
      try {
        const diff = S.snapshotStore.compare(S.snapSelA, S.snapSelB)
        html += `<div class="result-box">`
        html += `比对 [${esc(diff.labelA)}] vs [${esc(diff.labelB)}]\n`
        html += `摘要: <span class="ok">${esc(diff.summary)}</span>\n`
        html += `变更字段数: ${diff.changedFields.length}\n`
        for (const f of diff.changedFields) {
          html += `  ${esc(f.field)}: <span class="err">${esc(JSON.stringify(f.before))}</span> → <span class="ok">${esc(JSON.stringify(f.after))}</span>\n`
        }
        html += `</div>`
      } catch {
        // snapshots may have been cleared
      }
    }
  }

  html += `</div>`

  // 动作序列记录器
  html += `<div class="section"><h2>动作序列记录与重放</h2>`
  html += `<div class="helper-text">使用菜单·校验 tab 中的 permitted 按钮点击动作，记录后在此重放。</div>`
  html += `<div class="btn-group">
    <button class="btn btn-warn" id="btn-rec-reset">重置记录器</button>
    <button class="btn btn-primary" id="btn-rec-replay">从基态重放</button>
  </div>`
  html += `<div class="helper-text">已记录动作: ${S.recActions.length} 步</div>`

  if (S.recActions.length > 0) {
    html += `<div class="replay-log">`
    S.recActions.forEach((a, i) => {
      html += `  [${i}] ${esc(a)}\n`
    })
    html += `</div>`
  }

  html += `</div></div>`
  return html
}

// ── Tab: 状态树·地图 ─────────────────────────────────────────────────────────

function renderTreeTab(): string {
  const tree = buildStateTree(S.state)
  const map  = buildMapThumbnail(S.state)

  let html = `<div class="tab-content">`

  // PC 面板
  if (S.pcKey && S.state.NPC[S.pcKey]) {
    try {
      const panel = buildPCPanel(S.state, S.pcKey)
      html += `<div class="section"><h2>主角面板 · ${esc(panel.name)} (${esc(panel.pcKey)})</h2>`
      html += `<div class="stat-row"><span class="stat-label">位置</span><span class="stat-value">${esc(panel.location ?? '—')}</span></div>`
      html += `<div class="stat-row"><span class="stat-label">HP</span><span class="stat-value">${panel.hp} / ${panel.hpMax}</span></div>`
      html += `<div class="stat-row"><span class="stat-label">精力</span><span class="stat-value">${panel.energy} / ${panel.energyMax}</span></div>`
      html += `<div class="stat-row"><span class="stat-label">货币</span><span class="stat-value">${Object.entries(panel.currencies).map(([c, a]) => `${a}${esc(c)}`).join('  ') || '—'}</span></div>`
      html += `<div class="stat-row"><span class="stat-label">关系边</span><span class="stat-value">${panel.relationsCount}</span></div>`
      html += `<div class="stat-row"><span class="stat-label">认知目标</span><span class="stat-value">${panel.cognitiveTargets}</span></div>`
      html += `<div class="stat-row"><span class="stat-label">已知秘密</span><span class="stat-value ok">${panel.knownSecretIds.join(', ') || '无'}</span></div>`
      html += `<div class="attr-grid">`
      for (const [k, v] of Object.entries(panel.attributes)) {
        html += `<div class="attr-cell"><div class="attr-name">${esc(k)}</div><div class="attr-val">${v}</div></div>`
      }
      html += `</div></div>`
    } catch {
      // pcKey not in this fixture
    }
  }

  // 地图缩略图
  html += `<div class="section"><h2>地图缩略图（LOD 占位·待 G7）</h2>`
  html += `<table class="map-table"><thead><tr><th>地点键</th><th>名称</th><th>类别</th><th>大小</th><th>NPC数</th><th>LOD</th></tr></thead><tbody>`
  for (const loc of map.locations) {
    html += `<tr>
      <td><code>${esc(loc.key)}</code></td>
      <td>${esc(loc.name)}</td>
      <td>${esc(loc.category)}</td>
      <td>${esc(loc.size)}</td>
      <td>${loc.npcCount}</td>
      <td><span class="lod-placeholder">${esc(loc.lodStatus)}（待 G7）</span></td>
    </tr>`
  }
  if (map.locations.length === 0) {
    html += `<tr><td colspan="6" class="dim">（无地图数据）</td></tr>`
  }
  html += `</tbody></table>`
  html += `<div class="dim" style="font-size:11px;margin-top:6px">lodSystemStatus: ${esc(map.lodSystemStatus)}（灰显占位·不伪造·待 G7 实装）</div>`
  html += `</div>`

  // 可折叠状态树
  html += `<div class="section"><h2>世界状态树</h2><div class="tree-root">${renderTreeNode(tree)}</div></div>`

  html += `</div>`
  return html
}

function renderTreeNode(node: StateTreeNode, depth = 0): string {
  if (!node.children || node.children.length === 0) {
    const val = node.value !== undefined ? `: <span class="ok">${esc(String(node.value))}</span>` : ''
    return `<div class="tree-leaf">${esc(node.label)}${val}</div>`
  }
  const open = !node.collapsed || depth === 0 ? ' open' : ''
  const children = node.children.map(c => renderTreeNode(c, depth + 1)).join('')
  return `<details${open}><summary>${esc(node.label)}</summary><div class="tree-body">${children}</div></details>`
}

// ── 主渲染器 ──────────────────────────────────────────────────────────────────

function renderApp(): void {
  const app = document.getElementById('app')
  if (!app) return

  let tabContent = ''
  switch (S.activeTab) {
    case 'menu':     tabContent = renderMenuTab();     break
    case 'time':     tabContent = renderTimeTab();     break
    case 'graph':    tabContent = renderGraphTab();    break
    case 'pov':      tabContent = renderPOVTab();      break
    case 'snapshot': tabContent = renderSnapshotTab(); break
    case 'tree':     tabContent = renderTreeTab();     break
  }

  app.innerHTML = renderHeader() + renderTabBar() + tabContent
  attachEventListeners()
}

// ── 事件绑定 ──────────────────────────────────────────────────────────────────

function attachEventListeners(): void {
  // fixture 切换
  document.getElementById('fixture-sel')?.addEventListener('change', e => {
    switchFixture((e.target as HTMLSelectElement).value as FixtureId)
    renderApp()
  })

  // tab 切换
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      S.activeTab = (btn as HTMLElement).dataset['tab'] as TabId
      renderApp()
    })
  })

  // 菜单检视
  document.getElementById('btn-inspect-menu')?.addEventListener('click', () => {
    S.lastMenu = inspectMenu(S.state, S.pcKey, S.rawCandidates)
    renderApp()
  })

  // permitted 选项点击 → runValidationChain → runTickWithDiff + runActionInDualMode
  document.querySelectorAll('[data-run-option]').forEach(btn => {
    btn.addEventListener('click', () => {
      const optId = (btn as HTMLElement).dataset['runOption']!
      S.validInput = optId
      S.lastNarrative = null
      S.narrativeLoading = false
      S.lastChain = runValidationChain(optId, S.state, S.pcKey, S.rawCandidates)
      if (S.lastChain.passed) {
        // 捕获 pre-tick 状态用于叙事组装（assemblePrompt 需要行动前的世界）
        const preTick = S.state
        const tid  = `debug:${S.seed}:tick:${S.state._tick?.拍计数 ?? S.diffs.length}`
        const diff = runTickWithDiff(preTick, tid)
        S.diffs = [...S.diffs.slice(-(MAX_DIFFS - 1)), diff]
        S.state = diff.afterState
        S.recorder?.record(optId)
        S.recActions = [...S.recActions, optId]
        // 异步叙事生成（校验已通过·走合法路径）
        S.narrativeLoading = true
        renderApp()
        runActionInDualMode(preTick, S.pcKey, optId, S.rawCandidates, S.llmMode, {
          forceFailure: S.forceFailure,
        }).then(result => {
          S.lastNarrative = result
          S.narrativeLoading = false
          renderApp()
        }).catch(err => {
          console.error('[G1b3c] runActionInDualMode error:', err)
          S.lastNarrative = {
            narrative: `[叙事生成异常] ${err instanceof Error ? err.message : String(err)}`,
            isFallback: true,
            optionId: optId,
            usedDefault: false,
          }
          S.narrativeLoading = false
          renderApp()
        })
        return
      }
      renderApp()
    })
  })

  // 校验链输入
  const optInput = document.getElementById('opt-input') as HTMLInputElement | null
  optInput?.addEventListener('input', () => { S.validInput = optInput.value })

  document.getElementById('btn-validate')?.addEventListener('click', () => {
    const val = (document.getElementById('opt-input') as HTMLInputElement | null)?.value ?? ''
    S.validInput = val
    if (val) {
      S.lastChain = runValidationChain(val, S.state, S.pcKey, S.rawCandidates)
      renderApp()
    }
  })

  // 快速测试按钮
  document.querySelectorAll('[data-quick]').forEach(btn => {
    btn.addEventListener('click', () => {
      const optId = (btn as HTMLElement).dataset['quick']!
      S.validInput = optId
      S.lastChain  = runValidationChain(optId, S.state, S.pcKey, S.rawCandidates)
      renderApp()
    })
  })

  // 时间控制
  document.getElementById('btn-step1')?.addEventListener('click', () => {
    if (!S.timeCtrl) return
    const diffs = S.timeCtrl.step(1)
    S.state = S.timeCtrl.getCurrentState()
    S.diffs = [...S.diffs.slice(-(MAX_DIFFS - diffs.length)), ...diffs]
    renderApp()
  })

  document.getElementById('btn-step5')?.addEventListener('click', () => {
    if (!S.timeCtrl) return
    const diffs = S.timeCtrl.step(5)
    S.state = S.timeCtrl.getCurrentState()
    S.diffs = [...S.diffs.slice(-(MAX_DIFFS - diffs.length)), ...diffs]
    renderApp()
  })

  document.getElementById('btn-stepn')?.addEventListener('click', () => {
    if (!S.timeCtrl) return
    const n = parseInt((document.getElementById('step-n') as HTMLInputElement | null)?.value ?? '1', 10)
    const diffs = S.timeCtrl.step(Math.max(1, Math.min(50, n)))
    S.state = S.timeCtrl.getCurrentState()
    S.diffs = [...S.diffs.slice(-(MAX_DIFFS - diffs.length)), ...diffs]
    renderApp()
  })

  document.getElementById('btn-jump')?.addEventListener('click', () => {
    if (!S.timeCtrl) return
    const target = parseInt((document.getElementById('jump-tick') as HTMLInputElement | null)?.value ?? '0', 10)
    S.state = S.timeCtrl.jumpTo(Math.max(0, target))
    renderApp()
  })

  document.getElementById('btn-replay')?.addEventListener('click', () => {
    if (!S.timeCtrl) return
    S.state = S.timeCtrl.replay()
    S.diffs = []
    renderApp()
  })

  // LLM 模式
  document.getElementById('btn-llm-demo')?.addEventListener('click', () => { S.llmMode = 'demo'; renderApp() })
  document.getElementById('btn-llm-real')?.addEventListener('click', () => { S.llmMode = 'llm';  renderApp() })
  document.getElementById('btn-force-fail')?.addEventListener('click', () => { S.forceFailure = !S.forceFailure; renderApp() })

  // POV 选择
  document.getElementById('pov-a-sel')?.addEventListener('change', e => {
    S.povA = (e.target as HTMLSelectElement).value; renderApp()
  })
  document.getElementById('pov-b-sel')?.addEventListener('change', e => {
    S.povB = (e.target as HTMLSelectElement).value; renderApp()
  })
  document.getElementById('btn-pov-compare')?.addEventListener('click', () => renderApp())

  // 快照
  document.getElementById('btn-snap-save')?.addEventListener('click', () => {
    const label = (document.getElementById('snap-label') as HTMLInputElement | null)?.value ?? 'snap'
    S.snapshotLabel = label
    S.snapshotStore.save(label, S.state)
    renderApp()
  })

  document.getElementById('snap-sel-a')?.addEventListener('change', e => { S.snapSelA = (e.target as HTMLSelectElement).value })
  document.getElementById('snap-sel-b')?.addEventListener('change', e => { S.snapSelB = (e.target as HTMLSelectElement).value })

  document.getElementById('btn-snap-compare')?.addEventListener('click', () => {
    S.snapSelA = (document.getElementById('snap-sel-a') as HTMLSelectElement | null)?.value ?? ''
    S.snapSelB = (document.getElementById('snap-sel-b') as HTMLSelectElement | null)?.value ?? ''
    renderApp()
  })

  // 记录器
  document.getElementById('btn-rec-reset')?.addEventListener('click', () => {
    S.recorder   = new ActionRecorder(S.seed, S.state)
    S.recActions = []
    renderApp()
  })

  document.getElementById('btn-rec-replay')?.addEventListener('click', () => {
    if (!S.recorder) return
    const replayState = S.recorder.replay()
    const orig        = S.recorder.getCurrentState()
    const ok = JSON.stringify(replayState) === JSON.stringify(orig)
    alert(`重放完成 · 逐位恒等: ${ok ? '✅ YES' : '❌ NO'}`)
  })
}

// ── 启动 ──────────────────────────────────────────────────────────────────────

window.addEventListener('unhandledrejection', e => {
  console.error('[G1b3c] 未处理异常:', e.reason)
})

document.addEventListener('DOMContentLoaded', () => {
  renderApp()
})
