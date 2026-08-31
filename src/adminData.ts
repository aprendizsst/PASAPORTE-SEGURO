export const ADMIN_PAGE_SIZE = 10;

// Keep the same normalization as audienceKey_ in Apps Script.
export function audienceKey(value: unknown) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function missionAssignedTo(audience: unknown, uad: unknown) {
  const key = audienceKey(audience);
  return key === "todas las uad" || (key !== "" && key === audienceKey(uad));
}

export function pageOf<T>(items: readonly T[], requestedPage: number) {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Math.floor(requestedPage) || 1));
  const start = (page - 1) * ADMIN_PAGE_SIZE;
  return { items: items.slice(start, start + ADMIN_PAGE_SIZE), page, pages, total, from: total ? start + 1 : 0, to: Math.min(start + ADMIN_PAGE_SIZE, total) };
}
