'use strict';

const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ─── Brand registry ───────────────────────────────────────────────────────────

const BRANDS = [
  { slug: 'rolex',            name: 'Rolex' },
  { slug: 'omega',            name: 'Omega' },
  { slug: 'tudor',            name: 'Tudor' },
  { slug: 'patek-philippe',   name: 'Patek Philippe' },
  { slug: 'audemars-piguet',  name: 'Audemars Piguet' },
];

// Steiner uses p.vendor to identify brand
const VENDOR_TO_BRAND = {
  'Rolex': 'Rolex',
  'Omega': 'Omega',
  'Tudor': 'Tudor',
  'Patek Philippe': 'Patek Philippe',
  'Audemars Piguet': 'Audemars Piguet',
};
const TARGET_VENDORS = new Set(Object.keys(VENDOR_TO_BRAND));

// ─── Utilities ────────────────────────────────────────────────────────────────

function parsePrice(str) {
  if (!str) return null;
  let s = String(str).replace(/[€$£\s ]/g, '').replace(/,-$/, '');
  if (s.includes(',')) {
    const [int, dec] = s.split(',');
    s = `${int.replace(/\./g, '')}.${dec}`;
  } else {
    s = s.replace(/\./g, '');
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function parseYear(str) {
  const m = String(str || '').match(/\b(19[5-9]\d|20[0-2]\d)\b/);
  return m ? parseInt(m[0]) : null;
}

function extractRef(str) {
  if (!str) return null;
  const s = String(str);
  // Rolex modern: 126610LN, 116500LN, M126719BLRO
  const rm = s.match(/\bm?1[0-2]\d{4}[a-zA-Z]{0,4}\b/i);
  if (rm) return rm[0].toUpperCase().replace(/^M/, '');
  // Rolex vintage 4-5 digit: 1680, 16660
  const rv = s.match(/\b(1[0-9]\d{3,4})\b/);
  if (rv) return rv[0];
  // Omega dot-notation: 311.30.42.30.01.005
  const od = s.match(/\b\d{3}\.\d{2}\.\d{2}\.\d{2}\.\d{2}\.\d{3}\b/);
  if (od) return od[0];
  return null;
}

const DRY_RUN = process.argv.includes('--dry-run');

async function save(listings, source) {
  if (!listings.length) return 0;
  if (DRY_RUN) {
    console.log(`  [DRY-RUN] Would save ${listings.length} rows from ${source}`);
    return listings.length;
  }
  const { error } = await supabase.from('watches').insert(listings);
  if (error) {
    console.error(`  [${source}] DB error:`, error.message);
    return 0;
  }
  return listings.length;
}

// ─── 1. Amstel Watches — Rolex only (Shopify JSON API) ───────────────────────

async function scrapeAmstelWatches() {
  const SOURCE = 'Amstel Watches';
  console.log(`\n[${SOURCE}] Shopify JSON API (Rolex only)...`);
  try {
    const resp = await fetch('https://amstelwatches.nl/collections/rolex/products.json?limit=250', {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    });
    const { products = [] } = await resp.json();
    const listings = products.map(p => ({
      source: SOURCE, brand: 'Rolex',
      title: p.title,
      reference_number: extractRef(p.title) || extractRef(p.handle),
      price: p.variants?.[0]?.price ? parseFloat(p.variants[0].price) : null,
      image_url: p.images?.[0]?.src || null,
      url: `https://amstelwatches.nl/products/${p.handle}`,
      condition: p.tags?.some(t => /unworn|new|nieuw/i.test(t)) ? 'new'
        : p.tags?.some(t => /pre.?own|used|gedragen|tweedehands/i.test(t)) ? 'pre-owned'
        : null,
      year: parseYear(p.title) || parseYear(p.body_html),
    }));
    const saved = await save(listings, SOURCE);
    console.log(`  ${products.length} products → ${saved} saved`);
    return saved;
  } catch (e) {
    console.log(`  ERROR: ${e.message}`);
    return 0;
  }
}

// ─── 2. Steiner Maastricht — all target brands from /collections/watches ─────

async function scrapeSteinerMaastricht() {
  const SOURCE = 'Steiner Maastricht';
  console.log(`\n[${SOURCE}] Shopify JSON API (all brands)...`);
  try {
    const resp = await fetch('https://steinermaastricht.nl/collections/watches/products.json?limit=250', {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    });
    const { products: all = [] } = await resp.json();
    const target = all.filter(p => TARGET_VENDORS.has(p.vendor));

    const listings = target.map(p => ({
      source: SOURCE,
      brand: VENDOR_TO_BRAND[p.vendor],
      title: p.title,
      reference_number: extractRef(p.title) || extractRef(p.handle),
      price: p.variants?.[0]?.price ? parseFloat(p.variants[0].price) : null,
      image_url: p.images?.[0]?.src || null,
      url: `https://steinermaastricht.nl/products/${p.handle}`,
      condition: /pre.?own|tweedehands/i.test(p.product_type || '') ? 'pre-owned' : null,
      year: parseYear(p.title) || parseYear(p.body_html),
    }));

    // Log breakdown
    const byBrand = {};
    target.forEach(p => { byBrand[p.vendor] = (byBrand[p.vendor] || 0) + 1; });
    Object.entries(byBrand).forEach(([v, n]) => console.log(`  ${v}: ${n}`));

    const saved = await save(listings, SOURCE);
    console.log(`  ${target.length}/${all.length} target brands → ${saved} saved`);
    return saved;
  } catch (e) {
    console.log(`  ERROR: ${e.message}`);
    return 0;
  }
}

// ─── 3. Juwelier Burger — all brands (Playwright) ────────────────────────────

async function scrapeJuwelierBurger(browser) {
  const SOURCE = 'Juwelier Burger';
  console.log(`\n[${SOURCE}] Playwright (all brands)...`);
  const page = await browser.newPage();
  let totalSaved = 0;

  try {
    for (const brand of BRANDS) {
      const url = `https://www.juwelierburger.com/NL/horloges/${brand.slug}`;
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 35000 });
        await page.waitForTimeout(1200);

        // Scroll to trigger IntersectionObserver lazy-load
        for (let i = 0; i < 4; i++) {
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await page.waitForTimeout(800);
        }

        const items = await page.evaluate(() =>
          Array.from(document.querySelectorAll('a.item-wrapper')).map(card => {
            const imgEl = card.querySelector('img');
            const priceEl = card.querySelector('.item-price');
            return {
              href: card.getAttribute('href'),
              title: imgEl?.title || imgEl?.alt || card.textContent.trim().slice(0, 80),
              price: priceEl?.textContent?.trim() || null,
              image_url: imgEl?.src || null,
            };
          })
        );

        const listings = [];
        for (const item of items) {
          const listingUrl = item.href ? `https://www.juwelierburger.com${item.href}` : null;
          if (!listingUrl) continue;
          // Clean title: "Omega - Seamaster 300M" → "Omega Seamaster 300M"
          const title = (item.title || '').replace(/\s*-\s*/g, ' ').trim();
          listings.push({
            source: SOURCE,
            brand: brand.name,
            title,
            reference_number: extractRef(title) || extractRef(listingUrl),
            price: parsePrice(item.price),
            image_url: item.image_url || null,
            url: listingUrl,
            condition: null,
            year: parseYear(title),
          });
        }

        const saved = await save(listings, SOURCE);
        console.log(`  ${brand.name}: ${items.length} cards → ${saved} saved`);
        totalSaved += saved;
      } catch (e) {
        console.log(`  ${brand.name}: ERROR — ${e.message.slice(0, 60)}`);
      }
    }
  } finally {
    await page.close();
  }

  return totalSaved;
}

