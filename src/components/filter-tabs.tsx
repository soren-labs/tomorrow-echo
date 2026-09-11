"use client";

import { FILTERS, type FilterKey } from "./capsule-utils";

type Props = {
  value: FilterKey;
  counts: Record<FilterKey, number>;
  onChange: (f: FilterKey) => void;
};

export function FilterTabs({ value, counts, onChange }: Props) {
  return (
    <div role="tablist" aria-label="按状态筛选" className="flex flex-wrap gap-2">
      {FILTERS.map((f) => (
        <button
          key={f.key}
          role="tab"
          aria-selected={value === f.key}
          className={`chip cursor-pointer px-3 py-1.5 text-sm ${
            value === f.key ? "border-ink bg-ink font-semibold" : "hover:border-ink-soft"
          }`}
          style={value === f.key ? { color: "var(--color-card)" } : undefined}
          onClick={() => onChange(f.key)}
        >
          {f.label}
          <span className="tnum">{counts[f.key]}</span>
        </button>
      ))}
    </div>
  );
}
