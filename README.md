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

## Entrega actual y verificación de los tres sprints

El código integrado incluye eventos, categorías, usuarios/JWT, inscripciones,
cancelaciones, resultados, clasificación y un cliente HTML/JS en `/`.
La revisión final incorpora el flujo de resultados de `develop`, el cliente
RACE-48, automatización Selenium/POM RACE-49 y ejecución reproducible de QA RACE-51.

```powershell
npm ci
npm test
# Java 17+ y Apache JMeter 5.6.3 deben estar instalados para la aceptación completa.
$env:JAVA_HOME = 'C:\ruta\jdk-17'
$env:JMETER_HOME = 'C:\ruta\apache-jmeter-5.6.3'
npm run qa:acceptance
npm run regression -- --require-team
```

`qa:acceptance` inicia una réplica MongoDB 7.0.14 local desechable, crea fixtures,
ejecuta HTTP con transacciones reales, Newman, Chrome/Selenium y JMeter y cierra
la réplica. La primera ejecución descarga MongoDB y ChromeDriver; necesita red.
No utiliza Atlas. Admite `MONGOMS_SYSTEM_BINARY`, `CHROME_BINARY` y
`CHROMEDRIVER_PATH` para instalaciones locales. Las pruebas y sus salidas se
documentan en [validación final](docs/validacion-final.md).

El servidor normal sigue usando la URI privada de Atlas. Por decisión del usuario
del 26/10/2026, **Atlas queda exclusivamente a cargo de Kevin**; el acceso de Alexis
y Vanessa no forma parte de RACE-52. No se crean invitaciones ni se amplía la red.

## Roadmap y alcance histórico del Sprint 2 de Kevin (RACE-53)

| Sprint | Objetivo | Responsables |
| --- | --- | --- |
| 1 | Servidor Express, Atlas, estructura por capas, errores y flujo Jira/GitHub. | Kevin, Alexis y Vanessa; revisión histórica completada. |
| 2 | Eventos/categorías, inscripciones, autenticación, Postman, integración y CI. | Kevin: RACE-10/29/30, RACE-16, RACE-17, RACE-41, RACE-43, RACE-47, RACE-52 y RACE-53. Alexis y Vanessa mantienen sus tickets. |
| 3 | Resultados, clasificación, cliente web, Selenium, JMeter y regresión final. | Integrados y verificables con `npm run qa:acceptance`. |

La configuración de ambientes RACE-43 ya fue integrada históricamente en el PR #9.
El incremento histórico de Kevin se complementó con creación/edición de eventos,
categorías, creación/cancelación de inscripciones, middleware JWT y Postman de los
otros integrantes. La revisión final conserva su autoría y agrega QA de integración.

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

### MongoDB Atlas administrado por Kevin (RACE-52)

Proyecto: RaceTrack API. Kevin administra la conexión y guarda la URI únicamente
en variables privadas. La consulta al conector de Atlas confirmó el proyecto y
Cluster0 activo el 26/10/2026. No equivale a una nueva ejecución de la API contra
Atlas: las pruebas finales aisladas usan MongoDB local. Los demás integrantes
no necesitan acceso a Atlas, conforme al alcance actualizado por el usuario.

## Sprint 3 de Kevin: clasificación y regresión

RACE-20 incorpora `GET /api/v1/events/:id/ranking` con podio, filtro `category`,
`page` y `limit`. Ordena por milisegundos, conserva empates de competición (1,1,3,4)
y excluye resultados inválidos, inscripciones canceladas o de otro evento. Es público
y no devuelve email ni hash. RACE-19 de Alexis conserva la escritura de resultados.

`npm run regression` ejecuta la suite completa y genera evidencia local con commit,
fecha y conteos. `npm run verify:ranking` prueba los joins y reglas reales en una BD
Atlas QA aislada, utilizando `ATLAS_ENV_FILE` privado. No altera datos del proyecto.

La contribución RACE-51 incluye manifiesto, guion y ejecución conjunta de Postman,
integración, Selenium/POM y JMeter. `npm run qa:acceptance` genera los originales
en `evidence/team/`; `npm run regression -- --require-team` detecta evidencia ausente
o inválida con código 2. La evidencia se genera de nuevo en el job de aceptación CI.

Contrato de datos, reglas completas, matriz de regresión y guion en
[Sprint 3 de Kevin](docs/sprint3-kevin.md).
