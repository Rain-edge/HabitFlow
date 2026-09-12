import {
  Sun, Moon, Bell, Plus, Search, Check, Flame, Calendar, BarChart3, NotebookPen,
  Settings, Home, Sprout, Trash2, Pencil, RotateCcw, X, AlertTriangle,
  ArrowLeft, ArrowRight, Download, Upload, ChevronLeft, ChevronRight, Star,
  Clock, Hash, Type, List, Timer, CheckCircle2, XCircle, Smile, Zap,
  CloudRain, ShieldCheck, Trophy, TrendingUp, Target, Wrench, Circle,
  ClipboardList, Sparkles, Medal, Crown, Dumbbell, Gem, CalendarCheck,
  CalendarDays, PartyPopper, Droplets, BookOpen, Utensils, Flower2,
  PenLine, HeartPulse, Coffee, Music, AlarmClock, Footprints,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type IconName =
  | "sun" | "moon" | "bell" | "plus" | "search" | "check" | "flame" | "calendar"
  | "stats" | "journal" | "settings" | "home" | "sprout" | "trash" | "pencil"
  | "restore" | "x" | "alert" | "left" | "right" | "download" | "upload"
  | "prev" | "next" | "star" | "clock" | "hash" | "type" | "list" | "timer"
  | "check-circle" | "x-circle"
  | "smile" | "zap" | "cloud-rain" | "shield-check" | "trophy" | "trending-up"
  | "target" | "wrench" | "circle" | "clipboard" | "sparkles" | "medal"
  | "crown" | "dumbbell" | "gem" | "calendar-check" | "calendar-days"
  | "party-popper"
  // habit icons (pickable when creating a habit)
  | "droplets" | "book-open" | "utensils" | "flower"
  | "pen-line" | "heart-pulse" | "coffee" | "music" | "alarm-clock" | "footprints";

const ICONS: Record<IconName, LucideIcon> = {
  sun: Sun, moon: Moon, bell: Bell, plus: Plus, search: Search, check: Check,
  flame: Flame, calendar: Calendar, stats: BarChart3, journal: NotebookPen,
  settings: Settings, home: Home, sprout: Sprout, trash: Trash2, pencil: Pencil,
  restore: RotateCcw, x: X, alert: AlertTriangle, left: ArrowLeft, right: ArrowRight,
  download: Download, upload: Upload, prev: ChevronLeft, next: ChevronRight,
  star: Star, clock: Clock, hash: Hash, type: Type, list: List, timer: Timer,
  "check-circle": CheckCircle2, "x-circle": XCircle,
  smile: Smile, zap: Zap, "cloud-rain": CloudRain, "shield-check": ShieldCheck,
  trophy: Trophy, "trending-up": TrendingUp, target: Target, wrench: Wrench,
  circle: Circle, clipboard: ClipboardList, sparkles: Sparkles, medal: Medal,
  crown: Crown, dumbbell: Dumbbell, gem: Gem, "calendar-check": CalendarCheck,
  "calendar-days": CalendarDays, "party-popper": PartyPopper,
  droplets: Droplets, "book-open": BookOpen,
  utensils: Utensils, flower: Flower2, "pen-line": PenLine, "heart-pulse": HeartPulse,
  coffee: Coffee, music: Music, "alarm-clock": AlarmClock, footprints: Footprints,
};

/** Set of every registered icon name — used to distinguish habit icons from legacy emoji. */
export const ICON_NAMES = new Set(Object.keys(ICONS) as IconName[]);

export function isIconName(name: string): name is IconName {
  return ICON_NAMES.has(name as IconName);
}

export default function Icon({
  name,
  className = "h-5 w-5",
  strokeWidth = 1.8,
}: {
  name: IconName;
  className?: string;
  strokeWidth?: number;
}) {
  const C = ICONS[name];
  return <C className={className} strokeWidth={strokeWidth} aria-hidden="true" />;
}
