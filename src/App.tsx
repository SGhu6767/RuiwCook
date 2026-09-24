import { useEffect, useMemo, useState } from "react";
import { COOKING_METHODS, FREE_ITEMS, emoji } from "./data";
import type { Dish } from "./data";
import {
  buildFreeDishName,
  describeResult,
  ingredientCost,
  isFree,
  isSeasoning,
  matchRecipe,
  priceBreakdown,
  priceOf,
  qualityOf,
  zoneOf
} from "./cooking";
import type { CookSpec, HeatZone } from "./cooking";
import CookingStage from "./CookingStage";
import RecipeBook from "./RecipeBook";
import Sheet from "./Sheet";
import ShopList from "./ShopList";

type Page = "cook" | "shop" | "storage";
type SheetName = "shop" | "recipes" | null;

type StoredDish = { name: string; value: number };

type ResultData = {
  name: string;
  icon: string;
  zone: HeatZone;
  quality: number;
  label: string;
  grade: string;
  comment: string;
  value: number;
  base: number;
  qualityMoney: number;
  count: number;
  target: number;
};

type GameState = {
  money: number;
  inventory: Record<string, number>;
  storage: StoredDish[];
  combo: number;
  streak: number;
  cooked: number;
  pending: ResultData | null;
};

const STORAGE_KEY = "ruiwcook-vite-state";
const MAX_SELECT = 6;

const formatMoney = (value: number) => `${value} ri币`;

/** 仓库里旧存档只有菜名（字符串），这里给它们一个保底价格。 */
const LEGACY_STORED_VALUE = 5;

function loadState(): GameState {
  const fallback: GameState = { money: 80, inventory: {}, storage: [], combo: 0, streak: 0, cooked: 0, pending: null };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const saved = JSON.parse(raw) as Partial<GameState> & { storage?: unknown[] };

    const inventory: Record<string, number> = {};
    if (saved.inventory && typeof saved.inventory === "object") {
      for (const [name, amount] of Object.entries(saved.inventory)) {
        if (typeof amount === "number" && amount > 0) inventory[name] = amount;
      }
    }

    const storage: StoredDish[] = [];
    if (Array.isArray(saved.storage)) {
      for (const item of saved.storage) {
        if (typeof item === "string") storage.push({ name: item, value: LEGACY_STORED_VALUE });
        else if (item && typeof item === "object") {
          const dish = item as Partial<StoredDish>;
          if (typeof dish.name === "string" && typeof dish.value === "number") {
            storage.push({ name: dish.name, value: dish.value });
          }
        }
      }
    }

    const pending =
      saved.pending && typeof saved.pending.name === "string" && typeof saved.pending.value === "number"
        ? saved.pending
        : null;

    return {
      money: typeof saved.money === "number" ? saved.money : fallback.money,
      inventory,
      storage,
      combo: typeof saved.combo === "number" ? saved.combo : 0,
      streak: typeof saved.streak === "number" ? saved.streak : 0,
      cooked: typeof saved.cooked === "number" ? saved.cooked : 0,
      pending
    };
  } catch {
    return fallback;
  }
}

/** 食材稀有度（仿原神星级底色），只影响卡片底边颜色。 */
function tierOf(name: string) {
  const price = priceOf(name);
  if (price >= 10) return 5;
  if (price >= 7) return 4;
  if (price >= 3) return 3;
  if (price >= 2) return 2;
  return 1;
}

