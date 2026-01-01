"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "./api";

export type AuthedUser = {
  id: number;
  username: string;
  name: string;
  role: string;
  group_id?: number | null;
  major_id?: number | null;
};

type Options = {
  requiredRole?: string;
  redirectTo?: string;
};

export function useAuthGuard(options: Options = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const nextUrl = options.redirectTo ?? pathname ?? "/";

    const redirectToLogin = (msg: string) => {
      if (!active) return;
      setUser(null);
      setError(msg);
      router.replace(`/login?next=${encodeURIComponent(nextUrl)}`);
    };

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      redirectToLogin("需要登录");
      setLoading(false);
      return () => {
        active = false;
      };
    }

    apiFetch("/auth/me")
      .then((data) => {
        if (!active) return;
        if (options.requiredRole && data.role !== options.requiredRole) {
          redirectToLogin("需要管理员权限");
          return;
        }
        setUser(data);
        setError(null);
      })
      .catch(() => {
        redirectToLogin("需要登录");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [router, pathname, options.redirectTo, options.requiredRole]);

  return { user, loading, error };
}
