import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Camera, CornerDownLeft, Square } from "lucide-react";
import type { ActionMode } from "@weft/engine/types";
import { play, walkThrough, openBeat, illustrateTurn, load } from "../game/api";
import { activeArc, currentBeat, type Arc, type Beat, type Door, type Gate, type Save } from "../game/types";
import { beatFullness } from "../game/arc";
import { readOf } from "../game/read";
import { Prose, YourTurn, type Speaker } from "../ui/Prose";
import { Fill, Lightbox, Photo } from "../ui/kit";

/**
 * THE SCENE — where the game actually is.
 *
 * Layout, and why it is this way:
 *
 * A visual novel puts a text box across the bottom and character art above it.
 * That is the correct arrangement when the art is hand-painted and the text is
 * a caption on it. Ours is the other way round: the prose is generated fresh
 * every turn and is the thing being paid for, and the pictures are a decoration
 * we can produce on demand. So the page is the column and the pictures are
 * tipped into it, which is a book, not a text box.
 *
 * On a wide screen a right-hand rail carries the person — her photograph, the
 * read, the chapter she is in. It is a dossier standing open beside the page.
 * Under a thousand pixels it folds: the photograph goes into the header and the
 * read moves to a single line above the composer, which is the one piece of it
 * that has to survive on a phone.
 *
 * There are exactly two states down there. Inside a beat you have a text box and
 * total freedom. At a gate the text box is gone and there are three doors and
 * nothing else. Never both — the whole design of the game is that those are
 * different activities, and letting the player type their way past a gate would
 * dissolve the structure the spine exists to provide.
 */

const MODES: { id: ActionMode; label: string; hint: string }[] = [
  { id: "do", label: "Do", hint: "You act. Plain text is a physical action." },
  { id: "say", label: "Say", hint: "You speak. Everyone in the room hears it." },
  { id: "think", label: "Think", hint: "Sealed. Nobody perceives it and nobody reacts to it." },
  { id: "story", label: "Write", hint: "You write the world, not your character." },
];

