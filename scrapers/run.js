'use strict';

const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  // Service role key bypasses RLS; falls back to anon key
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Parse Dutch price: "€ 8.950,-" -> 8950 | "€23.995,00" -> 23995
function parsePrice(str) {
  if (!str) return null;
  let s = String(str).replace(/[€$£ \s ]/g, '').replace(/,-$/, '');
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
  // Modern Rolex refs: 126610LN, 116500LN, etc.
  const m = String(str || '').match(/\bm?1[0-2]\d{4}[a-zA-Z]{0,4}\b/i);
  if (m) return m[0].toUpperCase().replace(/^M/, '');
  // Older 4–5 digit refs: 1680, 16660
  const m2 = String(str || '').match(/\b(1[0-9]\d{3,4})\b/);
  return m2 ? m2[0] : null;
}

const DRY_RUN = process.argv.includes('--dry-run');

async function save(listings, source) {
  if (!listings.length) return 0;
  if (DRY_RUN) {
    console.log(`  [DRY-RUN] Would save ${listings.length} rows. Sample:`, JSON.stringify(listings[0], null, 2));
    return listings.length;
  }
  const { error } = await supabase.from('watches').insert(listings);
  if (error) {
    console.error(`  [${source}] DB error:`, error.message);
    return 0;
  }
  return listings.length;
}

// ─── 1. Amstel Watches (Shopify JSON API) ────────────────────────────────────
async function scrapeAmstelWatches() {
  const SOURCE = 'Amstel Watches';
  console.log(`\n[${SOURCE}] Shopify JSON API...`);
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

// ─── 2. Steiner Maastricht (Shopify JSON API, filter Rolex) ──────────────────
async function scrapeSteinerMaastricht() {
  const SOURCE = 'Steiner Maastricht';
  console.log(`\n[${SOURCE}] Shopify JSON API...`);
  try {
    const resp = await fetch('https://steinermaastricht.nl/collections/watches/products.json?limit=250', {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    });
    const { products: all = [] } = await resp.json();
    const rolex = all.filter(p =>
      /rolex/i.test(p.title) ||
      /rolex/i.test(p.vendor || '') ||
      (p.tags || []).some(t => /rolex/i.test(t))
    );
    const listings = rolex.map(p => ({
      source: SOURCE, brand: 'Rolex',
      title: p.title,
      reference_number: extractRef(p.title) || extractRef(p.handle),
      price: p.variants?.[0]?.price ? parseFloat(p.variants[0].price) : null,
      image_url: p.images?.[0]?.src || null,
      url: `https://steinermaastricht.nl/products/${p.handle}`,
      condition: /pre.?own|tweedehands/i.test(p.product_type || '') ? 'pre-owned' : null,
      year: parseYear(p.title) || parseYear(p.body_html),
    }));
    const saved = await save(listings, SOURCE);
    console.log(`  ${rolex.length}/${all.length} Rolex → ${saved} saved`);
    return saved;
  } catch (e) {
    console.log(`  ERROR: ${e.message}`);
    return 0;
  }
}

// ─── 3. Juwelier Burger (Playwright, initial DOM load) ───────────────────────
// Note: site uses IntersectionObserver-based infinite scroll that doesn't
// trigger in headless Chrome; scrapes the initial batch of visible products.
async function scrapeJuwelierBurger(browser) {
  const SOURCE = 'Juwelier Burger';
  console.log(`\n[${SOURCE}] Playwright...`);
  const page = await browser.newPage();
  const allListings = [];

  try {
    await page.goto('https://www.juwelierburger.com/NL/horloges/rolex', {
      waitUntil: 'networkidle', timeout: 35000,
    });
    await page.waitForTimeout(1500);

    const items = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a.item-wrapper')).map(card => {
        const imgEl = card.querySelector('img');
        const priceEl = card.querySelector('.item-price');
        return {
          href: card.getAttribute('href'),
          // img.title format: "Rolex - Explorer I 36MM 'Swiss Only'"
          title: imgEl?.title || imgEl?.alt || card.textContent.trim().slice(0, 80),
          price: priceEl?.textContent?.trim() || null,
          image_url: imgEl?.src || null,
        };
      })
    );

    for (const item of items) {
      const url = item.href
        ? `https://www.juwelierburger.com${item.href}`
        : null;
      if (!url) continue;
      // Clean: "Rolex - Explorer I 36MM" → "Rolex Explorer I 36MM"
      const title = (item.title || '').replace(/\s*-\s*/g, ' ').trim();
      if (!/rolex/i.test(title)) continue;

      allListings.push({
        source: SOURCE, brand: 'Rolex',
        title,
        reference_number: extractRef(title) || extractRef(url),
        price: parsePrice(item.price),
        image_url: item.image_url || null,
        url,
        condition: null,
        year: parseYear(title),
      });
    }

    const saved = await save(allListings, SOURCE);
    console.log(`  ${items.length} items → ${allListings.length} Rolex → ${saved} saved`);
    return saved;
  } catch (e) {
    console.log(`  ERROR: ${e.message}`);
    return 0;
  } finally {
    await page.close();
  }
}

