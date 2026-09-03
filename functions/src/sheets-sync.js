const { google } = require("googleapis");
const { db, FieldValue, now, toIso } = require("./core");

function columnName(number) {
  let value = number; let result = "";
  while (value > 0) { value -= 1; result = String.fromCharCode(65 + value % 26) + result; value = Math.floor(value / 26); }
  return result;
}
function cell(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return toIso(value) || JSON.stringify(value);
  return value;
}
async function sheetsClient() {
  const auth = new google.auth.GoogleAuth({ scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  return google.sheets({ version: "v4", auth });
}
async function ensureSheet(client, spreadsheetId, title, requestedHeaders) {
  const metadata = await client.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" });
  const exists = (metadata.data.sheets || []).some((sheet) => sheet.properties.title === title);
  if (!exists) await client.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title } } }] } });
  const response = await client.spreadsheets.values.get({ spreadsheetId, range: `'${title.replace(/'/g, "''")}'!1:1` });
  const existing = response.data.values?.[0] || [];
  const headers = [...existing];
  requestedHeaders.forEach((header) => { if (!headers.includes(header)) headers.push(header); });
  if (!headers.length) throw new Error(`No se pudieron determinar las columnas de ${title}.`);
  if (headers.length !== existing.length) await client.spreadsheets.values.update({ spreadsheetId, range: `'${title.replace(/'/g, "''")}'!A1:${columnName(headers.length)}1`, valueInputOption: "RAW", requestBody: { values: [headers] } });
  return headers;
}

async function synchronizeGroup(client, spreadsheetId, title, entries) {
  const latest = new Map();
  entries.forEach((entry) => {
    const current = latest.get(entry.data.entityId);
    const created = entry.data.createdAt?.toMillis ? entry.data.createdAt.toMillis() : 0;
    const currentCreated = current?.data.createdAt?.toMillis ? current.data.createdAt.toMillis() : -1;
    if (!current || created >= currentCreated) latest.set(entry.data.entityId, entry);
  });
  const rows = [...latest.values()];
  const requestedHeaders = [...new Set(rows.flatMap((entry) => Object.keys(entry.data.row || {}))), "SyncEstado", "SyncActualizadaEn"];
  const headers = await ensureSheet(client, spreadsheetId, title, requestedHeaders);
  const idHeader = headers.includes("Id") ? "Id" : headers[0];
  const idColumn = headers.indexOf(idHeader) + 1;
  const existingResponse = await client.spreadsheets.values.get({ spreadsheetId, range: `'${title.replace(/'/g, "''")}'!${columnName(idColumn)}2:${columnName(idColumn)}` });
  const existingIds = new Map();
  (existingResponse.data.values || []).forEach((row, index) => { if (row[0] !== "" && row[0] !== undefined) existingIds.set(String(row[0]), index + 2); });
  let nextRow = (existingResponse.data.values || []).length + 2;
  const values = rows.map((entry) => {
    const rowNumber = existingIds.get(String(entry.data.entityId)) || nextRow++;
    const data = { ...(entry.data.row || {}), SyncEstado: entry.data.operation === "DELETE" ? "ELIMINADO" : "SINCRONIZADO", SyncActualizadaEn: new Date().toISOString() };
    return { range: `'${title.replace(/'/g, "''")}'!A${rowNumber}:${columnName(headers.length)}${rowNumber}`, values: [headers.map((header) => cell(data[header]))] };
  });
  if (values.length) await client.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: "USER_ENTERED", data: values } });
  return new Set(rows.map((entry) => entry.data.entityId));
}

async function updateQueue(entries, status, error = "") {
  const chunks = [];
  for (let index = 0; index < entries.length; index += 400) chunks.push(entries.slice(index, index + 400));
  for (const chunk of chunks) {
    const batch = db.batch();
    chunk.forEach((entry) => {
      if (status === "SYNCED") batch.update(entry.ref, { status, syncedAt: now(), expiresAt: new Date(Date.now() + 7 * 86400000), error: "" });
      else {
        const terminal = Number(entry.data.attempts || 0) >= 7;
        batch.update(entry.ref, { status: terminal ? "ERROR" : "PENDING", attempts: FieldValue.increment(1), lastAttemptAt: now(), expiresAt: terminal ? new Date(Date.now() + 30 * 86400000) : null, error: String(error).slice(0, 500) });
      }
    });
    await batch.commit();
  }
}

async function synchronizeSheets(spreadsheetId) {
  const snapshot = await db.collection("syncQueue").where("status", "==", "PENDING").limit(400).get();
  if (snapshot.empty) return { processed: 0, pending: 0 };
  const entries = snapshot.docs.map((item) => ({ ref: item.ref, data: item.data() }));
  const groups = new Map();
  entries.forEach((entry) => groups.set(entry.data.sheet, [...(groups.get(entry.data.sheet) || []), entry]));
  const client = await sheetsClient(); let processed = 0; const errors = [];
  for (const [title, group] of groups) {
    try { await synchronizeGroup(client, spreadsheetId, title, group); await updateQueue(group, "SYNCED"); processed += group.length; }
    catch (error) { await updateQueue(group, "PENDING", error.message || error); errors.push({ sheet: title, message: String(error.message || error) }); }
  }
  return { processed, pending: Math.max(0, snapshot.size - processed), errors };
}

module.exports = { columnName, synchronizeSheets };
