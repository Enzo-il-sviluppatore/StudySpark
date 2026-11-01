// Tiny test helpers: print a ✅/❌ line per check and exit non-zero if anything failed.
let total = 0, fails = 0;
exports.section = n => console.log("\n" + n);
exports.check = (name, cond, extra) => {
  total++;
  if (cond) console.log("  ✅ " + name);
  else { fails++; console.log("  ❌ " + name + (extra === undefined ? "" : "  → " + (typeof extra === "string" ? extra : JSON.stringify(extra)))); }
};
exports.done = () => { console.log(`\n${total - fails}/${total} checks passed`); process.exit(fails ? 1 : 0); };
exports.skip = msg => { console.log("  ⏭️  " + msg); process.exit(0); };
