export type CapsuleState = "sealed" | "ready" | "resolved";
export type Capsule = {
  id: string; title: string; note: string | null; probability: number;
  createdAt: string; unlockAt: string; state: CapsuleState;
  outcome: boolean | null; reflection: string | null;
  resolvedAt: string | null; score: number | null;
};
export type CapsuleList = { capsules: Capsule[]; serverNow: string };
export type CapsuleResult = { capsule: Capsule; serverNow: string };
export type CapsuleStats = {
  total: number; sealed: number; ready: number; resolved: number;
  averageScore: number | null; serverNow: string;
};
export type CreateCapsuleInput = {
  title: string; note?: string; probability: number;
  unlockDelaySeconds: 60 | 3600 | 86400 | 604800;
};
export type ResolveCapsuleInput = { outcome: boolean; reflection?: string };
export type ApiError = { error: { code: string; message: string } };
