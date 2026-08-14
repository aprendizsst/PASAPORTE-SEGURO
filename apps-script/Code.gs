/**
 * PASAPORTE SEGURO 2026 · Backend para Google Apps Script
 * Vincule este proyecto a la hoja de cálculo y ejecute setupPasaporteSeguro().
 */

const SHEETS = {
  USERS: "Usuarios",
  MISSIONS: "Misiones",
  PROGRESS: "Progreso",
  SESSIONS: "Sesiones",
  CATALOGS: "Catalogos",
  BONUS: "Bonus",
};

const HEADERS = {
  Usuarios: ["Id", "Nombre", "Cedula", "Telefono", "Correo", "Cargo", "UAD", "Avatar", "Rol", "PasswordSalt", "PasswordHash", "Activo", "CreadoEn"],
  Misiones: ["Id", "Estacion", "Icono", "Color", "Titulo", "Descripcion", "Puntos", "Audiencia", "Duracion", "Activa", "CreadaEn"],
  Progreso: ["Id", "UsuarioId", "MisionId", "Estado", "IniciadaEn", "CompletadaEn"],
  Sesiones: ["Token", "UsuarioId", "ExpiraEn", "CreadaEn"],
  Catalogos: ["Tipo", "Valor", "Activo"],
  Bonus: ["Id", "UsuarioId", "JuegoId", "Puntaje", "CompletadoEn"],
};

const CACHE_KEYS = {
  CATALOGS: "pasaporte:catalogs:v1",
  MISSIONS: "pasaporte:missions:v1",
  SESSION_CLEANUP: "pasaporte:session-cleanup:v1",
};

function doGet() {
  return json_({ ok: true, data: { service: "Pasaporte Seguro API", status: "ready" } });
}

function doPost(event) {
  try {
    ensureStructure_();
    const request = JSON.parse((event && event.postData && event.postData.contents) || "{}");
    const action = String(request.action || "");
    let data;

    if (action === "catalogs") data = catalogsApi_();
    else if (action === "register") data = registerApi_(request);
    else if (action === "login") data = loginApi_(request);
    else if (action === "session") data = sessionApi_(request);
    else if (action === "startMission") data = startMissionApi_(request);
    else if (action === "completeMission") data = completeMissionApi_(request);
    else if (action === "updateAvatar") data = updateAvatarApi_(request);
    else if (action === "completeBonus") data = completeBonusApi_(request);
    else if (action === "adminCreateMission") data = adminCreateMissionApi_(request);
    else if (action === "adminDeleteMission") data = adminDeleteMissionApi_(request);
    else if (action === "adminDashboard") data = adminDashboardApi_(request);
    else throw new Error("Acción no reconocida.");

    return json_({ ok: true, data: data });
  } catch (error) {
    return json_({ ok: false, message: error.message || "Error inesperado." });
  }
}

function setupPasaporteSeguro() {
  ensureStructure_();
  seedCatalogs_();
  seedMissions_();
  return "Estructura creada. Ahora edite los catálogos y configure el administrador.";
}

/**
 * Antes de ejecutar esta función, cree estas propiedades del script:
 * ADMIN_CEDULA, ADMIN_PASSWORD, ADMIN_NOMBRE, ADMIN_CORREO, ADMIN_UAD y ADMIN_CARGO.
 */
