type Props = {
  onLogin: () => void;
  onClose: () => void;
};

/** 首次进入网页、或点击「我」但还没登录时弹出的提示。 */
export default function LoginPrompt({ onLogin, onClose }: Props) {
  return (
    <div className="sheet-mask" onClick={onClose}>
      <section className="sheet login-prompt" role="dialog" aria-label="登录" onClick={(event) => event.stopPropagation()}>
        <header className="sheet-head">
          <strong>欢迎来到 RuiwCook</strong>
          <button className="sheet-close" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </header>

        <div className="sheet-body login-prompt-body">
          <p>登录后，你的 ri币、食材和仓库都会保存在账号里，换设备也不会丢。</p>

          <button className="github-login-btn" onClick={onLogin}>
            <svg className="github-mark" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
                0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13
                -.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07
                -1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82
                a7.5 7.5 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15
                0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2
                0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/>
            </svg>
            使用 GitHub 一键登录
          </button>

          <button className="login-later-btn" onClick={onClose}>
            先随便逛逛
          </button>
        </div>
      </section>
    </div>
  );
}
