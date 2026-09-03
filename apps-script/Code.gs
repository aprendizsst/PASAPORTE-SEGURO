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
  EVIDENCE: "Evidencias",
  BADGES: "Insignias",
  RECOVERY: "Recuperaciones",
};

const HEADERS = {
  Usuarios: ["Id", "Nombre", "Cedula", "Telefono", "Correo", "Cargo", "UAD", "Avatar", "Rol", "PasswordSalt", "PasswordHash", "Activo", "CreadoEn", "SessionVersion"],
  Misiones: ["Id", "Estacion", "Icono", "Color", "Titulo", "Descripcion", "Puntos", "Audiencia", "Duracion", "Activa", "CreadaEn", "CreadaPor", "CodigoSello", "EvidenciaObligatoria", "EditadaEn"],
  Progreso: ["Id", "UsuarioId", "MisionId", "Estado", "IniciadaEn", "CompletadaEn"],
  Sesiones: ["Token", "UsuarioId", "ExpiraEn", "CreadaEn"],
  Catalogos: ["Tipo", "Valor", "Activo"],
  Bonus: ["Id", "UsuarioId", "JuegoId", "Puntaje", "CompletadoEn", "Record"],
  Evidencias: ["Id", "UsuarioId", "MisionId", "ArchivoId", "NombreArchivo", "TipoMime", "TamanoBytes", "Url", "Estado", "CreadoEn"],
  Insignias: ["Id", "Titulo", "Descripcion", "Icono", "ColorPrimario", "ColorSecundario", "TipoCriterio", "Meta", "Estacion", "Activa", "Orden", "CreadaEn", "CreadaPor", "EditadaEn"],
  Recuperaciones: ["Id", "UsuarioId", "CodigoHash", "ExpiraEn", "Intentos", "Usado", "Canal", "CreadoEn", "VerificadoEn", "TicketHash", "TicketExpiraEn"],
};

const CACHE_KEYS = {
  CATALOGS: "pasaporte:catalogs:v1",
  MISSIONS: "pasaporte:missions:v1",
  MISSIONS_ALL: "pasaporte:missions:all:v1",
  ADMIN_DASHBOARD: "pasaporte:admin-dashboard:v2",
  SESSION_CLEANUP: "pasaporte:session-cleanup:v1",
  ADMIN_EVIDENCE: "pasaporte:admin-evidence:v1",
  ADMIN_BONUS_RECORDS: "pasaporte:admin-bonus-records:v1",
  BADGES: "pasaporte:badges:v1",
  BONUS_LEADERBOARD: "pasaporte:bonus-leaderboard:v1",
  SCHEMA: "pasaporte:schema:v8",
  USERS_WARM: "pasaporte:users:warm:v2",
  EVENT_WARM_UNTIL: "pasaporte:event:warm-until:v1",
  PROGRESS_SNAPSHOT: "pasaporte:event:progress:v1:",
  BONUS_SNAPSHOT: "pasaporte:event:bonus:v1:",
};
const ACTIVITY_SNAPSHOT_SHARDS = 16;
const LOAD_TEST_USER_PREFIX = "LOADTEST-";
const LOAD_TEST_CEDULA_BASE = 990000000000;

const CACHE_TTL = {
  CATALOGS: 21600,
  MISSIONS: 900,
  USER: 3600,
  SESSION: 3600,
  ACTIVITY: 600,
};

const WRITE_ACTIONS = ["register", "startMission", "completeMission", "updateAvatar", "completeBonus", "requestPasswordReset", "verifyPasswordResetCode", "resetPassword", "adminCreateMission", "adminEditMission", "adminDeleteMission", "adminCreateBadge", "adminEditBadge", "adminDeleteBadge", "adminEditUser", "adminDeleteUser", "adminCreateRecoveryCode", "adminManageBonusRecord"];

function doGet() {
  return json_({ ok: true, data: { service: "Pasaporte Seguro API", status: "ready", version: "3.3.0-compat" } });
}

function doPost(event) {
  let idempotencyKey = "";
  let requestClaimed = false;
  try {
    const request = JSON.parse((event && event.postData && event.postData.contents) || "{}");
    const action = String(request.action || "");
    ensureRuntimeReady_();
    const requestId = cleanRequestId_(request.requestId);
    idempotencyKey = requestId && WRITE_ACTIONS.indexOf(action) >= 0 ? "pasaporte:request:" + action + ":" + requestId : "";
    if (idempotencyKey) {
      const claim = claimRequest_(idempotencyKey);
      if (claim.repeated) return json_({ ok: true, data: claim.data, repeated: true });
      requestClaimed = true;
    }
    let data;

    if (action === "catalogs") data = catalogsApi_();
    else if (action === "register") data = registerApi_(request);
    else if (action === "login") data = loginApi_(request);
    else if (action === "session") data = sessionApi_(request);
    else if (action === "getMissions") data = missionsApi_(request);
    else if (action === "startMission") data = startMissionApi_(request);
    else if (action === "completeMission") data = completeMissionApi_(request);
    else if (action === "updateAvatar") data = updateAvatarApi_(request);
    else if (action === "completeBonus") data = completeBonusApi_(request);
    else if (action === "getBonusLeaderboard") data = bonusLeaderboardApi_(request);
    else if (action === "requestPasswordReset") data = requestPasswordResetApi_(request);
    else if (action === "verifyPasswordResetCode") data = verifyPasswordResetCodeApi_(request);
    else if (action === "resetPassword") data = resetPasswordApi_(request);
    else if (action === "adminCreateMission") data = adminCreateMissionApi_(request);
    else if (action === "adminEditMission") data = adminEditMissionApi_(request);
    else if (action === "adminDeleteMission") data = adminDeleteMissionApi_(request);
    else if (action === "adminCreateBadge") data = adminCreateBadgeApi_(request);
    else if (action === "adminEditBadge") data = adminEditBadgeApi_(request);
    else if (action === "adminDeleteBadge") data = adminDeleteBadgeApi_(request);
    else if (action === "adminEditUser") data = adminEditUserApi_(request);
    else if (action === "adminDeleteUser") data = adminDeleteUserApi_(request);
    else if (action === "adminCreateRecoveryCode") data = adminCreateRecoveryCodeApi_(request);
    else if (action === "adminManageBonusRecord") data = adminManageBonusRecordApi_(request);
    else if (action === "adminDashboard") data = adminDashboardApi_(request);
    else if (action === "adminReportData") data = adminReportDataApi_(request);
    else throw new Error("Acción no reconocida.");

    if (idempotencyKey) completeRequest_(idempotencyKey, data);
    return json_({ ok: true, data: data });
  } catch (error) {
    if (requestClaimed && idempotencyKey) releaseRequestClaim_(idempotencyKey);
    return json_({ ok: false, message: error.message || "Error inesperado.", retryable: truthy_(error.retryable) });
  }
}

function setupPasaporteSeguro() {
  ensureStructure_();
  seedCatalogs_();
  seedMissions_();
  seedMissionCodes_();
  seedBadges_();
  migrateDefaultBadgeDesigns_();
  migrateExpandedBonusBadge_();
  invalidateMissionCaches_();
  CacheService.getScriptCache().remove(CACHE_KEYS.BADGES);
  CacheService.getScriptCache().put(CACHE_KEYS.SCHEMA, "ready", 21600);
  ensureTokenSecret_();
  PropertiesService.getScriptProperties().setProperty("PASAPORTE_SCHEMA_VERSION", "8");
  return "Estructura actualizada sin borrar datos. Misiones, insignias, evidencias, recuperación y récords Bonus están listos.";
}

function ensureRuntimeReady_() {
  const cache = CacheService.getScriptCache();
  if (cache.get(CACHE_KEYS.SCHEMA)) return;
  if (PropertiesService.getScriptProperties().getProperty("PASAPORTE_SCHEMA_VERSION") === "8") {
    cache.put(CACHE_KEYS.SCHEMA, "ready", 21600);
    return;
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(8000)) throw new Error("El sistema se está preparando. Intenta nuevamente en unos segundos.");
  try {
    if (!cache.get(CACHE_KEYS.SCHEMA)) {
      ensureStructure_();
      seedCatalogs_();
      seedMissions_();
      seedMissionCodes_();
      seedBadges_();
      migrateDefaultBadgeDesigns_();
      migrateExpandedBonusBadge_();
      ensureTokenSecret_();
      PropertiesService.getScriptProperties().setProperty("PASAPORTE_SCHEMA_VERSION", "8");
      cache.put(CACHE_KEYS.SCHEMA, "ready", 21600);
    }
  } finally { lock.releaseLock(); }
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
    SessionVersion: "1",
  });
  return "Administrador creado correctamente.";
}

/**
 * Respaldo de emergencia para el propietario del Apps Script.
 * Configure temporalmente ADMIN_CEDULA y ADMIN_RESET_PASSWORD en Propiedades del script,
 * ejecute esta función y elimine ADMIN_RESET_PASSWORD al terminar.
 */
function restablecerAdministradorDesdePropiedades() {
  ensureStructure_();
  const props = PropertiesService.getScriptProperties();
  const cedula = required_(props.getProperty("ADMIN_CEDULA"), "Falta ADMIN_CEDULA en Propiedades del script.");
  const password = required_(props.getProperty("ADMIN_RESET_PASSWORD"), "Falta ADMIN_RESET_PASSWORD en Propiedades del script.");
  if (password.length < 8 || password.length > 128) throw new Error("ADMIN_RESET_PASSWORD debe tener entre 8 y 128 caracteres.");
  const user = findUserByCedula_(cedula);
  if (!user || String(user.Rol) !== "ADMIN" || !truthy_(user.Activo)) throw new Error("No existe un administrador activo con esa cédula.");
  const salt = Utilities.getUuid();
  updateObjectRow_(SHEETS.USERS, user._row, { PasswordSalt: salt, PasswordHash: hashPassword_(password, salt), SessionVersion: nextSessionVersion_(user) });
  revokeUserSessions_(user.Id);
  invalidateUserCache_(user);
  clearLoginRate_(cedula);
  props.deleteProperty("ADMIN_RESET_PASSWORD");
  return "Contraseña administrativa restablecida. La propiedad temporal fue eliminada.";
}

function catalogsApi_() {
  const cached = cacheGet_(CACHE_KEYS.CATALOGS);
  if (cached) return cached;
  const rows = sheetObjects_(SHEETS.CATALOGS).filter(function (row) { return truthy_(row.Activo); });
  const catalogs = {
    cargos: unique_(rows.filter(function (row) { return row.Tipo === "CARGO"; }).map(function (row) { return String(row.Valor); })),
    uads: unique_(rows.filter(function (row) { return row.Tipo === "UAD"; }).map(function (row) { return String(row.Valor); })),
  };
  cachePut_(CACHE_KEYS.CATALOGS, catalogs, CACHE_TTL.CATALOGS);
  return catalogs;
}

function registerApi_(request) {
  const input = request.user || {};
  const password = String(request.password || "");
  const cedula = cleanId_(input.cedula);
  const name = limitedText_(input.name, 120, "El nombre completo es obligatorio.");
  required_(cedula, "La cédula es obligatoria.");
  const phone = limitedText_(input.phone, 30, "El teléfono es obligatorio.");
  const email = limitedText_(input.email, 160, "El correo es obligatorio.").toLowerCase();
  const cargo = limitedText_(input.cargo, 120, "El cargo es obligatorio.");
  const uad = limitedText_(input.uad, 120, "La UAD es obligatoria.");
  if (cedula.length < 5 || cedula.length > 25) throw new Error("La cédula no tiene un formato válido.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("El correo no tiene un formato válido.");
  if (password.length < 8) throw new Error("La contraseña debe tener mínimo 8 caracteres.");
  if (password.length > 128) throw new Error("La contraseña supera el tamaño permitido.");

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(8000)) throw busyError_("Hay varios registros en curso. Espera un momento; volveremos a intentarlo.");
  try {
    if (findObjectByField_(SHEETS.USERS, "Cedula", cedula, cleanId_)) throw new Error("Ya existe un pasaporte registrado con esa cédula.");
    if (findObjectByField_(SHEETS.USERS, "Correo", email, normalize_)) throw new Error("Ya existe un pasaporte registrado con ese correo.");
    const salt = Utilities.getUuid();
    const newUser = {
      Id: Utilities.getUuid(), Nombre: name, Cedula: cedula,
      Telefono: phone, Correo: email,
      Cargo: cargo, UAD: uad, Avatar: input.avatar || "avatar:v1:2:0:1:0:0",
      Rol: "USER", PasswordSalt: salt, PasswordHash: hashPassword_(password, salt),
      Activo: true, CreadoEn: new Date(), SessionVersion: "1",
    };
    newUser._row = appendObject_(SHEETS.USERS, newUser);
    cacheUser_(newUser);
    invalidateAdminDashboard_();
  } finally { lock.releaseLock(); }
  return loginApi_({ cedula: cedula, password: password });
}

