# RACE-46 - Pruebas de integración Top-down, Bottom-up y Big Bang

## Objetivo

El objetivo de RACE-46 es demostrar la integración incremental entre las diferentes capas del backend de RaceTrack API, utilizando estrategias Top-down, Bottom-up y Big Bang.

El flujo seleccionado para las pruebas corresponde al registro de una inscripción a un evento:

```text
HTTP Request
    ↓
Route
    ↓
Auth Middleware
    ↓
Controller
    ↓
Registration Service
    ↓
Capacity Service
    ↓
Models
    ↓
MongoDB
```

Las pruebas se encuentran en:

```text
test/integration-race46.test.js
```

---

## 1. Integración Top-down

### ¿Qué significa?

Top-down significa que las pruebas comienzan desde las capas superiores del sistema y progresivamente se integran las capas inferiores.

En RaceTrack API se empezó desde:

```text
HTTP
 ↓
Route
 ↓
Auth Middleware
 ↓
Controller
 ↓
Stub del Service
```

### Stub utilizado

Se utilizó un Stub para reemplazar temporalmente:

```text
registrationService.createRegistration()
```

El Stub devuelve una inscripción simulada sin ejecutar todavía toda la lógica interna de MongoDB.

### ¿Qué se valida?

La prueba comprueba que:

- La petición llega correctamente a la ruta.
- El middleware procesa el token.
- El usuario autenticado se coloca en `req.user`.
- El controlador recibe correctamente los datos.
- El controlador llama al servicio.
- La API devuelve HTTP 201.
- La respuesta JSON tiene la estructura correcta.

### ¿Por qué usamos un Stub?

Porque en una integración Top-down queremos comprobar primero las capas superiores sin depender todavía de las capas inferiores.

Por eso el servicio se reemplaza temporalmente por una respuesta controlada.

---

## 2. Integración Bottom-up

### ¿Qué significa?

Bottom-up significa comenzar desde las capas inferiores del sistema e ir integrando hacia arriba.

El flujo probado fue:

```text
Driver de prueba
      ↓
Registration Service
      ↓
Capacity Service
      ↓
Models
```

### Driver utilizado

El propio archivo de pruebas funciona como Driver.

El Driver llama directamente a:

```text
registrationService.createRegistration()
```

sin utilizar inicialmente la ruta HTTP ni el controlador.

### ¿Qué se valida?

La prueba comprueba que el servicio:

- Valida inscripciones duplicadas.
- Verifica que la categoría exista y esté activa.
- Comprueba la disponibilidad del evento.
- Reserva el cupo del evento.
- Utiliza la misma sesión de MongoDB.
- Crea la inscripción.
- Relaciona evento, participante y categoría.

### ¿Por qué usamos un Driver?

Porque en Bottom-up las capas superiores todavía no son necesarias para probar la integración entre servicios y modelos.

El Driver reemplaza temporalmente esa capa superior y llama directamente al componente que queremos integrar.

---

## 3. Integración Big Bang

### ¿Qué significa?

La estrategia Big Bang integra varias capas del sistema al mismo tiempo para comprobar el funcionamiento completo de un flujo.

El flujo probado fue:

```text
POST /api/v1/registrations
        ↓
authMiddleware
        ↓
registrationController
        ↓
registrationService
        ↓
capacityService
        ↓
Event
Category
Registration
```

### Flujo exitoso

Se ejecuta una petición:

```text
POST /api/v1/registrations
```

con un usuario autenticado, un evento válido y una categoría activa.

La prueba verifica que:

- La autenticación funciona.
- La ruta recibe la solicitud.
- El controlador llama al servicio.
- El servicio valida duplicados.
- La categoría es válida.
- Existe cupo disponible.
- El contador de inscritos aumenta.
- La inscripción se crea correctamente.
- La API responde HTTP 201.

---

## 4. Fallo esperado en Big Bang

También se ejecutó un caso donde el evento ya alcanzó su capacidad máxima.

Ejemplo:

```text
capacity = 50
registeredCount = 50
```

En este escenario:

```text
POST /api/v1/registrations
        ↓
Validación de capacidad
        ↓
Cupo agotado
        ↓
HTTP 409
```

La prueba confirma que:

- La API responde HTTP 409.
- El mensaje devuelto es `Cupo agotado`.
- La inscripción no se crea.
- El flujo se detiene antes de persistir datos inconsistentes.

Esto demuestra que los errores de negocio también se propagan correctamente entre las capas.

---

## 5. Relaciones entre colecciones

El módulo de inscripciones relaciona tres colecciones principales.

### Registration → Event

```text
event
ref: Event
```

Permite conocer a qué evento pertenece una inscripción.

### Registration → User

```text
participant
ref: User
```

Permite identificar al participante inscrito.

### Registration → Category

```text
category
ref: Category
```

Permite identificar la categoría en la que participa el usuario.

La prueba automatizada verifica las referencias configuradas en el esquema de Mongoose.

---

## 6. Diferencia entre Stub y Driver

### Stub

Un Stub reemplaza una capa inferior.

Ejemplo utilizado:

```text
Controller
    ↓
Stub de registrationService
```

El controlador cree que está llamando al servicio real, pero la prueba devuelve una respuesta controlada.

Se utilizó en:

```text
Top-down
```

### Driver

Un Driver reemplaza una capa superior.

Ejemplo utilizado:

```text
Driver de prueba
      ↓
registrationService
```

La prueba llama directamente al servicio sin necesitar la ruta ni el controlador.

Se utilizó en:

```text
Bottom-up
```

---

## 7. Resultados de las pruebas específicas

Comando utilizado:

```bash
node --test test/integration-race46.test.js
```

Resultado:

```text
tests 5
pass 5
fail 0
```

Casos ejecutados:

1. Top-down utilizando Stub.
2. Bottom-up utilizando Driver.
3. Big Bang con inscripción exitosa.
4. Big Bang con fallo esperado por cupo agotado.
5. Validación de relaciones entre Event, User y Category.

---

## 8. Regresión completa

También se ejecutó:

```bash
npm test
```

Resultado:

```text
tests 112
pass 112
fail 0
```

Esto demuestra que la implementación de RACE-46 no afecta las funcionalidades desarrolladas previamente.

---

## Conclusión

RACE-46 demuestra tres estrategias de integración sobre el módulo transaccional de inscripciones de RaceTrack API.

Top-down permitió comprobar las capas superiores utilizando un Stub.

Bottom-up permitió comprobar servicios y modelos utilizando un Driver.

Big Bang permitió ejecutar el flujo completo de registro de una inscripción y verificar tanto un escenario exitoso como un fallo esperado por falta de cupo.

Finalmente, las pruebas también verificaron las relaciones entre las colecciones Event, User y Category mediante el modelo Registration.

Todas las pruebas específicas y la regresión general finalizaron correctamente.