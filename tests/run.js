// Runs every test file and prints a short summary. Exit code is 1 if anything failed.
const { spawnSync } = require("child_process"), path = require("path");
const files = ["static.test.js", "worker.test.js", "app.test.js", "social.test.js", "duel.test.js"];
let bad = [];
for (const f of files) {
  console.log("\n==================== " + f + " ====================");
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { stdio: ["ignore", "pipe", "pipe"], timeout: 240000, encoding: "utf8" });
  process.stdout.write((r.stdout || "").split("\n").filter(l => !/Not implemented/.test(l)).join("\n"));
  if (r.status !== 0) { bad.push(f); if (r.stderr) process.stdout.write(r.stderr.split("\n").filter(l => !/Not implemented/.test(l)).slice(0, 8).join("\n") + "\n"); }
}
console.log("\n" + (bad.length ? "❌ Some tests failed: " + bad.join(", ") : "✅ All test files passed."));
process.exit(bad.length ? 1 : 0);
