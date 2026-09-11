"use client";

import { useState } from "react";
import type { CreateCapsuleInput } from "../contracts";
import {
  DELAY_OPTIONS,
  NOTE_MAX,
  TITLE_MAX,
  validateDelay,
  validateNote,
  validateProbability,
  validateTitle,
  type DelaySeconds,
} from "./capsule-utils";

type Props = {
  pending: boolean;
  onSubmit: (input: CreateCapsuleInput) => Promise<boolean>;
};

/** 新预测表单：标题 / 说明 / 概率 / 固定揭晓延时 */
export function CapsuleForm({ pending, onSubmit }: Props) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [probability, setProbability] = useState("80");
  const [delay, setDelay] = useState<DelaySeconds>(3600);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const titleErr = validateTitle(title);
    if (titleErr) return setError(titleErr);
    const noteErr = validateNote(note);
    if (noteErr) return setError(noteErr);
    const prob = validateProbability(probability);
    if ("error" in prob) return setError(prob.error);
    if (!validateDelay(delay)) return setError("请选择一个揭晓时间");
    setError(null);
    const ok = await onSubmit({
      title: title.trim(),
      note: note.trim() ? note.trim() : undefined,
      probability: prob.value,
      unlockDelaySeconds: delay,
    });
    if (ok) {
      setTitle("");
      setNote("");
      setProbability("80");
      setDelay(3600);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate={false}>
      <div>
        <label className="label" htmlFor="cf-title">
          标题 <span className="label-hint">1–{TITLE_MAX} 字</span>
        </label>
        <input
          id="cf-title"
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例如：今晚 23:00 前写完周报"
          required
          disabled={pending}
        />
      </div>

      <div>
        <label className="label" htmlFor="cf-note">
          说明 <span className="label-hint">可选，最多 {NOTE_MAX} 字</span>
        </label>
        <textarea
          id="cf-note"
          className="input min-h-20"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="为什么这样判断？（封存后不可修改）"
          disabled={pending}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="cf-prob">
            信心概率 <span className="label-hint">0–100 的整数</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              id="cf-prob"
              className="input tnum"
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              step={1}
              value={probability}
              onChange={(e) => setProbability(e.target.value)}
              required
              disabled={pending}
            />
            <span aria-hidden className="text-sm text-ink-soft">%</span>
          </div>
        </div>

        <fieldset disabled={pending}>
          <legend className="label">揭晓时间</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="揭晓时间">
            {DELAY_OPTIONS.map((o) => (
              <label
                key={o.value}
                className={`chip cursor-pointer px-3 py-1.5 text-sm ${
                  delay === o.value ? "border-accent bg-tint font-semibold text-accent-deep" : ""
                }`}
              >
                <input
                  type="radio"
                  name="unlock-delay"
                  value={o.value}
                  checked={delay === o.value}
                  onChange={() => setDelay(o.value)}
                  className="sr-only"
                />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium" style={{ color: "var(--color-seal-deep)" }}>
          {error}
        </p>
      ) : null}

      <div>
        <button type="submit" className="btn btn-seal" disabled={pending}>
          {pending ? "封存中…" : "封存这条预测"}
        </button>
        <p className="mt-2 text-xs text-ink-soft">封存后不能再修改，到期后如实记录结果。</p>
      </div>
    </form>
  );
}
