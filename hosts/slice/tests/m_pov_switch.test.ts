// m_pov_switch · POV 视角切换专项回归 (P-A-bug-03)
//
// 验证 povEntityKey 切换语义正确且与 operatorKey/runTick 完全隔离:
//
//   T1. 切换 povEntityKey → 可见秘密/认知档案随之变化
//   T2. povInspect 是纯只读函数 — 不改变传入 state
//   T3. 切 POV 不影响 operatorKey（隔离验证）
//   T4. 切 POV 不触发 runTick（state.世界.纪元分钟 不变）
//   T5. comparePOVs 随 povEntityKey 变化给出正确 diff
//   T6. 指纹 84 / schemaKeys 52 在 POV 操作后守恒

import { describe, it, expect } from 'vitest';
import { RootSchema } from '@ai-life-sim/core';
import {
  FINGERPRINT_BUNDLE_MEMBERS,
  FINGERPRINT_PRESET_FIELDS,
  FINGERPRINT_SNAPSHOT_FIELDS,
  FINGERPRINT_EXCLUDED_FIELDS,
} from '@ai-life-sim/core/engine/fingerprintManifest';

import { buildWorld, PC, NPC_WANG, NPC_HONG, SECRET_S1 } from '../fixture/world.js';
import {
  povInspect,
  comparePOVs,
  computePovPersonalityProjection,
} from '../../web-debug/aohpDebugConsole2.js';

