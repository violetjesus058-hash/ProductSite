// Generate client/src/data/style-label-map.ts: CJK styleLabel/styleKey -> English display label.
// Deterministic: exact overrides + longest-first fragment rules. Fails if any CJK remains.
// Usage: node scripts/build-style-label-map.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const UNIQUE_JSON = path.join(ROOT, "scripts/stylelabel-cjk-unique.json");
const OUT_TS = path.join(ROOT, "client/src/data/style-label-map.ts");

const EXACT = {
  "不印字号(No name number)": "No name/number",
  "不印字号(No namenumber)": "No name/number",
  "不印字号(Nonamenumber)": "No name/number",
  "印字号(Print name number)": "Printed name/number",
  "印字号(Print name number) 不退不换": "Printed name/number (final sale)",
  "印字号(Print name number)不退不换": "Printed name/number (final sale)",
  "印字号(Print namenumber)不退不换": "Printed name/number (final sale)",
  "中花灰(middle flower gray)": "Medium heather gray",
  "浅花灰(light flower gray)": "Light heather gray",
  "灰蓝色(gray blue)": "Gray blue",
  "银灰色(silver gray)": "Silver gray",
  "军绿色(olive)": "Army green",
  "黑色(black)": "Black",
  "款式1：一盒三条 清仓JJNK": "Style 1: 3-pack box (clearance JJNK)",
  "款式2：一盒三条 清仓JJNK": "Style 2: 3-pack box (clearance JJNK)",
  "款式3：一盒三条 清仓JJNK": "Style 3: 3-pack box (clearance JJNK)",
  "款式4：一盒三条 清仓JJNK": "Style 4: 3-pack box (clearance JJNK)",
  "款式5：一盒三条 清仓JJNK": "Style 5: 3-pack box (clearance JJNK)",
  "款式6：一盒三条 清仓JJNK": "Style 6: 3-pack box (clearance JJNK)",
  "互扣双G（宽版）": "Interlocking GG (wide)",
  "互扣双G（窄款）": "Interlocking GG (narrow)",
  "花戒双G(宽款）": "Floral ring GG (wide)",
  "花戒双G（窄款）": "Floral ring GG (narrow)",
  "白色- LAOGAO": "White - LAOGAO",
  "黑色- LAOGAO": "Black - LAOGAO",
  "黑皮带（man）": "Black leather strap (man)",
  "man（F款）": "Man (style F)",
  "man（G款）": "Man (style G)",
  "经典双G齿轮戒指": "Classic GG gear ring",
  "经典灵蛇": "Classic serpent",
  "虎头双G": "Tiger head GG",
  "双蛇浮雕": "Double snake relief",
  "红十字大马蹄": "Red cross horseshoe",
  "子弹头O字链": "Bullet O-chain",
  "子弹头光珠链": "Bullet bead chain",
  "子弹头字母链": "Bullet letter chain",
  "子弹头珍珠链": "Bullet pearl chain",
  "镂空星星染黑银色": "Hollow star blackened silver",
  "镂空星星银色": "Hollow star silver",
  "镂空星星黄金色": "Hollow star gold",
  "长城纹宽版": "Great Wall pattern (wide)",
  "长城纹窄款": "Great Wall pattern (narrow)",
  "绿色珐琅大号": "Green enamel (large)",
  "绿色珐琅": "Green enamel",
  "黑色珐琅": "Black enamel",
  "蓝裤奶牛标": "Blue pants (cow-print label)",
  "蓝裤毛边十字架": "Blue pants (raw-edge cross)",
  "爱无畏女款": "Blind for Love (women's)",
  "爱无畏男款": "Blind for Love (men's)",
  "自定义 2条装": "Custom 2-pack",
  "自定义 3条装": "Custom 3-pack",
  "自定义 3条礼盒装": "Custom 3-pack gift box",
  "白+蓝+灰 3条装": "White+Blue+Gray 3-pack",
  "红+白+灰 3条装": "Red+White+Gray 3-pack",
  "红+白+蓝 3条装": "Red+White+Blue 3-pack",
  "黑+灰 2条装": "Black+Gray 2-pack",
  "黑+灰+白 3条装": "Black+Gray+White 3-pack",
  "黑+灰+红 3条装": "Black+Gray+Red 3-pack",
  "黑+灰+蓝 3条装": "Black+Gray+Blue 3-pack",
  "黑+灰+藏青 3条装": "Black+Gray+Navy 3-pack",
  "黑+白 2条装": "Black+White 2-pack",
  "黑+红 2条装": "Black+Red 2-pack",
  "黑+蓝 2条装": "Black+Blue 2-pack",
  "7（2 Pairs黑+白）": "7 (2 pairs: black+white)",
  "8（2 Pairs白+灰）": "8 (2 pairs: white+gray)",
  "9（2 Pairs黑+蓝）": "9 (2 pairs: black+blue)",
  "白色（一件）": "White (1 piece)",
  "白色+黑色": "White+Black",
  "21（定制款，不退换）": "21 (custom, final sale)",
  "29（定制款，不退换）": "29 (custom, final sale)",
  "35（定制款，不退换）": "35 (custom, final sale)",
  "40（定制款，不退换）": "40 (custom, final sale)",
  "2代-Airpods": "Gen 2 - AirPods",
  "3代-Airpodspro": "Gen 3 - AirPods Pro",
  "4代-Airpods3": "Gen 4 - AirPods 3",
  "5代-Airpodspro2": "Gen 5 - AirPods Pro 2",
  "【现货秒发】Fragment Design Mind 001藤原浩闪电联名黑蓝": "Fragment Design Mind 001 Fujiwara Lightning Black/Blue (in stock)",
  "【现货秒发】Mind001 黑色Black": "Mind001 Black (in stock)",
  "【现货秒发】Mind001墨绿Green": "Mind001 Dark Green (in stock)",
  "【现货秒发】Mind001洞晶蓝绿Geode Teal/Green": "Mind001 Geode Teal/Green (in stock)",
  "【现货秒发】Mind001灰白Grey‌": "Mind001 Gray/White (in stock)",
  "【现货秒发】Mind001白色 White": "Mind001 White (in stock)",
  "【现货秒发】Mind001米白Bone White": "Mind001 Bone White (in stock)",
  "【现货秒发】Mind001粉色Pink": "Mind001 Pink (in stock)",
  "【现货秒发】Mind001红色Solar Red": "Mind001 Solar Red (in stock)",
  "【现货秒发】Mind001黑蓝Black/Blue": "Mind001 Black/Blue (in stock)",
  "Mind001浅紫色Palest Purple": "Mind001 Palest Purple",
  "Mind001浅绿Barely Green": "Mind001 Barely Green",
  "Mind001深红Team Red": "Mind001 Team Red",
};

