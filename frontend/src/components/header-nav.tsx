"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

type UserInfo = {
  name: string;
  role: string;
};

export function HeaderNav() {
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

  if (!checked) {
    return (
      <nav className="flex items-center gap-4 text-sm">
        <Link href="/resources">资源目录</Link>
      </nav>
    );
  }

  return (
    <nav className="flex items-center gap-4 text-sm">
      <Link href="/resources">资源目录</Link>
      {user && <Link href="/dashboard">教师工作台</Link>}
      {user?.role === "admin" && <Link href="/admin">管理后台</Link>}
      {!user && (
        <Link href="/login" className="rounded-md border px-3 py-1 text-brand border-brand">
          登录
        </Link>
      )}
    </nav>
  );
}
