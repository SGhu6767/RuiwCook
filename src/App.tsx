import { useEffect, useMemo, useState } from "react";
import { COOKING_TECHNIQUES, DISHES, EXTRA_DISHES, INGREDIENT_PRICES, emoji } from "./data";

type Page = "cook" | "shop" | "storage" | "dish" | "buy" | "cooking" | "result";

type ResultData = {
  grade: string;
  comment: string;
  value: number;
  heatScore: number;
  completion: number;
  quality: number;
  qualityLabel: string;
  qualityImpact: number;
  ingredientBase: number;
  displayName: string;
};

type GameState = {
  money: number;
  inventory: Record<string, number>;
  storage: string[];
  combo: number;
  streak: number;
  cooked: number;
};

const STORAGE_KEY = "ruiwcook-vite-state";
const ALL_DISHES = [...DISHES, ...EXTRA_DISHES];
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function formatMoney(value: number) {
  return `${value} ri币`;
}

function describeQuality(score: number) {
  if (score >= 95) return { label: "极致", grade: "传说" };
  if (score >= 85) return { label: "上品", grade: "金牌" };
  if (score >= 70) return { label: "精品", grade: "出色" };
  if (score >= 55) return { label: "良品", grade: "合格" };
  return { label: "普通", grade: "普通" };
}

function buildGenericDishName(method: string, ingredients: string[]) {
  const baseName = ingredients.slice(0, 2).join("和") || "菜";
  if (method === "炖" || method === "煮" || method === "煲汤") return `${baseName}汤`;
  if (method === "炸") return `油炸${baseName}`;
  if (method === "烤") return `烤${baseName}`;
  if (method === "焖") return `焖${baseName}`;
  if (method === "蒸") return `蒸${baseName}`;
  if (method === "煎") return `煎${baseName}`;
  if (method === "爆炒") return `爆炒${baseName}`;
  return `${method}${baseName}`;
}

function buildCustomDish(inventory: Record<string, number>) {
  const available = Object.entries(inventory)
    .filter(([, amount]) => amount > 0)
    .map(([name]) => name);

  const picked = available.length > 0 ? available : ["鸡蛋", "番茄", "黄油", "盐", "洋葱"];

  return {
    id: -1,
    name: "自由创作",
    category: "自由菜",
    price: 12,
    desc: "按当前库存自由搭配炒、煎、焖、炖、炸，做出一盘不在菜谱里的新菜。",
    ingredients: picked.slice(0, 5),
    techniques: ["炒", "煎", "焖", "炖", "炸"],
    styles: [
      { name: "平衡做法", idealHeat: 48, flavor: "均衡鲜香", quality: 12 },
      { name: "重口做法", idealHeat: 62, flavor: "香酥浓郁", quality: 16 },
      { name: "清淡做法", idealHeat: 36, flavor: "鲜嫩清甜", quality: 14 }
    ],
    isCustom: true,
  };
}

