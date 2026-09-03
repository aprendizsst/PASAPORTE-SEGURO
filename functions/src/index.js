const crypto = require("node:crypto");
const nodemailer = require("nodemailer");
const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret, defineString } = require("firebase-functions/params");
const { logger } = require("firebase-functions");
const {
  db, FieldValue, getStorage, GAME_NAMES, GAME_LIMITS, cleanId, normalize, audienceKey,
  missionAssignedTo, sha256, randomId, now, toIso, limited, clamp, createPassword,
  verifyPasswordAsync, createSessionToken, requireSession, requireAdmin, publicUser, publicMission,
  publicBadge, validateMission, validateBadge, missionCode, normalizeCode, sheetQueue,
  userSheetRow, missionSheetRow,
} = require("./core");
const { buildReport, buildReportData, loadReportCollections } = require("./report");
const { synchronizeSheets } = require("./sheets-sync");

const SESSION_SECRET = defineSecret("PASSPORT_SESSION_SECRET");
const SMTP_PASSWORD = defineSecret("PASSPORT_SMTP_PASSWORD");
const SMTP_HOST = defineString("PASSPORT_SMTP_HOST", { default: "smtp.gmail.com" });
const SMTP_PORT = defineString("PASSPORT_SMTP_PORT", { default: "465" });
const SMTP_USER = defineString("PASSPORT_SMTP_USER", { default: "" });
const SMTP_FROM = defineString("PASSPORT_SMTP_FROM", { default: "Pasaporte Seguro" });
const SHEET_ID = defineString("PASSPORT_SHEET_ID", { default: "" });
const ALLOWED_ORIGINS = defineString("PASSPORT_ALLOWED_ORIGINS", { default: "https://aprendizsst.github.io" });

const WRITE_ACTIONS = new Set(["register", "startMission", "completeMission", "updateAvatar", "completeBonus", "requestPasswordReset", "verifyPasswordResetCode", "resetPassword", "adminCreateMission", "adminEditMission", "adminDeleteMission", "adminCreateBadge", "adminEditBadge", "adminDeleteBadge", "adminEditUser", "adminDeleteUser", "adminCreateRecoveryCode", "adminManageBonusRecord"]);
const memoryCache = new Map();

async function cached(key, ttlMs, loader) {
  const current = memoryCache.get(key);
  if (current?.value !== undefined && current.expiresAt > Date.now()) return current.value;
  if (current?.promise) return current.promise;
  const promise = Promise.resolve().then(loader).then((value) => {
    memoryCache.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  }).catch((error) => {
    memoryCache.delete(key);
    throw error;
  });
  memoryCache.set(key, { promise, expiresAt: 0 });
  return promise;
}
function invalidateCache(...keys) { keys.forEach((key) => memoryCache.delete(key)); }

function secret() {
  const value = SESSION_SECRET.value();
  if (!value || value.length < 32) throw new Error("El backend no tiene configurado PASSPORT_SESSION_SECRET.");
  return value;
}
function retryable(message) { const error = new Error(message); error.retryable = true; return error; }
function parseBody(request) {
  if (request.body && typeof request.body === "object" && !Buffer.isBuffer(request.body)) return request.body;
  const text = Buffer.isBuffer(request.body) ? request.body.toString("utf8") : String(request.body || request.rawBody || "{}");
  try { return JSON.parse(text || "{}"); } catch { throw new Error("La solicitud no tiene un formato válido."); }
}
function cors(request, response) {
  const origin = String(request.headers.origin || "");
  const allowed = ALLOWED_ORIGINS.value().split(",").map((value) => value.trim()).filter(Boolean);
  if (origin && allowed.includes(origin)) response.set("Access-Control-Allow-Origin", origin);
  response.set("Vary", "Origin");
  response.set("Access-Control-Allow-Headers", "Content-Type");
  response.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.set("Cache-Control", "no-store");
}
async function userByCedula(cedula) {
  const index = await db.collection("userKeys").doc(`cedula_${sha256(cleanId(cedula))}`).get();
  if (!index.exists) return null;
  const snapshot = await db.collection("users").doc(String(index.data().userId)).get();
  return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
}
async function allMissions() { return cached("missions", 5000, async () => { const snapshot = await db.collection("missions").get(); return snapshot.docs.map((item) => ({ id: item.id, ...item.data() })); }); }
async function activeMissions() { return (await allMissions()).filter((mission) => mission.active); }
async function activeBadges() {
  return cached("badges", 10000, async () => { const snapshot = await db.collection("badges").where("active", "==", true).get(); return snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => Number(a.order || 100) - Number(b.order || 100)); });
}
async function allowedMissions(user) { return (await activeMissions()).filter((mission) => user.role === "ADMIN" || missionAssignedTo(mission.audience, user.uad)); }
async function allowedMission(user, missionId) {
  const snapshot = await db.collection("missions").doc(String(missionId)).get();
  if (!snapshot.exists) throw new Error("La misión no existe.");
  const mission = { id: snapshot.id, ...snapshot.data() };
  if (!mission.active || !missionAssignedTo(mission.audience, user.uad)) throw new Error("La misión no está disponible para tu UAD.");
  return mission;
}
async function userBundle(user) {
  const [allMissionRows, progressSnapshot, bonusSnapshot, badges] = await Promise.all([
    allMissions(), db.collection("progress").where("userId", "==", user.id).get(),
    db.collection("bonus").where("userId", "==", user.id).get(), activeBadges(),
  ]);
  const missions = allMissionRows.filter((mission) => mission.active && (user.role === "ADMIN" || missionAssignedTo(mission.audience, user.uad)));
  const progress = progressSnapshot.docs.map((item) => item.data());
  const completed = progress.filter((row) => row.status === "COMPLETADA").map((row) => Number(row.missionId));
  const started = progress.filter((row) => row.status === "INICIADA").map((row) => Number(row.missionId));
  const history = {};
  progress.forEach((row) => { if (row.status === "COMPLETADA") history[Number(row.missionId)] = toIso(row.completedAt); });
  const completedSet = new Set(completed.map(String));
  const historyMissions = allMissionRows.filter((mission) => completedSet.has(String(mission.id)));
  const bonusScores = {}; const bonusRecords = {};
  bonusSnapshot.docs.forEach((item) => { const row = item.data(); bonusScores[row.gameId] = Number(row.score) || 0; bonusRecords[row.gameId] = Number(row.record) || 0; });
  return { user: publicUser(user), missions: missions.map((mission) => publicMission(mission, user.role === "ADMIN")), historyMissions: historyMissions.map((mission) => publicMission(mission)), completed, started, history, bonusCompleted: Object.keys(bonusScores), bonusScores, bonusRecords, badgeDefinitions: badges.map(publicBadge) };
}

