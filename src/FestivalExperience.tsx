import { useEffect, useMemo, useRef, useState } from "react";

export type FestivalMission = {
  id: number;
  station: string;
  color: string;
  title: string;
  points: number;
};

export type FestivalBadge = {
  id: string;
  title: string;
  description: string;
  color: string;
  secondaryColor: string;
  icon: string;
  unlocked: boolean;
  progress: number;
  goal: number;
};

export type BadgeDefinition = {
  id: string;
  title: string;
  description: string;
  icon: string;
  primaryColor: string;
  secondaryColor: string;
  criterion: "MISSIONS" | "POINTS" | "BONUS" | "STATIONS" | "STATION" | "ALL_MISSIONS";
  goal: number;
  station?: string;
  order?: number;
};

type BadgeInput = {
  missions: FestivalMission[];
  completed: number[];
  points: number;
  bonusCompleted: string[];
  definitions?: BadgeDefinition[];
};

const defaultBadgeDefinitions: BadgeDefinition[] = [
  { id: "first-stamp", title: "Primer sello", description: "Completaste tu primera misión.", icon: "star", primaryColor: "#9d5cff", secondaryColor: "#d7c7ff", criterion: "MISSIONS", goal: 1 },
  { id: "route-keeper", title: "Guardián de la ruta", description: "Visitaste tres estaciones diferentes.", icon: "shield", primaryColor: "#12cfe0", secondaryColor: "#a5f4f7", criterion: "STATIONS", goal: 3 },
  { id: "bonus-explorer", title: "Explorador bonus", description: "Superaste tu primer minijuego.", icon: "rocket", primaryColor: "#ffb703", secondaryColor: "#ffe39b", criterion: "BONUS", goal: 1 },
  { id: "bright-mind", title: "Mente brillante", description: "Completaste los tres retos bonus.", icon: "sparkle", primaryColor: "#ff5c9b", secondaryColor: "#ffc2d9", criterion: "BONUS", goal: 3 },
  { id: "point-collector", title: "Coleccionista", description: "Alcanzaste 500 puntos en tu recorrido.", icon: "medal", primaryColor: "#43d17d", secondaryColor: "#baf3cf", criterion: "POINTS", goal: 500 },
  { id: "festival-ambassador", title: "Embajador del Festival", description: "Sellaste todas las misiones de tu pasaporte.", icon: "trophy", primaryColor: "#7253dc", secondaryColor: "#cfc2ff", criterion: "ALL_MISSIONS", goal: 1 },
];

export function buildBadges({ missions, completed, points, bonusCompleted, definitions }: BadgeInput): FestivalBadge[] {
  const completedMissions = missions.filter((mission) => completed.includes(mission.id));
  const completedStations = new Set(completedMissions.map((mission) => mission.station)).size;
  const allMissionsDone = missions.length > 0 && completedMissions.length >= missions.length;
  return (definitions?.length ? definitions : defaultBadgeDefinitions).map((definition) => {
    let current = completedMissions.length;
    let goal = Math.max(1, definition.goal || 1);
    if (definition.criterion === "POINTS") current = points;
    else if (definition.criterion === "BONUS") current = bonusCompleted.length;
    else if (definition.criterion === "STATIONS") current = completedStations;
    else if (definition.criterion === "STATION") current = completedMissions.some((mission) => mission.station === definition.station) ? 1 : 0;
    else if (definition.criterion === "ALL_MISSIONS") { current = allMissionsDone ? 1 : 0; goal = 1; }
    return { id: definition.id, title: definition.title, description: definition.description, icon: definition.icon || "star", color: definition.primaryColor, secondaryColor: definition.secondaryColor || definition.primaryColor, unlocked: current >= goal, progress: Math.min(current, goal), goal };
  });
}

