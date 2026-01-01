import Link from "next/link";

export type ResourceItem = {
  id: number;
  title: string;
  abstract: string;
  resource_type?: string;
  group_name?: string | null;
  major_name?: string | null;
  course_name?: string | null;
  tag_names?: string[];
  status?: string;
  download_count?: number;
  view_count?: number;
  published_at?: string | null;
  cover_url?: string | null;
  can_edit?: boolean;
  can_publish?: boolean;
  can_archive?: boolean;
  owner?: { id?: number; name?: string | null; username?: string | null };
};

export function ResourceCard({ item, href }: { item: ResourceItem; href?: string }) {
  const statusLabel: Record<string, string> = {
    draft: "草稿",
    published: "已发布",
  };
  const statusClass: Record<string, string> = {
    draft: "bg-[#e2e8f0] text-[#475569]",
    published: "bg-[#ecfdf3] text-[#15803d]",
  };
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
  const typeClass: Record<string, string> = {
    video: "bg-orange-50 text-orange-700",
    audio: "bg-purple-50 text-purple-700",
    image: "bg-pink-50 text-pink-700",
    slide: "bg-sky-50 text-sky-700",
    doc: "bg-cyan-50 text-cyan-700",
    policy: "bg-amber-50 text-amber-700",
    text: "bg-slate-100 text-slate-700",
    practice: "bg-slate-100 text-slate-700",
    link: "bg-indigo-50 text-indigo-700",
  };
  const cover = item.cover_url || "/sample-covers/default-cover.jpg";
  const metaLine = [item.group_name, item.major_name].filter(Boolean).join(" · ");

  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <div className="flex gap-4 p-3">
        <div className="relative w-52 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100 shadow-inner" style={{ aspectRatio: "16/9" }}>
          <img src={cover} alt={item.title} className="h-full w-full object-cover" />
          {item.status && (
            <span
              className={`absolute right-2 top-2 rounded-full px-3 py-1 text-[11px] ${statusClass[item.status] || "bg-slate-100 text-slate-600"}`}
            >
              {statusLabel[item.status] || item.status}
            </span>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-start gap-2">
            <h3 className="text-lg font-semibold text-slate-900 leading-6 line-clamp-2">
              {href ? <Link href={href}>{item.title}</Link> : item.title}
            </h3>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {item.resource_type && (
              <span className={`rounded px-2 py-1 ${typeClass[item.resource_type] || "bg-slate-100 text-slate-700"}`}>
                {typeLabel[item.resource_type] || item.resource_type}
              </span>
            )}
            {item.owner?.name && <span className="rounded bg-slate-100 px-2 py-1 text-slate-700">发布者：{item.owner.name}</span>}
          </div>
          <p className="text-sm text-slate-700 line-clamp-2">{item.abstract}</p>
          {metaLine && (
            <div className="text-xs text-slate-600 bg-slate-50 rounded px-2 py-1 inline-flex items-center gap-2">
              <span>{metaLine}</span>
              {item.course_name && <span className="text-[11px] text-slate-500" title={`课程：${item.course_name}`}>课程：{item.course_name}</span>}
            </div>
          )}
          <div className="flex flex-wrap gap-2 text-xs text-slate-600">
            {(item.tag_names || []).map((t) => (
              <span key={t} className="rounded bg-slate-100 px-2 py-1">
                {t}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-slate-500">
            {typeof item.download_count === "number" && <span>下载 {item.download_count}</span>}
            {typeof item.view_count === "number" && <span>浏览 {item.view_count}</span>}
            {item.published_at && <span>发布于 {item.published_at?.slice(0, 10)}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