function loginApi_(request) {
  const cedula = cleanId_(request.cedula);
  enforceLoginRate_(cedula);
  const user = findUserByCedula_(cedula);
  if (!user || !truthy_(user.Activo)) throw new Error("Cédula o contraseña incorrecta.");
  if (!String(user.PasswordSalt || "") || !String(user.PasswordHash || "")) throw new Error("Tu usuario necesita restablecer la contraseña. Usa la opción ¿Olvidaste tu contraseña?");
  if (hashPassword_(String(request.password || ""), String(user.PasswordSalt)) !== String(user.PasswordHash)) throw new Error("Cédula o contraseña incorrecta.");
  clearLoginRate_(cedula);

  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
  const token = createSessionToken_(user, expiresAt);
  cachePut_(sessionCacheKey_(token), { user: user, expiresAt: expiresAt.toISOString() }, CACHE_TTL.SESSION);
  const bundle = userBundle_(user);
  bundle.token = token;
  return bundle;
}

function sessionApi_(request) {
  const user = requireSession_(request.token);
  const bundle = userBundle_(user);
  bundle.token = String(request.token);
  return bundle;
}

function missionsApi_(request) {
  const user = requireSession_(request.token);
  const admin = String(user.Rol) === "ADMIN";
  return { missions: (admin ? activeMissions_() : allowedMissions_(user)).map(admin ? adminMission_ : publicMission_), uad: String(user.UAD || "") };
}

function requestPasswordResetApi_(request) {
  const cedula = cleanId_(request.cedula);
  const email = normalize_(request.email);
  required_(cedula, "La cédula es obligatoria.");
  required_(email, "El correo es obligatorio.");
  enforceRecoveryRequestRate_(cedula);
  const user = findUserByCedula_(cedula);
  const generic = { requested: true, message: "Si los datos coinciden, recibirás un código de recuperación en tu correo." };
  if (!user || !truthy_(user.Activo) || normalize_(user.Correo) !== email) return generic;
  const code = generateRecoveryCode_(6);
  const recovery = createRecovery_(user.Id, code, "EMAIL", 15);
  try {
    MailApp.sendEmail({
      to: String(user.Correo),
      subject: "Código para restablecer tu Pasaporte Seguro",
      body: "Hola " + String(user.Nombre || "viajero") + ",\n\nTu código de recuperación es: " + code + "\n\nEste código vence en 15 minutos y solo puede usarse una vez. Si no solicitaste el cambio, ignora este mensaje.\n\nPasaporte Seguro · Festival 2026",
      name: "Pasaporte Seguro",
    });
  } catch (error) {
    updateObjectRow_(SHEETS.RECOVERY, recovery._row, { Usado: true });
    throw new Error("No fue posible enviar el código en este momento. Solicita al administrador un código de respaldo.");
  }
  return generic;
}

function verifyPasswordResetCodeApi_(request) {
  const cedula = cleanId_(request.cedula);
  const code = normalizeRecoveryCode_(request.code);
  required_(cedula, "La cédula es obligatoria.");
  if (code.length < 6) throw new Error("Ingresa el código completo.");
  const user = findUserByCedula_(cedula);
  if (!user || !truthy_(user.Activo)) throw new Error("El código no es válido o ya venció.");
  const rows = findObjectsByField_(SHEETS.RECOVERY, "UsuarioId", user.Id, String)
    .filter(function (row) { return !truthy_(row.Usado) && new Date(row.ExpiraEn).getTime() > Date.now(); })
    .sort(function (a, b) { return new Date(b.CreadoEn).getTime() - new Date(a.CreadoEn).getTime(); });
  let matched = null;
  rows.some(function (row) {
    if (Number(row.Intentos || 0) >= 5) return false;
    if (hashPassword_(code, String(row.Id)) === String(row.CodigoHash)) { matched = row; return true; }
    updateObjectRow_(SHEETS.RECOVERY, row._row, { Intentos: Number(row.Intentos || 0) + 1 });
    return false;
  });
  if (!matched) throw new Error("El código no es válido o ya venció.");
  const ticket = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
  updateObjectRow_(SHEETS.RECOVERY, matched._row, {
    VerificadoEn: new Date(), TicketHash: hashPassword_(ticket, String(matched.Id)),
    TicketExpiraEn: new Date(Date.now() + 10 * 60 * 1000),
  });
  return { verified: true, ticket: ticket, expiresInMinutes: 10 };
}

function resetPasswordApi_(request) {
  const cedula = cleanId_(request.cedula);
  const ticket = String(request.ticket || "").trim();
  const password = String(request.password || "");
  required_(cedula, "La cédula es obligatoria.");
  if (ticket.length < 32) throw new Error("Primero debes validar el código de recuperación.");
  if (password.length < 8 || password.length > 128) throw new Error("La nueva contraseña debe tener entre 8 y 128 caracteres.");
  const user = findUserByCedula_(cedula);
  if (!user || !truthy_(user.Activo)) throw new Error("La validación del código no es válida o ya venció.");
  const matched = findObjectsByField_(SHEETS.RECOVERY, "UsuarioId", user.Id, String)
    .filter(function (row) {
      return !truthy_(row.Usado) && String(row.TicketHash || "") &&
        new Date(row.ExpiraEn).getTime() > Date.now() && new Date(row.TicketExpiraEn).getTime() > Date.now();
    })
    .sort(function (a, b) { return new Date(b.VerificadoEn || b.CreadoEn).getTime() - new Date(a.VerificadoEn || a.CreadoEn).getTime(); })
    .find(function (row) { return hashPassword_(ticket, String(row.Id)) === String(row.TicketHash); });
  if (!matched) throw new Error("La validación del código no es válida o ya venció. Solicita un código nuevo.");
  const salt = Utilities.getUuid();
  updateObjectRow_(SHEETS.USERS, user._row, { PasswordSalt: salt, PasswordHash: hashPassword_(password, salt), SessionVersion: nextSessionVersion_(user) });
  updateObjectRow_(SHEETS.RECOVERY, matched._row, { Usado: true, TicketHash: "", TicketExpiraEn: "" });
  revokeUserSessions_(user.Id);
  invalidateUserCache_(user);
  clearLoginRate_(cedula);
  return { reset: true };
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
  const suppliedCode = normalizeMissionCode_(request.sealCode);
  const expectedCode = normalizeMissionCode_(mission.CodigoSello);
  if (!expectedCode) throw new Error("Esta misión aún no tiene código. Pide al administrador ejecutar setupPasaporteSeguro().");
  enforceMissionCodeRate_(user.Id, mission.Id, suppliedCode === expectedCode);
  if (suppliedCode !== expectedCode) throw new Error("El código de la misión no es correcto.");
  const current = progressForUser_(user.Id).find(function (row) { return String(row.MisionId) === String(mission.Id) && row.Estado === "COMPLETADA"; });
  if (current) return { missionId: Number(mission.Id), status: "COMPLETADA", completedAt: new Date(current.CompletadaEn || new Date()).toISOString(), repeated: true };
  if (truthy_(mission.EvidenciaObligatoria) && !request.evidence) throw new Error("Esta misión requiere una foto o un video como evidencia.");
  if (request.evidence) saveEvidence_(user, mission, request.evidence);
  upsertProgress_(user.Id, mission.Id, "COMPLETADA");
  return { missionId: Number(mission.Id), status: "COMPLETADA", completedAt: new Date().toISOString() };
}

function updateAvatarApi_(request) {
  const user = requireSession_(request.token);
  const avatarValue = String(request.avatar || "");
  const validV1 = /^avatar:v1:[0-5]:[0-6]:[0-6]:[0-7]:[0-7]$/.test(avatarValue);
  const validV2 = /^avatar:v2:[0-5]:[0-6]:[0-6]:[0-7]:(?:[1-7]-[0-7](?:,[1-7]-[0-7]){0,2})?$/.test(avatarValue);
  if (!validV1 && !validV2) throw new Error("Avatar no permitido.");
  updateObjectRow_(SHEETS.USERS, user._row, { Avatar: String(request.avatar) });
  user.Avatar = String(request.avatar);
  cacheUser_(user);
  const currentSession = cacheGet_(sessionCacheKey_(request.token));
  if (currentSession && currentSession.expiresAt) cachePut_(sessionCacheKey_(request.token), { user: user, expiresAt: currentSession.expiresAt }, CACHE_TTL.SESSION);
  return { avatar: String(request.avatar) };
}

function completeBonusApi_(request) {
  const user = requireSession_(request.token);
  const gameId = String(request.gameId || "");
  const allowedGames = ["word-search", "sudoku", "target", "forest-run", "station-pairs", "wellbeing-flight"];
  if (allowedGames.indexOf(gameId) < 0) throw new Error("Minijuego no permitido.");
  const scoreLimits = { "word-search": 80, "sudoku": 120, "target": 200, "forest-run": 300, "station-pairs": 250, "wellbeing-flight": 300 };
  const recordLimits = { "word-search": 80, "sudoku": 120, "target": 500, "forest-run": 5000, "station-pairs": 340, "wellbeing-flight": 500 };
  const score = Math.max(0, Math.min(scoreLimits[gameId], Number(request.score) || 0));
  const requestedRecord = request.record === undefined || request.record === null || request.record === "" ? score : Number(request.record);
  const record = Math.max(0, Math.min(recordLimits[gameId], Number(requestedRecord) || 0));
  bonusForUser_(user.Id);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(12000)) throw busyError_("Estamos guardando otros resultados. Reintentando…");
  let bestScore = score;
  let bestRecord = record;
  try {
    const latestRows = bonusForUser_(user.Id);
    const current = latestRows.find(function (row) { return String(row.JuegoId) === gameId; });
    if (current) {
      const currentRecord = bonusRecordValue_(current);
      bestScore = Math.max(Number(current.Puntaje) || 0, score);
      bestRecord = Math.max(currentRecord, record);
      const changes = { Puntaje: bestScore, Record: bestRecord, CompletadoEn: record > currentRecord ? new Date() : current.CompletadoEn || new Date() };
      updateObjectRow_(SHEETS.BONUS, current._row, changes);
      Object.assign(current, changes);
    } else {
      const created = { Id: Utilities.getUuid(), UsuarioId: user.Id, JuegoId: gameId, Puntaje: score, CompletadoEn: new Date(), Record: record };
      created._row = appendObject_(SHEETS.BONUS, created);
      latestRows.push(created);
    }
    invalidateUserActivity_(user.Id);
    cachePut_(bonusCacheKey_(user.Id), latestRows, CACHE_TTL.ACTIVITY);
  } finally { lock.releaseLock(); }
  return { gameId: gameId, score: score, bestScore: bestScore, bestRecord: bestRecord, completed: true };
}

function bonusRecordValue_(row) {
  if (row.Record === "" || row.Record === null || row.Record === undefined) return Number(row.Puntaje) || 0;
  return Math.max(0, Number(row.Record) || 0);
}

function bonusLeaderboardApi_(request) {
  const currentUser = requireSession_(request.token);
  if (truthy_(request.force)) CacheService.getScriptCache().remove(CACHE_KEYS.BONUS_LEADERBOARD);
  let rows = cacheGet_(CACHE_KEYS.BONUS_LEADERBOARD);
  if (!rows) {
    const users = {};
    sheetObjects_(SHEETS.USERS).filter(function (user) { return truthy_(user.Activo); }).forEach(function (user) {
      users[String(user.Id)] = { name: String(user.Nombre || "Participante"), uad: String(user.UAD || "") };
    });
    const rankedGames = ["forest-run", "station-pairs", "wellbeing-flight", "target"];
    const bonus = sheetObjects_(SHEETS.BONUS).filter(function (row) { return users[String(row.UsuarioId)] && rankedGames.indexOf(String(row.JuegoId)) >= 0 && bonusRecordValue_(row) > 0; });
    rows = [];
    rankedGames.forEach(function (gameId) {
      bonus.filter(function (row) { return String(row.JuegoId) === gameId; }).sort(function (a, b) {
        const aRecord = bonusRecordValue_(a);
        const bRecord = bonusRecordValue_(b);
        return bRecord - aRecord || new Date(a.CompletadoEn).getTime() - new Date(b.CompletadoEn).getTime();
      }).slice(0, 10).forEach(function (row) {
        const person = users[String(row.UsuarioId)];
        rows.push({ userId: String(row.UsuarioId), gameId: gameId, name: person.name, uad: person.uad, record: bonusRecordValue_(row), completedAt: row.CompletadoEn ? new Date(row.CompletadoEn).toISOString() : "" });
      });
    });
    cachePut_(CACHE_KEYS.BONUS_LEADERBOARD, rows, 120);
  }
  return { entries: rows.map(function (row) { return { gameId: row.gameId, name: row.name, uad: row.uad, record: row.record, completedAt: row.completedAt, isCurrent: String(row.userId) === String(currentUser.Id) }; }), updatedAt: new Date().toISOString() };
}

