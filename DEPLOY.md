# Despliegue V10.9

1. Sube el contenido de esta carpeta a la raíz de GitHub Pages.
2. En el Apps Script vinculado a **CORRESPONDENCIA ENVIADA SST 2026**, reemplaza `Code.gs`, `BackendBridge.html` y `appsscript.json` por los de `backend/`.
3. Ejecuta manualmente `authorizePortalServices()` y acepta los permisos. La función valida:
   - `CORRESPONDENCIA ENVIADA SST 2026` / `Hoja 1`.
   - `CORRESPONDENCIA ENVIADA (1)` / `CONSECUTIVOS 2026`.
4. Implementa **Nueva versión** de la Web App.
5. El backend debe responder `2026.09.04-v10.9-two-sheet-routing`.
6. En Configuración, el URL/ID del archivo de consecutivos puede quedar vacío si Drive contiene un único archivo llamado exactamente `CORRESPONDENCIA ENVIADA (1)`. Si hay duplicados, pega su URL exacta.
7. Prueba con un documento:
   - `CONSECUTIVOS 2026`: `CONSECUTIVO | FECHA | NOMBRE | RECOMENDACIÓN MEDICA`.
   - `Hoja 1`: `CONSECUTIVO | FECHA | NOMBRE | CARGO | EXAMEN`.
