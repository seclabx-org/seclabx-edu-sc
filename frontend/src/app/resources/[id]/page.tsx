"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
const sourceLabel: Record<string, string> = { upload: "上传", url: "外链" };

export default function ResourceDetail() {
  const params = useParams();
  const id = Number(params?.id);
  const router = useRouter();
  const { user, loading: authLoading, error: authError } = useAuthGuard(); // 未登录自动跳转
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);

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
    resourceApi
      .preview(id)
      .then((p) => setPreview(p))
      .catch(() => setPreview({ mode: "unsupported", note: "暂不支持在线预览，请下载查看" }));
  }, [id, data]);

  useEffect(() => {
    // 处理需要鉴权拉取的 PDF 预览
    const fetchPreviewBlob = async () => {
      if (!preview || preview.mode !== "pdf_preview" || !preview.url) return;
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (!token) return;
      try {
        const resp = await fetch(preview.url, { headers: { Authorization: `Bearer ${token}` } });
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        setPreviewBlobUrl(url);
      } catch {
        setPreviewBlobUrl(null);
      }
    };
    fetchPreviewBlob();
    return () => {
      if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
    };
  }, [preview, previewBlobUrl]);

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

  const jumpToFilter = () => {
    const params = new URLSearchParams();
    if (data?.group_id) params.set("group_id", data.group_id);
    if (data?.major_id) params.set("major_id", data.major_id);
    if (data?.course_id) params.set("course_id", data.course_id);
    router.push(`/resources${params.toString() ? `?${params.toString()}` : ""}`);
  };

  if (authLoading) return <p className="text-sm text-slate-600">正在校验登录状态...</p>;
  if (!user || authError) {
    return (
      <div className="rounded border bg-white p-4">
        <p className="text-sm text-slate-700">需登录后查看资源详情。</p>
        <Link href={`/login?next=/resources/${id}`} className="text-brand">
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-slate-900">{data.title}</h1>
          <div className="flex flex-wrap gap-2 text-xs text-slate-600">
            <span className="rounded bg-blue-50 px-2 py-1 text-blue-700">{typeLabel[data.resource_type] || data.resource_type || "未填写"}</span>
            <span className="rounded bg-indigo-50 px-2 py-1 text-indigo-700">{sourceLabel[data.source_type] || data.source_type}</span>
            {data.published_at && <span>发布于 {formatTime(data.published_at)}</span>}
            {metaLine && <span className="rounded bg-slate-100 px-2 py-1 text-slate-700">专业群·专业：{metaLine}</span>}
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
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-70"
          >
            {downloading ? "下载中..." : "下载"}
          </button>
        )}
      </div>

      {data.cover_url && (
        <div className="relative w-full overflow-hidden rounded-lg border bg-slate-50 shadow-sm h-56 md:h-64">
          <div
            className="absolute inset-0 bg-center bg-cover blur-xl scale-110 opacity-60"
            style={{ backgroundImage: `url(${data.cover_url})` }}
          />
          <img
            src={data.cover_url}
            alt={data.title}
            className="relative z-10 h-full w-full object-contain"
          />
        </div>
      )}

      {/* 预览区域 */}
      {preview?.mode === "external" && (
        <div className="rounded border bg-white p-4 text-sm text-slate-700">
          <p className="mb-2">外链资源，点击跳转查看：</p>
          <a href={preview.url} target="_blank" rel="noreferrer" className="text-brand underline">
            {preview.url}
          </a>
        </div>
      )}
      {preview?.mode === "inline" && preview.url && (
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
      {preview?.mode === "pdf_preview" && (
        <div className="space-y-2 rounded border bg-white p-4">
          <p className="text-sm text-slate-700">已转换为 PDF 预览</p>
          <iframe src={previewBlobUrl || ""} className="h-[480px] w-full border" title="预览" />
        </div>
      )}
      {preview?.mode === "unsupported" && (
        <div className="rounded border bg-white p-4 text-sm text-slate-700">
          {preview.note || "暂不支持在线预览，请下载查看"}
        </div>
      )}

      <p className="text-sm text-slate-700 whitespace-pre-line">{data.abstract}</p>

      <div className="space-y-1 rounded-lg border bg-white p-4 text-sm text-slate-700">
        <div>类型：{typeLabel[data.resource_type] || data.resource_type || "未填写"}</div>
        <div>来源：{data.source_type === "url" ? "外链" : "上传"}</div>
        <div>标签：{(data.tag_names || []).join(" / ") || "未填写"}</div>
        {metaLine && <div>专业群·专业：{metaLine}</div>}
        {data.course_name && <div>课程：{data.course_name}</div>}
        <div>创建时间：{formatTime(data.created_at)}</div>
        <div>发布时间：{data.published_at ? formatTime(data.published_at) : "未发布"}</div>
        <div>下载次数：{data.download_count ?? 0}</div>
        <div>浏览次数：{data.view_count ?? 0}</div>
        {data.audience && <div>面向人群：{data.audience}</div>}
        {data.duration_seconds && <div>时长：{Math.round(data.duration_seconds / 60)} 分钟</div>}
        {data.owner?.name && <div>发布者：{data.owner.name}</div>}
      </div>

      {data.file && (
        <div className="space-y-1 rounded-lg border bg-white p-4 text-sm text-slate-700">
          <div>文件：{data.file.name}</div>
          <div>大小：{Math.round((data.file.size_bytes || 0) / 1024)} KB</div>
          <div>类型：{data.file.mime}</div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="rounded border border-brand px-3 py-1 text-brand hover:bg-brand hover:text-white disabled:opacity-60"
            >
              预览/下载
            </button>
          </div>
        </div>
      )}

      {!data.can_download && <p className="text-xs text-slate-500">需登录且有权限后才可下载。</p>}
    </div>
  );
}
