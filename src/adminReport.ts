import { strToU8, zipSync } from "fflate";

export type ReportCell = string | number | boolean | null | undefined;
export type ReportRow = Record<string, ReportCell>;
export type AdminReportData = {
  generatedAt?: string; summary?: ReportRow[]; users?: ReportRow[]; missions?: ReportRow[];
  progress?: ReportRow[]; badges?: ReportRow[]; bonus?: ReportRow[]; evidence?: ReportRow[];
  uads?: ReportRow[]; activity?: ReportRow[];
};

const DEFINITIONS: Array<{ key: keyof AdminReportData; title: string }> = [
  { key: "summary", title: "Resumen general" }, { key: "users", title: "Usuarios" },
  { key: "missions", title: "Misiones" }, { key: "progress", title: "Detalle misiones" },
  { key: "badges", title: "Insignias" }, { key: "bonus", title: "Minijuegos" },
  { key: "evidence", title: "Evidencias" }, { key: "uads", title: "Rendimiento UAD" },
  { key: "activity", title: "Actividad" },
];

function xml(value: unknown) { return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;"); }
function columnName(number: number) { let value = number; let result = ""; while (value > 0) { value -= 1; result = String.fromCharCode(65 + value % 26) + result; value = Math.floor(value / 26); } return result; }
function width(values: ReportCell[], header: string) { let longest = header.length; values.forEach((value) => { longest = Math.max(longest, String(value ?? "").length); }); return Math.max(12, Math.min(42, longest + 2)); }
function cell(value: ReportCell, reference: string, style: number) {
  if (typeof value === "number" && Number.isFinite(value)) return `<c r="${reference}" s="${style}"><v>${value}</v></c>`;
  if (typeof value === "boolean") return `<c r="${reference}" s="${style}" t="b"><v>${value ? 1 : 0}</v></c>`;
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
}
function worksheet(rows: ReportRow[]) {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const columns = headers.map((header, index) => `<col min="${index + 1}" max="${index + 1}" width="${width(rows.map((row) => row[header]), header)}" customWidth="1"/>`).join("");
  const heading = `<row r="1" ht="27" customHeight="1">${headers.map((header, index) => cell(header, `${columnName(index + 1)}1`, 1 + index % 5)).join("")}</row>`;
  const body = rows.map((row, rowIndex) => `<row r="${rowIndex + 2}">${headers.map((header, columnIndex) => cell(row[header], `${columnName(columnIndex + 1)}${rowIndex + 2}`, rowIndex % 2 ? 7 : 6)).join("")}</row>`).join("");
  const last = `${columnName(headers.length)}${rows.length + 1}`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${columns}</cols><sheetData>${heading}${body}</sheetData><autoFilter ref="A1:${last}"/></worksheet>`;
}

const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="10"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Aptos"/></font></fonts><fills count="8"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF12335A"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFC3010A"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF337A2"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF4AB2FB"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF7253DC"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF4F8FC"/></patternFill></fill></fills><borders count="2"><border/><border><bottom style="thin"><color rgb="FFD9E3EE"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="8"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="4" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="5" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="6" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="7" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

export function buildAdminWorkbook(data: AdminReportData) {
  const selected = DEFINITIONS.map((definition) => ({ ...definition, rows: data[definition.key] })).filter((definition): definition is typeof definition & { rows: ReportRow[] } => Array.isArray(definition.rows) && definition.rows.length > 0);
  if (!selected.length) throw new Error("El informe no contiene datos para exportar.");
  const sheetOverrides = selected.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  const workbookSheets = selected.map((definition, index) => `<sheet name="${xml(definition.title.slice(0, 31))}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("");
  const workbookRels = selected.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("");
  const archive: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheetOverrides}</Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${workbookRels}<Relationship Id="rId${selected.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    "xl/styles.xml": strToU8(styles),
  };
  selected.forEach((definition, index) => { archive[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(worksheet(definition.rows)); });
  return zipSync(archive, { level: 6 });
}

export async function downloadAdminWorkbook(data: AdminReportData) {
  const output = buildAdminWorkbook(data);
  const buffer = new ArrayBuffer(output.byteLength); new Uint8Array(buffer).set(output);
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob); const link = document.createElement("a");
  link.href = url; link.download = `informe-pasaporte-seguro-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
