import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const code = req.query.code as string;
  const state = req.query.state as string;

  if (!code) {
    return res.redirect(302, '/auth/google/callback?error=no_code');
  }

  const returnUrl = state ? decodeURIComponent(state) : '/empreendimentos';

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://nexa-taupe-two.vercel.app/api/google-callback';

    const response = await fetch(`${supabaseUrl}/functions/v1/google-oauth-exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ code, redirect_uri: redirectUri }),
    });

    const data = await response.json();

    if (!data.access_token) {
      const encodedReturn = encodeURIComponent(returnUrl);
      return res.redirect(302, `/auth/google/callback?error=token_failed&return_url=${encodedReturn}`);
    }

    const encodedToken = encodeURIComponent(data.access_token);
    const encodedReturn = encodeURIComponent(returnUrl);
    return res.redirect(302, `/auth/google/callback?token=${encodedToken}&return_url=${encodedReturn}`);
  } catch (err) {
    console.error('[google-callback]', err);
    const encodedReturn = encodeURIComponent(returnUrl);
    return res.redirect(302, `/auth/google/callback?error=server_error&return_url=${encodedReturn}`);
  }
}
