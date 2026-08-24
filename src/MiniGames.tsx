import { useEffect, useRef, useState } from "react";

export type BonusGameId = "word-search" | "sudoku" | "target";

type Props = {
  completed: string[];
  scores: Record<string, number>;
  busy: string;
  onComplete: (gameId: BonusGameId, score: number) => Promise<void>;
};

const games: { id: BonusGameId; title: string; subtitle: string; points: number; color: string }[] = [
  { id: "word-search", title: "Ruta de palabras", subtitle: "Una sopa diferente en cada partida", points: 80, color: "#9d5cff" },
  { id: "sudoku", title: "Sudoku seguro", subtitle: "Completa el tablero profesional 9 × 9", points: 120, color: "#12cfe0" },
  { id: "target", title: "Tiro al riesgo", subtitle: "Controla dos ejes y apunta con precisión", points: 200, color: "#ff5c9b" },
];

export default function MiniGamesPage({ completed, scores, busy, onComplete }: Props) {
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

    <div className="bonus-coming"><span>PRÓXIMAMENTE</span><div><i>✎</i> Colorea y descubre</div><div><i>＋</i> Crucigrama del bienestar</div></div>

    {current && <div className="game-backdrop" role="dialog" aria-modal="true" aria-label={current.title}><div className="game-modal" style={{ "--game": current.color } as React.CSSProperties}>
      <button className="game-close" onClick={() => setSelected(null)} aria-label="Cerrar minijuego">×</button>
      <div className="game-modal-heading"><span><GameIcon name={current.id} /></span><div><small>ZONA BONUS · {current.id === "target" ? "HASTA " : ""}{current.points} PUNTOS</small><h3>{current.title}</h3></div></div>
      {current.id === "word-search" && <WordSearchGame completed={completed.includes(current.id)} busy={busy === `bonus-${current.id}`} onComplete={() => onComplete(current.id, current.points)} />}
      {current.id === "sudoku" && <SudokuGame completed={completed.includes(current.id)} busy={busy === `bonus-${current.id}`} onComplete={() => onComplete(current.id, current.points)} />}
      {current.id === "target" && <TargetGame completed={completed.includes(current.id)} busy={busy === `bonus-${current.id}`} onComplete={(score) => onComplete(current.id, score)} />}
    </div></div>}
  </div>;
}

function GameIcon({ name }: { name: BonusGameId }) {
  if (name === "word-search") return <svg viewBox="0 0 24 24"><path d="M4 5h16v14H4zM8 9h.01M12 9h.01M16 9h.01M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01" /></svg>;
  if (name === "sudoku") return <svg viewBox="0 0 24 24"><path d="M4 4h16v16H4zM12 4v16M4 12h16M8 4v16M16 4v16M4 8h16M4 16h16" /></svg>;
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

function TargetGame({ completed, busy, onComplete }: { completed: boolean; busy: boolean; onComplete: (score: number) => Promise<void> }) {
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
  </div>{phase === "ready" && <button className="game-complete-button target-action" onClick={start}>Iniciar reto · {TARGET_SECONDS} segundos</button>}{(phase === "horizontal" || phase === "vertical") && <button className="game-complete-button target-action pulse" onClick={lockAim}>{phase === "horizontal" ? "1. Fijar dirección horizontal" : "2. Fijar altura y lanzar"}</button>}{phase === "flight" && <div className="flight-message">Dardo en trayectoria…</div>}{phase === "finished" && <div className={`target-result ${passed ? "passed" : ""}`}><b>{passed ? "¡Gran puntería!" : "Puedes acercarte más al centro"}</b><p>Lograste {precision} puntos de precisión con {landings.length} dardo{landings.length === 1 ? "" : "s"}. {passed ? `Tu recompensa es de ${reward} puntos.` : "Necesitas al menos 180 puntos de precisión."}</p>{passed ? <button className="game-complete-button" disabled={completed || busy} onClick={() => onComplete(reward)}>{busy ? "Guardando..." : completed ? "Bonus ya guardado ✓" : `Reclamar ${reward} puntos`}</button> : <button className="game-check-button" onClick={start}>Intentar nuevamente</button>}{completed && <button className="target-replay" onClick={start}>Jugar de nuevo sin cambiar el premio</button>}</div>}</div>;
}
