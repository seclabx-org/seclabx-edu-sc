"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { adminApi } from "../../lib/api";
import { useAuthGuard } from "../../lib/useAuthGuard";

const roleLabel: Record<string, string> = { admin: "管理员", teacher: "教师" };

export default function AdminPage() {
  const { user, loading } = useAuthGuard({ requiredRole: "admin" });
  const [users, setUsers] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    adminApi
      .users()
      .then((data) => setUsers(data.items || []))
      .catch((e: any) => setError(e.message || "需要管理员权限"));
  }, [user]);

  if (loading) {
    return (
      <div className="rounded border bg-white p-4 text-sm text-slate-600">
        正在校验登录状态...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded border bg-white p-4 text-sm text-slate-600">
        正在跳转到登录页...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded border bg-white p-4">
        <p className="text-sm text-red-600">{error}</p>
        <Link href="/login" className="text-brand">
          重新登录
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">管理后台 · 用户列表</h1>
      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
            <tr>
              <th className="px-4 py-2">ID</th>
              <th className="px-4 py-2">用户名</th>
              <th className="px-4 py-2">姓名</th>
              <th className="px-4 py-2">角色</th>
              <th className="px-4 py-2">专业ID</th>
              <th className="px-4 py-2">状态</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-4 py-2">{u.id}</td>
                <td className="px-4 py-2">{u.username}</td>
                <td className="px-4 py-2">{u.name}</td>
                <td className="px-4 py-2">{roleLabel[u.role] || u.role}</td>
                <td className="px-4 py-2">{u.major_id ?? "无"}</td>
                <td className="px-4 py-2">{u.is_active ? "启用" : "禁用"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
