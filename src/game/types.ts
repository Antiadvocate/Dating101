import type { SaveState } from "@weft/engine/types";
import type { ClientSave } from "@weft/lib/api";
import type { Appetites, Explicitness } from "./appetite";

/** The four route palettes, in casting order. A love interest owns one for the
 *  life of the save and the whole interface wears it while you are with them. */
export const ROUTE_ACCENTS = ["madder", "ochre", "verd", "plum"] as const;
export type RouteAccent = typeof ROUTE_ACCENTS[number];

export const ACCENT_NAMES: Record<RouteAccent, string> = {
  madder: "Madder", ochre: "Ochre", verd: "Verdigris", plum: "Plum",
};

/** ── A BEAT ──────────────────────────────────────────────────────────────────
 *
 *  The thing that makes this work at all, and the one design decision worth
 *  arguing about, is that a beat is written as a JOB rather than as a scene.
 *
 *  The obvious build is to have the forge write eight scenes at casting: she
 *  takes you to the pier, it rains, you argue about your sister. Two problems
 *  with that, and the second one is fatal. The first is that a scene written
 *  before turn one cannot know anything about the ninety turns of play that
 *  precede it, so by beat five it is describing a relationship that no longer
 *  exists. The second is that branching multiplies it: three doors over eight
 *  beats is six and a half thousand scenes, and the forge would still be
 *  writing at Christmas.
 *
 *  So the spine holds functions. Beat five is not "the pier"; it is "the first
 *  time she has to choose you over something she already promised somebody
 *  else." That is knowable at casting, it is specific enough to read as
 *  authored when the player looks at the spine, and the actual scene — where,
 *  when, who else is there, what she is carrying — is generated at the moment
 *  the beat opens, out of live world state. The same function at warmth 60 and
 *  at warmth 15 produces two scenes that share nothing but their purpose.
 *
 *  What the player gets is the promise of an authored story (eight beats, named,
 *  visible from turn one, two endings printed at the bottom of the spine) with
 *  none of the staleness. The rails are real. The road is not drawn until you
 *  are on it. */
export interface Beat {
  id: string;
  idx: number;
  /** What the player sees on the spine. A phrase, not a sentence: "The first
   *  night neither of you mentions it." */
  title: string;
  /** THE JOB. What this beat exists to put in front of the player, written so a
   *  model can generate a scene from it and a model can later judge whether it
   *  happened. Never a location, never a line of dialogue. */
  job: string;
  /** A place NAME (resolved against the world's gazetteer at entry, created if
   *  it does not exist). Advisory — a door can move it. */
  where: string;
  /** Flavour and a time-skip hint: "a Thursday, late", "three weeks later". */
  when: string;
  /** Turns that must pass inside the beat before the gate may open. Stops a
   *  two-line scene from resolving the whole thing. */
  floor: number;
  /** Turns after which the gate opens whether or not the job discharged. Stops
   *  a player from parking in one beat forever, which is the exact cheese the
   *  fixed spine exists to prevent: you cannot buy affection with turns. */
  ceiling: number;
  status: "locked" | "open" | "done" | "skipped";

  /* ── written during play ─────────────────────────────────────────────── */
  entered_turn?: number;
  closed_turn?: number;
  /** The situation, generated at entry: two or three sentences of where you
   *  are, when it is, and what is already in motion. Shown on the title card
   *  and then handed to the narrator as the scene's ground. */
  opening?: string;
  /** The place id this beat actually resolved to. */
  place_id?: string;
  illustration?: string;
  /** How the beat closed, measured off the engine's own edge state rather than
   *  asked of a model. */
  outcome?: "warm" | "level" | "cool" | "broken";
  /** Heat at entry and at close — the delta is the outcome. */
  heat_in?: number;
  heat_out?: number;
  /** The door the player went through on the way out, printed on the spine
   *  between this frame and the next. */
  taken?: string;
}

/** An ending. Every route carries exactly three and the player can read all of
 *  them from turn one — which sounds like a spoiler and is the opposite: knowing
 *  the two ways this can go badly is what makes the middle tense. */
export interface Terminal {
  kind: "win" | "loss" | "sour";
  title: string;
  /** One or two sentences. The forge writes these against the person, so the
   *  sour ending for a guarded person is not the sour ending for a reckless
   *  one. */
  description: string;
}

export interface Arc {
  char_id: string;
  /** Kept beside the character record so the spine can be drawn before the save
   *  has finished loading its cast. */
  name: string;
  accent: RouteAccent;
  /** The premise the player typed at casting. Never rewritten. */
  brief: string;
  beats: Beat[];
  terminals: Terminal[];
  cursor: number;
  state: "running" | "won" | "lost" | "soured";
  /** HOW FAR THINGS HAVE ACTUALLY GONE, 0-6 on the ladder in game/appetite.ts.
   *  Measured off the page by the gate judge rather than inferred from
   *  attraction, because attraction reads to a model as permission and this has
   *  to read as history. Moves at most one rung per chapter. */
  rung?: number;
  ended_turn?: number;
  /** The ending as it was actually written. */
  ending_prose?: string;
  /** Which terminal landed. */
  ending_kind?: Terminal["kind"];
}

