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
import { fb } from "./gate";
import { seedAttraction } from "@weft/engine/desire";
import { appetiteBrief, adultAge, emptyAppetites, EXPLICITNESS, HARD_FLOOR, rungLabel, type Appetites, type Explicitness } from "./appetite";

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
  /** How long a route runs, counted in chapters rather than turns. */
  beats: number;
  /** Ground the forge with web search — for a real city, a real subculture. */
  ground: boolean;
  model: string;
  /** How far the prose goes. */
  explicitness: Explicitness;
  /** What the game is about — seeds the cast's appetites, promises nothing. */
  palette: string[];
  /** The player's own never list. Held on every call this layer makes. */
  limits: string[];
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
    `THIS IS AN ADULT STORY AND ITS SUBJECT IS DESIRE. Written at this level: ${EXPLICITNESS[i.explicitness].label} — ${EXPLICITNESS[i.explicitness].note} Build the world to suit it: the places should include somewhere private, somewhere these people would end up at two in the morning, and somewhere it would be a mistake to be seen. Give at least half the cast drive_goals that are about wanting someone, wanting to be wanted, jealousy, loneliness reaching outward, or an appetite they are not admitting to.`,
    i.palette.length ? `WHAT THIS GAME IS ABOUT: ${i.palette.join("; ")}. Build people for whom these are live, in their own particular versions — never all four in the same way, and at least one of them indifferent to something on the list.` : ``,
    i.limits.length ? `THIS STORY NEVER CONTAINS: ${i.limits.join("; ")}.` : ``,
    HARD_FLOOR,
    ``,
    `THE STORY IS ABOUT GETTING TO KNOW SOMEBODY. Threads and faction clocks should be the ordinary machinery of these people's lives — a lease running out, a sister who keeps calling, a job that is going badly, an ex who is still around, a band that is falling apart — not a conspiracy and not a crisis aimed at the player. Keep the seeded tension low. The pressure in this story should come from other people's lives running into the player's, rather than from anything threatening them.`,
  ].join("\n");
}

/* ── THE SPINE ───────────────────────────────────────────────────────────────*/

