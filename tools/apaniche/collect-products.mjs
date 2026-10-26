import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeApiProduct, parseJsonResponse, parseProductPage } from './product-parser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = path.join(root, 'data/research/apaniche');
fs.mkdirSync(output, { recursive: true });
const origin = 'https://apaniche.vn';
const fields = 'id,name,slug,permalink,sku,type,prices,images,attributes,variations,categories,brands,is_in_stock,is_purchasable,on_sale,average_rating,review_count';
const args = new Map(process.argv.slice(2).map((arg) => arg.replace(/^--/, '').split('=')));
const phase = args.get('phase') || 'all';
const limit = args.has('html-limit') ? Math.max(0, Number(args.get('html-limit'))) : Infinity;
const concurrency = Math.min(3, Math.max(1, Number(args.get('concurrency') || 2)));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const read = (name, fallback) => { try { return JSON.parse(fs.readFileSync(path.join(output, name), 'utf8')); } catch (error) { if (error.code === 'ENOENT') return fallback; throw error; } };
const write = (name, value) => fs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2));
const now = () => new Date().toISOString();
let lastStart = 0, cooldownUntil = 0, stopped = false;
let requests = 0, bytes = 0;
const throttle = async () => {
  const start = Math.max(Date.now(), lastStart + 300, cooldownUntil);
  lastStart = start;
  await sleep(Math.max(0, start - Date.now()));
  if (stopped) throw new Error('Collection stopped after an access/rate-limit response');
};

const request = async (sourceUrl, pageHtml = false) => {
  const address = new URL(sourceUrl);
  if (address.origin !== origin || address.pathname.startsWith('/wp-admin') || address.pathname.startsWith('/wp-login')) throw new Error('URL outside the public collection scope');
  let error;
  for (let attempt = 0; attempt < 3; attempt++) {
    await throttle();
    try {
      const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(30000), headers: { 'User-Agent': 'VeloursPublicCatalogResearch/1.0', Accept: pageHtml ? 'text/html' : 'application/json,text/plain' } });
      requests++;
      if (new URL(response.url).origin !== origin) { await response.body?.cancel(); throw new Error('Unexpected cross-origin redirect'); }
      if (response.status === 401 || response.status === 403) {
        stopped = true; await response.body?.cancel();
        throw new Error(`Access denied (${response.status}); collection stopped`);
      }
      if (response.status === 429) {
        const retry = response.headers.get('retry-after');
        const seconds = Number(retry);
        const delay = retry ? Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retry) - Date.now() : 60000;
        cooldownUntil = Date.now() + Math.max(60000, delay || 0);
        await response.body?.cancel();
        console.log(JSON.stringify({ event: 'rate_limit', retryAt: new Date(cooldownUntil).toISOString() }));
        error = new Error('Rate limited'); continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        const failed = new Error(`HTTP ${response.status}`); failed.status = response.status;
        if (response.status >= 500 && attempt < 2) { await sleep(2000 * (attempt + 1)); error = failed; continue; }
        throw failed;
      }
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let content = ''; let size = 0; let truncated = false;
      try {
        while (true) {
          const result = await reader.read();
          if (result.done) break;
          size += result.value.byteLength;
          if (size > 12 * 1024 * 1024) throw new Error('Response exceeded the research size limit');
          content += decoder.decode(result.value, { stream: true });
          // All needed product facts precede reviews. Skip reviews and the large global filter/footer.
          if (pageHtml) {
            const boundary = content.search(/\bid=["']reviews["']/i);
            if (boundary > 0) { content = content.slice(0, boundary); truncated = true; await reader.cancel(); break; }
          }
        }
        if (!truncated) content += decoder.decode();
      } finally { reader.releaseLock(); }
      bytes += size;
      return { content, sourceUrl: response.url, fetchedAt: now(), httpStatus: response.status, total: Number(response.headers.get('x-wp-total')), pages: Number(response.headers.get('x-wp-totalpages')), bytesRead: size, stoppedBeforeReviews: truncated };
    } catch (caught) {
      error = caught;
      if (stopped || caught.status && caught.status < 500) throw caught;
      if (attempt < 2) await sleep(1500 * (attempt + 1));
    }
  }
  throw error;
};

