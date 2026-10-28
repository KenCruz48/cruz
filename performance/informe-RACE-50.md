# Informe de pruebas de rendimiento — RACE-50

| Dato | Descripción |
|---|---|
| Proyecto | Racetrack API |
| Tarea | RACE-50 — Pruebas de carga y estrés |
| Fecha de ejecución | 28 de octubre de 2026 |
| Ejecución documentada | 28 de octubre de 2026, 14:05:28.043 (UTC−05:00) |
| Herramienta | Apache JMeter 5.6.3 |
| Java | 21 |
| Rama de trabajo | `fix/RACE-50-evidencias` |

## 1. Objetivo

Evaluar el comportamiento de cinco endpoints protegidos de Racetrack API bajo dos escenarios de concurrencia: carga y estrés. Se analizan los tiempos de respuesta, el número de solicitudes, el porcentaje de errores y el throughput, a partir de los archivos JTL y las métricas generadas durante la ejecución documentada.

El propósito es obtener evidencia reproducible del comportamiento de las rutas seleccionadas en un entorno local de pruebas.

## 2. Alcance y entorno de ejecución

La ejecución documentada se realizó mediante el comando `npm run qa:acceptance`. El runner inició una instancia de Express en un puerto dinámico y una instancia temporal local de MongoDB configurada como replica set.

JMeter recibió el host y el puerto del entorno de prueba y utilizó las credenciales temporales definidas por el fixture.

Los archivos utilizados para documentar los resultados son:

- `evidence/team/load.jtl`
- `evidence/team/stress.jtl`
- `evidence/team/jmeter-metrics.json`

La ejecución de aceptación reportada previamente indicó que los componentes de integración, Newman, Selenium y JMeter finalizaron correctamente. Los resultados de este informe se limitan al rendimiento medido por JMeter durante la ejecución indicada.

## 3. Plan de pruebas y autenticación

El plan utilizado es `performance/RACE-50-rendimiento.jmx`.

Antes de ejecutar las solicitudes de negocio, el plan realiza un grupo de preparación que:

1. Inicia sesión como organizador y corredor mediante `POST /api/v1/users/login`.
2. Extrae los tokens JWT de las respuestas mediante la expresión JSON `$.data.token`.
3. Comprueba que los tokens estén disponibles.
4. Crea una categoría temporal y obtiene su identificador.
5. Envía los tokens en el encabezado `Authorization: Bearer <token>` para las solicitudes protegidas.
6. Obtiene los identificadores de evento e inscripción requeridos durante la ejecución.

Cada escenario registra tres solicitudes de preparación: dos inicios de sesión y una creación de categoría. Estas se incluyen en el total de muestras de los archivos JTL, pero se excluyen de las métricas de negocio presentadas en este informe.

El porcentaje de errores se calcula sobre el total de muestras del archivo JTL. Los tiempos de respuesta y el throughput se reportan para las solicitudes de negocio, de acuerdo con las métricas disponibles.

### 3.1. Endpoints evaluados

| Método y ruta | Propósito | Usuario autenticado | Muestras de negocio: carga / estrés | Respuesta esperada |
|---|---|---|---:|---:|
| `POST /api/v1/events` | Crear un evento | Organizador | 50 / 500 | HTTP 201 |
| `POST /api/v1/registrations` | Crear una inscripción | Corredor | 50 / 500 | HTTP 201 |
| `PATCH /api/v1/events/{eventId}` | Actualizar el evento creado | Organizador | 50 / 500 | HTTP 200 |
| `GET /api/v1/events/{eventId}/participants` | Consultar participantes | Organizador | 50 / 500 | HTTP 200 |
| `POST /api/v1/results` | Registrar un resultado | Organizador | 50 / 500 | HTTP 201 |

El plan contiene aserciones para verificar los códigos HTTP esperados. Los resultados de la ejecución documentada indican que las cinco rutas respondieron con los códigos previstos.

**Alcance de seguridad:** estas pruebas comprueban el acceso autenticado a las rutas seleccionadas. No constituyen una auditoría integral de seguridad ni demuestran por sí solas que se rechacen todos los tokens ausentes, inválidos o vencidos, o los usuarios sin permisos suficientes.

## 4. Configuración de los escenarios

Cada iteración ejecuta una vez las cinco solicitudes de negocio.

| Parámetro | Escenario de carga | Escenario de estrés |
|---|---:|---:|
| Usuarios virtuales | 5 | 50 |
| Ramp-up | 5 segundos | 10 segundos |
| Iteraciones por usuario | 10 | 10 |
| Solicitudes de negocio esperadas | 250 | 2.500 |
| Solicitudes de preparación | 3 | 3 |
| Total de muestras JTL | 253 | 2.503 |

Los totales se obtienen de las cinco solicitudes de negocio por iteración, más las tres solicitudes de preparación de cada escenario.

