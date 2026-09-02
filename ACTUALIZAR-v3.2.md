# Actualización segura a Pasaporte Seguro 3.2

## Revisión 3.2.26 — Ensayo masivo controlado

- Añade `crearUsuariosPruebaCarga(cantidad)` para generar hasta 500 cuentas temporales distribuidas entre las UAD, sin usar datos personales ni guardar la contraseña en el código.
- Añade `eliminarUsuariosPruebaCarga()` para retirar únicamente registros identificados con el prefijo interno `LOADTEST-`, junto con su progreso, Bonus, sesiones, recuperaciones y evidencias.
- Incorpora `npm run test:load`, que ejecuta las etapas 5, 25, 50, 100, 200 y 300 contra la implementación real y genera métricas p50, p95, p99, reintentos y errores por operación.
- El modo de escritura es optativo. Permite ensayar inicio de misión, sellado y Bonus únicamente con las cuentas temporales; al terminar debe ejecutarse la limpieza desde Apps Script.

## Revisión 3.2.25 — Carga confiable de Apps Script

- `config.js` se solicita antes de montar React y con un identificador variable para impedir que GitHub Pages, el navegador o un proxy reutilicen una copia anterior con `apiUrl` vacío.
- El inicio de sesión ahora diferencia configuración ausente, archivo no cargado y URL con formato inválido. En cualquiera de esos casos bloquea ingreso, registro y recuperación y muestra un aviso claro.
- Se eliminó el acceso de demostración: ninguna credencial local puede simular una conexión correcta ni abrir el panel sin validación del backend.
- No cambia hojas ni datos. Publique todos los archivos del frontend; si ya usa la revisión 3.2.24 del backend, la actualización de `Code.gs` es opcional y solo cambia el número informado por el diagnóstico.

## Revisión 3.2.24 — Conexión controlada por el administrador

- Se eliminan el botón **Revisar conexión con Apps Script**, el campo de URL y la acción **Validar y guardar** del inicio de sesión.
- La aplicación ignora cualquier URL de Apps Script que hubiera quedado guardada anteriormente en el navegador. La única conexión válida se lee desde `public/config.js`.
- La configuración publicada queda congelada durante la ejecución para evitar modificaciones accidentales desde componentes de la interfaz. Un usuario solo podría alterar temporalmente su propia copia mediante herramientas del navegador; nunca cambia la configuración publicada ni los datos de otros usuarios.
- Esta revisión no cambia columnas ni datos. Si ya ejecutó `setupPasaporteSeguro()` con la versión 3.2.23, no necesita volver a ejecutarlo; publique el frontend actualizado. Puede actualizar también `Code.gs` para que el diagnóstico muestre 3.2.24.
- `npm test` ejecuta ahora 14 pruebas, incluida una regresión que impide volver a introducir el selector de conexión o una URL tomada de `localStorage`.

## Revisión 3.2.23 — Estabilidad para picos de 300 dispositivos

- El inicio de sesión ya no crea una fila en `Sesiones`: usa tokens firmados con vencimiento de 12 horas. Esto elimina una escritura y el bloqueo asociado por cada ingreso. Cambiar contraseña, editar o desactivar un usuario incrementa `SessionVersion` y revoca de inmediato sus tokens.
- `prepararEvento300Usuarios()` carga usuarios, misiones, insignias, catálogos, progreso y Bonus antes del evento. Progreso y Bonus se leen una sola vez en lote y se sirven durante diez minutos desde snapshots; si la caché no admite el tamaño, la función lo informa en vez de declarar una preparación falsa.
- La aplicación no repite `getMissions` después del bundle de ingreso. Las sincronizaciones de fondo se distribuyen entre 2 y 3,5 minutos por dispositivo, se pausan fuera del recorrido y conservan actualización manual, foco y reconexión.
- Login y recuperación de sesión usan reintentos con espera exponencial y dispersión aleatoria. Las escrituras conservan el mismo `requestId`, por lo que una respuesta perdida no repite la operación mientras su resultado está registrado.
- Guardar progreso, evidencias y récords protege las filas nuevas con bloqueo corto. Las misiones son monotónicas: una solicitud atrasada de «iniciar» nunca devuelve una misión completada a estado iniciado.
- El frontend distingue errores transitorios de cuota, red o servidor de errores definitivos de credenciales y validación. Solo los primeros se reintentan.

