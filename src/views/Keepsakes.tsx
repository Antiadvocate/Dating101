import React, { useState } from "react";
import { type Save } from "../game/types";
import { Lightbox, Photo } from "../ui/kit";

/**
 * KEEPSAKES — the album.
 *
 * A visual novel calls these CGs and treats them as the reward: a handful of
 * hand-painted images for the moments that matter, unlocked into a gallery.
 * Ours are generated on demand, so scarcity has to come from somewhere else —
 * it comes from you deciding a moment is worth a picture and pressing the
 * shutter. What you get at the end is not a completion grid with locked slots;
 * it is a shoebox of the evenings you thought were worth keeping, which is a
 * better object and closer to what the album is for.
 */
export default function Keepsakes({ save }: { save: Save }) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  const shots = [...save.dating.keepsakes].reverse();

  return (
    <div className="scroll fade-top" style={{ height: "100%", padding: "16px 20px 60px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div className="label label-accent" style={{ marginBottom: 8 }}>Keepsakes</div>
        <h1 className="display" style={{ fontSize: 32, marginBottom: 8 }}>
          {shots.length ? `${shots.length} kept` : "Nothing kept yet"}
        </h1>
        <p className="ui" style={{ color: "var(--ink-lo)", fontSize: 12.5, lineHeight: 1.6, maxWidth: 440, marginBottom: 32 }}>
          {shots.length
            ? "Every picture you took, with where and when it was."
            : "The camera in the composer draws whatever is happening right now. Nothing else fills this page — it only holds what you decided was worth keeping."}
        </p>

        <div style={{
          display: "grid", gap: 24,
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        }}>
          {shots.map((k, i) => (
            <Photo key={k.id} src={k.image} ratio="3 / 4" tilt={i % 3 === 0 ? "l" : i % 3 === 1 ? "r" : "none"}
              caption={`${k.caption || `chapter ${k.beat_idx + 1}`} · ${k.place || k.time}`}
              onClick={() => setLightbox(k.image)} />
          ))}
        </div>
      </div>
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}
