// P7-3 事务保真 — 失败工单冻结（Z5）/ 幂等防护（6.67）/ irreversible 冻结载荷（3d）

export class TicketStore {
  _tickets   = new Map();
  _committed = new Set();

  freeze(ticket) {
    this._tickets.set(ticket.tickId, ticket);
  }

  get(tickId) {
    return this._tickets.get(tickId);
  }

  isEventCommitted(eventId) {
    return this._committed.has(eventId);
  }

  markEventCommitted(eventId) {
    this._committed.add(eventId);
  }

  unmarkEventCommitted(eventId) {
    this._committed.delete(eventId);
  }

  assertNotIrreversibleReroll(tickId) {
    const t = this._tickets.get(tickId);
    if (t?.hasIrreversibleEffects) {
      throw new Error(
        `3d: tickId=${tickId} 含 irreversible 副作用（LLM 叙事）·禁止重掷`,
      );
    }
  }

  replayNarrative(tickId) {
    const t = this._tickets.get(tickId);
    if (!t?.hasIrreversibleEffects) return null;
    const p = t.frozenPayloads.find(fp => fp.effectType === 'llm_narrative');
    return p?.payload ?? null;
  }

  get size() { return this._tickets.size; }
}
