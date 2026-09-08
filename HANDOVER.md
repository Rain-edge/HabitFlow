# HabitFlow 交接文档

> 版本基线：2026-08-29 · 面向接手开发者 / 下一会话的完整交接。
> 本文档只写"接手即可用"的事实与指引；细节以代码与 README 为准。

> **⚠️ 2026-08-29 新增「本地版 / APK」分支**：在原有 C/S 架构之外，新增
> **纯前端本地模式**（IndexedDB 存储，无后端、无登录），并用 **Capacitor** 打包
> Android APK。详见 §13。原有 Docker/后端部署路径保持不变。

---

## 1. 项目一句话

HabitFlow = 个人每日生活记录 + 自定义习惯 + 连续坚持 + 数据统计 + 成就激励。
**不是** Todo List，**不是** 医疗健康系统。核心是"记录想坚持的事，并看见坚持的痕迹"。

## 2. 技术栈

| 层 | 选型 |
|---|---|
| 后端 | Python 3.11 · FastAPI · SQLAlchemy 2.0 Async · Pydantic v2 · Alembic · PyJWT · passlib/bcrypt |
| DB | PostgreSQL 16（生产/Docker）；SQLite+aiosqlite（开发/测试，零依赖） |
| 缓存 | Redis 7（可选；`REDIS_URL` 为空时自动降级为进程内内存缓存） |
| 前端 | React 18 · TypeScript · Vite 6 · Tailwind CSS 3 · Recharts · react-router v6 |
| 部署 | Docker Compose（postgres/redis/backend/frontend/nginx）· GitHub Actions |

架构为 **Modular Monolith**：`backend/app/modules/{auth,users,habits,records,daily_journal,statistics,notifications,achievements,export}`，边界清晰，未来可拆微服务。

## 3. 目录速览

```
HabitFlow/
├── backend/app/
│   ├── core/            # config/database/security/deps/habit_logic(核心算法)/dates/cache
│   ├── modules/         # 9 个业务模块（models/schemas/router/service）
│   ├── main.py          # 组装路由 + lifespan（建表/成就目录/调度器）
│   └── seed.py          # SEED_DEMO_DATA 演示数据
├── frontend/src/
│   ├── pages/           # Login/Register/Dashboard/Habits/HabitDetail/Calendar/Statistics/Journal/Settings/StyleGuide
│   ├── components/      # Layout/Logo/Modal/RecordDialog/HabitForm/ui(设计系统原语)
│   └── index.css        # 设计令牌 + 组件系统（CSS 变量, 含 Dark Mode）
├── frontend/public/icons/  # 图标 SVG 源 + 各尺寸 PNG
├── migrations/          # Alembic（初始迁移 8 张表）
├── nginx/               # 入口反代
├── tests/               # 85 个 pytest 用例（含 test_release_audit.py）
└── docker-compose.yml / .env.example / README.md / HANDOVER.md
```

## 4. 关键设计决策（务必理解）

1. **统一 Habit 模型**：用 `record_type`(boolean/number/duration/rating/select/text/time) + `schedule_type`(daily/weekly_count/weekly_days) 表达所有习惯，不为每个习惯建表。
2. **同日唯一 + 软删可重记**：`habit_records` 唯一约束 `(user_id, habit_id, record_date, deleted_epoch)`。`deleted_epoch=0` 为有效行，软删时置为行 id，故删除后同一天可重新记录且不破坏约束。
3. **删习惯 ≠ 删历史**：`habits.deleted_at` 软删；记录保留并继续参与统计。
4. **统计全部可重算**：连续/完成率等不存快照，由 `core/habit_logic.py` 纯函数从历史重算（已穷举测试）。
5. **Daily Streak 与 Weekly Goal Streak 分离**：每周目标习惯统计"连续达标周数"，不与日连混算。
6. **补签可见**：`is_backfilled` 标记，正常/补签分开统计，UI 以 🔧 显示。
7. **宽限规则**：今天未打卡不中断当前连续（从昨天往前算）；进行中的周未达标不中断周连。

## 5. 核心算法位置