export default function Scene({ save, setSave, onOpenSpine }: {
  save: Save;
  setSave: (s: Save) => void;
  onOpenSpine: () => void;
}) {
  const arc = activeArc(save);
  const beat = currentBeat(arc);
  const gate = save.dating.gate ?? null;

  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<ActionMode>("do");
  const [streaming, setStreaming] = useState("");
  const [phase, setPhase] = useState("");
  const [busy, setBusy] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [card, setCard] = useState(false);
  const [walking, setWalking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const foot = useRef<HTMLDivElement>(null);

  const names: Speaker[] = useMemo(
    () => Object.values(save.characters)
      .filter((c) => c.character_id !== "char_player")
      .map((c) => ({ name: c.name, pronouns: c.pronouns })),
    [save.characters],
  );
  const her = arc ? save.characters[arc.char_id] : undefined;
  const read = arc ? readOf(save, arc.char_id) : null;

  /** The turns that belong to the chapter on screen. Everything before the beat
   *  was entered is in the journal, not on this page — a chapter should read as
   *  a chapter, not as an endless scroll of the entire save. */
  const page = useMemo(() => {
    const from = beat?.entered_turn ?? 0;
    return save.history.filter((h) => h.turn > from || h.kind === "opening" && beat?.idx === 0);
  }, [save.history, beat?.entered_turn, beat?.idx]);

  // The title card comes up whenever the chapter changes underneath us.
  const seen = useRef<number | null>(null);
  useEffect(() => {
    if (!arc || !beat) return;
    if (seen.current === null) { seen.current = arc.cursor; return; }
    if (seen.current !== arc.cursor) { seen.current = arc.cursor; setCard(true); }
  }, [arc?.cursor, beat]);

  // A beat that arrived without its opening written (a reload mid-chapter, or a
  // failed call) gets it now, quietly.
  useEffect(() => {
    if (save.dating.needs_opening && !busy) {
      openBeat(save.id).then((s) => setSave(s as Save)).catch(() => {});
    }
  }, [save.dating.needs_opening, save.id, busy, setSave]);

  useEffect(() => { foot.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [streaming, page.length, gate?.opened_turn]);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || busy || gate) return;
    setBusy(true); setStreaming(""); setError(null); setDraft("");
    abort.current = new AbortController();
    let acc = "";
    try {
      await play(save.id, text, mode, {
        onPhase: setPhase,
        onDelta: (d) => { acc += d; setStreaming(acc); },
        onDone: (s) => { setSave(s as Save); setStreaming(""); setPhase(""); },
        onGate: () => { /* the save reload below carries it */ },
        onError: (m) => { setError(m); setDraft(text); },
        onCancel: () => { setDraft(text); setStreaming(""); },
      }, { illustrate: !!save.model_settings.auto_illustrate, signal: abort.current.signal });
      // The gate is written after the turn commits, so re-read once at the end.
      setSave(await load(save.id) as Save);
    } catch (e: any) {
      setError(e?.message ?? "the turn failed");
      setDraft(text);
    } finally {
      setBusy(false); setPhase(""); setStreaming(""); abort.current = null;
    }
  }, [draft, busy, gate, mode, save.id, save.model_settings.auto_illustrate, setSave]);

  const takeDoor = useCallback(async (d: Door) => {
    if (walking) return;
    setWalking(true); setError(null);
    try {
      const r = await walkThrough(save.id, d.id, setPhase);
      setSave(r.save as Save);
    } catch (e: any) {
      setError(e?.message ?? "that did not go through");
    } finally { setWalking(false); setPhase(""); }
  }, [save.id, walking, setSave]);

  const shoot = useCallback(async () => {
    const turn = save.world.current_turn;
    setPhase("drawing");
    await illustrateTurn(save.id, turn, {});
    setSave(await load(save.id) as Save);
    setPhase("");
  }, [save.id, save.world.current_turn, setSave]);

  if (!arc || !beat) return null;
  const ended = arc.state !== "running";

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* ── CHAPTER BAR ─────────────────────────────────────────────────── */}
      <div className="center-page" style={{
        padding: "9px 20px 0", flex: "none",
        /* Opaque, and above the page. The bar sits over a scrolling column and the
           top-edge mask only softens the first few pixels — without a ground of its
           own, narration scrolls up and prints straight through the chapter title. */
        background: "var(--paper)", position: "relative", zIndex: 2,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 7 }}>
          <button className="label label-accent" onClick={onOpenSpine} style={{ flex: "none" }}>
            Ch. {beat.idx + 1} / {arc.beats.length}
          </button>
          <div className="display" style={{
            fontSize: 15, flex: 1, minWidth: 0, overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{beat.title}</div>
          <div className="label" style={{ flex: "none" }}>{save.world.current_time.replace(/\s*\(.*\)$/, "")}</div>
        </div>
        <Fill at={beatFullness(save)} />

        {/* Her face on a narrow screen, where the rail has folded away. */}
        <div className="her-mobile" style={{ alignItems: "center", gap: 11, padding: "11px 0 3px" }}>
          {her?.portrait_url
            ? <img src={her.portrait_url} alt="" onClick={() => setLightbox(her.portrait_url!)}
                style={{ width: 38, height: 46, objectFit: "cover", flex: "none",
                  border: "3px solid var(--photo-mat)", boxShadow: "var(--card-shadow)",
                  filter: "sepia(.12) saturate(.94) contrast(1.04)" }} />
            : <div style={{ width: 38, height: 46, flex: "none", background: "var(--paper-2)" }} />}
          <div style={{ minWidth: 0 }}>
            <div className="display" style={{ fontSize: 15 }}>{her?.name}</div>
            <div className="ui" style={{ fontSize: 11.5, color: "var(--ink-lo)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {save.world.places[save.world.player_location]?.name ?? beat.where}
            </div>
          </div>
        </div>
      </div>

      {/* ── PAGE + RAIL ─────────────────────────────────────────────────── */}
      <div className="center-page" style={{ flex: 1, minHeight: 0, display: "flex", gap: 30, padding: "0 20px" }}>
        <div className="scroll fade-top" style={{ flex: 1, minWidth: 0, paddingTop: 32 }}>

          {beat.opening && (
            <Opening beat={beat} onZoom={setLightbox} />
          )}

          {page.map((h) => (
            <div key={`${h.turn}-${h.kind ?? "t"}`}>
              {h.kind !== "opening" && <YourTurn text={h.player_action} mode={h.action_mode} />}
              <Prose text={h.narrator_prose_read || h.narrator_prose} names={names}
                dropcap={h.kind === "opening"} />
              {h.illustration_url && (
                <div style={{ maxWidth: 380, margin: "26px 0 8px" }}>
                  <Photo src={h.illustration_url} ratio="3 / 2" tilt="r"
                    caption={h.time_label} onClick={() => setLightbox(h.illustration_url!)} />
                </div>
              )}
            </div>
          ))}

          {streaming && (
            <div>
              <Prose text={streaming} names={names} streaming />
            </div>
          )}

          {busy && !streaming && (
            <div className="ui breathe" style={{ color: "var(--ink-lo)", padding: "18px 0", fontSize: 12.5, letterSpacing: ".08em" }}>
              {phase || "writing"}…
            </div>
          )}

          {ended && <TheEnd arc={arc} />}

          <div ref={foot} style={{ height: 40 }} />
        </div>

        {/* THE RAIL — the person, standing open beside the page. */}
        <aside className="scroll rail" style={{ width: 268, flex: "none", paddingTop: 32, paddingBottom: 24 }}>
          {her && (
            <Photo src={her.portrait_url} ratio="4 / 5" tilt="l" priority
              caption={`${her.name} · ${her.age}`}
              onClick={her.portrait_url ? () => setLightbox(her.portrait_url!) : undefined} />
          )}
          {read && (
            <div style={{ marginTop: 22 }}>
              <div className="prose" style={{ fontSize: 14.5, lineHeight: 1.6 }}>{read.line}</div>
              <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
                {read.facets.map((f) => (
                  <div key={f.label}>
                    <div className="label" style={{ marginBottom: 3 }}>{f.label}</div>
                    <div className="ui" style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--ink-mid)" }}>{f.line}</div>
                  </div>
                ))}
              </div>
              {read.caution && (
                <div style={{ marginTop: 18, paddingLeft: 12, borderLeft: "2px solid var(--accent-line)" }}>
                  <div className="ui" style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--ink)" }}>{read.caution}</div>
                </div>
              )}
            </div>
          )}
          {her?.appearance_now && (
            <div style={{ marginTop: 22 }}>
              <div className="label" style={{ marginBottom: 4 }}>Wearing</div>
              <div className="ui" style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--ink-mid)" }}>{her.appearance_now}</div>
            </div>
          )}
        </aside>
      </div>

      {/* ── THE FOOT: a composer, or three doors. Never both. ───────────── */}
      <div className="center-page" style={{ flex: "none", borderTop: "1px solid var(--rule)", background: "var(--paper)" }}>
        <AnimatePresence mode="wait">
          {gate ? (
            <motion.div key="gate" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.42, ease: [0.2, 0.7, 0.3, 1] }}>
              <Doors gate={gate} busy={walking} phase={phase} onTake={takeDoor} />
            </motion.div>
          ) : ended ? (
            <motion.div key="ended" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div style={{ padding: "18px 20px", textAlign: "center" }}>
                <button className="btn" onClick={onOpenSpine}>Read the spine</button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="composer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Composer
                draft={draft} setDraft={setDraft} mode={mode} setMode={setMode}
                busy={busy} onSend={send} onShoot={shoot} phase={phase}
                read={read?.line}
                onStop={() => abort.current?.abort()}
              />
            </motion.div>
          )}
        </AnimatePresence>
        {error && (
          <div className="ui" style={{ padding: "0 20px 12px", color: "var(--bad)", fontSize: 12.5 }}>{error}</div>
        )}
      </div>

      <AnimatePresence>
        {card && beat.opening && (
          <TitleCard beat={beat} total={arc.beats.length} who={arc.name} onDone={() => setCard(false)} />
        )}
      </AnimatePresence>
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}

