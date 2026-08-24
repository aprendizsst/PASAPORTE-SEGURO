import { useEffect, useRef, useState } from "react";

export type BonusGameId = "word-search" | "sudoku" | "target" | "forest-run" | "station-pairs" | "wellbeing-flight";
export type BonusLeaderboardEntry = { gameId: BonusGameId; name: string; uad: string; record: number; completedAt: string; isCurrent?: boolean };

type Props = {
  completed: string[];
  scores: Record<string, number>;
  records: Record<string, number>;
  leaderboard: BonusLeaderboardEntry[];
  leaderboardLoading: boolean;
  busy: string;
  onRefreshLeaderboard: () => Promise<void>;
  onComplete: (gameId: BonusGameId, score: number, record?: number) => Promise<void>;
};

const games: { id: BonusGameId; title: string; subtitle: string; points: number; color: string }[] = [
  { id: "word-search", title: "Ruta de palabras", subtitle: "Una sopa diferente en cada partida", points: 80, color: "#9d5cff" },
  { id: "sudoku", title: "Sudoku seguro", subtitle: "Completa el tablero profesional 9 × 9", points: 120, color: "#12cfe0" },
  { id: "target", title: "Tiro al riesgo", subtitle: "Controla dos ejes y apunta con precisión", points: 200, color: "#ff5c9b" },
  { id: "forest-run", title: "Carrera del bosque", subtitle: "Salta árboles y supera la distancia récord", points: 300, color: "#35a66f" },
  { id: "station-pairs", title: "Parejas del festival", subtitle: "Conecta las seis estaciones del pasaporte", points: 250, color: "#f2a800" },
  { id: "wellbeing-flight", title: "Vuelo del bienestar", subtitle: "Vuela entre ecoportales y mensajes positivos", points: 300, color: "#3c9ee8" },
];

export default function MiniGamesPage({ completed, scores, records, leaderboard, leaderboardLoading, busy, onRefreshLeaderboard, onComplete }: Props) {
  const [selected, setSelected] = useState<BonusGameId | null>(null);
  const current = games.find((game) => game.id === selected);

  return <div className="page-content bonus-page">
    <div className="bonus-hero">
      <div><p className="step-label">ZONA BONUS</p><h2>Juega, aprende y suma puntos</h2><p>Retos más completos que se ejecutan en tu dispositivo. Solo enviamos el resultado cuando terminas.</p></div>
      <div className="bonus-score"><span>★</span><b>{completed.length}/{games.length}</b><small>juegos superados</small></div>
    </div>

    <div className="bonus-grid">{games.map((game, index) => {
      const done = completed.includes(game.id);
      return <button className={`bonus-card ${done ? "done" : ""}`} style={{ "--game": game.color, "--delay": `${index * .08}s` } as React.CSSProperties} key={game.id} onClick={() => setSelected(game.id)}>
        <span className="bonus-card-icon"><GameIcon name={game.id} /></span><span className="bonus-card-copy"><small>{done ? "COMPLETADO" : "MINIJUEGO"}</small><b>{game.title}</b><i>{game.subtitle}</i></span><span className="bonus-points">{done ? `✓ ${scores[game.id] || game.points}` : game.id === "target" ? "hasta 200" : `+${game.points}`}<small>pts</small></span>
      </button>;
    })}</div>

    <BonusLeaderboard entries={leaderboard} loading={leaderboardLoading} onRefresh={onRefreshLeaderboard} />

    {current && <div className="game-backdrop" role="dialog" aria-modal="true" aria-label={current.title}><div className="game-modal" style={{ "--game": current.color } as React.CSSProperties}>
      <button className="game-close" onClick={() => setSelected(null)} aria-label="Cerrar minijuego">×</button>
      <div className="game-modal-heading"><span><GameIcon name={current.id} /></span><div><small>ZONA BONUS · {current.id === "target" ? "HASTA " : ""}{current.points} PUNTOS</small><h3>{current.title}</h3></div></div>
      {current.id === "word-search" && <WordSearchGame completed={completed.includes(current.id)} busy={busy === `bonus-${current.id}`} onComplete={() => onComplete(current.id, current.points)} />}
      {current.id === "sudoku" && <SudokuGame completed={completed.includes(current.id)} busy={busy === `bonus-${current.id}`} onComplete={() => onComplete(current.id, current.points)} />}
      {current.id === "target" && <TargetGame completed={completed.includes(current.id)} busy={busy === `bonus-${current.id}`} onComplete={(score, record) => onComplete(current.id, score, record)} />}
      {current.id === "forest-run" && <ForestRunGame bestRecord={records[current.id] || 0} busy={busy === `bonus-${current.id}`} onComplete={(score, record) => onComplete(current.id, score, record)} />}
      {current.id === "station-pairs" && <StationPairsGame bestRecord={records[current.id] || 0} busy={busy === `bonus-${current.id}`} onComplete={(score, record) => onComplete(current.id, score, record)} />}
      {current.id === "wellbeing-flight" && <WellbeingFlightGame bestRecord={records[current.id] || 0} busy={busy === `bonus-${current.id}`} onComplete={(score, record) => onComplete(current.id, score, record)} />}
    </div></div>}
  </div>;
}