const baseFile = 'catalog-base.json';
const loadCatalog = async () => {
  const saved = read(baseFile, null);
  if (saved && !args.has('refresh')) return saved;
  const catalog = new Map(); let pages = 1, total = 0; const pageReceipts = [];
  for (let page = 1; page <= pages; page++) {
    const result = await request(`${origin}/wp-json/wc/store/v1/products?per_page=100&page=${page}&orderby=id&order=asc&_fields=${fields}`);
    const products = parseJsonResponse(result.content);
    if (!Array.isArray(products) || products.some((product) => !Number.isInteger(product.id) || !product.permalink)) throw new Error('Invalid product records from the public API');
    if (page === 1) { pages = result.pages; total = result.total; if (!pages || !total || pages > 200) throw new Error('Unexpected public API pagination'); }
    products.forEach((product) => catalog.set(product.id, normalizeApiProduct(product, result.fetchedAt)));
    pageReceipts.push({ page, count: products.length, fetchedAt: result.fetchedAt, sourceUrl: result.sourceUrl });
    if (page === 1 || page % 5 === 0 || page === pages) console.log(JSON.stringify({ event: 'catalog', page, pages, collected: catalog.size, total }));
  }
  if (catalog.size !== total) throw new Error(`Catalog changed during collection: expected ${total}, received ${catalog.size}; rerun with --refresh`);
  const result = { createdAt: now(), source: `${origin}/wp-json/wc/store/v1/products`, reportedTotal: total, pages: pageReceipts, products: [...catalog.values()] };
  write(baseFile, result); return result;
};

const loadDetails = () => {
  const saved = new Map(); const file = path.join(output, 'product-details.jsonl');
  if (!fs.existsSync(file)) return saved;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean)) {
    try { const entry = JSON.parse(line); saved.set(entry.sourceId, entry); }
    catch { throw new Error('Malformed checkpoint line; refusing to overwrite research data'); }
  }
  return saved;
};
const appendDetail = (entry) => fs.appendFileSync(path.join(output, 'product-details.jsonl'), JSON.stringify(entry) + '\n');
const collectVariantSupplements = async (catalog, details) => {
  const saved = new Map(read('variant-supplements.json', []).map((item) => [item.sourceId, item]));
  for (const product of catalog.products) {
    const detail = details.get(product.sourceId); if (detail?.status !== 'ok') continue;
    const pageIds = new Set((detail.data.variants || []).map((item) => item.sourceId));
    for (const reference of product.variantReferences.filter((item) => !pageIds.has(item.sourceId))) {
      if (saved.has(reference.sourceId)) continue;
      const sourceUrl = `${origin}/wp-json/wc/store/v1/products/${reference.sourceId}?_fields=id,parent,prices,images,is_in_stock,is_purchasable,sku`;
      try {
        const response = await request(sourceUrl); const raw = parseJsonResponse(response.content);
        if (raw.id !== reference.sourceId || raw.parent !== product.sourceId) throw new Error('Public variant identity did not match its parent');
        const normalized = normalizeApiProduct(raw, response.fetchedAt);
        const attributes = Object.fromEntries((reference.attributes || []).map((attribute) => {
          const taxonomy = product.attributes.find((item) => item.name === attribute.name)?.taxonomy;
          return [taxonomy ? `attribute_${taxonomy}` : attribute.name, attribute.value];
        }));
        saved.set(raw.id, { productId: product.sourceId, sourceId: raw.id, sourceUrl, fetchedAt: response.fetchedAt, detailSource: 'public_store_api', attributes, price: normalized.price, regularPrice: normalized.regularPrice, inStock: normalized.inStock ?? null, purchasable: normalized.purchasable ?? null, sku: normalized.sku, imageUrl: normalized.images[0]?.url || null, ...(normalized.price === 0 ? { sourcePriceIssue: 'zero_price_not_verified_as_free' } : {}) });
      } catch (error) {
        console.log(JSON.stringify({ event: 'variant_supplement_error', id: reference.sourceId, error: error.message }));
        if (stopped) throw error;
      }
    }
  }
  write('variant-supplements.json', [...saved.values()]);
};
const csv = (name, headings, rows) => {
  const cell = (value) => {
    let content = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
    if (/^[=+\-@\t\r]/.test(content)) content = "'" + content;
    return '"' + content.replaceAll('"', '""') + '"';
  };
  fs.writeFileSync(path.join(output, name), '\uFEFF' + [headings.map(cell).join(','), ...rows.map((row) => row.map(cell).join(','))].join('\r\n'));
};

