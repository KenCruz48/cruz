# Informe de pruebas de rendimiento — RACE-50

| Dato | Descripción |
|---|---|
| Proyecto | Racetrack API |
| Tarea | RACE-50 — Pruebas de carga y estrés |
| Fecha de actualización | 28 de octubre de 2026 |
| Ejecución reportada | 28 de octubre de 2026, 12:59:14 (UTC−05:00) |
| Herramienta | Apache JMeter 5.6.3 |
| Java | 21 |
| Rama de trabajo | `feature/RACE-50-implementacion` |

## 1. Objetivo

Evaluar el comportamiento de cinco endpoints protegidos de Racetrack API bajo dos escenarios de concurrencia: carga y estrés. Se registran los tiempos de respuesta, el número de solicitudes, el porcentaje de errores y el throughput, utilizando los archivos JTL generados durante la ejecución reportada.

El propósito es obtener evidencia reproducible del comportamiento de las rutas seleccionadas en un entorno local de pruebas.

## 2. Alcance y entorno de ejecución

La ejecución se realizó mediante el comando `npm run qa:acceptance`. El runner inició una instancia de Express en un puerto dinámico y una instancia temporal local de MongoDB configurada como replica set.

JMeter recibió el host y el puerto del entorno de prueba, y utilizó las credenciales temporales definidas por el fixture. Los resultados se contrastaron con los archivos siguientes:

- `evidence/team/load.jtl`
- `evidence/team/stress.jtl`
- `evidence/team/jmeter-metrics.json`

La ejecución completa de aceptación reportó los componentes de integración, Newman, Selenium y JMeter aprobados. Este informe se limita a los resultados de rendimiento de JMeter.

## 3. Plan de pruebas y autenticación

El plan utilizado es `performance/RACE-50-rendimiento.jmx`. Antes de cada escenario se ejecuta un grupo de preparación que realiza las siguientes acciones:

1. Inicia sesión como organizador y como corredor mediante `POST /api/v1/users/login`.
2. Extrae los tokens JWT de las respuestas, utilizando la expresión JSON `$.data.token`.
3. Comprueba que los tokens estén disponibles.
4. Crea una categoría temporal y recupera su identificador.
5. Utiliza los tokens en las solicitudes protegidas mediante el encabezado `Authorization: Bearer <token>`.
6. Obtiene los identificadores de evento e inscripción requeridos durante la ejecución.

Cada escenario registra tres solicitudes de preparación: dos inicios de sesión y una creación de categoría. Estas solicitudes se incluyen en el total de muestras JTL, pero se excluyen de las métricas de negocio presentadas en este informe.

El porcentaje de errores se calcula sobre el total de muestras del archivo JTL; los tiempos de respuesta y el throughput se reportan para las solicitudes de negocio.

### 3.1. Endpoints evaluados

| Método y ruta | Propósito | Usuario autenticado | Muestras de negocio: carga / estrés | Respuesta esperada |
|---|---|---|---:|---:|
| `POST /api/v1/events` | Crear un evento | Organizador | 50 / 500 | HTTP 201 |
| `POST /api/v1/registrations` | Crear una inscripción | Corredor | 50 / 500 | HTTP 201 |
| `PATCH /api/v1/events/{eventId}` | Actualizar el evento creado | Organizador | 50 / 500 | HTTP 200 |
| `GET /api/v1/events/{eventId}/participants` | Consultar participantes | Organizador | 50 / 500 | HTTP 200 |
| `POST /api/v1/results` | Registrar un resultado | Organizador | 50 / 500 | HTTP 201 |

El plan contiene aserciones para verificar los códigos HTTP esperados. Los resultados reportados indican que las cinco rutas respondieron correctamente en los escenarios evaluados.

**Alcance de seguridad:** estas pruebas comprueban el acceso autenticado a las rutas seleccionadas. No constituyen una auditoría integral de seguridad ni demuestran por sí solas el rechazo de tokens ausentes, inválidos, vencidos o de usuarios sin permisos.

## 4. Configuración de los escenarios

Cada iteración ejecuta las cinco solicitudes de negocio una vez por hilo.

| Parámetro | Escenario de carga | Escenario de estrés |
|---|---:|---:|
| Usuarios virtuales | 5 | 50 |
| Ramp-up | 5 segundos | 10 segundos |
| Iteraciones por usuario | 10 | 10 |
| Solicitudes de negocio esperadas | 250 | 2.500 |
| Solicitudes de preparación | 3 | 3 |
| Total de muestras JTL | 253 | 2.503 |

Los totales se calculan a partir de las cinco solicitudes de negocio por iteración, más las tres solicitudes de preparación de cada escenario.

## 5. Resultados medidos

Los siguientes valores corresponden a la ejecución reportada del 28 de octubre de 2026 y deben mantenerse vinculados a sus archivos de evidencia.

