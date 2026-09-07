export interface Idea {
  id: string;
  title: string;
  description: string;
  votes: number;
  createdAt: string;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed with ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function fetchIdeas(): Promise<Idea[]> {
  return fetch("/api/ideas").then((res) => handle<Idea[]>(res));
}

export function createIdea(title: string, description: string): Promise<Idea> {
  return fetch("/api/ideas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description }),
  }).then((res) => handle<Idea>(res));
}

export function voteIdea(id: string): Promise<Idea> {
  return fetch(`/api/ideas/${id}/vote`, { method: "POST" }).then((res) =>
    handle<Idea>(res),
  );
}
