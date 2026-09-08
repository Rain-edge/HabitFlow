# HabitFlow 体验优化方案（可落地版）

> 版本:2026-08-29 · 范围:前端本地版(IndexedDB + Capacitor APK)
> 原则:不推倒重来,在现有设计 token 与组件体系上做**渐进式升级**;每个改动点标注文件/工作量/风险。

---

## 现状基线(已核查)

| 维度 | 现状 |
|---|---|
| 设计 token | ✅ 已有完整体系:`--brand #18A396`、`--flame #F5822B`、surface/card/ink 三级色 + 暗色模式 |
| 组件 | ✅ card / btn 体系 / Modal / toast / PageLoading / EmptyState 已有 |
| 交互 | ⚠️ 原生 confirm、无骨架屏、无统一动画库、toast 3.2s 固定 |
| 功能 | ⚠️ 无搜索/筛选/排序、无数据导入、无全局快捷键、统计范围固定 4 档 |

---

## 一、界面视觉

### V1. 统一标题层级(消除 text-lg/text-xl 混用)
**现状**:`Habits.tsx` 用 `text-lg`、`Statistics.tsx` 用 `text-xl`、`page-title` 类定义 `text-xl`。
**方案**:统一为 3 级体系,所有页面标题改用 `.page-title`(text-xl → 保持,但补 `tracking-tight`);区块标题统一 `.section-title`(text-sm → text-[13px] 微调)。次级标题不再另立字号。
**文件**:`pages/*.tsx`(9 处标题替换)、`index.css`(page-title/section-title 微调)
**工作量**:0.5h · **风险**:低 · **优先级**:P0

### V2. 精简卡片装饰与视觉噪音
**现状**:导航用 emoji(☀️🌱📅📊📝⚙️)、卡片 `shadow-xs` + 边框双重描边、图标底色用 `#4F8EF7 22` 透明度叠色。
**方案**:
1. 导航图标统一 6 个 emoji 为**单色 SVG 图标集**(引入 lucide-react,树摇友好,~40 个图标即可覆盖全部页面)
2. 卡片去 `shadow-xs`,保留 `border-line`(边框足够,阴影在暗色下显得脏)
3. 习惯图标底色透明度 `22 → 18`,降低饱和度对比
**文件**:`components/Layout.tsx`、`index.css`、`pages/Habits.tsx`、`pages/Dashboard.tsx`、新增 `components/Icon.tsx`
**工作量**:2h · **风险**:中(涉及所有页面图标替换,需回归) · **优先级**:P1

### V3. 留白与间距规范化
**现状**:页面容器 `space-y-4/5/6` 混用,卡片内边距 p-4/p-5 混用,无统一韵律。
**方案**:确立间距节奏 —— 页面级 `space-y-6`,区块级 `space-y-4`,卡片内 `p-5`(桌面)/`p-4`(移动);Hero 卡片 `p-6`。通过全局 CSS 覆盖 `.card-pad` 让所有卡片默认一致,个别页面移除手写 padding 类。
**文件**:`index.css`(.card-pad 统一)、`pages/*.tsx`(去除局部 p-4 覆盖)
**工作量**:1h · **风险**:低 · **优先级**:P1

### V4. 字体规范
**现状**:`font-display` 仅用于数字(tabular-nums),正文全走系统字体。
**方案**:保持系统字体(APK 体积零成本),但为**数字/日期/统计数据**统一加 `.num` 类(已有,补齐遗漏处如 Statistics 的 Y 轴数字、Journal 的滑块数值);标题字重 `font-semibold → font-bold` 增强层级。
**文件**:`pages/Statistics.tsx`、`pages/Journal.tsx`、`pages/HabitDetail.tsx`
**工作量**:0.5h · **风险**:低 · **优先级**:P2

---

## 二、操作体验

### O1. 首页一键打卡(最核心的高频优化)
**现状**:首页习惯条目 → 点「记录」→ 弹 RecordDialog → 填值 → 保存,**4 步**;boolean 习惯尤其冗余。
**方案**:
1. **boolean 习惯**:首页条目加「✓ 完成」**内联按钮**,点击直接打卡(写 IndexedDB + 即时刷新条目态),无需弹窗
2. **数值/时长/评分**:条目上增加**快速输入框**(数字输入 + 回车提交),输入后自动按 `target_value` 判定完成
3. 仅 `text/time/select` 类型保留弹窗
**文件**:`pages/Dashboard.tsx`(条目区重构)、`components/RecordDialog.tsx`(保留)、`local/api.ts`(recordApi.create 已有,无需改)
**工作量**:3h · **风险**:中(交互改动核心页) · **优先级**:P0

