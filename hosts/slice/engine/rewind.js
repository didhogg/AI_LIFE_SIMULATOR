import { bumpSalt } from './archive.js';
/**
 * 悔棋到 ring buffer 第 index 条快照（0 = 最旧，size-1 = 最近一次拍前快照）。
 * 全局回滚计数器 +1：不随回滚还原，阻止骰子农场。
 */
export function rewindTick(ring, index, header) {
    const snap = ring.get(index);
    if (snap === undefined) {
        throw new Error(`悔棋索引越界: index=${index}，ring.size=${ring.size}`);
    }
    return {
        balances: new Map(Object.entries(snap.balances)),
        tick: snap.tick,
        tick_log: [...snap.tick_log],
        observationTable: [...snap.observationTable],  // P7-4b: 还原拍前观测值表
        pendingQueue: [...snap.pendingQueue],            // P7-4b: 还原拍前挂起命中队列
        header: bumpSalt(header), // 全局回滚计数器 +1，不回滚
    };
}
