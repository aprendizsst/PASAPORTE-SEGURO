const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "src/index.js"), "utf8");

test("cada partida escribe un registro individual y no disputa un ranking global", () => {
  const bonus = source.slice(source.indexOf("async function completeBonusApi"), source.indexOf("async function bonusLeaderboardApi"));
  assert.match(bonus, /collection\("bonus"\)/);
  assert.doesNotMatch(bonus, /collection\("leaderboards"\)/);
  assert.match(source, /where\("gameId", "==", gameId\)\.orderBy\("record", "desc"\)\.limit\(10\)/);
});

test("los reintentos pueden recuperar una operación fallida sin esperar dos minutos", () => {
  const idempotency = source.slice(source.indexOf("async function dispatchIdempotent"), source.indexOf("exports.passportApi"));
  assert.match(idempotency, /stored\?\.status === "PROCESSING"/);
  assert.doesNotMatch(idempotency, /snapshot\.exists && snapshot\.data\(\)\.createdAt/);
});

test("las cuentas de carga no contaminan el respaldo ni los informes", () => {
  const loadUsers = fs.readFileSync(path.join(root, "scripts/load-test-users.mjs"), "utf8");
  const report = fs.readFileSync(path.join(root, "src/report.js"), "utf8");
  assert.match(loadUsers, /isLoadTest: true/);
  assert.match(loadUsers, /PASSPORT_LOAD_USERS_MODE/);
  assert.match(source, /if \(!user\.isLoadTest\) sheetQueue/);
  assert.match(report, /!user\.isLoadTest/);
});
