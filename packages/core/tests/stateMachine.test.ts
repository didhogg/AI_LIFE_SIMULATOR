import { describe, it, expect } from 'vitest';
import * as prand from 'pure-rand';
import {
  dispatch,
  assertInvariants,
  assertLlmNonBlockingTopology,
  _runTopologyCheckFor,
  isSafeSeam,
  SMTransitionError,
  LLM_WAIT_MODALS,
} from '../engine/stateMachine.js';
import type { StateMachineState, SMEvent } from '../engine/stateMachine.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

function base(): StateMachineState {
  return {
    当前态: 'PLAYING',
    模态栈: [],
    timeMode: 'PAUSED',
    双时钟: { 世界钟: 100, 镜头钟: 100 },
  };
}

function setup(): StateMachineState {
  return {
    当前态: 'WORLD_SETUP',
    模态栈: [],
    timeMode: 'PAUSED',
    双时钟: { 世界钟: 0, 镜头钟: 0 },
  };
}

function go(s: StateMachineState, type: SMEvent['type'], extra?: object): StateMachineState {
  return dispatch(s, { type, ...extra } as SMEvent).新机器状态;
}

function effects(s: StateMachineState, ev: SMEvent) {
  return dispatch(s, ev).效果指令;
}

function expectCode(fn: () => unknown, code: string) {
  try {
    fn();
    expect.fail(`Expected SMTransitionError(${code}) but no error was thrown`);
  } catch (e) {
    expect(e).toBeInstanceOf(SMTransitionError);
    expect((e as SMTransitionError).code).toBe(code);
  }
}

// ── 开机段 ─────────────────────────────────────────────────────────────────────

describe('P0-4 开机段 WORLD_SETUP', () => {
  it('新档 → stays WORLD_SETUP', () => {
    const s = go(setup(), '新档');
    expect(s.当前态).toBe('WORLD_SETUP');
  });

  it('装配完成 → CHARACTER_CREATE', () => {
    const s = go(setup(), '装配完成');
    expect(s.当前态).toBe('CHARACTER_CREATE');
    expect(s.模态栈).toEqual([]);
  });

  it('illegal: 人物创建提交 in WORLD_SETUP → ERR_COMMIT_AFTER_SETUP', () => {
    expectCode(() => go(setup(), '人物创建提交'), 'ERR_COMMIT_AFTER_SETUP');
  });

  it('illegal: 设置时间模式 in WORLD_SETUP → ERR_TICK_IN_SETUP [守卫①]', () => {
    expectCode(() => dispatch(setup(), { type: '设置时间模式', mode: 'TURN' }), 'ERR_TICK_IN_SETUP');
  });

  it('illegal: 未知事件 in WORLD_SETUP → ERR_INVALID_TRANSITION', () => {
    expectCode(() => go(setup(), '开场白完成'), 'ERR_INVALID_TRANSITION');
  });
});

describe('P0-4 开机段 CHARACTER_CREATE', () => {
  it('setup: WORLD_SETUP → CHARACTER_CREATE', () => {
    const s = go(setup(), '装配完成');
    expect(s.当前态).toBe('CHARACTER_CREATE');
  });

  it('illegal: 设置时间模式 in CHARACTER_CREATE → ERR_TICK_IN_SETUP [守卫②]', () => {
    const cc = go(setup(), '装配完成');
    expectCode(() => dispatch(cc, { type: '设置时间模式', mode: 'TURN' }), 'ERR_TICK_IN_SETUP');
  });

  it('illegal: 开场白完成 in CHARACTER_CREATE → ERR_SKIP_OPENING', () => {
    const cc = go(setup(), '装配完成');
    expectCode(() => go(cc, '开场白完成'), 'ERR_SKIP_OPENING');
  });

  it('illegal: 降级 in CHARACTER_CREATE → ERR_SKIP_OPENING', () => {
    const cc = go(setup(), '装配完成');
    expectCode(() => go(cc, '降级'), 'ERR_SKIP_OPENING');
  });

  it('illegal: 装配完成 in CHARACTER_CREATE → ERR_COMMIT_AFTER_SETUP', () => {
    const cc = go(setup(), '装配完成');
    expectCode(() => go(cc, '装配完成'), 'ERR_COMMIT_AFTER_SETUP');
  });
});

// ── 硬边：CHARACTER_CREATE → OPENING（禁止跳过） ──────────────────────────────