// ─── 4. Chronext NL — all brands (Playwright, paginated) ─────────────────────

const CONDITION_MAP_NL = {
  'nieuw': 'new', 'ongedragen': 'unworn', 'als nieuw': 'like new',
  'zeer goed': 'very good', 'goed': 'good', 'redelijk': 'fair',
};

async function scrapeChronextBrand(page, brand) {
  const BASE = `https://www.chronext.nl/${brand.slug}/gebruikte-horloges`;
  const allListings = [];
  const seenUrls = new Set();

  // Page 1: extract pagination meta
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 35000 });
  await page.waitForTimeout(1500);

  const paginationMeta = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('.pagination__list a[href]'));
    const offsets = links.map(a => {
      const m = a.href.match(/offset%5D=(\d+)/);
      return m ? parseInt(m[1]) : 0;
    }).filter(n => n > 0);
    const nodeIdMatch = links[0]?.href.match(/nodeId=([a-f0-9]+)/);
    const uuidMatch = links[0]?.href.match(/%5B([a-f0-9-]{36})%5D/);
    return {
      maxOffset: offsets.length ? Math.max(...offsets) : 0,
      nodeId: nodeIdMatch?.[1] || null,
      uuid: uuidMatch?.[1] || null,
    };
  });

  const allUrls = [BASE];
  if (paginationMeta.uuid && paginationMeta.nodeId) {
    const encodedUuid = encodeURIComponent(`[${paginationMeta.uuid}]`);
    for (let offset = 24; offset <= paginationMeta.maxOffset; offset += 24) {
      allUrls.push(
        `${BASE}?s${encodedUuid}%5Boffset%5D=${offset}&nodeId=${paginationMeta.nodeId}`
      );
    }
  }

  const brandSlug = brand.slug; // captured for use inside evaluate()

  const extractTiles = (slug) =>
    Array.from(document.querySelectorAll('.product-tile')).flatMap(tile => {
      const linkEl = tile.querySelector(`a[href*="/${slug}/"]`);
      if (!linkEl) return [];
      const imgEl = tile.querySelector('img');
      const lines = tile.innerText.split('\n').map(l => l.trim()).filter(Boolean);
      return [{ url: linkEl.href, image_url: imgEl?.src || null, lines }];
    });

  for (let pageNum = 1; pageNum <= allUrls.length; pageNum++) {
    if (pageNum > 1) {
      await page.goto(allUrls[pageNum - 1], { waitUntil: 'networkidle', timeout: 35000 });
      await page.waitForTimeout(1200);
    }

    const tiles = await page.evaluate(extractTiles, brandSlug);
    if (!tiles.length) break;

    const newTiles = tiles.filter(t => !seenUrls.has(t.url));
    if (!newTiles.length) break;

    for (const { url, image_url, lines } of newTiles) {
      seenUrls.add(url);
      const parts = url.split('/').filter(Boolean);
      const refFromUrl = parts.length >= 4 ? parts[parts.length - 2] : null;
      const modelSlug = parts.length >= 4 ? parts[parts.length - 3] : null;

      const condRaw = (lines[0] || '').toLowerCase();
      const condition = CONDITION_MAP_NL[condRaw] || condRaw || null;
      const model = lines[2] || (modelSlug ? modelSlug.replace(/-/g, ' ') : null);
      const refLine = lines[3] && /^\d{4,}/.test(lines[3]) ? lines[3] : refFromUrl;
      const priceMatch = lines.join(' ').match(/€\s*([\d.,]+)/);

      allListings.push({
        source: 'Chronext NL',
        brand: brand.name,
        title: `${brand.name} ${model || ''}`.trim(),
        reference_number: refLine || null,
        price: priceMatch ? parsePrice(priceMatch[0]) : null,
        image_url,
        url,
        condition,
        year: null,
      });
    }

    process.stdout.write(`  ${brand.name} page ${pageNum}/${allUrls.length}: ${newTiles.length} listings\n`);
  }

  const saved = await save(allListings, 'Chronext NL');
  console.log(`  ${brand.name} total: ${allListings.length} → ${saved} saved`);
  return saved;
}

