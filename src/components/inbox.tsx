"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "../lib/auth-client";
import type { Capsule, CapsuleStats, CreateCapsuleInput } from "../contracts";
import { api, ApiRequestError } from "./api";
import { useNow } from "./use-now";
import {
  STATE_LABEL,
  clockOffsetMs,
  describeApiError,
  resolveBlockReason,
  type FilterKey,
} from "./capsule-utils";
import { CapsuleCard } from "./capsule-card";
import { CapsuleForm } from "./capsule-form";
import { ResolvePanel } from "./resolve-panel";
import { FilterTabs } from "./filter-tabs";
import { StatsBar } from "./stats-bar";
import { SealMark } from "./postmark";

type LoadState = "loading" | "ready" | "error";

export function Inbox() {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = authClient.useSession();

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [stats, setStats] = useState<CapsuleStats | null>(null);
  const [offsetMs, setOffsetMs] = useState(0);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const offsetRef = useRef(0);
  const refreshingRef = useRef(false);
  const lastAutoRefreshRef = useRef(0);

  const nowMs = useNow(offsetMs, 1000);

  const goLogin = useCallback(() => {
    router.replace("/login");
  }, [router]);

  const refresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      const [list, s] = await Promise.all([api.listCapsules(), api.stats()]);
      setCapsules(list.capsules);
      setStats(s);
      const off = clockOffsetMs(list.serverNow);
      offsetRef.current = off;
      setOffsetMs(off);
      setLoadState("ready");
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 401) {
        goLogin();
        return;
      }
      setLoadState((prev) => (prev === "ready" ? "ready" : "error"));
      setNotice({ kind: "err", text: describeApiError(e) });
    } finally {
      refreshingRef.current = false;
    }
  }, [goLogin]);

  // 会话守卫：未登录去登录页
  useEffect(() => {
    if (!sessionPending && !session) goLogin();
  }, [sessionPending, session, goLogin]);

  // 登录后拉取数据（异步触发，避免在 effect 体内同步 setState）
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [session, refresh]);

  // 倒计时归零 → 重新向服务器取状态（以服务器 now() 为准）
  useEffect(() => {
    const crossed = capsules.some(
      (c) => c.state === "sealed" && Date.parse(c.unlockAt) <= nowMs,
    );
    if (
      crossed &&
      !refreshingRef.current &&
      nowMs - lastAutoRefreshRef.current > 4000
    ) {
      lastAutoRefreshRef.current = nowMs;
      void refresh();
    }
  }, [nowMs, capsules, refresh]);

  async function handleCreate(input: CreateCapsuleInput): Promise<boolean> {
    setCreating(true);
    setNotice(null);
    try {
      const res = await api.createCapsule(input);
      const off = clockOffsetMs(res.serverNow);
      offsetRef.current = off;
      setOffsetMs(off);
      setCapsules((prev) => [res.capsule, ...prev]);
      setNotice({ kind: "ok", text: "已封存。到揭晓时间后再来记录结果。" });
      setFormOpen(false);
      void api.stats().then(setStats).catch(() => {});
      return true;
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 401) {
        goLogin();
        return false;
      }
      setNotice({ kind: "err", text: describeApiError(e) });
      return false;
    } finally {
      setCreating(false);
    }
  }

  async function handleResolve(capsule: Capsule, outcome: boolean, reflection?: string) {
    if (resolvingId) return; // 防双击并发
    setResolvingId(capsule.id);
    setNotice(null);
    try {
      const res = await api.resolveCapsule(capsule.id, { outcome, reflection });
      setCapsules((prev) => prev.map((c) => (c.id === res.capsule.id ? res.capsule : c)));
      setNotice({ kind: "ok", text: `已结算，本条得分 ${res.capsule.score ?? "—"} 分。` });
      void api.stats().then(setStats).catch(() => {});
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 401) {
        goLogin();
        return;
      }
      setNotice({ kind: "err", text: describeApiError(e) });
      if (e instanceof ApiRequestError && e.status === 409) void refresh();
    } finally {
      setResolvingId(null);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await authClient.signOut();
    } finally {
      router.replace("/");
    }
  }

  if (sessionPending || (session && loadState === "loading")) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-4xl items-center justify-center px-4">
        <p className="text-ink-soft" role="status">正在打开你的信箱…</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-4xl items-center justify-center px-4">
        <p className="text-ink-soft" role="status">正在前往登录页…</p>
      </main>
    );
  }

  const counts: Record<FilterKey, number> = {
    all: capsules.length,
    sealed: capsules.filter((c) => c.state === "sealed").length,
    ready: capsules.filter((c) => c.state === "ready").length,
    resolved: capsules.filter((c) => c.state === "resolved").length,
  };
  const visible = filter === "all" ? capsules : capsules.filter((c) => c.state === filter);
  const showForm = formOpen || capsules.length === 0;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-3 py-5">
        <div className="flex items-center gap-3">
          <SealMark char="回" />
          <div>
            <h1 className="font-display text-xl font-bold leading-tight">明日回声</h1>
            <p className="text-xs text-ink-soft">我的信箱</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <p className="max-w-40 truncate text-sm text-ink-soft" title={session.user.email}>
            {session.user.name || session.user.email}
          </p>
          <button className="btn btn-ghost" onClick={handleSignOut} disabled={signingOut}>
            {signingOut ? "正在退出…" : "退出"}
          </button>
        </div>
      </header>

      {notice ? (
        <p
          role={notice.kind === "err" ? "alert" : "status"}
          className="sheet mb-4 px-4 py-2 text-sm"
          style={
            notice.kind === "err"
              ? { color: "var(--color-seal-deep)", borderColor: "var(--color-seal)" }
              : { color: "var(--color-accent-deep)", borderColor: "var(--color-accent)" }
          }
        >
          {notice.text}
        </p>
      ) : null}

      {stats ? <StatsBar stats={stats} /> : null}

      <section className="sheet mt-6 p-5" aria-labelledby="new-capsule-heading">
        <div className="flex items-center justify-between gap-3">
          <h2 id="new-capsule-heading" className="font-display text-lg font-semibold">
            写一条给未来的预测
          </h2>
          {capsules.length > 0 ? (
            <button
              className="btn btn-ghost"
              aria-expanded={showForm}
              onClick={() => setFormOpen((v) => !v)}
            >
              {showForm ? "收起" : "展开"}
            </button>
          ) : null}
        </div>
        {showForm ? (
          <div className="mt-4">
            <CapsuleForm pending={creating} onSubmit={handleCreate} />
          </div>
        ) : null}
      </section>

      <section className="mt-8" aria-labelledby="list-heading">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="list-heading" className="font-display text-lg font-semibold">
            封存列表
          </h2>
          <FilterTabs value={filter} counts={counts} onChange={setFilter} />
        </div>

        {loadState === "error" ? (
          <div className="sheet p-8 text-center">
            <p className="text-ink-soft">没能取回你的信件。</p>
            <button className="btn btn-primary mt-4" onClick={() => void refresh()}>
              重新加载
            </button>
          </div>
        ) : capsules.length === 0 ? (
          <div className="sheet p-8 text-center">
            <SealMark char="启" className="mx-auto mb-3" />
            <p className="text-ink-soft">
              信箱还是空的。在上方写下第一条预测，封好，寄给未来的自己。
            </p>
          </div>
        ) : visible.length === 0 ? (
          <div className="sheet p-8 text-center">
            <p className="text-ink-soft">「{STATE_LABEL[filter as Exclude<FilterKey, "all">] ?? "该状态"}」下暂无卡片。</p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {visible.map((c) => {
              const blocked = resolveBlockReason(c, nowMs);
              return (
                <li key={c.id}>
                  <CapsuleCard
                    capsule={c}
                    nowMs={nowMs}
                    actions={
                      c.state === "ready" ? (
                        <ResolvePanel
                          capsule={c}
                          pending={resolvingId === c.id}
                          onResolve={(outcome, reflection) => handleResolve(c, outcome, reflection)}
                        />
                      ) : blocked ? (
                        <button className="btn btn-ghost w-full" disabled title={blocked}>
                          {blocked}
                        </button>
                      ) : null
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