async function enforceRate(key, maximum, minutes) {
  const ref = db.collection("rateLimits").doc(sha256(key));
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.exists ? snapshot.data() : {};
    const resetAt = current.resetAt?.toMillis ? current.resetAt.toMillis() : 0;
    const count = resetAt > Date.now() ? Number(current.count) || 0 : 0;
    if (count >= maximum) throw new Error("Demasiados intentos. Espera unos minutos antes de volver a intentar.");
    const nextResetAt = new Date(Date.now() + minutes * 60000);
    transaction.set(ref, { count: count + 1, resetAt: nextResetAt, expiresAt: nextResetAt, updatedAt: now() });
  });
}

async function catalogsApi() {
  return cached("catalogs", 300000, async () => {
    const snapshot = await db.collection("catalogs").where("active", "==", true).get();
    const rows = snapshot.docs.map((item) => item.data());
    return { cargos: [...new Set(rows.filter((row) => row.type === "CARGO").map((row) => row.value))], uads: [...new Set(rows.filter((row) => row.type === "UAD").map((row) => row.value))] };
  });
}

async function registerApi(request) {
  const input = request.user || {}; const cedula = cleanId(input.cedula); const email = String(input.email || "").trim().toLowerCase();
  const user = { id: randomId(), name: limited(input.name, 120, "El nombre completo es obligatorio."), cedula, phone: limited(input.phone, 30, "El teléfono es obligatorio."), email, cargo: limited(input.cargo, 120, "El cargo es obligatorio."), uad: limited(input.uad, 120, "La UAD es obligatoria."), avatar: String(input.avatar || "avatar:v2:2:0:1:0:"), role: "USER", active: true, createdAt: now(), sessionVersion: 1, ...createPassword(request.password) };
  if (cedula.length < 5) throw new Error("La cédula no tiene un formato válido.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("El correo no tiene un formato válido.");
  const cedulaRef = db.collection("userKeys").doc(`cedula_${sha256(cedula)}`); const emailRef = db.collection("userKeys").doc(`email_${sha256(email)}`); const userRef = db.collection("users").doc(user.id);
  await db.runTransaction(async (transaction) => {
    const [cedulaKey, emailKey] = await Promise.all([transaction.get(cedulaRef), transaction.get(emailRef)]);
    if (cedulaKey.exists) throw new Error("Ya existe un pasaporte registrado con esa cédula.");
    if (emailKey.exists) throw new Error("Ya existe un pasaporte registrado con ese correo.");
    transaction.create(userRef, user); transaction.create(cedulaRef, { userId: user.id }); transaction.create(emailRef, { userId: user.id });
    sheetQueue(transaction, "Usuarios", user.id, userSheetRow(user));
  });
  return { ...(await userBundle(user)), token: createSessionToken(user, secret()) };
}

async function loginApi(request) {
  const cedula = cleanId(request.cedula);
  const user = await userByCedula(cedula);
  if (!user || !user.active || !(await verifyPasswordAsync(String(request.password || ""), user))) {
    await enforceRate(`login:${cedula}`, 10, 5);
    throw new Error("Cédula o contraseña incorrecta.");
  }
  if (user.passwordAlgorithm !== "pbkdf2-sha256-v1") {
    const upgraded = createPassword(String(request.password || ""));
    await db.collection("users").doc(user.id).update(upgraded); Object.assign(user, upgraded);
  }
  return { ...(await userBundle(user)), token: createSessionToken(user, secret()) };
}

async function sessionApi(request) { const user = await requireSession(request.token, secret()); return { ...(await userBundle(user)), token: String(request.token) }; }
async function missionsApi(request) { const user = await requireSession(request.token, secret()); return { missions: (await allowedMissions(user)).map((mission) => publicMission(mission, user.role === "ADMIN")), uad: user.uad || "" }; }

function progressSheetRow(row) { return { Id: row.id, UsuarioId: row.userId, MisionId: row.missionId, Estado: row.status, IniciadaEn: toIso(row.startedAt), CompletadaEn: toIso(row.completedAt) }; }
async function startMissionApi(request) {
  const user = await requireSession(request.token, secret()); const mission = await allowedMission(user, request.missionId); const ref = db.collection("progress").doc(`${user.id}_${mission.id}`);
  let output;
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref); const current = snapshot.exists ? snapshot.data() : null;
    const row = current?.status === "COMPLETADA" ? { ...current, id: ref.id } : { id: ref.id, userId: user.id, missionId: Number(mission.id), status: "INICIADA", startedAt: current?.startedAt || now(), completedAt: current?.completedAt || null, updatedAt: now() };
    transaction.set(ref, row, { merge: true }); if (!user.isLoadTest) sheetQueue(transaction, "Progreso", row.id, progressSheetRow(row)); output = row;
  });
  return { missionId: Number(mission.id), status: output.status };
}

