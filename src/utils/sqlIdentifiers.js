const SQL_IDENTIFIER_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;

function isValidSqlIdentifier(value) {
  return typeof value === 'string' && SQL_IDENTIFIER_REGEX.test(value.trim());
}

function normalizeSqlIdentifier(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function assertSqlIdentifier(value, fieldName) {
  const normalized = normalizeSqlIdentifier(value);
  if (!isValidSqlIdentifier(normalized)) {
    throw new Error(`Identificador SQL inválido para ${fieldName}. Use apenas letras, números e underscore.`);
  }
  return normalized;
}

module.exports = {
  isValidSqlIdentifier,
  normalizeSqlIdentifier,
  assertSqlIdentifier
};