function App() {
  const [page, setPage] = useState<Page>("cook");
  const [filter, setFilter] = useState("全部");
  const [selectedDishId, setSelectedDishId] = useState<number>(ALL_DISHES[0]?.id ?? 1);
  const [customMode, setCustomMode] = useState(false);
  const [money, setMoney] = useState(80);
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [storage, setStorage] = useState<string[]>([]);
  const [combo, setCombo] = useState(0);
  const [streak, setStreak] = useState(0);
  const [cooked, setCooked] = useState(0);
  const [heat, setHeat] = useState(50);
  const [progress, setProgress] = useState(0);
  const [timer, setTimer] = useState(30);
  const [techniqueStep, setTechniqueStep] = useState(0);
  const [styleIndex, setStyleIndex] = useState(0);
  const [qualityMeter, setQualityMeter] = useState(0);
  const [isCooking, setIsCooking] = useState(false);
  const [result, setResult] = useState<ResultData | null>(null);
  const [notice, setNotice] = useState("今天的菜单刚出炉，先做上一盘热乎的吧。");
  const [customIngredients, setCustomIngredients] = useState<string[]>(["鸡蛋", "番茄", "洋葱", "盐"]);
  const [customTechnique, setCustomTechnique] = useState<string>("爆炒");

  const selectedDish = useMemo(() => {
    if (customMode || selectedDishId === -1) return buildCustomDish(inventory);
    return ALL_DISHES.find((dish) => dish.id === selectedDishId) ?? ALL_DISHES[0];
  }, [customMode, inventory, selectedDishId]);

  const activeRecipeIngredients = customMode ? customIngredients : selectedDish.ingredients;
  const activeTechniqueName = customMode ? customTechnique : (selectedDish.techniques?.[0] ?? "炒");
  const techniqueQueue = customMode ? [customTechnique, "收口"] : (selectedDish.techniques?.length ? selectedDish.techniques : ["炒", "煎"]);
  const activeTechnique = techniqueQueue[Math.min(techniqueStep, techniqueQueue.length - 1)] ?? "炒";

  const dishStyles = selectedDish.styles && selectedDish.styles.length > 0
    ? selectedDish.styles
    : [
        { name: "平衡做法", idealHeat: 50, flavor: "平衡口感", quality: 10 },
        { name: "香脆做法", idealHeat: 68, flavor: "焦香外层", quality: 15 },
        { name: "细嫩做法", idealHeat: 38, flavor: "软嫩鲜香", quality: 12 }
      ];
  const activeStyle = dishStyles[Math.min(styleIndex, dishStyles.length - 1)] ?? dishStyles[0];
  const heatTarget = activeStyle.idealHeat;
  const currentDishName = customMode || selectedDishId === -1
    ? buildGenericDishName(activeTechniqueName, activeRecipeIngredients)
    : selectedDish.name;

  useEffect(() => {
    setStyleIndex(0);
    setQualityMeter(0);
    setHeat(50);
    setTechniqueStep(0);
    setProgress(0);
  }, [selectedDishId, customMode]);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const saved = JSON.parse(raw) as Partial<GameState>;
      if (typeof saved.money === "number") setMoney(saved.money);
      if (saved.inventory) setInventory(saved.inventory);
      if (Array.isArray(saved.storage)) setStorage(saved.storage);
      if (typeof saved.combo === "number") setCombo(saved.combo);
      if (typeof saved.streak === "number") setStreak(saved.streak);
      if (typeof saved.cooked === "number") setCooked(saved.cooked);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const payload: GameState = {
      money,
      inventory,
      storage,
      combo,
      streak,
      cooked
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [money, inventory, storage, combo, streak, cooked]);

  const categories = useMemo(() => ["全部", ...new Set(ALL_DISHES.map((dish) => dish.category))], []);
  const filteredDishes = useMemo(
    () => (filter === "全部" ? ALL_DISHES : ALL_DISHES.filter((dish) => dish.category === filter)),
    [filter]
  );

  const dailyEvent = useMemo(() => {
    if (combo >= 4) return "🔥 连击爆棚，顾客排起长龙";
    if (streak >= 2) return "⚡ 本日人气飙升";
    if (money >= 200) return "💰 店铺财政稳健";
    return "🌤️ 晴朗营业日，生意正好";
  }, [combo, streak, money]);

  const ingredientBase = activeRecipeIngredients.reduce(
    (sum, ingredient) => sum + (INGREDIENT_PRICES[ingredient] ?? 1),
    0
  );
  const missingIngredients = activeRecipeIngredients.filter((ingredient) => (inventory[ingredient] ?? 0) < 1);

  useEffect(() => {
    if (!isCooking) return;

    const tick = window.setInterval(() => {
      setTimer((prevTimer) => {
        const nextTimer = prevTimer - 1;

        if (nextTimer <= 0) {
          setIsCooking(false);
          completeCook(progress);
          return 0;
        }

        return nextTimer;
      });

      setProgress((prevProgress) => {
        const bonus = Math.abs(heat - heatTarget) <= 12 ? 3.4 : 2;
        const nextProgress = clamp(prevProgress + bonus, 0, 100);

        if (nextProgress >= 100) {
          setIsCooking(false);
          completeCook(nextProgress);
          return 100;
        }

        return nextProgress;
      });
    }, 220);

    return () => window.clearInterval(tick);
  }, [isCooking, heat, heatTarget, progress, selectedDishId, customMode]);

  function completeCook(finalProgress: number) {
    if (!selectedDish) return;

    const heatDistance = Math.abs(heat - heatTarget);
    const heatPrecision = clamp(100 - heatDistance * 1.7, 0, 100);
    const progressQuality = clamp(finalProgress * 0.9, 0, 100);
    const techniqueAccuracy = techniqueQueue.length
      ? clamp((techniqueStep / techniqueQueue.length) * 100, 0, 100)
      : 0;
    const styleQuality = clamp((activeStyle.quality ?? 10) + (techniqueQueue.includes(activeTechnique) ? 8 : 0), 0, 100);
    const quality = clamp(
      Math.round(heatPrecision * 0.52 + progressQuality * 0.2 + techniqueAccuracy * 0.18 + qualityMeter * 0.1 + styleQuality * 0.2),
      0,
      100
    );
    const qualityInfo = describeQuality(quality);
    const westernBonus = /西|牛|羊|火鸡|培根|奶酪|意面|海鲜/.test(`${selectedDish.category}${selectedDish.name}`) ? 1.8 : 1.2;
    const qualityImpact = Math.round((quality - 50) * westernBonus);
    const value = Math.max(0, ingredientBase + qualityImpact);

    let comment = "还差一点，继续练练手。";
    if (quality >= 95) {
      comment = "火候和手法都到位，顾客几乎在一瞬间就被吸引住了。";
    } else if (quality >= 85) {
      comment = "这盘口感和层次都非常稳定，值得表扬。";
    } else if (quality >= 70) {
      comment = "整体完成度不错，味道明显提升。";
    } else if (quality >= 55) {
      comment = "基础稳定，后续继续压住火候就更香了。";
    }

    const nextCombo = quality >= 70 ? combo + 1 : 0;
    const nextStreak = quality >= 70 ? streak + 1 : 0;

    setCombo(nextCombo);
    setStreak(nextStreak);
    setCooked((current) => current + 1);
    setMoney((current) => current + value);
    setResult({
      grade: qualityInfo.grade,
      comment,
      value,
      heatScore: heatPrecision,
      completion: clamp(finalProgress, 0, 100),
      quality,
      qualityLabel: qualityInfo.label,
      qualityImpact,
      ingredientBase,
      displayName: currentDishName,
    });
    setNotice(`${currentDishName} ${qualityInfo.grade}出品，食材 ${ingredientBase} + 品质 ${qualityImpact} = ${value} ri币。`);
    setPage("result");
    setIsCooking(false);
    setTimer(30);
    setProgress(0);
    setTechniqueStep(0);
    setQualityMeter(0);
  }

  function buyIngredient(ingredient: string) {
    const price = INGREDIENT_PRICES[ingredient] ?? 1;

    if (money < price) {
      setNotice(`${ingredient} 还没攒够钱，先小赚一笔再来买。`);
      return;
    }

    setMoney((current) => current - price);
    setInventory((current) => ({ ...current, [ingredient]: (current[ingredient] ?? 0) + 1 }));
    setNotice(`${emoji(ingredient)} 已购买 1 份 ${ingredient}，库存涨了。`);
  }

  function buyRecipeIngredients() {
    const ingredientsToBuy = customMode ? customIngredients : selectedDish.ingredients;
    const missing = ingredientsToBuy.filter((ingredient) => (inventory[ingredient] ?? 0) < 1);
    if (missing.length === 0) {
      setNotice(`${currentDishName} 的食材已经齐全，直接开工吧。`);
      return;
    }

    let purchased = 0;
    for (const ingredient of missing) {
      const price = INGREDIENT_PRICES[ingredient] ?? 1;
      if (money < price) {
        setNotice(`${ingredient} 还没攒够钱，先把它买齐再来做菜。`);
        return;
      }

      setMoney((current) => current - price);
      setInventory((current) => ({ ...current, [ingredient]: (current[ingredient] ?? 0) + 1 }));
      purchased += 1;
    }

    setNotice(`${currentDishName} 一键购买了 ${purchased} 种食材，已经准备开工。`);
  }

  function toggleCustomIngredient(ingredient: string) {
    setCustomIngredients((current) => {
      if (current.includes(ingredient)) {
        return current.filter((item) => item !== ingredient);
      }

      if (current.length >= 6) {
        return [...current.slice(1), ingredient];
      }
      return [...current, ingredient];
    });
  }

  function startCookingFlow() {
    if (!selectedDish) return;

    const missing = activeRecipeIngredients.filter((ingredient) => (inventory[ingredient] ?? 0) < 1);

    if (missing.length > 0) {
      setPage("buy");
      setNotice(`还差 ${missing.length} 种食材，先把材料备齐再开工。`);
      return;
    }

    setPage("cooking");
    setHeat(50);
    setProgress(0);
    setTimer(30);
    setTechniqueStep(0);
    setQualityMeter(0);
    setIsCooking(false);
    setNotice(`${currentDishName} 已经开始准备，动作顺序和火候都要兼顾。`);
  }

  function startCookTimer() {
    setIsCooking(true);
    setNotice("🔥 开始烹饪，盯住目标区并按对动作，口碑会更高。")
  }

  function handleTechniqueAction(action: string) {
    if (!selectedDish || !isCooking) {
      setNotice("先点击开始烹饪，再按顺序触发动作。");
      return;
    }

    const target = techniqueQueue[Math.min(techniqueStep, techniqueQueue.length - 1)] ?? "炒";
    const heatDelta = Math.abs(heat - heatTarget);
    const heatComfort = heatDelta <= 10 ? 1.2 : heatDelta <= 18 ? 1 : 0.7;

    if (action === target) {
      const nextStep = techniqueStep + 1;
      const gained = Math.round(18 + heatComfort * 16 + Math.min(12, heatTarget / 7));
      const nextProgress = clamp(progress + gained, 0, 100);

      setProgress(nextProgress);
      setTechniqueStep(nextStep);
      setQualityMeter((value) => clamp(value + Math.round(17 + heatComfort * 12), 0, 100));
      setNotice(`${action} 命中，火候和质感同步上升！下一步：${techniqueQueue[Math.min(nextStep, techniqueQueue.length - 1)] ?? "收口"}`);

      if (nextStep >= techniqueQueue.length || nextProgress >= 100) {
        setIsCooking(false);
        completeCook(nextProgress);
        return;
      }

      return;
    }

    const dropped = clamp(progress - 10, 0, 100);
    setProgress(dropped);
    setHeat((value) => clamp(value + 6, 0, 100));
    setQualityMeter((value) => clamp(value - 12, 0, 100));
    setNotice(`动作错了，当前应当是 ${target}，别乱点。`);
  }

  function sellCurrentDish() {
    if (!result || !selectedDish) return;

    setMoney((current) => current + result.value);
    setNotice(`${result.displayName} 已售出，收入 ${formatMoney(result.value)}。`);
    setPage("cook");
    setResult(null);
  }

  function storeCurrentDish() {
    if (!selectedDish) return;

    setStorage((current) => [result?.displayName ?? currentDishName, ...current]);
    setNotice(`${result?.displayName ?? currentDishName} 已入库，明天再开店也能卖出好价钱。`);
    setPage("cook");
    setResult(null);
  }

  function renderCookPage() {
    return (
      <div className="page">
        <section className="hero">
          <div className="hero-top">
            <div>
              <h1>今天做点什么？ 🍳</h1>
              <p>菜谱区 + 自由创作区，已收录 {ALL_DISHES.length} 道菜谱，支持中式、西餐、汤品、快手菜和独门新菜。</p>
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
        </section>

        <div className="filters">
          {categories.map((item) => (
            <button
              key={item}
              className={`chip ${filter === item ? "active" : ""}`}
              onClick={() => setFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <button
          className="primary full"
          style={{ marginBottom: "12px" }}
          onClick={() => {
            setCustomMode(true);
            setSelectedDishId(-1);
            setPage("dish");
          }}
        >
          自由创作新菜
        </button>

        <div className="dish-grid">
          {filteredDishes.map((dish) => (
            <article
              key={dish.id}
              className="dish"
              onClick={() => {
                setCustomMode(false);
                setSelectedDishId(dish.id);
                setPage("dish");
              }}
            >
              <div className="emoji">{emoji(dish.ingredients[0])}</div>
              <h3>{dish.name}</h3>
              <p>{dish.desc}</p>
              <div className="dish-foot">
                <span className="price">食材 {dish.price} ri币</span>
                <span className="tag">{dish.category}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  }

  function renderDishPage() {
    if (customMode) {
      const ingredientPool = Object.keys(INGREDIENT_PRICES).sort();
      const methodOptions = ["炒", "煎", "炸", "焖", "炖", "烤", "蒸", "煮", "爆炒"];

      return (
        <div className="page">
          <button className="back" onClick={() => setPage("cook")}>
            ← 返回菜单
          </button>

          <div className="card">
            <div className="emoji large">{emoji(activeRecipeIngredients[0] ?? "🍳")}</div>
            <h1 className="big-title">{buildGenericDishName(customTechnique, activeRecipeIngredients)}</h1>
            <div className="muted">自由模式 · 你自己选食材和做法 · 当前已选 {activeRecipeIngredients.length} 种</div>
            <p className="hint">这里不是预设菜单，完全由你自由搭配。选食材、选做法、再开始火候控制，做出来的名字会按你刚才的组合生成。</p>

            <div className="section-title">
              <h2>自由选材</h2>
              <span className="muted">最多 6 种</span>
            </div>

            <div className="ingredients">
              {ingredientPool.map((ingredient) => (
                <button
                  key={ingredient}
                  className={`chip ${customIngredients.includes(ingredient) ? "active" : ""}`}
                  onClick={() => toggleCustomIngredient(ingredient)}
                >
                  {emoji(ingredient)} {ingredient}
                </button>
              ))}
            </div>

            <div className="section-title">
              <h2>做法</h2>
              <span className="muted">按你做的方式命名</span>
            </div>

            <div className="style-row">
              {methodOptions.map((method) => (
                <button
                  key={method}
                  className={`chip ${customTechnique === method ? "active" : ""}`}
                  onClick={() => setCustomTechnique(method)}
                >
                  {method}
                </button>
              ))}
            </div>

            <button className="secondary full" onClick={buyRecipeIngredients}>
              一键购买已选食材 · {formatMoney(ingredientBase)}
            </button>

            <button className="primary full" onClick={() => setPage("buy")}>
              开始自由烹饪
            </button>
          </div>
        </div>
      );
    }

    const cost = selectedDish.ingredients.reduce((sum, ingredient) => sum + (INGREDIENT_PRICES[ingredient] ?? 1), 0);

    return (
      <div className="page">
        <button className="back" onClick={() => setPage("cook")}>
          ← 返回菜品
        </button>

        <div className="card">
          <div className="emoji large">{emoji(selectedDish.ingredients[0])}</div>
          <h1 className="big-title">{currentDishName}</h1>
          <div className="muted">
            {selectedDish.category} · 做法 {selectedDish.techniques?.join(" / ") ?? activeTechnique} · 食材成本 {cost} ri币
          </div>
          <p className="hint">{selectedDish.desc}</p>

          <div className="section-title">
            <h2>所需食材</h2>
            <span className="muted">每种 1 份</span>
          </div>

          <div className="ingredients">
            {selectedDish.ingredients.map((ingredient) => (
              <span key={ingredient} className="ingredient">
                {emoji(ingredient)} {ingredient} · {INGREDIENT_PRICES[ingredient] ?? 1} ri币
              </span>
            ))}
          </div>

          <div className="section-title">
            <h2>推荐动作</h2>
            <span className="muted">{selectedDish.techniques?.join(" · ") ?? "炒 · 煎"}</span>
          </div>

          <button className="secondary full" onClick={buyRecipeIngredients}>
            一键购买食材 · {formatMoney(cost)}
          </button>

          <button className="primary full" onClick={() => setPage("buy")}>
            {customMode || selectedDishId === -1 ? "开始自由烹饪" : "开始准备食材"}
          </button>
        </div>
      </div>
    );
  }

  function renderBuyPage() {
    const ingredientsForThisCook = customMode ? customIngredients : selectedDish.ingredients;

    return (
      <div className="page">
        <button className="back" onClick={() => setPage("dish")}>
          ← 返回
        </button>

        <div className="step-head">
          <h1>{customMode ? "自由选材" : "准备食材"} 🛒</h1>
          <div className="step-count">第 2 步 / 5</div>
        </div>

        <div className="progress-rail">
          <i className="dot done"></i>
          <i className="line done"></i>
          <i className="dot now"></i>
          <i className="line"></i>
          <i className="dot"></i>
          <i className="line"></i>
          <i className="dot"></i>
          <i className="line"></i>
          <i className="dot"></i>
        </div>

        <div className="card">
          <div className="row">
            <b>{currentDishName}</b>
            <span className="price">食材成本 {ingredientBase} ri币</span>
          </div>

          <div className="buy-list">
            {ingredientsForThisCook.map((ingredient) => (
              <div key={ingredient} className="buy-item">
                <span>
                  {emoji(ingredient)} {ingredient}
                  <br />
                  <small>{inventory[ingredient] ?? 0} 份库存</small>
                </span>

                <span className="qty">
                  <b>{INGREDIENT_PRICES[ingredient] ?? 1} ri币</b>
                  <button onClick={() => buyIngredient(ingredient)}>购买</button>
                </span>
              </div>
            ))}
          </div>

          <p className="hint">自由模式下，食材和做法都完全取决于你选的组合；售价仍按食材总价和品质差价计算，火候偏差会直接影响品质。</p>

          <button className="primary full" onClick={startCookingFlow}>
            {missingIngredients.length ? `还缺 ${missingIngredients.length} 种食材` : "食材齐全，开始烹饪"}
          </button>
        </div>
      </div>
    );
  }

  function renderCookingPage() {
    return (
      <div className="page">
        <div className="step-head">
          <h1>正在制作 {currentDishName} 🔥</h1>
          <div className="step-count">第 3 / 5 步 · 火候控制</div>
          <div className="progress-rail">
            <i className="dot done"></i>
            <i className="line done"></i>
            <i className="dot done"></i>
            <i className="line done"></i>
            <i className="dot now"></i>
            <i className="line"></i>
            <i className="dot"></i>
            <i className="line"></i>
            <i className="dot"></i>
          </div>
        </div>

        <div className="card">
          <div className="heat-wrap">
            <div className="heat-title">目标火候：{activeStyle.name} · 理想区间 {heatTarget}%</div>
            <div className="heatbar" style={{ ["--target" as string]: `${heatTarget}%` }}>
              <div className="heat-target"></div>
              <div className="heat-knob" style={{ left: `${heat}%` }}>🔥</div>
            </div>

            <div className="style-row">
              {dishStyles.map((style, index) => (
                <button
                  key={style.name}
                  className={`chip ${styleIndex === index ? "active" : ""}`}
                  onClick={() => setStyleIndex(index)}
                >
                  {style.name}
                </button>
              ))}
            </div>

            <input
              className="range"
              type="range"
              min={0}
              max={100}
              value={heat}
              onChange={(event) => setHeat(Number(event.target.value))}
            />

            <div className="row" style={{ marginTop: "8px" }}>
              <small>小火</small>
              <b id="heatText">
                {Math.abs(heat - heatTarget) <= 12 ? "理想火候" : heat < heatTarget ? "偏弱" : "偏旺"}
              </b>
              <small>大火</small>
            </div>
          </div>

          <div className="section-title">
            <h2>烹饪进度</h2>
            <span>{progress}%</span>
          </div>

          <div className="cook-progress">
            <div className="cook-fill" style={{ width: `${progress}%` }}></div>
          </div>

          <div className="quality-meter-wrap">
            <div className="row">
              <span>品质积累</span>
              <b>{qualityMeter}/100</b>
            </div>
            <div className="cook-progress">
              <div className="cook-fill" style={{ width: `${qualityMeter}%`, background: "linear-gradient(90deg, #d0ff7a, #ffd166, #ff8a80)" }}></div>
            </div>
          </div>

          <div className="timer">{timer} 秒</div>

          <div className="tech-wrap">
            <div className="tech-header">当前动作：{activeTechnique} · 目标风味：{activeStyle.flavor}</div>
            <div className="tech-grid">
              {COOKING_TECHNIQUES.map((technique) => (
                <button
                  key={technique}
                  className={`tech-btn ${technique === activeTechnique ? "active" : ""}`}
                  onClick={() => handleTechniqueAction(technique)}
                >
                  {technique}
                </button>
              ))}
            </div>
          </div>

          <button className="primary full" onClick={startCookTimer} disabled={isCooking}>
            {isCooking ? "正在烹饪" : "开始烹饪"}
          </button>
        </div>

        <p className="hint">
          关键顺序：{techniqueQueue.join(" → ")}。动作不对、火候偏大偏小，都会影响最终品质和售价。
        </p>
      </div>
    );
  }

  function renderResultPage() {
    if (!result) return null;

    return (
      <div className="page">
        <div className="step-head">
          <h1>做好了！ 🍳</h1>
          <div className="step-count">第 5 / 5 步 · 成品结算</div>
          <div className="progress-rail">
            <i className="dot done"></i>
            <i className="line done"></i>
            <i className="dot done"></i>
            <i className="line done"></i>
            <i className="dot done"></i>
            <i className="line done"></i>
            <i className="dot done"></i>
            <i className="line done"></i>
            <i className="dot now"></i>
          </div>
        </div>

        <div className="card result">
          <div className="result-icon">{emoji(selectedDish.ingredients[0])}</div>
          <h2>{result.displayName}</h2>
          <div className="grade">{result.grade}</div>
          <div className="quality-tag">品质 {result.qualityLabel} · {result.quality}/100</div>
          <div className="muted">{result.comment}</div>
          <div className="value">💰 {formatMoney(result.value)}</div>

          <div className="result-stats">
            <div className="stat">
              <b>{result.ingredientBase}</b>
              <small>食材成本</small>
            </div>
            <div className="stat">
              <b>{result.qualityImpact >= 0 ? "+" : ""}{result.qualityImpact}</b>
              <small>品质差价</small>
            </div>
            <div className="stat">
              <b>{result.heatScore}</b>
              <small>火候评分</small>
            </div>
          </div>

          <div className="row">
            <button className="primary" style={{ flex: 1 }} onClick={sellCurrentDish}>
              💰 出售
            </button>
            <button className="secondary" style={{ flex: 1 }} onClick={storeCurrentDish}>
              📦 存库
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderShopPage() {
    const names = [...new Set(ALL_DISHES.flatMap((dish) => dish.ingredients))].sort(
      (a, b) => (INGREDIENT_PRICES[a] ?? 1) - (INGREDIENT_PRICES[b] ?? 1)
    );

    return (
      <div className="page">
        <section className="hero">
          <h1>食材商店 🛒</h1>
          <p>油、盐、糖、黄油、橄榄油、花生油和各类中西食材全都能在这里买到。</p>
        </section>

        <div className="card">
          {names.map((ingredient) => (
            <div key={ingredient} className="buy-item">
              <span>
                {emoji(ingredient)} {ingredient}
                <br />
                <small>库存：{inventory[ingredient] ?? 0}</small>
              </span>

              <span className="qty">
                <b>{INGREDIENT_PRICES[ingredient] ?? 1} ri币</b>
                <button onClick={() => buyIngredient(ingredient)}>购买</button>
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderStoragePage() {
    return (
      <div className="page">
        <section className="hero">
          <h1>仓库 📦</h1>
          <p>存放你做过的成品，看看哪些菜被点过并保留了好口碑。</p>
        </section>

        <div className="card">
          {storage.length === 0 ? (
            <div className="empty-box">还没有成品进库，先做一盘菜再说。</div>
          ) : (
            <div className="storage-list">
              {storage.map((name, index) => (
                <div key={`${name}-${index}`} className="storage-item">
                  <span>🍽️ {name}</span>
                  <span className="tag">#{index + 1}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const pageNode = (() => {
    switch (page) {
      case "cook":
        return renderCookPage();
      case "shop":
        return renderShopPage();
      case "storage":
        return renderStoragePage();
      case "dish":
        return renderDishPage();
      case "buy":
        return renderBuyPage();
      case "cooking":
        return renderCookingPage();
      case "result":
        return renderResultPage();
      default:
        return renderCookPage();
    }
  })();

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

      <div className="status-banner">{notice}</div>

      <nav className="bottom-nav">
        <button className={page === "cook" ? "active" : ""} onClick={() => setPage("cook")}>
          🍳<span>做饭</span>
        </button>
        <button className={page === "shop" ? "active" : ""} onClick={() => setPage("shop")}>
          🛒<span>食材</span>
        </button>
        <button className={page === "storage" ? "active" : ""} onClick={() => setPage("storage")}>
          📦<span>仓库</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