async function storeEvidence(user, mission, input, requestId) {
  if (!input) return null;
  const mime = String(input.mime || "").toLowerCase();
  if (!mime.startsWith("image/") && !mime.startsWith("video/")) throw new Error("La evidencia debe ser una foto o un video.");
  const bytes = Buffer.from(String(input.data || ""), "base64");
  if (!bytes.length || bytes.length > 7 * 1024 * 1024) throw new Error("La evidencia supera 7 MB.");
  const safeName = String(input.name || "evidencia").replace(/[^0-9A-Za-z._ -]/g, "_").replace(/\s+/g, "-").slice(0, 120);
  const objectName = `evidence/${mission.id}/${user.id}/${requestId || randomId()}-${safeName}`;
  const file = getStorage().bucket().file(objectName);
  await file.save(bytes, { resumable: false, contentType: mime, metadata: { cacheControl: "private,max-age=0,no-store" } });
  const evidence = { id: requestId || randomId(), userId: user.id, missionId: Number(mission.id), objectName, fileName: safeName, mime, size: bytes.length, status: "RECIBIDA", createdAt: now(), url: `gs://${getStorage().bucket().name}/${objectName}` };
  await db.collection("evidence").doc(evidence.id).set(evidence);
  return evidence;
}

async function completeMissionApi(request) {
  const user = await requireSession(request.token, secret()); const mission = await allowedMission(user, request.missionId);
  if (!mission.sealCode || normalizeCode(request.sealCode) !== normalizeCode(mission.sealCode)) throw new Error("El código de la misión no es correcto.");
  if (mission.evidenceRequired && !request.evidence) throw new Error("Esta misión requiere una foto o un video como evidencia.");
  const evidence = await storeEvidence(user, mission, request.evidence, request.requestId);
  const ref = db.collection("progress").doc(`${user.id}_${mission.id}`); let completedAt;
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref); const current = snapshot.exists ? snapshot.data() : null;
    const row = { id: ref.id, userId: user.id, missionId: Number(mission.id), status: "COMPLETADA", startedAt: current?.startedAt || now(), completedAt: current?.completedAt || now(), updatedAt: now() };
    transaction.set(ref, row, { merge: true }); if (!user.isLoadTest) sheetQueue(transaction, "Progreso", row.id, progressSheetRow(row));
    if (evidence && !user.isLoadTest) sheetQueue(transaction, "Evidencias", evidence.id, { Id: evidence.id, UsuarioId: evidence.userId, MisionId: evidence.missionId, ArchivoId: evidence.objectName, NombreArchivo: evidence.fileName, TipoMime: evidence.mime, TamanoBytes: evidence.size, Url: evidence.url, Estado: evidence.status, CreadoEn: toIso(evidence.createdAt) });
    completedAt = toIso(row.completedAt);
  });
  return { missionId: Number(mission.id), status: "COMPLETADA", completedAt };
}

async function updateAvatarApi(request) {
  const user = await requireSession(request.token, secret()); const avatar = String(request.avatar || "");
  if (!/^avatar:v[12]:/.test(avatar) || avatar.length > 180) throw new Error("Avatar no permitido.");
  const updated = { ...user, avatar, updatedAt: now() };
  await db.runTransaction(async (transaction) => { transaction.update(db.collection("users").doc(user.id), { avatar, updatedAt: updated.updatedAt }); sheetQueue(transaction, "Usuarios", user.id, userSheetRow(updated)); });
  return { avatar };
}

