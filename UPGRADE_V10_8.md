# V10.8 · Sincronización real con hojas operativas

Esta versión corrige dos integraciones distintas:

1. **Pestaña de consecutivos:** la reserva del número ya no se considera suficiente. Después de asignar el consecutivo, el frontend ejecuta `syncConsecutiveRecord(s)` con la ficha completa del certificado. La misma fila se completa con trabajador, identificación, cargo, tipo de examen, exámenes, estados, recomendaciones, restricciones, observaciones, remisiones, PVE/SVE, archivo origen, validación IA y trazabilidad.
2. **Correspondencia Enviada:** los correos exitosos se registran también en la pestaña operativa configurada del mismo Google Sheets, no solo en `HistorialCorreos` de la base interna. En envío masivo se crea una fila por documento, aunque todos se envíen al mismo destinatario.

## Configuración

En Configuración → Google Sheets indica:

- URL/ID del archivo.
- Pestaña de consecutivos.
- Pestaña de correspondencia enviada (por defecto `Correspondencia Enviada`).
- Prefijo.

El backend no crea silenciosamente una pestaña externa si el nombre está mal: devuelve un error explícito.

Backend requerido: `2026.09.04-v10.8-correspondence-sync`.
