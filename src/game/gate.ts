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
import type { SaveState } from "@weft/engine/types";
import type { Arc, Beat, Door, Terminal } from "./types";
import { activeArc, currentBeat } from "./types";
import { heatOf, edgeToPlayer, OUTCOME_WORD } from "./arc";
import { readOf } from "./read";
import { NO_TROPES } from "./tics";

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
  ].filter(Boolean).join("\n");
}

/* ── 1. THE OPENING ──────────────────────────────────────────────────────────*/

const OPENING_SYSTEM = `You are setting a scene at the start of a chapter in a romance. You will be told what the chapter is FOR, where it is, roughly when, and where the relationship currently stands.

Write the situation the player walks into. Two or three sentences, present tense, second person for the player ("you"), third person for everyone else. Say where they are, what time it is, what is already happening, and what the other person is doing when the player arrives. End with the situation live — something in motion — never with a question and never with the player being asked one.

${NO_TROPES}

Do not summarise the relationship. Do not tell the player how they feel. Do not foreshadow. Do not write dialogue. Do not explain the chapter's purpose — the purpose is machinery and the player should never be able to see it.

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

Be strict. The default answer is no. A scene that is heading toward the job is not the job.

Output ONE strict JSON object: {"done":true|false,"because":"under fifteen words"}`;

export async function judgeBeat(s: SaveState, model: string): Promise<boolean> {
  const arc = activeArc(s);
  const beat = currentBeat(arc);
  if (!arc || !beat) return false;
  const volatile = `THE JOB: ${beat.job}\n\nTHE SCENE SO FAR:\n${recent(s, 2)}`;
  try {
    const out = await complete(buildMessages(JUDGE_SYSTEM, "JUDGE", volatile, model), model, model, true, 200);
    return safeJson<{ done?: boolean }>(out.text, {}).done === true;
  } catch { return false; }
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

Each door is something the player DOES, written as an imperative in the second person, six to eleven words. It must be a physical, sayable, doable thing, available right now from where they are standing. Not an attitude, not a feeling, not a strategy.

Each door carries a "read": one sentence, under twenty words, saying what taking it would COMMIT the player to or COST them. The read must never say how it turns out. A door that tells the player the outcome has stopped being a choice.

THE THREE MUST BE GENUINELY DIFFERENT IN KIND, not three intensities of the same move. Across the three, at least one should be a real risk with a plausible way to go badly, and at least one should be the quiet, unglamorous option that a sensible adult would actually take. Never make one door obviously correct.

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
      ? `It is ending because the night is over, not because anything was settled.`
      : `It is ending because the thing it was for has happened.`,
    ``,
    standing(s, arc),
    next ? `\nWHAT IS COMING (do not name it, do not hint at it — it is only here so the doors do not contradict it): ${next.job}` : `\nTHIS IS THE LAST SCENE. The doors are the last thing the player does.`,
    ``,
    `THE SCENE:\n${recent(s, 2)}`,
  ].join("\n");

  let doors: Door[] = [];
  for (const m of [model, model]) {
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

  // THE BACKSTOP. A gate with no doors is an unplayable save, so there is always
  // something to press. Plain rather than clever: the point is that the game
  // does not stop.
  if (doors.length < 2) {
    doors = [
      { id: uid("door"), label: "Stay a while longer and see where it goes", read: "You give up the excuse you had for leaving.", to: beat.idx + 1, bearing: "toward" },
      { id: uid("door"), label: "Say goodnight and go", read: "Nothing is decided, and nothing is spent.", to: beat.idx + 1, bearing: "across" },
      { id: uid("door"), label: "Say the thing you have not said", read: "It cannot be taken back once it is in the room.", to: beat.idx + 1, bearing: "toward" },
    ];
  }
  return doors.slice(0, 3);
}

/* ── 4. THE ENDING ───────────────────────────────────────────────────────────*/

const ENDING_SYSTEM = `Write the last page of a romance. You are given which of three prepared endings the player earned, what that ending was written to be, and how the whole thing actually went.

Three to five short paragraphs. Present tense, second person for the player. It is a SCENE, not a summary: one specific moment, in one place, with what people actually do and say. Never a montage, never "over the following months", never a closing line about what love is.

Honour the ending you were given. If it is the bad one, let it be bad — no last-minute softening, no implication that they will work it out later, no consolation. If it is the good one, keep it small and concrete: good endings in this register are somebody making two coffees without asking, not a speech.

${NO_TROPES}

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
  ].join("\n");

  try {
    const out = await complete(buildMessages(ENDING_SYSTEM, "ENDING", volatile, model), model, model, false, 1600);
    return out.text.trim();
  } catch {
    return `${terminal.description}\n\n(The ending could not be written — the model call failed. Everything that happened is still in the journal, and you can try again from the spine.)`;
  }
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
export function beatDirective(s: SaveState, arc: Arc, beat: Beat, register: string): string {
  const other = arc.name;
  return [
    `THIS IS A ROMANCE, AND ${other.toUpperCase()} IS ITS SUBJECT. The story is what happens between the player and ${other}. Keep ${other} in the scene and keep the scene between them; the rest of the world is texture unless the player reaches for it.`,
    register ? `REGISTER: ${register}.` : "",
    ``,
    `THE SCENE: ${beat.opening ?? beat.where}`,
    ``,
    `Write ${other} as a person with their own evening, their own irritations, and somewhere else they could be. They are allowed to be bored, distracted, unimpressed, or busy. They do not exist to respond to the player, and they never explain themselves at length unprompted.`,
    `Do not narrate what anybody feels, decides, or realises. The camera is in the room; it does not have access to anyone's interior. Write what is done and what is said.`,
    `Never write a line that states a general truth about people, love, or life. Never have anybody describe the conversation they are currently in.`,
    `Move something every turn — a change of position, an arrival, a thing picked up or put down, a subject somebody refuses. Two people talking in fixed positions for three turns is a failure.`,
  ].filter(Boolean).join("\n");
}
