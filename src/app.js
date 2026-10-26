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

app.use(
  express.json()
);

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