async function scrapeChronext(browser) {
  const SOURCE = 'Chronext NL';
  console.log(`\n[${SOURCE}] Playwright (all brands, paginated)...`);
  const page = await browser.newPage();
  let totalSaved = 0;

  try {
    for (const brand of BRANDS) {
      try {
        totalSaved += await scrapeChronextBrand(page, brand);
      } catch (e) {
        console.log(`  ${brand.name} ERROR: ${e.message.slice(0, 80)}`);
      }
    }
  } finally {
    await page.close();
  }

  return totalSaved;
}

// ─── 5. Ace Jewelers (Vue Storefront API interception) ───────────────────────

async function scrapeAceJewelers(browser) {
  const SOURCE = 'Ace Jewelers';
  console.log(`\n[${SOURCE}] Playwright (intercept Vue Storefront API)...`);
  const page = await browser.newPage();
  const allListings = [];

  try {
    const allHits = [];

    page.on('response', async resp => {
      if (!resp.url().includes('/product/_search') || !resp.ok()) return;
      try {
        const body = await resp.json();
        const hits = body.hits?.hits || [];
        if (hits.length) allHits.push(...hits);
      } catch {}
    });

    await page.goto('https://www.acejewelers.com/nl/horloges', {
      waitUntil: 'networkidle', timeout: 35000,
    });
    await page.waitForTimeout(2000);

    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1200);
    }

    try {
      const rolexBtn = page.locator('button:has-text("Rolex"), [class*="filter"] >> text=Rolex').first();
      if (await rolexBtn.isVisible({ timeout: 3000 })) {
        await rolexBtn.click();
        await page.waitForTimeout(3000);
      }
    } catch {}

    const targetHits = allHits.filter(h => {
      const s = h._source;
      const brandName = (s.brand_name || s.manufacturer_label || '').toLowerCase();
      return TARGET_VENDORS.has(s.brand_name) ||
        /rolex|omega|tudor|patek|audemars/i.test(s.name || brandName);
    });

    for (const hit of targetHits) {
      const p = hit._source;
      const finalPrice = p.final_price ?? p.price?.regularPrice?.amount?.value ?? null;
      const imgPath = p.media_gallery_entries?.[0]?.file || p.image || null;
      const brandName = VENDOR_TO_BRAND[p.brand_name] || p.brand_name || 'Unknown';

      allListings.push({
        source: SOURCE, brand: brandName,
        title: p.name || null,
        reference_number: extractRef(p.name) || p.sku || null,
        price: typeof finalPrice === 'number' ? finalPrice : parsePrice(String(finalPrice ?? '')),
        image_url: imgPath ? `https://www.acejewelers.com/img/${imgPath.replace(/^\//, '')}` : null,
        url: p.url_path ? `https://www.acejewelers.com/nl/${p.url_path.replace(/^\//, '')}` : null,
        condition: p.is_preowned ? 'pre-owned' : null,
        year: parseYear(p.name) || parseYear(p.description),
      });
    }

    const saved = await save(allListings, SOURCE);
    console.log(`  ${allHits.length} API hits, ${allListings.length} target brands → ${saved} saved`);
    return saved;
  } catch (e) {
    console.log(`  ERROR: ${e.message}`);
    return 0;
  } finally {
    await page.close();
  }
}

