# 前端（Next.js + Tailwind）

## 本地运行

```bash
cd frontend
npm install
npm run dev
# 浏览 http://localhost:3000
```

环境变量：

- `NEXT_PUBLIC_API_BASE`：后端 API 根地址（默认 `http://localhost:8000/api/v1`）

页面清单：

- `/` 首页/概览
- `/resources` 公共资源目录（未登录仅看标题/摘要）
- `/login` 登录页
- `/dashboard` 教师工作台
- `/dashboard/resources` 我的资源列表
- `/dashboard/resources/new` 新建资源
- `/dashboard/resources/[id]` 资源详情/上传/发布/下载
- `/admin` 管理后台用户列表（仅管理员 token 有效）