### Publicar y preparar esta revisión

1. Publique el frontend actualizado y reemplace Apps Script con `apps-script/Code.gs`.
2. Ejecute **una vez** `setupPasaporteSeguro()`. Agrega únicamente `SessionVersion` a `Usuarios` y crea el secreto de firma; no borra datos. Las sesiones antiguas siguen siendo aceptadas temporalmente.
3. Cree una nueva versión de la implementación de Apps Script conservando la URL `/exec`.
4. Entre 1 y 5 minutos antes del ingreso masivo, ejecute `prepararEvento300Usuarios()`. Debe responder «Preparación completa» con los conteos. Si indica caché incompleta, vuelva a ejecutarla y escalone el ingreso.
5. Compruebe una cuenta normal, una cuenta administrativa, una misión con sello y un récord Bonus antes de abrir el acceso general.

### Alcance de la validación

`npm test` ejecuta 13 pruebas: las 9 regresiones administrativas anteriores más distribución de 300 sincronizaciones, sesión firmada y revocación, progreso monotónico/idempotencia y snapshots de actividad sin búsquedas individuales. También se verificó la compilación de producción. La prueba de 300 es un modelo local determinista; la capacidad real de la implementación de Google debe medirse después de publicar con el procedimiento de `VALIDACION-300-DISPOSITIVOS.md`.

## Revisión 3.2.22 — Listas administrativas y asignación de misiones

- Misiones, insignias, usuarios, récords y progreso del resumen muestran **10 elementos por página**. Los controles aparecen a partir del elemento 11, permiten anterior/siguiente y seleccionar página. Cada lista conserva su página al cambiar de pestaña administrativa.
- Las búsquedas filtran la lista completa antes de paginar y vuelven a la primera página. Al borrar el último elemento de una página, la vista se ajusta a una página válida. El CSV y las estadísticas siguen usando todos los colaboradores.
- Se unifica la comparación de UAD en servidor, menús, mapa, validación del sello y resumen: espacios repetidos, mayúsculas y tildes ya no ocultan asignaciones. Una audiencia vacía o una UAD distinta **no** concede acceso. No se eliminan prefijos como «UAD».
- Administración consulta las UAD reales del catálogo y de usuarios activos. La creación y edición de misiones validan la audiencia en el servidor y guardan su nombre canónico. Se preserva el valor de los selectores al editar registros antiguos; no se convierte silenciosamente en «Todas las UAD».
- Cada misión muestra cuántos colaboradores activos no administradores la recibirán; se advierte cuando son cero. Una UAD válida sin colaboradores permite preparar misiones para registros futuros.
- Las sesiones abiertas consultan solo las asignaciones al entrar en las páginas del recorrido, al recuperar foco y cada minuto. Las lecturas se deduplican y limitan a una cada 30 segundos, salvo el botón **Actualizar misiones**. No hay sondeo durante Bonus, Administración ni con la pestaña oculta. No se reemplazan puntuaciones ni progreso con respuestas de esta consulta.
- El botón general «Misiones» elimina filtros de estación anteriores. Si una estación no tiene resultados, se ofrece volver a todas las misiones. Ante un error de sincronización se conserva la lista anterior y se muestra el error en Misiones.
- **Actualizar datos** en Administración invalida la caché de misiones y catálogos para recuperar también cambios directos en la hoja. Una lista vacía del servidor ahora reemplaza correctamente la lista anterior.

### Publicar esta revisión

