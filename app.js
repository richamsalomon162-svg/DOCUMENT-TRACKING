"use strict";
const KEY = "doctrack.v1";
const TYPES = { TO: "Travel Order", OO: "Office Order", CL: "Communication Letter" };
const STATUS = ["Draft", "For review", "For signature", "Signed", "Released", "Filed", "Returned", "Cancelled"];
const DONE = ["Signed", "Released", "Filed", "Cancelled"];
const ACTIONS = { Forwarded: null, Received: null, "For review": "For review", "For signature": "For signature", Signed: "Signed", Released: "Released", Returned: "Returned", Filed: "Filed" };
const FIELDS = {
  TO: [["traveler", "Traveler(s)", "text"], ["dest", "Destination", "text"], ["start", "Departure date", "date"], ["end", "Return date", "date"], ["fund", "Fund source", "text"]],
  OO: [["effect", "Effectivity date", "date"], ["covered", "Covered personnel or unit", "text"]],
  CL: [["dir", "Direction", "select", ["Incoming", "Outgoing"]], ["ref", "Reference no.", "text"], ["action", "Action required", "text"]],
};
const PARTY = { TO: ["Requesting office", "Approving authority"], OO: ["Issuing office", "Addressed to"], CL: ["From (sender)", "To (recipient)"] };

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const now = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16).replace("T", " ");

let db = load();
const view = { q: "", type: "", status: "" };

function load() { try { return JSON.parse(localStorage.getItem(KEY)) || { docs: [] }; } catch { return { docs: [] }; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { toast("Could not save in this browser. Export a backup now."); } }
function toast(m) { const t = $("#toast"); t.textContent = m; t.style.display = "block"; clearTimeout(toast.t); toast.t = setTimeout(() => (t.style.display = "none"), 3000); }
const isOverdue = (d) => d.due && d.due < today() && !DONE.includes(d.status);
function nextNo(type, date) {
  const y = (date || today()).slice(0, 4), p = `${type}-${y}-`;
  const n = db.docs.filter((d) => d.no.startsWith(p)).reduce((m, d) => Math.max(m, +d.no.slice(p.length) || 0), 0) + 1;
  return p + String(n).padStart(4, "0");
}
function chip(d) {
  const c = isOverdue(d) ? "bad" : DONE.includes(d.status) ? "done" : d.status === "Draft" ? "" : "wait";
  return `<span class="chip ${c}">${esc(d.status)}</span>${isOverdue(d) ? ' <span class="chip bad">Overdue</span>' : ""}`;
}

/* ---------- list ---------- */
function render() {
  const all = db.docs, q = view.q.toLowerCase();
  const list = all.filter((d) => (!view.type || d.type === view.type) && (!view.status || d.status === view.status) &&
    (!q || Object.values(d).join(" ").toLowerCase().includes(q))).sort((a, b) => b.no.localeCompare(a.no));
  const pend = all.filter((d) => !DONE.includes(d.status)).length;
  $("#stats").innerHTML = [["", "Total documents", all.length], ["wait", "In progress", pend], ["warn", "Overdue", all.filter(isOverdue).length], ["done", "Completed", all.length - pend]]
    .map(([c, l, n]) => `<div class="stat ${c}"><b>${n}</b><span>${l}</span></div>`).join("");
  $("#rows").innerHTML = list.map((d) => `<tr tabindex="0" data-id="${d.id}"><td class="no">${d.no}<small>${TYPES[d.type]}</small></td>
    <td>${esc(d.subject)}</td><td>${esc(d.from)}<small>to ${esc(d.to)}</small></td><td>${esc(d.date)}</td><td>${esc(d.due)}</td><td>${esc(d.holder)}</td><td>${chip(d)}</td></tr>`).join("");
  $("#empty").hidden = list.length > 0;
}

/* ---------- form ---------- */
function field(k, l, t, v, o, wide) {
  const w = wide ? ' class="w"' : "";
  if (t === "select") return `<label${w}>${l}<select name="${k}">${o.map((x) => `<option value="${x}" ${x === v ? "selected" : ""}>${x}</option>`).join("")}</select></label>`;
  if (t === "area") return `<label class="w">${l}<textarea name="${k}" rows="2">${esc(v)}</textarea></label>`;
  return `<label${w}>${l}<input name="${k}" type="${t}" value="${esc(v)}"></label>`;
}
function openForm(id, over) {
  const cur = id ? db.docs.find((x) => x.id === id) : null;
  const d = { type: "TO", date: today(), status: "Draft", priority: "Normal", ...(cur || {}), ...(over || {}) };
  const [pa, pb] = PARTY[d.type];
  $("#dlg").innerHTML = `<form id="frm"><h2>${cur ? cur.no : "New document"}</h2><div class="grid">
    <label>Type<select name="type" ${cur ? "disabled" : ""}>${Object.entries(TYPES).map(([k, v]) => `<option value="${k}" ${k === d.type ? "selected" : ""}>${v}</option>`).join("")}</select></label>
    ${field("date", "Document date", "date", d.date)}
    ${field("subject", "Subject or purpose", "text", d.subject, null, true)}
    ${field("from", pa, "text", d.from)}${field("to", pb, "text", d.to)}
    ${FIELDS[d.type].map(([k, l, t, o]) => field(k, l, t, d[k], o)).join("")}
    ${field("priority", "Priority", "select", d.priority, ["Normal", "Urgent", "Highly urgent"])}
    ${field("due", "Action due date", "date", d.due)}
    ${field("remarks", "Remarks", "area", d.remarks)}
  </div><div class="foot"><button type="button" id="x">Cancel</button><button class="primary">Save document</button></div></form>`;
  const frm = $("#frm");
  if (!cur) frm.type.onchange = () => openForm(null, { ...Object.fromEntries(new FormData(frm)) });
  $("#x").onclick = () => $("#dlg").close();
  frm.onsubmit = (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(frm));
    if (!f.subject.trim()) { toast("Enter the subject or purpose."); return; }
    if (cur) Object.assign(cur, f);
    else {
      Object.assign(f, { id: crypto.randomUUID(), no: nextNo(f.type, f.date), status: "Draft", holder: f.from,
        log: [{ at: now(), office: f.from, action: "Created", note: "" }] });
      db.docs.push(f);
    }
    save(); render(); $("#dlg").close(); toast("Document saved.");
    if (!cur) openDetail(f.id);
  };
  if (!$("#dlg").open) $("#dlg").showModal();
}

