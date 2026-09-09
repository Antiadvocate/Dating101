import React, { useEffect, useState } from "react";
import { getApiKey, setApiKey } from "@weft/config";
import { DEFAULT_MODELS } from "@weft/engine/types";
import { settings as saveSettings, editSave, load } from "../game/api";
import { type Save } from "../game/types";
import { Field, Mark } from "../ui/kit";
import { ticRate } from "../game/tics";

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
      setSave(await load(save.id) as Save);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const rate = save ? ticRate(save.history) : 0;

  return (
    <div className="scroll fade-top" style={{ height: "100%", padding: "16px 20px 60px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div className="label label-accent" style={{ marginBottom: 8 }}>Studio</div>
        <h1 className="display" style={{ fontSize: 32, marginBottom: 28 }}>How it runs.</h1>

        <Mark>The key</Mark>
        <Field label="OpenRouter key" value={key} onChange={setKey} type="password"
          placeholder="sk-or-v1-…"
          hint="Stored in this browser and sent to openrouter.ai and nowhere else. There is no server here to keep it on. Get one at openrouter.ai/keys." />

        <Mark>Who writes it</Mark>
        <Field label="Narrator — the prose, and the whole cost" value={narr} onChange={setNarr}
          hint="The long creative call, once a turn. Everything you read comes from here." />
        <Field label="Bookkeeper — the world, and the small work" value={sim} onChange={setSim}
          hint="Strict JSON every turn, plus the chapter openings, the gate check and the doors. Wants a small fast model, not a clever one." />

        <Mark>How it looks</Mark>
        <Field label="Image model" value={img} onChange={setImg}
          hint="Portraits and scene pictures. Gemini's flash-image family accepts the portraits as references, so the cast stays recognisable between scenes." />
        <Field label="Art direction" value={art} onChange={setArt}
          hint="Set once, governs everything drawn." />
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
              {rate > 0
                ? <>Romance tics caught in the last dozen turns: <strong>{Math.round(rate * 100)}%</strong> of them. Each one is quoted back at the narrator on the following turn.</>
                : <>No romance tics in the last dozen turns.</>}
            </div>
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