1. Conserva la URL actual de `public/config.js` y publica el código web actualizado.
2. Copia `apps-script/Code.gs` en el proyecto de Apps Script vinculado a tu hoja.
3. En **Implementar → Administrar implementaciones → Editar**, selecciona **Nueva versión** y actualiza la implementación existente, conservando la misma URL `/exec`. Guardar el archivo sin actualizar la implementación no activa los cambios.
4. Esta revisión no cambia las columnas ni borra datos. Si ya usabas 3.2.21, no requiere volver a ejecutar `setupPasaporteSeguro()`.
5. Recarga el sitio y pulsa **Administrar → Actualizar datos**.

### Comprobación después de publicar

- Con 11 o más elementos, revisa las páginas de las cuatro listas y busca un registro que esté en la última página. Verifica que el CSV siga incluyendo todos los usuarios.
- Crea una misión para una UAD real. Con una cuenta de esa UAD ya abierta, pulsa **Misiones → Actualizar misiones**: debe aparecer. Con una cuenta de otra UAD no debe mostrarse ni permitir iniciar o sellar esa misión.
- Cambia la audiencia a otra UAD, repite la actualización en ambas cuentas y verifica también el mapa del tablero. Si corriges la UAD del usuario, la edición mantiene la política de seguridad existente: cierra sus sesiones y deberá ingresar de nuevo.
- Revisa las advertencias de «0 colaboradores»; si una UAD antigua está mal escrita, selecciónala nuevamente desde las opciones válidas y guarda la misión.

### Pruebas incluidas

`npm test` ejecuta 9 pruebas automáticas: límites de paginación, renderizado de listas, búsqueda global, ajuste tras eliminación, normalización y permisos de UAD, crear/reasignar/retirar con caché, lectura de cambios directos y limpieza/pausa de sincronización. Se usan datos simulados; no se modifican datos de producción. Compilación y sintaxis de Apps Script verificadas. La revisión visual en navegador y la integración contra la implementación real quedan pendientes de comprobar tras publicar.

> Revisión 3.2.21: la imagen 1+1=3 se integra de forma permanente en el encabezado de todas las páginas internas, dentro de un espacio propio que no cubre contenidos y se simplifica en móvil. Se precarga una sola vez y se reutiliza desde la caché del navegador. Se optimizan las lecturas repetidas, el guardado local de sesión, la precarga del módulo Bonus, las consultas por filas en Apps Script y el ranking. Los juegos pausan trabajo cuando la pestaña no está visible, liberan temporizadores al cerrarse y reutilizan fondos de canvas ya dibujados; el tiro al blanco reduce renderizados innecesarios.

> Revisión 3.2.17: se retira el contenedor flexible interno introducido en 3.2.16, porque podía crecer fuera del viewport y dejar el juego sin desplazamiento. Ahora todo el fondo del minijuego es la superficie desplazable, el modal comienza en la parte superior, conserva el encabezado visible y permite llegar sin bloqueo hasta los botones finales.

> Revisión 3.2.16: se corrige el encuadre de todos los minijuegos. El encabezado permanece visible y el contenido utiliza un área de desplazamiento vertical independiente, compatible con rueda, panel táctil y gestos móviles. Los resultados y botones finales ya no quedan cortados, incluso en pantallas de poca altura.

> Revisión 3.2.15: se corrige definitivamente la cara vacía de las cartas de Parejas del Festival. Las cartas ahora renderizan de forma condicional una sola cara, sin depender de capas y rotaciones 3D que algunos navegadores dejaban invisibles. Cada pareja muestra una ilustración SVG, nombre de la estación, color propio y confirmación visual al acertar.

> Revisión 3.2.14: se corrige el guardado de récords para distinguir correctamente un valor reiniciado en cero de un registro antiguo sin récord. Administración incorpora una sección de puntuaciones para buscar, reiniciar individualmente, restablecer todos los récords o eliminar un resultado completo. El ranking se refresca inmediatamente después de guardar y omite resultados reiniciados. Parejas del Festival reemplaza los símbolos por seis ilustraciones SVG temáticas, visibles y adaptables a móvil.

