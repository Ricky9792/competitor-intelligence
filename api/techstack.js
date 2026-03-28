export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { domain } = req.query;
  if (!domain) return res.status(400).json({ error: 'domain richiesto' });

  const url = `https://${domain.replace(/^https?:\/\//, '')}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(10000)
    });

    const html = await response.text();
    const headers = Object.fromEntries(response.headers.entries());
    const detected = detect(html, headers, url);

    return res.status(200).json({ summary: detected });

  } catch (err) {
    return res.status(500).json({ error: 'Errore analisi tech stack', detail: err.message });
  }
}

function detect(html, headers, url) {
  const h = html.toLowerCase();
  const found = {
    platform: [],
    marketing: [],
    ads: [],
    analytics: [],
    crm: [],
    chat: [],
    other: [],
    totalCount: 0
  };

  function add(category, name) {
    if (!found[category].includes(name)) {
      found[category].push(name);
      found.totalCount++;
    }
  }

  // ─── CMS / PLATFORM ───
  if (h.includes('wp-content') || h.includes('wp-includes') || h.includes('wordpress')) add('platform', 'WordPress');
  if (h.includes('cdn.shopify.com') || h.includes('myshopify.com') || h.includes('shopify.com/s/files')) add('platform', 'Shopify');
  if (h.includes('woocommerce') && h.includes('wp-content')) add('platform', 'WooCommerce');
  if (h.includes('mage/cookies') || h.includes('magento/') || h.includes('mage.cookies')) add('platform', 'Magento');
  if (h.includes('squarespace')) add('platform', 'Squarespace');
  if (h.includes('wix.com') || h.includes('wixstatic')) add('platform', 'Wix');
  if (h.includes('webflow')) add('platform', 'Webflow');
  if (h.includes('framer.com') || h.includes('framer-motion')) add('platform', 'Framer');
  if (h.includes('sanity.io') || h.includes('sanitycdn')) add('platform', 'Sanity');
  if (h.includes('contentful')) add('platform', 'Contentful');
  if (h.includes('ghost.io') || h.includes('ghost/')) add('platform', 'Ghost');
  if (h.includes('drupal')) add('platform', 'Drupal');
  if (h.includes('joomla')) add('platform', 'Joomla');
  if (h.includes('prestashop')) add('platform', 'PrestaShop');
  if (h.includes('bigcommerce')) add('platform', 'BigCommerce');
  if (h.includes('next.js') || h.includes('_next/static') || h.includes('__next')) add('platform', 'Next.js');
  if (h.includes('nuxt') || h.includes('_nuxt/')) add('platform', 'Nuxt.js');
  if (h.includes('gatsby')) add('platform', 'Gatsby');
  if (h.includes('hubspot-') || h.includes('hs-sites')) add('platform', 'HubSpot CMS');

  // ─── ANALYTICS ───
  if (h.includes('google-analytics') || h.includes('gtag') || h.includes('ga.js') || h.includes('analytics.js') || h.includes('googletagmanager.com/gtag')) add('analytics', 'Google Analytics 4');
  if (h.includes('hotjar') || h.includes('hj.hotjar')) add('analytics', 'Hotjar');
  if (h.includes('mixpanel')) add('analytics', 'Mixpanel');
  if (h.includes('segment.com') || h.includes('segment.io') || h.includes('analytics.segment')) add('analytics', 'Segment');
  if (h.includes('amplitude')) add('analytics', 'Amplitude');
  if (h.includes('heap.io') || h.includes('heapanalytics')) add('analytics', 'Heap');
  if (h.includes('clarity.ms') || h.includes('microsoft clarity')) add('analytics', 'Microsoft Clarity');
  if (h.includes('plausible')) add('analytics', 'Plausible');
  if (h.includes('posthog')) add('analytics', 'PostHog');
  if (h.includes('datadog') || h.includes('dd-rum')) add('analytics', 'Datadog');
  if (h.includes('sentry')) add('analytics', 'Sentry');
  if (h.includes('logrocket')) add('analytics', 'LogRocket');
  if (h.includes('fullstory')) add('analytics', 'FullStory');
  if (h.includes('mouseflow')) add('analytics', 'Mouseflow');
  if (h.includes('crazyegg')) add('analytics', 'Crazy Egg');
  if (h.includes('inspectlet')) add('analytics', 'Inspectlet');

  // ─── ADS / PIXEL ───
  if (h.includes('googletagmanager.com') || h.includes('gtm.js')) add('ads', 'Google Tag Manager');
  if (h.includes('connect.facebook.net') || h.includes('fbq(') || h.includes('facebook pixel')) add('ads', 'Meta Pixel');
  if (h.includes('ads.tiktok.com') || h.includes('tiktok pixel') || h.includes('ttq.')) add('ads', 'TikTok Pixel');
  if (h.includes('snap.licdn') || h.includes('linkedin insight') || h.includes('linkedin.com/px')) add('ads', 'LinkedIn Insight Tag');
  if (h.includes('static.ads-twitter') || h.includes('twitter pixel') || h.includes('twq(')) add('ads', 'Twitter/X Pixel');
  if (h.includes('pinterest.com/ct') || h.includes('pintrk(')) add('ads', 'Pinterest Tag');
  if (h.includes('ads.snapchat.com') || h.includes('snaptr(')) add('ads', 'Snapchat Pixel');
  if (h.includes('google_ad_client') || h.includes('adsbygoogle') || h.includes('googlesyndication')) add('ads', 'Google AdSense');
  if (h.includes('doubleclick') || h.includes('dc.js')) add('ads', 'Google Ads');
  if (h.includes('criteo')) add('ads', 'Criteo');
  if (h.includes('taboola')) add('ads', 'Taboola');
  if (h.includes('outbrain')) add('ads', 'Outbrain');
  if (h.includes('adroll')) add('ads', 'AdRoll');
  if (h.includes('bing.com/bat') || h.includes('bat.bing')) add('ads', 'Microsoft Ads');

  // ─── MARKETING AUTOMATION ───
  if (h.includes('hubspot') || h.includes('hs-scripts') || h.includes('hsforms')) add('marketing', 'HubSpot');
  if (h.includes('mailchimp') || h.includes('list-manage.com')) add('marketing', 'Mailchimp');
  if (h.includes('klaviyo')) add('marketing', 'Klaviyo');
  if (h.includes('activecampaign')) add('marketing', 'ActiveCampaign');
  if (h.includes('marketo')) add('marketing', 'Marketo');
  if (h.includes('pardot') || h.includes('pi.pardot')) add('marketing', 'Pardot');
  if (h.includes('brevo') || h.includes('sendinblue')) add('marketing', 'Brevo');
  if (h.includes('mailerlite')) add('marketing', 'MailerLite');
  if (h.includes('convertkit')) add('marketing', 'ConvertKit');
  if (h.includes('drip.com') || h.includes('getdrip')) add('marketing', 'Drip');
  if (h.includes('omnisend')) add('marketing', 'Omnisend');
  if (h.includes('iterable')) add('marketing', 'Iterable');
  if (h.includes('customer.io')) add('marketing', 'Customer.io');
  if (h.includes('autopilot') || h.includes('autopilothq')) add('marketing', 'Autopilot');

  // ─── CRM ───
  if (h.includes('salesforce') || h.includes('force.com')) add('crm', 'Salesforce');
  if (h.includes('pipedrive')) add('crm', 'Pipedrive');
  if (h.includes('zoho')) add('crm', 'Zoho CRM');
  if (h.includes('freshsales') || h.includes('freshworks')) add('crm', 'Freshworks');

  // ─── CHAT / SUPPORT ───
  if (h.includes('intercom') || h.includes('widget.intercom')) add('chat', 'Intercom');
  if (h.includes('zendesk') || h.includes('zdassets')) add('chat', 'Zendesk');
  if (h.includes('drift.com') || h.includes('js.driftt')) add('chat', 'Drift');
  if (h.includes('tawk.to') || h.includes('tawkto')) add('chat', 'Tawk.to');
  if (h.includes('crisp.chat') || h.includes('client.crisp')) add('chat', 'Crisp');
  if (h.includes('livechat') || h.includes('cdn.livechatinc')) add('chat', 'LiveChat');
  if (h.includes('olark')) add('chat', 'Olark');
  if (h.includes('freshdesk') || h.includes('freshchat')) add('chat', 'Freshdesk');
  if (h.includes('tidio')) add('chat', 'Tidio');
  if (h.includes('gorgias')) add('chat', 'Gorgias');

  // ─── PAYMENT / OTHER ───
  if (h.includes('js.stripe.com') || h.includes('stripe.com/v3')) add('other', 'Stripe');
  if (h.includes('paypalobjects.com') || h.includes('paypal.com/sdk')) add('other', 'PayPal');
  if (h.includes('cloudflare') || headers['cf-ray'] || headers['server']?.includes('cloudflare')) add('other', 'Cloudflare');
  if (h.includes('hcaptcha') || h.includes('recaptcha') || h.includes('grecaptcha')) add('other', h.includes('hcaptcha') ? 'hCaptcha' : 'Google reCAPTCHA');
  if (h.includes('tailwindcss') || h.includes('tailwind')) add('other', 'Tailwind CSS');
  if (h.includes('bootstrap')) add('other', 'Bootstrap');
  if (h.includes('react') || h.includes('__react') || h.includes('reactdom')) add('other', 'React');
  if (h.includes('vue.js') || h.includes('vuejs') || h.includes('__vue')) add('other', 'Vue.js');
  if (h.includes('angular')) add('other', 'Angular');
  if (h.includes('jquery')) add('other', 'jQuery');
  if (h.includes('cookiebot') || h.includes('cookieconsent') || h.includes('cookiehub') || h.includes('iubenda')) add('other', 'Cookie Consent');
  if (h.includes('onetrust')) add('other', 'OneTrust');
  if (h.includes('typeform')) add('other', 'Typeform');
  if (h.includes('calendly')) add('other', 'Calendly');
  if (h.includes('youtube.com/embed') || h.includes('ytimg')) add('other', 'YouTube');
  if (h.includes('vimeo')) add('other', 'Vimeo');
  if (h.includes('aws') || h.includes('amazonaws')) add('other', 'Amazon AWS');
  if (h.includes('vercel') || h.includes('_vercel')) add('other', 'Vercel');
  if (h.includes('netlify')) add('other', 'Netlify');

  // Server headers
  const server = headers['server'] || '';
  if (server.includes('nginx')) add('other', 'Nginx');
  if (server.includes('apache')) add('other', 'Apache');
  if (server.includes('litespeed')) add('other', 'LiteSpeed');

  return found;
}
