const INGREDIENT_PRICES = {"番茄":3,"鸡蛋":3,"盐":1,"白糖":1,"土豆":3,"辣椒":2,"醋":2,"猪肉":6,"木耳":3,"胡萝卜":2,"泡椒":2,"鸡胸肉":6,"花生":2,"干辣椒":2,"黄瓜":2,"嫩豆腐":3,"牛肉末":6,"豆瓣酱":2,"花椒":2,"青椒":2,"蒜":1,"生抽":2,"五花肉":7,"冰糖":2,"老抽":2,"八角":2,"猪肋排":8,"鸡翅":7,"可乐":2,"姜":1,"瘦肉":6,"豆芽":2,"蒜苗":2,"甜面酱":2,"鲈鱼":12,"姜丝":1,"葱":1,"蒸鱼豉油":2,"大虾":12,"粉丝":3,"大蒜":1,"鸡块":7,"白芝麻":2,"鸡腿肉":7,"干香菇":3,"蚝油":2,"梅菜干":3,"梅菜":3,"剁椒":3,"鱼头":10,"温水":0,"紫菜":2,"香油":2,"牛肉":8,"洋葱":2,"排骨":8,"冬瓜":3,"姜片":1,"豆腐":3,"肉丝":6,"羊肉":9,"白萝卜":3,"枸杞":3,"青菜":2,"油麦菜":2,"干木耳":3,"小米辣":2,"牛腱子":10,"香菜":2,"辣椒油":2,"食用油":2,"老豆腐":3,"胡椒粉":1,"面条":3,"小葱":1,"米饭":2,"面粉":2,"白菜":2,"番茄酱":1,"梅干菜":3};
const EMOJIS = {"番茄":"🍅","鸡蛋":"🥚","土豆":"🥔","猪肉":"🥩","鸡胸肉":"🍗","五花肉":"🥩","鸡翅":"🍗","鲈鱼":"🐟","大虾":"🦐","牛肉":"🥩","羊肉":"🍖","黄瓜":"🥒","青椒":"🫑","胡萝卜":"🥕","豆腐":"🧈","嫩豆腐":"🧈","老豆腐":"🧈","米饭":"🍚","面条":"🍜","面粉":"🌾","白菜":"🥬","青菜":"🥬","油麦菜":"🥬","冬瓜":"🥒","白萝卜":"🥕","豆芽":"🌱","木耳":"🍄","干木耳":"🍄","干香菇":"🍄","紫菜":"🌿","花生":"🥜","辣椒":"🌶️","干辣椒":"🌶️","小米辣":"🌶️","泡椒":"🌶️","葱":"🧅","小葱":"🧅","洋葱":"🧅","蒜":"🧄","大蒜":"🧄","蒜苗":"🌿","姜":"🫚","姜丝":"🫚","姜片":"🫚","香菜":"🌿","花椒":"🫘","八角":"⭐","白糖":"🍬","冰糖":"🍬","盐":"🧂","醋":"🧴","生抽":"🧴","老抽":"🧴","豆瓣酱":"🥫","甜面酱":"🥫","蚝油":"🥫","剁椒":"🌶️","蒸鱼豉油":"🥫","食用油":"🫗","香油":"🫗","辣椒油":"🌶️","胡椒粉":"🧂","白芝麻":"⚪","粉丝":"🍜","可乐":"🥤","温水":"💧","枸杞":"🔴","梅干菜":"🥬","梅菜干":"🥬","番茄酱":"🥫","牛肉末":"🥩","瘦肉":"🥩","肉丝":"🥩","猪肋排":"🍖","排骨":"🍖","鸡块":"🍗","鸡腿肉":"🍗","牛腱子":"🥩","鱼头":"🐟"};

const KEY="ruiwcook_save_v1";
let state = JSON.parse(localStorage.getItem(KEY)||"null") || {money:80, ingredients:{}, storage:[], cooked:0};
let currentPage="cook", selectedDish=null, filter="全部", cookTimer=null, cooking=false, heat=50;

function save(){localStorage.setItem(KEY,JSON.stringify(state)); updateMoney();}
function updateMoney(){document.querySelector("#money").textContent=Math.floor(state.money);}
function money(n){return Math.max(0,Math.round(n*10)/10)+" ri币";}
function emoji(name){return EMOJIS[name]||"🥣";}
function toast(t){const e=document.querySelector("#toast");e.textContent=t;e.classList.add("show");clearTimeout(window._toast);window._toast=setTimeout(()=>e.classList.remove("show"),1800);}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));}
function categories(){return ["全部",...new Set(DISHES.map(x=>x.category))];}

