/**
 * THE GATE — closing a beat and opening the next one.
 *
 * Four small model calls live here, and none of them is the narrator. They are
 * deliberately tiny: none carries the world digest, the cast, or the rules
 * contract, so all four together cost less than a single turn of prose. The
 * expensive call in this game is the one Weft already makes.
 *
 *   openingFor()   — the situation a beat starts in, written once at entry
 *   judgeBeat()    — did this beat's job actually happen? one boolean
 *   doorsFor()     — the three ways out
 *   endingFor()    — the terminal, written against how it actually went
 *
 * The judge is the interesting one and it is worth saying why it exists at all.
 * The alternative was to let the bookkeeper decide, since it already reads every
 * turn and returns structured JSON — but that would mean editing Weft's
 * simulator prompt, which is vendored, shared with the parent project, and about
 * the most load-bearing string in the engine. A separate three-hundred-token
 * call that sees the beat's job and the last two turns of prose is cheaper to
 * run and enormously cheaper to be wrong about.
 */
import { complete, buildMessages, extractJson, repairJson } from "@weft/llm";
import { DEFAULT_MODELS, type SaveState } from "@weft/engine/types";
import type { Arc, Beat, Door, Terminal } from "./types";
import { activeArc, currentBeat } from "./types";
import { heatOf, edgeToPlayer, OUTCOME_WORD } from "./arc";
import { readOf } from "./read";
import { NO_TROPES, NO_PURPLE, parseFaults, type VoiceFault } from "./tics";
import { appetiteBlock, EXPLICITNESS, HARD_FLOOR, rungLabel } from "./appetite";
import type { DatingLayer } from "./types";

function safeJson<T>(text: string, fallback: T): T {
  for (const attempt of [extractJson(text), repairJson(extractJson(text))]) {
    try { return JSON.parse(attempt) as T; } catch { /* next */ }
  }
  return fallback;
}

const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 10)}`;

/** The last few turns as plain text — the only story context any of these calls
 *  gets. Two turns is enough to judge a beat and keeps the call small. */
function recent(s: SaveState, n = 2): string {
  return s.history.slice(-n).map((h) => {
    const said = h.player_action ? `PLAYER: ${h.player_action}\n` : "";
    return `${said}${(h.narrator_prose ?? "").slice(0, 2200)}`;
  }).join("\n\n---\n\n") || "(nothing has happened yet)";
}

/** Everything the small calls need to know about where the relationship stands,
 *  in words rather than numbers — the same read the player is looking at, so
 *  the doors it writes cannot contradict the strip above the composer. */
function standing(s: SaveState, arc: Arc): string {
  const r = readOf(s, arc.char_id);
  const e = edgeToPlayer(s, arc.char_id);
  const c = s.characters[arc.char_id];
  return [
    `${arc.name}, ${c?.age ?? "?"}, ${c?.pronouns ?? "they/them"}.`,
    `Where it stands: ${r.line} ${r.facets.map((f) => f.line).join(" ")}`,
    e?.roles?.length ? `Standing relationship: ${e.roles.join(", ")}` : "",
    e?.notes ? `Last thing noted between them: ${e.notes}` : "",
    `They talk like this: ${c?.speech_pattern ?? ""}`,
    `How far it has physically gone: ${rungLabel(arc.rung ?? 0)}.`,
  ].filter(Boolean).join("\n");
}

/** Pasted at the end of every prompt this module sends. The floor plus whatever
 *  the player put on the save's never list — stated on each call rather than
 *  once at world creation, because a constraint set at turn zero is a
 *  constraint the model stopped seeing around turn forty. */
function bounds(layer: DatingLayer | undefined): string {
  const lim = layer?.heat?.limits ?? [];
  return [
    lim.length ? `THIS STORY NEVER CONTAINS: ${lim.join("; ")}.` : "",
    HARD_FLOOR,
  ].filter(Boolean).join("\n");
}

/* ── 1. THE OPENING ──────────────────────────────────────────────────────────*/

const OPENING_SYSTEM = `You are setting a scene at the start of a chapter in a romance. You will be told what the chapter is FOR, where it is, roughly when, and where the relationship currently stands.

