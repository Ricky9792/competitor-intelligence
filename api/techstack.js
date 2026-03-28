import Wappalyzer from 'wappalyzer';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { domain } = req.query;
  if (!domain) return res.status(400).json({ error: 'domain richiesto' });

  const url = `https://${domain.replace(/^https?:\/\//, '')}`;

  try {
    const wappalyzer = new Wappalyzer({
      debug: false,
      delay: 500,
      headers: {},
      maxDepth: 1,
      maxUrls: 1,
      maxWait: 5000,
      recursive: false,
      probe: false,
      userAgent: 'Mozilla/5.0 (compatible; CompetitorIntel/1.0)',
      htmlMaxCols: 2000,
      htmlMaxRows: 2000,
    });

    await wappalyzer.init();
    const site = await wappalyzer.open(url);
    const results = await site.analyze();
    await wappalyzer.destroy();

    // Mappa le categorie Wappalyzer alle nostre
    const categoryMap = {
      'CMS': 'platform',
      'Ecommerce': 'platform',
      'Shop': 'platform',
      'Marketing automation': 'marketing',
      'Email': 'marketing',
      'CRM': 'crm',
      'Analytics': 'analytics',
      'Tag managers': 'ads',
      'Advertising networks': 'ads',
      'Retargeting': 'ads',
      'Pixel': 'ads',
      'Live chat': 'chat',
      'Helpdesk': 'chat',
      'Web frameworks': 'other',
      'JavaScript frameworks': 'other',
      'CDN': 'other',
      'Security': 'other',
    };

    const summary = {
      platform: [],
      marketing: [],
      ads: [],
      analytics: [],
      crm: [],
      chat: [],
      other: [],
      totalCount: 0
    };

    for (const tech of results.technologies) {
      let mapped = 'other';
      for (const cat of tech.categories || []) {
        const key = Object.keys(categoryMap).find(k => cat.name?.includes(k));
        if (key) { mapped = categoryMap[key]; break; }
      }
      if (!summary[mapped].includes(tech.name)) {
        summary[mapped].push(tech.name);
        summary.totalCount++;
      }
    }

    return res.status(200).json({ summary, raw: results.technologies.map(t => ({ name: t.name, categories: t.categories, confidence: t.confidence })) });

  } catch (err) {
    return res.status(500).json({ error: 'Errore analisi tech stack', detail: err.message });
  }
}