function GameIcon({ name }: { name: BonusGameId }) {
  if (name === "word-search") return <svg viewBox="0 0 24 24"><path d="M4 5h16v14H4zM8 9h.01M12 9h.01M16 9h.01M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01" /></svg>;
  if (name === "sudoku") return <svg viewBox="0 0 24 24"><path d="M4 4h16v16H4zM12 4v16M4 12h16M8 4v16M16 4v16M4 8h16M4 16h16" /></svg>;
  if (name === "forest-run") return <svg viewBox="0 0 24 24"><path d="M3 19h18M5 16l3-5 3 5M7 11V7l2 2 2-4 3 6M15 17v-5l-2-2 3-5 4 7-2 2v3" /></svg>;
  if (name === "station-pairs") return <svg viewBox="0 0 24 24"><rect x="3" y="5" width="7" height="8" rx="1.5" /><rect x="14" y="11" width="7" height="8" rx="1.5" /><path d="m5.5 9 1.3 1.3L9 7.8m7.5 7.2 1.3 1.3 2.2-2.5" /></svg>;
  if (name === "wellbeing-flight") return <svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" /><path d="M5 8 2 6m17 2 3-2" /></svg>;
  return <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /><path d="m17 7 4-4M17 3h4v4" /></svg>;
}

const WORD_BANK = ["SEGURO", "SALUD", "CUIDADO", "PAUSA", "RESPETO", "AMOR", "CALMA", "VIDA", "EQUIPO", "RIESGO", "APOYO", "MENTE", "ACTIVO", "AMBIENTE", "DIVERSIDAD", "BIENESTAR"];
const WORD_DIRECTIONS: [number, number][] = [[0, 1], [1, 0], [1, 1], [1, -1]];

function shuffled<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function createWordPuzzle() {
  const size = 10;
  const grid = Array.from({ length: size }, () => Array<string>(size).fill(""));
  const words: string[] = [];
  for (const original of shuffled(WORD_BANK).slice(0, 8)) {
    let placed = false;
    for (let attempt = 0; attempt < 180 && !placed; attempt += 1) {
      const word = Math.random() > .5 ? original : original.split("").reverse().join("");
      const [dr, dc] = WORD_DIRECTIONS[Math.floor(Math.random() * WORD_DIRECTIONS.length)];
      const row = Math.floor(Math.random() * size);
      const column = Math.floor(Math.random() * size);
      const lastRow = row + dr * (word.length - 1);
      const lastColumn = column + dc * (word.length - 1);
      if (lastRow < 0 || lastRow >= size || lastColumn < 0 || lastColumn >= size) continue;
      const cells = Array.from({ length: word.length }, (_, index) => [row + dr * index, column + dc * index] as [number, number]);
      if (cells.some(([r, c], index) => grid[r][c] && grid[r][c] !== word[index])) continue;
      cells.forEach(([r, c], index) => { grid[r][c] = word[index]; });
      words.push(original);
      placed = true;
    }
    if (words.length === 6) break;
  }
  const alphabet = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ";
  grid.forEach((row) => row.forEach((letter, column) => { if (!letter) row[column] = alphabet[Math.floor(Math.random() * alphabet.length)]; }));
  return { grid, words };
}

function WordSearchGame({ completed, busy, onComplete }: { completed: boolean; busy: boolean; onComplete: () => Promise<void> }) {
  const [puzzle, setPuzzle] = useState(createWordPuzzle);
  const [start, setStart] = useState<[number, number] | null>(null);
  const [found, setFound] = useState<string[]>([]);
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("Toca la primera y la última letra de una palabra.");

  function newPuzzle() {
    setPuzzle(createWordPuzzle()); setStart(null); setFound([]); setMarked(new Set());
    setMessage("Nueva sopa preparada. Toca la primera y la última letra.");
  }
  function choose(row: number, column: number) {
    if (found.length === puzzle.words.length) return;
    if (!start) { setStart([row, column]); setMessage("Ahora toca la última letra."); return; }
    const cells = cellsBetween(start, [row, column]);
    setStart(null);
    if (!cells.length) { setMessage("La palabra debe estar en línea recta."); return; }
    const word = cells.map(([r, c]) => puzzle.grid[r][c]).join("");
    const match = puzzle.words.find((item) => (item === word || item === word.split("").reverse().join("")) && !found.includes(item));
    if (!match) { setMessage("Esa combinación no está en la lista. Intenta otra vez."); return; }
    const next = [...found, match];
    setFound(next);
    setMarked((current) => new Set([...current, ...cells.map(([r, c]) => `${r}-${c}`)]));
    setMessage(next.length === puzzle.words.length ? "¡Encontraste todas las palabras!" : `¡${match} encontrada! Sigue así.`);
  }

  return <div className="game-body word-game"><div className="game-tools"><span>{found.length}/{puzzle.words.length} encontradas</span><button type="button" onClick={newPuzzle}>↻ Nueva sopa</button></div><div className="word-list">{puzzle.words.map((word) => <span className={found.includes(word) ? "found" : ""} key={word}>{found.includes(word) ? "✓" : "○"} {word}</span>)}</div><div className="word-grid">{puzzle.grid.map((row, r) => row.map((letter, c) => <button type="button" className={`${marked.has(`${r}-${c}`) ? "marked" : ""} ${start?.[0] === r && start?.[1] === c ? "selected" : ""}`} key={`${r}-${c}`} onClick={() => choose(r, c)}>{letter}</button>))}</div><p className="game-message">{message}</p>{found.length === puzzle.words.length && <button className="game-complete-button" disabled={completed || busy} onClick={onComplete}>{busy ? "Guardando..." : completed ? "Bonus ya guardado ✓" : "Reclamar 80 puntos"}</button>}</div>;
}

