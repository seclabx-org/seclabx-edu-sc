"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ResourceGraph } from "../components/ResourceGraph";
import { ResourceCard, ResourceItem } from "../components/ResourceCard";
import { resourceApi } from "../lib/api";

export default function Home() {
  const [latest, setLatest] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    resourceApi
      .list({ page_size: 6, sort: "created_at_desc" })
      .then((data) => setLatest(data?.items || []))
      .catch((e) => setError(e?.message || "加载最新资源失败"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-10">
      <section className="rounded-2xl bg-gradient-to-r from-brand to-brand-dark p-10 text-white shadow-lg">
        <h1 className="text-3xl font-bold">信息安全技术应用专业群 · 课程思政资源平台</h1>
        <p className="mt-4 max-w-3xl text-lg text-blue-100 md:whitespace-nowrap whitespace-normal">
          面向专业群课程建设，提供统一的课程思政资源发布与共享平台，服务教学应用与育人成效提升。
        </p>
        <div className="mt-6 flex gap-4">
          <Link className="rounded-md bg-white px-4 py-2 font-medium text-brand" href="/resources">
            浏览资源
          </Link>
          <Link className="rounded-md border border-white/60 px-4 py-2 font-medium text-white" href="/dashboard">
            教师工作台
          </Link>
          <Link className="rounded-md border border-white/60 px-4 py-2 font-medium text-white" href="/dashboard/ai">
            AI工作台
          </Link>
        </div>
      </section>

      <section>
        <ResourceGraph />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">最新资源</h2>
          <Link className="text-sm text-brand hover:underline" href="/resources">
            查看全部
          </Link>
        </div>
        {loading && <p className="text-sm text-slate-500">加载中...</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!loading && !error && latest.length === 0 && <p className="text-sm text-slate-500">暂无资源</p>}
        <div className="space-y-3">
          {latest.map((item) => (
            <ResourceCard key={item.id} item={item} href={`/resources/${item.id}`} />
          ))}
        </div>
      </section>
    </div>
  );
}