### O2. 全局快捷键
**方案**(桌面/平板,`Layout.tsx` 挂 keydown 监听):
| 键 | 动作 |
|---|---|
| `g` + `h` | 跳转首页 |
| `g` + `h` 后 `n` | 新建习惯(打开表单) |
| `c` | 日历页 |
| `s` | 统计页 |
| `j` | 日志页 |
| `?` | 快捷键面板(轻提示弹层) |
| `Esc` | 关闭弹窗/抽屉 |

快捷键面板做成 `components/ShortcutHint.tsx`,APK 内 WebView 支持软键盘可不显示说明。
**文件**:`components/Layout.tsx`、新增 `components/ShortcutHint.tsx`
**工作量**:2h · **风险**:低 · **优先级**:P1

### O3. 习惯列表搜索
**现状**:习惯多时靠滚动找,无任何检索能力。
**方案**:Habits 页顶部加搜索框(名称/描述/图标模糊匹配,`useMemo` 过滤,零依赖);配合「分类」下拉筛选(从 habits 数据动态聚合分类)。移动端搜索框常驻,桌面端收进可折叠区。
**文件**:`pages/Habits.tsx`(加 search/filter state + UI)
**工作量**:1.5h · **风险**:低 · **优先级**:P0

### O4. 底部导航常驻(移动端)
**现状**:移动端导航在顶部 banner 下的横向条目,下滑即消失。
**方案**:改为**底部固定 Tab Bar**(今天/习惯/日历/统计/日志/设置 6 项,emoji→图标,active 态 brand 色),顶栏仅保留主题/通知。参考主流习惯 app(loop habit tracker 同款布局)。
**文件**:`components/Layout.tsx`(移动端 nav 结构重写)
**工作量**:1.5h · **风险**:中(移动端布局) · **优先级**:P1

### O5. 加载与响应提速
**现状**:每次页面挂载全量 `api.get`,IndexedDB `getAll` 每表全扫;无缓存层。
**方案**:
1. `local/db.ts` 加 **内存缓存层**(Map:store→数据,写操作后失效),同页多次读取不再重复查 IDB
2. Dashboard 用 `useEffect` 一次性拉 habits+records+journal,改为 **Promise.all 并发**(现状 `todayDashboard` 内部串行 await,改并行)
3. 习惯列表/统计页数据变化时用 `onSaved` 回调即时刷新,避免整页 `load()` 全量重拉(现状删除/恢复后全量重拉)
**文件**:`local/db.ts`(缓存层)、`local/stats.ts`(并行化)、`pages/*.tsx`(增量刷新)
**工作量**:2.5h · **风险**:中(缓存一致性) · **优先级**:P1

---

## 三、交互细节

### I1. 自定义确认弹窗(替代原生 confirm)
**现状**:删除习惯/清空数据用 `window.confirm`,样式割裂、移动端体验差。
**方案**:新增 `components/ConfirmDialog.tsx`(基于现有 Modal,danger 主题,「取消/确认删除」按钮,支持 `title/description/confirmLabel`),替换 Habits 删除、Settings 清空、RecordDialog 删除 3 处 confirm。
**文件**:新增 `components/ConfirmDialog.tsx`、改 `pages/Habits.tsx`、`pages/Settings.tsx`、`components/RecordDialog.tsx`
**工作量**:1.5h · **风险**:低 · **优先级**:P0

### I2. 骨架屏加载态
**现状**:`PageLoading` 是居中 spinner,内容区空白闪烁。
**方案**:Dashboard/Statistics/HabitDetail 用**骨架屏**(灰块模拟卡片结构 + `animate-pulse`),数据到达后淡入内容。新增 `components/Skeleton.tsx`(卡片/列表/图表三种变体)。
**文件**:新增 `components/Skeleton.tsx`、改 `pages/Dashboard.tsx`、`pages/Statistics.tsx`、`pages/HabitDetail.tsx`
**工作量**:1.5h · **风险**:低 · **优先级**:P2

