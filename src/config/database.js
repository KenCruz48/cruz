const dns = require('node:dns');
const mongoose = require('mongoose');

function configureDns() {
  const currentServers = dns.getServers();

  const onlyLocalDns =
    currentServers.length === 0 ||
    currentServers.every(
      (server) =>
        server === '127.0.0.1' ||
        server === '::1' ||
        server.startsWith('10.') ||
        server.startsWith('192.168.') ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(server)
    );

  if (onlyLocalDns) {
    dns.setServers(['1.1.1.1', '8.8.8.8']);
  }
}

async function connectDatabase() {
  const uri = process.env.MONGODB_URI;

  if (!uri || !uri.trim()) {
    throw new Error(
      'MONGODB_URI es obligatoria para conectar a MongoDB.'
    );
  }

  try {
    configureDns();

    const options = { serverSelectionTimeoutMS: 10000 };
    if (process.env.MONGODB_DB) options.dbName = process.env.MONGODB_DB;
    await mongoose.connect(uri, options);

    console.log('MongoDB conectado correctamente');
  } catch (error) {
    const serverErrors = error?.reason?.servers instanceof Map
      ? [...error.reason.servers.values()]
          .map((server) => server.error?.code)
          .filter((code) => code !== undefined)
      : [];

    console.error('Diagnóstico MongoDB Atlas', {
      name: error?.name,
      code: error?.code,
      causeCode: error?.cause?.code,
      serverErrors: [...new Set(serverErrors)],
    });

    // No mostrar la URI ni información sensible del driver.
    throw new Error(
      'No se pudo conectar a MongoDB. Revisa MONGODB_URI y el acceso a Atlas.'
    );
  }
}

module.exports = connectDatabase;
