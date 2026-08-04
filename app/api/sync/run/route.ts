import { runSync } from "@/lib/sync/run";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request): Promise<Response> {
  const authHeader = req.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
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