function adminCreateMissionApi_(request) {
  const admin = requireAdmin_(request.token);
  const mission = validateMissionInput_(request.mission || {});
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error("Hay otra misión guardándose. Intenta nuevamente en un momento.");
  let id;
  let sealCode;
  try {
    id = Date.now();
    sealCode = generateUniqueMissionCode_();
    appendObject_(SHEETS.MISSIONS, {
      Id: id, Estacion: mission.station, Icono: mission.icon, Color: mission.color,
      Titulo: mission.title, Descripcion: mission.description, Puntos: mission.points,
      Audiencia: mission.audience, Duracion: mission.duration, Activa: true,
      CreadaEn: new Date(), CreadaPor: admin.Id, CodigoSello: sealCode,
      EvidenciaObligatoria: mission.evidenceRequired, EditadaEn: "",
    });
  } finally { lock.releaseLock(); }
  invalidateMissionCaches_();
  return { id: id, sealCode: sealCode, audience: mission.audience };
}

function adminEditMissionApi_(request) {
  requireAdmin_(request.token);
  const input = validateMissionInput_(request.mission || {});
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error("Hay otra misión guardándose. Intenta nuevamente en un momento.");
  try {
  const current = sheetObjects_(SHEETS.MISSIONS).find(function (row) { return String(row.Id) === String(request.mission && request.mission.id) && truthy_(row.Activa); });
  if (!current) throw new Error("La misión ya no existe o fue eliminada.");
  const sealCode = truthy_(request.regenerateCode) ? generateUniqueMissionCode_() : normalizeMissionCode_(current.CodigoSello) || generateUniqueMissionCode_();
  updateObjectRow_(SHEETS.MISSIONS, current._row, {
    Estacion: input.station, Icono: input.icon, Color: input.color, Titulo: input.title,
    Descripcion: input.description, Puntos: input.points, Audiencia: input.audience,
    Duracion: input.duration, EvidenciaObligatoria: input.evidenceRequired,
    CodigoSello: sealCode, EditadaEn: new Date(),
  });
  invalidateMissionCaches_();
  return { mission: { id: Number(current.Id), station: input.station, icon: input.icon, color: input.color, title: input.title, description: input.description, points: input.points, audience: input.audience, duration: input.duration, evidenceRequired: input.evidenceRequired, sealCode: sealCode } };
  } finally { lock.releaseLock(); }
}

function adminDeleteMissionApi_(request) {
  requireAdmin_(request.token);
  const mission = sheetObjects_(SHEETS.MISSIONS).find(function (row) {
    return String(row.Id) === String(request.missionId) && truthy_(row.Activa);
  });
  if (!mission) throw new Error("La misión ya no existe o fue eliminada.");

  // Se desactiva en lugar de borrar la fila para conservar el historial.
  updateObjectRow_(SHEETS.MISSIONS, mission._row, { Activa: false });
  invalidateMissionCaches_();
  return { missionId: Number(mission.Id), deleted: true };
}

function adminCreateBadgeApi_(request) {
  const admin = requireAdmin_(request.token);
  const badge = validateBadgeInput_(request.badge || {});
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error("Hay otra insignia guardándose. Intenta nuevamente.");
  let id;
  let rowNumber;
  try {
    id = Utilities.getUuid();
    rowNumber = appendObject_(SHEETS.BADGES, {
      Id: id, Titulo: badge.title, Descripcion: badge.description, Icono: badge.icon,
      ColorPrimario: badge.primaryColor, ColorSecundario: badge.secondaryColor,
      TipoCriterio: badge.criterion, Meta: badge.goal, Estacion: badge.station,
      Activa: true, Orden: badge.order, CreadaEn: new Date(), CreadaPor: admin.Id, EditadaEn: "",
    });
  } finally { lock.releaseLock(); }
  invalidateBadgeCaches_();
  return { badge: publicBadge_(objectAtRow_(SHEETS.BADGES, rowNumber)) };
}

function adminEditBadgeApi_(request) {
  requireAdmin_(request.token);
  const badge = validateBadgeInput_(request.badge || {});
  const current = sheetObjects_(SHEETS.BADGES).find(function (row) { return String(row.Id) === String(request.badge && request.badge.id) && truthy_(row.Activa); });
  if (!current) throw new Error("La insignia ya no existe o fue eliminada.");
  updateObjectRow_(SHEETS.BADGES, current._row, {
    Titulo: badge.title, Descripcion: badge.description, Icono: badge.icon,
    ColorPrimario: badge.primaryColor, ColorSecundario: badge.secondaryColor,
    TipoCriterio: badge.criterion, Meta: badge.goal, Estacion: badge.station,
    Orden: badge.order, EditadaEn: new Date(),
  });
  invalidateBadgeCaches_();
  const updated = objectAtRow_(SHEETS.BADGES, current._row);
  return { badge: publicBadge_(updated) };
}

function adminDeleteBadgeApi_(request) {
  requireAdmin_(request.token);
  const badge = sheetObjects_(SHEETS.BADGES).find(function (row) { return String(row.Id) === String(request.badgeId) && truthy_(row.Activa); });
  if (!badge) throw new Error("La insignia ya no existe o fue eliminada.");
  updateObjectRow_(SHEETS.BADGES, badge._row, { Activa: false, EditadaEn: new Date() });
  invalidateBadgeCaches_();
  return { badgeId: String(badge.Id), deleted: true };
}

