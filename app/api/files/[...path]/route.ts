import fs from "node:fs/promises";

import { fail } from "@/lib/http";
import { resolveDataPath } from "@/lib/storage";

function contentType(filePath: string): string {
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  if (filePath.endsWith(".json")) return "application/json";
  return "application/octet-stream";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await params;
    const relativePath = path.join("/");
    const absolutePath = resolveDataPath(relativePath);
    const data = await fs.readFile(absolutePath);

    return new Response(data, {
      status: 200,
      headers: {
        "content-type": contentType(absolutePath),
        "cache-control": "no-store",
      },
    });
  } catch {
    return fail("File not found", 404);
  }
}
