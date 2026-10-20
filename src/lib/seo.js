export const SITE_ORIGIN = 'https://careerlyst-three.vercel.app';
export const BRAND_IMAGE = `${SITE_ORIGIN}/assets/formant-wordmark-1200.png`;

export const SEO_PAGES = {
  '/': {
    title: 'Formant | Career documents and interview preparation',
    description: 'Build a clearer path to your next role with focused CV and resume writing, LinkedIn and GitHub profile support, portfolios, cover letters, and interview preparation.'
  },
  '/services': {
    title: 'Career Services | Formant',
    description: 'Explore Formant services for CVs and resumes, LinkedIn and GitHub profiles, portfolios, cover letters, and interview preparation.'
  },
  '/showcase': {
    title: 'Career Document and Profile Examples | Formant Showcase',
    description: 'Browse approved Formant examples across CVs, resumes, portfolios, LinkedIn and GitHub profiles, and cover letters.'
  },
  '/pricing': {
    title: 'Service Pricing | Formant',
    description: 'Review available Formant career-support services and their current package options.'
  },
  '/about': {
    title: 'About Formant | Career Preparation',
    description: 'Learn about Formant’s focused approach to career documents, professional profiles, portfolios, and interview preparation.'
  },
  '/contact': {
    title: 'Contact Formant | Career Support',
    description: 'Contact Formant with questions about CV and resume support, professional profiles, portfolios, cover letters, or interview preparation.'
  },
  '/services/resume': {
    title: 'CV and Resume Writing | Formant',
    description: 'Get focused CV and resume support designed to present relevant experience clearly and improve readability.'
  },
  '/services/linkedin': {
    title: 'LinkedIn Profile Support | Formant',
    description: 'Refine your LinkedIn headline, profile story, and target-role positioning with Formant.'
  },
  '/services/github': {
    title: 'GitHub Profile Support | Formant',
    description: 'Make your GitHub profile and projects easier to understand with focused presentation and structure.'
  },
  '/services/portfolio': {
    title: 'Portfolio Support | Formant',
    description: 'Present your work with a clear portfolio structure that helps visitors understand your projects.'
  },
  '/services/cover': {
    title: 'Cover Letter Support | Formant',
    description: 'Prepare a concise, opportunity-specific cover letter with Formant.'
  },
  '/services/interview': {
    title: 'Interview Preparation | Formant',
    description: 'Prepare for the role ahead with focused interview practice and feedback.'
  }
};

export const NON_INDEXABLE_PATHS = new Set([
  '/privacy', '/privacy-policy', '/terms', '/refund',
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
  return metadata;
}
