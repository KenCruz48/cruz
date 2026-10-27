# INFORME DE PRUEBAS DE RENDIMIENTO — RACE-50

**Proyecto:** Racetrack API  
**Actividad:** Implementación y ejecución de pruebas de rendimiento  
**Herramienta:** Apache JMeter  
**Rama de trabajo:** `feature/RACE-50-implementacion`  
**Fecha de ejecución:** 27 de octubre de 2026  
**Responsable:** [Nombre del estudiante]

## 1. Introducción

El presente informe documenta la configuración y ejecución de las pruebas de rendimiento realizadas sobre Racetrack API mediante Apache JMeter. El propósito es verificar el comportamiento del endpoint de consulta de eventos ante solicitudes HTTP y evaluar su respuesta en escenarios de carga y estrés.

Las pruebas permiten observar los tiempos de respuesta, la cantidad de solicitudes procesadas, el porcentaje de errores y el rendimiento del servicio durante la ejecución.

## 2. Objetivos

### 2.1. Objetivo general

Evaluar el comportamiento del endpoint de consulta de eventos de Racetrack API mediante pruebas de rendimiento realizadas con Apache JMeter.

### 2.2. Objetivos específicos

- Configurar un plan de pruebas en Apache JMeter.
- Verificar que el endpoint responda correctamente con el código HTTP 200.
- Ejecutar escenarios de carga y estrés.
- Registrar y analizar las métricas obtenidas.
- Documentar los resultados mediante archivos CSV y capturas de pantalla.

## 3. Entorno de pruebas

| Elemento | Configuración |
|---|---|
| API | Racetrack API |
| Herramienta de pruebas | Apache JMeter |
| Endpoint | `GET /api/v1/events?page=1&limit=10` |
| Servidor local | `http://localhost:3000` |
| Base de datos | MongoDB Atlas |
| Formato de respuesta | JSON |
| Validación principal | Código HTTP 200 |

La API debe permanecer en ejecución durante las pruebas y mantener una conexión funcional con la base de datos.

## 4. Configuración del plan de pruebas

Se utiliza un plan de pruebas de JMeter que contempla dos escenarios: carga y estrés.

### 4.1. Prueba de carga

Configuración prevista del grupo de hilos:

| Parámetro | Valor |
|---|---:|
| Usuarios virtuales | 5 |
| Tiempo de inicio (ramp-up) | 10 segundos |
| Iteraciones por usuario | 10 |
| Solicitudes previstas | Hasta 50 |

La prueba permite observar el comportamiento de la API bajo una carga moderada.

### 4.2. Prueba de estrés

Configuración prevista del grupo de hilos:

| Parámetro | Valor |
|---|---:|
| Usuarios virtuales | 25 |
| Tiempo de inicio (ramp-up) | 5 segundos |
| Iteraciones por usuario | 10 |
| Solicitudes previstas | Hasta 250 |

La prueba busca observar el comportamiento de la API ante una carga mayor. Esta configuración por sí sola no garantiza que se alcance el límite de capacidad del sistema.

### 4.3. Validación de respuestas

Se configura una aserción para comprobar que las solicitudes respondan con el código HTTP `200`. También se utilizan listeners para visualizar las respuestas y consultar el resumen de resultados.

## 5. Resultados de las pruebas

### 5.1. Prueba individual de verificación

Durante la verificación individual del endpoint se obtuvo el siguiente resultado:

| Métrica | Resultado |
|---|---:|
| Código HTTP | 200 OK |
| Tiempo de carga | 176 ms |
| Tiempo de conexión | 5 ms |
| Latencia | 175 ms |
| Tamaño total de respuesta | 296 bytes |
| Errores registrados | 0 |
| Número de muestras | 1 |

**Análisis:** la solicitud individual recibió una respuesta HTTP 200 OK, sin errores registrados. El tiempo de carga fue de 176 milisegundos. Este resultado confirma el funcionamiento de esa solicitud puntual, pero no permite establecer por sí solo el rendimiento de la API bajo carga concurrente.

### 5.2. Resultados de la prueba de carga

Completar esta tabla con los datos del listener **Resumen de resultados - RACE-50** después de ejecutar la prueba completa.

| Métrica | Resultado obtenido |
|---|---|
| Solicitudes ejecutadas | [Completar] |
| Tiempo promedio | [Completar] ms |
| Tiempo mínimo | [Completar] ms |
| Tiempo máximo | [Completar] ms |
| Percentil 90 | [Completar] ms |
| Porcentaje de errores | [Completar] % |
| Throughput | [Completar] solicitudes/s |

**Análisis:** [Describir el comportamiento observado, teniendo en cuenta los tiempos de respuesta, el porcentaje de errores y el throughput registrado por JMeter].

### 5.3. Resultados de la prueba de estrés

Completar esta tabla con los datos reales del listener **Resumen de resultados - RACE-50 - Estrés**.

| Métrica | Resultado obtenido |
|---|---|
| Solicitudes ejecutadas | [Completar] |
| Tiempo promedio | [Completar] ms |
| Tiempo mínimo | [Completar] ms |
| Tiempo máximo | [Completar] ms |
| Percentil 90 | [Completar] ms |
| Porcentaje de errores | [Completar] % |
| Throughput | [Completar] solicitudes/s |

**Análisis:** [Explicar cómo se comportó el endpoint con la carga aplicada. Indicar si hubo errores, incrementos de latencia o cambios en el throughput].

## 6. Evidencias

Se deben anexar las siguientes evidencias, siempre que hayan sido generadas durante la ejecución:

1. Captura de una solicitud individual con respuesta HTTP 200.
2. Captura del resumen de resultados de la prueba de carga.
3. Captura del resumen de resultados de la prueba de estrés.
4. Archivo CSV con los resultados de carga.
5. Archivo CSV con los resultados de estrés.
6. Archivo `.jmx` con la configuración del plan de pruebas.

Los archivos deben estar almacenados en la carpeta `performance` del proyecto.

## 7. Conclusiones

La verificación individual permitió confirmar que el endpoint `GET /api/v1/events?page=1&limit=10` respondió con HTTP 200 OK y no registró errores en la muestra analizada.

Para establecer conclusiones sobre el comportamiento de Racetrack API bajo carga y estrés, es necesario completar el análisis con los resultados de las ejecuciones completas de JMeter. Las conclusiones definitivas deberán considerar el número de solicitudes procesadas, los tiempos de respuesta, el throughput y el porcentaje de errores.

No se establece un umbral de rendimiento aprobado o reprobado mientras no se disponga de los criterios de aceptación definidos para la actividad.

## 8. Archivos de entrega

- `RACE-50-pruebas-rendimiento.jmx`
- `resultados-carga.csv`
- `resultados-estres.csv`
- `evidencia-solicitud-200.png`
- `evidencia-resumen-carga.png`
- `evidencia-resumen-estres.png`
- `informe-RACE-50.md`

**Nota:** los nombres anteriores representan la estructura propuesta. Verificar que cada archivo exista y contenga los resultados correspondientes antes de realizar la entrega.
