/**
 * Shared password rules for register / onboarding / password change.
 * Storage uses PostgreSQL crypt(..., gen_salt('bf')) — bcrypt via pgcrypto.
 */

const MIN_LENGTH = 8;
const MAX_LENGTH = 128;

function validatePassword(password) {
  const pw = password == null ? '' : String(password);
  if (pw.length < MIN_LENGTH) {
    return { ok: false, error: `Password must be at least ${MIN_LENGTH} characters` };
  }
  if (pw.length > MAX_LENGTH) {
    return { ok: false, error: `Password must be at most ${MAX_LENGTH} characters` };
  }
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) {
    return { ok: false, error: 'Password must include at least one letter and one number' };
  }
  return { ok: true };
}

module.exports = { validatePassword, MIN_LENGTH, MAX_LENGTH };
