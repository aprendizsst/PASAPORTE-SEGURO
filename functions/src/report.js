const { db, GAME_NAMES, missionAssignedTo, toIso } = require("./core");

function docs(snapshot) { return snapshot.docs.map((item) => ({ id: item.id, ...item.data() })); }

async function loadReportCollections() {
  const [users, missions, progress, bonus, badges, evidence] = await Promise.all([
    db.collection("users").get(), db.collection("missions").get(), db.collection("progress").get(),
    db.collection("bonus").get(), db.collection("badges").get(), db.collection("evidence").get(),
  ]);
  return { users: docs(users), missions: docs(missions), progress: docs(progress), bonus: docs(bonus), badges: docs(badges), evidence: docs(evidence) };
}

function buildReportData(data) {
  const users = data.users.filter((user) => user.active && user.role !== "ADMIN" && !user.isLoadTest);
  const missions = data.missions;
  const activeMissions = missions.filter((mission) => mission.active);
  const usersById = new Map(data.users.map((user) => [String(user.id), user]));
  const realUserIds = new Set(users.map((user) => String(user.id)));
  const realBonus = data.bonus.filter((row) => realUserIds.has(String(row.userId)));
  const realEvidence = data.evidence.filter((row) => realUserIds.has(String(row.userId)));
  const missionsById = new Map(missions.map((mission) => [String(mission.id), mission]));
  const progressByKey = new Map(data.progress.map((row) => [`${row.userId}:${row.missionId}`, row]));
  const bonusByUser = new Map();
  realBonus.forEach((row) => bonusByUser.set(String(row.userId), [...(bonusByUser.get(String(row.userId)) || []), row]));
  const pointsByMission = new Map(missions.map((mission) => [String(mission.id), Number(mission.points) || 0]));

  const userRows = users.map((user) => {
    const available = activeMissions.filter((mission) => missionAssignedTo(mission.audience, user.uad));
    const completed = data.progress.filter((row) => row.userId === user.id && row.status === "COMPLETADA");
    const completedAvailable = completed.filter((row) => available.some((mission) => String(mission.id) === String(row.missionId)));
    const points = completed.reduce((sum, row) => sum + (pointsByMission.get(String(row.missionId)) || 0), 0) + (bonusByUser.get(user.id) || []).reduce((sum, row) => sum + (Number(row.score) || 0), 0);
    return { Nombre: user.name, Cedula: user.cedula, Telefono: user.phone || "", Correo: user.email || "", Cargo: user.cargo || "", UAD: user.uad || "", Estado: "ACTIVO", MisionesCompletadas: completedAvailable.length, MisionesDisponibles: available.length, AvancePorcentaje: available.length ? Math.round(completedAvailable.length / available.length * 100) : 0, Puntos: points, BonusCompletados: (bonusByUser.get(user.id) || []).length, CreadoEn: toIso(user.createdAt) };
  });

  const missionRows = activeMissions.map((mission) => {
    const assigned = users.filter((user) => missionAssignedTo(mission.audience, user.uad));
    const states = assigned.map((user) => progressByKey.get(`${user.id}:${mission.id}`));
    const completed = states.filter((row) => row && row.status === "COMPLETADA").length;
    const started = states.filter((row) => row && row.status === "INICIADA").length;
    return { Id: Number(mission.id), Estacion: mission.station, Mision: mission.title, Audiencia: mission.audience, Duracion: mission.duration || "", Puntos: Number(mission.points) || 0, EvidenciaObligatoria: Boolean(mission.evidenceRequired), Asignados: assigned.length, Iniciaron: started, Completaron: completed, Pendientes: Math.max(0, assigned.length - completed), CumplimientoPorcentaje: assigned.length ? Math.round(completed / assigned.length * 100) : 0, CreadaEn: toIso(mission.createdAt) };
  });

  const detailRows = [];
  users.forEach((user) => activeMissions.filter((mission) => missionAssignedTo(mission.audience, user.uad)).forEach((mission) => {
    const row = progressByKey.get(`${user.id}:${mission.id}`);
    detailRows.push({ Colaborador: user.name, Cedula: user.cedula, UAD: user.uad, Cargo: user.cargo || "", Estacion: mission.station, Mision: mission.title, Estado: row?.status || "PENDIENTE", IniciadaEn: toIso(row?.startedAt), CompletadaEn: toIso(row?.completedAt), PuntosMision: row?.status === "COMPLETADA" ? Number(mission.points) || 0 : 0 });
  }));

  const bonusRows = realBonus.map((row) => {
    const user = usersById.get(String(row.userId)) || {};
    return { Colaborador: user.name || "Usuario eliminado", Cedula: user.cedula || "", UAD: user.uad || "", Juego: GAME_NAMES[row.gameId] || row.gameId, Puntos: Number(row.score) || 0, Record: Number(row.record) || 0, Fecha: toIso(row.completedAt) };
  });

  const uadGroups = new Map();
  userRows.forEach((row) => {
    const key = row.UAD || "Sin UAD";
    const current = uadGroups.get(key) || { UAD: key, Participantes: 0, MisionesDisponibles: 0, MisionesCompletadas: 0, Puntos: 0 };
    current.Participantes += 1; current.MisionesDisponibles += row.MisionesDisponibles; current.MisionesCompletadas += row.MisionesCompletadas; current.Puntos += row.Puntos;
    uadGroups.set(key, current);
  });
  const uadRows = [...uadGroups.values()].sort((a, b) => a.UAD.localeCompare(b.UAD)).map((row) => ({ ...row, CumplimientoPorcentaje: row.MisionesDisponibles ? Math.round(row.MisionesCompletadas / row.MisionesDisponibles * 100) : 0 }));

  const activityRows = [];
  data.progress.forEach((row) => {
    const user = usersById.get(String(row.userId)); const mission = missionsById.get(String(row.missionId));
    if (user && mission) activityRows.push({ Fecha: toIso(row.completedAt || row.startedAt), Tipo: row.status === "COMPLETADA" ? "MISION_COMPLETADA" : "MISION_INICIADA", Colaborador: user.name, Cedula: user.cedula, UAD: user.uad, Detalle: mission.title });
  });
  realBonus.forEach((row) => {
    const user = usersById.get(String(row.userId));
    if (user) activityRows.push({ Fecha: toIso(row.completedAt), Tipo: "MINIJUEGO", Colaborador: user.name, Cedula: user.cedula, UAD: user.uad, Detalle: GAME_NAMES[row.gameId] || row.gameId });
  });
  activityRows.sort((a, b) => b.Fecha.localeCompare(a.Fecha));

  const totalAssigned = userRows.reduce((sum, row) => sum + row.MisionesDisponibles, 0);
  const totalCompleted = userRows.reduce((sum, row) => sum + row.MisionesCompletadas, 0);
  const totalPoints = userRows.reduce((sum, row) => sum + row.Puntos, 0);
  return {
    generatedAt: new Date().toISOString(),
    summary: [
      { Indicador: "Colaboradores activos", Valor: users.length }, { Indicador: "Misiones activas", Valor: activeMissions.length },
      { Indicador: "Asignaciones totales", Valor: totalAssigned }, { Indicador: "Misiones completadas", Valor: totalCompleted },
      { Indicador: "Cumplimiento general (%)", Valor: totalAssigned ? Math.round(totalCompleted / totalAssigned * 100) : 0 },
      { Indicador: "Puntos entregados", Valor: totalPoints }, { Indicador: "Partidas con resultado", Valor: realBonus.length },
      { Indicador: "Evidencias recibidas", Valor: realEvidence.length }, { Indicador: "Insignias activas", Valor: data.badges.filter((badge) => badge.active).length },
    ],
    users: userRows, missions: missionRows, progress: detailRows,
    badges: data.badges.filter((badge) => badge.active).map((badge) => ({ Insignia: badge.title, Descripcion: badge.description, Icono: badge.icon, ColorPrimario: badge.primaryColor, ColorSecundario: badge.secondaryColor, Criterio: badge.criterion, Meta: Number(badge.goal) || 1, Estacion: badge.station || "", Orden: Number(badge.order) || 100 })),
    bonus: bonusRows,
    evidence: realEvidence.map((row) => { const user = usersById.get(String(row.userId)) || {}; const mission = missionsById.get(String(row.missionId)) || {}; return { Colaborador: user.name || "Usuario eliminado", Cedula: user.cedula || "", UAD: user.uad || "", Mision: mission.title || "Misión eliminada", Archivo: row.fileName || "", Tipo: row.mime || "", TamanoBytes: Number(row.size) || 0, Estado: row.status || "RECIBIDA", Fecha: toIso(row.createdAt), URL: row.url || "" }; }),
    uads: uadRows, activity: activityRows,
  };
}

async function buildReport() { return buildReportData(await loadReportCollections()); }

module.exports = { buildReportData, buildReport, loadReportCollections };
