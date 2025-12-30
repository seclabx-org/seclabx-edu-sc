"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuthGuard } from "../../lib/useAuthGuard";
import { resourceApi } from "../../lib/api";

type TagItem = { tag_id: number; tag_name: string; count: number };

export default function DashboardHome() {
  const { user, loading } = useAuthGuard();
  const [tags, setTags] = useState<TagItem[]>([]);

  useEffect(() => {
    resourceApi
      .tagsCloud({ limit: 50 })
      .then((data) => setTags(data.items || []))
      .catch(() => setTags([]));
  }, []);

  const colorPairs = useMemo(
    () => [
      { bg: "#e0f2fe", text: "#0f5fa4" },
      { bg: "#ede9fe", text: "#5b21b6" },
      { bg: "#dcfce7", text: "#166534" },
      { bg: "#fff7ed", text: "#9a3412" },
      { bg: "#fef2f2", text: "#b91c1c" },
    ],
    []
  );

  if (loading) {
    return (
      <div className="rounded border bg-white p-6 text-sm text-slate-600">
        正在校验登录状态...
      </div>
    );
  }

  if (!user) return null;

  const isAdmin = user.role === "admin";
  const manageLabel = isAdmin ? "管理资源" : "我的资源";
  const roleLabel = isAdmin ? "管理员" : "教师";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">教师工作台</h1>
          <p className="text-sm text-slate-600">
            欢迎，{user.name}（{roleLabel}）
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/dashboard/resources/new"
            className="rounded-md bg-brand px-4 py-2 text-sm text-white hover:opacity-90"
          >
            新建资源
          </Link>
          <Link
            href="/dashboard/resources"
            className="rounded-md border border-brand px-4 py-2 text-sm text-brand hover:bg-brand hover:text-white"
          >
            {manageLabel}
          </Link>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h3 className="text-sm text-slate-500">快捷入口</h3>
        <ul className="mt-2 space-y-2 text-sm">
          <li>
            <Link href="/resources" className="text-brand hover:underline">
              公共资源目录
            </Link>
          </li>
          <li>
            <Link href="/dashboard/resources" className="text-brand hover:underline">
              我的资源
            </Link>
          </li>
          {isAdmin && (
            <li>
              <Link href="/admin" className="text-brand hover:underline">
                管理后台（管理员）
              </Link>
            </li>
          )}
        </ul>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">标签（已发布资源）</h3>
          <Link href="/dashboard/tags" className="text-xs text-brand underline hover:text-brand">
            查看全部标签
          </Link>
        </div>
        {tags.length === 0 ? (
          <p className="text-xs text-slate-500">暂无标签数据。</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((t, idx) => {
              const href = `/resources?tag_id=${t.tag_id}`;
              const pair = colorPairs[idx % colorPairs.length];
              return (
                <Link
                  key={t.tag_id}
                  href={href}
                  className="rounded-full px-3 py-1 text-sm transition hover:bg-brand hover:text-white"
                  style={{ backgroundColor: pair.bg, color: pair.text }}
                  title={`${t.tag_name}（${t.count} 条）`}
                >
                  {t.tag_name}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
