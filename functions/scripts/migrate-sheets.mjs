import crypto from "node:crypto";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { google } from "googleapis";

const spreadsheetId = process.env.PASSPORT_SHEET_ID || "";
const confirmed = String(process.env.MIGRATION_CONFIRM || "").toUpperCase() === "SI";
if (!spreadsheetId) throw new Error("Falta PASSPORT_SHEET_ID.");
if (!confirmed) throw new Error('MigraciÃ³n detenida. Ejecuta primero una copia y define MIGRATION_CONFIRM="SI" cuando hayas validado el proyecto destino.');

initializeApp({ credential: applicationDefault() });
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });
const auth = new google.auth.GoogleAuth({ scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] });
const sheets = google.sheets({ version: "v4", auth });
const names = ["Usuarios", "Misiones", "Progreso", "Catalogos", "Bonus", "Evidencias", "Insignias", "Recuperaciones"];

const clean = (value) => String(value ?? "").trim();
const bool = (value) => value === true || ["true", "verdadero", "si", "sÃ­", "1", "activo"].includes(clean(value).toLowerCase());
const number = (value) => Number(value) || 0;
const hash = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");
const date = (value) => {
  if (!value) return null;
  if (typeof value === "number" && value > 20000) return Timestamp.fromDate(new Date(Math.round((value - 25569) * 86400 * 1000)));
  const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? null : Timestamp.fromDate(parsed);
};
function records(values) {
  const [headers = [], ...rows] = values || [];
  return rows.filter((row) => row.some((value) => value !== "" && value !== null && value !== undefined)).map((row) => Object.fromEntries(headers.map((header, index) => [clean(header), row[index]])));
}
async function readSheet(name) {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${name}'`, valueRenderOption: "UNFORMATTED_VALUE", dateTimeRenderOption: "SERIAL_NUMBER" });
  return records(response.data.values);
}
const source = Object.fromEntries(await Promise.all(names.map(async (name) => [name, await readSheet(name).catch(() => [])])));

const users = source.Usuarios.map((row) => ({ id: clean(row.Id), name: clean(row.Nombre), cedula: clean(row.Cedula), phone: clean(row.Telefono), email: clean(row.Correo).toLowerCase(), cargo: clean(row.Cargo), uad: clean(row.UAD), avatar: clean(row.Avatar) || "avatar:v2:2:0:1:0:", role: clean(row.Rol) === "ADMIN" ? "ADMIN" : "USER", passwordSalt: clean(row.PasswordSalt), passwordHash: clean(row.PasswordHash), passwordAlgorithm: "legacy-sha256", active: bool(row.Activo), createdAt: date(row.CreadoEn) || Timestamp.now(), sessionVersion: Math.max(1, number(row.SessionVersion) || 1), migratedAt: Timestamp.now() })).filter((row) => row.id && !row.id.startsWith("LOADTEST-"));
const missions = source.Misiones.map((row) => ({ id: number(row.Id), station: clean(row.Estacion), icon: clean(row.Icono), color: clean(row.Color), title: clean(row.Titulo), description: clean(row.Descripcion), points: number(row.Puntos), audience: clean(row.Audiencia), duration: clean(row.Duracion), active: bool(row.Activa), createdAt: date(row.CreadaEn), createdBy: clean(row.CreadaPor), sealCode: clean(row.CodigoSello), evidenceRequired: bool(row.EvidenciaObligatoria), updatedAt: date(row.EditadaEn), migratedAt: Timestamp.now() })).filter((row) => row.id);
const progress = source.Progreso.map((row) => ({ id: `${clean(row.UsuarioId)}_${number(row.MisionId)}`, legacyId: clean(row.Id), userId: clean(row.UsuarioId), missionId: number(row.MisionId), status: clean(row.Estado), startedAt: date(row.IniciadaEn), completedAt: date(row.CompletadaEn), migratedAt: Timestamp.now() })).filter((row) => row.userId && row.missionId);
const bonus = source.Bonus.map((row) => ({ id: `${clean(row.UsuarioId)}_${clean(row.JuegoId)}`, legacyId: clean(row.Id), userId: clean(row.UsuarioId), gameId: clean(row.JuegoId), score: number(row.Puntaje), record: row.Record === "" || row.Record === undefined ? number(row.Puntaje) : number(row.Record), completedAt: date(row.CompletadoEn), migratedAt: Timestamp.now() })).filter((row) => row.userId && row.gameId);
const badges = source.Insignias.map((row) => ({ id: clean(row.Id), title: clean(row.Titulo), description: clean(row.Descripcion), icon: clean(row.Icono), primaryColor: clean(row.ColorPrimario), secondaryColor: clean(row.ColorSecundario), criterion: clean(row.TipoCriterio), goal: number(row.Meta), station: clean(row.Estacion), active: bool(row.Activa), order: number(row.Orden) || 100, createdAt: date(row.CreadaEn), createdBy: clean(row.CreadaPor), updatedAt: date(row.EditadaEn), migratedAt: Timestamp.now() })).filter((row) => row.id);
const evidence = source.Evidencias.map((row) => ({ id: clean(row.Id), userId: clean(row.UsuarioId), missionId: number(row.MisionId), legacyFileId: clean(row.ArchivoId), fileName: clean(row.NombreArchivo), mime: clean(row.TipoMime), size: number(row.TamanoBytes), url: clean(row.Url), status: clean(row.Estado) || "RECIBIDA", createdAt: date(row.CreadoEn), migratedAt: Timestamp.now() })).filter((row) => row.id);
const catalogs = source.Catalogos.map((row) => ({ id: `${clean(row.Tipo).toLowerCase()}_${hash(clean(row.Valor)).slice(0, 16)}`, type: clean(row.Tipo), value: clean(row.Valor), active: bool(row.Activo), migratedAt: Timestamp.now() })).filter((row) => row.type && row.value);
const legacyRecoveries = source.Recuperaciones.map((row) => ({ id: clean(row.Id), legacy: row, migratedAt: Timestamp.now() })).filter((row) => row.id);

