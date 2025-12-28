"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { metaApi, resourceApi } from "../../../../lib/api";

export default function NewResourcePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "",
    abstract: "",
    group_id: null as any,
    major_id: null as any,
    course_id: null as any,
    tag_ids: [] as number[],
    source_type: "upload",
    file_type: "pdf",
    external_url: "",
  });
  const [groups, setGroups] = useState<any[]>([]);
  const [majors, setMajors] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([metaApi.groups(), metaApi.majors(), metaApi.tags()]).then(([g, m, t]) => {
      setGroups(g || []);
      setMajors(m || []);
      setTags(t || []);
    });
  }, []);

  useEffect(() => {
    if (form.major_id) {
      metaApi.courses(Number(form.major_id)).then((c) => setCourses(c || []));
    }
  }, [form.major_id]);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload: any = { ...form };
      if (form.source_type === "url") {
        payload.external_url = form.external_url;
      } else {
        payload.external_url = null;
      }
      const res = await resourceApi.create(payload);
      router.push(`/dashboard/resources/${res.id}`);
    } catch (e: any) {
      setError(e.message || "创建失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">新建资源</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm text-slate-700">标题</label>
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-slate-700">摘要</label>
          <textarea
            className="w-full rounded-md border px-3 py-2 text-sm"
            rows={3}
            value={form.abstract}
            onChange={(e) => setForm((f) => ({ ...f, abstract: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-slate-700">专业群</label>
          <select
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={form.group_id || ""}
            onChange={(e) => setForm((f) => ({ ...f, group_id: e.target.value || null }))}
          >
            <option value="">请选择</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm text-slate-700">专业</label>
          <select
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={form.major_id || ""}
            onChange={(e) => setForm((f) => ({ ...f, major_id: e.target.value || null }))}
          >
            <option value="">请选择</option>
            {majors
              .filter((m) => !form.group_id || m.group_id === Number(form.group_id))
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm text-slate-700">课程</label>
          <select
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={form.course_id || ""}
            onChange={(e) => setForm((f) => ({ ...f, course_id: e.target.value || null }))}
          >
            <option value="">可选</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm text-slate-700">思政主题标签</label>
          <select
            multiple
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={form.tag_ids.map(String)}
            onChange={(e) => {
              const options = Array.from(e.target.selectedOptions).map((o) => Number(o.value));
              setForm((f) => ({ ...f, tag_ids: options }));
            }}
          >
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm text-slate-700">来源类型</label>
          <select
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={form.source_type}
            onChange={(e) => setForm((f) => ({ ...f, source_type: e.target.value }))}
          >
            <option value="upload">上传文件</option>
            <option value="url">外链</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm text-slate-700">文件类型</label>
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={form.file_type}
            onChange={(e) => setForm((f) => ({ ...f, file_type: e.target.value }))}
          />
        </div>
        {form.source_type === "url" && (
          <div className="space-y-2">
            <label className="text-sm text-slate-700">外链地址</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={form.external_url}
              onChange={(e) => setForm((f) => ({ ...f, external_url: e.target.value }))}
            />
          </div>
        )}
      </div>
      {error && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <button
        onClick={submit}
        disabled={loading}
        className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
      >
        {loading ? "提交中..." : "创建资源"}
      </button>
    </div>
  );
}
