export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISO(new Date());
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

const WEEKDAYS_CN = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"];

export function formatCN(iso: string): string {
  const d = parseISO(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export function weekdayCN(iso: string): string {
  const d = parseISO(iso);
  const wd = (d.getDay() + 6) % 7; // Monday = 0
  return WEEKDAYS_CN[wd];
}

export function shortCN(iso: string): string {
  const d = parseISO(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** Calendar grid: 6 rows x 7 cols starting Monday, nulls pad the edges. */
export function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month - 1, 1);
  const lead = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(toISO(new Date(year, month - 1, d)));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
