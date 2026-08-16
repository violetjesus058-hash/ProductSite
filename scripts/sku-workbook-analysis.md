# Latest Fansbuy SKU Workbook Analysis

- Workbook: `pasted_file_drov2V_Kakobuy_SKU_数据表.xlsx`
- Existing catalog source: `products.ts`

## Workbook overview

| Sheet | Data rows | Columns | Headers |
|---|---:|---:|---|
| sku_records | 77563 | 30 | sku_key; product_id; sku_id; title_original; title_en_platform; source_url; platform_url; primary_platform; category; subcategory; variant_properties_raw; variant_label; attr_ids; price_rmb; price_usd; currency_source; price_checked_at; price_status; stock_quantity; stock_status; status; cover_image; variant_images; detail_images; source_sheets; source_locations; api_type; data_source; collection_method; notes |
| products | 1154 | 21 | product_id; title_original; title_en_platform; source_url; primary_platform_url; category; subcategory; default_price_rmb; default_price_usd; cover_image; seller_name; seller_url; api_type; platform_name; product_status; sku_count; available_sku_count; out_of_stock_sku_count; source_sheets; collected_at; data_source |
| product_images | 13770 | 7 | product_id; image_type; image_order; image_url; source_url; checked_at; image_status |
| product_platforms | 1463 | 8 | product_id; platform_name; url; is_primary; price_rmb_reference; price_usd_reference; checked_at; status |
| failed_pages | 579 | 7 | source_url; primary_platform_url; source_sheets; source_locations; checked_at; failure_code; failure_reason |
| url_dedup | 1733 | 8 | source_url; primary_platform_url; all_platform_urls; source_sheets; source_locations; fetch_status; product_id; failure_reason |
| summary | 9 | 2 | 指标; 数值 |

## Existing catalog parse status

- Existing product objects parsed: **276**
- Parse issue: none

## Workbook fields