async function write(collection, rows) {
  const writer = db.bulkWriter(); let count = 0;
  writer.onWriteError((error) => error.failedAttempts < 3);
  for (const row of rows) { const { id, ...data } = row; writer.set(db.collection(collection).doc(String(id)), data, { merge: true }); count += 1; }
  await writer.close(); return count;
}

const counts = {};
counts.users = await write("users", users);
counts.missions = await write("missions", missions);
counts.progress = await write("progress", progress);
counts.bonus = await write("bonus", bonus);
counts.badges = await write("badges", badges);
counts.evidence = await write("evidence", evidence);
counts.catalogs = await write("catalogs", catalogs);
counts.legacyRecoveries = await write("legacyRecoveries", legacyRecoveries);

const keyWriter = db.bulkWriter();
for (const user of users.filter((item) => item.active)) {
  keyWriter.set(db.collection("userKeys").doc(`cedula_${hash(user.cedula)}`), { userId: user.id }, { merge: true });
  if (user.email) keyWriter.set(db.collection("userKeys").doc(`email_${hash(user.email)}`), { userId: user.id }, { merge: true });
}
await keyWriter.close();
await db.collection("metadata").doc("counters").set({ missionId: missions.reduce((max, mission) => Math.max(max, mission.id), 0), migratedAt: Timestamp.now(), sourceSpreadsheetId: spreadsheetId }, { merge: true });

const usersById = new Map(users.map((user) => [user.id, user]));
const leaderWriter = db.bulkWriter();
for (const gameId of ["forest-run", "station-pairs", "wellbeing-flight", "target"]) {
  const entries = bonus.filter((row) => row.gameId === gameId && row.record > 0).sort((a, b) => b.record - a.record).slice(0, 10).map((row) => ({ userId: row.userId, name: usersById.get(row.userId)?.name || "Usuario eliminado", uad: usersById.get(row.userId)?.uad || "", record: row.record, completedAt: row.completedAt?.toDate().toISOString() || "" }));
  leaderWriter.set(db.collection("leaderboards").doc(gameId), { gameId, entries, updatedAt: Timestamp.now() }, { merge: true });
}
await leaderWriter.close();

console.log(JSON.stringify({ ok: true, spreadsheetId, counts, usersIndexed: users.filter((item) => item.active).length, message: "Datos copiados. Google Sheets no fue modificado ni eliminado." }, null, 2));

