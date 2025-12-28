"use client";

import Link from "next/link";
import { useAuthGuard } from "../../lib/useAuthGuard";

export default function DashboardHome() {
  const { user, loading } = useAuthGuard();

  if (loading) {
    return (
      <div className="rounded border bg-white p-6 text-sm text-slate-600">
        正在校验登录状态...
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">教师工作台</h1>
          <p className="text-sm text-slate-600">欢迎，{user.name}（{user.role}）</p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/resources/new" className="rounded-md bg-brand px-4 py-2 text-sm text-white">
            新建资源
          </Link>
          <Link href="/dashboard/resources" className="rounded-md border px-4 py-2 text-sm text-brand border-brand">
            管理资源
          </Link>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h3 className="text-sm text-slate-500">快捷入口</h3>
          <ul className="mt-2 space-y-2 text-sm">
            <li>
              <Link href="/resources">公共资源目录</Link>
            </li>
            <li>
              <Link href="/dashboard/resources">我的资源</Link>
            </li>
            {user.role === "admin" && (
              <li>
                <Link href="/admin">管理后台（管理员）</Link>
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
