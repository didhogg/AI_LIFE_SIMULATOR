// G1b3c · vite.config.ts — web-debug 浏览器调试壳
// 铁律: 不引重框架 · workspace alias 走 pnpm 符号链接（无需手配）
// process.env define: browser 中 API key 缺席 → callNarrativeSafe isFallback=true

import { defineConfig } from 'vite'

export default defineConfig({
  // @ai-life-sim/core 通过 pnpm 符号链接解析 · 无需 alias
  optimizeDeps: {
    // core 包导出 .ts 源文件·跳过预打包走 Vite 直接转译
    exclude: ['@ai-life-sim/core'],
  },
  define: {
    // 浏览器无 process.env → LLM 调用 key 缺失 → callNarrativeSafe isFallback=true
    'process.env': '{}',
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
  server: {
    port: 5199,
    open: false,
  },
})
