# Kakobuy 按价格聚合 SKU 分析

> 聚合规则：以 `product_id + price_usd` 作为一个展示商品组。同一 `product_id` 下所有可售型号的美元价格只有一个时，合并为一个商品；存在多个美元价格时，拆分为多个价格商品。SKU 的款式、尺码和库存保留在该价格组内部。

| 指标 | 数量 |
|---|---:|
| Kakobuy 商品数 | 1154 |
| SKU 明细数 | 77563 |
| 无美元价格商品 | 0 |
| 全部型号同一美元价格，可合并 | 588 |
| 存在多个美元价格，需要拆分 | 566 |
| 按商品+美元价格聚合后的展示商品数 | 2194 |
| 理论上比按 SKU 行展示减少 | 75369 |

## 每个商品价格组数量分布

| 价格组数量 | 商品数 |
|---:|---:|
| 1 | 588 |
| 2 | 413 |
| 3 | 50 |
| 4 | 28 |
| 5 | 31 |
| 6 | 10 |
| 7 | 10 |
| 8 | 9 |
| 9 | 4 |
| 10 | 3 |
| 11 | 4 |
| 12 | 1 |
| 13 | 3 |

## 按类别统计

| Category | 商品数 |
|---|---:|
| Clothing | 846 |
| Unclassified | 170 |
| Accessories | 80 |
| Shoes | 58 |

## 多价格商品示例

