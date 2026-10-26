const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…', times: '×', euro: '€' };
export const decode = (value = '') => String(value).replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (all, key) => {
  if (key.startsWith('#')) {
    const n = key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : Number(key.slice(1));
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : all;
  }
  return entities[key.toLowerCase()] ?? all;
});
export const text = (node) => decode((node?.children || []).map((child) => typeof child === 'string' ? child : text(child)).join(' ')).replace(/\s+/g, ' ').trim();
const hasClass = (node, name) => (node.attrs?.class || '').split(/\s+/).includes(name);
const descendants = (node, predicate) => {
  const result = [];
  const visit = (item) => { for (const child of item.children || []) if (typeof child !== 'string') { if (predicate(child)) result.push(child); visit(child); } };
  visit(node); return result;
};
const byClass = (node, name) => descendants(node, (item) => hasClass(item, name));
const byTag = (node, tag) => descendants(node, (item) => item.tag === tag);
const rawWidth = (node) => {
  const match = node?.attrs?.style?.match(/(?:^|;)\s*width\s*:\s*(-?[\d.]+)\s*%/i);
  return match && Number.isFinite(Number(match[1])) ? Number(match[1]) : null;
};
const width = (node) => { const value = rawWidth(node); return value !== null && value >= 0 && value <= 100 ? value : null; };
const numeric = (value) => value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
const url = (value, base) => { if (typeof value !== 'string' || !value) return null; try { const parsed = new URL(value, base); return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null; } catch { return null; } };