const SPINE_SYSTEM = `You are building the STRUCTURE of a romance — the ordered spine of scenes a route is made of, and the three ways it can end. Output ONE strict JSON object and nothing else.

WHAT A BEAT IS. Write each beat as a job rather than as a scene. You're not describing what happens, you're naming what this scene exists to put in front of the player. The actual scene gets generated later, out of live state, when the player arrives at it — so a beat written as "they go to the pier and it rains" is useless (by the time it is reached the relationship may be nothing like the one it assumed), while "the first time she has to choose the player over something she already promised somebody else" works at any temperature and produces a different evening depending on where things stand.

Write each job so that a reader could later look at a scene and answer yes or no: did that happen? "They grow closer" cannot be judged. "She tells the player something she has not told the friends she has had for ten years" can.

THE SHAPE OF A ROUTE. Beat one is always the meeting, and it is small — two people in the same place with a plausible reason to speak. After that the beats need to escalate in kind and not only in intensity, because a route made of eight conversations isn't much of a route. Across the spine you need at least one beat where somebody else is in the room, at least one where something practical goes wrong, at least one where the player sees this person doing the thing they actually do all day, at least one that is physical, and at least one where the person is unmistakably unhappy about something that is not the player. The last two beats are where it becomes what it is going to be.

WHAT YOU ARE FORBIDDEN FROM WRITING.
- No fated meetings, no bumping into each other and dropping papers, no rain-soaked confessions, no rescuing anybody from anything, no love triangles resolved by a third party leaving, no misunderstandings that a single sentence would fix, no "she is not like other people".
- No beat may hinge on a secret being revealed, unless the player's own description of the person established a secret.
- Don't title or describe any beat with an aphorism or a general truth about love or people or life, and that goes for the titles, the jobs and the endings alike.
- Do not write the person as a prize, a lesson, or a problem to be solved.
- Keep the sentiment out of it and write the way a good short story collection is written, which is specific and dry and mostly interested in what people actually do.

Titles are short phrases of four to nine words, concrete, and drawn from what the beat actually contains. "The night the van does not start." "What she is like around her brother." Don't use a theme and don't use a pun.

WHERE and WHEN are advisory. WHERE must be one of the place names given to you and nothing else. WHEN is a short phrase of elapsed time and time of day ("the following Tuesday, late"), and the gaps between beats should be uneven — days, then a week, then the same night.

FLOOR and CEILING are how many of the player's turns the beat must last at minimum, and after how many it closes whether or not its job got done. Small beats: floor 3, ceiling 8. Ordinary beats: floor 4, ceiling 11. The two or three big ones: floor 6, ceiling 16. Never a floor above 7 or a ceiling above 18.

PHYSICAL ESCALATION ACROSS THE SPINE. This is an adult story and the body is part of it, but a route where everything happens in chapter two has nowhere to go. Across the beats, physical contact escalates ONE step at a time — proximity, then a first deliberate touch, then clothed heat, then undressed, then sex — and each step is a beat's job in its own right, not a thing that happens in passing during a beat about something else. Put the first genuinely physical beat somewhere in the middle third, never in the first two. At least one late beat should be about what the two of them are like AFTER, which is where a person is least able to perform.

THE APPETITES. Write an "appetites" object for each person as specified in the brief you are given. That object describes who they are rather than what scenes to run, so don't write a beat whose job is to deliver something off their list.

THE THREE ENDINGS, written specifically for THIS person — a guarded person's bad ending is not a reckless person's bad ending:
- "win": what it looks like when this actually works. Keep it concrete and small, something you could film, rather than a wedding or a declaration.
- "loss": it does not happen, and why it does not, in this person's particular way of not happening.
- "sour": THE INTERESTING ONE. The player gets what they were playing for and it is bad — wanted and not trusted, or kept and not liked, or two people who have ended up together out of momentum. Write it without judgement and without a moral.

Every route you are given must come back COMPLETELY DIFFERENT from the others: different beat kinds, different pacing, different endings. If two routes could swap a beat without anyone noticing, rewrite one.

SHAPE:
{"routes":[{"name":"exact name as given","beats":[{"title":"","job":"","where":"","when":"","floor":4,"ceiling":11,"heat":"none|builds|sex","rung_target":0,"about":""}],"terminals":[{"kind":"win","title":"","description":""},{"kind":"loss","title":"","description":""},{"kind":"sour","title":"","description":""}],"appetites":{"into":[],"curious":[],"unsaid":"","limits":[],"register":""}}]}`;

interface RawAppetites {
  into?: unknown; curious?: unknown; unsaid?: unknown; limits?: unknown; register?: unknown;
}

interface RawRoute {
  name?: string;
  appetites?: RawAppetites;
  beats?: { title?: string; job?: string; where?: string; when?: string; floor?: number; ceiling?: number;
            heat?: string; rung_target?: number; about?: string }[];
  terminals?: { kind?: string; title?: string; description?: string }[];
}

/**
 * What is wrong with a spine, in the words the next attempt needs to hear.
 *
 * Empty means it is acceptable. Everything checked here is a countable property
 * of the returned object rather than a judgement about the writing.
 */
function spineComplaints(routes: RawRoute[], input: CastingInput): string[] {
  if (input.explicitness !== "explicit") return [];
  const out: string[] = [];
  for (const r of routes) {
    const beats = r.beats ?? [];
    if (beats.length < 4) continue;
    const who = String(r.name ?? "a route");
    const heats = beats.map((b) => String(b?.heat ?? "none"));
    const sex = heats.filter((h) => h === "sex").length;
    const want = Math.floor(beats.length / 2);
    if (sex < want) {
      out.push(`${who}: only ${sex} of ${beats.length} chapters are "sex". This register needs at least ${want}. Rewrite the jobs of the middle and late chapters so they ARE sex scenes, rather than relabelling conversations.`);
    }
    const firstSex = heats.indexOf("sex");
    if (firstSex === -1 || firstSex > 2) {
      out.push(`${who}: the first "sex" chapter is at index ${firstSex === -1 ? "none" : firstSex}. It must be at index 2 or earlier.`);
    }
    for (const b of beats) {
      const h = String(b?.heat ?? "none");
      const rt = Number(b?.rung_target);
      if (h === "sex" && !(rt >= 5)) out.push(`${who}: the chapter "${b?.title}" is marked sex but has rung_target ${b?.rung_target}. A sex chapter is 5 or 6.`);
      if (h === "builds" && !(rt >= 3)) out.push(`${who}: the chapter "${b?.title}" is marked builds but has rung_target ${b?.rung_target}. A builds chapter is 3 or 4.`);
    }
    const abouts = beats.filter((b) => String(b?.heat) === "sex").map((b) => String(b?.about ?? "").toLowerCase().trim());
    if (new Set(abouts.filter(Boolean)).size < abouts.filter(Boolean).length) {
      out.push(`${who}: two sex chapters are built around the same thing. Each takes a different item.`);
    }
  }
  return out.slice(0, 8);
}

