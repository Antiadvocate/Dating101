import React, { useState } from "react";
import { Camera } from "lucide-react";
import { activeArc, type Save } from "../game/types";
import { coldRead, readOf } from "../game/read";
import { portrait, load } from "../game/api";
import { Lightbox, Mark, Photo } from "../ui/kit";

/**
 * HER — what you actually know, and what you are guessing.
 *
 * The organising rule of this page is the line between the two. Everything in
 * the top half is observable: her face, what she is wearing, what she has told
 * you (Weft keeps a verified fact ledger with the source quote, so "she is from
 * Split" is on this page only if somebody actually said it), and the read.
 *
 * Everything behind THE COLD READ is not. That flip shows the simulation: the
 * three raw numbers, the ceiling on how far wanting can be lifted, and — the
 * one that is genuinely a spoiler and genuinely the best thing in here — the
 * concrete thing she privately believes about you that is not true.
 *
 * It is hidden by default and it stays hidden by default forever, because a
 * player who opens it once is playing a different, worse game from that point
 * on. It exists because it is her private state and the player paid for the
 * tokens that produced it, and hiding somebody's own save from them to protect
 * an experience they did not ask to have protected is not a decision this app
 * gets to make.
 */
export default function Dossier({ save, setSave }: { save: Save; setSave: (s: Save) => void }) {
  const arc = activeArc(save);
  const [cold, setCold] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  if (!arc) return null;

  const her = save.characters[arc.char_id];
  const mem = save.memory[arc.char_id];
  const cond = save.condition[arc.char_id];
  const traits = save.traits[arc.char_id] ?? [];
  const read = readOf(save, arc.char_id);
  const mind = save.minds?.[arc.char_id]?.about.find((b) => b.target === "char_player");
  const facts = (save.memory["char_player"]?.facts ?? []).filter((f) => !f.superseded_by);

  const draw = async () => {
    setDrawing(true);
    try { await portrait(save.id, arc.char_id); setSave(await load(save.id) as Save); }
    finally { setDrawing(false); }
  };

  return (
    <div className="scroll fade-top" style={{ height: "100%", padding: "16px 20px 60px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>

        <div style={{ display: "flex", gap: 22, flexWrap: "wrap", marginBottom: 34 }}>
          <div style={{ width: 210, flex: "none" }}>
            <Photo src={her?.portrait_url} ratio="4 / 5" tilt="l" priority
              onClick={her?.portrait_url ? () => setLightbox(her.portrait_url!) : undefined} />
            <button className="chip" style={{ marginTop: 10 }} onClick={draw} disabled={drawing}>
              <Camera size={11} style={{ verticalAlign: -1, marginRight: 5 }} />
              {drawing ? "drawing…" : her?.portrait_url ? "another take" : "draw her"}
            </button>
          </div>
          <div style={{ flex: "1 1 260px", minWidth: 240 }}>
            <h1 className="display" style={{ fontSize: 38, lineHeight: 1.05, marginBottom: 6 }}>{her?.name}</h1>
            <div className="label" style={{ marginBottom: 18 }}>
              {her?.age} · {her?.pronouns ?? "they/them"}
              {her?.location ? ` · ${save.world.places[her.location]?.name ?? ""}` : ""}
            </div>
            <div className="prose" style={{ fontSize: 15.5 }}>{read.line}</div>
            {read.caution && (
              <div style={{ marginTop: 16, paddingLeft: 13, borderLeft: "2px solid var(--accent-line)" }}>
                <div className="ui" style={{ fontSize: 12.5, lineHeight: 1.55 }}>{read.caution}</div>
              </div>
            )}
          </div>
        </div>

        <Mark>Right now</Mark>
        <div style={{ display: "grid", gap: 14, marginBottom: 34 }}>
          {read.facets.map((f) => (
            <div key={f.label} style={{ display: "flex", gap: 14, alignItems: "baseline" }}>
              <div className="label" style={{ width: 120, flex: "none" }}>{f.label}</div>
              <div className="ui" style={{ fontSize: 13, lineHeight: 1.55, color: "var(--ink-mid)" }}>{f.line}</div>
            </div>
          ))}
          {her?.appearance_now && (
            <div style={{ display: "flex", gap: 14, alignItems: "baseline" }}>
              <div className="label" style={{ width: 120, flex: "none" }}>Wearing</div>
              <div className="ui" style={{ fontSize: 13, lineHeight: 1.55, color: "var(--ink-mid)" }}>{her.appearance_now}</div>
            </div>
          )}
          {!!cond?.conditions?.length && (
            <div style={{ display: "flex", gap: 14, alignItems: "baseline" }}>
              <div className="label" style={{ width: 120, flex: "none" }}>State</div>
              <div className="ui" style={{ fontSize: 13, lineHeight: 1.55, color: "var(--ink-mid)" }}>
                {cond.conditions.join(", ")}{cond.fatigue !== "fresh" ? `, ${cond.fatigue}` : ""}
              </div>
            </div>
          )}
        </div>

        <Mark>Who she is</Mark>
        <div className="prose" style={{ fontSize: 15, marginBottom: 20 }}>{her?.background}</div>
        {!!her?.texture?.length && (
          <div className="ui" style={{ fontSize: 12.5, color: "var(--ink-lo)", marginBottom: 30, lineHeight: 1.6 }}>
            {her.texture.join(" · ")}
          </div>
        )}

        {/* WHAT SHE HAS TOLD YOU. Only facts the engine verified against the
            actual prose, with the line that produced them. This is the page's
            best answer to "did she say that or did I imagine it". */}
        {!!(mem?.facts?.length) && (
          <>
            <Mark>Things she has told you</Mark>
            <div style={{ display: "grid", gap: 12, marginBottom: 32 }}>
              {(mem.facts ?? []).filter((f) => !f.superseded_by).slice(-10).reverse().map((f, i) => (
                <div key={i}>
                  <div className="prose" style={{ fontSize: 14.5, lineHeight: 1.5 }}>{f.content}</div>
                  {f.quote && (
                    <div className="ui" style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: 3, fontStyle: "italic" }}>
                      “{f.quote}”
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {!!traits.length && (
          <>
            <Mark>What she has become</Mark>
            <div style={{ display: "grid", gap: 10, marginBottom: 32 }}>
              {traits.slice(-6).reverse().map((t) => (
                <div key={t.id}>
                  <div className="display" style={{ fontSize: 15.5 }}>{t.label}</div>
                  <div className="ui" style={{ fontSize: 12.5, color: "var(--ink-lo)", lineHeight: 1.5 }}>
                    {t.origin}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {!!facts.length && (
          <>
            <Mark>What she knows about you</Mark>
            <div className="ui" style={{ fontSize: 13, lineHeight: 1.7, color: "var(--ink-mid)", marginBottom: 32 }}>
              {facts.slice(-8).map((f) => f.content).join(" · ")}
            </div>
          </>
        )}

        {/* ── THE COLD READ ─────────────────────────────────────────────── */}
        <div style={{ height: 1, background: "var(--rule-strong)", margin: "10px 0 22px" }} />
        <button className="chip" data-on={cold ? "true" : "false"} onClick={() => setCold(!cold)}>
          {cold ? "◉" : "○"} the cold read
        </button>
        <div className="ui" style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: 8, lineHeight: 1.55, maxWidth: 420 }}>
          The simulation underneath — her actual numbers, and what she privately has wrong about you.
          It is your save and you can look. You will not be able to unsee it.
        </div>

        {cold && (
          <div className="well rise" style={{ padding: 18, marginTop: 18 }}>
            <div style={{ display: "grid", gap: 9, marginBottom: mind ? 22 : 0 }}>
              {coldRead(save, arc.char_id).map((row) => (
                <div key={row.label} style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                  <div className="ui" style={{ flex: 1, fontSize: 12.5, color: "var(--ink-mid)" }}>{row.label}</div>
                  <div className="display" style={{ fontSize: 17, fontVariantNumeric: "tabular-nums" }}>{row.value}</div>
                  <div className="label" style={{ width: 74, textAlign: "right" }}>{row.of}</div>
                </div>
              ))}
            </div>
            {mind && (
              <>
                <div className="label label-accent" style={{ marginBottom: 8 }}>What she thinks you feel</div>
                <div className="ui" style={{ fontSize: 13, lineHeight: 1.6, color: "var(--ink-mid)", marginBottom: mind.held_false ? 16 : 0 }}>
                  She reads you as {mind.predicted_stance}, and expects you feel about {Math.round(mind.predicted_warmth)}
                  {" "}toward her — against what you actually do. Confidence {Math.round(mind.confidence * 100)}%.
                </div>
                {mind.held_false && (
                  <>
                    <div className="label label-accent" style={{ marginBottom: 6 }}>And this, which is not true</div>
                    <div className="prose" style={{ fontSize: 15 }}>{mind.held_false}</div>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}
