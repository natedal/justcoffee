import type { User } from "./types";
import { getCity } from "./cities";
import { jitter } from "./geo";

// Deterministic RNG so the seeded world is stable across restarts.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Persona {
  name: string;
  pseudonym: string;
  age: number;
  city: string;
  iAm: string;
  lookingTo: string;
  availability: User["availability"];
  openness: number;
}

// Hand-authored so the pool produces good pairings at every point on the
// "someone like me" ↔ "someone I'd never normally meet" dial.
const PERSONAS: Persona[] = [
  {
    name: "Jordan", pseudonym: "Sage", age: 34, city: "austin",
    iAm: "I'm a pretty progressive public-school teacher.",
    lookingTo: "I want to actually understand how someone on the right sees the world.",
    availability: "now", openness: 0.9,
  },
  {
    name: "Marcus", pseudonym: "River", age: 41, city: "austin",
    iAm: "I'm a small-business owner and lifelong conservative.",
    lookingTo: "I'd like to share why I believe what I do with someone who disagrees.",
    availability: "now", openness: 0.85,
  },
  {
    name: "Priya", pseudonym: "Wren", age: 29, city: "austin",
    iAm: "I'm a burned-out startup founder running on fumes.",
    lookingTo: "I just need to vent to someone who isn't in tech.",
    availability: "now", openness: 0.8,
  },
  {
    name: "Tom", pseudonym: "Cedar", age: 58, city: "austin",
    iAm: "I'm a retired hospice nurse and a good listener.",
    lookingTo: "I'd like to listen to someone who needs to talk something through.",
    availability: "now", openness: 0.95,
  },
  {
    name: "Dana", pseudonym: "Lark", age: 24, city: "austin",
    iAm: "I'm a CS student who just moved here and knows nobody.",
    lookingTo: "I'm looking to make a new friend and feel less alone in a new city.",
    availability: "today", openness: 0.9,
  },
  {
    name: "Eli", pseudonym: "Ash", age: 27, city: "austin",
    iAm: "I'm a line cook who moved across the country last month.",
    lookingTo: "I want to meet people and build a little community here.",
    availability: "today", openness: 0.85,
  },
  {
    name: "Sofia", pseudonym: "Juno", age: 38, city: "austin",
    iAm: "I'm a climate scientist who loves a good argument.",
    lookingTo: "I want to debate someone who's skeptical about climate policy.",
    availability: "weekend", openness: 0.7,
  },
  {
    name: "Hank", pseudonym: "Bel", age: 49, city: "austin",
    iAm: "I'm an oil-and-gas engineer who's tired of being caricatured.",
    lookingTo: "I'd debate climate policy with someone who'll actually hear me out.",
    availability: "weekend", openness: 0.75,
  },
  {
    name: "Aisha", pseudonym: "Vera", age: 31, city: "austin",
    iAm: "I'm a devout Muslim and a pediatric nurse.",
    lookingTo: "I want to talk about faith and meaning with someone who believes differently.",
    availability: "today", openness: 0.8,
  },
  {
    name: "Noah", pseudonym: "Flint", age: 33, city: "austin",
    iAm: "I'm a cheerful atheist and a stand-up comic.",
    lookingTo: "I'm curious to understand what faith actually feels like from the inside.",
    availability: "today", openness: 0.85,
  },
  {
    name: "Grace", pseudonym: "Indi", age: 45, city: "austin",
    iAm: "I'm a chef who's failed at three restaurants and learned a lot.",
    lookingTo: "I'd love to share hard-won lessons with someone just starting out.",
    availability: "now", openness: 0.8,
  },
  {
    name: "Leo", pseudonym: "Sol", age: 22, city: "austin",
    iAm: "I'm a first-time founder who has no idea what I'm doing.",
    lookingTo: "I'm looking for advice from someone who's been knocked down and got up.",
    availability: "now", openness: 0.9,
  },
  {
    name: "Maya", pseudonym: "Posy", age: 36, city: "austin",
    iAm: "I'm a new mom feeling isolated on parental leave.",
    lookingTo: "I want to talk to another parent who gets how lonely this can be.",
    availability: "today", openness: 0.75,
  },
  {
    name: "Will", pseudonym: "Dexter", age: 39, city: "austin",
    iAm: "I'm a stay-at-home dad of two who misses adult conversation.",
    lookingTo: "I'd love to swap parenting war stories with someone in the trenches.",
    availability: "today", openness: 0.8,
  },
  // A couple farther afield, to prove distance filtering works.
  {
    name: "Rosa", pseudonym: "Mica", age: 30, city: "nashville",
    iAm: "I'm a songwriter who waits tables to pay rent.",
    lookingTo: "I want to meet someone outside the music bubble for once.",
    availability: "weekend", openness: 0.8,
  },
  {
    name: "Ben", pseudonym: "Arlo", age: 52, city: "denver",
    iAm: "I'm a mountain guide who reads philosophy on the trail.",
    lookingTo: "I'm looking to chew on the big questions with a total stranger.",
    availability: "weekend", openness: 0.85,
  },
  // New York — a second dense metro so the matcher has a real pool there too.
  {
    name: "Yusuf", pseudonym: "Atlas", age: 35, city: "nyc",
    iAm: "I'm a progressive union organizer in Brooklyn.",
    lookingTo: "I want to really understand how a small-business owner sees the economy.",
    availability: "now", openness: 0.9,
  },
  {
    name: "Diane", pseudonym: "Birch", age: 47, city: "nyc",
    iAm: "I'm a finance lifer who's quietly conservative.",
    lookingTo: "I'd like to explain why I see markets the way I do to someone who disagrees.",
    availability: "now", openness: 0.85,
  },
  {
    name: "Priya", pseudonym: "Cove", age: 28, city: "nyc",
    iAm: "I'm a burned-out ER resident who just moved to the city.",
    lookingTo: "I need to vent to someone completely outside of medicine.",
    availability: "now", openness: 0.8,
  },
  {
    name: "Walt", pseudonym: "Dune", age: 61, city: "nyc",
    iAm: "I'm a retired subway conductor and a patient listener.",
    lookingTo: "I'd like to listen to someone who needs to talk something through.",
    availability: "today", openness: 0.95,
  },
  {
    name: "Mei", pseudonym: "Echo", age: 24, city: "nyc",
    iAm: "I'm a grad student who knows almost no one in New York.",
    lookingTo: "I'm looking to make a friend and feel less alone in a huge city.",
    availability: "today", openness: 0.9,
  },
  {
    name: "Sol", pseudonym: "Ferro", age: 33, city: "nyc",
    iAm: "I'm a painter waiting tables in Queens.",
    lookingTo: "I want to swap creative survival stories with someone who gets it.",
    availability: "weekend", openness: 0.85,
  },
  {
    name: "Ibrahim", pseudonym: "Glade", age: 30, city: "nyc",
    iAm: "I'm a devout Muslim and a high-school physics teacher.",
    lookingTo: "I want to talk about faith and meaning with someone who believes differently.",
    availability: "today", openness: 0.8,
  },
  {
    name: "Hannah", pseudonym: "Haven", age: 38, city: "nyc",
    iAm: "I'm a cheerful atheist and a documentary editor.",
    lookingTo: "I'm curious what faith actually feels like from the inside.",
    availability: "today", openness: 0.85,
  },
];

export function buildSeedUsers(): User[] {
  const rng = mulberry32(20260626);
  const now = Date.now();
  return PERSONAS.map((p, i) => {
    const city = getCity(p.city);
    const { lat, lng } = jitter(city.lat, city.lng, 3.2, rng);
    return {
      id: `demo-${i + 1}`,
      name: p.name,
      pseudonym: p.pseudonym,
      age: p.age,
      iAm: p.iAm,
      lookingTo: p.lookingTo,
      avatar: { hue: Math.floor(rng() * 6), shape: Math.floor(rng() * 5) },
      city: p.city,
      lat,
      lng,
      availability: p.availability,
      isDemo: true,
      openness: p.openness,
      createdAt: now - (i + 1) * 60000,
    } satisfies User;
  });
}
