import { Sun, Moon, Bell, Plus, Search, Check, Flame, Calendar, BarChart3, NotebookPen, Settings, Home, Sprout, Trash2, Pencil, RotateCcw, X, AlertTriangle, ArrowLeft, ArrowRight, Download, Upload, ChevronLeft, ChevronRight, Star, Clock, Hash, Type, List, Timer, CheckCircle2, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type IconName =
  | "sun" | "moon" | "bell" | "plus" | "search" | "check" | "flame" | "calendar"
  | "stats" | "journal" | "settings" | "home" | "sprout" | "trash" | "pencil"
  | "restore" | "x" | "alert" | "left" | "right" | "download" | "upload"
  | "prev" | "next" | "star" | "clock" | "hash" | "type" | "list" | "timer"
  | "check-circle" | "x-circle";

const ICONS: Record<IconName, LucideIcon> = {
  sun: Sun, moon: Moon, bell: Bell, plus: Plus, search: Search, check: Check,
  flame: Flame, calendar: Calendar, stats: BarChart3, journal: NotebookPen,
  settings: Settings, home: Home, sprout: Sprout, trash: Trash2, pencil: Pencil,
  restore: RotateCcw, x: X, alert: AlertTriangle, left: ArrowLeft, right: ArrowRight,
  download: Download, upload: Upload, prev: ChevronLeft, next: ChevronRight,
  star: Star, clock: Clock, hash: Hash, type: Type, list: List, timer: Timer,
  "check-circle": CheckCircle2, "x-circle": XCircle,
};

export default function Icon({
  name,
  className = "h-5 w-5",
  strokeWidth = 2,
}: {
  name: IconName;
  className?: string;
  strokeWidth?: number;
}) {
  const C = ICONS[name];
  return <C className={className} strokeWidth={strokeWidth} aria-hidden="true" />;
}
