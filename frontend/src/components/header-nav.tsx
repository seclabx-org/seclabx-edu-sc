"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../lib/api";

type UserInfo = {
  name: string;
  role: string;
  username?: string;
};

const roleLabel: Record<string, string> = { admin: "管理员", teacher: "教师" };

export function HeaderNav() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const refreshUser = () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (!token) {
        setUser(null);
        setChecked(true);
        return;
      }
      apiFetch("/auth/me")
        .then((data) => setUser(data))
        .catch(() => {
          localStorage.removeItem("token");
          setUser(null);
        })
        .finally(() => setChecked(true));
    };

    refreshUser();

    const handler = () => refreshUser();
    if (typeof window !== "undefined") {
      window.addEventListener("auth-changed", handler);
      window.addEventListener("storage", handler);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("auth-changed", handler);
        window.removeEventListener("storage", handler);
      }
    };
  }, []);

  const logout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      window.dispatchEvent(new Event("auth-changed"));
    }
    setUser(null);
    router.push("/login");
  };

  if (!checked) {
    return (
      <nav className="flex items-center gap-4 text-sm">
        <Link href="/resources">资源目录</Link>
      </nav>
    );
  }

  return (
    <nav className="flex items-center gap-3 text-sm">
      <Link href="/resources">资源目录</Link>
      {user && <Link href="/dashboard">教师工作台</Link>}
      {user && <Link href="/dashboard/ai">AI工作台</Link>}
      {user?.role === "admin" && <Link href="/admin">管理后台</Link>}
      {user ? (
        <div className="flex items-center gap-2 rounded-md border border-brand/60 px-2 py-1">
          <span className="text-slate-700">
            {(user.name && user.name.trim()) || user.username || "已登录"}（{roleLabel[user.role] || user.role}）
          </span>
          <button
            onClick={logout}
            className="rounded border border-brand px-2 py-[2px] text-xs text-brand hover:bg-brand hover:text-white"
          >
            退出
          </button>
        </div>
      ) : (
        <Link href="/login" className="rounded-md border px-3 py-1 text-brand border-brand">
          登录
        </Link>
      )}
    </nav>
  );
}
