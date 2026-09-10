import React, { useState } from "react";
import { activeArc, currentBeat, type Save } from "../game/types";
import { RUNGS, rungLabel } from "../game/appetite";
import { heatOf } from "../game/arc";
import {
  editEdge, forceEnding, forceGate, jumpToBeat, load, reopenRoute, revealAppetites,
  rereadVoice, rewriteOpening, rollback, setGodMode, setRung, setTime, weft,
} from "../game/api";
import { Mark } from "../ui/kit";
import { llmErrors } from "@weft/llm";

/**
 * THE CONSOLE.
 *
 * Cheats, in the ordinary sense, and there is no argument for withholding any of
 * them. This is a single-player game that runs in the player's own browser on
 * the player's own key; the state is already theirs, sitting in IndexedDB where
 * anyone who wants it can open the devtools and edit it by hand. Making them do
 * that instead of putting a button here does not protect the experience, it just
 * makes the app worse than a text editor.
 *
 * What IS worth doing is telling the truth about what each one costs. Several of
 * these are one-way — you cannot un-read somebody's card — and one of them
 * (forcing an ending) spends a real model call on the good model. Every control
 * here says what it does before you press it rather than after.
 */
export default function Debug({ save, setSave, onEdit, onPlay }: {
  save: Save; setSave: (s: Save) => void; onEdit: (charId: string) => void; onPlay: () => void;
}) {
  const arc = activeArc(save);
  const beat = currentBeat(arc);
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [clock, setClock] = useState(save.world.current_time);
  const [back, setBack] = useState("3");
  const [raw, setRaw] = useState("");

  const run = async (what: string, fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(what);
    try {
      const r = await fn();
      if (r && typeof r === "object" && "id" in (r as object)) setSave(r as Save);
      else setSave(await load(save.id) as Save);
      setLog((l) => [`${what} — done`, ...l].slice(0, 8));
    } catch (e: any) {
      setLog((l) => [`${what} — ${e?.message ?? "failed"}`, ...l].slice(0, 8));
    } finally { setBusy(null); }
  };

  const h = arc ? heatOf(save, arc.char_id) : null;

  return (
    <div className="scroll fade-top" style={{ height: "100%", padding: "50px 20px 60px" }}>
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <div className="label label-accent" style={{ marginBottom: 8 }}>Console</div>
        <h1 className="display" style={{ fontSize: 32, marginBottom: 10 }}>The console</h1>
        <p className="ui" style={{ color: "var(--ink-lo)", fontSize: 12.5, lineHeight: 1.6, marginBottom: 30, maxWidth: 440 }}>
          This is all here because it's your save and it's already sitting in your browser, so there
          was no sense hiding any of it behind a wall. A few of these can't be undone, and those ones
          say so where they are.
        </p>

        {/* ── STATE READ-OUT ────────────────────────────────────────────── */}
        <div className="well" style={{ padding: 16, marginBottom: 30 }}>
          <div style={{ display: "grid", gap: 7 }}>
            {[
              ["turn", String(save.world.current_turn)],
              ["clock", save.world.current_time],
              ["route", arc ? `${arc.name} · ${arc.state}` : "none"],
              ["chapter", arc && beat ? `${arc.cursor + 1}/${arc.beats.length} — ${beat.title}` : "—"],
              ["in chapter", beat?.entered_turn != null ? `${save.world.current_turn - beat.entered_turn} turns (floor ${beat.floor}, ceiling ${beat.ceiling})` : "—"],
              ["gate", save.dating.gate ? `open · ${save.dating.gate.because}` : "closed"],
              ["ladder", arc ? `${arc.rung ?? 0} — ${rungLabel(arc.rung ?? 0)}` : "—"],
              ["heat", h ? `warmth ${Math.round(h.warmth)} · wanting ${Math.round(h.attraction)} · trust ${Math.round(h.trust)} → ${h.value}` : "—"],
              ["ceiling on wanting", h ? `${Math.round(h.base)}${h.base < 15 ? "  (a flat first read — see below)" : ""}` : "—"],
              ["explicitness", save.dating.heat.explicitness],
              ["god mode", save.world_bible.god_mode ? "on" : "off"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
                <span className="label" style={{ width: 104, flex: "none" }}>{k}</span>
                <span className="ui" style={{ fontSize: 12.5, color: "var(--ink-mid)" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sits directly under the state read-out because it is the first
            thing anybody reaches for when something has gone wrong, and it
            spent one release buried below a sixteen-row JSON textarea where
            nobody found it. Snapshots are stripped on the way out — they are
            device-local rollback copies and most of the file size. */}
        <Mark accent>Export this save</Mark>
        <Row note="Everything: the spine, every beat and what it was for, the whole cast with their locations and appetites, the relationship numbers, and the full history. This is the thing to attach to a bug report.">
          <button className="btn btn-ink" disabled={!!busy}
            onClick={() => run("export", async () => {
              const { name, json } = await weft.exportSave(save.id);
              const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
              const a = document.createElement("a");
              a.href = url; a.download = `${name || "dating101"}.json`;
              document.body.appendChild(a); a.click(); a.remove();
              setTimeout(() => URL.revokeObjectURL(url), 2000);
            })}>
            {busy === "export" ? "…" : "Download it"}
          </button>
          <button className="btn" disabled={!!busy}
            onClick={() => run("copy", async () => {
              const { json } = await weft.exportSave(save.id);
              await navigator.clipboard.writeText(json);
            })}>
            {busy === "copy" ? "…" : "Copy to clipboard"}
          </button>
        </Row>


        {arc && (
          <>
            {/* ── THE CHAPTER ───────────────────────────────────────────── */}
            <Mark accent>The chapter</Mark>
            <Row note="Open the gate now, whatever the floor says, and write fresh doors.">
              <button className="btn" disabled={!!busy} onClick={() => run("force gate", () => forceGate(save.id))}>
                {busy === "force gate" ? "…" : "Force the gate"}
              </button>
              <button className="btn" disabled={!!busy || !save.dating.gate}
                onClick={() => run("reroll doors", () => forceGate(save.id, true))}>
                {busy === "reroll doors" ? "…" : "Reroll the doors"}
              </button>
            </Row>
            <Row note="Throw away this chapter's opening and write another. One small call.">
              <button className="btn" disabled={!!busy} onClick={() => run("rewrite opening", () => rewriteOpening(save.id))}>
                {busy === "rewrite opening" ? "…" : "Rewrite the opening"}
              </button>
            </Row>

            <Mark>Jump to a chapter</Mark>
            <div className="ui" style={{ fontSize: 11.5, color: "var(--ink-faint)", marginBottom: 12, lineHeight: 1.55 }}>
              Everything stepped over is marked skipped rather than deleted, so the spine still shows
              the road not taken. Writes a new opening for wherever you land.
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 30 }}>
              {arc.beats.map((b) => (
                <button key={b.id} className="chip" disabled={!!busy}
                  data-on={b.idx === arc.cursor ? "true" : "false"}
                  title={b.title}
                  onClick={() => run(`jump to ${b.idx + 1}`, () => jumpToBeat(save.id, b.idx))}>
                  {b.idx + 1}
                </button>
              ))}
            </div>

            {/* ── THE LADDER ────────────────────────────────────────────── */}
            <Mark accent>How far it has gone</Mark>
            <div className="ui" style={{ fontSize: 11.5, color: "var(--ink-faint)", marginBottom: 12, lineHeight: 1.55 }}>
              Normally read off the page after each chapter and allowed to move one step at a time.
              Set it here and the next scene is written as though that has already happened.
            </div>
            <div style={{ display: "grid", gap: 5, marginBottom: 30 }}>
              {RUNGS.map((r) => (
                <button key={r.at} className="well" disabled={!!busy}
                  onClick={() => run(`ladder → ${r.at}`, () => setRung(save.id, r.at))}
                  style={{
                    padding: "10px 13px", textAlign: "left",
                    borderColor: (arc.rung ?? 0) === r.at ? "var(--accent)" : "var(--rule)",
                    background: (arc.rung ?? 0) === r.at ? "var(--accent-soft)" : "var(--paper-2)",
                  }}>
                  <div className="ui" style={{ fontSize: 13, color: "var(--ink)" }}>{r.at} · {r.label}</div>
                  <div className="ui" style={{ fontSize: 11.5, color: "var(--ink-lo)", lineHeight: 1.45 }}>{r.note}</div>
                </button>
              ))}
            </div>

            {/* ── HER ───────────────────────────────────────────────────── */}
            <Mark accent>{arc.name}</Mark>
            <Row note="Every field on her: name, age, looks, history, voice, appetites, limits, and the three numbers.">
              <button className="btn btn-ink" onClick={() => onEdit(arc.char_id)}>Open the editor</button>
            </Row>
            {h && h.base < 15 && (
              <Row note="Her first read of you was flat, which caps how far wanting can ever go no matter how well the route is played. This raises that cap to 45 and lifts current wanting to meet it. It is a thumb on the scale and it is yours to put there.">
                <button className="btn" disabled={!!busy}
                  onClick={() => run("raise the ceiling", () =>
                    editEdge(save.id, arc.char_id, { attraction: Math.max(45, Math.round(h.attraction)) }))}>
                  {busy === "raise the ceiling" ? "…" : "Let her want you"}
                </button>
              </Row>
            )}
            <Row note="Hand yourself everything on her card — wants, limits, and the thing she was not going to say. One way. You cannot un-know it.">
              <button className="btn" disabled={!!busy}
                onClick={() => run("reveal appetites", () => revealAppetites(save.id, arc.char_id))}>
                {busy === "reveal appetites" ? "…" : "Read the answers"}
              </button>
            </Row>

            {/* ── ENDINGS ───────────────────────────────────────────────── */}
            <Mark>Endings</Mark>
            <Row note="Write one of the three now, off the state as it stands. Spends a call on the narrator model.">
              {(["win", "loss", "sour"] as const).map((k) => (
                <button key={k} className="btn" disabled={!!busy || arc.state !== "running"}
                  onClick={() => run(`ending: ${k}`, () => forceEnding(save.id, k).then(() => onPlay()))}>
                  {busy === `ending: ${k}` ? "…" : k}
                </button>
              ))}
            </Row>
            {arc.state !== "running" && (
              <Row note="Put the route back on its feet. The history and the pictures stay.">
                <button className="btn" disabled={!!busy} onClick={() => run("reopen", () => reopenRoute(save.id))}>
                  Reopen the route
                </button>
              </Row>
            )}
          </>
        )}

        {/* ── THE WORLD ───────────────────────────────────────────────── */}
        <Mark accent>The world</Mark>
        <Row note="Your actions succeed and cost nothing. The world still reacts to them having succeeded.">
          <button className="btn" disabled={!!busy}
            onClick={() => run("god mode", () => setGodMode(save.id, !save.world_bible.god_mode))}>
            {save.world_bible.god_mode ? "Turn god mode off" : "Turn god mode on"}
          </button>
        </Row>
        <Row note="Runs the voice reader over the turn just written and shows what it found in the studio. Useful for working out whether it is judging sensibly before you trust it.">
          <button className="btn" disabled={!!busy} onClick={() => run("reread voice", () => rereadVoice(save.id))}>
            {busy === "reread voice" ? "…" : "Re-read the last turn"}
          </button>
        </Row>
        <Row note="The bookkeeper estimates elapsed time off the prose and it drifts. This is the correction.">
          <input className="field" value={clock} onChange={(e) => setClock(e.target.value)}
            style={{ maxWidth: 190, fontSize: 14 }} />
          <button className="btn" disabled={!!busy} onClick={() => run("set clock", () => setTime(save.id, clock))}>Set</button>
        </Row>
        <Row note="Rewind the story. One level of undo is kept, so a rollback you regret is recoverable.">
          <input className="field" value={back} onChange={(e) => setBack(e.target.value.replace(/[^0-9]/g, ""))}
            style={{ maxWidth: 70, fontSize: 14 }} />
          <button className="btn" disabled={!!busy}
            onClick={() => run("rollback", () => rollback(save.id, Math.max(0, save.world.current_turn - (Number(back) || 1))))}>
            Turns back
          </button>
        </Row>

        <Mark>Raw world</Mark>
        <div className="ui" style={{ fontSize: 11.5, color: "var(--ink-faint)", marginBottom: 12, lineHeight: 1.55 }}>
          The bible, threads, clocks, places, canon and edges as stored. Nothing validates this
          beyond it being JSON.
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button className="btn" disabled={!!busy}
            onClick={() => run("load world", async () => { setRaw(JSON.stringify(await weft.getWorldRaw(save.id), null, 2)); })}>
            Load
          </button>
          <button className="btn btn-ink" disabled={!!busy || !raw.trim()}
            onClick={() => run("write world", () => weft.rawEditWorld(save.id, JSON.parse(raw)))}>
            Write it
          </button>
        </div>
        {!!raw && (
          <textarea className="field" rows={16} value={raw} onChange={(e) => setRaw(e.target.value)}
            style={{ fontFamily: "ui-monospace, monospace", fontSize: 11.5, lineHeight: 1.5 }} />
        )}

        {/* WHAT THE MODELS ACTUALLY SAID WHEN THEY FAILED.
            Weft has kept a ring buffer of these the whole time and nothing in
            this app ever showed it, so every failed call surfaced as "the model
            call failed" and the reason — a refusal, a bad key, no credit, a
            provider 400 — was sitting in memory unread. */}
        <Mark accent>Recent model errors</Mark>
        {llmErrors.length === 0 ? (
          <div className="ui" style={{ fontSize: 12.5, color: "var(--ink-faint)", lineHeight: 1.6, marginBottom: 30 }}>
            Nothing has failed since this page was loaded. This list is in memory only, so a reload
            empties it.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10, marginBottom: 30 }}>
            {[...llmErrors].reverse().slice(0, 8).map((e, i) => (
              <div key={i} style={{ paddingLeft: 12, borderLeft: "2px solid var(--rule-strong)" }}>
                <div className="label" style={{ marginBottom: 2 }}>
                  {e.model} · {new Date(e.at).toLocaleTimeString()}
                </div>
                <div className="ui" style={{ fontSize: 12, color: "var(--ink-mid)", lineHeight: 1.5 }}>{e.message}</div>
              </div>
            ))}
          </div>
        )}
        {!!save.dating.opening_error && (
          <div style={{ marginTop: -18, marginBottom: 30, paddingLeft: 12, borderLeft: "2px solid var(--accent-line)" }}>
            <div className="label label-accent" style={{ marginBottom: 2 }}>last chapter opening</div>
            <div className="ui" style={{ fontSize: 12, color: "var(--ink-mid)", lineHeight: 1.5 }}>
              {save.dating.opening_error}
            </div>
          </div>
        )}

        {!!log.length && (
          <div style={{ marginTop: 30 }}>
            <Mark>Log</Mark>
            <div className="ui" style={{ fontSize: 12, color: "var(--ink-lo)", lineHeight: 1.8 }}>
              {log.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ note, children }: { note: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 7 }}>
        {children}
      </div>
      <div className="ui" style={{ fontSize: 11.5, color: "var(--ink-faint)", lineHeight: 1.55, maxWidth: 440 }}>{note}</div>
    </div>
  );
}
