# ProductSite 独立部署说明

## 审计结论

当前生产入口已不再通过 Manus OAuth、tRPC 或 Forge 服务运行。首页不再调用 `/api/trpc`，Vite 配置也不再加载 `vite-plugin-manus-runtime`。Cloudflare Pages 负责静态前端，Cloudflare Worker 负责申请上新和第一方匿名分析，D1 负责保存申请与分析事件。

仓库中仍保留部分模板文件，例如 `client/src/_core/hooks/useAuth.ts`、`DashboardLayout.tsx` 和 `client/src/const.ts`。这些文件当前没有从生产入口路由或首页导入，不会参与当前页面运行；它们属于未使用的模板遗留代码，后续可以单独清理，但不是 Cloudflare 上线的必要依赖。

## Cloudflare Pages 必需配置

| 配置 | 作用 | 是否必须 |
|---|---|---|
| `VITE_CLOUDFLARE_WORKER_URL` | 指向 `productsite-api` Worker，例如 `https://productsite-api.<account>.workers.dev` | 必须，用于申请表单、分析镜像和管理员面板 |
| `VITE_APP_TITLE` | 网站标题 | 可选 |
| `VITE_APP_LOGO` | 网站 Logo 配置 | 可选 |

Pages 构建命令仍使用仓库中的 `pnpm run build`。构建产物会同步到 `.vitepress/dist`，适合静态 Pages 部署。生产前端不要求 Manus 账号、Manus Cookie、Manus OAuth 或 Manus API Key。

## Cloudflare Worker 必需配置

| 配置 | 作用 | 是否必须 |
|---|---|---|
| D1 `DB` 绑定 | 保存 `product_requests` 和 `analytics_events` | 必须 |
| `ALLOWED_ORIGIN` | 允许 Pages 域名访问 Worker | 必须 |
| Secret `ADMIN_API_KEY` | 保护管理员申请和分析接口 | 必须 |

上线自定义域名时，需要把 `ALLOWED_ORIGIN` 改成新的正式域名，并重新部署 Worker。D1 迁移文件为 `cloudflare-worker/schema.sql`、`migrations/002_request_metadata.sql` 和 `migrations/003_analytics_events.sql`。

## 不再需要的 Manus 配置

生产 Pages 不需要 `VITE_OAUTH_PORTAL_URL`、`OAUTH_SERVER_URL`、`VITE_FRONTEND_FORGE_API_URL`、`VITE_FRONTEND_FORGE_API_KEY`、`BUILT_IN_FORGE_API_URL` 或 `BUILT_IN_FORGE_API_KEY`。本次审计已经从 Vite 生产构建链中移除 `vite-plugin-manus-runtime`，并从入口移除 tRPC/OAuth 客户端初始化。

## 验证结果

在不依赖 Manus 运行时服务的前提下，项目已完成 TypeScript 检查、20 项 Vitest 测试和生产构建。生产构建输出包含静态前端资源与 Worker 可打包的服务端产物；Pages 实际使用静态前端目录，Worker 使用 `cloudflare-worker/wrangler.toml` 和 D1 绑定。
