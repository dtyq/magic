# Complete HTML Examples

## A: Read → LLM Stream → Write → Notify Agent
```html
<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Analysis</title></head>
<body>
<label>Model <select id="model"></select></label>
<button id="go">Analyze</button><pre id="out">Ready</pre>
<script>
document.getElementById("go").addEventListener("click", async () => {
  const out = document.getElementById("out");
  const modelSelect = document.getElementById("model");
  const models = await window.Magic.llm.getModels();
  modelSelect.replaceChildren(...models.map(model => new Option(model.label || model.id, model.id)));
  modelSelect.value = models[0]?.id || "";
  if (!modelSelect.value) throw new Error("No available models");
  out.textContent = "Reading...";
  const [users, orders] = await Promise.all([
    window.Magic.fs.readFile("data/users.json").then(JSON.parse),
    window.Magic.fs.readFile("data/orders.json").then(JSON.parse),
  ]);
  out.textContent = "Analyzing...";
  let result = "";
  await new Promise(resolve => {
    window.Magic.llm.stream(
      [{role: "user", content: `Users: ${users.length}, Orders total: ${orders.reduce((s,o)=>s+o.amount,0)}. Recommendations?`}],
      (delta, done) => { result += delta; out.textContent = result; if (done) resolve(null); },
      {model: modelSelect.value, maxTokens: 500}
    );
  });
  await window.Magic.fs.writeFile("output/analysis.md", result);
  window.Magic.setInputMessage("Done. See output/analysis.md");
});
</script>
</body></html>
```

## B: Watch File + Auto-Refresh
```html
<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Dashboard</title></head>
<body>
<div id="dash">Loading...</div>
<script>
async function render() {
  const d = JSON.parse(await window.Magic.fs.readFile("data/metrics.json"));
  document.getElementById("dash").innerHTML =
    `<h2>Metrics</h2><p>Users: ${d.totalUsers}</p><p>Active: ${d.dailyActive}</p><p>${new Date(d.updatedAt).toLocaleString()}</p>`;
}
render().catch(console.error);
window.Magic.fs.watchFile("data/metrics.json", () => render().catch(console.error));
</script>
</body></html>
```

## C: CRUD List From Record Files
```html
<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Tasks</title></head>
<body>
<form id="form"><input id="title" placeholder="Task title"><button>Add</button></form>
<ul id="list"></ul>
<script>
const RECORD_DIR = "data/tasks/";
const encoder = new TextEncoder();

function truncateUtf8Bytes(input, maxBytes) {
  let out = "", size = 0;
  for (const char of String(input)) {
    const bytes = encoder.encode(char).length;
    if (size + bytes > maxBytes) break;
    out += char;
    size += bytes;
  }
  return out;
}

function slugifyTitle(title) {
  const slug = String(title || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return truncateUtf8Bytes(slug || "record", 40);
}

function parseRecordFileName(name) {
  const match = /^([^_]+)__([^_]+)__([a-z0-9]+)__(.+)\.json$/.exec(name);
  if (!match) return null;
  return { sortKey: match[1], status: match[2], shortId: match[3], titleSlug: match[4], name };
}

function safeToken(value, fallback, maxBytes) {
  const token = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+|-+$/g, "");
  return truncateUtf8Bytes(token || fallback, maxBytes);
}

function buildRecordFileName(record) {
  const sortKey = /^\d{14}$/.test(String(record.sortKey || "")) ? record.sortKey : new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const status = safeToken(record.status, "open", 16);
  const shortId = safeToken(record.shortId, newId(), 12);
  const base = `${sortKey}__${status}__${shortId}__`;
  const titleSlug = record.titleSensitive ? "record" : slugifyTitle(record.title);
  const maxTitleBytes = Math.max(6, 120 - encoder.encode(base + ".json").length);
  return `${base}${truncateUtf8Bytes(titleSlug, Math.min(40, maxTitleBytes))}.json`;
}

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

async function loadList() {
  const entries = await window.Magic.fs.listDir(RECORD_DIR);
  const rows = entries
    .map((entry) => ({ entry, projection: parseRecordFileName(entry.name) }))
    .filter((row) => row.projection)
    .sort((a, b) => b.projection.sortKey.localeCompare(a.projection.sortKey));
  document.getElementById("list").innerHTML = rows
    .map(({ entry, projection }) => `<li><button data-path="${entry.path}">${projection.status} ${projection.titleSlug}</button></li>`)
    .join("");
}

document.getElementById("form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = document.getElementById("title").value.trim();
  if (!title) return;
  const record = {
    id: crypto.randomUUID?.() || newId(),
    shortId: newId(),
    sortKey: new Date().toISOString().replace(/\D/g, "").slice(0, 14),
    status: "open",
    title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const existing = await window.Magic.fs.listDir(RECORD_DIR);
  let fileName = buildRecordFileName(record);
  while (existing.some((entry) => entry.name === fileName)) {
    record.shortId = newId();
    fileName = buildRecordFileName(record);
  }
  await window.Magic.fs.writeFile(RECORD_DIR + fileName, JSON.stringify(record, null, 2));
  document.getElementById("title").value = "";
  await loadList();
});

document.getElementById("list").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-path]");
  if (!button) return;
  const detail = JSON.parse(await window.Magic.fs.readFile(button.dataset.path));
  alert(detail.title);
});

loadList().catch(console.error);
window.Magic.fs.watchDir(RECORD_DIR, () => loadList().catch(console.error));
</script>
</body></html>
```

## D: Model Selector + Stream Chat
```html
<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Chat</title></head>
<body>
<select id="model"><option>Loading...</option></select>
<textarea id="input" placeholder="Message..."></textarea>
<button id="send">Send</button><button id="cancel" disabled>Cancel</button>
<div id="output"></div>
<script>
let cancelFn = null;
window.Magic.llm.getModels().then(models => {
  const select = document.getElementById("model");
  select.replaceChildren(...models.map(m => new Option(m.label || m.id, m.id)));
  select.value = models[0]?.id || "";
});
document.getElementById("send").addEventListener("click", async () => {
  const content = document.getElementById("input").value.trim();
  if (!content) return;
  const out = document.getElementById("output");
  out.textContent = "";
  document.getElementById("cancel").disabled = false;
  const model = document.getElementById("model").value;
  if (!model) { out.textContent = "No available models"; return; }
  cancelFn = window.Magic.llm.stream(
    [{role: "user", content}],
    (delta, done) => { out.textContent += delta; if (done) { document.getElementById("cancel").disabled = true; cancelFn = null; } },
    {model}
  );
});
document.getElementById("cancel").addEventListener("click", () => { cancelFn?.(); cancelFn = null; document.getElementById("cancel").disabled = true; });
</script>
</body></html>
```

## D: File URL Preview
```html
<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Preview</title></head>
<body>
<img id="preview" alt="Chart preview" style="max-width:100%;height:auto;">
<a id="open" target="_blank" rel="noopener">Open file</a>
<script>
async function loadPreview() {
  const url = await window.Magic.fs.getFileUrl("assets/chart.png");
  document.getElementById("preview").src = url;
  document.getElementById("open").href = url;
}
loadPreview().catch(err => {
  document.body.textContent = "Failed to load preview: " + err.message;
});
</script>
</body></html>
```
