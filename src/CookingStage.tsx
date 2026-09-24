import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { emoji } from "./data";
import { gaugeSlots, isFree, isSeasoning, targetSteps, zoneOf } from "./cooking";
import type { CookSpec, HeatZone } from "./cooking";

/* 火候指针速度（单位：格/秒）。想调难度只改这两个数：
 *   FORWARD_SPEED：按住「加热」时指针向右滑动的速度，越大越快、越难停准
 *   BACK_SPEED   ：松手后指针向左回落的速度，设为 0 就是松手原地不动（更简单） */
const FORWARD_SPEED = 3.4;
const BACK_SPEED = 1.5;

type Props = {
  spec: CookSpec;
  onCancel: () => void;
  /** slot = 出锅时指针所在的格子，target = 橙色（火候正好）格子的位置 */
  onFinish: (slot: number, target: number) => void;
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

function guideOf(slot: number, target: number, moved: boolean) {
  const delta = slot - target;
  if (!moved) return { tone: "idle", text: "按住「加热」让指针向右滑动，松手会慢慢回落" };
  if (delta < -1) return { tone: "idle", text: "火候还浅，继续按住……" };
  if (delta === -1) return { tone: "near", text: "快到了！准备松手" };
  if (delta === 0) return { tone: "ready", text: "✨ 火候正好，快点「结束」出锅！" };
  if (delta === 1) return { tone: "warn", text: "⚠ 有点过火了，赶紧「结束」！" };
  return { tone: "burnt", text: "🔥 糊锅了！" };
}

export default function CookingStage({ spec, onCancel, onFinish }: Props) {
  const target = useMemo(() => targetSteps(spec.method, spec.ingredients), [spec]);
  const slots = gaugeSlots(target);

  const [pos, setPos] = useState(0); // 指针位置，单位：格（可以是小数）
  const [holding, setHolding] = useState(false);
  const [locked, setLocked] = useState(false);

  const posRef = useRef(0);
  const holdRef = useRef(false);
  const lockedRef = useRef(false);
  const doneRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const finishCbRef = useRef(onFinish);
  finishCbRef.current = onFinish;

  const slotOf = (value: number) => Math.min(slots - 1, Math.max(0, Math.floor(value)));

  function finish(finalPos: number) {
    if (doneRef.current) return;
    doneRef.current = true;
    finishCbRef.current(slotOf(finalPos), target);
  }

  function setHold(value: boolean) {
    holdRef.current = value;
    setHolding(value);
  }

  // 每帧推进指针：按住向右，松手向左回落；滑到尽头 = 糊锅
  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (!lockedRef.current && !doneRef.current) {
        let next = posRef.current + (holdRef.current ? FORWARD_SPEED : -BACK_SPEED) * dt;
        next = Math.max(0, next);

        if (next >= slots - 0.02) {
          next = slots - 0.02;
          lockedRef.current = true;
          setLocked(true);
          setHold(false);
          timerRef.current = window.setTimeout(() => finish(next), 900);
        }

        if (next !== posRef.current) {
          posRef.current = next;
          setPos(next);
        }
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    []
  );

  function press(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* 部分浏览器不支持指针捕获，不影响长按 */
    }
    if (!lockedRef.current && !doneRef.current) setHold(true);
  }

  function release() {
    setHold(false);
  }

  function endCook() {
    if (lockedRef.current || doneRef.current || posRef.current < 0.05) return;
    finish(posRef.current);
  }

  // 键盘：按住空格加热，回车结束；切走页面时自动松手
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        if (!event.repeat && !lockedRef.current && !doneRef.current) setHold(true);
      } else if (event.code === "Enter" && !event.repeat) {
        endCook();
      }
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === "Space") setHold(false);
    };
    const blur = () => setHold(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const slot = slotOf(pos);
  const moved = pos > 0.05;
  const zone: HeatZone = zoneOf(slot, target);
  const guide = guideOf(slot, target, moved);
  const slotAngle = SPAN / slots;
  const pointerAngle = -SPAN / 2 + pos * slotAngle;

  const potItems = useMemo(() => {
    const real = spec.ingredients.filter((item) => !isFree(item));
    const main = real.filter((item) => !isSeasoning(item));
    return (main.length ? main : real).slice(0, 4);
  }, [spec]);

  const heatLevel = Math.min(1.3, 0.55 + (pos / Math.max(1, target)) * 0.55);
  const guideCall = guide.tone === "near" || guide.tone === "ready" || guide.tone === "warn";

  return (
    <div className={`stage zone-${moved ? zone : "cold"}`} style={{ ["--heat" as string]: String(heatLevel) }} role="dialog" aria-label="烹饪">
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

          <div className={`pot ${holding ? "stirring" : ""}`}>
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

        <svg className="gauge" viewBox="0 0 800 250" role="img" aria-label="火候条">
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
                className={`gauge-slot ${index <= slot ? "passed" : ""}`}
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
                r={index === slot ? 7 : 4}
                className={`gauge-dot ${index === slot ? "current" : ""}`}
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

        <div className="stage-count">按住「加热」向右滑动 · 松手缓慢回落 · 橙色区出锅</div>
      </div>

      <footer className="stage-actions">
        <button
          className={`round stir ${holding ? "holding" : ""}`}
          onPointerDown={press}
          onPointerUp={release}
          onPointerCancel={release}
          onLostPointerCapture={release}
          onContextMenu={(event) => event.preventDefault()}
          disabled={locked}
          aria-label="按住加热"
        >
          <span className="round-icon">🔥</span>
          <span>按住加热</span>
        </button>
        <button
          className={`round end ${guideCall && !locked ? "pulse" : ""}`}
          onClick={endCook}
          disabled={locked || !moved}
        >
          <span className="round-icon">■</span>
          <span>结束</span>
        </button>
      </footer>
    </div>
  );
}
