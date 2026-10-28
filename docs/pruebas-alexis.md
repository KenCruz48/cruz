# Evidencia de Pruebas — Alexis Erazo Paredes

## RaceTrack API

**Estudiante:** Alexis Erazo Paredes  
**Ticket principal de QA:** RACE-46  
**Proyecto:** RaceTrack API  
**Sprint:** Sprint 2

---

## 1. Objetivo

Documentar las pruebas de código correspondientes a mi participación en RaceTrack API, incluyendo un mínimo de 10 pruebas unitarias y 10 pruebas de integración.

Las pruebas validan funcionalidades relacionadas con eventos, inscripciones, cupos y la integración entre las diferentes capas de la aplicación.

Además, para cumplir con el requisito de la entrega, se implementaron pruebas utilizando Jest y se configuró GitHub Actions para ejecutar automáticamente Jest y Newman.

---

## 2. Pruebas unitarias

Las pruebas unitarias permiten verificar componentes pequeños del sistema de manera aislada.

Para estas pruebas se utilizan mocks o dobles de prueba, evitando depender directamente de servicios externos o de una base de datos real.

Las pruebas unitarias implementadas con Jest se encuentran en:

`jest-suite/unit/alexis-unit.spec.cjs`

| # | Prueba |
|---|---|
| 1 | Escapa caracteres especiales de una expresión regular |
| 2 | Permite buscar caracteres especiales literalmente |
| 3 | Devuelve una cadena vacía cuando recibe una cadena vacía |
| 4 | Rechaza valores que no son cadenas de texto |
| 5 | Crea un evento válido |
| 6 | Rechaza un evento cuando faltan campos obligatorios |
| 7 | Rechaza una distancia inválida |
| 8 | Rechaza un cupo inválido |
| 9 | Rechaza un organizador con ID inválido |
| 10 | Rechaza un estado de evento inválido |

### Explicación

Estas pruebas permiten verificar la lógica interna de funciones y servicios sin ejecutar todo el sistema.

Por ejemplo, en la creación de eventos se simula el modelo de MongoDB para comprobar que el servicio valide correctamente la información antes de guardar.

También se comprueba que valores incorrectos, como una distancia igual a cero, un cupo inválido o un identificador incorrecto, sean rechazados correctamente.

---

## 3. Pruebas de integración

Las pruebas de integración permiten verificar que diferentes componentes del sistema puedan trabajar correctamente entre sí.

En RaceTrack API se comprueba la interacción entre:

`Petición HTTP → Ruta → Middleware → Controlador → Servicio → Modelo`

Las pruebas de integración implementadas con Jest se encuentran en:

`jest-suite/integration/alexis-integration.spec.cjs`

| # | Prueba |
|---|---|
| 1 | POST `/api/v1/events` crea un evento autenticado y responde HTTP 201 |
| 2 | POST `/api/v1/events` sin token responde HTTP 401 |
| 3 | POST `/api/v1/registrations` sin token responde HTTP 401 |
| 4 | POST `/api/v1/registrations` con campos faltantes responde HTTP 400 |
| 5 | Rechaza una inscripción duplicada con HTTP 409 |
| 6 | Rechaza una categoría inactiva con HTTP 409 |
| 7 | Crea una inscripción válida y responde HTTP 201 |
| 8 | Top-down integra ruta, middleware, controlador y Stub |
| 9 | Un token inválido en una ruta protegida responde HTTP 401 |
| 10 | Un evento con datos inválidos responde HTTP 400 |

---

## 4. Integración Top-down

En Top-down la prueba comienza desde las capas superiores del sistema.

El recorrido principal es:

`Ruta → Middleware → Controlador → Servicio`

En esta estrategia se puede utilizar un **Stub** para reemplazar temporalmente una dependencia inferior.

### Stub

Un Stub es una dependencia simulada que devuelve una respuesta controlada.

Esto permite comprobar las capas superiores del sistema sin depender completamente de los componentes inferiores.

En las pruebas de RaceTrack API se utiliza un Stub para simular la respuesta del servicio de inscripción mientras se validan la ruta, el middleware y el controlador.

---

## 5. Integración Bottom-up

En Bottom-up la prueba comienza desde las capas inferiores del sistema.

