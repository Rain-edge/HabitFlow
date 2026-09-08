# HabitFlow

<img src="frontend/public/icons/icon-128.png" alt="HabitFlow 图标" width="72" align="right" />

> 个人每日生活记录 + 自定义习惯 + 连续坚持 + 数据统计 + 成就激励

HabitFlow 不是 Todo List，也不是医疗健康系统。它只做一件事：**让你方便地记录自己想坚持的事情，并看见坚持的痕迹。**

每天记录想坚持的事（喝水、运动、早睡、阅读、心情……），按日期查看历史，自动计算当前连续天数、历史最长连续、完成率，并用轻量成就给你正反馈。

---

## 功能说明

### 核心能力

| 能力 | 说明 |
| --- | --- |
| 自定义习惯 | 名称、图标、颜色、分类、目标值、单位、执行规则，高度自由 |
| 7 种记录类型 | Boolean / Number / Duration / Rating / Select / Text / Time |
| 执行规则 | 每天、每周 N 次、每周指定日（一~日） |
| 连续坚持 | 当前连续天数、历史最长连续；每周目标习惯独立统计「连续达标周数」 |
| 补签系统 | 历史补录、修改、删除；补签记录以 🔧 标记并与正常完成分开统计 |
| 每日日志 | 心情 / 精力 / 整体状态 / 压力（1-10）+ 自由文字 |
| 日历 | 月历视图：✅ 全部完成 / 🟡 部分完成 / ❌ 未完成 / ⚪ 无计划，点击查看当日详情并补录 |
| 统计 | 今日 / 本周 / 本月 / 30 天 / 90 天 / 全部；完成率趋势、最稳定 / 最易中断习惯 |
| 成就 | 连续 3/7/14/30/50/100 天、累计 10/50/100/365 次、圆满一月 / 一季 |
| 提醒 | 每习惯提醒时间 + 每日小结；站内通知 + 浏览器通知 |
| 数据导出 | JSON / CSV 一键导出全部数据 |

### 产品原则

- 首页以「今天」为核心，简单好用
- 同一用户、同一习惯、同一天只有一条有效记录
- 删除习惯 ≠ 删除历史，记录永久保留且继续参与统计
- 所有统计都可以从历史数据重新计算
- 无 AI 噱头、无复杂游戏化，颜色克制，长期使用舒适

### 截图

> 截图位置：`docs/screenshots/`（登录、首页、习惯详情、日历、统计、日志、设置）

---

## 视觉设计与图标

### APP 图标 ·「成长之流 The Growing Flow」

一条从左下向右上扬起的**流线**（每日记录汇成的轨迹），在顶端绽放一颗**小芽**（成长与变成）；起笔的圆点代表「第一天」。它不画水滴 / 跑者 / 日历这些"某个具体习惯"的符号，而是抽象表达**所有习惯随时间积累、向上生长**这件事——更贴切、更耐看。单笔画 + 芽点，16px 仍可识别，去掉文字不影响识别。

- 源文件：`frontend/public/icons/icon.svg`（App 图标）、`favicon.svg`、`glyph.svg`（单色）
- 栅格：`icon-16/32/64/128/192/512.png`、`apple-touch-icon-180.png`、`favicon-16/32/48/64.png`

### Color System（安静 · 清爽 · 有一点积极感）

| 角色 | 值 | 说明 |
| --- | --- | --- |
| 主色 brand | `#18A396`（500） | 沉静青绿，表达生命 / 流动 / 成长 |
| 暖色 flame | `#F5822B` | 仅用于连续 / 成就，制造一点积极感 |
| success | `#2FA36B` | 完成 / 达标 |
| warning | `#E8A400` | 部分完成 / 补签 |
| danger | `#E5484D` | 中断 / 删除 |
| surface / card | `#F7F9F8` / `#FFFFFF` | 背景 / 卡片 |
| ink / ink-2 / ink-3 | `#1C2B28` / `#63726D` / `#9AA6A1` | 主 / 次 / 弱文字 |
| line | `#E3E8E6` | 边框 |

深色模式自动翻转 surface/ink/line（CSS 变量），brand 提亮保证对比。右上角 🌙/☀️ 切换，跟随系统偏好。

### Typography / 组件

- 正文用系统中文黑体；数字与日期用 **Manrope**（`tabular-nums`），连续天数与完成率有视觉重点
- 完整令牌与组件（Button / Input / Card / Badge / Progress / Calendar / Empty / Loading / Error / Shadow / Radius）见**活文档页 `/style`**

---

## 技术栈

| 层 | 技术 |
| --- | --- |
| 后端 | Python 3.11 · FastAPI · SQLAlchemy 2.0 (Async) · Pydantic v2 · Alembic |
| 数据库 | PostgreSQL 16（开发/测试可用 SQLite） |
| 缓存 | Redis 7（可选，缺失时自动降级为内存缓存） |
| 前端 | React 18 · TypeScript · Vite · Tailwind CSS · Recharts |
| 部署 | Docker · Docker Compose · Nginx |
| CI | GitHub Actions（lint + 单元测试 + Docker 构建） |

---

## 系统架构

第一版采用 **Modular Monolith**（模块化单体），后端模块边界清晰，未来可按模块拆分为微服务：

```
auth  users  habits  records  daily_journal  statistics  notifications  achievements  export
```

- `habits`：统一定义模型，用 `record_type + schedule_type` 表达所有习惯，而不是每个习惯一张表
- `records`：`habit_records` 唯一约束保证同用户同习惯同日一条有效记录；软删除使用 `deleted_epoch` 技巧，删除后可重新记录
- `statistics`：纯函数算法层（`app/core/habit_logic.py`），连续打卡 / 每周目标 / 完成率全部可由历史数据重算
- `achievements`：每次打卡后自动评估解锁，去重防重复
- `notifications`：设置 + 站内收件箱 + 分钟级调度器；渠道可插拔（未来可接邮件 / Telegram）

