import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, ArrowRight, Plus, X } from "lucide-react";
import { DEFAULT_MODELS } from "@weft/engine/types";
import type { ClientSave } from "@weft/lib/api";
import { cast } from "../game/api";
import type { Brief, CastingInput } from "../game/casting";
import { ACCENT_HEX, ACCENT_NAMES, ROUTE_ACCENTS } from "../game/types";
import { Field, Mark } from "../ui/kit";

/**
 * CASTING — one question per page.
 *
 * The whole setup could fit on one scrolling form and it would be faster to
 * fill in and much worse. What the player types here is the entire story, and a
 * form treats it as configuration; a page with one question on it and a lot of
 * white space around it treats it as writing, and people write more. The
 * difference between three words and three sentences in the "describe them" box
 * is the difference between a stranger and a person, so every part of this
 * screen is arranged to get the longer answer.
 */

type Step = "you" | "them" | "register" | "shape";
const ORDER: Step[] = ["you", "them", "register", "shape"];

const REGISTERS = [
  "contemporary, adult, plainly written — nothing is softened",
  "slow and domestic, small stakes, genuinely funny in places",
  "explicit, unhurried, more interested in people than in acts",
  "sour and sharp — two people who are bad for each other",
  "romance under a horror premise; the dread is real and so is the romance",
  "hot, careless, and heading somewhere neither of you has admitted",
];

const BEAT_COUNTS = [
  { n: 6, label: "Six chapters", note: "A short route. Two or three evenings and a decision." },
  { n: 8, label: "Eight chapters", note: "The standard shape. Room for it to change direction twice." },
  { n: 10, label: "Ten chapters", note: "Long. The middle has space to go badly and recover." },
  { n: 12, label: "Twelve chapters", note: "A whole season. Expect to be at this for a while." },
];