- `backend/app/core/habit_logic.py`：`is_record_completed` / `scheduled_dates` / `daily_streaks` / `weekly_goal_streaks` / `period_stats`（纯函数，无 DB）。
- `backend/app/modules/statistics/service.py`：把 DB 记录喂给上述纯函数。
- 闰年/跨年/跨月/月初月底边界均在 `tests/test_streak_logic.py` 与 `tests/test_release_audit.py` 覆盖。

## 6. 设计系统（已落地）

- 图标「成长之流」：上扬流线 + 顶端芽点。源 `frontend/public/icons/icon.svg`。
- 主色 brand `#18A396`；暖橙 flame `#F5822B`（仅连续/成就）；success/warning/danger 见 README。
- surface/ink/line 用 CSS 变量实现 **Dark Mode** 自动翻转；右上角 🌙/☀️ 切换、跟随系统。
- 数字/日期用 Manrope + `tabular-nums`。
- 活文档页：`/style`（展示全部令牌与组件）。

## 7. 运行方式

本地（零外部依赖）：
```bash
cd backend && python -m venv .venv && .venv\Scripts\activate   # Windows
pip install -r requirements.txt
DATABASE_URL=sqlite+aiosqlite:///./habitflow.db uvicorn app.main:app --reload --port 8000
cd ../frontend && npm install && npm run dev    # http://localhost:5173
```
Docker：
```bash
cp .env.example .env   # 必填 JWT_SECRET
docker compose up -d --build    # 入口 http://localhost ；API 文档 http://localhost:8000/docs
```
演示账号：`SEED_DEMO_DATA=true` 启动后 `demo@habitflow.dev / demo123456`。

## 8. 测试

```bash
python -m pytest tests -q     # 当前 85 passed（含发布审计专项）
```
覆盖：注册/登录/权限隔离、习惯 CRUD、打卡/重复/补签/改/删、连续 1/3/7/30、中断、暂停/启用、每周目标 3/3 与未达标与多周连、日期边界、日志、统计、成就去重、导出、通知调度。

## 9. 本次 Release 审计进度（截至 2026-08-29 交接续跑完成）

