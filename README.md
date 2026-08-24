# Pasaporte Seguro · Festival 2026

Versión completa de la aplicación web para GitHub Pages y Google Apps Script. Incluye:

- Portada tipo libro vibrante, optimizada para móviles y basada en la paleta roja, azul y rosa de los logos JER y **De mí para mí**.
- Registro e inicio de sesión con cédula y contraseña.
- Tablero personal, progreso, puntos, sellos, historial y logro final.
- Misiones para todas las UAD o para una UAD específica.
- Panel administrador con creación, edición, eliminación segura, códigos únicos y seguimiento de misiones.
- Creador de avatares 3D con seis tonos de piel, siete colores y estilos de cabello, ocho colores de camiseta, hasta tres accesorios simultáneos y colores independientes.
- Pestaña Bonus con sopa de letras, sudoku seguro y tiro al blanco.
- **Ruta Viva del Festival 3D** con las seis islas siempre visibles —incluida Ambiental—, nave espacial, avatar visible en la cabina y acceso filtrado a las misiones de cada estación.
- Colección de insignias administrable: creación, edición, retiro, 10 iconos, dos colores, criterios y metas configurables.
- Certificado A4 personalizado en PDF, con diseño editorial, avatar refinado, textos adaptables, sellos y logos integrados, generado directamente en el dispositivo.
- Sellado protegido por código único de misión y carga opcional u obligatoria de fotos o videos como evidencia.
- Portada dinámica con profundidad, brillo, acentos institucionales y acceso compatible con mouse, teclado y pantallas táctiles.
- Reporte administrativo CSV y actualización manual de estadísticas.
- Diseño adaptable para computadores, tabletas y teléfonos.
- Carga diferida de minijuegos, caché por usuario, restauración de sesión, reintentos progresivos e identificadores de operación para reducir cargas y duplicados.
- Inicio de sesión optimizado por búsqueda directa, reutilización segura de sesión y restauración instantánea desde el dispositivo.
- Interacciones optimistas para misiones, avatar y bonus: la pantalla responde primero y confirma el guardado en segundo plano.
- Gestión administrativa de usuarios con búsqueda, edición, eliminación anonimizada, códigos de respaldo y conservación del historial.
- Recuperación de contraseña por correo y código de respaldo de un solo uso generado por el administrador.

La eliminación administrativa desactiva la misión y conserva los registros históricos de los participantes.

## 0. Cómo subir correctamente este paquete

1. Descomprima el ZIP en su computador.
2. Abra la carpeta `PASAPORTE-SEGURO-COMPLETO`.
3. Suba **el contenido de la carpeta**, no el archivo ZIP y no una carpeta adicional, a la raíz del repositorio `PASAPORTE-SEGURO`.
4. Deben quedar visibles en la raíz: `.github`, `apps-script`, `public`, `src`, `index.html`, `package.json`, `package-lock.json`, `tsconfig.json` y `vite.config.ts`.
5. Conserve solamente `.github/workflows/deploy.yml`. Si existe otro archivo como `pages.yml`, elimínelo para evitar dos despliegues al mismo tiempo.

## 1. Preparar Google Sheets y Apps Script

1. Cree una hoja de cálculo nueva en Google Sheets.
2. Abra **Extensiones → Apps Script**.
3. Reemplace el contenido de `Code.gs` por el archivo `apps-script/Code.gs` de este proyecto.
4. Guarde y ejecute una vez la función `setupPasaporteSeguro`. Autorice el acceso solicitado.
5. Regrese a la hoja. Se habrán creado las pestañas `Usuarios`, `Misiones`, `Progreso`, `Sesiones`, `Catalogos`, `Bonus`, `Evidencias`, `Insignias` y `Recuperaciones`.
6. En `Catalogos`, reemplace los cargos y UAD de ejemplo por sus datos reales. Conserve `Tipo` como `CARGO` o `UAD` y `Activo` como `TRUE`.