Write the situation the player walks into, in two or three sentences of present tense. The player is "you" and everybody else is named. Say where they are, what time it is, what is already happening, and what the other person is doing when the player arrives. Leave the situation in motion at the end, and don't finish on a question or on somebody asking the player one.

${NO_TROPES}

Don't summarise where the relationship stands, don't tell the player how they feel, don't foreshadow, and don't write dialogue. Don't explain what the chapter is for either, because that's machinery and the player shouldn't be able to see it from the page.

Output ONE strict JSON object: {"opening":"","time":"a time of day like 'evening' or 'just past two'","title_line":"a six-to-twelve word line printed under the chapter title — a physical detail from the scene, never a theme"}`;

export async function openingFor(s: SaveState, model: string): Promise<{ opening: string; time: string; title_line: string } | null> {
  const arc = activeArc(s);
  const beat = currentBeat(arc);
  if (!arc || !beat) return null;

  const prior = arc.beats[beat.idx - 1];
  const volatile = [
    `CHAPTER ${beat.idx + 1} OF ${arc.beats.length}: ${beat.title}`,
    `WHAT IT IS FOR (never state this on the page): ${beat.job}`,
    `WHERE: ${beat.where}`,
    `WHEN: ${beat.when}`,
    ``,
    standing(s, arc),
    prior?.taken ? `\nLAST CHAPTER ENDED WITH THE PLAYER CHOOSING: ${prior.taken}` : "",
    prior?.outcome ? `And it went like this: ${OUTCOME_WORD[prior.outcome]}.` : "",
    ``,
    `RECENTLY:\n${recent(s, 1)}`,
    ``,
    bounds((s as { dating?: DatingLayer }).dating),
  ].filter(Boolean).join("\n");

  try {
    const out = await complete(buildMessages(OPENING_SYSTEM, "SCENE", volatile, model), model, model, true, 700);
    const j = safeJson<{ opening?: string; time?: string; title_line?: string }>(out.text, {});
    const opening = String(j.opening ?? "").trim();
    if (!opening) return null;
    return {
      opening,
      time: String(j.time ?? "").trim(),
      title_line: String(j.title_line ?? "").trim(),
    };
  } catch { return null; }
}

/* ── 2. THE JUDGE ────────────────────────────────────────────────────────────*/

const JUDGE_SYSTEM = `You are checking whether one specific thing has happened in a story yet. You will be given a JOB — a description of what a scene exists to put in front of the player — and the last couple of turns of that scene.

Answer only whether the job has been DISCHARGED: the thing described has actually occurred on the page, in some form, whether it went well or badly. Going badly still counts. Being refused still counts. Being interrupted before it finished does NOT count. Being talked about rather than done does NOT count.

Be strict about this and answer no when you're unsure. A scene heading toward the job hasn't done it yet.

YOU ARE ALSO READING ONE OTHER THING off the same text, and it is a question of fact rather than judgement: how far the two people have physically gone, counting ONLY what the text shows or plainly states has already happened. Wanting to do something doesn't count, and nearly doing it doesn't either.

  0  nobody has touched anybody with intent
  1  charged proximity — standing too close, a look held, nothing done
  2  a first deliberate touch or kiss, acknowledged by both
  3  hands and mouths, still dressed
  4  undressed, everything short of sex
  5  they have slept together
  6  established and unembarrassed, nothing left to cross

Report the HIGHEST rung the text actually shows. If the text shows nothing physical at all, report the rung you were told they were already at — this reads a scene, it does not reset a history.

ALSO report anything the text revealed about what either of them WANTS — an appetite named out loud, a limit stated, a preference either of them showed rather than said. Quote or paraphrase in a few words each, and return an empty list on the common turn where nothing was revealed. Do not infer; somebody enjoying something is not the same as it being named.