// ─── 4. Chronext NL (Playwright, .product-tile with links, paginated) ────────
async function scrapeChronext(browser) {
  const SOURCE = 'Chronext NL';
  console.log(`\n[${SOURCE}] Playwright (paginated)...`);
  const page = await browser.newPage();
  const allListings = [];
  const seenUrls = new Set();
  const BASE = 'https://www.chronext.nl/rolex/gebruikte-horloges';

  const CONDITION_MAP = {
    'nieuw': 'new', 'ongedragen': 'unworn', 'als nieuw': 'like new',
    'zeer goed': 'very good', 'goed': 'good', 'redelijk': 'fair',
  };

  try {
    // Page 1: extract UUID and nodeId from pagination to build all page URLs
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 35000 });
    await page.waitForTimeout(1500);

    // Get max offset from pagination links to determine number of pages
    const paginationMeta = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('.pagination__list a[href]'));
      const offsets = links.map(a => {
        const m = a.href.match(/offset%5D=(\d+)/);
        return m ? parseInt(m[1]) : 0;
      }).filter(n => n > 0);
      const nodeIdMatch = links[0]?.href.match(/nodeId=([a-f0-9]+)/);
      const uuidMatch = links[0]?.href.match(/%5B([a-f0-9-]{36})%5D/);
      return {
        maxOffset: Math.max(0, ...offsets),
        nodeId: nodeIdMatch?.[1] || null,
        uuid: uuidMatch?.[1] || null,
      };
    });

    // Build URLs for all pages: base + offset=24, 48, ..., maxOffset
    const allUrls = [BASE];
    if (paginationMeta.uuid && paginationMeta.nodeId) {
      const encodedUuid = encodeURIComponent(`[${paginationMeta.uuid}]`);
      for (let offset = 24; offset <= paginationMeta.maxOffset; offset += 24) {
        allUrls.push(
          `${BASE}?s${encodedUuid}%5Boffset%5D=${offset}&nodeId=${paginationMeta.nodeId}`
        );
      }
    }

    const extractTiles = () =>
      Array.from(document.querySelectorAll('.product-tile')).flatMap(tile => {
        const linkEl = tile.querySelector('a[href*="/rolex/"]');
        if (!linkEl) return [];
        const imgEl = tile.querySelector('img');
        const lines = tile.innerText.split('\n').map(l => l.trim()).filter(Boolean);
        return [{ url: linkEl.href, image_url: imgEl?.src || null, lines }];
      });

    for (let pageNum = 1; pageNum <= allUrls.length; pageNum++) {
      if (pageNum > 1) {
        await page.goto(allUrls[pageNum - 1], { waitUntil: 'networkidle', timeout: 35000 });
        await page.waitForTimeout(1500);
      }

      const tiles = await page.evaluate(extractTiles);
      if (!tiles.length) break;

      const newUrls = tiles.filter(t => !seenUrls.has(t.url));
      if (newUrls.length === 0) break;

      for (const { url, image_url, lines } of newUrls) {
        seenUrls.add(url);
        const parts = url.split('/').filter(Boolean);
        const refFromUrl = parts.length >= 4 ? parts[parts.length - 2] : null;
        const modelSlug = parts.length >= 4 ? parts[parts.length - 3] : null;

        const condRaw = (lines[0] || '').toLowerCase();
        const condition = CONDITION_MAP[condRaw] || condRaw || null;
        const model = lines[2] || (modelSlug ? modelSlug.replace(/-/g, ' ') : null);
        const refLine = lines[3] && /^\d{4,6}/.test(lines[3]) ? lines[3] : refFromUrl;
        const priceMatch = lines.join(' ').match(/€\s*([\d.,]+)/);

        allListings.push({
          source: SOURCE, brand: 'Rolex',
          title: `Rolex ${model || ''}`.trim(),
          reference_number: refLine || null,
          price: priceMatch ? parsePrice(priceMatch[0]) : null,
          image_url,
          url,
          condition,
          year: null,
        });
      }

      console.log(`  Page ${pageNum}/${allUrls.length}: ${newUrls.length} listings`);
    }

    const saved = await save(allListings, SOURCE);
    console.log(`  Total: ${allListings.length} listings → ${saved} saved`);
    return saved;
  } catch (e) {
    console.log(`  ERROR: ${e.message}`);
    return 0;
  } finally {
    await page.close();
  }
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

    // Scroll to trigger lazy-loaded pages
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1200);
    }

    // Click Rolex brand filter if present
    try {
      const rolexBtn = page.locator('button:has-text("Rolex"), [class*="filter"] >> text=Rolex').first();
      if (await rolexBtn.isVisible({ timeout: 3000 })) {
        await rolexBtn.click();
        await page.waitForTimeout(3000);
      }
    } catch {}

    const rolexHits = allHits.filter(h => {
      const s = h._source;
      return /rolex/i.test(s.name || '') ||
        /rolex/i.test(s.brand_name || '') ||
        /rolex/i.test(s.manufacturer_label || '');
    });

    for (const hit of rolexHits) {
      const p = hit._source;
      const finalPrice = p.final_price ?? p.price?.regularPrice?.amount?.value ?? null;
      const imgPath = p.media_gallery_entries?.[0]?.file || p.image || null;

      allListings.push({
        source: SOURCE, brand: 'Rolex',
        title: p.name || null,
        reference_number: extractRef(p.name) || p.sku || null,
        price: typeof finalPrice === 'number' ? finalPrice : parsePrice(String(finalPrice ?? '')),
        image_url: imgPath
          ? `https://www.acejewelers.com/img/${imgPath.replace(/^\//, '')}`
          : null,
        url: p.url_path
          ? `https://www.acejewelers.com/nl/${p.url_path.replace(/^\//, '')}`
          : null,
        condition: p.is_preowned ? 'pre-owned' : null,
        year: parseYear(p.name) || parseYear(p.description),
      });
    }

    const saved = await save(allListings, SOURCE);
    console.log(`  ${allHits.length} API hits, ${allListings.length} Rolex → ${saved} saved`);
    return saved;
  } catch (e) {
    console.log(`  ERROR: ${e.message}`);
    return 0;
  } finally {
    await page.close();
  }
}

