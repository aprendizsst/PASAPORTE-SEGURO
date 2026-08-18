# Pasaporte Seguro · Festival 2026

Versión completa de la aplicación web para GitHub Pages y Google Apps Script. Incluye:

- Portada tipo libro, logos JER y **De mí para mí**, apertura 3D y cierre animado de sesión.
- Registro e inicio de sesión con cédula y contraseña.
- Tablero personal, progreso, puntos, sellos, historial y logro final.
- Misiones para todas las UAD o para una UAD específica.
- Panel administrador con creación, eliminación segura y seguimiento de misiones.
- Creador de avatares con seis tonos de piel, siete colores de cabello, siete estilos de cabello, ocho colores de camiseta y ocho accesorios.
- Pestaña Bonus con sopa de letras, sudoku seguro y tiro al blanco.
- **Ruta Viva del Festival** con seis mundos, avance por estación y avatar viajero.
- Colección automática de seis insignias, sin agregar columnas al archivo de Google Sheets.
- Tarjeta final personalizada descargable en PNG, generada directamente en el dispositivo.
- Portada dinámica con profundidad, brillo, constelaciones y ruta de vuelo.
- Reporte administrativo CSV y actualización manual de estadísticas.
- Diseño adaptable para computadores, tabletas y teléfonos.
- Carga diferida de minijuegos, caché por usuario, restauración de sesión, reintentos progresivos e identificadores de operación para reducir cargas y duplicados.

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
5. Regrese a la hoja. Se habrán creado las pestañas `Usuarios`, `Misiones`, `Progreso`, `Sesiones`, `Catalogos` y `Bonus`.
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

## 3. Publicar la API

1. En Apps Script seleccione **Implementar → Nueva implementación → Aplicación web**.
2. En **Ejecutar como**, seleccione su cuenta.
3. En **Quién tiene acceso**, seleccione **Cualquier persona** para permitir el acceso de los colaboradores desde GitHub Pages.
4. Publique y copie la URL que termina en `/exec`.
5. Abra `public/config.js` y pegue la URL entre las comillas de `apiUrl`.
6. Cada vez que modifique `Code.gs`, cree una **nueva versión** de la implementación de Apps Script para que el sitio público use los cambios.

> El backend valida la sesión y el rol en cada operación administrativa. Las contraseñas no se guardan en texto visible.

### Actualización desde una versión anterior

Esta actualización no elimina ni renombra hojas, columnas o registros. Puede reemplazar `Code.gs`, guardar y ejecutar nuevamente `setupPasaporteSeguro`. La función conserva las hojas existentes y crea únicamente cualquier hoja faltante.

Las insignias y la tarjeta final se calculan usando `Misiones`, `Progreso` y `Bonus`; no requieren una pestaña adicional.

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

- Catálogos y misiones se comparten mediante caché.
- La primera lectura de actividad prepara cachés individuales para los demás participantes.
- Las estadísticas administrativas se reutilizan durante 30 segundos y se actualizan solo cuando el administrador lo solicita.
- Las escrituras repetidas llevan un identificador temporal para evitar duplicados durante reintentos.
- Las actualizaciones de filas se realizan en bloque.
- Los minijuegos cargan su código únicamente al abrir la pestaña Bonus.

Estas medidas reducen notablemente las consultas, pero Google Apps Script y Google Sheets conservan cuotas propias. Antes del evento se recomienda hacer una prueba de carga progresiva en una copia de la hoja y del despliegue, nunca directamente sobre los datos reales.

## Estructura de datos

- `Usuarios`: perfiles, UAD, rol y credenciales cifradas.
- `Misiones`: actividades, estación, puntos y audiencia (`Todas las UAD` o una UAD específica).
- `Progreso`: misiones iniciadas y completadas con fechas.
- `Sesiones`: tokens temporales de acceso.
- `Catalogos`: listas editables de cargos y UAD.
- `Bonus`: resultados y puntajes de los minijuegos.

## Verificación después de publicar

1. Abra **Actions** y espere que `Desplegar Pasaporte Seguro` aparezca en verde.
2. Abra el sitio publicado y actualice con `Ctrl + F5`.
3. Pruebe registro, inicio de sesión, cambio de avatar, una misión y un minijuego.
4. Revise la Ruta Viva, la pestaña Insignias y la descarga de la tarjeta final.
5. Ingrese como administrador y confirme que puede crear, eliminar y actualizar misiones, además de descargar el reporte CSV.