function cellsBetween(start: [number, number], end: [number, number]) {
  const rowStep = Math.sign(end[0] - start[0]);
  const columnStep = Math.sign(end[1] - start[1]);
  const rowDistance = Math.abs(end[0] - start[0]);
  const columnDistance = Math.abs(end[1] - start[1]);
  if (!(rowDistance === 0 || columnDistance === 0 || rowDistance === columnDistance)) return [] as [number, number][];
  const length = Math.max(rowDistance, columnDistance) + 1;
  return Array.from({ length }, (_, index) => [start[0] + rowStep * index, start[1] + columnStep * index] as [number, number]);
}

type SudokuPuzzle = { puzzle: number[][]; solution: number[][] };
const SUDOKU_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function sudokuCandidates(grid: number[][], row: number, column: number) {
  const used = new Set<number>(grid[row]);
  grid.forEach((line) => used.add(line[column]));
  const startRow = Math.floor(row / 3) * 3;
  const startColumn = Math.floor(column / 3) * 3;
  for (let r = startRow; r < startRow + 3; r += 1) for (let c = startColumn; c < startColumn + 3; c += 1) used.add(grid[r][c]);
  return SUDOKU_NUMBERS.filter((number) => !used.has(number));
}

function countSudokuSolutions(grid: number[][], limit = 2): number {
  let selected: [number, number] | null = null;
  let options: number[] = [];
  for (let row = 0; row < 9; row += 1) for (let column = 0; column < 9; column += 1) {
    if (grid[row][column]) continue;
    const candidates = sudokuCandidates(grid, row, column);
    if (!candidates.length) return 0;
    if (!selected || candidates.length < options.length) { selected = [row, column]; options = candidates; }
  }
  if (!selected) return 1;
  let count = 0;
  for (const number of options) {
    grid[selected[0]][selected[1]] = number;
    count += countSudokuSolutions(grid, limit - count);
    grid[selected[0]][selected[1]] = 0;
    if (count >= limit) break;
  }
  return count;
}

function createSudokuPuzzle(): SudokuPuzzle {
  const bands = shuffled([0, 1, 2]);
  const stacks = shuffled([0, 1, 2]);
  const rows = bands.flatMap((band) => shuffled([0, 1, 2]).map((row) => band * 3 + row));
  const columns = stacks.flatMap((stack) => shuffled([0, 1, 2]).map((column) => stack * 3 + column));
  const digits = shuffled(SUDOKU_NUMBERS);
  const solution = rows.map((row) => columns.map((column) => digits[(row * 3 + Math.floor(row / 3) + column) % 9]));
  const puzzle = solution.map((row) => [...row]);
  let removed = 0;
  for (const cell of shuffled(Array.from({ length: 81 }, (_, index) => index))) {
    if (removed >= 47) break;
    const row = Math.floor(cell / 9);
    const column = cell % 9;
    const previous = puzzle[row][column];
    puzzle[row][column] = 0;
    if (countSudokuSolutions(puzzle.map((line) => [...line])) === 1) removed += 1;
    else puzzle[row][column] = previous;
  }
  return { puzzle, solution };
}

function SudokuGame({ completed, busy, onComplete }: { completed: boolean; busy: boolean; onComplete: () => Promise<void> }) {
  const [game, setGame] = useState<SudokuPuzzle>(createSudokuPuzzle);
  const [values, setValues] = useState(() => game.puzzle.map((row) => [...row]));
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [mistakes, setMistakes] = useState<Set<string>>(new Set());
  const [solved, setSolved] = useState(false);
  const [message, setMessage] = useState("Completa filas, columnas y bloques 3 × 3 con números del 1 al 9.");
  const filled = values.flat().filter(Boolean).length;

  function newSudoku() {
    const next = createSudokuPuzzle();
    setGame(next); setValues(next.puzzle.map((row) => [...row])); setSelected(null); setMistakes(new Set()); setSolved(false);
    setMessage("Nuevo tablero preparado. Cada reto tiene una única solución.");
  }
  function enterNumber(number: number) {
    if (!selected || solved || game.puzzle[selected[0]][selected[1]]) return;
    const [row, column] = selected;
    setValues((current) => current.map((line, r) => line.map((cell, c) => r === row && c === column ? number : cell)));
    setMistakes((current) => { const next = new Set(current); next.delete(`${row}-${column}`); return next; });
  }
  function validate() {
    const nextMistakes = new Set<string>();
    values.forEach((row, r) => row.forEach((value, c) => { if (value && value !== game.solution[r][c]) nextMistakes.add(`${r}-${c}`); }));
    const correct = values.every((row, r) => row.every((value, c) => value === game.solution[r][c]));
    setMistakes(nextMistakes); setSolved(correct);
    setMessage(correct ? "¡Sudoku 9 × 9 resuelto sin riesgos!" : nextMistakes.size ? `${nextMistakes.size} casilla${nextMistakes.size === 1 ? " necesita" : "s necesitan"} revisión.` : "Aún faltan casillas por completar.");
  }

  return <div className="game-body sudoku-game"><div className="game-tools"><span>{filled}/81 casillas</span><button type="button" onClick={newSudoku}>↻ Nuevo sudoku</button></div><div className="sudoku-board" tabIndex={0} onKeyDown={(event) => { if (/^[1-9]$/.test(event.key)) enterNumber(Number(event.key)); else if (event.key === "Backspace" || event.key === "Delete") enterNumber(0); }}>{values.map((row, r) => row.map((value, c) => {
    const fixed = Boolean(game.puzzle[r][c]);
    const active = selected?.[0] === r && selected?.[1] === c;
    const related = selected ? selected[0] === r || selected[1] === c || (Math.floor(selected[0] / 3) === Math.floor(r / 3) && Math.floor(selected[1] / 3) === Math.floor(c / 3)) : false;
    return <button type="button" aria-label={`Fila ${r + 1}, columna ${c + 1}${value ? `: ${value}` : " vacía"}`} className={`${fixed ? "fixed" : "editable"} ${active ? "selected" : ""} ${related ? "related" : ""} ${mistakes.has(`${r}-${c}`) ? "mistake" : ""} ${(c + 1) % 3 === 0 && c < 8 ? "block-right" : ""} ${(r + 1) % 3 === 0 && r < 8 ? "block-bottom" : ""}`} key={`${r}-${c}`} onClick={() => { if (!fixed) setSelected([r, c]); }}>{value || ""}</button>;
  }))}</div><div className="sudoku-keypad" aria-label="Teclado de sudoku">{SUDOKU_NUMBERS.map((number) => <button type="button" key={number} onClick={() => enterNumber(number)}>{number}</button>)}<button type="button" className="erase" onClick={() => enterNumber(0)} aria-label="Borrar casilla">⌫</button></div><p className="game-message">{message}</p>{!solved ? <button className="game-check-button" onClick={validate}>Comprobar solución</button> : <button className="game-complete-button" disabled={completed || busy} onClick={onComplete}>{busy ? "Guardando..." : completed ? "Bonus ya guardado ✓" : "Reclamar 120 puntos"}</button>}</div>;
}