describe('P0-4 硬边 CHARACTER_CREATE → OPENING', () => {
  it('人物创建提交 → 当前态=PLAYING, 模态栈=[OPENING]', () => {
    const cc = go(setup(), '装配完成');
    const s = go(cc, '人物创建提交');
    expect(s.当前态).toBe('PLAYING');
    expect(s.模态栈).toEqual(['OPENING']);
  });

  it('人物创建提交 → 效果含 发起认知投影初始化注册表调用', () => {
    const cc = go(setup(), '装配完成');
    const fx = effects(cc, { type: '人物创建提交' });
    expect(fx.some(f => f.type === '发起认知投影初始化注册表调用')).toBe(true);
  });

  it('人物创建提交 → 效果含 按序章模板模式发起开场白具名调用', () => {
    const cc = go(setup(), '装配完成');
    const fx = effects(cc, { type: '人物创建提交' });
    expect(fx.some(f => f.type === '按序章模板模式发起开场白具名调用')).toBe(true);
  });

  it('OPENING 开场白完成 → PLAYING.PAUSED 空栈', () => {
    const cc = go(setup(), '装配完成');
    const withOpening = go(cc, '人物创建提交');
    const s = go(withOpening, '开场白完成');
    expect(s.当前态).toBe('PLAYING');
    expect(s.模态栈).toEqual([]);
    expect(s.timeMode).toBe('PAUSED');
  });

  it('OPENING 降级 → PLAYING.PAUSED 空栈', () => {
    const cc = go(setup(), '装配完成');
    const withOpening = go(cc, '人物创建提交');
    const s = go(withOpening, '降级');
    expect(s.当前态).toBe('PLAYING');
    expect(s.模态栈).toEqual([]);
  });
});

// ── PLAYING 基础层 ─────────────────────────────────────────────────────────────

describe('P0-4 PLAYING 基础层', () => {
  it('设置时间模式 TURN', () => {
    const s = go(base(), '设置时间模式', { mode: 'TURN' });
    expect(s.timeMode).toBe('TURN');
  });

  it('设置时间模式 AUTO', () => {
    const s = go(base(), '设置时间模式', { mode: 'AUTO' });
    expect(s.timeMode).toBe('AUTO');
  });

  it('设置时间模式 PAUSED', () => {
    const s = go({ ...base(), timeMode: 'TURN' }, '设置时间模式', { mode: 'PAUSED' });
    expect(s.timeMode).toBe('PAUSED');
  });

  it('illegal: 人物创建提交 from PLAYING → ERR_COMMIT_AFTER_SETUP', () => {
    expectCode(() => go(base(), '人物创建提交'), 'ERR_COMMIT_AFTER_SETUP');
  });

  it('illegal: 装配完成 from PLAYING → ERR_COMMIT_AFTER_SETUP', () => {
    expectCode(() => go(base(), '装配完成'), 'ERR_COMMIT_AFTER_SETUP');
  });

  it('illegal: 未知事件 in PLAYING → ERR_INVALID_TRANSITION', () => {
    expectCode(() => go(base(), '战斗结束'), 'ERR_INVALID_TRANSITION');
  });
});

// ── EVENT_BROADCAST ─────────────────────────────────────────────────────────────

describe('P0-4 EVENT_BROADCAST push/pop + timeMode 保存还原', () => {
  it('广播推送 → 压栈 EVENT_BROADCAST', () => {
    const s = go(base(), '广播推送');
    expect(s.模态栈).toEqual(['EVENT_BROADCAST']);
  });

  it('广播推送 保存 timeMode TURN', () => {
    const s = go({ ...base(), timeMode: 'TURN' }, '广播推送');
    expect(s._savedTimeMode).toBe('TURN');
  });

  it('广播完成 → 弹栈 + 还原 timeMode', () => {
    const withEB = go({ ...base(), timeMode: 'TURN' }, '广播推送');
    const s = go(withEB, '广播完成');
    expect(s.模态栈).toEqual([]);
    expect(s.timeMode).toBe('TURN');
    expect(s._savedTimeMode).toBeUndefined();
  });

  it('LLM失败 from EVENT_BROADCAST → 降级弹栈 + 还原 timeMode', () => {
    const withEB = go({ ...base(), timeMode: 'AUTO' }, '广播推送');
    const s = go(withEB, 'LLM失败');
    expect(s.模态栈).toEqual([]);
    expect(s.timeMode).toBe('AUTO');
  });

  it('illegal: EVENT_BROADCAST 收到 日程提交 → ERR_WRONG_ACTIVE_STATE', () => {
    const withEB = go(base(), '广播推送');
    expectCode(() => go(withEB, '日程提交'), 'ERR_WRONG_ACTIVE_STATE');
  });
});

// ── SCHEDULE_PLAN ──────────────────────────────────────────────────────────────

describe('P0-4 SCHEDULE_PLAN', () => {
  it('打开日程规划 (PAUSED) → 压栈 SCHEDULE_PLAN', () => {
    const s = go(base(), '打开日程规划');
    expect(s.模态栈).toEqual(['SCHEDULE_PLAN']);
  });

  it('日程提交 → 弹栈', () => {
    const s = go(go(base(), '打开日程规划'), '日程提交');
    expect(s.模态栈).toEqual([]);
  });

  it('日程取消 → 弹栈', () => {
    const s = go(go(base(), '打开日程规划'), '日程取消');
    expect(s.模态栈).toEqual([]);
  });

  it('illegal: 打开日程规划 when TURN → ERR_SCHEDULE_PLAN_NOT_PAUSED', () => {
    expectCode(() => go({ ...base(), timeMode: 'TURN' }, '打开日程规划'), 'ERR_SCHEDULE_PLAN_NOT_PAUSED');
  });

  it('illegal: 打开日程规划 when AUTO → ERR_SCHEDULE_PLAN_NOT_PAUSED', () => {
    expectCode(() => go({ ...base(), timeMode: 'AUTO' }, '打开日程规划'), 'ERR_SCHEDULE_PLAN_NOT_PAUSED');
  });
});

