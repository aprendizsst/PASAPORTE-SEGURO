import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";

const apiUrl = String(process.env.PASAPORTE_API_URL || "").trim();
const password = String(process.env.PASAPORTE_LOAD_PASSWORD || "");
const stages = String(process.env.PASAPORTE_LOAD_STAGES || "5,25,50,100,200,300")
  .split(",").map((value) => Number(value.trim())).filter((value) => Number.isInteger(value) && value > 0 && value <= 500);
const pauseMs = Math.max(0, Number(process.env.PASAPORTE_LOAD_PAUSE_MS || 5000));
const writeEnabled = /^(1|true|yes|si|sí)$/i.test(String(process.env.PASAPORTE_LOAD_WRITE || "false"));
const missionId = String(process.env.PASAPORTE_LOAD_MISSION_ID || "").trim();
const missionCode = String(process.env.PASAPORTE_LOAD_MISSION_CODE || "").trim();
const outputPath = resolve(process.env.PASAPORTE_LOAD_OUTPUT || `load-tests/results/load-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);

if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/i.test(apiUrl)) throw new Error("PASAPORTE_API_URL debe ser la URL pública /exec de Apps Script.");
if (password.length < 12) throw new Error("PASAPORTE_LOAD_PASSWORD debe coincidir con LOAD_TEST_PASSWORD y tener mínimo 12 caracteres.");
if (!stages.length) throw new Error("PASAPORTE_LOAD_STAGES no contiene etapas válidas.");
if (writeEnabled && missionCode && !missionId) throw new Error("Defina PASAPORTE_LOAD_MISSION_ID cuando use PASAPORTE_LOAD_MISSION_CODE.");

const report = {
  startedAt: new Date().toISOString(),
  target: new URL(apiUrl).host,
  stages,
  writeEnabled,
  missionCompletionEnabled: Boolean(writeEnabled && missionId && missionCode),
  results: [],
};

function sleep(ms) { return new Promise((resolvePromise) => setTimeout(resolvePromise, ms)); }
function percentile(values, ratio) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))];
}
function summarize(samples) {
  const times = samples.map((sample) => sample.elapsedMs);
  const ok = samples.filter((sample) => sample.ok).length;
  return {
    requests: samples.length,
    ok,
    failed: samples.length - ok,
    successRate: samples.length ? Number(((ok / samples.length) * 100).toFixed(2)) : 0,
    retries: samples.reduce((sum, sample) => sum + Math.max(0, sample.attempts - 1), 0),
    p50Ms: percentile(times, 0.5),
    p95Ms: percentile(times, 0.95),
    p99Ms: percentile(times, 0.99),
    maxMs: times.length ? Math.max(...times) : 0,
  };
}

async function callApi(action, payload, attempts = 4) {
  const started = Date.now();
  const requestId = randomUUID();
  let lastMessage = "Sin respuesta";
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), action === "login" ? 25000 : 20000);
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action, requestId, ...payload }),
        signal: controller.signal,
        cache: "no-store",
      });
      const text = await response.text();
      let result;
      try { result = JSON.parse(text); }
      catch { throw new Error(`Respuesta no JSON (${response.status})`); }
      if (response.ok && result.ok) return { ok: true, data: result.data, elapsedMs: Date.now() - started, attempts: attempt };
      lastMessage = result.message || `HTTP ${response.status}`;
      if (!result.retryable && response.status !== 429 && response.status < 500) break;
    } catch (error) {
      lastMessage = error instanceof Error ? error.message : String(error);
    } finally { clearTimeout(timeout); }
    if (attempt < attempts) await sleep(Math.min(5000, 350 * (2 ** (attempt - 1))) + Math.floor(Math.random() * 450));
  }
  return { ok: false, message: lastMessage, elapsedMs: Date.now() - started, attempts };
}

function credentials(index) {
  return { cedula: String(990000000000 + index), password };
}

async function journey(index) {
  const samples = [];
  const login = await callApi("login", credentials(index), 5);
  samples.push({ action: "login", ...login, data: undefined });
  if (!login.ok) return samples;
  const token = String(login.data.token || "");
  const session = await callApi("session", { token });
  samples.push({ action: "session", ...session, data: undefined });
  const missions = await callApi("getMissions", { token });
  samples.push({ action: "getMissions", ...missions, data: undefined });
  if (!writeEnabled || !missions.ok) return samples;
  const assigned = Array.isArray(missions.data?.missions) ? missions.data.missions : [];

  const selected = missionId
    ? assigned.find((mission) => String(mission.id) === missionId)
    : assigned.find((mission) => !mission.evidenceRequired);
  if (!selected) {
    samples.push({ action: "missionAssignment", ok: false, message: missionId ? "La misión indicada no está asignada a este usuario." : "No hay una misión sin evidencia asignada.", elapsedMs: 0, attempts: 1 });
    return samples;
  }

  const start = await callApi("startMission", { token, missionId: selected.id });
  samples.push({ action: "startMission", ...start, data: undefined });
  if (start.ok && missionId && missionCode) {
    const complete = await callApi("completeMission", { token, missionId: selected.id, sealCode: missionCode });
    samples.push({ action: "completeMission", ...complete, data: undefined });
  }
  const bonus = await callApi("completeBonus", { token, gameId: "station-pairs", score: 1, record: 1 });
  samples.push({ action: "completeBonus", ...bonus, data: undefined });
  return samples;
}

for (const users of stages) {
  const stageStarted = Date.now();
  const journeys = await Promise.all(Array.from({ length: users }, (_, index) => journey(index + 1)));
  const samples = journeys.flat();
  const actions = {};
  for (const action of [...new Set(samples.map((sample) => sample.action))]) actions[action] = summarize(samples.filter((sample) => sample.action === action));
  const failures = samples.filter((sample) => !sample.ok).slice(0, 20).map(({ action, message }) => ({ action, message }));
  const stage = { users, elapsedMs: Date.now() - stageStarted, actions, failures };
  report.results.push(stage);
  console.log(JSON.stringify(stage));
  if (users !== stages.at(-1)) await sleep(pauseMs);
}

report.finishedAt = new Date().toISOString();
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(report, null, 2));
console.log(`Reporte guardado en ${outputPath}`);

const critical = report.results.flatMap((stage) => Object.entries(stage.actions)).filter(([action]) => ["login", "session", "getMissions"].includes(action));
if (critical.some(([, metrics]) => metrics.successRate < 99)) process.exitCode = 2;
