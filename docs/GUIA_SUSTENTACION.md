# RaceTrack · Ejecución y sustentación

## Inicio en este equipo

1. Abre la carpeta del proyecto y ejecuta `INICIAR_PROYECTO.cmd`.
2. Espera el mensaje `RaceTrack API escuchando en el puerto 3000`.
3. Abre http://localhost:3000.
4. Consulta las cuentas en `.demo-credentials.json`, archivo privado local.
5. Mantén abierta la ventana del servidor. Ctrl+C lo detiene.

También puedes ejecutar `npm ci` y `npm run demo:start` desde la raíz del repositorio.
Requiere Node 22+, conexión a Atlas y el puerto 3000 libre.
El modo Atlas conserva los datos al cerrar; la réplica local alternativa los reinicia.
Las cuentas privadas conservan sus contraseñas entre ejecuciones en este equipo.

El arranque prepara dos eventos: **Circuito universitario 5K · Inscripciones** y
**Encuentro universitario 5K · Resultados**, con categoría **Abierta Demo**. El segundo ya tiene
tiempos de 20:00, 20:00 y 22:00 minutos, con puestos 1,1,3.

## Demostración en clase (8–10 minutos)

1. **Gestión:** abre Jira y muestra los sprints, responsables y claves RACE. En GitHub
   muestra el código de develop, un PR y sus comprobaciones. Kevin administra Atlas.
2. **Arquitectura:** explica rutas, controladores, servicios, modelos y configuración.
   Distingue app.js de server.js y muestra variables de entorno sin revelar sus valores.
3. **Aplicación:** abre localhost:3000, muestra los eventos y el podio del segundo evento.
4. **Inscripción:** entra con la cuenta `corredor` del archivo privado. Selecciona
   Circuito universitario 5K · Inscripciones y Abierta Demo. Comprueba el contador actualizado.
5. **Validación:** intenta inscribirte otra vez y muestra el rechazo del duplicado.
6. **Cancelación:** cancela y comprueba que el cupo se libera. Cierra sesión.
7. **Pruebas:** presenta los reportes con su fecha y versión. Explica que Postman prueba
   API, Selenium prueba UI, la integración utiliza transacciones y JMeter mide carga local.

Para demostrar también escritura de resultados y su consulta por API sobre el servidor
activo en Atlas: `npm run demo:verify`. Ese comando comprueba login, inscripción, duplicado,
registro de resultado, ranking y cancelación, dejando la cuenta lista para repetir.

## Estado de Atlas

Conexión verificada el 28/10/2026, a las 12:53 (America/Bogota).
La aplicación utiliza Cluster0 y la base separada `racetrack_demo_kevin`.
La IP actual fue autorizada por Kevin. Login, inscripción, rechazo de duplicados,
resultado, ranking y cancelación pasaron sobre Atlas.
Consulta [el informe de verificación](atlas-verificacion.md).

Para iniciar esta configuración, ejecuta `INICIAR_PROYECTO.cmd` o
`npm run demo:start`. Para repetir la comprobación: `npm run demo:verify`.
El perfil privado es `.env.demo`; no revelar sus valores.

La alternativa local sigue disponible con `INICIAR_DEMO_LOCAL.cmd`.
Solo esa alternativa reinicia su base al detenerla; los datos de Atlas persisten.
Los eventos, participantes y tiempos son ejemplos académicos y se identifican
en pantalla, también al utilizar Atlas. Los datos se alojan en una base propia
y no sustituyen la base existente del equipo.

## Repetir la verificación completa

```powershell
npm ci
npm test
npm run test:jest
# Ajustar estas rutas a instalaciones reales:
$env:JAVA_HOME = 'C:\ruta\jdk-21'
$env:JMETER_HOME = 'C:\ruta\apache-jmeter-5.6.3'
npm run qa:acceptance
npm run regression -- --require-team
npm audit --omit=dev
```

Chrome debe estar instalado para Selenium. El perfil de pruebas es independiente y
headless, con carga eager y renderizado sin GPU para evitar bloqueos del renderer
observados en este Windows. Hay un timeout de carga de 30 segundos.

Los originales se generan en `evidence/team/` y `evidence/generated/`. Para sustentar,
mostrar TAP, reporte Newman, capturas Selenium y JTL/métricas de JMeter.
Las métricas locales con datos pequeños no estiman capacidad ni SLA de Atlas.

## Si aparece un error

- **Puerto 3000 ocupado:** detén la instancia anterior de RaceTrack antes de iniciar
  otra. No cierres procesos ajenos. La demo local usa ese puerto.
- **Descarga inicial:** deja terminar la descarga de MongoDB. En este equipo ya se
  verificó. Para otro equipo, prepara la conexión antes de la clase.
- **Sesión cerrada al recargar:** el JWT vive en memoria. Vuelve a entrar con la cuenta demo.
- **Datos reiniciados:** es el comportamiento esperado al detener la réplica local.
- **Atlas rechaza credenciales:** cambia al arranque local explícito y comunica ese modo.

El archivo de credenciales debe consultarse en privado, antes de proyectar la pantalla.
