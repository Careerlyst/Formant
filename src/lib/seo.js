const envOrigin = typeof import.meta !== 'undefined' && import.meta.env?.VITE_SITE_URL
  ? import.meta.env.VITE_SITE_URL
  : (typeof process !== 'undefined' && process.env?.VITE_SITE_URL ? process.env.VITE_SITE_URL : '');

export const SITE_ORIGIN = (envOrigin || 'https://careerlyst-three.vercel.app').replace(/\/+$/, '');
export const BRAND_IMAGE = `${SITE_ORIGIN}/assets/formant-wordmark-1200.png`;

export const SEO_PAGES = {
  '/': {
    title: 'Formant — Executive Resume Writing & Tech Career Advisory',
    description: 'Present your experience for the role you want with executive CV writing, GitHub and portfolio curation, and mock interview preparation from Formant.'
  },
  '/services': {
    title: 'Career Services & Advisory Packages | Formant',
    description: 'Compare tailored career services for CVs, LinkedIn, GitHub profiles, portfolios, cover letters, and interview coaching. Clear deliverables and upfront pricing.'
  },
  '/showcase': {
    title: 'Work Showcase: Approved CV, Portfolio & Profile Samples | Formant',
    description: 'Browse real, approved samples of Formant-crafted CVs, developer portfolios, GitHub profiles, and cover letters across technology and business sectors.'
  },
  '/pricing': {
    title: 'Pricing & Career Service Packages | Formant',
    description: 'Transparent starting prices and package options for resumes ($19+), LinkedIn, GitHub profiles, and complete interview readiness bundles.'
  },
  '/about': {
    title: 'About Formant — Our Editorial Career Philosophy & Standards',
    description: 'Discover the Formant standard: editorial clarity, deliberate composition, and operational precision designed to help professionals present their best work.'
  },
  '/contact': {
    title: 'Contact Formant — Request a Project Consultation',
    description: 'Reach out to discuss your target role, request custom portfolio scoping, or ask questions about our career document and interview preparation services.'
  },
  '/services/resume': {
    title: 'CV & Executive Resume Writing Services | Formant',
    description: 'Transform your work history into an executive-ready CV or resume tailored to your target role. Editorial structure, ATS optimization, and direct human review.'
  },
  '/services/linkedin': {
    title: 'LinkedIn Profile Optimization & Positioning | Formant',
    description: 'Optimize your LinkedIn headline, About section, and experience narrative to attract recruiters and align with your next senior or technical role.'
  },
  '/services/github': {
    title: 'GitHub Profile & Repository Curation for Developers | Formant',
    description: 'Turn your GitHub into a compelling engineering portfolio. Curate pinned repositories, structure READMEs, and showcase architecture decisions clearly.'
  },
  '/services/portfolio': {
    title: 'Technical & Design Portfolio Architecture | Formant',
    description: 'Build an editorial portfolio case study structure that explains your technical decisions, product scope, and measurable business outcomes to hiring teams.'
  },
  '/services/cover': {
    title: 'Tailored Cover Letter Writing Services | Formant',
    description: 'Craft concise, opportunity-specific cover letters that directly connect your achievements to job requirements without generic corporate boilerplate.'
  },
  '/services/interview': {
    title: 'Mock Interview Preparation & Strategy Coaching | Formant',
    description: 'Master behavioral, technical, and executive interviews with 1-on-1 mock sessions, role-specific question frameworks, and actionable delivery feedback.'
  },
  '/privacy': {
    title: 'Privacy Policy | Formant',
    description: 'Learn how Formant collects, protects, and handles personal data, documents, and communication in accordance with global privacy standards.'
  },
  '/terms': {
    title: 'Terms of Service | Formant',
    description: 'Review the terms and conditions governing Formant career services, project deliverables, and client engagements.'
  },
  '/refund': {
    title: 'Refund & Cancellation Policy | Formant',
    description: 'Understand Formant’s service guarantees, cancellation guidelines, and refund policies for custom career projects.'
  }
};

export const NON_INDEXABLE_PATHS = new Set([
  '/privacy-policy',
  '/login', '/signup', '/forgot-password', '/reset-password', '/auth/callback',
  '/assessment', '/service-selection', '/dashboard', '/dashboard/profile',
  '/dashboard/orders', '/dashboard/messages', '/dashboard/files',
  '/dashboard/payments', '/dashboard/notifications', '/dashboard/settings',
  '/admin', '/admin/workspace', '/admin/users', '/admin/leads', '/admin/orders',
  '/admin/projects', '/admin/services', '/admin/showcase', '/admin/payments',
  '/admin/messages', '/admin/files', '/admin/reviews', '/admin/coupons',
  '/admin/notifications', '/admin/settings'
]);