Output ONE strict JSON object: {"done":true|false,"because":"under fifteen words","rung":0,"revealed":["short phrases, usually empty"]}`;

export interface Judgement {
  done: boolean;
  /** The rung the page actually shows, never lower than where the route already
   *  was — this call reads a scene, it does not rewrite a history. */
  rung: number;
  /** Appetites or limits the scene put on the record. Folded into the
   *  character's `discovered` list, which is what the dossier shows. */
  revealed: string[];
}

export async function judgeBeat(s: SaveState, model: string): Promise<Judgement> {
  const arc = activeArc(s);
  const beat = currentBeat(arc);
  const was = arc?.rung ?? 0;
  if (!arc || !beat) return { done: false, rung: was, revealed: [] };
  const volatile = [
    `THE JOB: ${beat.job}`,
    `WHERE THEY WERE ALREADY AT, physically: rung ${was} (${rungLabel(was)}).`,
    ``,
    `THE SCENE SO FAR:\n${recent(s, 2)}`,
  ].join("\n");
  try {
    const out = await complete(buildMessages(JUDGE_SYSTEM, "JUDGE", volatile, model), model, model, true, 320);
    const j = safeJson<{ done?: boolean; rung?: unknown; revealed?: unknown }>(out.text, {});
    const read = Math.round(Number(j.rung));
    return {
      done: j.done === true,
      // Never below where it already was, and never more than one rung above:
      // the ladder is the one thing standing between "she is interested" and a
      // chapter that skips four steps because the model felt the mood was right.
      rung: Math.max(was, Math.min(was + 1, Number.isFinite(read) ? Math.max(0, Math.min(6, read)) : was)),
      revealed: (Array.isArray(j.revealed) ? j.revealed : [])
        .map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 4),
    };
  } catch { return { done: false, rung: was, revealed: [] }; }
}

/* ── 3. THE DOORS ────────────────────────────────────────────────────────────
 *
 *  Three, always. Two is a fork and reads as a morality test; four is a menu and
 *  nobody reads the fourth.
 *
 *  The rule that makes them worth reading is that a door names an ACTION and
 *  never its result. "Walk her home the long way" is a door. "Walk her home and
 *  grow closer" is a spoiler with a button attached, and once a player has seen
 *  one of those they stop choosing and start optimising. The `read` line under
 *  each door says what the choice would MEAN — what it costs, what it commits
 *  to — without saying how it lands. */

const DOORS_SYSTEM = `A scene has just ended. Write the THREE ways the player can leave it.

Each door is something the player DOES, written as an imperative in the second person, six to eleven words. It has to be something physical they could actually say or do right now from where they're standing, rather than an attitude they adopt or a strategy they decide on.

Each door carries a "read": one sentence, under twenty words, saying what taking it would COMMIT the player to or COST them. The read must never say how it turns out. A door that tells the player the outcome has stopped being a choice.

The three have to differ in kind rather than in degree, since three intensities of the same move is really only one door. Across the three, at least one should be a real risk with a plausible way to go badly, and at least one should be the quiet, unglamorous option that a sensible adult would actually take. Never make one door obviously correct.

Use what actually happened in the scene. A door that could have been written before the scene started is the wrong door. If somebody mentioned their sister, a door can be about the sister.

You may write a door that is rude, cowardly, blunt, or sexual, if the scene has earned it. Do not write one that is out of character for the player as they have been playing.

${NO_TROPES}

"bearing" is toward / away / across: whether the door moves the player nearer this person, further from them, or sideways into something else. Do not make all three "toward".

