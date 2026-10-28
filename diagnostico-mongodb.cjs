require('dotenv').config({ path: '.env.development' });
const mongoose = require('mongoose');

(async () => {
  try {
    const uri = process.env.MONGODB_URI;

    if (!uri) throw new Error('MONGODB_URI no está definida');

    console.log('URI presente:', true);
    console.log('Empieza con mongodb+srv://:', uri.startsWith('mongodb+srv://'));
    console.log('Contiene separador @:', /@[^/]+/.test(uri));
    console.log('Base de datos:', process.env.MONGODB_DB || '(no definida)');

    await mongoose.connect(uri, {
      dbName: process.env.MONGODB_DB,
      serverSelectionTimeoutMS: 10000
    });

    console.log('RESULTADO: conexión exitosa con MongoDB Atlas');
    await mongoose.disconnect();
  } catch (e) {
    console.log('RESULTADO: conexión fallida');
    console.log('Nombre:', e.name);
    console.log('Código:', e.code ?? '(sin código)');
    console.log(
      'Mensaje:',
      String(e.message || 'Sin mensaje')
        .replace(/mongodb(?:\+srv)?:\/\/[^@\s]+@/gi, 'mongodb+srv://[CREDENCIALES OCULTAS]@')
    );
    if (e.reason) {
      for (const [host, server] of e.reason.servers || []) {
        console.log('Servidor:', host, '| Error:', server.error?.name || '(ninguno)',
          '| Código:', server.error?.code ?? '(ninguno)');
      }
    }
    process.exitCode = 1;
  }
})();
