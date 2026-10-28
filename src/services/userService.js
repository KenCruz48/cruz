const bcrypt = require('bcryptjs');
const User = require('../models/userModel');

async function registerUser(data = {}) {
  const { name, email, password } = data || {};
  if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string'
    || name.trim().length < 2 || name.trim().length > 100
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || !password) {
    const error = new Error(
      'Nombre, correo y contrasena son obligatorios'
    );
    error.status = 400;
    throw error;
  }

  if (password.length < 8) {
    const error = new Error(
      'La contrasena debe tener al menos 8 caracteres'
    );
    error.status = 400;
    throw error;
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (normalizedEmail.length > 254 || Buffer.byteLength(password, 'utf8') > 72) {
    throw Object.assign(new Error('Correo o contraseña supera la longitud permitida'), { status: 400 });
  }

  const existingUser = await User.findOne({
    email: normalizedEmail,
  });

  if (existingUser) {
    const error = new Error(
      'Ya existe un usuario con ese correo'
    );
    error.status = 409;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
  });

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    active: user.active,
    createdAt: user.createdAt,
  };
}

module.exports = {
  registerUser,
};