| Métrica | Carga | Estrés |
|---|---:|---:|
| Muestras de negocio | 250 | 2.500 |
| Muestras de preparación | 3 | 3 |
| Total de muestras JTL | 253 | 2.503 |
| Errores registrados | 0 | 0 |
| Porcentaje de error sobre el JTL | 0 % | 0 % |
| Tiempo mínimo de negocio | 7 ms | 10 ms |
| Tiempo medio de negocio | 13,65 ms | 149,36 ms |
| Percentil 95 (p95) | 22 ms | 300 ms |
| Tiempo máximo de negocio | 37 ms | 423 ms |
| Throughput de negocio reportado | 53,86 solicitudes/s | 155,21 solicitudes/s |

### 5.1. Interpretación de los resultados

- **Carga:** se registraron 250 solicitudes de negocio y tres solicitudes de preparación. El tiempo medio reportado fue de 13,65 ms y el percentil 95 fue de 22 ms.
- **Estrés:** se registraron 2.500 solicitudes de negocio y tres solicitudes de preparación. El tiempo medio fue de 149,36 ms y el percentil 95 fue de 300 ms.
- **Porcentaje de errores:** los archivos revisados reportan cero errores en ambos escenarios.
- **Tiempos máximos:** se registraron máximos de 37 ms en carga y 423 ms en estrés. Estos valores representan las respuestas más lentas observadas y no el comportamiento de la mayoría de las solicitudes.
- **Throughput:** el runner reportó 53,86 solicitudes por segundo en carga y 155,21 solicitudes por segundo en estrés. Estos valores corresponden a las ventanas de cálculo utilizadas por el runner y deben interpretarse dentro del entorno de prueba.

El aumento de concurrencia estuvo acompañado por un incremento del tiempo medio y del p95. Aun así, en esta ejecución no se registraron errores en los JTL revisados.

Los resultados no establecen por sí solos si el rendimiento satisface los requisitos de producción, puesto que no se ha definido un umbral SLO y la ejecución se realizó en un entorno local.

## 6. Evidencias de la ejecución

Los gráficos incluidos a continuación son resúmenes generados a partir de los archivos JTL y contrastados con `jmeter-metrics.json`. No son capturas directas de la interfaz gráfica de JMeter.

### 6.1. Escenario de carga

![Resumen de carga generado desde load.jtl](./evidencia-resumen-carga-2026-10-28.png)

Fuente de datos: `evidence/team/load.jtl`.

### 6.2. Escenario de estrés

![Resumen de estrés generado desde stress.jtl](./evidencia-resumen-estres-2026-10-28.png)

Fuente de datos: `evidence/team/stress.jtl`.

### 6.3. Archivos de respaldo

- [Métricas de JMeter](../evidence/team/jmeter-metrics.json)
- [Resultados JTL de carga](../evidence/team/load.jtl)
- [Resultados JTL de estrés](../evidence/team/stress.jtl)
- [Informe de ejecución de JMeter](../evidence/team/jmeter.json)
- [Plan de pruebas RACE-50](./RACE-50-rendimiento.jmx)

**Nota sobre las imágenes:** las capturas históricas `evidencia-resumen-carga.png` y `evidencia-resumen-estres.png` no están presentes en el directorio de trabajo y no se han restaurado. Los archivos CSV históricos `resultados-carga.csv` y `resultados-estres.csv` corresponden a otra ejecución y no se utilizaron para calcular las métricas presentadas aquí.

Antes de entregar el informe, debe verificarse que los dos archivos PNG enlazados en las secciones 6.1 y 6.2 existan realmente en el directorio `performance`.

## 7. Conclusiones y limitaciones

La ejecución reportada cubrió cinco endpoints protegidos con JWT en dos escenarios de concurrencia. El escenario de carga registró 250 muestras de negocio y el de estrés, 2.500. Al sumar las tres solicitudes de preparación de cada escenario, los archivos JTL contienen 253 y 2.503 muestras, respectivamente.

Según los resultados reportados, no se observaron errores en ninguno de los dos escenarios. Los tiempos medios y los percentiles aumentaron en el escenario de estrés, lo que muestra una mayor latencia al incrementar la concurrencia.

Las pruebas se realizaron con una API Express y una base MongoDB temporales en un entorno local. Los resultados dependen del equipo, la configuración, los datos y el estado del entorno durante la ejecución. Por ello, no deben extrapolarse directamente a producción ni a MongoDB Atlas.

El plan valida respuestas HTTP para las cinco rutas, pero no cubre todos los casos negativos de autenticación y autorización. Para una evaluación completa de seguridad se requieren pruebas adicionales de tokens inválidos, ausentes o vencidos, así como de permisos insuficientes.

Por último, no se definió un umbral SLO de latencia o throughput. En consecuencia, los resultados permiten describir el comportamiento observado, pero no declarar una garantía de capacidad de producción.