| Field | Non-empty rows | Example values |
|---|---:|---|
| product_id | 95104 | 7511646004; 7542766831; 7542798673 |
| source_url | 94799 | https://weidian.com/item.html?itemID=7511646004; https://weidian.com/item.html?itemID=7542766831; https://weidian.com/item.html?itemID=7542798673 |
| source_sheets | 81029 | Trending Now🔥  (1); Trending Now🔥 ；Trending Now🔥  (1)；❄️How to match❗️; Trending Now🔥 ；Trending Now🔥  (1)；❄️Fall & Winter Clothes🧥；❄️How to match❗️ |
| source_locations | 79875 | Trending Now🔥  (1)!K43; Trending Now🔥  (1)!D2526；Trending Now🔥  (1)!D59；Trending Now🔥 !D1199；Trending Now🔥 !D38；❄️How to match❗️!F198; Trending Now🔥  (1)!D163；Trending Now🔥  (1)!D5002；Trending Now🔥 !D2054；Trending Now🔥 !D87；Trending Now🔥 !J2054；❄️How to m |
| status | 79026 | Available; Out of stock; Verified |
| title_original | 78717 | Sweater (high quality); 工厂高质量卫衣套装; 高品质休闲鞋021 |
| title_en_platform | 78717 | Sweater (high quality); High-Quality Hoodie Set from Factory 6PM; High-Quality Casual Shoes 021 |
| category | 78717 | Unclassified; Clothing; Accessories |
| subcategory | 78717 | Unspecified; Jerseys |
| cover_image | 78717 | https://si.geilicdn.com/pcitem1810691551-31f1000001924b46bf830a2301b4_1080_1080.jpg; https://si.geilicdn.com/open1699464805-1848188377-366600000193cf903f5c0a8115b5_1000_1000.jpg; https://si.geilicdn.com/open1702652901-1702652901-2bd2000001926f0849bd0a8133b5_1080_1440.jpg |
| api_type | 78717 | micro |
| data_source | 78717 | Kakobuy; Kakobuy public page API |
| sku_key | 77563 | 7511646004:125217158471; 7511646004:125217158473; 7511646004:125217158475 |
| sku_id | 77563 | 125217158471; 125217158473; 125217158475 |
| platform_url | 77563 | https://www.kakobuy.com/item/details?url=https%3A%2F%2Fweidian.com%2Fitem.html%3FitemID%3D7511646004&affcode=tcwed; https://www.kakobuy.com/item/details?url=https://weidian.com/item.html?itemID=7542766831&affcode=tcwed; https://www.kakobuy.com/item/details?url=https://weidian.com/item.html?itemID=7542798673&affcode=tcwed |
| primary_platform | 77563 | Kakobuy |
| variant_properties_raw | 77563 | 0:9:styles:1;1:5:size:S; 0:9:styles:1;1:6:size:M; 0:9:styles:1;1:7:size:L |
| attr_ids | 77563 | 9-5; 9-6; 9-7 |
| price_rmb | 77563 | 139; 256.8; 207.6 |
| price_usd | 77563 | 22.34; 41.27; 33.37 |
| currency_source | 77563 | Kakobuy item API, CNY + displayed USD |
| price_checked_at | 77563 | 2026-08-16T09:19:14.063Z; 2026-08-16T09:19:14.107Z; 2026-08-16T09:19:18.326Z |
| price_status | 77563 | Verified |
| stock_quantity | 77563 | 942; 924; 949 |
| stock_status | 77563 | Available; Out of stock |
| collection_method | 77563 | Kakobuy public page API |
| notes | 77563 | SKU source: skus.sku |
| variant_label | 77163 | 1;S; 1;M; 1;L |
| checked_at | 15812 | 2026-08-16T09:19:14.063Z; 2026-08-16T09:19:14.107Z; 2026-08-16T09:19:18.326Z |
| image_type | 13770 | cover; detail |
| image_order | 13770 | 1; 2; 3 |
| image_url | 13770 | https://si.geilicdn.com/pcitem1810691551-31f1000001924b46bf830a2301b4_1080_1080.jpg; https://si.geilicdn.com/pcitem901908374288-713b0000019406c456bc0a20e284-unadjust_596_275.png; https://si.geilicdn.com/pcitem1810691551-386e000001924b476bfc0a207569_1080_1080.jpg |
| image_status | 13770 | Captured |
| primary_platform_url | 3466 | https://www.kakobuy.com/item/details?url=https%3A%2F%2Fweidian.com%2Fitem.html%3FitemID%3D7511646004&affcode=tcwed; https://www.kakobuy.com/item/details?url=https://weidian.com/item.html?itemID=7542766831&affcode=tcwed; https://www.kakobuy.com/item/details?url=https://weidian.com/item.html?itemID=7542798673&affcode=tcwed |
| platform_name | 2617 | weidian; Kakobuy |
| all_platform_urls | 1733 | ["https://www.kakobuy.com/item/details?url=https%3A%2F%2Fweidian.com%2Fitem.html%3FitemID%3D7511646004&affcode=tcwed"]; ["https://www.kakobuy.com/item/details?url=https://weidian.com/item.html?itemID=7542766831&affcode=tcwed"]; ["https://www.kakobuy.com/item/details?url=https://weidian.com/item.html?itemID=7542798673&affcode=tcwed"] |
| fetch_status | 1733 | Success; Failed |
| url | 1463 | https://www.kakobuy.com/item/details?url=https%3A%2F%2Fweidian.com%2Fitem.html%3FitemID%3D7511646004&affcode=tcwed; https://www.kakobuy.com/item/details?url=https://weidian.com/item.html?itemID=7542766831&affcode=tcwed; https://www.kakobuy.com/item/details?url=https://weidian.com/item.html?itemID=7542798673&affcode=tcwed |
| is_primary | 1463 | Yes; No |
| price_rmb_reference | 1463 | 139; 96; 357.6 |
| price_usd_reference | 1463 | 22.34; 15.43; 57.47 |
| failure_reason | 1158 | 接口未返回商品数据; item not found |
| default_price_rmb | 1154 | 139; 96; 357.6 |
| default_price_usd | 1154 | 22.34; 15.43; 57.47 |
| seller_name | 1154 | 4号小店 |
| seller_url | 1154 | https://weidian.com/?userid=1784277725 |
| product_status | 1154 | Available |
| sku_count | 1154 | 20; 32; 385 |
| available_sku_count | 1154 | 20; 32; 385 |
| out_of_stock_sku_count | 1154 | 0; 12; 6 |
| collected_at | 1154 | 2026-08-16T09:19:14.063Z; 2026-08-16T09:19:14.107Z; 2026-08-16T09:19:18.326Z |
| failure_code | 579 | 200; 1002 |
| 指标 | 9 | Kakobuy 唯一源商品页总数; 成功采集商品页数; 失败或无商品数据页数 |
| 数值 | 9 | 1733; 1154; 579 |

