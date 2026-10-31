export const scentPhases = [
  ['top', 'Hương đầu'], ['middle', 'Hương giữa'], ['base', 'Hương cuối'],
  ['general', 'Các nốt hương (không phân tầng)'],
];

export const scentNoteNames = fragrance => [fragrance, ...(fragrance?.components || [])]
  .flatMap(profile => scentPhases.flatMap(([phase]) => (profile?.notes?.[phase] || [])
    .map(note => typeof note === 'string' ? note : note?.name).filter(Boolean)));
