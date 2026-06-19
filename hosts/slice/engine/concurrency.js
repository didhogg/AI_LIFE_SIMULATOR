// P7-4c 模态栈三方并发临界 + AA1 Ring2 世代核对
// P7-4d C2/C7 竞争仲裁 + 全席位意图屏障

export const MODAL_STACK_MAX_DEPTH = 4;

export class ModalStackController {
  _stack        = [];
  _epochCounter = 0;

  get depth() { return this._stack.length; }
  get currentMode() {
    const top = this._stack[this._stack.length - 1];
    return top?.mode ?? null;
  }

  push(mode) {
    const epoch = ++this._epochCounter;
    if (this._stack.length >= MODAL_STACK_MAX_DEPTH) {
      this._stack.shift();
    }
    this._stack.push({ mode, epoch });
    return epoch;
  }

  pop(epoch) {
    const top = this._stack[this._stack.length - 1];
    if (!top || top.epoch !== epoch) return null;
    this._stack.pop();
    return this._stack[this._stack.length - 1]?.mode ?? '';
  }

  snapshot() { return [...this._stack]; }
  restore(entries) { this._stack = [...entries]; }
}

export class Ring2GenerationTracker {
  _generation = 0;
  _inFlight   = new Map();

  enqueue(callId) {
    const gen = ++this._generation;
    this._inFlight.set(callId, gen);
    return gen;
  }

  validate(callId, generation) {
    return this._inFlight.get(callId) === generation;
  }

  complete(callId) {
    this._inFlight.delete(callId);
  }

  get inFlightCount() { return this._inFlight.size; }
}

export function deterministicLottery(seed, candidates) {
  if (candidates.length === 0) throw new Error('deterministicLottery: 候选列表为空');
  const idx = Math.abs(Math.trunc(seed) % candidates.length);
  return candidates[idx];
}

export class IntentBarrier {
  _seats;
  _received = new Map();

  constructor(seats) {
    this._seats = new Set(seats);
  }

  register(seatId, intent) {
    if (this._seats.has(seatId)) {
      this._received.set(seatId, intent);
    }
  }

  isReady() {
    if (this._seats.size === 0) return false;
    for (const s of this._seats) {
      if (!this._received.has(s)) return false;
    }
    return true;
  }

  flush() {
    const result   = new Map(this._received);
    this._received = new Map();
    return result;
  }

  get registeredCount() { return this._received.size; }
  get totalSeats()      { return this._seats.size;    }
}
