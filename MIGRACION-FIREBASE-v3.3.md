# Migración real a Firebase · Pasaporte Seguro 3.3.0

Esta versión mantiene exactamente la interfaz actual. El cambio está debajo de la aplicación:

```text
Navegador → Cloud Function passportApi → Firestore (base principal)
                                      ↘ Storage (evidencias privadas)
                                       ↘ Cola transaccional → Google Sheets (respaldo)
```

Firestore responde a los usuarios. Google Sheets deja de participar en el inicio de sesión, el sellado y los minijuegos; recibe una copia asíncrona cada cinco minutos. Una falla de Sheets no interrumpe el pasaporte y las operaciones pendientes permanecen en `syncQueue` para reintentarse. La sincronización es deliberadamente de una sola vía: **Firestore → Sheets**. Editar una fila manualmente en Sheets ya no cambia la plataforma.

## Qué pasa con la base existente

No se elimina. `migrate-sheets.mjs` solo lee las pestañas actuales y copia sus registros a Firestore. No borra filas, hojas, archivos de Drive ni la implementación de Apps Script. Las contraseñas heredadas siguen funcionando y se actualizan automáticamente al formato criptográfico nuevo después del primer inicio de sesión correcto.

Antes de comenzar, haga **Archivo → Hacer una copia** en Google Sheets. Mantenga `provider: "apps-script"` en `public/config.js` hasta completar toda la validación.

## 1. Crear el proyecto

1. En Firebase Console cree o seleccione el proyecto definitivo.
2. Active el plan Blaze. Cloud Functions de segunda generación y Cloud Scheduler requieren facturación habilitada, aunque el consumo pueda permanecer dentro de cuotas sin costo.
3. Cree Firestore en modo nativo y seleccione `us-east1` para mantenerlo cerca del backend configurado.
4. Active Storage.
5. Anote el **ID del proyecto** y el **número del proyecto** desde Configuración del proyecto.

No cree colecciones manualmente. La migración y la aplicación las crean con la estructura correcta.

## 2. Preparar PowerShell

Abra PowerShell dentro de la carpeta raíz del proyecto y ejecute una orden por línea:

```powershell
npm.cmd install
npm.cmd --prefix functions install
npx.cmd firebase-tools login
npx.cmd firebase-tools use --add
```

En la última orden seleccione el proyecto de producción y asígnele el alias `default`.

Copie `functions\env.example` como `functions\.env.ID_DEL_PROYECTO`, reemplace `ID_DEL_PROYECTO` por el valor real y complete:

- `PASSPORT_SHEET_ID`: texto entre `/d/` y `/edit` en la URL de Google Sheets.
- `PASSPORT_ALLOWED_ORIGINS`: para el sitio actual, `https://aprendizsst.github.io`.
- Datos SMTP del correo que enviará los códigos de recuperación.

No coloque contraseñas dentro de ese archivo.

## 3. Crear los secretos

Ejecute:

```powershell
npx.cmd firebase-tools functions:secrets:set PASSPORT_SESSION_SECRET
npx.cmd firebase-tools functions:secrets:set PASSPORT_SMTP_PASSWORD
```

Para `PASSPORT_SESSION_SECRET` pegue una cadena aleatoria de 48 caracteres o más. Puede generarla sin guardarla en archivos:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Para `PASSPORT_SMTP_PASSWORD` use una contraseña de aplicación del correo emisor, no la contraseña personal de la cuenta.

## 4. Dar acceso de respaldo a Sheets

Las Functions de segunda generación usan normalmente esta cuenta de servicio:

```text
NUMERO_DEL_PROYECTO-compute@developer.gserviceaccount.com
```

Comparta la hoja actual con esa dirección como **Editor**. Solo esa identidad necesita escribir el respaldo. No publique la hoja ni la deje accesible para cualquier persona.

## 5. Publicar reglas y backend

Desde la raíz:

```powershell
npx.cmd firebase-tools deploy --only firestore,storage,functions
```

El despliegue crea:

- `passportApi`: API pública con validación de sesión y permisos en cada acción.
- `syncPassportSheets`: respaldo programado cada cinco minutos.
- reglas que bloquean por completo el acceso directo del navegador a Firestore y Storage;
- índices para progreso y récords.

Copie la URL HTTPS de `passportApi`. Compruebe su estado:

```powershell
Invoke-RestMethod "URL_DE_PASSPORT_API"
```

Debe devolver `ok=True`, `status=ready`, `version=3.3.0` y `primaryDatabase=firestore`.

## 6. Copiar la base actual sin eliminarla

La migración local requiere una cuenta de servicio temporal con permiso **Cloud Datastore User** en el proyecto Firebase y acceso de **Lector** a la hoja. Descargue su clave JSON desde Google Cloud Console y no la suba a GitHub.