export function FestivalRoute({ missions, completed, started, avatar, travelerName, onExplore }: {
  missions: FestivalMission[];
  completed: number[];
  started: number[];
  avatar: string;
  travelerName: string;
  onExplore: (station?: string) => void;
}) {
  const stops = useMemo(() => {
    const grouped = new Map<string, FestivalMission[]>();
    missions.forEach((mission) => grouped.set(mission.station, [...(grouped.get(mission.station) || []), mission]));
    const worlds = [
      ["Estación Diversidad", "#9d5cff"], ["Estación Felicidad", "#ffb703"],
      ["Estación Salud", "#43d17d"], ["Estación Amor Propio", "#ff5c9b"],
      ["Estación Seguridad", "#12cfe0"], ["Estación Ambiental", "#8bd33f"],
    ];
    return worlds.map(([station, color]) => {
      const items = grouped.get(station) || [];
      return { station, color: items[0]?.color || color, complete: items.length > 0 && items.every((mission) => completed.includes(mission.id)),
      current: items.some((mission) => started.includes(mission.id)),
      completedCount: items.filter((mission) => completed.includes(mission.id)).length,
      total: items.length,
      };
    });
  }, [completed, missions, started]);
  const positions = [[12, 67], [27, 27], [43, 62], [59, 22], [76, 59], [90, 27]];
  const mobilePositions = [[21, 18], [73, 29], [25, 43], [72, 56], [25, 70], [72, 83]];
  const finishedStops = stops.filter((stop) => stop.complete).length;
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [travelling, setTravelling] = useState(false);
  const [shipPosition, setShipPosition] = useState({ x: 50, y: 84, mx: 50, my: 92 });
  const travelTimer = useRef<number | null>(null);
  const avatarColors = parseAvatarColors(avatar);

  useEffect(() => () => {
    if (travelTimer.current) window.clearTimeout(travelTimer.current);
  }, []);

  function travelTo(index: number) {
    if (travelling) return;
    const stop = stops[index];
    const desktop = positions[index] || [50, 50];
    const mobile = mobilePositions[index] || [50, 50];
    setSelectedIndex(index);
    setTravelling(true);
    window.requestAnimationFrame(() => setShipPosition({ x: desktop[0], y: desktop[1] - 9, mx: mobile[0], my: mobile[1] - 6 }));
    const travelDuration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 220 : 1850;
    travelTimer.current = window.setTimeout(() => onExplore(stop.station), travelDuration);
  }

  return <section className="living-route living-route-3d" aria-label="Ruta viva 3D del Festival">
    <div className="living-route-heading">
      <div><p className="step-label">RUTA VIVA · MUNDO 3D</p><h3>Viaja a tu próxima estación</h3><p>Selecciona un mundo. Tu nave te llevará hasta sus misiones.</p></div>
      <button onClick={() => onExplore()}>Ver todas las misiones <span>→</span></button>
    </div>
    <div className={`festival-map festival-map-3d ${travelling ? "is-travelling" : ""}`}>
      <div className="space-nebula" aria-hidden="true"><i /><i /><i /></div>
      <div className="map-sky" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></div>
      <div className="world-horizon" aria-hidden="true"><i /><i /><i /></div>
      {stops.slice(0, 6).map((stop, index) => {
        const position = positions[index];
        const shortName = stop.station.replace("Estación ", "");
        return <button
          type="button"
          className={`world-stop world-island world-kind-${worldKind(stop.station)} ${stop.complete ? "is-complete" : ""} ${stop.current ? "is-current" : ""} ${selectedIndex === index ? "is-selected" : ""}`}
          style={{ "--world": stop.color, "--mobile-left": `${mobilePositions[index][0]}%`, "--mobile-top": `${mobilePositions[index][1]}%`, left: `${position[0]}%`, top: `${position[1]}%` } as React.CSSProperties}
          key={stop.station}
          onClick={() => travelTo(index)}
          disabled={travelling}
          aria-label={`Viajar a ${stop.station}. ${stop.completedCount} de ${stop.total} misiones completadas`}
        >
          <span className="island-scene" aria-hidden="true">
            <i className="island-shadow" />
            <i className="island-rock" />
            <i className="island-top" />
            <i className="world-landmark"><b>{worldGlyph(stop.station)}</b></i>
            <i className="world-prop prop-one" /><i className="world-prop prop-two" />
            {stop.complete && <i className="world-check">✓</i>}
          </span>
          <span className="world-copy"><b>{shortName}</b><small>{stop.total ? `${stop.completedCount}/${stop.total} misiones` : "Próximamente"}</small><i>{selectedIndex === index ? "Preparando viaje…" : "Viajar aquí"}</i></span>
        </button>;
      })}
      {!!stops.length && <div className={`festival-spacecraft ${travelling ? "launching" : "docked"}`} style={{ "--ship-x": `${shipPosition.x}%`, "--ship-y": `${shipPosition.y}%`, "--ship-mx": `${shipPosition.mx}%`, "--ship-my": `${shipPosition.my}%`, "--skin": avatarColors.skin, "--hair": avatarColors.hair, "--shirt": avatarColors.shirt } as React.CSSProperties} title={`${travelerName} viaja en la nave`}>
        <i className="ship-energy" /><span className="ship-wing wing-left" /><span className="ship-wing wing-right" />
        <span className="ship-body"><i className="ship-window"><b className="pilot-hair" /><b className="pilot-face" /></i><i className="ship-light" /></span>
        <strong>{travelling ? "Viajando…" : "Tu nave"}</strong>
      </div>}
      <div className="mission-control" aria-live="polite"><span>✦</span><div><b>{travelling && selectedIndex !== null ? `Destino: ${stops[selectedIndex].station}` : "Centro de navegación"}</b><small>{travelling ? "Llegando a la estación…" : `${finishedStops}/${stops.length} mundos completados · Toca una estación para despegar`}</small></div></div>
    </div>
  </section>;
}

