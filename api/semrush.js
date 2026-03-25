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
    // Chiamate in parallelo per velocità
    const [overview, adKeywords, backlinks] = await Promise.allSettled([
      fetchDomainOverview(cleanDomain, apiKey),
      fetchAdKeywords(cleanDomain, apiKey),
      fetchBacklinks(cleanDomain, apiKey)
    ]);

    const overviewData = overview.status === 'fulfilled' ? overview.value : null;
    const adData = adKeywords.status === 'fulfilled' ? adKeywords.value : null;
    const backlinkData = backlinks.status === 'fulfilled' ? backlinks.value : null;

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
        score: backlinkData?.authority_score || overviewData?.authority_score || null,
        backlinks: backlinkData?.total || null
      },
      channels: buildChannelEstimate(overviewData),
      topAdKeywords: adData?.keywords?.slice(0, 10) || []
    });

  } catch (err) {
    return res.status(500).json({ error: 'Errore chiamata SEMrush API', detail: err.message });
  }
}

async function fetchDomainOverview(domain, key) {
  // SEMrush Domain Overview API
  const params = new URLSearchParams({
    type: 'domain_rank',
    key,
    domain,
    database: 'it',  // Database Italia
    export_columns: 'Or,Ot,Oc,Ad,At,Ac,FKn,FKk'
    // Or=organic_rank, Ot=organic_traffic, Oc=organic_keywords
    // Ad=paid_rank, At=paid_traffic, Ac=paid_keywords
  });

  const res = await fetch(`https://api.semrush.com/?${params}`);
  const text = await res.text();
  return parseSemrushCSV(text, 'domain_rank');
}

async function fetchAdKeywords(domain, key) {
  // SEMrush Advertising Research — keyword su cui il competitor fa ads
  const params = new URLSearchParams({
    type: 'domain_adwords',
    key,
    domain,
    database: 'it',
    display_limit: 20,
    export_columns: 'Ph,Po,Nq,Cp,Co,Tr,Tc,Nr,Td'
    // Ph=keyword, Po=position, Nq=search_volume, Cp=cpc, Tr=traffic%
  });

  const res = await fetch(`https://api.semrush.com/?${params}`);
  const text = await res.text();
  return parseSemrushKeywords(text);
}

async function fetchBacklinks(domain, key) {
  // SEMrush Backlinks Overview — authority score
  const params = new URLSearchParams({
    type: 'backlinks_overview',
    key,
    target: domain,
    target_type: 'root_domain',
    export_columns: 'ascore,total,domains_num,urls_num,ips_num,follows_num,nofollows_num'
  });

  const res = await fetch(`https://api.semrush.com/?${params}`);
  const text = await res.text();
  return parseSemrushBacklinks(text);
}

// Parsing risposta CSV SEMrush
function parseSemrushCSV(text, type) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return null;

  const headers = lines[0].split(';').map(h => h.trim());
  const values = lines[1].split(';').map(v => v.trim());

  const obj = {};
  headers.forEach((h, i) => { obj[h] = values[i]; });

  // Mappa tutti i possibili nomi di colonna
  const organicTraffic = parseInt(
    obj['Organic Traffic'] || obj['Ot'] || obj['Or'] || 0
  );
  const paidTraffic = parseInt(
    obj['Adwords Traffic'] || obj['At'] || obj['Ad'] || 0
  );
  const organicKeywords = parseInt(
    obj['Organic Keywords'] || obj['Oc'] || 0
  );
  const paidKeywords = parseInt(
    obj['Adwords Keywords'] || obj['Ac'] || 0
  );

  return {
    organic_traffic: organicTraffic,
    paid_traffic: paidTraffic,
    organic_keywords: organicKeywords,
    paid_keywords: paidKeywords,
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

function parseSemrushBacklinks(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return null;

  const headers = lines[0].split(';').map(h => h.trim());
  const vals = lines[1].split(';');
  const obj = {};
  headers.forEach((h, i) => { obj[h] = vals[i]?.trim(); });

  return {
    authority_score: parseInt(obj['Authority Score'] || obj['ascore'] || 0),
    total: parseInt(obj['Total Backlinks'] || obj['total'] || 0),
    domains: parseInt(obj['Referring Domains'] || obj['domains_num'] || 0)
  };
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

  // Stima distribuzione canali basata sui dati SEMrush
  const organicPct = Math.round((organic / total) * 60); // organic search
  const paidSearchPct = Math.round((paid / total) * 20);  // paid search
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
