# 课程思政资源平台

面向信息安全技术应用专业群的课程思政资源管理与展示平台（FastAPI + Next.js），一键 Docker Compose 即可运行。

## 功能概览
- 登录鉴权：管理员 / 教师，受保护页鉴权，token 过期自动提示。
- 资源管理：发布/下架、外链或上传资源、签名下载、下载日志、标签/课程/专业群关联。
- 教师工作台：草稿编辑、上传校验（类型白名单、大小限制）、发布申请。
- 管理后台：用户管理（仅管理员可访问）。
- 示例数据：默认创建专业群、专业、课程、标签，自动注入 6 条示例资源（封面位于 `frontend/public/sample-covers/`，资源路径 `frontend/public/sample-files/`）。

## 快速启动（Docker）
```bash
# 准备环境变量
cp backend/.env.example backend/.env
# 按需修改 JWT_SECRET / SIGNED_URL_SECRET / DATABASE_URL

# 启动
docker compose up --build
# 前端 http://localhost:3000
# 后端 http://localhost:8000 (Swagger: /docs)
```
默认账号：`admin` / `Admin#123456`
数据持久化：`data/db`（数据库）、`data/uploads`（本地上传文件）、`data/previews`（办公文档转 PDF 缓存）、`data/logs`（按天滚动日志）。

## 核心配置（backend/.env）
必填：
```
DATABASE_URL=postgresql+psycopg2://postgres:postgres@db:5432/ideology
JWT_SECRET=请替换为随机长字符串
SIGNED_URL_SECRET=请替换为随机长字符串
ALLOW_ORIGINS=http://localhost:3000
```
上传与签名：
```
UPLOAD_DIR=/data/uploads
MAX_UPLOAD_MB=200
ALLOWED_FILE_EXT=pdf,pptx,docx,xlsx,mp4,png,jpg,zip
SIGNED_URL_EXPIRES_SECONDS=60
```
预览：
```
PREVIEW_DIR=/data/previews        # 办公文档转 PDF 的缓存目录
# 日志（按天滚动，保留 LOG_RETENTION_DAYS 天）
LOG_DIR=/data/logs
LOG_LEVEL=INFO
LOG_RETENTION_DAYS=14
SEED_SAMPLE_DATA=true          # 是否在初始化时注入示例资源（默认 true，设置为 false 则仅创建基础元数据）
```

### 可选：阿里云 OSS 存储
默认使用本地存储（`UPLOAD_DIR`）；如需切换 OSS：
```
STORAGE_BACKEND=oss
OSS_ENDPOINT=https://<your-endpoint>.aliyuncs.com
OSS_BUCKET=<your-bucket>
OSS_ACCESS_KEY=<AK>
OSS_SECRET=<SK>
# 可选自定义访问域名（含 CDN 域名）
OSS_BASE_URL=https://your-cdn-domain
```
启用后：
- 上传直接写入 OSS，`file_id` 为 OSS 对象 key。
- 下载接口返回临时签名 URL（绑定用户且带过期时间）。
- 本地签名下载接口 `/api/v1/files/signed/...` 自动关闭。

## 目录结构（摘录）
- `backend/`：FastAPI 服务、模型与路由、存储/鉴权逻辑。
- `frontend/`：Next.js 前端，含资源列表/详情、登录、教师工作台等页面。
- `docs-private/resource-design.md`：资源类型与展示方案文档。
- `data/`：运行时数据卷（已在 .gitignore 中忽略）。

## 开发与测试
- 前端 API 基址：`NEXT_PUBLIC_API_BASE`（默认 `http://localhost:8000/api/v1`）。
- 推荐在 `test/` 下编写自动化脚本，避免污染项目目录。
- 登录鉴权、上传白名单、签名下载等安全逻辑已启用，生产环境请务必替换密钥并限制 CORS 域名。
