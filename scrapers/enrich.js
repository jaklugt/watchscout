'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CONDITION_SCORE = { unworn: 3, 'very good': 2, good: 1, fair: 0 };

// --- Claude enrichment: extract box/papers/service from title in batches of 10 ---
async function enrichBatch(watches) {
  const items = watches.map((w, i) =>
    `${i + 1}. Title: "${w.title}" | Condition: "${w.condition || ''}" | Source: "${w.source}"`
  );

  const prompt = `Analyze these pre-owned watch listings and extract availability details.
For each listing determine (based on title keywords like "doos", "box", "papieren", "papers", "service", "revision"):
- has_box (true/false/null if unknown)
- has_papers (true/false/null if unknown)
- has_service_history (true/false/null if unknown)

${items.join('\n')}

Respond ONLY with a JSON array of objects in the same order:
[{"has_box":null,"has_papers":null,"has_service_history":null}, ...]`;

  const resp = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = resp.content[0].text.trim();
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error(`Unexpected Claude response: ${text.slice(0, 200)}`);
  return JSON.parse(jsonMatch[0]);
}

// --- Market price analysis per reference_number ---
async function computeMarketPrices(watches) {
  const byRef = {};
  for (const w of watches) {
    if (!w.reference_number || !w.price) continue;
    const key = `${w.brand}::${w.reference_number}`;
    if (!byRef[key]) byRef[key] = { brand: w.brand, ref: w.reference_number, model: w.title, prices: [] };
    byRef[key].prices.push(w.price);
  }

  const analyses = [];
  for (const { brand, ref, model, prices } of Object.values(byRef)) {
    if (prices.length < 2) continue;
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    analyses.push({
      reference_number: ref,
      brand,
      model,
      avg_price: Math.round(avg),
      min_price: Math.min(...prices),
      max_price: Math.max(...prices),
      listing_count: prices.length,
      last_updated: new Date().toISOString(),
    });
  }

  if (analyses.length) {
    const { error } = await supabase
      .from('price_analysis')
      .upsert(analyses, { onConflict: 'reference_number,brand' });
    if (error) console.error('price_analysis upsert error:', error.message);
    else console.log(`  Saved ${analyses.length} market price records`);
  }

  // Return lookup: ref → avg_price
  return Object.fromEntries(
    analyses.map(a => [`${a.brand}::${a.reference_number}`, a.avg_price])
  );
}

// --- Send alert emails via Resend ---
async function sendAlerts(dealListings) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log('  RESEND_API_KEY not set — skipping email alerts');
    return;
  }

  const { data: subscribers, error } = await supabase.from('subscribers').select('*');
  if (error || !subscribers?.length) {
    console.log('  No subscribers found');
    return;
  }

  const { Resend } = require('resend');
  const resend = new Resend(apiKey);
  let sent = 0;

  for (const sub of subscribers) {
    const matches = dealListings.filter(w => {
      if (sub.brand && w.brand?.toLowerCase() !== sub.brand.toLowerCase()) return false;
      if (sub.reference_number && w.reference_number !== sub.reference_number) return false;
      if (sub.max_price && w.price > sub.max_price) return false;
      if (sub.must_have_papers && !w.has_papers) return false;
      return true;
    });

    if (!matches.length) continue;

    const listHtml = matches.map(w => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #eee">
          <a href="${w.url}" style="font-weight:600;color:#111;text-decoration:none">${w.title}</a><br>
          <span style="color:#666;font-size:13px">${w.source} · ${w.reference_number || ''}</span>
        </td>
        <td style="padding:8px 0 8px 16px;border-bottom:1px solid #eee;white-space:nowrap;text-align:right">
          <strong>€${w.price?.toLocaleString('nl-NL')}</strong><br>
          <span style="color:#059669;font-size:12px">
            ${w.market_avg_price ? `${Math.round(((w.market_avg_price - w.price) / w.market_avg_price) * 100)}% onder marktprijs` : 'Goede deal'}
          </span>
        </td>
      </tr>`).join('');

    await resend.emails.send({
      from: 'WatchScout <alerts@watchscout.nl>',
      to: sub.email,
      subject: `${matches.length} nieuwe Rolex deal${matches.length > 1 ? 's' : ''} voor jou`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
          <h2 style="margin:0 0 8px">WatchScout</h2>
          <p style="color:#666;margin:0 0 24px">We hebben ${matches.length} nieuwe deal${matches.length > 1 ? 's' : ''} gevonden die aan jouw criteria voldoe${matches.length > 1 ? 'n' : 't'}.</p>
          <table style="width:100%;border-collapse:collapse">${listHtml}</table>
          <p style="margin:24px 0 0;color:#999;font-size:12px">
            Je ontvangt deze e-mail omdat je je hebt aangemeld voor WatchScout alerts.
          </p>
        </div>`,
    });
    sent++;
  }

  if (sent) console.log(`  Sent ${sent} alert email(s)`);
}

