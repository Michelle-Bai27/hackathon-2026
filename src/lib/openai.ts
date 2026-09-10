import "server-only";

import fs from "node:fs";
import path from "node:path";
import OpenAI, { APIError, APIConnectionError, APIConnectionTimeoutError } from "openai";

export const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";

function applyEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/);
  for (const raw of lines) {
    let line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("export ")) line = line.slice(7).trim();
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    if (key !== "OPENAI_API_KEY" && key !== "OPENAI_MODEL" && key !== "OPENAI_BASE_URL") continue;
    if (process.env[key]?.trim()) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value) process.env[key] = value;
  }
}

export function loadOpenAIEnv() {
  applyEnvFile(path.join(process.cwd(), ".env.local"));
  applyEnvFile(path.join(process.cwd(), "src/.env.local"));
}

export function getOpenAIModel() {
  loadOpenAIEnv();
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
}

export class OpenAIConfigError extends Error {
  readonly code = "not_configured" as const;
  constructor(message: string) {
    super(message);
    this.name = "OpenAIConfigError";
  }
}

export function getOpenAI() {
  loadOpenAIEnv();
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new OpenAIConfigError(missingKeyMessage());
  }
  const baseURL = process.env.OPENAI_BASE_URL?.trim();
  return new OpenAI({
    apiKey,
    timeout: 60_000,
    maxRetries: 0,
    ...(baseURL ? { baseURL } : {}),
  });
}

export function missingKeyMessage() {
  const root = fs.existsSync(path.join(process.cwd(), ".env.local"));
  const nested = fs.existsSync(path.join(process.cwd(), "src/.env.local"));
  if (nested && !root) {
    return "OpenAI is not configured for Next.js. Add OPENAI_API_KEY to .env.local in the project root (Next.js does not load src/.env.local).";
  }
  return "OpenAI is not configured. Add OPENAI_API_KEY to .env.local in the project root, then restart the dev server.";
}

export async function createJsonResponse(options: {
  instructions: string;
  input: string;
  temperature?: number;
}) {
  const openai = getOpenAI();
  const response = await openai.responses.create({
    model: getOpenAIModel(),
    instructions: options.instructions,
    input: options.input,
    temperature: options.temperature ?? 0.4,
    text: { format: { type: "json_object" } },
  });
  const text = response.output_text?.trim();
  if (!text) {
    throw new Error("The model returned an empty response.");
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("The model returned text that was not valid JSON.");
  }
}

export function jsonError(error: unknown) {
  if (error instanceof OpenAIConfigError) {
    return {
      status: 503,
      body: { error: "not_configured", message: error.message },
    };
  }
  if (error instanceof APIConnectionTimeoutError || error instanceof APIConnectionError) {
    return {
      status: 504,
      body: {
        error: "unreachable",
        message:
          "Could not reach OpenAI (api.openai.com timed out). This is a network issue, not a problem with your lecture. Use a VPN, or set OPENAI_BASE_URL in .env.local if you use a proxy or compatible gateway.",
      },
    };
  }
  if (error instanceof APIError) {
    if (error.status === 401 || error.status === 403) {
      return {
        status: error.status,
        body: {
          error: "auth",
          message: "The OpenAI API rejected this request. The key may be invalid or missing permission.",
        },
      };
    }
    if (error.status === 429) {
      return {
        status: 429,
        body: {
          error: "rate_limit",
          message: "OpenAI rate limit reached. Try again in a moment.",
        },
      };
    }
    if (error.status && error.status >= 500) {
      return {
        status: 502,
        body: {
          error: "upstream",
          message: "OpenAI is temporarily unavailable. Try again shortly.",
        },
      };
    }
    return {
      status: error.status ?? 400,
      body: {
        error: "openai",
        message:
          typeof error.message === "string" && error.message.trim()
            ? error.message
            : "The OpenAI request failed. Try a different OPENAI_MODEL or retry in a moment.",
      },
    };
  }
  const message = error instanceof Error ? error.message : "Unexpected error while contacting OpenAI.";
  return { status: 500, body: { error: "failed", message } };
}