function crearAdministradorInicial() {
  ensureStructure_();
  const props = PropertiesService.getScriptProperties();
  const cedula = required_(props.getProperty("ADMIN_CEDULA"), "Falta ADMIN_CEDULA en Propiedades del script.");
  const password = required_(props.getProperty("ADMIN_PASSWORD"), "Falta ADMIN_PASSWORD en Propiedades del script.");
  if (password.length < 8) throw new Error("ADMIN_PASSWORD debe tener mínimo 8 caracteres.");
  if (findUserByCedula_(cedula)) throw new Error("Ya existe un usuario con esa cédula.");

  const salt = Utilities.getUuid();
  appendObject_(SHEETS.USERS, {
    Id: Utilities.getUuid(),
    Nombre: props.getProperty("ADMIN_NOMBRE") || "Administrador Festival",
    Cedula: cedula,
    Telefono: "",
    Correo: props.getProperty("ADMIN_CORREO") || "",
    Cargo: props.getProperty("ADMIN_CARGO") || "Administrador",
    UAD: props.getProperty("ADMIN_UAD") || "Sede Central",
    Avatar: "avatar:v1:3:1:0:5:1",
    Rol: "ADMIN",
    PasswordSalt: salt,
    PasswordHash: hashPassword_(password, salt),
    Activo: true,
    CreadoEn: new Date(),
  });
  return "Administrador creado correctamente.";
}

function catalogsApi_() {
  const cached = cacheGet_(CACHE_KEYS.CATALOGS);
  if (cached) return cached;
  const rows = sheetObjects_(SHEETS.CATALOGS).filter(function (row) { return truthy_(row.Activo); });
  const catalogs = {
    cargos: unique_(rows.filter(function (row) { return row.Tipo === "CARGO"; }).map(function (row) { return String(row.Valor); })),
    uads: unique_(rows.filter(function (row) { return row.Tipo === "UAD"; }).map(function (row) { return String(row.Valor); })),
  };
  cachePut_(CACHE_KEYS.CATALOGS, catalogs, 600);
  return catalogs;
}

function registerApi_(request) {
  const input = request.user || {};
  const password = String(request.password || "");
  const cedula = cleanId_(input.cedula);
  required_(input.name, "El nombre completo es obligatorio.");
  required_(cedula, "La cédula es obligatoria.");
  required_(input.phone, "El teléfono es obligatorio.");
  required_(input.email, "El correo es obligatorio.");
  required_(input.cargo, "El cargo es obligatorio.");
  required_(input.uad, "La UAD es obligatoria.");
  if (password.length < 8) throw new Error("La contraseña debe tener mínimo 8 caracteres.");

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (findUserByCedula_(cedula)) throw new Error("Ya existe un pasaporte registrado con esa cédula.");
    const duplicatedEmail = sheetObjects_(SHEETS.USERS).some(function (row) { return normalize_(row.Correo) === normalize_(input.email); });
    if (duplicatedEmail) throw new Error("Ya existe un pasaporte registrado con ese correo.");
    const salt = Utilities.getUuid();
    appendObject_(SHEETS.USERS, {
      Id: Utilities.getUuid(), Nombre: String(input.name).trim(), Cedula: cedula,
      Telefono: String(input.phone).trim(), Correo: String(input.email).trim().toLowerCase(),
      Cargo: String(input.cargo), UAD: String(input.uad), Avatar: input.avatar || "avatar:v1:2:0:1:0:0",
      Rol: "USER", PasswordSalt: salt, PasswordHash: hashPassword_(password, salt),
      Activo: true, CreadoEn: new Date(),
    });
  } finally { lock.releaseLock(); }
  return loginApi_({ cedula: cedula, password: password });
}

function loginApi_(request) {
  const cedula = cleanId_(request.cedula);
  const user = findUserByCedula_(cedula);
  if (!user || !truthy_(user.Activo)) throw new Error("Cédula o contraseña incorrecta.");
  if (hashPassword_(String(request.password || ""), String(user.PasswordSalt)) !== String(user.PasswordHash)) throw new Error("Cédula o contraseña incorrecta.");

  maybeCleanupSessions_();
  const token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
  appendObject_(SHEETS.SESSIONS, { Token: token, UsuarioId: user.Id, ExpiraEn: expiresAt, CreadoEn: new Date() });
  cachePut_(sessionCacheKey_(token), { user: user, expiresAt: expiresAt.toISOString() }, 120);
  const bundle = userBundle_(user);
  bundle.token = token;
  if (String(user.Rol) === "ADMIN") bundle.adminPeople = buildAdminPeople_();
  return bundle;
}

