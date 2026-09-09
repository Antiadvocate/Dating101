import React from "react";

/** ── THE PHOTOGRAPH ──────────────────────────────────────────────────────────
 *
 *  Every generated image in the game goes through this component and nothing
 *  else is allowed to render an <img> of model output.
 *
 *  The reason is consistency, and it is the single biggest visual problem an
 *  AI-illustrated game has. Two pictures from the same prompt and the same
 *  model can come back in different styles, different palettes, different
 *  levels of finish; put them next to each other raw and the page looks like a
 *  mistake. A shared frame, a shared grade and a shared grain do not fix the
 *  pictures, but they make the SET look deliberate, which is the thing the eye
 *  is actually judging. It is the same trick a magazine plays with photographs
 *  from twenty different photographers. */
export function Photo({
  src, alt = "", caption, tilt, ratio = "4 / 5", className = "", onClick, priority,
}: {
  src?: string; alt?: string; caption?: string;
  tilt?: "l" | "r" | "none"; ratio?: string; className?: string;
  onClick?: () => void; priority?: boolean;
}) {
  const t = tilt === "l" ? "tipped" : tilt === "r" ? "tipped-r" : "";
  return (
    <figure className={className} style={{ margin: 0 }}>
      <div
        className={`photo ${t}`}
        style={{ aspectRatio: ratio, cursor: onClick ? "zoom-in" : undefined }}
        onClick={onClick}
      >
        {src
          ? <img src={src} alt={alt} loading={priority ? "eager" : "lazy"} />
          : <Undeveloped />}
      </div>
      {caption && <figcaption className="photo-cap">{caption}</figcaption>}
    </figure>
  );
}

/** A frame with nothing in it yet. Used for beats you have not reached, and for
 *  a picture that is still being drawn — an unexposed negative rather than a
 *  spinner, because a spinner is software and this is supposed to be an object. */
export function Undeveloped({ label }: { label?: string }) {
  return (
    <div style={{
      width: "100%", height: "100%", display: "grid", placeItems: "center",
      background: "var(--paper-2)",
      backgroundImage: "repeating-linear-gradient(135deg, transparent 0 11px, var(--rule) 11px 12px)",
    }}>
      {label && <span className="label" style={{ background: "var(--paper-2)", padding: "4px 8px" }}>{label}</span>}
    </div>
  );
}

/** A word sitting on a hairline. The section mark used everywhere. */
export function Mark({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <div className="rule-with-word" style={{ marginBottom: 14 }}>
      <span className={`label ${accent ? "label-accent" : ""}`}>{children}</span>
    </div>
  );
}

/** The small round-cornerless icon button in the title bar. */
export function IconMark({ on, title, onClick, children }: {
  on?: boolean; title: string; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button className="mark" data-on={on ? "true" : "false"} title={title} aria-label={title} onClick={onClick}>
      {children}
    </button>
  );
}

/** A labelled field. The label is above the rule, the value writes on it. */
export function Field({
  label, hint, value, onChange, placeholder, rows, autoFocus, type,
}: {
  label: string; hint?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; rows?: number; autoFocus?: boolean; type?: string;
}) {
  return (
    <label style={{ display: "block", marginBottom: 26 }}>
      <div className="label" style={{ marginBottom: 4 }}>{label}</div>
      {rows
        ? <textarea className="field" rows={rows} value={value} placeholder={placeholder}
            autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} />
        : <input className="field" type={type ?? "text"} value={value} placeholder={placeholder}
            autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} />}
      {hint && <div className="ui" style={{ color: "var(--ink-lo)", marginTop: 7, fontSize: 12, lineHeight: 1.55 }}>{hint}</div>}
    </label>
  );
}

/** A hairline that fills left to right. The only progress indicator in the game
 *  and it is never labelled with a number — see game/arc.ts on why the player
 *  should not be able to count turns. */
export function Fill({ at, tone = "accent" }: { at: number; tone?: "accent" | "ink" }) {
  return (
    <div style={{ height: 1, background: "var(--rule)", position: "relative" }}>
      <div style={{
        position: "absolute", inset: 0, right: `${(1 - Math.max(0, Math.min(1, at))) * 100}%`,
        background: tone === "accent" ? "var(--accent)" : "var(--ink)",
        transition: "right .6s cubic-bezier(.2,.7,.3,1)",
      }} />
    </div>
  );
}

/** Full-bleed image viewer. */
export function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 900, background: "rgba(12,9,7,.93)",
      display: "grid", placeItems: "center", padding: 24, cursor: "zoom-out",
    }}>
      <img src={src} alt="" style={{ maxWidth: "100%", maxHeight: "100%", boxShadow: "0 30px 90px -20px #000" }} />
    </div>
  );
}
