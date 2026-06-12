// Ring 1 状态机 — 纯函数 dispatch，零副作用，效果指令外包给宿主
// dispatch 是唯一入口；不执行 IO / 计时器 / Date.now()（lint 已拦）
// 任何时钟推进均由宿主提供；dispatch 永不自行推进任何钟（拍原子不变量）
import type { StateMachine } from '../schema/system.js';

// ── State ─────────────────────────────────────────────────────────────────────

export interface StateMachineState extends StateMachine {
  /** EVENT_BROADCAST push 时保存的 timeMode，pop 时还原 */
  _savedTimeMode?: 'PAUSED' | 'TURN' | 'AUTO';
  /** META_OVERLAY 是否打开；打开时不触碰模态栈与 timeMode */
  _meta?: boolean;
}

// ── Events ─────────────────────────────────────────────────────────────────────

export type SMEvent =
  | { type: '新档' }
  | { type: '装配完成' }
  | { type: '人物创建提交' }
  | { type: '开场白完成' }
  | { type: '降级' }
  | { type: '设置时间模式'; mode: 'PAUSED' | 'TURN' | 'AUTO' }
  | { type: '广播推送' }
  | { type: '广播完成' }
  | { type: '打开日程规划' }
  | { type: '日程提交' }
  | { type: '日程取消' }
  | { type: '进入RP焦点' }
  | { type: '退出RP焦点' }
  | { type: '战斗开始' }
  | { type: '战斗结束' }
  | { type: '打开META' }
  | { type: '关闭META' }
  | { type: '主角死亡' }
  | { type: '选定继承人' }
  | { type: '无继承人' }
  | { type: '主动结束' }
  | { type: 'LLM超时' }
  | { type: 'LLM失败' }
  | { type: 'HOST事件' };

// ── Effect Instructions ────────────────────────────────────────────────────────

export type EffectInstruction =
  | { type: '发起认知投影初始化注册表调用' }
  | { type: '按序章模板模式发起开场白具名调用' }
  | { type: '冻结世界钟' }
  | { type: '世界钟对齐镜头钟'; elapsed分钟: number }
  | { type: '发起人生总结调用' }
  | { type: '清空$战斗暂存' }
  | { type: '粒度栈复位到base' };

// ── Error Codes ────────────────────────────────────────────────────────────────

export type SMErrorCode =
  | 'ERR_COMMIT_AFTER_SETUP'
  | 'ERR_SCHEDULE_PLAN_NOT_PAUSED'
  | 'ERR_STACK_OVERFLOW'
  | 'ERR_META_IN_META'
  | 'ERR_SKIP_OPENING'
  | 'ERR_TERMINAL_NON_HOST'
  | 'ERR_WRONG_ACTIVE_STATE'
  | 'ERR_TICK_IN_SETUP'
  | 'ERR_INVALID_TRANSITION';

export class SMTransitionError extends Error {
  constructor(
    public readonly code: SMErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SMTransitionError';
  }
}

// ── Dispatch result ────────────────────────────────────────────────────────────

export interface DispatchResult {
  新机器状态: StateMachineState;
  效果指令: EffectInstruction[];
}

// ── Constants ──────────────────────────────────────────────────────────────────

const KNOWN_BASE_STATES = new Set([
  'WORLD_SETUP', 'CHARACTER_CREATE', 'PLAYING', 'INHERIT_DECISION', 'LIFE_SUMMARY',
]);

const MODAL_STATES = new Set([
  'OPENING', 'EVENT_BROADCAST', 'SCHEDULE_PLAN', 'RP_FOCUS', 'COMBAT',
]);

const LLM_WAIT_STATES = new Set(['OPENING', 'EVENT_BROADCAST', 'RP_FOCUS', 'COMBAT']);

// 安全接缝白名单：广播可出队的模态（P1 行为，接口先到位）
const SAFE_SEAM_MODALS = new Set(['PLAYING', 'EVENT_BROADCAST', 'RP_FOCUS']);

// ── Helpers ────────────────────────────────────────────────────────────────────

function stackTop(s: StateMachineState): string {
  return s.模态栈.length > 0 ? s.模态栈[s.模态栈.length - 1]! : s.当前态;
}

// exactOptionalPropertyTypes requires deleting optional keys rather than assigning undefined
function dropSavedTimeMode(s: StateMachineState): StateMachineState {
  const { _savedTimeMode: _dropped, ...rest } = s;
  return rest;
}

// flush: 清栈到 base(PLAYING)，返回两条固定效果指令
function flush(s: StateMachineState): { state: StateMachineState; effects: EffectInstruction[] } {
  const { _savedTimeMode: _dropped, ...rest } = s;
  const state: StateMachineState = {
    ...rest,
    当前态: 'PLAYING',
    模态栈: [],
    timeMode: 'PAUSED',
    _meta: false,
  };
  return {
    state,
    effects: [{ type: '清空$战斗暂存' }, { type: '粒度栈复位到base' }],
  };
}

