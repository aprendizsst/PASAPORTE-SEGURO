import { useMemo, useState } from "react";

export type BonusGameId = "word-search" | "sudoku" | "target";

type Props = {
  completed: string[];
  scores: Record<string, number>;
  busy: string;
  onComplete: (gameId: BonusGameId, score: number) => Promise<void>;
};

const games: { id: BonusGameId; title: string; subtitle: string; points: number; color: string }[] = [
  { id: "word-search", title: "Ruta de palabras", subtitle: "Encuentra conceptos del cuidado", points: 80, color: "#9d5cff" },
  { id: "sudoku", title: "Sudoku seguro", subtitle: "Ordena los símbolos del 1 al 4", points: 120, color: "#12cfe0" },
  { id: "target", title: "Tiro al riesgo", subtitle: "Pon a prueba tus reflejos", points: 100, color: "#ff5c9b" },
];

export default function MiniGamesPage({ completed, scores, busy, onComplete }: Props) {
  const [selected, setSelected] = useState<BonusGameId | null>(null);
  const current = games.find((game) => game.id === selected);

  return <div className="page-content bonus-page">
    <div className="bonus-hero">
      <div><p className="step-label">ZONA BONUS</p><h2>Juega, aprende y suma puntos</h2><p>Retos breves que se ejecutan en tu dispositivo. Solo guardamos el resultado cuando terminas.</p></div>
      <div className="bonus-score"><span>★</span><b>{completed.length}/{games.length}</b><small>juegos superados</small></div>
    </div>

    <div className="bonus-grid">{games.map((game, index) => {
      const done = completed.includes(game.id);
      return <button className={`bonus-card ${done ? "done" : ""}`} style={{ "--game": game.color, "--delay": `${index * .08}s` } as React.CSSProperties} key={game.id} onClick={() => setSelected(game.id)}>
        <span className="bonus-card-icon"><GameIcon name={game.id} /></span><span className="bonus-card-copy"><small>{done ? "COMPLETADO" : "MINIJUEGO"}</small><b>{game.title}</b><i>{game.subtitle}</i></span><span className="bonus-points">{done ? `✓ ${scores[game.id] || game.points}` : `+${game.points}`}<small>pts</small></span>
      </button>;
    })}</div>

    <div className="bonus-coming"><span>PRÓXIMAMENTE</span><div><i>✎</i> Colorea y descubre</div><div><i>＋</i> Crucigrama del bienestar</div></div>

    {current && <div className="game-backdrop" role="dialog" aria-modal="true" aria-label={current.title}><div className="game-modal" style={{ "--game": current.color } as React.CSSProperties}>
      <button className="game-close" onClick={() => setSelected(null)} aria-label="Cerrar minijuego">×</button>
      <div className="game-modal-heading"><span><GameIcon name={current.id} /></span><div><small>ZONA BONUS · {current.points} PUNTOS</small><h3>{current.title}</h3></div></div>
      {current.id === "word-search" && <WordSearchGame completed={completed.includes(current.id)} busy={busy === `bonus-${current.id}`} onComplete={() => onComplete(current.id, current.points)} />}
      {current.id === "sudoku" && <SudokuGame completed={completed.includes(current.id)} busy={busy === `bonus-${current.id}`} onComplete={() => onComplete(current.id, current.points)} />}
      {current.id === "target" && <TargetGame completed={completed.includes(current.id)} busy={busy === `bonus-${current.id}`} onComplete={() => onComplete(current.id, current.points)} />}
    </div></div>}
  </div>;
}

function GameIcon({ name }: { name: BonusGameId }) {
  if (name === "word-search") return <svg viewBox="0 0 24 24"><path d="M4 5h16v14H4zM8 9h.01M12 9h.01M16 9h.01M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01" /></svg>;
  if (name === "sudoku") return <svg viewBox="0 0 24 24"><path d="M4 4h16v16H4zM12 4v16M4 12h16M8 4v16M16 4v16M4 8h16M4 16h16" /></svg>;
  return <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /><path d="m17 7 4-4M17 3h4v4" /></svg>;
}

const wordGrid = [
  ["S", "E", "G", "U", "R", "O", "M", "P"],
  ["A", "M", "O", "R", "N", "T", "E", "A"],
  ["L", "C", "U", "I", "D", "A", "D", "U"],
  ["U", "N", "T", "O", "R", "I", "S", "S"],
  ["D", "I", "V", "E", "R", "S", "O", "A"],
  ["C", "U", "I", "D", "A", "D", "O", "K"],
  ["P", "A", "U", "S", "A", "Q", "W", "E"],
  ["V", "I", "D", "A", "S", "A", "N", "A"],
];
const hiddenWords = ["SEGURO", "SALUD", "CUIDADO", "PAUSA"];

