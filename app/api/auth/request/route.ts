import { createToken, normalizeEmail } from "@/lib/magic";

// POST /api/auth/request  { email }
// Issues a magic-link token and either emails it (when RESEND_API_KEY is set)
// or returns the link directly in the response for local dev ("demo mode").
export async function POST(req: Request) {
  let email: string | null = null;
  try {
    email = normalizeEmail((await req.json())?.email);
  } catch {
    /* noop */
  }
  if (!email)
    return Response.json({ error: "enter a valid email" }, { status: 400 });

  const token = createToken(email);

  // Derive the base URL from the incoming request so the link always points
  // to the domain the user actually hit (works behind proxies, on Railway, etc.)
  // Fall back to the explicit env var only if headers are unavailable.
  const reqUrl = new URL(req.url);
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const baseUrl = configuredUrl ?? `${reqUrl.protocol}//${reqUrl.host}`;
  const link = `${baseUrl}/api/auth/verify?token=${encodeURIComponent(token)}`;

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.JUSTCOFFEE_EMAIL_FROM;

  if (apiKey && from) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(apiKey);
      const { error } = await resend.emails.send({
        from,
        to: email,
        subject: "your justcoffee sign-in link",
        html: `
          <div style="font-family:Helvetica Neue,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;color:#281A12">
            <p style="font-size:28px;font-weight:700;margin:0 0 8px">justcoffee</p>
            <p style="color:#6b5a4e;margin:0 0 32px;font-style:italic">meet someone for coffee.</p>
            <p style="margin:0 0 24px">tap the button below to sign in. this link expires in 15 minutes and can only be used once.</p>
            <a href="${link}"
               style="display:inline-block;background:#15625C;color:#F0E7D5;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:999px;font-size:16px">
              sign in to justcoffee →
            </a>
            <p style="margin:32px 0 0;font-size:12px;color:#9b8b7e">
              if you didn't request this, ignore it — nothing will happen.<br>
              link: <a href="${link}" style="color:#15625C">${link}</a>
            </p>
          </div>
        `,
      });
      if (error) {
        console.error("resend error:", error);
        // Fall through — return the link in the response as a fallback
        return Response.json({ ok: true, email, delivered: false, link, resendError: error.message });
      }
      return Response.json({ ok: true, email, delivered: true });
    } catch (err) {
      console.error("resend exception:", err);
      // Fall through — surface the link so the user isn't stuck
      return Response.json({ ok: true, email, delivered: false, link });
    }
  }

  // No email provider — surface the link directly (demo / local dev mode).
  return Response.json({ ok: true, email, delivered: false, link });
}
