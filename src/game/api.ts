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
import { adultAge, emptyAppetites, type Appetites } from "./appetite";
import { runCasting, beginRoute, type CastingInput } from "./casting";

const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 10)}`;

async function need(id: string): Promise<SaveState> {
  const s = await getSave(id);
  if (!s) throw new Error("that save is gone");
  return heal(s);
}

/** Saves written before the appetite layer existed are missing whole objects
 *  that half this module dereferences. Fill them in on load rather than
 *  guarding at every read — the alternative is forty optional chains and one
 *  that gets forgotten. */
function heal(s: SaveState): SaveState {
  const d = (s as SaveState & { dating?: DatingLayer }).dating;
  if (!d) return s;
  d.heat ??= { explicitness: "frank", palette: [], limits: [] };
  d.heat.palette ??= [];
  d.heat.limits ??= [];
  d.appetites ??= {};
  for (const arc of Object.values(d.routes ?? {})) {
    arc.rung ??= 0;
    d.appetites[arc.char_id] ??= emptyAppetites();
    const a = d.appetites[arc.char_id];
    a.into ??= []; a.curious ??= []; a.limits ??= []; a.discovered ??= [];
  }
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
    beatDirective(s, arc, beat, s.dating),
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
  if (g.shouldAsk || g.atCeiling) {
    // The judge is one small call and it answers three questions at once: did
    // the chapter's job happen, how far the two of them have physically gone,
    // and what the scene put on the record about what either of them wants. It
    // runs at the ceiling too — the chapter closes regardless there, but the
    // rung and the revelations still have to be read off the page.
    const verdict = await judgeBeat(s, smallModel(s));
    const fresh = await need(id);
    const a2 = activeArc(fresh);
    if (a2 && isDating(fresh)) {
      a2.rung = Math.max(a2.rung ?? 0, verdict.rung);
      if (verdict.revealed.length) {
        const app = (fresh.dating.appetites[a2.char_id] ??= emptyAppetites());
        recordRevealed(app, verdict.revealed);
      }
      await putSave(fresh);
    }
    if (g.atCeiling) because = "ceiling";
    else if (verdict.done) because = "discharged";
  }
  if (!because) return;

  const fresh = await need(id);
  const doors = await doorsFor(fresh, smallModel(fresh), because);
  openGate(fresh, doors, because);
  await putSave(fresh);
  ev.onGate?.(doors, because);
}

/** Fold what a scene revealed into what the player is allowed to see.
 *
 *  The dossier shows only `discovered`, so this is the collection mechanic: the
 *  truth of a person is on their card from turn one and the player earns access
 *  to it a line at a time. A revelation matches an existing appetite loosely —
 *  the judge writes "wants to be told what to do" and the card says "being
 *  given orders" — so matching is on word overlap rather than equality, and an
 *  unmatched revelation is still kept, because a person can turn out to want
 *  something the forge never wrote down. */
function recordRevealed(app: Appetites, revealed: string[]): void {
  const words = (s: string) => new Set(s.toLowerCase().match(/[a-z]{4,}/g) ?? []);
  const known = [...app.into, ...app.limits, ...app.curious];
  for (const r of revealed) {
    const rw = words(r);
    const hit = known.find((k) => {
      const kw = words(k);
      let shared = 0;
      for (const w of rw) if (kw.has(w)) shared++;
      return shared >= 2 || (kw.size <= 2 && shared >= 1);
    });
    const entry = hit ?? r;
    if (!app.discovered.some((d) => d.toLowerCase() === entry.toLowerCase())) {
      app.discovered.push(entry);
    }
    // The unsaid thing surfacing is the one revelation worth a flag of its own.
    if (app.unsaid && !app.unsaid_found) {
      const uw = words(app.unsaid);
      let shared = 0;
      for (const w of rw) if (uw.has(w)) shared++;
      if (shared >= 2) app.unsaid_found = true;
    }
  }
  if (app.discovered.length > 40) app.discovered.splice(0, app.discovered.length - 40);
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

/* ── EDITING ─────────────────────────────────────────────────────────────────
 *
 *  Everything about a person is editable, which is not a debug affordance — it
 *  is the point. The forge writes a first draft of somebody out of a paragraph
 *  you typed, and it will get things wrong, and the difference between a game
 *  you play once and one you keep is whether you can reach in and fix the
 *  woman's voice on turn three instead of rerolling the whole town.
 */

/** Identity fields, through Weft's own editor so age reconciliation runs — the
 *  number lives in a dozen prose copies (backgrounds, memories, edge notes,
 *  canon) and moving only the number leaves the cast still saying the old one.
 *  See vendor/weft/src/engine/age.ts, which is worth reading. */
export async function editCharacter(
  id: string, char_id: string, identity: Record<string, unknown>,
): Promise<{ save: ClientSave; notice?: string }> {
  const patch = { ...identity };
  // The floor is enforced here as well as in casting, because this is the other
  // door into the record.
  if ("age" in patch) patch.age = adultAge(patch.age);
  const save = await weft.rawEditCharacter(id, char_id, { identity: patch });
  return { save, notice: save.edit_notice };
}

export async function editAppetites(id: string, char_id: string, patch: Partial<Appetites>): Promise<ClientSave> {
  const s = await need(id);
  if (!isDating(s)) throw new Error("not a dating save");
  const a = (s.dating.appetites[char_id] ??= emptyAppetites());
  Object.assign(a, patch);
  a.into ??= []; a.curious ??= []; a.limits ??= []; a.discovered ??= [];
  await putSave(s);
  return weft.save(id);
}

/** The relationship itself, set by hand. Absolute values rather than deltas —
 *  a debug control that nudges is a debug control you use eleven times. */
export async function editEdge(
  id: string, char_id: string,
  patch: { warmth?: number; trust?: number; attraction?: number; roles?: string[]; notes?: string },
): Promise<ClientSave> {
  const s = await need(id);
  const clamp = (n: number) => Math.max(-100, Math.min(100, Math.round(n)));
  let e = s.world.edges.find((x) => x.from === char_id && x.to === "char_player");
  if (!e) {
    e = { from: char_id, to: "char_player", warmth: 0, trust: 0, power: 0, notes: "", updated_turn: s.world.current_turn };
    s.world.edges.push(e);
  }
  if (patch.warmth != null) e.warmth = clamp(patch.warmth);
  if (patch.trust != null) e.trust = clamp(patch.trust);
  if (patch.attraction != null) {
    e.attraction = clamp(patch.attraction);
    // attraction_base caps how far warmth alone can lift wanting (see
    // engine/desire.ts). Setting attraction by hand past a low base would be
    // silently pulled back down, so raise the ceiling with it.
    e.attraction_base = Math.max(e.attraction_base ?? 0, e.attraction);
  }
  if (patch.roles) e.roles = patch.roles.filter(Boolean);
  if (patch.notes != null) { e.notes = patch.notes; e.notes_turn = s.world.current_turn; }
  e.updated_turn = s.world.current_turn;
  await putSave(s);
  return weft.save(id);
}

/* ── THE CONSOLE ─────────────────────────────────────────────────────────────
 *  Cheats, in the ordinary sense. A single-player game running on the player's
 *  own key, on their own machine, has no reason to withhold any of this. */

/** Move the physical ladder by hand. Useful when the judge misreads a scene, and
 *  useful when you simply want to skip ahead. */
export async function setRung(id: string, rung: number): Promise<ClientSave> {
  const s = await need(id);
  const arc = activeArc(s);
  if (arc) arc.rung = Math.max(0, Math.min(6, Math.round(rung)));
  await putSave(s);
  return weft.save(id);
}

/** Jump to any chapter, played or not. Everything stepped over is marked
 *  skipped rather than deleted, so the spine still shows the road not taken. */
export async function jumpToBeat(id: string, idx: number): Promise<ClientSave> {
  const s = await need(id);
  const arc = activeArc(s);
  if (!arc || !isDating(s)) return weft.save(id);
  const to = Math.max(0, Math.min(arc.beats.length - 1, Math.round(idx)));
  for (let i = arc.cursor; i < to; i++) {
    if (arc.beats[i].status === "locked" || arc.beats[i].status === "open") arc.beats[i].status = "skipped";
  }
  for (let i = to; i < arc.beats.length; i++) {
    if (i > to && arc.beats[i].status === "skipped") arc.beats[i].status = "locked";
  }
  s.dating.gate = null;
  arc.state = "running";
  delete arc.ending_kind;
  delete arc.ending_prose;
  enterBeat(s, to);
  await putSave(s);
  return openBeat(id);
}

/** Open the gate right now, whatever the floor says, and write fresh doors.
 *  Also the fix for a gate whose doors came back unusable. */
export async function forceGate(id: string, reroll = false): Promise<ClientSave> {
  const s = await need(id);
  const arc = activeArc(s);
  if (!arc || !isDating(s)) return weft.save(id);
  if (reroll) s.dating.gate = null;
  await putSave(s);
  const fresh = await need(id);
  const doors = await doorsFor(fresh, smallModel(fresh), "discharged");
  openGate(fresh, doors, "discharged");
  await putSave(fresh);
  return weft.save(id);
}

/** Throw away this chapter's opening and write another one. */
export async function rewriteOpening(id: string, text?: string): Promise<ClientSave> {
  const s = await need(id);
  const arc = activeArc(s);
  const beat = currentBeat(arc);
  if (!beat || !isDating(s)) return weft.save(id);
  beat.opening = text?.trim() || undefined;
  s.dating.needs_opening = !beat.opening;
  await putSave(s);
  return beat.opening ? weft.save(id) : openBeat(id);
}

/** Hand the player everything on somebody's card. The dossier normally shows
 *  only what play has surfaced; this is the "I want to read the answers" switch
 *  and it is one-way on purpose — you cannot un-know it. */
export async function revealAppetites(id: string, char_id: string): Promise<ClientSave> {
  const s = await need(id);
  if (!isDating(s)) return weft.save(id);
  const a = (s.dating.appetites[char_id] ??= emptyAppetites());
  a.discovered = [...new Set([...a.discovered, ...a.into, ...a.curious, ...a.limits])];
  if (a.unsaid) a.unsaid_found = true;
  await putSave(s);
  return weft.save(id);
}

/** Weft's own sovereignty switch: the player's actions succeed, and the world
 *  still reacts to them having succeeded. */
export async function setGodMode(id: string, on: boolean): Promise<ClientSave> {
  const s = await need(id);
  s.world_bible.god_mode = on;
  await putSave(s);
  return weft.save(id);
}

/** Force a route to a given ending without playing the rest of it. */
export async function forceEnding(id: string, kind: "win" | "loss" | "sour"): Promise<DoorResult> {
  const s = await need(id);
  const arc = activeArc(s);
  if (!arc) throw new Error("no route in play");
  const terminal = terminalOf(arc, kind);
  if (!terminal) throw new Error("no such ending");
  arc.state = kind === "win" ? "won" : kind === "loss" ? "lost" : "soured";
  arc.ending_kind = kind;
  arc.ended_turn = s.world.current_turn;
  await putSave(s);
  const prose = await endingFor(s, arc, terminal, bigModel(s));
  const fin = await need(id);
  const a = activeArc(fin);
  if (a) { a.ending_prose = prose; a.ending_kind = kind; }
  await putSave(fin);
  return { save: await weft.save(id), ending: { kind, title: terminal.title, prose } };
}

/** Put the route back on its feet after an ending, without losing the history. */
export async function reopenRoute(id: string): Promise<ClientSave> {
  const s = await need(id);
  const arc = activeArc(s);
  if (!arc) return weft.save(id);
  arc.state = "running";
  delete arc.ending_kind;
  delete arc.ending_prose;
  delete arc.ended_turn;
  await putSave(s);
  return weft.save(id);
}

/** The save's heat settings, changeable mid-game — the explicitness dial in
 *  particular is one people move once they have seen the register in practice. */
export async function editHeat(
  id: string, patch: Partial<DatingLayer["heat"]>,
): Promise<ClientSave> {
  const s = await need(id);
  if (!isDating(s)) return weft.save(id);
  Object.assign(s.dating.heat, patch);
  await putSave(s);
  return weft.save(id);
}
