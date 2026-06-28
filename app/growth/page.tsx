import type { ReactNode } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import {
  rank,
  verdict,
  MIN_VISITS,
  type VariantRow,
  type RankedVariant,
} from "@/lib/growth-stats";

// Internal A/B dashboard. Reads the pre-aggregated funnel views and ranks ad
// variants by signup rate — the north-star metric. Always fresh, never cached.
export const dynamic = "force-dynamic";

type RawRow = {
  variant: string | null;
  market?: string | null;
  visits: number | string | null;
  signups: number | string | null;
  activations: number | string | null;
};

const num = (x: unknown) => Number(x ?? 0);
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

export default async function GrowthDashboard({
  searchParams,
}: {
  searchParams: Promise<{ key?: string | string[] }>;
}) {
  const sp = await searchParams;
  const token = process.env.GROWTH_DASHBOARD_TOKEN;
  const provided = Array.isArray(sp.key) ? sp.key[0] : sp.key;

  if (token && provided !== token) return <Unauthorized />;

  if (!isSupabaseConfigured()) {
    return (
      <Shell tokenSet={Boolean(token)}>
        <Card>
          Supabase isn&apos;t configured, so there&apos;s nothing to show. Set{" "}
          <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code>SUPABASE_SERVICE_ROLE_KEY</code>.
        </Card>
      </Shell>
    );
  }

  const sb = supabase();
  const [byVar, byCell] = await Promise.all([
    sb.from("growth_funnel_by_variant").select("*"),
    sb.from("growth_funnel_by_variant_market").select("*"),
  ]);

  const variantRows: VariantRow[] = ((byVar.data ?? []) as RawRow[])
    .filter((r) => r.variant) // attributed variants only
    .map((r) => ({
      variant: r.variant as string,
      visits: num(r.visits),
      signups: num(r.signups),
      activations: num(r.activations),
    }));

  const cells = ((byCell.data ?? []) as RawRow[])
    .map((r) => ({
      variant: r.variant || "(untagged)",
      market: r.market || "(none)",
      visits: num(r.visits),
      signups: num(r.signups),
      activations: num(r.activations),
    }))
    .sort(
      (a, b) =>
        a.variant.localeCompare(b.variant) ||
        a.market.localeCompare(b.market) ||
        b.visits - a.visits,
    );

  const ranked = rank(variantRows);
  const v = verdict(ranked);
  const best = ranked[0]?.rate ?? 0;

  const totalVisits = ranked.reduce((s, r) => s + r.visits, 0);
  const totalSignups = ranked.reduce((s, r) => s + r.signups, 0);
  const overallRate = totalVisits > 0 ? totalSignups / totalVisits : 0;

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL || "https://justcoffee.app"
  ).replace(/\/$/, "");
  const hasData = ranked.length > 0;

  return (
    <Shell tokenSet={Boolean(token)}>
      {hasData ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Kpi label="Ad clicks (visits)" value={totalVisits.toLocaleString()} />
            <Kpi label="Signups" value={totalSignups.toLocaleString()} />
            <Kpi label="Overall signup rate" value={pct(overallRate)} />
          </div>

          <Verdict v={v} />

          <Section title="By ad variant — ranked by signup rate">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-3 font-medium">#</th>
                  <th className="py-2 pr-3 font-medium">Ad</th>
                  <th className="py-2 pr-3 text-right font-medium">Visits</th>
                  <th className="py-2 pr-3 text-right font-medium">Signups</th>
                  <th className="py-2 pr-3 text-right font-medium">Signup rate</th>
                  <th className="py-2 pl-3 font-medium">95% range</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((r, i) => (
                  <VariantRowView key={r.variant} r={r} i={i} best={best} />
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-slate-400">
              Rows shaded amber have fewer than {MIN_VISITS} visits — the rate is
              not yet reliable. The 95% range is a Wilson interval; when two ads&apos;
              ranges don&apos;t overlap, the difference is real.
            </p>
          </Section>

          <Section title="By ad × market">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-3 font-medium">Ad</th>
                  <th className="py-2 pr-3 font-medium">Market</th>
                  <th className="py-2 pr-3 text-right font-medium">Visits</th>
                  <th className="py-2 pr-3 text-right font-medium">Signups</th>
                  <th className="py-2 pr-3 text-right font-medium">Rate</th>
                  <th className="py-2 pl-3 text-right font-medium">Activated</th>
                </tr>
              </thead>
              <tbody>
                {cells.map((c) => {
                  const rate = c.visits > 0 ? c.signups / c.visits : 0;
                  return (
                    <tr
                      key={`${c.variant}~${c.market}`}
                      className="border-b border-slate-100"
                    >
                      <td className="py-2 pr-3 font-medium text-slate-800">
                        {c.variant}
                      </td>
                      <td className="py-2 pr-3 text-slate-600">{c.market}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {c.visits}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {c.signups}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {c.visits > 0 ? pct(rate) : "—"}
                      </td>
                      <td className="py-2 pl-3 text-right tabular-nums text-slate-500">
                        {c.activations}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-slate-400">
              Each ad ran on different markets, so compare ads <em>within</em> a
              market before comparing across them — a market effect can masquerade
              as an ad effect.
            </p>
          </Section>
        </>
      ) : (
        <EmptyState appUrl={appUrl} />
      )}

      <LinkRecipe appUrl={appUrl} />
      <Methodology />
    </Shell>
  );
}

/* ---------- presentational helpers ---------- */

function Shell({
  children,
  tokenSet,
}: {
  children: ReactNode;
  tokenSet: boolean;
}) {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 text-slate-900">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">
          justcoffee · ad test
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Which ad turns the most clicks into signups, by market.
        </p>
      </header>
      {!tokenSet && (
        <div className="mb-5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>No dashboard token set.</strong> This page is open to anyone
          with the URL. Set <code>GROWTH_DASHBOARD_TOKEN</code> in your env and
          open <code>/growth?key=YOUR_TOKEN</code> before sharing.
        </div>
      )}
      <div className="space-y-6">{children}</div>
    </main>
  );
}

function Unauthorized() {
  return (
    <main className="mx-auto max-w-md px-5 py-24 text-center text-slate-700">
      <h1 className="text-lg font-semibold">Not authorized</h1>
      <p className="mt-2 text-sm text-slate-500">
        Append <code>?key=…</code> with the dashboard token to view this page.
      </p>
    </main>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function Verdict({
  v,
}: {
  v: ReturnType<typeof verdict>;
}) {
  const tone =
    v.kind === "winner"
      ? "border-emerald-300 bg-emerald-50 text-emerald-900"
      : v.kind === "leading"
        ? "border-sky-300 bg-sky-50 text-sky-900"
        : "border-slate-300 bg-slate-50 text-slate-700";
  const label =
    v.kind === "winner"
      ? "Winner"
      : v.kind === "leading"
        ? "Leading"
        : "Keep running";
  return (
    <div className={`rounded-xl border px-4 py-3 ${tone}`}>
      <div className="text-xs font-semibold uppercase tracking-wide opacity-70">
        {label}
      </div>
      <div className="mt-1 text-sm">{v.message}</div>
    </div>
  );
}

function VariantRowView({
  r,
  i,
  best,
}: {
  r: RankedVariant;
  i: number;
  best: number;
}) {
  const barW = best > 0 ? Math.round((r.rate / best) * 100) : 0;
  return (
    <tr className={`border-b border-slate-100 ${r.thin ? "bg-amber-50/60" : ""}`}>
      <td className="py-2 pr-3 text-slate-400">{i + 1}</td>
      <td className="py-2 pr-3 font-medium text-slate-800">{r.variant}</td>
      <td className="py-2 pr-3 text-right tabular-nums">{r.visits}</td>
      <td className="py-2 pr-3 text-right tabular-nums">{r.signups}</td>
      <td className="py-2 pr-3 text-right">
        <div className="flex items-center justify-end gap-2">
          <div className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-slate-100 sm:block">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${barW}%` }}
            />
          </div>
          <span className="tabular-nums font-semibold">
            {r.visits > 0 ? pct(r.rate) : "—"}
          </span>
        </div>
      </td>
      <td className="py-2 pl-3 text-xs tabular-nums text-slate-500">
        {r.visits > 0 ? `${pct(r.ciLow)} – ${pct(r.ciHigh)}` : "—"}
      </td>
    </tr>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">{title}</h2>
      {children}
    </section>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
      {children}
    </div>
  );
}

function EmptyState({ appUrl }: { appUrl: string }) {
  return (
    <Card>
      <p className="font-medium text-slate-800">No data yet.</p>
      <p className="mt-1">
        Put a tracked link in front of people and signups will show up here.
        Build links with the recipe below, e.g.{" "}
        <code className="break-all">
          {appUrl}/?v=hour-to-kill&amp;c=ut-austin&amp;ch=flyer
        </code>
        .
      </p>
    </Card>
  );
}

function LinkRecipe({ appUrl }: { appUrl: string }) {
  return (
    <Section title="Make a tracked link">
      <p className="text-sm text-slate-600">
        Give each ad its own link. Same four params everywhere — email, flyer QR,
        Instagram bio, Reddit:
      </p>
      <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-100">
        {appUrl}/?v=<span className="text-emerald-300">AD</span>&amp;c=
        <span className="text-emerald-300">MARKET</span>&amp;ch=
        <span className="text-emerald-300">CHANNEL</span>
      </pre>
      <ul className="mt-2 space-y-1 text-xs text-slate-500">
        <li>
          <code>v</code> — the ad/creative (e.g. <code>hour-to-kill</code>,{" "}
          <code>not-a-date</code>). This is what gets compared.
        </li>
        <li>
          <code>c</code> — the market/campus (e.g. <code>ut-austin</code>,{" "}
          <code>nyu</code>).
        </li>
        <li>
          <code>ch</code> — where it ran (<code>flyer</code>, <code>ig</code>,{" "}
          <code>reddit</code>, <code>qr</code>).
        </li>
      </ul>
    </Section>
  );
}

function Methodology() {
  return (
    <details className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
      <summary className="cursor-pointer font-semibold text-slate-700">
        How to read this
      </summary>
      <ul className="mt-3 list-disc space-y-1.5 pl-5">
        <li>
          <strong>Signup rate is the north star</strong> — clicks that turn into a
          captured email. It&apos;s first-party (logged when the email is
          submitted), so it doesn&apos;t depend on email open-pixels, which are
          unreliable.
        </li>
        <li>
          <strong>Visits</strong> are unique ad clicks (de-duped by a first-party
          cookie). <strong>Signups</strong> are unique emails (de-duped by a
          privacy-safe hash — no raw emails are stored).
        </li>
        <li>
          <strong>Don&apos;t call a winner early.</strong> The verdict only
          declares one when both ads clear {MIN_VISITS} visits and the gap is 95%
          significant. Thin rows are shaded amber.
        </li>
        <li>
          <strong>Activated</strong> = finished onboarding (a deeper signal than
          signup). It only populates if you add the optional activation hook.
        </li>
      </ul>
    </details>
  );
}