const NON_INDEXABLE_TITLES = {
  '/privacy': 'Formant — Privacy Policy',
  '/privacy-policy': 'Formant — Privacy Policy',
  '/terms': 'Formant — Terms',
  '/refund': 'Formant — Refund',
  '/login': 'Formant — Login',
  '/signup': 'Formant — Sign Up',
  '/auth/callback': 'Formant — Verifying…',
  '/forgot-password': 'Formant — Forgot Password',
  '/reset-password': 'Formant — Reset Password',
  '/assessment': 'Formant — Assessment',
  '/service-selection': 'Formant — Choose Your Service',
  '/dashboard': 'Formant — Dashboard',
  '/dashboard/profile': 'Formant — Profile',
  '/dashboard/orders': 'Formant — Orders',
  '/dashboard/messages': 'Formant — Messages',
  '/dashboard/files': 'Formant — Files',
  '/dashboard/payments': 'Formant — Payments',
  '/dashboard/notifications': 'Formant — Notifications',
  '/dashboard/settings': 'Formant — Settings',
  '/admin': 'Formant — Admin',
  '/admin/workspace': 'Formant — Workspace',
  '/admin/users': 'Formant — Users',
  '/admin/leads': 'Formant — Leads',
  '/admin/orders': 'Formant — Orders',
  '/admin/projects': 'Formant — Projects',
  '/admin/services': 'Formant — Services',
  '/admin/showcase': 'Formant — Showcase Management',
  '/admin/payments': 'Formant — Payments',
  '/admin/messages': 'Formant — Messages',
  '/admin/files': 'Formant — Files',
  '/admin/reviews': 'Formant — Reviews',
  '/admin/coupons': 'Formant — Coupons',
  '/admin/notifications': 'Formant — Notifications',
  '/admin/settings': 'Formant — Settings'
};

export function normalizePath(pathname = '/') {
  if (!pathname || pathname === '/') return '/';
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

export function getSeoMetadata(pathname = '/') {
  const path = normalizePath(pathname);
  const metadata = SEO_PAGES[path];
  const isIndexable = Boolean(metadata) && !NON_INDEXABLE_PATHS.has(path);

  return {
    title: metadata?.title || NON_INDEXABLE_TITLES[path] || 'Formant | Career Preparation',
    description: metadata?.description || 'Career document and interview preparation services from Formant.',
    canonical: `${SITE_ORIGIN}${metadata?.canonicalPath || (path === '/privacy-policy' ? '/privacy' : path)}`,
    image: BRAND_IMAGE,
    indexable: isIndexable
  };
}

export function getStructuredData(pathname = '/') {
  const path = normalizePath(pathname);
  const metadata = SEO_PAGES[path];
  const url = `${SITE_ORIGIN}${path === '/' ? '' : path}`;

  if (path === '/') {
    return {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          '@id': `${SITE_ORIGIN}/#organization`,
          'name': 'Formant',
          'url': SITE_ORIGIN,
          'logo': `${SITE_ORIGIN}/assets/formant-symbol-180.png`,
          'description': 'Editorial career advisory, executive resume writing, portfolio architecture, and interview preparation.'
        },
        {
          '@type': 'WebSite',
          '@id': `${SITE_ORIGIN}/#website`,
          'url': SITE_ORIGIN,
          'name': 'Formant',
          'publisher': { '@id': `${SITE_ORIGIN}/#organization` },
          'description': metadata?.description || 'Career documents and interview preparation.'
        }
      ]
    };
  }

  if (path.startsWith('/services/') && metadata) {
    const serviceName = metadata.title.split('|')[0].trim();
    return {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BreadcrumbList',
          'itemListElement': [
            { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': `${SITE_ORIGIN}/` },
            { '@type': 'ListItem', 'position': 2, 'name': 'Services', 'item': `${SITE_ORIGIN}/services` },
            { '@type': 'ListItem', 'position': 3, 'name': serviceName, 'item': url }
          ]
        },
        {
          '@type': 'Service',
          '@id': `${url}#service`,
          'name': serviceName,
          'url': url,
          'description': metadata.description,
          'provider': {
            '@type': 'Organization',
            'name': 'Formant',
            'url': SITE_ORIGIN
          }
        }
      ]
    };
  }

  if (metadata) {
    const pageName = metadata.title.split('|')[0].trim();
    return {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BreadcrumbList',
          'itemListElement': [
            { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': `${SITE_ORIGIN}/` },
            { '@type': 'ListItem', 'position': 2, 'name': pageName, 'item': url }
          ]
        },
        {
          '@type': 'WebPage',
          '@id': `${url}#webpage`,
          'url': url,
          'name': metadata.title,
          'description': metadata.description,
          'isPartOf': { '@id': `${SITE_ORIGIN}/#website` }
        }
      ]
    };
  }

  return null;
}

function setMeta(selector, attribute, value) {
  const element = document.querySelector(selector);
  if (element) element.setAttribute(attribute, value);
}

export function applySeoMetadata(pathname = '/', overrides = {}) {
  const metadata = { ...getSeoMetadata(pathname), ...overrides };
  document.title = metadata.title;
  document.documentElement.lang = 'en';
  setMeta('meta[name="description"]', 'content', metadata.description);
  setMeta('meta[name="robots"]', 'content', metadata.indexable ? 'index,follow' : 'noindex,nofollow');
  setMeta('link[rel="canonical"]', 'href', metadata.canonical);
  setMeta('meta[property="og:title"]', 'content', metadata.title);
  setMeta('meta[property="og:description"]', 'content', metadata.description);
  setMeta('meta[property="og:url"]', 'content', metadata.canonical);
  setMeta('meta[property="og:image"]', 'content', metadata.image);
  setMeta('meta[property="og:image:alt"]', 'content', 'Formant career preparation');
  setMeta('meta[name="twitter:title"]', 'content', metadata.title);
  setMeta('meta[name="twitter:description"]', 'content', metadata.description);
  setMeta('meta[name="twitter:image"]', 'content', metadata.image);

  const structuredData = getStructuredData(pathname);
  if (structuredData) {
    let scriptTag = document.getElementById('seo-structured-data');
    if (!scriptTag) {
      scriptTag = document.createElement('script');
      scriptTag.id = 'seo-structured-data';
      scriptTag.type = 'application/ld+json';
      document.head.appendChild(scriptTag);
    }
    scriptTag.textContent = JSON.stringify(structuredData);
  }

  return metadata;
}

