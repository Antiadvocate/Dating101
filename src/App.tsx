import React, { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { GitBranch, Images, Settings2, User, BookOpen } from "lucide-react";
import { hasApiKey, setApiKey } from "@weft/config";
import { load } from "./game/api";
import { activeArc, type Save } from "./game/types";
import Shelf from "./views/Shelf";
import Casting from "./views/Casting";
import Scene from "./views/Scene";
import Spine from "./views/Spine";
import Dossier from "./views/Dossier";
import Keepsakes from "./views/Keepsakes";
import Studio from "./views/Studio";
import { IconMark } from "./ui/kit";

type Mode = "shelf" | "casting" | "game";
type Tab = "scene" | "spine" | "her" | "album" | "studio";

/**
 * THE SHELL.
 *
 * Weft has six tabs across the bottom because it is an instrument and you are
 * reading its dials. This has one screen and four marks in the corner, because
 * it is a book and the rest is apparatus you occasionally want to check. The
 * scene is not a tab — it is where you are, and everything else closes back to
 * it.
 *
 * The one structural thing this file does is set `data-route` on the document,
 * which is what makes the entire interface change colour depending on who you
 * are with. Every accent in the app resolves through one custom property, so
 * switching route repaints the whole thing — the rules, the dialogue, the
 * doors, the drop caps — with no component knowing it happened.
 */
export default function App() {
  const [mode, setMode] = useState<Mode>("shelf");
  const [tab, setTab] = useState<Tab>("scene");
  const [save, setSave] = useState<Save | null>(null);
  const [needKey, setNeedKey] = useState(!hasApiKey());
  const [keyDraft, setKeyDraft] = useState("");

  const arc = save ? activeArc(save) : null;

  useEffect(() => {
    const m = localStorage.getItem("d101-mode") === "night" ? "night" : "day";
    document.documentElement.setAttribute("data-mode", m);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", m === "night" ? "#14110f" : "#efe9df");
  }, []);

  // THE COLOUR CHANGE. One attribute, and the whole interface belongs to her.
  useEffect(() => {
    document.documentElement.setAttribute("data-route", arc?.accent ?? "madder");
  }, [arc?.accent]);

  /* iOS puts the software keyboard over the layout because 100dvh does not know
     it exists, which slides the composer under the keys exactly when it matters.
     Size the shell to the visual viewport instead. */
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const apply = () => {
      document.documentElement.style.setProperty("--app-h", `${vv.height}px`);
      window.scrollTo(0, 0);
    };
    apply();
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    return () => { vv.removeEventListener("resize", apply); vv.removeEventListener("scroll", apply); };
  }, []);

  const open = useCallback(async (id: string) => {
    const s = await load(id) as Save;
    setSave(s);
    setMode("game");
    setTab(activeArc(s) ? "scene" : "spine");
  }, []);

  if (needKey) return <KeyGate value={keyDraft} onChange={setKeyDraft} onDone={() => { setApiKey(keyDraft); setNeedKey(false); }} />;

  const title = mode === "game" && arc ? arc.name
    : mode === "game" && save ? save.world_bible.name
    : mode === "casting" ? "Casting" : "Dating 101";

  return (
    <div className="shell">
      {mode === "game" && save && (
        <>
          <header style={{
            flex: "none", display: "flex", alignItems: "center", gap: 8,
            padding: "8px 14px 8px 20px",
          }}>
            <button onClick={() => { setSave(null); setMode("shelf"); }}
              style={{ minWidth: 0, textAlign: "left", flex: 1 }}>
              <div className="display" style={{ fontSize: 18, lineHeight: 1.1,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
              <div className="label" style={{ fontSize: 9.5 }}>{save.world_bible.name}</div>
            </button>
            <IconMark title="the spine" on={tab === "spine"} onClick={() => setTab(tab === "spine" ? "scene" : "spine")}>
              <GitBranch size={15} />
            </IconMark>
            <IconMark title="her" on={tab === "her"} onClick={() => setTab(tab === "her" ? "scene" : "her")}>
              <User size={15} />
            </IconMark>
            <IconMark title="keepsakes" on={tab === "album"} onClick={() => setTab(tab === "album" ? "scene" : "album")}>
              <Images size={15} />
            </IconMark>
            <IconMark title="studio" on={tab === "studio"} onClick={() => setTab(tab === "studio" ? "scene" : "studio")}>
              <Settings2 size={15} />
            </IconMark>
          </header>
          <div className="hairline" />
        </>
      )}

      <main style={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden" }}>
        <AnimatePresence mode="wait">
          <motion.div key={mode === "game" ? tab : mode}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{ position: "absolute", inset: 0 }}>
            {mode === "shelf" && <Shelf onOpen={open} onNew={() => setMode("casting")} />}
            {mode === "casting" && (
              <Casting onBack={() => setMode("shelf")}
                onCast={(s) => { setSave(s as Save); setMode("game"); setTab("spine"); }} />
            )}
            {mode === "game" && save && (
              <>
                {tab === "scene" && arc && (
                  <Scene save={save} setSave={setSave} onOpenSpine={() => setTab("spine")} />
                )}
                {(tab === "spine" || (tab === "scene" && !arc)) && (
                  <Spine save={save} setSave={setSave} onPlay={() => setTab("scene")} />
                )}
                {tab === "her" && <Dossier save={save} setSave={setSave} />}
                {tab === "album" && <Keepsakes save={save} />}
                {tab === "studio" && <Studio save={save} setSave={setSave} onClose={() => setTab("scene")} />}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

/** The door. One field, and an honest explanation of where the key goes. */
function KeyGate({ value, onChange, onDone }: {
  value: string; onChange: (v: string) => void; onDone: () => void;
}) {
  return (
    <div className="shell" style={{ display: "grid", placeItems: "center", padding: 28 }}>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }} style={{ maxWidth: 400, width: "100%" }}>
        <div className="label label-accent" style={{ marginBottom: 12 }}>Dating 101</div>
        <h1 className="display" style={{ fontSize: 34, lineHeight: 1.06, marginBottom: 16 }}>
          It runs on <span className="display-i">your</span> key.
        </h1>
        <p className="ui" style={{ color: "var(--ink-mid)", fontSize: 13.5, lineHeight: 1.65, marginBottom: 26 }}>
          There is no server here. The whole game is this page, your browser, and whatever model you
          point it at. The key is kept in this browser only and goes to openrouter.ai and nowhere
          else — grab one at openrouter.ai/keys.
        </p>
        <input className="field" type="password" autoFocus placeholder="sk-or-v1-…"
          value={value} onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && value.trim() && onDone()} />
        <button className="btn btn-accent" style={{ width: "100%", marginTop: 24 }}
          disabled={!value.trim()} onClick={onDone}>
          <BookOpen size={13} style={{ verticalAlign: -2, marginRight: 8 }} /> Begin
        </button>
      </motion.div>
    </div>
  );
}
