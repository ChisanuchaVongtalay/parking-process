import { isDownloadableDataFile } from "@/lib/auth/protected-files";
import { adminEndpoint } from "@/lib/auth/access";

import { fail } from "@/lib/http";
import { readDataFile } from "@/lib/storage";

function contentType(filePath: string): string {
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  if (filePath.endsWith(".json")) return "application/json";
  return "application/octet-stream";
}

async function handleGET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await params;
    const relativePath = path.join("/");
    if (!isDownloadableDataFile(relativePath)) return fail("File not found", 404);
    const data = await readDataFile(relativePath);

    return new Response(new Uint8Array(data), {
      status: 200,
      headers: {
        "content-type": contentType(relativePath),
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return fail("File not found", 404);
  }
}

export const GET = adminEndpoint((_session, ...args: Parameters<typeof handleGET>) => handleGET(...args));