/* ── THE CHAPTER'S ESTABLISHING BLOCK ──────────────────────────────────────
   Set apart from the narration around it: an epigraph, in the display face,
   with the chapter's picture beside it if one has been drawn. */
function Opening({ beat, onZoom }: { beat: Beat; onZoom: (s: string) => void }) {
  return (
    <div style={{ marginBottom: 34 }}>
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap", maxWidth: "var(--measure)" }}>
        <div style={{ flex: "1 1 280px", minWidth: 220 }}>
          <div className="label label-accent" style={{ marginBottom: 8 }}>{beat.when}</div>
          <div className="display-i" style={{ fontSize: 19, lineHeight: 1.45, color: "var(--ink)" }}>
            {beat.opening}
          </div>
        </div>
        {beat.illustration && (
          <div style={{ width: 150, flex: "none" }}>
            <Photo src={beat.illustration} ratio="4 / 5" tilt="r" onClick={() => onZoom(beat.illustration!)} />
          </div>
        )}
      </div>
      <div style={{ height: 1, background: "var(--rule)", margin: "26px 0 0", maxWidth: "var(--measure)" }} />
    </div>
  );
}

/* ── THE DOORS ─────────────────────────────────────────────────────────────
   Three, stacked, each a plate you can press. The `read` under each is what
   makes them worth reading rather than clicking: it says what the choice costs,
   never how it lands. */