## 2. Crear el primer administrador

En Apps Script, abra **Configuración del proyecto → Propiedades del script** y agregue:

- `ADMIN_CEDULA`
- `ADMIN_PASSWORD` (mínimo 8 caracteres)
- `ADMIN_NOMBRE`
- `ADMIN_CORREO`
- `ADMIN_UAD`
- `ADMIN_CARGO`

Ejecute una vez `crearAdministradorInicial`. Cuando confirme que el administrador puede ingresar, elimine la propiedad `ADMIN_PASSWORD`; la hoja conserva únicamente el hash seguro de la contraseña.

Si el administrador pierde el acceso y tampoco puede recibir el código por correo, cree temporalmente la propiedad `ADMIN_RESET_PASSWORD`, conserve `ADMIN_CEDULA` y ejecute `restablecerAdministradorDesdePropiedades`. La función cambia la contraseña, cierra las sesiones anteriores y elimina automáticamente la propiedad temporal.

## 3. Publicar la API

1. En Apps Script seleccione **Implementar → Nueva implementación → Aplicación web**.
2. En **Ejecutar como**, seleccione su cuenta.
3. En **Quién tiene acceso**, seleccione **Cualquier persona** para permitir el acceso de los colaboradores desde GitHub Pages.
4. Publique y copie la URL que termina en `/exec`.
5. Abra `public/config.js` y pegue la URL entre las comillas de `apiUrl`.
6. Cada vez que modifique `Code.gs`, cree una **nueva versión** de la implementación de Apps Script para que el sitio público use los cambios.

> El backend valida la sesión y el rol en cada operación administrativa. Las contraseñas no se guardan en texto visible.

La recuperación normal envía un código de un solo uso al correo registrado. Como respaldo, el administrador puede generar desde la pestaña **Usuarios** un código temporal válido por 24 horas. Ambos códigos se almacenan cifrados y se invalidan después de usarse.

### Actualización desde una versión anterior

Esta actualización no elimina ni renombra hojas, columnas o registros. Reemplace `Code.gs`, guarde y ejecute nuevamente `setupPasaporteSeguro` **una sola vez**. La función conserva las hojas existentes, agrega las columnas faltantes, crea `Evidencias`, `Insignias` y `Recuperaciones`, genera códigos de misión y carga las seis insignias iniciales.

La primera ejecución que reciba una evidencia solicitará permiso para Google Drive. Los archivos se guardan en la carpeta privada `PASAPORTE_SEGURO_EVIDENCIAS`; la hoja conserva únicamente sus metadatos y enlaces.

Las reglas visuales de las insignias se guardan en `Insignias`; el desbloqueo se calcula con `Misiones`, `Progreso` y `Bonus`, sin escribir una fila por usuario.

La Ruta Viva 3D también usa las misiones existentes: no crea hojas, columnas ni consultas adicionales. El viaje de la nave se ejecuta localmente y al llegar solo aplica el filtro de la estación seleccionada.

## 4. Publicar en GitHub Pages

1. Abra su repositorio de GitHub.
2. Suba a la raíz del repositorio todo el contenido de esta carpeta.
3. En el repositorio abra **Settings → Pages**.
4. En **Build and deployment → Source**, seleccione **GitHub Actions**.
5. Espere a que finalice el flujo **Desplegar Pasaporte Seguro**. GitHub mostrará la dirección pública del pasaporte.

## Uso local opcional

```bash
npm install
npm run dev
```

Sin una URL en `public/config.js`, la aplicación se abre en modo demostración. Para revisar el panel administrativo del modo demostración use cédula `1000000000` y contraseña `Demo1234*`.

## Activar o desactivar mejoras visuales

`public/config.js` incluye interruptores que permiten apagar una mejora sin borrar código:

```js
features: {
  dynamicCover: true,
  livingRoute: true,
  badges: true,
  downloadableCard: true,
}
```

