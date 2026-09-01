import { listLanguages } from "@/lib/entries";
import { json } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  return json({ languages: await listLanguages() });
}
