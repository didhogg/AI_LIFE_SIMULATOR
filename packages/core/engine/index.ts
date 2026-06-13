// Ring 0 engine — public surface
export * from './time.js';
export * from './rng.js';
export * from './check.js';
export * from './assertFinite.js';
export * from './math/fixed.js';
export * from './text/canonicalize.js';
export * from './text/normalize.js';
export * from './fingerprintManifest.js';

/* eslint-disable @typescript-eslint/no-unused-vars */
// Ring 0 确定性纯函数；平局按节点键字典序；A* 实装归 P1
export function findRoute(
  图: Record<string, { 相邻?: { 目标: string }[] }>,
  起: string,
  终: string,
  NPC过滤器?: (节点键: string) => boolean,
): string[] | '不可达' {
  throw new Error('未实装');
}
/* eslint-enable @typescript-eslint/no-unused-vars */
