# ProductSite 网站管理指南

> 适用网站：RIVORA / ProductSite
>
> 生产地址：<https://productsite-8wf.pages.dev/>
>
> 本指南用于日常产品管理、用户申请回复、推广链接制作、数据分析和 Cloudflare 部署操作。

## 一、后台功能总览

所有管理员页面都建议使用 HTTPS 访问，并且需要输入当前有效的 `ADMIN_API_KEY`。不要把密钥写入推广链接、CSV 文件、截图、公开文档或 Discord 消息中。

| 功能 | 管理路径 | 主要用途 |
|---|---|---|
| 产品批量导入 | <https://productsite-8wf.pages.dev/admin/products/import> | 下载模板、导出当前商品、上传 CSV、预览并确认更新 |
| 用户申请管理 | <https://productsite-8wf.pages.dev/admin/requests> | 查看用户申请、修改状态、填写管理员回复 |
| 用户行为分析 | <https://productsite-8wf.pages.dev/admin/analytics> | 查看访问、商品浏览、搜索、来源、平台点击和转化 |
| 推广链接生成 | <https://productsite-8wf.pages.dev/admin/promotion-links> | 自定义来源并生成带 UTM 参数的推广链接 |
| 网站首页 | <https://productsite-8wf.pages.dev/> | 用户浏览商品和提交产品申请 |
| 用户查询申请 | <https://productsite-8wf.pages.dev/requests/status> | 用户输入申请编号查看处理状态和管理员回复 |

管理员后台中的功能入口都属于管理工具，不建议放在网站公开导航中，也不要把管理路径和密钥同时发送给普通用户。

## 二、批量产品数据管理

产品批量管理入口是：<https://productsite-8wf.pages.dev/admin/products/import>。

进入页面后，必须先输入管理员密钥并完成验证。验证成功后，页面才会解锁模板下载、当前数据导出、CSV 文件选择、校验预览和确认写入。前端门禁只是第一层保护，Worker 服务端仍会使用 `x-admin-api-key` 再次校验权限。

### 1. 下载数据模板

点击“下载数据模板（含真实示例）”。模板第一行是字段名，**第一行字段名不要修改、删除或重新排序**。模板中包含一行来自现有商品目录的真实示例，用于对照填写格式。

数组字段使用竖线分隔，例如：

```text
S|M|L|XL
```

图片地址也可以使用竖线分隔。平台链接字段如果需要手动填写，应按照页面提示使用对应格式；通常只需要填写一个有效的商品来源链接，系统会尝试识别 Weidian 商品 ID 并自动补齐缺失的代理平台链接。

### 2. 导出当前商品数据

点击“导出当前商品数据”会下载当前目录数据 CSV。导出的数据适合用于备份、批量修改和再次导入。建议在进行大批量修改前先导出一份原始备份，并在本地另存为带日期的文件，例如 `product-backup-2026-08-22.csv`。

### 3. 上传、校验和确认

CSV 每次最多上传 5,000 行。上传后先点击“校验并预览”，不要直接确认写入。系统会区分有效行和错误行，并显示识别到的 Weidian ID、将自动生成的平台链接数量以及新增或更新结果。

确认规则如下：

| 情况 | 系统行为 |
|---|---|
| 相同 `id` | 更新对应的商品覆盖记录 |
| 新的 `id` | 新增商品覆盖记录 |
| CSV 中没有出现的商品 | 不会自动删除 |
| CSV 存在字段错误 | 该行不应确认写入，应先修正后重新上传 |
| 仅有一个来源商品链接 | 系统根据识别到的 Weidian ID 补齐缺失平台链接 |

只有确认预览内容无误后，才点击“确认写入网站数据”。写入完成后刷新首页和相关商品详情页，检查标题、价格、分类、图片和购买链接是否符合预期。

### 4. 商品链接自动识别规则

