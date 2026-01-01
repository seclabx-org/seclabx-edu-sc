"use client";

import { useState } from "react";
import Link from "next/link";
import { changePassword } from "../../../lib/api";
import { useAuthGuard } from "../../../lib/useAuthGuard";

export default function AccountPage() {
  const { user, loading } = useAuthGuard({ redirectTo: "/dashboard/account" });
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const validate = () => {
    if (!oldPassword.trim()) return "请填写当前密码";
    if (!newPassword.trim()) return "请填写新密码";
    if (newPassword.length < 8) return "新密码至少 8 位";
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return "新密码需包含大小写字母与数字";
    }
    if (newPassword !== confirmPassword) return "两次输入的新密码不一致";
    return null;
  };

  const handleSubmit = async () => {
    const msg = validate();
    if (msg) {
      setError(msg);
      setSuccess(null);
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await changePassword(oldPassword, newPassword);
      setSuccess("密码修改成功");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      setError(e.message || "修改失败");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="rounded border bg-white p-4 text-sm text-slate-600">正在校验登录状态...</div>;
  }

  if (!user) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">修改密码</h1>
          <p className="text-sm text-slate-600">请确保新密码安全且不与旧密码相同。</p>
        </div>
        <Link href="/dashboard" className="text-sm text-brand underline">
          返回工作台
        </Link>
      </div>

      <div className="rounded-xl border bg-white p-4 space-y-4 max-w-xl">
        <div className="space-y-2">
          <label className="text-sm text-slate-700">当前密码</label>
          <input
            type="password"
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-slate-700">新密码</label>
          <input
            type="password"
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <p className="text-xs text-slate-500">至少 8 位，包含大小写字母与数字。</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm text-slate-700">确认新密码</label>
          <input
            type="password"
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        {error && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {success && <div className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">{success}</div>}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
        >
          {submitting ? "提交中..." : "确认修改"}
        </button>
      </div>
    </div>
  );
}
