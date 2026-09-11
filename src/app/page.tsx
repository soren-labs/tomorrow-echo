import Link from "next/link";
import type { Capsule } from "../contracts";
import { CapsuleCard } from "../components/capsule-card";
import { SealMark } from "../components/postmark";

const EXAMPLE: Capsule = {
  id: "example",
  title: "今天下班前把那封邮件发出去",
  note: "拖了三天了，今天必须动手。",
  probability: 80,
  createdAt: "2026-09-10T09:00:00.000Z",
  unlockAt: "2026-09-10T11:00:00.000Z",
  state: "resolved",
  outcome: true,
  reflection: "确实发出去了，下次可以把概率再报高一点。",
  resolvedAt: "2026-09-10T11:05:00.000Z",
  score: 96,
};

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-20">
      <header className="flex items-center justify-between py-6">
        <div className="flex items-center gap-2">
          <SealMark char="回" />
          <span className="font-display text-lg font-bold">明日回声</span>
        </div>
        <nav className="flex gap-3">
          <Link href="/login" className="btn btn-ghost">登录</Link>
          <Link href="/signup" className="btn btn-primary">开始写信</Link>
        </nav>
      </header>

      <section className="pt-10 pb-12 text-center">
        <h1 className="font-display text-3xl leading-snug font-bold sm:text-4xl">
          把今天的判断，
          <br />
          寄给明天的自己
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-ink-soft">
          写下一条预测、你的信心概率和揭晓时间。封存之后不能修改；
          到点如实记录结果——看看你的感觉和现实差了多少。
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/signup" className="btn btn-primary">免费注册</Link>
          <Link href="/login" className="btn btn-ghost">已有账号登录</Link>
        </div>
      </section>

      <section aria-labelledby="example-heading">
        <h2 id="example-heading" className="mb-3 text-center text-sm font-semibold text-ink-soft">
          一封信的样子
        </h2>
        <CapsuleCard capsule={EXAMPLE} nowMs={Date.parse("2026-09-10T12:00:00.000Z")} />
        <p className="mt-3 text-center text-sm text-ink-soft">
          预测 80% 且发生了 → 得分 96；如果它没发生，会留下 36 分。
        </p>
      </section>

      <section className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label="怎么玩">
        {[
          { c: "封", t: "写下预测", d: "标题、信心概率、揭晓时间，写完立刻封存，不可修改。" },
          { c: "等", t: "等它揭晓", d: "封存期间只能读，不能改；倒计时归零后才开始结算。" },
          { c: "算", t: "如实结算", d: "发生了或没发生？写一句复盘，得到诚实分数。" },
        ].map((s) => (
          <div key={s.t} className="sheet flex flex-col items-center gap-2 p-5 text-center">
            <SealMark char={s.c} />
            <h3 className="font-display text-base font-semibold">{s.t}</h3>
            <p className="text-sm text-ink-soft">{s.d}</p>
          </div>
        ))}
      </section>

      <footer className="mt-16 border-t border-line pt-6 text-center text-xs text-ink-soft">
        明日回声 · 私人预测日记 — 只给你自己看。
      </footer>
    </main>
  );
}
