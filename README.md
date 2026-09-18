# RuiwCook

移动端优先的做饭模拟经营小游戏，适合直接部署到 Cloudflare Pages。

## 游戏循环
80 ri币开局 → 选择35道菜之一 → 购买缺少食材 → 控制火候 → 结算成品价值 → 出售或存库。

## 文件
- `public/index.html`：页面结构
- `public/style.css`：界面样式
- `public/game.js`：游戏逻辑、ri币、食材、烹饪、仓库
- `public/dishes.js`：35道菜品库

## Cloudflare Pages
构建命令留空，输出目录填写 `public`。
本版本无需后端、无需 API Key。
玩家数据保存在浏览器 localStorage 中；因此同一玩家换设备/清除浏览器数据后不会同步。
