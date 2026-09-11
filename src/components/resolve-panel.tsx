"use client";

import { useState } from "react";
import type { Capsule } from "../contracts";
import { REFLECTION_MAX, validateReflection } from "./capsule-utils";

type Props = {
  capsule: Capsule;
  pending: boolean;
  onResolve: (outcome: boolean, reflection?: string) => Promise<void>;
};

/** 待结算卡片的结算表单：布尔结果 + 可选复盘 */
export function ResolvePanel({ capsule, pending, onResolve }: Props) {
  const [outcome, setOutcome] = useState<boolean | null>(null);
  const [reflection, setReflection] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (outcome === null) return setError("请先选择「发生了」或「没发生」");
    const refErr = validateReflection(reflection);
    if (refErr) return setError(refErr);
    setError(null);
    await onResolve(outcome, reflection.trim() ? reflection.trim() : undefined);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 border-t border-dashed border-line pt-3">
      <fieldset disabled={pending}>
        <legend className="label">这条预测最后——</legend>
        <div className="flex gap-2" role="radiogroup" aria-label={`「${capsule.title}」的结果`}>
          {[
            { v: true, label: "发生了" },
            { v: false, label: "没发生" },
          ].map((o) => (
            <label
              key={String(o.v)}
              className={`chip cursor-pointer px-4 py-1.5 text-sm ${
                outcome === o.v ? "border-seal font-semibold" : ""
              }`}
              style={outcome === o.v ? { color: "var(--color-seal-deep)" } : undefined}
            >
              <input
                type="radio"
                name={`outcome-${capsule.id}`}
                checked={outcome === o.v}
                onChange={() => setOutcome(o.v)}
                className="sr-only"
              />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label className="label" htmlFor={`rf-${capsule.id}`}>
          复盘 <span className="label-hint">可选，最多 {REFLECTION_MAX} 字</span>
        </label>
        <textarea
          id={`rf-${capsule.id}`}
          className="input min-h-14"
          value={reflection}
          maxLength={REFLECTION_MAX}
          onChange={(e) => setReflection(e.target.value)}
          placeholder="哪里想对了，哪里想错了？"
          disabled={pending}
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium" style={{ color: "var(--color-seal-deep)" }}>
          {error}
        </p>
      ) : null}

      <div>
        <button type="submit" className="btn btn-primary" disabled={pending || outcome === null}>
          {pending ? "正在结算…" : "记录结果并结算"}
        </button>
      </div>
    </form>
  );
}
