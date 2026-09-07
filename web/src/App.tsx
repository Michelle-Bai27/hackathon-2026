import { useEffect, useState, type FormEvent } from "react";
import { createIdea, fetchIdeas, voteIdea, type Idea } from "./api";

export function App() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchIdeas()
      .then(setIdeas)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    try {
      const created = await createIdea(title, description);
      setIdeas((prev) => sortIdeas([created, ...prev]));
      setTitle("");
      setDescription("");
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleVote(id: string) {
    try {
      const updated = await voteIdea(id);
      setIdeas((prev) =>
        sortIdeas(prev.map((idea) => (idea.id === id ? updated : idea))),
      );
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="page">
      <header className="hero">
        <h1>Hackathon 2026</h1>
        <p>Pitch an idea, rally votes, ship something great.</p>
      </header>

      <form className="card form" onSubmit={handleSubmit}>
        <h2>Add an idea</h2>
        <input
          aria-label="Idea title"
          placeholder="Idea title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          aria-label="Idea description"
          placeholder="What problem does it solve?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
        <button type="submit" disabled={!title.trim()}>
          Submit idea
        </button>
        {error && <p className="error">{error}</p>}
      </form>

      <section className="ideas">
        <h2>Leaderboard</h2>
        {loading ? (
          <p className="muted">Loading ideas…</p>
        ) : ideas.length === 0 ? (
          <p className="muted">No ideas yet. Be the first!</p>
        ) : (
          <ul>
            {ideas.map((idea) => (
              <li key={idea.id} className="card idea">
                <div className="idea-body">
                  <h3>{idea.title}</h3>
                  {idea.description && <p>{idea.description}</p>}
                </div>
                <button
                  className="vote"
                  onClick={() => handleVote(idea.id)}
                  aria-label={`Upvote ${idea.title}`}
                >
                  ▲ <span>{idea.votes}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function sortIdeas(list: Idea[]): Idea[] {
  return [...list].sort(
    (a, b) => b.votes - a.votes || a.createdAt.localeCompare(b.createdAt),
  );
}
