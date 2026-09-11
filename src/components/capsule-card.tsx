import type { ReactNode } from "react";
import type { Capsule } from "../contracts";
import {
  STATE_LABEL,
  formatDateTime,
  formatRemaining,
} from "./capsule-utils";
import { Postmark } from "./postmark";

type Props = {
  capsule: Capsule;
  /** 已按服务器时钟校正过的当前时间（毫秒） */
  nowMs: number;
  /** 卡片底部动作区（结算表单、禁用原因按钮等），由调用方决定 */
  actions?: ReactNode;
};

/** 信封卡片：标题、概率、状态、时间、结果与得分 */
export function CapsuleCard({ capsule, nowMs, actions }: Props) {
  const remainingMs = Date.parse(capsule.unlockAt) - nowMs;
  const outcomeText =
    capsule.outcome === null ? null : capsule.outcome ? "发生了" : "没发生";

  return (
    <article className="sheet relative flex flex-col gap-3 p-5 pt-4">
      <Postmark
        date={capsule.createdAt}
        className="pointer-events-none absolute -top-3 right-3 h-16 w-16 -rotate-12 opacity-80 sm:h-[76px] sm:w-[76px]"
      />

      <div className="flex flex-wrap items-center gap-2 pr-16">
        <span className="chip" data-state={capsule.state}>
          {STATE_LABEL[capsule.state]}
        </span>
        <span className="chip">信心 {capsule.probability}%</span>
      </div>

      <h3 className="pr-12 font-display text-lg leading-snug font-semibold break-words">
        {capsule.title}
      </h3>

      {capsule.note ? (
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words text-ink-soft">
          {capsule.note}
        </p>
      ) : null}

      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-ink-soft sm:grid-cols-2">
        <div className="flex gap-1">
          <dt className="shrink-0">封存于</dt>
          <dd className="tnum">{formatDateTime(capsule.createdAt)}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="shrink-0">揭晓于</dt>
          <dd className="tnum">{formatDateTime(capsule.unlockAt)}</dd>
        </div>
      </dl>

      {capsule.state === "sealed" ? (
        <p className="text-sm text-ink-soft" aria-live="polite">
          距揭晓还有{" "}
          <strong className="tnum font-semibold text-accent-deep">
            {formatRemaining(remainingMs)}
          </strong>
        </p>
      ) : null}

      {capsule.state === "resolved" ? (
        <div className="rounded-md border border-dashed border-line px-3 py-2">
          <p className="text-sm">
            <span className="text-ink-soft">结果：</span>
            {outcomeText}
            <span className="mx-2 text-line">·</span>
            <span className="text-ink-soft">得分</span>{" "}
            <strong
              className="tnum text-base font-bold"
              style={{ color: "var(--color-seal)" }}
            >
              {capsule.score}
            </strong>
          </p>
          {capsule.reflection ? (
            <p className="mt-1 text-sm break-words whitespace-pre-wrap text-ink-soft">
              {capsule.reflection}
            </p>
          ) : null}
          {capsule.resolvedAt ? (
            <p className="mt-1 text-xs text-ink-soft tnum">
              结算于 {formatDateTime(capsule.resolvedAt)}
            </p>
          ) : null}
        </div>
      ) : null}

      {actions ? <div className="mt-auto pt-1">{actions}</div> : null}
    </article>
  );
}