const clampInt = (v: unknown, lo: number, hi: number, dflt: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt;
};

/** Place names that are not places. "elsewhere" is Weft's own marker for
 *  off-screen and the spine model reaches for it when it cannot decide, which
 *  is how a real save ended up with a chapter set in "elsewhere" — printed on
 *  the spine as the location, and impossible for openBeat to move anybody to. */
const NOT_A_PLACE = /^(elsewhere|somewhere|anywhere|nowhere|tbd|unknown|various|outside|out)$/i;

function resolveWhere(raw: unknown, places: string[], idx: number): string {
  // Weft keeps an off-scene bucket in the gazetteer as an ordinary place called
  // "elsewhere", so filtering by name was not enough — it passed the check by
  // genuinely being in the list, and one save opened a chapter there.
  places = places.filter((p) => !NOT_A_PLACE.test(p.trim()));
  const want = String(raw ?? "").trim();
  if (want && !NOT_A_PLACE.test(want)) {
    const hit = places.find((p) => p.toLowerCase() === want.toLowerCase())
      ?? places.find((p) => p.toLowerCase().includes(want.toLowerCase()) || want.toLowerCase().includes(p.toLowerCase()));
    if (hit) return hit;
  }
  // Rotate rather than always taking the first, so a spine that fails to name
  // its locations does not set all eight chapters in the same room.
  return places.length ? places[idx % places.length] : "";
}

