import { NextResponse } from "next/server";
import { generatePuzzle, NotEnoughEntriesError } from "@/lib/puzzles";
import { apiError, json, parse, readJson } from "@/lib/api";
import { generatePuzzleSchema } from "@/lib/validation/schemas";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const limit = rateLimit(clientKey(req.headers, "generate"), 20, 60);
  if (!limit.ok) {
    return apiError(429, "Too many puzzles generated, slow down", {
      retryAfter: limit.retryAfter,
    });
  }

  const read = await readJson(req);
  if (!read.ok) return read.response;

  const parsed = parse(generatePuzzleSchema, read.body);
  if (!parsed.ok) return parsed.response;

  try {
    const puzzle = await generatePuzzle(parsed.data);
    return json({ puzzle }, { status: 201 });
  } catch (err) {
    if (err instanceof NotEnoughEntriesError) return apiError(422, err.message);
    console.error("generate puzzle error:", err);
    return apiError(500, "Could not generate puzzle");
  }
}

export function GET() {
  return NextResponse.json({ error: "Use POST to generate a puzzle" }, { status: 405 });
}