// ── RP_FOCUS 双时钟 ────────────────────────────────────────────────────────────

describe('P0-4 RP_FOCUS 双时钟', () => {
  it('进入RP焦点 → 镜头钟 = 世界钟', () => {
    const s = go({ ...base(), 双时钟: { 世界钟: 500, 镜头钟: 400 } }, '进入RP焦点');
    expect(s.双时钟.镜头钟).toBe(500);
  });

  it('进入RP焦点 → 世界钟不变', () => {
    const s = go({ ...base(), 双时钟: { 世界钟: 500, 镜头钟: 400 } }, '进入RP焦点');
    expect(s.双时钟.世界钟).toBe(500);
  });

  it('进入RP焦点 → effect 冻结世界钟', () => {
    const fx = effects(base(), { type: '进入RP焦点' });
    expect(fx.some(f => f.type === '冻结世界钟')).toBe(true);
  });

  it('退出RP焦点 → effect 世界钟对齐镜头钟，elapsed 正确', () => {
    // 模拟宿主已推进镜头钟至 350（世界钟仍 100）
    const inRP = go(base(), '进入RP焦点');
    const afterLensAdvance: StateMachineState = {
      ...inRP,
      双时钟: { 世界钟: 100, 镜头钟: 350 },
    };
    const fx = effects(afterLensAdvance, { type: '退出RP焦点' });
    const syncEff = fx.find(f => f.type === '世界钟对齐镜头钟') as { type: string; elapsed分钟: number } | undefined;
    expect(syncEff).toBeDefined();
    expect(syncEff!.elapsed分钟).toBe(250);
  });

  it('LLM超时 from RP_FOCUS → 降级弹栈', () => {
    const inRP = go(base(), '进入RP焦点');
    const s = go(inRP, 'LLM超时');
    expect(s.模态栈).toEqual([]);
  });

  it('illegal: RP_FOCUS 收到 广播完成 → ERR_WRONG_ACTIVE_STATE', () => {
    const inRP = go(base(), '进入RP焦点');
    expectCode(() => go(inRP, '广播完成'), 'ERR_WRONG_ACTIVE_STATE');
  });
});

// ── COMBAT ─────────────────────────────────────────────────────────────────────

describe('P0-4 COMBAT', () => {
  it('战斗开始 from PLAYING → push COMBAT', () => {
    const s = go(base(), '战斗开始');
    expect(s.模态栈).toEqual(['COMBAT']);
  });

  it('战斗开始 from EVENT_BROADCAST → push COMBAT', () => {
    const withEB = go(base(), '广播推送');
    const s = go(withEB, '战斗开始');
    expect(s.模态栈).toEqual(['EVENT_BROADCAST', 'COMBAT']);
  });

  it('战斗开始 from RP_FOCUS → push COMBAT', () => {
    const inRP = go(base(), '进入RP焦点');
    const s = go(inRP, '战斗开始');
    expect(s.模态栈).toEqual(['RP_FOCUS', 'COMBAT']);
  });

  it('战斗结束 → 弹栈', () => {
    const s = go(go(base(), '战斗开始'), '战斗结束');
    expect(s.模态栈).toEqual([]);
  });

  it('LLM超时 from COMBAT → 降级弹栈', () => {
    const s = go(go(base(), '战斗开始'), 'LLM超时');
    expect(s.模态栈).toEqual([]);
  });
});

// ── META_OVERLAY ───────────────────────────────────────────────────────────────

describe('P0-4 META_OVERLAY', () => {
  it('打开META from PLAYING', () => {
    const s = go(base(), '打开META');
    expect(s._meta).toBe(true);
    expect(s.模态栈).toEqual([]);       // 模态栈不变
    expect(s.timeMode).toBe('PAUSED');  // timeMode 不变
  });

  it('打开META from EVENT_BROADCAST', () => {
    const withEB = go(base(), '广播推送');
    const s = go(withEB, '打开META');
    expect(s._meta).toBe(true);
    expect(s.模态栈).toEqual(['EVENT_BROADCAST']); // 栈不变
  });

  it('打开META from RP_FOCUS', () => {
    const inRP = go(base(), '进入RP焦点');
    const s = go(inRP, '打开META');
    expect(s._meta).toBe(true);
    expect(s.模态栈).toEqual(['RP_FOCUS']); // 栈不变
  });

  it('关闭META → 恢复 _meta=false', () => {
    const withMeta = go(base(), '打开META');
    const s = go(withMeta, '关闭META');
    expect(s._meta).toBe(false);
    expect(s.模态栈).toEqual([]);
  });

  it('illegal: META内再开META → ERR_META_IN_META', () => {
    const withMeta = go(base(), '打开META');
    expectCode(() => go(withMeta, '打开META'), 'ERR_META_IN_META');
  });

  it('illegal: META开启时发送普通事件 → ERR_WRONG_ACTIVE_STATE', () => {
    const withMeta = go(base(), '打开META');
    expectCode(() => go(withMeta, '广播推送'), 'ERR_WRONG_ACTIVE_STATE');
  });

  it('HOST事件 穿透 META（不抛错）', () => {
    const withMeta = go(base(), '打开META');
    expect(() => go(withMeta, 'HOST事件')).not.toThrow();
  });
});