function render(){
  updateMoney();
  const app=document.querySelector("#app");
  if(currentPage==="cook") app.innerHTML=cookPage();
  if(currentPage==="shop") app.innerHTML=shopPage();
  if(currentPage==="storage") app.innerHTML=storagePage();
  if(currentPage==="dish") app.innerHTML=dishPage();
  if(currentPage==="buy") app.innerHTML=buyPage();
  if(currentPage==="cooking") app.innerHTML=cookingPage();
  if(currentPage==="result") app.innerHTML=resultPage();
  bind();
}
function cookPage(){
 return `<div class="page"><section class="hero"><h1>今天做点什么？ 🍳</h1><p>选择一道菜，用 80 ri币 开始你的厨师生涯。</p></section>
 <div class="filters">${categories().map(c=>`<button class="chip ${filter===c?"active":""}" data-filter="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join("")}</div>
 <div class="dish-grid">${DISHES.filter(d=>filter==="全部"||d.category===filter).map(d=>dishCard(d)).join("")}</div></div>`;
}
function dishCard(d){
 return `<article class="dish" data-dish="${d.id}"><div class="emoji">${emoji(d.ingredients[0])}</div><h3>${escapeHtml(d.name)}</h3><p>${escapeHtml(d.desc)}</p><div class="dish-foot"><span class="price">基础 ${d.price} ri币</span><span class="tag">${escapeHtml(d.category)}</span></div></article>`;
}
function dishPage(){
 const d=DISHES.find(x=>x.id===selectedDish);
 return `<div class="page"><button class="back" data-back>← 返回菜品</button><div class="card"><div class="emoji" style="font-size:50px">${emoji(d.ingredients[0])}</div><h1 class="big-title">${escapeHtml(d.name)}</h1><div class="muted">${escapeHtml(d.category)} · 基础价值 ${d.price} ri币</div><p class="hint">${escapeHtml(d.desc)}</p><div class="section-title"><h2>所需食材</h2><span class="muted">每种 1 份</span></div><div class="ingredients">${d.ingredients.map(i=>`<span class="ingredient">${emoji(i)} ${escapeHtml(i)} · ${INGREDIENT_PRICES[i]||1} ri币</span>`).join("")}</div><button class="primary full" data-start-buy>开始准备食材</button></div></div>`;
}
function buyPage(){
 const d=DISHES.find(x=>x.id===selectedDish);
 const total=d.ingredients.reduce((s,i)=>s+(INGREDIENT_PRICES[i]||1),0);
 const missing=d.ingredients.filter(i=>(state.ingredients[i]||0)<1);
 const owned=d.ingredients.filter(i=>(state.ingredients[i]||0)>=1);
 return `<div class="page"><button class="back" data-back>← 返回</button><div class="step-head"><h1>准备食材 🛒</h1><div class="step-count">第 2 步 / 5</div></div><div class="progress"><i class="dot done"></i><i class="line done"></i><i class="dot now"></i><i class="line"></i><i class="dot"></i><i class="line"></i><i class="dot"></i><i class="line"></i><i class="dot"></i></div><div class="card"><div class="row"><b>${escapeHtml(d.name)}</b><span class="price">基础 ${d.price} ri币</span></div><div class="buy-list">${d.ingredients.map(i=>`<div class="buy-item"><span>${emoji(i)} ${escapeHtml(i)}<br><small>${state.ingredients[i]||0} 份库存</small></span><span class="qty"><b>${INGREDIENT_PRICES[i]||1} ri币</b><button data-buy-one="${escapeHtml(i)}">购买</button></span></div>`).join("")}</div><p class="hint">每道菜每种食材需要 1 份。买入的食材会进入你的食材库存。</p><button class="primary full" data-check-ready>${missing.length?"还缺 "+missing.length+" 种食材":"食材齐全，开始烹饪"}</button></div></div>`;
}
function cookingPage(){
 const d=DISHES.find(x=>x.id===selectedDish);
 return `<div class="page"><div class="step-head"><h1>正在制作 ${escapeHtml(d.name)} 🔥</h1><div class="step-count">第 3 / 5 步 · 控制火候</div><div class="progress"><i class="dot done"></i><i class="line done"></i><i class="dot done"></i><i class="line done"></i><i class="dot now"></i><i class="line"></i><i class="dot"></i><i class="line"></i><i class="dot"></i></div></div>
 <div class="card"><div class="heat-wrap"><div class="heat-title">把指针尽量保持在白色目标区</div><div class="heatbar" style="--target:50%"><div class="heat-target"></div><div class="heat-knob" style="left:${heat}%">🔥</div></div><input id="heat" class="range" type="range" min="0" max="100" value="${heat}"><div class="row" style="margin-top:8px"><small>小火</small><b id="heatText">${heat<35?"小火":heat<65?"中火":"大火"}</b><small>大火</small></div></div><div class="section-title"><h2>烹饪进度</h2><span id="cookPercent">0%</span></div><div class="cook-progress"><div id="cookFill" class="cook-fill"></div></div><div id="timer" class="timer">30 秒</div><button id="cookBtn" class="primary full">开始烹饪</button></div><p class="hint">火候会影响最终品质。尽量把指针保持在中间目标区，完成度越高，成品价值越高。</p></div>`;
}
function resultPage(){
 const r=window.lastResult,d=DISHES.find(x=>x.id===selectedDish);
 return `<div class="page"><div class="step-head"><h1>做好了！ 🍳</h1><div class="step-count">第 5 / 5 步 · 成品结算</div><div class="progress"><i class="dot done"></i><i class="line done"></i><i class="dot done"></i><i class="line done"></i><i class="dot done"></i><i class="line done"></i><i class="dot done"></i><i class="line done"></i><i class="dot now"></i></div></div>
 <div class="card result"><div class="result-icon">${emoji(d.ingredients[0])}</div><h2>${escapeHtml(d.name)}</h2><div class="grade">${r.grade}</div><div class="muted">${r.comment}</div><div class="value">💰 ${money(r.value)}</div><div class="result-stats"><div class="stat"><b>${r.heatScore}</b><small>火候评分</small></div><div class="stat"><b>${r.completion}%</b><small>完成度</small></div><div class="stat"><b>${d.price}</b><small>基础价值</small></div></div><div class="row"><button class="primary" style="flex:1" data-sell>💰 出售</button><button class="secondary" style="flex:1" data-store>📦 存库</button></div></div></div>`;
}
function shopPage(){
 const names=[...new Set(DISHES.flatMap(d=>d.ingredients))].sort((a,b)=>(INGREDIENT_PRICES[a]||1)-(INGREDIENT_PRICES[b]||1));
 return `<div class="page"><section class="hero"><h1>食材商店 🛒</h1><p>用 ri币购买食材。购买后的食材会一直保存在你的食材库存中。</p></section><div class="card">${names.map(i=>`<div class="buy-item" style="margin-bottom:7px"><span>${emoji(i)} ${escapeHtml(i)}<br><small>库存：${state.ingredients[i]||0}</small></span><span class="qty"><b>${INGREDIENT_PRICES[i]||1} ri币</b><button data-buy-shop="${escapeHtml(i)}">购买</button></span></div>`).join("")}</div></div>`;
}
function storagePage(){
 if(!state.storage.length)return `<div class="page"><section class="hero"><h1>我的仓库 📦</h1><p>存下来的成品可以随时出售。</p></section><div class="empty"><div class="icon">📦</div><p>仓库还是空的</p><p>做一道菜并选择“存库”吧。</p></div></div>`;
 return `<div class="page"><section class="hero"><h1>我的仓库 📦</h1><p>共 ${state.storage.length} 道成品</p></section>${state.storage.map((x,idx)=>`<div class="storage-item"><span>${emoji(x.first)} <b>${escapeHtml(x.name)}</b><br><small class="muted">${x.grade} · ${money(x.value)}</small></span><button class="primary" data-storage-sell="${idx}">出售</button></div>`).join("")}</div>`;
}

function buyIngredient(name){
 const cost=INGREDIENT_PRICES[name]||1;
 if(state.money<cost){toast("ri币不够了 💸");return false}
 state.money-=cost;state.ingredients[name]=(state.ingredients[name]||0)+1;save();toast(`${name} +1，-${cost} ri币`);return true;
}
function bind(){
 document.querySelectorAll(".bottom-nav button").forEach(b=>b.onclick=()=>{currentPage=b.dataset.page;render()});
 document.querySelectorAll("[data-filter]").forEach(b=>b.onclick=()=>{filter=b.dataset.filter;render()});
 document.querySelectorAll("[data-dish]").forEach(e=>e.onclick=()=>{selectedDish=Number(e.dataset.dish);currentPage="dish";render()});
 const back=document.querySelector("[data-back]"); if(back)back.onclick=()=>{currentPage="cook";render()};
 const start=document.querySelector("[data-start-buy]");if(start)start.onclick=()=>{currentPage="buy";render()};
 document.querySelectorAll("[data-buy-one]").forEach(b=>b.onclick=()=>{buyIngredient(b.dataset.buyOne);render()});
 document.querySelectorAll("[data-buy-shop]").forEach(b=>b.onclick=()=>{buyIngredient(b.dataset.buyShop);render()});
 const check=document.querySelector("[data-check-ready]");if(check)check.onclick=()=>{const d=DISHES.find(x=>x.id===selectedDish);const missing=d.ingredients.filter(i=>(state.ingredients[i]||0)<1);if(missing.length){toast("还缺少："+missing.join("、"));return}d.ingredients.forEach(i=>state.ingredients[i]--);save();currentPage="cooking";render()};
 const heatInput=document.querySelector("#heat");if(heatInput)heatInput.oninput=()=>{heat=Number(heatInput.value);document.querySelector(".heat-knob").style.left=heat+"%";document.querySelector("#heatText").textContent=heat<35?"小火":heat<65?"中火":"大火"};
 const cookBtn=document.querySelector("#cookBtn");if(cookBtn)cookBtn.onclick=startCooking;
 const sell=document.querySelector("[data-sell]");if(sell)sell.onclick=()=>{state.money+=window.lastResult.value;state.cooked++;save();toast("出售成功，获得 "+money(window.lastResult.value));setTimeout(()=>{currentPage="cook";render()},500)};
 const store=document.querySelector("[data-store]");if(store)store.onclick=()=>{const d=DISHES.find(x=>x.id===selectedDish);state.storage.push({name:d.name,value:window.lastResult.value,grade:window.lastResult.grade,first:d.ingredients[0]});state.cooked++;save();toast("已存入仓库 📦");setTimeout(()=>{currentPage="storage";render()},500)};
 document.querySelectorAll("[data-storage-sell]").forEach(b=>b.onclick=()=>{const idx=Number(b.dataset.storageSell),x=state.storage[idx];state.money+=x.value;state.storage.splice(idx,1);save();toast("成品已出售");render()});
}
function startCooking(){
 if(cooking)return;
 cooking=true;const btn=document.querySelector("#cookBtn");btn.disabled=true;btn.textContent="烹饪中…";
 let sec=30;
 cookTimer=setInterval(()=>{
   sec--;const pct=Math.round((30-sec)/30*100);
   const fill=document.querySelector("#cookFill"),pc=document.querySelector("#cookPercent"),tm=document.querySelector("#timer");
   if(fill)fill.style.width=pct+"%";if(pc)pc.textContent=pct+"%";if(tm)tm.textContent=sec+" 秒";
   if(sec<=0){clearInterval(cookTimer);finishCooking();}
 },1000);
}
function finishCooking(){
 const d=DISHES.find(x=>x.id===selectedDish);
 // 目标火候在 50 附近；偏离越大，评分越低。期间玩家可以调整滑块。
 const heatScore=Math.max(0,Math.round(100-Math.abs(heat-50)*2));
 const completion=Math.max(0,Math.min(100,Math.round(60+heatScore*0.4)));
 let grade=heatScore>=90?"S":heatScore>=78?"A":heatScore>=62?"B":heatScore>=45?"C":"D";
 const multiplier={S:1.75,A:1.45,B:1.15,C:.8,D:.45}[grade];
 const value=Math.max(1,Math.round(d.price*multiplier*10)/10);
 const comments={S:"完美火候，厨师本人都要鼓掌！",A:"火候漂亮，这道菜很成功。",B:"味道不错，再练练火候会更好。",C:"能吃，但还有提升空间。",D:"火候失控了，下次注意火力。"};
 window.lastResult={heatScore,completion,grade,value,comment:comments[grade]};
 cooking=false;currentPage="result";render();
}
render();