function bonusSheetRow(row) { return { Id: row.id, UsuarioId: row.userId, JuegoId: row.gameId, Puntaje: row.score, CompletadoEn: toIso(row.completedAt), Record: row.record }; }
async function completeBonusApi(request) {
  const user = await requireSession(request.token, secret()); const gameId = String(request.gameId || ""); const limits = GAME_LIMITS[gameId];
  if (!limits) throw new Error("Minijuego no permitido.");
  const score = clamp(request.score, 0, limits[0], 0); const record = clamp(request.record ?? score, 0, limits[1], 0); const ref = db.collection("bonus").doc(`${user.id}_${gameId}`); let output;
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref); const current = snapshot.exists ? snapshot.data() : {};
    const row = { id: ref.id, userId: user.id, gameId, score: Math.max(Number(current.score) || 0, score), record: Math.max(Number(current.record) || 0, record), completedAt: record > (Number(current.record) || 0) ? now() : current.completedAt || now(), updatedAt: now() };
    transaction.set(ref, row); if (!user.isLoadTest) sheetQueue(transaction, "Bonus", row.id, bonusSheetRow(row));
    output = row;
  });
  invalidateCache("leaderboard");
  return { gameId, score, bestScore: output.score, bestRecord: output.record, completed: true };
}

async function bonusLeaderboardApi(request) {
  const current = await requireSession(request.token, secret());
  const baseEntries = await cached("leaderboard", 20000, async () => {
    const gameIds = ["forest-run", "station-pairs", "wellbeing-flight", "target"];
    const snapshots = await Promise.all(gameIds.map((gameId) => db.collection("bonus").where("gameId", "==", gameId).orderBy("record", "desc").limit(10).get()));
    const rows = snapshots.flatMap((snapshot, index) => snapshot.docs.map((item) => ({ gameId: gameIds[index], ...item.data() })));
    const userIds = [...new Set(rows.map((row) => row.userId).filter(Boolean))];
    const users = userIds.length ? await db.getAll(...userIds.map((id) => db.collection("users").doc(String(id)))) : [];
    const usersById = new Map(users.filter((item) => item.exists).map((item) => [item.id, item.data()]));
    return rows.map((row) => ({ gameId: row.gameId, userId: row.userId, name: usersById.get(row.userId)?.name || "Usuario eliminado", uad: usersById.get(row.userId)?.uad || "", record: Number(row.record) || 0, completedAt: toIso(row.completedAt) }));
  });
  const entries = baseEntries.map((entry) => ({ ...entry, isCurrent: entry.userId === current.id }));
  return { entries };
}

async function sendRecoveryEmail(user, code) {
  const host = SMTP_HOST.value(); const account = SMTP_USER.value(); const password = SMTP_PASSWORD.value();
  if (!host || !account || !password) throw new Error("El envío de correo no está configurado. Solicita al administrador un código de respaldo.");
  const transporter = nodemailer.createTransport({ host, port: Number(SMTP_PORT.value()) || 465, secure: Number(SMTP_PORT.value()) === 465, auth: { user: account, pass: password }, pool: true, maxConnections: 5 });
  await transporter.sendMail({ from: `${SMTP_FROM.value()} <${account}>`, to: user.email, subject: "Código para restablecer tu Pasaporte Seguro", text: `Hola ${user.name || "viajero"},\n\nTu código de recuperación es: ${code}\n\nVence en 15 minutos y solo puede usarse una vez.\n\nPasaporte Seguro · Festival 2026` });
}
function recoveryHash(recoveryId, value) { return sha256(`${recoveryId}:${normalizeCode(value)}:${secret()}`); }
async function requestPasswordResetApi(request) {
  const cedula = cleanId(request.cedula); const email = normalize(request.email); await enforceRate(`recovery:${cedula}`, 4, 15);
  const generic = { requested: true, message: "Si los datos coinciden, recibirás un código de recuperación en tu correo." };
  const user = await userByCedula(cedula); if (!user || !user.active || normalize(user.email) !== email) return generic;
  const code = String(crypto.randomInt(100000, 1000000)); const recovery = { id: randomId(), userId: user.id, expiresAt: new Date(Date.now() + 15 * 60000), attempts: 0, used: false, channel: "EMAIL", createdAt: now() }; recovery.codeHash = recoveryHash(recovery.id, code);
  await db.collection("recoveries").doc(recovery.id).set(recovery);
  try { await sendRecoveryEmail(user, code); } catch (error) { await db.collection("recoveries").doc(recovery.id).update({ used: true }); throw error; }
  return generic;
}
async function verifyPasswordResetCodeApi(request) {
  const user = await userByCedula(request.cedula); if (!user || !user.active) throw new Error("El código no es válido o ya venció.");
  const snapshot = await db.collection("recoveries").where("userId", "==", user.id).get();
  const rows = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).filter((row) => !row.used && row.expiresAt.toMillis() > Date.now()).sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
  const matched = rows.find((row) => row.attempts < 5 && recoveryHash(row.id, request.code) === row.codeHash);
  if (!matched) { if (rows[0]) await db.collection("recoveries").doc(rows[0].id).update({ attempts: FieldValue.increment(1) }); throw new Error("El código no es válido o ya venció."); }
  const ticket = crypto.randomBytes(32).toString("base64url"); await db.collection("recoveries").doc(matched.id).update({ verifiedAt: now(), ticketHash: recoveryHash(matched.id, ticket), ticketExpiresAt: new Date(Date.now() + 10 * 60000) });
  return { verified: true, ticket, expiresInMinutes: 10 };
}
async function resetPasswordApi(request) {
  const user = await userByCedula(request.cedula); if (!user || !user.active) throw new Error("La validación del código no es válida o ya venció.");
  const snapshot = await db.collection("recoveries").where("userId", "==", user.id).get();
  const matched = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).find((row) => !row.used && row.ticketExpiresAt?.toMillis() > Date.now() && recoveryHash(row.id, request.ticket) === row.ticketHash);
  if (!matched) throw new Error("La validación del código no es válida o ya venció. Solicita un código nuevo.");
  const password = createPassword(request.password); const updated = { ...user, ...password, sessionVersion: Number(user.sessionVersion || 1) + 1, updatedAt: now() };
  await db.runTransaction(async (transaction) => { transaction.update(db.collection("users").doc(user.id), { ...password, sessionVersion: updated.sessionVersion, updatedAt: updated.updatedAt }); transaction.update(db.collection("recoveries").doc(matched.id), { used: true, ticketHash: "", usedAt: now() }); sheetQueue(transaction, "Usuarios", user.id, userSheetRow(updated)); });
  return { reset: true };
}

