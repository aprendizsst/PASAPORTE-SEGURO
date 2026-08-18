# Actualización segura a Pasaporte Seguro 3.1

Esta versión conserva usuarios, misiones, sellos, evidencias y resultados existentes.

## 1. GitHub

Reemplace el código del proyecto con este paquete, pero **conserve su archivo actual `public/config.js`** porque allí ya está la URL real de Apps Script terminada en `/exec`.

Si reemplazó accidentalmente `public/config.js`, vuelva a pegar la URL pública antes de publicar.

## 2. Google Apps Script

1. Reemplace todo `Code.gs` con `apps-script/Code.gs`.
2. Guarde.
3. Ejecute una sola vez `setupPasaporteSeguro` y autorice el envío de correo si Google lo solicita.
4. Abra **Implementar → Gestionar implementaciones**.
5. Edite la aplicación web, seleccione **Nueva versión** y pulse **Implementar**.
6. Confirme que el acceso siga configurado para **Cualquier persona**.

La migración crea `Insignias` y `Recuperaciones`, agrega las columnas que falten y no elimina filas existentes.

## 3. Pruebas mínimas

1. Abra la URL `/exec` en incógnito y confirme que muestra `status: ready`.
2. Inicie sesión con un usuario existente.
3. Compruebe que aparezcan las seis islas, incluida Ambiental.
4. Pruebe **¿Olvidaste tu contraseña?** con el correo registrado.
5. Ingrese como administrador y abra **Insignias** y **Usuarios**.
6. Genere un código de respaldo para un usuario de prueba y restablezca su contraseña.

La eliminación de usuarios es segura: anonimiza la cuenta y libera la cédula y el correo para un nuevo registro, mientras conserva los sellos históricos sin datos personales.