async function main() {
  console.log('WatchScout — Enrichment');
  console.log('══════════════════════════════════════════\n');

  // Fetch all watches
  const { data: watches, error } = await supabase
    .from('watches')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { console.error('Fetch error:', error.message); process.exit(1); }
  console.log(`Loaded ${watches.length} listings\n`);

  // --- Step 1: Claude enrichment for box/papers/service ---
  console.log('[Step 1] Enriching box/papers/service_history with Claude...');
  const needEnrich = watches.filter(w => w.has_box === null || w.has_box === undefined);
  console.log(`  ${needEnrich.length} listings need enrichment`);

  const BATCH = 10;
  for (let i = 0; i < needEnrich.length; i += BATCH) {
    const batch = needEnrich.slice(i, i + BATCH);
    process.stdout.write(`  Batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(needEnrich.length / BATCH)}...`);
    try {
      const results = await enrichBatch(batch);
      for (let j = 0; j < batch.length; j++) {
        const w = batch[j];
        const r = results[j] || {};
        const condScore = CONDITION_SCORE[w.condition] ?? null;
        await supabase.from('watches').update({
          has_box: r.has_box ?? null,
          has_papers: r.has_papers ?? null,
          has_service_history: r.has_service_history ?? null,
          condition_score: condScore,
        }).eq('id', w.id);
        // update in-memory too for deal score step
        w.has_box = r.has_box ?? null;
        w.has_papers = r.has_papers ?? null;
        w.has_service_history = r.has_service_history ?? null;
        w.condition_score = condScore;
      }
      console.log(' done');
    } catch (err) {
      console.log(` error: ${err.message}`);
    }
    // Small delay to avoid rate limits
    if (i + BATCH < needEnrich.length) await new Promise(r => setTimeout(r, 500));
  }

  // --- Step 2: Market price analysis ---
  console.log('\n[Step 2] Computing market prices...');
  const marketLookup = await computeMarketPrices(watches);

  // --- Step 3: Update deal_score and market_avg_price on watches ---
  console.log('\n[Step 3] Updating deal scores...');
  let dealCount = 0;
  for (const w of watches) {
    if (!w.price || !w.reference_number) continue;
    const avgPrice = marketLookup[`${w.brand}::${w.reference_number}`];
    if (!avgPrice) continue;
    const dealScore = ((avgPrice - w.price) / avgPrice) * 10;
    await supabase.from('watches').update({
      deal_score: Math.round(dealScore * 100) / 100,
      market_avg_price: avgPrice,
    }).eq('id', w.id);
    w.deal_score = dealScore;
    w.market_avg_price = avgPrice;
    if (dealScore > 0) dealCount++;
  }
  console.log(`  ${dealCount} listings priced below market average`);

  // --- Step 4: Send alerts for new deals (created in last 24h) ---
  console.log('\n[Step 4] Sending email alerts...');
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const newDeals = watches.filter(
    w => w.deal_score > 0 && w.created_at > oneDayAgo
  );
  console.log(`  ${newDeals.length} new deals in last 24h`);
  if (newDeals.length) await sendAlerts(newDeals);

  console.log('\n══════════════════════════════════════════');
  console.log('Enrichment complete.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