function sessionApi_(request) {
  const user = requireSession_(request.token);
  const bundle = userBundle_(user);
  bundle.token = String(request.token);
  if (String(user.Rol) === "ADMIN") bundle.adminPeople = buildAdminPeople_();
  return bundle;
}

function startMissionApi_(request) {
  const user = requireSession_(request.token);
  const mission = allowedMission_(user, request.missionId);
  upsertProgress_(user.Id, mission.Id, "INICIADA");
  return { missionId: Number(mission.Id), status: "INICIADA" };
}

function completeMissionApi_(request) {
  const user = requireSession_(request.token);
  const mission = allowedMission_(user, request.missionId);
  upsertProgress_(user.Id, mission.Id, "COMPLETADA");
  return { missionId: Number(mission.Id), status: "COMPLETADA", completedAt: new Date().toISOString() };
}

function updateAvatarApi_(request) {
  const user = requireSession_(request.token);
  if (!/^avatar:v1:[0-5]:[0-6]:[0-6]:[0-7]:[0-7]$/.test(String(request.avatar))) throw new Error("Avatar no permitido.");
  updateObjectRow_(SHEETS.USERS, user._row, { Avatar: String(request.avatar) });
  user.Avatar = String(request.avatar);
  cachePut_(sessionCacheKey_(request.token), { user: user, expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString() }, 120);
  return { avatar: String(request.avatar) };
}

function completeBonusApi_(request) {
  const user = requireSession_(request.token);
  const gameId = String(request.gameId || "");
  const allowedGames = ["word-search", "sudoku", "target"];
  if (allowedGames.indexOf(gameId) < 0) throw new Error("Minijuego no permitido.");
  const score = Math.max(0, Math.min(1000, Number(request.score) || 0));
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const current = sheetObjects_(SHEETS.BONUS).find(function (row) {
      return String(row.UsuarioId) === String(user.Id) && String(row.JuegoId) === gameId;
    });
    if (current) updateObjectRow_(SHEETS.BONUS, current._row, { Puntaje: Math.max(Number(current.Puntaje) || 0, score), CompletadoEn: new Date() });
    else appendObject_(SHEETS.BONUS, { Id: Utilities.getUuid(), UsuarioId: user.Id, JuegoId: gameId, Puntaje: score, CompletadoEn: new Date() });
  } finally { lock.releaseLock(); }
  return { gameId: gameId, score: score, completed: true };
}

function adminCreateMissionApi_(request) {
  const admin = requireAdmin_(request.token);
  const mission = request.mission || {};
  required_(mission.title, "El nombre de la misión es obligatorio.");
  required_(mission.station, "La estación es obligatoria.");
  required_(mission.description, "La descripción es obligatoria.");
  const id = Date.now();
  appendObject_(SHEETS.MISSIONS, {
    Id: id, Estacion: mission.station, Icono: mission.icon || "✦", Color: mission.color || "#12cfe0",
    Titulo: mission.title, Descripcion: mission.description, Puntos: Number(mission.points) || 100,
    Audiencia: mission.audience || "Todas las UAD", Duracion: mission.duration || "8 min", Activa: true,
    CreadaEn: new Date(), CreadaPor: admin.Id,
  });
  CacheService.getScriptCache().remove(CACHE_KEYS.MISSIONS);
  return { id: id };
}

function adminDeleteMissionApi_(request) {
  requireAdmin_(request.token);
  const mission = sheetObjects_(SHEETS.MISSIONS).find(function (row) {
    return String(row.Id) === String(request.missionId) && truthy_(row.Activa);
  });
  if (!mission) throw new Error("La misión ya no existe o fue eliminada.");

  // Se desactiva en lugar de borrar la fila para conservar el historial.
  updateObjectRow_(SHEETS.MISSIONS, mission._row, { Activa: false });
  CacheService.getScriptCache().remove(CACHE_KEYS.MISSIONS);
  return { missionId: Number(mission.Id), deleted: true };
}

function adminDashboardApi_(request) {
  requireAdmin_(request.token);
  return { people: buildAdminPeople_() };
}

