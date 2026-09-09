import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Plus, Trash2 } from "lucide-react";
import { shelf, remove, type Shelf as Row } from "../game/api";
import { ACCENT_HEX, type RouteAccent } from "../game/types";

/** THE SHELF — where the saves live. Deliberately not a grid of thumbnails: a
 *  row here is a spine of a book, with the person's name on it in their colour
 *  and how far in you are. */
export default function Shelf({ onOpen, onNew }: { onOpen: (id: string) => void; onNew: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const reload = () => shelf().then(setRows).catch(() => setRows([]));
  useEffect(() => { reload(); }, []);

  return (
    <div className="scroll fade-top" style={{ height: "100%", padding: "24px 20px 60px" }}>
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <div className="label label-accent" style={{ marginBottom: 12 }}>Dating 101</div>
        <h1 className="display" style={{ fontSize: "clamp(34px, 8vw, 52px)", lineHeight: 1.02, marginBottom: 14 }}>
          Somebody you<br /><span className="display-i">have not met yet.</span>
        </h1>
        <p className="ui" style={{ color: "var(--ink-mid)", fontSize: 13.5, lineHeight: 1.65, maxWidth: 440, marginBottom: 34 }}>
          Describe the people you want, and the town they live in gets built around them — their
          histories, how they talk, what they are doing on a Tuesday. Then you have to actually
          talk to them.
        </p>

        <button className="btn btn-accent" onClick={onNew} style={{ width: "100%", marginBottom: 34 }}>
          <Plus size={13} style={{ verticalAlign: -2, marginRight: 8 }} /> Start casting
        </button>

        {rows === null && <div className="ui breathe" style={{ color: "var(--ink-lo)", fontSize: 12.5 }}>looking…</div>}

        {rows?.length ? (
          <>
            <div className="rule-with-word" style={{ marginBottom: 16 }}>
              <span className="label">On the shelf</span>
            </div>
            <div style={{ display: "grid", gap: 2 }}>
              {rows.map((r, i) => (
                <motion.div key={r.id}
                  initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.04 * i, duration: 0.3 }}
                  style={{ display: "flex", alignItems: "stretch" }}>
                  <button onClick={() => onOpen(r.id)} style={{
                    flex: 1, textAlign: "left", padding: "14px 14px 14px 16px",
                    borderLeft: `3px solid ${ACCENT_HEX[(r.accent as RouteAccent)] ?? "#b03a48"}`,
                    borderBottom: "1px solid var(--rule)", minWidth: 0,
                  }}>
                    <div className="display" style={{ fontSize: 19, marginBottom: 3 }}>{r.who || r.name}</div>
                    <div className="ui" style={{ fontSize: 11.5, color: "var(--ink-lo)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.chapter} · turn {r.turn}
                      {r.state !== "running" && r.state !== "unstarted" ? ` · ${r.state}` : ""}
                    </div>
                  </button>
                  <button className="mark" title="delete" style={{ height: "auto", borderBottom: "1px solid var(--rule)" }}
                    onClick={async () => {
                      if (!confirm(`Delete ${r.who || r.name}? This cannot be undone.`)) return;
                      await remove(r.id); reload();
                    }}>
                    <Trash2 size={13} />
                  </button>
                </motion.div>
              ))}
            </div>
          </>
        ) : rows ? (
          <div className="ui" style={{ color: "var(--ink-faint)", fontSize: 12.5, fontStyle: "italic" }}>
            Nothing here yet.
          </div>
        ) : null}
      </div>
    </div>
  );
}
