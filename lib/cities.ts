import type { CoffeeSpot } from "./types";

// Launch cities mirror the go-to-market plan: start dense in a mid-sized,
// socially mixed city (Austin), expand out from there.

export interface City {
  key: string;
  label: string;
  lat: number;
  lng: number;
}

export const CITIES: City[] = [
  { key: "austin", label: "Austin, TX", lat: 30.2672, lng: -97.7431 },
  { key: "nashville", label: "Nashville, TN", lat: 36.1627, lng: -86.7816 },
  { key: "denver", label: "Denver, CO", lat: 39.7392, lng: -104.9903 },
  { key: "madison", label: "Madison, WI", lat: 43.0731, lng: -89.4012 },
  { key: "nyc", label: "New York, NY", lat: 40.7128, lng: -74.006 },
  { key: "sf", label: "San Francisco, CA", lat: 37.7749, lng: -122.4194 },
];

export const DEFAULT_CITY = "austin";

export function getCity(key: string): City {
  return CITIES.find((c) => c.key === key) ?? CITIES[0];
}

// Suggested meeting places are public by design (cafes, libraries, public
// spaces) — a core safety property, never a private address.
export const COFFEE_SPOTS: CoffeeSpot[] = [
  // Austin
  { id: "atx-1", name: "Cosmic Coffee + Beer Garden", kind: "cafe", city: "austin", lat: 30.234, lng: -97.756, blurb: "Big outdoor patio, easy to find a table." },
  { id: "atx-2", name: "Radio Coffee & Beer", kind: "cafe", city: "austin", lat: 30.241, lng: -97.769, blurb: "Roomy, casual, food trucks out back." },
  { id: "atx-3", name: "Central Library — Cookbook Bar", kind: "library", city: "austin", lat: 30.266, lng: -97.749, blurb: "Bright public library cafe with a rooftop." },
  { id: "atx-4", name: "Mozart's Coffee Roasters", kind: "cafe", city: "austin", lat: 30.296, lng: -97.787, blurb: "Lakeside deck, always busy and public." },
  { id: "atx-5", name: "Houndstooth Coffee", kind: "cafe", city: "austin", lat: 30.272, lng: -97.741, blurb: "Central, quick to get to from downtown." },

  // Nashville
  { id: "bna-1", name: "Barista Parlor", kind: "cafe", city: "nashville", lat: 36.178, lng: -86.767, blurb: "Spacious industrial cafe, easy parking." },
  { id: "bna-2", name: "Frothy Monkey", kind: "cafe", city: "nashville", lat: 36.152, lng: -86.772, blurb: "Friendly all-day spot, lots of seating." },
  { id: "bna-3", name: "Nashville Public Library Cafe", kind: "library", city: "nashville", lat: 36.162, lng: -86.781, blurb: "Calm, central, very public." },

  // Denver
  { id: "den-1", name: "Little Owl Coffee", kind: "cafe", city: "denver", lat: 39.751, lng: -105.0, blurb: "Cozy LoDo cafe, walkable." },
  { id: "den-2", name: "Thump Coffee", kind: "cafe", city: "denver", lat: 39.737, lng: -104.982, blurb: "Bright, roomy, good for talking." },
  { id: "den-3", name: "Denver Central Library Cafe", kind: "library", city: "denver", lat: 39.737, lng: -104.987, blurb: "Public library with seating and coffee." },

  // Madison
  { id: "msn-1", name: "Colectivo Coffee — Lake Park", kind: "cafe", city: "madison", lat: 43.077, lng: -89.394, blurb: "Lakeside, lots of tables." },
  { id: "msn-2", name: "Barriques", kind: "cafe", city: "madison", lat: 43.073, lng: -89.401, blurb: "Central, relaxed, easy to find." },
  { id: "msn-3", name: "Madison Central Library Cafe", kind: "library", city: "madison", lat: 43.074, lng: -89.39, blurb: "Quiet public space downtown." },

  // NYC
  { id: "nyc-1", name: "Bryant Park Reading Room", kind: "public", city: "nyc", lat: 40.753, lng: -73.983, blurb: "Open-air public space in midtown." },
  { id: "nyc-2", name: "Devoción (Williamsburg)", kind: "cafe", city: "nyc", lat: 40.717, lng: -73.958, blurb: "Big skylit cafe, lots of seating." },
  { id: "nyc-3", name: "Stumptown (Ace Hotel)", kind: "cafe", city: "nyc", lat: 40.745, lng: -73.988, blurb: "Central, public lobby seating nearby." },

  // SF
  { id: "sf-1", name: "Ferry Building — Blue Bottle", kind: "cafe", city: "sf", lat: 37.795, lng: -122.393, blurb: "Public marketplace, very busy." },
  { id: "sf-2", name: "Réveille Coffee (North Beach)", kind: "cafe", city: "sf", lat: 37.799, lng: -122.407, blurb: "Corner cafe with outdoor seats." },
  { id: "sf-3", name: "SF Public Library — Main", kind: "library", city: "sf", lat: 37.779, lng: -122.416, blurb: "Central public library, cafe nearby." },
];

export function spotsForCity(city: string): CoffeeSpot[] {
  return COFFEE_SPOTS.filter((s) => s.city === city);
}