export default function Casting({ onBack, onCast }: {
  onBack: () => void;
  onCast: (s: ClientSave) => void;
}) {
  const [step, setStep] = useState<Step>("you");
  const [yourName, setYourName] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [you, setYou] = useState("");
  const [briefs, setBriefs] = useState<Brief[]>([{ text: "", name: "" }]);
  const [register, setRegister] = useState("");
  const [setting, setSetting] = useState("");
  const [beats, setBeats] = useState(8);
  const [ground, setGround] = useState(false);
  const [model, setModel] = useState(DEFAULT_MODELS.forge_model);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState<string | null>(null);

  const idx = ORDER.indexOf(step);
  const filled = briefs.filter((b) => b.text.trim().length > 12);
  const canGo =
    step === "you" ? yourName.trim().length > 0 && you.trim().length > 12
    : step === "them" ? filled.length > 0
    : step === "register" ? register.trim().length > 3
    : true;

  const go = async () => {
    if (busy) return;
    setBusy(true); setError(null);
    const input: CastingInput = {
      you, your_name: yourName, your_pronouns: pronouns,
      briefs: filled, register, setting, beats, ground, model,
    };
    try {
      onCast(await cast(input, setPhase));
    } catch (e: any) {
      setError(e?.message ?? "casting failed");
      setBusy(false);
    }
  };

  if (busy) return <Forging phase={phase} names={filled.map((b) => b.name?.trim() || "…")} error={error} onBack={() => setBusy(false)} />;

  return (
    <div className="scroll fade-top" style={{ height: "100%", padding: "10px 22px 60px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0 26px" }}>
          <button className="chip" onClick={() => (idx === 0 ? onBack() : setStep(ORDER[idx - 1]))}>
            <ArrowLeft size={11} style={{ verticalAlign: -1, marginRight: 5 }} />
            {idx === 0 ? "shelf" : "back"}
          </button>
          <div className="label">{idx + 1} / {ORDER.length}</div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={step}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.32, ease: [0.2, 0.7, 0.3, 1] }}>

            {step === "you" && (
              <>
                <Head over="First" title="Who are you, this time?" />
                <p className="ui" style={{ color: "var(--ink-mid)", marginBottom: 30, maxWidth: 460, fontSize: 13.5, lineHeight: 1.6 }}>
                  Not a stat block. What you do all day, what you are bad at, why you are in this
                  town at all. Everyone you meet will read this and form an opinion.
                </p>
                <div style={{ display: "flex", gap: 20 }}>
                  <div style={{ flex: "1 1 60%" }}>
                    <Field label="Name" value={yourName} onChange={setYourName} placeholder="Ash Kovač" autoFocus />
                  </div>
                  <div style={{ flex: "1 1 40%" }}>
                    <Field label="Pronouns" value={pronouns} onChange={setPronouns} placeholder="he/him" />
                  </div>
                </div>
                <Field label="You" rows={7} value={you} onChange={setYou}
                  hint="Three or four sentences does more than twenty. Include one thing that is unflattering."
                  placeholder="Thirty-four. Moved back in March after the thing with the flat fell through, which I still describe as a landlord problem. I fix espresso machines, which is a real trade and pays like a hobby. I am good in a room full of strangers and terrible with anyone who already knows me." />
              </>
            )}

            {step === "them" && (
              <>
                <Head over="Second" title="Who are you here for?" />
                <p className="ui" style={{ color: "var(--ink-mid)", marginBottom: 26, maxWidth: 470, fontSize: 13.5, lineHeight: 1.6 }}>
                  Up to four. They will all live in the same town, know some of the same people, and
                  hear about each other — so describe them as people, not as options. Each one gets
                  their own arc, their own endings, and their own colour.
                </p>
                {briefs.map((b, i) => (
                  <div key={i} className="well" style={{ padding: "16px 16px 4px", marginBottom: 14, position: "relative" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <span style={{
                        width: 10, height: 10, borderRadius: "50%", flex: "none",
                        background: ACCENT_HEX[ROUTE_ACCENTS[i]],
                        boxShadow: "inset 0 0 0 1px rgba(0,0,0,.18)",
                      }} />
                      <span className="label">{ACCENT_NAMES[ROUTE_ACCENTS[i]]} route</span>
                      {briefs.length > 1 && (
                        <button className="mark" style={{ marginLeft: "auto", width: 26, height: 26 }}
                          title="remove" onClick={() => setBriefs(briefs.filter((_, n) => n !== i))}>
                          <X size={13} />
                        </button>
                      )}
                    </div>
                    <Field label="Name (optional)" value={b.name ?? ""}
                      onChange={(v) => setBriefs(briefs.map((x, n) => n === i ? { ...x, name: v } : x))}
                      placeholder="leave blank and the world will name them" />
                    <Field label="Them" rows={6} value={b.text}
                      onChange={(v) => setBriefs(briefs.map((x, n) => n === i ? { ...x, text: v } : x))}
                      hint={i === 0 ? "How they talk. What they do for money. What they are like when they are tired. What would make them walk out." : undefined}
                      placeholder="Runs the kitchen at a place that is better than it needs to be. Forty, divorced, funny in a way that lands about eighty percent of the time and she does not adjust for the twenty. Reads everything. Does not like being managed and can tell when it is happening. Her brother lives with her and it is not working." />
                  </div>
                ))}
                {briefs.length < 4 && (
                  <button className="chip" onClick={() => setBriefs([...briefs, { text: "", name: "" }])}>
                    <Plus size={11} style={{ verticalAlign: -1, marginRight: 5 }} /> another person
                  </button>
                )}
              </>
            )}

            {step === "register" && (
              <>
                <Head over="Third" title="What key is it written in?" />
                <p className="ui" style={{ color: "var(--ink-mid)", marginBottom: 26, maxWidth: 470, fontSize: 13.5, lineHeight: 1.6 }}>
                  This governs the prose, the world, and how far anything is allowed to go. It is
                  the one setting that changes everything downstream, so be specific and be honest
                  about what you actually want.
                </p>
                <Field label="Genre and register" rows={3} value={register} onChange={setRegister}
                  autoFocus
                  placeholder="explicit, unhurried, more interested in people than in acts" />
                <Mark>or start from</Mark>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {REGISTERS.map((r) => (
                    <button key={r} className="chip" data-on={register === r ? "true" : "false"}
                      style={{ textTransform: "none", letterSpacing: 0, fontSize: 12, fontWeight: 400, fontFamily: "var(--font-prose)" }}
                      onClick={() => setRegister(r)}>{r}</button>
                  ))}
                </div>
              </>
            )}

            {step === "shape" && (
              <>
                <Head over="Last" title="How long, and where?" />
                <Field label="Where this happens" rows={2} value={setting} onChange={setSetting}
                  hint="Leave it blank and the world builds somewhere plausible for the people you described."
                  placeholder="A harbour town in the off season. Everyone works two jobs and everyone knows everyone." />
                <Mark>Length</Mark>
                <div style={{ display: "grid", gap: 8, marginBottom: 28 }}>
                  {BEAT_COUNTS.map((b) => (
                    <button key={b.n} className="well" onClick={() => setBeats(b.n)}
                      style={{
                        padding: "13px 15px", textAlign: "left",
                        borderColor: beats === b.n ? "var(--accent)" : "var(--rule)",
                        background: beats === b.n ? "var(--accent-soft)" : "var(--paper-2)",
                      }}>
                      <div className="display" style={{ fontSize: 16, marginBottom: 2 }}>{b.label}</div>
                      <div className="ui" style={{ color: "var(--ink-lo)", fontSize: 12 }}>{b.note}</div>
                    </button>
                  ))}
                </div>
                <Mark>The forge</Mark>
                <Field label="Model that builds the world" value={model} onChange={setModel}
                  hint="One call, and it decides the quality of everything after it. Worth the good model even if you play on a cheap one." />
                <button className="chip" data-on={ground ? "true" : "false"} onClick={() => setGround(!ground)}>
                  {ground ? "◉" : "○"} ground it with a web search
                </button>
                <div className="ui" style={{ color: "var(--ink-lo)", fontSize: 12, marginTop: 8, lineHeight: 1.55, maxWidth: 440 }}>
                  For a real city, a real scene, a real job — the forge looks it up while building, so
                  the streets and the work are right. Costs a little more.
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {error && (
          <div className="well" style={{ padding: 14, marginTop: 24, borderColor: "rgba(168,69,47,.45)", color: "var(--bad)" }}>
            <div className="ui" style={{ fontSize: 13 }}>{error}</div>
          </div>
        )}

        <div style={{ marginTop: 40, display: "flex", justifyContent: "flex-end" }}>
          {step === "shape"
            ? <button className="btn btn-accent" onClick={go} disabled={!canGo}>Build it</button>
            : <button className="btn btn-ink" disabled={!canGo} onClick={() => setStep(ORDER[idx + 1])}>
                Next <ArrowRight size={13} style={{ marginLeft: 8, verticalAlign: -2 }} />
              </button>}
        </div>
      </div>
    </div>
  );
}

function Head({ over, title }: { over: string; title: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="label label-accent" style={{ marginBottom: 10 }}>{over}</div>
      <h1 className="display" style={{ fontSize: "clamp(30px, 6vw, 44px)", letterSpacing: "-0.02em" }}>{title}</h1>
    </div>
  );
}

/** The wait. A forge call takes a minute or more and the honest thing to do is
 *  say what is being built rather than spin a circle at somebody. */
function Forging({ phase, names, error, onBack }: {
  phase: string; names: string[]; error: string | null; onBack: () => void;
}) {
  return (
    <div style={{ height: "100%", display: "grid", placeItems: "center", padding: 30 }}>
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <div className="label label-accent" style={{ marginBottom: 16 }}>Casting</div>
        <h1 className="display" style={{ fontSize: 34, marginBottom: 22 }}>
          {names.filter((n) => n !== "…").join(", ") || "Four strangers"}
        </h1>
        <div className="ui breathe" style={{ color: "var(--ink-mid)", fontSize: 13.5, letterSpacing: ".02em" }}>
          {phase || "starting"}…
        </div>
        <p className="ui" style={{ color: "var(--ink-lo)", fontSize: 12, lineHeight: 1.65, marginTop: 26 }}>
          The town, ten places, everybody's history and how they talk, then one arc each with three
          endings apiece. Two calls, about a minute.
        </p>
        {error && (
          <>
            <div className="ui" style={{ color: "var(--bad)", marginTop: 22, fontSize: 13 }}>{error}</div>
            <button className="btn" style={{ marginTop: 16 }} onClick={onBack}>Back</button>
          </>
        )}
      </div>
    </div>
  );
}