导入时可以只填写一个来源商品链接。系统支持从常见 Kakobuy、Fansbuy、Weidian 及代理平台链接中提取商品 ID，再使用既定模板生成其他平台链接。已有链接优先保留，原始 Kakobuy 链接不会被无故替换。

如果系统无法从链接中提取 Weidian ID，预览中应显示错误或无法自动生成平台数量。此时不要确认写入，应检查链接是否完整、是否为商品详情页、是否包含有效的商品 ID。

## 三、Request a Product 用户申请管理

管理员入口是：<https://productsite-8wf.pages.dev/admin/requests>。

用户从首页点击 **REQUEST A PRODUCT**，填写昵称、联系方式、商品链接、商品图片链接、产品描述和补充要求。提交成功后系统会生成一个申请编号，例如：

```text
REQ-20260820-ABC123
```

用户需要保存这个编号。管理员在后台选择申请后，可以核对申请内容、更新处理状态并填写英文回复。保存回复后，用户访问 <https://productsite-8wf.pages.dev/requests/status>，输入申请编号即可查看状态和 **Administrator reply**。

建议使用清晰、克制的英文回复，例如说明“已收到申请，正在核对商品信息”，或说明“链接无法识别，请提供有效的商品详情页链接”。不要在回复中要求用户发送密码、支付验证码或其他敏感信息。

## 四、数据分析和推广归因

分析后台入口是：<https://productsite-8wf.pages.dev/admin/analytics>。管理员验证后，可以按“今天、昨天、最近 7 天、最近 30 天”查看统计。今天和昨天按北京时间自然日计算。

推广链接生成器入口是：<https://productsite-8wf.pages.dev/admin/promotion-links>。

来源可以从固定平台下拉选择，也可以选择“自定义网址”。固定平台包括 Kakobuy、Fast logistics、Superbuy、Litbuy、GTbuy、Oopbuy、Hipobuy、Fansbuy、LoveGoBuy、Hoobuy、UsFans、AllChinaBuy、Mulebuy、AcBuy、Joyagoo、OrientDig、Sugargoo、BBDBuyEU、VigorBuy 和 Fishgoo。

创建链接时填写来源、媒介、活动和投放位置。例如 YouTube 视频描述可以使用：

```text
https://productsite-8wf.pages.dev/?utm_source=youtube&utm_medium=video&utm_campaign=catalog-launch&utm_content=description
```

用户点击后会直接进入网站，不需要经过额外的跳转页面。后台会按 `utm_source`、`utm_medium`、`utm_campaign` 和 `utm_content` 记录归因。自定义网址应输入完整的 `http://` 或 `https://` 地址，系统会提取主机名作为主要来源，避免把过长网址直接作为渠道名称。

不要手动修改已经发布的链接参数；如果要区分新视频、置顶评论或新的投放批次，建议创建新的 `utm_campaign` 或 `utm_content`。

## 五、管理员密钥和安全规则

`ADMIN_API_KEY` 是管理员后台和 Worker 管理接口的访问凭证。应当使用高强度、不可猜测的密钥，并仅保存在 Cloudflare Worker 的 Secret 中。不要把密钥提交到 GitHub，不要放入 CSV，不要写入前端代码，也不要作为 URL 参数传递。

如果怀疑密钥泄露，应立即在 Cloudflare Worker 设置中重置 `ADMIN_API_KEY`，然后重新验证所有管理员页面。密钥重置后，旧密钥不应继续使用。

建议的管理习惯是：管理员页面只在需要时打开；完成操作后关闭页面；导出 CSV 后保存在受控位置；不通过公开频道传递用户申请中的联系方式或其他个人信息。

## 六、Cloudflare 部署流程

项目由 GitHub、Cloudflare Pages、Cloudflare Worker 和 D1 数据库共同组成。前端商品浏览主要由 Pages 提供，申请、分析、批量产品持久化等接口由 Worker 提供，商品覆盖数据和分析事件保存在 D1。

