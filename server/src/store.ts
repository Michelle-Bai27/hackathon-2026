import { randomUUID } from "node:crypto";

export interface Idea {
  id: string;
  title: string;
  description: string;
  votes: number;
  createdAt: string;
}

/** In-memory store for hackathon ideas. Swap for a real database later. */
export class IdeaStore {
  private ideas = new Map<string, Idea>();

  constructor(seed: Array<Pick<Idea, "title" | "description">> = []) {
    for (const item of seed) {
      this.add(item.title, item.description);
    }
  }

  list(): Idea[] {
    return [...this.ideas.values()].sort(
      (a, b) => b.votes - a.votes || a.createdAt.localeCompare(b.createdAt),
    );
  }

  add(title: string, description = ""): Idea {
    const idea: Idea = {
      id: randomUUID(),
      title: title.trim(),
      description: description.trim(),
      votes: 0,
      createdAt: new Date().toISOString(),
    };
    this.ideas.set(idea.id, idea);
    return idea;
  }

  vote(id: string): Idea | undefined {
    const idea = this.ideas.get(id);
    if (idea) {
      idea.votes += 1;
    }
    return idea;
  }
}
