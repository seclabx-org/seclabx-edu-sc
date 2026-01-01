"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { metaApi, resourceApi, uploadFile, uploadCover, uploadAttachment } from "../../../../lib/api";
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
  audio: "mp3",
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
  audio: "mp3",
  image: "png、jpg、jpeg",
  doc: "pdf、docx、xlsx、zip",
  policy: "pdf",
  practice: "pdf、docx、zip",
  link: "pdf、docx",
};
const ATTACHMENT_HINT = "pdf、pptx、docx、xlsx、mp4、mp3、png、jpg、jpeg、zip";

const formatBytes = (bytes?: number | null) => {
  if (!bytes || bytes <= 0) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
};

const formatDuration = (seconds?: number | null) => {
  if (!seconds || seconds <= 0) return "未识别";
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}小时${minutes}分${secs}秒`;
  if (minutes > 0) return `${minutes}分${secs}秒`;
  return `${secs}秒`;
};

type FileDropzoneProps = {
  label: string;
  required?: boolean;
  accept?: string;
  hint?: string;
  file: File | null;
  onSelect: (file: File | null) => void;
  multiple?: boolean;
  onSelectMultiple?: (files: File[]) => void;
  actionText?: string;
  helperText?: string;
  compact?: boolean;
};

function FileDropzone({
  label,
  required,
  accept,
  hint,
  file,
  onSelect,
  multiple = false,
  onSelectMultiple,
  actionText = "选择文件",
  helperText = "拖拽文件到此处，或点击选择",
  compact,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const padding = compact ? "px-4 py-4" : "px-5 py-6";
  const badgeSize = compact ? "h-9 w-9 text-xs" : "h-10 w-10 text-sm";

  const handleFiles = (files: FileList | null) => {
    if (multiple && onSelectMultiple) {
      onSelectMultiple(Array.from(files || []));
      return;
    }
    const first = files?.[0] || null;
    onSelect(first);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm text-slate-700">
        {label}
        {required && <span className="ml-1 text-xs text-red-600">*</span>}
      </label>
      <div
        className={[
          "group relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-center text-sm transition",
          padding,
          dragActive
            ? "border-brand bg-brand/5"
            : "border-slate-200 bg-slate-50/80 hover:border-brand/60 hover:bg-white",
        ].join(" ")}
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragActive(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <div className="flex items-center gap-3 text-slate-700">
          <span className={`inline-flex ${badgeSize} items-center justify-center rounded-full border bg-white font-semibold text-brand shadow-sm`}>
            上传
          </span>
          <div className="text-left">
            <div className="text-sm font-semibold">{actionText}</div>
            <div className="text-xs text-slate-500">{helperText}</div>
          </div>
        </div>
        {hint && <div className="text-xs text-slate-500">支持类型：{hint}</div>}
        {file && (
          <div className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-xs text-slate-600">
            已选择：{file.name} · {formatBytes(file.size)}
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
    </div>
  );
}

function NewResourcePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editParam = searchParams.get("edit");
  const editId = editParam ? Number(editParam) : null;
  const isEditing = Boolean(editParam && !isNaN(Number(editParam)));
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
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const durationTouchedRef = useRef(false);
  const [courseInput, setCourseInput] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [selectedTags, setSelectedTags] = useState<Array<{ id?: number; name: string }>>([]);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [editingResource, setEditingResource] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [skipCourseReset, setSkipCourseReset] = useState(false);
  const defaultsAppliedRef = useRef(false);
  const [downloadingAttachment, setDownloadingAttachment] = useState(false);
  const [deletingAttachment, setDeletingAttachment] = useState(false);
  const [attachmentsExpanded, setAttachmentsExpanded] = useState(false);
  const [touched, setTouched] = useState({
    title: false,
    group: false,
    major: false,
    course: false,
    tags: false,
  });

  useEffect(() => {
    Promise.all([metaApi.groups(), metaApi.majors(), metaApi.tags()]).then(([g, m, t]) => {
      const groupList = g || [];
      const majorList = m || [];
      setGroups(groupList);
      setMajors(majorList);
      setTags(t || []);
    });
  }, []);

  useEffect(() => {
    if (isEditing || defaultsAppliedRef.current) return;
    if (!groups.length) return;
    const userGroupId = user?.group_id ?? null;
    const userMajorId = user?.major_id ?? null;
    if (userGroupId) {
      defaultsAppliedRef.current = true;
      setForm((f) => ({
        ...f,
        group_id: userGroupId,
        major_id: userMajorId,
        course_id: null,
      }));
      return;
    }
    const preferred = groups.find((item: any) => item.code === "sec_cluster" || item.name.includes("信息安全技术应用专业群"));
    const defaultGroupId = preferred?.id ?? groups[0]?.id ?? null;
    if (defaultGroupId) {
      defaultsAppliedRef.current = true;
      setForm((f) => ({ ...f, group_id: defaultGroupId, major_id: null, course_id: null }));
    }
  }, [groups, user, isEditing]);

  useEffect(() => {
    if (form.major_id) {
      metaApi.courses(Number(form.major_id)).then((c) => setCourses(c || []));
    } else {
      setCourses([]);
    }
    if (skipCourseReset) {
      setSkipCourseReset(false);
    } else {
      setCourseInput("");
    }
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

  const detectMediaKind = (target: File | null, resourceType: string) => {
    if (resourceType === "video") return "video";
    if (resourceType === "audio") return "audio";
    if (!target) return null;
    const mime = (target.type || "").toLowerCase();
    if (mime.startsWith("video/")) return "video";
    if (mime.startsWith("audio/")) return "audio";
    const name = target.name.toLowerCase();
    if (name.endsWith(".mp4")) return "video";
    if (name.endsWith(".mp3") || name.endsWith(".wav") || name.endsWith(".m4a")) return "audio";
    return null;
  };
  const mediaKind = useMemo(() => detectMediaKind(file, form.resource_type), [file, form.resource_type]);
  const isVideoAudio = Boolean(mediaKind);

  const probeMediaDuration = (target: File, kind: "video" | "audio") =>
    new Promise<number | null>((resolve) => {
      const url = URL.createObjectURL(target);
      const media = document.createElement(kind);
      let timeoutId: number | undefined;
      let resolved = false;
      const finish = (seconds: number | null) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve(seconds);
      };
      const cleanup = () => {
        if (timeoutId) window.clearTimeout(timeoutId);
        URL.revokeObjectURL(url);
        media.remove();
      };
      media.muted = true;
      if (media instanceof HTMLVideoElement) {
        media.playsInline = true;
      }
      media.preload = "metadata";
      media.onloadedmetadata = () => {
        if (Number.isFinite(media.duration) && media.duration > 0) {
          finish(Math.round(media.duration));
          return;
        }
        if (media.duration === Infinity) {
          media.ontimeupdate = () => {
            if (Number.isFinite(media.duration) && media.duration > 0) {
              media.currentTime = 0;
              media.ontimeupdate = null;
              finish(Math.round(media.duration));
            }
          };
          media.currentTime = 1e101;
        }
      };
      media.onloadeddata = () => {
        if (Number.isFinite(media.duration) && media.duration > 0) {
          finish(Math.round(media.duration));
        }
      };
      media.onerror = () => {
        finish(null);
      };
      media.style.position = "fixed";
      media.style.left = "-9999px";
      media.style.width = "1px";
      media.style.height = "1px";
      document.body.appendChild(media);
      media.src = url;
      media.load();
      timeoutId = window.setTimeout(() => {
        finish(null);
      }, 12000);
    });

  useEffect(() => {
    if (!file || !isVideoAudio) return;
    durationTouchedRef.current = false;
    let cancelled = false;
    if (!mediaKind) return;
    const kind = mediaKind;
    probeMediaDuration(file, kind).then((seconds) => {
      if (cancelled || durationTouchedRef.current) return;
      if (seconds && seconds > 0) {
        setForm((f) => ({ ...f, duration_seconds: seconds }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [file, isVideoAudio, form.resource_type]);

  useEffect(() => {
    if (!isEditing || !editId || !user) return;
    setLoadingDetail(true);
    resourceApi
      .detail(editId)
      .then((d: any) => {
        setEditingResource(d);
        setSkipCourseReset(true);
        setForm((f) => ({
          ...f,
          title: d.title || "",
          abstract: d.abstract || "",
          group_id: d.group_id ?? null,
          major_id: d.major_id ?? null,
          course_id: d.course_id ?? null,
          tag_ids: d.tag_ids || [],
          resource_type: d.resource_type || f.resource_type,
          source_type: d.resource_type === "link" ? "url" : "upload",
          file_type: d.file_type || f.file_type,
          external_url: d.external_url || "",
          cover_url: d.cover_url || "",
          duration_seconds: d.duration_seconds ?? null,
          audience: d.audience || "",
        }));
        setCourseInput(d.course_name || "");
        const tagIds = Array.isArray(d.tag_ids) ? d.tag_ids : [];
        const tagNames = Array.isArray(d.tag_names) ? d.tag_names : [];
        const initialTags = tagIds.map((id: number, idx: number) => ({
          id,
          name: tagNames[idx] || String(id),
        }));
        setSelectedTags(initialTags.length ? initialTags : tagNames.map((name: string) => ({ name })));
        setTagInput("");
      })
      .catch((e: any) => setError(e.message || "加载资源失败"))
      .finally(() => setLoadingDetail(false));
  }, [isEditing, editId, user]);

  const baseCourseId = form.course_id ?? editingResource?.course_id ?? null;
  const baseMajorId = form.major_id ?? editingResource?.major_id ?? null;
  const hasExistingCourse = Boolean(isEditing && baseCourseId);

  const validate = () => {
    if (!form.title.trim()) return "请填写标题";
    if (!form.group_id) return "请选择专业群";
    if (!form.major_id) return "请选择专业";
    if (!form.resource_type) return "请选择资源类型";
    if (!courseInput.trim() && !hasExistingCourse) return "请填写课程名称";
    if (hasExistingCourse && baseMajorId && form.major_id && baseMajorId !== form.major_id && !courseInput.trim()) {
      return "已更换专业，请重新填写课程名称";
    }
    if (selectedTags.length === 0) return "请至少添加一个思政主题标签";
    const effectiveSourceType = isLink ? "url" : "upload";
    if (effectiveSourceType === "url") {
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
    if (effectiveSourceType === "upload" && !file && !(isEditing && editingResource?.file)) return "请选择要上传的文件";
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
      const effectiveSourceType = isLink ? "url" : "upload";
      payload.file_type = DEFAULT_EXT_BY_TYPE[form.resource_type] || "pdf";
      if (!isEditing) {
        payload.status = targetStatus;
      }
      payload.source_type = effectiveSourceType;
      if (effectiveSourceType === "url") {
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
        if (hasExistingCourse) {
          payload.course_id = baseCourseId;
          payload.course_name = null;
        } else {
          payload.course_id = null;
          payload.course_name = null;
        }
      }
      const tagIds = selectedTags.filter((t) => t.id).map((t) => t.id);
      const tagNames = selectedTags.filter((t) => !t.id).map((t) => t.name);
      payload.tag_ids = tagIds;
      if (tagNames.length) payload.tag_names = tagNames;
      if (coverFile) {
        payload.cover_url = ""; // 上传封面后端会更新
      }
      if (isEditing && editId) {
        await resourceApi.update(editId, payload);
        if (effectiveSourceType === "upload" && file) {
          const uploaded = await uploadFile(editId, file);
          if (uploaded?.duration_seconds && !durationTouchedRef.current) {
            setForm((f) => ({ ...f, duration_seconds: uploaded.duration_seconds }));
          }
        }
        if (attachmentFiles.length) {
          for (const attachment of attachmentFiles) {
            await uploadAttachment(editId, attachment);
          }
        }
        if (coverFile) {
          await uploadCover(editId, coverFile);
        }
        if (targetStatus === "published" && editingResource?.status !== "published") {
          await resourceApi.publish(editId);
        }
        const redirect = targetStatus === "draft" ? "/dashboard/resources" : "/resources";
        router.push(redirect);
      } else {
        const res = await resourceApi.create(payload);
        if (effectiveSourceType === "upload" && file) {
          const uploaded = await uploadFile(res.id, file);
          if (uploaded?.duration_seconds && !durationTouchedRef.current) {
            setForm((f) => ({ ...f, duration_seconds: uploaded.duration_seconds }));
          }
        }
        if (attachmentFiles.length) {
          for (const attachment of attachmentFiles) {
            await uploadAttachment(res.id, attachment);
          }
        }
        if (coverFile) {
          await uploadCover(res.id, coverFile);
        }
        const redirect = targetStatus === "draft" ? "/dashboard/resources" : "/resources";
        router.push(redirect);
      }
    } catch (e: any) {
      setError(e.message || "创建或上传失败");
    } finally {
      setLoading(false);
    }
  };

  const handleAttachmentDownload = async (attachmentId: number) => {
    if (!editId) return;
    setDownloadingAttachment(true);
    try {
      const res = await resourceApi.downloadAttachment(editId, attachmentId);
      if (res.download_url) window.open(res.download_url, "_blank");
    } catch (e: any) {
      setError(e.message || "附件下载失败");
    } finally {
      setDownloadingAttachment(false);
    }
  };

  const handleAttachmentDelete = async (attachmentId: number) => {
    if (!editId) return;
    if (!window.confirm("确定删除该附件？此操作不可恢复。")) return;
    setDeletingAttachment(true);
    try {
      await resourceApi.deleteAttachment(editId, attachmentId);
      setEditingResource((prev: any) => {
        if (!prev) return prev;
        const nextAttachments = Array.isArray(prev.attachments)
          ? prev.attachments.filter((att: any) => att.id !== attachmentId)
          : [];
        return { ...prev, attachments: nextAttachments };
      });
    } catch (e: any) {
      setError(e.message || "附件删除失败");
    } finally {
      setDeletingAttachment(false);
    }
  };

  const handleMainFileDownload = async () => {
    if (!editId) return;
    try {
      const res = await resourceApi.download(editId);
      if (res.download_url) window.open(res.download_url, "_blank");
    } catch (e: any) {
      setError(e.message || "下载失败");
    }
  };

  const isLink = form.resource_type === "link";
  const uploadSupport = !isLink;
  const typeHint = uploadSupport ? HINT_BY_TYPE[form.resource_type] || "pdf、pptx、docx、xlsx、mp4、png、jpg、zip" : "";
  const accept = uploadSupport ? (HINT_BY_TYPE[form.resource_type] || "").split("、").map((ext) => `.${ext}`).join(",") : undefined;
  const attachmentAccept = ATTACHMENT_HINT.split("、").map((ext) => `.${ext}`).join(",");
  const currentAttachments = Array.isArray(editingResource?.attachments) ? editingResource.attachments : [];
  const existingAttachmentCount = currentAttachments.length;
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
  const previewCover = coverPreviewUrl || form.cover_url || defaultCoverMap[form.resource_type] || "/sample-covers/default-cover.jpg";
  const previewGroup = groups.find((g) => g.id === form.group_id)?.name || "";
  const previewMajor = majors.find((m) => m.id === form.major_id)?.name || "";
  const pendingTag = tagInput.trim();
  const normalize = (value: string) => value.trim().toLowerCase();
  const buildMatches = (items: any[], input: string, limit: number) => {
    const keyword = normalize(input);
    if (!keyword) return [];
    return items
      .map((item) => {
        const name = normalize(item.name || "");
        const score = name === keyword ? 3 : name.startsWith(keyword) ? 2 : name.includes(keyword) ? 1 : 0;
        return { item, score, name };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.name.localeCompare(b.name, "zh-Hans-CN");
      })
      .slice(0, limit)
      .map((entry) => entry.item);
  };
  const courseMatches = useMemo(() => buildMatches(courses, courseInput, 6), [courseInput, courses]);
  const tagMatches = useMemo(() => {
    const candidates = tags.filter((t) => !selectedTags.find((s) => s.name === t.name));
    return buildMatches(candidates, tagInput, 8);
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
            <h1 className="text-2xl font-semibold">{isEditing ? "编辑资源" : "新建资源"}</h1>
            <p className="text-sm text-slate-600">
              {isEditing ? "仅可编辑草稿资源，修改后可保存草稿或直接发布。" : "填写基础信息、教学元信息与资源来源，系统会自动生成默认封面。"}
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-4 pb-20 lg:pb-0">
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
                      onBlur={() => setTouched((prev) => ({ ...prev, title: true }))}
                    />
                    {touched.title && !form.title.trim() && <div className="text-xs text-red-600">请填写标题</div>}
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
                      <label className="text-sm text-slate-700">时长（自动识别，可修改）</label>
                      <input
                        type="number"
                        min={0}
                        className="w-full rounded-md border px-3 py-2 text-sm"
                        value={form.duration_seconds ?? ""}
                        onChange={(e) => {
                          durationTouchedRef.current = true;
                          setForm((f) => ({ ...f, duration_seconds: e.target.value ? Number(e.target.value) : null }));
                        }}
                      />
                      <div className="text-xs text-slate-500">当前时长：{formatDuration(form.duration_seconds)}</div>
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
                          const nextSource = nextType === "link" ? "url" : "upload";
                          setForm((f) => ({
                            ...f,
                            resource_type: nextType,
                            file_type: DEFAULT_EXT_BY_TYPE[nextType] || "pdf",
                            source_type: nextSource,
                          }));
                        }}
                      >
                        {RESOURCE_TYPE_OPTIONS.map((opt) => {
                          const hint = HINT_BY_TYPE[opt.value];
                          const label = hint ? `${opt.label}（${hint}）` : opt.label;
                          return (
                            <option key={opt.value} value={opt.value}>
                              {label}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    {uploadSupport && !isLink && (
                      <div className="md:col-span-2">
                        <FileDropzone
                          label="主文件（用于预览/下载）"
                          required
                          accept={accept}
                          hint={typeHint}
                          file={file}
                          onSelect={setFile}
                          actionText="选择资源文件"
                          helperText={isEditing ? "拖拽文件到此处，或点击选择（上传新文件将替换主文件）" : undefined}
                        />
                        {isEditing && file && (
                          <div className="text-xs text-slate-500">
                            已选择新文件，将替换当前主文件。
                            <button
                              type="button"
                              className="ml-2 text-brand hover:underline"
                              onClick={() => setFile(null)}
                            >
                              清除选择
                            </button>
                          </div>
                        )}
                        {isEditing && !file && (
                          <div className="text-xs text-slate-500">未选择新文件，将保留当前主文件。</div>
                        )}
                      </div>
                    )}
                    {isLink && (
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
                  {isEditing && editingResource && (
                    <div className="space-y-2 md:col-span-2 text-sm text-slate-700">
                      <div className="font-semibold text-slate-800">当前资源</div>
                      {editingResource.source_type === "url" ? (
                        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                          外链地址：{editingResource.external_url || "未填写"}
                        </div>
                      ) : editingResource.file ? (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                          <div>
                            <div>主文件：{editingResource.file.name}</div>
                            <div className="text-xs text-slate-500">大小：{formatBytes(editingResource.file.size_bytes)}</div>
                          </div>
                          <button
                            type="button"
                            className="rounded border border-brand px-3 py-1 text-xs text-brand hover:bg-brand hover:text-white"
                            onClick={handleMainFileDownload}
                          >
                            下载主文件
                          </button>
                        </div>
                      ) : (
                        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">未上传主文件</div>
                      )}
                      {currentAttachments.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-sm font-semibold text-slate-800">附件列表</div>
                          {currentAttachments.map((att: any) => (
                            <div key={att.id} className="flex flex-wrap items-center gap-3 rounded border border-slate-200 px-3 py-2">
                              <div className="min-w-0 flex-1">
                                <div className="truncate">{att.name}</div>
                                <div className="text-xs text-slate-500">大小：{formatBytes(att.size_bytes)}</div>
                              </div>
                              <div className="ml-auto flex items-center gap-2">
                                <button
                                  type="button"
                                  className="rounded border border-brand px-3 py-1 text-xs text-brand hover:bg-brand hover:text-white disabled:opacity-60"
                                  disabled={downloadingAttachment}
                                  onClick={() => handleAttachmentDownload(att.id)}
                                >
                                  下载附件
                                </button>
                                <button
                                  type="button"
                                  className="rounded border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-60"
                                  disabled={deletingAttachment}
                                  onClick={() => handleAttachmentDelete(att.id)}
                                >
                                  删除附件
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="space-y-2 md:col-span-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-slate-800">附件（可选，仅下载）</div>
                      <button
                        type="button"
                        className="rounded border border-slate-200 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
                        onClick={() => setAttachmentsExpanded((prev) => !prev)}
                      >
                        {attachmentsExpanded ? "收起附件" : "添加附件"}
                      </button>
                    </div>
                    {!attachmentsExpanded && (
                      <div className="text-xs text-slate-500">
                        {existingAttachmentCount > 0 ? `已有 ${existingAttachmentCount} 个附件` : "暂无已上传附件"}
                        {attachmentFiles.length > 0 ? `，已新增 ${attachmentFiles.length} 个附件` : ""}
                      </div>
                    )}
                    {attachmentsExpanded && (
                      <div className="space-y-2">
                        <FileDropzone
                          label="附件上传"
                          accept={attachmentAccept}
                          hint={ATTACHMENT_HINT}
                          file={null}
                          multiple
                          onSelect={() => {}}
                          onSelectMultiple={(incoming) => {
                            if (!incoming.length) return;
                            setAttachmentFiles((prev) => [...prev, ...incoming]);
                          }}
                          actionText="选择附件"
                          helperText="拖拽文件到此处，或点击选择"
                        />
                        {attachmentFiles.length > 0 && (
                          <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                            {attachmentFiles.map((f) => (
                              <span key={`${f.name}-${f.lastModified}`} className="rounded bg-slate-100 px-2 py-1">
                                {f.name}
                                <button
                                  type="button"
                                  className="ml-2 text-slate-500 hover:text-slate-700"
                                  onClick={() =>
                                    setAttachmentFiles((prev) => prev.filter((item) => item !== f))
                                  }
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="text-xs text-slate-500">附件仅支持下载，不提供在线预览。</div>
                      </div>
                    )}
                  </div>
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
                      onBlur={() => setTouched((prev) => ({ ...prev, group: true }))}
                    >
                      <option value="">请选择</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                    {touched.group && !form.group_id && <div className="text-xs text-red-600">请选择专业群</div>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-slate-700">
                      专业<span className="ml-1 text-xs text-red-600">*</span>
                    </label>
                    <select
                      className="w-full rounded-md border px-3 py-2 text-sm"
                      value={form.major_id ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, major_id: e.target.value ? Number(e.target.value) : null, course_id: null }))}
                      onBlur={() => setTouched((prev) => ({ ...prev, major: true }))}
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
                    {touched.major && !form.major_id && <div className="text-xs text-red-600">请选择专业</div>}
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
                      onBlur={() => setTouched((prev) => ({ ...prev, course: true }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && courseMatches.length > 0) {
                          e.preventDefault();
                          setCourseInput(courseMatches[0].name);
                        }
                      }}
                    />
                    {touched.course && !courseInput.trim() && !hasExistingCourse && (
                      <div className="text-xs text-red-600">请填写课程名称</div>
                    )}
                    {hasExistingCourse && !courseInput.trim() && (
                      <div className="text-xs text-slate-500">
                        {baseMajorId && form.major_id && baseMajorId !== form.major_id
                          ? "已更换专业，请重新填写课程名称。"
                          : "已保留原课程关联，可直接保存。"}
                      </div>
                    )}
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
                        onBlur={() => setTouched((prev) => ({ ...prev, tags: true }))}
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
                    {touched.tags && selectedTags.length === 0 && (
                      <div className="text-xs text-red-600">请至少添加一个思政主题标签</div>
                    )}
                  </div>
                </div>
              </section>

              {loadingDetail && <div className="rounded bg-slate-50 px-3 py-2 text-sm text-slate-600">正在加载资源详情...</div>}
              {error && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
              <div className="sticky bottom-4 rounded-xl border bg-white p-4 flex flex-wrap gap-3 items-center justify-between">
                <div className="text-xs text-slate-500">带 * 为必填项</div>
                <div className="flex gap-3">
                  <button
                    onClick={() => submit("draft")}
                    disabled={loading}
                    className="rounded-md border border-brand px-4 py-2 text-sm font-semibold text-brand hover:bg-brand hover:text-white disabled:opacity-70"
                  >
                    {loading ? "提交中..." : isEditing ? "保存修改" : "保存草稿"}
                  </button>
                  <button
                    onClick={() => submit("published")}
                    disabled={loading}
                    className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
                  >
                    {loading ? "提交中..." : isEditing ? "发布资源" : "直接发布"}
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
                  <FileDropzone
                    label="自定义封面"
                    accept=".png,.jpg,.jpeg"
                    hint="仅支持 PNG/JPG/JPEG"
                    file={coverFile}
                    onSelect={setCoverFile}
                    actionText="选择封面图片"
                    helperText="拖拽或点击上传"
                    compact
                  />
                  <div className="text-xs text-slate-500">当前封面：{coverFile?.name || "默认封面"}</div>
                </div>
                <div className="space-y-2 text-sm text-slate-700">
                  <div className="text-base font-semibold">{form.title.trim() || "未填写标题"}</div>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                    <span className="rounded bg-slate-100 px-2 py-1">{typeLabel[form.resource_type] || "未选择类型"}</span>
                  </div>
                  <div className="text-xs text-slate-500">专业群：{previewGroup || "未选择"}</div>
                  <div className="text-xs text-slate-500">专业：{previewMajor || "未选择"}</div>
                  <div className="text-xs text-slate-500">课程：{courseInput.trim() || "未填写"}</div>
                  <div className="text-xs text-slate-500">
                    标签：{selectedTags.length ? selectedTags.map((t) => t.name).join("、") : pendingTag ? `待添加：${pendingTag}` : "未添加"}
                  </div>
                  <div className="text-xs text-slate-500">摘要：{form.abstract?.trim() || "未填写"}</div>
                  <div className="text-xs text-slate-500">适用人群：{form.audience?.trim() || "未填写"}</div>
                  {isVideoAudio && <div className="text-xs text-slate-500">时长：{formatDuration(form.duration_seconds)}</div>}
                  {file && <div className="text-xs text-slate-500">已选择文件：{file.name}</div>}
                  {isLink && <div className="text-xs text-slate-500">外链：{form.external_url || "未填写"}</div>}
                </div>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

export default function NewResourcePage() {
  return (
    <Suspense fallback={<div className="rounded border bg-white p-4 text-sm text-slate-600">正在加载页面...</div>}>
      <NewResourcePageContent />
    </Suspense>
  );
}
