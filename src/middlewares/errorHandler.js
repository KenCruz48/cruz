
function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  const isDuplicate = error.code === 11000;
  const status = isDuplicate ? 409 : (error.status || 500);

  let message = error.message;

  if (isDuplicate) {
    message = 'El participante ya tiene una inscripcion activa en este evento';
  } else if (status === 500) {
    message = 'Error interno del servidor';
  }

  res.status(status).json({
    status: 'error',
    message,
  });
}

module.exports = errorHandler;