Output ONE strict JSON object: {"doors":[{"label":"","read":"","bearing":"toward|away|across"}]} — exactly three.`;

export async function doorsFor(s: SaveState, model: string, because: "discharged" | "ceiling"): Promise<Door[]> {
  const arc = activeArc(s);
  const beat = currentBeat(arc);
  if (!arc || !beat) return [];

  const next = arc.beats[beat.idx + 1];
  const volatile = [
    `THE SCENE THAT JUST ENDED: ${beat.title}`,
    because === "ceiling"
      ? `It's ending because the night is over rather than because anything got settled.`
      : `It is ending because the thing it was for has happened.`,
    ``,
    standing(s, arc),
    next ? `\nWHAT IS COMING (do not name it, do not hint at it — it is only here so the doors do not contradict it): ${next.job}` : `\nTHIS IS THE LAST SCENE. The doors are the last thing the player does.`,
    ``,
    `THE SCENE:\n${recent(s, 2)}`,
    ``,
    bounds((s as { dating?: DatingLayer }).dating),
  ].join("\n");

  let doors: Door[] = [];
  for (const m of [model, model, DEFAULT_MODELS.fallback_model]) {
    try {
      const out = await complete(buildMessages(DOORS_SYSTEM, "DOORS", volatile, m), m, m, true, 900);
      const raw = safeJson<{ doors?: { label?: string; read?: string; bearing?: string }[] }>(out.text, {});
      doors = (raw.doors ?? [])
        .map((d) => ({
          id: uid("door"),
          label: String(d?.label ?? "").trim(),
          read: String(d?.read ?? "").trim(),
          to: beat.idx + 1,
          bearing: (["toward", "away", "across"].includes(String(d?.bearing)) ? d!.bearing : "across") as Door["bearing"],
        }))
        .filter((d) => d.label);
      if (doors.length >= 2) break;
    } catch { /* try again, then fall through */ }
  }

  // NO BACKSTOP. There used to be three hardcoded doors here so that a failed
  // call could never leave a gate empty, and one of them — "say the thing you
  // have not said" — turned up in a real game as the permanent record of a
  // choice somebody made. It is deliberately unspecific, because it was written
  // to fit any scene, and reading it back on the spine tells you nothing about
  // what you did. A gate that admits it could not be written is recoverable in
  // one tap; a gate that quietly invents three portentous non-choices and
  // writes one into the history is not.
  return doors.length >= 2 ? doors.slice(0, 3) : [];
}

/* ── 4. THE ENDING ───────────────────────────────────────────────────────────*/

const ENDING_SYSTEM = `Write the last page of a romance. You are given which of three prepared endings the player earned, what that ending was written to be, and how the whole thing actually went.

Three to five short paragraphs. Present tense, second person for the player. Write a scene rather than a summary. One specific moment, in one place, with what people actually do and say in it. Never a montage, never "over the following months", never a closing line about what love is.

Stick to the ending you were given. If it's the bad one, let it be bad, without softening it at the last minute and without implying they'll work it out later. If it's the good one, keep it small and concrete, because a good ending in this register looks more like somebody making two coffees without asking than like a speech.

${NO_TROPES}

${NO_PURPLE}

Do not state anyone's interior. Do not end on an aphorism. Do not name the ending.

Output plain prose. No JSON, no headings, no title.`;

export async function endingFor(s: SaveState, arc: Arc, terminal: Terminal, model: string): Promise<string> {
  const h = heatOf(s, arc.char_id);
  const played = arc.beats
    .filter((b) => b.status === "done")
    .map((b) => `${b.idx + 1}. ${b.title} — ${b.outcome ? OUTCOME_WORD[b.outcome] : "unplayed"}${b.taken ? `, and you ${b.taken.charAt(0).toLowerCase()}${b.taken.slice(1)}` : ""}`)
    .join("\n");

  const volatile = [
    `THE ENDING YOU ARE WRITING — "${terminal.title}": ${terminal.description}`,
    ``,
    standing(s, arc),
    ``,
    `HOW IT WENT, CHAPTER BY CHAPTER:\n${played}`,
    ``,
    `THE LAST OF IT:\n${recent(s, 2)}`,
    ``,
    bounds((s as { dating?: DatingLayer }).dating),
  ].join("\n");

  try {
    const out = await complete(buildMessages(ENDING_SYSTEM, "ENDING", volatile, model), model, model, false, 1600);
    return out.text.trim();
  } catch {
    return `${terminal.description}\n\n(The ending could not be written — the model call failed. Everything that happened is still in the journal, and you can try again from the spine.)`;
  }
}

/* ── 4b. WHAT HAPPENED WHEN YOU DID THAT ─────────────────────────────────────
 *
 *  The gap this fills was a real one, and it had a comment in walkThrough
 *  claiming it was already handled. It was not. The player picked a door, the
 *  clock jumped four days, and a new chapter opened — so the thing they had
 *  chosen to do was never written, never seen, and never reached the world. The
 *  spine recorded "you chose: say the thing you have not said" as the only
 *  trace, which reads as a chapter having been skipped rather than played.
 *
 *  A choice you do not get to watch land is not a choice. So the door is played
 *  now: a short passage of the player doing it and her answering, pushed through
 *  Weft's bookkeeper like any other turn, so it moves the ledger before the beat
 *  is graded and before any time passes. */

