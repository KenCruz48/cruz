# RACE-50: Pruebas de rendimiento de Racetrack API

## 1. Objetivo

Evaluar el rendimiento del endpoint de consulta de eventos mediante Apache JMeter 5.6.3, registrando los tiempos de respuesta, el throughput y el porcentaje de errores.

## 2. Endpoint evaluado

- Método HTTP: GET
- Ruta: `/api/v1/events`
- Parámetros: `page=1` y `limit=10`
- Código esperado: HTTP 200

## 3. Prueba de carga

- Usuarios virtuales: 5
- Periodo de subida: 10 segundos
- Iteraciones por usuario: 10
- Solicitudes ejecutadas: 50
- Tiempo promedio: 96 ms
- Tiempo mínimo: 91 ms
- Tiempo máximo: 128 ms
- Desviación estándar: 8,40 ms
- Throughput: 5,6 solicitudes/segundo
- Porcentaje de errores: 0,00 %

### Interpretación

La prueba de carga completó 50 solicitudes sin errores registrados. El tiempo promedio de respuesta fue de 96 ms, con tiempos observados entre 91 y 128 ms.

## 4. Prueba de estrés

Se intentó ejecutar una prueba con 25 usuarios virtuales, 5 segundos de subida y 10 iteraciones por usuario. JMeter registró un porcentaje de errores del 100 %, aunque las muestras inspeccionadas mostraban respuestas HTTP 200 OK.

El resultado requiere diagnóstico adicional para determinar la causa de los fallos de aserción. Por esta razón, no se considera una prueba de estrés exitosa.

## 5. Observación

La respuesta del endpoint contenía una lista vacía de eventos (`events: []`). Los resultados corresponden a consultas que no devolvieron eventos.

## 6. Conclusión

La prueba de carga inicial se completó con 50 solicitudes y 0,00 % de errores. La prueba de estrés permanece pendiente de diagnóstico y validación.
