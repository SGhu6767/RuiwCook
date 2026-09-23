# RuiwCook

移动端优先的做饭模拟经营小游戏，适合直接部署到 Cloudflare Pages。

## 游戏循环
80 ri币开局 → 选择35道菜之一 → 购买缺少食材 → 控制火候 → 结算成品价值 → 出售或存库。

## 文件
- `index.html`：Vite 入口页面
- `src/main.tsx`：React 启动入口
- `src/App.tsx`：游戏主界面与状态逻辑
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
