const pageNumber = (value, fallback = 1) => Number.isFinite(Number(value))
  ? Math.max(1, Math.trunc(Number(value))) : fallback;

// At most seven slots, even with thousands of pages.
export const getPaginationPages = (currentPage, totalPages) => {
  const total = pageNumber(totalPages);
  const current = Math.min(pageNumber(currentPage), total);
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);

  let start = Math.max(2, current - 1);
  let end = Math.min(total - 1, current + 1);
  if (current <= 4) { start = 2; end = 5; }
  if (current >= total - 3) { start = total - 4; end = total - 1; }
  const pages = [1];
  if (start === 3) pages.push(2);
  else if (start > 3) pages.push("start-gap");
  for (let page = start; page <= end; page++) pages.push(page);
  if (end === total - 2) pages.push(total - 1);
  else if (end < total - 2) pages.push("end-gap");
  pages.push(total);
  return pages;
};
