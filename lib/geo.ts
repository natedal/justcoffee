// Lightweight geo helpers. Distances in miles.

const EARTH_MI = 3958.8;
const toRad = (d: number) => (d * Math.PI) / 180;

export function haversineMi(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_MI * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function midpoint(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): { lat: number; lng: number } {
  return { lat: (aLat + bLat) / 2, lng: (aLng + bLng) / 2 };
}

export function formatDistance(mi: number): string {
  if (mi < 0.15) return "right around the corner";
  if (mi < 1) return `${(mi).toFixed(1)} mi away`;
  return `${Math.round(mi)} mi away`;
}

/** Random point within `radiusMi` of a center — used to scatter demo users. */
export function jitter(
  lat: number,
  lng: number,
  radiusMi: number,
  rng: () => number = Math.random,
): { lat: number; lng: number } {
  const r = radiusMi * Math.sqrt(rng());
  const theta = rng() * 2 * Math.PI;
  const dLat = (r / 69) * Math.cos(theta);
  const dLng = (r / (69 * Math.cos(toRad(lat)))) * Math.sin(theta);
  return { lat: lat + dLat, lng: lng + dLng };
}
