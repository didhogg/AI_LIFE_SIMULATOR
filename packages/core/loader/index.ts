// packages/core/loader — barrel export (B1·K1 + B2·S5 + B3·K2 + B4)
// Mirrors verb.ts pattern: consumers import from this barrel, not from sub-modules directly.
export * from './modGraph.js';
export * from './modWhitelist.js';
export * from './resolvePackId.js';
export * from './semver.js';
export * from '../interfaces/contentPackHash.js'; // B4: 内容包集聚合哈希层
export * from '../interfaces/interventionMerge.js'; // B5·K5: 约束取严 merge
export * from '../interfaces/authGate.js'; // B5·M2: 覆写授权源认证
export * from '../interfaces/patchInvariant.js'; // B5·M3: 规则补丁负面清单
