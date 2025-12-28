"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { resourceApi } from "../../../lib/api";
import { ResourceCard } from "../../../components/ResourceCard";

export default function DashboardResources() {
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    resourceApi
      .list()
      .then((data: any) => setItems(data.items || []))
      .catch((e: any) => setError(e.message || "加载失败"));
  };

  useEffect(() => {
    load();
  }, []);

  if (error) {
    return (
      <div className="rounded border bg-white p-4">
        <p className="text-sm text-red-600">{error}</p>
        <Link href="/login" className="text-brand">
          去登录
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">资源管理</h1>
        <Link href="/dashboard/resources/new" className="rounded-md bg-brand px-4 py-2 text-sm text-white">
          新建资源
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-slate-600">暂无资源，点击“新建资源”开始上传。</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <ResourceCard key={item.id} item={item} href={`/dashboard/resources/${item.id}`} />
          ))}
        </div>
      )}
    </div>
  );
}
