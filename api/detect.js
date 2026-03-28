export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { domain } = req.query;
  if (!domain) return res.status(400).json({ error: 'Domain richiesto' });

  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
  const url = `https://${cleanDomain}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CompetitorBot/1.0)',
        'Accept': 'text/html'
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000)
    });

    const html = await response.text();
    const brandName = extractBrand(html, cleanDomain);
    const socials = extractSocials(html, cleanDomain);
    const favicon = `https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=64`;

    return res.status(200).json({ domain: cleanDomain, brandName, socials, favicon, found: true });

  } catch (err) {
    const brandName = cleanDomain.split('.')[0].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return res.status(200).json({
      domain: cleanDomain,
      brandName,
      socials: guessSocials(cleanDomain),
      favicon: `https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=64`,
      found: false,
      warning: 'Sito non raggiungibile — profili social stimati dal dominio'
    });
  }
}

function extractBrand(html, domain) {
  const ogSite = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i);
  if (ogSite) return ogSite[1].trim();

  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"'|–-]+)/i);
  if (ogTitle) return ogTitle[1].trim();

  const title = html.match(/<title[^>]*>([^<|–-]+)/i);
  if (title) return title[1].trim().split(/[-|–]/)[0].trim();

  return domain.split('.')[0].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function extractSocials(html, domain) {
  const slug = domain.split('.')[0];
  const socials = [];

  // Facebook
  const fbMatch = html.match(/(?:href|src)=["']https?:\/\/(?:www\.)?facebook\.com\/([^"'/?#\s]+)/i);
  const fbSlug = fbMatch ? fbMatch[1].replace(/\/$/, '') : slug;
  socials.push({
    id: 'fb',
    platform: 'Facebook / Meta Ads',
    handle: fbSlug,
    slug: fbSlug,
    url: `https://facebook.com/${fbSlug}`,
    confidence: fbMatch ? 'high' : 'low',
    detected: !!fbMatch
  });

  // Instagram
  const igMatch = html.match(/(?:href|src)=["']https?:\/\/(?:www\.)?instagram\.com\/([^"'/?#]+)/i);
  const igHandle = igMatch ? igMatch[1] : slug;
  socials.push({
    id: 'ig',
    platform: 'Instagram',
    handle: '@' + igHandle,
    url: `https://instagram.com/${igHandle}`,
    confidence: igMatch ? 'high' : 'low',
    detected: !!igMatch
  });

  return socials;
}

function guessSocials(domain) {
  const slug = domain.split('.')[0];
  return [
    { id: 'fb', platform: 'Facebook / Meta Ads', handle: slug, slug, url: `https://facebook.com/${slug}`, confidence: 'low', detected: false },
    { id: 'ig', platform: 'Instagram', handle: '@' + slug, url: `https://instagram.com/${slug}`, confidence: 'low', detected: false }
  ];
}
