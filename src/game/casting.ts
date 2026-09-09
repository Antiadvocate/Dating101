/**
 * CASTING — the front door. Turns what the player typed into a world, a cast,
 * and one spine per person they said they wanted to date.
 *
 * Two calls, in order:
 *
 *   1. WEFT'S OWN FORGE, with a seed we compose. It builds the town, ten places,
 *      the whole cast with voices, tastes, attachment styles and schedules, and
 *      it does that job extremely well already — there was no version of this
 *      worth writing from scratch. What we do is shape the seed so the people
 *      the player described come out as NPCs under the names they gave, and so
 *      the world is a place where those four could plausibly all be met.
 *
 *   2. THE SPINE CALL, once, covering every route at the same time. Doing all
 *      four in one call is not only cheaper — it is the only way the four arcs
 *      come out different from each other, because the model can see that beat
 *      three of the ochre route must not be beat three of the madder one.
 */
import { api, type ClientSave } from "@weft/lib/api";
import { complete, buildMessages, extractJson, repairJson } from "@weft/llm";
import { DEFAULT_MODELS } from "@weft/engine/types";
import type { SaveState, Identity } from "@weft/engine/types";
import { ROUTE_ACCENTS, type AnySave, type Arc, type Beat, type DatingLayer, type Terminal } from "./types";
import { enterBeat } from "./arc";

export interface Brief {
  /** What the player typed. The whole description, verbatim. */
  text: string;
  /** Optional — if they gave a name, we hold the forge to it. */
  name?: string;
}

export interface CastingInput {
  /** The player's own character: who they are, in their own words. */
  you: string;
  your_name: string;
  your_pronouns: string;
  /** One to four people. */
  briefs: Brief[];
  /** Genre and register. Passed to Weft's tone field, which governs the key the
   *  whole thing is written in. */
  register: string;
  /** Where this happens. Blank lets the forge choose. */
  setting: string;
  /** How long a route runs. Beats, not turns. */
  beats: number;
  /** Ground the forge with web search — for a real city, a real subculture. */
  ground: boolean;
  model: string;
}

function safeJson<T>(text: string, fallback: T): T {
  for (const attempt of [extractJson(text), repairJson(extractJson(text))]) {
    try { return JSON.parse(attempt) as T; } catch { /* try the next one */ }
  }
  return fallback;
}

const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 10)}`;

/* ── THE SEED ────────────────────────────────────────────────────────────────
   Composed rather than typed, because the forge reads a seed the way a builder
   reads a brief and it responds to structure. The one thing that matters most
   here is the instruction to make the described people STRANGERS at zero warmth:
   Weft will otherwise happily hand you a cast that already loves you, and a
   dating game where everyone starts fond of you has nothing left to play for. */
export function buildSeed(i: CastingInput): string {
  const people = i.briefs.map((b, n) => {
    const name = b.name?.trim();
    return `PERSON ${n + 1}${name ? ` — name them exactly "${name}"` : ""}:\n${b.text.trim()}`;
  }).join("\n\n");

  return [
    i.setting.trim()
      ? `SETTING: ${i.setting.trim()}`
      : `SETTING: choose an ordinary, specific, modern place where all of the people below could plausibly cross paths in a week — a neighbourhood, a campus, a small city district. Somewhere with bars, work, weather and neighbours.`,
    ``,
    `THE PLAYER — build this person as the player character:`,
    `Name: ${i.your_name.trim() || "unnamed"}. Pronouns: ${i.your_pronouns.trim() || "they/them"}.`,
    i.you.trim() || "An ordinary adult, newly arrived, with a job and no one here yet.",
    ``,
    `THE PEOPLE THIS STORY IS ABOUT. Build EACH of the following as its own named NPC, exactly as described. These are the most important characters in the world; build them first and build them completely. Do not merge two of them into one person, do not rename them, and do not soften a description you find unusual — the player wrote these on purpose.`,
    ``,
    people,
    ``,
    `Then add two or three OTHER NPCs who are not romantic prospects — a friend, a colleague, a neighbour, somebody's sibling — so the world has people in it who are not being courted. Give them wants of their own that have nothing to do with the player.`,
    ``,
    `RELATIONSHIPS AT THE START: the player is a stranger to every one of the people above. Warmth 0, trust 0, relation_to_player "stranger" or a plain neutral descriptor ("the woman who works the late shift", "her brother's friend, met once"). NOBODY starts fond of the player. Whatever any of them come to feel has to happen in play. This is the single most important instruction in this seed: a cast that begins warm has nothing left to give.`,
    ``,
    `THE STORY IS ABOUT GETTING TO KNOW SOMEBODY. Threads and faction clocks should be the ordinary machinery of these people's lives — a lease running out, a sister who keeps calling, a job that is going badly, an ex who is still around, a band that is falling apart — not a conspiracy and not a crisis aimed at the player. Keep the seeded tension low. The pressure in this story comes from other people's lives colliding with yours, not from threat.`,
  ].join("\n");
}