### I3. 动效与反馈统一
**现状**:`transition-all duration-150 ease-soft` 已统一按钮;但 Modal 无进入动画、卡片无 hover 反馈、toast 无滑入。
**方案**:
1. Modal 加 `animate-zoom-in`(scale 0.96→1 + opacity,180ms)——CSS keyframes 新增
2. 卡片加 `hover:shadow-md hover:-translate-y-px transition`(桌面端)
3. toast 从底部滑入(`translate-y-2→0`)
4. 打卡成功时条目做**微动效**(✓ 图标 scale 弹跳,250ms)
**文件**:`index.css`(keyframes)、`components/Modal.tsx`、`components/Layout.tsx`(toast)、`pages/Dashboard.tsx`
**工作量**:1.5h · **风险**:低 · **优先级**:P1

### I4. 空状态升级
**现状**:空状态是纯文字(`还没有习惯。创建你想坚持的事情…`)。
**方案**:统一为 `EmptyState` 组件(图标 + 标题 + 说明 + 主操作按钮):
- 首页无习惯:「🌱 创建第一个习惯」(已有 Link,升级为按钮样式)
- 统计页无数据:「📊 完成记录后这里会生长出你的坚持曲线」
- 日志页无记录:「📝 今天写一句,未来会感谢现在」
- 日历页未来日:「🔒 未来还没有记录」
**文件**:`components/ui.tsx`(EmptyState 增强)、`pages/*.tsx`(替换 6 处)
**工作量**:1h · **风险**:低 · **优先级**:P1

### I5. 错误提示一致性
**现状**:`toast(..., "error")` 与 `alert()` 混用(HabitForm 校验用 alert)。
**方案**:全部改 toast;toast error 样式补 icon + 深色背景;`api/client.ts` 的 ApiError 统一映射文案(409→「这一天已记录过」,404→「记录不存在」)。
**文件**:`components/HabitForm.tsx`(alert→toast)、`components/RecordDialog.tsx`、`components/Layout.tsx`(toast error 样式)
**工作量**:1h · **风险**:低 · **优先级**:P1

---

## 四、功能完整

### F1. 习惯列表排序
**现状**:按创建时间固定序。
**方案**:Habits 页排序下拉:默认(创建序)/ 名称 A-Z / 完成率 / 连续天数(需本地算 stats,复用 `computeHabitStats`)。
**文件**:`pages/Habits.tsx`(sort state + useMemo)
**工作量**:1h · **风险**:低 · **优先级**:P1

### F2. 数据导入(与导出对称)
**现状**:设置页可导出 JSON/CSV,但**无导入**,换机即丢。
**方案**:设置页「导入 JSON」按钮 → file input → 解析后写入 IndexedDB(校验 schema:name/id 冲突用「追加模式」,已存在 id 则跳过并提示);导入后刷新统计。
**文件**:`local/api.ts`(importData)、`pages/Settings.tsx`(文件选择)
**工作量**:2h · **风险**:中(数据校验) · **优先级**:P0

### F3. 日历补签快捷入口
**现状**:日历页点过去日期 → 下方记录列表 → 新建记录弹窗(3 步)。
**方案**:日历格子 hover/长按直接弹出**快速记录面板**(该日该习惯的 boolean 一键补,带「补签」徽标);补签记录自动 `is_backfilled=true`(local/api.ts 已支持)。
**文件**:`pages/CalendarPage.tsx`(格子交互增强)
**工作量**:2h · **风险**:中 · **优先级**:P1

### F4. 统计时间范围扩展
**现状**:today/7d/30d/90d 四档。
**方案**:增加「本年 / 全部」两档 + 自定义起止日期(两个 date input);趋势图支持周粒度聚合(90 天以上自动降采样,避免 300+ 点渲染卡顿)。
**文件**:`pages/Statistics.tsx`、`local/stats.ts`(overview range 扩展 + 聚合)
**工作量**:2.5h · **风险**:中(聚合逻辑) · **优先级**:P2

### F5. 数据统计卡片(主页洞察)
**方案**:首页 Hero 下方新增一行**洞察卡**(复用现有 card 体系):今日完成 / 本周完成 / 最长连续 / 累计完成(4 个 stat-number);数据来自 `todayDashboard` + `overview("week")` 一次调用,零额外查询。
**文件**:`pages/Dashboard.tsx`(卡片区)、`local/stats.ts`(已有 overview,直接复用)
**工作量**:1h · **风险**:低 · **优先级**:P2

