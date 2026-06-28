'use strict';

const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({ headless: true });

  // --- Ace Jewelers: wait longer, scroll, check for Vue-rendered products ---
  {
    const page = await browser.newPage();
    await page.goto('https://www.acejewelers.com/nl/horloges', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    // Scroll to trigger lazy loading
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(2000);
    const info = await page.evaluate(() => {
      // Look for product-grid items
      const cards = Array.from(document.querySelectorAll('[class*="product-"]')).filter(el => {
        const c = el.querySelector('a') && el.querySelector('img');
        return c;
      });
      // Sample first 3
      return cards.slice(0, 3).map(el => ({
        cls: el.className,
        text: el.textContent.trim().slice(0, 200),
        html: el.outerHTML.slice(0, 600),
      }));
    });
    console.log('\n=== ACE JEWELERS (after networkidle+scroll) ===');
    console.log(JSON.stringify(info, null, 2));

    // Also look for any API/XHR calls that might return product data
    const apiLinks = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script[src]')).map(s => s.src);
      const metas = Array.from(document.querySelectorAll('meta')).map(m => m.outerHTML);
      // look for any JSON data in scripts
      const inlineData = Array.from(document.querySelectorAll('script:not([src])')).map(s => s.textContent.slice(0, 100));
      return { scripts: scripts.slice(0, 5), metas: metas.slice(0, 5) };
    });
    console.log('Scripts:', apiLinks.scripts);
    await page.close();
  }

  // --- Juwelier Burger: get product HTML structure ---
  {
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'nl-NL,nl;q=0.9' });
    await page.goto('https://www.juwelierburger.com/NL/horloges/rolex', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    const info = await page.evaluate(() => {
      // Find all anchors that look like product links
      const links = Array.from(document.querySelectorAll('a[href*="rolex"], a[href*="horloge"], a[href*="product"]'));
      const productLinks = links.filter(a => {
        const parent = a.closest('li, div, article');
        return parent && parent.querySelector('img');
      });

      // Get a broader view of the product grid
      const grid = document.querySelector('.products, .product-list, .product-grid, [class*="product-list"], [class*="watch-list"], main ul, main ol, .catalog');
      return {
        gridClass: grid?.className,
        gridHtml: grid?.outerHTML?.slice(0, 1500),
        sampleLinks: productLinks.slice(0, 3).map(a => ({
          href: a.href,
          text: a.textContent.trim().slice(0, 100),
          parentHtml: a.parentElement?.outerHTML?.slice(0, 500),
        })),
        // Try to find price elements
        prices: Array.from(document.querySelectorAll('[class*="price"]')).slice(0, 3).map(el => ({
          cls: el.className,
          text: el.textContent.trim(),
        })),
      };
    });
    console.log('\n=== JUWELIER BURGER (after networkidle) ===');
    console.log(JSON.stringify(info, null, 2));
    await page.close();
  }

  // --- Schaap & Citroen: find product listing structure and Rolex URL ---
  {
    const page = await browser.newPage();
    await page.goto('https://preowned.schaapcitroen.nl/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    const info = await page.evaluate(() => {
      // Find navigation links with "rolex" or "merk"
      const navLinks = Array.from(document.querySelectorAll('nav a, header a'))
        .map(a => ({ href: a.href, text: a.textContent.trim() }))
        .filter(l => l.text && l.text.length < 50);

      // Find any watch/product cards
      const cards = Array.from(document.querySelectorAll('[class*="card"], [class*="watch"], [class*="listing"], [class*="product"]'))
        .filter(el => el.querySelector('img') && el.querySelector('a'))
        .slice(0, 3).map(el => ({
          cls: el.className.slice(0, 100),
          text: el.textContent.trim().slice(0, 200),
        }));

      // Check for any Rolex brand link
      const rolexLinks = Array.from(document.querySelectorAll('a'))
        .filter(a => /rolex/i.test(a.textContent) || /rolex/i.test(a.href))
        .map(a => ({ href: a.href, text: a.textContent.trim() }))
        .slice(0, 10);

      return { navLinks: navLinks.slice(0, 20), cards, rolexLinks };
    });
    console.log('\n=== SCHAAP & CITROEN (networkidle) ===');
    console.log(JSON.stringify(info, null, 2));
    await page.close();
  }

  // --- Watchfinder: networkidle, look for product grid ---
  {
    const page = await browser.newPage();
    await page.goto('https://www.watchfinder.nl/watches/rolex', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    const info = await page.evaluate(() => {
      // Find product cards
      const selectors = [
        '.product-item', '.product-card', '.listing-item', '[class*="product"]',
        '[class*="watch"]', 'li.item', '.item.product', '.product-item-info',
      ];
      const results = [];
      for (const sel of selectors) {
        const els = document.querySelectorAll(sel);
        if (els.length > 2) {
          results.push({ sel, count: els.length, sample: els[0]?.outerHTML?.slice(0, 600) });
        }
      }

      // Also find any list of products
      const imgs = Array.from(document.querySelectorAll('img[alt]'))
        .filter(img => /rolex|watch|horloge/i.test(img.alt))
        .slice(0, 3).map(img => ({
          alt: img.alt,
          src: img.src,
          parentCls: img.parentElement?.className,
          ancestorHtml: img.closest('li, article, div[class*="product"], div[class*="item"]')?.outerHTML?.slice(0, 400),
        }));

      return { selectors: results, watchImages: imgs };
    });
    console.log('\n=== WATCHFINDER (networkidle) ===');
    console.log(JSON.stringify(info, null, 2));
    await page.close();
  }

  await browser.close();
}

main().catch(console.error);
