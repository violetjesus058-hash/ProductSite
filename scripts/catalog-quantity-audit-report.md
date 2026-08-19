# 排除 Fansbuy 旧商品后的产品数量审计报告

**审计日期：2026-08-19**

## 结论先说

> **当前网站并没有把旧 Fansbuy 商品混进来。** 当前生成器只读取 Kakobuy 主工作簿；旧 Fansbuy 工作簿与 Kakobuy 工作簿的唯一商品 ID 交集为 **0**。

因此，网站看起来“产品少”并不是因为排除 Fansbuy 后误删了 Kakobuy 产品，而是因为项目同时存在四种不同的数量口径：**SKU 明细行、唯一源商品、按美元价格拆出的展示商品、当前页面首屏可见卡片**。如果以“商品”理解为 Kakobuy item，则是 1,154 个；如果以“价格可独立购买的商品卡片”理解，则理论上是 2,194 个，当前网站实际生成 2,192 个。

## 一、数据来源没有混用

当前生成脚本 `scripts/generate-kakobuy-full-products.py` 的输入固定为 `/home/ubuntu/upload/pasted_file_drov2V_Kakobuy_SKU_数据表.xlsx`。旧的 Clothing、Accessories、Pants、Watches 和 Shoes 工作簿没有被该脚本读取；它们只是历史 Fansbuy 分类表。

| 数据来源 | 行数 | 唯一商品 ID | 链接特征 | 是否进入当前生成器 |
|---|---:|---:|---|---|
| Kakobuy 主工作簿 | 96,271（含多张辅助表） | 1,154 | 82,492 条 Kakobuy/Weidian 链接命中 | 是 |
| 旧 Fansbuy Clothing 表 | 2,553 | 127 | 2,553 条 Fansbuy 链接 | 否 |
| 旧 Fansbuy Accessories 表 | 1,816 | 78 | 1,816 条 Fansbuy 链接 | 否 |
| 旧 Fansbuy Pants 表 | 686 | 29 | 686 条 Fansbuy 链接 | 否 |
| 旧 Fansbuy Watches 表 | 170 | 8 | 170 条 Fansbuy 链接 | 否 |
| 旧 Fansbuy Shoes 表 | 678 | 33 | 678 条 Fansbuy 链接 | 否 |
| 旧 Fansbuy 表合计 | 5,903 | 274（去重后） | 全部为 Fansbuy | 否 |

旧 Fansbuy 五张表合计有 274 个唯一商品 ID。将这 274 个 ID 与 Kakobuy 主工作簿的 1,154 个唯一商品 ID 比较，交集为 **0**；也就是说，排除旧 Fansbuy 数据不会从当前 Kakobuy 目录中扣除重复商品。

## 二、Kakobuy 主表为什么不是 96,271 个商品

Kakobuy 主工作簿是一个完整采集数据库，不是可以直接展示的商品卡片表。其中 `sku_records` 有 **77,563 行**，每一行代表一个 SKU/款式/尺码/价格组合；`products` 表只有 **1,154 行**，每行才更接近一个 Kakobuy 商品 item。其余 `product_images`、`product_platforms`、`url_dedup` 和 `failed_pages` 是辅助表，不能再加总为商品数量。

| Kakobuy 主表 | 行数 | 正确解释 |
|---|---:|---|
| `sku_records` | 77,563 | SKU 明细，不应直接作为商品卡片 |
| `products` | 1,154 | 唯一 Kakobuy 商品 item |
| `product_images` | 13,770 | 商品图片明细 |
| `product_platforms` | 1,463 | 平台链接明细 |
| `url_dedup` | 1,733 | URL 去重辅助表 |
| `failed_pages` | 579 | 失败/异常页面记录 |

## 三、网站实际展示数量是 2,192，不是 1,154

生成器按 `product_id + price_usd` 建立展示卡片。相同 Kakobuy 商品下，如果所有型号价格相同，就合并为一个卡片；如果不同型号存在多个美元价格，则拆成多个可购买价格组，同时保留尺码和规格。

| 价格聚合结果 | 数量 |
|---|---:|
| Kakobuy 唯一商品 | 1,154 |
| 所有型号同一美元价格，可合并 | 588 |
| 存在多个美元价格、需要拆分 | 566 |
| 理论价格展示组 | 2,194 |
| 当前网站实际卡片 | 2,192 |
| 因本地图片不可用而跳过 | 2 个价格组 |

当前网站的 2,192 条记录来自 **1,153 个唯一 sourceProductId**。缺失的唯一商品是 `7782588053`，标题为 **26-27 Mali Player Edition**。它在 Kakobuy 主表中有 SKU、价格和 5 张图片记录，但 `scripts/kakobuy-cover-download-list.json` 中该商品的 `local_path` 为 `null`，生成器在没有可用本地图片时执行 `continue`，所以它的两个价格组 `20.09 USD` 和 `23.31 USD` 没有进入前端。

这不是 Fansbuy 排除造成的缺失，而是**本地图片下载失败导致的展示过滤**。

