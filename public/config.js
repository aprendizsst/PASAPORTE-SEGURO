// Pegue entre comillas la URL /exec de su implementaciÃ³n de Google Apps Script.
// Si queda vacÃ­o, la aplicaciÃ³n bloquearÃ¡ el acceso y mostrarÃ¡ un aviso. Esta URL
// es administrativa: los participantes no pueden cambiarla desde la aplicaciÃ³n.
window.PASSPORT_CONFIG = Object.freeze({
  apiUrl: "https://us-east1-pasaporte-seguro.cloudfunctions.net/passportApi",
  // Use "apps-script" durante la migraciÃ³n y "firebase" despuÃ©s de publicar
  // la funciÃ³n passportApi. El cambio no altera ninguna pantalla del sitio.
  provider: "firebase",
  // Puede desactivar una mejora visual sin borrar cÃ³digo ni modificar Google Sheets.
  features: Object.freeze({
    dynamicCover: true,
    livingRoute: true,
    badges: true,
    downloadableCard: true,
  }),
});
