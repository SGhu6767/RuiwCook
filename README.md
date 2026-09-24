# RuiwCook

移动端优先的做饭模拟经营小游戏，适合直接部署到 Cloudflare Pages。

## 游戏循环
80 ri币开局 → 在食材框里选食材 + 烹饪方式（或在「查看菜谱」里照菜谱做，可一键购买缺少的食材）→ 翻炒控制火候（按次数，看指南出锅）→ 结算成品价值 → 出售或存库。

## 文件
- `index.html`：Vite 入口页面
- `src/main.tsx`：React 启动入口
- `src/App.tsx`：游戏主界面与状态逻辑（食材框主页、结算、仓库）
- `src/CookingStage.tsx`：原神风格烹饪界面（锅、火、弧形火候条、翻炒/结束）
- `src/RecipeBook.tsx`：菜谱面板（食材是否齐全、一键购买、按菜谱烹饪）
- `src/ShopList.tsx`：食材商店列表
- `src/Sheet.tsx`：底部弹出面板
- `src/cooking.ts`：火候次数、菜名、售价、菜谱匹配等玩法规则
- `src/data.ts`：菜品数据、食材价格、表情与分类
- `src/index.css`：样式与 UI 主题

## 技术栈
- Vite
- React
- TypeScript
- pnpm

## 运行方式
```bash
pnpm install
pnpm dev
```

## 构建
```bash
pnpm build
```
