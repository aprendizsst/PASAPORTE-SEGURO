const crypto = require("node:crypto");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");

if (!getApps().length) initializeApp();
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

const STATIONS = {
  "Estación Diversidad": ["◉", "#9d5cff"],
  "Estación Felicidad": ["♡", "#ffb703"],
  "Estación Seguridad": ["◇", "#12cfe0"],
  "Estación Salud": ["+", "#43d17d"],
  "Estación Amor Propio": ["✦", "#ff5c9b"],
  "Estación Ambiental": ["♧", "#8bd33f"],
};
const GAME_NAMES = {
  "word-search": "Ruta de palabras",
  sudoku: "Sudoku seguro",
  target: "Tiro al riesgo",
  "forest-run": "Carrera del bosque",
  "station-pairs": "Parejas del festival",
  "wellbeing-flight": "Vuelo del bienestar",
};
const GAME_LIMITS = {
  "word-search": [80, 80], sudoku: [120, 120], target: [200, 500],
  "forest-run": [300, 5000], "station-pairs": [250, 340], "wellbeing-flight": [300, 500],
};

function cleanId(value) { return String(value || "").replace(/[^0-9A-Za-z-]/g, "").slice(0, 25); }
function normalize(value) { return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLowerCase(); }
function audienceKey(value) { return normalize(value); }
function missionAssignedTo(audience, uad) { const key = audienceKey(audience); return key === "todas las uad" || (key !== "" && key === audienceKey(uad)); }
function sha256(value) { return crypto.createHash("sha256").update(String(value)).digest("hex"); }
function randomId() { return crypto.randomUUID(); }
function now() { return Timestamp.now(); }
function toIso(value) {
  if (!value) return "";
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}
function limited(value, max, message) {
  const text = String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
  if (!text) throw new Error(message);
  return text;
}
function clamp(value, min, max, fallback = min) { return Math.max(min, Math.min(max, Number(value) || fallback)); }
function safeEqual(a, b) {
  const first = Buffer.from(String(a)); const second = Buffer.from(String(b));
  return first.length === second.length && crypto.timingSafeEqual(first, second);
}

function createPassword(password) {
  if (String(password).length < 8 || String(password).length > 128) throw new Error("La contraseña debe tener entre 8 y 128 caracteres.");
  const salt = crypto.randomBytes(24).toString("base64url");
  const hash = crypto.pbkdf2Sync(String(password), salt, 160000, 32, "sha256").toString("hex");
  return { passwordSalt: salt, passwordHash: hash, passwordAlgorithm: "pbkdf2-sha256-v1" };
}
function verifyPassword(password, user) {
  const salt = String(user.passwordSalt || "");
  const stored = String(user.passwordHash || "");
  if (!salt || !stored) return false;
  if (user.passwordAlgorithm === "legacy-sha256" || !user.passwordAlgorithm) return safeEqual(sha256(salt + String(password)), stored);
  const candidate = crypto.pbkdf2Sync(String(password), salt, 160000, 32, "sha256").toString("hex");
  return safeEqual(candidate, stored);
}
function verifyPasswordAsync(password, user) {
  const salt = String(user.passwordSalt || "");
  const stored = String(user.passwordHash || "");
  if (!salt || !stored) return Promise.resolve(false);
  if (user.passwordAlgorithm === "legacy-sha256" || !user.passwordAlgorithm) return Promise.resolve(safeEqual(sha256(salt + String(password)), stored));
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(String(password), salt, 160000, 32, "sha256", (error, derived) => {
      if (error) reject(error);
      else resolve(safeEqual(derived.toString("hex"), stored));
    });
  });
}

function tokenSignature(payload, secret) { return crypto.createHmac("sha256", secret).update(payload).digest("base64url"); }
function createSessionToken(user, secret) {
  const payload = Buffer.from(JSON.stringify({ uid: user.id, role: user.role, version: String(user.sessionVersion || 1), exp: Date.now() + 12 * 60 * 60 * 1000 })).toString("base64url");
  return `ps3.${payload}.${tokenSignature(payload, secret)}`;
}
function readSessionToken(token, secret) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3 || parts[0] !== "ps3" || !safeEqual(parts[2], tokenSignature(parts[1], secret))) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return payload && payload.uid && Number(payload.exp) > Date.now() ? payload : null;
  } catch { return null; }
}
async function requireSession(token, secret) {
  const session = readSessionToken(token, secret);
  if (!session) throw new Error("Tu sesión venció o no es válida. Inicia sesión nuevamente.");
  const snapshot = await db.collection("users").doc(String(session.uid)).get();
  if (!snapshot.exists) throw new Error("Tu sesión venció o no es válida. Inicia sesión nuevamente.");
  const user = { id: snapshot.id, ...snapshot.data() };
  if (!user.active || String(user.sessionVersion || 1) !== String(session.version)) throw new Error("Tu sesión cambió o fue revocada. Inicia sesión nuevamente.");
  return user;
}
async function requireAdmin(token, secret) {
  const user = await requireSession(token, secret);
  if (user.role !== "ADMIN") throw new Error("Esta acción requiere permisos de administrador.");
  return user;
}

