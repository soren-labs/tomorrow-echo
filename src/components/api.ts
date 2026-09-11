import type {
  ApiError,
  CapsuleList,
  CapsuleResult,
  CapsuleStats,
  CreateCapsuleInput,
  ResolveCapsuleInput,
} from "../contracts";

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      ...init,
    });
  } catch {
    throw new ApiRequestError(0, "NETWORK", "network error");
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const err = (body as ApiError | null)?.error;
    throw new ApiRequestError(res.status, err?.code ?? "UNKNOWN", err?.message ?? res.statusText);
  }
  return body as T;
}

export const api = {
  listCapsules: () => request<CapsuleList>("/api/capsules"),
  createCapsule: (input: CreateCapsuleInput) =>
    request<CapsuleResult>("/api/capsules", { method: "POST", body: JSON.stringify(input) }),
  resolveCapsule: (id: string, input: ResolveCapsuleInput) =>
    request<CapsuleResult>(`/api/capsules/${encodeURIComponent(id)}/resolve`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  stats: () => request<CapsuleStats>("/api/stats"),
};