// ── 主角死亡 + INHERIT_DECISION ────────────────────────────────────────────────

describe('P0-4 主角死亡 + INHERIT_DECISION', () => {
  it('主角死亡 → flush → INHERIT_DECISION', () => {
    const s = go(base(), '主角死亡');
    expect(s.当前态).toBe('INHERIT_DECISION');
    expect(s.模态栈).toEqual([]);
  });

  it('主角死亡 → 效果含 清空$战斗暂存 + 粒度栈复位到base', () => {
    const fx = effects(base(), { type: '主角死亡' });
    expect(fx.some(f => f.type === '清空$战斗暂存')).toBe(true);
    expect(fx.some(f => f.type === '粒度栈复位到base')).toBe(true);
  });

  it('主角死亡（深栈） → flush 清空模态栈', () => {
    const deep = go(go(go(base(), '广播推送'), '进入RP焦点'), '战斗开始');
    expect(deep.模态栈.length).toBe(3);
    const s = go(deep, '主角死亡');
    expect(s.模态栈).toEqual([]);
    expect(s.当前态).toBe('INHERIT_DECISION');
  });

  it('INHERIT_DECISION 选定继承人 → PLAYING.PAUSED', () => {
    const s = go(go(base(), '主角死亡'), '选定继承人');
    expect(s.当前态).toBe('PLAYING');
    expect(s.timeMode).toBe('PAUSED');
  });

  it('INHERIT_DECISION 无继承人 → LIFE_SUMMARY + effect', () => {
    const inherit = go(base(), '主角死亡');
    const fx = effects(inherit, { type: '无继承人' });
    const s = go(inherit, '无继承人');
    expect(s.当前态).toBe('LIFE_SUMMARY');
    expect(fx.some(f => f.type === '发起人生总结调用')).toBe(true);
  });

  it('illegal: INHERIT_DECISION 不接受未知事件', () => {
    const inherit = go(base(), '主角死亡');
    expectCode(() => go(inherit, '广播推送'), 'ERR_INVALID_TRANSITION');
  });
});

// ── LIFE_SUMMARY 终态 ──────────────────────────────────────────────────────────

describe('P0-4 LIFE_SUMMARY 终态', () => {
  it('主动结束 → flush → LIFE_SUMMARY + effect 发起人生总结调用', () => {
    const fx = effects(base(), { type: '主动结束' });
    const s = go(base(), '主动结束');
    expect(s.当前态).toBe('LIFE_SUMMARY');
    expect(fx.some(f => f.type === '发起人生总结调用')).toBe(true);
  });

  it('主动结束 → 效果含 清空$战斗暂存 + 粒度栈复位到base', () => {
    const fx = effects(base(), { type: '主动结束' });
    expect(fx.some(f => f.type === '清空$战斗暂存')).toBe(true);
    expect(fx.some(f => f.type === '粒度栈复位到base')).toBe(true);
  });

  it('HOST事件 in LIFE_SUMMARY → 通过（终态唯一合法事件）', () => {
    const terminal: StateMachineState = { ...base(), 当前态: 'LIFE_SUMMARY' };
    expect(() => go(terminal, 'HOST事件')).not.toThrow();
  });

  it('illegal: 非HOST事件 in LIFE_SUMMARY → ERR_TERMINAL_NON_HOST', () => {
    const terminal: StateMachineState = { ...base(), 当前态: 'LIFE_SUMMARY' };
    expectCode(() => go(terminal, '广播推送'), 'ERR_TERMINAL_NON_HOST');
    expectCode(() => go(terminal, '主角死亡'), 'ERR_TERMINAL_NON_HOST');
    expectCode(() => go(terminal, '设置时间模式', { mode: 'TURN' }), 'ERR_TERMINAL_NON_HOST');
  });
});

// ── 栈溢出守卫 ────────────────────────────────────────────────────────────────

describe('P0-4 栈深超 4 → ERR_STACK_OVERFLOW', () => {
  it('第 5 次 push → ERR_STACK_OVERFLOW', () => {
    // PLAYING → EB → RP → COMBAT → ？ (4 深)
    const s1 = go(base(), '广播推送');           // [EB]
    const s2 = go(s1, '进入RP焦点');             // [EB, RP]
    const s3 = go(s2, '战斗开始');               // [EB, RP, COMBAT]
    // 手动构造深度 3 的状态并再压一个
    // COMBAT 不支持 广播推送，需直接构造 depth=4 然后再触发
    const depth4: StateMachineState = {
      ...s3,
      模态栈: ['EVENT_BROADCAST', 'RP_FOCUS', 'COMBAT', 'EVENT_BROADCAST'],
    };
    expectCode(() => go(depth4, '战斗开始'), 'ERR_STACK_OVERFLOW');
  });
});

// ── LLM 超时/失败 守卫 ─────────────────────────────────────────────────────────

describe('P0-4 LLM 超时/失败 守卫', () => {
  it('LLM超时 from PLAYING（非 LLM 等待态） → ERR_WRONG_ACTIVE_STATE', () => {
    expectCode(() => go(base(), 'LLM超时'), 'ERR_WRONG_ACTIVE_STATE');
  });
});

