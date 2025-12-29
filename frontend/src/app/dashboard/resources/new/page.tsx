"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { metaApi, resourceApi } from "../../../../lib/api";

type FormState = {
  title: string;
  abstract: string;
  group_id: number | null;
  major_id: number | null;
  course_id: number | null;
  tag_ids: number[];
  resource_type: string;
  source_type: "upload" | "url";
  file_type: string;
  external_url: string;
  cover_url: string;
  duration_seconds: number | null;
  audience: string;
  status: "draft" | "published";
};

const RESOURCE_TYPE_OPTIONS = [
  { value: "text", label: "文本" },
  { value: "slide", label: "课件" },
  { value: "video", label: "视频" },
  { value: "audio", label: "音频" },
  { value: "image", label: "图片" },
  { value: "doc", label: "文档" },
  { value: "policy", label: "政策" },
  { value: "practice", label: "案例" },
  { value: "link", label: "链接" },
];

export default function NewResourcePage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    title: "",
    abstract: "",
    group_id: null,
    major_id: null,
    course_id: null,
    tag_ids: [],
    resource_type: "doc",
    source_type: "upload",
    file_type: "pdf",
    external_url: "",
    cover_url: "",
    duration_seconds: null,
    audience: "",
    status: "draft",
  });
  const [groups, setGroups] = useState<any[]>([]);
  const [majors, setMajors] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([metaApi.groups(), metaApi.majors(), metaApi.tags()]).then(([g, m, t]) => {
      const groupList = g || [];
      const majorList = m || [];
      setGroups(groupList);
      setMajors(majorList);
      setTags(t || []);

      // 默认选中“信息安全技术应用专业群”（code=sec_cluster），否则选第一个
      const preferred = groupList.find((item: any) => item.code === "sec_cluster" || item.name.includes("信息安全技术应用专业群"));
      const defaultGroupId = preferred?.id ?? (groupList[0]?.id ?? null);
      if (defaultGroupId && !form.group_id) {
        const majorsInGroup = majorList.filter((mm) => mm.group_id === defaultGroupId);
        const defaultMajorId = majorsInGroup[0]?.id ?? null;
        setForm((f) => ({ ...f, group_id: defaultGroupId, major_id: defaultMajorId }));
      }
    });
  }, []);

  useEffect(() => {
    if (form.group_id) {
      const majorsInGroup = majors.filter((m) => m.group_id === form.group_id);
      if (!form.major_id && majorsInGroup.length > 0) {
        setForm((f) => ({ ...f, major_id: majorsInGroup[0].id }));
      }
    }
  }, [form.group_id, majors]);

  useEffect(() => {
    if (form.major_id) {
      metaApi.courses(Number(form.major_id)).then((c) => setCourses(c || []));
    } else {
      setCourses([]);
    }
  }, [form.major_id]);

  const validate = () => {
    if (!form.title.trim()) return "请填写标题";
    if (!form.major_id) return "请选择专业";
    if (!form.resource_type) return "请选择资源类型";
    if (form.source_type === "url" && !form.external_url.trim()) return "请填写外链地址";
    return null;
  };

  const submit = async () => {
    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }
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

  const isVideoAudio = useMemo(() => ["video", "audio"].includes(form.resource_type), [form.resource_type]);

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
          <label className="text-sm text-slate-700">资源类型</label>
          <select
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={form.resource_type}
            onChange={(e) => setForm((f) => ({ ...f, resource_type: e.target.value }))}
          >
            {RESOURCE_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm text-slate-700">来源类型</label>
          <select
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={form.source_type}
            onChange={(e) => setForm((f) => ({ ...f, source_type: e.target.value as FormState["source_type"] }))}
          >
            <option value="upload">上传文件</option>
            <option value="url">外链</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm text-slate-700">保存方式</label>
          <select
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as FormState["status"] }))}
          >
            <option value="draft">保存为草稿</option>
            <option value="published">直接发布</option>
          </select>
          <p className="text-xs text-slate-500">直接发布后将出现在公共资源列表；草稿仅在“我的资源”可见。</p>
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
        <div className="space-y-2">
          <label className="text-sm text-slate-700">封面图（可选）</label>
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="https://example.com/cover.jpg"
            value={form.cover_url}
            onChange={(e) => setForm((f) => ({ ...f, cover_url: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-slate-700">适用人群（可选）</label>
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="如：大一 / 教师培训"
            value={form.audience}
            onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))}
          />
        </div>
        {isVideoAudio && (
          <div className="space-y-2">
            <label className="text-sm text-slate-700">时长（秒，可选）</label>
            <input
              type="number"
              min={0}
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={form.duration_seconds ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, duration_seconds: e.target.value ? Number(e.target.value) : null }))}
            />
          </div>
        )}
        <div className="space-y-2">
          <label className="text-sm text-slate-700">专业群</label>
          <select
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={form.group_id ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, group_id: e.target.value ? Number(e.target.value) : null, major_id: null, course_id: null }))}
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
            value={form.major_id ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, major_id: e.target.value ? Number(e.target.value) : null, course_id: null }))}
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
            value={form.course_id ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, course_id: e.target.value ? Number(e.target.value) : null }))}
          >
            <option value="">可选</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">如暂无课程选项，请联系管理员添加。</p>
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
          <p className="text-xs text-slate-500">标签由管理员维护，如需新标签请联系管理员。</p>
        </div>
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