/* ── THE SPINE ───────────────────────────────────────────────────────────────*/

const SPINE_SYSTEM = `You are building the STRUCTURE of a romance — the ordered spine of scenes a route is made of, and the three ways it can end. Output ONE strict JSON object and nothing else.

WHAT A BEAT IS. A beat is a JOB, not a scene. You are not writing what happens; you are naming what this scene EXISTS TO PUT IN FRONT OF THE PLAYER. The actual scene gets generated later, out of live state, when the player arrives at it — so a beat written as "they go to the pier and it rains" is useless (by the time it is reached the relationship may be nothing like the one it assumed), while "the first time she has to choose the player over something she already promised somebody else" works at any temperature and produces a different evening depending on where things stand.

Write each job so that a reader could later look at a scene and answer yes or no: did that happen? "They grow closer" cannot be judged. "She tells the player something she has not told the friends she has had for ten years" can.

THE SHAPE OF A ROUTE. Beat one is always the meeting, and it is small — two people in the same place with a plausible reason to speak. From there the beats must ESCALATE IN KIND, not just in intensity: a route that is eight conversations is a bad route. Across the spine you need at least one beat where somebody else is in the room, at least one where something practical goes wrong, at least one where the player sees this person doing the thing they actually do all day, at least one that is physical, and at least one where the person is unmistakably unhappy about something that is not the player. The last two beats are where it becomes what it is going to be.

WHAT YOU ARE FORBIDDEN FROM WRITING.
- No fated meetings, no bumping into each other and dropping papers, no rain-soaked confessions, no rescuing anybody from anything, no love triangles resolved by a third party leaving, no misunderstandings that a single sentence would fix, no "she is not like other people".
- No beat may hinge on a secret being revealed, unless the player's own description of the person established a secret.
- No beat may be titled or described with an aphorism, a maxim, or a general truth about love, people, or life. Not in a title, not in a job, not in a terminal.
- Do not write the person as a prize, a lesson, or a problem to be solved.
- Nothing may be sentimental. Write it the way a good short story collection is written: specific, dry, and interested in what people actually do.

TITLES are a short phrase — four to nine words, concrete, drawn from the beat's own content. "The night the van does not start." "What she is like around her brother." Never a theme. Never a pun.

WHERE and WHEN are advisory. WHERE must be one of the place names given to you and nothing else. WHEN is a short phrase of elapsed time and time of day ("the following Tuesday, late"), and the gaps between beats should be uneven — days, then a week, then the same night.

FLOOR and CEILING are how many of the player's turns the beat must last at minimum, and after how many it closes whether or not its job got done. Small beats: floor 3, ceiling 8. Ordinary beats: floor 4, ceiling 11. The two or three big ones: floor 6, ceiling 16. Never a floor above 7 or a ceiling above 18.

THE THREE ENDINGS, written specifically for THIS person — a guarded person's bad ending is not a reckless person's bad ending:
- "win": what it looks like when this actually works. Concrete and small. Not a wedding, not a declaration; a scene you could film.
- "loss": it does not happen, and why it does not, in this person's particular way of not happening.
- "sour": THE INTERESTING ONE. The player gets what they were playing for and it is bad — wanted and not trusted, or kept and not liked, or two people who have ended up together out of momentum. Write it without judgement and without a moral.

Every route you are given must come back COMPLETELY DIFFERENT from the others: different beat kinds, different pacing, different endings. If two routes could swap a beat without anyone noticing, rewrite one.

SHAPE:
{"routes":[{"name":"exact name as given","beats":[{"title":"","job":"","where":"","when":"","floor":4,"ceiling":11}],"terminals":[{"kind":"win","title":"","description":""},{"kind":"loss","title":"","description":""},{"kind":"sour","title":"","description":""}]}]}`;

interface RawRoute {
  name?: string;
  beats?: { title?: string; job?: string; where?: string; when?: string; floor?: number; ceiling?: number }[];
  terminals?: { kind?: string; title?: string; description?: string }[];
}

const clampInt = (v: unknown, lo: number, hi: number, dflt: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt;
};