| Product ID | Title | Category | USD prices | Example variants |
|---|---|---|---|---|
| 7542766831 | High-Quality Hoodie Set from Factory 6PM | Clothing | 15.43, 24.88, 33.37, 41.27 | 15.43: 7;S, 7;M, 7;L, 7;XL; 24.88: 8;S, 8;M, 8;L, 8;XL; 33.37: 4;S, 4;M, 4;L, 4;XL, 5;S, 5;M; 41.27: 1;S, 1;M, 1;L, 1;XL, 2;S, 2;M |
| 7542798673 | High-Quality Casual Shoes 021 | Clothing | 57.47, 69.43, 89.61 | 57.47: 3;35, 3;36, 3;37, 3;38, 3;39, 3;40; 69.43: 1;35, 1;36, 1;37, 1;38, 1;39, 1;40; 89.61: 25;35, 25;36, 25;37, 25;38, 25;39, 25;40 |
| 7542974543 | High-Quality Sportswear | Clothing | 28.74, 42.24, 61.71 | 28.74: 16;M100-125, 16;L125-145, 16;XL145-165, 16;XXL165-185, 18;M100-125, 18;L125-145; 42.24: 15;M100-125, 15;L125-145, 15;XL145-165, 15;XXL165-185, 17;M100-125, 17;L125-145; 61.7 |
| 7543309413 | REP High Quality 1-SS-002 | Unclassified | 1.93, 25.65, 28.93, 7.72 | 1.93: 3(1pairs); 25.65: 6(10 pair), 18(white 10pair), 10(10 pair ), 12(10 pair ), 15(10 pair ), 13(10 pair ); 28.93: 11(black 12 pair); 7.72: 1(3pairs), 2(3pairs), 16(white 3 pairs |
| 7543309425 | High-Quality Splash Ink Shorts 2 | Unclassified | 23.15, 25.07, 27.00, 27.97, 28.93, 32.79, 34.72, 36.64 | 23.15: 1;S, 1;M, 1;L, 1;XL, 3;S, 3;M; 25.07: 5;S, 5;M, 5;L, 5;XL, 6;S, 6;M; 27.00: 28;S, 28;M, 28;L, 28;XL, 29;S, 29;M; 27.97: 9;S, 9;M, 9;L, 9;XL, 10;S, 10;M; 28.93: 8;S, 8;M, 8;L |
| 7543311375 | High Quality Down Jacket from Factory (Visit Weidian to see more products) | Clothing | 25.07, 28.74 | 25.07: STD023;S, STD023;M, STD023;L, STD023;XL, STD024;S, STD024;M; 28.74: STD025;S, STD025;M, STD025;L, STD025;XL, STD025;2XL, STD025;3XL |
| 7543311377 | High-quality stylish versatile T-shirt from the factory | Unclassified | 15.24, 24.88, 26.81, 32.40 | 15.24: 1;S, 1;M, 1;L, 1;XL, 1;XXL, 1;XXXL; 24.88: 4;S, 4;M, 4;L, 4;XL, 4;XXL, 4;XXXL; 26.81: 2;S, 2;M, 2;L, 2;XL, 2;XXL, 2;XXXL; 32.40: 19;S, 19;M, 19;L, 19;XL, 19;XXL, 19;XXXL |
| 7543311383 | New Fashion Trend Portable Comfortable Headphones 130 DZXEJXQTX001YHH37 | Unclassified | 21.03, 23.15, 26.04 | 21.03: 070150005-1, 070150005-2, 070150005-3, 070150005-4, 070150005-5, 070150005-6; 23.15: 005, 006, 007, 008, 009, 010; 26.04: 001, 002, 003, 004 |
| 7543315317 | High-Quality Stone Backpack 4-MB-001 | Unclassified | 15.43, 20.25, 22.18, 8.68 | 15.43: 9; 20.25: 4, 5; 22.18: 6, 7, 8; 8.68: 1, 2, 3 |
| 7543319183 | Factory self-operated high-quality short sleeve 29 | Unclassified | 19.10, 23.15 | 19.10: 3;S, 3;M, 3;L, 3;XL, 3;XXL, 3;XXXL; 23.15: 1;S, 1;M, 1;L, 1;XL, 1;XXL, 1;XXXL |
| 7543323065 | High-Quality Fleece Hooded Sweatshirt Set from Factory | Unclassified | 24.11, 49.95 | 24.11: 1;S, 1;M, 1;L, 2;S, 2;M, 2;L; 49.95: 11;S, 11;M, 11;L, 12;S, 12;M, 12;L |
| 7543323077 | High-Quality Denim Jacket - 001-CN | Clothing | 47.25, 48.21, 50.14, 60.75, 61.71, 63.64, 71.36 | 47.25: 6;S 45-60kg, 6;M 60-70kg, 6;L 70-80kg, 6;XL 80-90kg, 7;S 45-60kg, 7;M 60-70kg; 48.21: 10;S 45-60kg, 10;M 60-70kg, 10;L 70-80kg, 10;XL 80-90kg; 50.14: 9;S 45-60kg, 9;M 60-70k |
| 7543327097 | Factory self-operated high-quality trendy shorts and short-sleeve suit. | Unclassified | 18.52, 22.95, 37.80 | 18.52: 08;S, 08;M, 08;L, 08;XL, 09;S, 09;M; 22.95: 15;S, 15;M, 15;L, 15;XL, 16;S, 16;M; 37.80: 01;S, 01;M, 01;L, 01;XL, 02;S, 02;M |
| 7543327119 | High Quality Scarf 001 | Clothing | 36.64, 39.54, 44.36, 49.18, 51.11 | 36.64: 1, 2, 3, 6, 7, 8; 39.54: 4, 21; 44.36: 5; 49.18: 16; 51.11: 17 |
| 7543329037 | Factory Direct High-Quality Summer Sports Short Sleeve Set | Unclassified | 13.31, 9.45 | 13.31: 01;S, 01;M, 01;L, 01;XL, 01;XXL, 02;S; 9.45: 12;S, 12;M, 12;L, 12;XL, 12;XXL, 12;XXXL |
| 7543332935 | High-Quality Classic Versatile Casual Sports Shoes | Clothing | 48.02, 55.93 | 48.02: TX-28;EU36, TX-28;EU37, TX-28;EU38, TX-28;EU39, TX-28;EU40, TX-28;EU41; 55.93: TX-01;EU36, TX-01;EU37, TX-01;EU38, TX-01;EU39, TX-01;EU40, TX-01;EU41 |
| 7543332937 | B Fashion Short Sleeve (E-003) | Unclassified | 24.88, 28.74 | 24.88: 20;L, 20;S, 20;M, 21;L, 21;S, 21;M; 28.74: 01;L, 01;S, 01;M, 02;L, 02;S, 02;M |
| 7543334883 | High-Quality Fashion Premium 1-AM-001 | Clothing | 54.00, 73.09 | 54.00: 1;36, 1;37, 1;38, 1;39, 1;40, 1;41; 73.09: 7;36, 7;37, 7;38, 7;39, 7;40, 7;41 |
| 7543338873 | REPS-High Quality 1-HB-001 | Unclassified | 14.85, 46.45 | 14.85: 1, 2, 3, 4, 6, 7; 46.45: 5 |
| 7543338877 | High-Quality Fashion Pants from Factory | Clothing | 15.05, 18.97, 26.81 | 15.05: 01;L, 01;XL, 01;S, 01;M, 02;L, 02;XL; 18.97: 35;S, 35;M, 35;L, 35;XL, 36;S, 36;M; 26.81: 29;S, 29;M, 29;L, 29;XL, 30;S, 30;M |
| 7543342819 | High-Quality Set SP | Clothing | 108.00, 125.16, 192.84, 29.90, 30.86, 42.24, 46.09, 63.45, 65.38, 91.60, 94.30 | 108.00: Down jacket（Black）;M, Down jacket（Black）;L, Down jacket（Black）;XL, Down jacket（Black）;XXL, Down jacket（Black）;S; 125.16: 33;S, 33;M, 33;L, 33;XL, 33;XXL; 192.84: Quilted ja |
| 7543342823 | High Quality 3-PHD-007 | Clothing | 36.45, 36.64 | 36.45: 2;S, 2;M, 2;L, 2;XL, 3;S, 3;M; 36.64: 1;S, 1;M, 1;L, 1;XL |
| 7543346835 | High Quality 2-SW-002 | Clothing | 34.72, 42.43 | 34.72: 2;M, 2;L, 2;XL, 2;XXL, 9;M, 9;L; 42.43: 1;M, 1;L, 1;XL, 1;XXL, 3;M, 3;L |
| 7543348805 | REP High-Quality 4-TS-001 | Unclassified | 11.38, 16.40 | 11.38: 2;S, 2;M, 2;L, 2;XL, 2;XXL, 2;XXXL; 16.40: 1;S, 1;M, 1;L, 1;XL, 1;XXL, 1;XXXL |
| 7543352771 | High-Quality Set 6095 | Clothing | 74.25, 96.42 | 74.25: 3;S, 3;M, 3;L, 3;XL, 3;2XL, 4;S; 96.42: 1;S, 1;M, 1;L, 1;XL, 1;2XL, 2;S |
| 7543354819 | High Quality 4-HD-001 | Clothing | 21.22, 23.72, 24.11, 28.93, 30.86 | 21.22: 2;S 45-60kg, 2;M 60-70kg, 2;L 70-80kg, 2;XL 80-90kg, 5;S 45-60kg, 5;M 60-70kg; 23.72: 4;S 45-60kg, 4;M 60-70kg, 4;L 70-80kg, 4;XL 80-90kg, 7;S 45-60kg, 7;M 60-70kg; 24.11: 8 |
| 7543360659 | High-Quality Underwear 2-UN-001 | Unclassified | 17.36, 18.32, 19.10 | 17.36: 7;L 76cm-78cm, 7;XL 80cm-82cm, 7;XXL 84cm-88cm, 7;XXXL 90cm-94cm; 18.32: 8;L 76cm-78cm, 8;XL 80cm-82cm, 8;XXL 84cm-88cm, 8;XXXL 90cm-94cm; 19.10: 1;L 76cm-78cm, 1;XL 80cm-82 |
| 7543362635 | High-Quality Hoodie 3-HD-001 | Clothing | 33.75, 35.68 | 33.75: 21;S 55-60kg, 21;M 60-68kg, 21;L 68-78kg, 21;XL 78-88kg, 22;S 55-60kg, 22;M 60-68kg; 35.68: 2;S 55-60kg, 2;M 60-68kg, 2;L 68-78kg, 2;XL 78-88kg, 3;S 55-60kg, 3;M 60-68kg |
| 7543362649 | High-Quality Training Clothes from Factory 📏 Please add WhatsApp: 12818407291 if | Unclassified | 10.61, 20.09, 36.64, 42.43 | 10.61: 2;S 55-65kg, 2;M 60-75kg, 2;L 70-85kg, 2;XL 80-100kg, 2;XXL 95-115kg, 7;S 55-65kg; 20.09: 3;S 55-65kg, 3;M 60-75kg, 3;L 70-85kg, 3;XL 80-100kg, 3;XXL 95-115kg, 4;S 55-65kg;  |
| 7543364729 | Factory high-quality winter cotton coat | Clothing | 17.55, 18.32, 192.65, 20.45, 38.57, 41.66 | 17.55: 18Straight tube black;S, 18Straight tube black;M, 18Straight tube black;L, 18Straight tube black;XL, 18Straight tube black;2XL, 19Straight tube grey;S; 18.32: 1;S, 1;M, 1;L, |

## 实施建议

价格组应生成独立的展示记录，但不需要复制所有图片。每个 `product_id + price_usd` 组共享同一商品的图片池；只有当不同价格组的图片明确不同，才按 SKU 选项图片做分组。商品详情页显示该价格组的 USD 价格，并在规格选择中只列出属于该价格组的型号。

对于同一商品所有型号价格相同的记录，保留一个商品卡片和一个主价格，型号、尺码、颜色作为选项，不再生成重复卡片。对于价格不同的记录，使用稳定的派生 ID，例如 `kakobuy-{product_id}-{price_usd}` 的哈希形式，避免因排序变化导致详情页链接漂移。

图片下载应从 `product_images` 按 `product_id` 聚合，并先复用现有托管图片；不要从 77,563 条 `sku_records` 重复下载。

