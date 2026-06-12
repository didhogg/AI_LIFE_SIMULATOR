# Code Review Checklist

## Absolute timestamp writes — `writeEpochMinute()` required

**File**: `packages/core/engine/time.ts` — `writeEpochMinute(em: number): number`

All writes of computed epoch minutes to A-class timestamp fields (fields whose
schema definition does **not** carry `.min(0)`) must pass through
`writeEpochMinute()` before storage.

**Why**: Epoch minute `0` is the sentinel value meaning "eternal / never happened /
not yet recorded". Writing a real event timestamp of exactly `0` (1970-01-01
00:00:00 — coincident with the Gregorian epoch anchor) would silently collide
with the sentinel, corrupting expiry checks and `minutesSinceLast()` logic.
`writeEpochMinute(em)` shifts `em === 0` to `1`, preserving the sentinel contract.

**How to apply**:
- Any time you compute an absolute epoch minute from `gregorianToEpochMin()` or
  similar and write it to a field such as `出生日期`, `死亡时间`, `缔结`, `起始时间`,
  `发生时间`, `到期`, etc., wrap it: `writeEpochMinute(computedEm)`.
- `0` as a literal default (meaning "unknown / not yet") is fine — that is the
  sentinel by design.
- Duration/count fields (B-class, still carry `.min(0)`) do not need this guard.

**Mechanical lint**: Not feasible (would require type-level tagging of A/B fields).
Enforce via this checklist during PR review.