async function canonicalAudience(value) {
  if (audienceKey(value) === "todas las uad") return "Todas las UAD";
  const [catalogs, users] = await Promise.all([catalogsApi(), db.collection("users").where("active", "==", true).get()]);
  const options = [...catalogs.uads, ...users.docs.map((item) => item.data().uad)].filter(Boolean);
  const canonical = options.find((item) => audienceKey(item) === audienceKey(value));
  if (!canonical) throw new Error("La UAD asignada no existe. Actualiza el panel y selecciona una UAD válida.");
  return canonical;
}
async function nextMissionId(transaction) {
  const ref = db.collection("metadata").doc("counters"); const snapshot = await transaction.get(ref); const value = Math.max(0, Number(snapshot.data()?.missionId) || 0) + 1; transaction.set(ref, { missionId: value }, { merge: true }); return value;
}
async function adminCreateMissionApi(request) {
  const admin = await requireAdmin(request.token, secret()); const value = validateMission(request.mission || {}); value.audience = await canonicalAudience(value.audience); let mission;
  await db.runTransaction(async (transaction) => { const id = await nextMissionId(transaction); mission = { id, ...value, sealCode: missionCode(), active: true, createdAt: now(), createdBy: admin.id, updatedAt: now() }; transaction.create(db.collection("missions").doc(String(id)), mission); sheetQueue(transaction, "Misiones", id, missionSheetRow(mission)); });
  invalidateCache("missions"); return { id: mission.id, sealCode: mission.sealCode, audience: mission.audience };
}
async function adminEditMissionApi(request) {
  await requireAdmin(request.token, secret()); const id = String(request.mission?.id || ""); const ref = db.collection("missions").doc(id); const snapshot = await ref.get(); if (!snapshot.exists) throw new Error("La misión ya no existe.");
  const value = validateMission(request.mission); value.audience = await canonicalAudience(value.audience); const mission = { id: Number(id), ...snapshot.data(), ...value, sealCode: request.regenerateCode ? missionCode() : snapshot.data().sealCode, updatedAt: now() };
  await db.runTransaction(async (transaction) => { transaction.set(ref, mission); sheetQueue(transaction, "Misiones", id, missionSheetRow(mission)); }); invalidateCache("missions"); return { mission: publicMission(mission, true) };
}
async function adminDeleteMissionApi(request) {
  await requireAdmin(request.token, secret()); const ref = db.collection("missions").doc(String(request.missionId)); const snapshot = await ref.get(); if (!snapshot.exists) throw new Error("La misión ya no existe."); const mission = { id: Number(snapshot.id), ...snapshot.data(), active: false, updatedAt: now() };
  await db.runTransaction(async (transaction) => { transaction.update(ref, { active: false, updatedAt: mission.updatedAt }); sheetQueue(transaction, "Misiones", mission.id, missionSheetRow(mission)); }); invalidateCache("missions"); return { deleted: true };
}
function badgeSheetRow(row) { return { Id: row.id, Titulo: row.title, Descripcion: row.description, Icono: row.icon, ColorPrimario: row.primaryColor, ColorSecundario: row.secondaryColor, TipoCriterio: row.criterion, Meta: row.goal, Estacion: row.station || "", Activa: Boolean(row.active), Orden: row.order, CreadaEn: toIso(row.createdAt), CreadaPor: row.createdBy || "", EditadaEn: toIso(row.updatedAt) }; }
async function adminCreateBadgeApi(request) { const admin = await requireAdmin(request.token, secret()); const badge = { id: randomId(), ...validateBadge(request.badge || {}), active: true, createdAt: now(), createdBy: admin.id, updatedAt: now() }; await db.runTransaction(async (transaction) => { transaction.create(db.collection("badges").doc(badge.id), badge); sheetQueue(transaction, "Insignias", badge.id, badgeSheetRow(badge)); }); invalidateCache("badges"); return { badge: publicBadge(badge) }; }
async function adminEditBadgeApi(request) { await requireAdmin(request.token, secret()); const ref = db.collection("badges").doc(String(request.badge?.id || "")); const snapshot = await ref.get(); if (!snapshot.exists) throw new Error("La insignia ya no existe."); const badge = { id: snapshot.id, ...snapshot.data(), ...validateBadge(request.badge), updatedAt: now() }; await db.runTransaction(async (transaction) => { transaction.set(ref, badge); sheetQueue(transaction, "Insignias", badge.id, badgeSheetRow(badge)); }); invalidateCache("badges"); return { badge: publicBadge(badge) }; }
async function adminDeleteBadgeApi(request) { await requireAdmin(request.token, secret()); const ref = db.collection("badges").doc(String(request.badgeId)); const snapshot = await ref.get(); if (!snapshot.exists) throw new Error("La insignia ya no existe."); const badge = { id: snapshot.id, ...snapshot.data(), active: false, updatedAt: now() }; await db.runTransaction(async (transaction) => { transaction.update(ref, { active: false, updatedAt: badge.updatedAt }); sheetQueue(transaction, "Insignias", badge.id, badgeSheetRow(badge)); }); invalidateCache("badges"); return { deleted: true }; }