function userBundle_(user) {
  const missions = String(user.Rol) === "ADMIN" ? activeMissions_() : allowedMissions_(user);
  const progress = sheetObjects_(SHEETS.PROGRESS).filter(function (row) { return String(row.UsuarioId) === String(user.Id); });
  const completed = progress.filter(function (row) { return row.Estado === "COMPLETADA"; }).map(function (row) { return Number(row.MisionId); });
  const started = progress.filter(function (row) { return row.Estado === "INICIADA"; }).map(function (row) { return Number(row.MisionId); });
  const history = {};
  progress.forEach(function (row) { if (row.Estado === "COMPLETADA" && row.CompletadaEn) history[Number(row.MisionId)] = new Date(row.CompletadaEn).toISOString(); });
  const historyMissions = completed.length ? sheetObjects_(SHEETS.MISSIONS).filter(function (mission) {
    return completed.indexOf(Number(mission.Id)) >= 0;
  }).map(publicMission_) : [];
  const bonusRows = sheetObjects_(SHEETS.BONUS).filter(function (row) { return String(row.UsuarioId) === String(user.Id); });
  const bonusScores = {};
  bonusRows.forEach(function (row) { bonusScores[String(row.JuegoId)] = Number(row.Puntaje) || 0; });
  return { user: publicUser_(user), missions: missions.map(publicMission_), historyMissions: historyMissions, completed: completed, started: started, history: history, bonusCompleted: Object.keys(bonusScores), bonusScores: bonusScores };
}

function buildAdminPeople_() {
  const users = sheetObjects_(SHEETS.USERS).filter(function (row) { return truthy_(row.Activo) && row.Rol !== "ADMIN"; });
  const missions = activeMissions_();
  const progress = sheetObjects_(SHEETS.PROGRESS).filter(function (row) { return row.Estado === "COMPLETADA"; });
  const bonus = sheetObjects_(SHEETS.BONUS);
  const pointsByMission = {};
  missions.forEach(function (m) { pointsByMission[String(m.Id)] = Number(m.Puntos) || 0; });
  return users.map(function (user) {
    const available = missions.filter(function (m) { return m.Audiencia === "Todas las UAD" || String(m.Audiencia) === String(user.UAD); });
    const completedRows = progress.filter(function (p) { return String(p.UsuarioId) === String(user.Id); });
    const bonusPoints = bonus.filter(function (row) { return String(row.UsuarioId) === String(user.Id); }).reduce(function (sum, row) { return sum + (Number(row.Puntaje) || 0); }, 0);
    return {
      name: String(user.Nombre), uad: String(user.UAD), completed: completedRows.length,
      total: available.length, points: completedRows.reduce(function (sum, p) { return sum + (pointsByMission[String(p.MisionId)] || 0); }, 0) + bonusPoints,
    };
  });
}

function allowedMissions_(user) {
  return activeMissions_().filter(function (mission) {
    return mission.Audiencia === "Todas las UAD" || String(mission.Audiencia) === String(user.UAD);
  });
}

function activeMissions_() {
  const cached = cacheGet_(CACHE_KEYS.MISSIONS);
  if (cached) return cached;
  const missions = sheetObjects_(SHEETS.MISSIONS).filter(function (row) { return truthy_(row.Activa); });
  cachePut_(CACHE_KEYS.MISSIONS, missions, 120);
  return missions;
}

function allowedMission_(user, missionId) {
  const mission = allowedMissions_(user).find(function (row) { return String(row.Id) === String(missionId); });
  if (!mission) throw new Error("La misión no está disponible para tu UAD.");
  return mission;
}

