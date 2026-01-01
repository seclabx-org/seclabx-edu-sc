"use client";

import { useAuthGuard } from "../../../lib/useAuthGuard";

export default function AiWorkbenchPage() {
  const { user, loading } = useAuthGuard();

  if (loading) {
    return <div className="rounded border bg-white p-6 text-sm text-slate-600">正在校验登录状态...</div>;
  }

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">AI工作台</h1>
        <p className="text-sm text-slate-600">模块化 AI 能力入口，逐步开放中。</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-white p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-base font-semibold">AI思政助手</div>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">开发中</span>
          </div>
          <p className="text-sm text-slate-600">用于生成思政教学素材、课堂活动与评价建议。</p>
          <button
            type="button"
            disabled
            className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-400"
          >
            即将上线
          </button>
        </div>
      </div>
    </div>
  );
}
