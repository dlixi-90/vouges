const TONE_MAP = {
  'oà': 'òa', 'oá': 'óa', 'oả': 'ỏa', 'oã': 'õa', 'oạ': 'ọa',
  'oè': 'òe', 'oé': 'óe', 'oẻ': 'ỏe', 'oẽ': 'õe', 'oẹ': 'ọe',
  'uỳ': 'ùy', 'uý': 'úy', 'uỷ': 'ủy', 'uỹ': 'ũy', 'uỵ': 'ụy'
};

export const canonicalizeVietnamese = value => {
  let s = String(value || '').normalize('NFC').toLocaleLowerCase('vi-VN').trim().replace(/\s+/g, ' ');
  for (const [k, v] of Object.entries(TONE_MAP)) {
    s = s.replaceAll(k, v);
  }
  return s;
};

export const normalizeLibrarySearch = value => String(value || '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLocaleLowerCase('vi-VN').trim().replace(/\s+/g, ' ');

const termIndexCache = new WeakMap();
const getTermIndex = term => {
  if (!term || typeof term !== 'object') {
    return {
      canonName: canonicalizeVietnamese(term?.name),
      canonEnglish: canonicalizeVietnamese(term?.englishName),
      folded: normalizeLibrarySearch(`${term?.name || ''} ${term?.englishName || ''}`),
    };
  }
  let entry = termIndexCache.get(term);
  if (!entry || entry.name !== term.name || entry.englishName !== term.englishName) {
    entry = {
      name: term.name,
      englishName: term.englishName,
      canonName: canonicalizeVietnamese(term.name),
      canonEnglish: canonicalizeVietnamese(term.englishName),
      folded: normalizeLibrarySearch(`${term.name || ''} ${term.englishName || ''}`),
    };
    termIndexCache.set(term, entry);
  }
  return entry;
};

export const filterLibraryTerms = (terms, query, origin = '') => {
  const rawQuery = String(query || '').trim();
  if (!rawQuery && !origin) return terms;

  const needle = normalizeLibrarySearch(rawQuery);
  const canonQuery = canonicalizeVietnamese(rawQuery);
  const hasAccent = canonQuery !== needle;

  return terms.filter(term => {
    if (origin && !term.originIds?.includes(origin)) return false;
    if (!needle) return true;

    const indexed = getTermIndex(term);
    if (hasAccent) {
      return indexed.canonName.includes(canonQuery) || indexed.canonEnglish.includes(canonQuery);
    }

    return indexed.folded.includes(needle);
  });
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
