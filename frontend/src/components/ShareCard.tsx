// Achievement share card: draws a branded 4:5 PNG on canvas (preview + save).
// Drawn in code so it works offline and matches the brand without asset files.
import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import Modal from "./Modal";
import { toast } from "./Layout";

interface ShareData {
  username: string;
  longest_streak: number;
  total_records: number;
  record_days: number;
  active_habit_count: number;
}

const W = 1080;
const H = 1350;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function draw(canvas: HTMLCanvasElement, d: ShareData) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const INK = "#1C2B28";
  const INK2 = "#63726D";
  const INK3 = "#9AA6A1";

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#F9F9F5";
  ctx.fillRect(0, 0, W, H);

  // ---- hero block with brand gradient + logo stroke ----
  const grad = ctx.createLinearGradient(0, 60, 0, 500);
  grad.addColorStop(0, "#1FB1A0");
  grad.addColorStop(1, "#139384");
  roundRect(ctx, 60, 60, W - 120, 440, 48);
  ctx.fillStyle = grad;
  ctx.fill();

  // "The Growing Flow" stroke: rising curve + sprout dot
  ctx.strokeStyle = "#FBFEFD";
  ctx.lineWidth = 40;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(150, 380);
  ctx.bezierCurveTo(300, 380, 280, 240, 430, 218);
  ctx.stroke();
  ctx.fillStyle = "#FBFEFD";
  ctx.beginPath();
  ctx.arc(492, 202, 26, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#FBFEFD";
  ctx.font = "700 96px 'Manrope', 'Segoe UI', system-ui, sans-serif";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("HabitFlow", 560, 320);
  ctx.font = "400 38px 'Segoe UI', system-ui, sans-serif";
  ctx.fillStyle = "rgba(251,254,253,0.85)";
  ctx.fillText("记录坚持的每一天", 560, 388);

  // ---- three headline numbers ----
  const stats: { value: string; label: string; color: string }[] = [
    { value: `${d.longest_streak}`, label: d.longest_streak > 0 ? "最长连续（天）" : "连续天数", color: "#F5822B" },
    { value: `${d.total_records}`, label: "累计完成（次）", color: "#18A396" },
    { value: `${d.record_days}`, label: "坚持天数", color: INK },
  ];
  const colW = (W - 120) / 3;
  stats.forEach((s, i) => {
    const cx = 60 + colW * i + colW / 2;
    ctx.textAlign = "center";
    ctx.font = "800 128px 'Manrope', 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = s.color;
    ctx.fillText(s.value, cx, 760);
    ctx.font = "400 34px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = INK2;
    ctx.fillText(s.label, cx, 824);
  });
  ctx.textAlign = "left";

  // ---- footer ----
  ctx.strokeStyle = "#E3E8E6";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(60, 940);
  ctx.lineTo(W - 60, 940);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.font = "600 44px 'Segoe UI', system-ui, sans-serif";
  ctx.fillStyle = INK;
  ctx.fillText(`@${d.username} 的坚持足迹`, W / 2, 1050);
  ctx.font = "400 34px 'Segoe UI', system-ui, sans-serif";
  ctx.fillStyle = INK2;
  ctx.fillText(`${d.active_habit_count} 个习惯进行中 · 每一天都算数`, W / 2, 1116);

  const date = new Date();
  ctx.font = "400 30px 'Segoe UI', system-ui, sans-serif";
  ctx.fillStyle = INK3;
  ctx.fillText(
    `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 · HabitFlow`,
    W / 2,
    1260
  );
  ctx.textAlign = "left";
}

export default function ShareCard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [data, setData] = useState<ShareData | null>(null);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        const [o, me] = await Promise.all([
          api.get<{
            total_records: number;
            record_days: number;
            active_habit_count: number;
            habits: { longest_streak: number }[];
          }>("/statistics/overview?range=all"),
          api.get<{ username: string }>("/users/me"),
        ]);
        setData({
          username: me.username || "我",
          longest_streak: o.habits.reduce((m, h) => Math.max(m, h.longest_streak), 0),
          total_records: o.total_records,
          record_days: o.record_days,
          active_habit_count: o.active_habit_count,
        });
      } catch {
        toast("加载分享数据失败", "error");
      }
    })();
  }, [open]);

  useEffect(() => {
    if (open && data && canvasRef.current) draw(canvasRef.current, data);
  }, [open, data]);

  const save = () => {
    const url = canvasRef.current?.toDataURL("image/png");
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = "habitflow-share.png";
    a.click();
    toast("卡片已保存", "success");
  };

  if (!open) return null;

  return (
    <Modal title="分享我的坚持" onClose={onClose}>
      <div className="space-y-4">
        {data ? (
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="mx-auto block w-full max-w-xs rounded-xl border border-line"
          />
        ) : (
          <div className="py-16 text-center text-sm text-ink-3">生成中…</div>
        )}
        <button className="btn btn-lg btn-primary w-full" onClick={save} disabled={!data}>
          保存图片
        </button>
        <p className="text-center text-xs text-ink-3">保存后可以分享到朋友圈或发给朋友。</p>
      </div>
    </Modal>
  );
}