function normalizeBeats(raw: RawRoute["beats"], want: number, places: string[]): Beat[] {
  const out: Beat[] = [];
  for (const b of raw ?? []) {
    const title = String(b?.title ?? "").trim();
    const job = String(b?.job ?? "").trim();
    if (!title || !job) continue;
    const ceiling = clampInt(b?.ceiling, 5, 18, 11);
    const heat = ["none", "builds", "sex"].includes(String(b?.heat)) ? b!.heat as Beat["heat"] : "none";
    out.push({
      heat,
      // A floor, not a default. The model returned 2 on a chapter it had itself
      // marked as a sex scene, and a finite wrong number was being kept because
      // only a non-finite one fell through to the default.
      rung_target: Math.max(
        clampInt(b?.rung_target, 0, 6, heat === "sex" ? 5 : heat === "builds" ? 3 : 0),
        heat === "sex" ? 5 : heat === "builds" ? 3 : 0,
      ),
      about: String(b?.about ?? "").trim() || undefined,
      id: uid("beat"),
      idx: out.length,
      title, job,
      where: resolveWhere(b?.where, places, out.length),
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

const strList = (v: unknown, cap: number): string[] =>
  (Array.isArray(v) ? v : []).map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, cap);

function normalizeAppetites(raw: RawAppetites | undefined): Appetites {
  const a = emptyAppetites();
  a.into = strList(raw?.into, 6);
  a.curious = strList(raw?.curious, 4);
  a.limits = strList(raw?.limits, 5);
  const unsaid = String(raw?.unsaid ?? "").trim();
  if (unsaid) a.unsaid = unsaid;
  const reg = String(raw?.register ?? "").trim();
  if (reg) a.register = reg;
  return a;
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

  // THE FLOOR, ENFORCED ON THE RECORD AND NOT ONLY IN THE PROMPT. The forge is
  // told every character is an adult and generally complies; "generally" is not
  // a guarantee, and a number on a record is read back into every prompt from
  // here to the end of the save. Clamp before anything is written.
  for (const c of Object.values(save.characters)) c.age = adultAge(c.age);

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
    ``,
    appetiteBrief(input.palette, input.explicitness, input.limits),
    ``,
    `THE WORLD: ${save.world_bible.name} — ${save.world_bible.political_situation}`,
    `PLACES (use these names verbatim for the where field): ${placeNames.join(" · ")}`,
    `THE PLAYER: ${save.characters["char_player"]?.name}, ${save.characters["char_player"]?.age}. ${save.characters["char_player"]?.background}`,
    ``,
    `Write ${input.beats} beats for EACH of the following routes.`,
    ``,
    roster,
  ].join("\n");

  let parsed: { routes?: RawRoute[] } = {};
  let correction = "";
  for (const m of [model, model, DEFAULT_MODELS.fallback_model]) {
    try {
      const msgs = buildMessages(SPINE_SYSTEM, "SPINE REQUEST", volatile + correction, m);
      const out = await complete(msgs, m, fb(m), true, 7000);
      const got = safeJson<{ routes?: RawRoute[] }>(out.text, {});
      if ((got.routes?.length ?? 0) < pairs.length) continue;
      parsed = got;
      /* CHECK THE SHAPE AND ASK AGAIN IF IT IS WRONG.
         The instruction to build an erotic spine on an explicit register was
         written, read, and ignored: one save came back with a single sex beat at
         index six of eight and a rung_target of two on it, on a palette naming
         four specific things the player wanted chapters about. A rule a model
         may decline to follow is a rule that needs checking, and the shape of a
         spine is entirely checkable. */
      const bad = spineComplaints(got.routes ?? [], input);
      if (!bad.length) break;
      correction = `\n\nYOUR PREVIOUS ATTEMPT WAS REJECTED. Fix exactly these and return the whole thing again:\n${bad.map((b) => `- ${b}`).join("\n")}`;
      onPhase("the arcs came back too tame — asking again");
    } catch { /* fall through to the next model */ }
  }

  const routes: Record<string, Arc> = {};
  const appetites: Record<string, Appetites> = {};
  pairs.forEach(({ brief, char }, n) => {
    const raw = (parsed.routes ?? []).find(
      (r) => String(r?.name ?? "").trim().toLowerCase() === char.name.trim().toLowerCase(),
    ) ?? (parsed.routes ?? [])[n];
    let beats = normalizeBeats(raw?.beats, input.beats, placeNames);
    if (beats.length < 3) beats = fallbackBeats(char.name, input.beats, placeNames);
    beats.forEach((b, i) => { b.idx = i; });
    appetites[char.character_id] = normalizeAppetites(raw?.appetites);
    routes[char.character_id] = {
      char_id: char.character_id,
      rung: 0,
      name: char.name,
      accent: ROUTE_ACCENTS[n % ROUTE_ACCENTS.length],
      brief: brief.text.trim(),
      beats,
      terminals: normalizeTerminals(raw?.terminals, char.name),
      cursor: 0,
      state: "running",
    };
  });

  /* HER FIRST READ OF THE PLAYER, TAKEN NOW.
   *
   *  Weft seeds attraction lazily, the first time two people are in a room
   *  together, and it seeds once and never again. In one save that produced a
   *  love interest with attraction_base of 0 — while a colleague who is not
   *  even a route sat at 35 toward the same player — and base is the ceiling on
   *  how far warmth alone can lift wanting, so that route was not winnable by
   *  playing it well. Her orientation said men, the player is a man, and her
   *  taste described him almost exactly, so the reading was not the engine
   *  disagreeing: it was the read being taken before the cards were finished.
   *
   *  Taking it here, with everybody's beauty, taste and orientation on the
   *  record, uses Weft's own arithmetic at the one moment the inputs are all
   *  present. seedAttraction returns early once an edge has a value, so the
   *  lazy seed later becomes a no-op and nothing is seeded twice. */
  for (const { char } of pairs) {
    try { seedAttraction(save as unknown as SaveState, char.character_id, "char_player"); }
    catch { /* a missing card is not worth failing casting over */ }
  }

  const dating: DatingLayer = {
    version: 1,
    routes,
    active: null,
    gate: null,
    needs_opening: false,
    keepsakes: [],
    register: input.register.trim(),
    heat: {
      explicitness: input.explicitness,
      palette: [...input.palette],
      limits: [...input.limits],
    },
    appetites,
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
    where: resolveWhere(null, places, i),
    when: i === 0 ? "an ordinary evening" : "some days later",
    floor: i >= jobs.length - 2 ? 6 : 4,
    ceiling: i >= jobs.length - 2 ? 15 : 10,
    status: "locked",
  }));
}

