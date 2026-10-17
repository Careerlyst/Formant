export const SHOWCASE_TABS = [
  { id: 'cv-demo', category: 'cv_demo', label: 'CV Demo' },
  { id: 'resume-demo', category: 'resume_demo', label: 'Resume Demo' },
  { id: 'portfolio-website-demo', category: 'portfolio_website_demo', label: 'Portfolio Website Demo' },
  { id: 'linkedin-before-after', category: 'linkedin_before_after', label: 'LinkedIn Before & After' },
  { id: 'github-before-after', category: 'github_before_after', label: 'GitHub Before & After' },
  { id: 'cover-letter-demo', category: 'cover_letter_demo', label: 'Cover Letter Demo' }
];

export const SHOWCASE_MEDIA_PRESENTATIONS = {
  cv_demo: [
    { value: 'document_before', label: 'Before document' },
    { value: 'document_after', label: 'After document' },
    { value: 'document', label: 'Document page' },
    { value: 'before', label: 'Before image preview' },
    { value: 'after', label: 'After image preview' },
    { value: 'gallery', label: 'Additional image' },
    { value: 'thumbnail', label: 'Cover image' }
  ],
  resume_demo: [
    { value: 'document_before', label: 'Before document' },
    { value: 'document_after', label: 'After document' },
    { value: 'document', label: 'Document page' },
    { value: 'before', label: 'Before image preview' },
    { value: 'after', label: 'After image preview' },
    { value: 'gallery', label: 'Additional image' },
    { value: 'thumbnail', label: 'Cover image' }
  ],
  portfolio_website_demo: [
    { value: 'desktop', label: 'Desktop screenshot' },
    { value: 'mobile', label: 'Mobile screenshot' },
    { value: 'before', label: 'Before screenshot' },
    { value: 'after', label: 'After screenshot' },
    { value: 'gallery', label: 'Additional screenshot' }
  ],
  linkedin_before_after: [
    { value: 'before', label: 'Before profile screenshot' },
    { value: 'after', label: 'After profile screenshot' },
    { value: 'gallery', label: 'Profile section screenshot' }
  ],
  github_before_after: [
    { value: 'before', label: 'Before profile screenshot' },
    { value: 'after', label: 'After profile screenshot' },
    { value: 'gallery', label: 'README or repository screenshot' }
  ],
  cover_letter_demo: [
    { value: 'document_before', label: 'Before document' },
    { value: 'document_after', label: 'After document' },
    { value: 'document', label: 'Document page' },
    { value: 'before', label: 'Before image preview' },
    { value: 'after', label: 'After image preview' },
    { value: 'gallery', label: 'Additional image' },
    { value: 'thumbnail', label: 'Cover image' }
  ]
};

export const SHOWCASE_DOCUMENT_PRESENTATIONS = ['document_before', 'document_after', 'document'];

export function safeShowcaseUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

export function showcaseTabForService(serviceName, packageName = '') {
  const value = `${serviceName || ''} ${packageName || ''}`.toLowerCase();
  if (value.includes('linkedin')) return 'linkedin-before-after';
  if (value.includes('github')) return 'github-before-after';
  if (value.includes('portfolio')) return 'portfolio-website-demo';
  if (value.includes('cover')) return 'cover-letter-demo';
  if (/\bcv\b/.test(value) && !value.includes('resume')) return 'cv-demo';
  if (value.includes('resume')) return 'resume-demo';
  return null;
}

export function showcaseImageEndpoint(imageId) {
  const base = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  return base && imageId
    ? `${base}/functions/v1/showcase-image?imageId=${encodeURIComponent(imageId)}`
    : '';
}

export function showcaseDownloadEndpoint(mediaId) {
  const endpoint = showcaseImageEndpoint(mediaId);
  return endpoint ? `${endpoint}&download=1` : '';
}

export function projectTypeLabel(type) {
  return type === 'client_work' ? 'Client Work' : 'Sample Project';
}

export function categoryLabel(category) {
  return SHOWCASE_TABS.find((tab) => tab.category === category)?.label || 'Showcase';
}

export function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
}
