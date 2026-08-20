# 男士时尚商品标题体系深度诊断

## 结论摘要

当前标题体系已经摆脱了纯编号、尺寸和联系方式残留，但还没有真正做到“每个商品都像一个被编辑挑选出来的独立商品”。核心问题不是英文是否正确，而是标题的**信息密度和商品区分度不足**。系统现在更像是把大量商品归入少数安全模板，而不是根据源商品、子类、版型、图案、球队/俱乐部、品牌和图片证据逐条命名。

> 目前的标题系统完成了“清理”，但尚未完成“商品化命名”。

## 全量基线

| 指标 | 当前结果 | 说明 |
|---|---:|---|
| 商品卡片 | 2,192 | 当前目录总量 |
| 不同标题 | 456 | 只有 20.8% 的标题文本是独立的 |
| 重复标题商品数 | 2,128 | 许多不同商品共用同一标题 |
| 重复标题簇 | 392 | 存在大量模板收敛 |
| 泛化标题商品 | 240 | 主要集中在 `Essential Apparel` |
| 含编辑风格词标题 | 1,292 | 说明风格词覆盖较高，但不代表特征真实充分 |
| 含具体品类/特征词标题 | 1,035 | 仍有相当一部分只有泛化风格词 |
| 代码型残留 | 18 | 仍需继续处理，但已不是主要问题 |
| 平均标题长度 | 21.57 字符 | 长度不是主要缺陷 |
| 最大标题长度 | 42 字符 | 当前长度约束有效 |

问题集中在几个大类。Clothing 有 1,385 张卡片，但标题独立率只有 26.7%，并有 240 张仍显示 `Essential Apparel`。Pants 有 350 张卡片，标题独立率仅 7.4%，其中 `Essential Trousers`、`Essential Jeans` 和 `Warm-Weather Pants` 占据大部分结果。Shoes 有 111 张卡片，标题独立率为 9.0%，其中 93 张都收敛到 `Everyday Sneakers`。Watches 和 Fragrance 也分别高度收敛到 `Everyday Watch` 和 `Everyday Fragrance`。

## 为什么现在的优化不彻底

第一，系统把“风格词”当成了“商品特征”。`Essential`、`Everyday`、`Classic` 和 `Warm-Weather` 可以改善语气，但不能区分两条不同的牛仔裤、两双不同的鞋或两个不同的手表。当源数据无法提供可靠细节时，系统直接退回统一模板，造成了安全但低信息量的标题。

第二，品类映射过于粗。当前 `clothing` 下仍有大量 `Selection`，这不是面向用户的商品类型；部分商品虽然图片中明显是短袖、夹克、卫衣、球衣或内衣，标题却只能得到 `Essential Apparel`。这说明“分类结果”和“标题生成”之间没有建立足够细的中间层。

第三，源数据中的真实英文标题没有被充分保留。Kakobuy SKU 表中有 1,153 个不重复源商品可以匹配到 `title_original` 和 `title_en_platform`。示例包括 `High-Quality Casual Shoes 021`、球队/俱乐部名称和明确的产品类型。这些标题虽然需要清洗，但仍然比 `Everyday Sneakers` 携带更多商品身份信息。当前系统过早把编号或质量词全部抹掉，导致真实差异丢失。

第四，标题生成没有采用“特征优先级”。应先判断品牌/球队/俱乐部，再判断商品类型，再判断版型或结构，再判断图案/颜色，最后才补充风格词。目前流程常常先决定 `Everyday` 或 `Essential`，然后再用一个通用品类补齐，顺序反了。

第五，重复度没有被纳入生成约束。标题生成完成后，系统只检查了硬性问题，没有要求同一品类中相邻商品必须拥有不同的有效特征。因此 `Everyday Sneakers`、`Essential Trousers` 和 `Everyday Cap` 可以大量重复存在。

## 下一轮标题架构

下一轮不应继续增加更多形容词，而应使用分层决策：

| 优先级 | 特征来源 | 可写入标题的内容 | 例子 |
|---:|---|---|---|
| 1 | 品牌、球队、俱乐部 | 已确认的身份词 | `Arsenal`, `Nike`, `Gallery Dept` |
| 2 | 产品类型 | 用户能理解的具体品类 | `Graphic T-Shirt`, `Cargo Pants`, `Football Jersey` |
| 3 | 结构/版型 | 源标题或图片能确认的结构 | `Oversized`, `Wide-Leg`, `Zip-Up`, `Low-Top` |
| 4 | 图案/用途 | 源标题或全图可确认的特征 | `Graphic`, `Logo`, `Track`, `Workwear` |
| 5 | 颜色 | 只有源字段或图片高置信度确认时使用 | `Black`, `Washed Blue`, `Neutral` |
| 6 | 编辑风格词 | 仅在前面信息不足时补充 | `Essential`, `Streetwear`, `Vintage`, `Everyday` |

