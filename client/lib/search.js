/**
 * /api/search returns one flat array whose rows carry a singular `type`
 * ("student", "class", …). The search UIs group and link by plural type.
 */
export function flattenSearchResults(data) {
  const results = data?.results;
  if (Array.isArray(results)) {
    return results.map((r) => ({ ...r, _type: `${r.type}s` }));
  }
  const flat = [];
  Object.entries(results || {}).forEach(([type, items]) => {
    (items || []).forEach((item) => flat.push({ ...item, _type: type }));
  });
  return flat;
}
