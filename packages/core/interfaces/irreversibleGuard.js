/* eslint-disable @typescript-eslint/no-unused-vars */
// irreversible 工具副作用守卫（对撞⑤ stub·接线见 P0-6+P1）
// 纪律：irreversible 产出进冻结载荷（同 Z5/R3-a）·重放短路读冻结·绝不重调外部
//       含 irreversible 的拍 重掏禁/强警示
/** 重放时读冻结载荷，绝不重调外部。未实装抛错。 */
export function replayIrreversible(_payload) {
    throw new Error('未实装: irreversible 重放守卫 (P0-6)');
}
/** 含 irreversible 的拍：重掏前强警示。未实装抛错。 */
export function assertNoRerollOnIrreversible(_tickId, _hasIrreversible) {
    throw new Error('未实装: irreversible 重掏守卫 (P0-6)');
}