Cambie únicamente `true` por `false` si necesita desactivar temporalmente una característica.

## Optimización y concurrencia

- El login consulta únicamente la columna y la fila del usuario solicitado; no vuelve a leer ni guardar en caché toda la hoja `Usuarios`.
- La estructura de las nueve hojas se valida durante `setupPasaporteSeguro`, no en cada clic del participante.
- Las sesiones válidas se reutilizan y su caché se conserva durante la actividad para evitar recorrer `Sesiones` repetidamente.
- El último tablero válido se muestra inmediatamente desde el dispositivo y se confirma en segundo plano con Apps Script.
- Los catálogos se solicitan solo cuando una persona abre el formulario de registro; no ralentizan el inicio de sesión.
- El panel administrativo calcula estadísticas únicamente al abrirlo o actualizarlo manualmente; no bloquea el ingreso del administrador.
- Catálogos y misiones se comparten mediante caché.
- El progreso y los bonus se buscan por usuario y solo se almacena en caché la actividad solicitada.
- Las estadísticas administrativas se reutilizan durante 30 segundos y se actualizan solo cuando el administrador lo solicita.
- Las evidencias no se descargan durante el login ni la navegación normal; el administrador consulta solo los 100 registros más recientes al abrir su panel.
- Las fotos se comprimen en el dispositivo hasta 1600 px antes del envío. Fotos y videos tienen un límite de 7 MB por evidencia.
- El código se valida antes de guardar el archivo y una misión completada no vuelve a duplicar evidencia durante un reintento.
- Las escrituras repetidas llevan un identificador temporal para evitar duplicados durante reintentos.
- Las actualizaciones de filas se realizan en bloque.
- Los minijuegos cargan su código únicamente al abrir la pestaña Bonus.
- Los tiempos de espera y reintentos son diferentes para login, lecturas y escrituras, evitando esperas acumuladas excesivas.

Estas medidas reducen notablemente las consultas, pero Google Apps Script y Google Sheets conservan cuotas propias. Antes del evento se recomienda hacer una prueba de carga progresiva en una copia de la hoja y del despliegue, nunca directamente sobre los datos reales.

## Estructura de datos

- `Usuarios`: perfiles, UAD, rol y credenciales cifradas.
- `Misiones`: actividades, estación, puntos, audiencia, código único y requisito de evidencia.
- `Progreso`: misiones iniciadas y completadas con fechas.
- `Sesiones`: tokens temporales de acceso.
- `Catalogos`: listas editables de cargos y UAD.
- `Bonus`: resultados y puntajes de los minijuegos.
- `Evidencias`: metadatos y enlaces privados de fotos o videos; el archivo binario se conserva en Google Drive.
- `Insignias`: diseño, icono, colores, criterio, meta y estado de cada reconocimiento.
- `Recuperaciones`: códigos cifrados de un solo uso, vencimiento, intentos y canal de recuperación.

## Verificación después de publicar

1. Abra **Actions** y espere que `Desplegar Pasaporte Seguro` aparezca en verde.
2. Abra el sitio publicado y actualice con `Ctrl + F5`.
3. Pruebe registro, inicio de sesión, cambio de avatar, una misión y un minijuego.
4. En la Ruta Viva 3D seleccione una estación, espere el viaje de la nave y confirme que se muestran únicamente las misiones de ese destino.
5. Ingrese como administrador y confirme que puede crear y editar una misión, administrar insignias, buscar usuarios, generar un código de respaldo y revisar Evidencias.
6. Inicie esa misión con un usuario, pruebe un código incorrecto y luego selle con el código correcto y una foto o video.
7. Desde la portada use **¿Olvidaste tu contraseña?** y compruebe el código recibido en el correo registrado.

Después de reemplazar `apps-script/Code.gs`, ejecute `setupPasaporteSeguro` una vez y cree una **nueva versión** de la implementación web. La migración conserva los registros existentes.
