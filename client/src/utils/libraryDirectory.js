export const normalizeLibrarySearch = value => String(value || '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLocaleLowerCase('vi-VN').trim();

export const filterLibraryTerms = (terms, query, origin = '') => {
  const needle = normalizeLibrarySearch(query);
  return terms.filter(term => (!origin || term.originIds?.includes(origin))
    && (!needle || normalizeLibrarySearch(`${term.name} ${term.englishName || ''}`).includes(needle)));
};

export function groupLibraryTerms(terms, origins) {
  const groups = origins.map(origin => ({ ...origin, terms: [] }));
  const byId = new Map(groups.map(group => [group.id, group]));
  const other = { id: 'other-notes', name: 'Các note hương khác', description: 'Khám phá thêm những chất liệu và liên tưởng trong điều hương.', terms: [] };
  for (const term of terms) {
    const memberships = [...new Set(term.originIds || [])].map(id => byId.get(id)).filter(Boolean);
    if (memberships.length) for (const group of memberships) group.terms.push(term);
    else other.terms.push(term);
  }
  return [...groups, other].filter(group => group.terms.length);
}

export const libraryDisplayName = term => {
  const suffix = term.name.match(/\s*\(([^()]+)\)\s*$/u);
  return suffix && normalizeLibrarySearch(suffix[1]) === normalizeLibrarySearch(term.englishName)
    ? term.name.slice(0, suffix.index).trim() : term.name;
};
