# Complete HTML Examples

## A: Read → LLM Stream → Write → Notify Agent
```html
<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Analysis</title></head>
<body>
<button id="go">Analyze</button><pre id="out">Ready</pre>
<script>
document.getElementById("go").addEventListener("click", async () => {
  const out = document.getElementById("out");
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
      {model: "auto", maxTokens: 500}
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

## C: Model Selector + Stream Chat
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
  document.getElementById("model").innerHTML =
    `<option value="auto" selected>Auto</option>` +
    models.map(m => `<option value="${m.id}">${m.label||m.id}</option>`).join("");
});
document.getElementById("send").addEventListener("click", async () => {
  const content = document.getElementById("input").value.trim();
  if (!content) return;
  const out = document.getElementById("output");
  out.textContent = "";
  document.getElementById("cancel").disabled = false;
  const model = document.getElementById("model").value || "auto";
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
