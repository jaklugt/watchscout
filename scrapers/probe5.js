'use strict';

const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({ headless: true });

  // --- Ace Jewelers: capture the product search API response ---
  {
    const page = await browser.newPage();
    let productApiUrl = null;
    let productApiBody = null;

    page.on('response', async resp => {
      const url = resp.url();
      if (url.includes('/product/_search') && resp.ok()) {
        productApiUrl = url;
        try { productApiBody = await resp.text(); } catch {}
      }
    });

    // Try the horloges page with a Rolex filter
    await page.goto('https://www.acejewelers.com/nl/horloges', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    console.log('\n=== ACE JEWELERS Product API ===');
    console.log('URL:', productApiUrl?.slice(0, 300));
    if (productApiBody) {
      try {
        const json = JSON.parse(productApiBody);
        const hits = json.hits?.hits || [];
        console.log(`Total hits: ${json.hits?.total?.value || json.hits?.total}`);
        console.log('Sample product:', JSON.stringify(hits[0]?._source, null, 2).slice(0, 800));
      } catch (e) {
        console.log('Body (raw):', productApiBody.slice(0, 500));
      }
    }
    await page.close();
  }

  // --- Watchfinder: intercept and read the search API response ---
  {
    const page = await browser.newPage();
    let searchResp = null;

    page.on('response', async resp => {
      const url = resp.url();
      if (url.includes('/search') && url.includes('rolex') && resp.ok()) {
        try { searchResp = await resp.text(); } catch {}
      }
    });

    await page.goto('https://www.watchfinder.nl/search?q=rolex', { waitUntil: 'networkidle', timeout: 25000 });
    await page.waitForTimeout(2000);

    console.log('\n=== WATCHFINDER Search API ===');
    if (searchResp) {
      console.log('Response:', searchResp.slice(0, 500));
    } else {
      // Try fetching the search endpoint directly
      const result = await page.evaluate(async () => {
        try {
          const r = await fetch('/search?q=rolex', { headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' } });
          return { status: r.status, body: (await r.text()).slice(0, 500) };
        } catch (e) { return { error: e.message }; }
      });
      console.log('Direct fetch:', JSON.stringify(result));
    }
    await page.close();
  }

  // --- Schaap & Citroen: find Rolex listing page and card structure ---
  {
    const page = await browser.newPage();
    await page.goto('https://preowned.schaapcitroen.nl/horloges', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Scroll to trigger lazy loading
    await page.evaluate(() => {
      window.scrollTo(0, 500);
    });
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      window.scrollTo(0, 1000);
    });
    await page.waitForTimeout(2000);

    const info = await page.evaluate(() => {
      // Find all links that look like individual watch pages
      const watchLinks = Array.from(document.querySelectorAll('a[href]'))
        .map(a => a.href)
        .filter(h => /\/horloges\/|\/watches\/|\/product\//i.test(h) && !/\.(jpg|png|svg|pdf)/i.test(h))
        .slice(0, 15);

      // Find any product/watch card elements with images
      const cards = Array.from(document.querySelectorAll('*')).filter(el => {
        return el.children.length >= 2 && el.querySelector('img') && el.querySelector('a') &&
          /rolex/i.test(el.textContent);
      }).slice(0, 5).map(el => ({
        tag: el.tagName,
        cls: el.className.slice(0, 100),
        text: el.textContent.trim().slice(0, 200),
        html: el.outerHTML.slice(0, 600),
      }));

      // Try to find any Rolex-specific links
      const rolexProductLinks = Array.from(document.querySelectorAll('a[href*="rolex"]'))
        .map(a => a.href)
        .filter(h => h.includes('preowned'))
        .slice(0, 10);

      return { watchLinks, cards, rolexProductLinks };
    });

    console.log('\n=== SCHAAP & CITROEN /horloges (after scroll) ===');
    console.log('Watch links:', info.watchLinks);
    console.log('Rolex product links:', info.rolexProductLinks);
    info.cards.forEach((c, i) => {
      console.log(`\nCard ${i} [${c.tag}.${c.cls.split(' ')[0]}]:`);
      console.log(c.text.slice(0, 150));
      console.log(c.html.slice(0, 400));
    });
    await page.close();
  }

  await browser.close();
}

main().catch(console.error);
