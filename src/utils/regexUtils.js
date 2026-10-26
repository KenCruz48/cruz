
/**
 * Escapa los caracteres especiales de una cadena para utilizarla
 * como texto literal dentro de una expresión regular.
 *
 * @param {string} value Texto que se desea escapar.
 * @returns {string} Texto seguro para incluir en una expresión regular.
 */
function escapeRegex(value) {
  if (typeof value !== 'string') {
    throw new TypeError('El valor debe ser una cadena de texto');
  }

  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { escapeRegex };
