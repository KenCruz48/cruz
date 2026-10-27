# Validación final · RACE-48 / RACE-49 / RACE-50 / RACE-51 / RACE-52

## Alcance y ejecución

El cliente de `/` consume la misma API: login/registro, catálogo paginado,
inscripción por categoría, cancelación y clasificación. Los elementos tienen IDs
estables. El JWT permanece en memoria y desaparece al recargar o cerrar sesión.
Los datos de servidor se insertan con `textContent`, sin interpretar HTML.

Instalar Node 22+, Chrome, Java 17+ y JMeter 5.6.3. Ejecutar `npm ci`, `npm test`,
`npm run qa:acceptance` y `npm run regression -- --require-team`.
`JAVA_HOME` y `JMETER_HOME` apuntan a las carpetas de instalación. Se pueden definir
`CHROME_BINARY`, `CHROMEDRIVER_PATH` y `MONGOMS_SYSTEM_BINARY` para binarios existentes.

La aceptación usa un MongoDB 7.0.14 real en réplica de un nodo, creado y destruido
por mongodb-memory-server. Los datos de prueba no se envían a Atlas. La descarga
inicial necesita red y espacio en disco. Un fallo invalida el reporte del módulo;
el proceso termina con código 1 y conserva diagnóstico en `acceptance-errors.json`.

## Matriz de aceptación

| Área | Ejecución y evidencia |
| --- | --- |
| Unitarias/HTTP, ambientes, JWT, servicios | `npm test`; TAP y conteos mediante `npm run regression` |
| Integración por capas | `test/integration-race46.test.js`: Top-down, Bottom-up, Big Bang con stubs/drivers |
| Flujo completo real | `qa/system.js`: crear evento → inscribir → registrar resultado → consultar ranking → cancelar |
| Consistencia de cupos | 12 intentos concurrentes para 3 plazas; rollback ante escritor fallido |
| Clasificación real | Scripts de verificación existentes ejecutados contra la réplica QA; empates, categorías, paginación, privacidad y joins |
| Postman | Colección del equipo ejecutada con Newman; `newman-original.json` |
| UI | Selenium WebDriver y Page Object Model; login inválido/válido, inscripción, duplicado, cancelación y logout; capturas PNG |
| Rendimiento | JMeter: carga 5 usuarios × 10 iteraciones; estrés 50 × 10; ramp-up 5 s; JTL y métricas calculadas |

JMeter consulta eventos paginados porque es una lectura pública frecuente que
ejecuta consultas MongoDB. Se comprueban HTTP 200, JSON válido y lista no vacía;
un HTTP 200 con assertion fallida sigue siendo error. El plan limpio evita listeners
y assertions heredados ambiguos del PR #30. No se atribuye una causa al 100 % de
errores de la ejecución antigua: faltaban sus muestras originales.

Los valores observados se escriben en `evidence/team/jmeter-metrics.json` e incluyen
promedio, p95, máximo, throughput y errores. La carga es local y el conjunto de datos
es pequeño: no demuestra la capacidad de Atlas, un límite de saturación ni un SLA
de producción. La prueba de estrés aumenta concurrencia; puede no alcanzar el límite.

## Evidencia y trazabilidad

Cada módulo genera un JSON de manifiesto con SHA, fecha, comando, entorno, conteos
y rutas a originales. El informe de regresión distingue formato de revisión técnica.
Los originales permanecen ignorados y se publican como artifact del job CI.
Un reporte anterior o una captura aislada no sustituye ejecutar nuevamente las pruebas.

La revisión corrige también una carrera entre reducción de cupo y nuevas inscripciones:
la actualización compara `registeredCount` en la misma escritura MongoDB. Su regresión
simula una inscripción posterior a la lectura. El registro de usuarios rechaza tipos
y formatos inválidos antes de consultar BD.

## Atlas (RACE-52)

El usuario cambió expresamente el alcance el 26/10/2026: Atlas queda solo a cargo
de Kevin. No se requieren invitaciones ni acceso de Alexis/Vanessa. El conector
confirmó el proyecto RaceTrack API y Cluster0 activo, MongoDB 8.0.34. La aplicación
carga su URI desde variables de entorno y los archivos reales están ignorados.
No se afirma haber ejecutado esta regresión contra Atlas ni haber cambiado permisos.

## Sustentación

1. Mostrar Jira, el PR final a develop, sus pruebas y el historial de integración.
2. Explicar las capas y la transacción compartida entre cupo e inscripción.
3. Abrir `/`, entrar con una cuenta del ambiente de demo e inscribirse en un evento.
4. Mostrar el rechazo de duplicado, la cancelación y el contador actualizado.
5. Registrar un resultado como organizador y mostrar clasificación/podio.
6. Mostrar TAP, originales Newman, capturas Selenium y JTL/métricas JMeter con SHA y fecha.
7. Explicar los límites de la prueba local y que Atlas es administrado por Kevin.
