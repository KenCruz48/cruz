function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}
function objectId(value, name = 'ID') {
  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) throw httpError(400, `${name} invalido`);
  return value;
}
function pagination(query = {}) {
  const integer = (value, fallback, max) => {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) throw httpError(400, 'Paginacion invalida');
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed > max) throw httpError(400, 'Paginacion invalida');
    return parsed;
  };
  const page = integer(query.page, 1, 10000);
  const limit = integer(query.limit, 20, 100);
  return { page, limit, skip: (page - 1) * limit };
}
module.exports = { httpError, objectId, pagination };