### F6. 通知中心补齐(本地版)
**现状**:本地版 inbox 无事件源(永远是空数组),通知按钮点开是空面板。
**方案**:本地生成两类通知写入 inbox:
1. 每日小结(每日提醒时间:今日完成 X/Y 个习惯)
2. 连续里程碑(达成 7/30/100 天时写入成就通知,`evaluateAchievements` 已返回 newly_unlocked)
再配合 `Notification` API(APK 内 WebView 已支持)。
**文件**:`local/api.ts`(generateLocalNotifications)、`components/Layout.tsx`(触发时机:页面加载 + 每日轮询)
**工作量**:2h · **风险**:低 · **优先级**:P2

---

## 实施路线(3 个迭代)

| 迭代 | 内容 | 交付后验证 |
|---|---|---|
| **Iter 1(核心体验)** | V1 标题统一、O1 一键打卡、O3 搜索、I1 自定义确认、F2 导入、I5 错误统一 | 浏览器实测打卡 3 秒内完成 |
| **Iter 2(视觉深化)** | V2 图标替换、V3 间距、I3 动效、I4 空状态、O5 响应提速、F1 排序、F3 补签 | 截图对比 + tsc/pytest 回归 |
| **Iter 3(功能扩展)** | V4 字体、O2 快捷键、O4 底部导航、I2 骨架屏、F4 统计扩展、F5 洞察卡、F6 通知 | APK 重打包 + 签名验证 |

每迭代结束跑:tsc --noEmit → vite build → pytest 85 → apksigner 验证;本地化逻辑改动需补 habitLogic/stats 边界用例(现有 Node 直跑方案复用)。

---

## 风险与注意

1. **V2 图标替换**(lucide-react)是全站改动,需逐个页面回归,建议 Iter 2 单独做
2. **O5 缓存层**要保证写操作后失效,否则会出现「改了不刷新」—— 用版本号或显式 invalidate
3. **F2 导入**必须校验数据结构,非法文件不得破坏现有库(全部走事务回滚)
4. 所有改动均不触碰后端(本地版无后端),pytest 85 始终为回归底线

---

# 执行序列(EXECUTION PLAN · 2026-08-29)

> 22 项优化 → 4 阶段 × 15 步。每步含:执行内容 / 前置条件 / 涉及文件 / 预期结果 / 检查点。
> 前置条件标注了**同文件合并策略**(避免反复编辑与冲突)与**组件依赖**。

## 阶段 0 · 基线(开工前一次性执行)

| 项 | 内容 |
|---|---|
| B0.1 | 创建 git 分支 `feat/ux-polish`(可回滚) |
| B0.2 | 跑基线验证:tsc --noEmit / vite build / pytest 85 / 边界用例 11 — 记录基线 |
| B0.3 | 浏览器快照 10 个页面(备对比) |

**检查点**:基线全绿,快照留存。**前置**:无(项目已可运行)。

## 阶段 1 · 核心体验(Iter 1:6 步)

| 步骤 | 执行内容 | 前置条件 | 涉及文件 | 预期结果 | 检查点 |
|---|---|---|---|---|---|
| **S1.1** | **V1 标题层级统一**:`page-title` 统一为 text-xl+tracking-tight,`section-title` text-[13px];9 个页面标题改类 | B0 完成 | `index.css`、`pages/*.tsx`(9 处) | 全部页面标题字号一致 | grep 无 `text-lg font-semibold` 残留;vite build 过 |
| **S1.2** | **I5 错误提示统一**:Layout toast 加 error icon+深底;HabitForm/RecordDialog 的 `alert()`→`toast`;ApiError 文案映射(409/404) | S1.1(样式基准) | `components/Layout.tsx`、`HabitForm.tsx`、`RecordDialog.tsx`、`api/client.ts` | 全站无 alert;错误统一 toast | grep 无 `alert(` 残留;触发 409 看 toast |
| **S1.3** | **I1 自定义确认框**:新增 `ConfirmDialog.tsx`(基于 Modal,danger 主题);替换 Habits 删除 / RecordDialog 删除 / Settings 清空 3 处 confirm | S1.2(toast 可用) | 新增 `ConfirmDialog.tsx`、`Habits.tsx`、`RecordDialog.tsx`、`Settings.tsx` | 3 处原生 confirm 全部替换 | grep 无 `confirm(` 残留;浏览器删习惯弹自定义框 |
| **S1.4** | **O3 习惯搜索**:Habits 顶部搜索框(名称/描述/图标模糊)+ 分类下拉;`useMemo` 过滤 | S1.3(同文件 Habits 合并编辑) | `pages/Habits.tsx` | 输入即过滤、分类可筛 | 浏览器输入关键词列表即时收缩 |
| **S1.5** | **O1 一键打卡**:Dashboard boolean 习惯内联「✓」打卡;数值/时长/评分快速输入框(回车提交);仅 text/time/select 走弹窗 | S1.2(toast 反馈);S1.4(不同文件可并行,但按序) | `pages/Dashboard.tsx` | boolean 打卡 1 步完成,3 秒内可打完所有日常习惯 | 浏览器点击 ✓ → 条目态即时刷新 + IDB 有记录;数值输 2000 自动判完成 |
| **S1.6** | **F2 数据导入**:`local/api.ts` 加 `importData`(schema 校验、id 冲突追加、事务回滚);Settings 加「导入 JSON」file input | S1.3(确认框)、S1.2(toast) | `local/api.ts`、`pages/Settings.tsx` | 导入后列表/统计刷新;非法文件被拒且不破坏数据 | 导出→清空→导入→数据恢复往返;坏 JSON 导入提示错误 |

