// Runs the REAL index.html in a simulated browser (jsdom) with Firebase replaced by an in-memory fake,
// so whole screens can be driven and checked without a network or a Firebase project.
const { JSDOM } = require("jsdom"), fs = require("fs"), path = require("path");
module.exports = async function boot({ file = path.join(__dirname, "..", "index.html"), sets = [], seed = {}, user = { uid: "u1", displayName: "Ann", email: "ann@school.org" }, url = "https://x.github.io/app/", handler = null } = {}) {
  const html = fs.readFileSync(file, "utf8");
  const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm, "");
  const dom = new JSDOM(html.replace(/<script[\s\S]*?<\/script>/g, ""), { url, runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window;
  w.matchMedia = () => ({ matches: false, addEventListener() {} });
  w.pdfjsLib = { GlobalWorkerOptions: {} }; w.JSZip = {};
  w.Element.prototype.scrollIntoView = function () {}; w.HTMLElement.prototype.focus = function () {};
  w.HTMLAnchorElement.prototype.click = function () {};
  w.__blobs = []; const RealBlob = w.Blob; w.Blob = function (parts, o) { w.__blobs.push(parts.join("")); return new RealBlob(parts, o); };
  w.URL.createObjectURL = () => "blob:x"; w.URL.revokeObjectURL = () => {};
  const store = new Map(), fetches = []; let authCb = null, n = 0;
  sets.forEach((s, i) => store.set("users/" + user.uid + "/sets/s" + (i + 1), s));
  Object.entries(seed).forEach(([k, v]) => store.set(k, v));
  const P = (a, ...p) => [typeof a === "string" ? a : "", ...p].filter(Boolean).join("/");
  const api = {
    initializeApp: () => ({}), getAuth: () => ({}), GoogleAuthProvider: function () {}, signInWithPopup: async () => {}, signOut: async () => authCb && authCb(null),
    onAuthStateChanged: (a, cb) => { authCb = cb; }, getFirestore: () => ({}), initializeFirestore: () => ({}), persistentLocalCache: () => ({}), persistentMultipleTabManager: () => ({}),
    collection: (db, ...p) => p.join("/"), doc: (a, ...p) => P(a, ...p), orderBy: () => ({}), where: (f, o, v) => ({ w: [f, o, v] }), query: (c, ...r) => ({ c, r }),
    addDoc: async (c, d) => { const id = "n" + (++n); store.set(c + "/" + id, JSON.parse(JSON.stringify(d))); return { id }; },
    setDoc: async (k, d, o) => { store.set(k, o && o.merge ? { ...(store.get(k) || {}), ...JSON.parse(JSON.stringify(d)) } : JSON.parse(JSON.stringify(d))); },
    getDoc: async k => ({ exists: () => store.has(k), data: () => store.get(k) }),
    getDocs: async q => { const col = q.c || q, wh = (q.r || []).find(x => x.w);
      const L = [...store].filter(([k]) => k.startsWith(col + "/") && !k.slice(col.length + 1).includes("/")).filter(([k, v]) => !wh || v[wh.w[0]] === wh.w[2]).map(([k, v]) => ({ id: k.split("/").pop(), data: () => v, ref: { path: k } }));
      L.sort((a, b) => (b.data().created || 0) - (a.data().created || 0)); return { docs: L, size: L.length }; },
    deleteDoc: async x => { store.delete(typeof x === "string" ? x : x.path); },
  };
  w.fetch = async (u, o) => { u = String(u); const body = o && o.body ? JSON.parse(o.body) : null; fetches.push({ url: u, body });
    const r = handler ? handler(u, body) : null; const status = r && r.__status || 200; const data = r && r.__status ? r.body : (r || { enabled: false });
    return { ok: status < 400, status, json: async () => data, text: async () => JSON.stringify(data) }; };
  const names = Object.keys(api), err = [];
  w.addEventListener("error", e => err.push(e.message));
  const fn = w.eval("(async function(" + names.join(",") + "){" + script + "\n})");
  fn(...names.map(k => api[k])).catch(e => err.push(String(e)));
  const tick = (ms = 40) => new Promise(r => setTimeout(r, ms));
  await tick(30);
  const signIn = async () => { await authCb({ ...user, getIdToken: async () => "tok" }); await tick(80); };
  const signOutNow = async () => { await authCb(null); await tick(60); };
  return { w, $: s => w.document.querySelector(s), $$: s => [...w.document.querySelectorAll(s)], store, fetches, tick, signIn, signOutNow, err, click: s => w.document.querySelector(s).click() };
};
