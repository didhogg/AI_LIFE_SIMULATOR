/* eslint-disable @typescript-eslint/no-unused-vars */
// 动词表通道 B·签名代码插件接口（对撞 stub·接线留 P0-6/P0-7）
// R6-a 唯一合法出口：通道 B 若要执行代码，只能是已验签的 Resolver（血统可追溯）；
// 禁内嵌任意 JS / eval。默认关闭，本批不接任何真实执行逻辑。

export interface 动词签名插件描述 {
  readonly 插件id:   string;
  readonly 签名:     string;  // 同 mod 注册表签名口径（Ed25519 等）；验签逻辑留 P0-6
  readonly 启用:     boolean; // 默认关：调用方须显式置 true，本批恒不实装/恒不执行
}

/** 执行签名插件（未实装·默认关·本批零接线）。 */
export function executeVerbSignedPlugin(
  _desc: 动词签名插件描述,
  _params: Record<string, unknown>,
): never {
  throw new Error('未实装: 动词表通道 B 签名插件 (P0-6/P0-7)');
}
