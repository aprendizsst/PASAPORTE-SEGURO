# V10.7 · Sincronización completa con la hoja de consecutivos

## Problema corregido
Hasta V10.6 el consecutivo se reservaba en la hoja operativa configurada, pero la ficha completa se almacenaba únicamente en la base interna `DocumentosProcesados`. Por eso la hoja de consecutivos podía mostrar solo consecutivo, fecha, trabajador y unos pocos campos.

## Nuevo comportamiento
La misma fila que contiene `SST-2026-...` se actualiza con la ficha completa del certificado cuando existe un consecutivo. No se crea una fila adicional para el mismo documento.

Si la hoja no tiene columnas para la ficha SST, Apps Script agrega al final únicamente los encabezados faltantes, respetando las columnas existentes:

- FECHA DOCUMENTO
- TRABAJADOR
- IDENTIFICACION
- CARGO
- TIPO EXAMEN
- ASUNTO
- PDF ORIGEN
- EXAMENES REALIZADOS
- ESTADOS EXAMENES
- RECOMENDACIONES
- RESTRICCIONES
- OBSERVACIONES
- REMISIONES
- PROGRAMA VIGILANCIA
- LUGAR
- PERFIL DOCUMENTAL
- CALIDAD EXTRACCION
- VALIDADO IA
- CAMPOS REVISION
- ESTADO SINCRONIZACION
- DOCUMENT_KEY
- USUARIO
- ACTUALIZADO EN

La base interna `DocumentosProcesados` se conserva como respaldo/auditoría.

## Backend requerido
`2026.09.03-v10.7-consecutive-full-sync`
