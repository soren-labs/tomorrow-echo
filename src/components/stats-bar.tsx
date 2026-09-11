import type { CapsuleStats } from "../contracts";

/** 摘要：总条数、封存中、待结算、已结算、平均得分（无已结算数据显示「暂无」） */
export function StatsBar({ stats }: { stats: CapsuleStats }) {
  const items = [
    { label: "全部预测", value: String(stats.total) },
    { label: "封存中", value: String(stats.sealed) },
    { label: "待结算", value: String(stats.ready) },
    { label: "已结算", value: String(stats.resolved) },
    { label: "平均得分", value: stats.averageScore === null ? "暂无" : String(stats.averageScore) },
  ];
  return (
    <dl className="sheet grid grid-cols-2 gap-px overflow-hidden p-0 sm:grid-cols-5" style={{ background: "var(--color-line)" }}>
      {items.map((it, i) => (
        <div
          key={it.label}
          className={`flex flex-col gap-1 px-4 py-3 ${i === items.length - 1 ? "col-span-2 sm:col-span-1" : ""}`}
          style={{ background: "var(--color-card)" }}
        >
          <dt className="text-xs text-ink-soft">{it.label}</dt>
          <dd className="tnum font-display text-2xl font-semibold">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
