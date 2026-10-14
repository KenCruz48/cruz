# RaceTrack API

Backend para la gestión de eventos deportivos desarrollado con Node.js, Express y MongoDB Atlas.

## Sprint 1

Objetivo del Sprint 1:

- Configurar el servidor Node.js + Express.
- Implementar arquitectura por capas.
- Conectar MongoDB Atlas.
- Configurar variables de entorno.
- Implementar manejo global de errores.
- Integrar Jira con GitHub.

## Gestión ágil

Proyecto Jira: RaceTrack API

Las ramas, commits y Pull Requests deben incluir el identificador del ticket Jira.

Ejemplo:

feature/RACE-21-servidor-express

## Ejecutar el servidor (RACE-21)

Requisito: Node.js 22 o superior con npm.

```powershell
npm ci
Copy-Item .env.development.example .env.development
npm start
```

El servidor utiliza el puerto 3000 por defecto. Para cambiarlo en PowerShell:

```powershell
$env:PORT = '3001'
npm start
```

`GET http://localhost:3000/health` responde HTTP 200 con `{"status":"ok"}`.

```powershell
Invoke-RestMethod http://localhost:3000/health
npm test
```

`npm run dev` reinicia el servidor al cambiar los archivos.
`src/app.js` configura Express y las rutas; `src/server.js` inicia el servidor HTTP.
La prueba de integración abre un puerto disponible y verifica la respuesta de `/health`.

## Variables de entorno (RACE-24)

Ejecuta los comandos desde la raíz del repositorio. Si ya tienes `.env`, conserva
ese archivo y completa únicamente las variables que falten.
Antes de ejecutar `npm start`, configura tu URI de Atlas en el `.env` local.

| Variable | Uso |
| --- | --- |
| `PORT` | Puerto HTTP opcional; por defecto `3000`. |
| `MONGODB_URI` | URI de MongoDB Atlas obligatoria; el ejemplo la deja vacía. |
| `MONGODB_DB` | Nombre explícito de BD opcional; si se omite, conserva el de la URI. |
| `JWT_SECRET` | Secreto aleatorio local de al menos 32 bytes, obligatorio para login y validación JWT. |
| `JWT_EXPIRES_IN` | Duración del JWT; por defecto `1h`. |

El arranque carga `.env.<NODE_ENV>` antes de conectar MongoDB y abrir HTTP.
En development también admite el `.env` anterior. Las variables del sistema tienen prioridad.
Si falta `MONGODB_URI` o falla MongoDB, HTTP no inicia y el proceso termina con código 1.
`GET /health` queda disponible tras una conexión exitosa.

`.env` y `.env.*` están excluidos de Git; `.env.example` está permitido.
Guarda las credenciales exclusivamente en tu entorno o `.env` local.

## Roadmap y alcance del Sprint 2 de Kevin (RACE-53)

| Sprint | Objetivo | Responsables |
| --- | --- | --- |
| 1 | Servidor Express, Atlas, estructura por capas, errores y flujo Jira/GitHub. | Kevin, Alexis y Vanessa; revisión histórica completada. |
| 2 | Eventos/categorías, inscripciones, autenticación, Postman, integración y CI. | Kevin: RACE-10/29/30, RACE-16, RACE-17, RACE-41, RACE-43, RACE-47, RACE-52 y RACE-53. Alexis y Vanessa mantienen sus tickets. |
| 3 | Resultados, clasificación, cliente web, Selenium, JMeter y regresión final. | Según el Sprint 3 de Jira; no se implementa aquí. |

La configuración de ambientes RACE-43 ya fue integrada históricamente en el PR #9.
Este incremento implementa solo el alcance de Kevin. No incluye creación/edición
de eventos (Alexis), categorías (Vanessa), creación/cancelación de inscripciones,
middleware JWT común, Postman ni las pruebas globales de los otros integrantes.

### Arquitectura

`routes → controllers → services → models → MongoDB Atlas`.
`app.js` exporta Express; `server.js` carga el ambiente, conecta Atlas y abre HTTP.
La validación de JWT vive en `authService`, y el login en `authController`.
El listado de participantes usa ese validador y comprueba el dueño del evento;
Vanessa podrá conectar su middleware RACE-42 al mismo servicio.

