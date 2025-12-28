"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "../../lib/api";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await login(username, password);
      router.push("/dashboard");
    } catch (e: any) {
      setError(e.message || "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6 rounded-2xl border bg-white p-8 shadow-sm">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">教师登录</h1>
        <p className="text-sm text-slate-600">无注册入口，如需账号请联系管理员。</p>
      </div>
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-sm text-slate-700">用户名</label>
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700">密码</label>
          <input
            type="password"
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
        >
          {loading ? "登录中..." : "登录"}
        </button>
      </div>
    </div>
  );
}