## ID and overlap analysis

| Metric | Value |
|---|---:|
| Workbook data rows | 96271 |
| Rows with a detectable product/SKU ID | 95104 |
| Unique workbook IDs | 1154 |
| Duplicate workbook IDs | 1154 |
| IDs overlapping current catalog | 0 |
| IDs new to current catalog | 1154 |
| Current catalog IDs absent from workbook | 276 |

Duplicate IDs: `7511646004, 7542766831, 7542798673, 7542802651, 7542974543, 7543046447, 7543307459, 7543307465, 7543309413, 7543309423, 7543309425, 7543311375, 7543311377, 7543311383, 7543313315, 7543313325, 7543315317, 7543319183, 7543321151, 7543321169, 7543323065, 7543323077, 7543325019, 7543327097, 7543327113, 7543327115, 7543327119, 7543329037, 7543331013, 7543332935, 7543332937, 7543334869, 7543334883, 7543336851, 7543336857, 7543338873, 7543338877, 7543342819, 7543342823, 7543344865, 7543346825, 7543346835, 7543346841, 7543348799, 7543348805, 7543352763, 7543352771, 7543352781, 7543352789, 7543354807`

## Sample normalized records

| Sheet row | ID | Title | Price | URL |
|---:|---|---|---|---|
| sku_records:2 | 7511646004 | Sweater (high quality) | 139 | https://weidian.com/item.html?itemID=7511646004 |
| sku_records:3 | 7511646004 | Sweater (high quality) | 139 | https://weidian.com/item.html?itemID=7511646004 |
| sku_records:4 | 7511646004 | Sweater (high quality) | 139 | https://weidian.com/item.html?itemID=7511646004 |
| sku_records:5 | 7511646004 | Sweater (high quality) | 139 | https://weidian.com/item.html?itemID=7511646004 |
| sku_records:6 | 7511646004 | Sweater (high quality) | 139 | https://weidian.com/item.html?itemID=7511646004 |
| sku_records:7 | 7511646004 | Sweater (high quality) | 139 | https://weidian.com/item.html?itemID=7511646004 |
| sku_records:8 | 7511646004 | Sweater (high quality) | 139 | https://weidian.com/item.html?itemID=7511646004 |
| sku_records:9 | 7511646004 | Sweater (high quality) | 139 | https://weidian.com/item.html?itemID=7511646004 |
| sku_records:10 | 7511646004 | Sweater (high quality) | 139 | https://weidian.com/item.html?itemID=7511646004 |
| sku_records:11 | 7511646004 | Sweater (high quality) | 139 | https://weidian.com/item.html?itemID=7511646004 |
| sku_records:12 | 7511646004 | Sweater (high quality) | 139 | https://weidian.com/item.html?itemID=7511646004 |
| sku_records:13 | 7511646004 | Sweater (high quality) | 139 | https://weidian.com/item.html?itemID=7511646004 |
| sku_records:14 | 7511646004 | Sweater (high quality) | 139 | https://weidian.com/item.html?itemID=7511646004 |
| sku_records:15 | 7511646004 | Sweater (high quality) | 139 | https://weidian.com/item.html?itemID=7511646004 |
| sku_records:16 | 7511646004 | Sweater (high quality) | 139 | https://weidian.com/item.html?itemID=7511646004 |
| sku_records:17 | 7511646004 | Sweater (high quality) | 139 | https://weidian.com/item.html?itemID=7511646004 |
| sku_records:18 | 7511646004 | Sweater (high quality) | 139 | https://weidian.com/item.html?itemID=7511646004 |
| sku_records:19 | 7511646004 | Sweater (high quality) | 139 | https://weidian.com/item.html?itemID=7511646004 |
| sku_records:20 | 7511646004 | Sweater (high quality) | 139 | https://weidian.com/item.html?itemID=7511646004 |
| sku_records:21 | 7511646004 | Sweater (high quality) | 139 | https://weidian.com/item.html?itemID=7511646004 |
| sku_records:22 | 7542766831 | 工厂高质量卫衣套装 | 256.8 | https://weidian.com/item.html?itemID=7542766831 |
| sku_records:23 | 7542766831 | 工厂高质量卫衣套装 | 256.8 | https://weidian.com/item.html?itemID=7542766831 |
| sku_records:24 | 7542766831 | 工厂高质量卫衣套装 | 256.8 | https://weidian.com/item.html?itemID=7542766831 |
| sku_records:25 | 7542766831 | 工厂高质量卫衣套装 | 256.8 | https://weidian.com/item.html?itemID=7542766831 |
| sku_records:26 | 7542766831 | 工厂高质量卫衣套装 | 256.8 | https://weidian.com/item.html?itemID=7542766831 |
| sku_records:27 | 7542766831 | 工厂高质量卫衣套装 | 256.8 | https://weidian.com/item.html?itemID=7542766831 |
| sku_records:28 | 7542766831 | 工厂高质量卫衣套装 | 256.8 | https://weidian.com/item.html?itemID=7542766831 |
| sku_records:29 | 7542766831 | 工厂高质量卫衣套装 | 256.8 | https://weidian.com/item.html?itemID=7542766831 |
| sku_records:30 | 7542766831 | 工厂高质量卫衣套装 | 256.8 | https://weidian.com/item.html?itemID=7542766831 |
| sku_records:31 | 7542766831 | 工厂高质量卫衣套装 | 256.8 | https://weidian.com/item.html?itemID=7542766831 |

