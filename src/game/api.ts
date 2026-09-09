/**
 * THE DATING LAYER'S API — everything the views call.
 *
 * It sits on top of Weft's own api rather than replacing it. Weft owns the
 * turn, the save store, the images and the whole simulation; this owns the
 * spine, the gate, the beat openings and the endings, and it hooks the two
 * together at exactly three points:
 *
 *   BEFORE a turn — the standing narrator direction is rewritten to the current
 *   beat's directive plus any tic correction owed from last turn. Weft puts the
 *   standing direction at the very top of the narrator prompt, above the world
 *   bible and the cast, which makes it the strongest channel in the engine and
 *   the right place for "this is a romance and she is its subject".
 *
 *   AFTER a turn — the beat is checked. Past its floor we ask the judge whether
 *   its job discharged; at its ceiling it closes regardless. Either way the gate
 *   opens and the doors get written.
 *
 *   AT A DOOR — the beat is graded off the engine's own ledger, the cursor
 *   moves, the clock jumps, and the next beat's opening is written.
 */
import { api as weft, streamTurn, type ClientSave, type TurnEvents } from "@weft/lib/api";
import { getSave, putSave, listSaves } from "@weft/store";
import { advance as advanceClock } from "@weft/engine/time";
import type { ActionMode, SaveState } from "@weft/engine/types";
import { DEFAULT_MODELS } from "@weft/engine/types";
import { activeArc, currentBeat, isDating, type DatingLayer, type Door, type Keepsake } from "./types";
import { enterBeat, gateCheck, heatOf, openGate, resolveTerminal, takeDoor, terminalOf } from "./arc";
import { beatDirective, doorsFor, endingFor, judgeBeat, openingFor } from "./gate";
import { findTics, ticCorrection } from "./tics";
import { runCasting, beginRoute, type CastingInput } from "./casting";

