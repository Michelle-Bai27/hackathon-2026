import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "./app.js";
import { IdeaStore } from "./store.js";

function freshApp() {
  return createApp(new IdeaStore());
}

test("health check returns ok", async () => {
  const res = await request(freshApp()).get("/api/health");
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: "ok" });
});

test("creating an idea returns it and lists it", async () => {
  const app = freshApp();
  const create = await request(app)
    .post("/api/ideas")
    .send({ title: "Test idea", description: "a description" });
  assert.equal(create.status, 201);
  assert.equal(create.body.title, "Test idea");
  assert.equal(create.body.votes, 0);

  const list = await request(app).get("/api/ideas");
  assert.equal(list.status, 200);
  assert.equal(list.body.length, 1);
  assert.equal(list.body[0].title, "Test idea");
});

test("missing title returns 400", async () => {
  const res = await request(freshApp()).post("/api/ideas").send({});
  assert.equal(res.status, 400);
  assert.equal(res.body.error, "title is required");
});

test("voting increments votes and reorders the list", async () => {
  const app = freshApp();
  await request(app).post("/api/ideas").send({ title: "First" });
  const second = await request(app).post("/api/ideas").send({ title: "Second" });
  const id = second.body.id;

  const voted = await request(app).post(`/api/ideas/${id}/vote`);
  assert.equal(voted.status, 200);
  assert.equal(voted.body.votes, 1);

  const list = await request(app).get("/api/ideas");
  assert.equal(list.body[0].title, "Second");
});

test("voting on a missing idea returns 404", async () => {
  const res = await request(freshApp()).post("/api/ideas/does-not-exist/vote");
  assert.equal(res.status, 404);
});