function publicUser(user) {
  return { name: user.name, cedula: user.cedula, phone: user.phone || "", email: user.email || "", cargo: user.cargo || "", uad: user.uad || "", avatar: user.avatar || "avatar:v2:2:0:1:0:", role: user.role === "ADMIN" ? "ADMIN" : "USER" };
}
function publicMission(mission, admin = false) {
  const value = { id: Number(mission.id), station: mission.station, icon: mission.icon, color: mission.color, title: mission.title, description: mission.description, points: Number(mission.points) || 0, audience: mission.audience, duration: mission.duration || "8 min", evidenceRequired: Boolean(mission.evidenceRequired) };
  if (admin) value.sealCode = mission.sealCode || "";
  return value;
}
function publicBadge(badge) {
  return { id: badge.id, title: badge.title, description: badge.description, icon: badge.icon || "star", primaryColor: badge.primaryColor || "#9d5cff", secondaryColor: badge.secondaryColor || "#12cfe0", criterion: badge.criterion || "MISSIONS", goal: Number(badge.goal) || 1, station: badge.station || "", order: Number(badge.order) || 100 };
}
function validateMission(input) {
  const station = limited(input.station, 80, "La estación es obligatoria.");
  if (!STATIONS[station]) throw new Error("La estación seleccionada no es válida.");
  const audience = limited(input.audience, 120, "Selecciona una audiencia.");
  return { station, icon: STATIONS[station][0], color: STATIONS[station][1], title: limited(input.title, 120, "El nombre de la misión es obligatorio."), description: limited(input.description, 700, "La descripción es obligatoria."), points: clamp(input.points, 10, 1000, 100), audience: audienceKey(audience) === "todas las uad" ? "Todas las UAD" : audience, duration: String(input.duration || "8 min").slice(0, 30), evidenceRequired: Boolean(input.evidenceRequired) };
}
function validateBadge(input) {
  const icons = ["star", "shield", "trophy", "leaf", "heart", "rocket", "sparkle", "medal", "planet", "hand", "flame", "target", "bolt", "crown", "compass", "hands"];
  const criteria = ["MISSIONS", "POINTS", "BONUS", "STATIONS", "STATION", "ALL_MISSIONS"];
  const icon = icons.includes(String(input.icon)) ? String(input.icon) : "star";
  const criterion = criteria.includes(String(input.criterion).toUpperCase()) ? String(input.criterion).toUpperCase() : "MISSIONS";
  const color = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value)) ? String(value).toLowerCase() : fallback;
  return { title: limited(input.title, 80, "El nombre de la insignia es obligatorio."), description: limited(input.description, 240, "La descripción es obligatoria."), icon, primaryColor: color(input.primaryColor, "#9d5cff"), secondaryColor: color(input.secondaryColor, "#12cfe0"), criterion, goal: criterion === "ALL_MISSIONS" ? 1 : clamp(input.goal, 1, 100000, 1), station: criterion === "STATION" ? String(input.station || "") : "", order: clamp(input.order, 1, 999, 100) };
}
function missionCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[crypto.randomInt(alphabet.length)]).join("");
}
function normalizeCode(value) { return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10); }
function sheetQueue(transaction, sheet, id, row, operation = "UPSERT") {
  const ref = db.collection("syncQueue").doc();
  transaction.set(ref, { sheet, entityId: String(id), operation, row, status: "PENDING", attempts: 0, createdAt: now(), updatedAt: now() });
}
function userSheetRow(user) {
  return { Id: user.id, Nombre: user.name, Cedula: user.cedula, Telefono: user.phone || "", Correo: user.email || "", Cargo: user.cargo || "", UAD: user.uad || "", Avatar: user.avatar || "", Rol: user.role || "USER", PasswordSalt: user.passwordSalt || "", PasswordHash: user.passwordHash || "", Activo: Boolean(user.active), CreadoEn: toIso(user.createdAt), SessionVersion: String(user.sessionVersion || 1) };
}
function missionSheetRow(mission) {
  return { Id: mission.id, Estacion: mission.station, Icono: mission.icon, Color: mission.color, Titulo: mission.title, Descripcion: mission.description, Puntos: mission.points, Audiencia: mission.audience, Duracion: mission.duration, Activa: Boolean(mission.active), CreadaEn: toIso(mission.createdAt), CreadaPor: mission.createdBy || "", CodigoSello: mission.sealCode || "", EvidenciaObligatoria: Boolean(mission.evidenceRequired), EditadaEn: toIso(mission.updatedAt) };
}

module.exports = {
  db, FieldValue, Timestamp, getStorage, STATIONS, GAME_NAMES, GAME_LIMITS,
  cleanId, normalize, audienceKey, missionAssignedTo, sha256, randomId, now, toIso, limited, clamp,
  createPassword, verifyPassword, verifyPasswordAsync, createSessionToken, requireSession, requireAdmin,
  publicUser, publicMission, publicBadge, validateMission, validateBadge, missionCode, normalizeCode,
  sheetQueue, userSheetRow, missionSheetRow,
};
