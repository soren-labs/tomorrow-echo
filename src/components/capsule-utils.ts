import type { Capsule, CapsuleState } from "../contracts";

export const DELAY_OPTIONS = [
  { value: 60, label: "1 分钟" },
  { value: 3600, label: "1 小时" },
  { value: 86400, label: "24 小时" },
  { value: 604800, label: "7 天" },
] as const;

export type DelaySeconds = (typeof DELAY_OPTIONS)[number]["value"];

export const TITLE_MAX = 120;
export const NOTE_MAX = 1000;
export const REFLECTION_MAX = 500;

export const STATE_LABEL: Record<CapsuleState, string> = {
  sealed: "封存中",
  ready: "待结算",
  resolved: "已结算",
};

export type FilterKey = CapsuleState | "all";

export const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "sealed", label: "封存中" },
  { key: "ready", label: "待结算" },
  { key: "resolved", label: "已结算" },
];

/** 服务端时间与本地时钟的差值：serverNow - Date.now() */
export function clockOffsetMs(serverNow: string, localNow = Date.now()): number {
  const t = Date.parse(serverNow);
  return Number.isFinite(t) ? t - localNow : 0;
}

/** 距离揭晓的剩余时间，中文紧凑格式；<=0 时返回「即将揭晓」 */
export function formatRemaining(ms: number): string {
  if (ms <= 0) return "即将揭晓";
  const s = Math.floor(ms / 1000);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (days > 0) return `${days} 天 ${hours} 小时`;
  if (hours > 0) return `${hours} 小时 ${mins} 分`;
  if (mins > 0) return `${mins} 分 ${secs} 秒`;
  return `${secs} 秒`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** 邮戳外圈用短日期：2026.09.11 */
export function formatStampDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

export function validateTitle(title: string): string | null {
  const len = title.trim().length;
  if (len === 0) return "请写下这条预测的标题";
  if (len > TITLE_MAX) return `标题最长 ${TITLE_MAX} 字`;
  return null;
}

export function validateNote(note: string): string | null {
  if (note.length > NOTE_MAX) return `说明最长 ${NOTE_MAX} 字`;
  return null;
}

export function validateProbability(raw: string): { value: number } | { error: string } {
  if (raw.trim() === "") return { error: "请填写信心概率" };
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return { error: "概率须为 0–100 的整数" };
  if (n < 0 || n > 100) return { error: "概率须在 0–100 之间" };
  return { value: n };
}

export function validateDelay(delay: number): delay is DelaySeconds {
  return DELAY_OPTIONS.some((o) => o.value === delay);
}

export function validateReflection(text: string): string | null {
  if (text.length > REFLECTION_MAX) return `复盘最长 ${REFLECTION_MAX} 字`;
  return null;
}

/** 结算按钮禁用原因；允许结算时返回 null（按本地推算，最终以服务端为准） */
export function resolveBlockReason(capsule: Capsule, nowMs: number): string | null {
  if (capsule.state === "resolved") return "这条预测已经结算过了";
  if (capsule.state === "sealed") {
    const ms = Date.parse(capsule.unlockAt) - nowMs;
    if (ms > 0) return `还没到揭晓时间，再等 ${formatRemaining(ms)}`;
  }
  return null;
}

export type CodedError = { status: number; code?: string; message?: string };

/** 契约错误 → 安全的用户可读中文文案；不展示数据库/服务端原始报错 */
export function describeApiError(err: unknown): string {
  const e = err as Partial<CodedError> | null;
  const status = e?.status ?? 0;
  if (status === 0) return "网络异常，请稍后重试";
  if (status === 400) return "填写的内容不符合要求，请检查后重试";
  if (status === 401) return "登录已失效，请重新登录";
  if (status === 404) return "没有找到这条预测";
  if (status === 409) return "还没到揭晓时间，或这条预测已经结算过了";
  return "出了点问题，请稍后重试";
}

/** Better Auth 错误码 → 中文提示 */
export function describeAuthError(code: string | undefined): string {
  switch (code) {
    case "INVALID_EMAIL":
      return "邮箱格式不正确";
    case "INVALID_EMAIL_OR_PASSWORD":
    case "USER_EMAIL_NOT_FOUND":
      return "邮箱或密码不正确";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "这个邮箱已经注册过，请直接登录";
    case "PASSWORD_TOO_SHORT":
      return "密码至少 8 位";
    case "PASSWORD_TOO_LONG":
      return "密码太长了";
    case "EMAIL_NOT_VERIFIED":
      return "邮箱尚未验证";
    default:
      return "登录失败，请检查输入后重试";
  }
}