## 四、前端没有在普通浏览模式下隐藏整批商品

`Home.tsx` 的普通浏览模式会对全部 `products` 做分类、品牌和搜索筛选；只有 URL 明确进入 AI Audit View 时，才会通过 `seenIds` 排除已审商品。普通模式的 `visible` 仍然只是当前筛选后的前 `pageSize` 条记录，因此首屏只看到少量卡片是正常现象，不代表目录只有这些商品。

当前代码中普通浏览默认 `pageSize` 为 40，AI Audit View 默认批次为 80。商品列表还会执行 `result.slice(0, pageSize)`。因此需要区分以下两件事：

| 用户看到的现象 | 实际原因 |
|---|---|
| 首屏只有几张卡片 | 瀑布流首批渲染和视口高度限制 |
| 点击一个类目后数量少 | 该类目本身的价格组数量较少，或使用了品牌/搜索筛选 |
| 审核模式下商品变少 | `seenIds` 会排除已审核 sourceProductId，这是设计行为 |
| 某个商品完全不见 | 当前最明确的原因是 7782588053 的本地图片为空 |
| 旧 Fansbuy 商品不见 | 正常，因为当前项目已切换为 Kakobuy 主数据 |

## 五、当前网站各大类的真实卡片数量

当前前端 `products.ts` 的 2,192 条展示记录按大类统计如下。`ACC` 与历史小写 `accessories` 尚未完全统一，因此 Accessories 视觉上可能被拆成两个内部值；这会影响统计口径，但不会导致商品被删除。

| 类目 | 展示卡片 | 唯一源商品 |
|---|---:|---:|
| Clothing | 1,387 | 693 |
| Pants | 348 | 228 |
| Accessories / ACC | 242 + 13 | 115 + 4 |
| Shoes | 111 | 81 |
| Bags | 54 | 14 |
| Fragrance | 15 | 5 |
| Watches | 22 | 13 |
| 合计 | 2,192 | 1,153 |

## 六、最主要的数量差异原因

第一，**把 SKU 明细、唯一商品和价格商品混为一个概念**，会造成数量误判。77,563 条 SKU 不是 77,563 个商品；1,154 个 Kakobuy item 也不等于 1,154 张卡片，因为 566 个 item 存在多个美元价格组。

第二，**当前网站使用图片可用性作为硬过滤条件**。生成器在 `if not images: continue` 后直接跳过记录，因此任何价格组只要没有本地图片，就不会出现在前端。当前已经确认有一个 source item、两个价格组受此影响。

第三，**首屏和筛选状态限制了可见数量**。普通模式默认只取 40 条，AI 审核模式只取 80 条；品牌、搜索、类目和已审核状态还会继续缩小结果集。

第四，**ACC/accessories 内部值不统一**。当前数据同时存在 `ACC` 和 `accessories`，而首页导航只将 `ACC` 作为正式 Accessories 导航项。这 13 条小写 `accessories` 记录仍在总目录中，但在点击正式 ACCESSORIES 类目时不会被匹配，造成用户感觉配饰产品少了 13 条。

第五，**旧 Fansbuy 数据被排除是预期行为，不是异常**。旧表的 274 个商品 ID 与 Kakobuy 主表完全不重合；如果用户把旧 Fansbuy 表的数量也算进期望总量，切换到 Kakobuy 后目录自然会少 274 个旧商品，但这属于数据源切换，不是误删。

## 七、建议的修复顺序

建议先修复两个确定问题。第一，将 `accessories` 统一映射为 `ACC`，并重新生成统计，使 ACCESSORIES 导航完整覆盖 128 个唯一源商品和 255 条展示卡片。第二，重新下载或人工指定 `7782588053` 的一张可用主图，让两个价格组进入网站；完成后网站应从 2,192 张卡片恢复到理论上的 2,194 张。

随后建议在首页增加清晰的数量口径说明，例如 `1,154 Kakobuy items / 2,194 purchase-ready price cards`，并将“首屏显示数量”和“总目录数量”分开表达。这样用户不会把首屏看到的 40 张卡片误解为整个网站只有 40 个商品。

最后，如果用户的真实目标是“一种价格一个商品作为 SKU”，当前按 `product_id + price_usd` 的聚合规则已经接近该要求；但如果希望每个 Kakobuy item 只显示一张卡片，则需要改为 1,154 个唯一 item 卡片，并把多个价格放入详情页选项，而不是继续拆成 2,194 张展示卡片。

## 审计依据

本报告依据项目当前文件 `/home/ubuntu/upload/pasted_file_drov2V_Kakobuy_SKU_数据表.xlsx`、五张历史 Fansbuy 工作簿、`scripts/generate-kakobuy-full-products.py`、`client/src/pages/Home.tsx`、`client/src/data/products.ts` 以及本轮生成的 `/home/ubuntu/catalog_quantity_audit.json` 和 `scripts/kakobuy-price-grouping-analysis.md`。
