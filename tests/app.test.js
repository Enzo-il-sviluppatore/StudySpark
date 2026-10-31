// Drives the real app (index.html) in a simulated browser, screen by screen.
const boot = require("./harness"), { section, check, done } = require("./lib");
const mk = (t, c, x = {}) => ({ title: t, created: c, text: "Mitochondria release energy as ATP. ".repeat(10),
  notes: { summary: "Summary of " + t, concepts: [{ term: "ATP", explanation: "Energy molecule" }], vocab: [{ word: "Cell", definition: "Basic unit" }], examples: ["An example"], diagram: { nodes: [{ id: "a", label: "Cell", group: "concept" }, { id: "b", label: "ATP", group: "term" }], links: [{ from: "a", to: "b", label: "makes" }] } },
  cards: [{ front: "f1", back: "b1", box: 0 }, { front: "f2", back: "b2", box: 0 }],
  quiz: [{ type: "mc", q: "Which releases energy?", options: ["Nucleus", "Mitochondria", "Ribosome", "Golgi"], answer: 1, why: ["", "", "", ""], explain: "ATP" }, { type: "multi", q: "Pick two", options: ["a", "b", "c", "d", "e"], answers: [0, 2], explain: "x" }, { type: "written", q: "Explain ATP", sample: "Energy carrier" }],
  lastScore: null, meta: { scores: [] }, visuals: { steps: { title: "S", cycle: true, items: [{ label: "A", detail: "a" }, { label: "B", detail: "b" }] }, images: [], resolved: true }, dialogues: null, ...x });
