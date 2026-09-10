/**
 * THE SPINE — how a route advances, measured rather than asked.
 *
 * This module is deliberately pure: no model calls, no state written. It is the
 * arithmetic the rest of the dating layer is held to, which means the rules a
 * player can feel — when a scene ends, whether it went well, which ending is
 * coming — are all readable in one file and testable without spending a token.
 *
 * THE ONE THING IT REFUSES TO DO is keep its own affection number. Weft already
 * simulates the relationship: `warmth` is liking, `attraction` is wanting, and
 * they are separate channels on purpose (kindness earns gratitude, not desire —
 * see engine/desire.ts). A parallel "affection score" maintained by the dating
 * layer would be a second truth, and second truths desynchronise. Within ten
 * turns you would have a HUD saying 62 while the woman on the page is cold, and
 * no way to tell which one the story believed. So heat is a VIEW over the
 * engine's edge, computed fresh every time it is asked for, stored nowhere.
 */
import type { SaveState, SocialEdge } from "@weft/engine/types";
import type { AnySave, Arc, Beat, Door, Gate, Terminal } from "./types";
import { activeArc, currentBeat, isDating } from "./types";

/** Her feeling toward the player. Direction matters: the edge FROM the love
 *  interest TO char_player is what she feels, which is the only one the player
 *  is actually playing for. */
export function edgeToPlayer(s: AnySave, char_id: string): SocialEdge | null {
  return s.world.edges.find((e) => e.from === char_id && e.to === "char_player") ?? null;
}

