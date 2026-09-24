import { useMemo, useState } from "react";
import { INGREDIENT_PRICES, emoji } from "./data";
import { isFree, priceOf } from "./cooking";

type Props = {
  money: number;
  inventory: Record<string, number>;
  onBuy: (ingredient: string) => void;
};

/** 食材商店列表（商店页和「食材购买」面板共用）。 */
export default function ShopList({ money, inventory, onBuy }: Props) {
  const [query, setQuery] = useState("");

  const names = useMemo(
    () =>
      Object.keys(INGREDIENT_PRICES)
        .filter((name) => !isFree(name))
        .sort((a, b) => priceOf(a) - priceOf(b) || a.localeCompare(b, "zh-CN")),
    []
  );
  const shown = query.trim() ? names.filter((name) => name.includes(query.trim())) : names;

  return (
    <div className="shop-list">
      <input
        className="search"
        placeholder="搜索食材…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {shown.length === 0 && <div className="empty-box">没有找到这个食材</div>}
      {shown.map((name) => {
        const price = priceOf(name);
        return (
          <div key={name} className="buy-item">
            <span className="buy-name">
              <span className="buy-emoji">{emoji(name)}</span>
              <span>
                {name}
                <small>库存 {inventory[name] ?? 0}</small>
              </span>
            </span>
            <span className="qty">
              <b>{price} ri币</b>
              <button onClick={() => onBuy(name)} disabled={money < price}>
                购买
              </button>
            </span>
          </div>
        );
      })}
    </div>
  );
}
