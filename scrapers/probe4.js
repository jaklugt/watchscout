'use strict';

const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({ headless: true });

  // --- Ace Jewelers: intercept XHR/fetch calls to find product API ---
  {
    const page = await browser.newPage();
    const apiCalls = [];
    page.on('request', req => {
      const url = req.url();
      if (req.resourceType() === 'fetch' || req.resourceType() === 'xhr') {
        apiCalls.push({ method: req.method(), url: url.slice(0, 200) });
      }
    });
    await page.goto('https://www.acejewelers.com/nl/horloges/rolex', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    const title = await page.title();
    console.log('\n=== ACE JEWELERS network calls ===');
    console.log('Title:', title);
    apiCalls.forEach(c => console.log(c.method, c.url));
    await page.close();
  }

  // --- Schaap & Citroen: explore catalog/listing pages ---
  {
    const page = await browser.newPage();
    // Try to find the correct catalog URL for Rolex on pre-owned site
    const tryUrls = [
      'https://preowned.schaapcitroen.nl/horloges',
      'https://preowned.schaapcitroen.nl/watches',
      'https://preowned.schaapcitroen.nl/collectie',
      'https://preowned.schaapcitroen.nl/catalog',
      'https://preowned.schaapcitroen.nl/horloges/rolex',
    ];
    for (const url of tryUrls) {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
      const status = await page.evaluate(() => ({
        title: document.title,
        url: window.location.href,
        rolex: document.body.innerHTML.toLowerCase().includes('rolex'),
        bodySnippet: document.body.innerText.slice(0, 200),
      }));
      console.log(`\n[SC] ${url} -> ${status.title} | rolex:${status.rolex}`);
      console.log(status.bodySnippet);
    }
    await page.close();
  }

  // --- Watchfinder: find individual Rolex listings ---
  {
    const page = await browser.newPage();
    const apiCalls = [];
    page.on('request', req => {
      const url = req.url();
      if ((req.resourceType() === 'fetch' || req.resourceType() === 'xhr') && url.includes('watch')) {
        apiCalls.push(url.slice(0, 250));
      }
    });
    // Try various listing URLs
    const urls = [
      'https://www.watchfinder.nl/watches/rolex/submariner',
      'https://www.watchfinder.nl/search?q=rolex',
    ];
    for (const url of urls) {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(2000);
      const info = await page.evaluate(() => {
        const productItems = document.querySelectorAll('.product-item, .product-item-info, [class*="product-item"], ol.products.list li');
        const cards = Array.from(productItems).slice(0, 3).map(el => ({
          cls: el.className.slice(0, 80),
          text: el.textContent.trim().slice(0, 200),
          html: el.outerHTML.slice(0, 600),
        }));
        return {
          title: document.title,
          productCount: productItems.length,
          cards,
        };
      });
      console.log(`\n=== WATCHFINDER ${url} ===`);
      console.log('Title:', info.title, '| Products:', info.productCount);
      info.cards.forEach((c, i) => {
        console.log(`Card ${i}:`, c.cls);
        console.log(c.text.slice(0, 150));
        console.log(c.html.slice(0, 400));
      });
    }
    console.log('\nAPI calls:', apiCalls);
    await page.close();
  }

  await browser.close();
}

main().catch(console.error);
