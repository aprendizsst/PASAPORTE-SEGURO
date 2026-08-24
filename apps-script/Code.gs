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
  Usuarios: ["Id", "Nombre", "Cedula", "Telefono", "Correo", "Cargo", "UAD", "Avatar", "Rol", "PasswordSalt", "PasswordHash", "Activo", "CreadoEn"],
  Misiones: ["Id", "Estacion", "Icono", "Color", "Titulo", "Descripcion", "Puntos", "Audiencia", "Duracion", "Activa", "CreadaEn", "CreadaPor", "CodigoSello", "EvidenciaObligatoria", "EditadaEn"],
  Progreso: ["Id", "UsuarioId", "MisionId", "Estado", "IniciadaEn", "CompletadaEn"],
  Sesiones: ["Token", "UsuarioId", "ExpiraEn", "CreadaEn"],
  Catalogos: ["Tipo", "Valor", "Activo"],
  Bonus: ["Id", "UsuarioId", "JuegoId", "Puntaje", "CompletadoEn"],
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
  BADGES: "pasaporte:badges:v1",
  SCHEMA: "pasaporte:schema:v6",
};

const CACHE_TTL = {
  CATALOGS: 21600,
  MISSIONS: 900,
  USER: 3600,
  SESSION: 3600,
  ACTIVITY: 600,
};

const WRITE_ACTIONS = ["register", "startMission", "completeMission", "updateAvatar", "completeBonus", "requestPasswordReset", "verifyPasswordResetCode", "resetPassword", "adminCreateMission", "adminEditMission", "adminDeleteMission", "adminCreateBadge", "adminEditBadge", "adminDeleteBadge", "adminEditUser", "adminDeleteUser", "adminCreateRecoveryCode"];

function doGet() {
  return json_({ ok: true, data: { service: "Pasaporte Seguro API", status: "ready", version: "3.2.12" } });
}

function doPost(event) {
  try {
    const request = JSON.parse((event && event.postData && event.postData.contents) || "{}");
    const action = String(request.action || "");
    ensureRuntimeReady_();
    const requestId = cleanRequestId_(request.requestId);
    const idempotencyKey = requestId && WRITE_ACTIONS.indexOf(action) >= 0 ? "pasaporte:request:" + action + ":" + requestId : "";
    if (idempotencyKey) {
      const previous = cacheGet_(idempotencyKey);
      if (previous) return json_({ ok: true, data: previous, repeated: true });
    }
    let data;

    if (action === "catalogs") data = catalogsApi_();
    else if (action === "register") data = registerApi_(request);
    else if (action === "login") data = loginApi_(request);
    else if (action === "session") data = sessionApi_(request);
    else if (action === "startMission") data = startMissionApi_(request);
    else if (action === "completeMission") data = completeMissionApi_(request);
    else if (action === "updateAvatar") data = updateAvatarApi_(request);
    else if (action === "completeBonus") data = completeBonusApi_(request);
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
    else if (action === "adminDashboard") data = adminDashboardApi_(request);
    else throw new Error("Acción no reconocida.");

    if (idempotencyKey) cachePut_(idempotencyKey, data, 600);
    return json_({ ok: true, data: data });
  } catch (error) {
    return json_({ ok: false, message: error.message || "Error inesperado." });
  }
}

function setupPasaporteSeguro() {
  ensureStructure_();
  seedCatalogs_();
  seedMissions_();
  seedMissionCodes_();
  seedBadges_();
  migrateDefaultBadgeDesigns_();
  invalidateMissionCaches_();
  CacheService.getScriptCache().remove(CACHE_KEYS.BADGES);
  CacheService.getScriptCache().put(CACHE_KEYS.SCHEMA, "ready", 21600);
  PropertiesService.getScriptProperties().setProperty("PASAPORTE_SCHEMA_VERSION", "6");
  return "Estructura actualizada sin borrar datos. Misiones, insignias, evidencias y recuperación de contraseñas están listas.";
}