const exportCatalog = (catalog, details) => {
  const supplements = read('variant-supplements.json', []);
  const products = catalog.products.map((product) => ({ ...product, detailStatus: details.get(product.sourceId)?.status || 'pending', detail: details.get(product.sourceId) || null, variantSupplements: supplements.filter((item) => item.productId === product.sourceId) }));
  const variants = products.flatMap((product) => [...(product.detail?.data?.variants || []), ...product.variantSupplements.filter((item) => !product.detail?.data?.variants?.some((variant) => variant.sourceId === item.sourceId))].map((variant) => {
    const labels = Object.entries(variant.attributes || {}).map(([attribute, value]) => ({
      attribute, value,
      label: product.detail.data.variantOptions.find((option) => option.attribute === attribute)?.options.find((option) => option.value === value)?.label || value,
    }));
    return { productId: product.sourceId, productName: product.name, productUrl: product.sourceUrl, currency: product.currency, ...variant, detailSource: variant.detailSource || 'public_product_page', fetchedAt: variant.fetchedAt || product.detail?.fetchedAt, sourceUrl: variant.sourceUrl || product.sourceUrl, attributeLabels: labels, sizeLabel: labels.map((item) => item.label).join(' / ') };
  }));
  const value = (product, name) => product.detail?.data?.specifications?.[name]?.value || product.attributes.find((attribute) => attribute.name.toLocaleLowerCase('vi') === name)?.terms.map((term) => term.name).join(' | ') || null;
  const summary = {
    exportedAt: now(), scope: 'Public published product facts from apaniche.vn; no account, order or admin data',
    totalProducts: products.length, completeDetails: products.filter((product) => product.detailStatus === 'ok').length,
    failedDetails: products.filter((product) => product.detailStatus === 'error').length, pendingDetails: products.filter((product) => product.detailStatus === 'pending').length,
    variants: variants.length, productsWithVariants: new Set(variants.map((variant) => variant.productId)).size,
    supplementalVariantCount: supplements.length,
    productsWithLongevity: products.filter((product) => product.detail?.data?.longevity?.length).length,
    productsWithSillage: products.filter((product) => product.detail?.data?.sillage?.length).length,
    productsWithSuitability: products.filter((product) => product.detail?.data?.suitability?.length).length,
    productsWithNotes: products.filter((product) => Object.keys(product.detail?.data?.scentNotes || {}).length).length,
    productsWithAccords: products.filter((product) => product.detail?.data?.accords?.length).length,
    imageUrls: products.reduce((total, product) => total + product.images.length, 0),
    distinctBrands: [...new Set(products.map((product) => value(product, 'thương hiệu')).filter(Boolean))].sort(),
    requestsThisRun: requests, decodedBytesThisRun: bytes,
    limitations: [
      'Prices are amounts in the source currency (VND), not the thousands-of-VND storage used by Velours.',
      'Availability booleans are public source states; exact warehouse quantities were not collected.',
      'Chart counts and percentages are source-displayed values; their original provenance and methodology are unverified.',
      'Missing values remain null/empty; missing charts do not mean zero suitability.',
      'Image files and long editorial descriptions were not copied; original image URLs and factual attributes are retained.',
      'Nothing has been imported into the Velours application database.',
    ],
    failures: products.filter((product) => product.detailStatus === 'error').map((product) => ({ id: product.sourceId, url: product.sourceUrl, error: product.detail.error })),
  };
  write('products.json', products); write('variants.json', variants); write('collection-summary.json', summary);
  csv('products.csv', ['source_id','name','source_url','currency','price','price_min','price_max','in_stock','brand','origin','gender','concentration','scent_group','sizes','image_urls','detail_status','fetched_at'], products.map((product) => [product.sourceId, product.name, product.sourceUrl, product.currency, product.price, product.priceRange?.min, product.priceRange?.max, product.inStock, value(product,'thương hiệu'), value(product,'xuất xứ'), value(product,'giới tính'), value(product,'nồng độ'), value(product,'nhóm hương'), product.detail?.data?.variantOptions || product.attributes.filter((attribute) => attribute.varies), product.images.map((image) => image.url), product.detailStatus, product.detail?.fetchedAt || product.apiFetchedAt]));
  csv('variants.csv', ['product_id','product_name','product_url','variant_id','size_label','attributes','currency','price','regular_price','in_stock','purchasable','image_url','max_purchase_quantity','detail_source','source_url','fetched_at','source_price_issue'], variants.map((variant) => [variant.productId,variant.productName,variant.productUrl,variant.sourceId,variant.sizeLabel,variant.attributes,variant.currency,variant.price,variant.regularPrice,variant.inStock,variant.purchasable,variant.imageUrl,variant.maxPurchaseQuantity,variant.detailSource,variant.sourceUrl,variant.fetchedAt,variant.sourcePriceIssue]));
  csv('assessments.csv', ['product_id','name','source_url','longevity','sillage','season_and_day_night','scent_notes','accords','original_assessment_source','methodology_verified'], products.map((product) => [product.sourceId, product.name, product.sourceUrl, product.detail?.data?.longevity, product.detail?.data?.sillage, product.detail?.data?.suitability, product.detail?.data?.scentNotes, product.detail?.data?.accords, null, false]));
  return summary;
};

