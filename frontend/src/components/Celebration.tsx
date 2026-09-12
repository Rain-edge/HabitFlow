import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";

const COLORS = ["#18A396", "#48B7A7", "#F5822B", "#2FA36B", "#E8A400", "#5B8DEF", "#8B7CF6"];

/** 全屏彩带庆祝（R-B）：Canvas 自研轻实现，不引库；文案停留约 2.6s，彩带落尽自动停帧。 */
export default function Celebration() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showText, setShowText] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const parts = Array.from({ length: 140 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * W * 0.5,
      y: -30 - Math.random() * H * 0.25,
      vx: (Math.random() - 0.5) * 3.2,
      vy: 1.5 + Math.random() * 2.5,
      w: 5 + Math.random() * 5,
      h: 8 + Math.random() * 8,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      delay: Math.random() * 40,
    }));

    let raf = 0;
    let frames = 0;
    const tick = () => {
      frames++;
      ctx.clearRect(0, 0, W, H);
      let alive = false;
      for (const p of parts) {
        if (frames < p.delay) {
          alive = true;
          continue;
        }
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.03;
        p.rot += p.vr;
        if (p.y < H + 30) alive = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(0, Math.min(1, (H + 30 - p.y) / 120));
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (alive) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const t1 = window.setTimeout(() => setShowText(false), 2600);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      <canvas ref={canvasRef} className="h-full w-full" />
      {showText && (
        <div className="animate-pop absolute left-1/2 top-24 -translate-x-1/2 rounded-card bg-card/95 px-6 py-4 text-center shadow-lg">
          <Icon name="party-popper" className="mx-auto h-7 w-7 text-flame-500" />
          <p className="mt-2 text-base font-bold text-ink">今天全部完成！</p>
          <p className="caption mt-1">每一个打卡都是给自己的礼物</p>
        </div>
      )}
    </div>
  );
}