function normalizeBeats(raw: RawRoute["beats"], want: number, places: string[]): Beat[] {
  const out: Beat[] = [];
  for (const b of raw ?? []) {
    const title = String(b?.title ?? "").trim();
    const job = String(b?.job ?? "").trim();
    if (!title || !job) continue;
    const ceiling = clampInt(b?.ceiling, 5, 18, 11);
    out.push({
      id: uid("beat"),
      idx: out.length,
      title, job,
      where: places.includes(String(b?.where ?? "")) ? String(b?.where) : (places[0] ?? ""),
      when: String(b?.when ?? "").trim() || "later",
      floor: Math.min(clampInt(b?.floor, 2, 7, 4), ceiling - 2),
      ceiling,
      status: "locked",
    });
    if (out.length >= want) break;
  }
  return out;
}

function normalizeTerminals(raw: RawRoute["terminals"], who: string): Terminal[] {
  const want: Terminal["kind"][] = ["win", "loss", "sour"];
  return want.map((kind) => {
    const hit = (raw ?? []).find((t) => String(t?.kind ?? "").toLowerCase() === kind);
    return {
      kind,
      title: String(hit?.title ?? "").trim() || (
        kind === "win" ? "It works" : kind === "loss" ? "It does not happen" : "It happens, and it is not good"
      ),
      description: String(hit?.description ?? "").trim() || (
        kind === "win" ? `Something ordinary and durable, with ${who}.`
          : kind === "loss" ? `${who} goes on with their life and you are not in it.`
          : `You end up with ${who} and neither of you is telling the truth about it.`
      ),
    };
  });
}

/** Find the character the player described, in the cast the forge built. Exact
 *  name first, then a loose match, then the least-connected NPC as a last
 *  resort — a route pointed at the wrong person is recoverable by hand; a
 *  casting screen that throws is not. */
function matchCharacter(save: AnySave, brief: Brief, taken: Set<string>): string | null {
  const cast = Object.values(save.characters).filter(
    (c) => c.character_id !== "char_player" && !taken.has(c.character_id),
  );
  const want = (brief.name ?? "").trim().toLowerCase();
  if (want) {
    const exact = cast.find((c) => c.name.trim().toLowerCase() === want);
    if (exact) return exact.character_id;
    const loose = cast.find((c) => c.name.toLowerCase().includes(want) || want.includes(c.name.toLowerCase()));
    if (loose) return loose.character_id;
  }
  // No name given: match on the most distinctive word in the description that
  // shows up in a background.
  const words = brief.text.toLowerCase().match(/[a-z]{5,}/g) ?? [];
  let best: Identity | null = null, bestScore = 0;
  for (const c of cast) {
    const hay = `${c.background} ${c.core_traits.join(" ")} ${c.appearance_facts}`.toLowerCase();
    const score = words.reduce((n, w) => n + (hay.includes(w) ? 1 : 0), 0);
    if (score > bestScore) { best = c; bestScore = score; }
  }
  return (best ?? cast[0])?.character_id ?? null;
}

export interface CastingProgress { (phase: string): void }