```
浏览器 ──▶ Nginx(:80) ──▶ 前端静态资源
               │
               └──▶ /api ──▶ FastAPI(:8000) ──▶ PostgreSQL
                                      │
                                      └──▶ Redis（缓存）
```

---

## 目录结构

```
HabitFlow/
├── backend/                  # FastAPI 后端（模块化单体）
│   ├── app/
│   │   ├── core/             # 配置、数据库、安全、依赖注入、习惯算法
│   │   ├── modules/          # auth/users/habits/records/daily_journal/
│   │   │                     # statistics/notifications/achievements/export
│   │   ├── main.py
│   │   └── seed.py           # 演示数据
│   ├── requirements.txt
│   ├── Dockerfile
│   └── docker-entrypoint.sh  # 启动前自动执行 alembic upgrade head
├── frontend/                 # React + TS + Vite + Tailwind
│   └── src/{api,components,pages,state,utils}
├── migrations/               # Alembic 迁移
├── nginx/                    # 入口反向代理
├── tests/                    # pytest 测试（75 个用例）
├── .github/workflows/ci.yml
├── docker-compose.yml
├── alembic.ini
├── pytest.ini
├── .env.example
├── .gitignore
├── LICENSE
└── README.md
```

---

## 快速开始

### 方式一：Docker Compose（推荐）

```bash
cp .env.example .env         # 修改 JWT_SECRET 等配置
docker compose up -d --build
```

启动后：

| 地址 | 说明 |
| --- | --- |
| http://localhost | 应用入口（Nginx） |
| http://localhost:8000/docs | Swagger API 文档 |
| http://localhost:5173 | 仅本地开发时的前端直连地址 |

停止：`docker compose down`（数据保留在 `pgdata` 卷中）。

### 方式二：本地开发

后端：

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate   Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt

# SQLite 快速启动（无需 PostgreSQL）
DATABASE_URL=sqlite+aiosqlite:///./habitflow.db uvicorn app.main:app --reload --port 8000

# 或使用 PostgreSQL：先在 .env 配置 DATABASE_URL，再执行迁移
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

前端：

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173，/api 自动代理到 :8000
```

演示数据（可选）：`SEED_DEMO_DATA=true` 启动后使用 `demo@habitflow.dev / demo123456` 登录。

---

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `JWT_SECRET` | 无（必填） | JWT 签名密钥，生产必须更换 |
| `JWT_ALGORITHM` | HS256 | JWT 算法 |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 10080 | Token 有效期（分钟） |
| `DATABASE_URL` | sqlite 开发库 | 如 `postgresql+asyncpg://user:pwd@host:5432/db` |
| `REDIS_URL` | 空 | 如 `redis://redis:6379/0`，留空则用内存缓存 |
| `CORS_ORIGINS` | localhost 若干 | 逗号分隔 |
| `ENABLE_SCHEDULER` | false | 是否启动提醒调度器 |
| `SEED_DEMO_DATA` | false | 是否注入演示数据 |
| `POSTGRES_USER/PASSWORD/DB` | habitflow 等 | Compose 中 PostgreSQL 配置 |

完整清单见 `.env.example`。**`.env` 永远不要提交 Git。**

---

## 数据库迁移

```bash
alembic upgrade head                          # 升级到最新
alembic revision --autogenerate -m "change"   # 生成新迁移（需配置 DATABASE_URL）
alembic downgrade -1                          # 回退一版
```

Docker 启动时后端入口脚本会自动执行 `alembic upgrade head`。

---

## 测试

```bash
# 在仓库根目录（已配置 pytest.ini，使用内置 SQLite，无需外部服务）
python -m pytest tests -q
```

覆盖范围：注册 / 登录 / 习惯 CRUD / 打卡 / 重复打卡拦截 / 补签 / 修改历史 /
连续打卡算法（含闰年、跨年、断签、宽限期）/ 每周目标 / 日志 / 统计 /
成就去重 / 数据导出 / 用户权限隔离 / 通知调度。

---

## API 文档

启动后端后访问 `http://localhost:8000/docs`（Swagger UI）。核心端点：

```
POST /api/auth/register        POST /api/auth/login
GET  /api/users/me             PUT  /api/users/me

GET/POST /api/habits           GET/PUT/DELETE /api/habits/{id}
POST /api/habits/{id}/restore

GET/POST /api/records          PUT/DELETE /api/records/{id}
GET/PUT /api/journal/{date}    DELETE /api/journal/{date}

GET /api/statistics/today      GET /api/statistics/overview?range=30d
GET /api/statistics/trend      GET /api/statistics/calendar?year=&month=
GET /api/statistics/habit/{id}

GET /api/achievements          POST /api/achievements/evaluate
GET/PUT /api/notifications/settings
GET /api/notifications/pending GET /api/notifications/inbox

GET /api/export/json           GET /api/export/csv
```

---

## 安全

- 密码：passlib + bcrypt 哈希，永不明文存储
- 认证：JWT（HS256），密钥来自环境变量
- 所有输入经 Pydantic 校验；资源访问全部校验归属（用户隔离有专项测试）
- CORS 白名单可配置；`.env` 不入 Git（`.gitignore` 已声明）

---

## 未来规划

- 提醒渠道扩展：邮件 / Telegram（调度器已按可插拔设计）
- Kubernetes / Helm 部署清单
- 数据导入（配合现有导出形成完整迁移闭环）
- 多语言、暗色主题

---

## License

[MIT](LICENSE)
