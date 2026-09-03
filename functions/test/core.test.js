const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { missionAssignedTo, createPassword, verifyPassword, verifyPasswordAsync } = require("../src/core");
const { buildReportData } = require("../src/report");
const { columnName } = require("../src/sheets-sync");

test("asignación de misiones conserva el alcance por UAD", () => {
  assert.equal(missionAssignedTo("Todas las UAD", "UAD Duitama"), true);
  assert.equal(missionAssignedTo(" uad chiquinquirá ", "UAD CHIQUINQUIRA"), true);
  assert.equal(missionAssignedTo("UAD Duitama", "UAD Chiquinquirá"), false);
});

test("contraseñas nuevas y heredadas se validan sin guardar texto visible", () => {
  const current = createPassword("UnaClave-Segura-2026");
  assert.equal(verifyPassword("UnaClave-Segura-2026", current), true);
  assert.equal(verifyPassword("incorrecta", current), false);
  const salt = "legacy-salt";
  const legacy = { passwordSalt: salt, passwordHash: crypto.createHash("sha256").update(`${salt}UnaClave-Segura-2026`).digest("hex"), passwordAlgorithm: "legacy-sha256" };
  assert.equal(verifyPassword("UnaClave-Segura-2026", legacy), true);
});

test("la validación asíncrona evita bloquear sesiones simultáneas", async () => {
  const current = createPassword("UnaClave-Segura-2026");
  assert.equal(await verifyPasswordAsync("UnaClave-Segura-2026", current), true);
  assert.equal(await verifyPasswordAsync("incorrecta", current), false);
});

test("informe calcula asignaciones, cumplimiento, puntos y UAD", () => {
  const data = {
    users: [{ id: "u1", name: "Ana", cedula: "1", uad: "UAD Duitama", active: true, role: "USER" }],
    missions: [{ id: 1, title: "Misión", station: "Estación Salud", audience: "Todas las UAD", points: 100, active: true }],
    progress: [{ id: "u1_1", userId: "u1", missionId: 1, status: "COMPLETADA" }],
    bonus: [{ id: "u1_target", userId: "u1", gameId: "target", score: 50, record: 90 }],
    badges: [{ id: "b1", title: "Salud", active: true }], evidence: [],
  };
  const report = buildReportData(data);
  assert.equal(report.summary.find((row) => row.Indicador === "Cumplimiento general (%)").Valor, 100);
  assert.equal(report.users[0].Puntos, 150);
  assert.equal(report.uads[0].MisionesCompletadas, 1);
  assert.equal(report.progress[0].Estado, "COMPLETADA");
});

test("columnas de Sheets superan la Z sin rangos inválidos", () => {
  assert.equal(columnName(1), "A");
  assert.equal(columnName(26), "Z");
  assert.equal(columnName(27), "AA");
  assert.equal(columnName(52), "AZ");
});
