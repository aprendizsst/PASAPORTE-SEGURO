# V10.9 · Enrutamiento exacto de Google Sheets

## 1. CORRESPONDENCIA ENVIADA (1) / CONSECUTIVOS 2026
Se usa exclusivamente para validar el mayor consecutivo y reservar el siguiente. Mantiene la estructura operativa de cuatro campos: `CONSECUTIVO | FECHA | NOMBRE | ASUNTO`, donde el asunto siempre es `RECOMENDACIÓN MEDICA`. No se agregan columnas clínicas ni técnicas.

## 2. CORRESPONDENCIA ENVIADA SST 2026 / Hoja 1
Es el registro SST y mantiene exactamente cinco campos: `CONSECUTIVO | FECHA | NOMBRE | CARGO | EXAMEN`. Se actualiza por consecutivo para evitar duplicados.

## Instalación
Ejecuta manualmente `authorizePortalServices()` desde el Apps Script vinculado al archivo `CORRESPONDENCIA ENVIADA SST 2026`, acepta permisos y publica una nueva versión de la Web App.
