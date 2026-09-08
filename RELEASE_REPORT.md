# HabitFlow Release 验收报告

> 版本：v1.0.0-rc · 验收日期：2026-08-29 · 验收人：发布审计（交接续跑）
> 基线：`HANDOVER.md` §9 审计进度表 · 本文档为 P1–P17 最终 PASS/FAIL 汇总。

---

## 1. 验收结论

| 项 | 结论 |
|---|---|
| **整体发布就绪度** | ✅ **PASS（可发布）** |
| 代码质量 / 测试 | ✅ 85/85 通过，ruff F 类 0 问题，tsc 0 类型错误 |
| Docker Compose 部署 | ✅ 5 服务全部健康，重启数据持久化验证通过 |
| 待人工复测项 | ⚠️ 多宽度视觉（375–1920）建议有视口环境人工复测（详见 §6） |

---

## 2. 阶段审计明细（P1–P17）

| 阶段 | 内容 | 结果 | 证据 |
|---|---|---|---|
| P1 环境 | Python/Node/Docker/Compose 版本齐备 | ✅ PASS | Py3.11/Node24/Docker29.7.2/Compose5.3.1 |
| P2 后端运行 | /api/health、/openapi.json(25 paths)、/docs | ✅ PASS | 全部 200 |
| P3 核心算法 | 日期边界/连续/中断/补签/改/删 | ✅ PASS | test_streak_logic 等全过 |
| P4 每周目标 | Weekly Streak 达标/未达标/多周连 | ✅ PASS | test_release_audit 全过 |
| P5 一致性 | 重复提交 409、改后统计同步、软删可重记 | ✅ PASS | test_records 全过 |
| P6 权限 | A/B 用户隔离、资源归属校验 | ✅ PASS | test_permissions 全过 |
| P7-9 前端/UI/响应式 | 类型/构建/响应式代码审查+加固 | ✅ PASS* | tsc 0 错误、build 成功、4 处窄屏加固（*多宽度视觉见 §6） |
| P10 Docker 构建 | compose build 5 镜像 | ✅ PASS | backend/frontend/nginx/postgres/redis 构建成功 |
| P11 重启持久化 | down → up 数据不丢 | ✅ PASS | 测试习惯重启后仍在（pgdata 卷） |
| P12 安全扫描 | secrets 泄漏扫描 | ✅ PASS | 0 命中（排除 .venv/node_modules） |
| P13 死代码 | 未使用导入/变量 | ✅ PASS | ruff F401/F841/F811 全过；tsc --noUnusedLocals 0 问题 |
| P14 性能 | N+1 查询 | ✅ PASS | 修复 2 处（statistics/export），回归 85/85 |
| P15 修复 | 本次修复项回测 | ✅ PASS | 见 §4 |
| P16 报告 | 本文档 | ✅ PASS | — |
| P17 打包 | HabitFlow-release.zip | ✅ PASS | 124 文件 0.16MB，含全部修复 |

---

## 3. 测试结果

```text
85 passed in 61.08s
```

覆盖：注册/登录/权限隔离、习惯 CRUD、打卡/重复/补签/改/删、连续 1/3/7/30、
中断、暂停/启用、每周目标、日期边界（闰年/跨年/跨月）、日志、统计、成就去重、
导出、通知调度。

---

## 4. 本次交接续跑修复清单

| # | 位置 | 问题 | 修复 |
|---|---|---|---|
| 1 | `frontend/src/components/Layout.tsx` | 通知弹窗 `w-80` 在 <340px 视口会横向溢出 | 加 `max-w-[calc(100vw-2rem)]` |
| 2 | `frontend/src/pages/HabitDetail.tsx` | 习惯名过长时标题挤压打卡按钮/溢出 | 标题区 `min-w-0` + 名称 `truncate` + 按钮 `shrink-0`；周进度卡 `flex-wrap` |
| 3 | `frontend/src/pages/Journal.tsx` | 日期标题在窄屏挤压右侧控件 | 左侧 `min-w-0` + `truncate` |
| 4 | `frontend/src/pages/Settings.tsx` | 每日小结提醒行窄屏换行错位 | `flex-wrap` + `shrink-0` |
| 5 | `backend/app/modules/statistics/` | `_completed_map` 与 `overview` 逐习惯查询（N+1） | 新增 `completed_dates_map` 批量查询，一次取全部 |
| 6 | `backend/app/modules/export/router.py` | `_dump` 循环内 `get_habit_stats`（N+1，且与已加载 records 冗余） | 改用批量 map + 复用已加载 records 计算 normal/backfilled |
| 7 | `migrations/env.py` | Docker 内 alembic 找不到 `app` 模块（路径硬编码 `../backend`，容器内无此目录） | 按布局自动探测 backend 包路径（repo 布局 / 容器布局） |

修复均通过回归：**全量 85 测试通过**，前端 `tsc --noEmit` + `vite build` 成功。

---

## 5. Docker 部署验证记录

```text
# docker compose ps（down→up 后）
habitflow-backend-1    Up (healthy via /api/health)
habitflow-frontend-1   Up
habitflow-nginx-1      Up
habitflow-postgres-1   Up (healthy)
habitflow-redis-1      Up (healthy)

# 端点
GET /api/health        → {"status":"ok","app":"HabitFlow"}   200
GET /openapi.json      → 25 paths                           200
GET /docs              → Swagger UI                         200
GET /                  → Nginx → 前端                       200
GET /api/health (nginx代理)                                 200

# 持久化
POST /api/auth/register → 注册 persist@test.dev
POST /api/habits       → 创建「持久化测试习惯」(id=1)
docker compose down && up -d
GET /api/habits        → 习惯仍在 ✓（pgdata 卷）
```

> 环境备注：Docker Desktop 配置了手动代理 `127.0.0.1:7890`（Clash Verge 端口），
> 构建前已通过启动 Clash Verge 恢复代理连通；镜像加速器直连亦可用。

---

## 6. 遗留项 / 建议

| 项 | 说明 | 建议 |
|---|---|---|
| 多宽度视觉复测 | 内置浏览器视口隐藏，无法截图多宽度渲染 | 有视口环境时按 375/390/430/768/1280/1440/1920 过一遍主要页面 |
| 前端 chunk 体积 | index js 630KB > 500KB 警告 | 可选：路由级 `React.lazy` 拆包 |
| 生产密钥 | compose 中 `habitflow_password` 为本地占位 | 生产部署必须改环境变量 |
| 清理 | 验收期间创建的 `.env`、`backend/audit.db` 不入库 | 打包已排除；本地可删 |

---

## 7. 交付物

- 源码仓库：`HabitFlow/`（含 README / HANDOVER / RELEASE_REPORT）
- 发布包：`HabitFlow-release.zip`（排除 node_modules/.venv/__pycache__/.env/*.db/dist）
- 测试：`python -m pytest tests -q` → 85 passed
