# ProductSite 推广链接规范

ProductSite 使用标准 UTM 参数记录推广来源。用户点击带参数的链接后会正常进入网站，不会看到中间跳转页；参数会保存在当前浏览会话中，并随匿名事件写入 Worker/D1，供 `/admin/analytics` 查看。

## 参数定义

| 参数 | 含义 | 示例 |
|---|---|---|
| `utm_source` | 流量来源平台 | `youtube`、`tiktok`、`instagram`、`discord` |
| `utm_medium` | 推广形式 | `video`、`bio`、`post`、`community`、`paid` |
| `utm_campaign` | 活动名称 | `summer-2026`、`catalog-launch` |
| `utm_content` | 同一活动中的具体位置，可选 | `description`、`profile`、`pinned-comment` |
| `utm_term` | 可选关键词或创意标签 | `streetwear` |

## 链接示例

YouTube 视频描述：

`https://productsite-8wf.pages.dev/?utm_source=youtube&utm_medium=video&utm_campaign=catalog-launch&utm_content=description`

YouTube 置顶评论：

`https://productsite-8wf.pages.dev/?utm_source=youtube&utm_medium=video&utm_campaign=catalog-launch&utm_content=pinned-comment`

TikTok 个人简介：

`https://productsite-8wf.pages.dev/?utm_source=tiktok&utm_medium=bio&utm_campaign=catalog-launch`

Instagram 个人简介：

`https://productsite-8wf.pages.dev/?utm_source=instagram&utm_medium=bio&utm_campaign=catalog-launch`

Discord 社区频道：

`https://productsite-8wf.pages.dev/?utm_source=discord&utm_medium=community&utm_campaign=catalog-launch`

如果要推广具体商品，在参数前添加商品路径，例如：

`https://productsite-8wf.pages.dev/product/7572868073?utm_source=youtube&utm_medium=video&utm_campaign=summer-2026&utm_content=description`

## 后台查看方式

进入 `https://productsite-8wf.pages.dev/admin/analytics`，输入 `ADMIN_API_KEY` 后刷新数据。分析面板中的“来源渠道”对应 `utm_source`，“推广媒介”对应 `utm_medium`，“推广活动”对应 `utm_campaign`。同一浏览会话内从首页进入商品详情、搜索、收藏或点击平台入口时，归因参数会继续保留。

建议每个平台和每个位置使用不同的 `utm_content`，例如 `description`、`pinned-comment` 和 `profile`，这样可以比较同一活动的不同投放位置。参数值建议只使用小写英文字母、数字和连字符，避免空格和中文编码造成统计分散。