const CONSEQUENCE_SYSTEM = `The player has just decided to do something, and you are writing what happens when they do it. You will be given the thing they chose, the scene it happens in, and where the two people stand with each other.

Two or three short paragraphs, present tense, with the player as "you" and everybody else named. Write them doing the thing, and write how the other person answers it — what they say, what they do with their hands, whether they answer at all.

Stop while it is still unfinished. This is the end of a chapter and not the end of the story, so don't resolve anything, don't have anybody explain how they feel about what just happened, and don't jump forward in time. If the choice was a bad idea, let it go badly and leave it gone badly.

Don't summarise. Don't write a closing line. The last sentence should be a thing somebody does or says, not a reflection on it.

${NO_TROPES}

${NO_PURPLE}`;

export async function consequenceFor(
  s: SaveState, arc: Arc, door: Door, model: string,
): Promise<string> {
  const beat = currentBeat(arc);
  const volatile = [
    `WHAT THE PLAYER CHOSE TO DO: ${door.label}`,
    door.read ? `What it commits them to: ${door.read}` : "",
    ``,
    standing(s, arc),
    ``,
    `THE SCENE THIS HAPPENS IN — the chapter called "${beat?.title ?? ""}", at ${beat?.where ?? "where they are"}:`,
    recent(s, 2),
    ``,
    bounds((s as { dating?: DatingLayer }).dating),
  ].filter(Boolean).join("\n");
  try {
    const out = await complete(
      buildMessages(CONSEQUENCE_SYSTEM, "CONSEQUENCE", volatile, model),
      model, model, false, 900,
    );
    return out.text.trim();
  } catch { return ""; }
}

/* ── 5. THE VOICE CHECK ──────────────────────────────────────────────────────
 *
 *  A regex list can only catch wordings somebody thought of in advance, and a
 *  model paraphrases around them without trying. The passage that prompted this
 *  contained six clear failures and the local detector caught zero of them:
 *  "her mouth does something small at the corner" is the unnamed-expression move
 *  with different words, and "that's a choice you make in front of a witness" is
 *  a portable general sentence with none of the vocabulary a pattern would look
 *  for.
 *
 *  Dialogue is where this matters most and where patterns are least use, so this
 *  is a reader instead. It gets the last turn's prose and nothing else — no
 *  digest, no cast, no rules contract — and comes back with the sentences that
 *  broke the voice, quoted, which is the only correction mechanism in this
 *  engine that reliably changes what the narrator does next.
 *
 *  The local detector still runs first and still runs free. This catches what it
 *  cannot. */

const VOICE_SYSTEM = `You are reading one turn of prose from a story and looking for a small number of specific writing failures. Quote the sentences you find, exactly as written, with a few words on which failure it is.

Look for these and nothing else:

1. A character commenting on the conversation they are having, instead of just responding to it. ("That's a very specific compliment." "You're deflecting." "That's not an answer.")

2. A line of dialogue or narration that would work in any other story, said by anyone, to anyone — anything shaped like a general truth about people, love, or how things go, even when dressed as a remark about the moment. ("That's a choice you make in front of a witness.")

3. A face or an expression doing something the writer declines to name. ("Her mouth does something small at the corner.")

4. The narration stating what somebody feels, wants, knows, or has just worked out, including when a simile is put in front of it to disguise it.

5. The shape "not that, just this" used in place of an actual description. ("She said it slowly, not mocking, just testing how it sat.")

6. Somebody's name used in dialogue when there is no reason for it. People rarely say the name of the person in front of them.

7. Dialogue where nearly every line is doing something clever or pointed. If three or more consecutive lines from the same person each land a little turn or a joke, quote the third one and say the talking is too consistently performed.

Be strict about what you quote and generous about letting ordinary writing pass. Most turns should return one or two findings, and a clean turn should return none. Do not quote something merely because it is a bit flat, and never quote a line for being too plain — plain is what we want.

Output ONE strict JSON object: {"faults":[{"quote":"the sentence, verbatim","why":"under ten words"}]}`;

