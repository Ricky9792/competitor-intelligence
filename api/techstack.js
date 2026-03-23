export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { domain } = req.query;
  if (!domain) return res.status(400).json({ error: 'Domain richiesto' });

  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();

  try {
    const response = await fetch(`https://${cleanDomain}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TechDetector/1.0)' },
      signal: AbortSignal.timeout(8000)
    });

    const html = await response.text();
    const headers = Object.fromEntries(response.headers.entries());

    const detected = detectTechnologies(html, headers, cleanDomain);

    return res.status(200).json({
      domain: cleanDomain,
      technologies: detected,
      summary: buildSummary(detected)
    });

  } catch (err) {
    return res.status(200).json({
      domain: cleanDomain,
      technologies: {},
      summary: { marketing: [], ads: [], analytics: [], platform: [] },
      warning: 'Impossibile analizzare il sito — potrebbe bloccare i bot'
    });
  }
}

function detectTechnologies(html, headers, domain) {
  const detected = {
    platform: [],
    marketing: [],
    ads: [],
    analytics: [],
    crm: [],
    chat: [],
    other: []
  };

  const checks = [
    // === PIATTAFORME ECOMMERCE / CMS ===
    { pattern: /shopify/i, name: 'Shopify', category: 'platform', hint: 'cdn.shopify.com' },
    { pattern: /woocommerce|wp-content\/plugins\/woocommerce/i, name: 'WooCommerce', category: 'platform' },
    { pattern: /wordpress|wp-content|wp-includes/i, name: 'WordPress', category: 'platform' },
    { pattern: /magento|mage\/|Mage\.Cookies/i, name: 'Magento', category: 'platform' },
    { pattern: /prestashop/i, name: 'PrestaShop', category: 'platform' },
    { pattern: /bigcommerce/i, name: 'BigCommerce', category: 'platform' },
    { pattern: /squarespace/i, name: 'Squarespace', category: 'platform' },
    { pattern: /webflow/i, name: 'Webflow', category: 'platform' },
    { pattern: /hubspot-web-interactives|hs-scripts\.com/i, name: 'HubSpot CMS', category: 'platform' },

    // === MARKETING AUTOMATION ===
    { pattern: /klaviyo/i, name: 'Klaviyo', category: 'marketing' },
    { pattern: /mailchimp|mc\.js|chimpstatic/i, name: 'Mailchimp', category: 'marketing' },
    { pattern: /hubspot|hs-analytics|hsstatic\.net/i, name: 'HubSpot', category: 'marketing' },
    { pattern: /activecampaign/i, name: 'ActiveCampaign', category: 'marketing' },
    { pattern: /marketo/i, name: 'Marketo', category: 'marketing' },
    { pattern: /salesforce.*pardot|pardot/i, name: 'Pardot', category: 'marketing' },
    { pattern: /sendinblue|brevo/i, name: 'Brevo', category: 'marketing' },
    { pattern: /mailup/i, name: 'MailUp', category: 'marketing' },

    // === ADVERTISING / PIXEL ===
    { pattern: /googletagmanager|gtm\.js|GTM-/i, name: 'Google Tag Manager', category: 'ads' },
    { pattern: /google-analytics|gtag\/js|GA_MEASUREMENT_ID|G-[A-Z0-9]+/i, name: 'Google Analytics 4', category: 'analytics' },
    { pattern: /adsbygoogle|googlesyndication|doubleclick/i, name: 'Google Ads', category: 'ads' },
    { pattern: /connect\.facebook\.net|fbq\(|facebook pixel|fbevents/i, name: 'Meta Pixel', category: 'ads' },
    { pattern: /tiktok.*pixel|analytics\.tiktok|_ttq/i, name: 'TikTok Pixel', category: 'ads' },
    { pattern: /snap\.licdn\.com|linkedin.*insight|_linkedin_partner/i, name: 'LinkedIn Insight Tag', category: 'ads' },
    { pattern: /static\.ads-twitter|twq\(|twitter.*pixel/i, name: 'Twitter/X Pixel', category: 'ads' },
    { pattern: /sc-static\.net|snapchat.*pixel/i, name: 'Snapchat Pixel', category: 'ads' },
    { pattern: /criteo/i, name: 'Criteo', category: 'ads' },
    { pattern: /rtmark\.net|zanox|awin/i, name: 'Awin Affiliate', category: 'ads' },

    // === ANALYTICS & CRO ===
    { pattern: /hotjar/i, name: 'Hotjar', category: 'analytics' },
    { pattern: /clarity\.ms|microsoft.*clarity/i, name: 'Microsoft Clarity', category: 'analytics' },
    { pattern: /segment\.io|segment\.com\/analytics/i, name: 'Segment', category: 'analytics' },
    { pattern: /mixpanel/i, name: 'Mixpanel', category: 'analytics' },
    { pattern: /heap\.io|heap\.js/i, name: 'Heap', category: 'analytics' },
    { pattern: /optimizely/i, name: 'Optimizely', category: 'analytics' },
    { pattern: /vwo\.com|visualwebsiteoptimizer/i, name: 'VWO', category: 'analytics' },
    { pattern: /crazyegg/i, name: 'Crazy Egg', category: 'analytics' },
    { pattern: /contentsquare|clicktale/i, name: 'Contentsquare', category: 'analytics' },
    { pattern: /trustpilot/i, name: 'Trustpilot', category: 'other' },
    { pattern: /yotpo/i, name: 'Yotpo', category: 'other' },

    // === CRM ===
    { pattern: /salesforce|force\.com/i, name: 'Salesforce', category: 'crm' },
    { pattern: /zendesk/i, name: 'Zendesk', category: 'crm' },
    { pattern: /intercom/i, name: 'Intercom', category: 'chat' },
    { pattern: /drift\.com/i, name: 'Drift', category: 'chat' },
    { pattern: /tidio/i, name: 'Tidio', category: 'chat' },
    { pattern: /freshchat|freshdesk/i, name: 'Freshdesk', category: 'crm' },
  ];

  for (const check of checks) {
    if (check.pattern.test(html)) {
      if (!detected[check.category]) detected[check.category] = [];
      detected[check.category].push(check.name);
    }
  }

  // Controlla anche negli headers HTTP
  const serverHeader = headers['server'] || headers['x-powered-by'] || '';
  if (/shopify/i.test(serverHeader) && !detected.platform.includes('Shopify')) {
    detected.platform.push('Shopify');
  }

  return detected;
}

function buildSummary(detected) {
  return {
    marketing: detected.marketing || [],
    ads: detected.ads || [],
    analytics: detected.analytics || [],
    platform: detected.platform || [],
    crm: detected.crm || [],
    chat: detected.chat || [],
    other: detected.other || [],
    totalCount: Object.values(detected).flat().length
  };
}
