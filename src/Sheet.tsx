import type { ReactNode } from "react";

type Props = {
  title: string;
  money: number;
  onClose: () => void;
  children: ReactNode;
};

/** 从底部弹出的面板：用于「食材购买」和「查看菜谱」。 */
export default function Sheet({ title, money, onClose, children }: Props) {
  return (
    <div className="sheet-mask" onClick={onClose}>
      <section className="sheet" role="dialog" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <header className="sheet-head">
          <strong>{title}</strong>
          <span className="sheet-wallet">💰 {money} ri币</span>
          <button className="sheet-close" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </section>
    </div>
  );
}