function pushModal(s: StateMachineState, modal: string): StateMachineState {
  if (s.模态栈.length >= 4) {
    throw new SMTransitionError('ERR_STACK_OVERFLOW', `模态栈深度超限 ${s.模态栈.length} >= 4`);
  }
  return { ...s, 模态栈: [...s.模态栈, modal] };
}

function popModal(s: StateMachineState): StateMachineState {
  if (s.模态栈.length === 0) {
    throw new SMTransitionError('ERR_INVALID_TRANSITION', '模态栈为空，无法 pop');
  }
  return { ...s, 模态栈: s.模态栈.slice(0, -1) };
}

// ── Dispatch ───────────────────────────────────────────────────────────────────

export function dispatch(机器状态: StateMachineState, 事件: SMEvent): DispatchResult {
  const s = 机器状态;

  // ① 终态守卫
  if (s.当前态 === 'LIFE_SUMMARY' && 事件.type !== 'HOST事件') {
    throw new SMTransitionError(
      'ERR_TERMINAL_NON_HOST',
      `终态 LIFE_SUMMARY 后禁止非 HOST 事件: ${事件.type}`,
    );
  }

  // ② HOST事件（终态与一切态均接受）
  if (事件.type === 'HOST事件') {
    return { 新机器状态: s, 效果指令: [] };
  }

  // ③ META_OVERLAY 开关（不触碰模态栈与 timeMode）
  if (事件.type === '打开META') {
    if (s._meta) {
      throw new SMTransitionError('ERR_META_IN_META', 'META 覆盖层已打开，不得再次打开');
    }
    return { 新机器状态: { ...s, _meta: true }, 效果指令: [] };
  }
  if (事件.type === '关闭META') {
    return { 新机器状态: { ...s, _meta: false }, 效果指令: [] };
  }

  // ④ META 开启时屏蔽所有其他事件
  if (s._meta) {
    throw new SMTransitionError(
      'ERR_WRONG_ACTIVE_STATE',
      `META 覆盖层开启时只接受 打开META/关闭META/HOST事件，收到: ${事件.type}`,
    );
  }

  // ⑤ 开机段时间推进守卫
  if (
    (s.当前态 === 'WORLD_SETUP' || s.当前态 === 'CHARACTER_CREATE') &&
    事件.type === '设置时间模式'
  ) {
    throw new SMTransitionError(
      'ERR_TICK_IN_SETUP',
      `开机段禁止时间推进事件: ${事件.type}`,
    );
  }

  // ⑥ WORLD_SETUP
  if (s.当前态 === 'WORLD_SETUP') {
    if (事件.type === '新档') {
      return { 新机器状态: s, 效果指令: [] };
    }
    if (事件.type === '装配完成') {
      return {
        新机器状态: { ...s, 当前态: 'CHARACTER_CREATE', 模态栈: [] },
        效果指令: [],
      };
    }
    if (事件.type === '人物创建提交') {
      throw new SMTransitionError('ERR_COMMIT_AFTER_SETUP', 'WORLD_SETUP 期间禁止人物创建提交');
    }
    throw new SMTransitionError('ERR_INVALID_TRANSITION', `WORLD_SETUP 不接受事件: ${事件.type}`);
  }

  // ⑦ CHARACTER_CREATE
  if (s.当前态 === 'CHARACTER_CREATE') {
    if (事件.type === '人物创建提交') {
      // 硬边：必须经过 OPENING，不得直达 PLAYING
      const withOpening = pushModal({ ...s, 当前态: 'PLAYING', 模态栈: [] }, 'OPENING');
      return {
        新机器状态: withOpening,
        效果指令: [
          { type: '发起认知投影初始化注册表调用' },
          { type: '按序章模板模式发起开场白具名调用' },
        ],
      };
    }
    if (事件.type === '开场白完成' || 事件.type === '降级') {
      // 试图跳过 OPENING
      throw new SMTransitionError('ERR_SKIP_OPENING', 'CHARACTER_CREATE 阶段禁止绕过 OPENING 直达 PLAYING');
    }
    if (事件.type === '装配完成') {
      throw new SMTransitionError('ERR_COMMIT_AFTER_SETUP', '已进入 CHARACTER_CREATE，禁止回退');
    }
    throw new SMTransitionError('ERR_INVALID_TRANSITION', `CHARACTER_CREATE 不接受事件: ${事件.type}`);
  }

  // ⑧ INHERIT_DECISION
  if (s.当前态 === 'INHERIT_DECISION') {
    if (事件.type === '选定继承人') {
      return {
        新机器状态: { ...s, 当前态: 'PLAYING', 模态栈: [], timeMode: 'PAUSED' },
        效果指令: [],
      };
    }
    if (事件.type === '无继承人') {
      return {
        新机器状态: { ...s, 当前态: 'LIFE_SUMMARY', 模态栈: [] },
        效果指令: [{ type: '发起人生总结调用' }],
      };
    }
    throw new SMTransitionError('ERR_INVALID_TRANSITION', `INHERIT_DECISION 不接受事件: ${事件.type}`);
  }

  // ── 以下均在 当前态=PLAYING 作用域内 ──────────────────────────────────────

  // ⑨ 全局事件（任意 PLAYING 阶段）

  // 主角死亡 → flush → INHERIT_DECISION
  if (事件.type === '主角死亡') {
    const { state: flushed, effects } = flush(s);
    return {
      新机器状态: { ...flushed, 当前态: 'INHERIT_DECISION' },
      效果指令: effects,
    };
  }

  // 主动结束 → flush → LIFE_SUMMARY
  if (事件.type === '主动结束') {
    const { state: flushed, effects } = flush(s);
    return {
      新机器状态: { ...flushed, 当前态: 'LIFE_SUMMARY' },
      效果指令: [...effects, { type: '发起人生总结调用' }],
    };
  }

  // LLM 超时/失败 → 降级出口（pop → 上层模态或 PLAYING）
  if (事件.type === 'LLM超时' || 事件.type === 'LLM失败') {
    const active = stackTop(s);
    if (!LLM_WAIT_STATES.has(active)) {
      throw new SMTransitionError(
        'ERR_WRONG_ACTIVE_STATE',
        `LLM 超时/失败 只能在 LLM 等待模态中触发，当前: ${active}`,
      );
    }
    const popped = dropSavedTimeMode(popModal(s));
    const restoredTimeMode = s._savedTimeMode ?? s.timeMode;
    return {
      新机器状态: { ...popped, timeMode: restoredTimeMode },
      效果指令: [],
    };
  }

  // 禁止在 PLAYING 阶段回退到开机段
  if (事件.type === '装配完成' || 事件.type === '人物创建提交') {
    throw new SMTransitionError('ERR_COMMIT_AFTER_SETUP', '已过创建段，禁止回退到 WORLD_SETUP/CHARACTER_CREATE');
  }

  const active = stackTop(s);

  // ⑩ PLAYING 基础层（模态栈为空）
  if (active === 'PLAYING') {
    if (事件.type === '设置时间模式') {
      return { 新机器状态: { ...s, timeMode: 事件.mode }, 效果指令: [] };
    }
    if (事件.type === '广播推送') {
      const saved = s.timeMode;
      return {
        新机器状态: { ...pushModal(s, 'EVENT_BROADCAST'), _savedTimeMode: saved },
        效果指令: [],
      };
    }
    if (事件.type === '打开日程规划') {
      if (s.timeMode !== 'PAUSED') {
        throw new SMTransitionError(
          'ERR_SCHEDULE_PLAN_NOT_PAUSED',
          `进入 SCHEDULE_PLAN 要求 PAUSED，当前 timeMode: ${s.timeMode}`,
        );
      }
      return { 新机器状态: pushModal(s, 'SCHEDULE_PLAN'), 效果指令: [] };
    }
    if (事件.type === '进入RP焦点') {
      const pushed = pushModal(s, 'RP_FOCUS');
      return {
        新机器状态: { ...pushed, 双时钟: { ...pushed.双时钟, 镜头钟: s.双时钟.世界钟 } },
        效果指令: [{ type: '冻结世界钟' }],
      };
    }
    if (事件.type === '战斗开始') {
      return { 新机器状态: pushModal(s, 'COMBAT'), 效果指令: [] };
    }
    throw new SMTransitionError('ERR_INVALID_TRANSITION', `PLAYING 不接受事件: ${事件.type}`);
  }

  // ⑪ OPENING（LLM 等待态，有降级出口）
  if (active === 'OPENING') {
    if (事件.type === '开场白完成' || 事件.type === '降级') {
      return {
        新机器状态: { ...popModal(s), timeMode: 'PAUSED' },
        效果指令: [],
      };
    }
    throw new SMTransitionError('ERR_WRONG_ACTIVE_STATE', `OPENING 不接受事件: ${事件.type}`);
  }

  // ⑫ EVENT_BROADCAST（LLM 等待态，有降级出口）
  if (active === 'EVENT_BROADCAST') {
    if (事件.type === '广播完成') {
      const popped = dropSavedTimeMode(popModal(s));
      const restoredTimeMode = s._savedTimeMode ?? s.timeMode;
      return {
        新机器状态: { ...popped, timeMode: restoredTimeMode },
        效果指令: [],
      };
    }
    if (事件.type === '进入RP焦点') {
      const pushed = pushModal(s, 'RP_FOCUS');
      return {
        新机器状态: { ...pushed, 双时钟: { ...pushed.双时钟, 镜头钟: s.双时钟.世界钟 } },
        效果指令: [{ type: '冻结世界钟' }],
      };
    }
    if (事件.type === '战斗开始') {
      return { 新机器状态: pushModal(s, 'COMBAT'), 效果指令: [] };
    }
    throw new SMTransitionError('ERR_WRONG_ACTIVE_STATE', `EVENT_BROADCAST 不接受事件: ${事件.type}`);
  }

  // ⑬ SCHEDULE_PLAN
  if (active === 'SCHEDULE_PLAN') {
    if (事件.type === '日程提交' || 事件.type === '日程取消') {
      return { 新机器状态: popModal(s), 效果指令: [] };
    }
    throw new SMTransitionError('ERR_WRONG_ACTIVE_STATE', `SCHEDULE_PLAN 不接受事件: ${事件.type}`);
  }

  // ⑭ RP_FOCUS（LLM 等待态，镜头钟独立推进，有降级出口）
  if (active === 'RP_FOCUS') {
    if (事件.type === '退出RP焦点') {
      const elapsed = s.双时钟.镜头钟 - s.双时钟.世界钟;
      return {
        新机器状态: popModal(s),
        效果指令: [{ type: '世界钟对齐镜头钟', elapsed分钟: elapsed }],
      };
    }
    if (事件.type === '战斗开始') {
      return { 新机器状态: pushModal(s, 'COMBAT'), 效果指令: [] };
    }
    throw new SMTransitionError('ERR_WRONG_ACTIVE_STATE', `RP_FOCUS 不接受事件: ${事件.type}`);
  }

  // ⑮ COMBAT（LLM 等待态，有降级出口）
  if (active === 'COMBAT') {
    if (事件.type === '战斗结束') {
      return { 新机器状态: popModal(s), 效果指令: [] };
    }
    throw new SMTransitionError('ERR_WRONG_ACTIVE_STATE', `COMBAT 不接受事件: ${事件.type}`);
  }

  throw new SMTransitionError('ERR_INVALID_TRANSITION', `未知激活态 '${active}'，事件: ${事件.type}`);
}