/* ---------- detail + routing ---------- */
function openDetail(id) {
  const d = db.docs.find((x) => x.id === id); if (!d) return;
  const rows = [["Type", TYPES[d.type]], ["Date", d.date], [PARTY[d.type][0], d.from], [PARTY[d.type][1], d.to],
    ...FIELDS[d.type].map(([k, l]) => [l, d[k]]), ["Priority", d.priority], ["Action due", d.due], ["Remarks", d.remarks]];
  $("#dlg").innerHTML = `<h2>${d.no} ${chip(d)}</h2><p><b>${esc(d.subject)}</b></p>
    <dl>${rows.filter((r) => r[1]).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}<dt>Currently with</dt><dd>${esc(d.holder)}</dd></dl>
    <h3>Routing history</h3><ul class="log">${[...d.log].reverse().map((l) => `<li><b>${esc(l.action)}</b> – ${esc(l.office)}<br><small>${l.at}${l.note ? " – " + esc(l.note) : ""}</small></li>`).join("")}</ul>
    <h3>Record movement</h3><form id="rt" class="grid">
      <label>Action<select name="action">${Object.keys(ACTIONS).map((a) => `<option>${a}</option>`).join("")}</select></label>
      <label>Office or person it moves to<input name="office" required></label>
      <label class="w">Note<input name="note"></label>
      <div class="w"><button class="primary">Add to routing</button></div></form>
    <div class="foot"><button id="del" class="danger">Delete</button><button id="edit">Edit details</button><button id="prt">Print routing slip</button><button id="cls">Close</button></div>`;
  $("#rt").onsubmit = (e) => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
    d.log.push({ at: now(), office: f.office, action: f.action, note: f.note }); d.holder = f.office;
    if (ACTIONS[f.action]) d.status = ACTIONS[f.action];
    save(); render(); openDetail(id); toast("Routing updated.");
  };
  $("#edit").onclick = () => openForm(id);
  $("#prt").onclick = () => printSlip(d);
  $("#cls").onclick = () => $("#dlg").close();
  $("#del").onclick = () => { if (confirm(`Delete ${d.no}? This cannot be undone.`)) { db.docs = db.docs.filter((x) => x.id !== id); save(); render(); $("#dlg").close(); toast("Document deleted."); } };
  if (!$("#dlg").open) $("#dlg").showModal();
}

