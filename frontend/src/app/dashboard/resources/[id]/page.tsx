"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { resourceApi, uploadFile } from "../../../../lib/api";
import { useAuthGuard } from "../../../../lib/useAuthGuard";

export default function ResourceDetailPage() {
  const params = useParams();
  const id = Number(params?.id);
  const { user, loading } = useAuthGuard();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

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

  const handleUpload = async (file: File) => {
    setUploading(true);
    setInfo(null);
    try {
      await uploadFile(id, file);
      setInfo("上传成功");
      load();
    } catch (e: any) {
      setError(e.message || "上传失败");
    } finally {
      setUploading(false);
    }
  };

  const handlePublish = async () => {
    await resourceApi.publish(id);
    load();
  };

  const handleArchive = async () => {
    await resourceApi.archive(id);
    load();
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

  if (loading) return <p className="text-sm text-slate-600">正在校验登录状态...</p>;
  if (error) {
    return (
      <div className="rounded border bg-white p-4">
        <p className="text-sm text-red-600">{error}</p>
        <Link href="/login" className="text-brand">
          去登录
        </Link>
      </div>
    );
  }
  if (!data) return <p className="text-sm text-slate-600">加载中...</p>;

  const isAdmin = user?.role === "admin";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{data.title}</h1>
          <p className="text-sm text-slate-600">状态：{data.status}</p>
        </div>
        <div className="flex gap-2">
          {data.can_download && (
            <button onClick={handleDownload} className="rounded-md border px-3 py-2 text-sm text-brand border-brand">
              下载
            </button>
          )}
          {isAdmin && data.status !== "published" && (
            <button onClick={handlePublish} className="rounded-md bg-brand px-3 py-2 text-sm text-white">
              发布
            </button>
          )}
          {isAdmin && data.status !== "archived" && (
            <button onClick={handleArchive} className="rounded-md bg-slate-800 px-3 py-2 text-sm text-white">
              下架
            </button>
          )}
        </div>
      </div>
      <p className="text-sm text-slate-700">{data.abstract}</p>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-800">基本信息</h3>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            <li>专业群：{data.group_name || "—"}</li>
            <li>专业：{data.major_name || "—"}</li>
            <li>课程：{data.course_name || "—"}</li>
            <li>标签：{(data.tag_names || []).join(" / ") || "—"}</li>
            <li>创建时间：{data.created_at || "—"}</li>
            <li>发布时间：{data.published_at || "—"}</li>
            <li>下载次数：{data.download_count ?? 0}</li>
          </ul>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-800">附件</h3>
          {data.file ? (
            <div className="text-sm text-slate-700">
              <p>名称：{data.file.name}</p>
              <p>大小：{Math.round((data.file.size_bytes || 0) / 1024)} KB</p>
              <p>类型：{data.file.mime}</p>
            </div>
          ) : (
            <p className="text-sm text-slate-600">尚未上传文件。</p>
          )}
          {data.can_edit && (
            <div className="mt-3">
              <label className="text-sm text-slate-700">上传文件</label>
              <input
                type="file"
                onChange={(e) => e.target.files && handleUpload(e.target.files[0])}
                className="mt-2 block w-full text-sm"
                disabled={uploading}
              />
              {info && <p className="text-xs text-green-700">{info}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
