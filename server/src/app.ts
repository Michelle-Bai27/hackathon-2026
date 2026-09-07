import express, { type Express } from "express";
import cors from "cors";
import { IdeaStore } from "./store.js";

const defaultSeed = [
  { title: "AI pair-programming kiosk", description: "Walk-up booth that pairs you with an agent." },
  { title: "Carbon-aware CI", description: "Schedule builds when the grid is greenest." },
];

export function createApp(store: IdeaStore = new IdeaStore(defaultSeed)): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/ideas", (_req, res) => {
    res.json(store.list());
  });

  app.post("/api/ideas", (req, res) => {
    const { title, description } = req.body ?? {};
    if (typeof title !== "string" || title.trim() === "") {
      res.status(400).json({ error: "title is required" });
      return;
    }
    const idea = store.add(title, typeof description === "string" ? description : "");
    res.status(201).json(idea);
  });

  app.post("/api/ideas/:id/vote", (req, res) => {
    const idea = store.vote(req.params.id);
    if (!idea) {
      res.status(404).json({ error: "idea not found" });
      return;
    }
    res.json(idea);
  });

  return app;
}
