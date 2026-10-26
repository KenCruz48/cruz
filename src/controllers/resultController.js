const resultService =
  require('../services/resultService');

async function createResult(
  req,
  res
) {
  const result =
    await resultService.createResult(
      req.body,
      req.user.id
    );

  res.status(201).json({
    status: 'success',
    message:
      'Resultado registrado correctamente',
    data: result,
  });
}

module.exports = {
  createResult,
};