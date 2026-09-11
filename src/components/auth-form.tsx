"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "../lib/auth-client";
import { describeAuthError } from "./capsule-utils";

type Props = { mode: "login" | "signup" };

/** 邮箱密码登录 / 注册（Better Auth 客户端），成功进入信箱 */
export function AuthForm({ mode }: Props) {
  const router = useRouter();
  const isSignup = mode === "signup";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    if (isSignup && name.trim().length === 0) return setError("请填写一个名字");
    if (!email.includes("@")) return setError("请填写正确的邮箱");
    if (password.length < 8) return setError("密码至少 8 位");
    setPending(true);
    setError(null);
    try {
      const res = isSignup
        ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
        : await authClient.signIn.email({ email: email.trim(), password });
      if (res.error) {
        setError(describeAuthError(res.error.code ?? res.error.message));
        return;
      }
      router.replace("/app");
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="sheet mx-auto w-full max-w-md p-6">
      <h1 className="font-display text-2xl font-bold">
        {isSignup ? "寄出第一封信" : "取回你的信箱"}
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        {isSignup
          ? "用邮箱注册，开始封存你的预测。"
          : "登录后查看封存中、待结算和已结算的预测。"}
      </p>

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
        {isSignup ? (
          <div>
            <label className="label" htmlFor="af-name">名字</label>
            <input
              id="af-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              maxLength={60}
              required
              disabled={pending}
              placeholder="怎么称呼你"
            />
          </div>
        ) : null}

        <div>
          <label className="label" htmlFor="af-email">邮箱</label>
          <input
            id="af-email"
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            disabled={pending}
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label className="label" htmlFor="af-password">
            密码 {isSignup ? <span className="label-hint">至少 8 位</span> : null}
          </label>
          <input
            id="af-password"
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isSignup ? "new-password" : "current-password"}
            minLength={8}
            required
            disabled={pending}
            placeholder="至少 8 位"
          />
        </div>

        {error ? (
          <p role="alert" className="text-sm font-medium" style={{ color: "var(--color-seal-deep)" }}>
            {error}
          </p>
        ) : null}

        <button type="submit" className="btn btn-primary w-full" disabled={pending}>
          {pending ? "请稍候…" : isSignup ? "注册并封存" : "登录"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-ink-soft">
        {isSignup ? (
          <>
            已有账号？{" "}
            <Link className="font-semibold text-accent underline underline-offset-2" href="/login">
              直接登录
            </Link>
          </>
        ) : (
          <>
            还没有账号？{" "}
            <Link className="font-semibold text-accent underline underline-offset-2" href="/signup">
              免费注册
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
