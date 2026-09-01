// Pegue entre comillas la URL /exec de su implementación de Google Apps Script.
// Si queda vacío, la aplicación bloqueará el acceso y mostrará un aviso. Esta URL
// es administrativa: los participantes no pueden cambiarla desde la aplicación.
window.PASSPORT_CONFIG = Object.freeze({
  apiUrl: "https://script.google.com/macros/s/AKfycbzc4_V7WdPV9Fj83eDelbRuFfn_V28CzHuCIcT9ugiopAzL8PjoLlhegr3Q5-tNc5pc/exec",
  // Puede desactivar una mejora visual sin borrar código ni modificar Google Sheets.
  features: Object.freeze({
    dynamicCover: true,
    livingRoute: true,
    badges: true,
    downloadableCard: true,
  }),
});