// ── 栈通道综合测试 ─────────────────────────────────────────────────────────────

describe('P0-4 栈通道 PLAYING→EVENT→RP→COMBAT→死亡→flush→INHERIT', () => {
  it('完整通道路径正确', () => {
    const s0 = base();
    const s1 = go(s0, '广播推送');
    expect(s1.模态栈).toEqual(['EVENT_BROADCAST']);

    const s2 = go(s1, '进入RP焦点');
    expect(s2.模态栈).toEqual(['EVENT_BROADCAST', 'RP_FOCUS']);

    const s3 = go(s2, '战斗开始');
    expect(s3.模态栈).toEqual(['EVENT_BROADCAST', 'RP_FOCUS', 'COMBAT']);

    const s4 = go(s3, '主角死亡');
    expect(s4.当前态).toBe('INHERIT_DECISION');
    expect(s4.模态栈).toEqual([]);
    expect(s4.timeMode).toBe('PAUSED');
  });
});

// ── timeMode 保存/还原跨嵌套 ──────────────────────────────────────────────────

describe('P0-4 timeMode 保存还原', () => {
  it('EVENT_BROADCAST push/pop 还原 timeMode=TURN', () => {
    const s0 = { ...base(), timeMode: 'TURN' as const };
    const withEB = go(s0, '广播推送');
    expect(withEB._savedTimeMode).toBe('TURN');
    const after = go(withEB, '广播完成');
    expect(after.timeMode).toBe('TURN');
    expect(after._savedTimeMode).toBeUndefined();
  });

  it('EVENT_BROADCAST LLM失败降级后还原 timeMode=AUTO', () => {
    const s0 = { ...base(), timeMode: 'AUTO' as const };
    const withEB = go(s0, '广播推送');
    const after = go(withEB, 'LLM失败');
    expect(after.timeMode).toBe('AUTO');
  });
});

// ── assertInvariants ───────────────────────────────────────────────────────────

describe('P0-4 assertInvariants', () => {
  it('合法状态不抛错', () => {
    expect(() => assertInvariants(base())).not.toThrow();
  });

  it('合法深栈不抛错', () => {
    const deep: StateMachineState = {
      ...base(),
      模态栈: ['OPENING', 'EVENT_BROADCAST', 'RP_FOCUS', 'COMBAT'],
    };
    expect(() => assertInvariants(deep)).not.toThrow();
  });

  it('非法 当前态 → invariant 1 抛错', () => {
    const bad = { ...base(), 当前态: 'UNKNOWN_STATE' };
    expect(() => assertInvariants(bad)).toThrow(/Invariant 1/);
  });

  it('模态栈含未知模态 → invariant 2 抛错', () => {
    const bad: StateMachineState = { ...base(), 模态栈: ['UNKNOWN_MODAL'] };
    expect(() => assertInvariants(bad)).toThrow(/Invariant 2/);
  });

  it('模态栈深 > 4 → invariant 3 抛错', () => {
    const bad: StateMachineState = {
      ...base(),
      模态栈: ['OPENING', 'EVENT_BROADCAST', 'RP_FOCUS', 'COMBAT', 'OPENING'],
    };
    expect(() => assertInvariants(bad)).toThrow(/Invariant 3/);
  });

  it('双时钟非整数 → invariant 4 抛错', () => {
    const bad: StateMachineState = { ...base(), 双时钟: { 世界钟: 1.5, 镜头钟: 0 } };
    expect(() => assertInvariants(bad)).toThrow(/Invariant 4/);
  });
});

// ── isSafeSeam ─────────────────────────────────────────────────────────────────

describe('P0-4 isSafeSeam', () => {
  it('PLAYING 空栈 → true', () => {
    expect(isSafeSeam(base())).toBe(true);
  });

  it('EVENT_BROADCAST 栈顶 → true', () => {
    expect(isSafeSeam(go(base(), '广播推送'))).toBe(true);
  });

  it('RP_FOCUS 栈顶 → true', () => {
    expect(isSafeSeam(go(base(), '进入RP焦点'))).toBe(true);
  });

  it('COMBAT 栈顶 → false', () => {
    expect(isSafeSeam(go(base(), '战斗开始'))).toBe(false);
  });

  it('SCHEDULE_PLAN 栈顶 → false', () => {
    expect(isSafeSeam(go(base(), '打开日程规划'))).toBe(false);
  });
});

// ── pure-rand fuzz：随机事件序列 + 六不变量 ────────────────────────────────────