const lib = (n) => [...Array(n)].map((_, i) => mk("Set " + (i + 1), 1000 * (i + 1)));
const tab = async (a, t) => { if (!a.$$("#snav [data-tab=" + t + "]")[0]) a.click("#snav [data-act=more]"); a.$$("#snav [data-tab=" + t + "]")[0].click(); await a.tick(60); };
const openFirst = async a => { a.$$("#lib [data-open]")[0].click(); await a.tick(); };
(async () => {
  section("Start-up and the welcome tour");
  let a = await boot(); await a.signIn();
  check("the app starts without script errors", a.err.length === 0, a.err[0]);
  check("a brand-new account sees the welcome tour", /Turn your notes into study tools/.test(a.$("#sm")?.textContent || ""));
  a.click("#tn"); check("Next moves to step 2", /Study the smart way/.test(a.$("#sm").textContent)); a.click("#tn"); a.click("#tn");
  a.click("#tg"); check("'Start my first set' closes the tour and opens the new-set form", !a.$("#sm") && a.$("details.hero").open);
  check("the tour is remembered", a.w.localStorage.getItem("ss_tour_u1") === "1");
  a = await boot({ sets: lib(1) }); await a.signIn(); check("people who already have sets are not shown the tour", !a.$("#sm"));

  section("Home screen and sidebar layout");
  a = await boot(); await a.signIn(); a.click("#ts");
  check("new-set form is open when the library is empty", a.$("details.hero").open);
  check("the footer is a compact icon row", ["#badges", "#gear", "#snd", "#more"].every(s => a.$(s)));
  check("privacy, install, help and feedback are tucked under ⋯", a.$("#moremenu").hidden && ["#howto", "#fbk", "#privacy", "#inst"].every(s => a.$("#moremenu " + s)));
  a = await boot({ sets: lib(7) }); await a.signIn();
  check("new-set form is folded away once you have sets", !a.$("details.hero").open);
  check("the study tip is one slim line", !!a.$(".tipline #tip") && a.$(".tipline #tip").textContent.length > 10 && !a.$(".tipcard"));
  check("sidebar lists 5 sets with a 'Show all' button", a.$$("#snav [data-set]").length === 5 && /Show all \(7\)/.test(a.$("#snav [data-act=all]").textContent));
  a.click("#snav [data-act=all]"); check("'Show all' lists every set", a.$$("#snav [data-set]").length === 7);
  await openFirst(a);
  check("inside a set the sidebar shows only the main tabs", a.$$("#snav [data-tab]").map(b => b.dataset.tab).join() === "notes,visuals,cards,quiz");
  a.click("#snav [data-act=more]"); check("'More' reveals Progress, Edit, My notes, Add notes", a.$$("#snav [data-tab]").length === 8);
  check("the set title has one ⋯ options button", !!a.$("#opt") && !a.$("#rn") && !a.$("#sj"));
  a.click("#opt"); check("the options menu has Rename, Subject, Share, Study guide", ["so-rn", "so-sj", "so-sh", "so-pg"].every(s => a.$("#" + s))); a.click("#sx");
  await tab(a, "notes");
  check("notes: vocabulary and examples are folded, the map shows", a.$$("#pane details.sec").length === 2 && a.$$("#pane details.sec").every(d => !d.open) && !!a.$("#map svg"));
  a.click("#gear"); const ds = a.$$("#sm details");
  check("settings are in collapsible sections, only Appearance open", ds.length >= 5 && ds[0].open && ds.slice(1).every(d => !d.open));
  ds[4].open = true; a.$("[data-k=anim][data-v=off]").click();
  check("changing a setting keeps your open sections", a.$$("#sm details")[4].open && a.w.document.documentElement.dataset.anim === "off"); a.click("#sx");
  a.click("#menu"); check("phone: ☰ opens the sidebar", a.$("#side").classList.contains("open")); a.click("#scrim"); check("phone: tapping outside closes it", !a.$("#side").classList.contains("open"));

  section("Making a study set");
  const gen = { notes: { summary: "Cells make energy.", concepts: [{ term: "ATP", explanation: "Energy molecule" }], vocab: [{ word: "Cell", definition: "Unit" }], examples: ["e"], diagram: null }, cards: [{ front: "f", back: "b" }], quiz: [{ type: "mc", q: "Q?", options: ["a", "b", "c", "d"], answer: 0, why: ["", "", "", ""], explain: "x" }], left: 11 };
  a = await boot({ handler: u => u.endsWith("/generate") ? gen : null }); await a.signIn(); a.click("#ts");
  a.$("#title").value = "A very long title ".repeat(10); a.$("#txt").value = "Cells use mitochondria to release energy. ".repeat(10); a.click("#go"); await a.tick(120);
  const made = [...a.store].filter(([k]) => /users\/u1\/sets\//.test(k)).map(x => x[1]);
  check("generating saves a set and opens it", made.length === 1 && /Cells make energy/.test(a.$("#pane").textContent), made.length);
  check("titles are limited to 60 characters", made[0] && made[0].title.length <= 60, made[0] && made[0].title.length);
  a = await boot({ handler: () => ({ __status: 502, body: { error: "The AI is busy right now." } }) }); await a.signIn(); a.click("#ts");
  a.$("#title").value = "T"; a.$("#txt").value = "Cells use mitochondria to release energy. ".repeat(10); a.click("#go"); await a.tick(100);
  check("a failed generation shows the message and keeps your text", /busy/.test(a.$("#toast").textContent) && a.$("#txt").value.length > 100 && a.$("#go").disabled === false);

  section("Flashcards, quiz and results");
  a = await boot({ sets: lib(2) }); await a.signIn(); await openFirst(a);
  await tab(a, "cards"); a.click("#fc"); check("a flashcard flips", /b[12]/.test(a.$("#fc").textContent));
  a.click("#yes"); await a.tick(300); check("'Got it' moves to the next card", /1 left/.test(a.$("#pane").textContent));
  const sid = [...a.store.keys()].find(k => /sets\/s\d$/.test(k));
  check("review progress is saved", [...a.store].some(([k, v]) => /users\/u1\/sets\//.test(k) && (v.cards || []).some(c => c.box === 1 && c.due > Date.now())));
  a.click("#no"); await a.tick(300); a.click("#yes"); await a.tick(300); check("finishing all due cards says 'All caught up'", /All caught up/.test(a.$("#pane").textContent));
  await tab(a, "quiz");
  for (let i = 0; i < 3; i++) {
    if (a.$("#wa")) { a.$("#wa").value = "energy carrier"; a.click("#ck"); await a.tick(60); a.$$("[data-sg]")[0]?.click(); }
    else if (a.$("#ck")) { a.$$(".opt")[0].click(); a.$$(".opt")[2].click(); a.click("#ck"); }
    else a.$$(".opt")[1].click();
    await a.tick(); a.click("#nx"); await a.tick();
  }
  check("the quiz ends on a results page with a percentage", /\d+%/.test(a.$("#pane").textContent) && !/NaN/.test(a.$("#pane").textContent), a.$("#pane").textContent.slice(0, 60));
  await tab(a, "cards"); await tab(a, "quiz");
  check("results stay after switching tabs until you press Retake", /\d+%/.test(a.$("#pane").textContent) && !!a.$("#re"));
  a.click("#re"); await a.tick(); check("Retake starts a new quiz", /Question 1 of/.test(a.$("#pane").textContent));
  for (const t of ["progress", "edit", "source", "add"]) { await tab(a, t); check("the " + t + " tab shows content", a.$("#pane").textContent.length > 20); }
  await tab(a, "progress"); a.$("#lb").value = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10); a.click("#lbs"); await a.tick();
  check("a learn-by date shows a countdown", /day/.test(a.$("#app").textContent));

  section("AI helpers: explain, practice questions, tutor");
  const h = u => u.endsWith("/explain") ? { reply: "Like a rechargeable battery.", left: 39 } : u.endsWith("/quizgen") ? { quiz: [{ type: "mc", q: "What does ATP do?", options: ["Stores energy", "Makes DNA", "Moves water", "Digests food"], answer: 0, why: ["", "", "", ""], explain: "x" }, { type: "written", q: "Describe what ATP is for", sample: "It carries energy." }], left: 19 } : u.endsWith("/chat") ? { reply: "Think about where energy comes from.", left: 79 } : null;
  a = await boot({ sets: lib(1), handler: h }); await a.signIn(); await openFirst(a);
  a.$$("[data-xp]")[0].click(); a.click("[data-x=analogy]"); await a.tick(60);
  check("'Explain differently' shows the explanation", /rechargeable battery/.test(a.$("#xo").textContent));
  a.click("#xa"); a.click("#xs"); await a.tick();
  check("'Add as flashcard' adds a card to the set", [...a.store].some(([k, v]) => /users\/u1\/sets\//.test(k) && (v.cards || []).length === 3));
  a.click("#xq"); await a.tick(60); check("'Make practice questions' previews them", a.$$("#xqo .item").length === 2);
  a.click("#xqa"); await a.tick(); check("…and adds them to the quiz", [...a.store].some(([k, v]) => /users\/u1\/sets\//.test(k) && (v.quiz || []).length === 5)); a.click("#sx");
  a.click("#fab"); a.$("#q").value = "Help me with energy"; a.click("#send"); await a.tick(80);
  check("the tutor chat gets a reply", /where energy comes from/.test(a.$("#log").textContent));

  section("Library search, subjects, rename");
  a = await boot({ sets: [mk("Biology", 3000, { meta: { subject: "Science", scores: [] } }), mk("French Revolution", 2000, { text: "The Bastille was stormed in July." }), mk("Maths", 1000)] }); await a.signIn();
  const q = v => { const i = a.$("#lq"); i.value = v; i.dispatchEvent(new a.w.Event("input", { bubbles: true })); };
  q("bastille"); check("search finds words inside your notes", a.$$("#lib .set").length === 1 && /French/.test(a.$("#lib").textContent) && !!a.$(".snip mark"));
  q(""); a.click("[data-sub=Science]"); check("filtering by subject works", a.$$("#lib .set").length === 1);
  a.click("[data-sub=__none]"); check("'No subject' filter works", a.$$("#lib .set").length === 2);

  section("Sharing");
  a = await boot({ sets: lib(1) }); await a.signIn(); await openFirst(a);
  a.click("#opt"); a.click("#so-sh"); a.click("#mk"); await a.tick(60);
  const link = a.$("#lk")?.value || ""; const shareId = (link.match(/\?s=([a-f0-9]{32})/) || [])[1];
  const shared = a.store.get("shared/" + shareId);
  check("creating a link makes a 32-character unguessable id", !!shareId);
  check("the shared copy leaves out your notes text, scores and email", !!shared && !("text" in shared) && !JSON.stringify(shared).includes("ann@school.org") && !("meta" in shared));
  a.click("#stop"); await a.tick(60); check("'Stop sharing' deletes the shared copy", !a.store.has("shared/" + shareId)); a.click("#sx");
  const sh = { ownerUid: "u1", title: "Shared set", by: "Ann", expires: null, notes: { summary: "S", concepts: [{ term: "T", explanation: "E" }] }, cards: [{ front: "f", back: "b" }], quiz: [], visuals: null, dialogues: null };
  const sid2 = "ab".repeat(16);
  a = await boot({ seed: { ["shared/" + sid2]: sh }, url: "https://x.github.io/app/?s=" + sid2 }); await a.signOutNow();
  check("a signed-out visitor can open a shared link", /Shared study set/.test(a.$("#app").textContent) && /Shared set/.test(a.$("#app").textContent));
  check("…read-only: no edit/add tabs and no library button", a.$$("#snav [data-tab]").map(b => b.dataset.tab).join() === "notes,visuals,cards,quiz" && !a.$("#snav [data-go]") && !a.$("#snav [data-act=more]"));
  a.click("#opt"); check("…and its options menu offers only the study guide", !a.$("#so-sh") && !a.$("#so-rn") && !!a.$("#so-pg")); a.click("#sx");
  a = await boot({ url: "https://x.github.io/app/?s=" + "cd".repeat(16) }); await a.signOutNow();
  check("a missing or expired link shows a friendly message", /isn’t available/.test(a.$("#app").textContent));
  a = await boot({ seed: { ["shared/" + sid2]: sh }, url: "https://x.github.io/app/?s=" + sid2, user: { uid: "v1", displayName: "Bo" } }); await a.signIn();
  a.click("#cpy"); await a.tick(60);
  check("a signed-in viewer can save a copy", [...a.store].some(([k, v]) => /users\/v1\/sets\//.test(k) && /copy/.test(v.title) && v.text === ""));

  section("Backup and restore");
  a = await boot({ sets: lib(2) }); await a.signIn(); a.click("#gear"); a.click("#bk"); await a.tick();
  const backup = a.w.__blobs.find(b => /StudySpark/.test(b)); let bj = {}; try { bj = JSON.parse(backup); } catch (e) {}
  check("the backup file holds all your sets", bj.app === "StudySpark" && bj.sets?.length === 2);
  check("the backup leaves out share links", !JSON.stringify(bj).includes("shareId\":\"a"));
  a = await boot(); await a.signIn(); a.click("#gear");
  const inp = a.$("#rsf"); Object.defineProperty(inp, "files", { value: [{ size: backup.length, text: async () => backup }] }); inp.dispatchEvent(new a.w.Event("change", { bubbles: true })); await a.tick(60);
  check("restoring shows a preview of what will be added", /2 sets/.test(a.$("#sm").textContent), a.$("#sm")?.textContent.slice(0, 80));
  a.click("#go2"); await a.tick(120);
  check("restoring adds the sets back", [...a.store.keys()].filter(k => /users\/u1\/sets\//.test(k)).length === 2);

  section("Settings, privacy, feedback, help");
  a = await boot({ sets: lib(1) }); await a.signIn();
  a.click("#more"); a.click("#privacy"); check("the Privacy & terms page opens", /What we keep/.test(a.$("#sm").textContent) && /Feedback/.test(a.$("#sm").textContent)); a.click("#sx");
  a.click("#more"); a.click("#howto"); check("the how-to guide opens with a print button", /Make a study set/.test(a.$("#sm").textContent) && !!a.$("#hp")); a.click("#sx");
  a.click("#badges"); check("the badges page opens", a.$$("#sm .badge").length >= 10); a.click("#sx");
  a.click("#more"); a.click("#fbk"); a.$("#fbm").value = "The quiz button does nothing on my phone"; a.$("#fbt").value = "bug"; a.click("#fbs"); await a.tick(60);
  const fb = [...a.store].filter(([k]) => k.startsWith("feedback")).map(x => x[1]);
  check("feedback is saved", fb.length === 1 && fb[0].type === "bug");
  check("feedback never includes your notes or your email unless you tick the box", !JSON.stringify(fb[0]).includes("Set 1") && !("contact" in fb[0]));
  a = await boot({ sets: lib(1) }); await a.signIn(); a.click("#gear"); a.click("[data-k=theme][data-v=dark]");
  check("dark theme applies and is remembered", a.w.document.documentElement.dataset.theme === "dark" && /"theme":"dark"/.test(a.w.localStorage.getItem("ss_settings")));
  a.click("[data-k=font][data-v=dyslexic]"); check("the dyslexia-friendly font can be chosen", a.w.document.documentElement.dataset.font === "dyslexic");
  a.click("#sx"); a.w.document.querySelector("#out").click(); await a.tick(80); check("signing out shows the welcome page", /Turn your notes into study tools/.test(a.$("#app").textContent));
  check("no script errors occurred anywhere in this run", a.err.length === 0, a.err[0]);
  done();
})().catch(e => { console.log("❌ the test run crashed:", e.stack || e); process.exit(1); });