> Revisión 3.2.13: se añaden Carrera del Bosque, Parejas del Festival y Vuelo del Bienestar. Los juegos cuentan con dificultad progresiva, controles táctiles y de teclado, récord personal y un Salón de récords global cargado únicamente al abrir Bonus. La hoja `Bonus` incorpora la columna `Record`, por lo que es obligatorio ejecutar una vez `setupPasaporteSeguro()` después de reemplazar Apps Script.

> Revisión 3.2.12: zona Bonus más desafiante y dinámica. La sopa de letras ahora genera un tablero 10×10 distinto en cada partida, el sudoku pasa a 9×9 con solución única y el tiro al blanco incorpora 35 segundos, cinco dardos, selección de dirección y altura mediante dos puntos oscilantes y puntaje por cercanía al centro. Los juegos se procesan localmente y solo guardan el resultado final para no aumentar la carga del servidor.

> Revisión 3.2.11: recuperación de contraseña separada en tres pasos obligatorios: solicitar el código, validarlo y crear la contraseña. Apps Script genera un comprobante temporal de 10 minutos únicamente después de verificar el código y bloquea el cambio de contraseña cuando ese comprobante falta o vence. Conserva todas las mejoras visuales del certificado 3.2.10.

Al ejecutar `setupPasaporteSeguro`, las seis insignias iniciales que aún conservan exactamente sus colores antiguos pasan a la paleta corporativa. Las insignias creadas o personalizadas desde Administración no se modifican.

Esta versión conserva usuarios, misiones, sellos, evidencias, insignias y resultados existentes.

## Qué cambia

- Portada vibrante con la nueva ilustración optimizada a WebP (32 KB), paleta de los logos y composición específica para teléfonos.
- Avatar configurado durante la creación del pasaporte y animación de confirmación.
- Accesorios del avatar alineados y combinaciones incompatibles controladas.
- Certificado A4 descargable sin avatar, con nombre destacado, medalla de puntos, cuadrícula de sellos, colección de insignias, logos y ajuste automático de textos largos.
- Recuperación de contraseña por correo y código de respaldo administrativo.
- Creación y edición de insignias operativas.
- Edición y eliminación segura de usuarios desde Administración.
- Inicialización automática y cacheada de las hojas nuevas para evitar consultas repetidas.
- Gestión administrativa de récords, con reinicio a cero conservando puntos y eliminación total del resultado.
- Ilustraciones vectoriales propias para las cartas de Parejas del Festival.

## Publicar sin perder datos

1. Conserve el valor actual de `public/config.js`; allí está la URL `/exec` de su instalación.
2. Reemplace el contenido del proyecto web por esta versión.
3. En el Apps Script vinculado a la hoja, reemplace `Code.gs` por `apps-script/Code.gs`.
4. Guarde y ejecute una vez `setupPasaporteSeguro`. Autorice el envío de correo si Google lo solicita.
5. Cree una **nueva versión** de la implementación web de Apps Script. Mantenga el acceso para cualquier persona y use la URL terminada en `/exec`.
6. Publique el sitio web y pruebe en una ventana privada.

Si el sitio indica que no encuentra Apps Script, el administrador debe corregir `apiUrl` en `public/config.js` y volver a publicar. Por seguridad, los participantes no pueden reemplazar esa dirección desde el inicio de sesión.

La migración agrega solamente las hojas o columnas faltantes. No borra filas existentes.

## Verificación rápida

1. Cree un pasaporte y personalice el avatar antes de enviarlo.
2. Confirme la animación “Listo para viajar por el mundo del autocuidado”.
3. Solicite un código desde “¿Olvidaste tu contraseña?”, introdúzcalo en el segundo paso y confirme que el formulario de contraseña solo aparece después de validarlo.
4. Como administrador, cree una insignia con icono y dos colores.
5. Edite un usuario, genere su código de respaldo y elimine un registro de prueba.
6. Complete el recorrido y descargue el certificado PDF.

Si el correo no puede enviarse por restricciones de la cuenta de Google, el administrador puede generar un código de respaldo de 24 horas desde **Administrar → Usuarios → Respaldo**.
