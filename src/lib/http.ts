import type { ApiError } from "../contracts";

/**
 * JSON response for private, per-user API data. Always `no-store` so shared
 * caches and browsers never retain authenticated payloads.
 */
export function jsonResponse(data: unknown, init?: { status?: number }): Response {
  return Response.json(data, {
    status: init?.status ?? 200,
    headers: {
      "cache-control": "no-store",
    },
  });
}

export function errorResponse(status: number, code: string, message: string): Response {
  const body: ApiError = { error: { code, message } };
  return jsonResponse(body, { status });
}

export function internalError(error: unknown): Response {
  console.error("api error:", error);
  return errorResponse(500, "internal_error", "服务器内部错误，请稍后重试");
}

/**
 * Same-origin guard for write endpoints. Browsers always send Origin on
 * cross-site fetches and Sec-Fetch-Site on all requests; rejecting anything
 * that is not explicitly same-origin blocks CSRF-style writes. Requests with
 * neither header (curl, server-to-server, same-origin fetches) are allowed.
 */
export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin) {
    const host =
      request.headers.get("x-forwarded-host") ??
      request.headers.get("host") ??
      new URL(request.url).host;
    const proto =
      request.headers.get("x-forwarded-proto") ??
      new URL(request.url).protocol.replace(/:$/, "");
    try {
      const o = new URL(origin);
      // Same-origin means scheme AND host; an http origin is not same-origin
      // with an https endpoint.
      if (o.host !== host || o.protocol !== `${proto}:`) return false;
    } catch {
      return false;
    }
  }
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return false;
  }
  return true;
}
