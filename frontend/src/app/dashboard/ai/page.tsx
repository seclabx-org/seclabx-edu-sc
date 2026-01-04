"use client";

import Link from "next/link";
import { useAuthGuard } from "../../../lib/useAuthGuard";

export default function AiWorkbenchPage() {
  const { user, loading } = useAuthGuard();

  if (loading) {
    return <div className="rounded border bg-white p-6 text-sm text-slate-600">正在校验登录状态...</div>;
  }

  if (!user) return null;

  return (
    <div
      className="space-y-6"
      style={{ fontFamily: "'Noto Serif SC', 'Source Han Serif SC', serif" }}
    >
      <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-900 via-slate-900 to-brand p-8 text-white">
        <div className="relative z-10 space-y-2">
          <div className="text-xs uppercase tracking-[0.2em] text-blue-200">AI Workbench</div>
          <h1 className="text-3xl font-semibold">AI 工作台</h1>
          <p className="max-w-2xl text-sm text-blue-100">
            模块化能力入口，聚焦教学场景。点击模块进入对应工作流。
          </p>
        </div>
        <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 -translate-y-1/2 translate-x-1/3 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-40 w-40 translate-y-1/2 rounded-full bg-brand/40 blur-3xl" />
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/dashboard/ai/assistant"
          className="group relative rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/60 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="text-base font-semibold text-slate-900">AI 思政助手</div>
            <span className="rounded-full bg-brand/10 px-2 py-1 text-xs text-brand">对话</span>
          </div>
          <p className="mt-3 text-sm text-slate-600">生成课堂导语、案例引入、讨论题与作业提示。</p>
          <div className="mt-4 inline-flex items-center gap-2 text-xs text-slate-500">
            <span className="rounded-full bg-slate-100 px-2 py-1">课堂导语</span>
            <span className="rounded-full bg-slate-100 px-2 py-1">讨论题</span>
            <span className="rounded-full bg-slate-100 px-2 py-1">作业提示</span>
          </div>
          <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-brand/10 blur-2xl" />
        </Link>

        <div className="rounded-2xl border border-dashed bg-white p-5 text-slate-500">
          <div className="text-base font-semibold">更多模块</div>
          <p className="mt-2 text-sm">逐步开放：智能检索、资源发布助手、知识库问答。</p>
          <div className="mt-4 text-xs text-slate-400">敬请期待</div>
        </div>
      </div>
    </div>
  );
}
