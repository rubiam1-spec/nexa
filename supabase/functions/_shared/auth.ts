import { createClient } from "jsr:@supabase/supabase-js@2";

// ── Types ──

export interface AuthResult {
  userId: string;
  email: string;
  accountId: string;
  role: string;
}

// ── JWT validation ──

export async function validateAuth(req: Request): Promise<AuthResult | null> {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return null;

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error } = await userClient.auth.getUser();
    if (error || !user) return null;

    const { data: access } = await userClient
      .from("user_account_access")
      .select("account_id, role")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!access) return null;

    return {
      userId: user.id,
      email: user.email || "",
      accountId: access.account_id,
      role: access.role,
    };
  } catch {
    return null;
  }
}

// ── Role check ──

export function requireRole(auth: AuthResult, allowedRoles: string[]): boolean {
  return allowedRoles.includes(auth.role);
}

// ── Standard responses ──

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function unauthorized(message = "Unauthorized"): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function forbidden(message = "Forbidden"): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 403,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function rateLimited(): Response {
  return new Response(JSON.stringify({ error: "Too many requests" }), {
    status: 429,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── In-memory rate limiting ──

const rateLimitMap = new Map<string, number[]>();

export function checkRateLimit(
  key: string,
  maxRequests = 30,
  windowMs = 60000,
): boolean {
  const now = Date.now();
  const requests = rateLimitMap.get(key)?.filter((t) => now - t < windowMs) || [];
  if (requests.length >= maxRequests) return false;
  requests.push(now);
  rateLimitMap.set(key, requests);
  // Cleanup stale entries
  if (rateLimitMap.size > 1000) {
    for (const [k, v] of rateLimitMap) {
      if (v.every((t) => now - t > windowMs)) rateLimitMap.delete(k);
    }
  }
  return true;
}
