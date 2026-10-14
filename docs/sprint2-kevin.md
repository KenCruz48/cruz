# RaceTrack API · Sprint 2 · Kevin Cruz

Fecha de implementación: 14 de octubre de 2026. Destino de integración: `develop`.

## Entregables

| Ticket | Implementación | Verificación |
| --- | --- | --- |
| RACE-10 / RACE-29 / RACE-30 | Modelo Event, servicios públicos paginados, rutas y controlador de consulta. | Listado, detalle, 400, 404 y proyección sin datos privados. |
| RACE-16 | Reserva de cupos atómica dentro de una transacción MongoDB. | Límite exacto, agotado, cancelado/pasado; concurrencia y rollback reales en Atlas. |
| RACE-17 | Listado de inscripciones activas por evento, visible solo al organizador. | 200/400/401/403/404 y exclusión de email/hash. |
| RACE-41 | Login por capas y generación/validación de JWT. | Login válido/inválido, algoritmo, firma, expiración, audiencia, emisor y cuenta inactiva. |
| RACE-43 | Configuración development/test/production histórica. | Suite de ambientes conservada; plantillas completadas con BD y expiración JWT. |
| RACE-47 | GitHub Actions Node 22/24. | Suite reproducible sin credenciales de Atlas; evidencia en Checks del PR. |
| RACE-52 | Procedimiento de acceso del equipo a Atlas. | El cierre exige invitaciones enviadas y aceptadas, verificadas en Users. |
| RACE-53 | Roadmap, comandos, arquitectura, endpoints e integración. | README y este contrato; revisión mediante PR a develop. |

No se cierran automáticamente tickets de Alexis o Vanessa, ni se atribuye a ellos
este código. Los fixtures de QA son datos de prueba y no representan su trabajo.

## Contrato Event para RACE-11/12

Campos: `name`, `date` (fecha ISO), `location`, `distance` (km, número positivo),
`capacity` (entero positivo), `registeredCount` (entero, inicial 0), `status`
(`active`/`cancelled`) y `owner` (ObjectId del usuario organizador autenticado).
El controlador de creación debe tomar `owner` del JWT, nunca del cuerpo enviado.
No debe aceptar `registeredCount` del cliente. Al modificar `capacity`, no debe
reducirse por debajo del contador actual; esa actualización debe ser atómica.
Las lecturas de Kevin devuelven solo una selección pública de campos.

## Contrato Registration para RACE-14/15/18

Campos del modelo compartido: `event`, `participant`, `category` opcional,
`status` (`active`/`cancelled`), timestamps. No existe aún un endpoint POST.
Alexis conserva la validación de categoría/participante y el registro RACE-14;
Vanessa conserva duplicados RACE-15 y cancelación RACE-18.

```js
const { withReservedCapacity } = require('../services/capacityService');
const Registration = require('../models/registrationModel');
// Validar primero identidad y categoria conforme a RACE-14.
return withReservedCapacity(eventId, async session => {
  const [registration] = await Registration.create([
    { event: eventId, participant: authenticatedUserId, category: categoryId },
  ], { session });
  return registration;
});
```

No añadir otro incremento de cupos al POST. No capturar un error del escritor para
devolver éxito: debe propagarse para abortar. El callback puede ser reintentado por
MongoDB; no enviar correos ni efectos externos dentro de la transacción.
RACE-15 debe definir el índice único parcial `(event, participant)` para activos.
RACE-18 debe cancelar y decrementar el contador en una misma transacción, una sola
vez, manteniendo el historial. Son puntos de integración pendientes del equipo.

## Contrato JWT para RACE-42

`authService.authenticate(token)` devuelve `{ id, name, email }` únicamente para
JWT válido y usuario activo. Vanessa puede usarlo desde su middleware para establecer
`req.user`. No modificar los claims `iss`, `aud`, `sub` ni aceptar otros algoritmos.
El endpoint de participantes ya usa el validador directamente y valida `Event.owner`.
Al conectar el middleware común se conserva la comprobación de dueño.

## Atlas y ambientes

1. Project Identity & Access → Users → comprobar Kevin, Alexis y Vanessa.
2. Invitar los correos confirmados al proyecto RaceTrack API con permisos mínimos
   para su trabajo; los integrantes deben aceptar desde sus propias cuentas.
3. Project Data Access Read/Write permite consultar/modificar datos; no requiere
   conceder Owner, administrar usuarios, facturación ni ampliar redes.
4. Database & Network Access → autorizar la IP de cada desarrollador y configurar
   acceso de BD privado. No publicar credenciales compartidas ni habilitar toda
   Internet como solución automática.
5. Completar `.env.development` local; comparar el nombre de BD esperado. La URI
   previa conectaba a `test`; una BD distinta debe elegirse explícitamente y no
   implica migración automática de los datos existentes.
6. Ejecutar `/health`; conservar evidencia de Users y conexión sin mostrar secretos.

La cuenta de Vanessa aparece como `lizeth en` en Jira y `pochis172` en GitHub;
su nombre para la entrega es Vanessa Ruiz. La aceptación de invitaciones sigue
siendo una acción de cada integrante, no un criterio que se pueda simular.

## Evidencia reproducible

`npm test` verifica el alcance local y conserva las pruebas existentes.
`scripts/verify-kevin-atlas.js` usa `racetrack_qa_kevin` o una BD cuyo nombre comience
por `racetrack_qa_`; crea fixtures con IDs propios y los elimina al terminar.
Valida login, eventos, cupo concurrente, rollback y autorización de participantes.
El reporte de entrega registra resultados observados, PR y estado de CI sin secretos.

## Sustentación de Kevin

Mostrar Jira con sus tareas y el PR hacia develop; explicar routes/controllers/services/models.
Ejecutar `npm test` y enseñar Checks. Mostrar GET eventos y detalle, un ID incorrecto
(400) y uno inexistente (404). Ejecutar la verificación Atlas para evidenciar cupos
concurrentes y rollback. Explicar el contrato que Alexis y Vanessa deben integrar.
Mostrar Users de Atlas solo cuando el acceso de todos esté confirmado.
