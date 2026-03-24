const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  "14133904198-e0qprhckppfl667op8s7gvm1i22vslpb.apps.googleusercontent.com";
const GOOGLE_REDIRECT_URI =
  import.meta.env.VITE_GOOGLE_REDIRECT_URI ||
  "https://nexa-taupe-two.vercel.app/auth/google/callback";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  thumbnailLink?: string;
};

export function getGoogleAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/drive.readonly",
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Troca o authorization code por access_token via Edge Function (backend seguro).
 * O client_secret NUNCA sai do servidor.
 */
export async function exchangeCodeForToken(code: string): Promise<string> {
  const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/google-oauth-exchange`;

  const resp = await fetch(edgeFunctionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      code,
      redirect_uri: GOOGLE_REDIRECT_URI,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error("[NEXA OAuth] Erro na troca de token via Edge Function:", err);
    throw new Error(`Falha na autenticação Google: ${err}`);
  }

  const data = await resp.json();
  if (!data.access_token) {
    throw new Error("Token não retornado pela Edge Function.");
  }
  return data.access_token as string;
}

export function getStoredToken(): string | null {
  return localStorage.getItem("nexa_google_token");
}

export function setStoredToken(token: string): void {
  localStorage.setItem("nexa_google_token", token);
}

export function clearStoredToken(): void {
  localStorage.removeItem("nexa_google_token");
}

export function isGoogleConnected(): boolean {
  return !!getStoredToken();
}

export function extractFolderIdFromUrl(url: string): string | null {
  const match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match?.[1] ?? null;
}

export async function listFolderFiles(folderId: string, accessToken?: string): Promise<DriveFile[]> {
  const token = accessToken ?? getStoredToken();
  if (!token) throw new Error("Nenhum token de acesso Google disponível.");

  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id,name,mimeType,webViewLink,thumbnailLink)",
    pageSize: "100",
  });

  const resp = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) {
    if (resp.status === 401) {
      clearStoredToken();
      throw new Error("Token expirado. Reconecte sua conta Google.");
    }
    const err = await resp.text();
    throw new Error(`Falha ao listar arquivos: ${err}`);
  }

  const data = await resp.json();
  return (data.files ?? []) as DriveFile[];
}

export function detectMaterialType(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "imagem";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType === "application/vnd.google-apps.folder") return "folder";
  return "link";
}
