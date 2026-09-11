import { formatStampDate } from "./capsule-utils";

/** 朱砂色圆形邮戳：外圈地名环 + 日期，盖在信封卡片右上角 */
export function Postmark({ date, className = "" }: { date: string; className?: string }) {
  const stamp = formatStampDate(date);
  return (
    <svg
      viewBox="0 0 88 88"
      className={className}
      role="img"
      aria-label={stamp ? `邮戳 ${stamp}` : "邮戳"}
      style={{ color: "var(--color-seal)" }}
    >
      <circle cx="44" cy="44" r="41" fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.85" />
      <circle cx="44" cy="44" r="33" fill="none" stroke="currentColor" strokeWidth="0.9" opacity="0.7" />
      <defs>
        <path id="pm-arc-top" d="M 44 12 A 32 32 0 0 1 76 44" fill="none" />
        <path id="pm-arc" d="M 12 44 A 32 32 0 1 1 76 44" fill="none" />
      </defs>
      <text fontSize="8.2" letterSpacing="2.5" fill="currentColor" opacity="0.85" fontFamily="var(--font-display)">
        <textPath href="#pm-arc" startOffset="6%">
          明日回声 · TOMORROW ECHO ·
        </textPath>
      </text>
      <text
        x="44"
        y="48"
        textAnchor="middle"
        fontSize="11"
        fill="currentColor"
        fontFamily="var(--font-mono)"
        letterSpacing="0.5"
      >
        {stamp}
      </text>
    </svg>
  );
}

/** 圆形「封」字小印 */
export function SealMark({ char = "封", className = "" }: { char?: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-sm leading-none ${className}`}
      style={{
        borderColor: "var(--color-seal)",
        color: "var(--color-seal)",
        fontFamily: "var(--font-display)",
        borderWidth: "1.5px",
        boxShadow: "inset 0 0 0 2px var(--color-card), inset 0 0 0 3px var(--color-seal)",
      }}
    >
      {char}
    </span>
  );
}
