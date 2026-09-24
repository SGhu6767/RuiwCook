import { ALL_DISHES, FREE_ITEMS, INGREDIENT_PRICES, SEASONINGS } from "./data";
import type { Dish } from "./data";

/* ------------------------------------------------------------------ *
 * 火候（按“次数”计算，而不是按秒）
 *
 * 每按一次「翻炒」，火候指针前进一格。
 *   - 指针停在橙色格 = 火候正好（完美）
 *   - 指针停在橙色格左右两侧的浅黄格 = 还不错
 *   - 更靠左 = 不熟；更靠右 = 糊了
 * 不同烹饪方式、不同食材需要的次数不一样（target）。
 * ------------------------------------------------------------------ */

export type HeatZone = "raw" | "good" | "perfect" | "burnt";

/** 一次烹饪的配置：菜名 / 用到的食材 / 烹饪方式 / 对应的菜谱 id（自由烹饪没有匹配菜谱时为 null）。 */
export type CookSpec = {
  name: string;
  ingredients: string[];
  method: string;
  recipeId: number | null;
};

/** 各烹饪方式“火候正好”所需的基础翻炒次数。 */
const METHOD_BASE: Record<string, number> = {
  爆炒: 3,
  炒: 4,
  煎: 4,
  炸: 4,
  烤: 6,
  蒸: 6,
  煮: 6,
  焖: 7,
  炖: 8,
  烧: 7
};

export const isFree = (name: string) => FREE_ITEMS.includes(name);
export const isSeasoning = (name: string) => SEASONINGS.includes(name);
export const priceOf = (name: string) => (isFree(name) ? 0 : INGREDIENT_PRICES[name] ?? 1);

/** 食材对火候的影响：肉类难熟 +1，海鲜/蛋/豆腐/嫩菜易熟 -1，其余 0。 */
function ingredientOffset(name: string): number {
  if (isSeasoning(name) || isFree(name)) return 0;
  if (/奶|油|酪|面|米|饭|粉|丝|锅巴/.test(name)) return 0;
  if (/蛋|豆腐|豆皮|菜|叶|番茄|西红柿|黄瓜|紫菜|豆芽|茄子|蘑菇|香菇|木耳/.test(name)) return -1;
  if (/虾|鱼|贝|蛤|蟹|龙虾/.test(name)) return -1;
  if (/牛|羊|猪|排|腱|腩|五花|里脊|鸡|鸭|火鸡|培根|火腿|肉/.test(name)) return 1;
  return 0;
}

/** 这道菜“火候正好”需要翻炒的次数（2 ~ 9 次）。 */
export function targetSteps(method: string, ingredients: string[]): number {
  const main = ingredients.filter((item) => !isSeasoning(item) && !isFree(item));
  const base = METHOD_BASE[method] ?? 5;
  const offset = main.length
    ? Math.round(main.reduce((sum, item) => sum + ingredientOffset(item), 0) / main.length)
    : 0;
  return Math.min(9, Math.max(2, base + offset));
}

/** 火候条总格数：0 ~ target+3 次，其中 target+2、target+3 一定是糊的。 */
export function gaugeSlots(target: number) {
  return target + 4;
}

/** 翻炒到第 count 次时所处的区间。 */
export function zoneOf(count: number, target: number): HeatZone {
  const delta = count - target;
  if (delta === 0) return "perfect";
  if (Math.abs(delta) === 1) return "good";
  return delta < 0 ? "raw" : "burnt";
}

/** 翻炒次数上限：到了这一次还不出锅，就自动糊锅结束。 */
export function maxSteps(target: number) {
  return target + 3;
}

/** 火候 -> 品质分（0 ~ 100）。 */
export function qualityOf(count: number, target: number): number {
  const delta = count - target;
  if (delta === 0) return 100;
  if (delta === -1) return 80;
  if (delta === 1) return 76;
  if (delta < -1) return Math.max(8, 50 - (-delta - 2) * 18);
  return Math.max(8, 45 - (delta - 2) * 25);
}

export function describeResult(zone: HeatZone, quality: number) {
  switch (zone) {
    case "perfect":
      return { label: "极致", grade: "完美出锅", comment: "火候恰到好处，香气扑鼻，一出锅就被抢光了。" };
    case "good":
      return {
        label: quality >= 80 ? "上品" : "精品",
        grade: "出色",
        comment: quality >= 80 ? "火候稍欠一点，但口感依然很棒。" : "稍微过了一点火，好在还不影响卖相。"
      };
    case "raw":
      return { label: "不熟", grade: "欠火候", comment: "出锅太早了，食材还没熟透，只能低价处理。" };
    default:
      return { label: "焦糊", grade: "过火了", comment: "锅底冒起了黑烟……下次记得看指南及时出锅。" };
  }
}

/* ------------------------------------------------------------------ *
 * 菜名 / 价格
 * ------------------------------------------------------------------ */

/** 自由烹饪的菜名：烹饪方式 + 食材（多个食材用“和”连接），例如 爆炒鸡蛋和牛排、煎西红柿。 */
export function buildFreeDishName(method: string, ingredients: string[]) {
  const real = ingredients.filter((item) => !isFree(item));
  const main = real.filter((item) => !isSeasoning(item));
  const names = main.length ? main : real;
  return `${method}${names.join("和")}`;
}

/** 原材料价格之和。 */
export function ingredientCost(ingredients: string[]) {
  return ingredients.reduce((sum, item) => sum + priceOf(item), 0);
}

/**
 * 售价 = 原材料价格之和 ± 品质钱。
 * 品质 50 分为基准：低于 50 扣钱，高于 50 加钱；最低卖 1 ri币。
 */
export function priceBreakdown(ingredients: string[], quality: number) {
  const base = ingredientCost(ingredients);
  const swing = base * 0.6 + 2;
  const qualityMoney = Math.round(((quality - 50) / 50) * swing);
  const value = Math.max(1, base + qualityMoney);
  return { base, qualityMoney, value };
}

/* ------------------------------------------------------------------ *
 * 菜谱匹配
 * ------------------------------------------------------------------ */

const setKey = (items: string[]) => [...new Set(items)].sort().join("|");

/**
 * 自由烹饪时，如果选的食材刚好等于某个菜谱的食材，就直接做出这道菜谱菜。
 * 温水这类免费食材不参与比较。多个菜谱撞车时优先选做法一致的。
 */
export function matchRecipe(ingredients: string[], method: string): Dish | null {
  const key = setKey(ingredients.filter((item) => !isFree(item)));
  if (!key) return null;
  const hits = ALL_DISHES.filter((dish) => setKey(dish.ingredients.filter((item) => !isFree(item))) === key);
  if (hits.length === 0) return null;
  return hits.find((dish) => dish.techniques?.includes(method)) ?? hits[0];
}
