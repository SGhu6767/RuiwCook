import { useEffect, useMemo, useRef, useState } from "react";
import { emoji } from "./data";
import { gaugeSlots, isFree, isSeasoning, maxSteps, targetSteps, zoneOf } from "./cooking";
import type { CookSpec, HeatZone } from "./cooking";

type Props = {
  spec: CookSpec;
  onCancel: () => void;
  /** count = 实际翻炒次数，target = 火候正好所需次数 */
  onFinish: (count: number, target: number) => void;
};

/* 弧形火候条的几何参数（SVG viewBox 800 x 250） */
const CX = 400;
const CY = 850;
const R = 740;
const SPAN = 52; // 整条弧的总角度
const THICK = 30;

const ZONE_COLOR: Record<HeatZone, string> = {
  raw: "#3d4558",
  good: "#efe7b4",
  perfect: "#f2a93b",
  burnt: "#5b3b3b"
};

function polar(angleDeg: number, radius: number): [number, number] {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [CX + radius * Math.cos(a), CY + radius * Math.sin(a)];
}

function arcPath(from: number, to: number, radius: number) {
  const [x1, y1] = polar(from, radius);
  const [x2, y2] = polar(to, radius);
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

function guideOf(count: number, target: number) {
  const delta = count - target;
  if (count === 0) return { tone: "idle", text: "点「翻炒」开始加热，留意橙色区域" };
  if (delta < -1) return { tone: "idle", text: "火候还浅，继续翻炒……" };
  if (delta === -1) return { tone: "near", text: "快好了！再翻炒 1 次火候最佳" };
  if (delta === 0) return { tone: "ready", text: "✨ 火候正好，该出锅了！" };
  if (delta === 1) return { tone: "warn", text: "⚠ 有点过火了，赶紧出锅！" };
  return { tone: "burnt", text: "🔥 糊锅了！" };
}

export default function CookingStage({ spec, onCancel, onFinish }: Props) {
  const target = useMemo(() => targetSteps(spec.method, spec.ingredients), [spec]);
  const slots = gaugeSlots(target);
  const limit = maxSteps(target);

  const [count, setCount] = useState(0);
  const [tick, setTick] = useState(0);
  const [locked, setLocked] = useState(false);
  const countRef = useRef(0);
  const doneRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    []
  );

  const zone: HeatZone = zoneOf(count, target);
  const guide = guideOf(count, target);
  const slotAngle = SPAN / slots;
  const pointerAngle = -SPAN / 2 + (count + 0.5) * slotAngle;

  const potItems = useMemo(() => {
    const real = spec.ingredients.filter((item) => !isFree(item));
    const main = real.filter((item) => !isSeasoning(item));
    return (main.length ? main : real).slice(0, 4);
  }, [spec]);

  function finish(finalCount: number) {
    if (doneRef.current) return;
    doneRef.current = true;
    onFinish(finalCount, target);
  }

  function stir() {
    if (locked || doneRef.current) return;
    const next = countRef.current + 1;
    countRef.current = next;
    setCount(next);
    setTick((value) => value + 1);

    // 一直翻炒到上限还不出锅 -> 糊锅，自动结束
    if (next >= limit) {
      setLocked(true);
      timerRef.current = window.setTimeout(() => finish(next), 1100);
    }
  }

  function endCook() {
    if (locked || countRef.current === 0) return;
    finish(countRef.current);
  }

  const heatLevel = Math.min(1.3, 0.55 + (count / Math.max(1, target)) * 0.55);
  const guideCall = guide.tone === "near" || guide.tone === "ready" || guide.tone === "warn";

  return (
    <div className={`stage zone-${count === 0 ? "cold" : zone}`} style={{ ["--heat" as string]: String(heatLevel) }} role="dialog" aria-label="烹饪">
      <div className="stage-mist" aria-hidden="true">
        <i></i>
        <i></i>
        <i></i>
      </div>

      <header className="stage-top">
        <div className="stage-title">
          <span className="chef-hat" aria-hidden="true">
            🧑‍🍳
          </span>
          <div>
            <strong>烹饪</strong>
            <small>
              {spec.name} · {spec.method}
            </small>
          </div>
        </div>
        <button className="stage-close" onClick={onCancel} aria-label="退出烹饪">
          ✕
        </button>
      </header>

      <div className="stage-body">
        <div className="pot-wrap">
          <div className="smoke" aria-hidden="true">
            <i></i>
            <i></i>
            <i></i>
          </div>
          <div className="steam" aria-hidden="true">
            <i></i>
            <i></i>
            <i></i>
          </div>

          <div className={`pot ${tick % 2 === 0 ? "stir-a" : "stir-b"}`}>
            <div className="pot-items">
              {potItems.map((item) => (
                <span key={item} className="pot-item">
                  {emoji(item)}
                </span>
              ))}
            </div>
            <svg className="pot-svg" viewBox="0 0 320 210" aria-hidden="true">
              <defs>
                <linearGradient id="potBody" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#5d6474" />
                  <stop offset="0.55" stopColor="#3e4453" />
                  <stop offset="1" stopColor="#2a2e3a" />
                </linearGradient>
              </defs>
              <path d="M14 58 L52 46 L62 70 L28 84 Z" fill="#4a505f" stroke="#6f7788" strokeWidth="3" />
              <path d="M306 58 L268 46 L258 70 L292 84 Z" fill="#4a505f" stroke="#6f7788" strokeWidth="3" />
              <path d="M38 62 Q160 24 282 62 L262 146 Q160 204 58 146 Z" fill="url(#potBody)" stroke="#727a8c" strokeWidth="4" />
              <ellipse cx="160" cy="60" rx="124" ry="27" fill="#2b2f3a" stroke="#8b93a5" strokeWidth="5" />
              <ellipse cx="160" cy="63" rx="108" ry="20" fill="#3a3122" />
              <path d="M160 118 L176 138 L160 158 L144 138 Z" fill="none" stroke="#8b93a5" strokeWidth="3" opacity="0.7" />
              <path d="M112 112 L124 128 L112 144 M208 112 L196 128 L208 144" fill="none" stroke="#8b93a5" strokeWidth="3" opacity="0.5" />
            </svg>
          </div>

          <div className="fire" aria-hidden="true">
            <i></i>
            <i></i>
            <i></i>
            <i></i>
            <i></i>
          </div>
        </div>

        <div className={`guide ${guide.tone}`} aria-live="polite">
          {guide.text}
        </div>

        <svg className="gauge" viewBox="0 0 800 250" role="img" aria-label={`火候条，已翻炒 ${count} 次`}>
          <defs>
            <filter id="pointerGlow" x="-100%" y="-30%" width="300%" height="160%">
              <feGaussianBlur stdDeviation="5" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <path d={arcPath(-SPAN / 2 - 1.2, SPAN / 2 + 1.2, R + THICK / 2 + 6)} className="gauge-line" />
          <path d={arcPath(-SPAN / 2 - 1.2, SPAN / 2 + 1.2, R - THICK / 2 - 6)} className="gauge-line" />

          {Array.from({ length: slots }, (_, index) => {
            const slotZone = zoneOf(index, target);
            const start = -SPAN / 2 + index * slotAngle + 0.25;
            const end = -SPAN / 2 + (index + 1) * slotAngle - 0.25;
            return (
              <path
                key={index}
                d={arcPath(start, end, R)}
                stroke={ZONE_COLOR[slotZone]}
                strokeWidth={THICK}
                fill="none"
                className={`gauge-slot ${index <= count ? "passed" : ""}`}
              />
            );
          })}

          {Array.from({ length: slots }, (_, index) => {
            const [x, y] = polar(-SPAN / 2 + (index + 0.5) * slotAngle, R + THICK / 2 + 26);
            return (
              <circle
                key={index}
                cx={x}
                cy={y}
                r={index === count ? 7 : 4}
                className={`gauge-dot ${index === count ? "current" : ""}`}
              />
            );
          })}

          <g
            className="gauge-pointer"
            style={{ transform: `rotate(${pointerAngle}deg)`, transformOrigin: `${CX}px ${CY}px` }}
            filter="url(#pointerGlow)"
          >
            <rect x={CX - 12} y={CY - R - 60} width={24} height={108} rx={12} fill="#ffffff" />
            <rect x={CX - 5} y={CY - R - 46} width={10} height={40} rx={5} fill="#e8e1d0" />
          </g>
        </svg>

        <div className="stage-count">
          已翻炒 <b>{count}</b> 次
        </div>
      </div>

      <footer className="stage-actions">
        <button className="round stir" onClick={stir} disabled={locked}>
          <span className="round-icon">🥄</span>
          <span>翻炒</span>
        </button>
        <button
          className={`round end ${guideCall && !locked ? "pulse" : ""}`}
          onClick={endCook}
          disabled={locked || count === 0}
        >
          <span className="round-icon">■</span>
          <span>结束</span>
        </button>
      </footer>
    </div>
  );
}