/**
 * REWRITE THE CHAPTERS THAT HAVE NOT BEEN PLAYED.
 *
 * The spine is written once, at casting, so everything learned since about what
 * an explicit spine should look like only ever applied to routes cast
 * afterwards. Somebody twenty turns into a save could get it only by throwing
 * the save away, which is not a reasonable thing to ask of anybody who has been
 * playing for an hour.
 *
 * Played chapters keep their record — what happened, what was chosen, how it
 * went. Everything from the current chapter onward is written again against the
 * relationship as it actually stands, which is the other reason to do it: a
 * spine written cold does not know they have already slept together.
 */
export async function respine(
  save: SaveState & { dating: DatingLayer },
  charId: string,
  model: string,
): Promise<number> {
  const arc = save.dating.routes[charId];
  const char = save.characters[charId];
  if (!arc || !char) return 0;

  const from = arc.cursor;
  const want = arc.beats.length - from;
  if (want < 1) return 0;

  const placeNames = Object.values(save.world.places)
    .map((p) => p.name).filter((n) => !NOT_A_PLACE.test(n.trim()));
  const played = arc.beats.slice(0, from)
    .map((b) => `${b.idx + 1}. ${b.title} — ${b.job}${b.taken ? ` (and the player ${b.taken.charAt(0).toLowerCase()}${b.taken.slice(1)})` : ""}`)
    .join("\n") || "(none — the route has not started)";
  const app = save.dating.appetites[charId];

  const volatile = [
    `GENRE AND REGISTER: ${save.dating.register || "contemporary, adult"}`,
    ``,
    appetiteBrief(save.dating.heat.palette, save.dating.heat.explicitness, save.dating.heat.limits),
    ``,
    `THIS IS A REWRITE OF AN ARC ALREADY IN PLAY. Return ONE route, for ${char.name}, containing exactly ${want} beats — the remaining chapters and nothing else. Do not rewrite the chapters already played; they are listed only so the new ones follow from them. Keep the endings exactly as given.`,
    ``,
    `ALREADY PLAYED:\n${played}`,
    ``,
    `WHERE THE TWO OF THEM HAVE ACTUALLY GOT TO: ${rungLabel(arc.rung ?? 0)}. Write the remaining chapters from there. They do not go back to the beginning, and nothing that has already happened between them happens for the first time again.`,
    ``,
    `PLACES (use these names verbatim): ${placeNames.join(" · ")}`,
    `${char.name}, ${char.age}. ${char.background}`,
    app ? `Wants: ${app.into.join("; ")}\nWill not: ${app.limits.join("; ")}` : "",
    `KEEP THESE ENDINGS EXACTLY AS THEY ARE: ${JSON.stringify(arc.terminals)}`,
  ].filter(Boolean).join("\n");

  let fresh: Beat[] = [];
  let correction = "";
  for (const m of [model, model, DEFAULT_MODELS.fallback_model]) {
    try {
      const out = await complete(
        buildMessages(SPINE_SYSTEM, "RESPINE", volatile + correction, m), m, fb(m), true, 5000);
      const got = safeJson<{ routes?: RawRoute[] }>(out.text, {});
      const r = (got.routes ?? [])[0];
      if (!r) continue;
      const bad = spineComplaints([r], { explicitness: save.dating.heat.explicitness } as CastingInput);
      if (bad.length) {
        correction = `\n\nYOUR PREVIOUS ATTEMPT WAS REJECTED. Fix exactly these and return the whole thing again:\n${bad.map((x) => `- ${x}`).join("\n")}`;
        continue;
      }
      const beats = normalizeBeats(r.beats, want, placeNames);
      if (beats.length < Math.min(3, want)) continue;
      fresh = beats;
      break;
    } catch { /* next model */ }
  }
  if (!fresh.length) return 0;

  arc.beats = [
    ...arc.beats.slice(0, from),
    ...fresh.map((b, i) => ({ ...b, idx: from + i, status: (i === 0 ? "open" : "locked") as Beat["status"] })),
  ];
  const now = arc.beats[from];
  if (now) {
    now.entered_turn = save.world.current_turn;
    delete now.heat_in;
    save.dating.needs_opening = true;
    if (now.rung_target != null) arc.rung = Math.max(arc.rung ?? 0, now.rung_target);
  }
  return fresh.length;
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
