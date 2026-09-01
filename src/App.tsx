"use client";

import { FormEvent, lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { BonusGameId, BonusLeaderboardEntry } from "./MiniGames";
import { BadgeCollection, BadgeIcon, buildBadges, FestivalRoute, FinalPassportCard } from "./FestivalExperience";
import type { BadgeDefinition } from "./FestivalExperience";
import { AdminPagination, useAdminPage } from "./AdminPagination";
import { audienceKey, missionAssignedTo } from "./adminData";
import { useMissionSync } from "./useMissionSync";

const loadMiniGames = () => import("./MiniGames");
const MiniGamesPage = lazy(loadMiniGames);

type View = "dashboard" | "guide" | "missions" | "bonus" | "badges" | "history" | "complete" | "admin";
type Role = "USER" | "ADMIN";
type User = { name: string; cedula: string; phone: string; email: string; cargo: string; uad: string; avatar: string; role: Role };
type Mission = { id: number; station: string; icon: string; color: string; title: string; description: string; points: number; audience: string; duration: string; sealCode?: string; evidenceRequired?: boolean };
type AvatarConfig = { skin: number; hair: number; style: number; shirt: number; accessories: number[]; accessoryColors: Record<number, number> };
type PersonProgress = { id: string; name: string; cedula: string; phone?: string; email: string; cargo?: string; uad: string; completed: number; total: number; points: number; createdAt?: string };
type EvidencePayload = { name: string; mime: string; data: string; size: number };
type AdminEvidence = { id: string; userName: string; missionTitle: string; fileName: string; mime: string; size: number; url: string; status: string; createdAt: string };
type AdminBonusRecord = { id: string; userId: string; userName: string; uad: string; gameId: BonusGameId; gameName: string; score: number; record: number; completedAt: string };
type SessionBundle = { user: User; missions: Mission[]; historyMissions?: Mission[]; completed: number[]; started?: number[]; history?: Record<number, string>; adminPeople?: PersonProgress[]; adminEvidence?: AdminEvidence[]; adminBonusRecords?: AdminBonusRecord[]; badgeDefinitions?: BadgeDefinition[]; bonusCompleted?: string[]; bonusScores?: Record<string, number>; bonusRecords?: Record<string, number>; token: string };
type StoredSession = { savedAt: number; bundle: SessionBundle };

const stations = [
  { name: "Estación Diversidad", icon: "◉", color: "#9d5cff" },
  { name: "Estación Felicidad", icon: "♡", color: "#ffb703" },
  { name: "Estación Seguridad", icon: "◇", color: "#12cfe0" },
  { name: "Estación Salud", icon: "+", color: "#43d17d" },
  { name: "Estación Amor Propio", icon: "✦", color: "#ff5c9b" },
  { name: "Estación Ambiental", icon: "♧", color: "#8bd33f" },
];

const missionsSeed: Mission[] = [
  { id: 1, station: "Estación Diversidad", icon: "◉", color: "#9d5cff", title: "Todos contamos", description: "Participa en el reto de inclusión y reconoce una fortaleza única de otro compañero.", points: 120, audience: "Todas las UAD", duration: "8 min", sealCode: "DIVER6" },
  { id: 2, station: "Estación Felicidad", icon: "♡", color: "#ffb703", title: "La pausa que suma", description: "Completa la dinámica de gratitud y deja un mensaje positivo en la estación.", points: 100, audience: "Todas las UAD", duration: "6 min", sealCode: "FELIZ6" },
  { id: 3, station: "Estación Seguridad", icon: "◇", color: "#12cfe0", title: "Cazadores de riesgos", description: "Identifica tres condiciones seguras dentro del recorrido y valida tu respuesta con el guía.", points: 150, audience: "Sede Central", duration: "10 min", sealCode: "SEGUR6", evidenceRequired: true },
  { id: 4, station: "Estación Salud", icon: "+", color: "#43d17d", title: "Pulso saludable", description: "Acepta el reto de hábitos saludables y registra el compromiso que aplicarás esta semana.", points: 100, audience: "Todas las UAD", duration: "7 min", sealCode: "SALUD6" },
  { id: 5, station: "Estación Amor Propio", icon: "✦", color: "#ff5c9b", title: "Mi mejor versión", description: "Elige una práctica de autocuidado y completa la actividad guiada de bienestar emocional.", points: 130, audience: "Todas las UAD", duration: "9 min", sealCode: "AMOR26" },
  { id: 6, station: "Estación Ambiental", icon: "♧", color: "#8bd33f", title: "Huella consciente", description: "Clasifica correctamente los residuos del desafío y descubre tu eco-acción diaria.", points: 110, audience: "Sede Central", duration: "8 min", sealCode: "VERDE6" },
];

const skinTones = ["#f8d5c2", "#efbd9f", "#d89572", "#a96848", "#70402f", "#3f251f"];
const hairColors = ["#241914", "#5b3426", "#b66d2e", "#e0b34f", "#7c355d", "#284d78", "#d8d4ce"];
const hairStyles = [
  { id: "short", label: "Corto" },
  { id: "medium", label: "Medio" },
  { id: "long", label: "Largo" },
  { id: "curly", label: "Rizado" },
  { id: "bun", label: "Recogido" },
  { id: "waves", label: "Ondulado" },
  { id: "braids", label: "Trenzas" },
];
const shirtColors = ["#7d4de8", "#08aabb", "#ef4d86", "#f39b17", "#3da868", "#264d87", "#df4949", "#ffffff"];
const accessories = [
  { id: "none", label: "Sin accesorio", icon: "×" },
  { id: "glasses", label: "Gafas", icon: "▢" },
  { id: "round-glasses", label: "Gafas redondas", icon: "∞" },
  { id: "headband", label: "Diadema", icon: "⌒" },
  { id: "bow", label: "Moño", icon: "⋈" },
  { id: "earrings", label: "Aretes", icon: "••" },
  { id: "flower", label: "Flor", icon: "✿" },
  { id: "cap", label: "Gorra", icon: "⌁" },
];
const accessoryColors = ["#172440", "#9d5cff", "#12cfe0", "#ff5c9b", "#ffb703", "#43d17d", "#ffffff", "#e95454"];
const badgeIconOptions = [
  { id: "star", label: "Estrella" }, { id: "shield", label: "Escudo" },
  { id: "trophy", label: "Trofeo" }, { id: "leaf", label: "Ambiental" },
  { id: "heart", label: "Corazón" }, { id: "rocket", label: "Nave" },
  { id: "sparkle", label: "Destello" }, { id: "medal", label: "Medalla" },
  { id: "planet", label: "Planeta" }, { id: "hand", label: "Compromiso" },
  { id: "flame", label: "Impulso" }, { id: "target", label: "Objetivo" },
  { id: "bolt", label: "Energía" }, { id: "crown", label: "Excelencia" },
  { id: "compass", label: "Exploración" }, { id: "hands", label: "Equipo" },
];
const badgePalette = ["#c3010a", "#f337a2", "#4ab2fb", "#ffc845", "#12335a", "#12cfe0", "#43d17d", "#8bd33f", "#7253dc", "#ef5b5b"];
const defaultAvatar = "avatar:v2:2:0:1:0:";
const cargos = ["Auxiliar administrativo", "Profesional asistencial", "Líder de proceso", "Coordinador(a)", "Analista", "Otro"];
const uads = ["Sede Central", "UAD Duitama", "UAD Chiquinquirá", "UAD Miraflores", "UAD Guateque"];
const demoUser: User = { name: "Valentina Segura", cedula: "1010101010", phone: "300 555 0198", email: "valentina@empresa.com", cargo: "Profesional asistencial", uad: "Sede Central", avatar: defaultAvatar, role: "USER" };
const demoPeople = [
  { id: "demo-1", name: "Valentina Segura", cedula: "1010101010", email: "valentina@empresa.com", uad: "Sede Central", completed: 4, total: 6, points: 470 },
  { id: "demo-2", name: "Samuel Torres", cedula: "1020202020", email: "samuel@empresa.com", uad: "UAD Duitama", completed: 6, total: 6, points: 710 },
  { id: "demo-3", name: "Laura Moreno", cedula: "1030303030", email: "laura@empresa.com", uad: "UAD Chiquinquirá", completed: 3, total: 5, points: 350 },
  { id: "demo-4", name: "Mateo Rojas", cedula: "1040404040", email: "mateo@empresa.com", uad: "UAD Miraflores", completed: 2, total: 4, points: 220 },
  { id: "demo-5", name: "Luna Castro", cedula: "1050505050", email: "luna@empresa.com", uad: "Sede Central", completed: 5, total: 6, points: 590 },
];
const demoBonusLeaderboard: BonusLeaderboardEntry[] = [
  { gameId: "forest-run", name: "Samuel Torres", uad: "UAD Duitama", record: 684, completedAt: "2026-08-24T14:20:00.000Z" },
  { gameId: "forest-run", name: "Luna Castro", uad: "Sede Central", record: 521, completedAt: "2026-08-24T15:05:00.000Z" },
  { gameId: "station-pairs", name: "Laura Moreno", uad: "UAD Chiquinquirá", record: 238, completedAt: "2026-08-24T15:18:00.000Z" },
  { gameId: "wellbeing-flight", name: "Mateo Rojas", uad: "UAD Miraflores", record: 14, completedAt: "2026-08-24T16:02:00.000Z" },
];

declare global {
  interface Window { PASSPORT_CONFIG?: { apiUrl?: string; features?: Record<string, boolean> } }
}

function normalizeAppsScriptUrl(value: string) {
  const cleaned = String(value || "").trim().replace(/^['\"]|['\"]$/g, "");
  if (!cleaned) return "";
  try {
    const url = new URL(cleaned);
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/$/, "");
  } catch { return cleaned; }
}

function getApiUrl() {
  if (typeof window === "undefined") return "";
  // La conexión es una configuración administrativa de despliegue. Nunca se
  // acepta una URL guardada o modificada desde la interfaz del participante.
  return normalizeAppsScriptUrl(window.PASSPORT_CONFIG?.apiUrl || "");
}

function featureEnabled(name: string) {
  return window.PASSPORT_CONFIG?.features?.[name] !== false;
}

function passportAccessHref() {
  const url = new URL(window.location.href);
  url.searchParams.set("passport", "1");
  url.hash = "passport-access";
  return `${url.pathname}${url.search}${url.hash}`;
}

function passportAccessRequested() {
  const url = new URL(window.location.href);
  return url.searchParams.get("passport") === "1" || url.hash === "#passport-access";
}

const SESSION_BUNDLE_KEY = "pasaporte_session_bundle_v4";
const inflightReads = new Map<string, Promise<unknown>>();
const apiReadCache = new Map<string, { expiresAt: number; value: unknown }>();
const WRITE_API_ACTIONS = new Set(["register", "startMission", "completeMission", "updateAvatar", "completeBonus", "requestPasswordReset", "verifyPasswordResetCode", "resetPassword", "adminCreateMission", "adminEditMission", "adminDeleteMission", "adminCreateBadge", "adminEditBadge", "adminDeleteBadge", "adminEditUser", "adminDeleteUser", "adminCreateRecoveryCode", "adminManageBonusRecord"]);

function apiPolicy(action: string, payload?: Record<string, unknown>) {
  if (action === "login") return { attempts: 5, timeoutMs: 25000 };
  if (action === "session") return { attempts: 4, timeoutMs: 20000 };
  if (action === "register") return { attempts: 3, timeoutMs: 30000 };
  if (action === "requestPasswordReset" || action === "verifyPasswordResetCode") return { attempts: 2, timeoutMs: 20000 };
  if (action === "completeMission" && payload?.evidence) return { attempts: 2, timeoutMs: 45000 };
  if (WRITE_API_ACTIONS.has(action)) return { attempts: 4, timeoutMs: 20000 };
  return { attempts: 2, timeoutMs: 10000 };
}

function apiUrlOrThrow() {
  const url = getApiUrl();
  if (!url) throw new Error("El Pasaporte Seguro no tiene configurada la conexión con Apps Script.");
  if (/TU[_ -]?IMPLEMENTACION|TU[_ -]?ID/i.test(url) || !/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/i.test(url)) throw new Error("La conexión debe usar la URL pública completa de Apps Script terminada en /exec.");
  return url;
}

async function callApi(action: string, payload: Record<string, unknown> = {}) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) throw new Error("No tienes conexión. Revisa internet e intenta nuevamente.");
  const url = apiUrlOrThrow();
  const requestId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const policy = apiPolicy(action, payload);
  const leaderboardCacheKey = `bonus-leaderboard:${String(payload.token || "")}`;
  if (action === "getBonusLeaderboard" && payload.force) apiReadCache.delete(leaderboardCacheKey);
  const inflightKey = action === "catalogs" ? `catalogs:${url}` : action === "session" || action === "getMissions" ? `${action}:${url}:${String(payload.token || "")}` : action === "getBonusLeaderboard" && !payload.force ? leaderboardCacheKey : "";
  const cacheTtl = action === "catalogs" ? 6 * 60 * 60 * 1000 : action === "getBonusLeaderboard" && !payload.force ? 45 * 1000 : 0;
  const cached = inflightKey && cacheTtl ? apiReadCache.get(inflightKey) : undefined;
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (cached) apiReadCache.delete(inflightKey);

  const request = async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt < policy.attempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), policy.timeoutMs);
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action, requestId, ...payload }),
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) {
          const error = new Error(response.status === 429 ? "Hay muchas personas conectadas. Reintentando…" : "El servicio no respondió correctamente.") as Error & { retryable?: boolean };
          error.retryable = response.status === 429 || response.status >= 500;
          throw error;
        }
        const responseText = await response.text();
        let result: { ok?: boolean; message?: string; data?: unknown };
        try { result = JSON.parse(responseText); }
        catch {
          const error = new Error("Apps Script no devolvió una respuesta válida. Verifica que la implementación sea pública y termine en /exec.") as Error & { retryable?: boolean };
          // Google puede responder con una página temporal de cuota antes de que
          // Code.gs alcance a generar JSON. Solo esos mensajes se reintentan.
          error.retryable = /too many|exceeded|quota|temporar|service unavailable|try again|intenta de nuevo/i.test(responseText);
          throw error;
        }
        if (!result.ok) {
          const error = new Error(result.message || "No fue posible completar la solicitud.") as Error & { retryable?: boolean };
          error.retryable = Boolean((result as { retryable?: boolean }).retryable);
          throw error;
        }
        if (inflightKey && cacheTtl) apiReadCache.set(inflightKey, { expiresAt: Date.now() + cacheTtl, value: result.data });
        return result.data;
      } catch (error) {
        lastError = error;
        const aborted = error instanceof DOMException && error.name === "AbortError";
        const retryable = aborted || (error as Error & { retryable?: boolean })?.retryable || error instanceof TypeError;
        if (!retryable || attempt === policy.attempts - 1) break;
        const retryWindow = Math.min(8000, 900 * (2 ** attempt));
        await new Promise((resolve) => window.setTimeout(resolve, retryWindow * (0.5 + Math.random())));
      } finally {
        window.clearTimeout(timeout);
      }
    }
    if (lastError instanceof DOMException && lastError.name === "AbortError") throw new Error("La conexión tardó más de lo esperado. Intenta nuevamente.");
    if (lastError instanceof TypeError) throw new Error("No fue posible conectar con Apps Script. Revisa la URL /exec y que el acceso sea para cualquier persona.");
    throw lastError instanceof Error ? lastError : new Error("No fue posible conectar con el pasaporte.");
  };

  if (!inflightKey) return request();
  const existing = inflightReads.get(inflightKey);
  if (existing) return existing;
  const pending = request().finally(() => inflightReads.delete(inflightKey));
  inflightReads.set(inflightKey, pending);
  return pending;
}

