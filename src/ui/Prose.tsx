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

/**
 * Who said it.
 *
 * Three passes, in falling order of confidence, and it gives up rather than
 * guess. A missing nameplate on a line of dialogue looks deliberate — plenty of
 * novels never attribute — while a WRONG one is the most damaging thing this
 * component could do, so the bar for printing a name is high.
 *
 *   1. A name or a first name inside the attribution tag right after the quote.
 *      "Anchovies," Vesna says.
 *   2. A subject pronoun in that tag which exactly one person in the scene
 *      uses. "Anchovies," she says — and she is the only she/her present. This
 *      is the one that matters, because narrators overwhelmingly write the
 *      pronoun rather than the name.
 *   3. Exactly one known name anywhere in the paragraph.
 */
function attribute(para: string, speakers: Speaker[]): string | null {
  const after = para.replace(/^[^"\u201c]*["\u201c][^"\u201d]*["\u201d]/, "");
  const tag = after.slice(0, 64);

  for (const s of speakers) {
    const forms = [s.name, firstName(s.name)];
    if (forms.some((f) => new RegExp(`\\b${esc(f)}\\b`).test(tag))) return firstName(s.name);
  }

  const pr = tag.toLowerCase().match(/\b(she|he|they)\b/);
  if (pr) {
    const owners = speakers.filter((s) => subjectPronoun(s.pronouns) === pr[1]);
    if (owners.length === 1) return firstName(owners[0].name);
  }

  const inPara = speakers.filter((s) =>
    new RegExp(`\\b${esc(firstName(s.name))}\\b`).test(para));
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
    () => text.split(/\n{1,}/).map((p) => p.trim()).filter(Boolean),
    [text],
  );
  let firstNarration = true;

  return (
    <div className={`prose ${className}`}>
      {paras.map((p, i) => {
        const last = i === paras.length - 1;
        if (OPEN_Q.test(p)) {
          const who = attribute(p, names);
          return (
            <p className="said" key={i}>
              {who && <span className="who">{who}</span>}
              {inline(p, String(i))}
              {streaming && last && <span className="caret" />}
            </p>
          );
        }
        const cap = dropcap && firstNarration && p.length > 60;
        if (cap) firstNarration = false;
        return (
          <p className={cap ? "dropcap" : undefined} key={i}>
            {inline(p, String(i))}
            {streaming && last && <span className="caret" />}
          </p>
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
