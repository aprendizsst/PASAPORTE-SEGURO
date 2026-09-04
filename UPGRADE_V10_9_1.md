# V10.9.1 · Corrección de rutas GitHub Pages

Esta revisión no cambia Google Apps Script. Corrige el arranque de GitHub Pages cuando los recursos dentro de `/js` o `/assets` devuelven 404.

## Cambio

`index.html` ahora carga los JavaScript desde la raíz del repositorio (`./app.js`, `./backend.js`, etc.), donde V10.9 ya mantenía copias sincronizadas. El CSS y el icono también se cargan desde la raíz.

## Backend

La versión requerida de Apps Script sigue siendo `2026.09.04-v10.9-two-sheet-routing`; no hay que volver a desplegar Apps Script por esta corrección.
