'use strict';

/**
 * Rule-based accessories enrichment
 *
 * Sources covered:
 *  - Amstel Watches   → re-fetch Shopify products.json, parse "Box Yes/No" + Dutch keywords from body_html
 *  - Steiner          → re-fetch Shopify products.json (body_html currently empty, keyword title scan fallback)
 *  - Schaap & Citroen → scrape each listing page for "Originele Doos" / "Originele Papieren" icons/text
 *  - All others       → keyword scan on title
 *
 * Box keywords:    box, doos, set, compleet
 * Papers keywords: papers, papieren, card, garantiekaart, garantie kaart
 */

const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ── Keyword rules ──────────────────────────────────────────────────────────────

const BOX_WORDS    = ['\\bbox\\b', '\\bdoos\\b', '\\bset\\b', '\\bcompleet\\b', 'originele doos', 'original box', 'box: yes', 'box yes'];
const PAPERS_WORDS = ['\\bpapers\\b', '\\bpapieren\\b', '\\bcard\\b', '\\bgarantiekaart\\b', 'garantie kaart', 'originele papieren', 'original papers', 'papers: yes', 'papers yes', 'warranty card'];

const BOX_RE    = new RegExp(BOX_WORDS.join('|'), 'i');
const PAPERS_RE = new RegExp(PAPERS_WORDS.join('|'), 'i');

const NO_BOX_RE    = /box:\s*no|box\s*no\b|geen doos/i;
const NO_PAPERS_RE = /papers:\s*no|papers\s*no\b|geen papieren/i;

function detectFromText(text) {
  const t = (text || '').toLowerCase();
  const hasBox    = BOX_RE.test(t)    && !NO_BOX_RE.test(t)    ? true  : null;
  const hasPapers = PAPERS_RE.test(t) && !NO_PAPERS_RE.test(t) ? true  : null;
  // Explicit "no" overrides
  const noBox     = NO_BOX_RE.test(t)    ? false : null;
  const noPapers  = NO_PAPERS_RE.test(t) ? false : null;
  return {
    has_box:    noBox    !== null ? noBox    : hasBox,
    has_papers: noPapers !== null ? noPapers : hasPapers,
  };
}

// ── Shopify helpers ────────────────────────────────────────────────────────────