// ─── 6. Schaap & Citroen — all brands (Playwright) ───────────────────────────

async function scrapeSchaapCitroen(browser) {
  const SOURCE = 'Schaap & Citroen';
  console.log(`\n[${SOURCE}] Playwright (all brands)...`);
  const page = await browser.newPage();
  let totalSaved = 0;

  const COND_MAP = {
    'ongedragen': 'unworn', 'nieuw': 'new', 'als nieuw': 'like new',
    'goed': 'good', 'redelijk': 'fair', 'zeer goed': 'very good',
  };

  try {
    for (const brand of BRANDS) {
      const brandUrl = `https://preowned.schaapcitroen.nl/brands/${brand.slug}/`;
      try {
        await page.goto(brandUrl, { waitUntil: 'networkidle', timeout: 35000 });
        await page.waitForTimeout(2000);

        // Scroll to load lazy items
        for (let i = 0; i < 6; i++) {
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await page.waitForTimeout(800);
        }

        const brandSlug = brand.slug;
        const items = await page.evaluate((slug) =>
          Array.from(document.querySelectorAll('a[href]')).filter(a => {
            const path = new URL(a.href, location.origin).pathname;
            return new RegExp(`^/brands/${slug}/.+/.+`).test(path) && a.querySelector('img');
          }).map(a => {
            const imgEl = a.querySelector('img');
            const alt = imgEl?.alt || '';
            const altParts = alt.split(' - ');
            const priceMatch = a.textContent.match(/€\s*([\d.,]+)/);
            const condMatch = a.textContent.match(/\b(Ongedragen|Nieuw|Goed|Redelijk|Als nieuw|Zeer goed)\b/i);
            const yearMatch = a.textContent.match(/\b(19[5-9]\d|20[0-2]\d)\b/);
            return {
              url: a.href,
              model: altParts[0]?.trim() || '',
              reference_number: altParts.length >= 3 ? altParts[altParts.length - 1].trim() : null,
              price: priceMatch ? priceMatch[0] : null,
              condition: condMatch ? condMatch[0] : null,
              year: yearMatch ? parseInt(yearMatch[0]) : null,
              image_url: imgEl?.src || imgEl?.srcset?.split(' ')?.[0] || null,
            };
          }), brandSlug
        );

        const seen = new Set();
        const listings = [];
        for (const item of items) {
          if (seen.has(item.url)) continue;
          seen.add(item.url);
          listings.push({
            source: SOURCE,
            brand: brand.name,
            title: item.model ? `${brand.name} ${item.model}` : brand.name,
            reference_number: item.reference_number && /^\d{4,}/.test(item.reference_number)
              ? item.reference_number : extractRef(item.model || ''),
            price: item.price ? parsePrice(item.price) : null,
            image_url: item.image_url,
            url: item.url,
            condition: COND_MAP[(item.condition || '').toLowerCase()] || null,
            year: item.year,
          });
        }

        const saved = await save(listings, SOURCE);
        console.log(`  ${brand.name}: ${items.length} listings → ${saved} saved`);
        totalSaved += saved;
      } catch (e) {
        console.log(`  ${brand.name} ERROR: ${e.message.slice(0, 80)}`);
      }
    }
  } finally {
    await page.close();
  }

  return totalSaved;
}

