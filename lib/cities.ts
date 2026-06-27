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
// spaces) — a core safety property, never a private address. The launch metro
// (Austin) is intentionally dense so the midpoint of two nearby people almost
// always has a walkable public option; lib/actions falls back to a generated
// neighborhood cafe only when nothing curated is close.
export const COFFEE_SPOTS: CoffeeSpot[] = [
  // Austin — dense central coverage across downtown, east, south, north & west.
  { id: "atx-1", name: "Cosmic Coffee + Beer Garden", kind: "cafe", city: "austin", lat: 30.234, lng: -97.756, blurb: "Big outdoor patio, easy to find a table." },
  { id: "atx-2", name: "Radio Coffee & Beer", kind: "cafe", city: "austin", lat: 30.241, lng: -97.769, blurb: "Roomy, casual, food trucks out back." },
  { id: "atx-3", name: "Central Library — Cookbook Bar", kind: "library", city: "austin", lat: 30.266, lng: -97.749, blurb: "Bright public library cafe with a rooftop." },
  { id: "atx-4", name: "Mozart's Coffee Roasters", kind: "cafe", city: "austin", lat: 30.296, lng: -97.787, blurb: "Lakeside deck, always busy and public." },
  { id: "atx-5", name: "Houndstooth Coffee", kind: "cafe", city: "austin", lat: 30.272, lng: -97.741, blurb: "Central, quick to get to from downtown." },
  { id: "atx-6", name: "Jo's Coffee (South Congress)", kind: "cafe", city: "austin", lat: 30.249, lng: -97.75, blurb: "Iconic SoCo walk-up, lots of foot traffic." },
  { id: "atx-7", name: "Caffé Medici (Congress)", kind: "cafe", city: "austin", lat: 30.265, lng: -97.748, blurb: "Snug downtown espresso bar." },
  { id: "atx-8", name: "Patika Coffee", kind: "cafe", city: "austin", lat: 30.264, lng: -97.749, blurb: "Modern downtown cafe, plenty of seats." },
  { id: "atx-9", name: "Cuvée Coffee Bar", kind: "cafe", city: "austin", lat: 30.263, lng: -97.722, blurb: "East 6th roaster, easy to find." },
  { id: "atx-10", name: "Flat Track Coffee", kind: "cafe", city: "austin", lat: 30.264, lng: -97.718, blurb: "Tiny East Side favorite." },
  { id: "atx-11", name: "Fleet Coffee", kind: "cafe", city: "austin", lat: 30.273, lng: -97.713, blurb: "Bright corner cafe on the East Side." },
  { id: "atx-12", name: "Greater Goods Coffee", kind: "cafe", city: "austin", lat: 30.273, lng: -97.7, blurb: "Airy roastery with room to talk." },
  { id: "atx-13", name: "Better Half Coffee & Cocktails", kind: "cafe", city: "austin", lat: 30.275, lng: -97.756, blurb: "Clarksville-area patio, all day." },
  { id: "atx-14", name: "Once Over Coffee Bar", kind: "cafe", city: "austin", lat: 30.247, lng: -97.755, blurb: "Bouldin Creek porch seating." },
  { id: "atx-15", name: "Epoch Coffee (North Loop)", kind: "cafe", city: "austin", lat: 30.318, lng: -97.722, blurb: "24-hour North Loop standby." },
  { id: "atx-16", name: "Summer Moon Coffee (South)", kind: "cafe", city: "austin", lat: 30.227, lng: -97.77, blurb: "Wood-fired coffee, big tables." },

  // Nashville
  { id: "bna-1", name: "Barista Parlor", kind: "cafe", city: "nashville", lat: 36.178, lng: -86.767, blurb: "Spacious industrial cafe, easy parking." },
  { id: "bna-2", name: "Frothy Monkey", kind: "cafe", city: "nashville", lat: 36.152, lng: -86.772, blurb: "Friendly all-day spot, lots of seating." },
  { id: "bna-3", name: "Nashville Public Library Cafe", kind: "library", city: "nashville", lat: 36.162, lng: -86.781, blurb: "Calm, central, very public." },
  { id: "bna-4", name: "Crema Coffee", kind: "cafe", city: "nashville", lat: 36.157, lng: -86.773, blurb: "SoBro roaster near downtown." },
  { id: "bna-5", name: "Steadfast Coffee (Germantown)", kind: "cafe", city: "nashville", lat: 36.183, lng: -86.789, blurb: "Bright, roomy Germantown cafe." },

  // Denver
  { id: "den-1", name: "Little Owl Coffee", kind: "cafe", city: "denver", lat: 39.751, lng: -105.0, blurb: "Cozy LoDo cafe, walkable." },
  { id: "den-2", name: "Thump Coffee", kind: "cafe", city: "denver", lat: 39.737, lng: -104.982, blurb: "Bright, roomy, good for talking." },
  { id: "den-3", name: "Denver Central Library Cafe", kind: "library", city: "denver", lat: 39.737, lng: -104.987, blurb: "Public library with seating and coffee." },
  { id: "den-4", name: "Huckleberry Roasters", kind: "cafe", city: "denver", lat: 39.762, lng: -105.001, blurb: "Lively spot in the Highlands." },
  { id: "den-5", name: "Corvus Coffee (Wash Park)", kind: "cafe", city: "denver", lat: 39.701, lng: -104.987, blurb: "South Broadway roaster, easy to find." },

  // Madison
  { id: "msn-1", name: "Colectivo Coffee — Lake Park", kind: "cafe", city: "madison", lat: 43.077, lng: -89.394, blurb: "Lakeside, lots of tables." },
  { id: "msn-2", name: "Barriques", kind: "cafe", city: "madison", lat: 43.073, lng: -89.401, blurb: "Central, relaxed, easy to find." },
  { id: "msn-3", name: "Madison Central Library Cafe", kind: "library", city: "madison", lat: 43.074, lng: -89.39, blurb: "Quiet public space downtown." },
  { id: "msn-4", name: "Crescendo Espresso Bar", kind: "cafe", city: "madison", lat: 43.085, lng: -89.355, blurb: "Friendly near-east cafe." },

  // NYC
  { id: "nyc-1", name: "Bryant Park Reading Room", kind: "public", city: "nyc", lat: 40.753, lng: -73.983, blurb: "Open-air public space in midtown." },
  { id: "nyc-2", name: "Devoción (Williamsburg)", kind: "cafe", city: "nyc", lat: 40.717, lng: -73.958, blurb: "Big skylit cafe, lots of seating." },
  { id: "nyc-3", name: "Stumptown (Ace Hotel)", kind: "cafe", city: "nyc", lat: 40.745, lng: -73.988, blurb: "Central, public lobby seating nearby." },
  { id: "nyc-4", name: "Birch Coffee (Gramercy)", kind: "cafe", city: "nyc", lat: 40.739, lng: -73.984, blurb: "Calm Gramercy room, good for talking." },
  { id: "nyc-5", name: "Variety Coffee (East Village)", kind: "cafe", city: "nyc", lat: 40.727, lng: -73.984, blurb: "Quick downtown stop, lots of seats." },

  // SF
  { id: "sf-1", name: "Ferry Building — Blue Bottle", kind: "cafe", city: "sf", lat: 37.795, lng: -122.393, blurb: "Public marketplace, very busy." },
  { id: "sf-2", name: "Réveille Coffee (North Beach)", kind: "cafe", city: "sf", lat: 37.799, lng: -122.407, blurb: "Corner cafe with outdoor seats." },
  { id: "sf-3", name: "SF Public Library — Main", kind: "library", city: "sf", lat: 37.779, lng: -122.416, blurb: "Central public library, cafe nearby." },
  { id: "sf-4", name: "Sightglass Coffee (SoMa)", kind: "cafe", city: "sf", lat: 37.772, lng: -122.409, blurb: "Two-story SoMa roastery." },
  { id: "sf-5", name: "Ritual Coffee (Mission)", kind: "cafe", city: "sf", lat: 37.762, lng: -122.422, blurb: "Mission staple, plenty of seating." },
];

export function spotsForCity(city: string): CoffeeSpot[] {
  return COFFEE_SPOTS.filter((s) => s.city === city);
}