function printSlip(d) {
  const blank = '<tr><td>&nbsp;</td><td></td><td></td><td></td></tr>'.repeat(3);
  $("#slip").innerHTML = `<h2>Document Routing Slip</h2><p>DA-PRDP RPCO 13</p>
    <table><tr><th>Tracking no.</th><td>${d.no}</td><th>Type</th><td>${TYPES[d.type]}</td></tr>
    <tr><th>Subject</th><td colspan="3">${esc(d.subject)}</td></tr>
    <tr><th>${PARTY[d.type][0]}</th><td>${esc(d.from)}</td><th>${PARTY[d.type][1]}</th><td>${esc(d.to)}</td></tr>
    <tr><th>Date</th><td>${esc(d.date)}</td><th>Action due</th><td>${esc(d.due)}</td></tr></table>
    <h3>Routing</h3><table><tr><th>Date and time</th><th>Action</th><th>Office or person</th><th>Note or signature</th></tr>
    ${d.log.map((l) => `<tr><td>${l.at}</td><td>${esc(l.action)}</td><td>${esc(l.office)}</td><td>${esc(l.note)}</td></tr>`).join("")}${blank}</table>`;
  window.print();
}

/* ---------- export / backup ---------- */
function download(name, text, type) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); URL.revokeObjectURL(a.href); }
$("#csv").onclick = () => {
  const cols = ["no", "type", "date", "subject", "from", "to", "status", "priority", "due", "holder", "traveler", "dest", "start", "end", "fund", "effect", "covered", "dir", "ref", "action", "remarks"];
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  download(`document-tracking-${today()}.csv`, "\ufeff" + [cols.join(","), ...db.docs.map((d) => cols.map((c) => cell(d[c])).join(","))].join("\r\n"), "text/csv");
};
$("#bak").onclick = () => download(`document-tracking-backup-${today()}.json`, JSON.stringify(db, null, 2), "application/json");
$("#rst").onchange = (e) => {
  const f = e.target.files[0]; if (!f) return;
  f.text().then((t) => {
    const j = JSON.parse(t); if (!Array.isArray(j.docs)) throw 0;
    if (confirm(`Replace the ${db.docs.length} documents in this browser with ${j.docs.length} from the backup?`)) { db = j; save(); render(); toast("Backup restored."); }
  }).catch(() => toast("That file is not a valid backup.")); e.target.value = "";
};

/* ---------- wiring ---------- */
$("#ft").innerHTML = '<option value="">All types</option>' + Object.entries(TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
$("#fs").innerHTML = '<option value="">All statuses</option>' + STATUS.map((s) => `<option>${s}</option>`).join("");
$("#q").oninput = (e) => { view.q = e.target.value; render(); };
$("#ft").onchange = (e) => { view.type = e.target.value; render(); };
$("#fs").onchange = (e) => { view.status = e.target.value; render(); };
$("#new").onclick = () => openForm();
$("#rows").onclick = (e) => { const tr = e.target.closest("tr"); if (tr) openDetail(tr.dataset.id); };
$("#rows").onkeydown = (e) => { if (e.key === "Enter" && e.target.dataset.id) openDetail(e.target.dataset.id); };
render();
