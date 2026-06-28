// P7-4c 模态栈三方并发临界 + AA1 Ring2 世代核对
// P7-4d C2/C7 竞争仲裁 + 全席位意图屏障
// ── 模态栈三方并发临界 ───────────────────────────────────────────────────────────
export const MODAL_STACK_MAX_DEPTH = 4;
/**
 * 模态栈三方并发临界（P7-4c）：
 * - 栈深 4：溢出弹出最旧条目（防卡死·不 throw）
 * - epoch 围栏：pop(epoch) 时 epoch 不匹配 → 响应过期作废 → 返回 null
 * - pop 落地态兜底：pop 后返回新栈顶 mode（空栈时返回空串）
 */
export class ModalStackController {
    _stack = [];
    _epochCounter = 0;
    get depth() { return this._stack.length; }
    get currentMode() {
        const top = this._stack[this._stack.length - 1];
        return top?.mode ?? null;
    }
    push(mode) {
        const epoch = ++this._epochCounter;
        if (this._stack.length >= MODAL_STACK_MAX_DEPTH) {
            this._stack.shift(); // 栈深 4 溢出兜底：弹出最旧（不 throw）
        }
        this._stack.push({ mode, epoch });
        return epoch;
    }
    /**
     * epoch 围栏：epoch 不匹配 → 响应过期作废（返回 null）。
     * pop 落地态兜底：返回新栈顶 mode 或空串。
     */
    pop(epoch) {
        const top = this._stack[this._stack.length - 1];
        if (!top || top.epoch !== epoch)
            return null; // stale epoch → discard
        this._stack.pop();
        return this._stack[this._stack.length - 1]?.mode ?? '';
    }
    snapshot() { return [...this._stack]; }
    restore(entries) { this._stack = [...entries]; }
}
// ── AA1 在途 Ring 2 世代核对 ─────────────────────────────────────────────────────
/**
 * AA1 Ring 2 世代核对（P7-4c）：
 * - 每次入队分配递增世代号
 * - validate(callId, gen): 世代号对不上即返回 false → 弃（防旧响应双落账）
 * - complete(callId): 移除在途记录
 */
export class Ring2GenerationTracker {
    _generation = 0;
    _inFlight = new Map();
    enqueue(callId) {
        const gen = ++this._generation;
        this._inFlight.set(callId, gen);
        return gen;
    }
    /** 世代号对不上 → false（调用方不得落账） */
    validate(callId, generation) {
        return this._inFlight.get(callId) === generation;
    }
    complete(callId) {
        this._inFlight.delete(callId);
    }
    get inFlightCount() { return this._inFlight.size; }
}
// ── 确定性抽签（C2/C7 竞争仲裁）─────────────────────────────────────────────────
/**
 * 确定性抽签（P7-4d）：同种子同候选列表 → 同结果（可复现）。
 * 纯整型模运算·禁 Math.random/Date.now（确定性铁律）。
 */
export function deterministicLottery(seed, candidates) {
    if (candidates.length === 0)
        throw new Error('deterministicLottery: 候选列表为空');
    const idx = Math.abs(Math.trunc(seed) % candidates.length);
    return candidates[idx];
}
// ── 全席位意图屏障（节拍公平）──────────────────────────────────────────────────
/**
 * 全席位意图屏障（P7-4d）：
 * 所有席位登记意图后才放行（节拍公平·防某席位抢先多次结算）。
 */
export class IntentBarrier {
    _seats;
    _received;
    constructor(seats) {
        this._seats = new Set(seats);
        this._received = new Map();
    }
    register(seatId, intent) {
        if (this._seats.has(seatId)) {
            this._received.set(seatId, intent);
        }
    }
    /** 全席位均已登记意图才放行 */
    isReady() {
        if (this._seats.size === 0)
            return false;
        for (const s of this._seats) {
            if (!this._received.has(s))
                return false;
        }
        return true;
    }
    /** 放行并清空（下一节拍从头收集）*/
    flush() {
        const result = new Map(this._received);
        this._received = new Map();
        return result;
    }
    get registeredCount() { return this._received.size; }
    get totalSeats() { return this._seats.size; }
}
