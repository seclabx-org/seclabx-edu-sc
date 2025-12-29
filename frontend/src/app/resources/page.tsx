"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { metaApi, resourceApi } from "../../lib/api";
import { ResourceCard, ResourceItem } from "../../components/ResourceCard";
import { useAuthGuard } from "../../lib/useAuthGuard";

type SelectOption = { label: string; value: string | number };

const typeOptions: SelectOption[] = [
  { value: "", label: "全部类型" },
  { value: "video", label: "视频" },
  { value: "audio", label: "音频" },
  { value: "text", label: "文本/讲稿" },
  { value: "slide", label: "课件" },
  { value: "policy", label: "政策" },
  { value: "practice", label: "案例" },
  { value: "image", label: "图片" },
  { value: "doc", label: "文档" },
  { value: "link", label: "链接" },
];

const sortOptions: SelectOption[] = [
  { value: "created_at_desc", label: "最新发布" },
  { value: "created_at_asc", label: "最早发布" },
  { value: "download_desc", label: "下载最多" },
];

function ResourceListInner() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const { user } = useAuthGuard({ redirectTo: "/resources" });
  const [onlyMine, setOnlyMine] = useState(false);

  const [keyword, setKeyword] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<number | undefined>();
  const [selectedMajor, setSelectedMajor] = useState<number | undefined>();
  const [selectedCourse, setSelectedCourse] = useState<number | undefined>();
  const [selectedTag, setSelectedTag] = useState<number | undefined>();
  const [sort, setSort] = useState("created_at_desc");

  const [groups, setGroups] = useState<SelectOption[]>([{ value: "", label: "全部专业群" }]);
  const [majors, setMajors] = useState<SelectOption[]>([{ value: "", label: "全部专业" }]);
  const [courses, setCourses] = useState<SelectOption[]>([{ value: "", label: "全部课程" }]);
  const [tags, setTags] = useState<SelectOption[]>([{ value: "", label: "全部标签" }]);

  // 初始化时根据 URL 预填
  useEffect(() => {
    const g = searchParams.get("group_id");
    const m = searchParams.get("major_id");
    const c = searchParams.get("course_id");
    const t = searchParams.get("resource_type");
    if (g) setSelectedGroup(Number(g));
    if (m) setSelectedMajor(Number(m));
    if (c) setSelectedCourse(Number(c));
    if (t) setSelectedType(t);
  }, [searchParams]);

  useEffect(() => {
    metaApi.groups().then((data) => {
      setGroups([{ value: "", label: "全部专业群" }, ...data.map((g: any) => ({ value: g.id, label: g.name }))]);
    });
    metaApi.tags().then((data) => {
      setTags([{ value: "", label: "全部标签" }, ...data.map((t: any) => ({ value: t.id, label: t.name }))]);
    });
  }, []);

  useEffect(() => {
    // 专业依赖专业群
    metaApi.majors(selectedGroup).then((data) => {
      setMajors([{ value: "", label: "全部专业" }, ...data.map((m: any) => ({ value: m.id, label: m.name }))]);
    });
    setSelectedMajor(undefined);
    setSelectedCourse(undefined);
  }, [selectedGroup]);

  useEffect(() => {
    // 课程依赖专业
    if (selectedMajor) {
      metaApi.courses(selectedMajor).then((data) => {
        setCourses([{ value: "", label: "全部课程" }, ...data.map((c: any) => ({ value: c.id, label: c.name }))]);
      });
    } else {
      setCourses([{ value: "", label: "全部课程" }]);
    }
    setSelectedCourse(undefined);
  }, [selectedMajor]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await resourceApi.list({
          page,
          page_size: pageSize,
          keyword: keyword.trim() || undefined,
          resource_type: selectedType || undefined,
          group_id: selectedGroup || undefined,
          major_id: selectedMajor || undefined,
          course_id: selectedCourse || undefined,
          tag_id: selectedTag || undefined,
          sort,
          mine: onlyMine ? 1 : undefined,
        });
        setItems(data.items || []);
        setTotal(data.total || 0);
      } catch (e: any) {
        setError(e.message || "加载失败");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [page, keyword, selectedType, selectedGroup, selectedMajor, selectedCourse, selectedTag, sort, onlyMine]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  const renderSelect = (label: string, value: string | number | undefined, onChange: (v: string) => void, options: SelectOption[]) => (
    <label className="flex flex-col text-xs text-slate-600">
      <span className="mb-1">{label}</span>
      <select
        value={value === undefined ? "" : value}
        onChange={(e) => {
          setPage(1);
          onChange(e.target.value);
        }}
        className="rounded border px-2 py-1 text-sm"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">资源目录</h1>
          <p className="text-sm text-slate-600">仅展示已发布资源；点击卡片可查看详情（需登录后访问详情/下载）。</p>
        </div>
        <div className="flex gap-2">
          {!user && (
            <Link href="/login" className="rounded border border-brand px-3 py-2 text-sm text-brand hover:bg-brand hover:text-white">
              教师/管理员登录
            </Link>
          )}
          {user && (
            <Link href="/dashboard" className="rounded bg-brand px-3 py-2 text-sm font-semibold text-white hover:opacity-90">
              教师工作台
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-3 lg:grid-cols-6">
        <label className="flex flex-col text-xs text-slate-600">
          <span className="mb-1">关键字</span>
          <input
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setPage(1);
            }}
            placeholder="标题/摘要"
            className="rounded border px-2 py-1 text-sm"
          />
        </label>
        {renderSelect("类型", selectedType, (v) => setSelectedType(v), typeOptions)}
        {renderSelect("专业群", selectedGroup, (v) => setSelectedGroup(v ? Number(v) : undefined), groups)}
        {renderSelect("专业", selectedMajor, (v) => setSelectedMajor(v ? Number(v) : undefined), majors)}
        {renderSelect("课程", selectedCourse, (v) => setSelectedCourse(v ? Number(v) : undefined), courses)}
        {renderSelect("标签", selectedTag, (v) => setSelectedTag(v ? Number(v) : undefined), tags)}
        {renderSelect("排序", sort, (v) => setSort(v), sortOptions)}
        <label className="flex items-center gap-2 text-xs text-slate-600 md:col-span-2 lg:col-span-2">
          <input
            type="checkbox"
            checked={onlyMine}
            onChange={(e) => {
              if (e.target.checked && !user) {
                alert("请先登录再查看“我的资源”。");
                return;
              }
              setOnlyMine(e.target.checked);
              setPage(1);
            }}
          />
          <span>只看我的</span>
        </label>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <p className="text-sm text-slate-600">加载中...</p>
      ) : (
        <div className="space-y-3">
          {items.length === 0 && <div className="rounded border bg-white p-4 text-sm text-slate-600">暂无资源，稍后再试。</div>}
          {items.map((item) => (
            <ResourceCard key={item.id} item={item} href={`/resources/${item.id}`} />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between rounded border bg-white px-3 py-2 text-sm text-slate-700">
        <span>
          第 {page}/{totalPages} 页 · 共 {total} 条
        </span>
        <div className="flex gap-2">
          <button
            className="rounded border px-2 py-1 disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            上一页
          </button>
          <button
            className="rounded border px-2 py-1 disabled:opacity-50"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ResourceListPage() {
  return (
    <Suspense fallback={<div className="text-sm text-slate-600">加载中...</div>}>
      <ResourceListInner />
    </Suspense>
  );
}