function Doors({ gate, busy, phase, onTake }: {
  gate: Gate | null;
  busy: boolean; phase: string; onTake: (d: Door) => void;
}) {
  if (!gate) return null;
  return (
    <div style={{ padding: "16px 20px 20px" }}>
      <div className="rule-with-word" style={{ marginBottom: 13 }}>
        <span className="label label-accent">
          {gate.because === "ceiling" ? "the night ends anyway" : "and so"}
        </span>
      </div>
      <div style={{ display: "grid", gap: 8, maxWidth: 760 }}>
        {gate.doors.map((d, i) => (
          <motion.button key={d.id} className="well" disabled={busy}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 * i, duration: 0.34 }}
            whileHover={busy ? undefined : { x: 3 }}
            onClick={() => onTake(d)}
            style={{
              padding: "14px 16px", textAlign: "left", display: "block",
              borderLeft: `2px solid ${d.bearing === "toward" ? "var(--accent)" : d.bearing === "away" ? "var(--rule-strong)" : "var(--ink-faint)"}`,
              opacity: busy ? 0.45 : 1,
            }}>
            <div className="display" style={{ fontSize: 17.5, lineHeight: 1.3, marginBottom: 5 }}>{d.label}</div>
            <div className="ui" style={{ fontSize: 12.5, color: "var(--ink-lo)", lineHeight: 1.5 }}>{d.read}</div>
          </motion.button>
        ))}
      </div>
      {busy && (
        <div className="ui breathe" style={{ marginTop: 14, fontSize: 12, letterSpacing: ".08em", color: "var(--ink-lo)" }}>
          {phase || "moving"}…
        </div>
      )}
    </div>
  );
}