## Fuzzy title matches for non-overlapping IDs

| Similarity | Workbook ID | Workbook title | Existing ID | Existing title |
|---:|---|---|---|---|
| 1.000 | 7545228852 | 高质量时尚大潮鞋1 | 7572852607 | 高质量时尚大潮鞋1 |
| 1.000 | 7545226858 | 工厂自营高品质印花短2 | 7572883817 | 工厂自营高品质印花短2 |
| 1.000 | 7545224884 | 工厂自营高品质断头熊短22 | 7572907657 | 工厂自营高品质断头熊短22 |
| 1.000 | 7545222940 | 工厂自营高品质美式短16 | 7572891763 | 工厂自营高品质美式短16 |
| 1.000 | 7545222938 | 高品质 卫衣--50 | 7572739583 | 高品质 卫衣--50 |
| 1.000 | 7545221022 | 高质量短 | 7572864219 | 高质量短 |
| 1.000 | 7545219044 | 工厂高质量篮球短裤 | 7572860367 | 工厂高质量篮球短裤 |
| 1.000 | 7545217100 | 高品质2-sw-001 | 7574801692 | 高品质2-sw-001 |
| 1.000 | 7545213080 | 高质量短裤1 | 7574738824 | 高质量短裤1 |
| 1.000 | 7545207146 | 高品质5--001 | 7572872035 | 高品质5--001 |
| 1.000 | 7545207144 | 高品质3-je-001 | 7572785515 | 高品质3-je-001 |
| 1.000 | 7545207140 | 高品质钱包1-hb-003 | 7574754616 | 高品质钱包1-hb-003 |
| 1.000 | 7545207126 | 高品质1-tst-001 | 7574689504 | 高品质1-tst-001 |
| 1.000 | 7545203334 | 工厂高质量新款运动套装 | 7574703268 | 工厂高质量新款运动套装 |
| 1.000 | 7545201386 | 高品质5-001 | 7572905675 | 高品质5-001 |
| 1.000 | 7545201362 | rep高品质1--002 | 7572907629 | rep高品质1--002 |
| 1.000 | 7545197460 | 工厂自营高品质爱心短23m5l | 7574693524 | 工厂自营高品质爱心短23m5l |
| 1.000 | 7544656828 | 高品质4-st-002 | 7574713086 | 高品质4-st-002 |
| 1.000 | 7543429795 | 高质量套装-pst-001 | 7574721056 | 高质量套装-pst-001 |
| 1.000 | 7543424263 | freps-高品质休闲鞋005 | 7572797405 | freps-高品质休闲鞋005 |
| 1.000 | 7543420287 | 工厂自营高品质卫衣 | 7574722732 | 工厂自营高品质卫衣 |
| 1.000 | 7543418327 | 高质量牛仔裤 | 7572907665 | 高质量牛仔裤 |
| 1.000 | 7543416115 | 工厂秋冬休闲时尚连帽卫衣 036 | 7572807159 | 工厂秋冬休闲时尚连帽卫衣 036 |
| 1.000 | 7543416111 | 高品质1-ts-001 | 7572789553 | 高品质1-ts-001 |
| 1.000 | 7543406405 | 高品质1- | 7572844595 | 高品质1- |
| 1.000 | 7543406401 | 工厂自营高品质美式印花短10 | 7572832853 | 工厂自营高品质美式印花短10 |
| 1.000 | 7543406391 | 工厂自营高品质短6 | 7572911609 | 工厂自营高品质短6 |
| 1.000 | 7543404481 | 工厂自营时尚百搭短裤 | 7572815105 | 工厂自营时尚百搭短裤 |
| 1.000 | 7543404477 | 高品质针织3-at-001 | 7574758470 | 高品质针织3-at-001 |
| 1.000 | 7543398543 | rep高品质1-ss-003 | 7574721046 | rep高品质1-ss-003 |
| 1.000 | 7543398539 | 高质量沙滩短裤 | 7572893745 | 高质量沙滩短裤 |
| 1.000 | 7543396675 | rep高品质4-pt-001 | 7574781948 | rep高品质4-pt-001 |
| 1.000 | 7543392683 | 工厂自营高品质美式印花短9 | 7572834811 | 工厂自营高品质美式印花短9 |
| 1.000 | 7543386611 | 高质量时尚运动鞋 | 7572874013 | 高质量时尚运动鞋 |
| 1.000 | 7543386603 | 高品质4-rc-001 | 7572881865 | 高品质4-rc-001 |
| 1.000 | 7543386595 | 高质量时尚运动休闲鞋04 | 7572870039 | 高质量时尚运动休闲鞋04 |
| 1.000 | 7543386589 | 高品质时尚包包1-hb-02 | 7572879861 | 高品质时尚包包1-hb-02 |
| 1.000 | 7543384627 | 工厂自营高品质美式短14 | 7574752610 | 工厂自营高品质美式短14 |
| 1.000 | 7543380869 | 工厂自营高品质夏季运动五分短裤 | 7574776012 | 工厂自营高品质夏季运动五分短裤 |
| 1.000 | 7543378609 | c-l version casual shoes sneakers top version yhh08 | 7572822933 | c-l version casual shoes sneakers top version yhh08 |
| 1.000 | 7543374631 | 高品质套装4-001 | 7574807730 | 高品质套装4-001 |
| 1.000 | 7543374625 | 高品质3-sw-001 | 7572786981 | 高品质3-sw-001 |
| 1.000 | 7543371979 | 工厂高品质针织帽 | 7572854469 | 工厂高品质针织帽 |
| 1.000 | 7543368745 | 高品质4-s-001 | 7572893749 | 高品质4-s-001 |
| 1.000 | 7543368743 | 毛衣（高品质） | 7574703264 | 毛衣（高品质） |
| 1.000 | 7543368735 | 高品质4-ts-002 | 7574764348 | 高品质4-ts-002 |
| 1.000 | 7543368727 | 工厂自营高品质大v短26 | 7572817019 | 工厂自营高品质大v短26 |
| 1.000 | 7543366669 | rep高品质2-kh-001 | 7572911631 | rep高品质2-kh-001 |
| 1.000 | 7543364729 | 工厂高质量冬季棉服st | 7572803223 | 工厂高质量冬季棉服st |
| 1.000 | 7543364725 | 工厂高质量时尚短 | 7572883819 | 工厂高质量时尚短 |
| 1.000 | 7543364723 | 高品质低帮板鞋sss | 7574716744 | 高品质低帮板鞋sss |
| 1.000 | 7543362635 | 高品质卫衣3--001 | 7574760420 | 高品质卫衣3--001 |
| 1.000 | 7543360659 | 高品质内裤2-un-001 | 7572875949 | 高品质内裤2-un-001 |
| 1.000 | 7543356731 | 工厂自营高品质时尚球衣（定制款非质量问题不退换） | 7574805716 | 工厂自营高品质时尚球衣（定制款非质量问题不退换） |
| 1.000 | 7543354819 | 高品质4--001 | 7574799748 | 高品质4--001 |
| 1.000 | 7543354807 | 工厂自营高品质热带风印花短11 | 7574709128 | 工厂自营高品质热带风印花短11 |
| 1.000 | 7543352789 | 工厂高质量秋冬新款经典烫连帽卫衣套装ce23 | 7572812753 | 工厂高质量秋冬新款经典烫连帽卫衣套装ce23 |
| 1.000 | 7543352771 | 高品质套装6095 | 7572866241 | 高品质套装6095 |
| 1.000 | 7543352763 | 高品质2-je-002 | 7574740722 | 高品质2-je-002 |
| 1.000 | 7543348805 | rep高品质4-ts-001 | 7574764362 | rep高品质4-ts-001 |
| 1.000 | 7543348799 | 高品质休闲毛衣 | 7572889759 | 高品质休闲毛衣 |
| 1.000 | 7543346841 | rep高品质4-cl-001 | 7574728564 | rep高品质4-cl-001 |
| 1.000 | 7543346835 | 高品质2-sw-002 | 7572852617 | 高品质2-sw-002 |
| 1.000 | 7543344865 | 工厂自营高品质大v短27 | 7574732938 | 工厂自营高品质大v短27 |
| 1.000 | 7543342823 | 高品质3-phd-007 | 7574783886 | 高品质3-phd-007 |
| 1.000 | 7543342819 | 高品质套装 sp | 7574805702 | 高品质套装 sp |
| 1.000 | 7543338877 | 工厂高质量时尚裤子 | 7574701410 | 工厂高质量时尚裤子 |
| 1.000 | 7543338873 | reps-高品质1-hb-001 | 7572887759 | reps-高品质1-hb-001 |
| 1.000 | 7543334883 | 高质量时尚高品质1-am-001 | 7574699336 | 高质量时尚高品质1-am-001 |
| 1.000 | 7543334869 | 高质量足球训练服 | 7574760428 | 高质量足球训练服 |
| 1.000 | 7543332937 | b时尚短（e-003） | 7574781966 | b时尚短（e-003） |
| 1.000 | 7543331013 | 工厂高质量秋冬款加绒圆领卫 | 7572824557 | 工厂高质量秋冬款加绒圆领卫 |
| 1.000 | 7543329037 | 工厂自营高品质夏季运动短套装 | 7574707210 | 工厂自营高品质夏季运动短套装 |
| 1.000 | 7543327119 | 高品质围巾001 | 7572856455 | 高品质围巾001 |
| 1.000 | 7543327115 | 高品质皮带1-cl-001 | 7572842647 | 高品质皮带1-cl-001 |
| 1.000 | 7543327113 | 工厂自营高品质大v短28 | 7572868073 | 工厂自营高品质大v短28 |
| 1.000 | 7543327097 | 工厂自营高品质潮流短裤短套装 | 7572854465 | 工厂自营高品质潮流短裤短套装 |
| 1.000 | 7543325019 | 休闲时尚板鞋-限时优惠$12 | 7572822949 | 休闲时尚板鞋-限时优惠$12 |
| 1.000 | 7543323077 | 高品质牛仔外套-001-cn | 7574734882 | 高品质牛仔外套-001-cn |
| 1.000 | 7543323065 | 工厂高质量加绒连帽卫衣套装 | 7572789529 | 工厂高质量加绒连帽卫衣套装 |
| 1.000 | 7543321169 | 高质量时尚高品质鞋 led | 7574732942 | 高质量时尚高品质鞋 led |
| 1.000 | 7543321151 | 高质量训练服psgall-st-005 | 7574689498 | 高质量训练服psgall-st-005 |
| 1.000 | 7543319183 | 工厂自营高品质短29 | 7574807708 | 工厂自营高品质短29 |
| 1.000 | 7543315317 | 高品质石头背包4-mb-001 | 7572846567 | 高品质石头背包4-mb-001 |
| 1.000 | 7543313325 | 高质量印花运动短 | 7572812731 | 高质量印花运动短 |
| 1.000 | 7543313315 | all-shp-001 | 7574709126 | all-shp-001 |
| 1.000 | 7543311383 | 新款潮流便携舒适耳机 1-30 dzxejxqtx001yhh37 | 7572801171 | 新款潮流便携舒适耳机 1-30 dzxejxqtx001yhh37 |
| 1.000 | 7543311377 | 工厂高质量时尚百搭t恤 | 7574793768 | 工厂高质量时尚百搭t恤 |
| 1.000 | 7543311375 | 工厂高质量羽绒服（进微店查看商品） | 7572887755 | 工厂高质量羽绒服（进微店查看商品） |
| 1.000 | 7543309423 | 高质量时尚b板鞋 | 7574705168 | 高质量时尚b板鞋 |
| 1.000 | 7543309413 | rep高品质1-ss-002 | 7572779119 | rep高品质1-ss-002 |
| 1.000 | 7543307465 | 工厂自营高品质印花短3 | 7572850601 | 工厂自营高品质印花短3 |
| 1.000 | 7543307459 | 工厂高质量短 | 7574744386 | 工厂高质量短 |
| 1.000 | 7543046447 | 工厂自营高品质时尚圆领短 | 7572793335 | 工厂自营高品质时尚圆领短 |
| 1.000 | 7542974543 | 高品质运动服 | 7572903705 | 高品质运动服 |
| 1.000 | 7542802651 | 高质量时尚高品跑鞋1 | 7574736838 | 高质量时尚高品跑鞋1 |
| 1.000 | 7542798673 | 高品质休闲鞋021 | 7574807682 | 高品质休闲鞋021 |
| 1.000 | 7542766831 | 工厂高质量卫衣套装 | 7574738798 | 工厂高质量卫衣套装 |
| 0.889 | 7543346825 | 工厂高质量海马毛毛衣 | 7574707198 | 高质量海马毛毛衣 |
| 0.800 | 7543371987 | 高质量短rl | 7572864219 | 高质量短 |

## Recommended update policy

> Do not replace the current catalog in place until the workbook fields are mapped and every row has a stable identity.

1. Treat a stable product/item ID as the primary key. Treat a SKU option ID as a child record, not as a separate product card, unless the product page itself has no stable item ID.
2. For overlapping IDs, update price and SKU-level option data only after validating the workbook currency and price semantics. Preserve the current image URLs, editorial catalog name, category, and platform links unless the workbook explicitly provides a newer verified value.
3. For new IDs, stage them in an import report first. Do not automatically publish them until image availability, title, category, and Fansbuy URL are complete.
4. For duplicate IDs, group all rows under one product and retain one price per SKU option. Never silently choose the first duplicate row.
5. Write an import snapshot and a machine-readable mapping report before changing `products.ts`, so the operation can be rolled back without reconstructing data from the workbook.

