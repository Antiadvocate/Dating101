import React from "react";

/**
 * THE PAGE.
 *
 * Visual novels put text in a box across the bottom eighth of the screen. That
 * convention exists because the art above it is the point and the text is a
 * caption on it — and it is completely wrong here, because our text is the
 * expensive, generated, unrepeatable thing and the art is a decoration we
 * produce on demand.
 *
 * So this is closer to NVL mode, which the format has always used for long
 * narration: a reading column on paper, thirty-three ems wide, left aligned,
 * 1.66 line height. Those numbers are not taste; they are where every
 * readability study lands, and a text box eight lines tall physically cannot
 * honour them.
 *
 * The one place it borrows from ADV is DIALOGUE. Spoken paragraphs pull left
 * out of the column, take a rule in the speaker's colour and a small-caps name,
 * and set a point larger than the narration around them. The result is a page
 * where narration reads like a novel and dialogue reads like a play, and you
 * can tell which is which from across the room without reading a word — which
 * is exactly what a nameplate on a text box is for, achieved without a box.
 */

const OPEN_Q = /^\s*["\u201c]/;

export interface Speaker { name: string; pronouns?: string }

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const subjectPronoun = (p?: string) => (p ?? "").toLowerCase().split("/")[0].trim() || null;
const firstName = (n: string) => n.split(/\s+/)[0];

/** One run of a paragraph: either speech inside quotation marks, or the
 *  narration around it. */
export interface Segment { kind: "said" | "beat"; text: string }

/**
 * Cut a paragraph into speech and narration.
 *
 * This used to test the FIRST CHARACTER of a paragraph and send the whole thing
 * one way or the other, which got it wrong in both directions at once. A
 * paragraph opening with narration rendered its dialogue as narration, so the
 * quotes never got their own treatment; a paragraph opening with a quote
 * swallowed the trailing "she says it like she's letting you in on something"
 * into the dialogue block, so narration got set as speech. Narrators write
 * mixed paragraphs constantly, so both were happening on nearly every turn.
 *
 * Only double quotes are tracked, straight or curly. Apostrophes are left
 * alone, which is why "she's" and "I'm" survive.
 */
export function splitSpeech(para: string): Segment[] {
  const out: Segment[] = [];
  let buf = "";
  let open = false;
  const flush = (kind: Segment["kind"]) => {
    const text = buf.trim();
    if (text) out.push({ kind, text });
    buf = "";
  };
  for (const ch of para) {
    if (!open && (ch === '"' || ch === "\u201c")) {
      flush("beat");
      open = true;
      buf += ch;
      continue;
    }
    if (open && (ch === '"' || ch === "\u201d")) {
      buf += ch;
      flush("said");
      open = false;
      continue;
    }
    buf += ch;
  }
  // An unclosed quote runs to the end of the paragraph, which happens when a
  // speech continues past a line break.
  flush(open ? "said" : "beat");
  return coalesce(out);
}

/**
 * Put embedded quotes back where they came from.
 *
 * Not every pair of quotation marks is somebody speaking. "He said "hello" and
 * then the door shut" is one sentence, and lifting the middle of it into a
 * dialogue block cuts a sentence in half on the page for no reason.
 *
 * The tell is whether the run before it finished a sentence. Narration that
 * ends on a full stop is followed by a new line of speech; narration that
 * trails off mid-clause is still in the same sentence as whatever is quoted
 * next. Combined with a length test, since a long quotation after "she said" is
 * dialogue whatever the punctuation is doing.
 */
function coalesce(segs: Segment[]): Segment[] {
  // Each run was trimmed on the way out of the splitter, so rejoining needs a
  // space — except where the next run opens on punctuation, which is what a
  // sentence looks like after a quoted word is folded back into it.
  const join = (a: string, b: string) => (/^[,.;:!?)\]]/.test(b) ? `${a}${b}` : `${a} ${b}`);
  const out: Segment[] = [];
  for (const seg of segs) {
    const prev = out[out.length - 1];
    const embedded =
      seg.kind === "said" &&
      seg.text.length < 26 &&
      prev?.kind === "beat" &&
      !/[.!?:\u2014-]["\u201d)]?$/.test(prev.text);
    if (embedded) {
      prev.text = join(prev.text, seg.text);
      continue;
    }
    if (prev && prev.kind === seg.kind) {
      prev.text = join(prev.text, seg.text);
      continue;
    }
    out.push({ ...seg });
  }
  return out;
}

/**
 * Who said one particular line.
 *
 * Checked against the narration nearest the line rather than the paragraph as a
 * whole, because a paragraph often holds both people — the player asks
 * something, she answers, and attributing both to her would be worse than
 * attributing neither.
 *
 * Three passes, falling in confidence, and it gives up rather than guess. A
 * line with no nameplate looks deliberate, since plenty of novels never
 * attribute. A line with the WRONG name on it is the most damaging thing this
 * component could do.
 */
