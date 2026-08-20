# Cloudflare Worker / D1 申请上新模块

## 当前文件

`schema.sql` 是 D1 建表脚本，`src/index.ts` 是 Worker API，`wrangler.toml` 是部署配置模板。管理员页面地址为 `/admin/requests`，公开申请表单从首页左侧的“申请上新产品”打开。

## Cloudflare 设置顺序

1. 在 D1 数据库的 SQL 控制台执行 `schema.sql`。你已经完成了这一步。
2. 复制 D1 数据库的 Database ID，替换 `wrangler.toml` 中的 `REPLACE_WITH_D1_DATABASE_ID`。
3. 将 `ALLOWED_ORIGIN` 替换为 Cloudflare Pages 的正式网址，例如 `https://productsite.pages.dev`。
4. 在 Worker 的 Secrets 中设置 `ADMIN_API_KEY`，不要把密钥写入 GitHub。建议使用长度较长的随机字符串。
5. 部署 Worker，得到地址，例如 `https://productsite-api.<account>.workers.dev`。
6. 在 Cloudflare Pages 项目设置中增加环境变量 `VITE_CLOUDFLARE_WORKER_URL`，值为 Worker 地址，不要在末尾添加 `/`。
7. 重新部署 Pages。完成后首页表单的“提交申请”按钮会启用，管理员页面可以使用管理员密钥读取和回复申请。

## API

| 方法 | 路径 | 权限 | 作用 |
|---|---|---|---|
| POST | `/api/requests` | 公开 | 创建申请并返回申请编号 |
| GET | `/api/requests/:requestCode` | 公开 | 用户凭申请编号查询状态与回复 |
| GET | `/api/admin/requests` | `x-admin-api-key` | 管理员读取申请列表 |
| PATCH | `/api/admin/requests/:id` | `x-admin-api-key` | 管理员修改状态和回复 |

在 Worker 未绑定前，预览页面会显示“尚未连接 Cloudflare Worker”，提交按钮保持禁用，避免申请内容误以为已经保存。Discord 按钮可以直接使用：<https://discord.gg/jtc399kUQV>。

## 申请元数据扩展

新版 Worker 会在用户提交申请时由 Cloudflare 服务端读取请求元数据，并保存脱敏 IP、国家/地区、城市、设备类型、浏览器、操作系统和 User-Agent 摘要。公开申请状态页不会返回这些字段，只有带有 `x-admin-api-key` 的管理员列表接口会返回。

已有 `product_requests` 表的数据库需要先在 Cloudflare D1 控制台执行 `migrations/002_request_metadata.sql` 中的 8 条 `ALTER TABLE` 语句。执行成功后，再从 GitHub 重新部署 Worker。新提交的申请才会开始记录这些字段，旧申请的元数据会显示为“—”，不会伪造历史数据。

管理员页面会显示用户完整表单资料、时间、脱敏 IP、国家/地区、设备、浏览器、操作系统和 User-Agent 摘要。IP 仅用于后台排查和统计，建议定期清理或按隐私政策保留。
