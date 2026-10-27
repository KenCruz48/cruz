const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

function authError() {
  return Object.assign(new Error('Credenciales invalidas'), { status: 401 });
}

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value || Buffer.byteLength(value) < 32) {
    throw new Error('JWT_SECRET debe contener al menos 32 bytes');
  }
  return value;
}

async function login(credentials) {
  const { email, password } = credentials || {};
  if (typeof email !== 'string' || typeof password !== 'string') throw authError();
  if (email.length > 254 || Buffer.byteLength(password, 'utf8') > 72) throw authError();
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash');
  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) throw authError();
  const token = jwt.sign({}, secret(), {
    algorithm: 'HS256', subject: String(user._id), expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    issuer: 'racetrack-api', audience: 'racetrack-client',
  });
  return { token, user: { id: user._id, name: user.name, email: user.email } };
}

async function authenticate(token) {
  const key = secret();
  let payload;
  try {
    payload = jwt.verify(token, key, { algorithms: ['HS256'], issuer: 'racetrack-api', audience: 'racetrack-client' });
    if (typeof payload.sub !== 'string' || !/^[a-f0-9]{24}$/i.test(payload.sub)) throw authError();
  } catch { throw authError(); }
  const user = await User.findById(payload.sub);
  if (!user || !user.active) throw authError();
  return { id: String(user._id), name: user.name, email: user.email };
}

module.exports = { login, authenticate };