function adminEditUserApi_(request) {
  const admin = requireAdmin_(request.token);
  const input = request.user || {};
  const user = findUserById_(input.id);
  if (!user || !truthy_(user.Activo)) throw new Error("El usuario ya no existe o fue eliminado.");
  if (String(user.Id) === String(admin.Id) || String(user.Rol) === "ADMIN") throw new Error("No se puede editar una cuenta administradora desde este panel.");
  const name = limitedText_(input.name, 120, "El nombre es obligatorio.");
  const cedula = cleanId_(input.cedula);
  const email = limitedText_(input.email, 160, "El correo es obligatorio.").toLowerCase();
  const phone = String(input.phone || "").trim().slice(0, 30);
  const cargo = String(input.cargo || "").trim().slice(0, 120);
  const uad = limitedText_(input.uad, 120, "La UAD es obligatoria.");
  if (cedula.length < 5 || cedula.length > 25) throw new Error("La cédula no tiene un formato válido.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("El correo no tiene un formato válido.");
  const users = sheetObjects_(SHEETS.USERS).filter(function (row) { return truthy_(row.Activo) && String(row.Id) !== String(user.Id); });
  if (users.some(function (row) { return cleanId_(row.Cedula) === cedula; })) throw new Error("Ya existe otro usuario con esa cédula.");
  if (users.some(function (row) { return normalize_(row.Correo) === email; })) throw new Error("Ya existe otro usuario con ese correo.");
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error("Hay otro usuario guardándose. Intenta nuevamente.");
  try {
    updateObjectRow_(SHEETS.USERS, user._row, { Nombre: name, Cedula: cedula, Telefono: phone, Correo: email, Cargo: cargo, UAD: uad, SessionVersion: nextSessionVersion_(user) });
    revokeUserSessions_(user.Id);
    invalidateUserCache_(user);
    const updated = objectAtRow_(SHEETS.USERS, user._row);
    cacheUser_(updated);
  } finally { lock.releaseLock(); }
  invalidateAdminDashboard_();
  CacheService.getScriptCache().removeAll([CACHE_KEYS.BONUS_LEADERBOARD, CACHE_KEYS.ADMIN_BONUS_RECORDS]);
  return { user: { id: String(user.Id), name: name, cedula: cedula, phone: phone, email: email, cargo: cargo, uad: uad } };
}

function adminDeleteUserApi_(request) {
  const admin = requireAdmin_(request.token);
  const user = findUserById_(request.userId);
  if (!user || !truthy_(user.Activo)) throw new Error("El usuario ya no existe o fue eliminado.");
  if (String(user.Id) === String(admin.Id) || String(user.Rol) === "ADMIN") throw new Error("No se puede eliminar una cuenta administradora.");
  const suffix = String(user.Id).replace(/[^0-9A-Za-z]/g, "").slice(0, 8) + "-" + Date.now();
  updateObjectRow_(SHEETS.USERS, user._row, {
    Nombre: "Usuario eliminado", Cedula: "ELIMINADO-" + suffix, Telefono: "",
    Correo: "eliminado-" + suffix + "@pasaporte.local", Cargo: "", UAD: "",
    Avatar: "avatar:v2:2:0:1:0:", PasswordSalt: Utilities.getUuid(),
    PasswordHash: Utilities.getUuid().replace(/-/g, ""), Activo: false, SessionVersion: nextSessionVersion_(user),
  });
  revokeUserSessions_(user.Id);
  invalidateUserCache_(user);
  invalidateAdminDashboard_();
  CacheService.getScriptCache().removeAll([CACHE_KEYS.BONUS_LEADERBOARD, CACHE_KEYS.ADMIN_BONUS_RECORDS]);
  return { userId: String(user.Id), deleted: true };
}

function adminCreateRecoveryCodeApi_(request) {
  requireAdmin_(request.token);
  const user = findUserById_(request.userId);
  if (!user || !truthy_(user.Activo) || String(user.Rol) === "ADMIN") throw new Error("El usuario no está disponible.");
  const code = generateRecoveryCode_(8);
  createRecovery_(user.Id, code, "ADMIN", 24 * 60);
  return { userId: String(user.Id), code: code, expiresInHours: 24 };
}

function adminManageBonusRecordApi_(request) {
  requireAdmin_(request.token);
  const mode = String(request.mode || "");
  if (["reset", "delete", "resetAll"].indexOf(mode) < 0) throw new Error("Operación de récord no permitida.");
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error("Hay otra actualización de récords en curso. Intenta nuevamente.");
  let affectedUsers = [];
  let result;
  try {
    const sheet = getSheet_(SHEETS.BONUS);
    if (mode === "resetAll") {
      const rows = sheetObjects_(SHEETS.BONUS);
      affectedUsers = rows.map(function (row) { return String(row.UsuarioId); });
      if (rows.length) sheet.getRange(2, headerColumn_(SHEETS.BONUS, "Record"), rows.length, 1).setValues(rows.map(function () { return [0]; }));
      result = { mode: mode, affected: rows.length };
    } else {
      const record = sheetObjects_(SHEETS.BONUS).find(function (row) { return String(row.Id) === String(request.recordId || ""); });
      if (!record) throw new Error("El resultado ya no existe.");
      affectedUsers = [String(record.UsuarioId)];
      if (mode === "reset") updateObjectRow_(SHEETS.BONUS, record._row, { Record: 0 });
      else sheet.deleteRow(record._row);
      result = { mode: mode, recordId: String(record.Id), userId: String(record.UsuarioId), gameId: String(record.JuegoId) };
    }
  } finally { lock.releaseLock(); }
  invalidateBonusManagementCaches_(affectedUsers);
  return result;
}

function adminDashboardApi_(request) {
  requireAdmin_(request.token);
  // Manual refresh also picks up edits made directly in the spreadsheet.
  if (truthy_(request.force)) {
    invalidateMissionCaches_();
    CacheService.getScriptCache().remove(CACHE_KEYS.CATALOGS);
  }
  return { people: buildAdminPeople_(), missions: activeMissions_().map(adminMission_), evidence: buildAdminEvidence_(), records: buildAdminBonusRecords_(), badges: activeBadges_(), uads: assignmentUads_() };
}

function adminReportDataApi_(request) {
  requireAdmin_(request.token);
  const users = sheetObjects_(SHEETS.USERS).filter(function (row) { return truthy_(row.Activo) && String(row.Rol) !== "ADMIN"; });
  const missions = allMissions_();
  const activeMissions = missions.filter(function (row) { return truthy_(row.Activa); });
  const progress = sheetObjects_(SHEETS.PROGRESS);
  const bonus = sheetObjects_(SHEETS.BONUS);
  const badges = sheetObjects_(SHEETS.BADGES).filter(function (row) { return truthy_(row.Activa); });
  const evidence = sheetObjects_(SHEETS.EVIDENCE);
  const usersById = {};
  const missionsById = {};
  const progressByKey = {};
  const bonusByUser = {};
  users.forEach(function (user) { usersById[String(user.Id)] = user; });
  missions.forEach(function (mission) { missionsById[String(mission.Id)] = mission; });
  progress.forEach(function (row) { progressByKey[String(row.UsuarioId) + ":" + String(row.MisionId)] = row; });
  bonus.forEach(function (row) {
    const userId = String(row.UsuarioId);
    if (!bonusByUser[userId]) bonusByUser[userId] = [];
    bonusByUser[userId].push(row);
  });

  const people = buildAdminPeople_();
  const totalAssigned = users.reduce(function (sum, user) {
    return sum + activeMissions.filter(function (mission) { return missionAssignedTo_(mission.Audiencia, user.UAD); }).length;
  }, 0);
  const completedActive = users.reduce(function (sum, user) {
    return sum + activeMissions.filter(function (mission) {
      const row = progressByKey[String(user.Id) + ":" + String(mission.Id)];
      return missionAssignedTo_(mission.Audiencia, user.UAD) && row && String(row.Estado) === "COMPLETADA";
    }).length;
  }, 0);
  const totalPoints = people.reduce(function (sum, person) { return sum + Number(person.points || 0); }, 0);
  const gameNames = { "word-search": "Ruta de palabras", sudoku: "Sudoku seguro", target: "Tiro al riesgo", "forest-run": "Carrera del bosque", "station-pairs": "Parejas del festival", "wellbeing-flight": "Vuelo del bienestar" };

  const userRows = people.map(function (person) {
    const source = usersById[String(person.id)] || {};
    return { Nombre: person.name, Cedula: person.cedula, Telefono: person.phone || "", Correo: person.email, Cargo: person.cargo || "", UAD: person.uad, Estado: "ACTIVO", MisionesCompletadas: person.completed, MisionesDisponibles: person.total, AvancePorcentaje: person.total ? Math.round(person.completed / person.total * 100) : 0, Puntos: person.points, BonusCompletados: (bonusByUser[String(person.id)] || []).length, CreadoEn: reportDate_(source.CreadoEn) };
  });

  const missionRows = activeMissions.map(function (mission) {
    const assigned = users.filter(function (user) { return missionAssignedTo_(mission.Audiencia, user.UAD); });
    const completed = assigned.filter(function (user) { const row = progressByKey[String(user.Id) + ":" + String(mission.Id)]; return row && String(row.Estado) === "COMPLETADA"; }).length;
    const started = assigned.filter(function (user) { const row = progressByKey[String(user.Id) + ":" + String(mission.Id)]; return row && String(row.Estado) === "INICIADA"; }).length;
    return { Id: Number(mission.Id), Estacion: String(mission.Estacion), Mision: String(mission.Titulo), Audiencia: String(mission.Audiencia), Duracion: String(mission.Duracion || ""), Puntos: Number(mission.Puntos) || 0, EvidenciaObligatoria: truthy_(mission.EvidenciaObligatoria), Asignados: assigned.length, Iniciaron: started, Completaron: completed, Pendientes: Math.max(0, assigned.length - completed), CumplimientoPorcentaje: assigned.length ? Math.round(completed / assigned.length * 100) : 0, CreadaEn: reportDate_(mission.CreadaEn) };
  });

  const detailRows = [];
  users.forEach(function (user) {
    activeMissions.filter(function (mission) { return missionAssignedTo_(mission.Audiencia, user.UAD); }).forEach(function (mission) {
      const row = progressByKey[String(user.Id) + ":" + String(mission.Id)];
      detailRows.push({ Colaborador: String(user.Nombre), Cedula: String(user.Cedula), UAD: String(user.UAD), Cargo: String(user.Cargo || ""), Estacion: String(mission.Estacion), Mision: String(mission.Titulo), Estado: row ? String(row.Estado) : "PENDIENTE", IniciadaEn: reportDate_(row && row.IniciadaEn), CompletadaEn: reportDate_(row && row.CompletadaEn), PuntosMision: row && String(row.Estado) === "COMPLETADA" ? Number(mission.Puntos) || 0 : 0 });
    });
  });

  const bonusRows = bonus.map(function (row) {
    const user = usersById[String(row.UsuarioId)] || {};
    return { Colaborador: String(user.Nombre || "Usuario eliminado"), Cedula: String(user.Cedula || ""), UAD: String(user.UAD || ""), Juego: gameNames[String(row.JuegoId)] || String(row.JuegoId), Puntos: Number(row.Puntaje) || 0, Record: bonusRecordValue_(row), Fecha: reportDate_(row.CompletadoEn) };
  });

  const uadGroups = {};
  userRows.forEach(function (row) {
    const key = String(row.UAD || "Sin UAD");
    if (!uadGroups[key]) uadGroups[key] = { UAD: key, Participantes: 0, MisionesDisponibles: 0, MisionesCompletadas: 0, Puntos: 0 };
    uadGroups[key].Participantes += 1;
    uadGroups[key].MisionesDisponibles += Number(row.MisionesDisponibles) || 0;
    uadGroups[key].MisionesCompletadas += Number(row.MisionesCompletadas) || 0;
    uadGroups[key].Puntos += Number(row.Puntos) || 0;
  });
  const uadRows = Object.keys(uadGroups).sort().map(function (key) {
    const row = uadGroups[key];
    row.CumplimientoPorcentaje = row.MisionesDisponibles ? Math.round(row.MisionesCompletadas / row.MisionesDisponibles * 100) : 0;
    return row;
  });

  const activityRows = [];
  progress.forEach(function (row) {
    const user = usersById[String(row.UsuarioId)];
    const mission = missionsById[String(row.MisionId)];
    if (!user || !mission) return;
    activityRows.push({ Fecha: reportDate_(row.CompletadaEn || row.IniciadaEn), Tipo: String(row.Estado) === "COMPLETADA" ? "MISION_COMPLETADA" : "MISION_INICIADA", Colaborador: String(user.Nombre), Cedula: String(user.Cedula), UAD: String(user.UAD), Detalle: String(mission.Titulo) });
  });
  bonus.forEach(function (row) {
    const user = usersById[String(row.UsuarioId)];
    if (!user) return;
    activityRows.push({ Fecha: reportDate_(row.CompletadoEn), Tipo: "MINIJUEGO", Colaborador: String(user.Nombre), Cedula: String(user.Cedula), UAD: String(user.UAD), Detalle: gameNames[String(row.JuegoId)] || String(row.JuegoId) });
  });
  activityRows.sort(function (a, b) { return String(b.Fecha).localeCompare(String(a.Fecha)); });

  return {
    generatedAt: new Date().toISOString(),
    summary: [
      { Indicador: "Colaboradores activos", Valor: users.length },
      { Indicador: "Misiones activas", Valor: activeMissions.length },
      { Indicador: "Asignaciones totales", Valor: totalAssigned },
      { Indicador: "Misiones completadas", Valor: completedActive },
      { Indicador: "Cumplimiento general (%)", Valor: totalAssigned ? Math.round(completedActive / totalAssigned * 100) : 0 },
      { Indicador: "Puntos entregados", Valor: totalPoints },
      { Indicador: "Partidas con resultado", Valor: bonus.length },
      { Indicador: "Evidencias recibidas", Valor: evidence.length },
      { Indicador: "Insignias activas", Valor: badges.length },
    ],
    users: userRows,
    missions: missionRows,
    progress: detailRows,
    badges: badges.map(function (row) { return { Insignia: String(row.Titulo), Descripcion: String(row.Descripcion), Icono: String(row.Icono), ColorPrimario: String(row.ColorPrimario), ColorSecundario: String(row.ColorSecundario), Criterio: String(row.TipoCriterio), Meta: Number(row.Meta) || 1, Estacion: String(row.Estacion || ""), Orden: Number(row.Orden) || 100 }; }),
    bonus: bonusRows,
    evidence: evidence.map(function (row) { const user = usersById[String(row.UsuarioId)] || {}; const mission = missionsById[String(row.MisionId)] || {}; return { Colaborador: String(user.Nombre || "Usuario eliminado"), Cedula: String(user.Cedula || ""), UAD: String(user.UAD || ""), Mision: String(mission.Titulo || "Misión eliminada"), Archivo: String(row.NombreArchivo), Tipo: String(row.TipoMime), TamanoBytes: Number(row.TamanoBytes) || 0, Estado: String(row.Estado || "RECIBIDA"), Fecha: reportDate_(row.CreadoEn), URL: String(row.Url || "") }; }),
    uads: uadRows,
    activity: activityRows,
  };
}

function reportDate_(value) {
  if (!value) return "";
  const date = new Date(value);
  return isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function buildAdminBonusRecords_() {
  const cached = cacheGet_(CACHE_KEYS.ADMIN_BONUS_RECORDS);
  if (cached) return cached;
  const users = {};
  sheetObjects_(SHEETS.USERS).forEach(function (user) { users[String(user.Id)] = { name: String(user.Nombre || "Usuario eliminado"), uad: String(user.UAD || "") }; });
  const names = { "word-search": "Ruta de palabras", sudoku: "Sudoku seguro", target: "Tiro al riesgo", "forest-run": "Carrera del bosque", "station-pairs": "Parejas del festival", "wellbeing-flight": "Vuelo del bienestar" };
  const result = sheetObjects_(SHEETS.BONUS).sort(function (a, b) { return new Date(b.CompletadoEn).getTime() - new Date(a.CompletadoEn).getTime(); }).map(function (row) {
    const user = users[String(row.UsuarioId)] || { name: "Usuario eliminado", uad: "" };
    return { id: String(row.Id), userId: String(row.UsuarioId), userName: user.name, uad: user.uad, gameId: String(row.JuegoId), gameName: names[String(row.JuegoId)] || String(row.JuegoId), score: Number(row.Puntaje) || 0, record: bonusRecordValue_(row), completedAt: row.CompletadoEn ? new Date(row.CompletadoEn).toISOString() : "" };
  });
  cachePut_(CACHE_KEYS.ADMIN_BONUS_RECORDS, result, 30);
  return result;
}

function invalidateBonusManagementCaches_(userIds) {
  const unique = {};
  (userIds || []).forEach(function (userId) { if (userId) unique[String(userId)] = true; });
  const keys = Object.keys(unique).map(bonusCacheKey_);
  keys.push(CACHE_KEYS.ADMIN_DASHBOARD, CACHE_KEYS.ADMIN_BONUS_RECORDS, CACHE_KEYS.BONUS_LEADERBOARD);
  const cache = CacheService.getScriptCache();
  for (let index = 0; index < keys.length; index += 90) cache.removeAll(keys.slice(index, index + 90));
}

function userBundle_(user) {
  const missions = String(user.Rol) === "ADMIN" ? activeMissions_() : allowedMissions_(user);
  const progress = progressForUser_(user.Id);
  const completed = progress.filter(function (row) { return row.Estado === "COMPLETADA"; }).map(function (row) { return Number(row.MisionId); });
  const started = progress.filter(function (row) { return row.Estado === "INICIADA"; }).map(function (row) { return Number(row.MisionId); });
  const history = {};
  progress.forEach(function (row) { if (row.Estado === "COMPLETADA" && row.CompletadaEn) history[Number(row.MisionId)] = new Date(row.CompletadaEn).toISOString(); });
  const historyMissions = completed.length ? allMissions_().filter(function (mission) {
    return completed.indexOf(Number(mission.Id)) >= 0;
  }).map(publicMission_) : [];
  const bonusRows = bonusForUser_(user.Id);
  const bonusScores = {};
  const bonusRecords = {};
  bonusRows.forEach(function (row) {
    bonusScores[String(row.JuegoId)] = Number(row.Puntaje) || 0;
    bonusRecords[String(row.JuegoId)] = bonusRecordValue_(row);
  });
  return { user: publicUser_(user), missions: missions.map(publicMission_), historyMissions: historyMissions, completed: completed, started: started, history: history, bonusCompleted: Object.keys(bonusScores), bonusScores: bonusScores, bonusRecords: bonusRecords, badgeDefinitions: activeBadges_() };
}

function buildAdminPeople_() {
  const cached = cacheGet_(CACHE_KEYS.ADMIN_DASHBOARD);
  if (cached) return cached;
  const users = sheetObjects_(SHEETS.USERS).filter(function (row) { return truthy_(row.Activo) && row.Rol !== "ADMIN"; });
  const missions = activeMissions_();
  const allMissions = allMissions_();
  const progress = sheetObjects_(SHEETS.PROGRESS).filter(function (row) { return row.Estado === "COMPLETADA"; });
  const bonus = sheetObjects_(SHEETS.BONUS);
  const pointsByMission = {};
  const progressByUser = {};
  const bonusByUser = {};
  allMissions.forEach(function (m) { pointsByMission[String(m.Id)] = Number(m.Puntos) || 0; });
  progress.forEach(function (row) {
    const userId = String(row.UsuarioId);
    if (!progressByUser[userId]) progressByUser[userId] = [];
    progressByUser[userId].push(row);
  });
  bonus.forEach(function (row) {
    const userId = String(row.UsuarioId);
    bonusByUser[userId] = (bonusByUser[userId] || 0) + (Number(row.Puntaje) || 0);
  });
  const people = users.map(function (user) {
    const available = missions.filter(function (m) { return missionAssignedTo_(m.Audiencia, user.UAD); });
    const completedRows = progressByUser[String(user.Id)] || [];
    const availableIds = available.map(function (mission) { return String(mission.Id); });
    const activeCompletedRows = completedRows.filter(function (row) { return availableIds.indexOf(String(row.MisionId)) >= 0; });
    return {
      id: String(user.Id), name: String(user.Nombre), cedula: String(user.Cedula), phone: String(user.Telefono || ""), email: String(user.Correo || ""), cargo: String(user.Cargo || ""),
      uad: String(user.UAD), completed: activeCompletedRows.length, total: available.length,
      points: completedRows.reduce(function (sum, p) { return sum + (pointsByMission[String(p.MisionId)] || 0); }, 0) + (bonusByUser[String(user.Id)] || 0),
      createdAt: user.CreadoEn ? new Date(user.CreadoEn).toISOString() : "",
    };
  });
  cachePut_(CACHE_KEYS.ADMIN_DASHBOARD, people, 30);
  return people;
}

function buildAdminEvidence_() {
  const cached = cacheGet_(CACHE_KEYS.ADMIN_EVIDENCE);
  if (cached) return cached;
  const users = {};
  const missions = {};
  sheetObjects_(SHEETS.USERS).forEach(function (row) { users[String(row.Id)] = String(row.Nombre || "Participante"); });
  allMissions_().forEach(function (row) { missions[String(row.Id)] = String(row.Titulo || "Misión"); });
  const rows = sheetObjects_(SHEETS.EVIDENCE).sort(function (a, b) { return new Date(b.CreadoEn).getTime() - new Date(a.CreadoEn).getTime(); }).slice(0, 100);
  const result = rows.map(function (row) {
    return { id: String(row.Id), userName: users[String(row.UsuarioId)] || "Participante", missionTitle: missions[String(row.MisionId)] || "Misión", fileName: String(row.NombreArchivo), mime: String(row.TipoMime), size: Number(row.TamanoBytes) || 0, url: String(row.Url), status: String(row.Estado || "RECIBIDA"), createdAt: row.CreadoEn ? new Date(row.CreadoEn).toISOString() : "" };
  });
  cachePut_(CACHE_KEYS.ADMIN_EVIDENCE, result, 30);
  return result;
}

function validateMissionInput_(mission) {
  const title = limitedText_(mission.title, 120, "El nombre de la misión es obligatorio.");
  const station = limitedText_(mission.station, 80, "La estación es obligatoria.");
  const description = limitedText_(mission.description, 700, "La descripción es obligatoria.");
  const audience = validateMissionAudience_(mission.audience);
  const duration = limitedText_(mission.duration || "8 min", 30, "La duración es obligatoria.");
  const stationOptions = {
    "Estación Diversidad": ["◉", "#9d5cff"], "Estación Felicidad": ["♡", "#ffb703"],
    "Estación Seguridad": ["◇", "#12cfe0"], "Estación Salud": ["+", "#43d17d"],
    "Estación Amor Propio": ["✦", "#ff5c9b"], "Estación Ambiental": ["♧", "#8bd33f"],
  };
  if (!stationOptions[station]) throw new Error("La estación seleccionada no es válida.");
  return { title: title, station: station, description: description, audience: audience, duration: duration, points: Math.max(10, Math.min(1000, Number(mission.points) || 100)), icon: stationOptions[station][0], color: stationOptions[station][1], evidenceRequired: truthy_(mission.evidenceRequired) };
}

function validateBadgeInput_(input) {
  const title = limitedText_(input.title, 80, "El nombre de la insignia es obligatorio.");
  const description = limitedText_(input.description, 240, "La descripción es obligatoria.");
  const icons = ["star", "shield", "trophy", "leaf", "heart", "rocket", "sparkle", "medal", "planet", "hand", "flame", "target", "bolt", "crown", "compass", "hands"];
  const criteria = ["MISSIONS", "POINTS", "BONUS", "STATIONS", "STATION", "ALL_MISSIONS"];
  const icon = String(input.icon || "star");
  const criterion = String(input.criterion || "MISSIONS").toUpperCase();
  if (icons.indexOf(icon) < 0) throw new Error("El icono seleccionado no es válido.");
  if (criteria.indexOf(criterion) < 0) throw new Error("El criterio seleccionado no es válido.");
  const primaryColor = validHexColor_(input.primaryColor, "#9d5cff");
  const secondaryColor = validHexColor_(input.secondaryColor, "#12cfe0");
  const goal = criterion === "ALL_MISSIONS" ? 1 : Math.max(1, Math.min(100000, Number(input.goal) || 1));
  const stations = ["Estación Diversidad", "Estación Felicidad", "Estación Seguridad", "Estación Salud", "Estación Amor Propio", "Estación Ambiental"];
  const station = criterion === "STATION" ? String(input.station || "") : "";
  if (criterion === "STATION" && stations.indexOf(station) < 0) throw new Error("Selecciona la estación asociada a la insignia.");
  return { title: title, description: description, icon: icon, primaryColor: primaryColor, secondaryColor: secondaryColor, criterion: criterion, goal: goal, station: station, order: Math.max(1, Math.min(999, Number(input.order) || 100)) };
}

function validHexColor_(value, fallback) {
  const color = String(value || fallback).toLowerCase();
  return /^#[0-9a-f]{6}$/.test(color) ? color : fallback;
}

function activeBadges_() {
  const cached = cacheGet_(CACHE_KEYS.BADGES);
  if (cached) return cached;
  if (!getSpreadsheet_().getSheetByName(SHEETS.BADGES)) return [];
  const badges = sheetObjects_(SHEETS.BADGES).filter(function (row) { return truthy_(row.Activa); })
    .sort(function (a, b) { return Number(a.Orden || 100) - Number(b.Orden || 100); })
    .map(publicBadge_);
  cachePut_(CACHE_KEYS.BADGES, badges, CACHE_TTL.MISSIONS);
  return badges;
}

function publicBadge_(row) {
  return { id: String(row.Id), title: String(row.Titulo), description: String(row.Descripcion), icon: String(row.Icono || "star"), primaryColor: validHexColor_(row.ColorPrimario, "#9d5cff"), secondaryColor: validHexColor_(row.ColorSecundario, "#12cfe0"), criterion: String(row.TipoCriterio || "MISSIONS"), goal: Math.max(1, Number(row.Meta) || 1), station: String(row.Estacion || ""), order: Math.max(1, Number(row.Orden) || 100) };
}

function invalidateBadgeCaches_() {
  CacheService.getScriptCache().removeAll([CACHE_KEYS.BADGES, CACHE_KEYS.ADMIN_DASHBOARD]);
}

function generateUniqueMissionCode_() {
  const used = {};
  sheetObjects_(SHEETS.MISSIONS).forEach(function (row) { const code = normalizeMissionCode_(row.CodigoSello); if (code) used[code] = true; });
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 40; attempt += 1) {
    let code = "";
    for (let index = 0; index < 6; index += 1) code += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    if (!used[code]) return code;
  }
  return Utilities.getUuid().replace(/-/g, "").slice(0, 8).toUpperCase();
}

function normalizeMissionCode_(value) { return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8); }