// ─── 6. Schaap & Citroen Pre-owned (Playwright, /brands/rolex/) ──────────────
async function scrapeSchaapCitroen(browser) {
  const SOURCE = 'Schaap & Citroen';
  console.log(`\n[${SOURCE}] Playwright...`);
  const page = await browser.newPage();
  const allListings = [];
  const seen = new Set();

  try {
    // Page uses Algolia InstantSearch (SSR-rendered data in anchors)
    await page.goto('https://preowned.schaapcitroen.nl/brands/rolex/', {
      waitUntil: 'networkidle', timeout: 35000,
    });
    await page.waitForTimeout(3000);

    // Scroll to trigger lazy-loaded pages
    for (let i = 0; i < 6; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(900);
    }

    const items = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href]')).filter(a => {
        // Must be a product detail URL (depth ≥ 5 path segments)
        const path = new URL(a.href, 'https://preowned.schaapcitroen.nl').pathname;
        return /^\/brands\/rolex\/.+\/.+/.test(path) && a.querySelector('img');
      }).map(a => {
        const imgEl = a.querySelector('img');
        // img.alt format: "Submariner 40mm - Rolex - 16610LV"
        const alt = imgEl?.alt || '';
        const altParts = alt.split(' - ');
        // Price from innerText
        const priceMatch = a.textContent.match(/€\s*([\d.,]+)/);
        // Condition from innerText (Dutch condition words)
        const condMatch = a.textContent.match(/\b(Ongedragen|Nieuw|Goed|Redelijk|Als nieuw|Zeer goed)\b/i);
        // Year
        const yearMatch = a.textContent.match(/\b(19[5-9]\d|20[0-2]\d)\b/);
        return {
          url: a.href,
          // Reconstruct clean title: "Rolex [model]"
          title: altParts.length >= 2
            ? `Rolex ${altParts[0].trim()}`.replace(/Rolex Rolex/i, 'Rolex')
            : alt,
          // Reference is last alt segment if it looks like a ref
          reference_number: altParts.length >= 3 ? altParts[altParts.length - 1].trim() : null,
          price: priceMatch ? priceMatch[0] : null,
          condition: condMatch ? condMatch[0] : null,
          year: yearMatch ? parseInt(yearMatch[0]) : null,
          image_url: imgEl?.src || imgEl?.srcset?.split(' ')?.[0] || null,
        };
      })
    );

    const COND_MAP = {
      'ongedragen': 'unworn', 'nieuw': 'new', 'als nieuw': 'like new',
      'goed': 'good', 'redelijk': 'fair', 'zeer goed': 'very good',
    };

    for (const item of items) {
      if (seen.has(item.url)) continue;
      seen.add(item.url);

      allListings.push({
        source: SOURCE, brand: 'Rolex',
        title: item.title || null,
        reference_number: item.reference_number && /^\d{4,6}/.test(item.reference_number)
          ? item.reference_number : extractRef(item.title || ''),
        price: item.price ? parsePrice(item.price) : null,
        image_url: item.image_url,
        url: item.url,
        condition: COND_MAP[(item.condition || '').toLowerCase()] || null,
        year: item.year,
      });
    }

    const saved = await save(allListings, SOURCE);
    console.log(`  ${items.length} listings → ${saved} saved`);
    return saved;
  } catch (e) {
    console.log(`  ERROR: ${e.message}`);
    return 0;
  } finally {
    await page.close();
  }
}

// ─── 7. Watchfinder NL — BLOCKED ─────────────────────────────────────────────
function reportWatchfinderBlocked() {
  console.log('\n[Watchfinder NL] SKIPPED — product listings require session cookies / JS rendering that prevents headless scraping');
  return 0;
}

// ─── 8. Chrono24 NL — BLOCKED ────────────────────────────────────────────────
function reportChrono24Blocked() {
  console.log('\n[Chrono24 NL] SKIPPED — site returned 403 (Cloudflare bot protection)');
  return 0;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('WatchScout — Rolex scraper\n' + '═'.repeat(42));

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
}

main().catch(e => { console.error(e); process.exit(1); });
