import { useEffect, useRef, useState } from "react";
import "./App.css";

type Note = {
  id: string;
  title: string;
  body: string;
  updatedAt: number;
  x: number;
  y: number;
};

const KEY = "notes";
const SIZE = 100; // circle diameter in px

function defaultPos(i: number) {
  return { x: 20 + (i % 3) * (SIZE + 20), y: 20 + Math.floor(i / 3) * (SIZE + 20) };
}

function loadNotes(): Note[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    // old notes saved before dragging existed get a starting position
    return raw.map((n: Note, i: number) => ({
      ...n,
      x: typeof n.x === "number" ? n.x : defaultPos(i).x,
      y: typeof n.y === "number" ? n.y : defaultPos(i).y,
    }));
  } catch {
    return [];
  }
}

export default function App() {
  const [notes, setNotes] = useState<Note[]>(loadNotes);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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

  const selected = notes.find((n) => n.id === selectedId);

  function addNote() {
    const { x, y } = defaultPos(notes.length);
    const note: Note = {
      id: crypto.randomUUID(),
      title: "",
      body: "",
      updatedAt: Date.now(),
      x,
      y,
    };
    setNotes([...notes, note]);
    setSelectedId(note.id);
  }

  function updateNote(id: string, changes: Partial<Pick<Note, "title" | "body">>) {
    setNotes(notes.map((n) => (n.id === id ? { ...n, ...changes, updatedAt: Date.now() } : n)));
  }

  function deleteNote(id: string) {
    setNotes(notes.filter((n) => n.id !== id));
    setSelectedId(null);
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
    if (d && !d.moved) setSelectedId(d.id); // it was a click, open the note
  }

  if (selected) {
    return (
        <div className="app">
          <div className="editor">
            <button className="back" onClick={() => setSelectedId(null)}>
              ← Back
            </button>
            <input
                value={selected.title}
                placeholder="Title"
                onChange={(e) => updateNote(selected.id, { title: e.target.value })}
            />
            <textarea
                value={selected.body}
                placeholder="Write something..."
                onChange={(e) => updateNote(selected.id, { body: e.target.value })}
            />
            <button className="danger" onClick={() => deleteNote(selected.id)}>
              Delete
            </button>
          </div>
        </div>
    );
  }

  return (
      <div className="app">
        <div className="toolbar">
          <button onClick={addNote}>+ New note</button>
        </div>
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
                {n.title || "Untitled"}
              </div>
          ))}
        </div>
      </div>
  );
}