function saveEvidence_(user, mission, input) {
  const mime = String(input.mime || "").toLowerCase();
  if (mime.indexOf("image/") !== 0 && mime.indexOf("video/") !== 0) throw new Error("La evidencia debe ser una foto o un video.");
  const encoded = String(input.data || "");
  if (!encoded || encoded.length > 10 * 1024 * 1024) throw new Error("La evidencia supera el tamaño permitido.");
  const bytes = Utilities.base64Decode(encoded);
  if (bytes.length > 7 * 1024 * 1024) throw new Error("La evidencia supera 7 MB.");
  const name = safeEvidenceName_(input.name || (mime.indexOf("image/") === 0 ? "evidencia.jpg" : "evidencia.mp4"));
  const folder = evidenceFolder_();
  const file = folder.createFile(Utilities.newBlob(bytes, mime, String(mission.Id) + "-" + String(user.Id).slice(0, 8) + "-" + name));
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(12000)) {
    try { file.setTrashed(true); } catch (error) { /* La limpieza de Drive no bloquea el reintento. */ }
    throw busyError_("Estamos registrando otras evidencias. Reintentando…");
  }
  try {
    appendObject_(SHEETS.EVIDENCE, { Id: Utilities.getUuid(), UsuarioId: user.Id, MisionId: mission.Id, ArchivoId: file.getId(), NombreArchivo: name, TipoMime: mime, TamanoBytes: bytes.length, Url: file.getUrl(), Estado: "RECIBIDA", CreadoEn: new Date() });
  } finally { lock.releaseLock(); }
  CacheService.getScriptCache().remove(CACHE_KEYS.ADMIN_EVIDENCE);
  return file.getId();
}

function evidenceFolder_() {
  const props = PropertiesService.getScriptProperties();
  const existingId = props.getProperty("EVIDENCE_FOLDER_ID");
  if (existingId) {
    try { return DriveApp.getFolderById(existingId); } catch (error) { props.deleteProperty("EVIDENCE_FOLDER_ID"); }
  }
  const folder = DriveApp.createFolder("PASAPORTE_SEGURO_EVIDENCIAS");
  props.setProperty("EVIDENCE_FOLDER_ID", folder.getId());
  return folder;
}

function safeEvidenceName_(value) {
  const safe = String(value || "evidencia").replace(/[^0-9A-Za-z._ -]/g, "_").replace(/\s+/g, "-").slice(0, 120);
  return safe || "evidencia";
}