// ─── 7. Watchfinder NL — BLOCKED ─────────────────────────────────────────────
function reportWatchfinderBlocked() {
  console.log('\n[Watchfinder NL] SKIPPED — requires session cookies / JS rendering');
  return 0;
}

// ─── 8. Chrono24 NL — BLOCKED ────────────────────────────────────────────────
function reportChrono24Blocked() {
  console.log('\n[Chrono24 NL] SKIPPED — 403 Cloudflare bot protection');
  return 0;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('WatchScout — Multi-brand scraper\n' + '═'.repeat(42));
  console.log(`Brands: ${BRANDS.map(b => b.name).join(', ')}\n`);

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL — check .env.local');
    process.exit(1);
  }

  const results = {};

  // API-based (no browser)
  results['Amstel Watches']     = await scrapeAmstelWatches();
  results['Steiner Maastricht'] = await scrapeSteinerMaastricht();
  results['Chrono24 NL']        = reportChrono24Blocked();
  results['Watchfinder NL']     = reportWatchfinderBlocked();

  // Browser-based
  const browser = await chromium.launch({ headless: true });
  try {
    results['Juwelier Burger']  = await scrapeJuwelierBurger(browser);
    results['Chronext NL']      = await scrapeChronext(browser);
    results['Ace Jewelers']     = await scrapeAceJewelers(browser);
    results['Schaap & Citroen'] = await scrapeSchaapCitroen(browser);
  } finally {
    await browser.close();
  }

  // Summary
  console.log('\n' + '═'.repeat(42));
  console.log('RESULTS PER SOURCE:');
  let total = 0;
  for (const [source, count] of Object.entries(results)) {
    console.log(`  ${source.padEnd(22)}: ${count}`);
    total += count;
  }
  console.log('─'.repeat(42));
  console.log(`  ${'TOTAL'.padEnd(22)}: ${total} listings saved`);

  // Per-brand breakdown from DB
  console.log('\nFetching per-brand totals from database...');
  const { data } = await supabase.from('watches').select('brand');
  if (data) {
    const counts = {};
    data.forEach(r => { counts[r.brand] = (counts[r.brand] || 0) + 1; });
    console.log('\nTOTALS PER BRAND (all-time in DB):');
    Object.entries(counts).sort((a, b) => b[1] - a[1])
      .forEach(([brand, n]) => console.log(`  ${brand.padEnd(22)}: ${n}`));
    console.log(`  ${'GRAND TOTAL'.padEnd(22)}: ${data.length}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
