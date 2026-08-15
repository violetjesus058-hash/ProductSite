# WebP 图片排查记录

检查商品 Under Armour Shorts Set（ID 7572911601）首图：

- 数据地址：`/product-images/dc1a7161ad56335c731c_d86d831d.webp`
- 原始文件：`/home/ubuntu/webdev-static-assets/product-images/dc1a7161ad56335c731c.gif`
- 原始 GIF 和转换后的 WebP 均为 800×800 的纯白首帧，文件本身没有商品画面。
- 因此首页空白卡片不是 WebP 转换损坏，而是原始 GIF 首帧内容为空白。
- 该商品后续图片包含实际内容，应将首图替换为第一张非空白详情图，或在通用图片处理流程中跳过近乎纯白的首帧。
