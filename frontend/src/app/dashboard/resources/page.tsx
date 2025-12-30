"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { resourceApi, metaApi } from "../../../lib/api";
import { ResourceCard } from "../../../components/ResourceCard";
import { useAuthGuard } from "../../../lib/useAuthGuard";

export default function DashboardResources() {
  const { user, loading } = useAuthGuard({ redirectTo: "/dashboard/resources" });
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [courseId, setCourseId] = useState<string>("");
  const [tagId, setTagId] = useState<string>("");
  const [courses, setCourses] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);

  const load = () => {
    const params: Record<string, any> = {
      status: status || undefined,
      course_id: courseId ? Number(courseId) : undefined,
      tag_id: tagId ? Number(tagId) : undefined,
    };
    if (!(user?.role === "admin")) {
      params.mine = 1;
    }
    resourceApi
      .list(params)
      .then((data: any) => {
        const list = data.items || [];
        const order = { draft: 0, published: 1 };
        list.sort((a: any, b: any) => (order[a.status] ?? 3) - (order[b.status] ?? 3));
        setItems(list);
      })
      .catch((e: any) => setError(e.message || "加载失败"));
  };

  useEffect(() => {
    if (user) {
      load();
      if (user.role === "admin") {
        Promise.all([metaApi.courses(), metaApi.tags()])
          .then(([c, t]) => {
            setCourses(c || []);
            setTags(t || []);
          })
          .catch(() => {
            setCourses([]);
            setTags([]);
          });
      } else {
        resourceApi
          .myFilters()
          .then((res) => {
            setCourses(res.courses || []);
            setTags(res.tags || []);
          })
          .catch(() => {
            setCourses([]);
            setTags([]);
          });
      }
    }
  }, [user, status, courseId, tagId]);

  if (loading) {
    return <div className="rounded border bg-white p-4 text-sm text-slate-600">正在校验登录...</div>;
  }

  if (error) {
    return (
      <div className="rounded border bg-white p-4">
        <p className="text-sm text-red-600">{error}</p>
        <Link href="/login" className="text-brand">
          请先登录
        </Link>
      </div>
    );
  }

  if (!user) return null;
  const isAdmin = user.role === "admin";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{isAdmin ? "管理资源" : "我的资源"}</h1>
        <Link href="/dashboard/resources/new" className="rounded-md bg-brand px-4 py-2 text-sm text-white">
          新建资源
        </Link>
      </div>
      <div className="flex flex-wrap items-end gap-3 rounded border bg-white p-3 text-sm">
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          状态
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border px-2 py-1 text-sm">
            <option value="">全部</option>
            <option value="draft">草稿</option>
            <option value="published">已发布</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          课程
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="rounded border px-2 py-1 text-sm">
            <option value="">全部</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          标签
          <select value={tagId} onChange={(e) => setTagId(e.target.value)} className="rounded border px-2 py-1 text-sm">
            <option value="">全部</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <button onClick={load} className="rounded bg-brand px-3 py-2 text-sm text-white hover:opacity-90">
          应用筛选
        </button>
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
