import { useEffect, useRef, useState } from "react";
import "./App.css";

type Note = { id: string; text: string; x: number; y: number };
type Raw = Partial<Note> & { title?: string; body?: string };
type Editing = { id: string | null; text: string; x: number; y: number };

const KEY = "notes";
const SIZE = 110; // circle diameter in px
const MAX = 60; // max symbols per note
const GAP = 20;
const PANEL_W = 280;
const PANEL_H = 190;

// slot 0 is taken by the "+" button, notes start from slot 1
function slotPos(i: number, cols: number) {
  return { x: GAP + (i % cols) * (SIZE + GAP), y: GAP + Math.floor(i / cols) * (SIZE + GAP) };
}

function loadNotes(): Note[] {
  try {
    const raw: Raw[] = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return raw.map((n, i) => ({
      id: n.id ?? crypto.randomUUID(),
      text: (typeof n.text === "string"
              ? n.text
              : [n.title, n.body].filter(Boolean).join(" ")
      ).slice(0, MAX),
      x: typeof n.x === "number" ? n.x : slotPos(i + 1, 3).x,
      y: typeof n.y === "number" ? n.y : slotPos(i + 1, 3).y,
    }));
  } catch {
    return [];
  }
}

export default function App() {
  const [notes, setNotes] = useState<Note[]>(loadNotes);
  const [editing, setEditing] = useState<Editing | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const drag = useRef<{
    id: string;
    startX: number;
    startY: number;
    noteX: number;
    noteY: number;
    moved: boolean;
  } | null>(null);

  // measure the board (in an effect, not during render)
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const update = () => setBoardSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(notes));
  }, [notes]);

  function startNew() {
    const cols = Math.max(1, Math.floor((boardSize.w - GAP) / (SIZE + GAP)));
    const { x, y } = slotPos(notes.length + 1, cols);
    setEditing({ id: null, text: "", x, y });
  }

  function save() {
    if (!editing || !editing.text.trim()) return;
    const text = editing.text.trim().slice(0, MAX);
    if (editing.id === null) {
      setNotes([...notes, { id: crypto.randomUUID(), text, x: editing.x, y: editing.y }]);
    } else {
      setNotes(notes.map((n) => (n.id === editing.id ? { ...n, text } : n)));
    }
    setEditing(null);
  }

  function remove() {
    if (editing?.id) setNotes(notes.filter((n) => n.id !== editing.id));
    setEditing(null);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>, note: Note) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      id: note.id,
      startX: e.clientX,
      startY: e.clientY,
      noteX: note.x,
      noteY: note.y,
      moved: false,
    };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < 5) return; // small movement = still a click
    d.moved = true;

    const x = Math.min(Math.max(0, d.noteX + dx), boardSize.w - SIZE);
    const y = Math.min(Math.max(0, d.noteY + dy), boardSize.h - SIZE);
    setNotes((prev) => prev.map((n) => (n.id === d.id ? { ...n, x, y } : n)));
  }

  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved) return;
    const note = notes.find((n) => n.id === d.id);
    if (note) setEditing({ id: note.id, text: note.text, x: note.x, y: note.y });
  }

  // editor card: below the note, or above it if there's no room
  let panelStyle: React.CSSProperties = {};
  if (editing) {
    const cw = boardSize.w;
    const ch = boardSize.h;
    const w = Math.min(PANEL_W, cw - 16);
    const left = Math.min(Math.max(8, editing.x + SIZE / 2 - w / 2), cw - w - 8);
    let top = editing.y + SIZE + 12;
    if (top + PANEL_H > ch - 8) top = Math.max(8, editing.y - PANEL_H - 12);
    panelStyle = { left, top, width: w, height: PANEL_H };
  }

  const isEditing = editing !== null;

  return (
      <div className="app">
        <div className="canvas" ref={canvasRef}>
          <button
              className={`add ${isEditing ? "dim" : ""}`}
              onClick={startNew}
              disabled={isEditing}
              aria-label="New note"
          />

          {notes.map((n) => {
            const active = editing?.id === n.id;
            return (
                <div
                    key={n.id}
                    className={`bubble ${active ? "active" : ""} ${isEditing && !active ? "dim" : ""}`}
                    style={{ left: n.x, top: n.y, width: SIZE, height: SIZE }}
                    onPointerDown={(e) => onPointerDown(e, n)}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                >
                  {active ? editing.text : n.text}
                </div>
            );
          })}

          {/* draft circle for a brand new note */}
          {editing && editing.id === null && (
              <div
                  className="bubble active draft"
                  style={{ left: editing.x, top: editing.y, width: SIZE, height: SIZE }}
              >
                {editing.text || "…"}
              </div>
          )}
        </div>

        {editing && (
            <div className="panel" style={panelStyle}>
          <textarea
              autoFocus
              value={editing.text}
              maxLength={MAX}
              placeholder="Write something..."
              onChange={(e) => setEditing({ ...editing, text: e.target.value })}
          />
              <div className="counter">
                {editing.text.length}/{MAX}
              </div>
              <div className="actions">
                <button className="primary" onClick={save} disabled={!editing.text.trim()}>
                  Save
                </button>
                <button onClick={() => setEditing(null)}>Cancel</button>
                {editing.id && (
                    <button className="danger" onClick={remove}>
                      Delete
                    </button>
                )}
              </div>
            </div>
        )}
      </div>
  );
}