async function fetchShopifyProducts(baseUrl, collectionPath) {
  const url = `${baseUrl}/collections/${collectionPath}/products.json?limit=250`;
  const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} from ${url}`);
  const { products = [] } = await resp.json();
  return products;
}

/** Build a map of handle → {has_box, has_papers} from Shopify body_html */
function parseShopifyAccessories(products) {
  const map = {};
  for (const p of products) {
    const html = (p.body_html || '').replace(/<[^>]+>/g, ' ');
    const result = detectFromText(html);
    map[p.handle] = result;
  }
  return map;
}

// ── Amstel Watches ─────────────────────────────────────────────────────────────

async function enrichAmstel(watches) {
  console.log(`\n[Amstel Watches] Re-fetching Shopify products.json...`);
  const products = await fetchShopifyProducts('https://amstelwatches.nl', 'rolex');
  const map = parseShopifyAccessories(products);

  let updated = 0;
  for (const w of watches) {
    const handle = w.url.split('/products/')[1]?.replace(/\/$/, '');
    if (!handle) continue;
    const result = map[handle];
    if (!result) continue;
    if (result.has_box === null && result.has_papers === null) continue;
    const { error } = await supabase.from('watches').update(result).eq('id', w.id);
    if (!error) updated++;
  }
  console.log(`  ${updated}/${watches.length} listings updated`);
  return updated;
}

// ── Steiner Maastricht ─────────────────────────────────────────────────────────

async function enrichSteiner(watches) {
  console.log(`\n[Steiner Maastricht] Re-fetching Shopify products.json...`);
  let products;
  try {
    const resp = await fetch('https://steinermaastricht.nl/collections/watches/products.json?limit=250', {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    });
    const json = await resp.json();
    products = (json.products || []).filter(p => /rolex/i.test(p.title) || /rolex/i.test(p.vendor || ''));
  } catch (e) {
    console.log(`  ERROR: ${e.message} — falling back to title scan`);
    products = [];
  }

  const map = parseShopifyAccessories(products);
  let updated = 0;

  for (const w of watches) {
    const handle = w.url.split('/products/')[1]?.replace(/\/$/, '');
    const fromShopify = handle ? map[handle] : null;
    // Fall back to title scan if Shopify body_html gave nothing
    const result = (fromShopify?.has_box !== null || fromShopify?.has_papers !== null)
      ? fromShopify
      : detectFromText(w.title);
    if (result.has_box === null && result.has_papers === null) continue;
    const { error } = await supabase.from('watches').update(result).eq('id', w.id);
    if (!error) updated++;
  }
  console.log(`  ${updated}/${watches.length} listings updated`);
  return updated;
}

// ── Schaap & Citroen — scrape individual pages ─────────────────────────────────

async function detectSchaapPage(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  // Fast: check visible text of the page (the icons have title attrs and text labels)
  const text = await page.evaluate(() => document.body.innerText);
  const hasBox    = /originele doos/i.test(text)     ? true : null;
  const hasPapers = /originele papieren/i.test(text) ? true : null;
  return { has_box: hasBox, has_papers: hasPapers };
}

async function enrichSchaap(watches, browser) {
  console.log(`\n[Schaap & Citroen] Scraping ${watches.length} listing pages...`);
  const page = await browser.newPage();
  let updated = 0;

  try {
    for (let i = 0; i < watches.length; i++) {
      const w = watches[i];
      process.stdout.write(`  [${i + 1}/${watches.length}] ${w.url.split('/').slice(-2, -1)[0]}...`);
      try {
        const result = await detectSchaapPage(page, w.url);
        const { error } = await supabase.from('watches').update(result).eq('id', w.id);
        if (!error) {
          updated++;
          console.log(` box=${result.has_box} papers=${result.has_papers}`);
        }
      } catch (e) {
        console.log(` SKIP (${e.message.slice(0, 40)})`);
      }
      // Brief pause between requests
      await new Promise(r => setTimeout(r, 400));
    }
  } finally {
    await page.close();
  }

  console.log(`  ${updated}/${watches.length} listings updated`);
  return updated;
}

// ── Generic title-based scan (Chronext, Juwelier Burger, Ace Jewelers) ────────

async function enrichByTitle(watches, sourceName) {
  console.log(`\n[${sourceName}] Keyword scan on title...`);
  let updated = 0;

  for (const w of watches) {
    const result = detectFromText(w.title);
    if (result.has_box === null && result.has_papers === null) continue;
    const { error } = await supabase.from('watches').update(result).eq('id', w.id);
    if (!error) updated++;
  }
  console.log(`  ${updated}/${watches.length} titles contained box/papers keywords`);
  return updated;
}

// ── Test: scrape a specific listing URL ────────────────────────────────────────

async function testScrapeUrl(url, browser) {
  console.log(`\n[Test scrape] ${url}`);
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    const text = await page.evaluate(() => document.body.innerText);
    const h1   = await page.locator('h1').first().innerText().catch(() => '?');

    // Extract accessories from visible text
    const result = {
      has_box:    /originele doos/i.test(text)     ? true : /\bbox\b|\bdoos\b/i.test(text) ? true : null,
      has_papers: /originele papieren/i.test(text) ? true : /papers|papieren/i.test(text)  ? true : null,
    };

    // Find and print the context around relevant keywords
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const relevant = lines.filter(l => /doos|papier|box|paper|compleet|garantie|accessori/i.test(l));

    console.log(`  Title: ${h1.replace(/\n/g, ' ').trim()}`);
    console.log(`  Result: has_box=${result.has_box}  has_papers=${result.has_papers}`);
    console.log(`  Relevant page lines:`);
    relevant.slice(0, 8).forEach(l => console.log(`    · ${l}`));

    return result;
  } finally {
    await page.close();
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('WatchScout — Accessories Enrichment');
  console.log('════════════════════════════════════════\n');

  // Load all watches
  const { data: watches, error } = await supabase
    .from('watches')
    .select('id, source, title, url')
    .order('source');

  if (error) { console.error('Fetch error:', error.message); process.exit(1); }
  console.log(`Loaded ${watches.length} listings\n`);

  // Group by source
  const bySource = {};
  for (const w of watches) {
    (bySource[w.source] = bySource[w.source] || []).push(w);
  }

  // Launch browser for Schaap & Citroen + test scrape
  const browser = await chromium.launch({ headless: true });

  let totalUpdated = 0;

  try {
    // 1. Test scrape first (gives quick feedback)
    await testScrapeUrl(
      'https://preowned.schaapcitroen.nl/brands/rolex/rolex-deepsea/357269/',
      browser
    );

    // 2. Amstel Watches (Shopify body_html)
    if (bySource['Amstel Watches']) {
      totalUpdated += await enrichAmstel(bySource['Amstel Watches']);
    }

    // 3. Steiner Maastricht (Shopify body_html + title fallback)
    if (bySource['Steiner Maastricht']) {
      totalUpdated += await enrichSteiner(bySource['Steiner Maastricht']);
    }

    // 4. Schaap & Citroen (page scrape per listing)
    if (bySource['Schaap & Citroen']) {
      totalUpdated += await enrichSchaap(bySource['Schaap & Citroen'], browser);
    }

    // 5. Remaining sources — title keyword scan
    for (const src of ['Chronext NL', 'Juwelier Burger', 'Ace Jewelers']) {
      if (bySource[src]) {
        totalUpdated += await enrichByTitle(bySource[src], src);
      }
    }
  } finally {
    await browser.close();
  }

  console.log('\n════════════════════════════════════════');
  console.log(`Accessories enrichment complete. ${totalUpdated} listings updated.`);

  // Summary: how many now have box / papers set
  const { data: stats } = await supabase
    .from('watches')
    .select('has_box, has_papers');

  if (stats) {
    const withBox    = stats.filter(w => w.has_box === true).length;
    const withPapers = stats.filter(w => w.has_papers === true).length;
    const noBox      = stats.filter(w => w.has_box === false).length;
    const noPapers   = stats.filter(w => w.has_papers === false).length;
    console.log(`\nDatabase summary:`);
    console.log(`  has_box=true:     ${withBox}`);
    console.log(`  has_box=false:    ${noBox}`);
    console.log(`  has_box=null:     ${stats.length - withBox - noBox}`);
    console.log(`  has_papers=true:  ${withPapers}`);
    console.log(`  has_papers=false: ${noPapers}`);
    console.log(`  has_papers=null:  ${stats.length - withPapers - noPapers}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
