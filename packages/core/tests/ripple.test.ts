// 前置③·ripple.ts 四纯净件搬家验收：环边③断言 + LOD SCC 全解 + 逐字比对
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emitRipple, writeImpressionMax } from '../engine/ripple.js';
import { emitRipple as tickEmitRipple, writeImpressionMax as tickWriteImpressionMax } from '../engine/tick.js';

const CORE_ROOT = join(fileURLToPath(import.meta.url), '..', '..'); // packages/core/
const readSrc = (rel: string): string => readFileSync(join(CORE_ROOT, rel), 'utf-8');

describe('前置③·ripple.ts 搬家：环边③ + LOD SCC 全解断言', () => {
  it('ripple.ts 不 import tick.js', () => {
    expect(readSrc('engine/ripple.ts')).not.toMatch(/from ['"]\.\/tick\.js['"]/);
  });

  it('lodEngine.ts 不 import tick.js（环边③已断·改指 ripple.js）', () => {
    const src = readSrc('engine/lodEngine.ts');
    expect(src).not.toMatch(/from ['"]\.\/tick\.js['"]/);
    expect(src).toMatch(/from ['"]\.\/ripple\.js['"]/);
  });

  it('LOD SCC 全解：lodPhase/lodScheduler/lodEngine 三文件源码均无 from tick.js（tick→lodPhase→lodScheduler→lodEngine 已是纯前向链）', () => {
    for (const rel of ['engine/lodPhase.ts', 'engine/lodScheduler.ts', 'engine/lodEngine.ts']) {
      expect(readSrc(rel), `${rel} 不应再从 tick.js 取任何符号`).not.toMatch(/from ['"]\.\/tick\.js['"]/);
    }
  });

  it('cognitionProjection.ts 的 ImpressionEntry type-only import 走 tick.js re-export 兼容（未改）', () => {
    const src = readSrc('engine/cognitionProjection.ts');
    expect(src).toMatch(/import type \{ ImpressionEntry \} from '\.\/tick\.js'/);
  });
});

describe('前置③·ripple.ts 搬家：tick.js re-export 与 ripple.js 原生导出逐字等价', () => {
  it('emitRipple：re-export 与原生导出是同一函数引用（Function.prototype 逐字等价）', () => {
    expect(tickEmitRipple).toBe(emitRipple);
  });

  it('writeImpressionMax：re-export 与原生导出是同一函数引用', () => {
    expect(tickWriteImpressionMax).toBe(writeImpressionMax);
  });

  it('emitRipple 行为逐位一致（经 tick.js re-export 调用 vs 直接调用 ripple.js）', () => {
    const pendingA: Record<string, unknown[]> = {};
    const pendingB: Record<string, unknown[]> = {};
    const entry = { 标签: '壮举', 极性: '正', 强度: 80, 可见性: '公开', 来源拍号: 0 };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tickEmitRipple(pendingA as any, 'npc_a', entry);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    emitRipple(pendingB as any, 'npc_a', entry);
    expect(pendingA).toEqual(pendingB);
  });

  it('writeImpressionMax 行为逐位一致（取 max 防环语义不变）', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cogA: any = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cogB: any = {};
    const e1 = { 标签: 'X', 极性: '正', 强度: 50, 来源: 'evt1', 获知时间: 0, 衰减速率: 0, 来源类型: '一手观测' as const };
    const e2 = { 标签: 'X', 极性: '正', 强度: 80, 来源: 'evt2', 获知时间: 1, 衰减速率: 0, 来源类型: '一手观测' as const };
    tickWriteImpressionMax(cogA, 'obs', 'tgt', e1);
    tickWriteImpressionMax(cogA, 'obs', 'tgt', e2); // 80 > 50 → 覆盖
    writeImpressionMax(cogB, 'obs', 'tgt', e1);
    writeImpressionMax(cogB, 'obs', 'tgt', e2);
    expect(cogA).toEqual(cogB);
    expect(cogA.obs.tgt.印象[0].强度).toBe(80);
  });
});
