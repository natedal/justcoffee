import { createToken, normalizeEmail } from "@/lib/magic";

// POST /api/auth/request  { email }
// Issues a magic-link token. With no email provider configured we return the
// link in the response so the flow is fully usable locally; in production the
// link is emailed and the response would simply confirm "check your inbox".
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
  const link = `/api/auth/verify?token=${encodeURIComponent(token)}`;

  // `delivered` mirrors what production would do (email sent, no link exposed).
  const emailConfigured = Boolean(process.env.JUSTCOFFEE_EMAIL_FROM);
  return Response.json({
    ok: true,
    email,
    delivered: emailConfigured,
    link: emailConfigured ? undefined : link,
  });
}
