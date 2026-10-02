import { useEffect, useRef, useState } from "react";
import "./App.css";

type Note = { id: string; text: string; x: number; y: number; createdDay: number };
type Raw = Partial<Note> & { title?: string; body?: string };
type Editing = { id: string | null; text: string; x: number; y: number };
type Drag = {
  id: string;
  startX: number;
  startY: number;
  noteX: number;
  noteY: number;
  size: number;
  moved: boolean;
};

const KEY = "notes";
const BASE = 110; // starting circle diameter in px
const MAX = 60; // max symbols per note
const GAP = 20;
const PANEL_W = 280;
const PANEL_H = 190;

const GROW_DAYS = 30; // days until a note is fully grown
const GROW_PX = 60; // extra px at full growth
const HUE_START = 225; // blue
const HUE_SHIFT = 120; // blue -> pink over GROW_DAYS

// --- days helpers (a "day" = whole days since 1970, timezone safe) ---
const DAY_MS = 86400000;
const now = new Date();
const TODAY = Math.round(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS);
let endYear = now.getFullYear();
if (Math.round(Date.UTC(endYear, 10, 1) / DAY_MS) <= TODAY) endYear += 1;
const TOTAL_DAYS = Math.round(Date.UTC(endYear, 10, 1) / DAY_MS) - TODAY; // today -> Nov 1

function dayLabel(day: number) {
  return new Date(day * DAY_MS).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function growth(note: Note, currentDay: number) {
  const age = Math.max(0, currentDay - note.createdDay);
  const t = Math.min(age, GROW_DAYS) / GROW_DAYS;
  return {
    size: Math.round(BASE + t * GROW_PX),
    hue: Math.round(HUE_START + t * HUE_SHIFT),
    font: 0.75 + t * 0.2,
  };
}

// slot 0 is taken by the "+" button, notes start from slot 1
function slotPos(i: number, cols: number) {
  return { x: GAP + (i % cols) * (BASE + GAP), y: GAP + Math.floor(i / cols) * (BASE + GAP) };
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
      createdDay: typeof n.createdDay === "number" ? n.createdDay : TODAY,
    }));
  } catch {
    return [];
  }
}

export default function App() {
  const [notes, setNotes] = useState<Note[]>(loadNotes);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [offset, setOffset] = useState(0); // simulated days from today
  const canvasRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const drag = useRef<Drag | null>(null);

  const currentDay = TODAY + offset;

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
    const cols = Math.max(1, Math.floor((boardSize.w - GAP) / (BASE + GAP)));
    const { x, y } = slotPos(notes.length + 1, cols);
    setEditing({ id: null, text: "", x, y });
  }

  function save() {
    if (!editing || !editing.text.trim()) return;
    const text = editing.text.trim().slice(0, MAX);
    if (editing.id === null) {
      setNotes([
        ...notes,
        { id: crypto.randomUUID(), text, x: editing.x, y: editing.y, createdDay: currentDay },
      ]);
    } else {
      setNotes(notes.map((n) => (n.id === editing.id ? { ...n, text } : n)));
    }
    setEditing(null);
  }

  function remove() {
    if (editing?.id) setNotes(notes.filter((n) => n.id !== editing.id));
    setEditing(null);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>, note: Note, size: number) {
    if (editing) return; // no dragging while editing
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      id: note.id,
      startX: e.clientX,
      startY: e.clientY,
      noteX: note.x,
      noteY: note.y,
      size,
      moved: false,
    };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < 5) return; // small movement = still a click
    if (!d.moved) setDragId(d.id);
    d.moved = true;

    const x = Math.min(Math.max(0, d.noteX + dx), Math.max(0, boardSize.w - d.size));
    const y = Math.min(Math.max(0, d.noteY + dy), Math.max(0, boardSize.h - d.size));
    setNotes((prev) => prev.map((n) => (n.id === d.id ? { ...n, x, y } : n)));
  }

  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    setDragId(null);
    if (!d || d.moved) return;
    const note = notes.find((n) => n.id === d.id);
    if (note) setEditing({ id: note.id, text: note.text, x: note.x, y: note.y });
  }

  // size of the note being edited (for positioning the card)
  const editedNote = editing?.id ? notes.find((n) => n.id === editing.id) : undefined;
  const editingSize = editedNote ? growth(editedNote, currentDay).size : BASE;

  // editor card: below the note, or above it if there's no room
  let panelStyle: React.CSSProperties = {};
  if (editing) {
    const cw = boardSize.w;
    const ch = boardSize.h;
    const w = Math.min(PANEL_W, cw - 16);
    const left = Math.min(Math.max(8, editing.x + editingSize / 2 - w / 2), cw - w - 8);
    let top = editing.y + editingSize + 12;
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
            const g = growth(n, currentDay);
            const active = editing?.id === n.id;
            const classes = [
              "bubble",
              active ? "active" : "",
              dragId === n.id ? "dragging" : "",
              isEditing && !active ? "dim" : "",
            ].join(" ");
            return (
                <div
                    key={n.id}
                    className={classes}
                    style={
                      {
                        left: n.x,
                        top: n.y,
                        width: g.size,
                        height: g.size,
                        fontSize: `${g.font}rem`,
                        "--h": g.hue,
                      } as React.CSSProperties
                    }
                    onPointerDown={(e) => onPointerDown(e, n, g.size)}
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
                  style={
                    {
                      left: editing.x,
                      top: editing.y,
                      width: BASE,
                      height: BASE,
                      "--h": HUE_START,
                    } as React.CSSProperties
                  }
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

        {/* imaginary timeline */}
        <div className="timeline">
          <div className="timeline-top">
            <span className="timeline-date">{dayLabel(currentDay)}</span>
            <span className="timeline-hint">
            {offset === 0 ? "Today" : `+${offset} day${offset === 1 ? "" : "s"}`}
          </span>
          </div>
          <input
              type="range"
              min={0}
              max={TOTAL_DAYS}
              step={1}
              value={offset}
              onChange={(e) => setOffset(Number(e.target.value))}
          />
          <div className="timeline-ends">
            <span>{dayLabel(TODAY)}</span>
            <span>{dayLabel(TODAY + TOTAL_DAYS)}</span>
          </div>
        </div>
      </div>
  );
}