function ensureRuntimeReady_() {
  const cache = CacheService.getScriptCache();
  if (cache.get(CACHE_KEYS.SCHEMA)) return;
  if (PropertiesService.getScriptProperties().getProperty("PASAPORTE_SCHEMA_VERSION") === "6") {
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
      PropertiesService.getScriptProperties().setProperty("PASAPORTE_SCHEMA_VERSION", "6");
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
  updateObjectRow_(SHEETS.USERS, user._row, { PasswordSalt: salt, PasswordHash: hashPassword_(password, salt) });
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
  if (!lock.tryLock(5000)) throw new Error("Hay varios registros en curso. Espera un momento e intenta nuevamente.");
  try {
    if (findObjectByField_(SHEETS.USERS, "Cedula", cedula, cleanId_)) throw new Error("Ya existe un pasaporte registrado con esa cédula.");
    if (findObjectByField_(SHEETS.USERS, "Correo", email, normalize_)) throw new Error("Ya existe un pasaporte registrado con ese correo.");
    const salt = Utilities.getUuid();
    const newUser = {
      Id: Utilities.getUuid(), Nombre: name, Cedula: cedula,
      Telefono: phone, Correo: email,
      Cargo: cargo, UAD: uad, Avatar: input.avatar || "avatar:v1:2:0:1:0:0",
      Rol: "USER", PasswordSalt: salt, PasswordHash: hashPassword_(password, salt),
      Activo: true, CreadoEn: new Date(),
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

  const reusable = cacheGet_(activeSessionCacheKey_(user.Id));
  let token;
  let expiresAt;
  if (reusable && reusable.token && new Date(reusable.expiresAt).getTime() > Date.now()) {
    token = String(reusable.token);
    expiresAt = new Date(reusable.expiresAt);
  } else {
    token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, "");
    expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
    appendObject_(SHEETS.SESSIONS, { Token: token, UsuarioId: user.Id, ExpiraEn: expiresAt, CreadoEn: new Date() });
    cachePut_(activeSessionCacheKey_(user.Id), { token: token, expiresAt: expiresAt.toISOString() }, CACHE_TTL.SESSION);
  }
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
  updateObjectRow_(SHEETS.USERS, user._row, { PasswordSalt: salt, PasswordHash: hashPassword_(password, salt) });
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
  const allowedGames = ["word-search", "sudoku", "target"];
  if (allowedGames.indexOf(gameId) < 0) throw new Error("Minijuego no permitido.");
  const score = Math.max(0, Math.min(1000, Number(request.score) || 0));
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(4000)) throw new Error("Estamos guardando otros resultados. Intenta nuevamente en un momento.");
  try {
    CacheService.getScriptCache().remove(bonusCacheKey_(user.Id));
    const current = findObjectsByField_(SHEETS.BONUS, "UsuarioId", user.Id, String).find(function (row) { return String(row.JuegoId) === gameId; });
    if (current) updateObjectRow_(SHEETS.BONUS, current._row, { Puntaje: Math.max(Number(current.Puntaje) || 0, score), CompletadoEn: new Date() });
    else appendObject_(SHEETS.BONUS, { Id: Utilities.getUuid(), UsuarioId: user.Id, JuegoId: gameId, Puntaje: score, CompletadoEn: new Date() });
  } finally { lock.releaseLock(); }
  invalidateUserActivity_(user.Id);
  return { gameId: gameId, score: score, completed: true };
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
  return { id: id, sealCode: sealCode };
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
    updateObjectRow_(SHEETS.USERS, user._row, { Nombre: name, Cedula: cedula, Telefono: phone, Correo: email, Cargo: cargo, UAD: uad });
    revokeUserSessions_(user.Id);
    invalidateUserCache_(user);
    const updated = objectAtRow_(SHEETS.USERS, user._row);
    cacheUser_(updated);
  } finally { lock.releaseLock(); }
  invalidateAdminDashboard_();
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
    PasswordHash: Utilities.getUuid().replace(/-/g, ""), Activo: false,
  });
  revokeUserSessions_(user.Id);
  invalidateUserCache_(user);
  invalidateAdminDashboard_();
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

