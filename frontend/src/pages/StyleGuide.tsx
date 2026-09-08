import Logo from "../components/Logo";
import { EmptyState, ProgressBar, SectionTitle, Skeleton, StatCard } from "../components/ui";

const BRAND = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900"] as const;
const BRAND_HEX = ["#EFFAF7", "#D7F2EC", "#B0E4DB", "#7ED0C3", "#48B7A7", "#18A396", "#12877C", "#116B62", "#11554E", "#0F4640"];

function Swatch({ hex, label }: { hex: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="h-12 w-full rounded-md border border-line" style={{ backgroundColor: hex }} />
      <span className="caption">{label}</span>
    </div>
  );
}

function Block({ title, children, desc }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="card card-pad">
      <SectionTitle>{title}</SectionTitle>
      {desc && <p className="caption -mt-2 mb-4">{desc}</p>}
      {children}
    </section>
  );
}

export default function StyleGuide() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">设计系统</h1>
        <p className="caption mt-1">安静 · 清爽 · 有一点积极感。本页是 HabitFlow 视觉语言的活文档。</p>
      </div>

      {/* Icon */}
      <Block title="App 图标 · 成长之流" desc="一条上扬的流线（每日轨迹）在顶端绽放成芽（成长）。单笔画 + 芽点，16px 仍可识别。">
        <div className="flex items-end gap-4">
          {[16, 32, 64, 128].map((s) => (
            <div key={s} className="flex flex-col items-center gap-1">
              <Logo size={s} rounded={s >= 64 ? 10 : 6} />
              <span className="caption">{s}</span>
            </div>
          ))}
          <div className="flex flex-col items-center gap-1">
            <img src="/icons/icon-128.png" alt="icon" className="h-[72px] w-[72px]" />
            <span className="caption">PNG</span>
          </div>
        </div>
      </Block>

      {/* Color */}
      <Block title="Color · 品牌色（沉静青绿）" desc="主色表达生命 / 流动 / 成长；暖橙 flame 只用于连续与成就，制造一点积极感。">
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
          {BRAND.map((k, i) => (
            <Swatch key={k} hex={BRAND_HEX[i]} label={k} />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Swatch hex="#F5822B" label="flame" />
          <Swatch hex="#2FA36B" label="success" />
          <Swatch hex="#E8A400" label="warning" />
          <Swatch hex="#E5484D" label="danger" />
          <Swatch hex="#F7F9F8" label="surface" />
        </div>
      </Block>

      {/* Typography */}
      <Block title="Typography" desc="正文用系统中文黑体；数字与标题用 Manrope（tabular-nums），日期与连续天数有视觉重点。">
        <div className="space-y-3">
          <div className="page-title num">2026年8月29日 · 星期六</div>
          <div className="font-display num text-4xl font-extrabold text-ink">🔥 12 天</div>
          <div className="text-sm text-ink">Body 14 — 今天整体状态不错，运动也坚持下来了。</div>
          <div className="caption">Caption 12 — 今天 4/5 个计划内习惯已完成</div>
        </div>
      </Block>

      {/* Buttons */}
      <Block title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-primary btn-md">完成记录</button>
          <button className="btn-secondary btn-md">保存修改</button>
          <button className="btn-ghost btn-md">取消</button>
          <button className="btn-soft btn-md">补签历史</button>
          <button className="btn-danger btn-md">删除</button>
          <button className="btn-primary btn-sm">小按钮</button>
          <button className="btn-primary btn-lg" disabled>
            禁用
          </button>
        </div>
      </Block>

      {/* Inputs */}
      <Block title="Inputs">
        <div className="grid max-w-md gap-3">
          <div>
            <label className="label">习惯名称</label>
            <input className="input" placeholder="如：坚持喝水" />
          </div>
          <div>
            <label className="label">目标值（ml）</label>
            <input className="input" type="number" defaultValue={2000} />
          </div>
        </div>
      </Block>

      {/* Badges */}
      <Block title="Badges / Chips">
        <div className="flex flex-wrap gap-2">
          <span className="badge-brand">✅ 已完成</span>
          <span className="badge-warn">🔧 补签</span>
          <span className="badge-success">达标</span>
          <span className="badge-danger">中断</span>
          <span className="badge-neutral">无计划</span>
          <span className="streak-chip num">🔥 连续 12 天</span>
        </div>
      </Block>

      {/* Progress + Stats */}
      <Block title="Progress / Stats">
        <div className="max-w-md space-y-3">
          <ProgressBar rate={80} />
          <ProgressBar rate={45} color="#F5822B" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="当前连续" value="12 天" accent="flame" />
            <StatCard label="历史最长" value="27 天" />
            <StatCard label="完成率" value="78%" accent="brand" />
            <StatCard label="累计" value="86 次" />
          </div>
        </div>
      </Block>

      {/* Calendar cells */}
      <Block title="Calendar 状态" desc="轻色块区分完成度：全部 / 部分 / 未完成 / 无计划。">
        <div className="flex gap-2">
          <div className="flex h-11 w-11 flex-col items-center justify-center rounded-lg bg-success-500 text-white">
            <span className="text-xs font-semibold">25</span>
          </div>
          <div className="flex h-11 w-11 flex-col items-center justify-center rounded-lg bg-warning-500 text-white">
            <span className="text-xs font-semibold">26</span>
          </div>
          <div className="flex h-11 w-11 flex-col items-center justify-center rounded-lg bg-danger-500/10 text-danger-500">
            <span className="text-xs font-semibold">27</span>
          </div>
          <div className="flex h-11 w-11 flex-col items-center justify-center rounded-lg bg-line-2 text-ink-3">
            <span className="text-xs font-semibold">28</span>
          </div>
        </div>
      </Block>

      {/* States */}
      <Block title="Empty / Loading / Error">
        <div className="grid gap-3 lg:grid-cols-3">
          <EmptyState icon="🌱" title="还没有习惯" desc="创建你想坚持的事情" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-16 w-full" />
          </div>
          <div className="error-box">日期早于习惯开始日期，无法记录。</div>
        </div>
      </Block>
    </div>
  );
}
