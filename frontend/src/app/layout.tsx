import "../app/globals.css";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata = {
  title: "课程思政资源平台",
  description: "信息安全技术应用专业群课程思政资源平台",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const currentYear = new Date().getFullYear();
  const yearLabel = currentYear > 2025 ? `2025–${currentYear}` : "2025";

  return (
    <html lang="zh-CN">
      <body>
        <header className="border-b bg-white/70 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-xl font-semibold text-brand">
              课程思政资源平台
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link href="/resources">资源目录</Link>
              <Link href="/dashboard">教师工作台</Link>
              <Link href="/admin">管理后台</Link>
              <Link href="/login" className="rounded-md border px-3 py-1 text-brand border-brand">
                登录
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto min-h-screen max-w-6xl px-6 py-8">{children}</main>
        <footer className="border-t bg-white py-6 text-center text-sm text-slate-500">
          <div className="inline-flex items-center justify-center gap-2 align-middle">
            <span>© {yearLabel} SeclabX ·</span>
            <a
              href="https://github.com/seclabx-org"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-[6px] align-middle"
            >
              <img
                src="https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png"
                width={20}
                height={20}
                alt="GitHub"
              />
              Open Source on GitHub
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
