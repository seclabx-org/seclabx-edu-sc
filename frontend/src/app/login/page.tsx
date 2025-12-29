"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "../../lib/api";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldownSec, setCooldownSec] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (cooldownSec === null) return;
    if (cooldownSec <= 0) {
      setCooldownSec(null);
      setError(null);
      return;
    }
    const timer = setTimeout(() => setCooldownSec((s) => (s !== null ? s - 1 : null)), 1000);
    return () => clearTimeout(timer);
  }, [cooldownSec]);

  const handleLogin = async () => {
    if (cooldownSec && cooldownSec > 0) return;
    setLoading(true);
    setError(null);
    try {
      await login(username, password);
      router.push("/dashboard");
    } catch (e: any) {
      const msg: string = e.message || "登录失败";
      const match = msg.match(/(\d+)秒后再试/);
      if (match) {
        const sec = Number(match[1]);
        setCooldownSec(sec);
        setError("登录过于频繁，请稍后再试");
      } else if (msg === "Failed to fetch") {
        setError("无法连接服务器，请确认后端运行且网络可用");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const btnDisabled = loading || (cooldownSec !== null && cooldownSec > 0);

  return (
    <div className="mx-auto max-w-md space-y-6 rounded-2xl border bg-white p-8 shadow-sm">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">教师登录</h1>
        <p className="text-sm text-slate-600">如需账号，请联系管理员。</p>
      </div>
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-sm text-slate-700">用户名</label>
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700">密码</label>
          <input
            type="password"
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        {error && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <button
          onClick={handleLogin}
          disabled={btnDisabled}
          className="w-full rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
        >
          {cooldownSec && cooldownSec > 0
            ? `请等待 ${cooldownSec} 秒`
            : loading
              ? "登录中..."
              : "登录"}
        </button>
      </div>
    </div>
  );
}
