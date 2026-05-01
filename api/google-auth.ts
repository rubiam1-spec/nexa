import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const returnUrl = (req.query.return_url as string) || '/empreendimentos';
  const clientId = process.env.GOOGLE_CLIENT_ID || '14133904198-5b9st81el02ovg4mc7ai9sramf581v7m.apps.googleusercontent.com';
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://nexa-taupe-two.vercel.app/api/google-callback';

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/drive.file',
    access_type: 'offline',
    prompt: 'consent',
    state: encodeURIComponent(returnUrl),
  });

  res.setHeader('Set-Cookie', `nexa_oauth_return=${encodeURIComponent(returnUrl)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`);
  res.redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}
