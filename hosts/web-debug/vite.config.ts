// G1b3c · vite.config.ts — web-debug 浏览器调试壳
// 铁律: 不引重框架 · workspace alias 走 pnpm 符号链接（无需手配）
// process.env define: 从 .env 读 VITE_DEEPSEEK_* 注入 browser 端 process.env
// ⚠ 修改 .env 后须重启 npm run dev（Vite 仅启动时读 .env）

import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  // loadEnv 读取 hosts/web-debug/.env（第三参数 '' = 不过滤前缀·加载全部变量）
  const env = loadEnv(mode, process.cwd(), '')

  return {
    // @ai-life-sim/core 通过 pnpm 符号链接解析 · 无需 alias
    optimizeDeps: {
      // core 包导出 .ts 源文件·跳过预打包走 Vite 直接转译
      exclude: ['@ai-life-sim/core'],
    },
    define: {
      // 把 VITE_DEEPSEEK_* 注入为 process.env.DEEPSEEK_*
      // adapter(openai-compatible.js) 读 process.env['DEEPSEEK_API_KEY']·代码不变
      // key 在 build 时静态内联——仅本地调试壳使用·勿部署到公网
      // 未设置的变量用 undefined（JSON.stringify 会省略），让 adapter 的 ?? 默认值生效
      'process.env': JSON.stringify({
        DEEPSEEK_API_KEY:     env['VITE_DEEPSEEK_API_KEY']     || undefined,
        DEEPSEEK_BASE_URL:    env['VITE_DEEPSEEK_BASE_URL']    || undefined,
        DEEPSEEK_MODEL:       env['VITE_DEEPSEEK_MODEL']       || undefined,
        DEEPSEEK_TEMPERATURE: env['VITE_DEEPSEEK_TEMPERATURE'] || undefined,
        DUMP_PROMPT:          env['VITE_DUMP_PROMPT']          || undefined,
      }),
    },
    build: {
      target: 'es2022',
      outDir: 'dist',
    },
    server: {
      port: 5199,
      open: false,
    },
  }
})