// Longest-first fragment rules applied after exact overrides.
const RULES = [
  ["不退不换", "(final sale)"],
  ["不退换", "(final sale)"],
  ["定制款", "custom"],
  ["现货秒发", "in stock"],
  ["潮牌版本", "Hype Version "],
  ["潮牌黑白", "Hype Black-White"],
  ["潮牌紫", "Hype Purple"],
  ["潮牌蓝", "Hype Blue"],
  ["潮牌黑", "Hype Black"],
  ["一盒三条", "3-pack box"],
  ["清仓", "clearance"],
  ["浅蓝黑标", "Light blue (black label)"],
  ["深蓝白标", "Dark blue (white label)"],
  ["深蓝黑标", "Dark blue (black label)"],
  ["深蓝蓝盖", "Dark blue (blue lid)"],
  ["黑色白标", "Black (white label)"],
  ["黑色粉标", "Black (pink label)"],
  ["黑色黑标", "Black (black label)"],
  ["白色粉标", "White (pink label)"],
  ["白色蓝标", "White (blue label)"],
  ["黑色豹纹", "Black leopard"],
  ["白色豹纹", "White leopard"],
  ["灰色短裤", "Gray shorts"],
  ["灰色长裤", "Gray pants"],
  ["白色短裤", "White shorts"],
  ["黑色短裤", "Black shorts"],
  ["黑色长裤", "Black pants"],
  ["冰晶蓝", "Ice blue"],
  ["宝蓝色", "Royal blue"],
  ["雾霾蓝", "Haze blue"],
  ["军绿色", "Army green"],
  ["孔雀蓝", "Peacock blue"],
  ["湖蓝色", "Lake blue"],
  ["藏青色", "Navy"],
  ["玫红色", "Rose red"],
  ["荧光绿", "Neon green"],
  ["海洋绿", "Ocean green"],
  ["浅灰色", "Light gray"],
  ["浅粉色", "Light pink"],
  ["浅蓝色", "Light blue"],
  ["银白色", "Silver white"],
  ["银绿色", "Silver green"],
  ["银蓝色", "Silver blue"],
  ["银银色", "Silver"],
  ["银黑色", "Silver black"],
  ["银天蓝", "Silver sky blue"],
  ["全金色", "All gold"],
  ["透明色", "Clear"],
  ["红迷彩", "Red camo"],
  ["绿迷彩", "Green camo"],
  ["卡其色", "Khaki"],
  ["黑玫瑰", "Black rose"],
  ["全黑", "All black"],
  ["黑色", "Black"],
  ["白色", "White"],
  ["红色", "Red"],
  ["蓝色", "Blue"],
  ["绿色", "Green"],
  ["灰色", "Gray"],
  ["黄色", "Yellow"],
  ["粉色", "Pink"],
  ["紫色", "Purple"],
  ["橙色", "Orange"],
  ["杏色", "Apricot"],
  ["米白", "Cream"],
  ["迷彩", "Camo"],
  ["豹纹", "Leopard"],
  ["蛇纹", "Snakeskin"],
  ["红格", "Red plaid"],
  ["绿格", "Green plaid"],
  ["红白", "Red-white"],
  ["蓝白", "Blue-white"],
  ["黑白", "Black-white"],
  ["黑红", "Black-red"],
  ["黑蓝", "Black-blue"],
  ["黑黄", "Black-yellow"],
  ["白黑", "White-black"],
  ["红黑", "Red-black"],
  ["男款", "Men's"],
  ["女款", "Women's"],
  ["款式", "Style "],
  ["带灯", "with light"],
  ["无灯", "no light"],
  ["小精灵", "Sprite "],
  ["小雏菊", "Daisy"],
  ["怪兽涂鸦", "Monster graffiti"],
  ["低LGOGAO", "Low LGOGAO"],
  ["字母链", "letter chain"],
  ["新", "New "],
  ["款", ""],
  ["【", ""],
  ["】", ": "],
  ["（", "("],
  ["）", ")"],
];