/* ── THE COMPOSER ──────────────────────────────────────────────────────────*/
function Composer({
  draft, setDraft, mode, setMode, busy, onSend, onStop, onShoot, phase, read,
}: {
  draft: string; setDraft: (v: string) => void;
  mode: ActionMode; setMode: (m: ActionMode) => void;
  busy: boolean; onSend: () => void; onStop: () => void; onShoot: () => void;
  phase: string; read?: string;
}) {
  const ta = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(150, Math.max(28, el.scrollHeight))}px`;
  }, [draft]);

  return (
    <div style={{ padding: "10px 20px 14px" }}>
      {/* THE READ STRIP. On a phone this is the whole HUD, so it carries the
          headline observation and nothing else. */}
      {read && (
        <div className="read-strip ui" style={{
          fontSize: 12.5, color: "var(--ink-lo)", fontStyle: "italic",
          marginBottom: 9, lineHeight: 1.5,
        }}>{read}</div>
      )}

      <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
        {MODES.map((m) => (
          <button key={m.id} className="chip" data-on={mode === m.id ? "true" : "false"}
            title={m.hint} onClick={() => setMode(m.id)}>{m.label}</button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          <button className="mark" title="draw this moment" onClick={onShoot} disabled={busy}>
            <Camera size={15} />
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
        <textarea
          ref={ta} className="field" rows={1} value={draft} disabled={busy}
          placeholder={MODES.find((m) => m.id === mode)!.hint}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); }
          }}
          style={{ flex: 1, minHeight: 28 }}
        />
        {busy
          ? <button className="mark" title="stop" onClick={onStop}><Square size={14} /></button>
          : <button className="mark" title="send" onClick={onSend} disabled={!draft.trim()}>
              <CornerDownLeft size={15} />
            </button>}
      </div>
      <div className="ui" style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 7, lineHeight: 1.5 }}>
        {busy ? (phase || "writing…")
          : `"quotes" are spoken · *asterisks* are sealed thought · everything else is what you do`}
      </div>
    </div>
  );
}

/* ── THE TITLE CARD ────────────────────────────────────────────────────────
   The chapter break. It costs nothing and it is most of what makes a run of
   turns feel like a story rather than a chat log: the screen stops, names what
   is about to happen, and waits for you. */
function TitleCard({ beat, total, who, onDone }: {
  beat: Beat; total: number; who: string; onDone: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.55 }}
      onClick={onDone}
      style={{
        position: "absolute", inset: 0, zIndex: 700, background: "var(--paper)",
        display: "grid", placeItems: "center", padding: 32, cursor: "pointer",
      }}>
      <motion.div
        initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.18, duration: 0.6, ease: [0.2, 0.7, 0.3, 1] }}
        style={{ maxWidth: 520, textAlign: "center" }}>
        <div className="label label-accent" style={{ marginBottom: 18 }}>
          Chapter {beat.idx + 1} of {total} · {who}
        </div>
        <h1 className="display" style={{ fontSize: "clamp(28px, 6vw, 42px)", lineHeight: 1.12, marginBottom: 20 }}>
          {beat.title}
        </h1>
        <div style={{ width: 46, height: 1, background: "var(--accent)", margin: "0 auto 20px" }} />
        <div className="display-i" style={{ fontSize: 16.5, lineHeight: 1.5, color: "var(--ink-mid)" }}>
          {beat.when}
        </div>
        <div className="label" style={{ marginTop: 40 }}>tap to begin</div>
      </motion.div>
    </motion.div>
  );
}

/* ── THE END ───────────────────────────────────────────────────────────────*/
function TheEnd({ arc }: { arc: Arc }) {
  const kind = arc.ending_kind ?? "sour";
  const t = arc.terminals.find((x) => x.kind === kind);
  return (
    <div style={{ margin: "40px 0", maxWidth: "var(--measure)" }}>
      <div style={{ height: 1, background: "var(--accent)", marginBottom: 26 }} />
      <div className="label label-accent" style={{ marginBottom: 12 }}>
        {kind === "win" ? "It worked" : kind === "loss" ? "It did not happen" : "It happened, and"}
      </div>
      <h2 className="display" style={{ fontSize: 30, marginBottom: 22 }}>{t?.title}</h2>
      {arc.ending_prose && <Prose text={arc.ending_prose} names={[{ name: arc.name }]} dropcap />}
    </div>
  );
}
