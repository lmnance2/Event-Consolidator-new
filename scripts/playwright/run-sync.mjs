import { runSync } from "../../lib/sync/run.ts";
const summary = await runSync();
console.log(JSON.stringify(summary, null, 2));
process.exit(0);
