"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { resourceApi } from "../../../lib/api";
import { useAuthGuard } from "../../../lib/useAuthGuard";

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

function ResourceDetailInner() {
  const params = useParams();
  const id = Number(params?.id);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, error: authError } = useAuthGuard();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewBlobLoading, setPreviewBlobLoading] = useState(false);
  const [previewBlobError, setPreviewBlobError] = useState<string | null>(null);
  const [previewRetryToken, setPreviewRetryToken] = useState(0);
  const previewBlobRef = useRef<string | null>(null);
  const rawBack = searchParams.get("back");
  const backTarget = useMemo(() => {
    if (!rawBack) return null;
    let decoded = rawBack;
    try {
      decoded = decodeURIComponent(rawBack);
    } catch {
      decoded = rawBack;
    }
    return decoded.startsWith("/") ? decoded : null;
  }, [rawBack]);

  const metaLine = useMemo(() => {
    const parts = [data?.group_name, data?.major_name].filter(Boolean);
    return parts.join(" · ");
  }, [data]);

  useEffect(() => {
    if (authLoading || authError || isNaN(id)) return;
    resourceApi
      .detail(id)
      .then((d) => setData(d))
      .catch((e) => setError(e.message || "加载失败"));
  }, [id, authLoading, authError]);

  useEffect(() => {
    if (!data) return;
    setPreview(null);
    setPreviewLoading(true);
    resourceApi
      .preview(id)
      .then((p) => setPreview(p))
      .catch(() => setPreview({ mode: "unsupported", note: "暂不支持在线预览，请下载查看" }))
      .finally(() => setPreviewLoading(false));
  }, [id, data]);

  useEffect(() => {
    const fetchPreviewBlob = async () => {
      if (!preview || preview.mode !== "pdf_preview" || !preview.url) {
        if (previewBlobRef.current) {
          URL.revokeObjectURL(previewBlobRef.current);
          previewBlobRef.current = null;
        }
        setPreviewBlobUrl(null);
        setPreviewBlobLoading(false);
        setPreviewBlobError(null);
        return;
      }
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (!token) {
        setPreviewBlobError("请登录后查看预览");
        return;
      }
      setPreviewBlobLoading(true);
      setPreviewBlobError(null);
      try {
        const resp = await fetch(preview.url, { headers: { Authorization: `Bearer ${token}` } });
        if (!resp.ok) throw new Error("preview_fetch_failed");
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        if (previewBlobRef.current) {
          URL.revokeObjectURL(previewBlobRef.current);
        }
        previewBlobRef.current = url;
        setPreviewBlobUrl(url);
      } catch {
        setPreviewBlobUrl(null);
        setPreviewBlobError("预览加载失败，请稍后重试或下载查看");
      } finally {
        setPreviewBlobLoading(false);
      }
    };
    fetchPreviewBlob();
    return () => {
      if (previewBlobRef.current) {
        URL.revokeObjectURL(previewBlobRef.current);
        previewBlobRef.current = null;
      }
    };
  }, [preview, previewRetryToken]);

  const handleDownload = async () => {
    if (!data) return;
    setDownloading(true);
    try {
      const res = await resourceApi.download(id);
      if (res.download_url) window.open(res.download_url, "_blank");
    } catch (e: any) {
      setError(e.message || "下载失败");
    } finally {
      setDownloading(false);
    }
  };

  const handleAttachmentDownload = async (attachmentId: number) => {
    if (!data) return;
    setDownloading(true);
    try {
      const res = await resourceApi.downloadAttachment(id, attachmentId);
      if (res.download_url) window.open(res.download_url, "_blank");
    } catch (e: any) {
      setError(e.message || "附件下载失败");
    } finally {
      setDownloading(false);
    }
  };

  const jumpToFilter = () => {
    const params = new URLSearchParams();
    if (data?.group_id) params.set("group_id", data.group_id);
    if (data?.major_id) params.set("major_id", data.major_id);
    if (data?.course_id) params.set("course_id", data.course_id);
    router.push(`/resources${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const handleBack = () => {
    if (backTarget) {
      router.push(backTarget);
      return;
    }
    router.back();
  };

  if (authLoading) return <p className="text-sm text-slate-600">正在校验登录状态...</p>;
  if (!user || authError) {
    const nextTarget = backTarget ? `/resources/${id}?back=${encodeURIComponent(backTarget)}` : `/resources/${id}`;
    return (
      <div className="rounded border bg-white p-4">
        <p className="text-sm text-slate-700">需登录后查看资源详情。</p>
        <Link href={`/login?next=${encodeURIComponent(nextTarget)}`} className="text-brand">
          去登录
        </Link>
      </div>
    );
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-slate-600">加载中...</p>;

  const formatTime = (v?: string | null) => {
    if (!v) return "未记录";
    const d = new Date(v);
    return isNaN(d.getTime()) ? v : d.toLocaleString("zh-CN", { hour12: false, timeZone: "Asia/Shanghai" });
  };

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

  const showPreviewLoading = previewLoading || (preview?.mode === "pdf_preview" && previewBlobLoading);
  const previewLoadingText = preview?.mode === "pdf_preview" ? "正在生成 PDF 预览" : "正在加载预览";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <button onClick={handleBack} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
            ← 返回
          </button>
          <h1 className="text-2xl font-semibold text-slate-900">{data.title}</h1>
          <div className="flex flex-wrap gap-2 text-xs text-slate-600">
            <span className="rounded bg-blue-50 px-2 py-1 text-blue-700">
              {typeLabel[data.resource_type] || data.resource_type || "未填写"}
            </span>
            {data.published_at && <span>发布于 {formatTime(data.published_at)}</span>}
            {metaLine && <span className="rounded bg-slate-100 px-2 py-1 text-slate-700">专业群 · 专业：{metaLine}</span>}
            {data.course_name && (
              <span className="rounded bg-slate-50 px-2 py-1 text-slate-600" title={`课程：${data.course_name}`}>
                课程：{data.course_name}
              </span>
            )}
          </div>
          {(data.group_id || data.major_id || data.course_id) && (
            <div className="flex flex-wrap gap-2 text-xs text-slate-600">
              <button className="rounded border border-brand px-3 py-1 text-brand hover:bg-brand hover:text-white" onClick={jumpToFilter}>
                跳转到筛选结果
              </button>
            </div>
          )}
        </div>
        {data.can_download && (
          <button onClick={handleDownload} disabled={downloading} className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-70">
            {downloading ? "下载中..." : "下载"}
          </button>
        )}
      </div>

      {data.cover_url && (
        <div className="relative h-56 w-full overflow-hidden rounded-lg border bg-slate-50 shadow-sm md:h-64">
          <div className="absolute inset-0 scale-110 bg-cover bg-center opacity-60 blur-xl" style={{ backgroundImage: `url(${data.cover_url})` }} />
          <img src={data.cover_url} alt={data.title} className="relative z-10 h-full w-full object-contain" />
        </div>
      )}

      {showPreviewLoading && (
        <div className="rounded border bg-white p-4">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
            </span>
            {previewLoadingText}
          </div>
          <div className="mt-3 h-[320px] w-full animate-pulse rounded-lg bg-slate-100" />
        </div>
      )}

      {!showPreviewLoading && preview?.mode === "external" && (
        <div className="rounded border bg-white p-4 text-sm text-slate-700">
          <p className="mb-2">外链资源，点击跳转查看：</p>
          <a href={preview.url} target="_blank" rel="noreferrer" className="text-brand underline">
            {preview.url}
          </a>
        </div>
      )}

      {!showPreviewLoading && preview?.mode === "inline" && preview.url && (
        <div className="space-y-3 rounded border bg-white p-4">
          {preview.ext === "pdf" && <iframe src={preview.url} className="h-[480px] w-full border" title="预览" />}
          {["png", "jpg", "jpeg", "gif", "webp"].includes(preview.ext) && (
            <img src={preview.url} alt={data.title} className="max-h-[480px] w-full object-contain" />
          )}
          {preview.ext === "mp4" && (
            <video controls className="w-full max-h-[480px]" src={preview.url}>
              浏览器不支持视频播放
            </video>
          )}
          {preview.ext === "mp3" && (
            <audio controls className="w-full" src={preview.url}>
              浏览器不支持音频播放
            </audio>
          )}
        </div>
      )}

      {!showPreviewLoading && preview?.mode === "pdf_preview" && (
        <div className="space-y-2 rounded border bg-white p-4">
          <p className="text-sm text-slate-700">已转换为 PDF 预览</p>
          {previewBlobError && (
            <div className="flex flex-wrap items-center gap-3 text-sm text-red-600">
              <span>{previewBlobError}</span>
              <button
                type="button"
                className="rounded border border-brand px-2 py-1 text-brand hover:bg-brand hover:text-white"
                onClick={() => setPreviewRetryToken((n) => n + 1)}
              >
                重新加载预览
              </button>
            </div>
          )}
          {!previewBlobError && <iframe src={previewBlobUrl || ""} className="h-[480px] w-full border" title="预览" />}
        </div>
      )}

      {!showPreviewLoading && preview?.mode === "unsupported" && (
        <div className="rounded border bg-white p-4 text-sm text-slate-700">
          {preview.note || "暂不支持在线预览，请下载查看"}
        </div>
      )}

      <p className="whitespace-pre-line text-sm text-slate-700">{data.abstract}</p>

      <div className="space-y-1 rounded-lg border bg-white p-4 text-sm text-slate-700">
        <div>类型：{typeLabel[data.resource_type] || data.resource_type || "未填写"}</div>
        <div>标签：{(data.tag_names || []).join(" / ") || "未填写"}</div>
        {metaLine && <div>专业群 · 专业：{metaLine}</div>}
        {data.course_name && <div>课程：{data.course_name}</div>}
        <div>创建时间：{formatTime(data.created_at)}</div>
        <div>发布时间：{data.published_at ? formatTime(data.published_at) : "未发布"}</div>
        <div>下载次数：{data.download_count ?? 0}</div>
        <div>浏览次数：{data.view_count ?? 0}</div>
        {data.audience && <div>面向人群：{data.audience}</div>}
        {(data.resource_type === "video" || data.resource_type === "audio") && (
          <div>时长：{formatDuration(data.duration_seconds)}</div>
        )}
        {data.owner?.name && <div>发布者：{data.owner.name}</div>}
      </div>

      {data.file && (
        <div className="space-y-1 rounded-lg border bg-white p-4 text-sm text-slate-700">
          <div>文件：{data.file.name}</div>
          <div>大小：{formatBytes(data.file.size_bytes)}</div>
          <div className="flex gap-2 pt-2">
            <button onClick={handleDownload} disabled={downloading} className="rounded border border-brand px-3 py-1 text-brand hover:bg-brand hover:text-white disabled:opacity-60">
              下载
            </button>
          </div>
        </div>
      )}

      {Array.isArray(data.attachments) && data.attachments.length > 0 && (
        <div className="space-y-2 rounded-lg border bg-white p-4 text-sm text-slate-700">
          <div className="font-semibold text-slate-800">附件</div>
          <div className="space-y-2">
            {data.attachments.map((att: any) => (
              <div key={att.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 px-3 py-2">
                <div className="text-sm text-slate-700">
                  <div>{att.name}</div>
                  <div className="text-xs text-slate-500">大小：{formatBytes(att.size_bytes)}</div>
                </div>
                <button
                  onClick={() => handleAttachmentDownload(att.id)}
                  disabled={downloading}
                  className="rounded border border-brand px-3 py-1 text-xs text-brand hover:bg-brand hover:text-white disabled:opacity-60"
                >
                  下载
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!data.can_download && <p className="text-xs text-slate-500">需登录且有权限后才可下载。</p>}
    </div>
  );
}

export default function ResourceDetailPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-600">加载中...</p>}>
      <ResourceDetailInner />
    </Suspense>
  );
}