function App() {
  const [saved] = useState(loadState);

  const [page, setPage] = useState<Page>("cook");
  const [sheet, setSheet] = useState<SheetName>(null);
  const [stage, setStage] = useState<CookSpec | null>(null);
  const [result, setResult] = useState<ResultData | null>(saved.pending);

  const [money, setMoney] = useState(saved.money);
  const [inventory, setInventory] = useState<Record<string, number>>(saved.inventory);
  const [storage, setStorage] = useState<StoredDish[]>(saved.storage);
  const [combo, setCombo] = useState(saved.combo);
  const [streak, setStreak] = useState(saved.streak);
  const [cooked, setCooked] = useState(saved.cooked);

  const [selected, setSelected] = useState<string[]>([]);
  const [method, setMethod] = useState("炒");
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);

  const notify = (text: string) => setToast({ text, id: Date.now() });

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const payload: GameState = { money, inventory, storage, combo, streak, cooked, pending: result };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* 存档失败（比如无痕模式）不影响游戏继续 */
    }
  }, [money, inventory, storage, combo, streak, cooked, result]);

  const stockOf = (name: string) => (isFree(name) ? Infinity : inventory[name] ?? 0);

  /* ---------------- 食材框（自由烹饪） ---------------- */

  const pantry = useMemo(() => {
    const owned = Object.keys(inventory)
      .filter((name) => (inventory[name] ?? 0) > 0)
      .sort((a, b) => priceOf(b) - priceOf(a) || a.localeCompare(b, "zh-CN"));
    return [...FREE_ITEMS, ...owned];
  }, [inventory]);

  // 库存用完的食材自动从“已选”里去掉
  const chosen = selected.filter((name) => stockOf(name) > 0);
  const canCookFree = chosen.some((name) => !isFree(name));
  const matched = chosen.length > 0 ? matchRecipe(chosen, method) : null;
  const previewName = chosen.length === 0 ? "" : matched ? matched.name : buildFreeDishName(method, chosen);
  const previewCost = ingredientCost(chosen);

  function toggleSelect(name: string) {
    setSelected((current) => {
      const active = current.filter((item) => stockOf(item) > 0);
      if (active.includes(name)) return active.filter((item) => item !== name);
      if (active.length >= MAX_SELECT) {
        notify(`一口锅最多放 ${MAX_SELECT} 种食材`);
        return active;
      }
      return [...active, name];
    });
  }

  /* ---------------- 购买 ---------------- */

  function buyIngredient(name: string) {
    const price = priceOf(name);
    if (money < price) {
      notify(`${name} 还没攒够钱，先小赚一笔再来买。`);
      return;
    }
    setMoney((current) => current - price);
    setInventory((current) => ({ ...current, [name]: (current[name] ?? 0) + 1 }));
    notify(`${emoji(name)} 已购买 1 份 ${name}`);
  }

  function buyMissingFor(dish: Dish) {
    const missing = dish.ingredients.filter((name) => !isFree(name) && (inventory[name] ?? 0) < 1);
    if (missing.length === 0) {
      notify(`${dish.name} 的食材已经齐全，直接开工吧。`);
      return;
    }
    const total = ingredientCost(missing);
    if (money < total) {
      notify(`买齐 ${dish.name} 还差 ${total - money} ri币。`);
      return;
    }
    setMoney((current) => current - total);
    setInventory((current) => {
      const next = { ...current };
      for (const name of missing) next[name] = (next[name] ?? 0) + 1;
      return next;
    });
    notify(`已为 ${dish.name} 一键购买 ${missing.length} 种食材，花费 ${total} ri币。`);
  }

  /* ---------------- 烹饪 ---------------- */

  function startCook(spec: CookSpec) {
    const lacking = spec.ingredients.filter((name) => stockOf(name) < 1);
    if (lacking.length > 0) {
      notify(`还缺少：${lacking.join("、")}`);
      return;
    }
    setSheet(null);
    setStage(spec);
  }

  function startFreeCook() {
    if (!canCookFree) {
      notify("先在食材框里选几样食材吧。");
      return;
    }
    startCook({
      name: previewName,
      ingredients: chosen,
      method,
      recipeId: matched ? matched.id : null
    });
  }

  function startRecipeCook(dish: Dish, dishMethod: string) {
    startCook({ name: dish.name, ingredients: dish.ingredients, method: dishMethod, recipeId: dish.id });
  }

  function handleFinish(slot: number, target: number) {
    if (!stage) return;

    const zone = zoneOf(slot, target);
    const quality = qualityOf(slot, target);
    const { base, qualityMoney, value } = priceBreakdown(stage.ingredients, quality);
    const info = describeResult(zone, quality);
    const main = stage.ingredients.find((name) => !isFree(name) && !isSeasoning(name)) ?? stage.ingredients[0];

    // 出锅时才扣除食材（中途退出不会浪费）
    setInventory((current) => {
      const next = { ...current };
      for (const name of stage.ingredients) {
        if (isFree(name)) continue;
        const left = (next[name] ?? 0) - 1;
        if (left > 0) next[name] = left;
        else delete next[name];
      }
      return next;
    });

    const good = zone === "perfect" || zone === "good";
    setCombo((current) => (good ? current + 1 : 0));
    setStreak((current) => (good ? current + 1 : 0));
    setCooked((current) => current + 1);

    setResult({
      name: stage.name,
      icon: emoji(main),
      zone,
      quality,
      label: info.label,
      grade: info.grade,
      comment: info.comment,
      value,
      base,
      qualityMoney,
      count: slot,
      target
    });
    setStage(null);
  }

  function sellResult() {
    if (!result) return;
    setMoney((current) => current + result.value);
    notify(`${result.name} 已售出，收入 ${formatMoney(result.value)}。`);
    setResult(null);
  }

  function storeResult() {
    if (!result) return;
    const dish: StoredDish = { name: result.name, value: result.value };
    setStorage((current) => [dish, ...current]);
    notify(`${result.name} 已存入仓库。`);
    setResult(null);
  }

  function sellStored(index: number) {
    const dish = storage[index];
    if (!dish) return;
    setMoney((current) => current + dish.value);
    setStorage((current) => current.filter((_, i) => i !== index));
    notify(`${dish.name} 已售出，收入 ${formatMoney(dish.value)}。`);
  }

  function sellAllStored() {
    if (storage.length === 0) return;
    const total = storage.reduce((sum, dish) => sum + dish.value, 0);
    setMoney((current) => current + total);
    setStorage([]);
    notify(`全部售出，共收入 ${formatMoney(total)}。`);
  }

  /* ---------------- 页面 ---------------- */

  const dailyEvent = useMemo(() => {
    if (combo >= 4) return "🔥 连击爆棚，顾客排起长龙";
    if (streak >= 2) return "⚡ 本日人气飙升";
    if (money >= 200) return "💰 店铺财政稳健";
    return "🌤️ 晴朗营业日，生意正好";
  }, [combo, streak, money]);

  function renderCookPage() {
    return (
      <div className="page">
        <div className="home-head">
          <div>
            <h1>今天做点什么？</h1>
            <p>选好食材和烹饪方式就能开火；也可以翻菜谱照着做。</p>
          </div>
          <span className="pulse-badge">{dailyEvent}</span>
        </div>

        <div className="mini-stats">
          <div className="mini-card">
            <span>连击</span>
            <strong>{combo}</strong>
          </div>
          <div className="mini-card">
            <span>热度</span>
            <strong>{streak}</strong>
          </div>
          <div className="mini-card">
            <span>完成</span>
            <strong>{cooked}</strong>
          </div>
        </div>

        <section className="frame">
          <header className="frame-head">
            <div className="frame-title">
              <span className="frame-icon">🧺</span>
              <div>
                <strong>选择食材</strong>
                <small>
                  已选 {chosen.filter((name) => !isFree(name)).length}
                  {chosen.some(isFree) ? " + 水" : ""} / {MAX_SELECT}
                </small>
              </div>
            </div>
            <div className="frame-actions">
              <button className="pill" onClick={() => setSheet("shop")}>
                🛒 食材购买
              </button>
              <button className="pill" onClick={() => setSheet("recipes")}>
                📖 查看菜谱
              </button>
            </div>
          </header>

          <div className="pantry-grid">
            {pantry.map((name) => {
              const active = chosen.includes(name);
              return (
                <button
                  key={name}
                  className={`item-card ${active ? "selected" : ""}`}
                  data-tier={tierOf(name)}
                  onClick={() => toggleSelect(name)}
                >
                  <span className="item-emoji">{emoji(name)}</span>
                  <span className="item-name">{name}</span>
                  <span className="item-count">{isFree(name) ? "∞" : `×${inventory[name]}`}</span>
                  {active && <span className="item-check">✓</span>}
                </button>
              );
            })}
          </div>

          {pantry.length <= FREE_ITEMS.length && (
            <p className="frame-empty">还没有食材，点右上角「食材购买」备料，或在「查看菜谱」里一键购买菜谱食材。</p>
          )}
        </section>

        <section className="frame">
          <header className="frame-head slim">
            <div className="frame-title">
              <span className="frame-icon">🔥</span>
              <strong>烹饪方式</strong>
            </div>
          </header>
          <div className="method-row">
            {COOKING_METHODS.map((item) => (
              <button key={item} className={`chip ${method === item ? "active" : ""}`} onClick={() => setMethod(item)}>
                {item}
              </button>
            ))}
          </div>
        </section>

        <section className={`preview ${chosen.length ? "on" : ""}`}>
          {chosen.length === 0 ? (
            <span className="preview-empty">选择食材后，这里会显示将要做出的菜</span>
          ) : (
            <>
              <div className="preview-name">
                <span>{matched ? "📖" : "🍳"}</span>
                <strong>{previewName}</strong>
              </div>
              <small>
                {matched ? "匹配菜谱 · " : "自由创作 · "}原料 {formatMoney(previewCost)}
              </small>
            </>
          )}
        </section>

        <button className="primary full cook-go" onClick={startFreeCook} disabled={!canCookFree}>
          开始烹饪
        </button>
      </div>
    );
  }

  function renderShopPage() {
    return (
      <div className="page">
        <div className="home-head">
          <div>
            <h1>食材商店 🛒</h1>
            <p>油、盐、糖、黄油、橄榄油和各类中西食材都能在这里买到。</p>
          </div>
        </div>
        <section className="frame">
          <ShopList money={money} inventory={inventory} onBuy={buyIngredient} />
        </section>
      </div>
    );
  }

  function renderStoragePage() {
    const total = storage.reduce((sum, dish) => sum + dish.value, 0);

    return (
      <div className="page">
        <div className="home-head">
          <div>
            <h1>仓库 📦</h1>
            <p>存放做好的成品，想卖的时候再出手。</p>
          </div>
        </div>

        <section className="frame">
          {storage.length === 0 ? (
            <div className="empty-box">还没有成品进库，先做一盘菜再说。</div>
          ) : (
            <>
              <div className="storage-list">
                {storage.map((dish, index) => (
                  <div key={`${dish.name}-${index}`} className="storage-item">
                    <span>🍽️ {dish.name}</span>
                    <span className="qty">
                      <b>{formatMoney(dish.value)}</b>
                      <button onClick={() => sellStored(index)}>出售</button>
                    </span>
                  </div>
                ))}
              </div>
              <button className="secondary full" onClick={sellAllStored}>
                全部出售 · {formatMoney(total)}
              </button>
            </>
          )}
        </section>
      </div>
    );
  }

  function renderResult() {
    if (!result) return null;

    return (
      <div className={`result-mask zone-${result.zone}`}>
        <div className="result-card">
          <div className="result-glow" aria-hidden="true"></div>
          <small className="result-kicker">获得菜品</small>
          <div className="result-icon">{result.icon}</div>
          <h2>{result.name}</h2>
          <div className="grade">{result.grade}</div>
          <div className="quality-tag">
            品质 {result.label} · {result.quality}/100
          </div>
          <p className="result-comment">{result.comment}</p>

          <div className="result-stats">
            <div className="stat">
              <b>{result.base}</b>
              <small>原料价格</small>
            </div>
            <div className="stat">
              <b className={result.qualityMoney >= 0 ? "plus" : "minus"}>
                {result.qualityMoney >= 0 ? "+" : ""}
                {result.qualityMoney}
              </b>
              <small>品质钱</small>
            </div>
            <div className="stat total">
              <b>{result.value}</b>
              <small>售价</small>
            </div>
          </div>

          <div className="row">
            <button className="primary" onClick={sellResult}>
              💰 出售
            </button>
            <button className="secondary" onClick={storeResult}>
              📦 存库
            </button>
          </div>
        </div>
      </div>
    );
  }

  const pageNode = page === "shop" ? renderShopPage() : page === "storage" ? renderStoragePage() : renderCookPage();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="logo">🍳</span>
          <div>
            <strong>RuiwCook</strong>
            <small>做饭模拟器</small>
          </div>
        </div>

        <div className="account-area">
          <div className="wallet">💰 {money} ri币</div>
        </div>
      </header>

      <main className="app-main">{pageNode}</main>

      <nav className="bottom-nav">
        <button className={page === "cook" ? "active" : ""} onClick={() => setPage("cook")}>
          🍳<span>做饭</span>
        </button>
        <button className={page === "shop" ? "active" : ""} onClick={() => setPage("shop")}>
          🛒<span>食材</span>
        </button>
        <button className={page === "storage" ? "active" : ""} onClick={() => setPage("storage")}>
          📦<span>仓库{storage.length ? ` ${storage.length}` : ""}</span>
        </button>
      </nav>

      {sheet === "shop" && (
        <Sheet title="食材购买" money={money} onClose={() => setSheet(null)}>
          <ShopList money={money} inventory={inventory} onBuy={buyIngredient} />
        </Sheet>
      )}

      {sheet === "recipes" && (
        <Sheet title="菜谱" money={money} onClose={() => setSheet(null)}>
          <RecipeBook money={money} inventory={inventory} onBuyMissing={buyMissingFor} onCook={startRecipeCook} />
        </Sheet>
      )}

      {stage && <CookingStage key={stage.name + stage.method} spec={stage} onCancel={() => setStage(null)} onFinish={handleFinish} />}

      {renderResult()}

      {toast && (
        <div key={toast.id} className="toast" role="status">
          {toast.text}
        </div>
      )}
    </div>
  );
}

export default App;
