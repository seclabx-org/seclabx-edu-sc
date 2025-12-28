"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { resourceApi } from "../../../lib/api";

export default function ResourceDetail() {
  const params = useParams();
  const id = Number(params?.id);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!isNaN(id)) {
      resourceApi
        .detail(id)
        .then((d) => setData(d))
        .catch((e) => setError(e.message || "加载失败"));
    }
  }, [id]);

  const handleDownload = async () => {
    if (!data) return;
    setDownloading(true);
    try {
      const res = await resourceApi.download(id);
      if (res.download_url) {
        window.open(res.download_url, "_blank");
      }
    } catch (e: any) {
      setError(e.message || "下载失败");
    } finally {
      setDownloading(false);
    }
  };

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-slate-600">加载中...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{data.title}</h1>
          <p className="text-sm text-slate-600">
            专业：{data.major_name || "—"} · 课程：{data.course_name || "—"} · 标签：
            {(data.tag_names || []).join(" / ") || "—"}
          </p>
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
      <p className="text-sm text-slate-700 whitespace-pre-line">{data.abstract}</p>
      {data.file && (
        <div className="rounded-lg border bg-white p-4 text-sm text-slate-700">
          <div>附件：{data.file.name}</div>
          <div>大小：{Math.round((data.file.size_bytes || 0) / 1024)} KB</div>
          <div>类型：{data.file.mime}</div>
        </div>
      )}
      {!data.can_download && <p className="text-xs text-slate-500">需登录且有权限后才能下载。</p>}
    </div>
  );
}
