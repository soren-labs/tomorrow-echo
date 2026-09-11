"use client";

import { useEffect, useState } from "react";

/** 每秒走针的「现在」，单位毫秒；offsetMs 用于对齐服务端时钟 */
export function useNow(offsetMs = 0, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now + offsetMs;
}