type AimPhase = "ready" | "horizontal" | "vertical" | "flight" | "finished";
type DartLanding = { x: number; y: number; score: number };
const TARGET_SECONDS = 35;
const TARGET_DARTS = 5;

function dartScore(x: number, y: number) {
  const distance = Math.hypot(x - 50, y - 50);
  if (distance <= 4.5) return 100;
  if (distance <= 11) return 80;
  if (distance <= 19) return 60;
  if (distance <= 28) return 40;
  if (distance <= 38) return 20;
  return 5;
}

function TargetGame({ completed, busy, onComplete }: { completed: boolean; busy: boolean; onComplete: (score: number, record: number) => Promise<void> }) {
  const [phase, setPhase] = useState<AimPhase>("ready");
  const [timeLeft, setTimeLeft] = useState(TARGET_SECONDS);
  const [xAim, setXAim] = useState(50);
  const [yAim, setYAim] = useState(50);
  const [landings, setLandings] = useState<DartLanding[]>([]);
  const [landing, setLanding] = useState<DartLanding | null>(null);
  const flightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const running = phase !== "ready" && phase !== "finished";
  const precision = landings.reduce((sum, dart) => sum + dart.score, 0);
  const passed = precision >= 180;
  const reward = Math.min(200, 100 + Math.round(precision / 5));

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setTimeLeft((current) => Math.max(0, current - 1)), 1000);
    return () => clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (phase !== "horizontal" && phase !== "vertical") return;
    const startedAt = Date.now() + Math.random() * 900;
    const timer = setInterval(() => {
      const position = 50 + 44 * Math.sin((Date.now() - startedAt) / (phase === "horizontal" ? 360 : 310));
      if (phase === "horizontal") setXAim(position); else setYAim(position);
    }, 24);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (timeLeft === 0 && running) {
      if (flightTimer.current) clearTimeout(flightTimer.current);
      if (landing) setLandings((current) => [...current, landing]);
      setLanding(null); setPhase("finished");
    }
  }, [landing, running, timeLeft]);

  useEffect(() => () => { if (flightTimer.current) clearTimeout(flightTimer.current); }, []);

  function start() {
    if (flightTimer.current) clearTimeout(flightTimer.current);
    setTimeLeft(TARGET_SECONDS); setXAim(50); setYAim(50); setLandings([]); setLanding(null); setPhase("horizontal");
  }
  function lockAim() {
    if (phase === "horizontal") { setPhase("vertical"); return; }
    if (phase !== "vertical") return;
    const shot = { x: xAim, y: yAim, score: dartScore(xAim, yAim) };
    setLanding(shot); setPhase("flight");
    flightTimer.current = setTimeout(() => {
      const next = [...landings, shot];
      setLandings(next); setLanding(null); setXAim(50); setYAim(50);
      setPhase(next.length >= TARGET_DARTS || timeLeft <= 0 ? "finished" : "horizontal");
    }, 650);
  }

  return <div className="game-body target-game"><div className="target-stats"><span><small>TIEMPO</small><b className={timeLeft <= 10 ? "urgent" : ""}>{timeLeft}s</b></span><span><small>DARDOS</small><b>{landings.length}/{TARGET_DARTS}</b></span><span><small>PRECISIÓN</small><b>{precision}</b></span></div><p className="target-instructions">Fija primero el movimiento horizontal y luego la altura. La intersección de ambos puntos define la trayectoria del dardo.</p><div className="aim-arena">
    <div className="target-board" aria-label="Diana de puntuación"><i className="target-ring ring-5">5</i><i className="target-ring ring-20">20</i><i className="target-ring ring-40">40</i><i className="target-ring ring-60">60</i><i className="target-ring ring-80">80</i><i className="target-ring ring-100">100</i>{landings.map((dart, index) => <span className="dart-mark" style={{ left: `${dart.x}%`, top: `${dart.y}%` }} key={index}>{index + 1}</span>)}{landing && <span className="dart-mark flying" style={{ left: `${landing.x}%`, top: `${landing.y}%` }}>➤</span>}</div>
    <div className={`aim-axis aim-axis-y ${phase === "vertical" ? "active" : ""}`}><small>ALTURA</small><div><i style={{ top: `${yAim}%` }} /></div></div>
    <div className={`aim-axis aim-axis-x ${phase === "horizontal" ? "active" : ""}`}><small>DIRECCIÓN</small><div><i style={{ left: `${xAim}%` }} /></div></div>
  </div>{phase === "ready" && <button className="game-complete-button target-action" onClick={start}>Iniciar reto · {TARGET_SECONDS} segundos</button>}{(phase === "horizontal" || phase === "vertical") && <button className="game-complete-button target-action pulse" onClick={lockAim}>{phase === "horizontal" ? "1. Fijar dirección horizontal" : "2. Fijar altura y lanzar"}</button>}{phase === "flight" && <div className="flight-message">Dardo en trayectoria…</div>}{phase === "finished" && <div className={`target-result ${passed ? "passed" : ""}`}><b>{passed ? "¡Gran puntería!" : "Puedes acercarte más al centro"}</b><p>Lograste {precision} puntos de precisión con {landings.length} dardo{landings.length === 1 ? "" : "s"}. {passed ? `Tu recompensa es de ${reward} puntos.` : "Necesitas al menos 180 puntos de precisión."}</p>{passed ? <button className="game-complete-button" disabled={busy} onClick={() => onComplete(reward, precision)}>{busy ? "Guardando..." : completed ? `Actualizar récord · ${precision}` : `Reclamar ${reward} puntos`}</button> : <button className="game-check-button" onClick={start}>Intentar nuevamente</button>}{completed && <button className="target-replay" onClick={start}>Jugar de nuevo</button>}</div>}</div>;
}

