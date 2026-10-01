import { useEffect, useState } from "react";
import "./App.css";

type Note = { id: string; title: string; body: string; updatedAt: number };
const KEY = "notes";

function loadNotes(): Note[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export default function App() {
  const [notes, setNotes] = useState<Note[]>(loadNotes);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(notes));
  }, [notes]);

  const selected = notes.find((n) => n.id === selectedId);

  function addNote() {
    const note: Note = { id: crypto.randomUUID(), title: "", body: "", updatedAt: Date.now() };
    setNotes([note, ...notes]);
    setSelectedId(note.id);
  }

  function updateNote(id: string, changes: Partial<Pick<Note, "title" | "body">>) {
    setNotes(notes.map((n) => (n.id === id ? { ...n, ...changes, updatedAt: Date.now() } : n)));
  }

  function deleteNote(id: string) {
    setNotes(notes.filter((n) => n.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  return (
      <div className="app">
        <aside className="sidebar">
          <button onClick={addNote}>+ New note</button>
          <ul>
            {notes.map((n) => (
                <li
                    key={n.id}
                    className={n.id === selectedId ? "active" : ""}
                    onClick={() => setSelectedId(n.id)}
                >
                  {n.title || "Untitled"}
                </li>
            ))}
          </ul>
        </aside>

        <main className="editor">
          {selected ? (
              <>
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
              </>
          ) : (
              <p className="empty">Select or create a note.</p>
          )}
        </main>
      </div>
  );
}