function readStoredSession(token: string): SessionBundle | null {
  try {
    const stored = JSON.parse(localStorage.getItem(SESSION_BUNDLE_KEY) || "null") as StoredSession | null;
    if (!stored || stored.bundle.token !== token || Date.now() - stored.savedAt > 12 * 60 * 60 * 1000) return null;
    return stored.bundle;
  } catch { return null; }
}

function isExpiredSessionError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("sesión venció") || message.includes("sesion vencio") || message.includes("usuario inactivo");
}

function decodeAvatar(value: string): AvatarConfig {
  const fallback: AvatarConfig = { skin: 2, hair: 0, style: 1, shirt: 0, accessories: [], accessoryColors: {} };
  if (value?.startsWith("avatar:v2:")) {
    const [skin, hair, style, shirt, encoded = ""] = value.replace("avatar:v2:", "").split(":");
    const selected = encoded.split(",").filter(Boolean).slice(0, 3).map((item) => item.split("-").map(Number)).filter(([id, color]) => id > 0 && id < accessories.length && color >= 0 && color < accessoryColors.length);
    return {
      skin: Math.min(Math.max(Number(skin) || 0, 0), skinTones.length - 1), hair: Math.min(Math.max(Number(hair) || 0, 0), hairColors.length - 1),
      style: Math.min(Math.max(Number(style) || 0, 0), hairStyles.length - 1), shirt: Math.min(Math.max(Number(shirt) || 0, 0), shirtColors.length - 1),
      accessories: selected.map(([id]) => id), accessoryColors: Object.fromEntries(selected.map(([id, color]) => [id, color])),
    };
  }
  if (!value?.startsWith("avatar:v1:")) return fallback;
  const values = value.replace("avatar:v1:", "").split(":").map(Number);
  const legacyAccessory = Math.min(Math.max(values[4] || 0, 0), accessories.length - 1);
  return {
    skin: Math.min(Math.max(values[0] || 0, 0), skinTones.length - 1),
    hair: Math.min(Math.max(values[1] || 0, 0), hairColors.length - 1),
    style: Math.min(Math.max(values[2] || 0, 0), hairStyles.length - 1),
    shirt: Math.min(Math.max(values[3] || 0, 0), shirtColors.length - 1),
    accessories: legacyAccessory ? [legacyAccessory] : [], accessoryColors: legacyAccessory ? { [legacyAccessory]: 0 } : {},
  };
}

function encodeAvatar(config: AvatarConfig) {
  const encoded = config.accessories.slice(0, 3).map((id) => `${id}-${config.accessoryColors[id] || 0}`).join(",");
  return `avatar:v2:${config.skin}:${config.hair}:${config.style}:${config.shirt}:${encoded}`;
}

function toggleAccessory(config: AvatarConfig, id: number) {
  if (!id) return { ...config, accessories: [], accessoryColors: {} };
  const groups = [[1, 2], [3, 4, 6, 7], [5]];
  const group = groups.find((items) => items.includes(id)) || [id];
  if (config.accessories.includes(id)) return { ...config, accessories: config.accessories.filter((item) => item !== id) };
  const next = [...config.accessories.filter((item) => !group.includes(item)), id].slice(-3);
  return { ...config, accessories: next, accessoryColors: { ...config.accessoryColors, [id]: config.accessoryColors[id] || 0 } };
}

async function prepareEvidence(file: File): Promise<EvidencePayload> {
  const allowed = file.type.startsWith("image/") || file.type.startsWith("video/");
  if (!allowed) throw new Error("La evidencia debe ser una foto o un video.");
  if (file.size > 7 * 1024 * 1024) throw new Error("La evidencia supera 7 MB.");
  let output: Blob = file;
  let name = file.name;
  if (file.type.startsWith("image/") && file.type !== "image/gif") {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
    output = await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("No fue posible optimizar la foto.")), "image/jpeg", .78));
    name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  }
  if (output.size > 7 * 1024 * 1024) throw new Error("La evidencia optimizada supera 7 MB.");
  const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || "")); reader.onerror = () => reject(new Error("No fue posible leer la evidencia.")); reader.readAsDataURL(output); });
  return { name, mime: output.type || file.type, data: dataUrl.split(",")[1] || "", size: output.size };
}

function tiltCover(event: React.PointerEvent<HTMLDivElement>) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const bounds = event.currentTarget.getBoundingClientRect();
  const x = (event.clientX - bounds.left) / bounds.width - .5;
  const y = (event.clientY - bounds.top) / bounds.height - .5;
  event.currentTarget.style.setProperty("--cover-rx", `${(-y * 7).toFixed(2)}deg`);
  event.currentTarget.style.setProperty("--cover-ry", `${(x * 9).toFixed(2)}deg`);
  event.currentTarget.style.setProperty("--shine-x", `${((x + .5) * 100).toFixed(0)}%`);
  event.currentTarget.style.setProperty("--shine-y", `${((y + .5) * 100).toFixed(0)}%`);
}

function resetCoverTilt(event: React.PointerEvent<HTMLDivElement>) {
  event.currentTarget.style.setProperty("--cover-rx", "0deg");
  event.currentTarget.style.setProperty("--cover-ry", "0deg");
  event.currentTarget.style.setProperty("--shine-x", "50%");
  event.currentTarget.style.setProperty("--shine-y", "35%");
}

