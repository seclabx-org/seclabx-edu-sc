"use client";

import { useEffect, useState } from "react";
import { resourceApi } from "../../lib/api";
import { ResourceCard } from "../../components/ResourceCard";

export default function ResourcesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");

  const load = () => {
    setLoading(true);
    resourceApi
      .list({ keyword })
      .then((data: any) => setItems(data.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">资源目录</h1>
          <p className="text-sm text-slate-600">未登录仅显示已发布的标题与摘要。</p>
        </div>
        <div className="flex gap-2">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索标题/摘要"
            className="rounded-md border px-3 py-2 text-sm"
          />
          <button onClick={load} className="rounded-md bg-brand px-4 py-2 text-sm text-white">
            搜索
          </button>
        </div>
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
    </div>
  );
}
