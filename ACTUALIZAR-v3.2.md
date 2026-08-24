# Actualización segura a Pasaporte Seguro 3.2

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

## Publicar sin perder datos

1. Conserve el valor actual de `public/config.js`; allí está la URL `/exec` de su instalación.
2. Reemplace el contenido del proyecto web por esta versión.
3. En el Apps Script vinculado a la hoja, reemplace `Code.gs` por `apps-script/Code.gs`.
4. Guarde y ejecute una vez `setupPasaporteSeguro`. Autorice el envío de correo si Google lo solicita.
5. Cree una **nueva versión** de la implementación web de Apps Script. Mantenga el acceso para cualquier persona y use la URL terminada en `/exec`.
6. Publique el sitio web y pruebe en una ventana privada.

Si el sitio indica que no encuentra Apps Script aunque la implementación esté publicada, pulse **Revisar conexión con Apps Script** debajo del inicio de sesión, pegue la URL `/exec` y seleccione **Validar y guardar**. La URL verificada queda guardada en ese navegador y tiene prioridad sobre una copia antigua de `config.js`.

La migración agrega solamente las hojas o columnas faltantes. No borra filas existentes.

## Verificación rápida

1. Cree un pasaporte y personalice el avatar antes de enviarlo.
2. Confirme la animación “Listo para viajar por el mundo del autocuidado”.
3. Solicite un código desde “¿Olvidaste tu contraseña?”, introdúzcalo en el segundo paso y confirme que el formulario de contraseña solo aparece después de validarlo.
4. Como administrador, cree una insignia con icono y dos colores.
5. Edite un usuario, genere su código de respaldo y elimine un registro de prueba.
6. Complete el recorrido y descargue el certificado PDF.

Si el correo no puede enviarse por restricciones de la cuenta de Google, el administrador puede generar un código de respaldo de 24 horas desde **Administrar → Usuarios → Respaldo**.