En PowerShell, una orden por línea:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\ruta\cuenta-migracion.json"
$env:PASSPORT_SHEET_ID="ID_DE_LA_HOJA"
$env:MIGRATION_CONFIRM="SI"
npm.cmd --prefix functions run migrate:sheets
```

El resultado muestra los conteos copiados. Revise en Firestore que existan `users`, `missions`, `progress`, `bonus`, `badges`, `evidence` y `catalogs`. Los códigos de recuperación antiguos se archivan en `legacyRecoveries` y no vuelven a ser utilizables.

Conserve la clave hasta terminar la prueba de carga y su limpieza. Después elimine el archivo local y revoque la clave desde Google Cloud Console.

## 7. Cambiar el frontend cuando todo esté validado

En `public/config.js` cambie únicamente estas dos líneas:

```js
apiUrl: "URL_HTTPS_DE_PASSPORT_API",
provider: "firebase",
```

Publique el frontend en GitHub Pages y actualice con `Ctrl + F5`. No cambie estilos, componentes ni recursos gráficos.

Pruebe, en este orden:

1. ingreso del administrador;
2. ingreso de un colaborador ya existente;
3. misión asignada a todas las UAD;
4. misión exclusiva de la UAD del colaborador;
5. sellado con un código incorrecto y luego con el correcto;
6. un minijuego y su récord;
7. recuperación: correo → código → contraseña nueva;
8. crear/editar una insignia y editar un usuario;
9. abrir una evidencia desde Administración;
10. descargar el informe Excel y revisar sus nueve hojas.

Espere cinco minutos y confirme que las filas modificadas aparecen en Sheets con `SyncEstado=SINCRONIZADO`.

## 8. Prueba de carga aislada

Con las mismas credenciales temporales de migración todavía activas:

```powershell
$clave = Read-Host "Contraseña temporal de 12 caracteres o más" -AsSecureString
$env:PASAPORTE_LOAD_PASSWORD = [System.Net.NetworkCredential]::new("", $clave).Password
$env:PASAPORTE_LOAD_CONFIRM="SI"
$env:PASAPORTE_LOAD_USER_COUNT="300"
$env:PASAPORTE_LOAD_USERS_MODE="seed"
npm.cmd --prefix functions run load-users
```

Luego:

```powershell
$env:PASAPORTE_API_URL="URL_HTTPS_DE_PASSPORT_API"
$env:PASAPORTE_LOAD_STAGES="5,25,50,100,200,300"
$env:PASAPORTE_LOAD_WRITE="false"
npm.cmd run test:load
```

Si la lectura alcanza al menos 99 %, repita con escrituras:

```powershell
$env:PASAPORTE_LOAD_WRITE="true"
$env:PASAPORTE_LOAD_MISSION_ID="ID_DE_MISION_SIN_EVIDENCIA"
$env:PASAPORTE_LOAD_MISSION_CODE="CODIGO_DE_SELLO"
npm.cmd run test:load
```

Las cuentas de carga tienen `isLoadTest=true`: no aparecen en los reportes administrativos y sus resultados no se envían a Sheets. Al terminar, límpielas:

```powershell
$env:PASAPORTE_LOAD_USERS_MODE="cleanup"
npm.cmd --prefix functions run load-users
Remove-Item Env:PASAPORTE_LOAD_PASSWORD, Env:PASAPORTE_LOAD_CONFIRM
```

## 9. Limpieza automática de datos técnicos

En Google Cloud Console abra **Firestore → Time-to-live** y active el campo `expiresAt` para los grupos de colección:

- `requests`
- `rateLimits`
- `recoveries`
- `syncQueue`

Esto elimina después del vencimiento solicitudes idempotentes, límites de intentos, recuperaciones usadas y eventos de sincronización ya procesados. Nunca configure TTL sobre `users`, `missions`, `progress`, `bonus`, `badges` o `evidence`.

## 10. Operación y recuperación

- Firestore es la única base principal después del cambio. No active simultáneamente escrituras de Apps Script y Firebase.
- Sheets es un respaldo operativo legible, no una segunda base activa. De esta forma no hay conflictos de “última escritura”.
- Una caída temporal de Sheets no afecta login, misiones ni juegos. La cola reintenta y, tras ocho fallos repetidos de una misma hoja, marca el evento `ERROR` sin bloquear las demás hojas.
- `minInstances: 1` mantiene una instancia caliente y la concurrencia se limita a 10 solicitudes por instancia para que la validación criptográfica no se acumule; implica un costo base pequeño. Para priorizar costo sobre latencia, cambie `minInstances` a `0` en `functions/src/index.js`.
- Si el despliegue nuevo falla antes de cambiar `public/config.js`, el sitio sigue usando Apps Script. Después del cambio, no vuelva a Apps Script como base activa sin un procedimiento de recuperación controlado, porque Firestore ya puede contener operaciones más recientes.

## Criterios de aceptación

- Cero pérdidas y cero duplicados en las operaciones reintentadas.
- Login, sesión y listado de misiones con éxito mínimo de 99 % en cada etapa.
- p95 inicial objetivo menor de 5 segundos para login y menor de 8 segundos para escritura a 300 sesiones; el valor final debe medirse desde la red real del evento.
- La misión completada queda visible inmediatamente en Firestore y después en Sheets. Una misión nueva o reasignada se propaga entre instancias en un máximo normal de cinco segundos.
- El ranking no usa un documento compartido por cada partida: se calcula desde registros individuales con caché breve, evitando contención entre jugadores.
