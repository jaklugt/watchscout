'use strict';

const { chromium } = require('playwright');

async function probePage(browser, name, url, opts = {}) {
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'nl-NL,nl;q=0.9' });
  try {
    await page.goto(url, { waitUntil: opts.idle ? 'networkidle' : 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    const status = await page.evaluate(() => document.readyState);
    const title = await page.title();

    const html = await page.evaluate(() => {
      // Find all elements that look like product cards
      const candidates = [];
      const all = document.querySelectorAll('*');
      const seen = new Set();

      // Look for repeated structural elements with links and prices
      const moneyPattern = /€\s*\d[\d.,]+/;
      for (const el of all) {
        const cls = el.className;
        if (!cls || typeof cls !== 'string') continue;
        if (seen.has(cls)) continue;
        const siblings = document.getElementsByClassName(cls.split(' ')[0]);
        if (siblings.length >= 3 && siblings.length <= 200) {
          const sample = siblings[0];
          const hasLink = sample.querySelector('a');
          const hasImg = sample.querySelector('img');
          const hasPrice = moneyPattern.test(sample.textContent || '');
          if (hasLink && (hasImg || hasPrice)) {
            seen.add(cls);
            candidates.push({
              cls,
              count: siblings.length,
              sampleText: sample.textContent?.trim().slice(0, 300),
              sampleHtml: sample.outerHTML?.slice(0, 500),
            });
          }
        }
      }

      // Top 5 by count
      candidates.sort((a, b) => b.count - a.count);
      return candidates.slice(0, 5);
    });

    console.log(`\n=== ${name} [${url}] ===`);
    console.log(`Title: ${title}`);
    for (const c of html) {
      console.log(`\n  CLASS: "${c.cls}" (${c.count} els)`);
      console.log(`  TEXT: ${c.sampleText?.slice(0, 200)}`);
      console.log(`  HTML: ${c.sampleHtml?.slice(0, 400)}`);
    }
    if (html.length === 0) {
      // Print page text snippet
      const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 500));
      console.log(`  No candidates. Body: ${bodyText}`);
    }
  } catch (e) {
    console.log(`\n=== ${name} === ERROR: ${e.message}`);
  } finally {
    await page.close();
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  // Ace Jewelers - try correct URL patterns
  await probePage(browser, 'Ace Jewelers /horloges', 'https://www.acejewelers.com/nl/horloges');
  await probePage(browser, 'Ace Jewelers /horloges/rolex', 'https://www.acejewelers.com/nl/horloges/rolex');

  // Juwelier Burger - try the rolex-specific URL found in probe
  await probePage(browser, 'Juwelier Burger /rolex', 'https://www.juwelierburger.com/NL/horloges/rolex', { idle: true });

  // Schaap & Citroen preowned
  await probePage(browser, 'Schaap Citroen preowned', 'https://preowned.schaapcitroen.nl/', { idle: true });
  await probePage(browser, 'Schaap Citroen /rolex', 'https://preowned.schaapcitroen.nl/rolex');

  // Watchfinder - rolex page
  await probePage(browser, 'Watchfinder /watches/rolex', 'https://www.watchfinder.nl/watches/rolex', { idle: true });

  await browser.close();
}

main().catch(console.error);