describe('P0-4 fuzz（pure-rand 随机事件 × 200轮）', () => {
  const CANDIDATE_EVENTS: SMEvent[] = [
    { type: '广播推送' },
    { type: '广播完成' },
    { type: '打开日程规划' },
    { type: '日程提交' },
    { type: '日程取消' },
    { type: '进入RP焦点' },
    { type: '退出RP焦点' },
    { type: '战斗开始' },
    { type: '战斗结束' },
    { type: '打开META' },
    { type: '关闭META' },
    { type: '设置时间模式', mode: 'PAUSED' },
    { type: '设置时间模式', mode: 'TURN' },
    { type: 'LLM超时' },
    { type: 'LLM失败' },
    { type: 'HOST事件' },
  ];

  it('随机事件序列：每次合法转移后六不变量均成立', () => {
    const rng = prand.xorshift128plus(0x12345678);

    for (let round = 0; round < 200; round++) {
      let s = base();

      for (let step = 0; step < 30; step++) {
        const idx = prand.unsafeUniformIntDistribution(0, CANDIDATE_EVENTS.length - 1, rng);
        const ev = CANDIDATE_EVENTS[idx]!;

        try {
          const result = dispatch(s, ev);
          assertInvariants(result.新机器状态);
          s = result.新机器状态;
        } catch (e) {
          // 非法转移是预期行为；验证是 SMTransitionError 后继续
          if (!(e instanceof SMTransitionError)) throw e;
        }
      }
    }
  });
});

// ── P0-4b LLM 非阻塞拓扑验证（Invariant 6 结构自证）────────────────────────────

describe('P0-4b LLM_WAIT_MODALS 失败出口拓扑', () => {
  it('LLM_WAIT_MODALS 含 OPENING / EVENT_BROADCAST / RP_FOCUS / COMBAT', () => {
    expect(LLM_WAIT_MODALS.has('OPENING')).toBe(true);
    expect(LLM_WAIT_MODALS.has('EVENT_BROADCAST')).toBe(true);
    expect(LLM_WAIT_MODALS.has('RP_FOCUS')).toBe(true);
    expect(LLM_WAIT_MODALS.has('COMBAT')).toBe(true);
    expect(LLM_WAIT_MODALS.has('SCHEDULE_PLAN')).toBe(false);
  });

  it('OPENING: LLM超时 + LLM失败 均能降级弹栈', () => {
    expect(() => _runTopologyCheckFor(new Set(['OPENING']))).not.toThrow();
  });

  it('EVENT_BROADCAST: LLM超时 + LLM失败 均能降级弹栈', () => {
    expect(() => _runTopologyCheckFor(new Set(['EVENT_BROADCAST']))).not.toThrow();
  });

  it('RP_FOCUS: LLM超时 + LLM失败 均能降级弹栈', () => {
    expect(() => _runTopologyCheckFor(new Set(['RP_FOCUS']))).not.toThrow();
  });

  it('COMBAT: LLM超时 + LLM失败 均能降级弹栈', () => {
    expect(() => _runTopologyCheckFor(new Set(['COMBAT']))).not.toThrow();
  });

  it('反例：SCHEDULE_PLAN 无失败出口 → 拓扑断言报 Invariant 6（检测力验证）', () => {
    expect(() => _runTopologyCheckFor(new Set(['SCHEDULE_PLAN']))).toThrow(/Invariant 6/);
  });

  it('assertLlmNonBlockingTopology 不抛错（模块加载缓存已通过）', () => {
    expect(() => assertLlmNonBlockingTopology()).not.toThrow();
  });
});

// ── G1·6.49 INHERIT_DECISION 空候选兜底边 ─────────────────────────────────────

describe('P0-4 G1·INHERIT_DECISION 空候选兜底（6.49）', () => {
  function inherit(): StateMachineState {
    return go(base(), '主角死亡');
  }

  it('候选列表为空（默认路径）→ LIFE_SUMMARY + 发起人生总结调用', () => {
    const s = go(inherit(), '候选列表为空');
    expect(s.当前态).toBe('LIFE_SUMMARY');
    expect(s.模态栈).toEqual([]);
    const fx = effects(inherit(), { type: '候选列表为空' });
    expect(fx.some(f => f.type === '发起人生总结调用')).toBe(true);
  });

  it('候选列表为空 路径=人生总结 → LIFE_SUMMARY', () => {
    const s = go(inherit(), '候选列表为空', { 路径: '人生总结' });
    expect(s.当前态).toBe('LIFE_SUMMARY');
  });

  it('候选列表为空 路径=回溯里程碑 → PLAYING.PAUSED + 触发回溯里程碑fork', () => {
    const s = go(inherit(), '候选列表为空', { 路径: '回溯里程碑' });
    expect(s.当前态).toBe('PLAYING');
    expect(s.timeMode).toBe('PAUSED');
    expect(s.模态栈).toEqual([]);
    const fx = effects(inherit(), { type: '候选列表为空', 路径: '回溯里程碑' });
    expect(fx.some(f => f.type === '触发回溯里程碑fork')).toBe(true);
  });

  it('全覆盖：INHERIT_DECISION 四条出口边均有合法迁移', () => {
    // 选定继承人
    expect(go(inherit(), '选定继承人').当前态).toBe('PLAYING');
    // 无继承人
    expect(go(inherit(), '无继承人').当前态).toBe('LIFE_SUMMARY');
    // 候选列表为空→人生总结
    expect(go(inherit(), '候选列表为空').当前态).toBe('LIFE_SUMMARY');
    // 候选列表为空→回溯
    expect(go(inherit(), '候选列表为空', { 路径: '回溯里程碑' }).当前态).toBe('PLAYING');
  });

  it('illegal: 候选列表为空 in PLAYING → ERR_INVALID_TRANSITION（只在 INHERIT_DECISION 有效）', () => {
    expectCode(() => go(base(), '候选列表为空'), 'ERR_INVALID_TRANSITION');
  });

  it('illegal: 候选列表为空 in LIFE_SUMMARY → ERR_TERMINAL_NON_HOST', () => {
    const terminal: StateMachineState = { ...base(), 当前态: 'LIFE_SUMMARY' };
    expectCode(() => go(terminal, '候选列表为空'), 'ERR_TERMINAL_NON_HOST');
  });
});

