export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { pageId, pageName, limit = 10 } = req.query;
  const token = process.env.META_ACCESS_TOKEN;

  if (!token) return res.status(500).json({ error: 'META_ACCESS_TOKEN non configurato' });
  if (!pageId && !pageName) return res.status(400).json({ error: 'pageId o pageName richiesto' });

  try {
    let resolvedPageId = pageId;

    // Se abbiamo solo il nome, cerchiamo l'ID pagina
    if (!pageId && pageName) {
      resolvedPageId = await resolvePageId(pageName, token);
      if (!resolvedPageId) {
        return res.status(200).json({
          ads: [],
          total: 0,
          warning: `Pagina Facebook non trovata per "${pageName}". Verifica che il nome sia corretto.`
        });
      }
    }

    // Chiama Meta Ad Library API
    const fields = [
      'id',
      'ad_creation_time',
      'ad_delivery_start_time',
      'ad_snapshot_url',
      'page_name',
      'publisher_platforms',
      'ad_creative_bodies',
      'ad_creative_link_titles',
      'ad_creative_link_descriptions',
      'ad_creative_link_captions',
      'impressions',
      'spend'
    ].join(',');

    const params = new URLSearchParams({
      access_token: token,
      ad_reached_countries: '["IT"]',  // Italia — modifica se serve altro paese
      search_page_ids: resolvedPageId,
      ad_active_status: 'ACTIVE',
      fields,
      limit: Math.min(Number(limit), 50)
    });

    const apiUrl = `https://graph.facebook.com/v19.0/ads_archive?${params}`;
    const response = await fetch(apiUrl, { signal: AbortSignal.timeout(10000) });
    const data = await response.json();

    if (data.error) {
      return res.status(200).json({
        ads: [],
        total: 0,
        error: data.error.message,
        hint: 'Verifica che il token Meta sia valido e che l\'app abbia i permessi per Ad Library API'
      });
    }

    const ads = (data.data || []).map(ad => ({
      id: ad.id,
      headline: extractHeadline(ad),
      copy: extractCopy(ad),
      platforms: ad.publisher_platforms || [],
      startDate: ad.ad_delivery_start_time || ad.ad_creation_time,
      snapshotUrl: ad.ad_snapshot_url,
      daysActive: calcDaysActive(ad.ad_delivery_start_time || ad.ad_creation_time),
      impressions: ad.impressions,
      spend: ad.spend
    }));

    return res.status(200).json({
      ads,
      total: ads.length,
      pageId: resolvedPageId,
      hasMore: !!data.paging?.next
    });

  } catch (err) {
    return res.status(500).json({ error: 'Errore chiamata Meta API', detail: err.message });
  }
}

async function resolvePageId(name, token) {
  // Strategia 1: risolvi lo slug direttamente come username Facebook
  // Funziona per URL tipo facebook.com/leviathan.levelup
  try {
    const slugParams = new URLSearchParams({ access_token: token, fields: 'id,name' });
    const slugRes = await fetch(`https://graph.facebook.com/v19.0/${encodeURIComponent(name)}?${slugParams}`);
    const slugData = await slugRes.json();
    if (slugData.id && !slugData.error) return slugData.id;
  } catch {}

  // Strategia 2: cerca per nome testuale
  try {
    const params = new URLSearchParams({
      access_token: token,
      q: name,
      type: 'page',
      fields: 'id,name,fan_count'
    });
    const res = await fetch(`https://graph.facebook.com/v19.0/search?${params}`);
    const data = await res.json();
    if (data.data && data.data.length > 0) {
      const sorted = data.data.sort((a, b) => (b.fan_count || 0) - (a.fan_count || 0));
      return sorted[0].id;
    }
  } catch {}

  return null;
}

function extractHeadline(ad) {
  if (ad.ad_creative_link_titles?.length) return ad.ad_creative_link_titles[0];
  if (ad.ad_creative_link_captions?.length) return ad.ad_creative_link_captions[0];
  return 'Annuncio senza titolo';
}

function extractCopy(ad) {
  if (ad.ad_creative_bodies?.length) {
    const body = ad.ad_creative_bodies[0];
    return body.length > 120 ? body.slice(0, 120) + '...' : body;
  }
  if (ad.ad_creative_link_descriptions?.length) return ad.ad_creative_link_descriptions[0];
  return '';
}

function calcDaysActive(dateStr) {
  if (!dateStr) return null;
  const start = new Date(dateStr);
  const now = new Date();
  return Math.floor((now - start) / (1000 * 60 * 60 * 24));
}