**阶段 1 检查点**:tsc --noEmit 0 错误 → vite build 成功 → 浏览器全流程(打卡/搜索/删除确认/导入导出)→ 截图对比基线。

## 阶段 2 · 视觉深化(Iter 2:6 步)

| 步骤 | 执行内容 | 前置条件 | 涉及文件 | 预期结果 | 检查点 |
|---|---|---|---|---|---|
| **S2.1** | **V2 图标替换**:安装 lucide-react;新增 `Icon.tsx` 封装;Layout 导航 6 项 + 全站 emoji 按钮替换 | 阶段 1 完成(避免功能/样式混同) | `package.json`、新增 `components/Icon.tsx`、`Layout.tsx`、`pages/*.tsx` | 导航/操作按钮无 emoji | 截图;grep 导航区无 emoji 残留;vite build 过 |
| **S2.2** | **V3 间距统一**:`.card-pad` 全局 p-5/p-4;清理页面局部 padding 覆盖;Hero 卡片 p-6 | S2.1(图标替换后视觉再统一) | `index.css`、`pages/*.tsx` | 页面间距节奏一致、呼吸感增强 | 截图对比(桌面+窄屏);grep 无散落 p-4/p-5 覆盖 |
| **S2.3** | **I3 动效打磨**:index.css 新增 keyframes(zoom-in/check-pop/toast-in);Modal 进入动画;toast 滑入;打卡 ✓ 弹跳 | S2.2 | `index.css`、`Modal.tsx`、`Layout.tsx`(toast)、`Dashboard.tsx` | 弹窗/反馈有统一动效 | 浏览器观察 Modal/toast/打卡动效正常,无卡顿 |
| **S2.4** | **I4 空状态升级**:`ui.tsx` 增强 EmptyState(icon+title+desc+CTA);替换 6 处纯文字空态 | S2.3 | `components/ui.tsx`、`Dashboard.tsx`、`Habits.tsx`、`Statistics.tsx`、`Journal.tsx`、`CalendarPage.tsx` | 空态带操作引导 | 清空数据看各页空态;CTA 可点击 |
| **S2.5** | **O5 响应提速**:`local/db.ts` 加内存缓存层(Map,写后失效);`local/stats.ts` 并行化(Promise.all);页面增量刷新(onSaved 局部更新) | S2.4(空态在缓存后仍正常) | `local/db.ts`、`local/stats.ts`、`pages/*.tsx` | 切页/刷新更快 | console.time 对比;改数据后立即刷新(缓存一致性) |
| **S2.6** | **F1 排序** + **F3 日历补签**:Habits 排序下拉(名称/完成率/连续天数);CalendarPage 格子快捷补录(boolean 一键补,自动 is_backfilled) | S2.5;F1 依赖 S1.4(O3 同页) | `pages/Habits.tsx`、`pages/CalendarPage.tsx` | 列表可排序;日历格子可快速补签 | 排序切换正确;格子补签后 IDB is_backfilled=true |

**阶段 2 检查点**:tsc → vite build → 截图对比 → 缓存一致性验证(编辑习惯后回列表立即反映)→ 无回归。

## 阶段 3 · 功能扩展(Iter 3:6 步)

