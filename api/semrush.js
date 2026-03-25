export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { domain } = req.query;
  const apiKey = process.env.SEMRUSH_API_KEY;

  if (!apiKey) return res.status(500).json({ error: 'SEMRUSH_API_KEY non configurato' });
  if (!domain) return res.status(400).json({ error: 'Domain richiesto' });

  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();

  try {
    const [overview, adKeywords] = await Promise.allSettled([
      fetchDomainOverview(cleanDomain, apiKey),
      fetchAdKeywords(cleanDomain, apiKey)
    ]);

    const overviewData = overview.status === 'fulfilled' ? overview.value : null;
    const adData = adKeywords.status === 'fulfilled' ? adKeywords.value : null;

    return res.status(200).json({
      domain: cleanDomain,
      traffic: {
        organic: overviewData?.organic_traffic || null,
        paid: overviewData?.paid_traffic || null,
        total: overviewData?.total_traffic || null,
        formatted: formatTraffic(overviewData?.organic_traffic)
      },
      keywords: {
        organic: overviewData?.organic_keywords || null,
        paid: adData?.total || null
      },
      authority: {
        score: overviewData?.authority_score || null
      },
      channels: buildChannelEstimate(overviewData),
      topAdKeywords: adData?.keywords?.slice(0, 10) || []
    });

  } catch (err) {
    return res.status(500).json({ error: 'Errore chiamata SEMrush API', detail: err.message });
  }
}

async function fetchDomainOverview(domain, key) {
  const params = new URLSearchParams({
    type: 'domain_rank',
    key,
    domain,
    database: 'it',
    export_columns: 'Or,Ot,Oc,Ad,At,Ac'
  });
  const res = await fetch(`https://api.semrush.com/?${params}`);
  const text = await res.text();
  return parseSemrushCSV(text);
}

async function fetchAdKeywords(domain, key) {
  const params = new URLSearchParams({
    type: 'domain_adwords',
    key,
    domain,
    database: 'it',
    display_limit: 20,
    export_columns: 'Ph,Po,Nq,Cp,Tr'
  });
  const res = await fetch(`https://api.semrush.com/?${params}`);
  const text = await res.text();
  return parseSemrushKeywords(text);
}

function parseSemrushCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return null;

  const headers = lines[0].split(';').map(h => h.trim());
  const values = lines[1].split(';').map(v => v.trim());

  const obj = {};
  headers.forEach((h, i) => { obj[h] = values[i]; });

  const organicTraffic = parseInt(obj['Organic Traffic'] || obj['Ot'] || 0);
  const paidTraffic = parseInt(obj['Adwords Traffic'] || obj['At'] || 0);
  const organicKeywords = parseInt(obj['Organic Keywords'] || obj['Oc'] || 0);

  return {
    organic_traffic: organicTraffic,
    paid_traffic: paidTraffic,
    organic_keywords: organicKeywords,
    authority_score: parseInt(obj['Authority Score'] || obj['AS'] || 0),
    total_traffic: organicTraffic + paidTraffic
  };
}

function parseSemrushKeywords(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return { keywords: [], total: 0 };

  const headers = lines[0].split(';').map(h => h.trim());
  const keywords = lines.slice(1).map(line => {
    const vals = line.split(';');
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i]?.trim(); });
    return {
      keyword: obj['Keyword'] || obj['Ph'] || '',
      position: obj['Position'] || obj['Po'] || '',
      volume: parseInt(obj['Search Volume'] || obj['Nq'] || 0),
      cpc: obj['CPC'] || obj['Cp'] || '',
      traffic: obj['Traffic (%)'] || obj['Tr'] || ''
    };
  }).filter(k => k.keyword);

  return { keywords, total: keywords.length };
}

function formatTraffic(n) {
  if (!n) return '—';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return Math.round(n / 1000) + 'K';
  return String(n);
}

function buildChannelEstimate(data) {
  if (!data) return null;

  const organic = data.organic_traffic || 0;
  const paid = data.paid_traffic || 0;
  const total = organic + paid;
  if (total === 0) return null;

  const organicPct = Math.round((organic / total) * 60);
  const paidSearchPct = Math.round((paid / total) * 20);
  const remaining = 100 - organicPct - paidSearchPct;
  const paidSocialPct = Math.round(remaining * 0.45);
  const directPct = Math.round(remaining * 0.35);
  const emailPct = remaining - paidSocialPct - directPct;

  return [
    { nome: 'Organic search', pct: organicPct, colore: '#1D9E75' },
    { nome: 'Paid social', pct: paidSocialPct, colore: '#534AB7' },
    { nome: 'Direct', pct: directPct, colore: '#888780' },
    { nome: 'Paid search', pct: paidSearchPct, colore: '#BA7517' },
    { nome: 'Email / referral', pct: emailPct, colore: '#5a5a5a' }
  ];
}
