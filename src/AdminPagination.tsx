import { useEffect, useState } from "react";
import { pageOf } from "./adminData";

export function useAdminPage<T>(items: readonly T[], search = "") {
  const [selection, setSelection] = useState({ page: 1, search });
  const result = pageOf(items, selection.search === search ? selection.page : 1);
  useEffect(() => {
    setSelection((current) => current.page === result.page && current.search === search ? current : { page: result.page, search });
  }, [result.page, search]);
  return { ...result, onPage: (page: number) => setSelection({ page, search }) };
}

export function AdminPagination({ label, page, pages, total, from, to, onPage }: {
  label: string; page: number; pages: number; total: number; from: number; to: number; onPage: (page: number) => void;
}) {
  if (pages <= 1) return null;
  return <nav className="admin-pagination" aria-label={`Paginación de ${label}`}>
    <span role="status">{from}–{to} de {total}</span>
    <div>
      <button type="button" disabled={page === 1} onClick={() => onPage(page - 1)} aria-label={`Página anterior de ${label}`}>← Anterior</button>
      <label>Página <select aria-label={`Página de ${label}`} value={page} onChange={(event) => onPage(Number(event.target.value))}>{Array.from({ length: pages }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select> de {pages}</label>
      <button type="button" disabled={page === pages} onClick={() => onPage(page + 1)} aria-label={`Página siguiente de ${label}`}>Siguiente →</button>
    </div>
  </nav>;
}
