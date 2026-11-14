import type { Route } from "./+types/home";
import { useEffect, useState, type FormEvent } from "react";
import { getSupabaseClient } from "../utils/supabase";

type Todo = {
  id: number;
  description: string;
};

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Todos" },
    { name: "description", content: "A simple todo list." },
  ];
}

export default function Home() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newDescription, setNewDescription] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function fetchTodos() {
      try {
        const { data, error } = await getSupabaseClient()
          .from("todos")
          .select("id, description")
          .order("id", { ascending: true });

        if (error) {
          throw error;
        }

        setTodos(data);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Unable to load todos.",
        );
      } finally {
        setLoading(false);
      }
    }

    void fetchTodos();
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const description = newDescription.trim();
    if (!description || busy) return;

    setBusy(true);
    setErrorMessage("");
    try {
      const { data, error } = await getSupabaseClient()
        .from("todos")
        .insert({ description })
        .select("id, description")
        .single();

      if (error) throw error;

      setTodos((currentTodos) => [...currentTodos, data]);
      setNewDescription("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to create the todo.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const description = editDescription.trim();
    if (editingId === null || !description || busy) return;

    setBusy(true);
    setErrorMessage("");
    try {
      const { data, error } = await getSupabaseClient()
        .from("todos")
        .update({ description })
        .eq("id", editingId)
        .select("id, description")
        .single();

      if (error) throw error;

      setTodos((currentTodos) =>
        currentTodos.map((todo) => (todo.id === data.id ? data : todo)),
      );
      setEditingId(null);
      setEditDescription("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to update the todo.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: number) {
    if (busy) return;

    setBusy(true);
    setErrorMessage("");
    try {
      const { data, error } = await getSupabaseClient()
        .from("todos")
        .delete()
        .eq("id", id)
        .select("id");

      if (error) throw error;
      if (data.length === 0) {
        throw new Error("This todo could not be found or deleted.");
      }

      setTodos((currentTodos) => currentTodos.filter((todo) => todo.id !== id));
      if (editingId === id) {
        setEditingId(null);
        setEditDescription("");
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to delete the todo.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900">
      <section className="mx-auto w-full max-w-2xl">
        <header className="mb-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
            Your list
          </p>
          <h1 className="text-4xl font-bold tracking-tight">Todos</h1>
          <p className="mt-2 text-slate-600">
            Keep track of what you want to get done.
          </p>
        </header>

        <form
          className="mb-6 flex gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
          onSubmit={handleCreate}
        >
          <label className="sr-only" htmlFor="new-todo">
            New todo
          </label>
          <input
            id="new-todo"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            value={newDescription}
            onChange={(event) => setNewDescription(event.target.value)}
            placeholder="What needs to be done?"
            required
          />
          <button
            className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            type="submit"
            disabled={loading || busy || !newDescription.trim()}
          >
            Add todo
          </button>
        </form>

        {errorMessage && (
          <p
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {errorMessage}
          </p>
        )}

        <section
          className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200"
          aria-label="Todo list"
        >
          {loading ? (
            <p className="p-6 text-slate-600" role="status">
              Loading todos…
            </p>
          ) : todos.length === 0 ? (
            <p className="p-6 text-slate-600">
              No todos yet. Add one above to get started.
            </p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {todos.map((todo) => (
                <li
                  className="flex items-center gap-4 px-5 py-4"
                  key={todo.id}
                >
                  {editingId === todo.id ? (
                    <form
                      className="flex min-w-0 flex-1 flex-wrap gap-2"
                      onSubmit={handleUpdate}
                    >
                      <label className="sr-only" htmlFor={`edit-todo-${todo.id}`}>
                        Edit todo
                      </label>
                      <input
                        id={`edit-todo-${todo.id}`}
                        className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                        value={editDescription}
                        onChange={(event) =>
                          setEditDescription(event.target.value)
                        }
                        required
                        autoFocus
                      />
                      <button
                        className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                        type="submit"
                        disabled={busy || !editDescription.trim()}
                      >
                        Save
                      </button>
                      <button
                        className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setEditDescription("");
                        }}
                        disabled={busy}
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 break-words">
                        {todo.description}
                      </span>
                      <button
                        className="rounded-lg px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                        type="button"
                        onClick={() => {
                          setEditingId(todo.id);
                          setEditDescription(todo.description);
                          setErrorMessage("");
                        }}
                        disabled={busy}
                        aria-label={`Edit ${todo.description}`}
                      >
                        Edit
                      </button>
                      <button
                        className="rounded-lg px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        type="button"
                        onClick={() => void handleDelete(todo.id)}
                        disabled={busy}
                        aria-label={`Delete ${todo.description}`}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>
    </main>
  );
}
