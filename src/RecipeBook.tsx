import { useMemo, useState } from "react";
import { ALL_DISHES, emoji } from "./data";
import type { Dish } from "./data";
import { ingredientCost, isFree, priceOf } from "./cooking";

type Props = {
  money: number;
  inventory: Record<string, number>;
  onBuyMissing: (dish: Dish) => void;
  onCook: (dish: Dish, method: string) => void;
};

/** 菜谱面板：查看食材是否齐全、一键购买缺少的食材、直接按菜谱烹饪。 */
export default function RecipeBook({ money, inventory, onBuyMissing, onCook }: Props) {
  const [category, setCategory] = useState("全部");
  const [query, setQuery] = useState("");
  const [readyOnly, setReadyOnly] = useState(false);
  const [methodBy, setMethodBy] = useState<Record<number, string>>({});

  const categories = useMemo(() => ["全部", ...new Set(ALL_DISHES.map((dish) => dish.category))], []);

  const missingOf = (dish: Dish) => dish.ingredients.filter((name) => !isFree(name) && (inventory[name] ?? 0) < 1);

  const list = ALL_DISHES.filter((dish) => {
    if (category !== "全部" && dish.category !== category) return false;
    if (query.trim() && !dish.name.includes(query.trim())) return false;
    if (readyOnly && missingOf(dish).length > 0) return false;
    return true;
  });

  return (
    <div className="recipe-book">
      <input
        className="search"
        placeholder="搜索菜谱…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <div className="filters">
        <button className={`chip ${readyOnly ? "active" : ""}`} onClick={() => setReadyOnly((value) => !value)}>
          ✅ 可制作
        </button>
        {categories.map((item) => (
          <button key={item} className={`chip ${category === item ? "active" : ""}`} onClick={() => setCategory(item)}>
            {item}
          </button>
        ))}
      </div>

      {list.length === 0 && <div className="empty-box">没有符合条件的菜谱</div>}

      {list.map((dish) => {
        const missing = missingOf(dish);
        const missingCost = ingredientCost(missing);
        const methods = dish.techniques?.length ? dish.techniques : ["炒"];
        const method = methodBy[dish.id] ?? methods[0];

        return (
          <article key={dish.id} className="recipe-card">
            <div className="recipe-top">
              <span className="recipe-emoji">{emoji(dish.ingredients[0])}</span>
              <div className="recipe-name">
                <strong>{dish.name}</strong>
                <small>
                  {dish.category} · 食材共 {ingredientCost(dish.ingredients)} ri币
                </small>
              </div>
            </div>

            <div className="recipe-ings">
              {dish.ingredients.map((name) => {
                const free = isFree(name);
                const have = free || (inventory[name] ?? 0) >= 1;
                return (
                  <span key={name} className={`ing ${have ? "have" : "lack"}`}>
                    {emoji(name)} {name}
                    <em>{free ? "自带" : have ? `×${inventory[name]}` : `${priceOf(name)}币`}</em>
                  </span>
                );
              })}
            </div>

            {methods.length > 1 && (
              <div className="recipe-methods">
                <small>做法</small>
                {methods.map((item) => (
                  <button
                    key={item}
                    className={`chip small ${method === item ? "active" : ""}`}
                    onClick={() => setMethodBy((current) => ({ ...current, [dish.id]: item }))}
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}

            <div className="recipe-actions">
              {missing.length > 0 ? (
                <button className="secondary" onClick={() => onBuyMissing(dish)} disabled={money < missingCost}>
                  一键购买 · {missingCost} ri币
                </button>
              ) : (
                <span className="ready-tag">食材已备齐</span>
              )}
              <button className="primary" onClick={() => onCook(dish, method)} disabled={missing.length > 0}>
                {methods.length === 1 ? `${method} · 开始烹饪` : "开始烹饪"}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
