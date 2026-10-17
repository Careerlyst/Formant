export const PRODUCTION_ORIGIN = 'https://careerlyst-three.vercel.app';
export const BRAND_IMAGE = '/assets/formant-wordmark-1200.png';

export const PUBLIC_SEO_PAGES = {
  '/': {
    title: 'Formant | Career Profile and Job Preparation',
    description: 'Build a clearer professional profile with role-focused resume, LinkedIn, GitHub, portfolio and interview preparation.',
    canonical: `${PRODUCTION_ORIGIN}/`,
    indexable: true
  },
  '/services': {
    title: 'Career Preparation Services | Formant',
    description: 'Explore role-focused resume, LinkedIn, GitHub, portfolio, cover letter and interview preparation services.',
    canonical: `${PRODUCTION_ORIGIN}/services`,
    indexable: true
  },
  '/pricing': {
    title: 'Pricing | Formant Career Preparation',
    description: 'Review starting points for Formant career preparation services and find an approach suited to your goals.',
    canonical: `${PRODUCTION_ORIGIN}/pricing`,
    indexable: true
  },
  '/about': {
    title: 'About Formant | Career Profile Preparation',
    description: 'Learn how Formant helps students, job seekers and professionals communicate their experience with clarity.',
    canonical: `${PRODUCTION_ORIGIN}/about`,
    indexable: true
  },
  '/contact': {
    title: 'Contact Formant | Start a Project Enquiry',
    description: 'Tell Formant what you are working towards and get guidance on the career preparation service that fits.',
    canonical: `${PRODUCTION_ORIGIN}/contact`,
    indexable: true
  }
};

const PRIVATE_OR_PLACEHOLDER_PATHS = new Set([
  '/privacy', '/terms', '/refund', '/login', '/signup', '/forgot-password',
  '/reset-password', '/auth/callback', '/assessment', '/dashboard', '/admin'
]);

function ensureMeta(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
}

function ensureLink(rel, href) {
  let element = document.head.querySelector(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement('link');
    element.rel = rel;
    document.head.appendChild(element);
  }
  element.href = href;
}

function ensureWebsiteStructuredData() {
  let element = document.head.querySelector('script[data-formant-seo="website"]');
  if (!element) {
    element = document.createElement('script');
    element.type = 'application/ld+json';
    element.dataset.formantSeo = 'website';
    document.head.appendChild(element);
  }
  element.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Formant',
    url: `${PRODUCTION_ORIGIN}/`
  });
}

export function applySeoMetadata(pathname, overrides = {}) {
  const normalizedPath = pathname.length > 1 && pathname.endsWith('/')
    ? pathname.slice(0, -1)
    : pathname;
  const page = { ...(PUBLIC_SEO_PAGES[normalizedPath] || {}), ...overrides };
  const indexable = page.indexable === true && !PRIVATE_OR_PLACEHOLDER_PATHS.has(normalizedPath);

  document.title = page.title || 'Formant';
  ensureMeta('meta[name="description"]', {
    name: 'description',
    content: page.description || 'Formant helps people prepare a clear, credible professional profile for their next opportunity.'
  });
  ensureMeta('meta[name="robots"]', {
    name: 'robots',
    content: indexable ? 'index,follow' : 'noindex,nofollow'
  });

  if (indexable) {
    ensureLink('canonical', page.canonical || `${PRODUCTION_ORIGIN}${normalizedPath}`);
    const image = `${PRODUCTION_ORIGIN}${BRAND_IMAGE}`;
    ensureMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' });
    ensureMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: 'Formant' });
    ensureMeta('meta[property="og:title"]', { property: 'og:title', content: page.title });
    ensureMeta('meta[property="og:description"]', { property: 'og:description', content: page.description });
    ensureMeta('meta[property="og:url"]', { property: 'og:url', content: page.canonical || `${PRODUCTION_ORIGIN}${normalizedPath}` });
    ensureMeta('meta[property="og:image"]', { property: 'og:image', content: image });
    ensureMeta('meta[property="og:image:alt"]', { property: 'og:image:alt', content: 'Formant wordmark' });
    ensureMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    ensureMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: page.title });
    ensureMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: page.description });
    ensureMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: image });
    if (normalizedPath === '/') ensureWebsiteStructuredData();
  } else {
    document.head.querySelector('link[rel="canonical"]')?.remove();
    document.head.querySelectorAll('[property^="og:"], [name^="twitter:"]').forEach((element) => element.remove());
    document.head.querySelector('script[data-formant-seo="website"]')?.remove();
  }

  return { ...page, indexable };
}

export function renderSeoTags(page) {
  const escape = (value) => String(value).replace(/[&"<>]/g, (character) => ({
    '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;'
  })[character]);
  const image = `${PRODUCTION_ORIGIN}${BRAND_IMAGE}`;
  const values = [
    `<title>${escape(page.title)}</title>`,
    `<meta name="description" content="${escape(page.description)}">`,
    `<meta name="robots" content="index,follow">`,
    `<link rel="canonical" href="${escape(page.canonical)}">`,
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="Formant">',
    `<meta property="og:title" content="${escape(page.title)}">`,
    `<meta property="og:description" content="${escape(page.description)}">`,
    `<meta property="og:url" content="${escape(page.canonical)}">`,
    `<meta property="og:image" content="${escape(image)}">`,
    '<meta property="og:image:alt" content="Formant wordmark">',
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escape(page.title)}">`,
    `<meta name="twitter:description" content="${escape(page.description)}">`,
    `<meta name="twitter:image" content="${escape(image)}">`,
    ...(page.canonical.endsWith('/') ? [`<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org', '@type': 'WebSite', name: 'Formant', url: `${PRODUCTION_ORIGIN}/`
    })}</script>`] : [])
  ];
  return values.join('\n    ');
}