// Small inert HTML tree. Scripts/styles/SVG/noscript are never executed or retained.
export const parseTree = (source) => {
  const html = source.replace(/<(script|style|svg|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  const root = { tag: '#root', attrs: {}, children: [] };
  const stack = [root];
  const voids = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  const tokens = /<\/?[a-zA-Z][^>]*>|[^<]+/g;
  for (const match of html.matchAll(tokens)) {
    const token = match[0];
    if (!token.startsWith('<')) { stack.at(-1).children.push(token); continue; }
    const tag = token.match(/^<\/?([\w:-]+)/)?.[1]?.toLowerCase();
    if (!tag) continue;
    if (token.startsWith('</')) {
      for (let n = stack.length - 1; n > 0; n--) if (stack[n].tag === tag) { stack.length = n; break; }
      continue;
    }
    const attrs = {};
    for (const entry of token.slice(tag.length + 1, -1).matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attrs[entry[1].toLowerCase()] = decode(entry[2] ?? entry[3] ?? entry[4] ?? '');
    const node = { tag, attrs, children: [], parent: stack.at(-1) };
    stack.at(-1).children.push(node);
    if (!voids.has(tag) && !token.endsWith('/>')) stack.push(node);
  }
  return root;
};

export const parseJsonResponse = (source) => {
  try { return JSON.parse(source); } catch { /* A public shortcode can echo HTML ahead of the JSON. */ }
  for (const match of source.matchAll(/\[\s*\{\s*"id"\s*:/g)) {
    let quoted = false, escaped = false, depth = 0;
    for (let i = match.index; i < source.length; i++) {
      const char = source[i];
      if (quoted) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') quoted = false; continue; }
      if (char === '"') quoted = true;
      else if (char === '[' || char === '{') depth++;
      else if (char === ']' || char === '}') {
        depth--;
        if (depth === 0) { try { return JSON.parse(source.slice(match.index, i + 1)); } catch { break; } }
      }
    }
  }
  throw new Error('Public API response did not contain a valid product array');
};

export const normalizeApiProduct = (product, fetchedAt) => {
  const prices = product.prices || {};
  const unit = 10 ** Number(prices.currency_minor_unit || 0);
  const amount = (value) => numeric(value) === null ? null : Number(value) / unit;
  return {
    sourceId: product.id, name: decode(product.name), slug: product.slug,
    sourceUrl: product.permalink, apiFetchedAt: fetchedAt, productType: product.type, sku: product.sku || null,
    currency: prices.currency_code || null,
    price: amount(prices.price), regularPrice: amount(prices.regular_price), salePrice: amount(prices.sale_price),
    priceRange: prices.price_range ? { min: amount(prices.price_range.min_amount), max: amount(prices.price_range.max_amount) } : null,
    onSale: product.on_sale, inStock: product.is_in_stock, purchasable: product.is_purchasable,
    averageRating: numeric(product.average_rating), reviewCount: product.review_count ?? null,
    images: (product.images || []).map((image) => ({ sourceId: image.id, url: image.src, thumbnailUrl: image.thumbnail || null })),
    categories: (product.categories || []).map(({ id, name, slug, link }) => ({ id, name: decode(name), slug, url: link })),
    brands: (product.brands || []).map(({ id, name, slug, link }) => ({ id, name: decode(name), slug, url: link })),
    attributes: (product.attributes || []).map((attribute) => ({ name: decode(attribute.name), taxonomy: attribute.taxonomy, varies: attribute.has_variations, terms: (attribute.terms || []).map(({ id, name, slug }) => ({ id, name: decode(name), slug })) })),
    variantReferences: (product.variations || []).map((variant) => ({ sourceId: variant.id, attributes: variant.attributes })),
  };
};

export const parseProductPage = (html, sourceUrl) => {
  const tree = parseTree(html);
  const title = byTag(tree, 'h1').map(text).find(Boolean) || null;
  const specs = {};
  for (const table of byClass(tree, 'shop_attributes')) for (const row of byTag(table, 'tr')) {
    const label = text(byTag(row, 'th')[0]); const cell = byTag(row, 'td')[0];
    if (label && cell) specs[label.toLocaleLowerCase('vi')] = { value: text(cell), links: byTag(cell, 'a').map((a) => ({ label: text(a), url: url(a.attrs.href, sourceUrl) })) };
  }
  const charts = byClass(tree, 'perfume-chart').map((chart) => ({
    label: text(byClass(chart, 'chart-title')[0]),
    rows: byClass(chart, 'chart-item').map((row) => {
      const count = numeric(text(byClass(row, 'chart-value')[0]));
      const fill = byClass(row, 'chart-bar-fill')[0]; const raw = rawWidth(fill); const percent = width(fill);
      return {
        label: text(byClass(row, 'chart-label')[0]), displayedCount: count !== null && Number.isInteger(count) && count >= 0 ? count : null,
        displayedPercent: percent,
        ...(count !== null && (!Number.isInteger(count) || count < 0) ? { sourceRawCount: count, sourceCountIssue: 'not_a_nonnegative_integer' } : {}),
        ...(raw !== null && percent === null ? { sourceRawPercent: raw, sourceValueIssue: 'outside_0_to_100' } : {}),
      };
    }),
  }));
  const suitability = [...byClass(tree, 'season-item'), ...byClass(tree, 'time-item')].map((node) => {
    const fill = byClass(node, 'value-fill')[0]; const raw = rawWidth(fill); const percent = width(fill);
    return { label: text(node), displayedPercent: percent, ...(raw !== null && percent === null ? { sourceRawPercent: raw, sourceValueIssue: 'outside_0_to_100' } : {}) };
  });
  const phases = {};
  for (const heading of byClass(tree, 'title-nh')) {
    const key = { 'top notes': 'top', 'middle notes': 'middle', 'base notes': 'base' }[text(heading).toLowerCase()];
    if (!key) continue;
    const siblings = heading.parent.children;
    const next = siblings.slice(siblings.indexOf(heading) + 1).find((node) => typeof node !== 'string');
    if (next && hasClass(next, 'nh-phase-notes')) phases[key] = byTag(next, 'a').map((a) => ({ name: text(byTag(a, 'p')[0]) || byTag(a, 'img')[0]?.attrs.alt || text(a), url: url(a.attrs.href, sourceUrl) }));
  }
  const accordNodes = descendants(tree, (node) => node.attrs.class?.split(/\s+/).some((name) => /^(accord-bar|accord-item|accord)$/i.test(name)));
  const accords = accordNodes.map((node) => {
    const content = text(node); const match = content.match(/^(.*?)\s*\(([\d.,]+)%\)$/);
    const link = node.tag === 'a' ? node : byTag(node, 'a')[0];
    return match ? { label: match[1].trim(), displayedPercent: Number(match[2].replace(',', '.')), url: url(link?.attrs.href, sourceUrl) } : null;
  }).filter(Boolean);
  const form = byClass(tree, 'variations_form')[0];
  const raw = form?.attrs['data-product_variations'];
  let variants = null; const warnings = [];
  if (raw && raw !== 'false') {
    try {
      const data = JSON.parse(raw);
      if (Array.isArray(data)) variants = data.map((variant) => ({
        sourceId: variant.variation_id, attributes: variant.attributes, price: numeric(variant.display_price), regularPrice: numeric(variant.display_regular_price),
        inStock: variant.is_in_stock, purchasable: variant.is_purchasable, active: variant.variation_is_active, visible: variant.variation_is_visible,
        sku: variant.sku || null, imageUrl: url(variant.image?.url || variant.image?.src, sourceUrl),
        minPurchaseQuantity: numeric(variant.min_qty), maxPurchaseQuantity: numeric(variant.max_qty),
      }));
      else warnings.push('variation_data_not_array');
    } catch { warnings.push('variation_data_invalid_json'); }
  } else if (form) warnings.push('variation_details_not_embedded');
  const options = byTag(tree, 'select').filter((select) => select.attrs.name?.startsWith('attribute_')).map((select) => ({ attribute: select.attrs.name, options: byTag(select, 'option').filter((option) => option.attrs.value).map((option) => ({ value: option.attrs.value, label: text(option) })) }));
  return {
    pageTitle: title, specifications: specs, accords, scentNotes: phases, variants, variantOptions: options,
    longevity: charts.find((chart) => chart.label.toLowerCase() === 'lưu')?.rows || [],
    sillage: charts.find((chart) => chart.label.toLowerCase() === 'tỏa')?.rows || [],
    suitability, warnings,
    assessmentProvenance: { displayedBy: 'apaniche.vn', originalAssessmentSource: null, methodologyVerified: false },
  };
};