export interface Door {
  id: string;
  /** An imperative, second person, short: "Walk her home the long way." */
  label: string;
  /** The read — what taking this door would mean, in behaviour rather than in
   *  numbers. Never states an outcome; a door that tells you what happens next
   *  is not a choice. */
  read: string;
  /** Which beat this leads to. Normally cursor + 1. A door may skip a beat (you
   *  moved fast) or send you back to one you already used (you are repeating
   *  yourself, and the beat opens differently the second time). */
  to: number;
  /** Whether this door reads as a step toward the win, the loss, or sideways.
   *  Advisory only: it seeds the next beat's opening. Nothing about the ending
   *  is decided here — that is measured off live state at the terminal. */
  bearing: "toward" | "away" | "across";
}

export interface Gate {
  beat_idx: number;
  opened_turn: number;
  doors: Door[];
  /** Why the gate opened — the job discharged, or the ceiling ran out. Printed
   *  small above the doors, because a player who is told "time is up" plays the
   *  next beat differently from one who is told "that landed". */
  because: "discharged" | "ceiling";
}

/** A picture worth keeping — every illustration the game generates, filed with
 *  where and when it was. The album. */
export interface Keepsake {
  id: string;
  char_id: string;
  beat_idx: number;
  turn: number;
  time: string;
  place: string;
  caption: string;
  image: string;
}

/** The dating layer, hung off the Weft save. `sanitize` copies unknown fields
 *  through untouched, so this rides along in IndexedDB and in exports without
 *  the engine needing to know it exists. */
export interface DatingLayer {
  version: 1;
  routes: Record<string, Arc>;
  /** char_id of the route being played. Null between routes. */
  active: string | null;
  gate: Gate | null;
  /** Set when a beat has been entered but its opening has not been written yet. */
  needs_opening: boolean;
  keepsakes: Keepsake[];
  /** The genre line, kept separately from world_bible.tone so the casting screen
   *  can show it back verbatim. */
  register: string;
  /** WHAT KIND OF GAME THIS IS. Set once at casting, editable in the studio.
   *  `palette` seeds the cast's appetites and is not a promise — a person built
   *  under it still gets their own limits. `limits` is the player's own never
   *  list and is pasted into every generation call this layer makes. */
  heat: {
    explicitness: Explicitness;
    palette: string[];
    limits: string[];
  };
  /** What each character actually wants, keyed by char_id. Kept here rather than
   *  on Weft's Identity so nothing in vendor/ has to change and a subtree pull
   *  never conflicts. */
  appetites: Record<string, Appetites>;
  /** Turns the player has spent at a gate without choosing. Cosmetic. */
  seen_prologue?: boolean;
  /** Sentences the voice check found in the turn just written, quoted back to
   *  the narrator on the next one and then cleared. Weft uses the same
   *  mechanism for maxims and echoes, and it is the only correction in the
   *  engine that reliably changes behaviour — a rule in the system prompt gets
   *  read as reference, a sentence you just wrote gets read as a mistake. */
  last_faults?: { quote: string; why: string }[];
}

export type DatingSave = SaveState & { dating: DatingLayer };

/** THE READ-ONLY VIEW OF A SAVE.
 *
 *  The engine works on `SaveState` and the app works on `ClientSave`, and the
 *  only difference between them is `snapshots` — which the engine keeps and the
 *  client view strips because it is megabytes of rollback state no view has ever
 *  needed. Every helper in this layer that only READS a save takes this instead,
 *  so one implementation serves both sides and no view has to cast. Anything
 *  that MUTATES still takes SaveState, because mutation only ever happens on the
 *  engine side of the fence. */
export type AnySave = Omit<SaveState, "snapshots">;

/** The client-side view of a dating save — what every view in the app is handed.
 *  Weft's ClientSave spreads the whole record, so the layer rides along; this
 *  alias is the only place that has to say so. */
export type Save = ClientSave & { dating: DatingLayer };

export function isDating<T extends AnySave>(s: T): s is T & { dating: DatingLayer } {
  return !!(s as { dating?: DatingLayer }).dating?.routes;
}

/** The live route, or null. */
export function activeArc(s: AnySave): Arc | null {
  if (!isDating(s)) return null;
  const id = s.dating.active;
  return id ? s.dating.routes[id] ?? null : null;
}

export function currentBeat(a: Arc | null): Beat | null {
  if (!a) return null;
  return a.beats[a.cursor] ?? null;
}

/** The swatch, for anywhere a route has to be shown as a colour outside its own
 *  themed screen — the casting slots, the shelf, the route picker. Inside a
 *  route everything reads `var(--accent)` instead, which is set on the root. */
export const ACCENT_HEX: Record<RouteAccent, string> = {
  madder: "#b03a48", ochre: "#a3762a", verd: "#2b6f66", plum: "#6a4489",
};