Se comprueba principalmente la comunicación entre:

`Servicio → lógica de cupos → modelos`

Para iniciar este tipo de prueba se utiliza un **Driver**.

### Driver

Un Driver es un componente de prueba que llama directamente al módulo que se desea verificar.

En RaceTrack API, el propio test funciona como Driver al llamar directamente a los servicios del sistema.

---

## 6. Integración Big Bang

En una prueba Big Bang se integran varias partes del sistema al mismo tiempo.

En RaceTrack API este enfoque permite comprobar un flujo completo como:

`Petición → autenticación → ruta → controlador → servicio → cupo → inscripción`

También se verifican escenarios de error, por ejemplo cuando un evento no tiene cupos disponibles.

---

## 7. Pruebas anteriores del proyecto

Antes de implementar Jest, el proyecto ya tenía una suite de pruebas utilizando el módulo `node:test` de Node.js.

Estas pruebas se conservaron para no eliminar funcionalidad existente.

Entre ellas se encuentran archivos como:

- `test/regexUtils.test.js`
- `test/event-create-service.test.js`
- `test/capacity.test.js`
- `test/integration-race46.test.js`
- `test/event-create-api.test.js`
- `test/registration-create-api.test.js`

La incorporación de Jest se realizó de manera adicional, sin reemplazar ni eliminar estas pruebas.

---

## 8. Comandos de ejecución con Jest

### Ejecutar las pruebas unitarias

```bash
npm run test:jest:unit
```

Resultado obtenido:

- 10 pruebas ejecutadas.
- 10 pruebas aprobadas.
- 0 pruebas fallidas.
- 1 suite aprobada.

### Ejecutar las pruebas de integración

```bash
npm run test:jest:integration
```

Resultado obtenido:

- 10 pruebas ejecutadas.
- 10 pruebas aprobadas.
- 0 pruebas fallidas.
- 1 suite aprobada.

### Ejecutar todas las pruebas Jest

```bash
npm run test:jest
```

Resultado obtenido:

- 2 suites ejecutadas.
- 2 suites aprobadas.
- 20 pruebas ejecutadas.
- 20 pruebas aprobadas.
- 0 pruebas fallidas.

---

## 9. Regresión completa del proyecto

Después de agregar Jest se ejecutó nuevamente la suite de pruebas existente del proyecto con:

```bash
npm test
```

Resultado obtenido:

- 124 pruebas ejecutadas.
- 124 pruebas aprobadas.
- 0 pruebas fallidas.
- 0 pruebas omitidas.

Esto permite comprobar que la incorporación de Jest no dañó ni modificó negativamente las funcionalidades que ya estaban funcionando en RaceTrack API.

---

## 10. GitHub Actions

El archivo:

`.github/workflows/continuous-testing.yml`

fue actualizado para ejecutar automáticamente las pruebas del proyecto.

El workflow ejecuta:

- Pruebas existentes con Node Test.
- Pruebas unitarias y de integración con Jest.
- Newman para la colección de Postman.
- Selenium.
- JMeter.
- Generación de evidencias de QA.

De esta manera, el repositorio evidencia la ejecución automática de **Jest y Newman**, tal como se solicita en la entrega.

---

## 11. Resultado final

Resultados obtenidos durante la validación:

- Pruebas unitarias con Jest: **10/10 aprobadas**.
- Pruebas de integración con Jest: **10/10 aprobadas**.
- Total de pruebas Jest: **20/20 aprobadas**.
- Regresión existente con Node Test: **124/124 aprobadas**.
- Pruebas fallidas: **0**.

---

## 12. Conclusión

Las pruebas implementadas permiten comprobar tanto la lógica individual de los componentes como la comunicación entre las diferentes capas de RaceTrack API.

Las pruebas unitarias permiten detectar errores específicos en funciones y servicios.

Las pruebas de integración comprueban que rutas, middleware, controladores, servicios y modelos puedan trabajar correctamente en conjunto.

Además, se mantiene la evidencia correspondiente a RACE-46 sobre integración Top-down, Bottom-up, uso de Stubs, Drivers y escenarios Big Bang.

Finalmente, la incorporación de Jest y su ejecución desde GitHub Actions permite cumplir con el requisito de automatización de pruebas solicitado para la entrega.
