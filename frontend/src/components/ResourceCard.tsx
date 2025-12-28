import Link from "next/link";

export type ResourceItem = {
  id: number;
  title: string;
  abstract: string;
  major_name?: string | null;
  course_name?: string | null;
  tag_names?: string[];
  status?: string;
  download_count?: number;
  published_at?: string | null;
  can_edit?: boolean;
};

export function ResourceCard({ item, href }: { item: ResourceItem; href?: string }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-slate-900">
            {href ? <Link href={href}>{item.title}</Link> : item.title}
          </h3>
          <p className="mt-2 text-sm text-slate-700 line-clamp-2">{item.abstract}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
            {item.major_name && <span className="rounded bg-brand-light px-2 py-1">专业：{item.major_name}</span>}
            {item.course_name && <span className="rounded bg-brand-light px-2 py-1">课程：{item.course_name}</span>}
            {(item.tag_names || []).map((t) => (
              <span key={t} className="rounded bg-slate-100 px-2 py-1">
                {t}
              </span>
            ))}
          </div>
        </div>
        {item.status && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs uppercase text-slate-600">{item.status}</span>
        )}
      </div>
    </div>
  );
}
