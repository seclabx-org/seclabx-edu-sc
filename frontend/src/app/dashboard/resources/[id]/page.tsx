"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { resourceApi } from "../../../../lib/api";
import { useAuthGuard } from "../../../../lib/useAuthGuard";

const statusLabel: Record<string, string> = {
  draft: "草稿",
  published: "已发布",
};

export default function ResourceDetailPage() {
  const params = useParams();
  const id = Number(params?.id);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuthGuard();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const rawBack = searchParams.get("back");
  const backTarget = (() => {
    if (!rawBack) return null;
    let decoded = rawBack;
    try {
      decoded = decodeURIComponent(rawBack);
    } catch {
      decoded = rawBack;
    }
    return decoded.startsWith("/") ? decoded : null;
  })();

  const load = () => {
    resourceApi
      .detail(id)
      .then((d) => setData(d))
      .catch((e) => setError(e.message || "加载失败"));
  };

  useEffect(() => {
    if (!isNaN(id)) {
      load();
    }
  }, [id]);

  const handlePublish = async () => {
    await resourceApi.publish(id);
    load();
  };

  const handleArchive = async () => {
    await resourceApi.archive(id);
    load();
  };

  const handleDelete = async () => {
    if (!window.confirm("确定删除该资源？此操作不可恢复。")) return;
    setDeleting(true);
    try {
      await resourceApi.remove(id);
      window.alert("删除成功");
      window.location.href = "/dashboard/resources";
    } catch (e: any) {
      window.alert(e.message || "删除失败");
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = async () => {
    try {
      const res = await resourceApi.download(id);
      if (res.download_url) {
        window.open(res.download_url, "_blank");
      }
    } catch (e: any) {
      setError(e.message || "下载失败");
    }
  };

  const handleAttachmentDownload = async (attachmentId: number) => {
    try {
      const res = await resourceApi.downloadAttachment(id, attachmentId);
      if (res.download_url) {
        window.open(res.download_url, "_blank");
      }
    } catch (e: any) {
      setError(e.message || "附件下载失败");
    }
  };
  const handleBack = () => {
    if (backTarget) {
      router.push(backTarget);
      return;
    }
    router.back();
  };

  if (loading) return <p className="text-sm text-slate-600">正在校验登录状态...</p>;
  if (error) {
    return (
      <div className="rounded border bg-white p-4">
        <p className="text-sm text-red-600">{error}</p>
        <Link href="/login" className="text-brand">
          前往登录
        </Link>
      </div>
    );
  }
  if (!data) return <p className="text-sm text-slate-600">加载中...</p>;

  const isAdmin = user?.role === "admin";
  const isOwner = Boolean(data?.can_edit);
  const canEditDraft = Boolean(data?.can_edit) && data.status === "draft";
  const canPublish = Boolean(data?.can_publish ?? ((isAdmin || isOwner) && data.status !== "published"));
  const canArchive = Boolean(data?.can_archive ?? ((isAdmin || isOwner) && data.status === "published"));
  const canDelete =
    (isAdmin && data.status !== "published") || // 管理员可删草稿/未发布，如需删已发布请放开此限制
    (isOwner && data.status === "draft");
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
          >
            ← 返回
          </button>
          <h1 className="text-2xl font-semibold">{data.title}</h1>
          <p className="text-sm text-slate-600">状态：{statusLabel[data.status] || data.status}</p>
          <p className="text-xs text-slate-500">类型：{data.resource_type || "未填写"}</p>
        </div>
        <div className="flex gap-2">
          {data.can_download && (
            <button onClick={handleDownload} className="rounded-md border px-3 py-2 text-sm text-brand border-brand">
              下载
            </button>
          )}
          {canEditDraft && (
            <Link href={`/dashboard/resources/new?edit=${id}`} className="rounded-md border px-3 py-2 text-sm text-slate-700">
              编辑
            </Link>
          )}
          {canPublish && (
            <button onClick={handlePublish} className="rounded-md bg-brand px-3 py-2 text-sm text-white">
              发布
            </button>
          )}
          {canArchive && (
            <button onClick={handleArchive} className="rounded-md bg-slate-800 px-3 py-2 text-sm text-white">
              下架
            </button>
          )}
          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-md bg-red-600 px-3 py-2 text-sm text-white disabled:opacity-70"
            >
              {deleting ? "删除中..." : "删除"}
            </button>
          )}
        </div>
      </div>
      <p className="text-sm text-slate-700">{data.abstract}</p>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-800">基本信息</h3>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            <li>类型：{data.resource_type || "未填写"}</li>
            <li>专业群：{data.group_name || "未填写"}</li>
            <li>专业：{data.major_name || "未填写"}</li>
            <li>课程：{data.course_name || "未填写"}</li>
            <li>标签：{(data.tag_names || []).join(" / ") || "未填写"}</li>
            <li>创建时间：{formatTime(data.created_at)}</li>
            <li>发布时间：{data.published_at ? formatTime(data.published_at) : "未发布"}</li>
            <li>下载次数：{data.download_count ?? 0}</li>
            <li>面向人群：{data.audience || "未填写"}</li>
            {(data.resource_type === "video" || data.resource_type === "audio") && (
              <li>时长：{formatDuration(data.duration_seconds)}</li>
            )}
          </ul>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-800">文件</h3>
          {data.source_type === "url" ? (
            <div className="text-sm text-slate-700">
              <p>链接：{data.external_url || "未填写"}</p>
            </div>
          ) : data.file ? (
            <div className="text-sm text-slate-700">
              <p>名称：{data.file.name}</p>
              <p>大小：{formatBytes(data.file.size_bytes)}</p>
            </div>
          ) : (
            <p className="text-sm text-slate-600">尚未上传文件。</p>
          )}
          {info && <p className="mt-2 text-xs text-green-700">{info}</p>}
        </div>
        <div className="rounded-lg border bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-800">附件</h3>
          {Array.isArray(data.attachments) && data.attachments.length > 0 ? (
            <div className="mt-2 space-y-2 text-sm text-slate-700">
              {data.attachments.map((att: any) => (
                <div key={att.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 px-3 py-2">
                  <div>
                    <p>名称：{att.name}</p>
                    <p className="text-xs text-slate-500">大小：{formatBytes(att.size_bytes)}</p>
                  </div>
                  <button
                    onClick={() => handleAttachmentDownload(att.id)}
                    className="rounded-md border px-3 py-1 text-xs text-brand border-brand"
                  >
                    下载
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-600">暂无附件。</p>
          )}
        </div>
      </div>
    </div>
  );
}