function upsertProgress_(userId, missionId, status) {
  const rows = sheetObjects_(SHEETS.PROGRESS);
  const current = rows.find(function (row) { return String(row.UsuarioId) === String(userId) && String(row.MisionId) === String(missionId); });
  const now = new Date();
  if (current) {
    const changes = { Estado: status };
    if (!current.IniciadaEn) changes.IniciadaEn = now;
    if (status === "COMPLETADA") changes.CompletadaEn = now;
    updateObjectRow_(SHEETS.PROGRESS, current._row, changes);
  } else appendObject_(SHEETS.PROGRESS, { Id: Utilities.getUuid(), UsuarioId: userId, MisionId: missionId, Estado: status, IniciadaEn: now, CompletadaEn: status === "COMPLETADA" ? now : "" });
}

function requireSession_(token) {
  const cached = cacheGet_(sessionCacheKey_(token));
  if (cached && new Date(cached.expiresAt).getTime() > Date.now() && cached.user && truthy_(cached.user.Activo)) return cached.user;
  const session = sheetObjects_(SHEETS.SESSIONS).find(function (row) { return String(row.Token) === String(token) && new Date(row.ExpiraEn).getTime() > Date.now(); });
  if (!session) throw new Error("Tu sesión venció. Inicia sesión nuevamente.");
  const user = sheetObjects_(SHEETS.USERS).find(function (row) { return String(row.Id) === String(session.UsuarioId); });
  if (!user || !truthy_(user.Activo)) throw new Error("Usuario inactivo.");
  cachePut_(sessionCacheKey_(token), { user: user, expiresAt: new Date(session.ExpiraEn).toISOString() }, 120);
  return user;
}

function requireAdmin_(token) {
  const user = requireSession_(token);
  if (String(user.Rol) !== "ADMIN") throw new Error("No tienes permisos de administrador.");
  return user;
}

function cleanupSessions_() {
  const sheet = getSheet_(SHEETS.SESSIONS);
  const rows = sheetObjects_(SHEETS.SESSIONS).filter(function (row) { return new Date(row.ExpiraEn).getTime() <= Date.now(); }).sort(function (a, b) { return b._row - a._row; });
  rows.forEach(function (row) { sheet.deleteRow(row._row); });
}

function maybeCleanupSessions_() {
  const cache = CacheService.getScriptCache();
  if (cache.get(CACHE_KEYS.SESSION_CLEANUP)) return;
  cleanupSessions_();
  cache.put(CACHE_KEYS.SESSION_CLEANUP, "1", 300);
}

function sessionCacheKey_(token) {
  return "pasaporte:session:" + String(token || "");
}

function publicUser_(user) {
  return { name: String(user.Nombre), cedula: String(user.Cedula), phone: String(user.Telefono || ""), email: String(user.Correo || ""), cargo: String(user.Cargo || ""), uad: String(user.UAD || ""), avatar: String(user.Avatar || "avatar:v1:2:0:1:0:0"), role: String(user.Rol) === "ADMIN" ? "ADMIN" : "USER" };
}

function publicMission_(m) {
  return { id: Number(m.Id), station: String(m.Estacion), icon: String(m.Icono), color: String(m.Color), title: String(m.Titulo), description: String(m.Descripcion), points: Number(m.Puntos), audience: String(m.Audiencia), duration: String(m.Duracion) };
}

function findUserByCedula_(cedula) {
  return sheetObjects_(SHEETS.USERS).find(function (row) { return cleanId_(row.Cedula) === cleanId_(cedula); });
}

function hashPassword_(password, salt) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(salt) + String(password), Utilities.Charset.UTF_8);
  return bytes.map(function (byte) { const value = byte < 0 ? byte + 256 : byte; return ("0" + value.toString(16)).slice(-2); }).join("");
}

function ensureStructure_() {
  Object.keys(HEADERS).forEach(function (name) { ensureSheet_(name, HEADERS[name]); });
}

function ensureSheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  sheet.setFrozenRows(1);
  return sheet;
}

function getSheet_(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error("No existe la hoja " + name + ". Ejecute setupPasaporteSeguro().");
  return sheet;
}