代码更新后，先确认 GitHub `ProductSite/main` 已经出现最新提交，再分别部署：

| 部署对象 | Cloudflare 项目 | 说明 |
|---|---|---|
| 后端 | `productsite-api` | 部署 Worker，使 API、权限和 D1 逻辑更新 |
| 前端 | `productsite` | 部署 Pages，使页面、路由和界面更新 |

涉及前端页面改动时需要重新部署 Pages；涉及 Worker 路由、D1 查询、管理员权限或导入逻辑时需要重新部署 Worker。若两边都发生改动，建议先部署 Worker，再部署 Pages，最后进行完整验证。

每次部署后至少检查首页、一个商品详情页、Request a Product 提交入口、管理员申请页面、分析页面和 CSV 导入页面。批量导入涉及 D1 写入时，必须先使用少量测试行进行校验预览，不要直接上传完整大文件确认写入。

## 七、上线前检查清单

> 上线前的最低要求是：代码已推送、Worker 和 Pages 版本已部署、D1 绑定正确、管理员密钥有效、公开页面可浏览、管理接口未授权时返回拒绝、授权后可以正常加载。

| 检查项 | 通过标准 |
|---|---|
| 首页 | 能打开，商品图片、标题、价格和分类正常 |
| 商品详情 | 图片切换、分享、购买平台链接和风险提示正常 |
| 收藏 | 手机端爱心可打开收藏视图，收藏商品两列显示，推荐模块正常 |
| Request a Product | 表单流程说明、提交结果和申请编号正常 |
| 管理员申请 | 能加载申请、保存状态和管理员回复 |
| 用户状态查询 | 输入申请编号能显示状态和管理员回复 |
| 分析面板 | 密钥保护正常，周期和渠道数据能加载 |
| 推广链接 | UTM 参数可生成，用户点击后无感进入网站 |
| CSV 管理 | 模板、导出、校验预览和确认写入均需管理员密钥 |
| Worker 安全 | 未带密钥的管理 API 返回未授权，CORS 仅允许生产站点 |
| 移动端 | 390px 宽度无横向溢出，分类与收藏状态不冲突 |

## 八、常见问题

### 页面显示旧版本

先确认 Pages 是否部署了最新 GitHub `main` 提交，再进行浏览器强制刷新。如果 Worker 和 Pages 版本不一致，管理页面可能显示新界面但接口仍返回旧数据，或新接口尚未可用。

### 分析页面无法加载

检查 Worker 是否为活动版本、`ADMIN_API_KEY` 是否已更新、D1 是否绑定到 `productsite-db`，以及 Worker 的 `ALLOWED_ORIGIN` 是否包含 `https://productsite-8wf.pages.dev`。不要把密钥放到 URL 中测试。

### CSV 导入失败

先下载最新模板，不要修改第一行字段名；检查 CSV 编码、必填 `id`、链接协议、数组分隔符和平台链接格式。修正后重新上传并查看预览错误，不要用错误预览直接确认写入。

### 用户看不到管理员回复

确认管理员回复已经保存，而不仅仅是填写在输入框中；确认用户使用的是完整申请编号；确认 Worker 和 Pages 都已经部署到包含回复字段修复的版本。

### 收藏模式仍显示分类高亮

清除旧版本缓存并确认 Pages 已部署最新前端版本。正确行为是：收藏模式打开后，分类菜单不再高亮且不能切换；退出收藏模式后，原分类浏览恢复。

## 九、建议的日常操作顺序

日常维护建议遵循“备份—小批量验证—确认写入—线上检查”的顺序。先导出当前商品 CSV 作为备份，再处理小批量数据；确认预览内容正确后再写入；最后从首页、商品详情页和管理员后台分别验证结果。涉及代码改动时，先在 GitHub 确认提交，再分别部署 Worker 和 Pages，并记录本次部署版本。