function audienceKey_(value) {
  return String(value === null || value === undefined ? "" : value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLowerCase();
}

function missionAssignedTo_(audience, uad) {
  const key = audienceKey_(audience);
  return key === "todas las uad" || (key !== "" && key === audienceKey_(uad));
}

function assignmentUads_() {
  const seen = {};
  const values = catalogsApi_().uads.concat(sheetObjects_(SHEETS.USERS).filter(function (user) { return truthy_(user.Activo); }).map(function (user) { return user.UAD; }));
  return values.map(function (value) { return String(value || "").trim().replace(/\s+/g, " "); }).filter(function (value) {
    const key = audienceKey_(value);
    if (!key || key === "todas las uad" || seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

function validateMissionAudience_(value) {
  const audience = limitedText_(value, 120, "Selecciona una UAD o Todas las UAD.");
  const key = audienceKey_(audience);
  if (key === "todas las uad") return "Todas las UAD";
  const canonical = assignmentUads_().find(function (uad) { return audienceKey_(uad) === key; });
  if (!canonical) throw new Error("La UAD asignada no existe en el catálogo ni entre los usuarios activos. Actualiza el panel y selecciona una UAD válida.");
  return canonical;
}

function allowedMissions_(user) {
  return activeMissions_().filter(function (mission) {
    return missionAssignedTo_(mission.Audiencia, user.UAD);
  });
}

function activeMissions_() {
  const cached = cacheGet_(CACHE_KEYS.MISSIONS);
  if (cached) return cached;
  const missions = sheetObjects_(SHEETS.MISSIONS).filter(function (row) { return truthy_(row.Activa); });
  cachePut_(CACHE_KEYS.MISSIONS, missions, CACHE_TTL.MISSIONS);
  return missions;
}

function allMissions_() {
  const cached = cacheGet_(CACHE_KEYS.MISSIONS_ALL);
  if (cached) return cached;
  const missions = sheetObjects_(SHEETS.MISSIONS);
  cachePut_(CACHE_KEYS.MISSIONS_ALL, missions, CACHE_TTL.MISSIONS);
  return missions;
}

function allowedMission_(user, missionId) {
  const mission = allowedMissions_(user).find(function (row) { return String(row.Id) === String(missionId); });
  if (!mission) throw new Error("La misión no está disponible para tu UAD.");
  return mission;
}

function upsertProgress_(userId, missionId, status) {
  const rows = progressForUser_(userId);
  const current = rows.find(function (row) { return String(row.MisionId) === String(missionId); });
  const now = new Date();
  if (current) {
    // El progreso solo avanza: una petición STARTED atrasada nunca puede
    // devolver una misión ya completada al estado inicial.
    const finalStatus = String(current.Estado) === "COMPLETADA" || status === "COMPLETADA" ? "COMPLETADA" : status;
    const changes = { Estado: finalStatus };
    if (!current.IniciadaEn) changes.IniciadaEn = now;
    if (finalStatus === "COMPLETADA" && !current.CompletadaEn) changes.CompletadaEn = now;
    updateObjectRow_(SHEETS.PROGRESS, current._row, changes);
    const updatedRows = rows.map(function (row) { return String(row.MisionId) === String(missionId) ? Object.assign({}, row, changes) : row; });
    invalidateUserActivity_(userId);
    cachePut_(progressCacheKey_(userId), updatedRows, CACHE_TTL.ACTIVITY);
    return;
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(12000)) throw busyError_("Estamos guardando el progreso de otros participantes. Reintentando…");
  try {
    const latestRows = progressForUser_(userId);
    const existing = latestRows.find(function (row) { return String(row.MisionId) === String(missionId); });
    if (existing) {
      const finalStatus = String(existing.Estado) === "COMPLETADA" || status === "COMPLETADA" ? "COMPLETADA" : status;
      const changes = { Estado: finalStatus, IniciadaEn: existing.IniciadaEn || now, CompletadaEn: finalStatus === "COMPLETADA" ? existing.CompletadaEn || now : "" };
      updateObjectRow_(SHEETS.PROGRESS, existing._row, changes);
      Object.assign(existing, changes);
    } else {
      const created = { Id: Utilities.getUuid(), UsuarioId: userId, MisionId: missionId, Estado: status, IniciadaEn: now, CompletadaEn: status === "COMPLETADA" ? now : "" };
      created._row = appendObject_(SHEETS.PROGRESS, created);
      latestRows.push(created);
    }
    invalidateUserActivity_(userId);
    cachePut_(progressCacheKey_(userId), latestRows, CACHE_TTL.ACTIVITY);
  } finally { lock.releaseLock(); }
}

function requireSession_(token) {
  // Los tokens nuevos se verifican antes de devolver la caché. La consulta del
  // usuario normalmente también sale de caché, pero permite revocar una sesión
  // inmediatamente al editar, desactivar o restablecer la contraseña.
  const signedSession = readSessionToken_(token);
  if (signedSession) {
    const signedUser = findUserByCedula_(signedSession.cedula);
    if (!signedUser || !truthy_(signedUser.Activo) || sessionVersion_(signedUser) !== String(signedSession.version)) throw new Error("Tu sesión cambió o fue revocada. Inicia sesión nuevamente.");
    const signedExpiry = new Date(Number(signedSession.expiresAt));
    cachePut_(sessionCacheKey_(token), { user: signedUser, expiresAt: signedExpiry.toISOString() }, CACHE_TTL.SESSION);
    return signedUser;
  }
  if (String(token || "").indexOf("ps2.") === 0) throw new Error("Tu sesión venció o no es válida. Inicia sesión nuevamente.");
  const cached = cacheGet_(sessionCacheKey_(token));
  if (cached && new Date(cached.expiresAt).getTime() > Date.now() && cached.user && truthy_(cached.user.Activo)) return cached.user;
  // Compatibilidad temporal con sesiones emitidas por versiones anteriores.
  const session = findObjectByField_(SHEETS.SESSIONS, "Token", token, String);
  if (!session || new Date(session.ExpiraEn).getTime() <= Date.now()) throw new Error("Tu sesión venció. Inicia sesión nuevamente.");
  const user = findUserById_(session.UsuarioId);
  if (!user || !truthy_(user.Activo)) throw new Error("Usuario inactivo.");
  cachePut_(sessionCacheKey_(token), { user: user, expiresAt: new Date(session.ExpiraEn).toISOString() }, CACHE_TTL.SESSION);
  return user;
}

function sessionVersion_(user) { return String(user && user.SessionVersion || "1"); }
function nextSessionVersion_(user) { return String(Math.max(Date.now(), Number(sessionVersion_(user)) + 1)); }

function ensureTokenSecret_() {
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty("PASAPORTE_TOKEN_SECRET");
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid();
    props.setProperty("PASAPORTE_TOKEN_SECRET", secret);
  }
  return secret;
}

function tokenSignature_(payload) {
  const bytes = Utilities.computeHmacSha256Signature(String(payload), ensureTokenSecret_(), Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, "");
}

function secureEqual_(left, right) {
  left = String(left || ""); right = String(right || "");
  let mismatch = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  return mismatch === 0;
}

function createSessionToken_(user, expiresAt) {
  const payload = Utilities.base64EncodeWebSafe(JSON.stringify({ cedula: cleanId_(user.Cedula), expiresAt: expiresAt.getTime(), version: sessionVersion_(user) }), Utilities.Charset.UTF_8).replace(/=+$/g, "");
  return "ps2." + payload + "." + tokenSignature_(payload);
}

function readSessionToken_(token) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length !== 3 || parts[0] !== "ps2" || !secureEqual_(parts[2], tokenSignature_(parts[1]))) return null;
    const json = Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[1])).getDataAsString();
    const payload = JSON.parse(json);
    if (!payload.cedula || Number(payload.expiresAt) <= Date.now()) return null;
    return payload;
  } catch (error) { return null; }
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

function revokeUserSessions_(userId) {
  const sheet = getSheet_(SHEETS.SESSIONS);
  const rows = findObjectsByField_(SHEETS.SESSIONS, "UsuarioId", userId, String).sort(function (a, b) { return b._row - a._row; });
  rows.forEach(function (row) {
    CacheService.getScriptCache().remove(sessionCacheKey_(row.Token));
    sheet.deleteRow(row._row);
  });
  CacheService.getScriptCache().remove(activeSessionCacheKey_(userId));
}

function createRecovery_(userId, code, channel, durationMinutes) {
  const id = Utilities.getUuid();
  const row = {
    Id: id, UsuarioId: userId, CodigoHash: hashPassword_(normalizeRecoveryCode_(code), id),
    ExpiraEn: new Date(Date.now() + durationMinutes * 60 * 1000), Intentos: 0,
    Usado: false, Canal: channel, CreadoEn: new Date(), VerificadoEn: "", TicketHash: "", TicketExpiraEn: "",
  };
  row._row = appendObject_(SHEETS.RECOVERY, row);
  return row;
}

function generateRecoveryCode_(length) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < length; index += 1) code += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  return code;
}

function normalizeRecoveryCode_(value) { return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12); }

function enforceRecoveryRequestRate_(cedula) {
  const key = "pasaporte:recovery-request:" + cedula;
  const cache = CacheService.getScriptCache();
  const attempts = Number(cache.get(key)) || 0;
  if (attempts >= 3) throw new Error("Ya se solicitaron varios códigos. Espera 15 minutos o pide un código de respaldo al administrador.");
  cache.put(key, String(attempts + 1), 900);
}

function mantenimientoPasaporteSeguro() {
  cleanupSessions_();
  cleanupRecoveries_();
  return "Sesiones y recuperaciones vencidas eliminadas.";
}

function cleanupRecoveries_() {
  const sheet = getSheet_(SHEETS.RECOVERY);
  const threshold = Date.now() - 7 * 24 * 60 * 60 * 1000;
  sheetObjects_(SHEETS.RECOVERY).filter(function (row) { return truthy_(row.Usado) || new Date(row.ExpiraEn).getTime() < threshold; })
    .sort(function (a, b) { return b._row - a._row; })
    .forEach(function (row) { sheet.deleteRow(row._row); });
}

function sessionCacheKey_(token) {
  return "pasaporte:session:" + String(token || "");
}

function activeSessionCacheKey_(userId) { return "pasaporte:active-session:" + String(userId || ""); }
function userCedulaCacheKey_(cedula) { return "pasaporte:user:cedula:" + cleanId_(cedula); }
function userIdCacheKey_(id) { return "pasaporte:user:id:" + String(id || ""); }
function progressCacheKey_(userId) { return "pasaporte:progress:" + String(userId || ""); }
function bonusCacheKey_(userId) { return "pasaporte:bonus:" + String(userId || ""); }

function progressForUser_(userId) {
  return activityRowsForUser_(SHEETS.PROGRESS, userId, progressCacheKey_);
}

function bonusForUser_(userId) {
  return activityRowsForUser_(SHEETS.BONUS, userId, bonusCacheKey_);
}

function activityRowsForUser_(sheetName, userId, keyBuilder) {
  const key = keyBuilder(userId);
  const cached = cacheGet_(key);
  if (cached !== null) return cached;
  // Durante la apertura del evento, todos los participantes leen dos snapshots
  // preparados en lote en vez de ejecutar cientos de búsquedas independientes.
  const warmUntil = Number(CacheService.getScriptCache().get(CACHE_KEYS.EVENT_WARM_UNTIL)) || 0;
  if (warmUntil > Date.now()) {
    const snapshotKey = activitySnapshotKey_(sheetName, userId);
    const snapshot = snapshotKey ? cacheGet_(snapshotKey) : null;
    if (snapshot !== null) {
      const warmRows = snapshot[String(userId)] || [];
      cachePut_(key, warmRows, CACHE_TTL.ACTIVITY);
      return warmRows;
    }
  }
  const rows = findObjectsByField_(sheetName, "UsuarioId", userId, String);
  cachePut_(key, rows, CACHE_TTL.ACTIVITY);
  return rows;
}

function invalidateUserActivity_(userId) {
  CacheService.getScriptCache().removeAll([progressCacheKey_(userId), bonusCacheKey_(userId), CACHE_KEYS.ADMIN_DASHBOARD, CACHE_KEYS.ADMIN_BONUS_RECORDS, CACHE_KEYS.BONUS_LEADERBOARD]);
}

function invalidateMissionCaches_() {
  CacheService.getScriptCache().removeAll([CACHE_KEYS.MISSIONS, CACHE_KEYS.MISSIONS_ALL, CACHE_KEYS.ADMIN_DASHBOARD]);
}

function invalidateAdminDashboard_() {
  CacheService.getScriptCache().remove(CACHE_KEYS.ADMIN_DASHBOARD);
}

function publicUser_(user) {
  return { name: String(user.Nombre), cedula: String(user.Cedula), phone: String(user.Telefono || ""), email: String(user.Correo || ""), cargo: String(user.Cargo || ""), uad: String(user.UAD || ""), avatar: String(user.Avatar || "avatar:v1:2:0:1:0:0"), role: String(user.Rol) === "ADMIN" ? "ADMIN" : "USER" };
}

function publicMission_(m) {
  return { id: Number(m.Id), station: String(m.Estacion), icon: String(m.Icono), color: String(m.Color), title: String(m.Titulo), description: String(m.Descripcion), points: Number(m.Puntos), audience: String(m.Audiencia), duration: String(m.Duracion), evidenceRequired: truthy_(m.EvidenciaObligatoria) };
}

function adminMission_(m) {
  const mission = publicMission_(m);
  mission.sealCode = normalizeMissionCode_(m.CodigoSello);
  return mission;
}

function findUserByCedula_(cedula) {
  const key = userCedulaCacheKey_(cedula);
  const cached = cacheGet_(key);
  if (cached) return cached;
  warmUserCaches_();
  const warmed = cacheGet_(key);
  if (warmed) return warmed;
  const user = findObjectByField_(SHEETS.USERS, "Cedula", cedula, cleanId_);
  if (user) cacheUser_(user);
  return user;
}

function findUserById_(id) {
  const key = userIdCacheKey_(id);
  const cached = cacheGet_(key);
  if (cached) return cached;
  const user = findObjectByField_(SHEETS.USERS, "Id", id, String);
  if (user) cacheUser_(user);
  return user;
}

function cacheUser_(user) {
  if (!user) return;
  cachePut_(userCedulaCacheKey_(user.Cedula), user, CACHE_TTL.USER);
  cachePut_(userIdCacheKey_(user.Id), user, CACHE_TTL.USER);
}