export interface Heat {
  /** 0..100 composite. Never shown as a number by default — see game/read.ts. */
  value: number;
  warmth: number;       // -100..100, liking
  trust: number;        // -100..100, reliance
  attraction: number;   // -100..100, wanting
  /** 0..1 — how cleanly the wanting can be expressed. Low is the possessive,
   *  sideways texture; high is flirtation that can let a thing stand. */
  admissibility: number;
  /** The conditioned first read. Attraction cannot be lifted far past this by
   *  warmth alone, so a flat first read plateaus at fondness however well you
   *  play. Worth surfacing: it explains a route that will not catch. */
  base: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const to100 = (n: number) => clamp((n + 100) / 2, 0, 100);

/**
 * THE COMPOSITE. Warmth and attraction carry most of it because this is a dating
 * game and those are the two things being played for; trust is a quarter because
 * a relationship built on wanting alone is a real outcome the game should be
 * able to reach and grade — that is the sour ending, and it needs to be able to
 * score highly on two channels and badly on the third.
 */
export function heatOf(s: AnySave, char_id: string): Heat {
  const e = edgeToPlayer(s, char_id);
  const warmth = e?.warmth ?? 0;
  const trust = e?.trust ?? 0;
  const attraction = e?.attraction ?? 0;
  const value = clamp(
    to100(warmth) * 0.40 + to100(attraction) * 0.35 + to100(trust) * 0.25,
    0, 100,
  );
  return {
    value: Math.round(value),
    warmth, trust, attraction,
    admissibility: e?.desire_admissibility ?? 0.5,
    base: e?.attraction_base ?? attraction,
  };
}

/* ── THE GATE ────────────────────────────────────────────────────────────────
 *
 *  When a scene ends. The obvious answer — after an hour of in-world time —
 *  does not survive contact with the engine: the clock is advanced by the
 *  bookkeeper's estimate of elapsed minutes read off the prose, and it drifts
 *  far enough that Weft ships a control for correcting it by hand. An hour
 *  might be three turns of talking or fifteen. Gating on it would mean scenes
 *  of wildly different length for no reason the player could see.
 *
 *  So the gate opens on the beat's JOB being discharged — did the thing this
 *  scene exists for actually happen — bracketed by a turn floor and a turn
 *  ceiling. The floor stops a scene resolving before it has been played. The
 *  ceiling is the anti-grind rule and the reason the spine can promise a fixed
 *  ending: you cannot buy your way to a better outcome by talking for another
 *  forty turns, because the beat closes regardless and the spine has a fixed
 *  number of beats. Time is a budget, not a resource.
 */
export interface GateCheck {
  /** Turns spent inside the current beat. */
  elapsed: number;
  /** Below the floor: the gate cannot open yet, and we do not spend a model
   *  call asking whether it should. */
  belowFloor: boolean;
  /** At or past the ceiling: the gate opens on this turn whatever happened. */
  atCeiling: boolean;
  /** Worth asking the judge whether the job discharged. */
  shouldAsk: boolean;
  beat: Beat | null;
}

export function gateCheck(s: AnySave): GateCheck {
  const arc = activeArc(s);
  const beat = currentBeat(arc);
  if (!arc || !beat || beat.entered_turn == null || arc.state !== "running") {
    return { elapsed: 0, belowFloor: true, atCeiling: false, shouldAsk: false, beat: null };
  }
  const elapsed = Math.max(0, s.world.current_turn - beat.entered_turn);
  const belowFloor = elapsed < beat.floor;
  const atCeiling = elapsed >= beat.ceiling;
  return { elapsed, belowFloor, atCeiling, shouldAsk: !belowFloor && !atCeiling, beat };
}

/** How full the current beat is, 0..1 — drawn as a hairline that fills under
 *  the beat title. Deliberately not a countdown in turns: a number would have
 *  the player playing the meter instead of the scene. */
export function beatFullness(s: AnySave): number {
  const g = gateCheck(s);
  if (!g.beat) return 0;
  return clamp(g.elapsed / Math.max(1, g.beat.ceiling), 0, 1);
}

/* ── OUTCOME ─────────────────────────────────────────────────────────────────
 *  Graded off the engine's own ledger: heat at entry against heat at close. No
 *  model is asked how the scene went, because a model asked that question says
 *  it went well. */
export function gradeBeat(heatIn: number, heatOut: number): Beat["outcome"] {
  const d = heatOut - heatIn;
  if (d <= -9) return "broken";
  if (d <= -3) return "cool";
  if (d >= 5) return "warm";
  return "level";
}

export const OUTCOME_WORD: Record<NonNullable<Beat["outcome"]>, string> = {
  warm: "it went somewhere",
  level: "it held",
  cool: "it cooled",
  broken: "it came apart",
};

/* ── THE ENDING ──────────────────────────────────────────────────────────────
 *
 *  Three terminals, all three visible on the spine from turn one. That reads
 *  like a spoiler and does the opposite: knowing the two ways this can go wrong
 *  is most of what makes the middle of a route tense.
 *
 *  The third one is the one worth having. Win and lose are obvious and between
 *  them they cover a fairly boring space. The interesting outcome in a dating
 *  story is the one where you got exactly what you were playing for and it is
 *  bad — high wanting, no trust, a person who is with you and would not tell you
 *  anything true. The engine can express that state precisely, because wanting
 *  and trusting are separate numbers, so the game may as well grade for it. */
const WIN_AT = 64;
const LOSS_AT = 34;

export function resolveTerminal(s: AnySave, arc: Arc): Terminal["kind"] {
  const h = heatOf(s, arc.char_id);
  const broke = arc.beats.filter((b) => b.outcome === "broken").length;

  // SOUR — wanted and not trusted. Checked first: it outranks a winning
  // composite, because a high total assembled out of desire with the trust
  // channel on the floor is exactly the ending this branch is for.
  if (h.attraction >= 45 && h.trust <= 10) return "sour";
  // ...and its mirror: trusted, liked, and never wanted. A friendship you spent
  // eight beats trying to make into something else.
  if (h.warmth >= 55 && h.attraction < 15) return "sour";

  if (h.value >= WIN_AT && broke < 2) return "win";
  if (h.value <= LOSS_AT || broke >= 3) return "loss";
  return "sour";
}

export function terminalOf(arc: Arc, kind: Terminal["kind"]): Terminal | null {
  return arc.terminals.find((t) => t.kind === kind) ?? null;
}

/** Is the current beat the last one? The terminal is written on the way out of
 *  it rather than as a beat of its own — an ending is not a scene you play,
 *  it is what the scene you just played turned out to be. */
export function onFinalBeat(arc: Arc): boolean {
  return arc.cursor >= arc.beats.length - 1;
}

export function arcProgress(arc: Arc): number {
  return clamp((arc.cursor + 1) / Math.max(1, arc.beats.length), 0, 1);
}

/* ── MOVEMENT ────────────────────────────────────────────────────────────────
 *  Mutating helpers. They take the save and write to it; every caller persists
 *  afterwards. Kept here rather than in the API layer so the whole state machine
 *  is in one place. */

export function openGate(s: SaveState, doors: Door[], because: Gate["because"]): void {
  if (!isDating(s)) return;
  const arc = activeArc(s);
  if (!arc) return;
  s.dating.gate = { beat_idx: arc.cursor, opened_turn: s.world.current_turn, doors, because };
}

/** Walk through a door: close the beat behind you, grade it, and move the
 *  cursor. Returns the beat that just opened, or null if the route ended. */
export function takeDoor(s: SaveState, door: Door): Beat | null {
  if (!isDating(s)) return null;
  const arc = activeArc(s);
  if (!arc) return null;
  const beat = arc.beats[arc.cursor];
  if (beat) {
    beat.closed_turn = s.world.current_turn;
    beat.heat_out = heatOf(s, arc.char_id).value;
    beat.outcome = gradeBeat(beat.heat_in ?? beat.heat_out, beat.heat_out);
    beat.taken = door.label;
    beat.status = "done";
  }
  s.dating.gate = null;

  // A door may skip ahead. Anything it steps over is marked skipped rather than
  // deleted, so the spine still shows the road not taken — which is half the
  // point of drawing the spine at all.
  const next = clamp(Math.round(door.to), 0, arc.beats.length);
  for (let i = arc.cursor + 1; i < next && i < arc.beats.length; i++) {
    if (arc.beats[i].status === "locked") arc.beats[i].status = "skipped";
  }

  if (next >= arc.beats.length) {
    const kind = resolveTerminal(s, arc);
    arc.state = kind === "win" ? "won" : kind === "loss" ? "lost" : "soured";
    arc.ending_kind = kind;
    arc.ended_turn = s.world.current_turn;
    arc.cursor = arc.beats.length - 1;
    return null;
  }
  arc.cursor = next;
  return enterBeat(s, next);
}

/** Mark a beat as the live one and stamp the heat it began at. The opening
 *  prose is written separately (it costs a model call); `needs_opening` is the
 *  flag the scene view watches. */
export function enterBeat(s: SaveState, idx: number): Beat | null {
  if (!isDating(s)) return null;
  const arc = activeArc(s);
  const beat = arc?.beats[idx];
  if (!arc || !beat) return null;
  beat.status = "open";
  beat.entered_turn = s.world.current_turn;
  beat.heat_in = heatOf(s, arc.char_id).value;
  arc.cursor = idx;
  s.dating.needs_opening = !beat.opening;
  return beat;
}

/** Every beat, in order, with enough shape for the spine to draw itself without
 *  reaching into the save. */
export function spineFrames(arc: Arc): {
  beat: Beat; state: "past" | "here" | "ahead" | "skipped"; door?: string;
}[] {
  return arc.beats.map((beat, i) => ({
    beat,
    state: beat.status === "skipped" ? "skipped"
      : i < arc.cursor ? "past"
      : i === arc.cursor ? (arc.state === "running" ? "here" : "past")
      : "ahead",
    door: beat.taken,
  }));
}

/* ── HOW LONG BETWEEN CHAPTERS ───────────────────────────────────────────── */

const WORD_NUMBERS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, couple: 2, few: 3, several: 4,
};

/** How long a chapter's `when` phrase says has passed. The old version only read
 *  digits, so "four days later" parsed as the default two — which mattered less
 *  than it sounds, because the gap was being applied by nudging the clock and
 *  nothing else. Returns minutes. */
export function skipMinutes(when: string): number {
  const w = (when ?? "").toLowerCase();
  const count = (): number => {
    const digit = w.match(/\b(\d{1,2})\b/);
    if (digit) return Number(digit[1]);
    // Longest word first, or the articles win: "a couple of days" matches the
    // "a" before it ever reaches "couple", and a two-day gap becomes one.
    for (const [word, n] of Object.entries(WORD_NUMBERS).sort((x, y) => y[0].length - x[0].length)) {
      if (new RegExp(`\\b${word}\\b`).test(w)) return n;
    }
    return 0;
  };
  const n = count();
  if (/month/.test(w)) return (n || 1) * 43200;
  if (/week/.test(w)) return (n || 1) * 10080;
  if (/day|tomorrow|following|next/.test(w)) return (n || 2) * 1440;
  if (/hour|later that|same night|afterward|that evening/.test(w)) return (n || 3) * 60;
  return 900;
}
