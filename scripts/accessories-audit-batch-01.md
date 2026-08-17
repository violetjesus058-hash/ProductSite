# Accessories audit batch 01

The compact AI Audit View was switched to ACCESSORIES on 2026-08-17. The page reports 168 remaining unique source products and displays an 80-card batch.

Visual scan from the screenshot and extracted product labels:

| Source product | Visible evidence | Decision |
|---|---|---|
| 7612187771 | Phone/accessory product image and title containing phones | Keep Accessories / Phone Cases or mark accessory subtype; not clothing |
| 7545416357 | ID card holder image/title | Keep Accessories / Wallets or Card Holders |
| 7554602004 | Glasses image/title | Keep Accessories / Eyewear |
| 7615069536 | Belt image/title | Keep Accessories / Belts |
| 7545207140 | Wallet image/title | Keep Accessories / Wallets |
| 7576593843 | Scarf image/title | Keep Accessories / Scarves |
| 7552717915 | Leather belt image/title | Keep Accessories / Belts |
| 7615128286 | Pendant necklace image/title | Keep Accessories / Jewelry |
| 7552674207 | Underwear image/title | Clear cross-category item; candidate for Clothing rather than Accessories |
| 7545203334 | Sports suit image/title | Mixed apparel; likely Clothing, but verify image before override |
| 7783164819 | Long sleeve apparel title/image | Clear cross-category item; candidate for Clothing |
| 7543362649 | Training clothes image/title | Clear apparel; candidate for Clothing |
| 7789908090 | Fashion apparel image/title | Clear apparel; candidate for Clothing |
| 7782578621 | Algeria fan edition jersey image/title | Clear apparel; candidate for Clothing |
| 7576605833 | Digital audio product image/title | Non-fashion accessory/electronics; keep Accessories unless catalog scope excludes electronics |

Many generic `Catalog Item kb-*` products show bags, wallets, jewelry, caps, belts, or mixed sets. These require image-by-image confirmation; no override should be added from the generic title alone. The batch should be marked reviewed only after these 80 cards are visually checked, and ambiguous mixed sets should receive SUSPECTED_REVIEW rather than a forced category change.


## Batch 02 continuation

After marking the first 80-card batch reviewed, the UI automatically loaded the next Accessories batch and reported 102 remaining unique source products. The second batch includes several clear apparel items mixed into Accessories:

| Source product | Evidence | Decision |
|---|---|---|
| 7543334869 | Soccer training apparel image/title | Correct to Clothing / Sportswear |
| 7615081442 | Cotton underwear image/title | Correct to Clothing / Underwear |
| 7612091525 | Pure cotton basketball socks image/title | Correct to Clothing / Socks |
| 7578512126 | Underwear image/title | Correct to Clothing / Underwear |
| 7554564280 | Necklace image/title | Keep Accessories / Jewelry |
| 7615106984, 7615116526, 7543327115, 7554543542, 7612152297 | Belt titles/images | Keep Accessories / Belts |
| 7615126312 | Knit hat image/title | Keep Accessories / Caps |
| 7545304312, 7552729877 | Card holder/keychain images/titles | Keep Accessories / Wallets |
| 7543352781 | Headphones image/title | Keep Accessories / Audio Accessories |
| 7552641513 | Phone case image/title | Keep Accessories / Phone Cases |
| 7772891157 | Belt and wallet set | Keep Accessories; mixed set does not justify category change |

Generic catalog items were not changed without conclusive visual evidence. The second batch is ready for explicit apparel overrides above, followed by another regenerated build and batch continuation.


## Continuity note

The first Accessories batch was marked reviewed before the preview browser entered a crash loop. The second batch was visually scanned and its four clear apparel corrections were regenerated successfully. A later preview reload rendered the catalog but did not expose interactive elements before the browser subsystem failed again, so the second batch was intentionally not marked reviewed in localStorage. The persistent backup keys were strengthened in Home.tsx, and TypeScript/build validation passed. Resume by opening Accessories AI Audit View and reviewing the second batch; do not re-mark the first batch.
