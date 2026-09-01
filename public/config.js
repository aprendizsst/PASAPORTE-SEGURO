// Pegue entre comillas la URL /exec de su implementación de Google Apps Script.
// Mientras esté vacío, la aplicación funciona en modo demostración. Esta URL es
// administrativa: los participantes no pueden cambiarla desde la aplicación.
window.PASSPORT_CONFIG = Object.freeze({
  apiUrl: "",
  // Puede desactivar una mejora visual sin borrar código ni modificar Google Sheets.
  features: Object.freeze({
    dynamicCover: true,
    livingRoute: true,
    badges: true,
    downloadableCard: true,
  }),
});
