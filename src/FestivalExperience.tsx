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
  unlocked: boolean;
  progress: number;
  goal: number;
};

type BadgeInput = {
  missions: FestivalMission[];
  completed: number[];
  points: number;
  bonusCompleted: string[];
};

export function buildBadges({ missions, completed, points, bonusCompleted }: BadgeInput): FestivalBadge[] {
  const completedMissions = missions.filter((mission) => completed.includes(mission.id));
  const completedStations = new Set(completedMissions.map((mission) => mission.station)).size;
  const allMissionsDone = missions.length > 0 && completedMissions.length >= missions.length;

  return [
    { id: "first-stamp", title: "Primer sello", description: "Completaste tu primera misión.", color: "#9d5cff", unlocked: completedMissions.length >= 1, progress: Math.min(completedMissions.length, 1), goal: 1 },
    { id: "route-keeper", title: "Guardián de la ruta", description: "Visitaste tres estaciones diferentes.", color: "#12cfe0", unlocked: completedStations >= 3, progress: Math.min(completedStations, 3), goal: 3 },
    { id: "bonus-explorer", title: "Explorador bonus", description: "Superaste tu primer minijuego.", color: "#ffb703", unlocked: bonusCompleted.length >= 1, progress: Math.min(bonusCompleted.length, 1), goal: 1 },
    { id: "bright-mind", title: "Mente brillante", description: "Completaste los tres retos bonus.", color: "#ff5c9b", unlocked: bonusCompleted.length >= 3, progress: Math.min(bonusCompleted.length, 3), goal: 3 },
    { id: "point-collector", title: "Coleccionista", description: "Alcanzaste 500 puntos en tu recorrido.", color: "#43d17d", unlocked: points >= 500, progress: Math.min(points, 500), goal: 500 },
    { id: "festival-ambassador", title: "Embajador del Festival", description: "Sellaste todas las misiones de tu pasaporte.", color: "#7253dc", unlocked: allMissionsDone, progress: Math.min(completedMissions.length, missions.length || 1), goal: missions.length || 1 },
  ];
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
    return Array.from(grouped.entries()).map(([station, items]) => ({
      station,
      color: items[0].color,
      complete: items.every((mission) => completed.includes(mission.id)),
      current: items.some((mission) => started.includes(mission.id)),
      completedCount: items.filter((mission) => completed.includes(mission.id)).length,
      total: items.length,
    }));
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
          className={`world-stop world-island world-kind-${index} ${stop.complete ? "is-complete" : ""} ${stop.current ? "is-current" : ""} ${selectedIndex === index ? "is-selected" : ""}`}
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
            <i className="world-landmark"><b>{worldGlyph(index)}</b></i>
            <i className="world-prop prop-one" /><i className="world-prop prop-two" />
            {stop.complete && <i className="world-check">✓</i>}
          </span>
          <span className="world-copy"><b>{shortName}</b><small>{stop.completedCount}/{stop.total} misiones</small><i>{selectedIndex === index ? "Preparando viaje…" : "Viajar aquí"}</i></span>
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

function worldGlyph(index: number) {
  return ["✦", "☀", "◆", "+", "♥", "♧"][index] || "✦";
}

export function BadgeCollection({ badges, onExplore }: { badges: FestivalBadge[]; onExplore: () => void }) {
  const unlocked = badges.filter((badge) => badge.unlocked).length;
  return <div className="page-content badge-page">
    <section className="badge-hero">
      <div><p className="step-label">COLECCIÓN DE INSIGNIAS</p><h2>Reconocimientos de tu aventura</h2><p>Cada insignia celebra una forma diferente de cuidar, aprender y participar.</p></div>
      <div className="badge-counter"><span>✦</span><b>{unlocked}/{badges.length}</b><small>desbloqueadas</small></div>
    </section>
    <div className="badge-showcase">{badges.map((badge, index) => <article className={`festival-badge ${badge.unlocked ? "unlocked" : "locked"}`} style={{ "--badge": badge.color, "--delay": `${index * .07}s` } as React.CSSProperties} key={badge.id}>
      <div className="badge-medal"><span><BadgeIcon id={badge.id} /></span><i /></div>
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
      canvas.width = 1200; canvas.height = 1500;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Tu navegador no permite generar la tarjeta.");
      drawCardBackground(ctx, canvas.width, canvas.height);
      await drawCardLogos(ctx);
      ctx.textAlign = "center";
      ctx.fillStyle = "#7fe9ef"; ctx.font = "700 25px Arial"; ctx.fillText("PASAPORTE SEGURO · FESTIVAL 2026", 600, 190);
      ctx.fillStyle = "#ffffff"; ctx.font = "900 78px Arial"; ctx.fillText("¡RUTA COMPLETADA!", 600, 285);
      ctx.fillStyle = "#b9cae8"; ctx.font = "400 25px Arial"; ctx.fillText("Una aventura de cuidado, diversidad y bienestar.", 600, 340);
      drawAvatarMedallion(ctx, avatar, 410, 530, 155);
      drawCardSeal(ctx, 790, 530);
      ctx.fillStyle = "#8fa7cc"; ctx.font = "700 21px Arial"; ctx.fillText("CERTIFICADO PARA", 600, 720);
      ctx.fillStyle = "#ffffff"; ctx.font = "900 55px Arial"; fitText(ctx, name.toUpperCase(), 600, 785, 940);
      ctx.fillStyle = "#8fe5e9"; ctx.font = "600 26px Arial"; fitText(ctx, `${uad} · PASAPORTE Nº ${cedula.slice(-6).padStart(6, "0")}`, 600, 835, 980);
      const completedMissions = missions.filter((mission) => completed.includes(mission.id));
      drawCardStats(ctx, points, completedMissions.length, unlocked.length);
      drawCardStamps(ctx, completedMissions);
      ctx.fillStyle = "#91a5c7"; ctx.font = "500 21px Arial"; ctx.fillText("Juntos hacemos del trabajo un lugar más seguro, saludable y feliz.", 600, 1370);
      ctx.fillStyle = "#5de2e8"; ctx.font = "700 19px Arial"; ctx.fillText("DE MÍ · PARA MÍ  ·  EDICIÓN GALÁCTICA", 600, 1422);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", .95));
      if (!blob) throw new Error("No fue posible crear la imagen.");
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `pasaporte-seguro-${safeFileName(name)}.png`;
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      onNotice("Tarjeta descargada. ¡Tu logro está listo para compartir!");
    } catch (error) { onNotice(error instanceof Error ? error.message : "No fue posible descargar la tarjeta."); }
    finally { setCreating(false); }
  }

  return <section className="download-card-panel">
    <div className="card-miniature creative-certificate"><div className="card-mini-stars">✦　·　✦</div><small>PASAPORTE SEGURO</small><div className="certificate-avatar"><span className="certificate-avatar-face" style={{ "--mini-skin": avatarColors.skin, "--mini-hair": avatarColors.hair, "--mini-shirt": avatarColors.shirt } as React.CSSProperties}><em /><b /><small /></span><i>✓</i></div><b>{name}</b><i>{points} PUNTOS · {unlocked.length} INSIGNIAS</i></div>
    <div><p className="step-label">RECUERDO DEL FESTIVAL</p><h3>Descarga tu tarjeta final</h3><p>Guárdala como imagen o compártela con tu equipo. Se genera en este dispositivo y no hace nuevas consultas al servidor.</p><button className="primary-button" onClick={downloadCard} disabled={creating}>{creating ? "Creando tarjeta..." : "Descargar tarjeta PNG ↓"}</button></div>
  </section>;
}

function BadgeIcon({ id }: { id: string }) {
  if (id === "first-stamp") return <svg viewBox="0 0 24 24"><path d="m12 3 2.3 4.7 5.2.8-3.8 3.7.9 5.2-4.6-2.5-4.6 2.5.9-5.2-3.8-3.7 5.2-.8L12 3Z" /></svg>;
  if (id === "route-keeper") return <svg viewBox="0 0 24 24"><path d="M5 19c3-8 7-12 14-14M5 19l3-1M5 19l1-3" /><circle cx="7" cy="8" r="2" /><circle cx="17" cy="15" r="2" /></svg>;
  if (id === "bonus-explorer") return <svg viewBox="0 0 24 24"><path d="M5 9h14l-1 11H6L5 9ZM8 9V7a4 4 0 0 1 8 0v2" /><path d="m12 12 .8 1.8 2 .2-1.5 1.4.4 2-1.7-1-1.7 1 .4-2-1.5-1.4 2-.2.8-1.8Z" /></svg>;
  if (id === "bright-mind") return <svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M8.5 15.5C6.9 14.4 6 12.6 6 10.5a6 6 0 1 1 12 0c0 2.1-.9 3.9-2.5 5" /><path d="M9 10h6M12 7v6" /></svg>;
  if (id === "point-collector") return <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" /><path d="M14.5 8.8c-.6-.5-1.4-.8-2.5-.8-1.4 0-2.5.7-2.5 1.8 0 2.7 5.2 1 5.2 3.8 0 1.3-1.1 2.2-2.7 2.2-1.1 0-2.1-.4-2.8-1M12 6v12" /></svg>;
  return <svg viewBox="0 0 24 24"><path d="M8 4h8v5a4 4 0 0 1-8 0V4ZM12 13v5M8 21h8M9 18h6" /><path d="M8 6H4v2c0 2 1.4 3 4 3M16 6h4v2c0 2-1.4 3-4 3" /></svg>;
}

function parseAvatarColors(value: string) {
  const normalized = value.startsWith("avatar:v2:") ? value.replace("avatar:v2:", "") : value.replace("avatar:v1:", "");
  const parts = normalized.split(":").slice(0, 4).map(Number);
  const skins = ["#f8d5c2", "#efbd9f", "#d89572", "#a96848", "#70402f", "#3f251f"];
  const hairs = ["#241914", "#5b3426", "#b66d2e", "#e0b34f", "#7c355d", "#284d78", "#d8d4ce"];
  const shirts = ["#7d4de8", "#08aabb", "#ef4d86", "#f39b17", "#3da868", "#264d87", "#df4949", "#ffffff"];
  return { skin: skins[parts[0]] || skins[2], hair: hairs[parts[1]] || hairs[0], shirt: shirts[parts[3]] || shirts[0] };
}

function drawCardBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#06142d"); gradient.addColorStop(.48, "#102d61"); gradient.addColorStop(1, "#07152f");
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
  const glowA = ctx.createRadialGradient(190, 170, 0, 190, 170, 430); glowA.addColorStop(0, "rgba(157,92,255,.48)"); glowA.addColorStop(1, "rgba(157,92,255,0)"); ctx.fillStyle = glowA; ctx.fillRect(0, 0, width, height);
  const glowB = ctx.createRadialGradient(1040, 760, 0, 1040, 760, 500); glowB.addColorStop(0, "rgba(18,207,224,.3)"); glowB.addColorStop(1, "rgba(18,207,224,0)"); ctx.fillStyle = glowB; ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(93,226,232,.22)"; ctx.lineWidth = 2;
  for (let x = -300; x < width + 300; x += 70) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 500, height); ctx.stroke(); }
  for (let i = 0; i < 85; i += 1) { const x = (i * 137) % width; const y = (i * i * 29 + 71) % height; const radius = i % 7 === 0 ? 3 : 1.5; ctx.fillStyle = i % 5 === 0 ? "rgba(255,216,90,.9)" : "rgba(255,255,255,.62)"; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill(); }
  roundRect(ctx, 82, 375, 1036, 360, 45); ctx.fillStyle = "rgba(3,13,38,.38)"; ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,.14)"; ctx.lineWidth = 2; ctx.stroke();
  roundRect(ctx, 45, 45, width - 90, height - 90, 38); ctx.strokeStyle = "#5de2e8"; ctx.lineWidth = 4; ctx.stroke();
  roundRect(ctx, 65, 65, width - 130, height - 130, 30); ctx.strokeStyle = "rgba(255,255,255,.18)"; ctx.lineWidth = 2; ctx.stroke();
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
  ctx.save();
  const aura = ctx.createRadialGradient(x - 40, y - 55, 20, x, y, radius + 42); aura.addColorStop(0, "rgba(255,255,255,.95)"); aura.addColorStop(.18, "rgba(93,226,232,.78)"); aura.addColorStop(.55, "rgba(157,92,255,.45)"); aura.addColorStop(1, "rgba(157,92,255,0)"); ctx.fillStyle = aura; ctx.beginPath(); ctx.arc(x, y, radius + 42, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.clip();
  const sky = ctx.createLinearGradient(x - radius, y - radius, x + radius, y + radius); sky.addColorStop(0, "#e9fbff"); sky.addColorStop(1, "#a8b8ff"); ctx.fillStyle = sky; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  ctx.fillStyle = colors.shirt; ctx.beginPath(); ctx.ellipse(x, y + 138, 122, 104, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = colors.skin; roundRect(ctx, x - 26, y + 50, 52, 70, 18); ctx.fill();
  ctx.fillStyle = colors.hair; ctx.beginPath(); ctx.ellipse(x, y - 20, 87, 110, 0, 0, Math.PI * 2); ctx.fill();
  const face = ctx.createRadialGradient(x - 35, y - 45, 12, x, y, 105); face.addColorStop(0, "#fff0e7"); face.addColorStop(.45, colors.skin); face.addColorStop(1, shadeColor(colors.skin, -24)); ctx.fillStyle = face; ctx.beginPath(); ctx.ellipse(x, y, 70, 91, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = colors.hair; ctx.beginPath(); ctx.ellipse(x - 8, y - 72, 70, 39, -.08, Math.PI, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#263044"; ctx.beginPath(); ctx.arc(x - 25, y - 8, 5, 0, Math.PI * 2); ctx.arc(x + 25, y - 8, 5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#a64d55"; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, y + 22, 24, .25, Math.PI - .25); ctx.stroke();
  drawAvatarAccessories(ctx, value, x, y);
  ctx.restore(); ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = "#5de2e8"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, radius + 13, 0, Math.PI * 2); ctx.stroke();
}

function drawAvatarAccessories(ctx: CanvasRenderingContext2D, value: string, x: number, y: number) {
  const encoded = value.startsWith("avatar:v2:") ? value.split(":")[6] || "" : `${value.split(":")[6] || 0}-0`;
  const palette = ["#172440", "#9d5cff", "#12cfe0", "#ff5c9b", "#ffb703", "#43d17d", "#ffffff", "#e95454"];
  encoded.split(",").filter(Boolean).forEach((item) => {
    const [id, colorIndex] = item.split("-").map(Number); const color = palette[colorIndex] || palette[0]; ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 6;
    if (id === 1 || id === 2) { ctx.beginPath(); ctx.arc(x - 27, y - 5, 25, 0, Math.PI * 2); ctx.arc(x + 27, y - 5, 25, 0, Math.PI * 2); ctx.moveTo(x - 2, y - 5); ctx.lineTo(x + 2, y - 5); ctx.stroke(); }
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
    roundRect(ctx, x - 140, 885, 280, 135, 24); ctx.fillStyle = "rgba(255,255,255,.08)"; ctx.fill();
    ctx.fillStyle = index === 0 ? "#ffd447" : index === 1 ? "#5de2e8" : "#ff75ae"; ctx.font = "900 44px Arial"; ctx.fillText(String(value), x, 948);
    ctx.fillStyle = "#a9bad6"; ctx.font = "700 19px Arial"; ctx.fillText(label, x, 987);
  });
}

function drawCardStamps(ctx: CanvasRenderingContext2D, missions: FestivalMission[]) {
  const unique = Array.from(new Map(missions.map((mission) => [mission.station, mission])).values()).slice(0, 6);
  const gap = 160; const start = 600 - ((unique.length - 1) * gap) / 2;
  unique.forEach((mission, index) => {
    const x = start + index * gap; const y = 1135;
    ctx.fillStyle = mission.color; ctx.beginPath(); ctx.arc(x, y, 55, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 43, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#ffffff"; ctx.font = "900 34px Arial"; ctx.fillText("✓", x, y + 12);
    ctx.fillStyle = "#c7d6ed"; ctx.font = "600 16px Arial"; fitText(ctx, mission.station.replace("Estación ", ""), x, y + 88, 145);
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

function safeFileName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "participante";
}
