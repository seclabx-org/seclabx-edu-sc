"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { metaApi, resourceApi, uploadFile, uploadCover } from "../../../../lib/api";
import { useAuthGuard } from "../../../../lib/useAuthGuard";

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

const DEFAULT_EXT_BY_TYPE: Record<string, string> = {
  text: "pdf",
  slide: "pptx",
  video: "mp4",
  audio: "mp4",
  image: "jpg",
  doc: "pdf",
  policy: "pdf",
  practice: "pdf",
  link: "pdf",
};

const HINT_BY_TYPE: Record<string, string> = {
  text: "pdf、docx",
  slide: "pptx",
  video: "mp4",
  audio: "mp4",
  image: "png、jpg",
  doc: "pdf、docx、xlsx、zip",
  policy: "pdf",
  practice: "pdf、docx、zip",
  link: "pdf、docx",
};

export default function NewResourcePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthGuard();
  const [form, setForm] = useState<FormState>({
    title: "",
    abstract: "",
    group_id: null,
    major_id: null,
    course_id: null,
    tag_ids: [],
    resource_type: "doc",
    source_type: "upload",
    file_type: DEFAULT_EXT_BY_TYPE["doc"],
    external_url: "",
    cover_url: "",
    duration_seconds: null,
    audience: "",
  });
  const [groups, setGroups] = useState<any[]>([]);
  const [majors, setMajors] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [courseInput, setCourseInput] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [selectedTags, setSelectedTags] = useState<Array<{ id?: number; name: string }>>([]);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([metaApi.groups(), metaApi.majors(), metaApi.tags()]).then(([g, m, t]) => {
      const groupList = g || [];
      const majorList = m || [];
      setGroups(groupList);
      setMajors(majorList);
      setTags(t || []);
      if (!form.group_id && groupList.length) {
        const preferred = groupList.find((item: any) => item.code === "sec_cluster" || item.name.includes("信息安全技术应用专业群"));
        const defaultGroupId = preferred?.id ?? groupList[0]?.id ?? null;
        if (defaultGroupId) {
          setForm((f) => ({ ...f, group_id: defaultGroupId, major_id: null, course_id: null }));
        }
      }
    });
  }, []);

  useEffect(() => {
    if (form.major_id) {
      metaApi.courses(Number(form.major_id)).then((c) => setCourses(c || []));
    } else {
      setCourses([]);
    }
    setCourseInput("");
  }, [form.major_id]);

  useEffect(() => {
    if (!coverFile) {
      setCoverPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(coverFile);
    setCoverPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  const validate = () => {
    if (!form.title.trim()) return "请填写标题";
    if (!form.major_id) return "请选择专业";
    if (!form.resource_type) return "请选择资源类型";
    if (!courseInput.trim()) return "请填写课程名称";
    if (selectedTags.length === 0) return "请至少添加一个思政主题标签";
    if (form.source_type === "url") {
      const url = form.external_url.trim();
      if (!url) return "请填写外链地址";
      if (url.length > 2048) return "外链地址过长";
      const lower = url.toLowerCase();
      if (!(lower.startsWith("http://") || lower.startsWith("https://"))) return "外链仅支持 http:// 或 https://";
      if (lower.startsWith("javascript:") || lower.startsWith("data:")) return "外链协议不合法";
      try {
        new URL(url);
      } catch {
        return "外链地址格式不正确";
      }
    }
    if (form.source_type === "upload" && !file) return "请选择要上传的文件";
    return null;
  };

  const submit = async (targetStatus: "draft" | "published") => {
    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload: any = { ...form };
      payload.file_type = DEFAULT_EXT_BY_TYPE[form.resource_type] || "pdf";
      payload.status = targetStatus;
      if (form.source_type === "url") {
        payload.external_url = form.external_url;
      } else {
        payload.external_url = null;
      }
      const courseName = courseInput.trim();
      if (courseName) {
        const found = courses.find((c) => c.name === courseName);
        if (found) {
          payload.course_id = found.id;
          payload.course_name = null;
        } else {
          payload.course_id = null;
          payload.course_name = courseName;
        }
      } else {
        payload.course_id = null;
        payload.course_name = null;
      }
      const tagIds = selectedTags.filter((t) => t.id).map((t) => t.id);
      const tagNames = selectedTags.filter((t) => !t.id).map((t) => t.name);
      payload.tag_ids = tagIds;
      if (tagNames.length) payload.tag_names = tagNames;
      if (coverFile) {
        payload.cover_url = ""; // 上传封面后端会更新
      }
      const res = await resourceApi.create(payload);
      if (form.source_type === "upload" && file) {
        await uploadFile(res.id, file);
      }
      if (coverFile) {
        await uploadCover(res.id, coverFile);
      }
      const redirect = targetStatus === "draft" ? "/dashboard/resources" : "/resources";
      router.push(redirect);
    } catch (e: any) {
      setError(e.message || "创建或上传失败");
    } finally {
      setLoading(false);
    }
  };

  const isVideoAudio = useMemo(() => ["video", "audio"].includes(form.resource_type), [form.resource_type]);
  const uploadSupport = form.source_type === "upload";
  const typeHint = uploadSupport ? HINT_BY_TYPE[form.resource_type] || "pdf、pptx、docx、xlsx、mp4、png、jpg、zip" : "";
  const isLink = form.resource_type === "link";
  const accept = uploadSupport ? (HINT_BY_TYPE[form.resource_type] || "").split("、").map((ext) => `.${ext}`).join(",") : undefined;
  const typeLabel: Record<string, string> = {
    text: "文本",
    slide: "课件",
    video: "视频",
    audio: "音频",
    image: "图片",
    doc: "文档",
    policy: "政策",
    practice: "案例",
    link: "链接",
  };
  const sourceLabel: Record<string, string> = { upload: "上传", url: "外链" };
  const defaultCoverMap: Record<string, string> = {
    text: "/sample-covers/text.jpg",
    slide: "/sample-covers/slide.jpg",
    video: "/sample-covers/video.jpg",
    audio: "/sample-covers/audio.jpg",
    image: "/sample-covers/image.jpg",
    doc: "/sample-covers/doc.jpg",
    policy: "/sample-covers/policy.jpg",
    practice: "/sample-covers/practice.jpg",
    link: "/sample-covers/link.jpg",
  };
  const previewCover = coverPreviewUrl || defaultCoverMap[form.resource_type] || "/sample-covers/default-cover.jpg";
  const previewGroup = groups.find((g) => g.id === form.group_id)?.name || "";
  const previewMajor = majors.find((m) => m.id === form.major_id)?.name || "";
  const pendingTag = tagInput.trim();
  const normalize = (value: string) => value.trim().toLowerCase();
  const courseMatches = useMemo(() => {
    const keyword = normalize(courseInput);
    if (!keyword) return [];
    return courses.filter((c) => normalize(c.name).includes(keyword)).slice(0, 6);
  }, [courseInput, courses]);
  const tagMatches = useMemo(() => {
    const keyword = normalize(tagInput);
    if (!keyword) return [];
    return tags
      .filter((t) => normalize(t.name).includes(keyword))
      .filter((t) => !selectedTags.find((s) => s.name === t.name))
      .slice(0, 8);
  }, [tagInput, tags, selectedTags]);
  const addTag = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const existing = tags.find((t) => t.name === trimmed);
    const already = selectedTags.find((t) => t.name === trimmed);
    if (already) return;
    if (existing) {
      setSelectedTags((prev) => [...prev, { id: existing.id, name: existing.name }]);
    } else {
      setSelectedTags((prev) => [...prev, { name: trimmed }]);
    }
    setTagInput("");
  };

  return (
    <div className="space-y-6">
      {authLoading && <div className="rounded border bg-white p-4 text-sm text-slate-600">正在校验登录状态...</div>}
      {!authLoading && !user && <div className="rounded border bg-white p-4 text-sm text-slate-600">正在跳转到登录页...</div>}
      {!authLoading && user && (
        <>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">新建资源</h1>
            <p className="text-sm text-slate-600">填写基础信息、教学元信息与资源来源，系统会自动生成默认封面。</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-4">
              <section className="rounded-xl border bg-white p-4 space-y-4">
                <div className="text-sm font-semibold text-slate-800">基础信息</div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm text-slate-700">
                      标题<span className="ml-1 text-xs text-red-600">*</span>
                    </label>
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
                </div>
              </section>

              <section className="rounded-xl border bg-white p-4 space-y-4">
                <div className="text-sm font-semibold text-slate-800">资源来源</div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm text-slate-700">
                      资源类型<span className="ml-1 text-xs text-red-600">*</span>
                    </label>
                    <select
                      className="w-full rounded-md border px-3 py-2 text-sm"
                      value={form.resource_type}
                      onChange={(e) => {
                        const nextType = e.target.value;
                        const nextSource = nextType === "link" ? "url" : form.source_type;
                        setForm((f) => ({
                          ...f,
                          resource_type: nextType,
                          file_type: DEFAULT_EXT_BY_TYPE[nextType] || "pdf",
                          source_type: nextSource,
                        }));
                      }}
                    >
                      {RESOURCE_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-slate-700">
                      来源类型<span className="ml-1 text-xs text-red-600">*</span>
                    </label>
                    <select
                      className="w-full rounded-md border px-3 py-2 text-sm"
                      value={form.source_type}
                      onChange={(e) => setForm((f) => ({ ...f, source_type: e.target.value as FormState["source_type"] }))}
                      disabled={isLink}
                    >
                      <option value="upload">上传文件</option>
                      <option value="url">外链</option>
                    </select>
                    {isLink && <p className="text-xs text-slate-500">链接类型仅支持外链，不需上传文件。</p>}
                    {uploadSupport && !isLink && <p className="text-xs text-slate-500">支持类型：{typeHint}</p>}
                  </div>
                  {uploadSupport && !isLink && (
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm text-slate-700">
                        资源文件上传<span className="ml-1 text-xs text-red-600">*</span>
                      </label>
                      <input
                        type="file"
                        accept={accept}
                        className="w-full rounded-md border px-3 py-2 text-sm"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                      />
                      <div className="text-xs text-slate-500">用于下载/预览：{file?.name || "未选择文件"}</div>
                    </div>
                  )}
                  {form.source_type === "url" && (
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm text-slate-700">
                        外链地址<span className="ml-1 text-xs text-red-600">*</span>
                      </label>
                      <input
                        className="w-full rounded-md border px-3 py-2 text-sm"
                        value={form.external_url}
                        onChange={(e) => setForm((f) => ({ ...f, external_url: e.target.value }))}
                      />
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-xl border bg-white p-4 space-y-4">
                <div className="text-sm font-semibold text-slate-800">教学元信息</div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm text-slate-700">
                      专业群<span className="ml-1 text-xs text-red-600">*</span>
                    </label>
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
                    <label className="text-sm text-slate-700">
                      专业<span className="ml-1 text-xs text-red-600">*</span>
                    </label>
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
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm text-slate-700">
                      课程<span className="ml-1 text-xs text-red-600">*</span>
                    </label>
                    <input
                      className="w-full rounded-md border px-3 py-2 text-sm"
                      placeholder="输入课程名称，可选已有或直接新建"
                      value={courseInput}
                      onChange={(e) => setCourseInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && courseMatches.length > 0) {
                          e.preventDefault();
                          setCourseInput(courseMatches[0].name);
                        }
                      }}
                    />
                    {courseMatches.length > 0 && (
                      <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                        {courseMatches.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className="rounded bg-slate-100 px-2 py-1 hover:bg-slate-200"
                            onClick={() => setCourseInput(c.name)}
                          >
                            {c.name}
                          </button>
                        ))}
                      </div>
                    )}
                    {courseInput.trim() && courseMatches.length === 0 && (
                      <div className="text-xs text-slate-500">未匹配到现有课程，将按新课程保存。</div>
                    )}
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm text-slate-700">
                      思政主题标签<span className="ml-1 text-xs text-red-600">*</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        className="w-full rounded-md border px-3 py-2 text-sm"
                        placeholder="输入标签名称，回车或点击添加"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addTag(tagInput);
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => addTag(tagInput)}
                        className="rounded-md border px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                      >
                        添加
                      </button>
                    </div>
                    {tagMatches.length > 0 && (
                      <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                        {tagMatches.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            className="rounded bg-slate-100 px-2 py-1 hover:bg-slate-200"
                            onClick={() => addTag(t.name)}
                          >
                            {t.name}
                          </button>
                        ))}
                      </div>
                    )}
                    {selectedTags.length > 0 && (
                      <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                        {selectedTags.map((t) => (
                          <span key={`${t.id ?? "new"}-${t.name}`} className="rounded bg-slate-100 px-2 py-1">
                            {t.name}
                            <button
                              type="button"
                              className="ml-2 text-slate-500 hover:text-slate-700"
                              onClick={() => setSelectedTags((prev) => prev.filter((x) => x.name !== t.name))}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {error && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
              <div className="sticky bottom-4 rounded-xl border bg-white p-4 flex flex-wrap gap-3 items-center justify-between">
                <div className="text-xs text-slate-500">带 * 为必填项</div>
                <div className="flex gap-3">
                  <button
                    onClick={() => submit("draft")}
                    disabled={loading}
                    className="rounded-md border border-brand px-4 py-2 text-sm font-semibold text-brand hover:bg-brand hover:text-white disabled:opacity-70"
                  >
                    {loading ? "提交中..." : "保存草稿"}
                  </button>
                  <button
                    onClick={() => submit("published")}
                    disabled={loading}
                    className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
                  >
                    {loading ? "提交中..." : "直接发布"}
                  </button>
                </div>
              </div>
            </div>

            <aside className="space-y-4 lg:sticky lg:top-6">
              <div className="rounded-xl border bg-white p-4 space-y-3">
                <div className="text-sm font-semibold text-slate-800">预览</div>
                <div className="overflow-hidden rounded-lg border bg-slate-50">
                  <img src={previewCover} alt="封面预览" className="h-40 w-full object-cover" />
                </div>
                <div className="space-y-2">
                  <label className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 cursor-pointer">
                    自定义封面
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg"
                      className="sr-only"
                      onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                    />
                  </label>
                  <div className="text-xs text-slate-500">当前封面：{coverFile?.name || "默认封面"}</div>
                </div>
                <div className="space-y-2 text-sm text-slate-700">
                  <div className="text-base font-semibold">{form.title.trim() || "未填写标题"}</div>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                    <span className="rounded bg-slate-100 px-2 py-1">{typeLabel[form.resource_type] || "未选择类型"}</span>
                    <span className="rounded bg-slate-100 px-2 py-1">{sourceLabel[form.source_type]}</span>
                  </div>
                  <div className="text-xs text-slate-500">专业群：{previewGroup || "未选择"}</div>
                  <div className="text-xs text-slate-500">专业：{previewMajor || "未选择"}</div>
                  <div className="text-xs text-slate-500">课程：{courseInput.trim() || "未填写"}</div>
                  <div className="text-xs text-slate-500">
                    标签：{selectedTags.length ? selectedTags.map((t) => t.name).join("、") : pendingTag ? `待添加：${pendingTag}` : "未添加"}
                  </div>
                  <div className="text-xs text-slate-500">摘要：{form.abstract?.trim() || "未填写"}</div>
                  <div className="text-xs text-slate-500">适用人群：{form.audience?.trim() || "未填写"}</div>
                  {file && <div className="text-xs text-slate-500">已选择文件：{file.name}</div>}
                  {form.source_type === "url" && <div className="text-xs text-slate-500">外链：{form.external_url || "未填写"}</div>}
                </div>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
