import React, { useEffect, useState } from "react";
import { getApiKey, setApiKey } from "@weft/config";
import { DEFAULT_MODELS } from "@weft/engine/types";
import { settings as saveSettings, editSave, editHeat, load, setFallbackModel } from "../game/api";
import { type Save } from "../game/types";
import { EXPLICITNESS, type Explicitness } from "../game/appetite";
import { Field, Mark } from "../ui/kit";
import { ModelPicker } from "../ui/ModelPicker";

/**
 * STUDIO — the key, the four models, and how it looks.
 *
 * Kept deliberately short. Weft has an enormous tuning surface and almost all of
 * it is about running a world simulation cheaply; a dating game does not need
 * the player anywhere near the token budget or the context mode, and putting
 * those on this page would make it look like the same app in different colours.
 * What is here is what somebody actually changes: whose model writes the prose,
 * what the pictures look like, and whether they arrive on their own.
 */

const STYLES = [
  "35mm film, available light, grain, muted",
  "soft painterly, warm, low contrast",
  "cool documentary photography, natural skin",
  "high-contrast black and white, hard shadows",
  "90s anime cel, flat colour, heavy line",
];

export default function Studio({ save, setSave, onClose }: {
  save: Save | null; setSave: (s: Save) => void; onClose: () => void;
}) {
  const [key, setKey] = useState(getApiKey());
  const [saved, setSaved] = useState(false);
  const m = save?.model_settings ?? DEFAULT_MODELS;
  const [narr, setNarr] = useState(m.narrator_model);
  const [sim, setSim] = useState(m.simulator_model);
  const [img, setImg] = useState(m.image_model);
  const [art, setArt] = useState(save?.world_bible.art_direction ?? STYLES[0]);
  const [auto, setAuto] = useState(!!m.auto_illustrate);
  const [night, setNight] = useState(() => document.documentElement.getAttribute("data-mode") === "night");
  const [expl, setExpl] = useState<Explicitness>(save?.dating.heat.explicitness ?? "frank");
  const [alt, setAlt] = useState(save?.dating.fallback_model ?? "");
  const [limits, setLimits] = useState((save?.dating.heat.limits ?? []).join("\n"));

  useEffect(() => {
    document.documentElement.setAttribute("data-mode", night ? "night" : "day");
    localStorage.setItem("d101-mode", night ? "night" : "day");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", night ? "#14110f" : "#efe9df");
  }, [night]);

  const commit = async () => {
    setApiKey(key);
    if (save) {
      await saveSettings(save.id, {
        narrator_model: narr.trim() || DEFAULT_MODELS.narrator_model,
        simulator_model: sim.trim() || DEFAULT_MODELS.simulator_model,
        image_model: img.trim() || DEFAULT_MODELS.image_model,
        auto_illustrate: auto,
      });
      await editSave(save.id, { world_bible: { art_direction: art.trim() } });
      await setFallbackModel(save.id, alt);
      await editHeat(save.id, {
        explicitness: expl,
        limits: limits.split(/[\n,]/).map((x) => x.trim()).filter(Boolean),
      });
      setSave(await load(save.id) as Save);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  /* Measured, not inferred. The reader runs on every turn and records what it
     found; this is the share of the last dozen turns it flagged something on. */
  const log = (save?.dating.voice_log ?? []).slice(-12);
  const flagged = log.filter((l) => l.found > 0).length;

  return (
    <div className="scroll fade-top" style={{ height: "100%", padding: "74px 20px 60px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div className="label label-accent" style={{ marginBottom: 8 }}>Studio</div>
        <h1 className="display" style={{ fontSize: 32, marginBottom: 28 }}>Models and settings</h1>

        <Mark>The key</Mark>
        <Field label="OpenRouter key" value={key} onChange={setKey} type="password"
          placeholder="sk-or-v1-…"
          hint="Your key stays in this browser and only ever goes to openrouter.ai, because there's no server in this thing to keep it on. You can get one at openrouter.ai/keys." />

        <Mark>Who writes it</Mark>
        <ModelPicker label="Narrator — the prose" role="narrator" value={narr} onChange={setNarr} />
        <ModelPicker label="Bookkeeper — the world, and the small work" role="bookkeeper" value={sim} onChange={setSim} />
        <ModelPicker label="For anything the first one won't write" role="unfiltered" value={alt} onChange={setAlt} />
        <div className="ui" style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: -18, marginBottom: 26, lineHeight: 1.55 }}>
          Every prompt that could be turned down asks the model to answer with one word if it would
          rather not, instead of writing an apology or quietly leaving the substance out. When that
          word comes back, the same prompt goes here once. Leave it empty and a refusal stops and
          tells you, which is still better than a scene that went nowhere for no stated reason.
        </div>

        <Mark>How it looks</Mark>
        <ModelPicker label="Image model" role="image" value={img} onChange={setImg} />
        <Field label="Art direction" value={art} onChange={setArt}
          hint="You set this once and it applies to every picture the game draws." />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: -12, marginBottom: 26 }}>
          {STYLES.map((s) => (
            <button key={s} className="chip" data-on={art === s ? "true" : "false"}
              style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}
              onClick={() => setArt(s)}>{s}</button>
          ))}
        </div>
        <button className="chip" data-on={auto ? "true" : "false"} onClick={() => setAuto(!auto)}>
          {auto ? "◉" : "○"} draw every turn on its own
        </button>
        <div className="ui" style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: 8, lineHeight: 1.55 }}>
          A picture a message, arriving after the prose has committed so nothing waits on it. On the
          cloud path that is a few cents a turn, which is why it is off.
        </div>

        {save && (
          <div style={{ marginTop: 30 }}>
            <Mark accent>How far it goes</Mark>
            <div className="ui" style={{ fontSize: 11.5, color: "var(--ink-faint)", marginBottom: 14, lineHeight: 1.55 }}>
              Changeable mid-game — this is the one most people move once they have seen the register
              in practice. It changes the prose from the next turn on; nothing already written is
              rewritten.
            </div>
            <div style={{ display: "grid", gap: 7, marginBottom: 22 }}>
              {(Object.keys(EXPLICITNESS) as Explicitness[]).map((k) => (
                <button key={k} className="well" onClick={() => setExpl(k)}
                  style={{
                    padding: "11px 14px", textAlign: "left",
                    borderColor: expl === k ? "var(--accent)" : "var(--rule)",
                    background: expl === k ? "var(--accent-soft)" : "var(--paper-2)",
                  }}>
                  <div className="display" style={{ fontSize: 15.5 }}>{EXPLICITNESS[k].label}</div>
                  <div className="ui" style={{ color: "var(--ink-lo)", fontSize: 11.5, lineHeight: 1.5 }}>{EXPLICITNESS[k].note}</div>
                </button>
              ))}
            </div>
            <Field label="Never — one per line" rows={3} value={limits} onChange={setLimits}
              hint="This goes into every call the game makes, rather than being mentioned once when the world gets built — a rule set at the start is one the model has stopped noticing by turn forty. Everyone in the game is always an adult as well, and that part isn't adjustable." />
            {!!save.dating.heat.palette.length && (
              <div className="ui" style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: -14, marginBottom: 26, lineHeight: 1.6 }}>
                Palette set at casting: {save.dating.heat.palette.join(" · ")}. It seeded the cast and
                has done its job — change what anyone actually wants in their own editor.
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 30 }}>
          <Mark>The page</Mark>
          <button className="chip" data-on={night ? "true" : "false"} onClick={() => setNight(!night)}>
            {night ? "◉" : "○"} print it on black
          </button>
        </div>

        {save && (
          <div style={{ marginTop: 34 }}>
            <Mark>This run</Mark>
            <div className="ui" style={{ fontSize: 13, lineHeight: 1.7, color: "var(--ink-mid)" }}>
              Turn {save.world.current_turn} · {save.history.length} entries · {save.dating.keepsakes.length} pictures kept
              <br />
              {log.length === 0
                ? <>The voice reader hasn't seen a turn yet.</>
                : flagged === 0
                ? <>The voice reader has found nothing in the last {log.length} turns.</>
                : <>The voice reader flagged something on <strong>{flagged}</strong> of the last {log.length} turns, and each one was quoted back at the narrator on the turn after.</>}
            </div>
            {!!save.dating.last_faults?.length && (
              <div style={{ marginTop: 16 }}>
                <div className="label" style={{ marginBottom: 7 }}>from the last turn</div>
                <div style={{ display: "grid", gap: 10 }}>
                  {save.dating.last_faults.map((f, i) => (
                    <div key={i} style={{ paddingLeft: 12, borderLeft: "2px solid var(--accent-line)" }}>
                      <div className="prose" style={{ fontSize: 14, lineHeight: 1.5 }}>“{f.quote}”</div>
                      <div className="ui" style={{ fontSize: 11.5, color: "var(--ink-lo)", marginTop: 2 }}>{f.why}</div>
                    </div>
                  ))}
                </div>
                <div className="ui" style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: 10, lineHeight: 1.55 }}>
                  These are shown so you can tell whether the reader is being sensible. If it keeps
                  flagging writing you actually wanted, point it at a better model, or edit the rules
                  in src/game/tics.ts.
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 40 }}>
          <button className="btn btn-accent" onClick={commit} style={{ flex: 1 }}>
            {saved ? "saved" : "Save"}
          </button>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