const RECORD_GAME_LABELS: { id: BonusGameId; label: string; unit: string }[] = [
  { id: "forest-run", label: "Bosque", unit: "m" },
  { id: "station-pairs", label: "Parejas", unit: "pts" },
  { id: "wellbeing-flight", label: "Vuelo", unit: "portales" },
  { id: "target", label: "Diana", unit: "precisión" },
];

function BonusLeaderboard({ entries, loading, onRefresh }: { entries: BonusLeaderboardEntry[]; loading: boolean; onRefresh: () => Promise<void> }) {
  const [gameId, setGameId] = useState<BonusGameId>("forest-run");
  const current = RECORD_GAME_LABELS.find((game) => game.id === gameId) || RECORD_GAME_LABELS[0];
  const ranking = entries.filter((entry) => entry.gameId === gameId).sort((a, b) => b.record - a.record).slice(0, 10);
  return <section className="bonus-leaderboard"><div className="leaderboard-heading"><div><small>HISTORIAL COLABORATIVO</small><h3>Salón de récords</h3><p>Los mejores resultados de todos los participantes.</p></div><button type="button" disabled={loading} onClick={onRefresh}>{loading ? "Actualizando…" : "↻ Actualizar"}</button></div><div className="leaderboard-tabs">{RECORD_GAME_LABELS.map((game) => <button type="button" className={game.id === gameId ? "active" : ""} key={game.id} onClick={() => setGameId(game.id)}>{game.label}</button>)}</div>{loading && !ranking.length ? <div className="leaderboard-empty">Preparando el ranking…</div> : ranking.length ? <div className="leaderboard-list">{ranking.map((entry, index) => <article className={entry.isCurrent ? "current" : ""} key={`${entry.gameId}-${entry.name}-${entry.completedAt}`}><span className={`rank-position rank-${index + 1}`}>{index + 1}</span><div><b>{entry.name}{entry.isCurrent ? " · Tú" : ""}</b><small>{entry.uad || "Colaborador"}</small></div><strong>{entry.record}<small>{current.unit}</small></strong></article>)}</div> : <div className="leaderboard-empty"><b>Aún no hay récords en {current.label}</b><span>¡Sé la primera persona en aparecer aquí!</span></div>}</section>;
}

type ArcadePhase = "ready" | "running" | "finished";