const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 10)}`;

async function need(id: string): Promise<SaveState> {
  const s = await getSave(id);
  if (!s) throw new Error("that save is gone");
  return s;
}

/** The cheap slot. Every dating-layer call except the ending rides the
 *  bookkeeper's model, which is small, fast and already paid for. */
function smallModel(s: SaveState): string {
  return s.model_settings.simulator_model || DEFAULT_MODELS.simulator_model;
}
function bigModel(s: SaveState): string {
  return s.model_settings.narrator_model || DEFAULT_MODELS.narrator_model;
}

/* ── SAVES ───────────────────────────────────────────────────────────────────*/

export interface Shelf {
  id: string; name: string; updated_at: string; turn: number;
  who: string; accent: string; chapter: string; state: string;
}

export async function shelf(): Promise<Shelf[]> {
  const rows = await listSaves();
  const out: Shelf[] = [];
  for (const r of rows) {
    const s = await getSave(r.id);
    if (!s || !isDating(s)) continue;
    const arc = activeArc(s);
    const beat = currentBeat(arc);
    out.push({
      id: r.id, name: r.name, updated_at: r.updated_at, turn: r.turn,
      who: arc?.name ?? Object.values(s.dating.routes).map((x) => x.name).join(", "),
      accent: arc?.accent ?? "madder",
      chapter: arc ? `${arc.cursor + 1}/${arc.beats.length} · ${beat?.title ?? ""}` : "not started",
      state: arc?.state ?? "unstarted",
    });
  }
  return out;
}

export const load = async (id: string): Promise<ClientSave> => weft.save(id);
export const remove = async (id: string) => weft.remove(id);

/* ── CASTING ─────────────────────────────────────────────────────────────────*/

export async function cast(input: CastingInput, onPhase: (p: string) => void): Promise<ClientSave> {
  const save = await runCasting(input, onPhase);
  const raw = await need(save.id);
  (raw as SaveState & { dating: DatingLayer }).dating = (save as ClientSave & { dating: DatingLayer }).dating;
  await putSave(raw);
  return weft.save(save.id);
}

/** Commit to one of the people. This is the moment the interface changes
 *  colour, and it also writes the first beat's directive so turn one already
 *  knows what story it is in. */
export async function chooseRoute(id: string, char_id: string): Promise<ClientSave> {
  const s = await need(id);
  beginRoute(s, char_id);
  await syncDirective(s);
  await putSave(s);
  return weft.save(id);
}

/* ── THE BEAT'S OPENING ──────────────────────────────────────────────────────*/

/** Write the situation the player is walking into. Costs one small call and is
 *  worth it: it is the title card, the establishing shot, and the ground the
 *  narrator builds the whole chapter on. */
export async function openBeat(id: string): Promise<ClientSave> {
  const s = await need(id);
  const arc = activeArc(s);
  const beat = currentBeat(arc);
  if (!arc || !beat || !isDating(s)) return weft.save(id);

  if (!beat.opening) {
    const written = await openingFor(s, smallModel(s));
    if (written) {
      beat.opening = written.opening;
      if (written.title_line) beat.when = written.title_line;
    }
  }

  // Put the player where the beat says they are. The place may not exist yet —
  // resolvePlace inside Weft creates it on first mention, so a beat set
  // somewhere the forge did not build still works.
  if (beat.where) {
    const hit = Object.values(s.world.places).find(
      (p) => p.name.toLowerCase() === beat.where.toLowerCase(),
    );
    if (hit) {
      s.world.player_location = hit.id;
      beat.place_id = hit.id;
      // and put her there too, or the first turn opens with an empty room
      const her = s.characters[arc.char_id];
      if (her) her.location = hit.id;
    }
  }

  // Beat one is the save's opening scene, so Weft renders it as "the beginning"
  // before turn 1 exactly as it does for its own worlds.
  if (beat.idx === 0 && beat.opening && !s.history.some((h) => h.kind === "opening")) {
    s.dating.needs_opening = false;
    await putSave(s);
    await weft.setOpening(id, beat.opening);
    const again = await need(id);
    await syncDirective(again);
    await putSave(again);
    return weft.save(id);
  }

  s.dating.needs_opening = false;
  await syncDirective(s);
  await putSave(s);
  return weft.save(id);
}

/** Rewrite the standing direction for whatever beat is live. Cheap, no calls. */
async function syncDirective(s: SaveState): Promise<void> {
  const arc = activeArc(s);
  const beat = currentBeat(arc);
  if (!arc || !beat || !isDating(s)) return;
  const owed = s.history.length
    ? ticCorrection(findTics(s.history[s.history.length - 1].narrator_prose ?? ""))
    : "";
  s.world_bible.narrator_direction = [
    beatDirective(s, arc, beat, s.dating.register),
    owed,
  ].filter(Boolean).join("\n\n");
}

/* ── PLAYING A TURN ──────────────────────────────────────────────────────────*/

export interface PlayEvents extends TurnEvents {
  /** The gate opened. The scene view swaps the composer for the doors. */
  onGate?: (doors: Door[], because: "discharged" | "ceiling") => void;
  /** A picture landed. */
  onPicture?: (url: string) => void;
}

export async function play(
  id: string,
  action: string,
  mode: ActionMode,
  ev: PlayEvents,
  opts?: { illustrate?: boolean; signal?: AbortSignal },
): Promise<void> {
  // Refresh the direction before the turn so this turn carries the correction
  // owed for last turn's tics.
  const pre = await need(id);
  await syncDirective(pre);
  await putSave(pre);

  await streamTurn(id, action, mode, {
    ...ev,
    onDone: async (save) => {
      ev.onDone?.(save);
      try {
        if (opts?.illustrate) void illustrateTurn(id, save.world.current_turn, ev);
        await afterTurn(id, ev);
      } catch (e: any) {
        ev.onError?.(e?.message ?? "the gate check failed");
      }
    },
  }, { signal: opts?.signal });
}

/** The post-turn check. Runs after the prose has committed, so nothing the
 *  player reads ever waits on it. */
async function afterTurn(id: string, ev: PlayEvents): Promise<void> {
  const s = await need(id);
  const arc = activeArc(s);
  if (!arc || arc.state !== "running" || !isDating(s) || s.dating.gate) return;

  const g = gateCheck(s);
  if (!g.beat) return;

  let because: "discharged" | "ceiling" | null = null;
  if (g.atCeiling) because = "ceiling";
  else if (g.shouldAsk && await judgeBeat(s, smallModel(s))) because = "discharged";
  if (!because) return;

  const fresh = await need(id);
  const doors = await doorsFor(fresh, smallModel(fresh), because);
  openGate(fresh, doors, because);
  await putSave(fresh);
  ev.onGate?.(doors, because);
}

/* ── WALKING THROUGH A DOOR ──────────────────────────────────────────────────*/

/** Rough elapsed time from a beat's `when` phrase. Deliberately crude: the
 *  point is that a chapter set "the following week" does not open four minutes
 *  after the last one ended, not that the calendar is exact. */
function skipMinutes(when: string): number {
  const w = when.toLowerCase();
  const num = Number((w.match(/\b(\d{1,2})\b/) ?? [])[1] ?? 0);
  if (/month/.test(w)) return (num || 1) * 43200;
  if (/week/.test(w)) return (num || 1) * 10080;
  if (/day|tomorrow|following|next/.test(w)) return (num || 2) * 1440;
  if (/hour|later that|same night|afterward/.test(w)) return (num || 3) * 60;
  return 900; // a bit over half a day: enough that it is plainly a new scene
}

export interface DoorResult {
  save: ClientSave;
  /** Set when the route ended here. */
  ending?: { kind: "win" | "loss" | "sour"; title: string; prose: string };
}

export async function walkThrough(id: string, doorId: string, onPhase: (p: string) => void = () => {}): Promise<DoorResult> {
  const s = await need(id);
  if (!isDating(s)) throw new Error("not a dating save");
  const arc = activeArc(s);
  const door = s.dating.gate?.doors.find((d) => d.id === doorId);
  if (!arc || !door) throw new Error("that door is not open");

  // Record the choice as a turn of its own, so the journal reads continuously
  // and the narrator's replayed history contains the decision rather than a
  // hole where one was made.
  const heat = heatOf(s, arc.char_id).value;
  const next = takeDoor(s, door);

  if (!next) {
    // THE ROUTE ENDED. Grade it, write it, and stop.
    onPhase("writing the ending");
    const kind = arc.ending_kind ?? resolveTerminal(s, arc);
    const terminal = terminalOf(arc, kind)!;
    await putSave(s);
    const prose = await endingFor(s, arc, terminal, bigModel(s));
    const fin = await need(id);
    const a = activeArc(fin);
    if (a) { a.ending_prose = prose; a.ending_kind = kind; a.state = kind === "win" ? "won" : kind === "loss" ? "lost" : "soured"; }
    await putSave(fin);
    return { save: await weft.save(id), ending: { kind, title: terminal.title, prose } };
  }

  // Move the clock so the next chapter is plainly a different night.
  s.world.current_time = advanceClock(s.world.current_time, skipMinutes(next.when));
  s.world.scene_started_time = s.world.current_time;
  void heat;
  await putSave(s);

  onPhase("setting the next scene");
  return { save: await openBeat(id) };
}

/* ── PICTURES ────────────────────────────────────────────────────────────────*/

export async function illustrateTurn(id: string, turn: number, ev: PlayEvents): Promise<string | null> {
  try {
    const { url } = await weft.illustrate(id, turn);
    if (!url) return null;
    const s = await need(id);
    const arc = activeArc(s);
    if (arc && isDating(s)) {
      const beat = currentBeat(arc);
      const place = s.world.places[s.world.player_location]?.name ?? "";
      const k: Keepsake = {
        id: uid("keep"), char_id: arc.char_id, beat_idx: arc.cursor, turn,
        time: s.world.current_time, place, caption: beat?.title ?? "", image: url,
      };
      s.dating.keepsakes.push(k);
      // The pixels live on the history entry too; the album keeps its own copy
      // so a picture stays in the album after Weft's illustration cap drops the
      // bytes from an old turn. Cap the album as well or the save grows without
      // limit — thirty is a long campaign's worth.
      if (s.dating.keepsakes.length > 30) s.dating.keepsakes.splice(0, s.dating.keepsakes.length - 30);
      if (!beat!.illustration) beat!.illustration = url;
      await putSave(s);
    }
    ev.onPicture?.(url);
    return url;
  } catch { return null; }
}

export async function portrait(id: string, char_id: string): Promise<string | null> {
  try { return (await weft.portrait(id, char_id)).url; } catch { return null; }
}

/* ── PASS-THROUGH ────────────────────────────────────────────────────────────*/

export const settings = weft.settings;
export const editSave = weft.edit;
export const rollback = weft.rollback;
export const setTime = weft.setTime;
export { weft };
