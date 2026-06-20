// E0 内存存档 Mock — P0-11 探雷轮
// 纪律: 进程内读写·不落盘·不进指纹·不参与恒等
// P0-9 迁移面: 暂挂（不实装·沿用 demo D4 侦察记录）
import type { RootState } from '@ai-life-sim/core';
import {
  createFullArchiveHeader,
  bumpSalt,
  type FullArchiveHeader,
  type MinArchiveHeader,
} from '../slice/engine/archive.js';

export interface ArchiveSnapshot {
  header: FullArchiveHeader;
  state: RootState;
  balances: Record<string, number>;
  turn: number;
}

export class InMemoryArchiveStore {
  private snap: ArchiveSnapshot;

  constructor(seed: number, initialState: RootState, initialBalances: Record<string, number>) {
    this.snap = {
      header: createFullArchiveHeader(seed),
      state: structuredClone(initialState) as RootState,
      balances: { ...initialBalances },
      turn: 0,
    };
  }

  /** 读取当前存档快照（返回副本·防外部污染·不落盘） */
  load(): ArchiveSnapshot {
    return {
      header: this.snap.header,
      state: structuredClone(this.snap.state) as RootState,
      balances: { ...this.snap.balances },
      turn: this.snap.turn,
    };
  }

  /** 回写新状态（深克隆·不落盘·turn+1） */
  save(state: RootState, balances: Record<string, number>): void {
    this.snap = {
      header: this.snap.header,
      state: structuredClone(state) as RootState,
      balances: { ...balances },
      turn: this.snap.turn + 1,
    };
  }

  /** 重掷：递增全局回滚计数器（农骰防护·与 bumpSalt 同源） */
  bumpReroll(): void {
    this.snap = { ...this.snap, header: bumpSalt(this.snap.header) };
  }

  getTurn(): number { return this.snap.turn; }
  getSeed(): number { return this.snap.header.seed; }
  getHeader(): FullArchiveHeader { return this.snap.header; }
}
