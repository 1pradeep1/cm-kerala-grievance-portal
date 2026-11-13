const { AppError } = require('./errors');

function parseId(value, label = 'id') {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 2147483647) throw new AppError(400, `Invalid ${label}`);
  return n;
}

module.exports = { parseId };
