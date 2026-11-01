// Tests the Cloudflare Worker with a fake AI service and a fake usage database.
const fs = require("fs"), path = require("path");
const { section, check, done, skip } = require("./lib");
const file = path.join(__dirname, "..", "worker.js");
if (!fs.existsSync(file)) skip("worker.js is not in this folder, so the Worker tests were skipped (add it to the repo to run them).");
const src = fs.readFileSync(file, "utf8").replace("export default", "const W=");
const rows = {}; const today = () => new Date().toISOString().slice(0, 10);
const mk = sql => ({ a: [], bind(...x) { this.a = x; return this; },
  async first() { const [u, d, k] = this.a, kk = u + "|" + d + "|" + k; if (/^INSERT/.test(sql)) rows[kk] = (rows[kk] || 0) + 1; return rows[kk] ?? null; },
  async all() { const [u, d] = this.a; return { results: Object.entries(rows).filter(([k]) => k.startsWith(u + "|" + d + "|")).map(([k, n]) => ({ kind: k.split("|")[2], n })) }; },
  run() { const [u, d, k] = this.a, kk = u + "|" + d + "|" + k; if (/n - 1/.test(sql)) rows[kk] = Math.max(0, (rows[kk] || 0) - 1); return Promise.resolve(); } });
const DB = { prepare: mk, batch: async st => { for (const s of st) await s.run(); } };
let uid = "u1", tokenOk = true, models = ["llama-3.3-70b-versatile", "meta-llama/llama-4-scout-17b-16e-instruct"], groq = () => ({ status: 200, content: "hello" }), seen = [], referers = [];
global.fetch = async (u, o) => {
  if (u.includes("identitytoolkit")) { referers.push(o.headers.Referer); return tokenOk ? { ok: true, json: async () => ({ users: [{ localId: uid }] }) } : { ok: false, json: async () => ({}) }; }
  if (u.includes("/models")) return { ok: true, json: async () => ({ data: models.map(id => ({ id })) }) };
  const body = JSON.parse(o.body); seen.push(body); const r = groq(body, seen.length);
  return { ok: r.status < 400, status: r.status, json: async () => ({ choices: [{ message: { content: r.content } }] }), text: async () => "err" };
};
eval(src + ";global.W=W");
const env = (x = {}) => ({ FIREBASE_API_KEY: "k", GROQ_KEY: "g", ALLOWED_ORIGIN: "https://site.example", DB, ...x });
const call = async (p, b, e) => { const r = await W.fetch(new Request("https://x" + p, { method: "POST", headers: { Authorization: "Bearer t" }, body: JSON.stringify(b || {}) }), env(e), { waitUntil: x => x }); let j = {}; try { j = await r.json(); } catch (x) {} return [r.status, j, r]; };
const quizItem = { type: "mc", q: "Q?", options: ["a", "b", "c", "d"], answer: "B", why: ["", "", "", ""], explain: "e" };
(async () => {
  section("Basics");
  let r = await W.fetch(new Request("https://x/chat", { method: "OPTIONS" }), env(), {}); check("preflight allows only your site", r.headers.get("Access-Control-Allow-Origin") === "https://site.example");
  r = await W.fetch(new Request("https://x/chat", { method: "GET" }), env(), {}); check("GET is refused", r.status === 405);
  tokenOk = false; r = await call("/chat", { messages: [{ role: "user", content: "hi" }] }); check("an invalid sign-in token is refused", r[0] === 401); tokenOk = true;
  r = await call("/nope", {}); check("unknown path gives 404", r[0] === 404);
  check("the site address is sent to Google so a restricted API key still works", referers.every(x => x === "https://site.example/"), referers[0]);
  section("Making a study set (/generate)");
  groq = () => ({ status: 200, content: JSON.stringify({ study: { notes: { summary: "S" }, cards: [{ term: "ATP", definition: "Energy" }, { question: "Q", answer: "A" }, { foo: 1 }], quiz: [quizItem, { type: "written", q: "W?", sample: "model answer" }, { type: "mc", q: "bad", options: ["a", "b", "c", "d"], answer: "zzz" }] } }) });
  r = await call("/generate", { text: "x".repeat(300) });
  check("works even when the AI wraps its answer in another key", r[0] === 200 && !!r[1].notes);
  check("flashcards with other field names are kept", r[1].cards?.length === 2 && r[1].cards[0].front === "ATP");
  check("a letter answer (\"B\") becomes the right number", r[1].quiz?.[0]?.answer === 1);
  check("unusable questions are dropped", r[1].quiz?.length === 2);
  check("the reply says how many generations are left today", r[1].left === 11, r[1].left);
  r = await call("/generate", { text: "short" }); check("too-short notes are refused", r[0] === 400);
  let n = 0; groq = () => (++n === 1 ? { status: 400, content: "" } : { status: 200, content: JSON.stringify({ notes: { summary: "S" }, cards: [{ front: "f", back: "b" }], quiz: [] }) });
  r = await call("/generate", { text: "y".repeat(300) }); check("a failed first try is retried with a shorter request", r[0] === 200 && n === 2);
  section("Tutor, explanations, questions, grading");
  seen = []; groq = () => ({ status: 200, content: "A hint, not the answer." });
  r = await call("/chat", { messages: [{ role: "user", content: "Which of the following is right? A) x" }], selection: "highlighted words", context: "notes" });
  check("tutor replies", r[0] === 200 && r[1].reply === "A hint, not the answer.");
  check("quiz-style questions get an extra no-answers warning", /looks like a quiz question/.test(seen[0].messages[0].content));
  check("highlighted text is passed to the tutor", /highlighted words/.test(JSON.stringify(seen[0].messages)));
  seen = []; r = await call("/explain", { item: { kind: "concept", a: "ATP", b: "Energy" }, style: "analogy", title: "Bio" });
  check("explain works and uses the chosen style", r[0] === 200 && /STYLE: analogy/.test(seen[0].messages[1].content));
  r = await call("/explain", { item: { a: "x" }, style: "<script>" }); check("an unknown style falls back to simpler", /STYLE: simpler/.test(seen[seen.length - 1].messages[1].content));
  r = await call("/explain", { item: { a: "" } }); check("explaining nothing is refused", r[0] === 400);
  groq = () => ({ status: 200, content: JSON.stringify({ quiz: [quizItem, { type: "written", q: "W?", sample: "model answer here" }] }) });
  r = await call("/quizgen", { item: { a: "ATP", b: "Energy" } }); check("practice questions are returned and cleaned", r[0] === 200 && r[1].quiz?.length === 2 && r[1].quiz[0].answer === 1);
  groq = () => ({ status: 200, content: "garbage" }); r = await call("/quizgen", { item: { a: "ATP" } }); check("unusable AI output gives a clear error", r[0] === 502);
  groq = () => ({ status: 200, content: JSON.stringify({ score: 0.5, feedback: "Partly right." }) });
  r = await call("/grade", { q: "Q", sample: "s", answer: "my answer" }); check("grading returns 0, 0.5 or 1 with feedback", r[0] === 200 && r[1].score === 0.5 && !!r[1].feedback);
  r = await call("/grade", { q: "Q", sample: "s", answer: "" }); check("an empty answer is refused", r[0] === 400);
  section("Reading photos (/readphoto)");
  const img = "data:image/jpeg;base64," + Buffer.from("fakejpeg").toString("base64");
  seen = []; groq = () => ({ status: 200, content: "Photosynthesis [?]\n\n\n- water" });
  r = await call("/readphoto", { image: img }); check("a photo is read with a vision model", r[0] === 200 && /llama-4/.test(seen[0].model) && seen[0].messages[0].content.some(p => p.type === "image_url") && /\[\?\]/.test(r[1].text));
  groq = () => ({ status: 200, content: "NO_TEXT" }); r = await call("/readphoto", { image: img }); check("a blank page is reported kindly", r[0] === 422);
  r = await call("/readphoto", { image: "http://evil.example/x.jpg" }); check("only embedded pictures are accepted, not web addresses", r[0] === 400);
  r = await call("/readphoto", { image: "data:image/jpeg;base64," + "A".repeat(3600000) }); check("huge pictures are refused", r[0] === 400);
  models = ["llama-3.3-70b-versatile"]; groq = () => ({ status: 200, content: "x" }); r = await call("/readphoto", { image: img }); check("no vision model available gives a clear message", r[0] === 503); models = ["llama-3.3-70b-versatile", "meta-llama/llama-4-scout-17b-16e-instruct"];
  section("Daily limits");
  groq = () => ({ status: 200, content: "ok" }); uid = "limit1"; let last;
  for (let i = 0; i < 81; i++) last = await call("/chat", { messages: [{ role: "user", content: "hi" }] });
  check("the 81st tutor message in a day is blocked", last[0] === 429 && /limit/.test(last[1].error));
  uid = "other"; r = await call("/chat", { messages: [{ role: "user", content: "hi" }] }); check("another student is not affected", r[0] === 200);
  r = await call("/usage", {}); check("usage lists every limited feature", r[0] === 200 && r[1].enabled && ["/generate", "/chat", "/grade", "/explain", "/quizgen", "/readphoto"].every(k => r[1].usage[k]));
  uid = "refund"; groq = () => ({ status: 503, content: "" }); await call("/generate", { text: "z".repeat(300) });
  check("a request that fails on the AI side is not counted", (rows["refund|" + today() + "|/generate"] || 0) === 0, rows["refund|" + today() + "|/generate"]);
  groq = () => ({ status: 200, content: "ok" }); r = await call("/chat", { messages: [{ role: "user", content: "hi" }] }, { DB: undefined }); check("without the database no limits apply", r[0] === 200 && r[1].left === undefined);
  done();
})();