推荐的实际结构不是固定三词，而是“最有信息的三段”：

> **[Identity or Style] + [Specific Product Type] + [One Verified Feature]**

例如，应该从 `Everyday Sneakers` 进一步变为 `Retro Low-Top Sneakers`、`Graphic Canvas Sneakers` 或 `Nike Running Sneakers`，但只有在源标题、子类或全图足以支持时才使用。不能为了降低重复率而凭空加入 `Canvas`、`Leather`、`Waterproof` 或 `Performance`。

## 各品类应采用的中间层

| 品类 | 不应继续使用 | 应建立的具体类型层 | 可用模板示例 |
|---|---|---|---|
| T 恤 | Essential Apparel | T-Shirt、Graphic T-Shirt、Long-Sleeve、Polo | `Streetwear Graphic T-Shirt` |
| 卫衣 | Essential Apparel | Hoodie、Zip-Up Hoodie、Crewneck | `Minimalist Zip-Up Hoodie` |
| 外套 | Essential Apparel | Workwear Jacket、Bomber、Track Jacket、Vest | `Vintage Workwear Jacket` |
| 裤装 | Essential Trousers | Jeans、Cargo Pants、Sweatpants、Track Pants、Shorts | `Relaxed Fit Cargo Pants` |
| 鞋 | Everyday Sneakers | Low-Top、High-Top、Running、Basketball、Loafers、Boots | `Retro Low-Top Sneakers` |
| 球衣 | Essential Apparel | Football Jersey、Basketball Jersey、Training Top | `Retro Football Jersey` |
| 包 | Everyday Bag | Crossbody、Shoulder Bag、Backpack、Tote、Waist Bag | `Everyday Crossbody Bag` |
| 帽子/配饰 | Everyday Accessories | Cap、Beanie、Belt、Glasses、Wallet、Jewelry | `Minimalist Baseball Cap` |
| 手表 | Everyday Watch | Digital、Sport、Minimalist、Chronograph-style（仅有证据时） | `Minimalist Everyday Watch` |
| 香水 | Everyday Fragrance | Fragrance、Travel Atomizer、Gift Set（仅有证据时） | `Everyday Fragrance` |

## 三层兜底机制

第一层是**源数据标题优先**。保留真实品牌、球队、俱乐部和明确产品类型，只删除联系方式、无意义质量承诺、尺寸、价格和款号尾缀。第二层是**分类与图像特征补全**。当源标题只有 `High-Quality 021` 或 `Selection` 时，使用子类、图片主物体和全部画廊图判断具体类型。第三层才是**保守兜底**。如果图片确实无法判定结构，不再使用大量完全相同的 `Essential Apparel`，而应按大类和随机受控模板分配有限但有区分度的名称，例如 `Essential Casual Top`、`Minimalist Daily Layer`，并且要求同一商品的标题稳定、同一源商品的多价格 SKU 标题一致。

## 必须加入的质量指标

下一轮不能只检查“没有代码、没有中文、没有超长”。还应加入以下指标：

| 指标 | 建议目标 |
|---|---:|
| 完全相同标题占比 | 低于 15% |
| `Essential Apparel` 占比 | 低于 1% |
| 只有风格词、没有具体品类词 | 低于 3% |
| 同一品类前 20 个标题的重复簇 | 不超过 3 个大簇 |
| 品牌/球队/俱乐部可确认但标题未使用 | 低于 5% |
| 源标题有具体类型但标题被泛化 | 低于 5% |
| 标题长度 | 18–42 字符为主 |
| 任何虚构材质、性能、销量或评论 | 0 |

## 建议的执行顺序

下一轮应先处理 1,385 条 Clothing，因为它同时拥有最大数量和最多 `Essential Apparel`。随后处理 350 条 Pants 和 111 条 Shoes，这两个品类重复度最高、用户最容易通过标题判断差异。最后再处理 Bags、ACC、Watches 和 Fragrance。每个品类都应先生成候选标题统计，再审核高重复簇，最后写入可重复运行的规则或人工/视觉覆盖表，而不是直接一次性覆盖全部数据。

更彻底的做法不是让 AI 为每张卡片自由发挥，而是让 AI 只负责两件事：一是从全部商品图片中判断具体类型和结构；二是在受控词库中选择一个最符合证据的特征词。最终标题仍由确定性模板生成。这样可以同时保证**差异化、可复现、可审计和不虚构**。