function warmUserCaches_() {
  const cache = CacheService.getScriptCache();
  try { if (cache.get(CACHE_KEYS.USERS_WARM)) return true; } catch (error) { return false; }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(2500)) return false;
  try {
    if (cache.get(CACHE_KEYS.USERS_WARM)) return true;
    const entries = {};
    sheetObjects_(SHEETS.USERS).filter(function (user) { return truthy_(user.Activo); }).forEach(function (user) {
      const serialized = JSON.stringify(user);
      if (serialized.length < 95000) {
        entries[userCedulaCacheKey_(user.Cedula)] = serialized;
      }
    });
    const keys = Object.keys(entries);
    for (let index = 0; index < keys.length; index += 90) {
      const batch = {};
      keys.slice(index, index + 90).forEach(function (key) { batch[key] = entries[key]; });
      cache.putAll(batch, CACHE_TTL.USER);
    }
    cache.put(CACHE_KEYS.USERS_WARM, "1", CACHE_TTL.USER);
    return true;
  } catch (error) { return false; }
  finally { lock.releaseLock(); }
}

function prepararEvento300Usuarios() {
  CacheService.getScriptCache().remove(CACHE_KEYS.USERS_WARM);
  const warmed = warmUserCaches_();
  const activity = warmActivitySnapshots_();
  activeMissions_(); activeBadges_(); catalogsApi_();
  return warmed && activity.ready
    ? "Preparación completa: " + activity.progress + " avances y " + activity.bonus + " resultados Bonus disponibles para el pico de ingresos."
    : "La preparación quedó incompleta (la caché puede estar llena o los datos superan su tamaño). Intenta nuevamente antes del evento.";
}

/**
 * Crea participantes temporales para una prueba de carga real sin usar cuentas
 * de colaboradores. Antes de ejecutarla, defina LOAD_TEST_PASSWORD en
 * Propiedades del script. Los usuarios se reparten entre las UAD activas.
 */
function crearUsuariosPruebaCarga(cantidad) {
  ensureStructure_();
  const total = Math.floor(Number(cantidad || 300));
  if (total < 1 || total > 500) throw new Error("La cantidad debe estar entre 1 y 500 usuarios de prueba.");
  const password = String(PropertiesService.getScriptProperties().getProperty("LOAD_TEST_PASSWORD") || "");
  if (password.length < 12 || password.length > 128) throw new Error("Configure LOAD_TEST_PASSWORD con una contraseña temporal de 12 a 128 caracteres.");
  const existingUsers = sheetObjects_(SHEETS.USERS);
  const existingTests = existingUsers.filter(function (user) { return String(user.Id || "").indexOf(LOAD_TEST_USER_PREFIX) === 0; });
  if (existingTests.length) throw new Error("Ya existen " + existingTests.length + " usuarios LOADTEST. Ejecute eliminarUsuariosPruebaCarga() antes de crear un lote nuevo.");
  const occupiedCedulas = {};
  existingUsers.forEach(function (user) { occupiedCedulas[cleanId_(user.Cedula)] = true; });
  for (let reservedIndex = 1; reservedIndex <= total; reservedIndex += 1) {
    if (occupiedCedulas[String(LOAD_TEST_CEDULA_BASE + reservedIndex)]) throw new Error("Una cédula reservada para la prueba ya está en uso. Elimine o corrija ese registro antes de continuar.");
  }

  const uads = catalogsApi_().uads;
  if (!uads.length) throw new Error("No hay UAD activas para distribuir los usuarios de prueba.");
  const headers = headersForSheet_(SHEETS.USERS);
  const createdAt = new Date();
  const rows = [];
  for (let index = 1; index <= total; index += 1) {
    const sequence = ("000" + index).slice(-3);
    const salt = Utilities.getUuid();
    const user = {
      Id: LOAD_TEST_USER_PREFIX + sequence,
      Nombre: "[PRUEBA CARGA] Usuario " + sequence,
      Cedula: String(LOAD_TEST_CEDULA_BASE + index),
      Telefono: "",
      Correo: "loadtest" + sequence + "@pasaporte.invalid",
      Cargo: "Prueba de carga",
      UAD: uads[(index - 1) % uads.length],
      Avatar: "avatar:v2:2:0:1:0:",
      Rol: "USER",
      PasswordSalt: salt,
      PasswordHash: hashPassword_(password, salt),
      Activo: true,
      CreadoEn: createdAt,
      SessionVersion: "1",
    };
    rows.push(headers.map(function (header) { return user[header] === undefined ? "" : user[header]; }));
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error("No fue posible reservar la hoja para crear el lote de prueba.");
  try {
    const latestUsers = sheetObjects_(SHEETS.USERS);
    if (latestUsers.some(function (user) { return String(user.Id || "").indexOf(LOAD_TEST_USER_PREFIX) === 0; })) {
      throw new Error("Otro proceso ya creó usuarios LOADTEST. No se agregó un lote duplicado.");
    }
    const latestCedulas = {};
    latestUsers.forEach(function (user) { latestCedulas[cleanId_(user.Cedula)] = true; });
    for (let latestIndex = 1; latestIndex <= total; latestIndex += 1) {
      if (latestCedulas[String(LOAD_TEST_CEDULA_BASE + latestIndex)]) throw new Error("Una cédula reservada para la prueba fue ocupada mientras se preparaba el lote.");
    }
    const sheet = getSheet_(SHEETS.USERS);
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
    SpreadsheetApp.flush();
  } finally { lock.releaseLock(); }
  invalidateLoadTestCaches_();
  return JSON.stringify({
    creados: total,
    primeraCedula: String(LOAD_TEST_CEDULA_BASE + 1),
    ultimaCedula: String(LOAD_TEST_CEDULA_BASE + total),
    uads: uads,
    siguientePaso: "Ejecute prepararEvento300Usuarios() y después el script load-tests/run.mjs.",
  });
}

/**
 * Elimina exclusivamente usuarios con Id LOADTEST- y sus datos dependientes.
 * Las evidencias creadas por esas cuentas también se envían a la papelera.
 */
function eliminarUsuariosPruebaCarga() {
  ensureStructure_();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error("No fue posible reservar la hoja para limpiar la prueba de carga.");
  try {
    const testUsers = sheetObjects_(SHEETS.USERS).filter(function (user) { return String(user.Id || "").indexOf(LOAD_TEST_USER_PREFIX) === 0; });
    if (!testUsers.length) {
      PropertiesService.getScriptProperties().deleteProperty("LOAD_TEST_PASSWORD");
      return JSON.stringify({ eliminados: 0, mensaje: "No había usuarios LOADTEST.", passwordTemporalEliminada: true });
    }
    const ids = {};
    testUsers.forEach(function (user) { ids[String(user.Id)] = true; });

    const evidence = sheetObjects_(SHEETS.EVIDENCE).filter(function (row) { return ids[String(row.UsuarioId)]; });
    evidence.forEach(function (row) {
      if (!row.ArchivoId) return;
      try { DriveApp.getFileById(String(row.ArchivoId)).setTrashed(true); } catch (error) { /* El archivo ya no existe o no pertenece a esta cuenta. */ }
    });

    const removed = {
      progreso: deleteRowsForLoadUsers_(SHEETS.PROGRESS, ids),
      bonus: deleteRowsForLoadUsers_(SHEETS.BONUS, ids),
      evidencias: deleteRowsForLoadUsers_(SHEETS.EVIDENCE, ids),
      recuperaciones: deleteRowsForLoadUsers_(SHEETS.RECOVERY, ids),
      sesiones: deleteRowsForLoadUsers_(SHEETS.SESSIONS, ids),
      usuarios: deleteRowsForLoadUsers_(SHEETS.USERS, ids, "Id"),
    };
    SpreadsheetApp.flush();
    invalidateLoadTestCaches_();
    PropertiesService.getScriptProperties().deleteProperty("LOAD_TEST_PASSWORD");
    return JSON.stringify({ eliminados: testUsers.length, registros: removed, passwordTemporalEliminada: true });
  } finally { lock.releaseLock(); }
}

function deleteRowsForLoadUsers_(sheetName, ids, field) {
  const key = field || "UsuarioId";
  const sheet = getSheet_(sheetName);
  const rows = sheetObjects_(sheetName).filter(function (row) { return ids[String(row[key])]; }).map(function (row) { return Number(row._row); }).sort(function (a, b) { return b - a; });
  let removed = 0;
  for (let index = 0; index < rows.length;) {
    const end = rows[index];
    let start = end;
    index += 1;
    while (index < rows.length && rows[index] === start - 1) { start = rows[index]; index += 1; }
    sheet.deleteRows(start, end - start + 1);
    removed += end - start + 1;
  }
  return removed;
}

function invalidateLoadTestCaches_() {
  const cache = CacheService.getScriptCache();
  const keys = [CACHE_KEYS.USERS_WARM, CACHE_KEYS.ADMIN_DASHBOARD, CACHE_KEYS.BONUS_LEADERBOARD, CACHE_KEYS.EVENT_WARM_UNTIL];
  for (let shard = 0; shard < ACTIVITY_SNAPSHOT_SHARDS; shard += 1) {
    keys.push(CACHE_KEYS.PROGRESS_SNAPSHOT + shard, CACHE_KEYS.BONUS_SNAPSHOT + shard);
  }
  cache.removeAll(keys);
}

function warmActivitySnapshots_() {
  const progress = Array.from({ length: ACTIVITY_SNAPSHOT_SHARDS }, function () { return {}; });
  const bonus = Array.from({ length: ACTIVITY_SNAPSHOT_SHARDS }, function () { return {}; });
  let progressCount = 0;
  let bonusCount = 0;
  sheetObjects_(SHEETS.PROGRESS).forEach(function (row) {
    const id = String(row.UsuarioId);
    const shard = progress[activityShard_(id)];
    if (!shard[id]) shard[id] = [];
    shard[id].push(row);
    progressCount += 1;
  });
  sheetObjects_(SHEETS.BONUS).forEach(function (row) {
    const id = String(row.UsuarioId);
    const shard = bonus[activityShard_(id)];
    if (!shard[id]) shard[id] = [];
    shard[id].push(row);
    bonusCount += 1;
  });
  progress.forEach(function (snapshot, shard) { cachePut_(CACHE_KEYS.PROGRESS_SNAPSHOT + shard, snapshot, 600); });
  bonus.forEach(function (snapshot, shard) { cachePut_(CACHE_KEYS.BONUS_SNAPSHOT + shard, snapshot, 600); });
  let ready = true;
  for (let shard = 0; shard < ACTIVITY_SNAPSHOT_SHARDS; shard += 1) {
    if (cacheGet_(CACHE_KEYS.PROGRESS_SNAPSHOT + shard) === null || cacheGet_(CACHE_KEYS.BONUS_SNAPSHOT + shard) === null) ready = false;
  }
  if (ready) CacheService.getScriptCache().put(CACHE_KEYS.EVENT_WARM_UNTIL, String(Date.now() + 10 * 60 * 1000), 600);
  return {
    ready: ready,
    progress: progressCount,
    bonus: bonusCount,
  };
}

function activityShard_(userId) {
  const value = String(userId || "");
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  return hash % ACTIVITY_SNAPSHOT_SHARDS;
}

function activitySnapshotKey_(sheetName, userId) {
  if (sheetName === SHEETS.PROGRESS) return CACHE_KEYS.PROGRESS_SNAPSHOT + activityShard_(userId);
  if (sheetName === SHEETS.BONUS) return CACHE_KEYS.BONUS_SNAPSHOT + activityShard_(userId);
  return "";
}

function invalidateUserCache_(user) {
  if (!user) return;
  CacheService.getScriptCache().removeAll([userCedulaCacheKey_(user.Cedula), userIdCacheKey_(user.Id), activeSessionCacheKey_(user.Id), progressCacheKey_(user.Id), bonusCacheKey_(user.Id), CACHE_KEYS.USERS_WARM]);
}

function hashPassword_(password, salt) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(salt) + String(password), Utilities.Charset.UTF_8);
  return bytes.map(function (byte) { const value = byte < 0 ? byte + 256 : byte; return ("0" + value.toString(16)).slice(-2); }).join("");
}

function enforceLoginRate_(cedula) {
  if (!cedula) return;
  const key = "pasaporte:login-attempt:" + cedula;
  const cache = CacheService.getScriptCache();
  const attempts = Number(cache.get(key)) || 0;
  if (attempts >= 8) throw new Error("Demasiados intentos. Espera cinco minutos antes de volver a ingresar.");
  cache.put(key, String(attempts + 1), 300);
}

function clearLoginRate_(cedula) {
  if (cedula) CacheService.getScriptCache().remove("pasaporte:login-attempt:" + cedula);
}