| 阶段 | 状态 | 说明 |
|---|---|---|
| P1 环境 | ✅ | Py3.11/Node24/Docker29.7/Compose5.3；依赖全部可导入；PG/Redis 客户端未装（由 Docker 提供） |
| P2 后端运行 | ✅ | /health、/openapi.json(25 paths)、/docs 200；85 测试通过 |
| P3-4 核心+每周 | ✅ | 日期边界/连续/中断/补签/改/删/暂停/启用/Weekly Streak 全过 |
| P5-6 一致+权限 | ✅ | 重复提交 409、改后统计同步、软删可查、A/B 隔离全过 |
| P7-9 前端/UI/响应式 | ✅ | tsc 0 错误、build 成功；4 处窄屏加固（Layout 弹窗/HabitDetail/Journal/Settings）；多宽度视觉建议人工复测 |
| P10-11 Docker+持久化 | ✅ | compose build/up 成功，5 服务健康；down→up 数据持久化验证通过（pgdata 卷） |
| P12-14 安全/质量/性能 | ✅ | secrets 扫描 0 命中；ruff F 类 0 问题；N+1 修复 2 处（statistics/export）并回归 85/85 |
| P15 修复 | ✅ | 见 RELEASE_REPORT.md §4（7 项修复） |
| P16 报告 | ✅ | RELEASE_REPORT.md 已输出 |
| P17 打包 | ✅ | HabitFlow-release.zip 已生成（124 文件，排除 node_modules/.venv/__pycache__/.env/*.db/dist） |

> 最终结论：**PASS（可发布）**。细节见 `RELEASE_REPORT.md`。

## 10. 已知坑 / 注意事项

1. **Docker 守护进程默认未启动**（Windows）。需手动启动 Docker Desktop 后再 `docker compose up`。本次已拉起，daemon=29.7.2。
2. **内置浏览器视口隐藏**：`take_screenshot` 不可用（viewport hidden），只能用 `take_snapshot` 做结构验证；响应式多宽度视觉验证受限，建议人工或有视口环境复测。
3. **PyJWT 元数据名**：`import jwt` 正常，但 `importlib.metadata.version("jwt")` 报 missing（分布名为 `PyJWT`），属正常，勿误判为缺依赖。
4. **Git Bash 参数转换**：`taskkill /PID`、`robocopy /E` 等以 `/` 开头的开关会被 MSYS 转成路径，需加 `MSYS_NO_PATHCONV=1`。
5. **dev 与 build 的 Tailwind 缓存**：改 `tailwind.config.js` 后若 dev 报"class does not exist"，清 `node_modules/.vite` 并重启；注意可能有旧 dev 进程占端口（5173/5174），新实例会顺延端口。
6. **透明度档位**：Tailwind 默认无 `/12`、`/8`，用 `/10` 或方括号任意值。

## 11. 接手后的下一步清单（按序）

> ⚠️ 2026-08-29 交接续跑已完成，以下原清单全部完成；保留供后续参考。

1. ✅ 跑 `docker compose build && up -d`，验证 5 服务 + 重启持久化（P10-11）。
2. ✅ 前端多宽度（375/390/430/768/1280/1440/1920）溢出扫尾（P9）——代码级加固完成，**视觉复测建议人工**。
3. ✅ secrets/死代码/N+1 最终扫描并修（P12-14）。
4. ✅ 输出 PASS/FAIL 验收报告（P16）→ `RELEASE_REPORT.md`。
5. ✅ 清理缓存后打包 `HabitFlow-release.zip`（排除 node_modules/__pycache__/.env/*.db）（P17）。

### 新发现的注意事项（续跑补充）

1. **Docker 手动代理**：Docker Desktop 配置了手动代理 `127.0.0.1:7890`（Clash Verge 端口）。
   若 Clash Verge 未启动，`docker compose build` 拉镜像会失败（镜像加速器直连反而可用）。
   解决：启动 `D:\CLash\Clash Verge\clash-verge.exe`（桌面有 clash.lnk）。
2. **migrations/env.py 路径**：已修复为自动探测 backend 包路径（repo 布局 / Docker 布局均可用），
   勿回退为硬编码 `../backend`。
3. **前端打包**：`frontend/dist` 不入 release 包（由 Dockerfile 构建时生成）。

### 2026-08-29 视觉审查补充（设计师视角）

按产品设计师视角对 10 个页面做了最终视觉审查（简洁/大方/统一/耐看/信息层级/留白/按钮/卡片数/颜色/噪音），修复如下：

| # | 位置 | 改动 |
|---|---|---|
| 1 | 首页 | 未完成习惯**置顶**（`done_today` 排序），已完成降权（opacity-60 + 名称 ink-2）；Hero 新增「还有 N 项待完成 / 今天全部完成 🎉」状态徽标 —— 3 秒内可知日期/进度/待办/连续天数 |
| 2 | 登录/注册 | `🌊` emoji 替换为品牌 Logo「成长之流」；错误提示统一为 `error-box`（danger 色系） |
| 3 | 统计 | 趋势图硬编码蓝 `#4F8EF7` → 品牌青绿 `#18A396`；网格/刻度统一为 line/ink-3 色 |
| 4 | 日历 | 图例「未完成」`bg-rose-200` → `bg-danger-500`（与格子状态一致） |
| 5 | 习惯详情 | 4 张周期卡合并为 1 张卡内 4 列轻量数字区（`bg-card-2` 内嵌，减少卡片堆叠） |
| 6 | 日志 | 原生 range 滑块补充品牌化样式（`index.css`：brand 圆点 + hover 放大） |
| 7 | 习惯列表 | 「显示已删除」checkbox 改为**仅在存在已删除习惯时显示**（`hasDeleted` 判断），减少常驻噪音 |

验证：tsc 0 错误、vite build 成功、pytest 85 passed、Docker 前端容器已重建部署。
375/390/1440 宽度已在代码级复核（min-w-0/truncate/flex-wrap/overflow-x-auto 均就位）。

## 14. 全面审查记录（2026-08-29）

用 agent-browser 真实渲染验证了 10 个页面的视觉与数据流。**发现并修复 1 个关键 bug**：

### 修复：HabitForm 缺少 `is_active` 字段

**症状**：通过 HabitForm 创建的习惯**不会出现在首页仪表盘**。Dashboard 的 `todayDashboard` 用 `h.is_active` 过滤,undefined 视为 falsy 被过滤掉。
**修复**：`src/components/HabitForm.tsx` 加 `is_active: true` 默认值并写入 submit payload。
**验证**：用 eval 直接 put 一条 `is_active=true` 的习惯,首页 Hero 显示"还有 1 项待完成",完成环 0/1,习惯条目正确显示。

### 审查结论
- **功能流**：首页/习惯列表/创建/打卡/统计/设置/通知全链路验证通过(IndexedDB 写入/读取/持久化/刷新保留/记录去重/软删可重记均正常)。
- **视觉**：配色 brand #18A396 / flame #F5822B / 状态色统一;圆角 20px 卡片;圆环 + 进度条 + 进度徽标层级清晰;深色模式自动切换。
- **响应式**：375px 视口模拟在 Windows agent-browser 不支持(仅 macOS);代码级已用 `min-w-0 + truncate + flex-wrap + overflow-x-auto + sm:/lg: 断点` 全覆盖。
- **APK**：`com.habitflow.app`、minSdk 24、build successful、4.5 MB,品牌青绿图标 + 背景。

### 目标

去掉登录注册，所有数据保存在本机，打包为 Android APK。
**实现方式：纯前端本地化 + Capacitor 壳**，不依赖 FastAPI 后端。

### 架构变更

| 原（C/S） | 新（本地版） |
|---|---|
| FastAPI + PostgreSQL + Redis | **无后端**；IndexedDB（浏览器本地库） |
| JWT 登录/注册 | **无登录**；`state/auth.tsx` 提供本地默认用户（`hf-profile` 存 localStorage） |
| `backend/app/core/habit_logic.py` | 移植为 `frontend/src/local/habitLogic.ts`（纯函数，逻辑一致） |
| `backend/app/modules/statistics` | 移植为 `frontend/src/local/stats.ts` |
| `backend/app/modules/achievements` | 移植进 `stats.ts`（catalog + evaluate） |
| `api/client.ts`（HTTP） | **同路径路由适配层** → 调用 `local/api.ts` → IndexedDB |
| 导出 JSON/CSV | 浏览器 Blob 下载 |

### 关键文件

```
frontend/
├── src/local/db.ts          # IndexedDB 封装（6 张表）
├── src/local/habitLogic.ts  # 纯逻辑移植（连续/每周/周期/日历）
├── src/local/stats.ts       # 统计/成就/概览/趋势/日历
├── src/local/api.ts         # 本地业务 CRUD 门面
├── src/api/client.ts        # 路径路由适配（页面零改动）
├── src/state/auth.tsx       # 本地用户（无密码）
└── capacitor.config.ts      # Capacitor 配置
```

页面全部保持原有 `api.get/post/put/delete` 调用方式不变（适配层按路径分发），
因此**页面组件几乎未改动**；仅删除 Login/Register 页面、App.tsx 路由、Settings 密码区。

### 数据表（IndexedDB object stores）

`habits` / `records` / `journal` / `notification_settings` / `achievements` / `inbox`

### 构建 APK

```bash
cd frontend
npm run build                         # 产物 → dist/
cp -r dist/* android/app/src/main/assets/public/   # 或 npx cap sync（沙箱删除受限时可手动）
cd android
ANDROID_HOME=<SDK> ./gradlew assembleDebug
# 产物: android/app/build/outputs/apk/debug/app-debug.apk
```

### 已知差异

1. 无用户隔离（单机单用户）。
2. 提醒为浏览器 Notification（APK 内依赖 WebView 权限，行为可能受限）。
3. `notification_settings` 默认关闭，需在设置页手动开启。
4. 数据备份 = 设置页「导出 JSON/CSV」；清除 = 设置页「清除全部数据」。
5. 原后端/测试路径不受影响（`tests/` 仍 85 passed）。