export default function Home() {
  const [opened, setOpened] = useState(passportAccessRequested);
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register" | "recover">("login");
  const [recoveryStage, setRecoveryStage] = useState<"request" | "verify" | "reset">("request");
  const [recoveryCedula, setRecoveryCedula] = useState("");
  const [recoveryTicket, setRecoveryTicket] = useState("");
  const [view, setView] = useState<View>("dashboard");
  const [completed, setCompleted] = useState<number[]>([1, 2]);
  const [started, setStarted] = useState<number[]>([3]);
  const [stampMission, setStampMission] = useState<Mission | null>(null);
  const [validationMission, setValidationMission] = useState<Mission | null>(null);
  const [sealCode, setSealCode] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [avatarPurpose, setAvatarPurpose] = useState<"register" | "profile">("profile");
  const [avatarDraft, setAvatarDraft] = useState<AvatarConfig>(decodeAvatar(defaultAvatar));
  const [creationCelebration, setCreationCelebration] = useState(false);
  const [missionFilter, setMissionFilter] = useState("Todas");
  const [toast, setToast] = useState("");
  const [missions, setMissions] = useState<Mission[]>(missionsSeed);
  const [historyMissions, setHistoryMissions] = useState<Mission[]>(missionsSeed);
  const [catalogs, setCatalogs] = useState({ cargos, uads });
  const [sessionToken, setSessionToken] = useState("");
  const [historyDates, setHistoryDates] = useState<Record<number, string>>({});
  const [adminPeople, setAdminPeople] = useState(demoPeople);
  const [adminEvidence, setAdminEvidence] = useState<AdminEvidence[]>([]);
  const [adminBonusRecords, setAdminBonusRecords] = useState<AdminBonusRecord[]>([]);
  const [badgeDefinitions, setBadgeDefinitions] = useState<BadgeDefinition[]>([]);
  const [pageDirection, setPageDirection] = useState<"next" | "prev">("next");
  const [pageKey, setPageKey] = useState(0);
  const [sessionOpening, setSessionOpening] = useState(false);
  const [sessionClosing, setSessionClosing] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [bonusCompleted, setBonusCompleted] = useState<string[]>([]);
  const [bonusScores, setBonusScores] = useState<Record<string, number>>({});
  const [bonusRecords, setBonusRecords] = useState<Record<string, number>>({});
  const [bonusLeaderboard, setBonusLeaderboard] = useState<BonusLeaderboardEntry[]>([]);
  const [bonusLeaderboardLoading, setBonusLeaderboardLoading] = useState(false);
  const [adminDashboardLoaded, setAdminDashboardLoaded] = useState(false);
  const catalogsRequested = useRef(false);
  const bonusLeaderboardLoaded = useRef(false);
  const visibleMissions = useMemo(() => user ? missions.filter((m) => missionAssignedTo(m.audience, user.uad)) : [], [missions, user]);
  const missionSync = useMissionSync({
    token: sessionToken,
    active: Boolean(opened && user && getApiUrl() && ["dashboard", "missions", "guide", "badges", "complete"].includes(view)),
    view,
    load: async (token) => await callApi("getMissions", { token }) as { missions: Mission[]; uad: string },
    onSync: (data) => {
      if (!Array.isArray(data.missions)) throw new Error("Actualiza la implementación de Apps Script para sincronizar las misiones.");
      setMissions((current) => JSON.stringify(current) === JSON.stringify(data.missions) ? current : data.missions);
      setUser((current) => current && current.uad !== data.uad ? { ...current, uad: data.uad } : current);
    },
  });
  const filteredMissions = missionFilter === "Todas" ? visibleMissions : visibleMissions.filter((m) => m.station === missionFilter);
  const completedVisible = visibleMissions.filter((m) => completed.includes(m.id));
  const completedHistory = historyMissions.filter((m) => completed.includes(m.id));
  const progress = visibleMissions.length ? Math.round((completedVisible.length / visibleMissions.length) * 100) : 0;
  const points = completedVisible.reduce((sum, m) => sum + m.points, 0) + Object.values(bonusScores).reduce((sum, value) => sum + value, 0);
  const badges = useMemo(() => buildBadges({ missions: visibleMissions, completed, points, bonusCompleted, definitions: badgeDefinitions }), [badgeDefinitions, bonusCompleted, completed, points, visibleMissions]);
  const unlockedBadges = badges.filter((badge) => badge.unlocked).length;
  const viewOrder: View[] = ["dashboard", "guide", "missions", "bonus", "badges", "history", "complete", "admin"];

  useEffect(() => {
    if (!getApiUrl()) return;
    const cachedCatalogs = localStorage.getItem("pasaporte_catalogs");
    if (cachedCatalogs) {
      try { setCatalogs(JSON.parse(cachedCatalogs)); } catch { localStorage.removeItem("pasaporte_catalogs"); }
    }

    const savedToken = localStorage.getItem("pasaporte_session");
    if (savedToken) {
      const storedBundle = readStoredSession(savedToken);
      if (storedBundle) applyBundle(storedBundle, false);
      else setBusyAction("restoring");
      callApi("session", { token: savedToken })
        .then((data) => applyBundle(data as SessionBundle))
        .catch((error) => {
          if (isExpiredSessionError(error)) {
            localStorage.removeItem("pasaporte_session");
            localStorage.removeItem(SESSION_BUNDLE_KEY);
            setUser(null);
          }
        })
        .finally(() => setBusyAction(""));
    }
  }, []);

  useEffect(() => {
    if (!opened || (user ? user.role !== "ADMIN" : authMode !== "register") || !getApiUrl() || catalogsRequested.current) return;
    catalogsRequested.current = true;
    callApi("catalogs").then((data) => {
      const nextCatalogs = data as { cargos: string[]; uads: string[] };
      setCatalogs(nextCatalogs);
      localStorage.setItem("pasaporte_catalogs", JSON.stringify(nextCatalogs));
    }).catch(() => {
      catalogsRequested.current = false;
      if (!localStorage.getItem("pasaporte_catalogs")) notify("No fue posible cargar los catálogos. Se muestran opciones de ejemplo.");
    });
  }, [authMode, opened, user]);

  useEffect(() => {
    if (!user || !sessionToken) return;
    const bundle: SessionBundle = {
      user,
      missions,
      historyMissions,
      completed,
      started,
      history: historyDates,
      bonusCompleted,
      bonusScores,
      bonusRecords,
      badgeDefinitions,
      token: sessionToken,
      ...(adminDashboardLoaded ? { adminPeople } : {}),
      ...(adminDashboardLoaded ? { adminEvidence } : {}),
      ...(adminDashboardLoaded ? { adminBonusRecords } : {}),
    };
    const saveTimer = window.setTimeout(() => {
      localStorage.setItem(SESSION_BUNDLE_KEY, JSON.stringify({ savedAt: Date.now(), bundle } satisfies StoredSession));
    }, 180);
    return () => window.clearTimeout(saveTimer);
  }, [adminBonusRecords, adminDashboardLoaded, adminEvidence, adminPeople, badgeDefinitions, bonusCompleted, bonusRecords, bonusScores, completed, historyDates, historyMissions, missions, sessionToken, started, user]);

  useEffect(() => {
    if (!opened || !user) return;
    const preloadTimer = window.setTimeout(() => { void loadMiniGames(); }, 650);
    return () => window.clearTimeout(preloadTimer);
  }, [opened, user]);

  useEffect(() => {
    if (view !== "bonus" || !user || !sessionToken) return;
    void loadBonusLeaderboard();
  }, [sessionToken, user, view]);

  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(""), 2800); }
  function applyBundle(data: SessionBundle, persist = true) {
    setUser(data.user);
    setMissions(data.missions);
    setHistoryMissions(data.historyMissions?.length ? data.historyMissions : data.missions);
    setCompleted(data.completed || []);
    setStarted(data.started || []);
    setHistoryDates(data.history || {});
    setAdminPeople(data.adminPeople || []);
    setAdminEvidence(data.adminEvidence || []);
    setAdminBonusRecords(data.adminBonusRecords || []);
    setBadgeDefinitions(data.badgeDefinitions || []);
    setBonusCompleted(data.bonusCompleted || []);
    setBonusScores(data.bonusScores || {});
    setBonusRecords(data.bonusRecords || data.bonusScores || {});
    setSessionToken(data.token);
    setAdminDashboardLoaded(Array.isArray(data.adminPeople));
    localStorage.setItem("pasaporte_session", data.token);
    if (persist) localStorage.setItem(SESSION_BUNDLE_KEY, JSON.stringify({ savedAt: Date.now(), bundle: data } satisfies StoredSession));
  }
  function turnTo(next: View) {
    if (next === view) return;
    setPageDirection(viewOrder.indexOf(next) >= viewOrder.indexOf(view) ? "next" : "prev");
    setView(next);
    setPageKey((current) => current + 1);
    if (next === "admin" && user?.role === "ADMIN") window.setTimeout(() => void refreshAdminDashboard(), 0);
  }
  function exploreStation(station?: string) {
    setMissionFilter(station || "Todas");
    turnTo("missions");
  }
  function revealPassport(next: View) {
    setView(next);
    setSessionOpening(true);
    window.setTimeout(() => setSessionOpening(false), 1050);
  }
  function openPassport() {
    try { window.history.replaceState(window.history.state, "", passportAccessHref()); }
    catch { /* Algunos contenedores embebidos restringen la URL; el estado local sigue funcionando. */ }
    setOpened(true);
    if (!user) { setAuthMode("login"); setRecoveryStage("request"); }
  }
  function openAvatarStudio(purpose: "register" | "profile" = "profile") {
    if (purpose === "profile" && !user) return;
    setAvatarPurpose(purpose);
    if (purpose === "profile" && user) setAvatarDraft(decodeAvatar(user.avatar));
    setAvatarOpen(true);
  }
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const cedula = String(form.get("cedula") || "");
    const password = String(form.get("password") || "");
    setBusyAction("login");
    try {
      if (getApiUrl()) {
        const data = await callApi("login", { cedula, password });
        applyBundle(data as SessionBundle);
      } else if (cedula === "1000000000" && password === "Demo1234*") setUser({ ...demoUser, name: "Administrador Festival", cedula, email: "admin@empresa.com", role: "ADMIN", avatar: "avatar:v1:3:1:0:5:1" });
      else if (cedula && password) setUser({ ...demoUser, cedula });
      revealPassport("dashboard");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No fue posible iniciar sesión.";
      notify(message);
    }
    finally { setBusyAction(""); }
  }
  async function requestPasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const cedula = String(form.get("cedula") || "");
    const email = String(form.get("email") || "");
    setBusyAction("request-reset");
    try {
      if (!getApiUrl()) throw new Error("La recuperación requiere la conexión con Apps Script.");
      const data = await callApi("requestPasswordReset", { cedula, email }) as { message?: string };
      setRecoveryCedula(cedula);
      setRecoveryTicket("");
      setRecoveryStage("verify");
      notify(data.message || "Revisa tu correo e ingresa el código recibido.");
    } catch (error) { notify(error instanceof Error ? error.message : "No fue posible solicitar el código."); }
    finally { setBusyAction(""); }
  }
  async function verifyPasswordResetCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const cedula = String(form.get("cedula") || recoveryCedula);
    const code = String(form.get("code") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length < 6) { notify("Ingresa el código completo enviado a tu correo."); return; }
    setBusyAction("verify-reset-code");
    try {
      if (!getApiUrl()) throw new Error("La recuperación requiere la conexión con Apps Script.");
      const data = await callApi("verifyPasswordResetCode", { cedula, code }) as { ticket?: string };
      if (!data.ticket) throw new Error("No fue posible confirmar el código.");
      setRecoveryCedula(cedula); setRecoveryTicket(data.ticket); setRecoveryStage("reset");
      notify("Código verificado. Ahora crea tu contraseña nueva.");
    } catch (error) { notify(error instanceof Error ? error.message : "No fue posible validar el código."); }
    finally { setBusyAction(""); }
  }
  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const cedula = String(form.get("cedula") || recoveryCedula);
    const password = String(form.get("password") || "");
    const confirmation = String(form.get("confirmation") || "");
    if (!recoveryTicket) { setRecoveryStage("verify"); notify("Primero debes validar el código de recuperación."); return; }
    if (password !== confirmation) { notify("Las contraseñas no coinciden."); return; }
    setBusyAction("reset-password");
    try {
      if (!getApiUrl()) throw new Error("La recuperación requiere la conexión con Apps Script.");
      await callApi("resetPassword", { cedula, ticket: recoveryTicket, password });
      setAuthMode("login"); setRecoveryStage("request"); setRecoveryCedula(""); setRecoveryTicket("");
      notify("Contraseña restablecida. Ya puedes iniciar sesión.");
    } catch (error) { notify(error instanceof Error ? error.message : "No fue posible restablecer la contraseña."); }
    finally { setBusyAction(""); }
  }
  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const newUser = { name: String(form.get("name") || "Nuevo participante"), cedula: String(form.get("cedula") || ""), phone: String(form.get("phone") || ""), email: String(form.get("email") || ""), cargo: String(form.get("cargo") || catalogs.cargos[0]), uad: String(form.get("uad") || catalogs.uads[0]), avatar: encodeAvatar(avatarDraft), role: "USER" as Role };
    setBusyAction("register");
    try {
      if (getApiUrl()) {
        const data = await callApi("register", { user: newUser, password: String(form.get("password") || "") });
        applyBundle(data as SessionBundle);
      } else setUser(newUser);
      setCompleted([]); setStarted([]); setView("guide"); setCreationCelebration(true);
      window.setTimeout(() => { setCreationCelebration(false); revealPassport("guide"); }, 2700);
    } catch (error) { notify(error instanceof Error ? error.message : "No fue posible crear el pasaporte."); }
    finally { setBusyAction(""); }
  }
  async function startMission(id: number) {
    if (busyAction) return;
    const previous = started;
    setStarted((current) => current.includes(id) ? current : [...current, id]);
    setBusyAction(`start-${id}`);
    try {
      if (getApiUrl()) await callApi("startMission", { token: sessionToken, missionId: id });
      notify("Misión iniciada. ¡Busca la estación!");
    } catch (error) {
      setStarted(previous);
      notify(error instanceof Error ? error.message : "No fue posible iniciar la misión.");
    } finally { setBusyAction(""); }
  }
  function requestMissionSeal(mission: Mission) {
    setSealCode(""); setEvidenceFile(null); setValidationMission(mission);
  }
  async function finishMission(mission: Mission) {
    if (busyAction) return;
    const previousCompleted = completed;
    const previousHistoryMissions = historyMissions;
    const previousHistoryDates = historyDates;
    const previousStarted = started;
    const optimisticDate = new Date().toISOString();
    setCompleted((current) => current.includes(mission.id) ? current : [...current, mission.id]);
    setHistoryMissions((current) => current.some((item) => item.id === mission.id) ? current : [...current, mission]);
    setHistoryDates((current) => ({ ...current, [mission.id]: optimisticDate }));
    setStarted((current) => current.filter((id) => id !== mission.id));
    setBusyAction(`finish-${mission.id}`);
    try {
      const evidence = evidenceFile ? await prepareEvidence(evidenceFile) : undefined;
      if (getApiUrl()) {
        const data = await callApi("completeMission", { token: sessionToken, missionId: mission.id, sealCode: sealCode.trim().toUpperCase(), evidence }) as { completedAt?: string };
        if (data.completedAt) setHistoryDates((current) => ({ ...current, [mission.id]: data.completedAt as string }));
      } else if ((mission.sealCode || "RUTA26") !== sealCode.trim().toUpperCase()) {
        throw new Error(`Código incorrecto. En demostración usa ${mission.sealCode || "RUTA26"}.`);
      }
      setValidationMission(null); setSealCode(""); setEvidenceFile(null);
      setStampMission(mission);
    } catch (error) {
      setCompleted(previousCompleted);
      setHistoryMissions(previousHistoryMissions);
      setHistoryDates(previousHistoryDates);
      setStarted(previousStarted);
      notify(error instanceof Error ? error.message : "No fue posible completar la misión.");
    }
    finally { setBusyAction(""); }
  }
  async function createAdminMission(mission: Mission) {
    setBusyAction("create-mission");
    try {
      let created = mission;
      if (getApiUrl()) {
        const data = await callApi("adminCreateMission", { token: sessionToken, mission }) as { id: number; sealCode?: string; audience?: string };
        created = { ...mission, id: data.id, sealCode: data.sealCode, audience: data.audience || mission.audience };
      } else {
        created = { ...mission, sealCode: Math.random().toString(36).slice(2, 8).toUpperCase() };
      }
      setMissions((current) => [...current, created]);
      notify("Misión creada y publicada correctamente.");
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : "No fue posible publicar la misión.");
      return false;
    } finally { setBusyAction(""); }
  }
  async function editAdminMission(mission: Mission, regenerateCode: boolean) {
    setBusyAction(`edit-${mission.id}`);
    try {
      let updated = mission;
      if (getApiUrl()) {
        const data = await callApi("adminEditMission", { token: sessionToken, mission, regenerateCode }) as { mission: Mission };
        updated = data.mission;
      } else if (regenerateCode) updated = { ...mission, sealCode: Math.random().toString(36).slice(2, 8).toUpperCase() };
      setMissions((current) => current.map((item) => item.id === updated.id ? updated : item));
      setHistoryMissions((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item));
      notify("Misión actualizada correctamente.");
      return true;
    } catch (error) { notify(error instanceof Error ? error.message : "No fue posible editar la misión."); return false; }
    finally { setBusyAction(""); }
  }
  async function deleteAdminMission(mission: Mission) {
    const previous = missions;
    setMissions((current) => current.filter((item) => item.id !== mission.id));
    setBusyAction(`delete-${mission.id}`);
    try {
      if (getApiUrl()) await callApi("adminDeleteMission", { token: sessionToken, missionId: mission.id });
      notify("Misión eliminada. El historial anterior se conservó.");
      return true;
    } catch (error) {
      setMissions(previous);
      notify(error instanceof Error ? error.message : "No fue posible eliminar la misión.");
      return false;
    } finally { setBusyAction(""); }
  }
  async function createAdminBadge(badge: BadgeDefinition) {
    setBusyAction("create-badge");
    try {
      let created = badge;
      if (getApiUrl()) {
        const data = await callApi("adminCreateBadge", { token: sessionToken, badge }) as { badge: BadgeDefinition };
        created = data.badge;
      }
      setBadgeDefinitions((current) => [...current, created].sort((a, b) => (a.order || 100) - (b.order || 100)));
      notify("Insignia creada y publicada."); return true;
    } catch (error) { notify(error instanceof Error ? error.message : "No fue posible crear la insignia."); return false; }
    finally { setBusyAction(""); }
  }
  async function editAdminBadge(badge: BadgeDefinition) {
    setBusyAction(`edit-badge-${badge.id}`);
    try {
      let updated = badge;
      if (getApiUrl()) {
        const data = await callApi("adminEditBadge", { token: sessionToken, badge }) as { badge: BadgeDefinition };
        updated = data.badge;
      }
      setBadgeDefinitions((current) => current.map((item) => item.id === updated.id ? updated : item).sort((a, b) => (a.order || 100) - (b.order || 100)));
      notify("Insignia actualizada."); return true;
    } catch (error) { notify(error instanceof Error ? error.message : "No fue posible editar la insignia."); return false; }
    finally { setBusyAction(""); }
  }
  async function deleteAdminBadge(badge: BadgeDefinition) {
    setBusyAction(`delete-badge-${badge.id}`);
    try {
      if (getApiUrl()) await callApi("adminDeleteBadge", { token: sessionToken, badgeId: badge.id });
      setBadgeDefinitions((current) => current.filter((item) => item.id !== badge.id));
      notify("Insignia retirada. Los datos de progreso se conservaron."); return true;
    } catch (error) { notify(error instanceof Error ? error.message : "No fue posible retirar la insignia."); return false; }
    finally { setBusyAction(""); }
  }
  async function deleteAdminUser(person: PersonProgress) {
    setBusyAction(`delete-user-${person.id}`);
    try {
      if (getApiUrl()) await callApi("adminDeleteUser", { token: sessionToken, userId: person.id });
      setAdminPeople((current) => current.filter((item) => item.id !== person.id));
      notify("Usuario eliminado. Su historial quedó anonimizado."); return true;
    } catch (error) { notify(error instanceof Error ? error.message : "No fue posible eliminar el usuario."); return false; }
    finally { setBusyAction(""); }
  }
  async function editAdminUser(person: PersonProgress) {
    setBusyAction(`edit-user-${person.id}`);
    try {
      let updated = person;
      if (getApiUrl()) {
        const data = await callApi("adminEditUser", { token: sessionToken, user: person }) as { user: PersonProgress };
        updated = { ...person, ...data.user };
      }
      setAdminPeople((current) => current.map((item) => item.id === updated.id ? updated : item));
      notify("Usuario actualizado correctamente."); return true;
    } catch (error) { notify(error instanceof Error ? error.message : "No fue posible editar el usuario."); return false; }
    finally { setBusyAction(""); }
  }
  async function createAdminRecoveryCode(person: PersonProgress) {
    setBusyAction(`recovery-user-${person.id}`);
    try {
      if (getApiUrl()) {
        const data = await callApi("adminCreateRecoveryCode", { token: sessionToken, userId: person.id }) as { code: string };
        notify(`Código de respaldo para ${person.name}: ${data.code}`);
        return data.code;
      }
      return "RESPALDO";
    } catch (error) { notify(error instanceof Error ? error.message : "No fue posible generar el código."); return ""; }
    finally { setBusyAction(""); }
  }
  async function manageAdminBonusRecord(recordId: string, mode: "reset" | "delete" | "resetAll") {
    const actionKey = mode === "resetAll" ? "records-reset-all" : `${mode}-record-${recordId}`;
    setBusyAction(actionKey);
    try {
      if (getApiUrl()) await callApi("adminManageBonusRecord", { token: sessionToken, recordId, mode });
      if (mode === "delete") setAdminBonusRecords((current) => current.filter((record) => record.id !== recordId));
      else if (mode === "reset") setAdminBonusRecords((current) => current.map((record) => record.id === recordId ? { ...record, record: 0 } : record));
      else setAdminBonusRecords((current) => current.map((record) => ({ ...record, record: 0 })));
      setBonusLeaderboard([]); bonusLeaderboardLoaded.current = false;
      notify(mode === "delete" ? "Resultado Bonus eliminado junto con sus puntos." : mode === "resetAll" ? "Todos los récords fueron restablecidos a cero." : "Récord restablecido a cero; los puntos se conservaron.");
      return true;
    } catch (error) { notify(error instanceof Error ? error.message : "No fue posible administrar el récord."); return false; }
    finally { setBusyAction(""); }
  }
  async function refreshAdminDashboard() {
    if (busyAction) return;
    setBusyAction("admin-refresh");
    try {
      if (getApiUrl()) {
        const data = await callApi("adminDashboard", { token: sessionToken, force: true });
        const dashboard = data as { people?: PersonProgress[]; missions?: Mission[]; evidence?: AdminEvidence[]; records?: AdminBonusRecord[]; badges?: BadgeDefinition[]; uads?: string[] };
        setAdminPeople(dashboard.people || []);
        setAdminEvidence(dashboard.evidence || []);
        setAdminBonusRecords(dashboard.records || []);
        if (dashboard.missions) setMissions(dashboard.missions);
        if (dashboard.badges) setBadgeDefinitions(dashboard.badges);
        if (dashboard.uads) setCatalogs((current) => ({ ...current, uads: dashboard.uads! }));
        setAdminDashboardLoaded(true);
      }
      notify("Tablero administrativo actualizado.");
    } catch (error) { notify(error instanceof Error ? error.message : "No fue posible actualizar el tablero."); }
    finally { setBusyAction(""); }
  }
  async function saveAvatar() {
    if (busyAction) return;
    if (avatarPurpose === "register") {
      setAvatarOpen(false);
      notify("Avatar listo. Se guardará al crear tu pasaporte.");
      return;
    }
    if (!user) return;
    const avatar = encodeAvatar(avatarDraft);
    const previousUser = user;
    setUser({ ...user, avatar });
    setAvatarOpen(false);
    setBusyAction("avatar");
    try {
      if (getApiUrl()) await callApi("updateAvatar", { token: sessionToken, avatar });
      notify("Avatar actualizado.");
    } catch (error) {
      setUser(previousUser);
      notify(error instanceof Error ? error.message : "No fue posible actualizar el avatar.");
    }
    finally { setBusyAction(""); }
  }
  async function loadBonusLeaderboard(force = false) {
    if (!user || !sessionToken || (bonusLeaderboardLoaded.current && !force)) return;
    bonusLeaderboardLoaded.current = true;
    setBonusLeaderboardLoading(true);
    try {
      if (getApiUrl()) {
        const data = await callApi("getBonusLeaderboard", { token: sessionToken, force }) as { entries?: BonusLeaderboardEntry[] };
        setBonusLeaderboard(data.entries || []);
      } else setBonusLeaderboard(demoBonusLeaderboard);
    } catch {
      bonusLeaderboardLoaded.current = false;
      if (!bonusLeaderboard.length) setBonusLeaderboard(demoBonusLeaderboard);
    } finally { setBonusLeaderboardLoading(false); }
  }
  async function completeBonus(gameId: BonusGameId, score: number, record = score) {
    if (busyAction) return;
    const previousCompleted = bonusCompleted;
    const previousScores = bonusScores;
    const previousRecords = bonusRecords;
    setBonusCompleted((current) => current.includes(gameId) ? current : [...current, gameId]);
    setBonusScores((current) => ({ ...current, [gameId]: Math.max(current[gameId] || 0, score) }));
    setBonusRecords((current) => ({ ...current, [gameId]: Math.max(current[gameId] || 0, record) }));
    setBusyAction(`bonus-${gameId}`);
    try {
      let bestScore = Math.max(previousScores[gameId] || 0, score);
      let bestRecord = Math.max(previousRecords[gameId] || 0, record);
      if (getApiUrl()) {
        const data = await callApi("completeBonus", { token: sessionToken, gameId, score, record }) as { bestScore?: number; bestRecord?: number };
        bestScore = Number(data.bestScore) || bestScore;
        bestRecord = Number(data.bestRecord) || bestRecord;
      }
      setBonusScores((current) => ({ ...current, [gameId]: bestScore }));
      setBonusRecords((current) => ({ ...current, [gameId]: bestRecord }));
      notify(record > (previousRecords[gameId] || 0) ? `¡Nuevo récord! Sumaste hasta ${bestScore} puntos.` : "Resultado guardado. Tu mejor récord se conserva.");
      await loadBonusLeaderboard(true);
    } catch (error) {
      setBonusCompleted(previousCompleted);
      setBonusScores(previousScores);
      setBonusRecords(previousRecords);
      notify(error instanceof Error ? error.message : "No fue posible guardar el bonus.");
    }
    finally { setBusyAction(""); }
  }
  function closeStamp() { const allDone = visibleMissions.length > 0 && completedVisible.length >= visibleMissions.length; setStampMission(null); if (allDone) turnTo("complete"); }
  function logout() {
    if (sessionClosing) return;
    setSessionClosing(true);
    window.setTimeout(() => {
      localStorage.removeItem("pasaporte_session");
      localStorage.removeItem(SESSION_BUNDLE_KEY);
      setSessionToken(""); setUser(null); setOpened(false); setView("dashboard");
      setBonusCompleted([]); setBonusScores({}); setBonusRecords({}); setBonusLeaderboard([]); setAdminBonusRecords([]); bonusLeaderboardLoaded.current = false; setSessionClosing(false);
      setAdminDashboardLoaded(false);
    }, 900);
  }

  return <main className="app-shell">
    <div className="aurora aurora-one" /><div className="aurora aurora-two" />
    {!opened && <section className="cover-stage" aria-label="Portada del Pasaporte Seguro">
      <div className="cover-perspective">
      <div className="book-cover clean-cover minimal-cover vibrant-cover"><span className="cover-spine" /><span className="cover-foil" /><span className="cover-light" aria-hidden="true" /><div className="cover-brand-ribbons" aria-hidden="true"><i /><i /><i /><i /></div>
        <div className="cover-brands"><img className="cover-company-logo" src="./assets/jer-logo.webp" alt="JER Une tus sueños" /><span>Una experiencia apoyada por</span><img className="cover-program-logo" src="./assets/de-mi-para-mi.webp" alt="Programa De mí para mí" /></div>
        <div className="minimal-cover-layout"><div className="minimal-cover-copy"><div className="cover-kickers"><p className="festival">FESTIVAL 2026</p><p className="eyebrow">SEMANA DE LA SEGURIDAD Y SALUD EN EL TRABAJO</p></div><h1>PASAPORTE <span>SEGURO</span></h1><p className="cover-intro">Tu ruta interactiva por el <b>autocuidado</b>, el bienestar y la seguridad en el trabajo.</p><div className="cover-keywords" aria-label="Temas del pasaporte">{stations.map((station) => <span key={station.name} style={{ "--station": station.color } as React.CSSProperties}>{station.name.replace("Estación ", "")}</span>)}</div><p className="motto">DIFERENTES EN DISTANCIA · ÚNICOS EN HISTORIA · JUNTOS EN PROPÓSITO</p><a className="primary-button cover-button cover-entry-button" href={passportAccessHref()} onClick={(event) => { event.preventDefault(); openPassport(); }} aria-controls="passport-access">{user ? "Volver a mi pasaporte" : "Ingresar al pasaporte"} <UiIcon name="arrow" /></a><small className="cover-entry-note">Explora estaciones · completa retos · colecciona insignias</small></div>
          <figure className="cover-art"><span className="cover-art-orbit" aria-hidden="true" /><img src="./assets/autocuidado-1mas1.webp" alt="Dos personas cuidando juntas su bienestar" width="817" height="900" loading="eager" decoding="async" /><strong className="cover-art-badge"><b>1 + 1 = 3</b><small>El cuidado nos multiplica</small></strong><figcaption>Juntos por un entorno más seguro, saludable y feliz</figcaption></figure>
        </div>
      </div></div><p className="hint"><span>↔</span> Mueve el cursor y abre tu próxima aventura</p>
    </section>}

    {opened && !user && <section className="auth-stage" id="passport-access"><div className="auth-book"><aside className="auth-visual"><p className="mini-kicker">FESTIVAL 2026</p><div className="passport-mark">P</div><h2>Tu ruta segura comienza aquí.</h2><p>Regístrate, visita las estaciones y colecciona cada sello del festival.</p><div className="mini-route">{stations.map((s) => <span key={s.name} style={{ background: s.color }}><StationIcon station={s.name} /></span>)}</div></aside>
      <div className="auth-form-side"><div className="auth-switch" role="tablist"><button className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")}>Iniciar sesión</button><button className={authMode === "register" ? "active" : ""} onClick={() => setAuthMode("register")}>Crear pasaporte</button></div>
        {authMode === "login" ? <form className="passport-form" onSubmit={login}><p className="step-label">BIENVENIDO DE NUEVO</p><h2>Continúa tu recorrido</h2><label>Número de cédula<input name="cedula" inputMode="numeric" maxLength={25} autoComplete="username" placeholder="Ej. 1010101010" required /></label><label>Contraseña<input name="password" type="password" maxLength={128} autoComplete="current-password" placeholder="Tu contraseña" required /></label><button className="primary-button" type="submit" disabled={busyAction === "login"}>{busyAction === "login" ? <><LoadingDot /> Verificando...</> : <>Ingresar al pasaporte <UiIcon name="arrow" /></>}</button><button className="forgot-password" type="button" onClick={() => { setAuthMode("recover"); setRecoveryStage("request"); setRecoveryTicket(""); }}>¿Olvidaste tu contraseña?</button>{!getApiUrl() && <p className="demo-note">Demostración administrador: <b>1000000000</b> / <b>Demo1234*</b></p>}</form>
        : authMode === "register" ? <form className="passport-form register-grid" onSubmit={register}><div className="form-heading"><p className="step-label">NUEVO VIAJERO</p><h2>Crea tu pasaporte</h2></div><button className="register-avatar-card wide" type="button" onClick={() => openAvatarStudio("register")}><AvatarPortrait value={encodeAvatar(avatarDraft)} size="small" /><span><b>Crea tu foto de pasaporte</b><small>Elige rostro, cabello, ropa y accesorios antes de registrarte.</small></span><i>Personalizar →</i></button><label className="wide">Nombre completo<input name="name" maxLength={120} autoComplete="name" placeholder="Nombres y apellidos" required /></label><label>Número de cédula<input name="cedula" inputMode="numeric" maxLength={25} autoComplete="username" placeholder="Sin puntos" required /></label><label>Número de teléfono<input name="phone" type="tel" maxLength={30} autoComplete="tel" placeholder="300 000 0000" required /></label><label className="wide">Correo electrónico<input name="email" type="email" maxLength={160} autoComplete="email" placeholder="nombre@empresa.com" required /></label><label>Cargo<select name="cargo">{catalogs.cargos.map((x) => <option key={x}>{x}</option>)}</select></label><label>UAD<select name="uad">{catalogs.uads.map((x) => <option key={x}>{x}</option>)}</select></label><label className="wide">Contraseña<input name="password" type="password" minLength={8} maxLength={128} autoComplete="new-password" placeholder="Mínimo 8 caracteres" required /></label><button className="primary-button wide" type="submit" disabled={busyAction === "register"}>{busyAction === "register" ? <><LoadingDot /> Creando...</> : <>Crear mi pasaporte <UiIcon name="arrow" /></>}</button></form>
        : recoveryStage === "request" ? <form className="passport-form recovery-form" onSubmit={requestPasswordReset}><RecoveryProgress step={1} /><p className="step-label">RECUPERAR ACCESO</p><h2>Solicita tu código</h2><p>Escribe la cédula y el correo usados al crear tu pasaporte. Te enviaremos un código válido por 15 minutos.</p><label>Número de cédula<input name="cedula" inputMode="numeric" maxLength={25} required /></label><label>Correo registrado<input name="email" type="email" maxLength={160} autoComplete="email" required /></label><button className="primary-button" type="submit" disabled={busyAction === "request-reset"}>{busyAction === "request-reset" ? <><LoadingDot /> Enviando...</> : <>Enviar código <UiIcon name="key" /></>}</button><button className="forgot-password" type="button" onClick={() => { setRecoveryTicket(""); setRecoveryStage("verify"); }}>Ya tengo un código de respaldo</button><button className="auth-back" type="button" onClick={() => setAuthMode("login")}>← Volver al inicio de sesión</button></form>
        : recoveryStage === "verify" || !recoveryTicket ? <form className="passport-form recovery-form" onSubmit={verifyPasswordResetCode}><RecoveryProgress step={2} /><p className="step-label">VALIDAR IDENTIDAD</p><h2>Ingresa el código</h2><p>Revisa tu correo e introduce el código recibido. No podrás crear una contraseña nueva hasta validarlo.</p><label>Número de cédula<input name="cedula" inputMode="numeric" maxLength={25} defaultValue={recoveryCedula} required /></label><label>Código de recuperación<input name="code" minLength={6} maxLength={12} autoComplete="one-time-code" autoCapitalize="characters" placeholder="Ej. A7K9P2" pattern="[A-Za-z0-9]{6,12}" onInput={(event) => { event.currentTarget.value = event.currentTarget.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12); }} required /></label><button className="primary-button" type="submit" disabled={busyAction === "verify-reset-code"}>{busyAction === "verify-reset-code" ? <><LoadingDot /> Validando...</> : <>Validar código <UiIcon name="check" /></>}</button><button className="auth-back" type="button" onClick={() => { setRecoveryTicket(""); setRecoveryStage("request"); }}>← Solicitar otro código</button></form>
        : <form className="passport-form recovery-form" onSubmit={resetPassword}><RecoveryProgress step={3} /><p className="step-label">CÓDIGO CONFIRMADO</p><h2>Crea una contraseña nueva</h2><div className="recovery-verified" role="status"><span><UiIcon name="check" /></span><div><b>Código validado correctamente</b><small>El acceso está habilitado durante 10 minutos.</small></div></div><label>Número de cédula<input name="cedula" value={recoveryCedula} readOnly /></label><label>Nueva contraseña<input name="password" type="password" minLength={8} maxLength={128} autoComplete="new-password" placeholder="Mínimo 8 caracteres" required /></label><label>Confirmar contraseña<input name="confirmation" type="password" minLength={8} maxLength={128} autoComplete="new-password" placeholder="Repite la contraseña" required /></label><button className="primary-button" type="submit" disabled={busyAction === "reset-password"}>{busyAction === "reset-password" ? <><LoadingDot /> Guardando...</> : <>Guardar nueva contraseña <UiIcon name="check" /></>}</button><button className="auth-back" type="button" onClick={() => { setRecoveryTicket(""); setRecoveryStage("request"); }}>← Reiniciar recuperación</button></form>}
      </div></div></section>}

    {opened && user && <section className={`passport-stage ${sessionOpening ? "session-opening" : ""} ${sessionClosing ? "session-closing" : ""}`}><nav className="page-tabs" aria-label="Secciones del pasaporte"><Tab label="Tablero" icon="home" active={view === "dashboard"} onClick={() => turnTo("dashboard")} /><Tab label="Cómo usarlo" icon="help" active={view === "guide"} onClick={() => turnTo("guide")} /><Tab label="Misiones" icon="compass" active={view === "missions"} onClick={() => { setMissionFilter("Todas"); turnTo("missions"); }} /><Tab label="Bonus" icon="gamepad" active={view === "bonus"} onClick={() => turnTo("bonus")} />{featureEnabled("badges") && <Tab label="Insignias" icon="badge" active={view === "badges"} onClick={() => turnTo("badges")} />}<Tab label="Historial" icon="history" active={view === "history"} onClick={() => turnTo("history")} />{user.role === "ADMIN" && <Tab label="Administrar" icon="settings" active={view === "admin"} onClick={() => turnTo("admin")} />}</nav>
      <div className="passport-book"><span className="book-binding" aria-hidden="true" /><header className="passport-header"><div className="brand-lockup"><div className="brand-p">P</div><div><b>PASAPORTE SEGURO</b><small>FESTIVAL 2026</small></div></div><div className="header-campaign-lockup"><img className="header-program-logo" src="./assets/de-mi-para-mi.webp" alt="De mí para mí" width="132" height="52" decoding="async" /><span aria-hidden="true" /><img className="header-campaign-art" src="./assets/autocuidado-1mas1.webp" alt="1 más 1 es igual a 3: el cuidado nos multiplica" width="817" height="900" decoding="async" /></div><div className="header-actions"><button className="cover-return" onClick={() => setOpened(false)} aria-label="Regresar a la portada"><UiIcon name="cover" /><span>Portada</span></button><div className="profile-chip"><AvatarPortrait value={user.avatar} size="tiny" /><div><b>{user.name}</b><small>{user.uad}</small></div><button onClick={logout} aria-label="Cerrar sesión" title="Cerrar sesión"><UiIcon name="logout" /></button></div></div></header>
        <div className={`page-sheet turn-${pageDirection}`} key={`${view}-${pageKey}`}>
        {view === "dashboard" && <div className="page-content dashboard-page"><div className="welcome-copy"><p className="step-label">TABLERO DE VIAJE</p><h2>¡Hola, {user.name.split(" ")[0]}! <span>👋</span></h2><p>Tu pasaporte ya está en marcha. Cada estación suma una experiencia, un sello y nuevos puntos.</p></div><button className="avatar-card" onClick={() => openAvatarStudio("profile")}><span className="avatar-large"><AvatarPortrait value={user.avatar} size="small" /></span><span><b>Tu foto de pasaporte</b><small>Personalizar avatar</small></span><i>✎</i></button>
          <div className="progress-card"><div className="progress-ring" style={{ "--progress": `${progress * 3.6}deg` } as React.CSSProperties}><span><b>{progress}%</b><small>completado</small></span></div><div><p className="step-label">AVANCE TOTAL</p><h3>{completedVisible.length} de {visibleMissions.length} misiones selladas</h3><p>{progress < 100 ? `Te faltan ${visibleMissions.length - completedVisible.length} sellos para completar el pasaporte.` : "¡Tu pasaporte está completo!"}</p></div><button className="secondary-button" onClick={() => turnTo(progress === 100 ? "complete" : "missions")}>{progress === 100 ? "Ver logro" : "Continuar misiones"}</button></div>
          <div className={`stat-grid ${featureEnabled("badges") ? "stat-grid-four" : ""}`}><StatCard icon="sparkle" label="Puntos acumulados" value={String(points)} color="#9d5cff" /><StatCard icon="play" label="Misiones en curso" value={String(started.length)} color="#ffb703" /><StatCard icon="check" label="Sellos obtenidos" value={String(completedVisible.length)} color="#12cfe0" />{featureEnabled("badges") && <button className="stat-card stat-card-button" onClick={() => turnTo("badges")}><span style={{ background: "#ff5c9b" }}><UiIcon name="badge" /></span><div><b>{unlockedBadges}</b><small>Insignias logradas</small></div></button>}</div>
          {featureEnabled("livingRoute") && <FestivalRoute missions={visibleMissions} completed={completed} started={started} avatar={user.avatar} travelerName={user.name} onExplore={exploreStation} />}
        </div>}

        {view === "guide" && <div className="page-content guide-page"><div className="center-heading"><p className="step-label">GUÍA DE VIAJE</p><h2>¿Cómo usar tu pasaporte?</h2><p>Cuatro pasos sencillos para vivir la experiencia completa.</p></div><div className="guide-steps"><GuideStep number="01" icon="compass" title="Explora las misiones" text="Abre el selector y descubre las actividades disponibles para tu UAD." color="#9d5cff" /><GuideStep number="02" icon="pin" title="Visita la estación" text="Acércate a la estación indicada y pulsa Iniciar misión cuando estés listo." color="#12cfe0" /><GuideStep number="03" icon="check" title="Completa el reto" text="Realiza la actividad con el facilitador y registra tu misión como completada." color="#ffb703" /><GuideStep number="04" icon="sparkle" title="Colecciona sellos" text="Suma puntos, revisa tu historial y completa todas las páginas del pasaporte." color="#ff5c9b" /></div><div className="tip-card"><span><UiIcon name="sparkle" /></span><div><b>Consejo de viajero</b><p>Las misiones disponibles dependen de tu UAD. Vuelve a revisar durante el festival: pueden aparecer retos nuevos.</p></div></div><button className="primary-button centered" onClick={() => turnTo("missions")}>Ver misiones disponibles <UiIcon name="arrow" /></button></div>}

        {view === "missions" && <div className="page-content missions-page"><div className="section-heading missions-heading"><div><p className="step-label">DESTINO ALCANZADO</p><h2>{missionFilter === "Todas" ? "Todas las misiones del festival" : missionFilter}</h2><p>{filteredMissions.length} actividades disponibles para {user.uad}.</p></div><div className="mission-heading-actions">{getApiUrl() && <button className="secondary-button" disabled={missionSync.loading} onClick={() => void missionSync.refresh()}>{missionSync.loading ? "Actualizando…" : "Actualizar misiones ↻"}</button>}<button className="world-return-button" onClick={() => turnTo("dashboard")}><UiIcon name="compass" /> Volver al mundo 3D</button><div className="points-pill"><UiIcon name="sparkle" /> {points} puntos</div></div></div><div className="filter-row"><button className={missionFilter === "Todas" ? "active" : ""} onClick={() => setMissionFilter("Todas")}>Todas</button>{stations.map((s) => <button aria-label={s.name} title={s.name} className={missionFilter === s.name ? "active" : ""} style={{ "--station": s.color } as React.CSSProperties} key={s.name} onClick={() => setMissionFilter(s.name)}><StationIcon station={s.name} /><span>{s.name.replace("Estación ", "")}</span></button>)}</div>
          {missionSync.error && <p className="mission-sync-error" role="alert">No se pudo confirmar la lista actual. {missionSync.error}</p>}
          <div className="mission-grid">{filteredMissions.map((m) => { const done = completed.includes(m.id), active = started.includes(m.id), isStarting = busyAction === `start-${m.id}`; return <article className={`mission-card ${done ? "completed" : ""}`} key={m.id} style={{ "--station": m.color } as React.CSSProperties}><div className="mission-top"><span className="station-icon"><StationIcon station={m.station} /></span><span className="mission-status">{done ? "✓ SELLADA" : active ? "● EN CURSO" : "DISPONIBLE"}</span></div><p className="station-name">{m.station}</p><h3>{m.title}</h3><p>{m.description}</p><div className="mission-meta"><span><UiIcon name="clock" /> {m.duration}</span><span><UiIcon name="sparkle" /> {m.points} pts</span><span><UiIcon name="pin" /> {m.audience}</span>{m.evidenceRequired && <span><UiIcon name="camera" /> Evidencia requerida</span>}</div>{done ? <button className="mission-button done-button" disabled>Pasaporte sellado <UiIcon name="check" /></button> : active ? <button className="mission-button" onClick={() => requestMissionSeal(m)}>Validar y sellar <UiIcon name="check" /></button> : <button className="mission-button outline" disabled={isStarting} onClick={() => startMission(m.id)}>{isStarting ? <><LoadingDot /> Iniciando...</> : <>Iniciar misión <UiIcon name="play" /></>}</button>}</article> })}</div>
          {!filteredMissions.length && <div className="empty-state"><span><UiIcon name="compass" /></span><h3>{missionSync.loading ? "Consultando tus misiones…" : "No hay misiones en esta selección"}</h3><p>{missionFilter !== "Todas" ? "Puede haber actividades en otras estaciones. Revisa todas tus misiones." : "Verifica que tu UAD sea correcta. Si te asignaron una misión nueva, pulsa Actualizar misiones."}</p>{missionFilter !== "Todas" && <button className="secondary-button" onClick={() => setMissionFilter("Todas")}>Ver todas mis misiones</button>}</div>}
        </div>}

        {view === "bonus" && <Suspense fallback={<div className="page-content lazy-page-loader"><LoadingDot /><b>Preparando la zona bonus...</b></div>}><MiniGamesPage completed={bonusCompleted} scores={bonusScores} records={bonusRecords} leaderboard={bonusLeaderboard} leaderboardLoading={bonusLeaderboardLoading} busy={busyAction} onRefreshLeaderboard={() => loadBonusLeaderboard(true)} onComplete={completeBonus} /></Suspense>}

        {view === "badges" && featureEnabled("badges") && <BadgeCollection badges={badges} onExplore={() => turnTo("missions")} />}

        {view === "history" && <div className="page-content history-page"><div className="section-heading"><div><p className="step-label">BITÁCORA PERSONAL</p><h2>Historial de misiones</h2><p>Todos los sellos y experiencias que has coleccionado.</p></div><div className="passport-number">PASAPORTE Nº <b>{user.cedula.slice(-6).padStart(6, "0")}</b></div></div><div className="history-list">{completedHistory.length ? completedHistory.map((m, i) => <article className="history-item" key={m.id}><span className="history-icon" style={{ background: m.color }}><StationIcon station={m.station} /></span><div><small>{m.station}</small><h3>{m.title}</h3><p>Completada el {historyDates[m.id] ? new Date(historyDates[m.id]).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" }) : `${i === 0 ? "10" : "11"} de agosto de 2026`} · {m.duration}</p></div><div className="history-points">+{m.points}<small>puntos</small></div><span className="mini-stamp">SELLADA</span></article>) : <div className="empty-state"><span><UiIcon name="compass" /></span><h3>Tu bitácora está lista</h3><p>Completa tu primera misión para estrenar esta página.</p><button className="primary-button" onClick={() => turnTo("missions")}>Explorar misiones</button></div>}</div></div>}

        {view === "complete" && <div className="page-content complete-page"><div className="confetti-field" aria-hidden="true">✦　●　◆　✦　●　◆　✦</div><div className="completion-seal"><span>✓</span><b>PASAPORTE<br />COMPLETO</b><small>FESTIVAL 2026</small></div><p className="step-label">MISIÓN CUMPLIDA</p><h2>¡Completaste tu Pasaporte Seguro!</h2><p className="completion-copy">Recorriste todas las estaciones y demostraste que la diversidad, la felicidad, la seguridad, la salud y el cuidado se construyen entre todos.</p><div className="completion-name"><small>OTORGADO A</small><b>{user.name}</b><span>{user.uad} · {points} puntos · {unlockedBadges} insignias</span></div><div className="completion-actions"><button className="secondary-button" onClick={() => turnTo("history")}>Ver mi historial</button>{featureEnabled("badges") && <button className="secondary-button" onClick={() => turnTo("badges")}>Ver insignias</button>}</div>{featureEnabled("downloadableCard") && <FinalPassportCard name={user.name} uad={user.uad} cedula={user.cedula} avatar={user.avatar} points={points} missions={visibleMissions} completed={completed} badges={badges} onNotice={notify} />}</div>}
        {view === "admin" && user.role === "ADMIN" && <AdminPage missions={missions} people={adminPeople} evidence={adminEvidence} records={adminBonusRecords} badges={badgeDefinitions} uadOptions={catalogs.uads} busyAction={busyAction} onCreate={createAdminMission} onEdit={editAdminMission} onDelete={deleteAdminMission} onCreateBadge={createAdminBadge} onEditBadge={editAdminBadge} onDeleteBadge={deleteAdminBadge} onEditUser={editAdminUser} onDeleteUser={deleteAdminUser} onCreateRecoveryCode={createAdminRecoveryCode} onManageRecord={manageAdminBonusRecord} onRefresh={refreshAdminDashboard} />}
        </div>
      </div>
    </section>}

    {avatarOpen && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Personalizar avatar"><div className="avatar-modal avatar-studio"><button className="close-button" type="button" onClick={() => setAvatarOpen(false)}>×</button><div className="avatar-studio-preview"><div className="avatar-halo" /><AvatarPortrait value={encodeAvatar(avatarDraft)} size="large" /><p className="step-label">TU FOTO DE PASAPORTE</p><h2>Crea un avatar a tu estilo</h2><p>Combina tonos, peinados, ropa y accesorios compatibles.</p></div><div className="avatar-controls">
      <AvatarOption label="Tono de piel"><div className="color-options">{skinTones.map((color, index) => <button type="button" aria-label={`Tono de piel ${index + 1}`} className={avatarDraft.skin === index ? "selected" : ""} style={{ background: color }} key={color} onClick={() => setAvatarDraft({ ...avatarDraft, skin: index })} />)}</div></AvatarOption>
      <AvatarOption label="Estilo de cabello"><div className="text-options">{hairStyles.map((style, index) => <button type="button" className={avatarDraft.style === index ? "selected" : ""} key={style.id} onClick={() => setAvatarDraft({ ...avatarDraft, style: index })}>{style.label}</button>)}</div></AvatarOption>
      <AvatarOption label="Color de cabello"><div className="color-options">{hairColors.map((color, index) => <button type="button" aria-label={`Color de cabello ${index + 1}`} className={avatarDraft.hair === index ? "selected" : ""} style={{ background: color }} key={color} onClick={() => setAvatarDraft({ ...avatarDraft, hair: index })} />)}</div></AvatarOption>
      <AvatarOption label="Color de camiseta"><div className="color-options">{shirtColors.map((color, index) => <button type="button" aria-label={`Color de camiseta ${index + 1}`} className={avatarDraft.shirt === index ? "selected" : ""} style={{ background: color }} key={color} onClick={() => setAvatarDraft({ ...avatarDraft, shirt: index })} />)}</div></AvatarOption>
      <AvatarOption label="Accesorios compatibles (hasta 3)"><div className="accessory-options">{accessories.map((item, index) => <button type="button" className={(index === 0 ? avatarDraft.accessories.length === 0 : avatarDraft.accessories.includes(index)) ? "selected" : ""} key={item.id} onClick={() => setAvatarDraft(toggleAccessory(avatarDraft, index))}><span>{item.icon}</span>{item.label}</button>)}</div></AvatarOption>
      {!!avatarDraft.accessories.length && <AvatarOption label="Colores de accesorios"><div className="accessory-color-list">{avatarDraft.accessories.map((id) => <div key={id}><b>{accessories[id].label}</b><span>{accessoryColors.map((color, index) => <button type="button" aria-label={`${accessories[id].label}, color ${index + 1}`} className={(avatarDraft.accessoryColors[id] || 0) === index ? "selected" : ""} style={{ background: color }} key={color} onClick={() => setAvatarDraft({ ...avatarDraft, accessoryColors: { ...avatarDraft.accessoryColors, [id]: index } })} />)}</span></div>)}</div></AvatarOption>}
      <button className="primary-button save-avatar" type="button" disabled={busyAction === "avatar"} onClick={saveAvatar}>{busyAction === "avatar" ? <><LoadingDot /> Guardando...</> : <>{avatarPurpose === "register" ? "Usar este avatar" : "Guardar mi avatar"} <UiIcon name="check" /></>}</button>
    </div></div></div>}
    {validationMission && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Validar misión"><form className="mission-validation-modal" onSubmit={(event) => { event.preventDefault(); void finishMission(validationMission); }}><button className="close-button" type="button" onClick={() => setValidationMission(null)}>×</button><div className="validation-orb" style={{ "--station": validationMission.color } as React.CSSProperties}><StationIcon station={validationMission.station} /></div><p className="step-label">CONTROL DE ESTACIÓN</p><h2>Valida “{validationMission.title}”</h2><p>Solicita al facilitador el código único de esta misión. No se mostrará públicamente.</p><label>Código de sellado<input value={sealCode} onChange={(event) => setSealCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))} autoComplete="one-time-code" placeholder="••••••" minLength={6} maxLength={8} required /></label><label className="evidence-drop"><span><UiIcon name="camera" /></span><b>{evidenceFile ? evidenceFile.name : "Subir foto o video"}</b><small>{validationMission.evidenceRequired ? "Obligatoria · máximo 7 MB" : "Opcional · máximo 7 MB"}</small><input type="file" accept="image/*,video/*" onChange={(event) => setEvidenceFile(event.target.files?.[0] || null)} required={!!validationMission.evidenceRequired} /></label><p className="privacy-note">La foto se comprime antes de enviarse. El video solo se carga al confirmar.</p><button className="primary-button" type="submit" disabled={busyAction === `finish-${validationMission.id}`}>{busyAction === `finish-${validationMission.id}` ? <><LoadingDot /> Validando...</> : <>Validar y obtener sello <UiIcon name="check" /></>}</button></form></div>}
    {stampMission && <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="stamp-modal"><div className="animated-stamp" style={{ "--station": stampMission.color } as React.CSSProperties}><span>✓</span><b>MISIÓN<br />COMPLETADA</b></div><p className="step-label">NUEVO SELLO</p><h2>¡Lo hiciste!</h2><p>Completaste <b>{stampMission.title}</b> y sumaste <b>{stampMission.points} puntos</b> a tu pasaporte.</p><button className="primary-button" onClick={closeStamp}>Continuar mi recorrido <span>→</span></button></div></div>}
    {sessionOpening && <div className="entry-transition" aria-hidden="true"><div className="entry-book"><span className="entry-left">PASAPORTE</span><span className="entry-right"><b>¡BIENVENIDO!</b><i>Tu viaje comienza ahora</i></span></div></div>}
    {creationCelebration && <div className="passport-created" role="status" aria-live="polite"><div className="created-passport"><div className="created-cover"><span>P</span><b>PASAPORTE<br />SEGURO</b><AvatarPortrait value={encodeAvatar(avatarDraft)} size="small" /></div><div className="created-page"><div className="created-seal"><span>✓</span><b>PASAPORTE<br />CREADO</b></div><h2>¡Todo listo!</h2><p>Listo para viajar por el mundo del autocuidado</p></div></div></div>}
    {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
  </main>;
}

function AvatarPortrait({ value, size = "small" }: { value: string; size?: "tiny" | "small" | "large" }) {
  const config = decodeAvatar(value);
  const style = hairStyles[config.style];
  return <span className={`custom-avatar avatar-${size} hair-${style.id} avatar-3d ${config.accessories.includes(7) ? "avatar-has-cap" : ""}`} style={{ "--skin": skinTones[config.skin], "--hair": hairColors[config.hair], "--shirt": shirtColors[config.shirt] } as React.CSSProperties} aria-label={`Avatar 3D con cabello ${style.label.toLowerCase()} y ${config.accessories.length} accesorios`}>
    <i className="portrait-shirt" /><i className="portrait-neck" /><i className="portrait-hair-back" /><i className="portrait-ear left" /><i className="portrait-ear right" /><i className="portrait-face"><b className="portrait-brow left" /><b className="portrait-brow right" /><b className="portrait-eye left" /><b className="portrait-eye right" /><b className="portrait-nose" /><b className="portrait-smile" /></i><i className="portrait-hair-front" />{config.accessories.map((id) => <i key={id} className={`portrait-accessory accessory-layer accessory-${accessories[id].id}`} style={{ "--accessory": accessoryColors[config.accessoryColors[id] || 0] } as React.CSSProperties} />)}
  </span>;
}

function AvatarOption({ label, children }: { label: string; children: React.ReactNode }) {
  return <section className="avatar-option"><h3>{label}</h3>{children}</section>;
}

function StationIcon({ station }: { station: string }) {
  if (station.includes("Diversidad")) return <svg className="station-svg" viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="8" r="2.4" /><circle cx="16" cy="8" r="2.4" /><circle cx="12" cy="6" r="2.7" /><path d="M3.8 18.5c.2-3 1.7-5 4.2-5 1 0 1.8.3 2.5.9M20.2 18.5c-.2-3-1.7-5-4.2-5-1 0-1.8.3-2.5.9M7.2 19c.2-4 2-6.4 4.8-6.4s4.6 2.4 4.8 6.4" /></svg>;
  if (station.includes("Felicidad")) return <svg className="station-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 9.2c0 5-8.5 10-8.5 10s-8.5-5-8.5-10A4.7 4.7 0 0 1 12 6.4a4.7 4.7 0 0 1 8.5 2.8Z" /><path d="M8.5 10.5c1.7 2 5.3 2 7 0" /></svg>;
  if (station.includes("Seguridad")) return <svg className="station-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8 20 6v5.6c0 4.8-3.2 7.8-8 9.6-4.8-1.8-8-4.8-8-9.6V6l8-3.2Z" /><path d="m8.3 12 2.4 2.4 5-5" /></svg>;
  if (station.includes("Salud")) return <svg className="station-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 9.2c0 5-8.5 10-8.5 10s-8.5-5-8.5-10A4.7 4.7 0 0 1 12 6.4a4.7 4.7 0 0 1 8.5 2.8Z" /><path d="M5.5 12h3l1.3-3.2 2.4 6.4 1.5-3.2h4.8" /></svg>;
  if (station.includes("Amor Propio")) return <svg className="station-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20c-4.7-2.1-7-5.3-7-9.2 3.3 0 5.7 1 7 3.1 1.3-2.1 3.7-3.1 7-3.1 0 3.9-2.3 7.1-7 9.2Z" /><path d="M12 13.9V7M9.5 6.4 12 3l2.5 3.4" /></svg>;
  return <svg className="station-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M19.8 4.2C12.3 4.3 6.2 7.4 5 14.8c3.8 1.2 7.4.4 9.8-2.4" /><path d="M4 20c2.4-5.2 6.2-8.8 11.4-10.8M19.8 4.2c.3 8-3.4 13-10.5 12.7" /></svg>;
}

function UiIcon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    home: <><path d="m3 11 9-8 9 8" /><path d="M5.5 9.5V21h13V9.5M9 21v-7h6v7" /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9.6 9a2.5 2.5 0 1 1 3.2 2.4c-.8.3-.8 1-.8 1.8M12 17h.01" /></>,
    compass: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" /></>,
    history: <><path d="M3.5 12a8.5 8.5 0 1 0 2-5.5L3.5 8.5" /><path d="M3.5 4.5v4h4M12 7v5l3.2 2" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
    sparkle: <><path d="m12 2 1.4 5.1L18 9l-4.6 1.9L12 16l-1.4-5.1L6 9l4.6-1.9L12 2Z" /><path d="m18.5 15 .7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3Z" /></>,
    play: <path d="m9 6 9 6-9 6V6Z" />,
    check: <path d="m5 12 4.2 4.2L19 6.8" />,
    pin: <><path d="M20 10c0 5.5-8 11-8 11S4 15.5 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    arrow: <><path d="M5 12h14M14 7l5 5-5 5" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19c.3-4 2.2-6 5.5-6s5.2 2 5.5 6M16 6.5a2.7 2.7 0 0 1 0 5.3M16 13c2.8.2 4.3 2.2 4.5 5" /></>,
    trend: <><path d="M4 18 10 12l4 3 6-8" /><path d="M15 7h5v5" /></>,
    trophy: <><path d="M8 3h8v4c0 3-1.6 5-4 5S8 10 8 7V3ZM12 12v5M8 21h8M9 17h6" /><path d="M8 5H4v2c0 2 1.5 3.5 4 3.5M16 5h4v2c0 2-1.5 3.5-4 3.5" /></>,
    gamepad: <><path d="M7.5 8h9a4.5 4.5 0 0 1 4.3 5.8l-1.1 3.6a2.2 2.2 0 0 1-3.7.8L14.1 16H9.9L8 18.2a2.2 2.2 0 0 1-3.7-.8l-1.1-3.6A4.5 4.5 0 0 1 7.5 8Z" /><path d="M8 11v4M6 13h4M16.5 12h.01M18 14h.01" /></>,
    badge: <><path d="M12 3a6 6 0 1 1 0 12 6 6 0 0 1 0-12Z" /><path d="m8.5 14-1 7 4.5-2 4.5 2-1-7M12 6.5l1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3 1-2Z" /></>,
    cover: <><path d="M5 3h11a3 3 0 0 1 3 3v15H7a2 2 0 0 1-2-2V3Z" /><path d="M7 17h12M9 3v14" /></>,
    logout: <><path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10" /></>,
    trash: <><path d="M4 7h16M9 3h6l1 4H8l1-4ZM6 7l1 14h10l1-14M10 11v6M14 11v6" /></>,
    edit: <><path d="m4 16-.8 4.8L8 20l10.5-10.5-4-4L4 16Z" /><path d="m12.8 7.2 4 4" /></>,
    camera: <><path d="M4 7h3l1.5-2h7L17 7h3v12H4V7Z" /><circle cx="12" cy="13" r="3.5" /></>,
    key: <><circle cx="8" cy="12" r="4" /><path d="M12 12h9M17 12v3M20 12v2" /></>,
  };
  return <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name] || paths.sparkle}</svg>;
}

function LoadingDot() { return <span className="loading-dot" aria-hidden="true" />; }
function RecoveryProgress({ step }: { step: 1 | 2 | 3 }) { return <div className="recovery-progress" aria-label={`Paso ${step} de 3`}>{["Correo", "Código", "Contraseña"].map((label, index) => <span className={step >= index + 1 ? "active" : ""} key={label}><b>{index + 1}</b><small>{label}</small></span>)}</div>; }
function Tab({ label, icon, active, onClick }: { label: string; icon: string; active: boolean; onClick: () => void }) { return <button className={active ? "active" : ""} onClick={onClick}><span><UiIcon name={icon} /></span>{label}</button>; }
function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) { return <article className="stat-card"><span style={{ background: color }}><UiIcon name={icon} /></span><div><b>{value}</b><small>{label}</small></div></article>; }
function GuideStep({ number, icon, title, text, color }: { number: string; icon: string; title: string; text: string; color: string }) { return <article className="guide-step"><span className="guide-number">{number}</span><div className="guide-icon" style={{ background: color }}><UiIcon name={icon} /></div><h3>{title}</h3><p>{text}</p></article>; }

function AdminPage({ missions, people, evidence, records, badges, uadOptions: catalogUads, busyAction, onCreate, onEdit, onDelete, onCreateBadge, onEditBadge, onDeleteBadge, onEditUser, onDeleteUser, onCreateRecoveryCode, onManageRecord, onRefresh }: {
  missions: Mission[];
  people: PersonProgress[];
  evidence: AdminEvidence[];
  records: AdminBonusRecord[];
  badges: BadgeDefinition[];
  uadOptions: string[];
  busyAction: string;
  onCreate: (mission: Mission) => Promise<boolean>;
  onEdit: (mission: Mission, regenerateCode: boolean) => Promise<boolean>;
  onDelete: (mission: Mission) => Promise<boolean>;
  onCreateBadge: (badge: BadgeDefinition) => Promise<boolean>;
  onEditBadge: (badge: BadgeDefinition) => Promise<boolean>;
  onDeleteBadge: (badge: BadgeDefinition) => Promise<boolean>;
  onEditUser: (person: PersonProgress) => Promise<boolean>;
  onDeleteUser: (person: PersonProgress) => Promise<boolean>;
  onCreateRecoveryCode: (person: PersonProgress) => Promise<string>;
  onManageRecord: (recordId: string, mode: "reset" | "delete" | "resetAll") => Promise<boolean>;
  onRefresh: () => Promise<void>;
}) {
  const [tab, setTab] = useState<"overview" | "missions" | "badges" | "users" | "records" | "evidence">("overview");
  const [audience, setAudience] = useState("Todas las UAD");
  const [deleteTarget, setDeleteTarget] = useState<Mission | null>(null);
  const [editTarget, setEditTarget] = useState<Mission | null>(null);
  const [badgeEditTarget, setBadgeEditTarget] = useState<BadgeDefinition | null>(null);
  const [badgeDeleteTarget, setBadgeDeleteTarget] = useState<BadgeDefinition | null>(null);
  const [userDeleteTarget, setUserDeleteTarget] = useState<PersonProgress | null>(null);
  const [userEditTarget, setUserEditTarget] = useState<PersonProgress | null>(null);
  const [recoveryCode, setRecoveryCode] = useState<{ person: PersonProgress; code: string } | null>(null);
  const [recordAction, setRecordAction] = useState<{ record?: AdminBonusRecord; mode: "reset" | "delete" | "resetAll" } | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [recordSearch, setRecordSearch] = useState("");
  const [missionSearch, setMissionSearch] = useState("");
  const [badgeSearch, setBadgeSearch] = useState("");
  const uadOptions = useMemo(() => {
    const options = new Map<string, string>();
    [...catalogUads, ...people.map((person) => person.uad)].forEach((uad) => {
      const key = audienceKey(uad);
      if (key && key !== "todas las uad" && !options.has(key)) options.set(key, uad);
    });
    return [...options.values()];
  }, [catalogUads, people]);
  const peopleByUad = useMemo(() => {
    const counts = new Map<string, number>();
    people.forEach((person) => { const key = audienceKey(person.uad); counts.set(key, (counts.get(key) || 0) + 1); });
    return counts;
  }, [people]);
  const recipientCount = (target: string) => audienceKey(target) === "todas las uad" ? people.length : peopleByUad.get(audienceKey(target)) || 0;
  const filteredPeople = useMemo(() => people.filter((person) => audienceKey(`${person.name} ${person.cedula} ${person.phone || ""} ${person.email} ${person.cargo || ""} ${person.uad}`).includes(audienceKey(userSearch))), [people, userSearch]);
  const filteredRecords = useMemo(() => records.filter((record) => audienceKey(`${record.userName} ${record.uad} ${record.gameName}`).includes(audienceKey(recordSearch))), [records, recordSearch]);
  const filteredAdminMissions = useMemo(() => missions.slice().reverse().filter((mission) => audienceKey(`${mission.title} ${mission.station} ${mission.audience}`).includes(audienceKey(missionSearch))), [missions, missionSearch]);
  const filteredBadges = useMemo(() => badges.filter((badge) => audienceKey(`${badge.title} ${badge.description}`).includes(audienceKey(badgeSearch))), [badges, badgeSearch]);
  const overviewPage = useAdminPage(people);
  const missionsPage = useAdminPage(filteredAdminMissions, missionSearch);
  const badgesPage = useAdminPage(filteredBadges, badgeSearch);
  const usersPage = useAdminPage(filteredPeople, userSearch);
  const recordsPage = useAdminPage(filteredRecords, recordSearch);
  const average = people.length ? Math.round(people.reduce((sum, p) => sum + (p.total ? (p.completed / p.total) * 100 : 0), 0) / people.length) : 0;
  const leader = people.slice().sort((a, b) => b.completed - a.completed || b.points - a.points)[0];
  const totalCompleted = people.reduce((sum, p) => sum + p.completed, 0);
  const totalPoints = people.reduce((sum, p) => sum + p.points, 0);

  async function createMission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    const station = stations.find((item) => item.name === String(form.get("station"))) || stations[0];
    const success = await onCreate({
      id: Date.now(), station: station.name, icon: station.icon, color: station.color,
      title: String(form.get("title")), description: String(form.get("description")),
      points: Number(form.get("points")), audience, duration: String(form.get("duration")) || "8 min", evidenceRequired: form.get("evidenceRequired") === "on",
    });
    if (success) { element.reset(); setAudience("Todas las UAD"); setMissionSearch(""); missionsPage.onPage(1); }
  }

  async function editMission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editTarget) return;
    const form = new FormData(event.currentTarget);
    const station = stations.find((item) => item.name === String(form.get("station"))) || stations[0];
    const updated: Mission = { ...editTarget, station: station.name, icon: station.icon, color: station.color, title: String(form.get("title")), description: String(form.get("description")), duration: String(form.get("duration")) || "8 min", points: Number(form.get("points")), audience: String(form.get("audience")), evidenceRequired: form.get("evidenceRequired") === "on" };
    if (await onEdit(updated, form.get("regenerateCode") === "on")) setEditTarget(null);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    if (await onDelete(deleteTarget)) setDeleteTarget(null);
  }

  function badgeFromForm(form: FormData, existing?: BadgeDefinition): BadgeDefinition {
    return {
      id: existing?.id || `badge-${Date.now()}`,
      title: String(form.get("title") || ""), description: String(form.get("description") || ""),
      icon: String(form.get("icon") || "star"), primaryColor: String(form.get("primaryColor") || "#9d5cff"),
      secondaryColor: String(form.get("secondaryColor") || "#12cfe0"),
      criterion: String(form.get("criterion") || "MISSIONS") as BadgeDefinition["criterion"],
      goal: Number(form.get("goal")) || 1, station: String(form.get("station") || ""),
      order: Number(form.get("order")) || 100,
    };
  }

  async function createBadge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    if (await onCreateBadge(badgeFromForm(new FormData(element)))) element.reset();
  }

  async function editBadge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (badgeEditTarget && await onEditBadge(badgeFromForm(new FormData(event.currentTarget), badgeEditTarget))) setBadgeEditTarget(null);
  }

  async function generateBackupCode(person: PersonProgress) {
    const code = await onCreateRecoveryCode(person);
    if (code) setRecoveryCode({ person, code });
  }

  async function editUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userEditTarget) return;
    const form = new FormData(event.currentTarget);
    const updated = { ...userEditTarget, name: String(form.get("name") || ""), cedula: String(form.get("cedula") || ""), phone: String(form.get("phone") || ""), email: String(form.get("email") || ""), cargo: String(form.get("cargo") || ""), uad: String(form.get("uad") || "") };
    if (await onEditUser(updated)) setUserEditTarget(null);
  }

  function downloadReport() {
    const escape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const rows = [["Colaborador", "UAD", "Misiones completadas", "Misiones disponibles", "Avance", "Puntos"], ...people.map((person) => [person.name, person.uad, person.completed, person.total, `${person.total ? Math.round((person.completed / person.total) * 100) : 0}%`, person.points])];
    const csv = `\uFEFF${rows.map((row) => row.map(escape).join(";")).join("\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "progreso-pasaporte-seguro.csv";
    document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <div className="page-content admin-page">
    <div className="admin-title"><div><p className="step-label">CENTRO DE CONTROL</p><h2>Administración del festival</h2><p>Gestiona misiones y acompaña el avance de los colaboradores.</p></div><div className="admin-title-actions"><button className="secondary-button" onClick={onRefresh} disabled={Boolean(busyAction)}>{busyAction === "admin-refresh" ? "Actualizando…" : "Actualizar datos ↻"}</button><div className="admin-badge"><UiIcon name="settings" /> Modo administrador</div></div></div>
    <div className="admin-tabs"><button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>Resumen</button><button className={tab === "missions" ? "active" : ""} onClick={() => setTab("missions")}>Misiones <span>{missions.length}</span></button><button className={tab === "badges" ? "active" : ""} onClick={() => setTab("badges")}>Insignias <span>{badges.length}</span></button><button className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}>Usuarios <span>{people.length}</span></button><button className={tab === "records" ? "active" : ""} onClick={() => setTab("records")}>Récords <span>{records.length}</span></button><button className={tab === "evidence" ? "active" : ""} onClick={() => setTab("evidence")}>Evidencias <span>{evidence.length}</span></button></div>

    {tab === "overview" ? <>
      <div className="admin-stats"><StatCard icon="users" label="Colaboradores" value={String(people.length)} color="#9d5cff" /><StatCard icon="check" label="Misiones completadas" value={String(totalCompleted)} color="#12cfe0" /><StatCard icon="trend" label="Avance promedio" value={`${average}%`} color="#43d17d" /><StatCard icon="sparkle" label="Puntos entregados" value={totalPoints >= 1000 ? `${(totalPoints / 1000).toFixed(1)}K` : String(totalPoints)} color="#ffb703" /></div>
      {leader && <div className="leader-card"><span className="leader-avatar"><UiIcon name="trophy" /></span><div><p className="step-label">LÍDER DEL RECORRIDO</p><h3>{leader.name}</h3><p>{leader.uad} · {leader.completed} misiones completadas</p></div><b>{leader.points}<small>puntos</small></b></div>}
      <div className="people-table"><div className="table-title"><h3>Progreso de colaboradores</h3><div className="table-actions"><button onClick={onRefresh} disabled={busyAction === "admin-refresh"}>{busyAction === "admin-refresh" ? "Actualizando..." : "Actualizar ↻"}</button><button onClick={downloadReport}>Descargar CSV ↓</button></div></div><div className="table-head"><span>Colaborador</span><span>UAD</span><span>Progreso</span><span>Puntos</span></div>{overviewPage.items.map((p) => { const pct = p.total ? Math.round((p.completed / p.total) * 100) : 0; return <div className="table-row" key={p.id}><span><i>{p.name.charAt(0)}</i><b>{p.name}</b></span><span>{p.uad}</span><span><div className="mini-progress"><i style={{ width: `${pct}%` }} /></div><b>{pct}%</b></span><span className="point-value">{p.points}</span></div>; })}</div><AdminPagination label="progreso" {...overviewPage} />
    </> : tab === "missions" ? <div className="mission-admin-grid">
      <form className="create-mission-card" onSubmit={createMission}><p className="step-label">NUEVA ACTIVIDAD</p><h3>Crear una misión</h3><label>Nombre de la misión<input name="title" maxLength={120} placeholder="Ej. Ruta de la confianza" required /></label><label>Estación<select name="station">{stations.map((s) => <option key={s.name}>{s.name}</option>)}</select></label><label>Descripción<textarea name="description" maxLength={700} placeholder="Explica en qué consiste el reto..." required /></label><div className="field-row"><label>Duración<input name="duration" maxLength={30} placeholder="8 min" /></label><label>Puntos<input name="points" type="number" defaultValue="100" min="10" max="1000" required /></label></div><label>¿A quién se asigna?<select value={audience === "Todas las UAD" ? "all" : "uad"} onChange={(e) => setAudience(e.target.value === "all" ? "Todas las UAD" : (uadOptions[0] || ""))}><option value="all">A todas las UAD</option><option value="uad" disabled={!uadOptions.length}>A una UAD específica</option></select></label>{audience !== "Todas las UAD" && <label>UAD asignada<select required value={audience} onChange={(e) => setAudience(e.target.value)}>{uadOptions.map((uad) => <option key={uad}>{uad}</option>)}</select></label>}<p className={`assignment-note ${recipientCount(audience) ? "" : "warning"}`}>{recipientCount(audience)} colaboradores registrados recibirán esta misión.{!recipientCount(audience) && " No hay colaboradores registrados en esta UAD; revisa la selección."}</p><label className="toggle-field"><input type="checkbox" name="evidenceRequired" /><span><b>Exigir evidencia</b><small>Foto o video para sellar</small></span></label><div className="generated-code-note"><UiIcon name="key" /><span><b>Código automático</b><small>Se genera al publicar y solo lo ve el administrador.</small></span></div><button className="primary-button" type="submit" disabled={busyAction === "create-mission"}>{busyAction === "create-mission" ? <><LoadingDot /> Publicando...</> : <>Publicar misión <UiIcon name="arrow" /></>}</button></form>
      <div className="active-missions"><div className="section-heading"><div><p className="step-label">PUBLICADAS</p><h3>Misiones activas</h3></div><span>{missions.length}</span></div><div className="user-search"><input aria-label="Buscar misiones" value={missionSearch} onChange={(event) => setMissionSearch(event.target.value)} placeholder="Buscar por nombre, estación o UAD..." /></div>{missionsPage.items.map((m) => <article key={m.id}><span style={{ background: m.color }}><StationIcon station={m.station} /></span><div><b>{m.title}</b><small>{m.station} · {m.audience}</small><small className={recipientCount(m.audience) ? "assignment-count" : "assignment-count warning"}>{recipientCount(m.audience)} colaboradores asignados{!recipientCount(m.audience) && " · Revisa la UAD"}</small><code><UiIcon name="key" /> {m.sealCode || "Cargando…"}</code></div><div className="mission-admin-actions"><button aria-label={`Editar ${m.title}`} title="Editar misión" onClick={() => setEditTarget(m)}><UiIcon name="edit" /></button><button className="delete-mission" aria-label={`Eliminar ${m.title}`} title="Eliminar misión" onClick={() => setDeleteTarget(m)}><UiIcon name="trash" /></button></div></article>)}{!missionsPage.total && <p className="admin-list-empty">No hay misiones que coincidan con la búsqueda.</p>}<AdminPagination label="misiones" {...missionsPage} /></div>
    </div> : tab === "badges" ? <div className="badge-admin-grid">
      <form className="create-mission-card badge-builder" onSubmit={createBadge}><p className="step-label">NUEVO RECONOCIMIENTO</p><h3>Crear una insignia</h3><BadgeFormFields /><button className="primary-button" disabled={busyAction === "create-badge"}>{busyAction === "create-badge" ? <><LoadingDot /> Publicando...</> : <>Publicar insignia <UiIcon name="badge" /></>}</button></form>
      <div className="admin-badge-list"><div className="section-heading"><div><p className="step-label">COLECCIÓN ACTIVA</p><h3>Insignias publicadas</h3></div><span>{badges.length}</span></div><div className="user-search"><input aria-label="Buscar insignias" value={badgeSearch} onChange={(event) => setBadgeSearch(event.target.value)} placeholder="Buscar insignias..." /></div>{badgesPage.items.map((badge) => <article key={badge.id}><span className="admin-medal-preview" style={{ "--badge-a": badge.primaryColor, "--badge-b": badge.secondaryColor } as React.CSSProperties}><BadgeIcon icon={badge.icon} /></span><div><b>{badge.title}</b><small>{badgeCriterionLabel(badge)} · meta {badge.goal}</small><i><span style={{ background: badge.primaryColor }} /><span style={{ background: badge.secondaryColor }} /></i></div><div className="mission-admin-actions"><button title="Editar insignia" onClick={() => setBadgeEditTarget(badge)}><UiIcon name="edit" /></button><button className="delete-mission" title="Retirar insignia" onClick={() => setBadgeDeleteTarget(badge)}><UiIcon name="trash" /></button></div></article>)}{!badgesPage.total && <p className="admin-list-empty">No hay insignias que coincidan con la búsqueda.</p>}<AdminPagination label="insignias" {...badgesPage} /></div>
    </div> : tab === "users" ? <div className="users-admin"><div className="section-heading"><div><p className="step-label">CONTROL DE ACCESO</p><h3>Usuarios registrados</h3><p>Busca, edita, recupera el acceso o elimina registros con errores.</p></div><button className="secondary-button" onClick={onRefresh}>Actualizar ↻</button></div><div className="user-search"><UiIcon name="users" /><input aria-label="Buscar usuarios" value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Buscar usuario..." /></div><div className="user-management-list">{usersPage.items.map((person) => <article key={person.id}><span>{person.name.charAt(0).toUpperCase()}</span><div><b>{person.name}</b><small>CC {person.cedula} · {person.uad}</small><i>{person.email}</i></div><div className="user-score"><b>{person.points}</b><small>puntos</small></div><div className="user-actions"><button title="Editar usuario" disabled={busyAction === `edit-user-${person.id}`} onClick={() => setUserEditTarget(person)}><UiIcon name="edit" /><span>Editar</span></button><button title="Generar código de respaldo" disabled={busyAction === `recovery-user-${person.id}`} onClick={() => void generateBackupCode(person)}><UiIcon name="key" /><span>Respaldo</span></button><button className="danger-outline" title="Eliminar usuario" disabled={busyAction === `delete-user-${person.id}`} onClick={() => setUserDeleteTarget(person)}><UiIcon name="trash" /><span>Eliminar</span></button></div></article>)}</div><AdminPagination label="usuarios" {...usersPage} />{!filteredPeople.length && <div className="empty-state"><span><UiIcon name="users" /></span><h3>No se encontraron usuarios</h3><p>Prueba con otro nombre, cédula o UAD.</p></div>}</div>
    : tab === "records" ? <div className="records-admin"><div className="section-heading"><div><p className="step-label">CONTROL DE PUNTUACIONES</p><h3>Récords de los minijuegos</h3><p>Reiniciar deja el récord en cero y conserva los puntos. Eliminar borra completamente el resultado del bonus.</p></div><button className="danger-outline-button" disabled={!records.length || busyAction === "records-reset-all"} onClick={() => setRecordAction({ mode: "resetAll" })}>{busyAction === "records-reset-all" ? "Restableciendo…" : "Restablecer todos"}</button></div><div className="user-search record-search"><UiIcon name="gamepad" /><input aria-label="Buscar récords" value={recordSearch} onChange={(event) => setRecordSearch(event.target.value)} placeholder="Buscar por colaborador, UAD o juego..." /></div>{filteredRecords.length ? <div className="record-management-list">{recordsPage.items.map((record) => <article key={record.id}><span className="record-game-icon" style={{ "--record-color": bonusRecordColor(record.gameId) } as React.CSSProperties}><UiIcon name="gamepad" /></span><div><b>{record.gameName}</b><small>{record.userName} · {record.uad || "Sin UAD"}</small><i>{record.completedAt ? new Date(record.completedAt).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }) : "Sin fecha"}</i></div><div className="record-values"><span><small>RÉCORD</small><b>{record.record}</b></span><span><small>PUNTOS</small><b>{record.score}</b></span></div><div className="record-actions"><button disabled={busyAction === `reset-record-${record.id}`} onClick={() => setRecordAction({ record, mode: "reset" })}>Reiniciar</button><button className="danger-outline" disabled={busyAction === `delete-record-${record.id}`} onClick={() => setRecordAction({ record, mode: "delete" })}><UiIcon name="trash" /> Eliminar</button></div></article>)}</div> : <div className="empty-state"><span><UiIcon name="gamepad" /></span><h3>No hay récords para mostrar</h3><p>Los resultados aparecerán aquí después de guardar una partida.</p></div>}<AdminPagination label="récords" {...recordsPage} /></div>
    : <div className="evidence-admin"><div className="section-heading"><div><p className="step-label">VALIDACIÓN VISUAL</p><h3>Evidencias recientes</h3><p>Los archivos se consultan solo al abrir Administración.</p></div><button className="secondary-button" onClick={onRefresh}>Actualizar ↻</button></div>{evidence.length ? <div className="evidence-grid">{evidence.map((item) => <article key={item.id}><span className="evidence-type"><UiIcon name="camera" /></span><div><b>{item.userName}</b><small>{item.missionTitle}</small><p>{item.fileName} · {(item.size / 1024 / 1024).toFixed(1)} MB</p></div><a href={item.url} target="_blank" rel="noreferrer">Revisar ↗</a></article>)}</div> : <div className="empty-state"><span><UiIcon name="camera" /></span><h3>Aún no hay evidencias</h3><p>Las fotos y videos aparecerán aquí cuando los participantes validen sus misiones.</p></div>}</div>}

    {editTarget && <div className="admin-confirm-backdrop" role="dialog" aria-modal="true" aria-label="Editar misión"><form className="admin-edit-modal" onSubmit={editMission}><button className="close-button" type="button" onClick={() => setEditTarget(null)}>×</button><p className="step-label">EDITAR MISIÓN</p><h3>{editTarget.title}</h3><label>Nombre<input name="title" defaultValue={editTarget.title} maxLength={120} required /></label><label>Estación<select name="station" defaultValue={editTarget.station}>{stations.map((s) => <option key={s.name}>{s.name}</option>)}</select></label><label>Descripción<textarea name="description" defaultValue={editTarget.description} maxLength={700} required /></label><div className="field-row"><label>Duración<input name="duration" defaultValue={editTarget.duration} maxLength={30} /></label><label>Puntos<input name="points" type="number" defaultValue={editTarget.points} min="10" max="1000" required /></label></div><label>Audiencia<select name="audience" defaultValue={editTarget.audience}><option>Todas las UAD</option>{editTarget.audience !== "Todas las UAD" && !uadOptions.includes(editTarget.audience) && <option value={editTarget.audience}>{editTarget.audience} (asignación actual)</option>}{uadOptions.map((uad) => <option key={uad}>{uad}</option>)}</select></label><label className="toggle-field"><input type="checkbox" name="evidenceRequired" defaultChecked={editTarget.evidenceRequired} /><span><b>Exigir evidencia</b><small>Foto o video para completar</small></span></label><label className="toggle-field warning"><input type="checkbox" name="regenerateCode" /><span><b>Generar un código nuevo</b><small>El código anterior dejará de funcionar</small></span></label><button className="primary-button" type="submit" disabled={busyAction === `edit-${editTarget.id}`}>{busyAction === `edit-${editTarget.id}` ? <><LoadingDot /> Guardando...</> : <>Guardar cambios <UiIcon name="check" /></>}</button></form></div>}

    {deleteTarget && <div className="admin-confirm-backdrop" role="dialog" aria-modal="true" aria-label="Confirmar eliminación"><div className="admin-confirm"><span><UiIcon name="trash" /></span><h3>¿Eliminar esta misión?</h3><p><b>{deleteTarget.title}</b> dejará de aparecer para los usuarios. El historial ya registrado se conservará.</p><div><button className="secondary-button" onClick={() => setDeleteTarget(null)} disabled={busyAction.startsWith("delete-")}>Cancelar</button><button className="danger-button" onClick={confirmDelete} disabled={busyAction === `delete-${deleteTarget.id}`}>{busyAction === `delete-${deleteTarget.id}` ? <><LoadingDot /> Eliminando...</> : <>Eliminar misión <UiIcon name="trash" /></>}</button></div></div></div>}
    {badgeEditTarget && <div className="admin-confirm-backdrop" role="dialog" aria-modal="true"><form className="admin-edit-modal badge-builder" onSubmit={editBadge}><button className="close-button" type="button" onClick={() => setBadgeEditTarget(null)}>×</button><p className="step-label">EDITAR INSIGNIA</p><h3>{badgeEditTarget.title}</h3><BadgeFormFields value={badgeEditTarget} /><button className="primary-button" disabled={busyAction === `edit-badge-${badgeEditTarget.id}`}>Guardar cambios <UiIcon name="check" /></button></form></div>}
    {badgeDeleteTarget && <div className="admin-confirm-backdrop" role="dialog" aria-modal="true"><div className="admin-confirm"><span><UiIcon name="badge" /></span><h3>¿Retirar esta insignia?</h3><p><b>{badgeDeleteTarget.title}</b> dejará de aparecer, pero no se modificará el progreso de ningún usuario.</p><div><button className="secondary-button" onClick={() => setBadgeDeleteTarget(null)}>Cancelar</button><button className="danger-button" onClick={async () => { if (await onDeleteBadge(badgeDeleteTarget)) setBadgeDeleteTarget(null); }}>Retirar insignia</button></div></div></div>}
    {userEditTarget && <div className="admin-confirm-backdrop" role="dialog" aria-modal="true" aria-label="Editar usuario"><form className="admin-edit-modal user-edit-modal" onSubmit={editUser}><button className="close-button" type="button" onClick={() => setUserEditTarget(null)}>×</button><p className="step-label">EDITAR USUARIO</p><h3>{userEditTarget.name}</h3><label>Nombre completo<input name="name" defaultValue={userEditTarget.name} maxLength={120} required /></label><div className="field-row"><label>Cédula<input name="cedula" defaultValue={userEditTarget.cedula} maxLength={25} required /></label><label>Teléfono<input name="phone" defaultValue={userEditTarget.phone || ""} maxLength={30} /></label></div><label>Correo<input name="email" type="email" defaultValue={userEditTarget.email} maxLength={160} required /></label><div className="field-row"><label>Cargo<input name="cargo" defaultValue={userEditTarget.cargo || ""} maxLength={120} /></label><label>UAD<select name="uad" defaultValue={userEditTarget.uad}>{!uadOptions.includes(userEditTarget.uad) && <option value={userEditTarget.uad}>{userEditTarget.uad}</option>}{uadOptions.map((uad) => <option key={uad}>{uad}</option>)}</select></label></div><p className="edit-session-note">Por seguridad, al guardar se cerrarán las sesiones activas de este usuario.</p><button className="primary-button" type="submit" disabled={busyAction === `edit-user-${userEditTarget.id}`}>{busyAction === `edit-user-${userEditTarget.id}` ? <><LoadingDot /> Guardando...</> : <>Guardar usuario <UiIcon name="check" /></>}</button></form></div>}
    {userDeleteTarget && <div className="admin-confirm-backdrop" role="dialog" aria-modal="true"><div className="admin-confirm"><span><UiIcon name="trash" /></span><h3>¿Eliminar este usuario?</h3><p><b>{userDeleteTarget.name}</b> perderá el acceso. Su cédula y correo quedarán libres para registrar el pasaporte nuevamente; el historial anterior se conservará de forma anónima.</p><div><button className="secondary-button" onClick={() => setUserDeleteTarget(null)}>Cancelar</button><button className="danger-button" onClick={async () => { if (await onDeleteUser(userDeleteTarget)) setUserDeleteTarget(null); }}>Eliminar usuario</button></div></div></div>}
    {recordAction && <div className="admin-confirm-backdrop" role="dialog" aria-modal="true" aria-label="Administrar récord"><div className="admin-confirm record-confirm"><span><UiIcon name={recordAction.mode === "delete" ? "trash" : "gamepad"} /></span><h3>{recordAction.mode === "delete" ? "¿Eliminar este resultado?" : recordAction.mode === "resetAll" ? "¿Restablecer todos los récords?" : "¿Reiniciar este récord?"}</h3><p>{recordAction.mode === "delete" ? <><b>{recordAction.record?.userName}</b> perderá este bonus, sus puntos y su lugar en el ranking.</> : recordAction.mode === "resetAll" ? <>Todos los récords quedarán en <b>cero</b>. Los puntos y bonus completados de los colaboradores se conservarán.</> : <>El récord de <b>{recordAction.record?.userName}</b> en {recordAction.record?.gameName} quedará en cero, pero conservará los puntos obtenidos.</>}</p><div><button className="secondary-button" onClick={() => setRecordAction(null)}>Cancelar</button><button className={recordAction.mode === "delete" ? "danger-button" : "primary-button"} onClick={async () => { if (await onManageRecord(recordAction.record?.id || "", recordAction.mode)) setRecordAction(null); }}>{recordAction.mode === "delete" ? "Eliminar resultado" : recordAction.mode === "resetAll" ? "Restablecer todos" : "Reiniciar a cero"}</button></div></div></div>}
    {recoveryCode && <div className="admin-confirm-backdrop" role="dialog" aria-modal="true"><div className="admin-confirm recovery-code-card"><span><UiIcon name="key" /></span><h3>Código de respaldo</h3><p>Entrégalo únicamente a <b>{recoveryCode.person.name}</b>. Caduca en 24 horas y funciona una sola vez.</p><code>{recoveryCode.code}</code><div><button className="primary-button" onClick={() => setRecoveryCode(null)}>Entendido</button></div></div></div>}
  </div>;
}

function BadgeFormFields({ value }: { value?: BadgeDefinition }) {
  return <>
    <label>Nombre de la insignia<input name="title" defaultValue={value?.title} maxLength={80} placeholder="Ej. Guardián ambiental" required /></label>
    <label>Descripción<textarea name="description" defaultValue={value?.description} maxLength={240} placeholder="Explica cómo se obtiene..." required /></label>
    <fieldset className="badge-icon-picker"><legend>Icono</legend>{badgeIconOptions.map((option) => <label key={option.id}><input type="radio" name="icon" value={option.id} defaultChecked={(value?.icon || "star") === option.id} /><span><BadgeIcon icon={option.id} /></span><small>{option.label}</small></label>)}</fieldset>
    <div className="badge-color-fields"><label>Color principal<input type="color" name="primaryColor" defaultValue={value?.primaryColor || badgePalette[0]} /></label><label>Color secundario<input type="color" name="secondaryColor" defaultValue={value?.secondaryColor || badgePalette[1]} /></label></div>
    <div className="badge-palette" aria-label="Paleta sugerida">{badgePalette.map((color) => <i key={color} style={{ background: color }} title={color} />)}</div>
    <label>Condición para desbloquear<select name="criterion" defaultValue={value?.criterion || "MISSIONS"}><option value="MISSIONS">Cantidad de misiones</option><option value="POINTS">Puntos acumulados</option><option value="BONUS">Minijuegos completados</option><option value="STATIONS">Estaciones visitadas</option><option value="STATION">Completar una estación específica</option><option value="ALL_MISSIONS">Completar todo el pasaporte</option></select></label>
    <div className="field-row"><label>Meta<input name="goal" type="number" min="1" max="100000" defaultValue={value?.goal || 1} required /></label><label>Orden<input name="order" type="number" min="1" max="999" defaultValue={value?.order || 100} required /></label></div>
    <label>Estación asociada <small className="field-help">Solo se usa con “estación específica”.</small><select name="station" defaultValue={value?.station || stations[0].name}>{stations.map((station) => <option key={station.name}>{station.name}</option>)}</select></label>
  </>;
}

function badgeCriterionLabel(badge: BadgeDefinition) {
  if (badge.criterion === "POINTS") return "Puntos acumulados";
  if (badge.criterion === "BONUS") return "Retos bonus";
  if (badge.criterion === "STATIONS") return "Estaciones visitadas";
  if (badge.criterion === "STATION") return badge.station || "Estación específica";
  if (badge.criterion === "ALL_MISSIONS") return "Pasaporte completo";
  return "Misiones completadas";
}

function bonusRecordColor(gameId: BonusGameId) {
  const colors: Partial<Record<BonusGameId, string>> = { "word-search": "#9d5cff", sudoku: "#12cfe0", target: "#ff5c9b", "forest-run": "#35a66f", "station-pairs": "#f2a800", "wellbeing-flight": "#3c9ee8" };
  return colors[gameId] || "#7253dc";
}
