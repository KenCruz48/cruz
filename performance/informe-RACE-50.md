# Informe de pruebas de rendimiento — RACE-50

**Proyecto:** RaceTrack API

**Responsable:** Vanessa Ruiz (cuenta Jira: lizeth en; autora de los commits RACE-50)

**Fecha de evidencia final:** 28 de octubre de 2026, 10:54:14, America/Bogota

**Rama:** `feature/RACE-50-implementacion`

**Fuente:** [jmeter-metrics.json](../evidence/team/jmeter-metrics.json), generado a las `2026-10-28T15:54:14.383Z`.

## Objetivo y entorno

Evaluar cinco operaciones de la API bajo carga concurrente, comprobando respuestas,
latencias, throughput y errores. La ejecución final usó Apache JMeter 5.6.3 y
Java 21 sobre una API local con MongoDB temporal aislado. El puerto se asignó
durante la ejecución; los JTL conservan las URL reales. Estas mediciones no
representan la capacidad de Atlas ni de producción.

El [plan JMeter](RACE-50-rendimiento.jmx) y el
[ejecutor](../qa/acceptance.js) preparan autenticación y datos, y comprueban
el código esperado de cada operación:

| Operación | Código esperado |
|---|---:|
| POST /api/v1/events | 201 |
| POST /api/v1/registrations | 201 |
| PATCH /api/v1/events/{id} | 200 |
| GET /api/v1/events/{id}/participants | 200 |
| POST /api/v1/results | 201 |

## Configuración y resultados finales

| Métrica | Carga | Estrés |
|---|---:|---:|
| Usuarios virtuales | 5 | 50 |
| Ramp-up (segundos) | 5 | 10 |
| Iteraciones por usuario | 10 | 10 |
| Operaciones por iteración | 5 | 5 |
| Muestras por operación | 50 | 500 |
| Muestras del escenario | 250 | 2.500 |
| Muestras de preparación | 3 | 3 |
| Muestras totales del JTL | 253 | 2.503 |
| Errores del escenario y preparación | 0 | 0 |
| Porcentaje de errores | 0 % | 0 % |
| Tiempo mínimo (ms) | 6 | 10 |
| Tiempo promedio (ms) | 12,3 | 113,1092 |
| Percentil 95 (ms) | 17 | 201 |
| Tiempo máximo (ms) | 273 | 282 |
| Throughput del escenario (solicitudes/s) | 54,2064 | 176,2301 |

Las tres muestras de preparación son dos inicios de sesión y la creación de
una categoría. No se incluyen en las latencias ni en el throughput del escenario.
El promedio es la media de `elapsed`; p95 usa el elemento de posición
`ceil(n × 0,95)` en los tiempos ordenados. El throughput divide las muestras
del escenario por el intervalo entre su primer inicio y su última finalización.
Los valores se recalcularon desde los JTL y coinciden con el JSON de métricas.

## Interpretación y límites

Las 2.750 muestras de escenario y seis de preparación terminaron sin errores.
Al pasar de 5 a 50 usuarios, el promedio aumentó de 12,3 a 113,1092 ms y p95
de 17 a 201 ms. El throughput observado aumentó de 54,2064 a 176,2301
solicitudes/s. Son observaciones de estas ejecuciones locales: no garantizan
tiempos futuros ni demuestran el límite de capacidad.

El ejecutor registró `status: passed`, que acredita sus verificaciones para esta
ejecución. No establece un SLA de producción. No se atribuyen estas mediciones
a Atlas ni se deduce de ellas que el acceso actual a Atlas funcione.

## Evidencias y trazabilidad

- [Métricas finales](../evidence/team/jmeter-metrics.json).
- [JTL de carga](../evidence/team/load.jtl): 253 registros, tres de preparación.
- [JTL de estrés](../evidence/team/stress.jtl): 2.503 registros, tres de preparación.
- [Plan JMeter](RACE-50-rendimiento.jmx).
- [Ejecutor de aceptación](../qa/acceptance.js).

Los archivos `resultados-carga.csv`, `resultados-estres.csv`,
`evidencia-resumen-carga.png` y `evidencia-resumen-estres.png` se conservan como
evidencia histórica de la prueba GET anterior. Los CSV contienen respectivamente
una y 250 muestras de `GET - Listar eventos`; no respaldan las tablas finales
de cinco operaciones de este informe. Las capturas anteriores no se presentan
como capturas de la ejecución final. Para verificar esta última se deben usar
el JSON y los JTL enlazados arriba.