export async function runCasting(input: CastingInput, onPhase: CastingProgress = () => {}): Promise<ClientSave> {
  const model = input.model || DEFAULT_MODELS.forge_model;

  onPhase("building the place and the people");
  const save = await api.forge(
    buildSeed(input),
    model,
    undefined,
    input.ground,
    undefined,
    input.register.trim() || "contemporary romance, plainly written, adult",
  );

  onPhase("writing the arcs");
  const placeNames = Object.values(save.world.places).map((p) => p.name);

  // Match every brief to a character BEFORE the spine call, so the spine can be
  // written against the person the forge actually produced rather than against
  // the sketch the player typed.
  const taken = new Set<string>();
  const pairs: { brief: Brief; char: Identity }[] = [];
  for (const brief of input.briefs) {
    const id = matchCharacter(save, brief, taken);
    if (!id) continue;
    taken.add(id);
    pairs.push({ brief, char: save.characters[id] });
  }

  const roster = pairs.map(({ brief, char }, n) => [
    `ROUTE ${n + 1} — ${char.name}, ${char.age}, ${char.pronouns ?? "they/them"}`,
    `What the player asked for: ${brief.text.trim()}`,
    `Who the world made: ${char.background}`,
    `Traits: ${char.core_traits.join(", ")}`,
    `Values: ${char.values.join(", ")}`,
    `Talks like: ${char.speech_pattern}`,
    char.attachment?.under_threat ? `When frightened or hurt: ${char.attachment.under_threat}` : "",
    char.texture?.length ? `Standing interests: ${char.texture.join("; ")}` : "",
    `Wants right now: ${char.drive?.goal ?? char.current_goal ?? "unstated"}`,
  ].filter(Boolean).join("\n")).join("\n\n");

  const volatile = [
    `GENRE AND REGISTER: ${input.register.trim() || "contemporary romance, plainly written, adult"}`,
    `THE WORLD: ${save.world_bible.name} — ${save.world_bible.political_situation}`,
    `PLACES (use these names verbatim for the where field): ${placeNames.join(" · ")}`,
    `THE PLAYER: ${save.characters["char_player"]?.name}, ${save.characters["char_player"]?.age}. ${save.characters["char_player"]?.background}`,
    ``,
    `Write ${input.beats} beats for EACH of the following routes.`,
    ``,
    roster,
  ].join("\n");

  const msgs = buildMessages(SPINE_SYSTEM, "SPINE REQUEST", volatile, model);
  let parsed: { routes?: RawRoute[] } = {};
  for (const m of [model, model, DEFAULT_MODELS.fallback_model]) {
    try {
      const out = await complete(msgs, m, m, true, 7000);
      parsed = safeJson<{ routes?: RawRoute[] }>(out.text, {});
      if ((parsed.routes?.length ?? 0) >= pairs.length) break;
    } catch { /* fall through to the next model */ }
  }

  const routes: Record<string, Arc> = {};
  pairs.forEach(({ brief, char }, n) => {
    const raw = (parsed.routes ?? []).find(
      (r) => String(r?.name ?? "").trim().toLowerCase() === char.name.trim().toLowerCase(),
    ) ?? (parsed.routes ?? [])[n];
    let beats = normalizeBeats(raw?.beats, input.beats, placeNames);
    if (beats.length < 3) beats = fallbackBeats(char.name, input.beats, placeNames);
    beats.forEach((b, i) => { b.idx = i; });
    routes[char.character_id] = {
      char_id: char.character_id,
      name: char.name,
      accent: ROUTE_ACCENTS[n % ROUTE_ACCENTS.length],
      brief: brief.text.trim(),
      beats,
      terminals: normalizeTerminals(raw?.terminals, char.name),
      cursor: 0,
      state: "running",
    };
  });

  const dating: DatingLayer = {
    version: 1,
    routes,
    active: null,
    gate: null,
    needs_opening: false,
    keepsakes: [],
    register: input.register.trim(),
  };
  (save as ClientSave & { dating: DatingLayer }).dating = dating;
  return save;
}

/** If the spine call comes back unusable we still have to hand the player a
 *  game. These are deliberately generic — they are a scaffold to be played and
 *  edited, not a story — and the spine screen says so. */
function fallbackBeats(who: string, want: number, places: string[]): Beat[] {
  const jobs: [string, string][] = [
    ["The first time you are in the same room", `The player and ${who} end up in conversation with a plausible reason to be talking, and one of them decides whether to keep it going.`],
    ["Somebody else is there too", `The player sees ${who} with people who already know them, and how different that version is.`],
    ["The thing they actually do all day", `The player sees ${who} in the middle of their work or their obligations, competent and busy and not thinking about the player.`],
    ["Something practical goes wrong", `A plan the two of them made fails on a logistical detail, and the evening becomes about handling it.`],
    ["The first time it is physical", `Proximity stops being accidental, and both of them know it.`],
    ["What they are unhappy about", `${who} is plainly upset about something that has nothing to do with the player, and the player finds out whether they get to be part of it.`],
    ["The thing they have not said", `${who} either tells the player something costly or decides not to, and the player learns which.`],
    ["What this is going to be", `The two of them are forced to name what has been happening, or to go on not naming it.`],
  ];
  return jobs.slice(0, Math.max(3, want)).map(([title, job], i) => ({
    id: uid("beat"), idx: i, title, job,
    where: places[i % Math.max(1, places.length)] ?? "",
    when: i === 0 ? "an ordinary evening" : "some days later",
    floor: i >= jobs.length - 2 ? 6 : 4,
    ceiling: i >= jobs.length - 2 ? 15 : 10,
    status: "locked",
  }));
}

/** Commit to a route. Everything about the interface follows the accent from
 *  here — this is the moment the game changes colour. */
export function beginRoute(save: SaveState, char_id: string): void {
  const d = (save as SaveState & { dating: DatingLayer }).dating;
  if (!d?.routes[char_id]) return;
  d.active = char_id;
  d.gate = null;
  enterBeat(save, d.routes[char_id].cursor);
}