function worldGlyph(station: string) {
  if (station.includes("Felicidad")) return "☀";
  if (station.includes("Salud")) return "+";
  if (station.includes("Amor Propio")) return "♥";
  if (station.includes("Seguridad")) return "◆";
  if (station.includes("Ambiental")) return "♧";
  return "✦";
}

function worldKind(station: string) {
  if (station.includes("Felicidad")) return 1;
  if (station.includes("Seguridad")) return 2;
  if (station.includes("Salud")) return 3;
  if (station.includes("Amor Propio")) return 4;
  if (station.includes("Ambiental")) return 5;
  return 0;
}

export function BadgeCollection({ badges, onExplore }: { badges: FestivalBadge[]; onExplore: () => void }) {
  const unlocked = badges.filter((badge) => badge.unlocked).length;
  return <div className="page-content badge-page">
    <section className="badge-hero">
      <div><p className="step-label">COLECCIÓN DE INSIGNIAS</p><h2>Reconocimientos de tu aventura</h2><p>Cada insignia celebra una forma diferente de cuidar, aprender y participar.</p></div>
      <div className="badge-counter"><span>✦</span><b>{unlocked}/{badges.length}</b><small>desbloqueadas</small></div>
    </section>
    <div className="badge-showcase">{badges.map((badge, index) => <article className={`festival-badge ${badge.unlocked ? "unlocked" : "locked"}`} style={{ "--badge": badge.color, "--badge-secondary": badge.secondaryColor, "--delay": `${index * .07}s` } as React.CSSProperties} key={badge.id}>
      <div className="badge-medal"><span><BadgeIcon icon={badge.icon} /></span><i /></div>
      <small>{badge.unlocked ? "DESBLOQUEADA" : "POR DESCUBRIR"}</small><h3>{badge.title}</h3><p>{badge.description}</p>
      <div className="badge-progress"><span><i style={{ width: `${Math.min(100, Math.round((badge.progress / badge.goal) * 100))}%` }} /></span><b>{badge.progress}/{badge.goal}</b></div>
    </article>)}</div>
    {unlocked < badges.length && <div className="badge-callout"><span>?</span><div><b>Tu próxima insignia te está esperando</b><p>Continúa la ruta y completa retos bonus para descubrir toda la colección.</p></div><button onClick={onExplore}>Continuar mi ruta →</button></div>}
  </div>;
}

