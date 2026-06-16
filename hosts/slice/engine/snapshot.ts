// M3 拍前快照 ring buffer + 存档校验和 + 关账态门规
// 禁 Math.random / Date.now / 裸 JSON.stringify
// 校验和走 canonicalize + hashCanonical（rng.ts）；反序列化 JSON.parse 合规
import { canonicalize } from '@ai-life-sim/core/engine/text/canonicalize';
import { hashCanonical } from '@ai-life-sim/core/engine/rng';

// ── 拍生命周期（与 stateMachine.ts 镜像·仅 slice 宿主使用）──────────────────────
export type TickLifecycleState = '空闲' | '结算中' | '等待呈现' | '等待选择' | '关账中';

// ── Slice 级 tick_log 条目（M3 扩展：加入路由快照）───────────────────────────────
export interface SliceTickLog {
  tick_id:    string;
  拍计数:     number;
  结果摘要:   string;
  系数组指纹: string;
  盐值?:      number;
  路由快照?:  {
    routedVia:     string;
    modelKey:      string | null;
    explicitReason: string;
  };
}

// ── 拍前快照主体（进 ring buffer + 进存档体）─────────────────────────────────────
export interface SliceSnapshot {
  tick:             number;
  balances:         Record<string, number>;   // entity_key → 文钱余额
  tick_log:         SliceTickLog[];
  observationTable: unknown[];                // stub·M3 始终为空
  pendingQueue:     unknown[];                // stub·M3 始终为空
}

// ── 存档文件（校验和 + 快照体）────────────────────────────────────────────────────
export interface ArchiveFile {
  checksum: string;
  body:     SliceSnapshot;
}

// ── Ring buffer 容量常量 ───────────────────────────────────────────────────────
export const RING_K = 5;

// ── 拍前快照 ring buffer（固定深度·先进先出）────────────────────────────────────
export class SnapshotRingBuffer {
  private readonly _buf: SliceSnapshot[];
  private readonly _k:   number;

  constructor(k: number = RING_K) {
    this._buf = [];
    this._k   = k;
  }

  push(snapshot: SliceSnapshot): void {
    this._buf.push(snapshot);
    if (this._buf.length > this._k) this._buf.shift();
  }

  get size(): number { return this._buf.length; }

  get(index: number): SliceSnapshot | undefined {
    return this._buf[index];
  }

  getLast(): SliceSnapshot | undefined {
    return this._buf[this._buf.length - 1];
  }

  all(): readonly SliceSnapshot[] {
    return this._buf;
  }
}

// ── 校验和计算（禁裸 JSON.stringify；对存档体做确定性哈希）──────────────────────
export function computeChecksum(body: unknown): string {
  return hashCanonical(body);
}

// ── 序列化存档（{ checksum, body } → 确定性 JSON 字符串）────────────────────────
export function serializeArchive(snapshot: SliceSnapshot): string {
  const checksum = computeChecksum(snapshot);
  const archive: ArchiveFile = { checksum, body: snapshot };
  return canonicalize(archive);
}

// ── 反序列化 + 校验和验证（fail-closed：不符则 throw，不静默吃坏档）────────────
export function deserializeArchive(raw: string): SliceSnapshot {
  let parsed: unknown;
  try {
    // JSON.parse 合规（禁止的是裸 JSON.stringify，不是 JSON.parse）
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`存档解析失败 (JSON): ${String(e)}`);
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('checksum' in parsed) ||
    !('body' in parsed)
  ) {
    throw new Error('存档格式非法: 缺少 checksum 或 body 字段');
  }

  const file = parsed as ArchiveFile;
  const expected = computeChecksum(file.body);

  if (file.checksum !== expected) {
    throw new Error(
      `存档校验和不符: 期望 ${expected}，实际 ${file.checksum}（拒载·fail-closed）`,
    );
  }

  return file.body;
}

// ── 关账态门规：非空闲态禁止写快照/存档（防脏档落盘）───────────────────────────
export function assertClosedAccount(state: TickLifecycleState): void {
  if (state !== '空闲') {
    throw new Error(
      `关账态门规: 当前拍生命周期"${state}"非关账态（空闲），禁止写快照/存档`,
    );
  }
}