| 步骤 | 执行内容 | 前置条件 | 涉及文件 | 预期结果 | 检查点 |
|---|---|---|---|---|---|
| **S3.1** | **V4 字体规范**:统计/日志/详情页数字补 `.num`;标题字重 font-bold | 阶段 2 完成 | `Statistics.tsx`、`Journal.tsx`、`HabitDetail.tsx` | 数字 tabular-nums 统一 | 统计页 Y 轴/数值对齐 |
| **S3.2** | **O2 快捷键** + **O4 底部 Tab**(合并 Layout 改动):keydown 监听(g+h/n、c、s、j、?、Esc)+ 新增 `ShortcutHint.tsx`;移动端底部固定 Tab Bar | S3.1(同轮 Layout) | `Layout.tsx`、新增 `ShortcutHint.tsx`、`index.css` | 快捷键可用;移动端 Tab 常驻 | 按 g+n 开新建表单;375 视口看底部 Tab(如可模拟) |
| **S3.3** | **I2 骨架屏**:新增 `Skeleton.tsx`(卡片/列表/图表 3 变体);Dashboard/Statistics/HabitDetail 加载态 | S3.2 | 新增 `Skeleton.tsx`、`Dashboard.tsx`、`Statistics.tsx`、`HabitDetail.tsx` | 加载期无白屏闪烁 | 降速观察骨架屏出现;内容淡入 |
| **S3.4** | **F5 首页洞察卡**:Hero 下方 4 卡(今日/本周/最长连续/累计),数据复用 todayDashboard+overview | S3.3(同文件 Dashboard 顺序) | `pages/Dashboard.tsx` | 一屏可见 4 项核心数字 | 数据与统计页一致(抽样核对) |
| **S3.5** | **F4 统计扩展**:stats.ts range 加 本年/全部/自定义;90d+ 自动周聚合降采样 | S3.4 | `local/stats.ts`、`Statistics.tsx` | 4 档→6 档+自定义;长周期不卡 | 边界用例(Node 直跑)扩展:聚合结果与逐日一致 |
| **S3.6** | **F6 本地通知**:`local/api.ts` 加 generateLocalNotifications(每日小结+成就里程碑写入 inbox);Layout 页面加载+每日轮询触发 | S3.5 | `local/api.ts`、`Layout.tsx` | 通知面板有内容;成就解锁有通知 | 手动触发查看 inbox;`evaluateAchievements` 返回的 new 项入库 |

**阶段 3 检查点**:tsc → vite build → 边界用例全量(含新增)→ 浏览器全流程回归 → 截图。

## 阶段 4 · 回归与交付

| 步骤 | 执行内容 | 前置条件 | 涉及文件 | 预期结果 | 检查点 |
|---|---|---|---|---|---|
| **S4.1** | 全量回归:tsc / vite build / pytest 85 / 边界用例 / ruff | 阶段 3 完成 | — | 全部通过 | 与基线一致 |
| **S4.2** | 重打包 Release APK:清 assets/public → 同步 dist → assembleRelease | S4.1 | `android/` | BUILD SUCCESSFUL | 产物存在 |
| **S4.3** | 签名与包验证:apksigner verify(V2 证书指纹不变)+ aapt dump(包名/minSdk/标签)+ APK 内 bundle 单一且含全部新功能 | S4.2 | — | 签名有效、包信息正确 | 指纹与上版一致;SHA-256 记录 |
| **S4.4** | 交付:`HabitFlow-release-v2.apk` 复制到工作区根目录 + HANDOVER 更新 | S4.3 | `HANDOVER.md` | 交付物就绪 | present_files 展示 |

**终态检查点**:APK 可分发安装;HANDOVER 记录版本差异;内存/工作日志更新。

## 依赖速查(防顺序混乱)

```
B0(基线) → 阶段1(S1.1→S1.2→S1.3→S1.4→S1.5→S1.6)
  → 阶段2(S2.1→S2.2→S2.3→S2.4→S2.5→S2.6)
  → 阶段3(S3.1→S3.2→S3.3→S3.4→S3.5→S3.6)
  → 阶段4(S4.1→S4.2→S4.3→S4.4)
```

- **同文件合并**:Habits(S1.3→S1.4→S2.6)、Dashboard(S1.5→S2.4→S3.4)、Layout(S1.2→S2.3→S3.2)、Settings(S1.3→S1.6) —— 严格按步序,避免反复编辑
- **组件依赖**:I1 依赖 Modal(已有);I5 依赖 toast 体系(已有);I2 依赖页面结构;O5 缓存需显式 invalidate
- **可并行项**(同一文件不并行):S1.5 与 S1.4 文件不同可并行,但建议按序保持可审计
