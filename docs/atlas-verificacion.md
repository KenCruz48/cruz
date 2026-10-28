# Atlas: verificación final de RaceTrack

Verificación: 28 de octubre de 2026, 12:53:30 (America/Bogota).
Resultado: aprobado. Aplicación en http://localhost:3000 conectada a
Cluster0 de RaceTrack API, base de demostración separada racetrack_demo_kevin.

La IP 148.222.238.203/32 fue añadida por Kevin en Atlas. Se comprobó conexión
autenticada y ping antes de detener la réplica local. Se creó el perfil privado
.env.demo a partir de la URI existente, con JWT nuevo, sin publicar credenciales.

Comandos ejecutados:

```powershell
node scripts/demo.js prepare .env.development
node scripts/demo.js start
node scripts/demo.js verify
```

Comprobaciones aprobadas:
- API /ready responde 200 y status ok con MongoDB conectado.
- Catálogo: dos eventos y una categoría activa, consultados por HTTP.
- Podio: tres resultados, puestos 1, 1 y 3.
- Login de organizador y participante.
- Inscripción con respuesta 201; duplicado rechazado con 409.
- Registro de resultado con 201 y consulta del resultado en ranking.
- Cancelación con 200 y recuperación del cupo inicial.

Se verificó también la carga del catálogo y del indicador de disponibilidad
desde el navegador. Son datos académicos de demostración identificados en pantalla;
la infraestructura de base de datos utilizada en esta ejecución es Atlas.
La prueba no es una medición de carga ni certifica un SLA.

Para arrancar de nuevo: INICIAR_PROYECTO.cmd. El perfil local alternativo
sigue disponible con INICIAR_DEMO_LOCAL.cmd. Las cuentas están en el archivo
privado .demo-credentials.json. No proyectar ese archivo ni los .env.

El JSON original de esta ejecución está en evidence/generated/demo-verification.json
y la copia de entrega en outputs/atlas-verificacion-final.json (fuera del repositorio).
Las mediciones JMeter anteriores siguen correspondiendo a MongoDB temporal:
no deben renombrarse como mediciones de Atlas.
