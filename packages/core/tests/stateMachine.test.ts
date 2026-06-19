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

// ── 缺口1·死亡拦截检查 + INHERIT_DECISION ─────────────────────────────────────

describe('P0-4 缺口1·死亡拦截检查 + INHERIT_DECISION', () => {
  it('主角死亡 → flush → DEATH_INTERCEPT（拦截待判）', () => {
    const s = go(base(), '主角死亡');
    expect(s.当前态).toBe('DEATH_INTERCEPT');
    expect(s.模态栈).toEqual([]);
  });

  it('主角死亡 → 效果含 清空$战斗暂存 + 粒度栈复位到base + 发起死亡拦截扫描', () => {
    const fx = effects(base(), { type: '主角死亡' });
    expect(fx.some(f => f.type === '清空$战斗暂存')).toBe(true);
    expect(fx.some(f => f.type === '粒度栈复位到base')).toBe(true);
    expect(fx.some(f => f.type === '发起死亡拦截扫描')).toBe(true);
  });

  it('主角死亡（深栈） → flush 清空模态栈 → DEATH_INTERCEPT', () => {
    const deep = go(go(go(base(), '广播推送'), '进入RP焦点'), '战斗开始');
    expect(deep.模态栈.length).toBe(3);
    const s = go(deep, '主角死亡');
    expect(s.模态栈).toEqual([]);
    expect(s.当前态).toBe('DEATH_INTERCEPT');
  });

  it('DEATH_INTERCEPT 拦截扫描完成_继承 → INHERIT_DECISION', () => {
    const death = go(base(), '主角死亡');
    const s = go(death, '拦截扫描完成_继承');
    expect(s.当前态).toBe('INHERIT_DECISION');
    expect(s.模态栈).toEqual([]);
  });

  it('DEATH_INTERCEPT 转域续命 → PLAYING.PAUSED', () => {
    const death = go(base(), '主角死亡');
    const s = go(death, '转域续命');
    expect(s.当前态).toBe('PLAYING');
    expect(s.timeMode).toBe('PAUSED');
    expect(s.模态栈).toEqual([]);
  });

  it('DEATH_INTERCEPT 谢幕终局 → LIFE_SUMMARY + 发起人生总结调用', () => {
    const death = go(base(), '主角死亡');
    const s = go(death, '谢幕终局');
    expect(s.当前态).toBe('LIFE_SUMMARY');
    const fx = effects(go(base(), '主角死亡'), { type: '谢幕终局' });
    expect(fx.some(f => f.type === '发起人生总结调用')).toBe(true);
  });

  it('INHERIT_DECISION 选定继承人 → PLAYING.PAUSED', () => {
    const death = go(base(), '主角死亡');
    const inherit = go(death, '拦截扫描完成_继承');
    const s = go(inherit, '选定继承人');
    expect(s.当前态).toBe('PLAYING');
    expect(s.timeMode).toBe('PAUSED');
  });

  it('INHERIT_DECISION 无继承人 → LIFE_SUMMARY + effect', () => {
    const death = go(base(), '主角死亡');
    const inherit = go(death, '拦截扫描完成_继承');
    const fx = effects(inherit, { type: '无继承人' });
    const s = go(inherit, '无继承人');
    expect(s.当前态).toBe('LIFE_SUMMARY');
    expect(fx.some(f => f.type === '发起人生总结调用')).toBe(true);
  });

  it('illegal: INHERIT_DECISION 不接受未知事件 → ERR_INVALID_TRANSITION', () => {
    const death = go(base(), '主角死亡');
    const inherit = go(death, '拦截扫描完成_继承');
    expectCode(() => go(inherit, '广播推送'), 'ERR_INVALID_TRANSITION');
  });

  it('illegal: DEATH_INTERCEPT 不接受未知事件 → ERR_INVALID_TRANSITION', () => {
    const death = go(base(), '主角死亡');
    expectCode(() => go(death, '广播推送'), 'ERR_INVALID_TRANSITION');
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

// ── F5·6.56 栈满→待弹队列（不溢出·不报错）──────────────────────────────────

describe('P0-4 F5·栈满→待弹队列（6.56）', () => {
  // 构造深度4栈：[EB, RP, COMBAT, EB]（手动，正常事件流最深3）
  function depth4(): StateMachineState {
    const s3 = go(go(go(base(), '广播推送'), '进入RP焦点'), '战斗开始');
    return { ...s3, 模态栈: ['EVENT_BROADCAST', 'RP_FOCUS', 'COMBAT', 'EVENT_BROADCAST'] };
  }

  it('栈满 + 战斗开始 → 进待弹队列，不抛错，栈不变', () => {
    const result = dispatch(depth4(), { type: '战斗开始' });
    expect(result.新机器状态.模态栈).toEqual(['EVENT_BROADCAST', 'RP_FOCUS', 'COMBAT', 'EVENT_BROADCAST']);
    expect(result.新机器状态.待弹队列?.length).toBe(1);
    expect(result.新机器状态.待弹队列?.[0]?.模态).toBe('COMBAT');
  });

  it('栈满 + 进入RP焦点 → 进待弹队列（重要等级=5）', () => {
    const result = dispatch(depth4(), { type: '进入RP焦点', 重要等级: 5, 事件id: 'rp-001' });
    const q = result.新机器状态.待弹队列;
    expect(q?.length).toBe(1);
    expect(q?.[0]?.模态).toBe('RP_FOCUS');
    expect(q?.[0]?.事件id).toBe('rp-001');
  });

  it('待弹队列出队 = 重要等级高者优先', () => {
    // 先把 RP(5) 和 COMBAT(10) 入队
    const s1 = dispatch(depth4(), { type: '进入RP焦点', 重要等级: 5, 事件id: 'b' }).新机器状态;
    const s2 = dispatch(s1, { type: '战斗开始', 重要等级: 10, 事件id: 'a' }).新机器状态;
    expect(s2.待弹队列?.length).toBe(2);
    // pop 一个（广播完成 → pop EB）→ auto-dequeue COMBAT(10)
    const s3 = go(s2, '广播完成');
    // 出队后 COMBAT 上栈
    expect(s3.模态栈).toContain('COMBAT');
    // 剩余队列长度 = 1（RP_FOCUS 仍在等）
    expect(s3.待弹队列?.length).toBe(1);
  });

  it('flush（主动结束）豁免 = 清空待弹队列', () => {
    const s = dispatch(depth4(), { type: '战斗开始' }).新机器状态;
    expect(s.待弹队列?.length).toBe(1);
    const after = go(s, '主动结束');
    expect(after.待弹队列).toEqual([]);
  });
});

// ── LLM 超时/失败 守卫 ─────────────────────────────────────────────────────────

describe('P0-4 LLM 超时/失败 守卫', () => {
  it('LLM超时 from PLAYING（非 LLM 等待态） → ERR_WRONG_ACTIVE_STATE', () => {
    expectCode(() => go(base(), 'LLM超时'), 'ERR_WRONG_ACTIVE_STATE');
  });
});

// ── 栈通道综合测试 ─────────────────────────────────────────────────────────────

describe('P0-4 栈通道 PLAYING→EVENT→RP→COMBAT→死亡→拦截→INHERIT', () => {
  it('完整通道路径正确', () => {
    const s0 = base();
    const s1 = go(s0, '广播推送');
    expect(s1.模态栈).toEqual(['EVENT_BROADCAST']);

    const s2 = go(s1, '进入RP焦点');
    expect(s2.模态栈).toEqual(['EVENT_BROADCAST', 'RP_FOCUS']);

    const s3 = go(s2, '战斗开始');
    expect(s3.模态栈).toEqual(['EVENT_BROADCAST', 'RP_FOCUS', 'COMBAT']);

    const s4 = go(s3, '主角死亡');
    expect(s4.当前态).toBe('DEATH_INTERCEPT');
    expect(s4.模态栈).toEqual([]);
    expect(s4.timeMode).toBe('PAUSED');

    const s5 = go(s4, '拦截扫描完成_继承');
    expect(s5.当前态).toBe('INHERIT_DECISION');
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

  it('DEATH_INTERCEPT 是合法基础态（不违反 Invariant 1）', () => {
    const s: StateMachineState = { ...base(), 当前态: 'DEATH_INTERCEPT' };
    expect(() => assertInvariants(s)).not.toThrow();
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
    // G1/F1/F2/F3 新事件（本轮加入）
    { type: '候选列表为空' },                         // G1：PLAYING 下抛 ERR_INVALID_TRANSITION，fuzz 跳过
    { type: '元层写入', 操作: 'fuzz-write' },         // F1
    { type: '指令组边界' },                            // F1
    { type: '拍推进' },                               // F2
    { type: '结算完成' },                             // F2
    { type: '呈现确认' },                             // F2
    { type: '选择完成' },                             // F2
    { type: '关账完成' },                             // F2
    { type: '看门狗超时' },                           // F3
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
  // 缺口1: 主角死亡 → DEATH_INTERCEPT → 拦截扫描完成_继承 → INHERIT_DECISION
  function inherit(): StateMachineState {
    return go(go(base(), '主角死亡'), '拦截扫描完成_继承');
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

// ── F6·6.56 同类型模态禁重入 ──────────────────────────────────────────────────

describe('P0-4 F6·同类型模态禁重入（6.56）', () => {
  it('RP_FOCUS 中 进入RP焦点 → ERR_MODAL_REENTRY', () => {
    const inRP = go(base(), '进入RP焦点');
    expectCode(() => go(inRP, '进入RP焦点'), 'ERR_MODAL_REENTRY');
  });

  it('COMBAT 中 战斗开始 → ERR_MODAL_REENTRY', () => {
    const inCombat = go(base(), '战斗开始');
    expectCode(() => go(inCombat, '战斗开始'), 'ERR_MODAL_REENTRY');
  });

  it('切换对话对象 in RP_FOCUS → 不触模态栈（模态内切换）+ 切换RP焦点对象效果', () => {
    const inRP = go(base(), '进入RP焦点');
    const result = dispatch(inRP, { type: '切换对话对象', 对象ID: 'npc-42' });
    expect(result.新机器状态.模态栈).toEqual(['RP_FOCUS']); // 栈不变
    expect(result.效果指令.some(f => f.type === '切换RP焦点对象')).toBe(true);
    const fx = result.效果指令.find(f => f.type === '切换RP焦点对象') as
      { type: string; 对象ID: string } | undefined;
    expect(fx?.对象ID).toBe('npc-42');
  });
});

// ── 缺口7·自愿换角 ────────────────────────────────────────────────────────────

describe('P0-4 缺口7·自愿换角→INHERIT_DECISION（6.56）', () => {
  it('自愿换角 → INHERIT_DECISION（复用继承管线）', () => {
    const s = go(base(), '自愿换角');
    expect(s.当前态).toBe('INHERIT_DECISION');
    expect(s.模态栈).toEqual([]);
    expect(s.timeMode).toBe('PAUSED');
  });

  it('自愿换角 不发起死亡拦截扫描', () => {
    const fx = effects(base(), { type: '自愿换角' });
    expect(fx.some(f => f.type === '发起死亡拦截扫描')).toBe(false);
  });

  it('自愿换角 + 元层写队列非空 → 落指令组边界（执行元层写队列效果）', () => {
    const s0 = go(base(), '元层写入', { 操作: '换角前操作' });
    expect(s0.元层写队列?.length).toBe(1);
    const result = dispatch(s0, { type: '自愿换角' });
    expect(result.新机器状态.元层写队列).toEqual([]);
    expect(result.效果指令.some(f => f.type === '执行元层写队列')).toBe(true);
  });

  it('自愿换角 + 元层写队列为空 → 无 执行元层写队列 效果', () => {
    const fx = effects(base(), { type: '自愿换角' });
    expect(fx.some(f => f.type === '执行元层写队列')).toBe(false);
  });

  it('illegal: 自愿换角 in WORLD_SETUP → ERR_INVALID_TRANSITION', () => {
    expectCode(() => go(setup(), '自愿换角'), 'ERR_INVALID_TRANSITION');
  });

  it('INHERIT_DECISION 可继续 选定继承人/无继承人/候选列表为空 路径', () => {
    const inherit = go(base(), '自愿换角');
    expect(go(inherit, '选定继承人').当前态).toBe('PLAYING');
    expect(go(inherit, '无继承人').当前态).toBe('LIFE_SUMMARY');
    expect(go(inherit, '候选列表为空').当前态).toBe('LIFE_SUMMARY');
  });
});

// ── G5·6.49 读档/立碑 安全接缝门规 ──────────────────────────────────────────

describe('P0-4 G5·读档/立碑 安全接缝门规（6.49）', () => {
  it('读档 in PLAYING.PAUSED（空栈·拍空闲·队列空）→ 执行读档', () => {
    const fx = effects(base(), { type: '读档' });
    expect(fx.some(f => f.type === '执行读档')).toBe(true);
  });

  it('立碑 in PLAYING.PAUSED（空栈·拍空闲·队列空）→ 执行立碑', () => {
    const fx = effects(base(), { type: '立碑' });
    expect(fx.some(f => f.type === '执行立碑')).toBe(true);
  });

  it('读档 in EVENT_BROADCAST（安全模态）→ 执行读档', () => {
    const withEB = go(base(), '广播推送');
    expect(isSafeSeam(withEB)).toBe(true);
    const fx = effects(withEB, { type: '读档' });
    expect(fx.some(f => f.type === '执行读档')).toBe(true);
  });

  it('illegal: 读档 in COMBAT（不安全模态）→ ERR_UNSAFE_SEAM', () => {
    const inCombat = go(base(), '战斗开始');
    expectCode(() => go(inCombat, '读档'), 'ERR_UNSAFE_SEAM');
  });

  it('illegal: 立碑 in SCHEDULE_PLAN（不安全模态）→ ERR_UNSAFE_SEAM', () => {
    const inSP = go(base(), '打开日程规划');
    expectCode(() => go(inSP, '立碑'), 'ERR_UNSAFE_SEAM');
  });

  it('illegal: 读档 in 结算中（拍非空闲）→ ERR_UNSAFE_SEAM', () => {
    const s: StateMachineState = { ...base(), 拍生命周期: '结算中' };
    expectCode(() => go(s, '读档'), 'ERR_UNSAFE_SEAM');
  });

  it('illegal: 立碑 in 元层写队列非空（指令组未提交）→ ERR_UNSAFE_SEAM', () => {
    const s = go(base(), '元层写入', { 操作: '未提交操作' });
    expectCode(() => go(s, '立碑'), 'ERR_UNSAFE_SEAM');
  });
});

// ── C4·6.53 席位掉线×看门狗 AI 托管降级接口（单机=no-op）────────────────────

describe('P0-4 C4·席位掉线 AI 托管降级接口（6.53）', () => {
  it('席位掉线 → 发起AI托管降级效果（状态机不变·单机路径宿主 no-op）', () => {
    const result = dispatch(base(), { type: '席位掉线', 席位ID: 'seat-1' });
    expect(result.新机器状态.当前态).toBe('PLAYING');
    expect(result.效果指令.some(f => f.type === '发起AI托管降级')).toBe(true);
    const fx = result.效果指令.find(f => f.type === '发起AI托管降级') as
      { type: string; 席位ID: string } | undefined;
    expect(fx?.席位ID).toBe('seat-1');
  });

  it('席位回连 → 交还席位效果', () => {
    const result = dispatch(base(), { type: '席位回连', 席位ID: 'seat-2' });
    expect(result.效果指令.some(f => f.type === '交还席位')).toBe(true);
    const fx = result.效果指令.find(f => f.type === '交还席位') as
      { type: string; 席位ID: string } | undefined;
    expect(fx?.席位ID).toBe('seat-2');
  });
});

// ── R2·6.63 COMBAT 离散孪生钟口径（注释验证）────────────────────────────────

describe('P0-4 R2·COMBAT 离散孪生钟口径注释（6.63）', () => {
  it('COMBAT 不自行推进世界钟（宿主推进·离散步进）', () => {
    const before = base();
    const inCombat = go(before, '战斗开始');
    expect(inCombat.双时钟.世界钟).toBe(before.双时钟.世界钟);
  });

  it('COMBAT 通过 F3 看门狗超时 → 战斗机械收束（零第三钟·唯一收束路径之一）', () => {
    const inCombat = go(base(), '战斗开始');
    const result = dispatch(inCombat, { type: '看门狗超时' });
    expect(result.效果指令.some(f => f.type === '战斗机械收束')).toBe(true);
  });
});

// ── F7·6.56 三档内存盘点（Invariant 7 框架占位）────────────────────────────

describe('P0-4 F7·运行时内存三档盘点（6.56）', () => {
  it('F7: assertInvariants 对含待弹队列（第二档）的合法状态不抛错', () => {
    const s: StateMachineState = {
      ...base(),
      待弹队列: [{ 模态: 'EVENT_BROADCAST', 重要等级: 5, 事件id: 'e001' }],
    };
    expect(() => assertInvariants(s)).not.toThrow();
  });

  it('F7: 从档恢复 → 状态不变 + 重扫已结算未呈现队列效果', () => {
    const result = dispatch(base(), { type: '从档恢复' });
    expect(result.新机器状态.当前态).toBe('PLAYING');
    expect(result.效果指令.some(f => f.type === '重扫已结算未呈现队列')).toBe(true);
  });
});

// ── D2·6.54 死亡时刻双登记接口（注释验证）────────────────────────────────────

describe('P0-4 D2·死亡时刻双登记接口（6.54）', () => {
  it('主角死亡 → 效果含 双登记死亡时刻（全局时刻=世界钟·域钟读数=镜头钟）', () => {
    const s = { ...base(), 双时钟: { 世界钟: 1000, 镜头钟: 1200 } };
    const fx = effects(s, { type: '主角死亡' });
    const dual = fx.find(f => f.type === '双登记死亡时刻') as
      { type: string; 全局时刻: number; 域钟读数: number } | undefined;
    expect(dual).toBeDefined();
    expect(dual!.全局时刻).toBe(1000);
    expect(dual!.域钟读数).toBe(1200);
  });
});

// ── G1·P0-4 元层开关走组边界（I-a·专项·bugs.md:167）──────────────────────────
// 元层写入 → FIFO 队列累积（本拍不生效）；指令组边界 → 整批 flush 给宿主
// 操作标签用测试本地占位 tag（拍板：不命名抢话/视角/观战/二审正式串）

describe('P0-4 G1·元层开关走组边界（I-a·专项）', () => {
  it('连续多个元层写入 → 全部 FIFO 入队、拍内中途无执行效果', () => {
    const s0 = base();
    const r1 = dispatch(s0, { type: '元层写入', 操作: 'G1_ctrl_alpha', 幂等键: 'k-α' });
    const r2 = dispatch(r1.新机器状态, { type: '元层写入', 操作: 'G1_ctrl_beta', 幂等键: 'k-β' });
    const r3 = dispatch(r2.新机器状态, { type: '元层写入', 操作: 'G1_ctrl_gamma' });

    // FIFO 累积顺序恒等
    expect(r3.新机器状态.元层写队列).toEqual([
      { 操作: 'G1_ctrl_alpha', 幂等键: 'k-α' },
      { 操作: 'G1_ctrl_beta', 幂等键: 'k-β' },
      { 操作: 'G1_ctrl_gamma' },
    ]);

    // 每次 dispatch 结果中均无「执行」效果——写入仅入队，不立即生效
    for (const r of [r1, r2, r3]) {
      expect(r.效果指令.some(f => f.type === '执行元层写队列')).toBe(false);
    }

    // 机器状态基础态不变
    expect(r3.新机器状态.当前态).toBe(s0.当前态);
    expect(r3.新机器状态.模态栈).toEqual(s0.模态栈);
  });

  it('指令组边界 → 整批一次性 flush 给宿主 + 队列清空（FIFO 顺序恒等）', () => {
    const s1 = go(base(), '元层写入', { 操作: 'G1_ctrl_alpha', 幂等键: 'k-α' });
    const s2 = go(s1, '元层写入', { 操作: 'G1_ctrl_beta', 幂等键: 'k-β' });
    const s3 = go(s2, '元层写入', { 操作: 'G1_ctrl_gamma' });

    const result = dispatch(s3, { type: '指令组边界' });

    expect(result.新机器状态.元层写队列).toEqual([]);

    const batchFx = result.效果指令.find(f => f.type === '执行元层写队列') as
      { type: string; 条目: { 操作: string; 幂等键?: string }[] } | undefined;
    expect(batchFx).toBeDefined();
    expect(batchFx!.条目).toEqual([
      { 操作: 'G1_ctrl_alpha', 幂等键: 'k-α' },
      { 操作: 'G1_ctrl_beta', 幂等键: 'k-β' },
      { 操作: 'G1_ctrl_gamma' },
    ]);
  });

  it('元层写绝不在指令组边界前生效 — 未 flush 队列阻断安全接缝（堵 silent fallthrough）', () => {
    // 非空队列 → 读档须 ERR_UNSAFE_SEAM（G5 安全接缝门规·第三条：指令组已提交）
    const withPending = go(base(), '元层写入', { 操作: 'G1_ctrl_alpha' });
    expectCode(() => go(withPending, '读档'), 'ERR_UNSAFE_SEAM');

    // flush 后队列清空 → 安全接缝通过（写入真正生效权交宿主，机器侧视队列为空）
    const flushed = go(withPending, '指令组边界');
    expect(() => go(flushed, '读档')).not.toThrow();
  });

  it('同一拍内多组 元层写入→指令组边界 循环确定性（纯函数·跨调用恒等）', () => {
    const runGroup = (s0: StateMachineState, ops: string[]) => {
      let s = s0;
      for (const op of ops) s = go(s, '元层写入', { 操作: op });
      return dispatch(s, { type: '指令组边界' });
    };

    // 纯函数：相同初态 + 相同序列 → 相同输出
    const rA = runGroup(base(), ['G1_ctrl_alpha', 'G1_ctrl_beta']);
    const rB = runGroup(base(), ['G1_ctrl_alpha', 'G1_ctrl_beta']);
    expect(rA.新机器状态).toEqual(rB.新机器状态);
    expect(rA.效果指令).toEqual(rB.效果指令);

    // 多轮：第二组 flush 仅含第二组条目（第一组已清，不跨组混入）
    const afterRound1 = rA.新机器状态;
    const rC = runGroup(afterRound1, ['G1_ctrl_gamma']);
    const batchFx = rC.效果指令.find(f => f.type === '执行元层写队列') as
      { type: string; 条目: { 操作: string }[] } | undefined;
    expect(batchFx!.条目).toEqual([{ 操作: 'G1_ctrl_gamma' }]);
  });
});