function translate(value) {
  if (EXACT[value]) return EXACT[value];
  let out = value;
  for (const [from, to] of RULES) out = out.split(from).join(to);
  out = out
    .replace(/\(\s*\)/g, "")
    .replace(/\s*:\s*$/g, "")
    .replace(/\(\s*final sale\s*\)\s*$/, " (final sale)")
    .replace(/(\d)([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  // Drop duplicate adjacent words created by bilingual fragments, e.g. "Black Black".
  out = out.replace(/\b([A-Za-z]+)(\s+\1\b)+/g, "$1");
  return out;
}

function main() {
  const values = JSON.parse(fs.readFileSync(UNIQUE_JSON, "utf8"));
  const map = {};
  const leftovers = [];
  for (const value of values) {
    const translated = translate(value);
    if (/[\u4e00-\u9fff]/.test(translated)) { leftovers.push([value, translated]); continue; }
    map[value] = translated;
  }
  if (leftovers.length > 0) {
    console.error(`Unresolved (${leftovers.length}):`);
    for (const [from, to] of leftovers) console.error(`  ${JSON.stringify(from)} -> ${JSON.stringify(to)}`);
    process.exitCode = 1;
    return;
  }
  // Runtime lookup also accepts the lowercased form (styleKeyFor() lowercases keys).
  const lower = {};
  const lowerConflicts = [];
  for (const [key, label] of Object.entries(map)) {
    const lowered = key.toLowerCase();
    const existing = lower[lowered];
    if (existing && existing !== label) lowerConflicts.push([key, label, existing]);
    else lower[lowered] = label;
  }
  if (lowerConflicts.length > 0) {
    console.error("Lowercase key conflicts:", JSON.stringify(lowerConflicts));
    process.exitCode = 1;
    return;
  }
  const header = "// Generated by scripts/build-style-label-map.mjs — CJK style labels -> English display labels.\n// Lookup tries the exact value first, then its lowercased form; missing values fall back at the call site.\n";
  const helper = `\nexport function displayStyleLabel(value: string): string {\n  if (!value) return "";\n  const hit = styleLabelEn[value] || styleLabelEn[value.toLowerCase()];\n  if (hit) return hit;\n  // Strip residual CJK (incl. fullwidth punctuation) so Chinese is never rendered.\n  return value.replace(/[\\u4e00-\\u9fff\\u3000-\\u303f\\uff01-\\uff5e]+/g, " ").replace(/\\s+/g, " ").trim();\n}\n`;
  const body = `export const styleLabelEn: Record<string, string> = ${JSON.stringify({ ...map, ...lower }, null, 2)};\n${helper}`;
  fs.writeFileSync(OUT_TS, header + body, "utf8");
  console.log(`Wrote ${OUT_TS} with ${Object.keys(map).length} entries (+${Object.keys(lower).length} lowercase aliases).`);
}

main();