export function FinalPassportCard({ name, uad, cedula, avatar, points, missions, completed, badges, onNotice }: {
  name: string;
  uad: string;
  cedula: string;
  avatar: string;
  points: number;
  missions: FestivalMission[];
  completed: number[];
  badges: FestivalBadge[];
  onNotice: (message: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const unlocked = badges.filter((badge) => badge.unlocked);
  const avatarColors = parseAvatarColors(avatar);

  async function downloadCard() {
    if (creating) return;
    setCreating(true);
    try {
      await document.fonts?.ready;
      const canvas = document.createElement("canvas");
      canvas.width = 1240; canvas.height = 1754;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Tu navegador no permite generar la tarjeta.");
      drawCardBackground(ctx, canvas.width, canvas.height);
      await drawCardLogos(ctx);
      ctx.textAlign = "center";
      ctx.fillStyle = "#6b51bd"; ctx.font = "700 25px Arial"; ctx.fillText("PASAPORTE SEGURO · FESTIVAL 2026", 620, 205);
      ctx.fillStyle = "#15294c"; ctx.font = "900 76px Arial"; ctx.fillText("¡RUTA COMPLETADA!", 620, 300);
      ctx.fillStyle = "#66758d"; ctx.font = "400 25px Arial"; ctx.fillText("Una aventura de autocuidado, diversidad y bienestar.", 620, 354);
      drawAvatarMedallion(ctx, avatar, 420, 555, 160);
      drawCardSeal(ctx, 820, 555);
      ctx.fillStyle = "#6d7890"; ctx.font = "700 21px Arial"; ctx.fillText("CERTIFICADO PARA", 620, 755);
      ctx.fillStyle = "#172b4d"; ctx.font = "900 55px Arial"; fitText(ctx, name.toUpperCase(), 620, 825, 980);
      ctx.fillStyle = "#087f8c"; ctx.font = "600 26px Arial"; fitText(ctx, `${uad} · PASAPORTE Nº ${cedula.slice(-6).padStart(6, "0")}`, 620, 875, 1020);
      const completedMissions = missions.filter((mission) => completed.includes(mission.id));
      drawCardStats(ctx, points, completedMissions.length, unlocked.length);
      drawCardStamps(ctx, completedMissions);
      ctx.fillStyle = "#66758d"; ctx.font = "500 21px Arial"; ctx.fillText("Juntos hacemos del trabajo un lugar más seguro, saludable y feliz.", 620, 1545);
      ctx.fillStyle = "#087f8c"; ctx.font = "700 19px Arial"; ctx.fillText("DE MÍ · PARA MÍ  ·  MUNDO DEL AUTOCUIDADO", 620, 1600);
      const blob = await canvasToPdfBlob(canvas);
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `pasaporte-seguro-${safeFileName(name)}.pdf`;
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      onNotice("Certificado PDF descargado. ¡Tu logro está listo para compartir!");
    } catch (error) { onNotice(error instanceof Error ? error.message : "No fue posible descargar el certificado."); }
    finally { setCreating(false); }
  }

  return <section className="download-card-panel">
    <div className="card-miniature creative-certificate"><div className="card-mini-stars">✦　·　✦</div><small>PASAPORTE SEGURO</small><div className="certificate-avatar"><span className="certificate-avatar-face" style={{ "--mini-skin": avatarColors.skin, "--mini-hair": avatarColors.hair, "--mini-shirt": avatarColors.shirt } as React.CSSProperties}><em /><b /><small /></span><i>✓</i></div><b>{name}</b><i>{points} PUNTOS · {unlocked.length} INSIGNIAS</i></div>
    <div><p className="step-label">RECUERDO DEL FESTIVAL</p><h3>Descarga tu certificado</h3><p>Obtén un PDF limpio, listo para imprimir o compartir. Se genera en este dispositivo y no hace nuevas consultas al servidor.</p><button className="primary-button" onClick={downloadCard} disabled={creating}>{creating ? "Creando PDF..." : "Descargar certificado PDF ↓"}</button></div>
  </section>;
}

function BadgeIcon({ icon }: { icon: string }) {
  if (icon === "shield") return <svg viewBox="0 0 24 24"><path d="M12 3 20 6v5.5c0 4.7-3.2 7.7-8 9.5-4.8-1.8-8-4.8-8-9.5V6l8-3Z" /><path d="m8.5 12 2.2 2.2 4.8-4.8" /></svg>;
  if (icon === "rocket") return <svg viewBox="0 0 24 24"><path d="M14 4c3-1 5-1 6-1 0 1 0 3-1 6l-6 6-4-4 5-7Z" /><path d="m9 11-4 1-2 4 5 1M13 15l-1 4-4 2-1-5M10 14l-3 3" /><circle cx="15.5" cy="7.5" r="1.5" /></svg>;
  if (icon === "sparkle") return <svg viewBox="0 0 24 24"><path d="m12 2 1.5 5.2L18 9l-4.5 1.8L12 16l-1.5-5.2L6 9l4.5-1.8L12 2Z" /><path d="m19 15 .7 2.3 2.3.7-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 15Z" /></svg>;
  if (icon === "medal") return <svg viewBox="0 0 24 24"><path d="m7 3 5 7 5-7M12 10a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z" /><path d="m12 12 1 2 2 .3-1.5 1.4.4 2-1.9-1-1.9 1 .4-2L9 14.3l2-.3 1-2Z" /></svg>;
  if (icon === "leaf") return <svg viewBox="0 0 24 24"><path d="M20 4C12 4 6 7 5 15c4 1 8 0 11-4" /><path d="M4 21c2-6 6-10 12-13M20 4c0 8-4 13-11 13" /></svg>;
  if (icon === "heart") return <svg viewBox="0 0 24 24"><path d="M20.5 9c0 5-8.5 10-8.5 10S3.5 14 3.5 9A4.7 4.7 0 0 1 12 6.3 4.7 4.7 0 0 1 20.5 9Z" /></svg>;
  if (icon === "planet") return <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" /><path d="M3 15c2 2 7 1 12-1s8-5 6-7M5 8c3-1 8 0 12 3s5 6 3 8" /></svg>;
  if (icon === "hand") return <svg viewBox="0 0 24 24"><path d="M6 12V7a1.5 1.5 0 0 1 3 0v4-6a1.5 1.5 0 0 1 3 0v6-5a1.5 1.5 0 0 1 3 0v5-3a1.5 1.5 0 0 1 3 0v7c0 4-2.5 6-6 6-3 0-5-1.5-7-5l-2-3a1.7 1.7 0 0 1 2.8-1.9L8 14" /></svg>;
  if (icon === "trophy") return <svg viewBox="0 0 24 24"><path d="M8 4h8v5a4 4 0 0 1-8 0V4ZM12 13v5M8 21h8M9 18h6" /><path d="M8 6H4v2c0 2 1.4 3 4 3M16 6h4v2c0 2-1.4 3-4 3" /></svg>;
  return <svg viewBox="0 0 24 24"><path d="m12 3 2.3 4.7 5.2.8-3.8 3.7.9 5.2-4.6-2.5-4.6 2.5.9-5.2-3.8-3.7 5.2-.8L12 3Z" /></svg>;
}

function parseAvatarColors(value: string) {
  const config = parseAvatarConfig(value);
  const skins = ["#f8d5c2", "#efbd9f", "#d89572", "#a96848", "#70402f", "#3f251f"];
  const hairs = ["#241914", "#5b3426", "#b66d2e", "#e0b34f", "#7c355d", "#284d78", "#d8d4ce"];
  const shirts = ["#7d4de8", "#08aabb", "#ef4d86", "#f39b17", "#3da868", "#264d87", "#df4949", "#ffffff"];
  return { skin: skins[config.skin] || skins[2], hair: hairs[config.hair] || hairs[0], shirt: shirts[config.shirt] || shirts[0] };
}

function parseAvatarConfig(value: string) {
  const isV2 = value.startsWith("avatar:v2:");
  const normalized = isV2 ? value.replace("avatar:v2:", "") : value.replace("avatar:v1:", "");
  const parts = normalized.split(":");
  const accessories = isV2
    ? (parts[4] || "").split(",").filter(Boolean).map((item) => item.split("-").map(Number) as [number, number])
    : Number(parts[4]) ? [[Number(parts[4]), Number(parts[5]) || 0] as [number, number]] : [];
  return { skin: Number(parts[0]) || 0, hair: Number(parts[1]) || 0, style: Number(parts[2]) || 0, shirt: Number(parts[3]) || 0, accessories };
}

function drawCardBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#ffffff"); gradient.addColorStop(.5, "#f7fbff"); gradient.addColorStop(1, "#f5f0ff");
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
  const glowA = ctx.createRadialGradient(120, 130, 0, 120, 130, 430); glowA.addColorStop(0, "rgba(157,92,255,.2)"); glowA.addColorStop(1, "rgba(157,92,255,0)"); ctx.fillStyle = glowA; ctx.fillRect(0, 0, width, height);
  const glowB = ctx.createRadialGradient(1120, 720, 0, 1120, 720, 500); glowB.addColorStop(0, "rgba(18,207,224,.18)"); glowB.addColorStop(1, "rgba(18,207,224,0)"); ctx.fillStyle = glowB; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(18,207,224,.08)"; ctx.beginPath(); ctx.arc(1140, 90, 180, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(255,92,155,.07)"; ctx.beginPath(); ctx.arc(90, 1660, 230, 0, Math.PI * 2); ctx.fill();
  roundRect(ctx, 82, 390, 1076, 365, 45); ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.fill(); ctx.strokeStyle = "rgba(50,73,114,.1)"; ctx.lineWidth = 2; ctx.stroke();
  roundRect(ctx, 45, 45, width - 90, height - 90, 38); ctx.strokeStyle = "#12b8c8"; ctx.lineWidth = 4; ctx.stroke();
  roundRect(ctx, 65, 65, width - 130, height - 130, 30); ctx.strokeStyle = "rgba(107,81,189,.16)"; ctx.lineWidth = 2; ctx.stroke();
}

async function drawCardLogos(ctx: CanvasRenderingContext2D) {
  const [jer, program] = await Promise.all([loadImage("./assets/jer-logo.webp"), loadImage("./assets/de-mi-para-mi.webp")]);
  if (jer) drawContainedImage(ctx, removeLightBackground(jer), 86, 72, 170, 92);
  if (program) drawContainedImage(ctx, removeLightBackground(program), 872, 72, 240, 88);
}

function drawCardSeal(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const gradient = ctx.createRadialGradient(x - 35, y - 50, 15, x, y, 150);
  gradient.addColorStop(0, "#ffd85a"); gradient.addColorStop(.5, "#9d5cff"); gradient.addColorStop(1, "#4a2a9e");
  ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(x, y, 138, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 7; ctx.setLineDash([10, 10]); ctx.beginPath(); ctx.arc(x, y, 115, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = "#ffffff"; ctx.textAlign = "center"; ctx.font = "900 92px Arial"; ctx.fillText("✓", x, y + 12);
  ctx.font = "800 24px Arial"; ctx.fillText("PASAPORTE COMPLETO", x, y + 69);
}

function drawAvatarMedallion(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, radius: number) {
  const colors = parseAvatarColors(value);
  const config = parseAvatarConfig(value);
  ctx.save();
  const aura = ctx.createRadialGradient(x - 40, y - 55, 20, x, y, radius + 42); aura.addColorStop(0, "rgba(255,255,255,.95)"); aura.addColorStop(.18, "rgba(93,226,232,.78)"); aura.addColorStop(.55, "rgba(157,92,255,.45)"); aura.addColorStop(1, "rgba(157,92,255,0)"); ctx.fillStyle = aura; ctx.beginPath(); ctx.arc(x, y, radius + 42, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.clip();
  const sky = ctx.createLinearGradient(x - radius, y - radius, x + radius, y + radius); sky.addColorStop(0, "#e9fbff"); sky.addColorStop(1, "#a8b8ff"); ctx.fillStyle = sky; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  ctx.fillStyle = colors.shirt; ctx.beginPath(); ctx.ellipse(x, y + 138, 122, 104, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = colors.skin; roundRect(ctx, x - 26, y + 50, 52, 70, 18); ctx.fill();
  ctx.fillStyle = colors.hair;
  if ([2, 5].includes(config.style)) { ctx.beginPath(); ctx.ellipse(x, y + 5, 100, 132, 0, 0, Math.PI * 2); ctx.fill(); }
  else { ctx.beginPath(); ctx.ellipse(x, y - 22, 88, config.style === 1 ? 116 : 101, 0, 0, Math.PI * 2); ctx.fill(); }
  if (config.style === 4) { ctx.beginPath(); ctx.arc(x + 50, y - 103, 38, 0, Math.PI * 2); ctx.fill(); }
  if (config.style === 3) for (let index = 0; index < 9; index += 1) { const angle = Math.PI + index * Math.PI / 8; ctx.beginPath(); ctx.arc(x + Math.cos(angle) * 75, y - 16 + Math.sin(angle) * 84, 28, 0, Math.PI * 2); ctx.fill(); }
  if (config.style === 6) { for (const side of [-1, 1]) for (let index = 0; index < 5; index += 1) { ctx.beginPath(); ctx.arc(x + side * 78, y + 12 + index * 27, 18, 0, Math.PI * 2); ctx.fill(); } }
  const face = ctx.createRadialGradient(x - 35, y - 45, 12, x, y, 105); face.addColorStop(0, "#fff0e7"); face.addColorStop(.45, colors.skin); face.addColorStop(1, shadeColor(colors.skin, -24)); ctx.fillStyle = face; ctx.beginPath(); ctx.ellipse(x, y, 70, 91, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = colors.skin; ctx.beginPath(); ctx.arc(x - 70, y, 13, 0, Math.PI * 2); ctx.arc(x + 70, y, 13, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = colors.hair; ctx.beginPath(); ctx.ellipse(x - 8, y - 72, 72, config.style === 0 ? 34 : 42, -.08, Math.PI, Math.PI * 2); ctx.fill();
  if (config.style === 5) { ctx.strokeStyle = shadeColor(colors.hair, 24); ctx.lineWidth = 5; for (let index = 0; index < 3; index += 1) { ctx.beginPath(); ctx.arc(x - 10 + index * 12, y - 76, 52 - index * 6, Math.PI * 1.08, Math.PI * 1.85); ctx.stroke(); } }
  ctx.strokeStyle = shadeColor(colors.hair, -25); ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(x - 42, y - 27); ctx.lineTo(x - 18, y - 31); ctx.moveTo(x + 18, y - 31); ctx.lineTo(x + 42, y - 27); ctx.stroke();
  ctx.fillStyle = "#263044"; ctx.beginPath(); ctx.arc(x - 25, y - 8, 5, 0, Math.PI * 2); ctx.arc(x + 25, y - 8, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(231,101,119,.18)"; ctx.beginPath(); ctx.ellipse(x - 48, y + 20, 13, 7, 0, 0, Math.PI * 2); ctx.ellipse(x + 48, y + 20, 13, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(91,56,46,.28)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y - 2); ctx.quadraticCurveTo(x - 5, y + 12, x + 3, y + 13); ctx.stroke();
  ctx.strokeStyle = "#a64d55"; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, y + 22, 24, .25, Math.PI - .25); ctx.stroke();
  drawAvatarAccessories(ctx, value, x, y);
  ctx.restore(); ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = "#5de2e8"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, radius + 13, 0, Math.PI * 2); ctx.stroke();
}

function drawAvatarAccessories(ctx: CanvasRenderingContext2D, value: string, x: number, y: number) {
  const palette = ["#172440", "#9d5cff", "#12cfe0", "#ff5c9b", "#ffb703", "#43d17d", "#ffffff", "#e95454"];
  parseAvatarConfig(value).accessories.forEach(([id, colorIndex]) => {
    const color = palette[colorIndex] || palette[0]; ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 6;
    if (id === 1 || id === 2) { ctx.beginPath(); if (id === 1) { roundRect(ctx, x - 56, y - 29, 50, 42, 10); ctx.stroke(); roundRect(ctx, x + 6, y - 29, 50, 42, 10); ctx.stroke(); } else { ctx.arc(x - 31, y - 8, 25, 0, Math.PI * 2); ctx.arc(x + 31, y - 8, 25, 0, Math.PI * 2); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(x - 6, y - 8); ctx.lineTo(x + 6, y - 8); ctx.stroke(); }
    if (id === 3) { ctx.beginPath(); ctx.arc(x, y - 62, 75, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke(); }
    if (id === 4) { ctx.beginPath(); ctx.ellipse(x + 64, y - 73, 22, 12, .6, 0, Math.PI * 2); ctx.ellipse(x + 90, y - 80, 22, 12, -.6, 0, Math.PI * 2); ctx.fill(); }
    if (id === 5) { ctx.beginPath(); ctx.arc(x - 72, y + 25, 8, 0, Math.PI * 2); ctx.arc(x + 72, y + 25, 8, 0, Math.PI * 2); ctx.fill(); }
    if (id === 6) { for (let i = 0; i < 6; i += 1) { const a = i * Math.PI / 3; ctx.beginPath(); ctx.arc(x + 74 + Math.cos(a) * 15, y - 70 + Math.sin(a) * 15, 11, 0, Math.PI * 2); ctx.fill(); } }
    if (id === 7) { roundRect(ctx, x - 82, y - 99, 164, 55, 28); ctx.fill(); ctx.beginPath(); ctx.ellipse(x + 62, y - 48, 62, 14, .08, 0, Math.PI * 2); ctx.fill(); }
  });
}

function drawCardStats(ctx: CanvasRenderingContext2D, points: number, missions: number, badges: number) {
  const stats = [["PUNTOS", points], ["SELLOS", missions], ["INSIGNIAS", badges]] as const;
  stats.forEach(([label, value], index) => {
    const x = 240 + index * 360;
    roundRect(ctx, x - 140, 930, 280, 135, 24); ctx.fillStyle = "rgba(255,255,255,.86)"; ctx.fill(); ctx.strokeStyle = "rgba(39,64,104,.1)"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = index === 0 ? "#d28c00" : index === 1 ? "#078c99" : "#db3c7a"; ctx.font = "900 44px Arial"; ctx.fillText(String(value), x, 993);
    ctx.fillStyle = "#66758d"; ctx.font = "700 19px Arial"; ctx.fillText(label, x, 1032);
  });
}

function drawCardStamps(ctx: CanvasRenderingContext2D, missions: FestivalMission[]) {
  const unique = Array.from(new Map(missions.map((mission) => [mission.station, mission])).values()).slice(0, 6);
  const gap = 160; const start = 600 - ((unique.length - 1) * gap) / 2;
  unique.forEach((mission, index) => {
    const x = start + index * gap; const y = 1210;
    ctx.fillStyle = mission.color; ctx.beginPath(); ctx.arc(x, y, 55, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 43, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#ffffff"; ctx.font = "900 34px Arial"; ctx.fillText("✓", x, y + 12);
    ctx.fillStyle = "#52627a"; ctx.font = "600 16px Arial"; fitText(ctx, mission.station.replace("Estación ", ""), x, y + 88, 145);
  });
}

function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) { ctx.fillText(text, x, y); return; }
  let size = Number(ctx.font.match(/\d+/)?.[0] || 30);
  while (size > 16 && ctx.measureText(text).width > maxWidth) { size -= 2; ctx.font = ctx.font.replace(/\d+px/, `${size}px`); }
  ctx.fillText(text, x, y);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath(); ctx.roundRect(x, y, width, height, radius);
}

function drawContainedImage(ctx: CanvasRenderingContext2D, image: HTMLImageElement | HTMLCanvasElement, x: number, y: number, width: number, height: number) {
  const sourceWidth = image instanceof HTMLImageElement ? image.naturalWidth || image.width : image.width;
  const sourceHeight = image instanceof HTMLImageElement ? image.naturalHeight || image.height : image.height;
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale; const drawHeight = sourceHeight * scale;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function removeLightBackground(image: HTMLImageElement) {
  const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth || image.width; canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const width = canvas.width, height = canvas.height, visited = new Uint8Array(width * height), queue: number[] = [];
  const isBackground = (position: number) => { const offset = position * 4; const r = pixels.data[offset], g = pixels.data[offset + 1], b = pixels.data[offset + 2]; return Math.min(r, g, b) > 232 && Math.max(r, g, b) - Math.min(r, g, b) < 25; };
  const add = (position: number) => { if (!visited[position] && isBackground(position)) { visited[position] = 1; queue.push(position); } };
  for (let x = 0; x < width; x += 1) { add(x); add((height - 1) * width + x); }
  for (let y = 0; y < height; y += 1) { add(y * width); add(y * width + width - 1); }
  for (let cursor = 0; cursor < queue.length; cursor += 1) { const position = queue[cursor], x = position % width, y = Math.floor(position / width); if (x) add(position - 1); if (x + 1 < width) add(position + 1); if (y) add(position - width); if (y + 1 < height) add(position + width); pixels.data[position * 4 + 3] = 0; }
  ctx.putImageData(pixels, 0, 0); return canvas;
}

function shadeColor(hex: string, amount: number) {
  const value = parseInt(hex.replace("#", ""), 16); const clamp = (channel: number) => Math.max(0, Math.min(255, channel + amount));
  return `rgb(${clamp(value >> 16)},${clamp((value >> 8) & 255)},${clamp(value & 255)})`;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image(); image.onload = () => resolve(image); image.onerror = () => resolve(null); image.src = src;
  });
}

async function canvasToPdfBlob(canvas: HTMLCanvasElement) {
  const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", .9));
  if (!jpeg) throw new Error("No fue posible preparar el certificado.");
  const image = new Uint8Array(await jpeg.arrayBuffer());
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [0];
  let length = 0;
  const push = (value: string | Uint8Array) => { const bytes = typeof value === "string" ? encoder.encode(value) : value; parts.push(bytes); length += bytes.length; };
  const beginObject = (id: number) => { offsets[id] = length; push(`${id} 0 obj\n`); };
  push("%PDF-1.4\n");
  beginObject(1); push("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  beginObject(2); push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  beginObject(3); push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n");
  beginObject(4); push(`<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`); push(image); push("\nendstream\nendobj\n");
  const drawing = "q\n595.28 0 0 841.89 0 0 cm\n/Im0 Do\nQ\n";
  beginObject(5); push(`<< /Length ${encoder.encode(drawing).length} >>\nstream\n${drawing}endstream\nendobj\n`);
  const xref = length;
  push("xref\n0 6\n0000000000 65535 f \n");
  for (let id = 1; id <= 5; id += 1) push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  const output = new Uint8Array(length);
  let cursor = 0;
  parts.forEach((part) => { output.set(part, cursor); cursor += part.length; });
  return new Blob([output.buffer], { type: "application/pdf" });
}

function safeFileName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "participante";
}