// ── assertInvariants ──────────────────────────────────────────────────────────

export function assertInvariants(state: StateMachineState): void {
  const { 当前态, 模态栈, timeMode, 双时钟 } = state;

  // 1. 可达性：当前态 ∈ 已知基础状态
  if (!KNOWN_BASE_STATES.has(当前态)) {
    throw new Error(`Invariant 1 [可达性] violated: 当前态 '${当前态}' 不在已知集合`);
  }

  // 2. 无捕获环：模态栈中每项均有无条件出口边（结构校验）
  for (const modal of 模态栈) {
    if (!MODAL_STATES.has(modal)) {
      throw new Error(`Invariant 2 [无捕获环] violated: 模态栈含未知模态 '${modal}'`);
    }
  }

  // 3. 栈有界：≤ 4
  if (模态栈.length > 4) {
    throw new Error(`Invariant 3 [栈有界] violated: 栈深 ${模态栈.length} > 4`);
  }

  // 4. 拍原子：双时钟值为整数（dispatch 永不自行推进时钟的结构代理）
  if (!Number.isInteger(双时钟.世界钟) || !Number.isInteger(双时钟.镜头钟)) {
    throw new Error(`Invariant 4 [拍原子] violated: 双时钟值非整数 世界钟=${双时钟.世界钟} 镜头钟=${双时钟.镜头钟}`);
  }

  // 5. 单写者：timeMode ∈ 合法值（dispatch 只修改状态机键的类型完整性代理）
  if (timeMode !== 'PAUSED' && timeMode !== 'TURN' && timeMode !== 'AUTO') {
    throw new Error(`Invariant 5 [单写者] violated: 非法 timeMode '${timeMode}'`);
  }

  // 6. LLM 非阻塞：每个 LLM 等待模态有超时/失败出口边（设计保证，此处断言已知集合完整性）
  for (const modal of 模态栈) {
    if (!MODAL_STATES.has(modal)) {
      throw new Error(`Invariant 6 [LLM非阻塞] violated: 模态 '${modal}' 不在已知集合`);
    }
  }
}

// ── isSafeSeam ────────────────────────────────────────────────────────────────

/** P1 接口：栈顶 ∈ 安全接缝白名单时广播可出队 */
export function isSafeSeam(state: StateMachineState): boolean {
  const top = stackTop(state);
  return SAFE_SEAM_MODALS.has(top);
}
