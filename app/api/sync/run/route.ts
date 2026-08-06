import * as crypto from "crypto";
import { runSync } from "@/lib/sync/run";

export const runtime = "nodejs";
export const maxDuration = 300;

function timingSafeStringEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export async function GET(req: Request): Promise<Response> {
  const authHeader = req.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || !authHeader || !timingSafeStringEqual(authHeader, `Bearer ${cronSecret}`)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let summary;
  try {
    summary = await runSync();
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "sync.route.fatal_error",
        error: String(err),
      })
    );
    return Response.json({ error: "Sync failed" }, { status: 500 });
  }

  return Response.json(
    {
      ok: true,
      providers: summary.providers,
      crossProviderDeduped: summary.crossProviderDeduped,
      cleanup: summary.cleanup,
      durationMs: summary.durationMs,
    },
    { status: 200 }
  );
}