function attributeAt(segments: Segment[], idx: number, names: Speaker[]): string | null {
  const after = segments[idx + 1]?.kind === "beat" ? segments[idx + 1].text : "";
  const before = idx > 0 && segments[idx - 1].kind === "beat" ? segments[idx - 1].text : "";
  const tag = `${after.slice(0, 70)} ${before.slice(-70)}`;

  for (const s of names) {
    const forms = [s.name, firstName(s.name)];
    if (forms.some((f) => new RegExp(`\\b${esc(f)}\\b`).test(tag))) return firstName(s.name);
  }

  // "she says" is what narrators actually write, so a subject pronoun that only
  // one person present could own is the pass that carries most of the weight.
  const pr = tag.toLowerCase().match(/\b(she|he|they)\b/);
  if (pr) {
    const owners = names.filter((s) => subjectPronoun(s.pronouns) === pr[1]);
    if (owners.length === 1) return firstName(owners[0].name);
  }

  const whole = segments.map((s) => s.text).join(" ");
  const inPara = names.filter((s) => new RegExp(`\\b${esc(firstName(s.name))}\\b`).test(whole));
  return inPara.length === 1 ? firstName(inPara[0].name) : null;
}

/** *asterisks* are a private thought and never reach anybody in the room; the
 *  page should show that they are sealed. */
function inline(text: string, key: string): React.ReactNode {
  const parts = text.split(/(\*[^*]+\*)/g);
  return parts.map((p, i) =>
    /^\*[^*]+\*$/.test(p)
      ? <em key={`${key}-${i}`} className="thought">{p.slice(1, -1)}</em>
      : <React.Fragment key={`${key}-${i}`}>{p}</React.Fragment>);
}

export function Prose({
  text, names = [], dropcap, streaming, className = "",
}: {
  text: string;
  /** Everyone who could be speaking — the scene's cast, for attribution. */
  names?: Speaker[];
  dropcap?: boolean;
  streaming?: boolean;
  className?: string;
}) {
  const paras = React.useMemo(
    () => text.split(/\n{1,}/).map((s) => s.trim()).filter(Boolean).map(splitSpeech),
    [text],
  );
  let firstNarration = true;

  return (
    <div className={`prose ${className}`}>
      {paras.map((segments, pi) => {
        const lastPara = pi === paras.length - 1;

        // A paragraph of pure narration stays one paragraph, which is most of
        // them and the reason this does not turn every page into a script.
        if (segments.length === 1 && segments[0].kind === "beat") {
          const cap = dropcap && firstNarration && segments[0].text.length > 60;
          if (cap) firstNarration = false;
          return (
            <p className={cap ? "dropcap" : undefined} key={pi}>
              {inline(segments[0].text, `${pi}`)}
              {streaming && lastPara && <span className="caret" />}
            </p>
          );
        }

        let lastSpeaker: string | null = null;
        return (
          <div className="mixed" key={pi}>
            {segments.map((seg, si) => {
              const lastSeg = lastPara && si === segments.length - 1;
              if (seg.kind === "beat") {
                return (
                  <p className="beat" key={si}>
                    {inline(seg.text, `${pi}-${si}`)}
                    {streaming && lastSeg && <span className="caret" />}
                  </p>
                );
              }
              const who = attributeAt(segments, si, names);
              // The nameplate goes on the first line of a run and is dropped
              // while the same person keeps talking, so a paragraph where she
              // says four things is not stamped with her name four times.
              const show = who && who !== lastSpeaker ? who : null;
              lastSpeaker = who ?? lastSpeaker;
              return (
                <p className="said" key={si}>
                  {show && <span className="who">{show}</span>}
                  {inline(seg.text, `${pi}-${si}`)}
                  {streaming && lastSeg && <span className="caret" />}
                </p>
              );
            })}
          </div>
        );
      })}
      {streaming && !paras.length && <span className="caret" />}
    </div>
  );
}

/** The player's own turn, printed in the margin above the reply it produced.
 *  Small, set in the UI face rather than the prose face, so the page can always
 *  be read as: this is what you did, this is what happened. */
export function YourTurn({ text, mode }: { text: string; mode?: string }) {
  if (!text.trim()) return null;
  const verb = mode === "say" ? "you said" : mode === "think" ? "you thought" : mode === "story" ? "you wrote" : "you";
  return (
    <div style={{ margin: "34px 0 22px", maxWidth: "var(--measure)" }}>
      <div className="label" style={{ marginBottom: 5 }}>{verb}</div>
      <div style={{
        fontFamily: "var(--font-prose)", fontSize: 15.5, lineHeight: 1.55,
        color: "var(--ink-mid)", borderLeft: "1px solid var(--rule-strong)",
        paddingLeft: 14, fontStyle: mode === "think" ? "italic" : undefined,
      }}>
        {text}
      </div>
    </div>
  );
}