export async function voiceCheck(prose: string, model: string, speakers: string[] = []): Promise<VoiceFault[]> {
  const text = (prose ?? "").trim();
  if (text.length < 120) return [];
  const volatile = [
    speakers.length ? `People who might be speaking here: ${speakers.join(", ")}.` : "",
    ``,
    text.slice(0, 4000),
  ].filter(Boolean).join("\n");
  try {
    const out = await complete(
      buildMessages(VOICE_SYSTEM, "VOICE", volatile, model),
      model, model, true, 420,
    );
    return parseFaults(safeJson<unknown>(out.text, null), text);
  } catch { return []; }
}

/** The directive handed to Weft's narrator for every turn inside a beat. It goes
 *  into the save's standing direction, which sits at the very top of the
 *  narrator prompt above the world bible and the cast — so it is the strongest
 *  channel available for keeping a scene inside its chapter.
 *
 *  Note what it does NOT say: it never tells the narrator what the beat is for.
 *  A narrator that knows the scene exists to make somebody confess something
 *  will make them confess it in the first paragraph, and the player will have
 *  watched rather than played. It gets the situation and the register, and the
 *  job stays with the judge. */
export function beatDirective(s: SaveState, arc: Arc, beat: Beat, layer: DatingLayer): string {
  const other = arc.name;
  const register = layer.register;
  const turnsIn = s.world.current_turn - (beat.entered_turn ?? s.world.current_turn);

  /* THE FIRST TURNS OF A CHAPTER NEED TO BE TOLD THEY ARE THE FIRST TURNS.
     Weft replays the previous few turns to the narrator, and at a chapter
     boundary those turns are the end of a conversation that finished days ago.
     Left to itself the model reads the most recent thing in its context and
     continues it, which produced a save where chapter two opened mid-exchange
     in chapter one's coffee shop while the clock said four days had passed.
     The interlude in the history helps; saying it outright helps more. */
  const fresh = turnsIn <= 1 ? [
    `THIS IS THE OPENING OF A NEW CHAPTER, AND IT IS NOT A CONTINUATION.`,
    `${beat.when} has passed since the last scene, and this one happens at ${beat.where || "somewhere else"}. The conversation that was going on at the end of the last chapter is over. It ended, both of them went home, and time has gone by since.`,
    `Do not pick that conversation back up, do not answer a question that was left hanging in it, and do not write anybody carrying on as though no time has passed. If something was left unresolved, it has been sitting there for ${beat.when} and both of them have had time to think about it or go quiet about it.`,
    `Open on where they are now.`,
    ``,
  ] : [];

  return [
    ...fresh,
    `THIS IS A ROMANCE, AND ${other.toUpperCase()} IS ITS SUBJECT. The story is what happens between the player and ${other}. Keep ${other} in the scene and keep the scene between them; the rest of the world is texture unless the player reaches for it.`,
    register ? `REGISTER: ${register}.` : "",
    ``,
    `THE SCENE: ${beat.opening ?? beat.where}`,
    ``,
    `Write ${other} as a person with their own evening, their own irritations, and somewhere else they could be. They're allowed to be bored, distracted, unimpressed, or busy. They don't exist to answer the player, and they don't explain themselves at length unless somebody asks.`,
    `Something should change every turn, even slightly — somebody moves, or arrives, or picks something up, or won't talk about something. If two people have been sitting in the same positions talking for three turns, the scene has stopped.`,
    ``,
    // The full contract, not the three-line summary that used to live here. The
    // standing direction sits above the world bible and the cast in Weft's
    // narrator prompt, which makes it the loudest channel available, and it was
    // carrying about a fifth of the rules that actually govern the prose.
    NO_TROPES,
    ``,
    NO_PURPLE,
    ``,
    appetiteBlock(other, layer.appetites?.[arc.char_id], {
      rung: arc.rung ?? 0,
      explicitness: layer.heat?.explicitness ?? "frank",
      limits: layer.heat?.limits ?? [],
    }),
  ].filter(Boolean).join("\n");
}
