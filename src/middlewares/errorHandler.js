
function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  const isDuplicate = error.code === 11000;
  const status = isDuplicate ? 409 : (error.name === 'ValidationError' ? 400 : (error.status || 500));

  let message = error.message;

  if (isDuplicate) {
    message = error.keyPattern?.email ? 'Ya existe un usuario con ese correo'
      : 'El participante ya tiene una inscripcion activa en este evento';
  } else if (error.type === 'entity.parse.failed') {
    message = 'El cuerpo de la solicitud contiene JSON inválido.';
  } else if (status === 413) {
    message = 'La solicitud supera el tamaño permitido.';
  } else if (status === 500) {
    message = 'Error interno del servidor';
  }

  res.status(status).json({
    status: 'error',
    message,
  });
}

module.exports = errorHandler;
