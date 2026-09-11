import { getAuth } from "./auth";

/**
 * Returns the verified server-side session user for a request, or null when
 * unauthenticated. Identity is always derived from the session cookie; request
 * bodies and query strings are never trusted for user identity.
 */
export async function getSessionUser(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  return session?.user ?? null;
}
