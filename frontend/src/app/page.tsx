"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { resourceApi } from "../lib/api";
import { ResourceCard } from "../components/ResourceCard";

export default function Home() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    resourceApi
      .list({ page_size: 5 })
      .then((data: any) => setItems(data.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-10">
      <section className="rounded-2xl bg-gradient-to-r from-brand to-brand-dark p-10 text-white shadow-lg">
        <h1 className="text-3xl font-bold">信息安全技术应用专业群 · 课程思政资源平台</h1>
        <p className="mt-4 max-w-3xl text-lg text-blue-100">
          集中管理专业群课程思政资源，支持教师上传、发布、下载与统计，保障资源可控、可追溯、可验收。
        </p>
        <div className="mt-6 flex gap-4">
          <Link className="rounded-md bg-white px-4 py-2 font-medium text-brand" href="/resources">
            浏览资源
          </Link>
          <Link className="rounded-md border border-white/60 px-4 py-2 font-medium text-white" href="/login">
            教师登录
          </Link>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">最新资源</h2>
          <Link href="/resources" className="text-sm text-brand">
            查看全部
          </Link>
        </div>
        {loading ? (
          <p className="text-sm text-slate-600">加载中...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-600">暂无资源。</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <ResourceCard key={item.id} item={item} href={`/resources/${item.id}`} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
