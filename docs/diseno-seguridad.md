# Interfaz y seguridad de RaceTrack

## Diseño

Navegación horizontal superior por preferencia del usuario, con acceso a vista
general, eventos, inscripción y clasificación. La cabecera se mantiene disponible
al desplazarse; en pantallas pequeñas el menú sigue siendo horizontal y permite
desplazamiento dentro de su fila.

Paleta: azul profundo `#142335`, superficie `#f5f6f8`, tarjetas blancas y acento
naranja `#f26445`. Verde, azul y violeta se reservan para indicadores secundarios.
Tipografía Segoe UI/system-ui instalada en el dispositivo, sin Google Fonts ni
peticiones a terceros. Iconos SVG locales y una ilustración vectorial propia.

Los indicadores proceden de la API. Eventos y plazas corresponden a la página
consultada; la tarjeta de inscripción corresponde a la sesión actual y no implica
un historial persistente. Los estados sin datos no se rellenan con carreras falsas.
La búsqueda/distancia filtran la página visible; los resultados deportivos se
consultan con paginación real del servidor y muestran empates por posición.

Se conservan etiquetas, navegación por teclado, mensajes aria-live, foco visible,
enlace para saltar contenido y reducción de movimiento según preferencias del sistema.

## Controles revisados

- Crear, modificar y desactivar categorías exige Bearer JWT de usuario activo.
  El catálogo público sigue disponible. Esto exige autenticación, sin introducir
  una distinción de roles que el modelo de usuarios actual no contempla.
- CSP restringe recursos y conexiones al mismo origen y bloquea objetos/iframes.
  Nosniff, política de referencia, aislamiento de ventana y permisos de dispositivos.
- Se oculta X-Powered-By y las respuestas API llevan Cache-Control: no-store.
  HSTS se emite solo cuando la petición llega por HTTPS.
- El JSON está limitado a 32 KiB. Los errores de parsing/tamaño no reflejan su cuerpo
  ni posibles credenciales; los arrays como cuerpo API se rechazan.
- Login/registro aceptan como máximo 20 peticiones POST por IP cada 15 minutos.
  Se devuelve 429 con Retry-After. El almacén tiene límite de claves y caducidad;
  no se confía en X-Forwarded-For proporcionado por el cliente.
- El limitador es local a un proceso; un despliegue con varias instancias necesita
  un almacén compartido y una política explícita de proxy. No se presenta como WAF.
- Contraseñas de más de 72 bytes se rechazan para evitar truncado silencioso bcrypt;
  correos limitados a 254 caracteres.
- Token solo en memoria: no localStorage, sessionStorage ni cookies. Logout/vencimiento
  limpia credenciales y estado del usuario. El servidor sigue verificando cada JWT.
- Nombres, ubicaciones y resultados se renderizan con textContent, sin HTML del servidor.
  Solicitudes con timeout y protección contra respuestas antiguas de catálogo/ranking.

## Validación

`npm test` incluye regresión y casos de seguridad HTTP: cabeceras, categorías sin
autenticación, JSON malformado sin reflejo de secretos, límite de cuerpo, expiración
del limitador y límite bcrypt. `npm run qa:acceptance` comprueba el flujo UI con
Selenium/POM, integración, Newman autenticado y JMeter sobre MongoDB QA aislado.
La colección Postman usa `{{token}}` en mutaciones de categorías; no almacena tokens
reales. El ejecutor QA genera su token exclusivamente para el ambiente desechable.

No se modificaron datos reales de Atlas ni se cambiaron roles de sus usuarios.
Las credenciales expuestas anteriormente en capturas deben rotarse en Atlas;
mejorar el cliente no revoca por sí mismo una contraseña de base de datos.