try {
  const robots = await request(`${origin}/robots.txt`);
  if (/Disallow:\s*\/\s*(?:\r?\n|$)/i.test(robots.content)) throw new Error('Robots currently disallows site collection');
  const catalog = await loadCatalog(); const details = loadDetails();
  if (phase !== 'base' && phase !== 'export') {
    const recheckIds = new Set((args.get('recheck-ids') || '').split(',').filter(Boolean).map(Number));
    const todo = catalog.products.filter((product) => !details.has(product.sourceId) || recheckIds.has(product.sourceId) || args.has('retry-errors') && details.get(product.sourceId).status === 'error').slice(0, limit);
    let next = 0, completed = 0; const startedAt = now();
    const progress = () => {
      const status = { updatedAt: now(), startedAt, total: catalog.products.length, detailsRecorded: details.size, processedThisRun: completed, queuedThisRun: todo.length, requestsThisRun: requests, decodedBytesThisRun: bytes, stopped };
      write('progress.json', status); return status;
    };
    progress();
    await Promise.all(Array.from({ length: concurrency }, async () => {
      while (!stopped) {
        const product = todo[next++]; if (!product) break;
        let entry;
        try {
          const response = await request(product.sourceUrl, true); const data = parseProductPage(response.content, product.sourceUrl);
          if (!data.pageTitle) throw new Error('Missing product title; source page layout could not be verified');
          if (/captcha|access denied|just a moment/i.test(data.pageTitle)) { stopped = true; throw new Error('Source presented an access challenge; stopping'); }
          const expected = (product.name || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
          const observed = data.pageTitle.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
          if (expected !== observed) data.warnings.push('page_title_differs_from_api_name');
          entry = { sourceId: product.sourceId, status: 'ok', fetchedAt: response.fetchedAt, sourceUrl: response.sourceUrl, stoppedBeforeReviews: response.stoppedBeforeReviews, bytesRead: response.bytesRead, data };
        } catch (error) {
          entry = { sourceId: product.sourceId, status: 'error', fetchedAt: now(), sourceUrl: product.sourceUrl, error: error.message };
        }
        appendDetail(entry); details.set(product.sourceId, entry); completed++;
        if (completed % 10 === 0 || completed === todo.length || stopped) {
          const status = progress();
          if (completed % 100 === 0 || completed === todo.length || stopped) console.log(JSON.stringify({ event: 'details', ...status }));
        }
      }
    }));
    progress();
  }
  if (phase !== 'base' && phase !== 'export') await collectVariantSupplements(catalog, details);
  const summary = exportCatalog(catalog, details);
  console.log(JSON.stringify({ event: 'export', total: summary.totalProducts, completeDetails: summary.completeDetails, failedDetails: summary.failedDetails, pendingDetails: summary.pendingDetails, variants: summary.variants, output }));
  if (stopped) process.exitCode = 2;
} catch (error) { console.error(JSON.stringify({ event: 'fatal', error: error.message, output })); process.exitCode = 1; }
