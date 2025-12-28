"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";

export default function DashboardHome() {
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/auth/me")
      .then((data) => setUser(data))
      .catch((e) => setError(e.message || "请先登录"));
  }, []);

  if (error) {
    return (
      <div className="rounded border bg-white p-6">
        <p className="text-sm text-slate-700">需要登录后访问。</p>
        <Link href="/login" className="text-brand">
          去登录
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">教师工作台</h1>
          {user && <p className="text-sm text-slate-600">欢迎，{user.name}（{user.role}）</p>}
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
          <h3 className="text-sm text-slate-500">快速入口</h3>
          <ul className="mt-2 space-y-2 text-sm">
            <li>
              <Link href="/resources">公共资源目录</Link>
            </li>
            <li>
              <Link href="/dashboard/resources">我的资源</Link>
            </li>
            <li>
              <Link href="/admin">管理后台（管理员）</Link>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
