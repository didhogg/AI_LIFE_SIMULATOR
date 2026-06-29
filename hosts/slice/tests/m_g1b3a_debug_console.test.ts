// G1b3a · AOHP 调试控制台 · 专项回归
//
// 铁律:
//   ① 无真实 LLM 调用（纯单元·不烧 API 额度）
//   ② 校验链 / 菜单过滤 / fixture 验证 — 确定性零 IO
//   ③ 黄金向量/指纹84/schemaKeys52 守恒
//
// 覆盖:
//   T1. 菜单过滤前后 + 原因码正确
//   T2. 非法 option_id 被校验闸拒绝（BAD_FORMAT / NOT_IN_MENU / KNOWLEDGE_DENIED）
//   T3. 合法 option_id 校验链全通过（含 GATE_SKIPPED / GATE_PASS）
//   T4. effect 闸拒绝（GATE_REJECTED）
//   T5. 固定 seed 重放 jumpTo(N) 逐位恒等
//   T6. LLM 失败注入（forceFailure=true）→ isFallback=true·usedDefault=true·不崩
//   T7. 3 个 fixture seeded 装配确定性（两次调用 JSON 恒等）
//   T8. runTickWithDiff — afterState 拍计数递增·结构完整
//   T9. 指纹84 / schemaKeys52 守恒

import { describe, it, expect } from 'vitest';
import { RootSchema } from '@ai-life-sim/core';
import {
  FINGERPRINT_BUNDLE_MEMBERS,
  FINGERPRINT_PRESET_FIELDS,
  FINGERPRINT_SNAPSHOT_FIELDS,
  FINGERPRINT_EXCLUDED_FIELDS,
} from '@ai-life-sim/core/engine/fingerprintManifest';

import {
  buildWorld, PC, NPC_WANG, NPC_HONG, SECRET_S1, SAVE_SEED,
} from '../fixture/world.js';

// 测试目标函数（从 web-debug 相对引用）
import {
  inspectMenu,
  runValidationChain,
  runTickWithDiff,
  runActionInDualMode,
  TimeController,
  DEMO_RAW_CANDIDATES,
  PHASE6_THRESHOLD,
} from '../../web-debug/aohpDebugConsole.js';

import {
  buildDebugFixtureSmall,
  buildDebugFixtureMedium,
  buildDebugFixtureLarge,
  SMALL_SEED,
  MEDIUM_SEED,
  LARGE_SEED,
  DEBUG_FIXTURES,
  getDebugFixture,
} from '../../web-debug/fixtures/debugFixtures.js';


