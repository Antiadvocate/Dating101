import React, { useState } from "react";
import { motion } from "motion/react";
import { Lock } from "lucide-react";
import { activeArc, ACCENT_HEX, type Arc, type Save } from "../game/types";
import { OUTCOME_WORD, spineFrames } from "../game/arc";
import { chooseRoute, portrait, load } from "../game/api";
import { Lightbox, Mark, Photo, Undeveloped } from "../ui/kit";

/**
 * THE SPINE — every chapter of the route, and the three ways it ends, on one
 * page, from turn one.
 *
 * This is lifted directly from Zero Escape, which put the whole branching
 * structure of a very complicated story on a flowchart and let you look at it
 * whenever you liked. That was treated as a spoiler risk at the time and it is
 * the opposite: a reader who can see the shape of what they are inside plays
 * with intent, and a reader who cannot is just clicking.
 *
 * What is drawn is a contact sheet rather than a flowchart, because the frames
 * are real — every chapter you have played has a photograph from it, and every
 * chapter you have not is an unexposed one with a title under it. You can see
 * that there are eight. You can see the two bad endings sitting at the bottom
 * next to the good one. You can see which one you are drifting toward, because
 * the door you took out of each chapter is printed between the frames.
 *
 * Chapters ahead show their TITLE and nothing else. Not the job, not the
 * endings' conditions. Enough to feel authored, not enough to play against.
 */
