# Actualización segura a Pasaporte Seguro 3.2

> Revisión 3.2.3: el acceso de la portada funciona como enlace real con respaldo por URL. Se eliminó la inclinación geométrica en PC que podía cancelar el clic; si el evento interactivo fuera bloqueado, la navegación abre igualmente el formulario de acceso al recargar.

Esta versión conserva usuarios, misiones, sellos, evidencias, insignias y resultados existentes.

## Qué cambia

- Portada vibrante con la nueva ilustración optimizada a WebP (32 KB), paleta de los logos y composición específica para teléfonos.
- Avatar configurado durante la creación del pasaporte y animación de confirmación.
- Accesorios del avatar alineados y combinaciones incompatibles controladas.
- Certificado final descargable como PDF, con avatar y composición mejorados.
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

La migración agrega solamente las hojas o columnas faltantes. No borra filas existentes.

## Verificación rápida

1. Cree un pasaporte y personalice el avatar antes de enviarlo.
2. Confirme la animación “Listo para viajar por el mundo del autocuidado”.
3. Solicite un código desde “¿Olvidaste tu contraseña?” y complete el cambio.
4. Como administrador, cree una insignia con icono y dos colores.
5. Edite un usuario, genere su código de respaldo y elimine un registro de prueba.
6. Complete el recorrido y descargue el certificado PDF.

Si el correo no puede enviarse por restricciones de la cuenta de Google, el administrador puede generar un código de respaldo de 24 horas desde **Administrar → Usuarios → Respaldo**.
