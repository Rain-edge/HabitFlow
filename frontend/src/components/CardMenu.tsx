import { useEffect, useRef } from "react";
import Icon, { type IconName } from "./Icon";

export interface CardMenuItem {
  key: string;
  label: string;
  icon: IconName;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

const MENU_W = 176;
const ITEM_H = 40;

/** 卡片快捷菜单（R-F）：长按/右键唤出，锚点定位、贴边翻转，点击外部或 Esc 关闭。 */
export default function CardMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: CardMenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);

  const menuH = items.length * ITEM_H + 12;
  const left = Math.max(8, Math.min(x, window.innerWidth - MENU_W - 8));
  const top = y + menuH > window.innerHeight - 8 ? Math.max(8, y - menuH) : y;

  return (
    <div
      ref={ref}
      className="fixed z-50 animate-zoom-in overflow-hidden rounded-lg border border-line bg-card py-1.5 shadow-lg"
      style={{ left, top, width: MENU_W }}
    >
      {items.map((it) => (
        <button
          key={it.key}
          disabled={it.disabled}
          className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors hover:bg-line-2 disabled:pointer-events-none disabled:opacity-40 ${
            it.danger ? "text-danger-600 dark:text-danger-500" : "text-ink"
          }`}
          onClick={() => {
            onClose();
            it.onSelect();
          }}
        >
          <Icon name={it.icon} className="h-4 w-4 shrink-0 opacity-70" />
          {it.label}
        </button>
      ))}
    </div>
  );
}