async function adminEditUserApi(request) {
  const admin = await requireAdmin(request.token, secret()); const input = request.user || {}; const ref = db.collection("users").doc(String(input.id || "")); const snapshot = await ref.get(); if (!snapshot.exists) throw new Error("El usuario ya no existe."); const current = { id: snapshot.id, ...snapshot.data() }; if (current.role === "ADMIN" && current.id === admin.id) throw new Error("La cuenta administradora principal no se edita desde esta vista.");
  const updated = { ...current, name: limited(input.name, 120, "El nombre es obligatorio."), cedula: cleanId(input.cedula), phone: String(input.phone || "").slice(0, 30), email: limited(input.email, 160, "El correo es obligatorio.").toLowerCase(), cargo: String(input.cargo || "").slice(0, 120), uad: limited(input.uad, 120, "La UAD es obligatoria."), sessionVersion: Number(current.sessionVersion || 1) + 1, updatedAt: now() };
  const oldCedula = db.collection("userKeys").doc(`cedula_${sha256(current.cedula)}`); const oldEmail = db.collection("userKeys").doc(`email_${sha256(current.email)}`); const newCedula = db.collection("userKeys").doc(`cedula_${sha256(updated.cedula)}`); const newEmail = db.collection("userKeys").doc(`email_${sha256(updated.email)}`);
  await db.runTransaction(async (transaction) => { const [cedulaKey, emailKey] = await Promise.all([transaction.get(newCedula), transaction.get(newEmail)]); if (cedulaKey.exists && cedulaKey.data().userId !== current.id) throw new Error("La cédula ya está registrada."); if (emailKey.exists && emailKey.data().userId !== current.id) throw new Error("El correo ya está registrado."); transaction.set(ref, updated); if (oldCedula.path !== newCedula.path) transaction.delete(oldCedula); if (oldEmail.path !== newEmail.path) transaction.delete(oldEmail); transaction.set(newCedula, { userId: current.id }); transaction.set(newEmail, { userId: current.id }); sheetQueue(transaction, "Usuarios", current.id, userSheetRow(updated)); });
  return { user: { id: updated.id, name: updated.name, cedula: updated.cedula, phone: updated.phone, email: updated.email, cargo: updated.cargo, uad: updated.uad } };
}
async function adminDeleteUserApi(request) {
  const admin = await requireAdmin(request.token, secret()); const ref = db.collection("users").doc(String(request.userId)); const snapshot = await ref.get(); if (!snapshot.exists) throw new Error("El usuario ya no existe."); const current = { id: snapshot.id, ...snapshot.data() }; if (current.id === admin.id || current.role === "ADMIN") throw new Error("No puedes eliminar una cuenta administradora desde esta vista.");
  const anonymized = { ...current, name: "Usuario eliminado", cedula: "", phone: "", email: "", cargo: "", avatar: "", active: false, sessionVersion: Number(current.sessionVersion || 1) + 1, deletedAt: now(), updatedAt: now() };
  await db.runTransaction(async (transaction) => { transaction.set(ref, anonymized); transaction.delete(db.collection("userKeys").doc(`cedula_${sha256(current.cedula)}`)); transaction.delete(db.collection("userKeys").doc(`email_${sha256(current.email)}`)); sheetQueue(transaction, "Usuarios", current.id, userSheetRow(anonymized)); }); return { deleted: true };
}
async function adminCreateRecoveryCodeApi(request) { await requireAdmin(request.token, secret()); const user = await db.collection("users").doc(String(request.userId)).get(); if (!user.exists || !user.data().active) throw new Error("El usuario ya no está activo."); const code = crypto.randomBytes(5).toString("base64url").toUpperCase().slice(0, 8); const recovery = { id: randomId(), userId: user.id, expiresAt: new Date(Date.now() + 24 * 60 * 60000), attempts: 0, used: false, channel: "ADMIN", createdAt: now() }; recovery.codeHash = recoveryHash(recovery.id, code); await db.collection("recoveries").doc(recovery.id).set(recovery); return { code }; }
async function adminEvidenceDataApi(request) {
  await requireAdmin(request.token, secret());
  const snapshot = await db.collection("evidence").doc(String(request.evidenceId || "")).get();
  if (!snapshot.exists) throw new Error("La evidencia ya no existe.");
  const evidence = snapshot.data();
  if (!evidence.objectName && /^https:\/\//i.test(String(evidence.url || ""))) return { url: evidence.url };
  if (!evidence.objectName) throw new Error("La evidencia heredada no tiene un archivo disponible.");
  const [buffer] = await getStorage().bucket().file(String(evidence.objectName)).download();
  if (buffer.length > 8 * 1024 * 1024) throw new Error("La evidencia supera el tamaño permitido para revisión.");
  return { data: buffer.toString("base64"), mime: evidence.mime || "application/octet-stream", fileName: evidence.fileName || "evidencia" };
}
async function adminManageBonusRecordApi(request) { await requireAdmin(request.token, secret()); const mode = String(request.mode || ""); if (!["reset", "delete", "resetAll"].includes(mode)) throw new Error("Acción de récord no permitida."); if (mode === "resetAll") { const snapshot = await db.collection("bonus").get(); const batches = []; let batch = db.batch(); let count = 0; for (const item of snapshot.docs) { const row = { id: item.id, ...item.data(), record: 0, updatedAt: now() }; batch.update(item.ref, { record: 0, updatedAt: row.updatedAt }); sheetQueue(batch, "Bonus", row.id, bonusSheetRow(row)); if (++count % 200 === 0) { batches.push(batch.commit()); batch = db.batch(); } } if (count % 200) batches.push(batch.commit()); await Promise.all(batches); invalidateCache("leaderboard"); return { mode, affected: snapshot.size }; } const ref = db.collection("bonus").doc(String(request.recordId)); const snapshot = await ref.get(); if (!snapshot.exists) throw new Error("El resultado ya no existe."); const row = { id: snapshot.id, ...snapshot.data() }; await db.runTransaction(async (transaction) => { if (mode === "reset") { const updated = { ...row, record: 0, updatedAt: now() }; transaction.update(ref, { record: 0, updatedAt: updated.updatedAt }); sheetQueue(transaction, "Bonus", row.id, bonusSheetRow(updated)); } else { transaction.delete(ref); sheetQueue(transaction, "Bonus", row.id, bonusSheetRow({ ...row, score: 0, record: 0 }), "DELETE"); } }); invalidateCache("leaderboard"); return { mode, recordId: row.id }; }

async function adminDashboardApi(request) {
  await requireAdmin(request.token, secret()); const data = await loadReportCollections(); const report = buildReportData(data); const activeMissionDocs = data.missions.filter((mission) => mission.active); const activeBadgeDocs = data.badges.filter((badge) => badge.active); const uads = [...new Set([...report.users.map((row) => row.UAD), ...(await catalogsApi()).uads])].filter(Boolean);
  const usersById = new Map(data.users.map((item) => [item.id, item])); const missionsById = new Map(data.missions.map((item) => [String(item.id), item]));
  return { people: report.users.map((row) => ({ id: data.users.find((user) => user.cedula === row.Cedula)?.id || "", name: row.Nombre, cedula: row.Cedula, phone: row.Telefono, email: row.Correo, cargo: row.Cargo, uad: row.UAD, completed: row.MisionesCompletadas, total: row.MisionesDisponibles, points: row.Puntos, createdAt: row.CreadoEn })), missions: activeMissionDocs.map((mission) => publicMission(mission, true)), evidence: data.evidence.filter((row) => !usersById.get(row.userId)?.isLoadTest).sort((a, b) => toIso(b.createdAt).localeCompare(toIso(a.createdAt))).slice(0, 100).map((row) => ({ id: row.id, userName: usersById.get(row.userId)?.name || "Usuario eliminado", missionTitle: missionsById.get(String(row.missionId))?.title || "Misión eliminada", fileName: row.fileName || "", mime: row.mime || "", size: Number(row.size) || 0, url: row.url || "", status: row.status || "RECIBIDA", createdAt: toIso(row.createdAt) })), records: data.bonus.filter((row) => !usersById.get(row.userId)?.isLoadTest).sort((a, b) => toIso(b.completedAt).localeCompare(toIso(a.completedAt))).map((row) => { const user = usersById.get(row.userId) || {}; return { id: row.id, userId: row.userId, userName: user.name || "Usuario eliminado", uad: user.uad || "", gameId: row.gameId, gameName: GAME_NAMES[row.gameId] || row.gameId, score: Number(row.score) || 0, record: Number(row.record) || 0, completedAt: toIso(row.completedAt) }; }), badges: activeBadgeDocs.map(publicBadge), uads };
}

async function dispatch(action, request) {
  const handlers = { catalogs: catalogsApi, register: registerApi, login: loginApi, session: sessionApi, getMissions: missionsApi, startMission: startMissionApi, completeMission: completeMissionApi, updateAvatar: updateAvatarApi, completeBonus: completeBonusApi, getBonusLeaderboard: bonusLeaderboardApi, requestPasswordReset: requestPasswordResetApi, verifyPasswordResetCode: verifyPasswordResetCodeApi, resetPassword: resetPasswordApi, adminCreateMission: adminCreateMissionApi, adminEditMission: adminEditMissionApi, adminDeleteMission: adminDeleteMissionApi, adminCreateBadge: adminCreateBadgeApi, adminEditBadge: adminEditBadgeApi, adminDeleteBadge: adminDeleteBadgeApi, adminEditUser: adminEditUserApi, adminDeleteUser: adminDeleteUserApi, adminCreateRecoveryCode: adminCreateRecoveryCodeApi, adminManageBonusRecord: adminManageBonusRecordApi, adminEvidenceData: adminEvidenceDataApi, adminDashboard: adminDashboardApi, adminReportData: async (value) => { await requireAdmin(value.token, secret()); return buildReport(); } };
  if (!handlers[action]) throw new Error("Acción no reconocida."); return handlers[action](request);
}
async function dispatchIdempotent(action, request) {
  const requestId = String(request.requestId || "").replace(/[^0-9A-Za-z-]/g, "").slice(0, 80);
  if (!WRITE_ACTIONS.has(action) || !requestId) return dispatch(action, request);
  const ref = db.collection("requests").doc(`${action}_${requestId}`); let repeated;
  await db.runTransaction(async (transaction) => { const snapshot = await transaction.get(ref); const stored = snapshot.exists ? snapshot.data() : null; if (stored?.status === "DONE") { repeated = stored.result; return; } if (stored?.status === "PROCESSING" && stored.createdAt?.toMillis() > Date.now() - 120000) throw retryable("La operación continúa en proceso. Reintentando…"); transaction.set(ref, { action, status: "PROCESSING", createdAt: now(), expiresAt: new Date(Date.now() + 24 * 60 * 60000) }); });
  if (repeated !== undefined) return repeated;
  try { const result = await dispatch(action, request); await ref.set({ status: "DONE", result, completedAt: now() }, { merge: true }); return result; } catch (error) { await ref.set({ status: "FAILED", error: String(error.message || error), failedAt: now() }, { merge: true }); throw error; }
}

exports.passportApi = onRequest({ region: "us-east1", timeoutSeconds: 120, memory: "512MiB", cpu: 1, minInstances: 1, maxInstances: 100, concurrency: 10, secrets: [SESSION_SECRET, SMTP_PASSWORD] }, async (request, response) => {
  cors(request, response); if (request.method === "OPTIONS") return response.status(204).send("");
  if (request.method === "GET") return response.json({ ok: true, data: { service: "Pasaporte Seguro Firebase API", status: "ready", version: "3.3.0", primaryDatabase: "firestore" } });
  try { const body = parseBody(request); const data = await dispatchIdempotent(String(body.action || ""), body); return response.json({ ok: true, data }); }
  catch (error) { logger.error("passportApi", { message: error.message, action: (() => { try { return parseBody(request).action; } catch { return "unknown"; } })() }); return response.json({ ok: false, message: error.message || "Error inesperado.", retryable: Boolean(error.retryable) }); }
});

exports.syncPassportSheets = onSchedule({ schedule: "every 5 minutes", region: "us-east1", timeoutSeconds: 300, memory: "512MiB", maxInstances: 1 }, async () => {
  const spreadsheetId = SHEET_ID.value(); if (!spreadsheetId) { logger.info("Sin PASSPORT_SHEET_ID; sincronización omitida."); return; }
  const result = await synchronizeSheets(spreadsheetId);
  if (result.errors?.length) logger.warn("Sincronización parcial con Sheets", result);
});

exports._test = { parseBody, buildReportData };
