// Second Brain — personal long-term memory assistant
// Stack: Cloudflare Worker + KV, Nebius Token Factory (Qwen3-Embedding-8B),
// NVIDIA Nemotron chat models (nvidia/nemotron-3-super-120b-a12b primary,
// nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B fallback). Key via env.NEBIUS_API_KEY secret.

const NEBIUS_BASE = "https://api.tokenfactory.nebius.com/v1";
const EMBED_MODEL = "Qwen/Qwen3-Embedding-8B";
const CHAT_PRIMARY = "nvidia/nemotron-3-super-120b-a12b";
const CHAT_FALLBACK = "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B";

const SEEDS = [
  {
    id: "seed-1",
    title: "Main project: Line Puppy pet extension",
    text: "The user's flagship product is a Chrome extension featuring a line-art puppy desktop pet that lives on web pages. It is published on the Chrome Web Store under the publisher name ninigogo and has over 1,100 users. Version 1.1 added an adoption and growth system."
  },
  {
    id: "seed-2",
    title: "Keepie: AI bookmark organizer",
    text: "Keepie is the user's AI bookmark organizer Chrome extension. Version 0.4 shipped a built-in AI experience with free credits: the AI sorts bookmarks into folders automatically and gives suggestions. It uses a Cloudflare Worker gateway in front of the model API."
  },
  {
    id: "seed-3",
    title: "Niji Auth: iOS authenticator app",
    text: "Niji Auth is the user's two-factor authenticator app for iPhone, built for the Japanese market first. Pricing: free for 5 accounts, then 980 yen per month or 4,800 yen per year, with a 12,000 yen lifetime option. Differentiators are Google Authenticator migration import, no tracking, and encrypted backups."
  },
  {
    id: "seed-4",
    title: "Preferred tech stack",
    text: "The user is a solo indie developer based in Hangzhou, China. Preferred stack: Cloudflare Workers and Pages for backends and hosting, Supabase for Postgres and auth, and vanilla JavaScript single-page apps for web front ends. He prefers standard CLIs and APIs over browser automation."
  },
  {
    id: "seed-5",
    title: "Vibe coding course",
    text: "The user teaches a vibe coding course that helps beginners build real products with AI coding tools such as Cursor. The course sites run on Cloudflare Pages. His teaching style is minimalist: clean whitespace, typography-first slides, no cinematic fluff."
  },
  {
    id: "seed-6",
    title: "Working habits and hackathons",
    text: "The user ships small products fast and enters online hackathons regularly, including Devpost events. He decides quickly, likes parallel projects, and wants status reports with evidence: what was verified, what failed, and what is still open."
  }
];

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Second Brain — Nebius + NVIDIA Nemotron</title>
<style>
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; background: #0f1115; color: #e8eaf0; }
  .wrap { max-width: 760px; margin: 0 auto; padding: 24px 16px 64px; }
  h1 { font-size: 28px; margin: 8px 0 4px; }
  .stack { color: #9aa3b2; font-size: 14px; line-height: 1.5; }
  .card { background: #171a21; border: 1px solid #262b36; border-radius: 12px; padding: 16px; margin-top: 20px; }
  .card h2 { font-size: 17px; margin: 0 0 10px; }
  input[type=text], textarea { width: 100%; box-sizing: border-box; background: #0f1115; color: #e8eaf0; border: 1px solid #333a49; border-radius: 8px; padding: 9px 10px; margin-bottom: 8px; font-size: 14px; }
  button { background: #76b900; color: #10130a; border: 0; border-radius: 8px; padding: 9px 14px; font-size: 14px; font-weight: 600; cursor: pointer; }
  button.secondary { background: #262b36; color: #e8eaf0; }
  button.del { background: transparent; color: #ff7b72; padding: 2px 6px; font-weight: 400; }
  .mem { border-top: 1px solid #262b36; padding: 10px 0; }
  .mem:first-of-type { border-top: 0; }
  .mem .t { font-weight: 600; }
  .mem .x { color: #9aa3b2; font-size: 14px; line-height: 1.5; }
  #answer { white-space: pre-wrap; line-height: 1.6; font-size: 15px; }
  #sources { color: #9aa3b2; font-size: 13px; margin-top: 8px; }
  .status { color: #9aa3b2; font-size: 13px; min-height: 18px; }
  a { color: #8ecbff; }
</style>
</head>
<body>
<div class="wrap">
  <h1>🧠 Second Brain</h1>
  <div class="stack">
    A personal long-term memory assistant. Everything you save is embedded with
    <b>Qwen3-Embedding-8B</b> on <b>Nebius Token Factory</b>, stored in Cloudflare KV,
    and recalled by semantic search. Questions are answered by the NVIDIA open model
    <b>Nemotron 3 Super 120B</b> (fallback: Nemotron 3 Nano 30B), grounded only in your memories.
  </div>

  <div class="card">
    <h2>💬 Ask your second brain</h2>
    <input type="text" id="q" placeholder="e.g. What is my main Chrome extension and how many users does it have?">
    <button id="ask">Ask</button>
    <div class="status" id="chatStatus"></div>
    <div id="answer"></div>
    <div id="sources"></div>
  </div>

  <div class="card">
    <h2>➕ Add a memory</h2>
    <input type="text" id="mtitle" placeholder="Title, e.g. Dog">
    <textarea id="mtext" rows="3" placeholder="The fact to remember, e.g. My dog is a white Cocker Spaniel puppy named Lumi."></textarea>
    <button id="add">Save memory</button>
    <span class="status" id="addStatus"></span>
  </div>

  <div class="card">
    <h2>🗂️ Stored memories</h2>
    <button class="secondary" id="seed">Load demo memories</button>
    <span class="status" id="seedStatus"></span>
    <div id="list"></div>
  </div>

  <div class="stack" style="margin-top:24px">
    Built for the Nebius x NVIDIA hackathon. Demo data describes a fictional indie developer.
  </div>
</div>
<script>
function esc(s){return s.replace(/&/g,"&amp;").replace(/</g,"&lt;");}
function loadList(){
  fetch("/api/memories").then(function(r){return r.json();}).then(function(d){
    var el = document.getElementById("list");
    if(!d.memories || !d.memories.length){ el.innerHTML = "<p class='status'>No memories yet. Load the demo set or add your own.</p>"; return; }
    el.innerHTML = d.memories.map(function(m){
      return "<div class='mem'><span class='t'>" + esc(m.title) + "</span> " +
        "<button class='del' data-id='" + m.id + "'>delete</button>" +
        "<div class='x'>" + esc(m.text) + "</div></div>";
    }).join("");
    var btns = el.querySelectorAll("button.del");
    for(var i=0;i<btns.length;i++){ btns[i].onclick = function(){
      fetch("/api/memories/" + this.getAttribute("data-id"), {method:"DELETE"}).then(loadList);
    }; }
  });
}
document.getElementById("add").onclick = function(){
  var title = document.getElementById("mtitle").value.trim();
  var text = document.getElementById("mtext").value.trim();
  var st = document.getElementById("addStatus");
  if(!title || !text){ st.textContent = "Title and text are both required."; return; }
  st.textContent = "Embedding and saving...";
  fetch("/api/memories", {method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify({title:title, text:text})})
    .then(function(r){return r.json();}).then(function(d){
      if(d.error){ st.textContent = "Error: " + d.error; return; }
      st.textContent = "Saved."; document.getElementById("mtitle").value=""; document.getElementById("mtext").value=""; loadList();
    }).catch(function(e){ st.textContent = "Error: " + e; });
};
document.getElementById("seed").onclick = function(){
  var st = document.getElementById("seedStatus"); st.textContent = "Seeding (embedding 6 memories)...";
  fetch("/api/seed", {method:"POST"}).then(function(r){return r.json();}).then(function(d){
    st.textContent = d.error ? ("Error: " + d.error) : ("Seeded " + d.seeded + " memories."); loadList();
  }).catch(function(e){ st.textContent = "Error: " + e; });
};
document.getElementById("ask").onclick = function(){
  var q = document.getElementById("q").value.trim();
  var st = document.getElementById("chatStatus");
  var ans = document.getElementById("answer"); var src = document.getElementById("sources");
  if(!q){ st.textContent = "Type a question first."; return; }
  st.textContent = "Thinking (Nemotron)..."; ans.textContent = ""; src.textContent = "";
  fetch("/api/chat", {method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify({question:q})})
    .then(function(r){return r.json();}).then(function(d){
      st.textContent = "";
      if(d.error){ ans.textContent = "Error: " + d.error; return; }
      ans.textContent = d.answer || "";
      if(d.sources && d.sources.length){ src.textContent = "Sources: " + d.sources.join(" · ") + (d.model ? "  |  Model: " + d.model : ""); }
    }).catch(function(e){ st.textContent = ""; ans.textContent = "Error: " + e; });
};
loadList();
</script>
</body>
</html>`;

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

async function nebiusFetch(env, path, body) {
  const resp = await fetch(NEBIUS_BASE + path, {
    method: "POST",
    headers: {
      "authorization": "Bearer " + env.NEBIUS_API_KEY,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const text = await resp.text();
  let data = null;
  try { data = JSON.parse(text); } catch (e) { /* keep null */ }
  if (!resp.ok) {
    throw new Error("Nebius " + path + " HTTP " + resp.status + ": " + text.slice(0, 300));
  }
  return data;
}

async function embed(env, text) {
  const data = await nebiusFetch(env, "/embeddings", { model: EMBED_MODEL, input: text });
  const vec = data && data.data && data.data[0] && data.data[0].embedding;
  if (!Array.isArray(vec) || !vec.length) throw new Error("Embedding response had no vector");
  return vec;
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function allMemories(env) {
  const listed = await env.MEMORIES.list({ prefix: "mem:" });
  const out = [];
  for (const k of listed.keys) {
    const raw = await env.MEMORIES.get(k.name);
    if (raw) { try { out.push(JSON.parse(raw)); } catch (e) { /* skip corrupt */ } }
  }
  out.sort((x, y) => (x.ts || 0) - (y.ts || 0));
  return out;
}

async function saveMemory(env, id, title, text) {
  const vector = await embed(env, title + "\n" + text);
  const rec = { id: id, title: title, text: text, vector: vector, ts: Date.now() };
  await env.MEMORIES.put("mem:" + id, JSON.stringify(rec));
  return rec;
}

async function chat(env, question) {
  const mems = await allMemories(env);
  if (!mems.length) {
    return { answer: "I have no memories stored yet, so I cannot answer from memory. Add a memory or load the demo memories first, then ask again.", sources: [], model: null };
  }
  const qv = await embed(env, question);
  const scored = mems.map(m => ({ m: m, s: cosine(qv, m.vector) }));
  scored.sort((a, b) => b.s - a.s);
  const top = scored.slice(0, 4);
  const context = top.map((t, i) => "[" + (i + 1) + "] Title: " + t.m.title + "\n" + t.m.text).join("\n\n");
  const messages = [
    {
      role: "system",
      content: "You are Second Brain, a personal memory assistant. Answer the user's question using ONLY the memories provided below. Be concise and factual. If the memories do not contain the answer, say that you do not have a memory about that. At the end of your reply, on its own line, write: Sources: followed by the titles of the memories you used, separated by semicolons."
    },
    { role: "user", content: "Memories:\n\n" + context + "\n\nQuestion: " + question }
  ];
  let data = null, usedModel = CHAT_PRIMARY, lastErr = null;
  for (const model of [CHAT_PRIMARY, CHAT_FALLBACK]) {
    try {
      data = await nebiusFetch(env, "/chat/completions", { model: model, messages: messages, max_tokens: 1200, temperature: 0.2 });
      usedModel = model;
      break;
    } catch (e) { lastErr = e; data = null; }
  }
  if (!data) throw lastErr || new Error("Chat call failed");
  const answer = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!answer) throw new Error("Chat response had no content");
  return { answer: answer.trim(), sources: top.map(t => t.m.title), model: usedModel };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (request.method === "GET" && path === "/") {
        return new Response(HTML, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=60" } });
      }
      if (request.method === "GET" && path === "/api/memories") {
        const mems = await allMemories(env);
        return json({ memories: mems.map(m => ({ id: m.id, title: m.title, text: m.text, ts: m.ts })) });
      }
      if (request.method === "POST" && path === "/api/memories") {
        const body = await request.json();
        const title = (body.title || "").trim(), text = (body.text || "").trim();
        if (!title || !text) return json({ error: "title and text are required" }, 400);
        const id = "m" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
        const rec = await saveMemory(env, id, title, text);
        return json({ ok: true, id: rec.id });
      }
      if (request.method === "POST" && path === "/api/seed") {
        let n = 0;
        for (const s of SEEDS) { await saveMemory(env, s.id, s.title, s.text); n++; }
        return json({ ok: true, seeded: n });
      }
      if (request.method === "DELETE" && path.indexOf("/api/memories/") === 0) {
        const id = decodeURIComponent(path.slice("/api/memories/".length));
        if (!id) return json({ error: "missing id" }, 400);
        await env.MEMORIES.delete("mem:" + id);
        return json({ ok: true });
      }
      if (request.method === "POST" && path === "/api/chat") {
        const body = await request.json();
        const question = (body.question || "").trim();
        if (!question) return json({ error: "question is required" }, 400);
        return json(await chat(env, question));
      }
      return json({ error: "not found" }, 404);
    } catch (e) {
      return json({ error: String(e && e.message || e) }, 500);
    }
  }
};
