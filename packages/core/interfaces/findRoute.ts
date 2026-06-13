/* eslint-disable @typescript-eslint/no-unused-vars */
// P0-1x·findRoute 寻路备忘 接口冻结 stub（🔴卡 P0-7 实装）
// findRoute(图, 起, 终, NPC过滤器) → 节点序列 | null(不可达)
// 平局按节点键字典序（规则冻结·接线时不得更改）

/**
 * 在地图图结构中寻找从起点到终点的路径。
 * @param _图 - 地图图结构（节点键→邻接表，P0-7 细化类型）
 * @param _起 - 起点节点键
 * @param _终 - 终点节点键
 * @param _NPC过滤器 - NPC 通行过滤器表达式（开放串）
 * @returns 节点键序列（含起点和终点）；不可达时返回 null
 * @note 平局按节点键字典序排序（6.x 冻结规则）
 */
export function findRoute(
  _图: unknown,
  _起: string,
  _终: string,
  _NPC过滤器: string,
): string[] | null {
  throw new Error('未实装');
}
