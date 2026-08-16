# 商品目录网站视觉方案

## 方向一：Editorial Pinboard

**Very Brief Intro:** 以 Pinterest 的内容发现感为基础，加入杂志编辑部式的留白、黑白图像框和细长侧栏。整体更像一个被策展过的商品灵感墙，而不是传统电商货架。

**Probability:** 0.07

## 方向二：Quiet Atelier

**Very Brief Intro:** 用米白纸张、炭黑字体和柔和的暖灰打造安静的买手店气质，让商品图片成为视觉主角。详情页强调材质、规格与来源信息的秩序感。

**Probability:** 0.04

## 方向三：Signal Market

**Very Brief Intro:** 以高对比黑白为底，使用一种鲜明的珊瑚红作为交互信号，强调分类切换、收藏和商品状态。它更利落、更数字化，但不依赖霓虹渐变或过度科技感。

**Probability:** 0.02

## 已选方向：Editorial Pinboard

### Design Movement

选择 **当代编辑型电商（Editorial Commerce）**，融合 Pinterest 的瀑布流探索、独立买手店的目录感和现代杂志版式。参考图中的左侧导航与瀑布流作为结构基准，但不复制 Pinterest 品牌元素。

### Core Principles

1. **内容先于装饰。** 商品图片承担第一视觉层级，标题、价格和状态信息保持克制。
2. **侧栏是目录，不是控制台。** 左侧大类使用清晰的中文大类名称，点击后改变内容墙，而不是打开复杂菜单。
3. **卡片不做统一盒子。** 图片保持自然比例，使用轻微圆角与柔和阴影，形成有节奏的瀑布流。
4. **详情页像商品档案。** 点击商品后进入自有详情页，图片、价格、规格、颜色、库存、店铺与原始链接分层呈现。

### Color Philosophy

主色使用 **纸张米白 #F7F5F0**，让商品图片拥有类似印刷目录的背景；文字使用 **深墨黑 #191919**，保持高级、清晰的阅读感；品牌信号色使用 **珊瑚红 #E95D4F**，只出现在选中态、价格标签、收藏和关键 CTA，形成可识别但不喧宾夺主的导视系统。

### Layout Paradigm

采用固定左侧窄导航 + 顶部搜索条 + 右侧非对称瀑布流。桌面端左侧导航保持可见，商品区以 4–5 列流动排列；移动端将左侧导航收纳为顶部横向滚动分类栏。详情页采用左侧大图画廊 + 右侧商品档案，不使用全屏居中卡片。

### Signature Elements

1. 左侧垂直目录中的珊瑚红短线选中标记。
2. 商品卡片 hover 时出现极简的“查看档案”浮层和图片轻微上移。
3. 详情页使用细线分隔、编号式信息模块和“FROM THE CATALOG”档案标签。

### Interaction Philosophy

交互应像翻阅一份精选目录：分类切换快速、搜索即时、卡片点击明确；不使用过长动画。商品图片点击进入详情页，详情页提供返回目录、缩略图切换和“查看原始商品链接”操作。所有操作保持键盘可访问，并使用清晰的焦点样式。

### Animation

卡片进入时只做轻微 opacity + translateY(8px)，每项错开 35ms；hover 只改变图片 scale(1.015)、阴影和浮层透明度；侧栏选中标记使用 180ms ease-out；详情页图片切换使用 220ms opacity 过渡。尊重 prefers-reduced-motion，关闭非必要的入场和切换动画。

### Typography System

标题使用 **DM Serif Display**，体现编辑型目录的文化感；正文和界面使用 **Manrope**，保持数字、价格和中文界面的清晰度。页面标题 32–44px，商品卡标题 13–14px，价格 15–16px，辅助信息 11–12px，中文正文使用系统无衬线回退字体。

### Brand Essence

定位：**为寻找独特穿搭与生活方式单品的人，提供一份可浏览、可比较、可追溯的精选商品目录。**

人格：编辑感、克制、可靠。

### Brand Voice

标题和按钮简短、具体、有目录感，不使用“欢迎来到我们的网站”或“立即开始”等泛化文案。

示例文案：

> FIND YOUR NEXT PIECE

> 查看商品档案

### Wordmark & Logo

标志采用一个由两条错位目录线组成的珊瑚红抽象符号，像书签与商品标签的交叠；字标使用 DM Serif Display 的大写字母组合，旁边搭配小号 “CATALOG / 01” 编号，避免默认字体品牌感。

### Signature Brand Color

**Catalog Coral — #E95D4F**。它既像纸质目录上的编辑批注，也像商品状态标签，是网站专属的浏览信号色。

## Style Decisions

所有前端页面与组件必须保持 Editorial Pinboard 方向：米白纸张背景、深墨文字、珊瑚红信号色、固定目录侧栏、非对称瀑布流、自然比例商品图片和档案型详情页。避免紫色渐变、深色霓虹、统一大圆角卡片、过度居中布局和默认 Inter 字体。


## Style Decisions

根据首轮视觉复核，首页必须让左侧中文大类导航成为明显的编辑目录脊柱；商品卡片以图片为第一信息层，标题与价格降为辅助层；商品详情页的主标题只显示清洗后的编辑化商品名，供应商联系方式和原始残留只放在次级说明；Catalog Coral #E95D4F 仅用于激活态、价格/状态、收藏和主要操作，不作为普遍装饰色。


### Accepted review amendments

The post-migration catalog keeps one archival dossier structure for product detail pages, uses Catalog Coral #E95D4F for active navigation, price/status signals, favorites/share, and primary commerce actions, and gives the masonry wall more breathing room through larger feature pins and stronger spacing rhythm. Platform links remain available but are visually subordinate to the catalog record.