function sheetObjects_(name) {
  const sheet = getSheet_(name);
  if (sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  return values.slice(1).map(function (row, index) {
    const object = { _row: index + 2 };
    headers.forEach(function (header, column) { object[header] = row[column]; });
    return object;
  });
}

function appendObject_(sheetName, object) {
  const sheet = getSheet_(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  sheet.appendRow(headers.map(function (header) { return object[header] === undefined ? "" : object[header]; }));
}

function updateObjectRow_(sheetName, rowNumber, changes) {
  const sheet = getSheet_(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  Object.keys(changes).forEach(function (key) {
    const column = headers.indexOf(key) + 1;
    if (column > 0) sheet.getRange(rowNumber, column).setValue(changes[key]);
  });
}

function seedCatalogs_() {
  if (sheetObjects_(SHEETS.CATALOGS).length) return;
  ["Auxiliar administrativo", "Profesional asistencial", "Líder de proceso", "Coordinador(a)", "Analista", "Otro"].forEach(function (value) { appendObject_(SHEETS.CATALOGS, { Tipo: "CARGO", Valor: value, Activo: true }); });
  ["Sede Central", "UAD Duitama", "UAD Chiquinquirá", "UAD Miraflores", "UAD Guateque"].forEach(function (value) { appendObject_(SHEETS.CATALOGS, { Tipo: "UAD", Valor: value, Activo: true }); });
  CacheService.getScriptCache().remove(CACHE_KEYS.CATALOGS);
}

function seedMissions_() {
  if (sheetObjects_(SHEETS.MISSIONS).length) return;
  const seeds = [
    [1,"Estación Diversidad","◉","#9d5cff","Todos contamos","Participa en el reto de inclusión y reconoce una fortaleza única de otro compañero.",120,"Todas las UAD","8 min"],
    [2,"Estación Felicidad","♡","#ffb703","La pausa que suma","Completa la dinámica de gratitud y deja un mensaje positivo en la estación.",100,"Todas las UAD","6 min"],
    [3,"Estación Seguridad","◇","#12cfe0","Cazadores de riesgos","Identifica tres condiciones seguras dentro del recorrido y valida tu respuesta con el guía.",150,"Sede Central","10 min"],
    [4,"Estación Salud","+","#43d17d","Pulso saludable","Acepta el reto de hábitos saludables y registra el compromiso que aplicarás esta semana.",100,"Todas las UAD","7 min"],
    [5,"Estación Amor Propio","✦","#ff5c9b","Mi mejor versión","Elige una práctica de autocuidado y completa la actividad guiada de bienestar emocional.",130,"Todas las UAD","9 min"],
    [6,"Estación Ambiental","♧","#8bd33f","Huella consciente","Clasifica correctamente los residuos del desafío y descubre tu eco-acción diaria.",110,"Sede Central","8 min"],
  ];
  seeds.forEach(function (m) { appendObject_(SHEETS.MISSIONS, { Id:m[0],Estacion:m[1],Icono:m[2],Color:m[3],Titulo:m[4],Descripcion:m[5],Puntos:m[6],Audiencia:m[7],Duracion:m[8],Activa:true,CreadaEn:new Date() }); });
  CacheService.getScriptCache().remove(CACHE_KEYS.MISSIONS);
}

function cacheGet_(key) {
  const value = CacheService.getScriptCache().get(key);
  if (!value) return null;
  try { return JSON.parse(value); } catch (error) { return null; }
}
function cachePut_(key, value, seconds) {
  CacheService.getScriptCache().put(key, JSON.stringify(value), seconds);
}
function json_(payload) { return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON); }
function required_(value, message) { if (value === undefined || value === null || String(value).trim() === "") throw new Error(message); return String(value).trim(); }
function cleanId_(value) { return String(value || "").replace(/[^0-9A-Za-z-]/g, ""); }
function normalize_(value) { return String(value || "").trim().toLowerCase(); }
function truthy_(value) { return value === true || String(value).toUpperCase() === "TRUE" || String(value) === "1" || String(value).toUpperCase() === "SI"; }
function unique_(items) { return items.filter(function (value, index) { return value && items.indexOf(value) === index; }); }
