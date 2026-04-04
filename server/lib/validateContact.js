function isValidEmail(s) {
  if (typeof s !== 'string') return false;
  const t = s.trim().toLowerCase();
  if (t.length < 5 || t.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

function isValidLoginUrl(urlString) {
  try {
    const u = new URL(String(urlString).trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    if (!u.hostname || u.hostname.length > 253) return false;
    if (u.href.length > 2048) return false;
    return true;
  } catch {
    return false;
  }
}

module.exports = { isValidEmail, isValidLoginUrl };
