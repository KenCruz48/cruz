const dns = require('node:dns');
const mongoose = require('mongoose');

function configureDns() {
  const currentServers = dns.getServers();

  const onlyLocalDns =
    currentServers.length === 0 ||
    currentServers.every(
      (server) => server === '127.0.0.1' || server === '::1'
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

    console.log('MongoDB Atlas conectado correctamente');
  } catch {
    // No mostrar la URI ni información sensible del driver.
    throw new Error(
      'No se pudo conectar a MongoDB. Revisa MONGODB_URI y el acceso a Atlas.'
    );
  }
}

module.exports = connectDatabase;