function enforceMissionCodeRate_(userId, missionId, valid) {
  const key = "pasaporte:seal-attempt:" + String(userId) + ":" + String(missionId);
  const cache = CacheService.getScriptCache();
  if (valid) { cache.remove(key); return; }
  const attempts = Number(cache.get(key)) || 0;
  if (attempts >= 7) throw new Error("Demasiados códigos incorrectos. Espera cinco minutos antes de volver a intentar.");
  cache.put(key, String(attempts + 1), 300);
}

let spreadsheetInstance_ = null;
const executionSheets_ = {};
const executionHeaders_ = {};

function getSpreadsheet_() {
  if (!spreadsheetInstance_) spreadsheetInstance_ = SpreadsheetApp.getActiveSpreadsheet();
  return spreadsheetInstance_;
}

function ensureStructure_() {
  Object.keys(HEADERS).forEach(function (name) { ensureSheet_(name, HEADERS[name]); });
}

function ensureSheet_(name, headers) {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  else {
    const existingHeaders = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getDisplayValues()[0].map(String);
    const missingHeaders = headers.filter(function (header) { return existingHeaders.indexOf(header) < 0; });
    if (missingHeaders.length) sheet.getRange(1, existingHeaders.length + 1, 1, missingHeaders.length).setValues([missingHeaders]);
  }
  sheet.setFrozenRows(1);
  executionSheets_[name] = sheet;
  delete executionHeaders_[name];
  return sheet;
}

function getSheet_(name) {
  if (executionSheets_[name]) return executionSheets_[name];
  const sheet = getSpreadsheet_().getSheetByName(name);
  if (!sheet) throw new Error("No existe la hoja " + name + ". Ejecute setupPasaporteSeguro().");
  executionSheets_[name] = sheet;
  return sheet;
}

function headersForSheet_(name) {
  if (executionHeaders_[name]) return executionHeaders_[name];
  const sheet = getSheet_(name);
  const lastColumn = sheet.getLastColumn();
  if (!lastColumn) throw new Error("La hoja " + name + " no tiene encabezados.");
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(String);
  executionHeaders_[name] = headers;
  return headers;
}

function headerColumn_(name, field) {
  const column = headersForSheet_(name).indexOf(field) + 1;
  if (column < 1) throw new Error("Falta la columna " + field + " en la hoja " + name + ".");
  return column;
}

function objectAtRow_(name, rowNumber) {
  const sheet = getSheet_(name);
  const headers = headersForSheet_(name);
  const values = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  const object = { _row: rowNumber };
  headers.forEach(function (header, column) { object[header] = values[column]; });
  return object;
}

function findObjectsByField_(name, field, value, normalizer) {
  const sheet = getSheet_(name);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const column = headerColumn_(name, field);
  const target = normalizer(value);
  const searchRange = sheet.getRange(2, column, lastRow - 1, 1);
  let matches = [];
  try {
    matches = searchRange.createTextFinder(String(value)).matchEntireCell(true).matchCase(false).findAll();
  } catch (error) {
    matches = [];
  }
  let rowNumbers = matches.map(function (range) { return range.getRow(); });
  if (!rowNumbers.length) {
    const values = searchRange.getDisplayValues();
    values.forEach(function (row, index) { if (normalizer(row[0]) === target) rowNumbers.push(index + 2); });
  }
  if (!rowNumbers.length) return [];
  const headers = headersForSheet_(name);
  const firstRow = Math.min.apply(null, rowNumbers);
  const lastMatchRow = Math.max.apply(null, rowNumbers);
  if (lastMatchRow - firstRow > 500 && rowNumbers.length < 18) {
    return rowNumbers.map(function (rowNumber) { return objectAtRow_(name, rowNumber); }).filter(function (object) { return normalizer(object[field]) === target; });
  }
  const selectedRows = {};
  rowNumbers.forEach(function (rowNumber) { selectedRows[rowNumber] = true; });
  const values = sheet.getRange(firstRow, 1, lastMatchRow - firstRow + 1, headers.length).getValues();
  return values.map(function (row, index) {
    const rowNumber = firstRow + index;
    if (!selectedRows[rowNumber]) return null;
    const object = { _row: rowNumber };
    headers.forEach(function (header, columnIndex) { object[header] = row[columnIndex]; });
    return object;
  }).filter(function (object) { return object && normalizer(object[field]) === target; });
}

function findObjectByField_(name, field, value, normalizer) {
  const rows = findObjectsByField_(name, field, value, normalizer);
  return rows.length ? rows[0] : null;
}

function sheetObjects_(name) {
  const sheet = getSheet_(name);
  if (sheet.getLastRow() < 2) return [];
  const headers = headersForSheet_(name);
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  return values.map(function (row, index) {
    const object = { _row: index + 2 };
    headers.forEach(function (header, column) { object[header] = row[column]; });
    return object;
  });
}

function appendObject_(sheetName, object) {
  const sheet = getSheet_(sheetName);
  const headers = headersForSheet_(sheetName);
  const rowNumber = sheet.getLastRow() + 1;
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([headers.map(function (header) { return object[header] === undefined ? "" : object[header]; })]);
  return rowNumber;
}

function updateObjectRow_(sheetName, rowNumber, changes) {
  const sheet = getSheet_(sheetName);
  const headers = headersForSheet_(sheetName);
  const range = sheet.getRange(rowNumber, 1, 1, headers.length);
  const values = range.getValues()[0];
  Object.keys(changes).forEach(function (key) {
    const column = headers.indexOf(key) + 1;
    if (column > 0) values[column - 1] = changes[key];
  });
  range.setValues([values]);
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
  seeds.forEach(function (m) { appendObject_(SHEETS.MISSIONS, { Id:m[0],Estacion:m[1],Icono:m[2],Color:m[3],Titulo:m[4],Descripcion:m[5],Puntos:m[6],Audiencia:m[7],Duracion:m[8],Activa:true,CreadaEn:new Date(),CodigoSello:generateUniqueMissionCode_(),EvidenciaObligatoria:false }); });
  invalidateMissionCaches_();
}

function seedMissionCodes_() {
  const missions = sheetObjects_(SHEETS.MISSIONS);
  missions.forEach(function (mission) {
    if (!normalizeMissionCode_(mission.CodigoSello)) updateObjectRow_(SHEETS.MISSIONS, mission._row, { CodigoSello: generateUniqueMissionCode_(), EvidenciaObligatoria: truthy_(mission.EvidenciaObligatoria) });
  });
  invalidateMissionCaches_();
}

function seedBadges_() {
  if (sheetObjects_(SHEETS.BADGES).length) return;
  const now = new Date();
  const seeds = [
    ["first-stamp", "Primer sello", "Completaste tu primera misión.", "star", "#c3010a", "#f337a2", "MISSIONS", 1, "", 10],
    ["route-keeper", "Guardián de la ruta", "Visitaste tres estaciones diferentes.", "shield", "#0c75c9", "#4ab2fb", "STATIONS", 3, "", 20],
    ["bonus-explorer", "Explorador bonus", "Superaste tu primer minijuego.", "rocket", "#f0a800", "#ffc845", "BONUS", 1, "", 30],
    ["bright-mind", "Mente brillante", "Completaste los seis retos bonus.", "sparkle", "#d92591", "#f337a2", "BONUS", 6, "", 40],
    ["point-collector", "Coleccionista", "Alcanzaste 500 puntos en tu recorrido.", "medal", "#249c64", "#43d17d", "POINTS", 500, "", 50],
    ["festival-ambassador", "Embajador del Festival", "Sellaste todas las misiones de tu pasaporte.", "trophy", "#12335a", "#4ab2fb", "ALL_MISSIONS", 1, "", 60],
  ];
  seeds.forEach(function (badge) {
    appendObject_(SHEETS.BADGES, { Id: badge[0], Titulo: badge[1], Descripcion: badge[2], Icono: badge[3], ColorPrimario: badge[4], ColorSecundario: badge[5], TipoCriterio: badge[6], Meta: badge[7], Estacion: badge[8], Activa: true, Orden: badge[9], CreadaEn: now, CreadaPor: "SISTEMA", EditadaEn: "" });
  });
  invalidateBadgeCaches_();
}

function migrateDefaultBadgeDesigns_() {
  const designs = {
    "first-stamp": ["#9d5cff", "#d7c7ff", "#c3010a", "#f337a2"],
    "route-keeper": ["#12cfe0", "#a5f4f7", "#0c75c9", "#4ab2fb"],
    "bonus-explorer": ["#ffb703", "#ffe39b", "#f0a800", "#ffc845"],
    "bright-mind": ["#ff5c9b", "#ffc2d9", "#d92591", "#f337a2"],
    "point-collector": ["#43d17d", "#baf3cf", "#249c64", "#43d17d"],
    "festival-ambassador": ["#7253dc", "#cfc2ff", "#12335a", "#4ab2fb"],
  };
  let changed = false;
  sheetObjects_(SHEETS.BADGES).forEach(function (badge) {
    const design = designs[String(badge.Id)];
    if (!design) return;
    const primary = String(badge.ColorPrimario || "").toLowerCase();
    const secondary = String(badge.ColorSecundario || "").toLowerCase();
    if (primary !== design[0] || secondary !== design[1]) return;
    updateObjectRow_(SHEETS.BADGES, badge._row, { ColorPrimario: design[2], ColorSecundario: design[3], EditadaEn: new Date() });
    changed = true;
  });
  if (changed) invalidateBadgeCaches_();
}

function migrateExpandedBonusBadge_() {
  const badge = sheetObjects_(SHEETS.BADGES).find(function (row) { return String(row.Id) === "bright-mind" && Number(row.Meta) === 3 && String(row.Descripcion) === "Completaste los tres retos bonus."; });
  if (!badge) return;
  updateObjectRow_(SHEETS.BADGES, badge._row, { Descripcion: "Completaste los seis retos bonus.", Meta: 6, EditadaEn: new Date() });
  invalidateBadgeCaches_();
}

function cacheGet_(key) {
  try {
    const value = CacheService.getScriptCache().get(key);
    if (!value) return null;
    return JSON.parse(value);
  } catch (error) { return null; }
}
function cachePut_(key, value, seconds) {
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length < 95000) CacheService.getScriptCache().put(key, serialized, seconds);
  } catch (error) {
    // La caché acelera la aplicación, pero nunca debe impedir una operación válida.
  }
}
function busyError_(message) {
  const error = new Error(message || "El sistema está procesando varias solicitudes. Reintentando…");
  error.retryable = true;
  return error;
}
function requestClaimLock_() {
  const documentLock = typeof LockService.getDocumentLock === "function" ? LockService.getDocumentLock() : null;
  return documentLock || LockService.getScriptLock();
}
function claimRequest_(key) {
  const lock = requestClaimLock_();
  if (!lock.tryLock(2000)) throw busyError_("Hay varias solicitudes guardándose. Reintentando…");
  try {
    const previous = cacheGet_(key);
    if (previous && previous.status === "done") return { repeated: true, data: previous.data };
    if (previous && previous.status === "pending") throw busyError_("Esta operación todavía se está guardando. Reintentando…");
    if (previous) return { repeated: true, data: previous };
    cachePut_(key, { status: "pending", startedAt: Date.now() }, 120);
    return { repeated: false };
  } finally { lock.releaseLock(); }
}
function completeRequest_(key, data) { cachePut_(key, { status: "done", data: data }, 600); }
function releaseRequestClaim_(key) {
  try {
    const current = cacheGet_(key);
    if (current && current.status === "pending") CacheService.getScriptCache().remove(key);
  } catch (error) { /* La expiración automática permite reintentar. */ }
}
function json_(payload) { return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON); }
function required_(value, message) { if (value === undefined || value === null || String(value).trim() === "") throw new Error(message); return String(value).trim(); }
function limitedText_(value, maxLength, message) { const text = required_(value, message); if (text.length > maxLength) throw new Error("Uno de los campos supera el tamaño permitido."); return text; }
function cleanId_(value) { return String(value || "").replace(/[^0-9A-Za-z-]/g, ""); }
function normalize_(value) { return String(value || "").trim().toLowerCase(); }
function truthy_(value) { return value === true || String(value).toUpperCase() === "TRUE" || String(value) === "1" || String(value).toUpperCase() === "SI"; }
function unique_(items) { return items.filter(function (value, index) { return value && items.indexOf(value) === index; }); }
function cleanRequestId_(value) { return String(value || "").replace(/[^0-9A-Za-z-]/g, "").slice(0, 80); }