function ForestRunGame({ bestRecord, busy, onComplete }: { bestRecord: number; busy: boolean; onComplete: (score: number, record: number) => Promise<void> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const engineRef = useRef({ jump: 0, velocity: 0, distance: 0, trees: [] as { x: number; height: number; crown: number }[], nextTree: 420 });
  const [phase, setPhase] = useState<ArcadePhase>("ready");
  const [distance, setDistance] = useState(0);
  const reward = Math.min(300, 90 + Math.floor(distance / 4));

  function jump() {
    const engine = engineRef.current;
    if (phase === "running" && engine.jump <= 1) engine.velocity = .72;
  }
  function start() {
    engineRef.current = { jump: 0, velocity: 0, distance: 0, trees: [{ x: 650, height: 54, crown: 28 }], nextTree: 440 };
    setDistance(0); setPhase("running");
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if ((event.code === "Space" || event.code === "ArrowUp") && phase === "running") { event.preventDefault(); jump(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let previous = performance.now();
    let reportedDistance = Math.floor(engineRef.current.distance);
    const render = (now: number) => {
      const dt = Math.min(34, now - previous || 16); previous = now;
      const engine = engineRef.current;
      if (phase === "running") {
        engine.velocity -= .0025 * dt;
        engine.jump = Math.max(0, engine.jump + engine.velocity * dt);
        if (!engine.jump && engine.velocity < 0) engine.velocity = 0;
        const speed = Math.min(.62, .30 + engine.distance / 7000);
        engine.distance += speed * dt * .075;
        engine.trees.forEach((tree) => { tree.x -= speed * dt; });
        engine.trees = engine.trees.filter((tree) => tree.x > -80);
        engine.nextTree -= speed * dt;
        if (engine.nextTree <= 0) {
          engine.trees.push({ x: 760, height: 44 + Math.random() * 34, crown: 23 + Math.random() * 11 });
          engine.nextTree = 245 + Math.random() * 220 - Math.min(90, engine.distance / 8);
        }
        const runner = { left: 72, right: 108, top: 176 - 42 - engine.jump, bottom: 176 - engine.jump };
        const collision = engine.trees.some((tree) => runner.right > tree.x + 7 && runner.left < tree.x + 34 && runner.bottom > 176 - tree.height + 7 && runner.top < 176);
        const roundedDistance = Math.floor(engine.distance);
        if (roundedDistance !== reportedDistance) { reportedDistance = roundedDistance; setDistance(roundedDistance); }
        if (collision) { setDistance(roundedDistance); setPhase("finished"); }
      }
      drawForestRun(context, engineRef.current, phase);
      if (phase === "running") frameRef.current = requestAnimationFrame(render);
    };
    drawForestRun(context, engineRef.current, phase);
    if (phase === "running") frameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frameRef.current);
  }, [phase]);

  return <div className="game-body arcade-game forest-run-game"><div className="arcade-hud"><span><small>DISTANCIA</small><b>{distance} m</b></span><span><small>TU RÉCORD</small><b>{bestRecord} m</b></span><span><small>CONTROL</small><b>ESPACIO / TOQUE</b></span></div><div className="arcade-canvas-wrap" onPointerDown={jump}><canvas ref={canvasRef} width="760" height="210" aria-label="Carrera del bosque: salta sobre los árboles" />{phase === "ready" && <div className="arcade-overlay"><b>Carrera del bosque</b><p>Salta los árboles y llega tan lejos como puedas.</p><button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={start}>Comenzar carrera</button></div>}{phase === "finished" && <div className="arcade-overlay result"><b>{distance > bestRecord ? "¡Nuevo récord personal!" : "Fin del recorrido"}</b><p>Recorriste {distance} metros · recompensa de {reward} puntos.</p><div><button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={start}>Reintentar</button><button className="save-record" type="button" disabled={busy || distance < 1} onPointerDown={(event) => event.stopPropagation()} onClick={() => onComplete(reward, distance)}>{busy ? "Guardando…" : "Guardar récord"}</button></div></div>}</div><p className="arcade-tip">En computador usa espacio o ↑. En celular toca el área del juego para saltar.</p></div>;
}

function drawForestRun(context: CanvasRenderingContext2D, engine: { jump: number; distance: number; trees: { x: number; height: number; crown: number }[] }, phase: ArcadePhase) {
  const width = 760; const height = 210; const ground = 176;
  const sky = context.createLinearGradient(0, 0, 0, height); sky.addColorStop(0, "#dff7ff"); sky.addColorStop(1, "#f5fbdf"); context.fillStyle = sky; context.fillRect(0, 0, width, height);
  context.fillStyle = "rgba(255,255,255,.78)"; [[90, 38], [330, 62], [610, 35]].forEach(([x, y]) => { context.beginPath(); context.arc(x, y, 18, 0, Math.PI * 2); context.arc(x + 22, y + 3, 25, 0, Math.PI * 2); context.arc(x + 48, y, 16, 0, Math.PI * 2); context.fill(); });
  context.fillStyle = "#9bd36f"; context.beginPath(); context.moveTo(0, 150); for (let x = 0; x <= width; x += 80) context.quadraticCurveTo(x + 40, 112 + ((x / 80) % 2) * 14, x + 80, 150); context.lineTo(width, ground); context.lineTo(0, ground); context.fill();
  context.fillStyle = "#e9d8ae"; context.fillRect(0, ground, width, height - ground); context.fillStyle = "#b89d67"; for (let x = -(engine.distance * 5) % 42; x < width; x += 42) context.fillRect(x, ground + 17, 20, 2);
  engine.trees.forEach((tree) => { const top = ground - tree.height; context.fillStyle = "#7a4c2b"; context.fillRect(tree.x + 14, top + 18, 13, tree.height - 18); context.fillStyle = "#2f9d63"; context.beginPath(); context.arc(tree.x + 20, top + 10, tree.crown, 0, Math.PI * 2); context.arc(tree.x + 4, top + 20, tree.crown * .67, 0, Math.PI * 2); context.arc(tree.x + 38, top + 21, tree.crown * .7, 0, Math.PI * 2); context.fill(); context.fillStyle = "#66bf75"; context.beginPath(); context.arc(tree.x + 10, top + 4, tree.crown * .35, 0, Math.PI * 2); context.fill(); });
  const y = ground - 42 - engine.jump; context.save(); context.translate(72, y); context.fillStyle = phase === "finished" ? "#758394" : "#6750c8"; context.fillRect(2, 11, 31, 25); context.beginPath(); context.moveTo(25, 12); context.lineTo(39, 7); context.lineTo(38, 24); context.lineTo(28, 25); context.fill(); context.fillStyle = "#fff"; context.beginPath(); context.arc(33, 13, 2.6, 0, Math.PI * 2); context.fill(); context.strokeStyle = "#42327f"; context.lineWidth = 5; context.lineCap = "round"; context.beginPath(); context.moveTo(10, 35); context.lineTo(7, 43); context.moveTo(25, 35); context.lineTo(29, 43); context.stroke(); context.restore();
}

const PAIR_STATIONS = [
  { id: "diversidad", name: "Diversidad", icon: "◉", color: "#9d5cff" },
  { id: "felicidad", name: "Felicidad", icon: "♡", color: "#ffb703" },
  { id: "seguridad", name: "Seguridad", icon: "◇", color: "#12cfe0" },
  { id: "salud", name: "Salud", icon: "+", color: "#43d17d" },
  { id: "amor", name: "Amor propio", icon: "✦", color: "#ff5c9b" },
  { id: "ambiental", name: "Ambiental", icon: "♧", color: "#8bd33f" },
];

function createPairDeck() { return shuffled(PAIR_STATIONS.flatMap((station) => [0, 1].map((copy) => ({ ...station, key: `${station.id}-${copy}-${Math.random()}` })))); }

function StationPairsGame({ bestRecord, busy, onComplete }: { bestRecord: number; busy: boolean; onComplete: (score: number, record: number) => Promise<void> }) {
  const [deck, setDeck] = useState(createPairDeck);
  const [phase, setPhase] = useState<ArcadePhase>("ready");
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [locked, setLocked] = useState(false);
  const record = Math.max(80, 340 - moves * 9 - seconds * 2);
  const reward = Math.min(250, 80 + Math.round(record / 2));

  useEffect(() => {
    if (phase !== "running") return;
    const timer = setInterval(() => setSeconds((current) => current + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  function start() { setDeck(createPairDeck()); setOpen([]); setMatched([]); setMoves(0); setSeconds(0); setLocked(false); setPhase("running"); }
  function flip(index: number) {
    if (phase !== "running" || locked || open.includes(index) || matched.includes(deck[index].id)) return;
    if (!open.length) { setOpen([index]); return; }
    const first = open[0]; setOpen([first, index]); setMoves((current) => current + 1); setLocked(true);
    window.setTimeout(() => {
      if (deck[first].id === deck[index].id) {
        const next = [...matched, deck[index].id]; setMatched(next);
        if (next.length === PAIR_STATIONS.length) setPhase("finished");
      }
      setOpen([]); setLocked(false);
    }, deck[first].id === deck[index].id ? 430 : 760);
  }

  return <div className="game-body pairs-game"><div className="arcade-hud"><span><small>TIEMPO</small><b>{seconds}s</b></span><span><small>MOVIMIENTOS</small><b>{moves}</b></span><span><small>TU RÉCORD</small><b>{bestRecord} pts</b></span></div>{phase === "ready" ? <div className="pairs-intro"><span>✦</span><h4>Encuentra las seis estaciones</h4><p>Cada color, símbolo y nombre tiene su pareja. Memoriza su ubicación y completa el tablero con pocos movimientos.</p><button className="game-complete-button" onClick={start}>Comenzar juego</button></div> : <div className="pairs-board">{deck.map((card, index) => { const visible = open.includes(index) || matched.includes(card.id); return <button type="button" aria-label={visible ? card.name : "Carta oculta"} className={`${visible ? "revealed" : ""} ${matched.includes(card.id) ? "matched" : ""}`} style={{ "--pair-color": card.color } as React.CSSProperties} key={card.key} onClick={() => flip(index)}><span className="card-back">?</span><span className="card-face"><i>{card.icon}</i><b>{card.name}</b></span></button>; })}</div>}{phase === "finished" && <div className="pairs-result"><b>{record > bestRecord ? "¡Nuevo récord de memoria!" : "¡Todas las estaciones conectadas!"}</b><p>{moves} movimientos · {seconds} segundos · {record} puntos de desempeño.</p><div><button className="game-check-button" onClick={start}>Jugar otra vez</button><button className="game-complete-button" disabled={busy} onClick={() => onComplete(reward, record)}>{busy ? "Guardando…" : `Guardar récord · +${reward}`}</button></div></div>}</div>;
}

function WellbeingFlightGame({ bestRecord, busy, onComplete }: { bestRecord: number; busy: boolean; onComplete: (score: number, record: number) => Promise<void> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const engineRef = useRef({ y: 150, velocity: 0, gates: 0, obstacles: [] as { x: number; gapY: number; gap: number; passed: boolean; label: string }[] });
  const [phase, setPhase] = useState<ArcadePhase>("ready");
  const [gates, setGates] = useState(0);
  const reward = Math.min(300, 80 + gates * 15);

  function flap() { if (phase === "running") engineRef.current.velocity = -.48; }
  function start() {
    engineRef.current = { y: 150, velocity: 0, gates: 0, obstacles: [{ x: 680, gapY: 145, gap: 142, passed: false, label: "RESPIRA" }] };
    setGates(0); setPhase("running");
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.code === "Space" && phase === "running") { event.preventDefault(); flap(); } };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const context = canvas.getContext("2d"); if (!context) return;
    let previous = performance.now();
    const render = (now: number) => {
      const dt = Math.min(34, now - previous || 16); previous = now; const engine = engineRef.current;
      if (phase === "running") {
        engine.velocity += .00165 * dt; engine.y += engine.velocity * dt;
        const speed = Math.min(.43, .235 + engine.gates * .008);
        engine.obstacles.forEach((obstacle) => { obstacle.x -= speed * dt; });
        const last = engine.obstacles[engine.obstacles.length - 1];
        if (!last || last.x < 470) {
          const messages = ["RESPIRA", "RECICLA", "PAUSA", "CUÍDATE", "SONRÍE", "CONECTA"];
          const gap = Math.max(103, 148 - engine.gates * 2.2);
          engine.obstacles.push({ x: 780, gapY: 82 + Math.random() * 128, gap, passed: false, label: messages[Math.floor(Math.random() * messages.length)] });
        }
        engine.obstacles = engine.obstacles.filter((obstacle) => obstacle.x > -90);
        engine.obstacles.forEach((obstacle) => { if (!obstacle.passed && obstacle.x + 58 < 112) { obstacle.passed = true; engine.gates += 1; setGates(engine.gates); } });
        const collision = engine.y < 16 || engine.y > 294 || engine.obstacles.some((obstacle) => 126 > obstacle.x && 94 < obstacle.x + 58 && (engine.y - 15 < obstacle.gapY - obstacle.gap / 2 || engine.y + 15 > obstacle.gapY + obstacle.gap / 2));
        if (collision) setPhase("finished");
      }
      drawWellbeingFlight(context, engineRef.current);
      if (phase === "running") frameRef.current = requestAnimationFrame(render);
    };
    drawWellbeingFlight(context, engineRef.current);
    if (phase === "running") frameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frameRef.current);
  }, [phase]);

  return <div className="game-body arcade-game flight-game"><div className="arcade-hud"><span><small>ECOPORTALES</small><b>{gates}</b></span><span><small>TU RÉCORD</small><b>{bestRecord}</b></span><span><small>DIFICULTAD</small><b>{gates < 5 ? "SUAVE" : gates < 12 ? "ACTIVA" : "EXPERTA"}</b></span></div><div className="arcade-canvas-wrap flight" onPointerDown={flap}><canvas ref={canvasRef} width="760" height="320" aria-label="Vuelo del bienestar entre portales ambientales" />{phase === "ready" && <div className="arcade-overlay"><b>Vuelo del bienestar</b><p>Ayuda al corazón alado a cruzar mensajes de autocuidado y pautas ambientales.</p><button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={start}>Empezar a volar</button></div>}{phase === "finished" && <div className="arcade-overlay result"><b>{gates > bestRecord ? "¡Nuevo récord de bienestar!" : "El vuelo terminó"}</b><p>Superaste {gates} ecoportal{gates === 1 ? "" : "es"} · recompensa de {reward} puntos.</p><div><button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={start}>Reintentar</button><button className="save-record" type="button" disabled={busy || gates < 1} onPointerDown={(event) => event.stopPropagation()} onClick={() => onComplete(reward, gates)}>{busy ? "Guardando…" : "Guardar récord"}</button></div></div>}</div><p className="arcade-tip">Pulsa espacio o toca el juego para elevarte. La velocidad aumenta y los portales se hacen más estrechos.</p></div>;
}

function drawWellbeingFlight(context: CanvasRenderingContext2D, engine: { y: number; gates: number; obstacles: { x: number; gapY: number; gap: number; label: string }[] }) {
  const width = 760; const height = 320; const sky = context.createLinearGradient(0, 0, 0, height); sky.addColorStop(0, "#bcecff"); sky.addColorStop(.62, "#eefbff"); sky.addColorStop(1, "#d8f2cf"); context.fillStyle = sky; context.fillRect(0, 0, width, height);
  context.fillStyle = "rgba(255,255,255,.74)"; [[80, 58], [370, 42], [650, 85]].forEach(([x, y]) => { context.beginPath(); context.arc(x, y, 22, 0, Math.PI * 2); context.arc(x + 25, y - 5, 29, 0, Math.PI * 2); context.arc(x + 55, y + 2, 19, 0, Math.PI * 2); context.fill(); });
  context.fillStyle = "#a6d987"; context.beginPath(); context.moveTo(0, 290); for (let x = 0; x <= width; x += 95) context.quadraticCurveTo(x + 45, 252 - (x % 3) * 4, x + 95, 290); context.lineTo(width, height); context.lineTo(0, height); context.fill();
  engine.obstacles.forEach((obstacle) => {
    const topEnd = obstacle.gapY - obstacle.gap / 2; const bottomStart = obstacle.gapY + obstacle.gap / 2;
    const portal = context.createLinearGradient(obstacle.x, 0, obstacle.x + 58, 0); portal.addColorStop(0, "#257d64"); portal.addColorStop(.5, "#4fbd77"); portal.addColorStop(1, "#1f6d59"); context.fillStyle = portal; context.fillRect(obstacle.x, 0, 58, topEnd); context.fillRect(obstacle.x, bottomStart, 58, height - bottomStart);
    context.fillStyle = "#83db89"; for (let y = 12; y < topEnd; y += 24) { context.beginPath(); context.ellipse(obstacle.x + 12 + (y % 3) * 10, y, 9, 5, -.5, 0, Math.PI * 2); context.fill(); } for (let y = bottomStart + 12; y < height; y += 24) { context.beginPath(); context.ellipse(obstacle.x + 16 + (y % 4) * 7, y, 9, 5, .5, 0, Math.PI * 2); context.fill(); }
    context.fillStyle = "#fff"; context.font = "bold 8px sans-serif"; context.textAlign = "center"; context.fillText(obstacle.label, obstacle.x + 29, obstacle.gapY + 3);
  });
  const x = 110; const y = engine.y; context.save(); context.translate(x, y); context.fillStyle = "rgba(255,255,255,.9)"; context.beginPath(); context.ellipse(-19, 0, 17, 7, -.35, 0, Math.PI * 2); context.ellipse(19, 0, 17, 7, .35, 0, Math.PI * 2); context.fill(); context.fillStyle = "#f3378d"; context.beginPath(); context.moveTo(0, 17); context.bezierCurveTo(-27, -1, -19, -21, 0, -10); context.bezierCurveTo(19, -21, 27, -1, 0, 17); context.fill(); context.fillStyle = "#fff"; context.beginPath(); context.arc(-6, -4, 2, 0, Math.PI * 2); context.arc(6, -4, 2, 0, Math.PI * 2); context.fill(); context.restore();
}