// ── F2·6.56 拍生命周期单飞锁 ──────────────────────────────────────────────────

describe('P0-4 F2·拍生命周期单飞锁（6.56）', () => {
  it('拍推进 空闲→结算中', () => {
    const s = go(base(), '拍推进');
    expect(s.拍生命周期).toBe('结算中');
  });

  it('结算完成 结算中→等待呈现', () => {
    const s = go(go(base(), '拍推进'), '结算完成');
    expect(s.拍生命周期).toBe('等待呈现');
  });

  it('呈现确认 等待呈现→等待选择', () => {
    const s = go(go(go(base(), '拍推进'), '结算完成'), '呈现确认');
    expect(s.拍生命周期).toBe('等待选择');
  });

  it('选择完成 等待选择→关账中', () => {
    const s = go(go(go(go(base(), '拍推进'), '结算完成'), '呈现确认'), '选择完成');
    expect(s.拍生命周期).toBe('关账中');
  });

  it('关账完成 关账中→空闲（生命周期复位）', () => {
    const terminal = go(go(go(go(go(base(), '拍推进'), '结算完成'), '呈现确认'), '选择完成'), '关账完成');
    expect(terminal.拍生命周期).toBe('空闲');
  });

  it('CI 连点轰炸：第二次 拍推进 → ERR_TICK_NOT_IDLE', () => {
    const s1 = go(base(), '拍推进'); // 空闲→结算中
    expectCode(() => go(s1, '拍推进'), 'ERR_TICK_NOT_IDLE');
  });

  it('结算中再拍推进 → ERR_TICK_NOT_IDLE', () => {
    const inSettling: StateMachineState = { ...base(), 拍生命周期: '结算中' };
    expectCode(() => go(inSettling, '拍推进'), 'ERR_TICK_NOT_IDLE');
  });

  it('等待呈现再拍推进 → ERR_TICK_NOT_IDLE', () => {
    const s: StateMachineState = { ...base(), 拍生命周期: '等待呈现' };
    expectCode(() => go(s, '拍推进'), 'ERR_TICK_NOT_IDLE');
  });

  it('非 PLAYING 基础层（RP_FOCUS 模态）拍推进 → ERR_WRONG_ACTIVE_STATE', () => {
    const inRP = go(base(), '进入RP焦点');
    expectCode(() => go(inRP, '拍推进'), 'ERR_WRONG_ACTIVE_STATE');
  });

  it('完整生命周期 + assertInvariants 每步均通过', () => {
    let s = base();
    for (const ev of ['拍推进', '结算完成', '呈现确认', '选择完成', '关账完成'] as const) {
      s = go(s, ev);
      expect(() => assertInvariants(s)).not.toThrow();
    }
  });
});

// ── F1·6.56 元层写 FIFO 排队（M5 收紧版）─────────────────────────────────────

describe('P0-4 F1·元层写排队（6.56·M5 收紧版）', () => {
  it('元层写入 → 推入队列 + UI 回执效果', () => {
    const result = dispatch(base(), { type: '元层写入', 操作: '设置属性', 幂等键: 'attr-001' });
    expect(result.新机器状态.元层写队列).toEqual([{ 操作: '设置属性', 幂等键: 'attr-001' }]);
    expect(result.效果指令.some(f => f.type === '元层写UI回执')).toBe(true);
  });

  it('多条元层写入 → FIFO 顺序保留', () => {
    const s1 = go(base(), '元层写入', { 操作: '操作A', 幂等键: 'k1' });
    const s2 = go(s1, '元层写入', { 操作: '操作B', 幂等键: 'k2' });
    const s3 = go(s2, '元层写入', { 操作: '操作C' });
    expect(s3.元层写队列).toEqual([
      { 操作: '操作A', 幂等键: 'k1' },
      { 操作: '操作B', 幂等键: 'k2' },
      { 操作: '操作C' },
    ]);
  });

  it('指令组边界 → 队列整批交宿主 + 清空队列', () => {
    const s1 = go(base(), '元层写入', { 操作: '操作A' });
    const s2 = go(s1, '元层写入', { 操作: '操作B' });
    const result = dispatch(s2, { type: '指令组边界' });
    expect(result.新机器状态.元层写队列).toEqual([]);
    const batchFx = result.效果指令.find(f => f.type === '执行元层写队列') as
      { type: string; 条目: { 操作: string }[] } | undefined;
    expect(batchFx).toBeDefined();
    expect(batchFx!.条目).toEqual([{ 操作: '操作A' }, { 操作: '操作B' }]);
  });

  it('指令组边界（空队列）→ 无 执行元层写队列 效果', () => {
    const result = dispatch(base(), { type: '指令组边界' });
    expect(result.效果指令.some(f => f.type === '执行元层写队列')).toBe(false);
  });

  it('停机类元层写入 → 立即执行·不进队列', () => {
    const result = dispatch(base(), { type: '元层写入', 操作: '停机操作', 停机类: true });
    expect(result.新机器状态.元层写队列 ?? []).toEqual([]); // 不入队
    expect(result.效果指令.some(f => f.type === '执行元层写队列')).toBe(true);
    expect(result.效果指令.some(f => f.type === '元层写UI回执')).toBe(true);
  });

  it('UI 回执效果含操作名称与幂等键', () => {
    const result = dispatch(base(), { type: '元层写入', 操作: '改名', 幂等键: 'rename-007' });
    const ui = result.效果指令.find(f => f.type === '元层写UI回执') as
      { type: string; 操作: string; 幂等键?: string } | undefined;
    expect(ui?.操作).toBe('改名');
    expect(ui?.幂等键).toBe('rename-007');
  });

  it('元层写入在 EVENT_BROADCAST 模态下也进队列（F1 全局）', () => {
    const withEB = go(base(), '广播推送');
    const result = dispatch(withEB, { type: '元层写入', 操作: '模态中写入' });
    expect(result.新机器状态.元层写队列).toEqual([{ 操作: '模态中写入' }]);
  });
});

