// Pure stats for the growth dashboard — no imports, easy to reason about. This is
// conversion-test math only: a Wilson score interval for a single rate, and a
// two-proportion z-test for comparing two ad variants. The point is to stop you
// calling a winner on noise.

export interface VariantRow {
  variant: string;
  visits: number;
  signups: number;
  activations: number;
}

export interface RankedVariant extends VariantRow {
  rate: number; // signups / visits (0 when no visits)
  ciLow: number; // 95% Wilson lower bound
  ciHigh: number; // 95% Wilson upper bound
  thin: boolean; // too few visits to trust the rate yet
}

export const MIN_VISITS = 30; // below this, a rate is "thin" and not yet meaningful

/** 95% Wilson score interval for a binomial proportion — well-behaved at small n
 *  and near 0/1, unlike the naive normal interval. */
export function wilson(successes: number, n: number): [number, number] {
  if (n <= 0) return [0, 0];
  const z = 1.96;
  const p = successes / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n)) / denom;
  return [Math.max(0, center - margin), Math.min(1, center + margin)];
}

/** Standard normal CDF (Abramowitz & Stegun 7.1.26). */
export function normalCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  const p =
    d *
    t *
    (0.31938153 +
      t *
        (-0.356563782 +
          t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x > 0 ? 1 - p : p;
}

/** Two-sided p-value for the difference between two conversion rates. Null when
 *  either sample is empty or degenerate. */
export function twoProportionP(
  s1: number,
  n1: number,
  s2: number,
  n2: number,
): number | null {
  if (n1 <= 0 || n2 <= 0) return null;
  const p1 = s1 / n1;
  const p2 = s2 / n2;
  const pPool = (s1 + s2) / (n1 + n2);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2));
  if (se === 0) return null;
  const z = (p1 - p2) / se;
  return 2 * (1 - normalCdf(Math.abs(z)));
}

/** Rank variants by signup rate (then raw signups as a tiebreak). */
export function rank(rows: VariantRow[]): RankedVariant[] {
  return rows
    .map((r) => {
      const rate = r.visits > 0 ? r.signups / r.visits : 0;
      const [ciLow, ciHigh] = wilson(r.signups, r.visits);
      return { ...r, rate, ciLow, ciHigh, thin: r.visits < MIN_VISITS };
    })
    .sort((a, b) => b.rate - a.rate || b.signups - a.signups);
}

export interface Verdict {
  kind: "winner" | "leading" | "insufficient";
  leader?: string;
  runnerUp?: string;
  p?: number | null;
  message: string;
}

/** Can we call a winner yet? Conservative: both leader and runner-up must clear
 *  MIN_VISITS, and the gap must be 95% significant. */
export function verdict(ranked: RankedVariant[]): Verdict {
  const withData = ranked.filter((r) => r.visits > 0);
  if (withData.length < 2) {
    return {
      kind: "insufficient",
      message:
        "Not enough variants reporting yet. Get at least two ads in front of real visitors.",
    };
  }
  const [a, b] = withData;
  if (a.thin || b.thin) {
    return {
      kind: "insufficient",
      leader: a.variant,
      message: `Too little data to trust — keep running. Aim for ≥${MIN_VISITS} visits per ad before reading the rates (leader so far: ${a.variant}).`,
    };
  }
  const p = twoProportionP(a.signups, a.visits, b.signups, b.visits);
  if (p !== null && p < 0.05) {
    return {
      kind: "winner",
      leader: a.variant,
      runnerUp: b.variant,
      p,
      message: `${a.variant} beats ${b.variant} at 95% confidence (p = ${p.toFixed(3)}).`,
    };
  }
  return {
    kind: "leading",
    leader: a.variant,
    runnerUp: b.variant,
    p,
    message: `${a.variant} leads ${b.variant}, but the gap isn't significant yet${
      p !== null ? ` (p = ${p.toFixed(2)})` : ""
    } — keep the test running.`,
  };
}
