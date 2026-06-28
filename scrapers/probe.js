'use strict';

const { chromium } = require('playwright');

const SITES = [
  { name: 'Ace Jewelers',         url: 'https://www.acejewelers.com/nl/search?q=rolex' },
  { name: 'Juwelier Burger',      url: 'https://www.juwelierburger.com/NL/horloges' },
  { name: 'Schaap & Citroen',     url: 'https://preowned.schaapcitroen.nl/' },
  { name: 'Steiner Maastricht',   url: 'https://steinermaastricht.nl/collections/watches' },
  { name: 'Chrono24 NL',          url: 'https://www.chrono24.nl/rolex/index.htm' },
  { name: 'Watchfinder NL',       url: 'https://www.watchfinder.nl/' },
  { name: 'Amstel Watches',       url: 'https://amstelwatches.nl/collections/rolex' },
  { name: 'Chronext NL',          url: 'https://www.chronext.nl/rolex/gebruikte-horloges' },
];

async function probe(browser, name, url) {
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'nl-NL,nl;q=0.9' });
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    const status = resp?.status();
    await page.waitForTimeout(2000);
    const title = await page.title();

    const info = await page.evaluate(() => {
      // Count candidate product containers
      const counts = {};
      const selectors = [
        '.product-tile', '.product-card', '.product-item', '.product',
        '[class*="product-card"]', '[class*="ProductCard"]', '[class*="product-tile"]',
        'article', '.grid__item', '.listing-item', '.watch-item', '.item',
        '[data-product]', '[class*="product"]',
      ];
      for (const sel of selectors) {
        const n = document.querySelectorAll(sel).length;
        if (n > 0) counts[sel] = n;
      }

      // Find any text containing "rolex"
      const rolexCount = document.body.innerHTML.toLowerCase().split('rolex').length - 1;

      // Shopify check
      const isShopify = !!(window.Shopify || document.querySelector('[data-shopify]') ||
        document.querySelector('script[src*="shopify"]'));

      // Sample first "product-like" element's classes
      const firstCard = document.querySelector('.product-tile, .product-card, .product-item, article');
      const sampleClasses = firstCard?.className || '';
      const sampleText = firstCard?.textContent?.trim().slice(0, 200) || '';

      // Links containing common watch paths
      const watchLinks = Array.from(document.querySelectorAll('a[href]'))
        .map(a => a.href)
        .filter(h => /rolex|horloge|watch|product/i.test(h))
        .slice(0, 5);

      return { counts, rolexCount, isShopify, sampleClasses, sampleText, watchLinks };
    });

    console.log(`\n=== ${name} (${status}) ===`);
    console.log(`Title: ${title}`);
    console.log(`Rolex mentions: ${info.rolexCount}`);
    console.log(`Is Shopify: ${info.isShopify}`);
    console.log(`Product selectors found:`, JSON.stringify(info.counts, null, 2));
    console.log(`Sample card classes: ${info.sampleClasses}`);
    console.log(`Sample text: ${info.sampleText}`);
    console.log(`Watch links: ${info.watchLinks.join('\n  ')}`);
  } catch (e) {
    console.log(`\n=== ${name} === ERROR: ${e.message}`);
  } finally {
    await page.close();
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  for (const site of SITES) {
    await probe(browser, site.name, site.url);
  }
  await browser.close();
}

main().catch(console.error);
