# Sprint 3 · Entrega de Kevin Cruz

> Actualización 26/10/2026: el escritor RACE-19 está integrado en develop y la entrega
> final incorpora cliente web, Selenium/POM y ejecución conjunta de Newman/JMeter.
> `npm run qa:acceptance` genera las evidencias antes externas con datos QA aislados.
> Véase [validación final](validacion-final.md). Los pendientes de este documento
> describen la entrega histórica previa a esa integración.

Alcance: RACE-20 (clasificación/podios) y contribución de Kevin a RACE-51
(regresión y sustentación). Atlas queda a cargo del usuario desde su interfaz.

## Clasificación y podios

`GET /api/v1/events/:id/ranking?page=1&limit=20&category=<ObjectId opcional>`.
Consulta pública. Devuelve ranking paginado, total, podio y reglas; 400 para parámetros
inválidos, 404 para evento inexistente, 200 con listas vacías si no hay resultados.
Máximo 100 filas por página.

- Menor tiempo obtiene mejor posición; tiempos expresados en milisegundos enteros positivos.
- Empates por competición: 1000,1000,2000,3000 producen puestos **1,1,3,4**.
- Podio incluye puestos 1 a 3 y sus empates; puede contener más de tres participantes.
- Los empatados se muestran en orden estable por ID, sin alterar su posición deportiva.
- Puestos calculados antes de paginar. Filtrar categoría recalcula posiciones en esa categoría.
- Solo resultados `finished` con inscripción activa del mismo evento y participante existente.
- Se descartan negativos, cero, fracciones, texto, cancelaciones y referencias cruzadas.
- Una fila por inscripción: última versión válida/finalizada por `updatedAt` y `_id` descendentes.
- Podio acotado a 100 personas: `podiumCount` indica el total real y `podiumTruncated`
  avisa si hay más. El ranking paginado permite consultar a todos los empatados.

La respuesta expone ID de inscripción, ID/nombre del participante, categoría, tiempo y
puesto; no devuelve email ni hash. La consulta no escribe datos y limita la agregación
a 10 segundos.

## Contrato con RACE-19 de Alexis

El lector usa la colección `results`:

| Campo | Tipo y significado |
| --- | --- |
| `event` | ObjectId del evento |
| `registration` | ObjectId de inscripción existente en `registrations` |
| `timeMs` | Número entero positivo en milisegundos, hasta MAX_SAFE_INTEGER |
| `status` | `finished` para entrar en clasificación |
| `updatedAt` | Fecha BSON de la versión |

La inscripción tiene `event`, `participant`, `category` opcional y `status=active`;
su participante existe en `users`. Alexis conserva creación, validación, autorización
y persistencia del resultado. Aquí no se implementa su POST ni se cierra RACE-19.
Para eficiencia podrá crear un índice por evento/estado/fecha. Cualquier cambio en los
nombres de campo requiere acordar un adaptador antes de la integración.

Los fixtures de la verificación QA prueban el lector de Kevin independientemente de
la entrega del escritor; no se presentan como trabajo realizado por Alexis.

## Regresión RACE-51

```powershell
npm ci
npm test
npm run regression
$env:ATLAS_ENV_FILE = 'C:\ruta\privada\atlas-credentials.env'
npm run verify:ranking
node scripts/verify-kevin-atlas.js
```

La regresión genera TAP, stderr y JSON en `evidence/generated/`, registrando commit,
fecha, conteos y pendientes del equipo. Código 1: falló la suite de Kevin. Con
`npm run regression -- --require-team`, código 2: faltan evidencias externas o son
inválidas. `ready-for-team-review` solo significa formato/adjuntos presentes; sigue
requiriendo revisión técnica. Los originales y secretos no se versionan.

Las pruebas reales exigen una BD `racetrack_qa_*`, crean IDs propios y eliminan solo
sus fixtures. No sustituyen los datos de desarrollo ni introducen resultados reales.

### Selección justificada de regresión

| Riesgo | Cobertura |
| --- | --- |
| Romper el arranque | app/server, ambientes, URI ausente y cierre por fallo |
| Exponer datos ajenos | JWT, firma/expiración, usuario activo y dueño del evento |
| Consultas inválidas | IDs, filtros, paginación y errores JSON 400/404 |
| Inconsistencia de cupos | Reservas concurrentes y rollback real |
| Podios incorrectos | Orden, empates, categoría, versión vigente, vacío y paginación |
| Mezclar eventos | Join con inscripción activa del mismo evento |
| Certificar pruebas ausentes | Manifiesto y validación de reportes/adjuntos |

### Evidencias externas

`evidence/team-manifest.json` registra RACE-45 Postman (Vanessa), RACE-46 integración
(Alexis), RACE-49 Selenium (Alexis) y RACE-50 JMeter (Vanessa). Cada responsable debe
entregar su JSON y archivos originales en la carpeta local ignorada `evidence/team/`.

Formato común, completado con resultados reales:

```json
{
  "ticket": "RACE-45",
  "status": "passed",
  "commit": "SHA real de 40 caracteres",
  "generatedAt": "fecha ISO real de ejecucion",
  "command": "comando real ejecutado",
  "tests": { "total": 1, "passed": 1, "failed": 0 },
  "artifacts": ["evidence/team/archivo-original-del-ejecutor"]
}
```

Ese ejemplo describe el formato y no representa una ejecución. Conservar reporte
Newman/colección, pruebas/log de integración, reporte/capturas Selenium y plan
JMeter/JTL/resumen. Kevin revisará metodología, cobertura, ambiente, commit y métricas.
La comprobación de estructura y adjuntos no certifica el contenido de esas pruebas.
Mientras falten esos entregables, RACE-51 permanece pendiente de cierre global aunque
la automatización, organización y guion de Kevin estén entregados.

## Guion de sustentación de Kevin (6–8 minutos)

1. **Jira (1 min):** mostrar tickets propios, dependencias y PR hacia develop.
2. **Arquitectura (1 min):** recorrer ruta → controlador → servicio y joins MongoDB.
   Explicar la separación entre escribir resultados (Alexis) y consultarlos (Kevin).
3. **Reglas (1 min):** explicar tiempos, puestos 1,1,3,4 y empates en el podio.
4. **Regresión (1 min):** ejecutar `npm run regression`; mostrar conteos y pendientes.
5. **API/Atlas (2 min):** ejecutar `npm run verify:ranking`; demostrar categoría,
   página 2 con puestos absolutos, vacío, 400 y 404. Explicar la limpieza de fixtures.
6. **Cierre (1 min):** mostrar cupos/rollback del Sprint 2, Checks de GitHub y contrato
   que deben consumir los otros módulos. No describir reportes antiguos como ejecución en vivo.

Si Atlas falla en clase, usar la suite local y evidencia previa con su fecha/commit,
explicando que la comprobación remota en ese momento no fue posible.