## 5. Resultados medidos

Los siguientes resultados corresponden a la ejecución documentada del 28 de octubre de 2026 a las 19:05:28.043 UTC, equivalente a las 14:05:28.043 en UTC−05:00. Los valores fueron reportados como verificados contra `jmeter-metrics.json` y los archivos JTL de esa ejecución.

| Métrica | Carga | Estrés |
|---|---:|---:|
| Muestras de negocio | 250 | 2.500 |
| Muestras de preparación | 3 | 3 |
| Total de muestras JTL | 253 | 2.503 |
| Errores registrados | 0 | 0 |
| Porcentaje de error sobre el JTL | 0 % | 0 % |
| Tiempo mínimo de negocio | 11 ms | 9 ms |
| Tiempo medio de negocio | 22,656 ms | 213,8908 ms |
| Percentil 95 (p95) | 32 ms | 395 ms |
| Tiempo máximo de negocio | 46 ms | 654 ms |
| Throughput de negocio reportado | 50,1002 solicitudes/s | 138,2438 solicitudes/s |

### 5.1. Interpretación de los resultados

- **Escenario de carga:** se registraron 250 solicitudes de negocio y tres solicitudes de preparación. El tiempo medio reportado fue de 22,656 ms y el p95 fue de 32 ms.
- **Escenario de estrés:** se registraron 2.500 solicitudes de negocio y tres solicitudes de preparación. El tiempo medio reportado fue de 213,8908 ms y el p95 fue de 395 ms.
- **Errores:** los archivos revisados reportaron cero errores en ambos escenarios.
- **Tiempos máximos:** se registraron máximos de 46 ms en carga y 654 ms en estrés.
- **Throughput:** las métricas reportaron 50,1002 solicitudes por segundo en carga y 138,2438 solicitudes por segundo en estrés. Estos valores deben interpretarse según las ventanas de cálculo del runner y las condiciones del entorno local.

El escenario de estrés presentó mayores tiempos de respuesta promedio y p95 que el escenario de carga. Esto indica un incremento de la latencia bajo la configuración de concurrencia evaluada. Sin embargo, el throughput reportado fue mayor en estrés; por sí solo, este resultado no demuestra una mejora general del rendimiento ni permite establecer la capacidad máxima del sistema.

No se definió un umbral SLO de latencia o throughput. Por tanto, los resultados describen el comportamiento observado, pero no permiten declarar una garantía de rendimiento para producción.

## 6. Evidencias de la ejecución

No se incluyen gráficos como evidencia de esta ejecución. Las capturas PNG disponibles corresponden a una fecha anterior y no fueron verificadas contra los JTL documentados; por ello, no se presentan como resultados de esta corrida.

### 6.1. Archivos de evidencia

- [Métricas de JMeter](../evidence/team/jmeter-metrics.json)
- [Resultados JTL de carga](../evidence/team/load.jtl)
- [Resultados JTL de estrés](../evidence/team/stress.jtl)
- [Plan de pruebas RACE-50](./RACE-50-rendimiento.jmx)

Las rutas anteriores son relativas a la ubicación de este informe. Los archivos deben existir en esas ubicaciones para que los enlaces funcionen correctamente.

Los JTL documentados contienen tres solicitudes de preparación y 250 o 2.500 muestras de negocio, respectivamente. Los resultados reportados indican cero errores y métricas de negocio coherentes con el resumen de JMeter correspondiente a esa ejecución.

## 7. Conclusiones y limitaciones

La ejecución documentada cubrió cinco endpoints protegidos mediante JWT en dos escenarios de concurrencia. El escenario de carga registró 250 muestras de negocio y el de estrés, 2.500. Al incluir las tres solicitudes de preparación de cada escenario, los archivos JTL contienen 253 y 2.503 muestras, respectivamente.

Según los resultados reportados, no se observaron errores en los dos escenarios. Los tiempos promedio y el p95 aumentaron con la concurrencia configurada para estrés, lo que evidencia una mayor latencia en esa ejecución.

Las pruebas se realizaron con una API Express y una base MongoDB temporales en un entorno local. Los resultados dependen del equipo, la configuración, los datos y el estado del entorno durante la ejecución. En consecuencia, no deben extrapolarse directamente a producción ni a MongoDB Atlas.

El plan verifica las respuestas HTTP de las cinco rutas seleccionadas, pero no cubre todos los escenarios negativos de autenticación y autorización. Una evaluación de seguridad más completa requeriría pruebas adicionales con tokens ausentes, inválidos o vencidos y con usuarios que no dispongan de los permisos requeridos.

Finalmente, al no haberse definido umbrales SLO de latencia o throughput, los resultados permiten describir el comportamiento observado, pero no garantizan una capacidad determinada en producción.
