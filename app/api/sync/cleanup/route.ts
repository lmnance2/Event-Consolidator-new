import * as crypto from "crypto";
import { runCleanup } from "@/lib/sync/cleanup";

export const runtime = "nodejs";
export const maxDuration = 60;

function timingSafeStringEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export async function GET(req: Request): Promise<Response> {
  const authHeader = req.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || !authHeader || !timingSafeStringEqual(authHeader, `Bearer ${cronSecret}`)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let result;
  try {
    result = await runCleanup();
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "cleanup.route.fatal_error",
        error: String(err),
      })
    );
    return Response.json({ error: "Cleanup failed" }, { status: 500 });
  }

  return Response.json({ ok: true, ...result }, { status: 200 });
}
