// Quick sanity checks on the files themselves: they parse, nothing important is missing.
const fs = require("fs"), path = require("path"), { JSDOM } = require("jsdom");
const { section, check, done } = require("./lib");
const root = p => path.join(__dirname, "..", p), read = p => fs.readFileSync(root(p), "utf8");
section("Files are present");
for (const f of ["index.html", "manifest.json", "sw.js", "icon-192.png", "icon-512.png", "firestore.rules"]) check(f + " exists", fs.existsSync(root(f)));
section("index.html");
const html = read("index.html");
const code = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm, "");
let ok = true, msg = ""; try { new Function("return (async()=>{" + code + "\n})"); } catch (e) { ok = false; msg = e.message; }
check("the app code has no syntax errors", ok, msg);
check("Firebase settings are filled in (no placeholders left)", !/YOUR_API_KEY|YOUR_PROJECT|YOUR_APP_ID|YOUR-WORKER/.test(html));
check("no secret API keys in the page", !/gsk_[A-Za-z0-9]{20,}|AIzaSy[A-Za-z0-9_-]{33}.*GEMINI|sk-[A-Za-z0-9]{30,}/.test(html.replace(/apiKey: "AIzaSy[A-Za-z0-9_-]{33}"/, "")));
const dom = new JSDOM(html.replace(/<script[\s\S]*?<\/script>/g, ""));
const ids = [...dom.window.document.querySelectorAll("[id]")].map(e => e.id), dup = ids.filter((x, i) => ids.indexOf(x) !== i);
check("no duplicate element ids in the page", dup.length === 0, dup);
check("page language is set", /<html lang="[a-z-]+"/.test(html));
check("viewport tag is present", /name="viewport"/.test(html));
section("Install and offline files");
let man = {}; try { man = JSON.parse(read("manifest.json")); } catch (e) {}
check("manifest has a name, start page and icons", !!(man.name && man.start_url && man.icons && man.icons.length >= 2));
check("every manifest icon file exists", (man.icons || []).every(i => fs.existsSync(root(i.src))));
let sw = true; try { new Function(read("sw.js")); } catch (e) { sw = false; }
check("sw.js has no syntax errors", sw);
section("Security rules (text checks)");
const rules = read("firestore.rules");
check("a signed-in user can only reach their own data", /match \/users\/\{uid\}\/sets\/\{setId\}/.test(rules) && /request\.auth\.uid == uid/.test(rules));
check("everything else is denied by default", /match \/\{document=\*\*\} \{ allow read, write: if false; \}/.test(rules));
check("share links can be read one at a time but not listed", /match \/shared\/\{shareId\}/.test(rules) && /allow get:/.test(rules));
check("feedback can be written but not read by students", /match \/feedback\/\{id\}/.test(rules) && /allow read, update, delete: if false/.test(rules));
if (fs.existsSync(root("worker.js"))) { let w = true; try { new Function(read("worker.js").replace("export default", "const W=")); } catch (e) { w = false; } check("worker.js has no syntax errors", w); }
done();
