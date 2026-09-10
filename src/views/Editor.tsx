import React, { useMemo, useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import type { Identity } from "@weft/engine/types";
import { editAppetites, editCharacter, editEdge, load, weft } from "../game/api";
import { type Save } from "../game/types";
import { ageWasRaised, emptyAppetites, KINK_GROUPS, type Appetites } from "../game/appetite";
import { Field, Mark } from "../ui/kit";

/**
 * THE EDITOR — every field on a person, reachable and writable.
 *
 * This is not a debug screen. The forge writes a first draft of somebody out of
 * a paragraph you typed, and it will get things wrong — the voice will be a
 * shade off, the job will be the wrong job, the thing you actually wanted will
 * have been sanded into something safer. The difference between a game you play
 * once and one you keep is whether you can reach in and fix that on turn three
 * instead of rerolling the whole town.
 *
 * Two fields are load-bearing in ways that are not obvious from looking at them,
 * so they carry warnings:
 *
 *   AGE is stored a dozen times — as a number here, and as PROSE in the
 *   background, in life history, in everyone's memories, in edge notes, in
 *   canon. Changing the number alone leaves the whole cast still saying the old
 *   one, and a sentence is a far louder instruction to a model than a field.
 *   Weft has a reconciliation pass for exactly this and the save goes through
 *   it; it reports what it changed and what it deliberately left alone.
 *
 *   VOICE gets rewritten by three separate automatic passes — the periodic
 *   re-forge, trait consolidation, and per-turn drift. All three are useful on a
 *   character the engine wrote and all three are vandalism on one you sat down
 *   and wrote yourself. The lock switch stops every one of them.
 */

const list = (v: string[] | undefined) => (v ?? []).join("\n");
const unlist = (s: string) => s.split(/\n/).map((x) => x.trim()).filter(Boolean);
const csv = (v: string[] | undefined) => (v ?? []).join(", ");
const uncsv = (s: string) => s.split(/,/).map((x) => x.trim()).filter(Boolean);

type Tab = "who" | "looks" | "voice" | "desire" | "between" | "raw";

const TABS: { id: Tab; label: string }[] = [
  { id: "who", label: "Who" },
  { id: "looks", label: "Looks" },
  { id: "voice", label: "Voice" },
  { id: "desire", label: "Desire" },
  { id: "between", label: "Between you" },
  { id: "raw", label: "Raw" },
];

export default function Editor({ save, setSave, charId, onBack }: {
  save: Save; setSave: (s: Save) => void; charId: string; onBack: () => void;
}) {
  const c = save.characters[charId] as Identity | undefined;
  const app = save.dating.appetites[charId] ?? emptyAppetites();
  const edge = save.world.edges.find((e) => e.from === charId && e.to === "char_player");

  const [tab, setTab] = useState<Tab>("who");
  const [d, setD] = useState(() => ({
    name: c?.name ?? "", age: String(c?.age ?? 27), pronouns: c?.pronouns ?? "",
    background: c?.background ?? "", life_history: c?.life_history ?? "",
    core_traits: list(c?.core_traits), values: list(c?.values), texture: list(c?.texture),
    appearance_facts: c?.appearance_facts ?? "", appearance_now: c?.appearance_now ?? "",
    visual_signature: c?.visual_signature ?? "", beauty: String(c?.beauty ?? 50),
    speech_pattern: c?.speech_pattern ?? "",
    v_diction: c?.voice?.diction ?? "", v_syntax: c?.voice?.syntax ?? "", v_rhythm: c?.voice?.rhythm ?? "",
    v_agenda: c?.voice?.agenda ?? "", v_tics: list(c?.voice?.tics),
    v_never: list(c?.voice?.never_says), v_examples: list(c?.voice?.example_lines),
    attracted_to: c?.attracted_to ?? "", taste: c?.taste ?? "",
    a_into: list(app.into), a_curious: list(app.curious), a_limits: list(app.limits),
    a_unsaid: app.unsaid ?? "", a_register: app.register ?? "",
    e_warmth: String(edge?.warmth ?? 0), e_trust: String(edge?.trust ?? 0),
    e_attraction: String(edge?.attraction ?? 0), e_roles: csv(edge?.roles), e_notes: edge?.notes ?? "",
  }));
  const [locked, setLocked] = useState(!!c?.voice_locked);
  const [unsaidFound, setUnsaidFound] = useState(!!app.unsaid_found);
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const set = (k: keyof typeof d) => (v: string) => setD((p) => ({ ...p, [k]: v }));
  const ageWarn = useMemo(() => ageWasRaised(d.age), [d.age]);

  const commit = async () => {
    if (busy || !c) return;
    setBusy(true); setNotice(null);
    try {
      const { notice: n } = await editCharacter(save.id, charId, {
        name: d.name.trim() || c.name,
        age: Number(d.age),
        pronouns: d.pronouns.trim() || undefined,
        background: d.background, life_history: d.life_history || undefined,
        core_traits: unlist(d.core_traits), values: unlist(d.values), texture: unlist(d.texture),
        appearance_facts: d.appearance_facts, appearance_now: d.appearance_now || undefined,
        visual_signature: d.visual_signature || undefined,
        beauty: Math.max(0, Math.min(100, Number(d.beauty) || 50)),
        speech_pattern: d.speech_pattern,
        voice_locked: locked,
        voice: {
          ...c.voice,
          diction: d.v_diction || undefined, syntax: d.v_syntax || undefined,
          rhythm: d.v_rhythm || undefined, agenda: d.v_agenda || undefined,
          tics: unlist(d.v_tics), never_says: unlist(d.v_never), example_lines: unlist(d.v_examples),
        },
        attracted_to: d.attracted_to.trim() || undefined,
        taste: d.taste.trim() || undefined,
      });
      await editAppetites(save.id, charId, {
        into: unlist(d.a_into), curious: unlist(d.a_curious), limits: unlist(d.a_limits),
        unsaid: d.a_unsaid.trim() || undefined, register: d.a_register.trim() || undefined,
        unsaid_found: unsaidFound,
      } as Partial<Appetites>);
      await editEdge(save.id, charId, {
        warmth: Number(d.e_warmth), trust: Number(d.e_trust), attraction: Number(d.e_attraction),
        roles: uncsv(d.e_roles), notes: d.e_notes,
      });
      setSave(await load(save.id) as Save);
      if (n) setNotice(n);
      setSaved(true); setTimeout(() => setSaved(false), 1800);
    } catch (e: any) {
      setNotice(e?.message ?? "that did not save");
    } finally { setBusy(false); }
  };

  const loadRaw = async () => setRaw(JSON.stringify(await weft.getCharacterRaw(save.id, charId), null, 2));
  const saveRaw = async () => {
    setBusy(true); setNotice(null);
    try {
      await weft.rawEditCharacter(save.id, charId, JSON.parse(raw));
      setSave(await load(save.id) as Save);
      setNotice("written");
    } catch (e: any) { setNotice(e?.message ?? "that JSON did not parse"); }
    finally { setBusy(false); }
  };

  if (!c) return null;

  return (
    <div className="scroll fade-top" style={{ height: "100%", padding: "50px 20px 60px" }}>
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <button className="chip" onClick={onBack} style={{ marginBottom: 20 }}>
          <ArrowLeft size={11} style={{ verticalAlign: -1, marginRight: 5 }} /> back
        </button>
        <div className="label label-accent" style={{ marginBottom: 8 }}>Editing</div>
        <h1 className="display" style={{ fontSize: 32, marginBottom: 22 }}>{c.name}</h1>

        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 28 }}>
          {TABS.map((x) => (
            <button key={x.id} className="chip" data-on={tab === x.id ? "true" : "false"}
              onClick={() => { setTab(x.id); if (x.id === "raw" && !raw) void loadRaw(); }}>
              {x.label}
            </button>
          ))}
        </div>

        {tab === "who" && (
          <>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
              <div style={{ flex: "2 1 200px" }}><Field label="Name" value={d.name} onChange={set("name")} /></div>
              <div style={{ flex: "1 1 90px" }}><Field label="Age" value={d.age} onChange={set("age")} /></div>
              <div style={{ flex: "1 1 120px" }}><Field label="Pronouns" value={d.pronouns} onChange={set("pronouns")} /></div>
            </div>
            {ageWarn && (
              <div className="well" style={{ padding: 12, marginTop: -14, marginBottom: 22, borderColor: "var(--accent)" }}>
                <div className="ui" style={{ fontSize: 12.5, lineHeight: 1.55 }}>
                  Everyone in this game is an adult. This will be saved as 18.
                </div>
              </div>
            )}
            <div className="ui" style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: -16, marginBottom: 26, lineHeight: 1.55 }}>
              Changing the age also rewrites the present-tense copies of it in her background, in
              everyone's memories, and in the edge notes — otherwise the cast goes on saying the old
              number, and a sentence beats a field every time. Statements about the past are left alone.
            </div>
            <Field label="Background — who she is apart from the story" rows={7} value={d.background} onChange={set("background")}
              hint="Nothing in the game ever rewrites this, so whatever you put here stays the way you wrote it." />
            <Field label="Life history — what has happened in play" rows={4} value={d.life_history} onChange={set("life_history")}
              hint="This builds up as you play, and gets compressed once it runs long. You can edit it or clear it out entirely without breaking anything." />
            <Field label="Core traits — one per line" rows={4} value={d.core_traits} onChange={set("core_traits")} />
            <Field label="Values — one per line" rows={3} value={d.values} onChange={set("values")} />
            <Field label="Texture — small standing things, one per line" rows={4} value={d.texture} onChange={set("texture")}
              hint="Small things that come up when a scene has room for them — a bird she watches for, an argument she keeps having about a road. They shouldn't ever be what a scene is about." />
          </>
        )}

        {tab === "looks" && (
          <>
            <Field label="Appearance — the constants" rows={5} value={d.appearance_facts} onChange={set("appearance_facts")}
              hint="Her face, hair, eyes, build, and one thing you'd pick her out by. Leave clothes out of it, since those go in the field below. Nothing gets added here except permanent physical changes." />
            <Field label="Right now — clothes, state, visible condition" rows={3} value={d.appearance_now} onChange={set("appearance_now")}
              hint="The engine rewrites this as the story changes what she's wearing or what shape she's in." />
            <Field label="Beauty (0–100)" value={d.beauty} onChange={set("beauty")}
              hint="Roughly how she reads to a stranger at a glance, before anything else about her registers. Around 50 is ordinary and 75 or over turns heads. Each character's own taste gets applied on top of this." />
            <Field label="Image words" rows={3} value={d.visual_signature} onChange={set("visual_signature")}
              hint="The words that produced her portrait, reused unchanged in every scene picture so her face stays recognisable. This only matters if you're generating images locally." />
          </>
        )}

        {tab === "voice" && (
          <>
            <button className="chip" data-on={locked ? "true" : "false"} onClick={() => setLocked(!locked)}
              style={{ marginBottom: 10 }}>
              {locked ? "◉" : "○"} lock this voice
            </button>
            <div className="ui" style={{ fontSize: 11.5, color: "var(--ink-faint)", marginBottom: 24, lineHeight: 1.55 }}>
              Three separate passes rewrite how somebody sounds — the periodic re-forge, trait
              consolidation, and per-turn drift. All three are useful on a character the engine wrote
              and all three are vandalism on one you wrote. Locking stops every one of them.
            </div>
            <Field label="Speech pattern" rows={3} value={d.speech_pattern} onChange={set("speech_pattern")} />
            <Field label="Diction — the words she has" rows={2} value={d.v_diction} onChange={set("v_diction")} />
            <Field label="Syntax — how her sentences are built" rows={2} value={d.v_syntax} onChange={set("v_syntax")} />
            <Field label="Rhythm — how her talking moves" rows={2} value={d.v_rhythm} onChange={set("v_rhythm")} />
            <Field label="Agenda — what she is angling for under the words" rows={2} value={d.v_agenda} onChange={set("v_agenda")} />
            <Field label="Tics — one per line, used sparingly" rows={2} value={d.v_tics} onChange={set("v_tics")} />
            <Field label="Never says — one per line" rows={3} value={d.v_never} onChange={set("v_never")}
              hint="Put things she genuinely couldn't say here, rather than things she'd be too guarded to say. Somebody who works other people says sorry and please constantly and means none of it, so listing those would take her tools away and leave you with a plain bully. The engine checks her dialogue against this and corrects the narrator when something slips through." />
            <Field label="Example lines — one per line" rows={4} value={d.v_examples} onChange={set("v_examples")}
              hint="The narrator copies these fairly closely, so if a line here could have come from anybody, she'll start sounding like anybody." />
          </>
        )}

        {tab === "desire" && (
          <>
            <Field label="Attracted to" value={d.attracted_to} onChange={set("attracted_to")}
              hint="Who this person is capable of wanting at all — women, men, anyone, or nobody. The engine treats it as a hard limit rather than a leaning, so it won't get overridden by how well things are going." />
            <Field label="Taste — what her history trained her to find attractive" rows={3} value={d.taste} onChange={set("taste")}
              hint="What her life trained her to find attractive, which isn't something she decided on and isn't the same as who she likes." />

            <Mark accent>Appetites</Mark>
            <Field label="Into — what she wants and would say so" rows={5} value={d.a_into} onChange={set("a_into")} />
            <Field label="Curious — has not, would try" rows={3} value={d.a_curious} onChange={set("a_curious")} />
            <Field label="How she is about it" rows={3} value={d.a_register} onChange={set("a_register")}
              hint="How she is about it, rather than what she does — whether she talks the whole way through, whether she laughs, whether she can ask for anything directly. Two people can want exactly the same things and still be nothing alike, and this is where that shows up." />
            <Field label="The unsaid thing" rows={3} value={d.a_unsaid} onChange={set("a_unsaid")}
              hint="Something she wants but won't bring up herself. The narrator isn't told what it is, so it can only come out if a scene gets somewhere that would make a person risk saying it." />
            <button className="chip" data-on={unsaidFound ? "true" : "false"} onClick={() => setUnsaidFound(!unsaidFound)}
              style={{ marginTop: -14, marginBottom: 26 }}>
              {unsaidFound ? "◉" : "○"} it has surfaced
            </button>
            <Field label="Limits — will not, ever" rows={4} value={d.a_limits} onChange={set("a_limits")}
              hint="She'll refuse these outright, and the refusal plays as a scene rather than as the game blocking you. Try to put at least one of them near something she does want, otherwise the limit isn't costing her anything to hold." />

            <Mark>Common tags</Mark>
            <div className="ui" style={{ fontSize: 11.5, color: "var(--ink-faint)", marginBottom: 12, lineHeight: 1.55 }}>
              Tap to append to the into list. Then rewrite it into her version of it — the tag is a
              checkbox, the sentence is a character.
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {KINK_GROUPS.flatMap((g) => g.tags).map((tag) => (
                <button key={tag} className="chip"
                  style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400, fontSize: 11 }}
                  onClick={() => setD((p) => ({ ...p, a_into: p.a_into ? `${p.a_into}\n${tag}` : tag }))}>
                  {tag}
                </button>
              ))}
            </div>
          </>
        )}

        {tab === "between" && (
          <>
            <div className="ui" style={{ fontSize: 12.5, color: "var(--ink-mid)", marginBottom: 24, lineHeight: 1.6 }}>
              What she feels toward you. These are the numbers the whole game is played for and
              everything you read is derived from them, so setting one by hand is the bluntest cheat
              in here — and the fastest way to see what a scene looks like at a temperature you have
              not reached yet.
            </div>
            <Field label="Warmth (−100…100) — liking" value={d.e_warmth} onChange={set("e_warmth")} />
            <Field label="Wanting (−100…100) — desire, which is not liking" value={d.e_attraction} onChange={set("e_attraction")}
              hint="If you raise this, the ceiling on it goes up too. Otherwise the engine pulls it back down over the next few turns toward whatever her first impression of you was." />
            <Field label="Trust (−100…100)" value={d.e_trust} onChange={set("e_trust")} />
            <Field label="Roles — comma separated" value={d.e_roles} onChange={set("e_roles")}
              hint="These get tracked as facts, and somebody can easily be two things at once — boss and girlfriend, or older sister and rival." />
            <Field label="Note — the last thing recorded between you" rows={3} value={d.e_notes} onChange={set("e_notes")} />
          </>
        )}

        {tab === "raw" && (
          <>
            <div className="ui" style={{ fontSize: 12.5, color: "var(--ink-mid)", marginBottom: 16, lineHeight: 1.6 }}>
              Identity, condition, traits and memory as stored. Nothing validates what you put here
              beyond it being JSON, which is the point of it being here.
            </div>
            <textarea className="field" rows={22} value={raw} onChange={(e) => setRaw(e.target.value)}
              style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, lineHeight: 1.5 }} />
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button className="btn" onClick={loadRaw} disabled={busy}>Reload</button>
              <button className="btn btn-ink" onClick={saveRaw} disabled={busy || !raw.trim()}>Write it</button>
            </div>
          </>
        )}

        {notice && (
          <div className="well" style={{ padding: 14, marginTop: 24 }}>
            <div className="ui" style={{ fontSize: 12.5, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{notice}</div>
          </div>
        )}

        {tab !== "raw" && (
          <button className="btn btn-accent" style={{ width: "100%", marginTop: 36 }} onClick={commit} disabled={busy}>
            {saved ? <><Check size={13} style={{ verticalAlign: -2, marginRight: 8 }} /> saved</> : busy ? "saving…" : "Save"}
          </button>
        )}
      </div>
    </div>
  );
}
