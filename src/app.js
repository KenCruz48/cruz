const express =
  require('express');

const eventRoutes =
  require('./routes/eventRoutes');

const userRoutes =
  require('./routes/userRoutes');

const registrationRoutes =
  require('./routes/registrationRoutes');

const categoryRoutes =
  require('./routes/categoryRoutes');

const resultRoutes =
  require('./routes/resultRoutes');

const notFound =
  require('./middlewares/notFound');

const errorHandler =
  require('./middlewares/errorHandler');

const app =
  express();

app.disable('x-powered-by');
const { securityHeaders, createAuthLimiter } = require('./middlewares/security');
app.use(securityHeaders);

app.use(express.static(require('node:path').join(__dirname, '..', 'public')));

app.use(
  express.json({ limit: '32kb' })
);

app.use('/api', (req, res, next) => {
  if (req.body !== undefined && (req.body === null || Array.isArray(req.body) || typeof req.body !== 'object')) {
    return res.status(400).json({ status: 'error', message: 'El cuerpo debe ser un objeto JSON.' });
  }
  next();
});
app.use('/api/v1/users', createAuthLimiter());

app.get('/ready', (req, res) => {
  const connected = require('mongoose').connection.readyState === 1;
  res.status(connected ? 200 : 503).json({ status: connected ? 'ok' : 'unavailable', demonstration: /^racetrack_demo_/.test(process.env.MONGODB_DB || '') });
});

app.get(
  '/health',
  (req, res) => {
    res.status(200).json({
      status: 'ok',
    });
  }
);

app.use(
  '/api/v1/events',
  eventRoutes
);

app.use(
  '/api/v1/users',
  userRoutes
);

app.use(
  '/api/v1/registrations',
  registrationRoutes
);

app.use(
  '/api/v1/categories',
  categoryRoutes
);

/**
 * RACE-19
 * Registro de tiempos y resultados.
 */
app.use(
  '/api/v1/results',
  resultRoutes
);

app.use(
  notFound
);

app.use(
  errorHandler
);

module.exports =
  app;