export default function Spine({ save, setSave, onPlay }: {
  save: Save; setSave: (s: Save) => void; onPlay: () => void;
}) {
  const arc = activeArc(save);
  const routes = Object.values(save.dating.routes);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (char_id: string) => {
    if (busy) return;
    setBusy(true);
    try { setSave(await chooseRoute(save.id, char_id) as Save); onPlay(); }
    finally { setBusy(false); }
  };

  if (!arc) return <RoutePicker save={save} setSave={setSave} routes={routes} busy={busy} onPick={pick} />;

  const frames = spineFrames(arc);
  return (
    <div className="scroll fade-top" style={{ height: "100%", padding: "74px 20px 60px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {routes.length > 1 && (
          <div style={{ display: "flex", gap: 6, marginBottom: 22, flexWrap: "wrap" }}>
            {routes.map((r) => (
              <button key={r.char_id} className="chip"
                data-on={r.char_id === arc.char_id ? "true" : "false"}
                style={r.char_id === arc.char_id ? undefined : { borderLeft: `2px solid ${ACCENT_HEX[r.accent]}` }}
                onClick={() => r.char_id !== arc.char_id && pick(r.char_id)}>
                {r.name}{r.state !== "running" ? ` · ${r.state}` : ""}
              </button>
            ))}
          </div>
        )}

        <div className="label label-accent" style={{ marginBottom: 8 }}>The spine</div>
        <h1 className="display" style={{ fontSize: 34, marginBottom: 6 }}>{arc.name}</h1>
        <p className="ui" style={{ color: "var(--ink-lo)", fontSize: 12.5, lineHeight: 1.6, maxWidth: 460, marginBottom: 30 }}>
          {arc.beats.length} chapters and three endings, fixed from the start. More turns will not
          buy you a better one — a chapter closes when it closes.
        </p>

        {frames.map(({ beat, state, door }, i) => (
          <motion.div key={beat.id}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(0.03 * i, 0.3), duration: 0.4 }}>
            <div style={{
              display: "flex", gap: 18, marginBottom: 16, alignItems: "flex-start",
              opacity: state === "ahead" ? 0.5 : state === "skipped" ? 0.32 : 1,
            }}>
              <div style={{ width: 80, flex: "none" }}>
                {beat.illustration
                  ? <Photo src={beat.illustration} ratio="4 / 5" tilt={i % 2 ? "r" : "l"}
                      onClick={() => setLightbox(beat.illustration!)} />
                  : <div className="photo" style={{ aspectRatio: "4 / 5" }}>
                      <Undeveloped />
                    </div>}
              </div>
              <div style={{
                flex: 1, minWidth: 0, paddingTop: 3,
                borderLeft: state === "here" ? "2px solid var(--accent)" : "none",
                paddingLeft: state === "here" ? 14 : 0,
              }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
                  <span className="label" style={{ color: state === "here" ? "var(--accent)" : undefined }}>
                    {String(beat.idx + 1).padStart(2, "0")}
                  </span>
                  {state === "here" && <span className="label label-accent">you are here</span>}
                  {state === "skipped" && <span className="label">skipped</span>}
                </div>
                <div className="display" style={{ fontSize: 19, lineHeight: 1.22, marginBottom: 5 }}>
                  {beat.title}
                </div>
                {state === "ahead" ? (
                  <div className="ui" style={{ fontSize: 12, color: "var(--ink-faint)", display: "flex", alignItems: "center", gap: 6 }}>
                    <Lock size={11} /> not yet
                  </div>
                ) : (
                  <>
                    <div className="ui" style={{ fontSize: 12, color: "var(--ink-lo)", marginBottom: 6 }}>
                      {beat.when}{beat.where ? ` · ${beat.where}` : ""}
                    </div>
                    {beat.caption && (
                      <div className="display-i" style={{ fontSize: 13.5, color: "var(--ink-lo)", marginBottom: 6 }}>
                        {beat.caption}
                      </div>
                    )}
                    {beat.opening && (
                      <div className="ui" style={{
                        fontSize: 12.5, color: "var(--ink-mid)", lineHeight: 1.55, marginBottom: 6,
                      }}>
                        {beat.opening.length > 190 ? `${beat.opening.slice(0, 189)}…` : beat.opening}
                      </div>
                    )}
                    {beat.outcome && (
                      <div className="ui" style={{ fontSize: 12.5, color: "var(--ink-mid)", fontStyle: "italic" }}>
                        {OUTCOME_WORD[beat.outcome]}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            {/* The door out of THIS chapter, printed on the line that leads to
                the next one. It reads as a connector because it is one. */}
            {door && (
              <div style={{
                margin: "-4px 0 16px 98px", paddingLeft: 16,
                borderLeft: "1px solid var(--rule)",
              }}>
                <div className="label" style={{ marginBottom: 2 }}>you chose</div>
                <div className="display-i" style={{ fontSize: 14.5, color: "var(--ink-mid)" }}>{door}</div>
              </div>
            )}
          </motion.div>
        ))}

        <div style={{ height: 1, background: "var(--rule-strong)", margin: "34px 0 26px" }} />
        <Mark accent>The three endings</Mark>
        <p className="ui" style={{ color: "var(--ink-lo)", fontSize: 12.5, lineHeight: 1.6, marginBottom: 20, maxWidth: 440 }}>
          All three were written for this person before you met them. Which one lands is measured off
          how she actually feels when the last chapter closes — not off which doors you picked.
        </p>
        <div style={{ display: "grid", gap: 10 }}>
          {arc.terminals.map((t) => {
            const landed = arc.state !== "running" && arc.ending_kind === t.kind;
            return (
              <div key={t.kind} className="well" style={{
                padding: "15px 16px",
                borderColor: landed ? "var(--accent)" : "var(--rule)",
                background: landed ? "var(--accent-soft)" : "var(--paper-2)",
              }}>
                <div className="label" style={{ color: landed ? "var(--accent)" : undefined, marginBottom: 6 }}>
                  {t.kind === "win" ? "if it works" : t.kind === "loss" ? "if it does not" : "the third one"}
                  {landed ? " · this is where you ended" : ""}
                </div>
                <div className="display" style={{ fontSize: 18, marginBottom: 5 }}>{t.title}</div>
                <div className="ui" style={{ fontSize: 13, lineHeight: 1.55, color: "var(--ink-mid)" }}>
                  {t.description}
                </div>
              </div>
            );
          })}
        </div>

        {arc.state === "running" && (
          <button className="btn btn-accent" style={{ marginTop: 30, width: "100%" }} onClick={onPlay}>
            Back to the scene
          </button>
        )}
      </div>
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}

/** Before a route is chosen. Four people, four colours, and the same question. */
function RoutePicker({ save, setSave, routes, busy, onPick }: {
  save: Save; setSave: (s: Save) => void; routes: Arc[]; busy: boolean; onPick: (id: string) => void;
}) {
  const [drawing, setDrawing] = useState<string | null>(null);
  const missing = routes.filter((r) => !save.characters[r.char_id]?.portrait_url);

  /* FACES ARE OPT-IN. Four portraits is four image calls and a minute of
     waiting, and charging somebody for that before they have decided whether
     they like the cast is the wrong way round. The frames say what they are
     until then. */
  const drawAll = async () => {
    for (const r of missing) {
      setDrawing(r.name);
      await portrait(save.id, r.char_id);
    }
    setDrawing(null);
    setSave(await load(save.id) as Save);
  };

  return (
    <div className="scroll fade-top" style={{ height: "100%", padding: "74px 20px 60px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div className="label label-accent" style={{ marginBottom: 10 }}>{save.world_bible.name}</div>
        <h1 className="display" style={{ fontSize: 36, marginBottom: 10 }}>Who are you going to try?</h1>
        <p className="ui" style={{ color: "var(--ink-mid)", fontSize: 13.5, lineHeight: 1.6, maxWidth: 470, marginBottom: 32 }}>
          They all live here. They know some of the same people, and what you do with one of them
          travels. You can change your mind later — the arcs keep their place.
        </p>
        {!!missing.length && (
          <div style={{ marginBottom: 20 }}>
            <button className="chip" onClick={drawAll} disabled={!!drawing}>
              {drawing ? `drawing ${drawing}…` : `draw ${missing.length === 1 ? "their face" : "their faces"}`}
            </button>
            <div className="ui" style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: 8, lineHeight: 1.55 }}>
              One image call each, on your key. You can also do it one at a time from a person's page.
            </div>
          </div>
        )}
        <div style={{ display: "grid", gap: 14 }}>
          {routes.map((r) => {
            const c = save.characters[r.char_id];
            return (
              <button key={r.char_id} className="well" disabled={busy} onClick={() => onPick(r.char_id)}
                style={{
                  padding: 0, textAlign: "left", display: "flex", gap: 16, overflow: "hidden",
                  borderLeft: `3px solid ${ACCENT_HEX[r.accent]}`, opacity: busy ? 0.5 : 1,
                }}>
                <div style={{ width: 104, flex: "none" }}>
                  {c?.portrait_url
                    ? <img src={c.portrait_url} alt="" style={{
                        width: "100%", height: "100%", objectFit: "cover", display: "block",
                        filter: "sepia(.12) saturate(.94) contrast(1.04)",
                      }} />
                    : <Undeveloped />}
                </div>
                <div style={{ padding: "16px 16px 16px 0", minWidth: 0 }}>
                  <div className="display" style={{ fontSize: 22, marginBottom: 4 }}>{r.name}</div>
                  <div className="label" style={{ marginBottom: 8 }}>
                    {c?.age} · {r.beats.length} chapters
                    {r.state !== "running" ? ` · ${r.state}` : ""}
                  </div>
                  <div className="ui" style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--ink-mid)" }}>
                    {(c?.background ?? r.brief).slice(0, 220)}
                    {(c?.background ?? r.brief).length > 220 ? "…" : ""}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
