import { useEffect, useRef, useState } from "react";
import "./App.css";

type Note = { id: string; text: string; x: number; y: number };
type Raw = Partial<Note> & { title?: string; body?: string };

const KEY = "notes";
const SIZE = 110; // circle diameter in px
const MAX = 60; // max symbols per note

function defaultPos(i: number) {
  return { x: 20 + (i % 3) * (SIZE + 20), y: 20 + Math.floor(i / 3) * (SIZE + 20) };
}

function loadNotes(): Note[] {
  try {
    const raw: Raw[] = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return raw.map((n, i) => ({
      id: n.id ?? crypto.randomUUID(),
      // migrate old notes that had a title and a body
      text: (typeof n.text === "string"
              ? n.text
              : [n.title, n.body].filter(Boolean).join(" ")
      ).slice(0, MAX),
      x: typeof n.x === "number" ? n.x : defaultPos(i).x,
      y: typeof n.y === "number" ? n.y : defaultPos(i).y,
    }));
  } catch {
    return [];
  }
}

export default function App() {
  const [notes, setNotes] = useState<Note[]>(loadNotes);
  // editing: null = closed, id = null means a brand new note
  const [editing, setEditing] = useState<{ id: string | null; text: string } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    id: string;
    startX: number;
    startY: number;
    noteX: number;
    noteY: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(notes));
  }, [notes]);

  function save() {
    if (!editing || !editing.text.trim()) return;
    const text = editing.text.trim().slice(0, MAX);
    if (editing.id === null) {
      const { x, y } = defaultPos(notes.length);
      setNotes([...notes, { id: crypto.randomUUID(), text, x, y }]);
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
    if (!d || !canvasRef.current) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < 5) return; // small movement = still a click
    d.moved = true;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.min(Math.max(0, d.noteX + dx), rect.width - SIZE);
    const y = Math.min(Math.max(0, d.noteY + dy), rect.height - SIZE);
    setNotes((prev) => prev.map((n) => (n.id === d.id ? { ...n, x, y } : n)));
  }

  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved) return;
    const note = notes.find((n) => n.id === d.id);
    if (note) setEditing({ id: note.id, text: note.text }); // it was a click
  }

  return (
      <div className="app">
        <div className="canvas" ref={canvasRef}>
          {notes.map((n) => (
              <div
                  key={n.id}
                  className="bubble"
                  style={{ left: n.x, top: n.y, width: SIZE, height: SIZE }}
                  onPointerDown={(e) => onPointerDown(e, n)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
              >
                {n.text}
              </div>
          ))}
        </div>

        <button className="fab" onClick={() => setEditing({ id: null, text: "" })} aria-label="New note">
          +
        </button>

        {editing && (
            <div className="overlay">
              <div className="panel">
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
            </div>
        )}
      </div>
  );
}