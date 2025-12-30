"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthGuard } from "../../../lib/useAuthGuard";
import { resourceApi } from "../../../lib/api";

type TagItem = { tag_id: number; tag_name: string; count: number };

export default function TagsPage() {
  const { user, loading } = useAuthGuard();
  const [tags, setTags] = useState<TagItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    resourceApi
      .tagsCloud({})
      .then((data) => {
        setTags(data.items || []);
        setError(null);
      })
      .catch((e: any) => setError(e.message || "加载标签失败"));
  }, []);

  const colorPairs = [
    { bg: "#e0f2fe", text: "#0f5fa4" },
    { bg: "#ede9fe", text: "#5b21b6" },
    { bg: "#dcfce7", text: "#166534" },
    { bg: "#fff7ed", text: "#9a3412" },
    { bg: "#fef2f2", text: "#b91c1c" },
  ];

  if (loading) return <p className="text-sm text-slate-600">正在校验登录...</p>;
  if (!user) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">标签列表（已发布资源）</h1>
        <Link href="/dashboard" className="text-sm text-brand underline hover:text-brand">
          返回工作台
        </Link>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">全部标签</h3>
          <span className="text-[11px] text-slate-500">点击标签可筛选</span>
        </div>
        {tags.length === 0 ? (
          <p className="text-xs text-slate-500">暂无标签数据。</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((t, idx) => {
              const pair = colorPairs[idx % colorPairs.length];
              const href = `/resources?tag_id=${t.tag_id}`;
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