### Ejecutar por ambiente

```powershell
npm ci
Copy-Item .env.development.example .env.development
# Completar MONGODB_URI y JWT_SECRET en el archivo local.
npm start
npm test
Copy-Item .env.production.example .env.production
# Completar configuración privada antes de ejecutar:
npm run start:production
```

Para generar un secreto local: `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"`.
No pegues su resultado en GitHub, Jira ni en una presentación. Los archivos de
ambiente reales permanecen ignorados; las plantillas no contienen credenciales.
Elegir una nueva `MONGODB_DB` no migra la información de la BD anterior.

### API disponible de Kevin

| Método y ruta | Acceso | Respuesta |
| --- | --- | --- |
| `POST /api/v1/users/login` | Correo y contraseña de usuario activo registrado | 200: `data.token` y perfil sin hash; credenciales incorrectas: 401. |
| `GET /api/v1/events` | Público | 200: `data.events`, `page`, `limit`. Filtros: `status=active/cancelled`, `page`, `limit` (máximo 100). |
| `GET /api/v1/events/:id` | Público | 200: evento; ID incorrecto: 400; inexistente: 404. |
| `GET /api/v1/events/:id/participants` | `Authorization: Bearer <token>` del dueño del evento | 200: participantes activos sin correo ni hash; anónimo/token inválido: 401; otro usuario: 403. |

El JWT usa HS256, emisor `racetrack-api`, audiencia `racetrack-client`,
`sub` como ID del usuario y expiración. Se verifica firma, algoritmo, audiencia,
emisor, expiración y que el usuario siga activo. No hay un secreto de respaldo.

### Cupos e integración con Alexis

RACE-16 exporta `withReservedCapacity(eventId, persistRegistration)`.
La reserva incrementa `registeredCount` únicamente si el evento sigue activo,
no ha iniciado y el contador es menor que `capacity`. El escritor de RACE-14
debe guardar la inscripción con la **misma sesión**, dentro de la transacción.
Si el escritor falla, MongoDB revierte también el incremento. Véase
[contrato de integración](docs/sprint2-kevin.md).

### Pruebas y Continuous Testing (RACE-47)

`npm test` ejecuta pruebas unitarias y HTTP con dobles controlados sin Atlas
ni secretos de producción. GitHub Actions ejecuta `npm ci` y `npm test` con
Node 22 y 24 en pushes y PRs hacia `develop`/`main`; un fallo bloquea el job.
Los resultados se consultan en la pestaña Checks del PR o Actions del repositorio.

La verificación opcional real de Atlas usa únicamente una BD `racetrack_qa_*`:

```powershell
$env:ATLAS_ENV_FILE = 'C:\ruta\privada\atlas-credentials.env'
$env:MONGODB_DB = 'racetrack_qa_kevin'
node scripts/verify-kevin-atlas.js
```

Crea sus propios IDs, prueba lectura, login, autorización, concurrencia y rollback,
y elimina exclusivamente sus fixtures al terminar. No elimina bases ni datos del
proyecto. Esta prueba no crea el endpoint de inscripción asignado a Alexis.

### Flujo Scrum

Kevin es Scrum Master. Flujo vigente: Jira → rama `feature/RACE-<ticket>-...`
desde `develop` → commit con clave → push → PR hacia `develop` → revisión técnica
del Scrum Master → merge. `main` se utiliza para versiones revisadas. Tener código
local o CI verde no equivale a aprobación humana. Las incidencias se cierran cuando
sus criterios de aceptación, revisión e integración se hayan cumplido.

### MongoDB Atlas compartido (RACE-52)

Proyecto: RaceTrack API. Kevin conserva el rol Project Owner. Las invitaciones de
Alexis y Vanessa requieren permisos de proyecto apropiados y aceptación de ambos.
Comprueba Members/Users en Project Identity & Access antes de cerrar RACE-52.
No confundas las cuentas de Atlas con los usuarios deportivos de la aplicación.
Los secretos se entregan por un canal privado y se configura la IP autorizada de
cada desarrollador. No se incluyen URI, claves ni invitaciones aceptadas ficticias
en el repositorio. La documentación de acceso está en `docs/sprint2-kevin.md`.