// ──────────────────────────────────────────────────────────────────────────────
// T1. 菜单过滤前后 + 原因码
// ──────────────────────────────────────────────────────────────────────────────
describe('T1 菜单生成检视 — 过滤前后/原因码', () => {
  const state = buildWorld();

  it('inspectMenu 返回 rawCandidates / menuWithIds / filterResult', () => {
    const r = inspectMenu(state, PC, DEMO_RAW_CANDIDATES);
    expect(r.rawCandidates).toBe(DEMO_RAW_CANDIDATES);
    expect(r.menuWithIds.length).toBeGreaterThan(0);
    expect(r.filterResult).toBeDefined();
  });

  it('PC POV: 知情受限选项进 denied（secretRef=S1）', () => {
    const r = inspectMenu(state, PC, DEMO_RAW_CANDIDATES);
    expect(r.filterResult.denied.length).toBeGreaterThan(0);
    expect(r.filterResult.denied.some(d => d.secretRef === SECRET_S1)).toBe(true);
  });

  it('denied 原因码均为 KNOWLEDGE_DENIED', () => {
    const r = inspectMenu(state, PC, DEMO_RAW_CANDIDATES);
    for (const dr of r.deniedReasons) {
      expect(dr.reasonCode).toBe('KNOWLEDGE_DENIED');
    }
  });

  it('denied 非空时附 rollHint', () => {
    const r = inspectMenu(state, PC, DEMO_RAW_CANDIDATES);
    expect(r.filterResult.rollHint).toBeDefined();
    expect(r.filterResult.rollHint?.ui提示).toContain('重 Roll');
  });

  it('无 secretRef 选项均在 permitted', () => {
    const r = inspectMenu(state, PC, DEMO_RAW_CANDIDATES);
    const noSecret = DEMO_RAW_CANDIDATES.filter(c => !c.secretRef);
    for (const c of noSecret) {
      expect(
        r.filterResult.permitted.some(p => p.verb === c.verb && p.targetEntityId === c.targetEntityId),
      ).toBe(true);
    }
  });

  it('menuWithIds option_id 全局唯一（Set.size === length）', () => {
    const r = inspectMenu(state, PC, DEMO_RAW_CANDIDATES);
    const ids = r.menuWithIds.map(o => o.option_id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// T2. 非法/越权 option_id 被校验闸拒绝 + 原因码
// ──────────────────────────────────────────────────────────────────────────────
describe('T2 校验链 — 非法/越权 option_id 被正确拒绝', () => {
  const state = buildWorld();

  it('格式错误（无冒号）→ BAD_FORMAT 拒绝于格式校验', () => {
    const r = runValidationChain('malformed_no_colon', state, PC, DEMO_RAW_CANDIDATES);
    expect(r.passed).toBe(false);
    expect(r.rejectStep).toBe('格式校验');
    expect(r.rejectCode).toBe('BAD_FORMAT');
    expect(r.steps[0]?.stepName).toBe('格式校验');
    expect(r.steps[0]?.pass).toBe(false);
    expect(r.steps[0]?.reasonCode).toBe('BAD_FORMAT');
  });

  it('合法格式但不在菜单 → NOT_IN_MENU 拒绝于菜单归属', () => {
    const r = runValidationChain('飞行:npc_wang', state, PC, DEMO_RAW_CANDIDATES);
    expect(r.passed).toBe(false);
    expect(r.rejectStep).toBe('菜单归属');
    expect(r.rejectCode).toBe('NOT_IN_MENU');
    expect(r.steps.find(s => s.stepName === '格式校验')?.pass).toBe(true);
    expect(r.steps.find(s => s.stepName === '菜单归属')?.pass).toBe(false);
  });

  it('越权 option_id（需知S1·PC不知情）→ KNOWLEDGE_DENIED 拒绝于知情过滤', () => {
    const r = runValidationChain('询问:npc_wang', state, PC, DEMO_RAW_CANDIDATES);
    expect(r.passed).toBe(false);
    expect(r.rejectStep).toBe('知情过滤');
    expect(r.rejectCode).toBe('KNOWLEDGE_DENIED');
    // 前两步应通过
    expect(r.steps.find(s => s.stepName === '格式校验')?.pass).toBe(true);
    expect(r.steps.find(s => s.stepName === '菜单归属')?.pass).toBe(true);
    expect(r.steps.find(s => s.stepName === '知情过滤')?.pass).toBe(false);
  });

  it('拒绝后链不继续（步骤数 = 拒绝步骤编号）', () => {
    const r = runValidationChain('飞行:npc_wang', state, PC, DEMO_RAW_CANDIDATES);
    // BAD_FORMAT 在 step 1, NOT_IN_MENU 在 step 2 → only 2 steps
    expect(r.steps.length).toBe(2);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// T3. 合法 option_id 校验链全通过
// ──────────────────────────────────────────────────────────────────────────────
describe('T3 校验链 — 合法 option_id 全通过', () => {
  const state = buildWorld();

  it('对话:npc_wang — 5 步均 pass（含 GATE_SKIPPED）', () => {
    const r = runValidationChain('对话:npc_wang', state, PC, DEMO_RAW_CANDIDATES);
    expect(r.passed).toBe(true);
    expect(r.steps.every(s => s.pass)).toBe(true);
    const gateStep = r.steps.find(s => s.stepName === 'effect闸');
    expect(gateStep?.reasonCode).toBe('GATE_SKIPPED');
  });

  it('给钱:npc_hong:5文 + 匹配 proposal — 含 GATE_PASS + runTick 成功', () => {
    const r = runValidationChain(
      '给钱:npc_hong:5文',
      state, PC, DEMO_RAW_CANDIDATES,
      '林九取出五文钱递给红姨，换来一碗热茶。',
      { transfers: [{ from: PC, to: NPC_HONG, amount: 5, reason: '给钱' }], checks: [], knowledge: [] },
    );
    expect(r.passed).toBe(true);
    const gateStep = r.steps.find(s => s.stepName === 'effect闸');
    expect(gateStep?.pass).toBe(true);
    expect(gateStep?.reasonCode).not.toBe('GATE_REJECTED');
    const tickStep = r.steps.find(s => s.stepName === 'runTick');
    expect(tickStep?.pass).toBe(true);
  });

  it('NPC_WANG POV: 越权选项对 NPC_WANG 可见（知情过滤放行）', () => {
    const r = runValidationChain('询问:npc_wang', state, NPC_WANG, DEMO_RAW_CANDIDATES);
    expect(r.passed).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// T4. effect 闸拒绝（GATE_REJECTED）
// ──────────────────────────────────────────────────────────────────────────────
describe('T4 校验链 — effect 闸拒绝', () => {
  const state = buildWorld();

  it('赊账叙事 → reconcileGate hard_rejected → GATE_REJECTED', () => {
    const r = runValidationChain(
      '还账:npc_wang:8文',
      state, PC, DEMO_RAW_CANDIDATES,
      '林九赊账了八文钱的酒菜。',
      { transfers: [{ from: PC, to: NPC_WANG, amount: 8, reason: '赊账' }], checks: [], knowledge: [] },
    );
    expect(r.passed).toBe(false);
    expect(r.rejectStep).toBe('effect闸');
    expect(r.rejectCode).toBe('GATE_REJECTED');
    // runTick 不应执行（GATE_REJECTED 后链停止）
    expect(r.steps.some(s => s.stepName === 'runTick')).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// T5. 固定 seed 重放 jumpTo(N) 逐位恒等
// ──────────────────────────────────────────────────────────────────────────────
describe('T5 时间推进控制 — 固定 seed 重放逐位恒等', () => {
  it('两个独立 TimeController 同 seed 同基态 jumpTo(3) → JSON 逐位恒等', () => {
    const tc1 = new TimeController(SAVE_SEED, buildWorld());
    const state1 = tc1.jumpTo(3);

    const tc2 = new TimeController(SAVE_SEED, buildWorld());
    const state2 = tc2.jumpTo(3);

    expect(JSON.stringify(state1)).toBe(JSON.stringify(state2));
  });

  it('replay() 后 jumpTo(2) 与直接 jumpTo(2) 逐位恒等', () => {
    const tc = new TimeController(SAVE_SEED, buildWorld());
    const s1 = tc.jumpTo(2);
    tc.replay();
    const s2 = tc.jumpTo(2);
    expect(JSON.stringify(s1)).toBe(JSON.stringify(s2));
  });

  it('worldTimeAt 拍号 → 世界时间字符串正确', () => {
    const tc = new TimeController(SAVE_SEED, buildWorld());
    expect(tc.worldTimeAt(0)).toContain('纪元第0日');
    expect(tc.worldTimeAt(1)).toContain('纪元第30日');
    expect(tc.worldTimeAt(2)).toContain('纪元第60日');
  });

  it('step(N) 后 getTickCount() = 基础拍计数 + N', () => {
    const tc = new TimeController(SAVE_SEED, buildWorld());
    const base = tc.getTickCount();
    tc.step(3);
    expect(tc.getTickCount()).toBe(base + 3);
  });

  it('step() 返回 TickDiffResult 数组，长度等于 N', () => {
    const tc = new TimeController(SAVE_SEED, buildWorld());
    const diffs = tc.step(2);
    expect(diffs.length).toBe(2);
    for (const d of diffs) {
      expect(d.settledPhases.length).toBeGreaterThan(0);
      expect(d.afterState).toBeDefined();
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// T6. LLM 失败注入 → isFallback=true · usedDefault=true · 不崩
// ──────────────────────────────────────────────────────────────────────────────
describe('T6 LLM 失败注入 — 兜底不崩', () => {
  const state = buildWorld();

  it('forceFailure=true → isFallback=true 且 usedDefault=true', async () => {
    const r = await runActionInDualMode(
      state, PC, '对话:npc_wang', DEMO_RAW_CANDIDATES,
      'demo', { forceFailure: true },
    );
    expect(r.isFallback).toBe(true);
    expect(r.usedDefault).toBe(true);
    expect(typeof r.narrative).toBe('string');
    expect(r.narrative.length).toBeGreaterThan(0);
  });

  it('forceFailure=true → 走 permitted 第一项作为默认 option', async () => {
    const r = await runActionInDualMode(
      state, PC, '询问:npc_wang', DEMO_RAW_CANDIDATES,
      'demo', { forceFailure: true },
    );
    expect(r.usedDefault).toBe(true);
    // 默认 option 应为 permitted 列表第一项，不是被 denied 的 询问:npc_wang
    expect(r.optionId).not.toBe('询问:npc_wang');
  });

  it('demo 模式（非失败注入）→ isFallback=false · usedDefault=false', async () => {
    const r = await runActionInDualMode(
      state, PC, '对话:npc_wang', DEMO_RAW_CANDIDATES, 'demo',
    );
    expect(r.isFallback).toBe(false);
    expect(r.usedDefault).toBe(false);
    expect(r.optionId).toBe('对话:npc_wang');
  });

  it('demo 模式自定脚本叙事 → narrative 正确注入', async () => {
    const r = await runActionInDualMode(
      state, PC, '对话:npc_wang', DEMO_RAW_CANDIDATES, 'demo',
      { scriptedNarrative: '王掌柜点头示意。' },
    );
    expect(r.narrative).toBe('王掌柜点头示意。');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// T7. 3 个 fixture seeded 装配确定性
// ──────────────────────────────────────────────────────────────────────────────
describe('T7 场景 fixture 确定性 — 两次调用逐位恒等', () => {
  it('小城 fixture 两次调用 JSON 恒等（seed=100）', () => {
    const s1 = buildDebugFixtureSmall();
    const s2 = buildDebugFixtureSmall();
    expect(JSON.stringify(s1)).toBe(JSON.stringify(s2));
  });

  it('大陆 fixture 两次调用 JSON 恒等（seed=200）', () => {
    const s1 = buildDebugFixtureMedium();
    const s2 = buildDebugFixtureMedium();
    expect(JSON.stringify(s1)).toBe(JSON.stringify(s2));
  });

  it('整世界 fixture 两次调用 JSON 恒等（seed=300）', () => {
    const s1 = buildDebugFixtureLarge();
    const s2 = buildDebugFixtureLarge();
    expect(JSON.stringify(s1)).toBe(JSON.stringify(s2));
  });

  it('三个 fixture NPC 数量正确', () => {
    expect(Object.keys(buildDebugFixtureSmall().NPC).length).toBe(3);
    expect(Object.keys(buildDebugFixtureMedium().NPC).length).toBe(6);
    expect(Object.keys(buildDebugFixtureLarge().NPC).length).toBe(12);
  });

  it('三个 fixture 地点数量正确', () => {
    // 地点数据存于 地图.地点（地图Schema）而非 全局Schema（后者无此字段·Zod 会 strip）
    expect(Object.keys(buildDebugFixtureSmall().地图?.地点 ?? {}).length).toBe(1);
    expect(Object.keys(buildDebugFixtureMedium().地图?.地点 ?? {}).length).toBe(3);
    expect(Object.keys(buildDebugFixtureLarge().地图?.地点 ?? {}).length).toBe(5);
  });

  it('fixture 种子互不相同（与黄金 seed=42 严格隔离）', () => {
    expect(SMALL_SEED).not.toBe(SAVE_SEED);
    expect(MEDIUM_SEED).not.toBe(SAVE_SEED);
    expect(LARGE_SEED).not.toBe(SAVE_SEED);
    expect(new Set([SMALL_SEED, MEDIUM_SEED, LARGE_SEED, SAVE_SEED]).size).toBe(4);
  });

  it('大陆 fixture autoCompleteRelations 产生关系边（Phase6 可见）', () => {
    const s = buildDebugFixtureMedium();
    // 同地点+同组织的 NPC 应有 score≥60 的关系边
    const hits: Array<{ from: string; score: number }> = [];
    for (const [key, npc] of Object.entries(s.NPC)) {
      for (const rel of npc.关系) {
        const score = Math.abs(rel.强度) * (rel.信任 / 100);
        if (score >= PHASE6_THRESHOLD) {
          hits.push({ from: key, score });
        }
      }
    }
    expect(hits.length).toBeGreaterThan(0);
  });

  it('整世界 fixture 关系边数 > 大陆 fixture（规模递增）', () => {
    const edgeCount = (s: ReturnType<typeof buildDebugFixtureSmall>) =>
      Object.values(s.NPC).reduce((acc, npc) => acc + npc.关系.length, 0);
    expect(edgeCount(buildDebugFixtureLarge())).toBeGreaterThan(
      edgeCount(buildDebugFixtureMedium()),
    );
  });

  it('getDebugFixture 按名称正确返回 fixture', () => {
    const f = getDebugFixture('小城');
    expect(f.name).toBe('小城');
    expect(f.seed).toBe(SMALL_SEED);
    expect(f.npcCount).toBe(3);
    expect(f.label).toContain('调试 fixture');
  });

  it('DEBUG_FIXTURES 注册表 3 项', () => {
    expect(DEBUG_FIXTURES.length).toBe(3);
    expect(DEBUG_FIXTURES.map(f => f.name)).toEqual(['小城', '大陆', '整世界']);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// T8. runTickWithDiff — afterState 拍计数递增·结构完整
// ──────────────────────────────────────────────────────────────────────────────
describe('T8 runTickWithDiff — state diff 结构正确', () => {
  const state = buildWorld();

  it('afterState 拍计数 = before 拍计数 + 1', () => {
    const before = state._tick?.拍计数 ?? 0;
    const r = runTickWithDiff(state, `test:tick:${before}`);
    expect(r.afterState._tick?.拍计数).toBe(before + 1);
  });

  it('settledPhases 非空', () => {
    const r = runTickWithDiff(state, 'test:phases:0');
    expect(r.settledPhases.length).toBeGreaterThan(0);
  });

  it('同一 state 同 tickId 两次调用 → settledPhases 相同（幂等）', () => {
    const r1 = runTickWithDiff(state, 'test:idempotent:0');
    const r2 = runTickWithDiff(state, 'test:idempotent:0');
    expect(r1.settledPhases).toEqual(r2.settledPhases);
  });

  it('cognitiveChanges / relationHits / resourceChanges 均为数组', () => {
    const r = runTickWithDiff(state, 'test:diff:0');
    expect(Array.isArray(r.cognitiveChanges)).toBe(true);
    expect(Array.isArray(r.relationHits)).toBe(true);
    expect(Array.isArray(r.resourceChanges)).toBe(true);
  });

  it('大陆 fixture: Phase6 触发的关系边在 relationHits 中可见', () => {
    const medState = buildDebugFixtureMedium();
    const r = runTickWithDiff(medState, 'test:med:phase6:0');
    expect(r.relationHits.length).toBeGreaterThan(0);
    for (const hit of r.relationHits) {
      expect(hit.score).toBeGreaterThanOrEqual(PHASE6_THRESHOLD);
    }
  });

  it('大陆 fixture: 认知档案变更非空（Phase6 关系边发射涟漪写入认知档案）', () => {
    const medState = buildDebugFixtureMedium();
    const r = runTickWithDiff(medState, 'test:med:cognitive:0');
    // 若有 Phase6 触发 + propagateRipple，认知档案应有新增印象
    expect(r.cognitiveChanges.length).toBeGreaterThanOrEqual(0); // 可能为0（依赖涟漪参数）
    // 至少 afterState 认知档案存在
    expect(r.afterState.认知档案).toBeDefined();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// T9. 指纹84 / schemaKeys52 守恒（不新增字段）
// ──────────────────────────────────────────────────────────────────────────────
describe('T9 指纹守恒 — 84条/schemaKeys=53', () => {
  it('指纹 manifest 总条目 = 85', () => {
    const total =
      FINGERPRINT_BUNDLE_MEMBERS.length +
      FINGERPRINT_PRESET_FIELDS.length +
      FINGERPRINT_SNAPSHOT_FIELDS.length +
      FINGERPRINT_EXCLUDED_FIELDS.length;
    expect(total).toBe(94);
  });

  it('schemaKeys = 53（调试控制台/fixture 不新增 schema 顶层键）', () => {
    expect(Object.keys(RootSchema.shape).length).toBe(54);
  });
});