function WordSearchGame({ completed, busy, onComplete }: { completed: boolean; busy: boolean; onComplete: () => Promise<void> }) {
  const [start, setStart] = useState<[number, number] | null>(null);
  const [found, setFound] = useState<string[]>(completed ? hiddenWords : []);
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("Toca la primera y la última letra de una palabra.");

  function choose(row: number, column: number) {
    if (found.length === hiddenWords.length) return;
    if (!start) { setStart([row, column]); setMessage("Ahora toca la última letra."); return; }
    const cells = cellsBetween(start, [row, column]);
    setStart(null);
    if (!cells.length) { setMessage("La palabra debe estar en línea recta."); return; }
    const word = cells.map(([r, c]) => wordGrid[r][c]).join("");
    const match = hiddenWords.find((item) => (item === word || item === word.split("").reverse().join("")) && !found.includes(item));
    if (!match) { setMessage("Intenta con otra combinación."); return; }
    const next = [...found, match];
    setFound(next);
    setMarked((current) => new Set([...current, ...cells.map(([r, c]) => `${r}-${c}`)]));
    setMessage(next.length === hiddenWords.length ? "¡Encontraste todas las palabras!" : `¡${match} encontrada! Sigue así.`);
  }

  return <div className="game-body word-game"><div className="word-list">{hiddenWords.map((word) => <span className={found.includes(word) ? "found" : ""} key={word}>{found.includes(word) ? "✓" : "○"} {word}</span>)}</div><div className="word-grid">{wordGrid.map((row, r) => row.map((letter, c) => <button className={`${marked.has(`${r}-${c}`) ? "marked" : ""} ${start?.[0] === r && start?.[1] === c ? "selected" : ""}`} key={`${r}-${c}`} onClick={() => choose(r, c)}>{letter}</button>))}</div><p className="game-message">{message}</p>{found.length === hiddenWords.length && <button className="game-complete-button" disabled={completed || busy} onClick={onComplete}>{busy ? "Guardando..." : completed ? "Puntos guardados ✓" : "Reclamar 80 puntos"}</button>}</div>;
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

const sudokuSolution = [[1, 2, 3, 4], [3, 4, 1, 2], [2, 1, 4, 3], [4, 3, 2, 1]];
const sudokuPuzzle = [[1, 0, 0, 4], [0, 4, 1, 0], [0, 1, 4, 0], [4, 0, 0, 1]];

function SudokuGame({ completed, busy, onComplete }: { completed: boolean; busy: boolean; onComplete: () => Promise<void> }) {
  const [values, setValues] = useState(() => (completed ? sudokuSolution : sudokuPuzzle).map((row) => [...row]));
  const [solved, setSolved] = useState(completed);
  const [message, setMessage] = useState("Completa cada fila y columna con números del 1 al 4.");
  function validate() {
    const correct = values.every((row, r) => row.every((value, c) => value === sudokuSolution[r][c]));
    setSolved(correct); setMessage(correct ? "¡Sudoku resuelto sin riesgos!" : "Aún hay números por revisar.");
  }
  return <div className="game-body sudoku-game"><div className="sudoku-board">{values.map((row, r) => row.map((value, c) => sudokuPuzzle[r][c] ? <span className="fixed" key={`${r}-${c}`}>{value}</span> : <select aria-label={`Fila ${r + 1}, columna ${c + 1}`} value={value || ""} key={`${r}-${c}`} onChange={(event) => setValues((current) => current.map((line, ri) => line.map((cell, ci) => ri === r && ci === c ? Number(event.target.value) : cell)))}><option value="">·</option>{[1, 2, 3, 4].map((number) => <option key={number}>{number}</option>)}</select>))}</div><p className="game-message">{message}</p>{!solved ? <button className="game-check-button" onClick={validate}>Comprobar solución</button> : <button className="game-complete-button" disabled={completed || busy} onClick={onComplete}>{busy ? "Guardando..." : completed ? "Puntos guardados ✓" : "Reclamar 120 puntos"}</button>}</div>;
}

function TargetGame({ completed, busy, onComplete }: { completed: boolean; busy: boolean; onComplete: () => Promise<void> }) {
  const [hits, setHits] = useState(completed ? 6 : 0);
  const [attempts, setAttempts] = useState(completed ? 10 : 0);
  const [position, setPosition] = useState({ left: 50, top: 48 });
  const finished = attempts >= 10;
  const passed = hits >= 6;
  const targetLabel = useMemo(() => finished ? `${hits} aciertos` : `${10 - attempts} intentos`, [attempts, finished, hits]);
  function moveTarget() { setPosition({ left: 10 + Math.random() * 75, top: 12 + Math.random() * 68 }); }
  function miss() { if (finished) return; setAttempts((value) => value + 1); moveTarget(); }
  function hit(event: React.MouseEvent) { event.stopPropagation(); if (finished) return; setHits((value) => value + 1); setAttempts((value) => value + 1); moveTarget(); }
  function retry() { setHits(0); setAttempts(0); moveTarget(); }
  return <div className="game-body target-game"><div className="target-stats"><span><b>{hits}</b> aciertos</span><span>{targetLabel}</span></div><div className="target-field" onClick={miss}>{!finished && <button aria-label="Objetivo" style={{ left: `${position.left}%`, top: `${position.top}%` }} onClick={hit}><i /><b>RIESGO</b></button>}<div className="target-radar" /></div>{finished && <div className={`target-result ${passed ? "passed" : ""}`}><b>{passed ? "¡Objetivo cumplido!" : "Casi lo logras"}</b><p>{passed ? "Identificaste los riesgos con gran precisión." : "Necesitas al menos 6 aciertos. Respira y prueba otra vez."}</p>{passed ? <button className="game-complete-button" disabled={completed || busy} onClick={onComplete}>{busy ? "Guardando..." : completed ? "Puntos guardados ✓" : "Reclamar 100 puntos"}</button> : <button className="game-check-button" onClick={retry}>Intentar nuevamente</button>}</div>}</div>;
}