function adminDashboardApi_(request) {
  requireAdmin_(request.token);
  return { people: buildAdminPeople_(), missions: activeMissions_().map(adminMission_), evidence: buildAdminEvidence_(), badges: activeBadges_() };
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
  bonusRows.forEach(function (row) { bonusScores[String(row.JuegoId)] = Number(row.Puntaje) || 0; });
  return { user: publicUser_(user), missions: missions.map(publicMission_), historyMissions: historyMissions, completed: completed, started: started, history: history, bonusCompleted: Object.keys(bonusScores), bonusScores: bonusScores, badgeDefinitions: activeBadges_() };
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
    const available = missions.filter(function (m) { return m.Audiencia === "Todas las UAD" || String(m.Audiencia) === String(user.UAD); });
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
  const audience = limitedText_(mission.audience || "Todas las UAD", 120, "La audiencia es obligatoria.");
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
  appendObject_(SHEETS.EVIDENCE, { Id: Utilities.getUuid(), UsuarioId: user.Id, MisionId: mission.Id, ArchivoId: file.getId(), NombreArchivo: name, TipoMime: mime, TamanoBytes: bytes.length, Url: file.getUrl(), Estado: "RECIBIDA", CreadoEn: new Date() });
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

function allowedMissions_(user) {
  return activeMissions_().filter(function (mission) {
    return mission.Audiencia === "Todas las UAD" || String(mission.Audiencia) === String(user.UAD);
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
  const current = progressForUser_(userId).find(function (row) { return String(row.MisionId) === String(missionId); });
  const now = new Date();
  if (current) {
    const changes = { Estado: status };
    if (!current.IniciadaEn) changes.IniciadaEn = now;
    if (status === "COMPLETADA") changes.CompletadaEn = now;
    updateObjectRow_(SHEETS.PROGRESS, current._row, changes);
  } else appendObject_(SHEETS.PROGRESS, { Id: Utilities.getUuid(), UsuarioId: userId, MisionId: missionId, Estado: status, IniciadaEn: now, CompletadaEn: status === "COMPLETADA" ? now : "" });
  invalidateUserActivity_(userId);
}

function requireSession_(token) {
  const cached = cacheGet_(sessionCacheKey_(token));
  if (cached && new Date(cached.expiresAt).getTime() > Date.now() && cached.user && truthy_(cached.user.Activo)) return cached.user;
  const session = findObjectByField_(SHEETS.SESSIONS, "Token", token, String);
  if (!session || new Date(session.ExpiraEn).getTime() <= Date.now()) throw new Error("Tu sesión venció. Inicia sesión nuevamente.");
  const user = findUserById_(session.UsuarioId);
  if (!user || !truthy_(user.Activo)) throw new Error("Usuario inactivo.");
  cachePut_(sessionCacheKey_(token), { user: user, expiresAt: new Date(session.ExpiraEn).toISOString() }, CACHE_TTL.SESSION);
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
  const rows = findObjectsByField_(sheetName, "UsuarioId", userId, String);
  cachePut_(key, rows, CACHE_TTL.ACTIVITY);
  return rows;
}

function invalidateUserActivity_(userId) {
  CacheService.getScriptCache().removeAll([progressCacheKey_(userId), bonusCacheKey_(userId), CACHE_KEYS.ADMIN_DASHBOARD]);
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

function invalidateUserCache_(user) {
  if (!user) return;
  CacheService.getScriptCache().removeAll([userCedulaCacheKey_(user.Cedula), userIdCacheKey_(user.Id), activeSessionCacheKey_(user.Id), progressCacheKey_(user.Id), bonusCacheKey_(user.Id)]);
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
  return rowNumbers.map(function (rowNumber) { return objectAtRow_(name, rowNumber); }).filter(function (object) { return normalizer(object[field]) === target; });
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
    ["bright-mind", "Mente brillante", "Completaste los tres retos bonus.", "sparkle", "#d92591", "#f337a2", "BONUS", 3, "", 40],
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
function json_(payload) { return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON); }
function required_(value, message) { if (value === undefined || value === null || String(value).trim() === "") throw new Error(message); return String(value).trim(); }
function limitedText_(value, maxLength, message) { const text = required_(value, message); if (text.length > maxLength) throw new Error("Uno de los campos supera el tamaño permitido."); return text; }
function cleanId_(value) { return String(value || "").replace(/[^0-9A-Za-z-]/g, ""); }
function normalize_(value) { return String(value || "").trim().toLowerCase(); }
function truthy_(value) { return value === true || String(value).toUpperCase() === "TRUE" || String(value) === "1" || String(value).toUpperCase() === "SI"; }
function unique_(items) { return items.filter(function (value, index) { return value && items.indexOf(value) === index; }); }
function cleanRequestId_(value) { return String(value || "").replace(/[^0-9A-Za-z-]/g, "").slice(0, 80); }