// ──────────────────────────────────────────────────────────────────────────────
// T1. 切换 povEntityKey → 投影输出随之变化
// ──────────────────────────────────────────────────────────────────────────────
describe('T1 切换 povEntityKey → 可见集·认知档案随之变化', () => {
  const state = buildWorld();

  it('NPC_WANG POV 可见 SECRET_S1', () => {
    const r = povInspect(state, NPC_WANG);
    expect(r.visibleSecretIds).toContain(SECRET_S1);
  });

  it('PC POV 不可见 SECRET_S1（existence-opaque）', () => {
    const r = povInspect(state, PC);
    expect(r.visibleSecretIds).not.toContain(SECRET_S1);
  });

  it('切换 povEntityKey 后可见集从 PC 变为 NPC_WANG（输出差异化）', () => {
    const rPC   = povInspect(state, PC);
    const rWang = povInspect(state, NPC_WANG);
    // 两者可见集不完全相同
    const pcSet   = new Set(rPC.visibleSecretIds);
    const wangSet = new Set(rWang.visibleSecretIds);
    // NPC_WANG 至少多见 SECRET_S1
    expect(wangSet.has(SECRET_S1)).toBe(true);
    expect(pcSet.has(SECRET_S1)).toBe(false);
    // 整体结果不等
    expect(JSON.stringify(rPC.visibleSecretIds.sort())).not.toBe(
      JSON.stringify(rWang.visibleSecretIds.sort())
    );
  });

  it('认知目标键 NPC_HONG POV 与 PC POV 可能不同', () => {
    const rHong = povInspect(state, NPC_HONG);
    const rPC   = povInspect(state, PC);
    // 两者各自的 cognitiveTargetKeys 是独立的
    expect(Array.isArray(rHong.cognitiveTargetKeys)).toBe(true);
    expect(Array.isArray(rPC.cognitiveTargetKeys)).toBe(true);
    // 不要求它们不同（fixture 可能没有认知数据），但结构存在
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// T2. povInspect 纯只读 — 不改变传入 state
// ──────────────────────────────────────────────────────────────────────────────
describe('T2 povInspect 纯只读 — 不改变 state', () => {
  it('调用前后 state JSON 完全恒等', () => {
    const state = buildWorld();
    const before = JSON.stringify(state);

    // 多次切换 povEntityKey，每次调用 povInspect
    povInspect(state, NPC_WANG);
    povInspect(state, PC);
    povInspect(state, NPC_HONG);
    povInspect(state, NPC_WANG); // 再次切换回去

    const after = JSON.stringify(state);
    expect(after).toBe(before);
  });

  it('多次切换 POV 后 state 快照哈希恒等（无副作用）', () => {
    const stateA = buildWorld();
    const stateB = buildWorld();

    // stateA: 切换一次 POV
    povInspect(stateA, NPC_WANG);
    // stateB: 不调用 povInspect

    // 两者 state 仍然相同（povInspect 不写 state）
    expect(JSON.stringify(stateA)).toBe(JSON.stringify(stateB));
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// T3. 切 POV 不影响 operatorKey（数据层验证）
// ──────────────────────────────────────────────────────────────────────────────
describe('T3 切 POV 不影响 operatorKey', () => {
  it('povInspect 不读取/写入 operatorKey 字段（state 无 operatorKey 顶层字段）', () => {
    const state = buildWorld();
    // operatorKey 在 web-debug UI 层 (S.operatorKey)，不进 RootState
    // 验证 state 本身没有 operatorKey 字段（确保 UI 层和 state 层解耦）
    expect((state as Record<string, unknown>)['operatorKey']).toBeUndefined();
  });

  it('NPC_WANG POV → state 中 NPC_WANG 自身数据未被修改', () => {
    const state = buildWorld();
    const wangBefore = JSON.stringify(state.NPC?.[NPC_WANG]);

    povInspect(state, NPC_WANG);
    povInspect(state, PC);    // 切回 PC
    povInspect(state, NPC_WANG); // 再切 NPC_WANG

    const wangAfter = JSON.stringify(state.NPC?.[NPC_WANG]);
    expect(wangAfter).toBe(wangBefore);
  });

  it('PC POV → NPC_HONG 数据未被修改', () => {
    const state = buildWorld();
    const hongBefore = JSON.stringify(state.NPC?.[NPC_HONG]);

    povInspect(state, PC);    // 只看 PC，但 NPC_HONG 不受影响

    const hongAfter = JSON.stringify(state.NPC?.[NPC_HONG]);
    expect(hongAfter).toBe(hongBefore);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// T4. 切 POV 不触发 runTick（游戏时间不变）
// ──────────────────────────────────────────────────────────────────────────────
describe('T4 切 POV 不触发 runTick（纪元分钟不变）', () => {
  it('多次切换 POV 后 state.世界.纪元分钟 保持不变', () => {
    const state = buildWorld();
    const epochBefore = state.世界?.纪元分钟 ?? 0;

    povInspect(state, NPC_WANG);
    povInspect(state, PC);
    povInspect(state, NPC_HONG);
    povInspect(state, PC);

    const epochAfter = state.世界?.纪元分钟 ?? 0;
    expect(epochAfter).toBe(epochBefore);
  });

  it('comparePOVs 不改变 state.世界.纪元分钟', () => {
    const state = buildWorld();
    const epochBefore = state.世界?.纪元分钟 ?? 0;

    comparePOVs(state, PC, NPC_WANG);
    comparePOVs(state, NPC_HONG, NPC_WANG);

    const epochAfter = state.世界?.纪元分钟 ?? 0;
    expect(epochAfter).toBe(epochBefore);
  });

  it('POV 操作前后 state 世界纪元分钟不变（无 runTick）', () => {
    const state = buildWorld();
    const epochBefore = state.世界?.纪元分钟 ?? 0;

    povInspect(state, NPC_WANG);
    povInspect(state, PC);

    const epochAfter = state.世界?.纪元分钟 ?? 0;
    expect(epochAfter).toBe(epochBefore);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// T5. comparePOVs 随 povEntityKey 变化给出正确 diff
// ──────────────────────────────────────────────────────────────────────────────
describe('T5 comparePOVs diff 正确性', () => {
  const state = buildWorld();

  it('compare(PC, NPC_WANG) → SECRET_S1 在 onlyB 中（NPC_WANG 独有）', () => {
    const cmp = comparePOVs(state, PC, NPC_WANG);
    expect(cmp.onlyB).toContain(SECRET_S1);
    expect(cmp.onlyA).not.toContain(SECRET_S1);
  });

  it('compare(NPC_WANG, PC) → SECRET_S1 在 onlyA 中（方向反转）', () => {
    const cmp = comparePOVs(state, NPC_WANG, PC);
    expect(cmp.onlyA).toContain(SECRET_S1);
    expect(cmp.onlyB).not.toContain(SECRET_S1);
  });

  it('compare(X, X) → onlyA 和 onlyB 均为空（自己与自己比对）', () => {
    const cmp = comparePOVs(state, NPC_WANG, NPC_WANG);
    expect(cmp.onlyA).toHaveLength(0);
    expect(cmp.onlyB).toHaveLength(0);
  });

  it('comparePOVs 不改变 state（纯只读）', () => {
    const before = JSON.stringify(state);
    comparePOVs(state, PC, NPC_WANG);
    comparePOVs(state, NPC_WANG, NPC_HONG);
    const after = JSON.stringify(state);
    expect(after).toBe(before);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// T7. 五轴人格投影（Bug 2 回归）
// ──────────────────────────────────────────────────────────────────────────────
describe('T7 五轴人格投影 computePovPersonalityProjection', () => {
  it('返回全部 5 轴 + totalBias 字段', () => {
    const state = buildWorld();
    const result = computePovPersonalityProjection(state, NPC_WANG);
    const AXES = ['开放', '尽责', '外向', '宜人', '神经质'] as const;
    for (const axis of AXES) {
      expect(result).toHaveProperty(axis);
      const axData = result[axis];
      expect(typeof axData.true).toBe('number');
      expect(typeof axData.projected).toBe('number');
      expect(typeof axData.bias).toBe('number');
    }
    expect(typeof result.totalBias).toBe('number');
  });

  it('projected = clamp(true + bias, 0, 100)（公式一致性）', () => {
    const state = buildWorld();
    const AXES = ['开放', '尽责', '外向', '宜人', '神经质'] as const;
    for (const entity of [NPC_WANG, PC, NPC_HONG]) {
      const result = computePovPersonalityProjection(state, entity);
      for (const axis of AXES) {
        const axData = result[axis];
        const expected = Math.max(0, Math.min(100, axData.true + axData.bias));
        expect(axData.projected).toBe(expected);
      }
    }
  });

  it('无自我认知条目·无伪装特质 → bias=0 → 投影值 = 真值', () => {
    const state = buildWorld();
    // buildWorld() NPC 无自我观察档案·无伪装特质·无自身关系边 → bias=0
    const result = computePovPersonalityProjection(state, NPC_WANG);
    expect(result.totalBias).toBe(0);
    const AXES = ['开放', '尽责', '外向', '宜人', '神经质'] as const;
    for (const axis of AXES) {
      expect(result[axis].projected).toBe(result[axis].true);
    }
  });

  it('computePovPersonalityProjection 纯只读·不改 state', () => {
    const state = buildWorld();
    const before = JSON.stringify(state);
    computePovPersonalityProjection(state, NPC_WANG);
    computePovPersonalityProjection(state, PC);
    computePovPersonalityProjection(state, NPC_HONG);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('五轴 true 值与 state.NPC[entity].性格五轴 逐轴一致', () => {
    const state = buildWorld();
    const AXES = ['开放', '尽责', '外向', '宜人', '神经质'] as const;
    for (const entity of [NPC_WANG, PC, NPC_HONG]) {
      const result = computePovPersonalityProjection(state, entity);
      const stateAxes = state.NPC[entity]?.性格五轴;
      if (!stateAxes) continue;
      for (const axis of AXES) {
        expect(result[axis].true).toBe(stateAxes[axis]);
      }
    }
  });

  it('五轴 true 值在 0-100 范围内', () => {
    const state = buildWorld();
    const result = computePovPersonalityProjection(state, NPC_WANG);
    const AXES = ['开放', '尽责', '外向', '宜人', '神经质'] as const;
    for (const axis of AXES) {
      expect(result[axis].true).toBeGreaterThanOrEqual(0);
      expect(result[axis].true).toBeLessThanOrEqual(100);
      expect(result[axis].projected).toBeGreaterThanOrEqual(0);
      expect(result[axis].projected).toBeLessThanOrEqual(100);
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// T8. POV 投影面板 6 组字段 · operatorKey×povEntityKey 解耦（数据层）
// ──────────────────────────────────────────────────────────────────────────────
describe('T8 POV 投影 6 组字段 · operatorKey 解耦（数据层）', () => {
  it('6 组数据源均可读取·无异常', () => {
    const state = buildWorld();
    // Section 1-3: povInspect 已由 T1-T6 覆盖
    const r = povInspect(state, NPC_WANG);
    expect(Array.isArray(r.visibleSecretIds)).toBe(true);  // ① 可见秘密
    expect(typeof r.cognitiveProjection).toBe('object');   // ② 认知档案
    // ③ 关系投影（直读 NPC.关系）
    const npc = state.NPC[NPC_WANG];
    expect(Array.isArray(npc?.关系)).toBe(true);
    // ④ 五轴投影
    const pp = computePovPersonalityProjection(state, NPC_WANG);
    expect(typeof pp.totalBias).toBe('number');
    // ⑤ 已知物品
    expect(typeof npc?.物品).toBe('object');
    // ⑥ 已知目标
    expect(Array.isArray(npc?.目标?.长期)).toBe(true);
    expect(Array.isArray(npc?.目标?.短期)).toBe(true);
  });

  it('切换 POV 不影响 computePovPersonalityProjection 对另一实体的结果', () => {
    const state = buildWorld();
    const pp1 = computePovPersonalityProjection(state, NPC_WANG);
    povInspect(state, PC);    // 切换 POV
    povInspect(state, NPC_HONG);
    const pp2 = computePovPersonalityProjection(state, NPC_WANG);  // 结果应相同
    expect(JSON.stringify(pp1)).toBe(JSON.stringify(pp2));
  });

  it('POV 操作（包括 6 组数据读取）不改变 state.世界.纪元分钟', () => {
    const state = buildWorld();
    const t0 = state.世界?.纪元分钟 ?? 0;
    povInspect(state, NPC_WANG);
    computePovPersonalityProjection(state, NPC_WANG);
    computePovPersonalityProjection(state, PC);
    comparePOVs(state, PC, NPC_WANG);
    expect(state.世界?.纪元分钟 ?? 0).toBe(t0);
  });

  it('6 组 POV 数据读取后 state 仍通过 RootSchema 校验', () => {
    const state = buildWorld();
    povInspect(state, NPC_WANG);
    computePovPersonalityProjection(state, NPC_WANG);
    computePovPersonalityProjection(state, PC);
    const result = RootSchema.safeParse(state);
    expect(result.success).toBe(true);
  });

  it('指纹 84 在 6 组 POV 数据读取后守恒', () => {
    const total =
      FINGERPRINT_BUNDLE_MEMBERS.length +
      FINGERPRINT_PRESET_FIELDS.length +
      FINGERPRINT_SNAPSHOT_FIELDS.length +
      FINGERPRINT_EXCLUDED_FIELDS.length;
    expect(total).toBe(84);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// T6. 指纹 84 / schemaKeys 52 在 POV 操作后守恒
// ──────────────────────────────────────────────────────────────────────────────
describe('T6 指纹 84 / schemaKeys 52 守恒（POV 不进指纹）', () => {
  it('指纹字段总数 = 84（POV 操作不改变 manifest）', () => {
    const total =
      FINGERPRINT_BUNDLE_MEMBERS.length +
      FINGERPRINT_PRESET_FIELDS.length +
      FINGERPRINT_SNAPSHOT_FIELDS.length +
      FINGERPRINT_EXCLUDED_FIELDS.length;
    expect(total).toBe(84);
  });

  it('schemaKeys = 52', () => {
    expect(Object.keys(RootSchema.shape).length).toBe(52);
  });

  it('多次 POV 切换后 state 仍通过 RootSchema 校验', () => {
    const state = buildWorld();
    povInspect(state, NPC_WANG);
    povInspect(state, PC);
    comparePOVs(state, PC, NPC_WANG);
    const result = RootSchema.safeParse(state);
    expect(result.success).toBe(true);
  });
});
