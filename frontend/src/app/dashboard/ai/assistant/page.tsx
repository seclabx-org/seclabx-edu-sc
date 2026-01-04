"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuthGuard } from "../../../../lib/useAuthGuard";
import { aiApi } from "../../../../lib/api";

type ChatMessage = { role: "user" | "assistant"; content: string };
type ChatSession = { id: number; title: string; updated_at?: string | null; message_count?: number };

const PRESET_PROMPTS = [
  "为“网络安全法”生成课堂导入与讨论题",
  "给出一次思政课堂活动设计，主题是“网络伦理”",
  "生成一份课程思政案例，面向大一新生",
];

export default function AiAssistantPage() {
  const { user, loading } = useAuthGuard();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = endRef.current;
    if (!el || typeof window === "undefined") return;
    const threshold = 160;
    const scrollTop = window.scrollY;
    const viewportHeight = window.innerHeight;
    const docHeight = document.documentElement.scrollHeight;
    const nearBottom = scrollTop + viewportHeight >= docHeight - threshold;
    if (nearBottom) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [messages, submitting]);

  const resetChat = () => {
    setMessages([]);
    setInput("");
    setError(null);
    setActiveSessionId(null);
  };

  const loadSessions = async () => {
    try {
      const data = await aiApi.sessions();
      setSessions(data.items || []);
      if (!activeSessionId && data.items?.length) {
        const first = data.items[0];
        setActiveSessionId(first.id);
        try {
          const detail = await aiApi.session(first.id);
          setMessages(detail.messages || []);
        } catch {
          setMessages([]);
        }
      }
    } catch {
      setSessions([]);
    }
  };

  const openSession = async (sessionId: number) => {
    setActiveSessionId(sessionId);
    setError(null);
    setInput("");
    try {
      const detail = await aiApi.session(sessionId);
      setMessages(detail.messages || []);
    } catch (err: any) {
      setMessages([]);
      setError(err?.message || "加载对话失败，请稍后重试");
    }
  };

  useEffect(() => {
    if (user) {
      loadSessions();
    }
  }, [user]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || submitting) return;
    setInput("");
    setError(null);
    setSubmitting(true);

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);

    try {
      const data = await aiApi.chat({
        messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        session_id: activeSessionId,
      });
      const reply = data?.content || "";
      if (!activeSessionId && data?.session_id) {
        setActiveSessionId(data.session_id);
      }
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      loadSessions();
    } catch (e: any) {
      setError(e.message || "调用失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="rounded border bg-white p-6 text-sm text-slate-600">正在校验登录状态...</div>;
  }

  if (!user) return null;

  const footerClass = showSidebar
    ? "fixed bottom-0 left-0 right-0 z-40 border-t bg-white px-3 py-3 lg:pl-56"
    : "fixed bottom-0 left-0 right-0 z-40 border-t bg-white px-3 py-3";

  return (
    <div
      className="w-screen overflow-x-hidden bg-slate-50"
      style={{
        fontFamily: "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",
        marginLeft: "calc(50% - 50vw)",
        marginRight: "calc(50% - 50vw)",
      }}
    >
      <div className="flex flex-col lg:flex-row lg:h-[calc(100vh-160px)] lg:overflow-hidden">
        {showSidebar && (
          <aside className="hidden w-56 shrink-0 border-r bg-white lg:fixed lg:bottom-0 lg:left-0 lg:top-[72px] lg:z-20 lg:flex lg:flex-col">
            <div className="border-b bg-white p-4">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">AI Assistant</div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <span className="rounded-full bg-brand/10 px-2 py-1 text-[10px] text-brand">Beta</span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={() => setShowSidebar(false)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setShowSidebar(false);
                      }
                    }}
                    className="cursor-pointer select-none text-slate-500 hover:text-brand"
                  >
                    收起
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={resetChat}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-brand/50"
              >
                新对话
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 lg:min-h-0">
              <div className="text-xs text-slate-500">最近对话</div>
              <div className="mt-2 space-y-2 text-sm text-slate-700">
                {sessions.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-2 text-slate-400">
                    暂无对话
                  </div>
                ) : (
                  sessions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => openSession(s.id)}
                      className={
                        s.id === activeSessionId
                          ? "w-full rounded-lg border border-brand bg-brand/5 px-3 py-2 text-left"
                          : "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left hover:border-brand/40"
                      }
                    >
                      <div className="truncate text-sm text-slate-700">{s.title || "未命名对话"}</div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </aside>
        )}

        <div className={`relative flex flex-1 flex-col ${showSidebar ? "lg:pl-56" : "pl-3 lg:pl-4"}`}>
          {!showSidebar && (
            <button
              type="button"
              onClick={() => setShowSidebar(true)}
              className="fixed left-0 top-1/2 z-50 flex h-14 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-slate-300 bg-white text-[12px] text-brand shadow-md hover:bg-brand/10"
              aria-label="展开对话列表"
            >
              <span className="font-semibold">{">"}</span>
            </button>
          )}
          <header className="sticky top-0 z-30 border-b bg-white px-2 py-3">
            <div className="flex w-full items-center justify-between">
              <div className="space-y-1">
                <div className="text-sm text-slate-500">AI工作台 / AI思政助手</div>
                <div className="text-lg font-semibold text-slate-900">AI思政助手</div>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <Link href="/dashboard/ai" className="text-brand hover:underline">
                  返回工作台
                </Link>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto px-0 pb-20 pt-3 lg:min-h-0">
            <div className="w-full space-y-6">
              {messages.length === 0 && (
                <div className="rounded-2xl border border-dashed bg-white px-4 py-4 text-sm text-slate-600">
                  <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">Quick Start</div>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_PROMPTS.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className="rounded-full border bg-white px-3 py-1 text-xs text-slate-600 hover:border-brand/50"
                        onClick={() => send(item)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, idx) => (
                <div key={`${msg.role}-${idx}`} className="flex">
                  <div
                    className={
                      msg.role === "user"
                        ? "ml-auto max-w-[96%] rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-sm"
                        : "mr-auto max-w-[96%] rounded-2xl bg-white px-4 py-3 text-sm text-slate-800 shadow-sm"
                    }
                  >
                    <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                  </div>
                </div>
              ))}

              {submitting && (
                <div className="flex">
                  <div className="mr-auto rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-500">正在生成...</div>
                </div>
              )}
              <div ref={endRef} />
            </div>
          </main>

          <footer className={footerClass}>
            <div className="mx-auto w-full max-w-3xl">
              {error && <div className="mb-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
              <div className="flex items-end gap-2 rounded-2xl border bg-white px-3 py-2 shadow-md">
                <textarea
                  className="min-h-[48px] flex-1 resize-none bg-transparent px-2 py-1 text-sm outline-none"
                  placeholder="输入你的问题或需求..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => send()}
                  disabled={submitting}
                  className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
                >
                  {submitting ? "生成中..." : "发送"}
                </button>
                <button
                  type="button"
                  onClick={resetChat}
                  className="rounded-full border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  清空
                </button>
              </div>
              <div className="mt-2 text-xs text-slate-400">提示：Ctrl/Cmd + Enter 发送</div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
