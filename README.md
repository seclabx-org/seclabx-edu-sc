# 课程思政资源平台

面向信息安全技术应用专业群的课程思政资源管理与展示平台，前后端分离（FastAPI + Next.js），开箱即用的 Docker Compose 部署。

## 功能亮点
- 登录与权限：Admin / Teacher
- 元数据：专业群、专业、课程、思政标签
- 资源管理：创建、上传文件或外链、发布/下架、签名下载、下载计数
- 管理端：用户管理、基础资源报表骨架

## 快速开始（本地一键启动）
需要 Docker 与 Docker Compose。默认端口：3000(前端) / 8000(后端) / 5432(DB)。
```bash
cp backend/.env.example backend/.env
docker compose up --build
# 前端：http://localhost:3000
# 后端：http://localhost:8000  (Swagger: /docs)
```
数据持久化：项目根 `data/`（`data/db` 数据库，`data/uploads` 上传文件），拷贝该目录即可备份/迁移。若端口或 API 地址冲突，复制 `docker-compose.override.example.yml` 为 `docker-compose.override.yml`，调整端口或 `NEXT_PUBLIC_API_BASE` 后再 `docker compose up -d`。

默认管理员：`admin` / `Admin#123456`

## 服务器部署（拉取镜像直接运行）
无需本地构建，仅需 Docker 与 Docker Compose：
```bash
# 1) 准备目录与配置
mkdir -p seclabx-edu-sc && cd seclabx-edu-sc
# 创建backend.env（可从仓库复制 backend/.env.example）
# 必填：请改成自己的安全值
JWT_SECRET=CHANGE_ME_TO_A_RANDOM_LONG_SECRET
SIGNED_URL_SECRET=CHANGE_ME_TOO
DATABASE_URL=postgresql+psycopg2://postgres:postgres@db:5432/ideology
# 可选：其它配置参考 backend/.env.example

# 2) 获取部署 compose（可从仓库复制 docker-compose.deploy.yml）

# 3) 拉取镜像，并启动
docker compose -f docker-compose.deploy.yml pull
docker compose -f docker-compose.deploy.yml up -d
# 前端：http://<server-ip>:3000
# 后端：http://<server-ip>:8000
```
数据目录 `data/db`、`data/uploads` 随启动自动生成，无需手工。若端口或 API 地址需调整，修改上述 compose 中的端口映射或 `NEXT_PUBLIC_API_BASE`。

## 配置说明
- 后端环境变量：`backend/.env`（JWT_SECRET、SIGNED_URL_SECRET、DATABASE_URL 等）
- 前端环境变量：`NEXT_PUBLIC_API_BASE`（默认 http://localhost:8000/api/v1，可在 override/deploy 中改为 IP/域名）
- 上传限制：见 `backend/app/core/config.py`（后缀白名单、大小限制）

## 目录结构
- `backend/`：FastAPI 后端（Dockerfile、.env.example、app 源码）
- `frontend/`：Next.js 前端（Dockerfile、src 源码）
- `docker-compose.yml`：默认一键启动
- `docker-compose.override.example.yml`：端口/API 覆写示例
- `docker-compose.deploy.yml`：拉取预构建镜像的部署示例
- `data/`：运行时数据（数据库/上传，已忽略提交）

## 许可证
本项目基于 Apache License 2.0 开源发布，详情见 LICENSE 文件。![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)