// ── F3·6.56 看门狗超时强制 pop ───────────────────────────────────────────────

describe('P0-4 F3·看门狗超时强制 pop（6.56）', () => {
  it('看门狗超时 in EVENT_BROADCAST → pop + 丢弃在途意图效果', () => {
    const withEB = go(base(), '广播推送');
    const result = dispatch(withEB, { type: '看门狗超时' });
    expect(result.新机器状态.模态栈).toEqual([]);
    expect(result.效果指令.some(f => f.type === '丢弃在途意图')).toBe(true);
    expect(result.效果指令.some(f => f.type === '战斗机械收束')).toBe(false);
  });

  it('看门狗超时 in COMBAT → pop + 丢弃在途意图 + 战斗机械收束 + 粒度栈复位', () => {
    const inCombat = go(base(), '战斗开始');
    const result = dispatch(inCombat, { type: '看门狗超时' });
    expect(result.新机器状态.模态栈).toEqual([]);
    expect(result.效果指令.some(f => f.type === '丢弃在途意图')).toBe(true);
    expect(result.效果指令.some(f => f.type === '战斗机械收束')).toBe(true);
    expect(result.效果指令.some(f => f.type === '粒度栈复位到base')).toBe(true);
  });

  it('看门狗超时 in RP_FOCUS → pop + 丢弃在途意图（无战斗机械收束）', () => {
    const inRP = go(base(), '进入RP焦点');
    const result = dispatch(inRP, { type: '看门狗超时' });
    expect(result.新机器状态.模态栈).toEqual([]);
    expect(result.效果指令.some(f => f.type === '丢弃在途意图')).toBe(true);
    expect(result.效果指令.some(f => f.type === '战斗机械收束')).toBe(false);
  });

  it('看门狗超时 in SCHEDULE_PLAN → pop（非 LLM 模态也能强制 pop）', () => {
    const s = go(base(), '打开日程规划');
    const result = dispatch(s, { type: '看门狗超时' });
    expect(result.新机器状态.模态栈).toEqual([]);
  });

  it('看门狗超时 in OPENING → pop + 丢弃在途意图', () => {
    const cc = go(setup(), '装配完成');
    const withOpening = go(cc, '人物创建提交'); // PLAYING + [OPENING]
    const result = dispatch(withOpening, { type: '看门狗超时' });
    expect(result.新机器状态.模态栈).toEqual([]);
    expect(result.效果指令.some(f => f.type === '丢弃在途意图')).toBe(true);
  });

  it('看门狗超时 还原 _savedTimeMode（EVENT_BROADCAST 保存的 timeMode）', () => {
    const s0 = { ...base(), timeMode: 'TURN' as const };
    const withEB = go(s0, '广播推送'); // _savedTimeMode = TURN
    const result = dispatch(withEB, { type: '看门狗超时' });
    expect(result.新机器状态.timeMode).toBe('TURN');
    expect(result.新机器状态._savedTimeMode).toBeUndefined();
  });

  it('illegal: 看门狗超时 in PLAYING（空栈）→ ERR_WRONG_ACTIVE_STATE（进非法迁移表）', () => {
    expectCode(() => go(base(), '看门狗超时'), 'ERR_WRONG_ACTIVE_STATE');
  });

  it('深栈（EB→RP→COMBAT）看门狗超时 只 pop 栈顶 COMBAT', () => {
    const s = go(go(go(base(), '广播推送'), '进入RP焦点'), '战斗开始');
    expect(s.模态栈).toEqual(['EVENT_BROADCAST', 'RP_FOCUS', 'COMBAT']);
    const result = dispatch(s, { type: '看门狗超时' });
    expect(result.新机器状态.模态栈).toEqual(['EVENT_BROADCAST', 'RP_FOCUS']);
  });
});
