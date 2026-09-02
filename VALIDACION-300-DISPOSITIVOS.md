# Validación operativa para 300 dispositivos

Esta guía separa la comprobación funcional del ensayo de capacidad. Las pruebas locales confirman lógica, compilación y distribución de las consultas; no pueden reproducir la cuota real de la cuenta de Google que ejecuta Apps Script.

## Antes del evento

1. Publique la revisión 3.2.26 del frontend y una **nueva versión** de la implementación de Apps Script.
2. Ejecute una vez `setupPasaporteSeguro()` y confirme que finaliza sin error.
3. Verifique que los 300 usuarios estén creados antes del ingreso masivo. Evite registrar 300 cuentas durante el evento.
4. Entre 1 y 5 minutos antes de abrir el acceso, ejecute `prepararEvento300Usuarios()`. Continúe únicamente si responde **Preparación completa**.
5. Mantenga cerrada la pestaña administrativa durante el primer pico; sus resúmenes requieren lecturas globales que no son necesarias para el ingreso de los colaboradores.

## Ensayo gradual recomendado

| Etapa | Dispositivos | Duración | Criterio para continuar |
|---|---:|---:|---|
| Funcional | 5 | 5 min | Login, sello y Bonus correctos; cero duplicados |
| Carga media | 50 | 10 min | Al menos 99 % de ingresos exitosos; sin pérdida de progreso |
| Carga alta | 150 | 10 min | Errores transitorios recuperados por reintento; interfaz fluida |
| Objetivo | 300 | 15 min | Al menos 99 % de operaciones exitosas y sin filas duplicadas |

No use credenciales reales en herramientas externas. Prepare cuentas de prueba y distribuya el inicio de sesión en una ventana de 10 a 15 segundos para el ensayo; después puede medir un inicio más concentrado si la etapa anterior resulta estable.

## Qué registrar

- Hora de inicio y fin de cada etapa.
- Total de intentos y operaciones exitosas: login, iniciar misión, completar misión y guardar un récord.
- Tiempo percibido en p50, p95 y máximo. Objetivos iniciales: login p95 menor a 5 s con caché preparada; escritura p95 menor a 8 s.
- Mensajes de cuota, red o tiempo de espera y si el reintento automático los recuperó.
- Conteos antes/después en `Usuarios`, `Progreso`, `Bonus` y `Evidencias` para detectar duplicados o pérdidas.
- Historial de ejecuciones de Apps Script durante la misma ventana.

## Criterios de detención

Detenga la siguiente etapa si se pierde progreso, aparecen duplicados, el éxito baja de 99 %, hay errores definitivos repetidos o el p95 supera 10 segundos. Conserve la evidencia de la etapa y reduzca la concurrencia mientras se identifica si el límite proviene de Apps Script, Sheets, Drive o la red del lugar.

## Comandos de comprobación local

```bash
npm test
npm run build
```

El resultado esperado es 15 pruebas aprobadas y una compilación de producción sin errores.

## Prueba automatizada con usuarios temporales

1. En **Configuración del proyecto → Propiedades del script**, cree `LOAD_TEST_PASSWORD` con una contraseña temporal de al menos 12 caracteres.
2. En el editor de Apps Script seleccione `crearUsuariosPruebaCarga` y ejecútela una vez. Sin parámetros crea 300 cuentas y debe informar las cédulas `990000000001` a `990000000300`.
3. Ejecute `prepararEvento300Usuarios()` inmediatamente antes de iniciar el ensayo.
4. Desde PowerShell, en la carpeta del proyecto, configure las variables sin escribir la contraseña en archivos:

```powershell
$env:PASAPORTE_API_URL="PEGUE_AQUI_LA_URL_EXEC"
$env:PASAPORTE_LOAD_PASSWORD="LA_MISMA_CONTRASEÑA_TEMPORAL"
$env:PASAPORTE_LOAD_STAGES="5,25,50,100,200,300"
$env:PASAPORTE_LOAD_WRITE="false"
npm run test:load
```

El modo anterior valida login, restauración de sesión y asignación de misiones. Para incluir escrituras use una misión activa, asignada a todas las UAD y que **no requiera evidencia**:

```powershell
$env:PASAPORTE_LOAD_WRITE="true"
$env:PASAPORTE_LOAD_MISSION_ID="ID_DE_LA_MISION"
$env:PASAPORTE_LOAD_MISSION_CODE="CODIGO_DE_SELLO"
npm run test:load
```

El ejecutor también guarda un resultado JSON en `load-tests/results/`. Si login, sesión o misiones bajan de 99 %, termina con código de error.

Al finalizar, ejecute obligatoriamente `eliminarUsuariosPruebaCarga()` desde Apps Script. Esta función elimina solo las cuentas cuyo identificador interno comienza por `LOADTEST-`, sus datos dependientes y la propiedad `LOAD_TEST_PASSWORD`. Cierre también la terminal o retire sus variables temporales con `Remove-Item Env:PASAPORTE_LOAD_PASSWORD, Env:PASAPORTE_LOAD_MISSION_CODE`.
