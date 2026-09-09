import React, { useEffect, useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { LOCAL_PREFIX, getLocalEndpoint } from "@weft/config";

/**
 * PICKING A MODEL.
 *
 * This was a text input, which is not a picker — it is a memory test. You had to
 * already know that the id is `anthropic/claude-opus-5` and not `claude-opus-5`
 * or `claude/opus-5`, and getting it wrong produced a forge that failed on the
 * first call with no way to tell a dead id from a bad key.
 *
 * But a searchable list of four hundred models is barely better, because the
 * question is never "which of these exist" — it is "which one should be doing
 * THIS job". The four slots want completely different things and the prices
 * differ by two orders of magnitude between them, so:
 *
 *   · Each slot opens with a short list of models that suit that role, with a
 *     line saying why, above the full list.
 *   · Every row prints what it costs per million tokens in and out. The narrator
 *     slot runs once a turn on a large prompt and is essentially the entire bill
 *     of a campaign; the bookkeeper runs on a small one; nothing in the app
 *     could tell you that before you picked.
 *   · Anything typed that looks like an id can be used directly, so a model that
 *     launched this morning is never locked out by this component.
 */

interface ORModel {
  id: string;
  name: string;
  created?: number;
  image?: boolean;
  local?: boolean;
  /** USD per million tokens. */
  in?: number;
  out?: number;
  ctx?: number;
}

export type Role = "forge" | "narrator" | "bookkeeper" | "image";

const ROLE_NOTE: Record<Role, string> = {
  forge: "One call, at the start, that decides the quality of everything after it. This is the slot to spend on.",
  narrator: "Once a turn, on a large prompt. This is the entire bill of a campaign — everything else is rounding.",
  bookkeeper: "Strict JSON on a small prompt, several times a turn. Wants fast and cheap, not clever.",
  image: "Portraits and scene pictures. The Gemini flash-image family takes the portraits as references, which is what keeps a face recognisable between scenes.",
};

/** Ids worth putting in front of somebody for each slot. Shown only when the
 *  live list confirms they exist, so this going stale degrades to an ordinary
 *  search rather than to a dead id offered as a recommendation. */
const SUGGESTED: Record<Role, { id: string; why: string }[]> = {
  forge: [
    { id: "anthropic/claude-opus-5", why: "Writes the most specific people. Worth it here even on a cheap campaign." },
    { id: "anthropic/claude-sonnet-5", why: "Most of the way there for a fraction of it." },
    { id: "google/gemini-2.5-pro", why: "Long context, holds a big seed together." },
    { id: "deepseek/deepseek-v4-pro", why: "Cheap for the quality, if the whole run is on a budget." },
  ],
  narrator: [
    { id: "deepseek/deepseek-v4-pro", why: "The value pick. Good prose, and cheap enough to run a long campaign on." },
    { id: "anthropic/claude-sonnet-5", why: "Better prose, several times the cost per turn." },
    { id: "anthropic/claude-opus-5", why: "The best of it, and a campaign here is genuinely expensive." },
    { id: "x-ai/grok-4", why: "Less prone to sanding the edges off an adult scene." },
  ],
  bookkeeper: [
    { id: "google/gemini-3.1-flash-lite", why: "Fast, cheap, reliable at strict JSON. The default for a reason." },
    { id: "google/gemini-2.0-flash-001", why: "The older one. Cheaper still." },
    { id: "anthropic/claude-haiku-4.5", why: "Better at holding a schema when the small models start dropping fields." },
  ],
  image: [
    { id: "google/gemini-2.5-flash-image", why: "Takes the portraits as reference images, so the cast stays recognisable." },
    { id: "black-forest-labs/flux-1.1-pro", why: "The best-looking single image. No reference input, so faces drift." },
    { id: "black-forest-labs/flux-1-schnell", why: "Fast and cheap enough to illustrate every turn." },
  ],
};

/**
 * WHAT THE PICKER OFFERS WHEN OPENROUTER CANNOT BE REACHED.
 *
 * Not a nicety. A browser extension, a corporate network, an offline laptop, or
 * OpenRouter having a bad afternoon all produce the same thing: a fetch that
 * fails, an empty list, and a picker that is worse than the text box it
 * replaced — because at least the text box let you type. Every id the picker
 * recommends is listed here so the recommendations survive the fetch failing,
 * and the search still works over them.
 *
 * These carry no prices, because a hardcoded price is a lie with a shelf life.
 * When the live list is up, its numbers replace all of this.
 *
 * A stale id here is a model slot that fails on its first call with no way to
 * tell a dead id from a bad key, so prune anything OpenRouter drops.
 */
const FALLBACK: ORModel[] = [
  { id: "anthropic/claude-opus-5", name: "Claude Opus 5" },
  { id: "anthropic/claude-sonnet-5", name: "Claude Sonnet 5" },
  { id: "anthropic/claude-opus-4.8", name: "Claude Opus 4.8" },
  { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5" },
  { id: "anthropic/claude-haiku-4.5", name: "Claude Haiku 4.5" },
  { id: "openai/gpt-5", name: "GPT-5" },
  { id: "openai/gpt-5-mini", name: "GPT-5 Mini" },
  { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro" },
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash" },
  { id: "google/gemini-3.1-flash-lite", name: "Gemini 3.1 Flash Lite" },
  { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash" },
  { id: "deepseek/deepseek-v4-pro", name: "DeepSeek V4 Pro" },
  { id: "deepseek/deepseek-r1", name: "DeepSeek R1" },
  { id: "x-ai/grok-4", name: "Grok 4" },
  { id: "meta-llama/llama-4-maverick", name: "Llama 4 Maverick" },
  { id: "qwen/qwen3-235b-a22b", name: "Qwen3 235B" },
  { id: "mistralai/mistral-large-2411", name: "Mistral Large" },
  { id: "google/gemini-2.5-flash-image", name: "Gemini 2.5 Flash Image", image: true },
  { id: "black-forest-labs/flux-1.1-pro", name: "FLUX 1.1 Pro", image: true },
  { id: "black-forest-labs/flux-1-schnell", name: "FLUX.1 Schnell", image: true },
  { id: "openai/gpt-image-1", name: "GPT Image 1", image: true },
];

let CACHE: ORModel[] | null = null;
let CACHE_AT = 0;

async function loadCloud(): Promise<ORModel[]> {
  if (CACHE && Date.now() - CACHE_AT < 1000 * 60 * 30) return CACHE;
  const res = await fetch("https://openrouter.ai/api/v1/models");
  if (!res.ok) throw new Error(`openrouter returned ${res.status}`);
  const j: any = await res.json();
  const list: ORModel[] = (j.data ?? []).map((m: any) => {
    const out: string[] = m.architecture?.output_modalities ?? [];
    const price = (v: unknown) => {
      const n = Number(v);
      return Number.isFinite(n) ? n * 1e6 : undefined;
    };
    return {
      id: String(m.id), name: String(m.name ?? m.id), created: m.created,
      image: out.includes("image"),
      in: price(m.pricing?.prompt), out: price(m.pricing?.completion),
      ctx: Number(m.context_length) || undefined,
    };
  }).filter((m: ORModel) => m.id);
  if (!list.length) throw new Error("openrouter returned an empty list");
  CACHE = list; CACHE_AT = Date.now();
  return list;
}

/** Whatever is loaded on the machine under the desk. KoboldCpp ignores the
 *  model field entirely, so `local/default` is always valid and is offered even
 *  when the listing call fails — a server can be up and still refuse a
 *  cross-origin GET, which says nothing about whether it will answer a POST. */
async function loadLocal(): Promise<ORModel[]> {
  const ep = getLocalEndpoint();
  if (!ep) return [];
  const anyLoaded: ORModel = { id: `${LOCAL_PREFIX}default`, name: "whatever is loaded", local: true };
  try {
    const res = await fetch(`${ep.url}/models`, {
      headers: ep.key ? { Authorization: `Bearer ${ep.key}` } : undefined,
    });
    if (!res.ok) throw new Error(String(res.status));
    const j: any = await res.json();
    const list: ORModel[] = (j.data ?? []).map((m: any) => {
      const raw = String(m.id ?? "").replace(/^koboldcpp\//, "");
      return { id: `${LOCAL_PREFIX}${raw}`, name: raw.split(/[\\/]/).pop() || raw, local: true };
    }).filter((m: ORModel) => m.id !== LOCAL_PREFIX);
    return list.length ? list : [anyLoaded];
  } catch { return [anyLoaded]; }
}

const money = (v?: number) =>
  v == null ? "" : v === 0 ? "free" : v < 1 ? `$${v.toFixed(2)}` : `$${v.toFixed(v < 10 ? 1 : 0)}`;

const looksLikeId = (s: string) => /^[\w.-]+\/[\w.:-]+$/.test(s.trim());

export function ModelPicker({ label, role, value, onChange }: {
  label: string; role: Role; value: string; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<ORModel[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const wantsImage = role === "image";

  useEffect(() => {
    if (!open || models) return;
    setErr(null);
    Promise.all([
      loadLocal(),
      loadCloud().catch((e) => { setErr(e?.message ?? "unreachable"); return FALLBACK; }),
    ]).then(([local, cloud]) => setModels([...local, ...cloud]));
  }, [open, models]);

  const pool = useMemo(
    () => (models ?? []).filter((m) => m.local || (wantsImage ? m.image : !m.image)),
    [models, wantsImage],
  );

  /* The recommendations render whether or not the live list came back. When it
     did, each row carries that model's real price and context; when it did not,
     the row is still there and still picks a working id — which is the whole
     reason the fallback exists. */
  const suggested = useMemo(() => {
    if (!models) return [];
    return SUGGESTED[role].map((s) => ({
      ...s,
      model: pool.find((m) => m.id === s.id)
        ?? FALLBACK.find((m) => m.id === s.id)
        ?? { id: s.id, name: s.id.split("/").pop() ?? s.id },
    }));
  }, [models, pool, role]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = [...pool].sort((a, b) =>
      (Number(!!b.local) - Number(!!a.local)) || (b.created ?? 0) - (a.created ?? 0));
    if (term) {
      list = list.filter((m) => m.id.toLowerCase().includes(term) || m.name.toLowerCase().includes(term));
    } else {
      // The recommended ones are already printed above under their own rule;
      // printing them again immediately underneath reads as a rendering bug.
      const shown = new Set(SUGGESTED[role].map((s) => s.id));
      list = list.filter((m) => !shown.has(m.id));
    }
    return list.slice(0, 80);
  }, [pool, q, role]);

  const current = pool.find((m) => m.id === value);

  return (
    <div style={{ marginBottom: 26 }}>
      <div className="label" style={{ marginBottom: 4 }}>{label}</div>
      <button
        onClick={() => { setOpen(true); setQ(""); }}
        aria-label={`Choose the ${label.toLowerCase()} model. Currently ${value || "unset"}.`}
        aria-haspopup="dialog"
        data-model-picker={role}
        style={{
          width: "100%", textAlign: "left", display: "flex", alignItems: "baseline", gap: 12,
          borderBottom: "1px solid var(--rule-strong)", padding: "8px 0 9px",
        }}>
        <span style={{
          flex: 1, minWidth: 0, fontFamily: "var(--font-prose)", fontSize: 16.5,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          color: value ? "var(--ink)" : "var(--ink-faint)",
          fontStyle: value ? undefined : "italic",
        }}>
          {value || "choose a model"}
        </span>
        <span className="label label-accent" style={{ flex: "none" }}>change</span>
      </button>
      <div className="ui" style={{ color: "var(--ink-lo)", marginTop: 7, fontSize: 12, lineHeight: 1.55 }}>
        {ROLE_NOTE[role]}
        {current?.in != null && (
          <> <span style={{ color: "var(--ink-faint)" }}>
            · {money(current.in)}/M in{current.out != null ? `, ${money(current.out)}/M out` : ""}
          </span></>
        )}
      </div>

      {open && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 800, background: "var(--paper)",
          display: "flex", flexDirection: "column",
          paddingTop: "env(safe-area-inset-top)",
        }}>
          <div className="center-page" style={{ padding: "26px 20px 12px", borderBottom: "1px solid var(--rule)", flex: "none" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div className="display" style={{ fontSize: 20 }}>{label}</div>
              <button className="mark" onClick={() => setOpen(false)} aria-label="close"><X size={17} /></button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, borderBottom: "1px solid var(--rule-strong)", paddingBottom: 7 }}>
              <Search size={14} style={{ color: "var(--ink-lo)", flex: "none" }} />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="search, or paste a model id"
                style={{
                  flex: 1, background: "transparent", border: "none", outline: "none",
                  fontFamily: "var(--font-prose)", fontSize: 16, color: "var(--ink)",
                }} />
            </div>
            <div className="ui" style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: 8, lineHeight: 1.5 }}>
              {!models ? "loading the live list…"
                : err ? `Could not reach OpenRouter (${err}) — showing a known-good short list. Prices are missing and a model released since this build will not be here, but you can paste any id.`
                : `${filtered.length} shown${pool.length > filtered.length ? ` of ${pool.length}` : ""} · newest first · prices per million tokens`}
            </div>
          </div>

          <div className="scroll center-page" style={{ flex: 1, minHeight: 0, padding: "8px 12px 40px" }}>
            {looksLikeId(q) && !pool.some((m) => m.id === q.trim()) && (
              <Row model={{ id: q.trim(), name: "use this id as typed" }} selected={false}
                onPick={() => { onChange(q.trim()); setOpen(false); }} />
            )}

            {!q.trim() && suggested.length > 0 && (
              <>
                <div className="rule-with-word" style={{ margin: "8px 8px 10px" }}>
                  <span className="label label-accent">for this slot</span>
                </div>
                {suggested.map((s) => (
                  <Row key={s.id} model={s.model} why={s.why} selected={s.model.id === value}
                    onPick={() => { onChange(s.model.id); setOpen(false); }} />
                ))}
                <div className="rule-with-word" style={{ margin: "20px 8px 10px" }}>
                  <span className="label">everything else</span>
                </div>
              </>
            )}

            {filtered.map((m) => (
              <Row key={m.id} model={m} selected={m.id === value}
                onPick={() => { onChange(m.id); setOpen(false); }} />
            ))}

            {models && !filtered.length && !looksLikeId(q) && (
              <div className="ui" style={{ padding: "30px 12px", textAlign: "center", color: "var(--ink-faint)", fontSize: 12.5, lineHeight: 1.6 }}>
                Nothing matches. Paste a full model id — <span style={{ fontFamily: "ui-monospace, monospace" }}>vendor/model-name</span> — to use it anyway.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ model, why, selected, onPick }: {
  model: ORModel; why?: string; selected: boolean; onPick: () => void;
}) {
  return (
    <button onClick={onPick}
      style={{
        width: "100%", textAlign: "left", padding: "11px 12px", display: "flex",
        gap: 12, alignItems: "flex-start",
        background: selected ? "var(--accent-soft)" : "transparent",
        borderLeft: `2px solid ${selected ? "var(--accent)" : "transparent"}`,
      }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
          {model.local && <span className="label label-accent" style={{ flex: "none" }}>local</span>}
          <span className="display" style={{
            fontSize: 16, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{model.name}</span>
        </div>
        <div className="ui" style={{
          fontSize: 11, color: "var(--ink-faint)", fontFamily: "ui-monospace, monospace",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1,
        }}>{model.id}</div>
        {why && (
          <div className="ui" style={{ fontSize: 12, color: "var(--ink-mid)", lineHeight: 1.5, marginTop: 4 }}>{why}</div>
        )}
        {(model.in != null || model.ctx) && (
          <div className="ui" style={{ fontSize: 11.5, color: "var(--ink-lo)", marginTop: 4 }}>
            {model.in != null && <>{money(model.in)}/M in{model.out != null ? ` · ${money(model.out)}/M out` : ""}</>}
            {model.ctx ? `${model.in != null ? " · " : ""}${Math.round(model.ctx / 1000)}k context` : ""}
          </div>
        )}
      </div>
      {selected && <Check size={15} style={{ color: "var(--accent)", flex: "none", marginTop: 4 }} />}
    </button>
  );
}
