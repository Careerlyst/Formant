import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Footer from '../components/Footer';
import PublicNav from '../components/PublicNav';
import SkeletonState from '../components/SkeletonState';
import { supabase } from '../lib/supabase';
import { classifyRequestFailure } from '../lib/requestFailure';
import { RequestProblem } from '../components/ErrorExperience';
import { SHOWCASE_TABS, categoryLabel, projectTypeLabel, safeShowcaseUrl, showcaseDownloadEndpoint, showcaseImageEndpoint } from '../lib/showcase';
import './showcase.css';

const PUBLIC_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const SHOWCASE_REQUEST_TIMEOUT_MS = 20000;
const publicImageRequests = new Map();

function withTimeout(promise, timeoutMs, message, onTimeout) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      onTimeout?.();
      reject(new Error(message));
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => window.clearTimeout(timeoutId));
}

function subscribeToPublicImageRequest(imageId, endpoint) {
  let request = publicImageRequests.get(imageId);
  if (!request) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    request = { controller, timeout, subscribers: 0, settled: false, promise: null };
    request.promise = fetch(endpoint, {
      headers: { apikey: PUBLIC_KEY },
      signal: controller.signal
    }).then((response) => {
      if (!response.ok) throw new Error(`Showcase image request returned ${response.status}`);
      return response.blob();
    }).finally(() => {
      request.settled = true;
      window.clearTimeout(request.timeout);
      if (publicImageRequests.get(imageId) === request) publicImageRequests.delete(imageId);
    });
    // The shared request may be cancelled after its final subscriber unmounts.
    request.promise.catch(() => {});
    publicImageRequests.set(imageId, request);
  }
  request.subscribers += 1;
  let released = false;
  return {
    promise: request.promise,
    release() {
      if (released) return;
      released = true;
      request.subscribers = Math.max(0, request.subscribers - 1);
      if (!request.subscribers && !request.settled) {
        if (publicImageRequests.get(imageId) === request) publicImageRequests.delete(imageId);
        window.clearTimeout(request.timeout);
        request.controller.abort();
      }
    }
  };
}

async function createDecodedObjectUrl(blob) {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const decoder = new window.Image();
    decoder.src = objectUrl;
    if (typeof decoder.decode === 'function') {
      await decoder.decode();
    } else {
      await new Promise((resolve, reject) => {
        decoder.onload = resolve;
        decoder.onerror = () => reject(new Error('Showcase preview could not be decoded.'));
      });
    }
    return objectUrl;
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

function createPdfThumbnailScheduler(concurrency = 2) {
  const queued = [];
  const active = new Set();
  let sequence = 0;
  let disposed = false;

  const pump = () => {
    while (!disposed && active.size < concurrency && queued.length) {
      queued.sort((a, b) => a.priority - b.priority || a.sequence - b.sequence);
      const job = queued.shift();
      if (job.cancelled) continue;
      active.add(job);
      Promise.resolve()
        .then(() => job.render(() => job.cancelled, (cancel) => { job.cancelRender = cancel; }))
        .catch(() => {})
        .finally(() => {
          active.delete(job);
          pump();
        });
    }
  };

  return {
    enqueue(key, priority, render) {
      if (disposed) return () => {};
      const job = { key, priority, render, sequence: sequence++, cancelled: false, cancelRender: null };
      queued.push(job);
      pump();
      return () => {
        job.cancelled = true;
        const index = queued.indexOf(job);
        if (index >= 0) queued.splice(index, 1);
        job.cancelRender?.();
      };
    },
    dispose() {
      disposed = true;
      queued.splice(0).forEach((job) => { job.cancelled = true; });
      active.forEach((job) => {
        job.cancelled = true;
        job.cancelRender?.();
      });
    }
  };
}

function publishedShowcaseRequest(featuredOnly, signal) {
  return supabase.rpc('list_published_showcase_v1', {
    p_service_category: null,
    p_featured_only: featuredOnly
  }).abortSignal(signal);
}

function loadedPreviewSource(container, imageId) {
  if (!container || !imageId) return '';
  const image = Array.from(container.querySelectorAll('img[data-showcase-image-id]'))
    .find((candidate) => candidate.dataset.showcaseImageId === imageId);
  return image?.complete && image.naturalWidth > 0 && image.src.startsWith('blob:') ? image.src : '';
}

const SHOWCASE_CATEGORY_COPY = {
  cv_demo: {
    eyebrow: 'CV',
    heading: 'CV Examples',
    description: 'Explore CV examples and the choices behind a clear, focused presentation.'
  },
  resume_demo: {
    eyebrow: 'RESUME',
    heading: 'Resume Examples',
    description: 'See resume examples organized around readable structure and relevant experience.'
  },
  portfolio_website_demo: {
    eyebrow: 'PORTFOLIO',
    heading: 'Portfolio Websites',
    description: 'Browse portfolio website examples that bring professional work into view.'
  },
  linkedin_before_after: {
    eyebrow: 'LINKEDIN',
    heading: 'Profile Before & After',
    description: 'Compare LinkedIn profile presentations before and after a considered rewrite.'
  },
  github_before_after: {
    eyebrow: 'GITHUB',
    heading: 'Profile Before & After',
    description: 'Compare GitHub profile presentations before and after a clearer story.'
  },
  cover_letter_demo: {
    eyebrow: 'COVER LETTER',
    heading: 'Cover Letter Examples',
    description: 'Explore cover letter examples tailored to a role and its requirements.'
  }
};

const SHOWCASE_FILTERS = [
  { id: 'all', label: 'All', categories: null, heading: 'Selected work and sample projects', eyebrow: 'WORK SHOWCASE', description: 'Browse published client work and sample projects across CVs, portfolios and professional profiles.' },
  { id: 'cv', label: 'CV', categories: ['cv_demo', 'resume_demo'], heading: 'CV examples', eyebrow: 'WORK SHOWCASE', description: 'Browse CV projects and sample layouts.' },
  { id: 'cover-letter', label: 'Cover Letter', categories: ['cover_letter_demo'], heading: 'Cover Letter Examples', eyebrow: 'COVER LETTER', description: SHOWCASE_CATEGORY_COPY.cover_letter_demo.description },
  { id: 'linkedin', label: 'LinkedIn', categories: ['linkedin_before_after'], heading: 'LinkedIn Examples', eyebrow: 'LINKEDIN', description: SHOWCASE_CATEGORY_COPY.linkedin_before_after.description },
  { id: 'portfolio', label: 'Portfolio Website', categories: ['portfolio_website_demo'], heading: 'Portfolio Website Examples', eyebrow: 'PORTFOLIO', description: SHOWCASE_CATEGORY_COPY.portfolio_website_demo.description },
  { id: 'github', label: 'GitHub', categories: ['github_before_after'], heading: 'GitHub Examples', eyebrow: 'GITHUB', description: SHOWCASE_CATEGORY_COPY.github_before_after.description }
];

const LEGACY_TAB_FILTERS = {
  'cv-demo': 'cv',
  'resume-demo': 'cv',
  'cover-letter-demo': 'cover-letter',
  'linkedin-before-after': 'linkedin',
  'portfolio-website-demo': 'portfolio',
  'github-before-after': 'github'
};

export function ShowcaseImage({ image, className = '', eager = false, authorized = false, initialSrc = '', onRetry, onFailure, onImageReady, retryToken = 0, onImageLoad, resourceStyle, altText }) {
  const resourceRef = useRef(null);
  const [src, setSrc] = useState(initialSrc);
  const [status, setStatus] = useState(initialSrc ? 'ready' : 'idle');
  const [shouldLoad, setShouldLoad] = useState(Boolean(eager));

  useEffect(() => {
    if (eager) {
      setShouldLoad(true);
      return undefined;
    }
    const node = resourceRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setShouldLoad(true);
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setShouldLoad(true);
        observer.disconnect();
      }
    }, { rootMargin: '240px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [eager, image?.id]);

  useEffect(() => {
    if (!shouldLoad) return undefined;
    let active = true;
    let objectUrl = '';
    let sharedRequest = null;
    if (initialSrc && !authorized) {
      setSrc(initialSrc);
      setStatus('ready');
      onImageReady?.();
      return undefined;
    }
    const controller = new AbortController();
    const timeout = authorized ? window.setTimeout(() => controller.abort(), 15000) : null;
    const endpoint = showcaseImageEndpoint(image?.id);
    if (!endpoint || !PUBLIC_KEY) {
      setStatus('error');
      onFailure?.();
      return () => { if (timeout) window.clearTimeout(timeout); };
    }
    setSrc('');
    setStatus('loading');
    const loadImage = async () => {
      const headers = { apikey: PUBLIC_KEY };
      if (authorized) {
        const { data } = await supabase?.auth.getSession() || {};
        const token = data?.session?.access_token;
        if (!token) throw new Error('Staff session is required to preview draft media.');
        headers.Authorization = `Bearer ${token}`;
        const response = await fetch(endpoint, { headers, signal: controller.signal });
        if (!response.ok) throw new Error(`Showcase image request returned ${response.status}`);
        return response.blob();
      }
      sharedRequest = subscribeToPublicImageRequest(image.id, endpoint);
      return sharedRequest.promise;
    };
    loadImage()
      .then(async (blob) => {
        if (!active) return;
        objectUrl = await createDecodedObjectUrl(blob);
        if (!active) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        onImageReady?.();
        setSrc(objectUrl);
        setStatus('ready');
      })
      .catch(() => {
        if (active) {
          setStatus('error');
          onFailure?.();
        }
      });
    return () => {
      active = false;
      controller.abort();
      if (timeout) window.clearTimeout(timeout);
      sharedRequest?.release();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [image?.id, authorized, initialSrc, shouldLoad, retryToken]);

  const imageAlt = altText !== undefined ? altText : (image?.alt_text || 'Showcase project image');
  const imageElement = status === 'ready' && src
    ? <img className={className} src={src} data-showcase-image-id={image?.id} alt={imageAlt} decoding="async" draggable={authorized ? undefined : false} onContextMenu={authorized ? undefined : (event) => event.preventDefault()} onLoad={(event) => onImageLoad?.({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} onError={() => { if (src.startsWith('blob:')) URL.revokeObjectURL(src); setSrc(''); setStatus('error'); onFailure?.(); }} />
    : status === 'error'
      ? <span className="showcase-image-fallback" role="status" aria-live="polite"><span>{imageAlt || 'Project'} preview unavailable.</span>{onRetry && <button type="button" className="showcase-preview-retry" onClick={onRetry}>Try again</button>}</span>
      : status === 'idle'
        ? <span className="showcase-image-loading is-deferred" aria-hidden="true" />
        : <span className="showcase-image-loading" role="status" aria-live="polite">Loading preview…</span>;
  const content = !authorized && status === 'ready'
    ? <span className="showcase-protected-image">{imageElement}</span>
    : imageElement;
  return <span ref={resourceRef} className="showcase-image-resource" style={resourceStyle}>{content}</span>;
}

export function ShowcaseDocument({ image, authorized = false, downloadEnabled = false }) {
  const [src, setSrc] = useState('');
  const [status, setStatus] = useState(authorized ? 'loading' : 'private');
  const [loadError, setLoadError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [downloadError, setDownloadError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const downloadControllerRef = useRef(null);
  useEffect(() => {
    let active = true;
    let objectUrl = '';
    const controller = new AbortController();
    const endpoint = showcaseImageEndpoint(image?.id);
    if (!authorized) {
      setSrc('');
      setStatus('private');
      return () => { active = false; controller.abort(); };
    }
    if (!endpoint || !PUBLIC_KEY) {
      setSrc('');
      setStatus('error');
      setLoadError('The authorized document service is not configured.');
      return () => { active = false; controller.abort(); };
    }
    setSrc('');
    setStatus('loading');
    setLoadError('');
    setDownloading(false);
    setDownloadError('');
    const loadDocument = async () => withTimeout((async () => {
      const headers = { apikey: PUBLIC_KEY };
      const { data, error } = await supabase?.auth.getSession() || {};
      if (error) throw new Error('The staff session could not be checked. Sign in again and retry.');
      const token = data?.session?.access_token;
      if (!token) throw new Error('A staff session is required to preview this private document. Sign in again and retry.');
      headers.Authorization = `Bearer ${token}`;
      const response = await fetch(endpoint, { headers, signal: controller.signal });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) throw new Error('Your staff session cannot access this document. Sign in again or ask an administrator to check access.');
        if (response.status === 404) throw new Error('The original PDF is not available from the document service.');
        throw new Error(`The document service returned HTTP ${response.status}. Retry, or ask an administrator if the problem continues.`);
      }
      return response.blob();
    })(), SHOWCASE_REQUEST_TIMEOUT_MS, 'The PDF request timed out. Retry loading the document.', () => controller.abort());
    loadDocument().then((blob) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setSrc(objectUrl);
      setStatus('ready');
    }).catch((error) => {
      if (!active) return;
      setLoadError(controller.signal.aborted ? 'The PDF request timed out or was cancelled. Retry loading the document.' : error?.message || 'The PDF could not be loaded. Retry the request.');
      setStatus('error');
    });
    return () => {
      active = false;
      controller.abort();
      downloadControllerRef.current?.abort();
      downloadControllerRef.current = null;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [image?.id, authorized, retryCount]);

  if (!authorized) return <div className="showcase-document-fallback" role="status">Original documents are kept private. Approved preview images will appear here when available.</div>;
  if (status === 'error') return <div className="showcase-document-fallback is-error" role="alert"><span>{loadError}</span><button type="button" onClick={() => setRetryCount((count) => count + 1)}>Retry PDF loading</button></div>;
  if (status !== 'ready' || !src) return <div className="showcase-document-fallback" role="status" aria-live="polite">Loading authorized PDF…</div>;
  const downloadFile = async () => {
    const controller = new AbortController();
    downloadControllerRef.current?.abort();
    downloadControllerRef.current = controller;
    setDownloading(true);
    setDownloadError('');
    try {
      const blob = await withTimeout((async () => {
        const { data, error } = await supabase?.auth.getSession() || {};
        if (error || !data?.session?.access_token) throw new Error('A staff session is required. Sign in again and retry.');
        const response = await fetch(showcaseDownloadEndpoint(image?.id), {
          headers: { apikey: PUBLIC_KEY, Authorization: `Bearer ${data.session.access_token}` },
          signal: controller.signal
        });
        if (!response.ok) throw new Error(response.status === 403 ? 'The explicit download action is not enabled for this document.' : `The document could not be downloaded (HTTP ${response.status}).`);
        return response.blob();
      })(), SHOWCASE_REQUEST_TIMEOUT_MS, 'The PDF download timed out. Retry the download.', () => controller.abort());
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${(image?.alt_text || 'formant-document').replace(/[^a-z0-9-_]+/gi, '-').slice(0, 80)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (error) {
      if (downloadControllerRef.current === controller) {
        setDownloadError(controller.signal.aborted ? 'The PDF download timed out or was cancelled. Retry the download.' : error?.message || 'The document could not be downloaded.');
      }
    } finally {
      if (downloadControllerRef.current === controller) {
        downloadControllerRef.current = null;
        setDownloading(false);
      }
    }
  };
  return <div className="showcase-document-preview"><iframe title={image?.caption || image?.alt_text || 'Showcase document preview'} src={src} loading="eager" />{authorized && downloadEnabled && <button className="showcase-document-download" type="button" onClick={downloadFile} disabled={downloading}>{downloading ? 'Preparing PDF…' : 'Download original PDF'}</button>}<a href={src} target="_blank" rel="noopener noreferrer">Open document in a new tab ↗</a>{downloadError && <p role="alert">{downloadError}</p>}</div>;
}

function PdfThumbnailItem({ pdf, pageNumber, activePageNumber, isSelected, rotation, sidebarOpen, scrollRootRef, scheduler, onSelect }) {
  const canvasRef = useRef(null);
  const itemRef = useRef(null);
  const [rendered, setRendered] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(0.707);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!sidebarOpen) {
      setIsVisible(false);
      return undefined;
    }
    const item = itemRef.current;
    if (!item || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver((entries) => {
      setIsVisible(entries.some((entry) => entry.isIntersecting));
    }, { root: scrollRootRef.current, rootMargin: '120px 0px' });
    observer.observe(item);
    return () => observer.disconnect();
  }, [sidebarOpen, scrollRootRef]);

  useEffect(() => {
    if (isSelected && itemRef.current) {
      itemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      });
    }
  }, [isSelected]);

  const distanceFromActivePage = Math.abs(pageNumber - activePageNumber);
  const isNearActivePage = distanceFromActivePage <= 2;
  const shouldRender = sidebarOpen && (isVisible || isSelected || isNearActivePage);
  const renderPriority = isSelected ? 0 : isNearActivePage ? distanceFromActivePage + 1 : 10;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!shouldRender || !pdf || !canvas || !scheduler) {
      setRendered(false);
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
        canvas.style.width = '';
        canvas.style.height = '';
      }
      return undefined;
    }
    let active = true;
    let renderTask = null;
    setRendered(false);
    const cancelQueuedJob = scheduler.enqueue(`${pageNumber}:${rotation}`, renderPriority, async (isCancelled, setCancelRender) => {
      try {
        const page = await pdf.getPage(pageNumber);
        if (!active || isCancelled()) return;
        const totalRotation = ((page.rotate || 0) + rotation) % 360;
        const unscaledViewport = page.getViewport({ scale: 1, rotation: totalRotation });
        setAspectRatio(unscaledViewport.width / unscaledViewport.height);

        const targetWidth = 84;
        const scale = targetWidth / unscaledViewport.width;
        const viewport = page.getViewport({ scale, rotation: totalRotation });
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

        if (!active || isCancelled() || !canvasRef.current) return;
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) return;

        canvas.width = Math.ceil(viewport.width * dpr);
        canvas.height = Math.ceil(viewport.height * dpr);
        canvas.style.width = `${Math.ceil(viewport.width)}px`;
        canvas.style.height = `${Math.ceil(viewport.height)}px`;

        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, viewport.width, viewport.height);

        renderTask = page.render({ canvasContext: context, viewport });
        setCancelRender(() => renderTask?.cancel());
        await renderTask.promise;
        if (active && !isCancelled()) setRendered(true);
      } catch {
        // Keep the placeholder visible when a thumbnail cannot be rendered.
      }
    });

    return () => {
      active = false;
      cancelQueuedJob();
      renderTask?.cancel();
      canvas.width = 0;
      canvas.height = 0;
      canvas.style.width = '';
      canvas.style.height = '';
    };
  }, [pdf, pageNumber, rotation, shouldRender, renderPriority, scheduler]);

  return (
    <button
      ref={itemRef}
      type="button"
      className={`showcase-pdf-thumb-item ${isSelected ? 'is-selected' : ''}`}
      onClick={onSelect}
      aria-label={`Go to page ${pageNumber}`}
      aria-current={isSelected ? 'page' : undefined}
    >
      <div className="showcase-pdf-thumb-wrapper" style={{ aspectRatio: `${aspectRatio}` }}>
        <canvas ref={canvasRef} className={`showcase-pdf-thumb-canvas ${rendered ? 'is-ready' : 'is-loading'}`} />
        {!rendered && <div className="showcase-pdf-thumb-placeholder" aria-hidden="true" />}
      </div>
      <span className="showcase-pdf-thumb-num">{pageNumber}</span>
    </button>
  );
}

function PdfReaderIcon({ name }) {
  const shared = {
    className: 'showcase-pdf-icon',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    focusable: false
  };

  const shapes = {
    thumbnailsHide: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M14 8h4M14 12h4M14 16h4M6.5 9.5 4.5 12l2 2.5" /></>,
    thumbnailsShow: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M13 8h5M13 12h5M13 16h5M5 9.5 7 12l-2 2.5" /></>,
    zoomOut: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5M8 10.8h5.6" /></>,
    zoomIn: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5M8 10.8h5.6M10.8 8v5.6" /></>,
    fitWidth: <><path d="M4 5h16v14H4zM2 12h4m-2-2-2 2 2 2m18-2h-4m2-2 2 2-2 2" /></>,
    fitPage: <><rect x="6" y="3" width="12" height="18" rx="1.5" /><path d="M3 8V5a2 2 0 0 1 2-2h3m8 0h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3" /></>,
    previous: <path d="m15 5-7 7 7 7" />,
    next: <path d="m9 5 7 7-7 7" />,
    rotate: <><path d="M20 11a8 8 0 0 0-14.5-4L4 9" /><path d="M4 4v5h5M4 13a8 8 0 0 0 14.5 4L20 15" /><path d="M20 20v-5h-5" /></>,
    fullscreen: <path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3" />,
    fullscreenExit: <path d="M9 3v4a2 2 0 0 1-2 2H3m18 0h-4a2 2 0 0 1-2-2V3M3 15h4a2 2 0 0 1 2 2v4m12-6h-4a2 2 0 0 0-2 2v4" />,
    close: <path d="m6 6 12 12M18 6 6 18" />
  };

  return <svg {...shared}>{shapes[name] || shapes.close}</svg>;
}

function ShowcasePdfReader({ image, title, category, authorized = false, onClose, closeRef, viewerRef, onToggleFullscreen }) {
  const containerRef = useRef(null);
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const loadingTaskRef = useRef(null);
  const renderTaskRef = useRef(null);
  const scaleRef = useRef(1);
  const fitModeRef = useRef('width');
  const manualBaseModeRef = useRef('width');
  const zoomAnchorRef = useRef(null);
  const wheelLineRemainderRef = useRef(0);
  const pointerInsideStageRef = useRef(false);
  const spacePanActiveRef = useRef(false);
  const panDragRef = useRef(null);
  const thumbnailsScrollRef = useRef(null);
  const [pdf, setPdf] = useState(null);
  const thumbnailScheduler = useMemo(() => createPdfThumbnailScheduler(2), [pdf]);
  const [loadStatus, setLoadStatus] = useState(authorized ? 'loading' : 'private');
  const [loadError, setLoadError] = useState('');
  const [renderError, setRenderError] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1);
  const [fitMode, setFitMode] = useState('width');
  const [manualBaseMode, setManualBaseMode] = useState('width');
  const [rotation, setRotation] = useState(0);
  const [showSidebar, setShowSidebar] = useState(() => (typeof window !== 'undefined' ? window.innerWidth > 768 : true));
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [renderStatus, setRenderStatus] = useState('idle');
  const [retryCount, setRetryCount] = useState(0);
  const [spacePanActive, setSpacePanActive] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [isFullscreenActive, setIsFullscreenActive] = useState(false);

  useEffect(() => () => thumbnailScheduler.dispose(), [thumbnailScheduler]);

  const handleThumbnailSelect = useCallback((num) => {
    setPageNumber(num);
    if (typeof window !== 'undefined' && window.innerWidth <= 640) {
      setShowSidebar(false);
    }
  }, []);

  const updateScale = useCallback((nextScale) => {
    const next = typeof nextScale === 'function' ? nextScale(scaleRef.current) : nextScale;
    scaleRef.current = next;
    setScale(next);
  }, []);

  const stopPan = useCallback((updateState = true) => {
    const drag = panDragRef.current;
    panDragRef.current = null;
    if (updateState) setIsPanning(false);
    if (drag) {
      const stage = stageRef.current;
      try {
        if (stage?.hasPointerCapture(drag.pointerId)) stage.releasePointerCapture(drag.pointerId);
      } catch { /* The pointer may already have been released by the browser. */ }
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (onToggleFullscreen) {
      onToggleFullscreen();
      return;
    }
    const target = viewerRef?.current || containerRef.current;
    if (!target) return;
    if (!document.fullscreenElement) {
      try {
        if (target.requestFullscreen) {
          await target.requestFullscreen();
        }
      } catch {
        setIsFullscreenActive(document.fullscreenElement === target);
      }
    } else {
      try {
        if (document.exitFullscreen) await document.exitFullscreen();
      } catch {
        setIsFullscreenActive(document.fullscreenElement === target);
      }
    }
  }, [onToggleFullscreen, viewerRef]);

  const exitFullscreen = useCallback(async () => {
    const target = viewerRef?.current || containerRef.current;
    if (document.fullscreenElement && document.exitFullscreen) {
      try {
        await document.exitFullscreen();
      } catch {
        setIsFullscreenActive(document.fullscreenElement === target);
      }
    }
  }, [viewerRef]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const target = viewerRef?.current || containerRef.current;
      setIsFullscreenActive(Boolean(target && document.fullscreenElement === target));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [viewerRef]);

  useEffect(() => {
    let active = true;
    let loadingTask = null;
    const controller = new AbortController();
    setPdf(null);
    setPageNumber(1);
    setRotation(0);
    scaleRef.current = 1;
    updateScale(1);
    fitModeRef.current = 'width';
    setFitMode('width');
    manualBaseModeRef.current = 'width';
    setManualBaseMode('width');
    setLoadError('');
    setRenderError('');

    if (!authorized) {
      setLoadStatus('private');
      return () => controller.abort();
    }
    if (!image?.id || !PUBLIC_KEY || !showcaseImageEndpoint(image.id)) {
      setLoadStatus('unavailable');
      setLoadError('The authorized document service is not available for this PDF.');
      return () => controller.abort();
    }

    setLoadStatus('loading');
    const loadPdf = async () => {
      try {
        const bytes = await withTimeout((async () => {
          const { data, error } = await supabase?.auth.getSession() || {};
          if (error) throw new Error('The staff session could not be checked. Sign in again and retry.');
          const token = data?.session?.access_token;
          if (!token) throw new Error('A staff session is required to view this private PDF. Sign in again and retry.');
          const response = await fetch(showcaseImageEndpoint(image.id), {
            headers: { apikey: PUBLIC_KEY, Authorization: `Bearer ${token}` },
            signal: controller.signal
          });
          if (!response.ok) {
            if (response.status === 401 || response.status === 403) throw new Error('Your staff session cannot access this PDF. Sign in again or ask an administrator to check access.');
            if (response.status === 404) throw new Error('The original PDF is not available from the document service.');
            throw new Error(`The document service returned HTTP ${response.status}. Retry, or ask an administrator if the problem continues.`);
          }
          return new Uint8Array(await response.arrayBuffer());
        })(), SHOWCASE_REQUEST_TIMEOUT_MS, 'The PDF request timed out. Retry loading the document.', () => controller.abort());

        if (!active) return;
        const pdfjsLib = await import('pdfjs-dist');
        if (!active) return;
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
        loadingTask = pdfjsLib.getDocument({ data: bytes });
        loadingTaskRef.current = loadingTask;
        const loadedPdf = await withTimeout(
          loadingTask.promise,
          SHOWCASE_REQUEST_TIMEOUT_MS,
          'The PDF could not be opened in time. Retry loading the document.',
          () => { void loadingTask?.destroy().catch(() => {}); }
        );
        if (!active) {
          await loadedPdf.destroy();
          return;
        }
        setPdf(loadedPdf);
        setLoadStatus('ready');
      } catch (error) {
        if (!active) return;
        setLoadError(controller.signal.aborted ? 'The PDF request timed out or was cancelled. Retry loading the document.' : error?.message || 'The PDF could not be opened. Retry loading the document.');
        setLoadStatus('error');
      }
    };
    void loadPdf();

    return () => {
      active = false;
      controller.abort();
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
      const task = loadingTaskRef.current || loadingTask;
      loadingTaskRef.current = null;
      if (task) void task.destroy().catch(() => {});
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
    };
  }, [image?.id, authorized, retryCount, updateScale]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const measure = () => {
      const style = window.getComputedStyle(stage);
      const width = Math.max(0, stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
      const height = Math.max(0, stage.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom));
      setStageSize((current) => current.width === width && current.height === height ? current : { width, height });
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(stage);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const handleWheel = (event) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const canvas = canvasRef.current;
      const rect = canvas?.getBoundingClientRect();
      if (!canvas || !rect?.width || !rect?.height) return;

      let scaleDelta;
      if (event.deltaMode === 1) {
        const direction = Math.sign(event.deltaY);
        if (direction && wheelLineRemainderRef.current && Math.sign(wheelLineRemainderRef.current) !== direction) {
          wheelLineRemainderRef.current = 0;
        }
        const lineSteps = wheelLineRemainderRef.current + event.deltaY / 3;
        const wholeSteps = Math.trunc(lineSteps);
        wheelLineRemainderRef.current = lineSteps - wholeSteps;
        scaleDelta = -wholeSteps * 0.05;
      } else if (event.deltaMode === 2) {
        scaleDelta = -Math.sign(event.deltaY) * Math.max(1, Math.round(Math.abs(event.deltaY))) * 0.05;
      } else if (Math.abs(event.deltaY) >= 50) {
        const wheelNotches = Math.max(1, Math.round(Math.abs(event.deltaY) / 100));
        scaleDelta = -Math.sign(event.deltaY) * wheelNotches * 0.05;
      } else {
        scaleDelta = -event.deltaY * 0.001;
      }
      const nextScale = Math.min(3.0, Math.max(0.4, Math.round((scaleRef.current + scaleDelta) * 100) / 100));
      if (Math.abs(nextScale - scaleRef.current) < 0.001) return;

      zoomAnchorRef.current = {
        xRatio: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
        yRatio: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
        clientX: event.clientX,
        clientY: event.clientY
      };
      if (fitModeRef.current !== 'manual') {
        const baseMode = fitModeRef.current;
        manualBaseModeRef.current = baseMode;
        setManualBaseMode(baseMode);
      }
      fitModeRef.current = 'manual';
      setFitMode('manual');
      updateScale(nextScale);
    };
    stage.addEventListener('wheel', handleWheel, { passive: false });
    return () => stage.removeEventListener('wheel', handleWheel);
  }, [updateScale]);

  useEffect(() => {
    const isInteractiveTarget = (target) => Boolean(target?.closest?.('button, a, input, textarea, select, [role="button"], [contenteditable="true"]'));
    const handleKeyDown = (event) => {
      const reader = containerRef.current;
      const readerHasFocus = Boolean(reader && (reader.contains(event.target) || reader.contains(document.activeElement)));
      if (event.code !== 'Space' || event.repeat || !readerHasFocus || !pointerInsideStageRef.current || isInteractiveTarget(event.target)) return;
      event.preventDefault();
      spacePanActiveRef.current = true;
      setSpacePanActive(true);
    };
    const handleKeyUp = (event) => {
      if (event.code !== 'Space' || !spacePanActiveRef.current) return;
      event.preventDefault();
      spacePanActiveRef.current = false;
      setSpacePanActive(false);
      stopPan();
    };
    const clearPan = () => {
      spacePanActiveRef.current = false;
      setSpacePanActive(false);
      stopPan();
    };
    const handlePointerEnd = (event) => {
      if (panDragRef.current?.pointerId === event.pointerId) stopPan();
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', clearPan);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', clearPan);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
      spacePanActiveRef.current = false;
      pointerInsideStageRef.current = false;
      stopPan(false);
    };
  }, [stopPan]);

  const zoomBy = useCallback((amount) => {
    if (fitModeRef.current !== 'manual') {
      manualBaseModeRef.current = fitModeRef.current;
      setManualBaseMode(fitModeRef.current);
    }
    fitModeRef.current = 'manual';
    setFitMode('manual');
    updateScale((value) => Math.min(3.0, Math.max(0.4, Math.round((value + amount) * 100) / 100)));
  }, [updateScale]);

  const selectFitMode = useCallback((mode) => {
    fitModeRef.current = mode;
    manualBaseModeRef.current = mode;
    setFitMode(mode);
    setManualBaseMode(mode);
    updateScale(1);
  }, [updateScale]);

  const resetZoom = useCallback(() => {
    selectFitMode('width');
  }, [selectFitMode]);

  const rotatePage = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360);
  }, []);

  useEffect(() => {
    const handleDocKeyDown = (event) => {
      const reader = containerRef.current;
      const readerHasFocus = Boolean(reader && (reader.contains(event.target) || reader.contains(document.activeElement)));
      if (!readerHasFocus) return;
      if (event.key === 'Escape' && isFullscreenActive) {
        event.preventDefault();
        event.stopPropagation();
        void exitFullscreen();
        return;
      }
      if (event.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      if (event.target?.closest?.('button, a, [role="button"]')) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      if (event.key === '+' || event.key === '=' || event.code === 'NumpadAdd') {
        event.preventDefault();
        zoomBy(0.15);
      } else if (event.key === '-' || event.key === '_' || event.code === 'NumpadSubtract') {
        event.preventDefault();
        zoomBy(-0.15);
      } else if (event.key === 'ArrowLeft') {
        if (pageNumber > 1) {
          event.preventDefault();
          setPageNumber((page) => Math.max(1, page - 1));
        }
      } else if (event.key === 'ArrowRight') {
        const total = pdf?.numPages || 1;
        if (pageNumber < total) {
          event.preventDefault();
          setPageNumber((page) => Math.min(total, page + 1));
        }
      } else if (event.key === 'r' || event.key === 'R') {
        if (!event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault();
          rotatePage();
        }
      } else if (event.key === 't' || event.key === 'T') {
        if (!event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault();
          setShowSidebar((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleDocKeyDown);
    return () => window.removeEventListener('keydown', handleDocKeyDown);
  }, [exitFullscreen, isFullscreenActive, pageNumber, pdf?.numPages, rotatePage, zoomBy]);

  useEffect(() => {
    if (!pdf || !stageSize.width || !stageSize.height || !canvasRef.current) return undefined;
    let active = true;
    let task = null;
    let anchorFrame = 0;
    const canvas = canvasRef.current;
    setRenderStatus('rendering');
    setRenderError('');

    const renderPage = async () => {
      try {
        const page = await withTimeout(
          pdf.getPage(pageNumber),
          SHOWCASE_REQUEST_TIMEOUT_MS,
          'This PDF page could not be prepared in time. Retry the document.',
          () => { void pdf.destroy().catch(() => {}); }
        );
        if (!active) return;
        const totalRotation = ((page.rotate || 0) + rotation) % 360;
        const baseViewport = page.getViewport({ scale: 1, rotation: totalRotation });
        const fitWidthScale = stageSize.width / baseViewport.width;
        const fitPageScale = Math.min(fitWidthScale, stageSize.height / baseViewport.height);
        const fittedScale = fitMode === 'page' || (fitMode === 'manual' && manualBaseMode === 'page')
          ? fitPageScale
          : fitWidthScale;
        const viewport = page.getViewport({ scale: fittedScale * scale, rotation: totalRotation });
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) throw new Error('This browser could not create a PDF page canvas.');
        canvas.width = Math.ceil(viewport.width * pixelRatio);
        canvas.height = Math.ceil(viewport.height * pixelRatio);
        canvas.style.width = `${Math.ceil(viewport.width)}px`;
        canvas.style.height = `${Math.ceil(viewport.height)}px`;
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        context.fillStyle = '#fff';
        context.fillRect(0, 0, viewport.width, viewport.height);
        task = page.render({ canvasContext: context, viewport });
        renderTaskRef.current = task;
        await withTimeout(task.promise, SHOWCASE_REQUEST_TIMEOUT_MS, 'This page took too long to render. Retry the PDF.', () => task?.cancel());
        if (active) {
          setRenderStatus('ready');
          const anchor = zoomAnchorRef.current;
          if (anchor) {
            zoomAnchorRef.current = null;
            anchorFrame = window.requestAnimationFrame(() => {
              if (!active || !stageRef.current || !canvas.isConnected) return;
              const rect = canvas.getBoundingClientRect();
              stageRef.current.scrollLeft += rect.left + anchor.xRatio * rect.width - anchor.clientX;
              stageRef.current.scrollTop += rect.top + anchor.yRatio * rect.height - anchor.clientY;
            });
          }
        }
      } catch (error) {
        if (!active || error?.name === 'RenderingCancelledException') return;
        zoomAnchorRef.current = null;
        setRenderError(error?.message || 'This PDF page could not be rendered. Retry the document.');
        setRenderStatus('error');
      } finally {
        if (renderTaskRef.current === task) renderTaskRef.current = null;
      }
    };
    void renderPage();

    return () => {
      active = false;
      if (anchorFrame) window.cancelAnimationFrame(anchorFrame);
      task?.cancel();
      if (renderTaskRef.current === task) renderTaskRef.current = null;
      canvas.width = 0;
      canvas.height = 0;
      canvas.style.width = '';
      canvas.style.height = '';
    };
  }, [pdf, pageNumber, scale, fitMode, manualBaseMode, stageSize, rotation]);

  const retry = () => setRetryCount((count) => count + 1);

  const handlePanPointerDown = (event) => {
    if (!spacePanActiveRef.current || event.pointerType !== 'mouse' || event.button !== 0) return;
    event.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    panDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: stage.scrollLeft,
      scrollTop: stage.scrollTop
    };
    try { stage.setPointerCapture(event.pointerId); } catch { /* Window-level release handlers remain as a fallback. */ }
    setIsPanning(true);
  };

  const handlePanPointerMove = (event) => {
    const drag = panDragRef.current;
    const stage = stageRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !stage) return;
    event.preventDefault();
    stage.scrollLeft = drag.scrollLeft - (event.clientX - drag.startX);
    stage.scrollTop = drag.scrollTop - (event.clientY - drag.startY);
  };

  const handleStagePointerDown = (event) => {
    if (event.button === 0 && !event.target?.closest?.('button, a, input, textarea, select, [role="button"], [contenteditable="true"]')) {
      stageRef.current?.focus({ preventScroll: true });
    }
    handlePanPointerDown(event);
  };

  const pageCount = pdf?.numPages || 0;
  const pageControlsDisabled = loadStatus !== 'ready';

  if (!authorized || loadStatus === 'private') {
    return (
      <section ref={containerRef} className="showcase-pdf-reader" aria-label={`PDF reader${title ? ` for ${title}` : ''}`} onContextMenu={(e) => e.preventDefault()}>
        <header className="showcase-pdf-toolbar" role="toolbar" aria-label="PDF document toolbar">
          <div className="showcase-pdf-toolbar-heading">
            <h2 className="showcase-pdf-toolbar-title">{title || 'Document preview'}</h2>
            {category && <span className="showcase-pdf-toolbar-category">{category}</span>}
          </div>
          {onClose && (
            <div className="showcase-pdf-toolbar-actions">
              <button ref={closeRef} type="button" className="showcase-pdf-btn showcase-pdf-close-btn" onClick={onClose} aria-label="Close document viewer" title="Close document viewer"><PdfReaderIcon name="close" /></button>
            </div>
          )}
        </header>
        <div className="showcase-pdf-state" role="status">The original PDF is available only to authorized staff.</div>
      </section>
    );
  }

  if (loadStatus === 'unavailable') {
    return (
      <section ref={containerRef} className="showcase-pdf-reader" aria-label={`PDF reader${title ? ` for ${title}` : ''}`} onContextMenu={(e) => e.preventDefault()}>
        <header className="showcase-pdf-toolbar" role="toolbar" aria-label="PDF document toolbar">
          <div className="showcase-pdf-toolbar-heading">
            <h2 className="showcase-pdf-toolbar-title">{title || 'Document preview'}</h2>
            {category && <span className="showcase-pdf-toolbar-category">{category}</span>}
          </div>
          {onClose && (
            <div className="showcase-pdf-toolbar-actions">
              <button ref={closeRef} type="button" className="showcase-pdf-btn showcase-pdf-close-btn" onClick={onClose} aria-label="Close document viewer" title="Close document viewer"><PdfReaderIcon name="close" /></button>
            </div>
          )}
        </header>
        <div className="showcase-pdf-state is-error" role="alert"><span>{loadError}</span><button type="button" onClick={retry}>Retry PDF loading</button></div>
      </section>
    );
  }

  return (
    <section
      ref={containerRef}
      className={`showcase-pdf-reader ${isFullscreenActive ? 'is-fullscreen' : ''}`}
      aria-label={`PDF reader${title ? ` for ${title}` : ''}`}
      onContextMenu={(e) => e.preventDefault()}
    >
      <header className="showcase-pdf-toolbar" role="toolbar" aria-label="PDF document toolbar">
        <div className="showcase-pdf-toolbar-heading">
          <div className="showcase-pdf-title-row">
            <button
              type="button"
              className={`showcase-pdf-btn showcase-pdf-sidebar-toggle ${showSidebar ? 'is-active' : ''}`}
              onClick={() => setShowSidebar((prev) => !prev)}
              disabled={pageControlsDisabled}
              aria-label={showSidebar ? 'Hide thumbnails (t)' : 'Show thumbnails (t)'}
              aria-pressed={showSidebar}
              title={showSidebar ? 'Hide thumbnails (t)' : 'Show thumbnails (t)'}
            >
              <PdfReaderIcon name={showSidebar ? 'thumbnailsHide' : 'thumbnailsShow'} />
            </button>
            <h2 className="showcase-pdf-toolbar-title">{title || 'Document preview'}</h2>
          </div>
          {category && <span className="showcase-pdf-toolbar-category">{category}</span>}
        </div>
        <div className="showcase-pdf-toolbar-actions" role="group" aria-label="PDF controls">
          <div className="showcase-pdf-control-group" role="group" aria-label="Zoom controls">
            <button
              type="button"
              className="showcase-pdf-btn"
              onClick={() => zoomBy(-0.15)}
              disabled={pageControlsDisabled || scale <= 0.4}
              aria-label="Zoom out (-)"
              title="Zoom out (-)"
            >
              <PdfReaderIcon name="zoomOut" />
            </button>
            <button
              type="button"
              className="showcase-pdf-btn showcase-pdf-zoom-btn"
              onClick={resetZoom}
              disabled={pageControlsDisabled}
              aria-label={`Current zoom ${Math.round(scale * 100)} percent. Click to reset.`}
              title="Reset zoom to 100%"
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              type="button"
              className="showcase-pdf-btn"
              onClick={() => zoomBy(0.15)}
              disabled={pageControlsDisabled || scale >= 3.0}
              aria-label="Zoom in (+)"
              title="Zoom in (+)"
            >
              <PdfReaderIcon name="zoomIn" />
            </button>
          </div>
          <div className="showcase-pdf-control-group showcase-pdf-fit-group" role="group" aria-label="Fit controls">
            <button
              type="button"
              className={`showcase-pdf-btn showcase-pdf-fit-btn ${fitMode === 'width' && scale === 1 ? 'is-active' : ''}`}
              onClick={() => selectFitMode('width')}
              disabled={pageControlsDisabled}
              aria-pressed={fitMode === 'width' && scale === 1}
              aria-label="Fit page to width"
              title="Fit page to width"
            >
              <PdfReaderIcon name="fitWidth" /><span className="showcase-pdf-fit-label">Fit width</span>
            </button>
            <button
              type="button"
              className={`showcase-pdf-btn showcase-pdf-fit-btn ${fitMode === 'page' && scale === 1 ? 'is-active' : ''}`}
              onClick={() => selectFitMode('page')}
              disabled={pageControlsDisabled}
              aria-pressed={fitMode === 'page' && scale === 1}
              aria-label="Fit entire page in view"
              title="Fit entire page in view"
            >
              <PdfReaderIcon name="fitPage" /><span className="showcase-pdf-fit-label">Fit page</span>
            </button>
          </div>
          <div className="showcase-pdf-control-group" role="group" aria-label="Page navigation">
            <button
              type="button"
              className="showcase-pdf-btn"
              onClick={() => setPageNumber((page) => Math.max(1, page - 1))}
              disabled={pageControlsDisabled || pageNumber <= 1}
              aria-label="Previous page (Left arrow)"
              title="Previous page (Left arrow)"
            >
              <PdfReaderIcon name="previous" />
            </button>
            <span className="showcase-pdf-page-indicator" aria-live="polite">
              {pageControlsDisabled ? '— / —' : `${pageNumber} / ${pageCount || 1}`}
            </span>
            <button
              type="button"
              className="showcase-pdf-btn"
              onClick={() => setPageNumber((page) => Math.min(pageCount, page + 1))}
              disabled={pageControlsDisabled || pageNumber >= pageCount}
              aria-label="Next page (Right arrow)"
              title="Next page (Right arrow)"
            >
              <PdfReaderIcon name="next" />
            </button>
          </div>
          <div className="showcase-pdf-control-group" role="group" aria-label="View actions">
            <button
              type="button"
              className="showcase-pdf-btn"
              onClick={rotatePage}
              disabled={pageControlsDisabled}
              aria-label={`Rotate clockwise 90 degrees (r). Current: ${rotation}°`}
              title="Rotate clockwise (r)"
            >
              <PdfReaderIcon name="rotate" />
            </button>
            <button
              type="button"
              className={`showcase-pdf-btn ${isFullscreenActive ? 'is-active' : ''}`}
              onClick={() => void toggleFullscreen()}
              disabled={pageControlsDisabled || (!onToggleFullscreen && !(viewerRef?.current || containerRef.current)?.requestFullscreen)}
              aria-label={isFullscreenActive ? 'Exit fullscreen' : 'Enter fullscreen'}
              title={isFullscreenActive ? 'Exit fullscreen' : 'Enter fullscreen'}
              aria-pressed={isFullscreenActive}
            >
              <PdfReaderIcon name={isFullscreenActive ? 'fullscreenExit' : 'fullscreen'} />
            </button>
            {onClose && (
              <button
                ref={closeRef}
                type="button"
                className="showcase-pdf-btn showcase-pdf-close-btn"
                onClick={onClose}
                aria-label="Close document viewer (Escape)"
                title="Close (Escape)"
              >
                <PdfReaderIcon name="close" />
              </button>
            )}
          </div>
        </div>
      </header>
      <div className={`showcase-pdf-body ${showSidebar ? 'has-sidebar' : 'is-sidebar-collapsed'}`}>
        <aside
          className={`showcase-pdf-sidebar ${showSidebar ? 'is-open' : 'is-collapsed'}`}
          aria-label="Document thumbnails"
          aria-hidden={!showSidebar}
        >
          <div className="showcase-pdf-sidebar-header">
            <span className="showcase-pdf-sidebar-title">Pages ({pageCount || 1})</span>
            <button
              type="button"
              className="showcase-pdf-sidebar-close"
              onClick={() => setShowSidebar(false)}
              aria-label="Close thumbnails sidebar"
              title="Close sidebar (t)"
            >
              <PdfReaderIcon name="close" />
            </button>
          </div>
          <div ref={thumbnailsScrollRef} className="showcase-pdf-thumbnails-scroll" role="list" tabIndex={0} aria-label="Page thumbnail list">
            {pageCount > 0 ? (
              Array.from({ length: pageCount }, (_, i) => i + 1).map((num) => (
                <PdfThumbnailItem
                  key={num}
                  pdf={pdf}
                  pageNumber={num}
                  activePageNumber={pageNumber}
                  isSelected={num === pageNumber}
                  rotation={rotation}
                  sidebarOpen={showSidebar}
                  scrollRootRef={thumbnailsScrollRef}
                  scheduler={thumbnailScheduler}
                  onSelect={() => handleThumbnailSelect(num)}
                />
              ))
            ) : (
              <div className="showcase-pdf-thumb-loading">Loading pages…</div>
            )}
          </div>
        </aside>
        {showSidebar && (
          <div
            className="showcase-pdf-sidebar-backdrop"
            onClick={() => setShowSidebar(false)}
            aria-hidden="true"
          />
        )}
        <div
          ref={stageRef}
          className={`showcase-pdf-stage${fitMode === 'page' ? ' is-fit-page' : ''}${spacePanActive ? ' is-pan-mode' : ''}${isPanning ? ' is-panning' : ''}`}
          role="region"
          tabIndex={0}
          aria-label={`PDF page ${pageNumber} of ${pageCount || 'loading'}`}
          onContextMenu={(event) => event.preventDefault()}
          onPointerEnter={(event) => { if (event.pointerType === 'mouse') pointerInsideStageRef.current = true; }}
          onPointerLeave={() => { pointerInsideStageRef.current = false; }}
          onPointerDown={handleStagePointerDown}
          onPointerMove={handlePanPointerMove}
          onLostPointerCapture={stopPan}
        >
          {loadStatus === 'loading' && <div className="showcase-pdf-state" role="status" aria-live="polite">Loading authorized PDF…</div>}
          {loadStatus === 'error' && <div className="showcase-pdf-state is-error" role="alert"><span>{loadError}</span><button type="button" onClick={retry}>Retry PDF loading</button></div>}
          {loadStatus === 'ready' && renderStatus === 'rendering' && <div className="showcase-pdf-render-status" role="status" aria-live="polite">Rendering page {pageNumber}…</div>}
          {loadStatus === 'ready' && renderStatus === 'error' && <div className="showcase-pdf-state is-error" role="alert"><span>{renderError}</span><button type="button" onClick={retry}>Retry PDF loading</button></div>}
          {loadStatus === 'ready' && renderStatus !== 'error' && (
            <canvas
              ref={canvasRef}
              className="showcase-pdf-page"
              aria-label={`${title || 'Document'} page ${pageNumber}`}
              onContextMenu={(event) => event.preventDefault()}
            />
          )}
        </div>
      </div>
      <footer className="showcase-pdf-foot">
        <span>Original PDF · authorized staff view</span>
        <small id="showcase-pdf-privacy">Private original PDF shown in this viewer. The approved PNG remains separate cover media.</small>
      </footer>
    </section>
  );
}

function ShowcaseLightbox({ images, index, onClose, onChange, authorized = false, isDocument = false, documentImage = null, title = 'Project preview', project, returnFocusElement = null, initialSrc = '' }) {
  const closeRef = useRef(null);
  const viewerRef = useRef(null);
  const returnFocusRef = useRef(null);
  const canvasRef = useRef(null);
  const naturalSizeRef = useRef(null);
  const zoomAnchorRef = useRef(null);
  const latestRef = useRef({ images, index, onClose, onChange });
  const [zoom, setZoom] = useState(1);
  const [fitSize, setFitSize] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  latestRef.current = { images, index, onClose, onChange };

  useEffect(() => {
    setZoom(1);
    setFitSize(null);
    naturalSizeRef.current = null;
    if (canvasRef.current) canvasRef.current.scrollTo({ top: 0, left: 0 });
    setRetryCount(0);
  }, [index]);

  const captureZoomAnchor = useCallback(() => {
    const canvas = canvasRef.current;
    const page = canvas?.firstElementChild;
    if (!canvas || !page || !fitSize) return { x: 0.5, y: 0.5 };
    const canvasRect = canvas.getBoundingClientRect();
    const pageRect = page.getBoundingClientRect();
    const pageLeft = pageRect.left - canvasRect.left + canvas.scrollLeft;
    const pageTop = pageRect.top - canvasRect.top + canvas.scrollTop;
    const width = fitSize.width * zoom;
    const height = fitSize.height * zoom;
    return {
      x: Math.max(0, Math.min(1, (canvas.scrollLeft + canvas.clientWidth / 2 - pageLeft) / width)),
      y: Math.max(0, Math.min(1, (canvas.scrollTop + canvas.clientHeight / 2 - pageTop) / height))
    };
  }, [fitSize, zoom]);

  const updateFitSize = useCallback(() => {
    const canvas = canvasRef.current;
    const naturalSize = naturalSizeRef.current;
    if (!canvas || !naturalSize?.width || !naturalSize?.height) return;
    const availableWidth = Math.max(1, canvas.clientWidth - 32);
    const availableHeight = Math.max(1, canvas.clientHeight - 32);
    const scale = Math.min(1, availableWidth / naturalSize.width, availableHeight / naturalSize.height);
    setFitSize({ width: naturalSize.width * scale, height: naturalSize.height * scale });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
      zoomAnchorRef.current = captureZoomAnchor();
      updateFitSize();
    });
    observer?.observe(canvas);
    return () => observer?.disconnect();
  }, [captureZoomAnchor, updateFitSize]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const anchor = zoomAnchorRef.current;
    if (!canvas || !fitSize || !anchor) return;
    const width = fitSize.width * zoom;
    const height = fitSize.height * zoom;
    canvas.scrollLeft = Math.max(0, Math.min(canvas.scrollWidth - canvas.clientWidth, anchor.x * width - canvas.clientWidth / 2));
    canvas.scrollTop = Math.max(0, Math.min(canvas.scrollHeight - canvas.clientHeight, anchor.y * height - canvas.clientHeight / 2));
    zoomAnchorRef.current = null;
  }, [fitSize, zoom]);

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(document.fullscreenElement === viewerRef.current);
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  useEffect(() => {
    const scrollY = window.scrollY;
    returnFocusRef.current = returnFocusElement || document.activeElement;
    closeRef.current?.focus({ preventScroll: true });
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (document.fullscreenElement) {
          if (documentImage && viewerRef.current?.contains(document.fullscreenElement)) {
            event.stopPropagation();
            void document.exitFullscreen().catch(() => {});
            return;
          }
          void document.exitFullscreen().catch(() => {}).finally(() => latestRef.current.onClose());
        } else {
          latestRef.current.onClose();
        }
      } else if (event.key === 'ArrowRight' && latestRef.current.index < latestRef.current.images.length - 1) {
        event.preventDefault();
        latestRef.current.onChange(latestRef.current.index + 1);
      } else if (event.key === 'ArrowLeft' && latestRef.current.index > 0) {
        event.preventDefault();
        latestRef.current.onChange(latestRef.current.index - 1);
      } else if (event.key === 'Tab') {
        const focusable = Array.from(viewerRef.current?.querySelectorAll('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])') || []);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.classList.add('showcase-modal-open');
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('showcase-modal-open');
      if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus?.({ preventScroll: true });
      window.requestAnimationFrame(() => window.scrollTo(0, scrollY));
    };
  }, []);

  const image = images[index];
  if (!image && !documentImage) return null;
  const changeZoom = (amount) => {
    zoomAnchorRef.current = captureZoomAnchor();
    setZoom((current) => Math.min(2.5, Math.max(0.75, Math.round((current + amount) * 100) / 100)));
  };
  const fitPreview = () => {
    zoomAnchorRef.current = { x: 0, y: 0 };
    setZoom(1);
    requestAnimationFrame(() => canvasRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
  };
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await viewerRef.current?.requestFullscreen?.();
    } catch {
      setIsFullscreen(false);
    }
  };
  const closeViewer = async () => {
    if (document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch { /* Continue closing the viewer. */ }
    }
    onClose();
  };
  const canFullscreen = typeof document !== 'undefined' && Boolean(viewerRef.current?.requestFullscreen);
  const previewLabel = (pageImage, pageIndex) => pageImage.caption || (pageImage.presentation?.replaceAll('_', ' ') || `Preview ${pageIndex + 1}`);

  return (
    <div className={`showcase-lightbox-backdrop ${isDocument ? 'is-document-viewer' : ''}`} onMouseDown={(event) => { if (event.target === event.currentTarget) void closeViewer(); }}>
      <section ref={viewerRef} className={`showcase-lightbox ${isDocument ? 'is-document-viewer' : ''}`} role="dialog" aria-modal="true" aria-labelledby="showcase-lightbox-title" aria-describedby="showcase-lightbox-privacy" onContextMenu={(event) => { if (documentImage || isDocument) event.preventDefault(); }}>
        {documentImage ? (
          <ShowcasePdfReader
            key={documentImage.id}
            image={documentImage}
            title={project?.title || title}
            category={project ? `${categoryLabel(project.service_category)} · ${projectTypeLabel(project.project_type)}` : ''}
            authorized
            onClose={closeViewer}
            closeRef={closeRef}
            viewerRef={viewerRef}
          />
        ) : (
          <>
            <header className="showcase-lightbox-top">
              <div className="showcase-viewer-heading"><h2 id="showcase-lightbox-title">{project?.title || title}</h2><span>{project ? `${categoryLabel(project.service_category)} · ${projectTypeLabel(project.project_type)}` : image.caption || image.alt_text || 'Project preview'}</span></div>
              <div className="showcase-viewer-header-actions">
                <div className="showcase-lightbox-zoom" role="group" aria-label="Preview zoom controls"><button type="button" onClick={() => changeZoom(-0.25)} disabled={zoom <= 0.75} aria-label="Zoom out" title="Zoom out">−</button><button type="button" onClick={() => setZoom(1)} aria-label={`Reset zoom, currently ${Math.round(zoom * 100)} percent`} title="Reset zoom">{Math.round(zoom * 100)}%</button><button type="button" onClick={() => changeZoom(0.25)} disabled={zoom >= 2.5} aria-label="Zoom in" title="Zoom in">＋</button></div>
                <div className="showcase-viewer-utility-actions">
                  <button type="button" className="showcase-viewer-fit" onClick={fitPreview} aria-label="Fit preview to canvas" title="Fit to view" aria-pressed={zoom === 1}>Fit</button>
                  <button type="button" className="showcase-viewer-fullscreen" onClick={() => void toggleFullscreen()} disabled={!canFullscreen} aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'} title={isFullscreen ? 'Exit full screen' : 'Enter full screen'} aria-pressed={isFullscreen}>⛶</button>
                  <button ref={closeRef} type="button" onClick={() => void closeViewer()} aria-label="Close preview viewer" title="Close preview">×</button>
                </div>
              </div>
            </header>
            <div className={`showcase-viewer-body ${images.length > 1 ? 'has-thumbnails' : ''}`}>
              {images.length > 1 && <nav className="showcase-viewer-thumbnails" aria-label="Available preview images">
                {images.map((pageImage, pageIndex) => <button key={pageImage.id} type="button" className={pageIndex === index ? 'is-active' : ''} aria-current={pageIndex === index ? 'true' : undefined} aria-label={`Show preview ${pageIndex + 1}: ${previewLabel(pageImage, pageIndex)}`} onClick={() => onChange(pageIndex)}><span className="showcase-viewer-thumbnail-frame"><ShowcaseImage image={pageImage} /></span><span>{pageIndex + 1}</span></button>)}
              </nav>}
              <div className="showcase-viewer-main">
                <div ref={canvasRef} className="showcase-lightbox-image" role="region" tabIndex={0} aria-label={`Preview image ${index + 1} of ${images.length}`}>
                  <ShowcaseImage
                    key={`${image.id}-${retryCount}`}
                    image={image}
                    eager
                    authorized={authorized}
                    initialSrc={retryCount === 0 ? initialSrc : ''}
                    onRetry={() => setRetryCount((count) => count + 1)}
                    onImageLoad={(size) => { naturalSizeRef.current = size; updateFitSize(); }}
                    resourceStyle={fitSize ? { width: `${fitSize.width * zoom}px`, height: `${fitSize.height * zoom}px` } : undefined}
                  />
                </div>
              </div>
            </div>
            <footer className="showcase-lightbox-controls">
              <div className="showcase-lightbox-page-count" aria-live="polite">{`Preview image ${index + 1} of ${images.length}`}<small id="showcase-lightbox-privacy">Preview only. Original document remains private.</small></div>
              {images.length > 1 && <div className="showcase-lightbox-page-nav"><button type="button" onClick={() => onChange(index - 1)} disabled={index === 0} aria-label="Previous preview image">←</button><button type="button" onClick={() => onChange(index + 1)} disabled={index === images.length - 1} aria-label="Next preview image">→</button></div>}
            </footer>
          </>
        )}
      </section>
    </div>
  );
}

function DocumentPreviewCard({ project, images }) {
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const lightboxTriggerRef = useRef(null);
  const before = images.find((image) => ['document_before', 'before'].includes(image.presentation));
  const after = images.find((image) => ['document_after', 'after'].includes(image.presentation));
  const thumbnail = images.find((image) => image.presentation === 'thumbnail');
  const featured = thumbnail || after || images[0];
  const cardPages = thumbnail ? [thumbnail] : before && after ? [before, after] : featured ? [featured] : [];
  const pageIndex = Math.max(0, images.findIndex((image) => image.id === cardPages[0]?.id));

  if (!cardPages.length) {
    return <div className="showcase-document-card-empty" role="status"><strong>Prepared preview coming soon</strong><span>The original PDF remains private. No approved preview image is available yet.</span></div>;
  }

  return (
    <div className="showcase-document-card-preview">
      <button className={`showcase-document-preview-launch ${cardPages.length > 1 ? 'has-comparison' : ''}`} type="button" onClick={(event) => { lightboxTriggerRef.current = event.currentTarget; setLightboxIndex(pageIndex); }} aria-haspopup="dialog" aria-label={`View full document preview for ${project.title}`}>
        <span className="showcase-document-preview-pages">{cardPages.map((image) => <span className="showcase-document-page" key={image.id}><span className="showcase-document-page-label">{image.presentation.includes('before') || image.presentation === 'before' ? 'BEFORE' : image.presentation.includes('after') || image.presentation === 'after' ? 'AFTER' : 'PREVIEW'}</span><ShowcaseImage image={image} /></span>)}</span>
        <span className="showcase-document-preview-affordance">View full preview{images.length > 1 && <span className="showcase-document-preview-count">· {images.length} images</span>} <span aria-hidden="true">↗</span></span>
      </button>
      {lightboxIndex != null && <ShowcaseLightbox images={images} index={lightboxIndex} onClose={() => setLightboxIndex(null)} onChange={setLightboxIndex} isDocument title={`Document preview · ${project.title}`} project={project} returnFocusElement={lightboxTriggerRef.current} />}
    </div>
  );
}

export function ProjectGallery({ project, authorized = false }) {
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const lightboxTriggerRef = useRef(null);
  const images = Array.isArray(project.images)
    ? [...project.images]
      .filter((image) => authorized || (image.is_public_preview && image.content_type !== 'application/pdf'))
      .sort((a, b) => a.sort_order - b.sort_order)
    : [];
  const before = images.find((image) => image.presentation === 'before');
  const after = images.find((image) => image.presentation === 'after');
  const isBeforeAfter = ['linkedin_before_after', 'github_before_after'].includes(project.service_category);
  const documents = images.filter((image) => image.content_type === 'application/pdf');
  const screenshots = images.filter((image) => image.content_type !== 'application/pdf');
  const portfolioUrl = safeShowcaseUrl(project.portfolio_url);
  const beforeUrl = safeShowcaseUrl(project.portfolio_before_url);

  if (!authorized && ['cv_demo', 'resume_demo', 'cover_letter_demo'].includes(project.service_category)) {
    return <DocumentPreviewCard project={project} images={screenshots} />;
  }

  if (authorized && ['cv_demo', 'resume_demo', 'cover_letter_demo'].includes(project.service_category) && documents.length) {
    const beforeDocument = documents.find((image) => image.presentation === 'document_before');
    const afterDocument = documents.find((image) => image.presentation === 'document_after');
    const orderedDocuments = beforeDocument && afterDocument ? [beforeDocument, afterDocument] : documents;
    return <div className="showcase-document-presentation"><div className="showcase-document-grid">{orderedDocuments.map((image) => <figure key={image.id}><figcaption>{image.presentation === 'document_before' ? 'Before' : image.presentation === 'document_after' ? 'After' : image.caption || 'Document preview'}</figcaption><ShowcasePdfReader image={image} title={image.caption || image.alt_text || project.title} authorized={authorized} />{image.caption && <p>{image.caption}</p>}</figure>)}</div>{screenshots.length > 0 && <div className="showcase-document-image-previews">{screenshots.map((image) => <figure key={image.id}><figcaption>{image.presentation === 'before' ? 'Before image preview' : image.presentation === 'after' ? 'After image preview' : image.presentation === 'thumbnail' ? 'Cover image' : image.caption || 'Additional preview'}</figcaption><ShowcaseImage image={image} authorized={authorized} />{image.caption && <p>{image.caption}</p>}</figure>)}</div>}</div>;
  }

  if (project.service_category === 'portfolio_website_demo') {
    const desktop = screenshots.find((image) => image.presentation === 'desktop') || ((!screenshots.some((image) => image.presentation === 'before')) && screenshots.find((image) => image.presentation === 'after')) || screenshots.find((image) => image.presentation === 'gallery');
    const mobile = screenshots.find((image) => image.presentation === 'mobile');
    const beforeShot = screenshots.find((image) => image.presentation === 'before');
    const afterShot = screenshots.find((image) => image.presentation === 'after');
    return <div className="showcase-portfolio-presentation">
      {(beforeShot || afterShot) && <div className="showcase-before-after">{[[beforeShot, 'Before'], [afterShot, 'After']].filter(([image]) => image).map(([image, label]) => <figure key={image.id}><figcaption>{label}</figcaption><ShowcaseImage image={image} authorized={authorized} /></figure>)}</div>}
      <div className="showcase-portfolio-previews">{desktop && <figure className="showcase-browser-frame"><figcaption>Desktop preview</figcaption><ShowcaseImage image={desktop} authorized={authorized} /><span className="showcase-browser-dots" aria-hidden="true">● ● ●</span></figure>}{mobile && <figure className="showcase-mobile-frame"><figcaption>Mobile preview</figcaption><ShowcaseImage image={mobile} authorized={authorized} /></figure>}</div>
      {portfolioUrl && <div className="showcase-project-actions"><a className="btn dark" href={portfolioUrl} target="_blank" rel="noopener noreferrer">{project.external_link_label || 'Visit Website'} ↗</a>{beforeUrl && <a href={beforeUrl} target="_blank" rel="noopener noreferrer">View previous website ↗</a>}<button type="button" className="showcase-live-preview-toggle" onClick={(event) => { event.currentTarget.nextElementSibling.hidden = !event.currentTarget.nextElementSibling.hidden; event.currentTarget.setAttribute('aria-expanded', String(!event.currentTarget.nextElementSibling.hidden)); }}>{'Load live preview'}</button><iframe className="showcase-live-preview" title={`${project.title} live website preview`} src={portfolioUrl} sandbox="allow-scripts allow-forms" referrerPolicy="no-referrer" loading="lazy" hidden /></div>}
      {!desktop && !mobile && !beforeShot && !afterShot && <div className="showcase-gallery-empty"><p>Website screenshots are being prepared.</p></div>}
    </div>;
  }

  if (!screenshots.length) {
    return <div className="showcase-gallery-empty"><span aria-hidden="true">◌</span><p>Project images are being prepared.</p></div>;
  }

  if (isBeforeAfter && before && after) {
    const beforeIndex = screenshots.findIndex((image) => image.id === before.id);
    const afterIndex = screenshots.findIndex((image) => image.id === after.id);
    return (
      <div className="showcase-before-after">
        {[['Before', before, beforeIndex], ['After', after, afterIndex]].map(([label, image, index]) => (
          <figure key={image.id}>
            <figcaption>{label}</figcaption>
            <button type="button" className="showcase-image-button" onClick={(event) => { lightboxTriggerRef.current = event.currentTarget; setLightboxIndex(index); }} aria-label={`Enlarge ${label.toLowerCase()} image: ${image.alt_text}`}><ShowcaseImage image={image} authorized={authorized} /></button>
            {image.caption && <p>{image.caption}</p>}
          </figure>
        ))}
        {lightboxIndex != null && <ShowcaseLightbox images={screenshots} index={lightboxIndex} onClose={() => setLightboxIndex(null)} onChange={setLightboxIndex} authorized={authorized} project={project} returnFocusElement={lightboxTriggerRef.current} />}
      </div>
    );
  }

  return (
    <div className={`showcase-image-grid ${project.service_category === 'portfolio_website_demo' ? 'is-portfolio' : ''}`}>
      {screenshots.map((image, index) => (
        <figure key={image.id} className={image.presentation === 'before' ? 'is-before' : image.presentation === 'after' ? 'is-after' : ''}>
          {image.presentation !== 'gallery' && <figcaption>{image.presentation === 'before' ? 'Before' : 'After'}</figcaption>}
          <button type="button" className="showcase-image-button" onClick={(event) => { lightboxTriggerRef.current = event.currentTarget; setLightboxIndex(index); }} aria-label={`Enlarge image: ${image.alt_text}`}><ShowcaseImage image={image} authorized={authorized} /></button>
          {image.caption && <p>{image.caption}</p>}
        </figure>
      ))}
      {lightboxIndex != null && <ShowcaseLightbox images={screenshots} index={lightboxIndex} onClose={() => setLightboxIndex(null)} onChange={setLightboxIndex} authorized={authorized} project={project} returnFocusElement={lightboxTriggerRef.current} />}
    </div>
  );
}

export function FeaturedShowcase() {
  const [projects, setProjects] = useState([]);
  const [visibleCount, setVisibleCount] = useState(8);
  const [state, setState] = useState('loading');
  const [failureKind, setFailureKind] = useState('unexpected');
  const [retryCount, setRetryCount] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), SHOWCASE_REQUEST_TIMEOUT_MS);
    if (!supabase) {
      setState('unavailable');
      window.clearTimeout(timeout);
      return () => { active = false; controller.abort(); };
    }
    publishedShowcaseRequest(false, controller.signal)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) throw error;
        const uniqueProjects = [...new Map((data || []).map((project) => [project.project_id, project])).values()];
        setProjects(uniqueProjects);
        setVisibleCount(8);
        setState('ready');
      })
      .catch((error) => { if (active) { setFailureKind(classifyRequestFailure(error)); setState('error'); } });
    return () => { active = false; window.clearTimeout(timeout); controller.abort(); };
  }, [retryCount]);

  return (
    <section className="showcase-featured-section" aria-labelledby="showcase-featured-title">
      <div className="showcase-featured-inner">
        <div className="showcase-featured-head">
          <div>
            <p className="eyebrow">SELECTED WORK</p>
            <h2 id="showcase-featured-title">Selected work and <span>sample projects.</span></h2>
            <p>Browse published CVs, profile work and sample projects.</p>
          </div>
          <Link className="showcase-text-link" to="/showcase">
            View all work <span aria-hidden="true">↗</span>
          </Link>
        </div>
        {state === 'loading' ? <div className="showcase-featured-state"><SkeletonState label="Loading featured work" variant="cards" count={3} /></div>
          : state === 'error' ? <div className="showcase-featured-state"><RequestProblem kind={failureKind} onRetry={() => { setState('loading'); setRetryCount((count) => count + 1); }} /><Link to="/showcase">Explore the Showcase</Link></div>
            : state === 'unavailable' ? <p className="showcase-featured-state">Featured work is temporarily unavailable. <Link to="/showcase">Explore the Showcase</Link></p>
              : projects.length ? <>
                <div className="showcase-featured-grid">
                {projects.slice(0, visibleCount).map((project) => {
                  const isDocumentCategory = ['cv_demo', 'resume_demo', 'cover_letter_demo'].includes(project.service_category);
                  const isProfileCategory = ['linkedin_before_after', 'github_before_after'].includes(project.service_category);
                  const isPortfolioCategory = project.service_category === 'portfolio_website_demo';
                  const previews = getPublicPreviewImages(project);
                  const preferredPresentations = isDocumentCategory
                    ? ['thumbnail', 'document_after', 'after', 'document', 'gallery']
                    : isPortfolioCategory
                      ? ['thumbnail', 'desktop', 'after', 'gallery']
                      : isProfileCategory
                        ? ['thumbnail', 'after', 'gallery', 'desktop']
                        : ['thumbnail', 'after', 'desktop', 'gallery'];
                  const featuredImage = preferredPresentations
                    .map((presentation) => previews.find((image) => image.presentation === presentation))
                    .find(Boolean) || previews[0];
                  const categoryTab = SHOWCASE_TABS.find((tab) => tab.category === project.service_category)?.id || '';
                  const previewVariant = isDocumentCategory
                    ? 'is-document-preview'
                    : isProfileCategory
                      ? 'is-profile-preview'
                      : isPortfolioCategory
                        ? 'is-portfolio-preview'
                        : 'is-general-preview';
                  const tint = ['is-tint-ivory', 'is-tint-sage', 'is-tint-blush', 'is-tint-blue'][Array.from(String(project.project_id || project.service_category || project.title)).reduce((sum, character) => sum + character.charCodeAt(0), 0) % 4];

                  return (
                    <Link className="showcase-featured-card" key={project.project_id} to={`/showcase?tab=${categoryTab}`}>
                      <div className={`showcase-featured-media ${previewVariant} ${tint}`}>
                        {featuredImage
                          ? <ShowcaseImage image={featuredImage} eager altText="" />
                          : <div className="showcase-document-featured" role="status">
                            <strong>Project preview coming soon.</strong>
                          </div>}
                      </div>
                      <div className="showcase-featured-copy">
                        <small>{categoryLabel(project.service_category)}</small>
                        <h3>{project.title}</h3>
                        <span className="showcase-featured-action" aria-hidden="true">↗</span>
                      </div>
                    </Link>
                  );
                })}
                </div>
                {projects.length > visibleCount && <button className="showcase-featured-more" type="button" onClick={() => setVisibleCount((count) => Math.min(count + 8, projects.length))}>Show more</button>}
              </>
                : <p className="showcase-featured-state">Published work is being prepared. <Link to="/showcase">Explore the Showcase</Link></p>}
      </div>
    </section>
  );
}

function getPublicPreviewImages(project) {
  return Array.isArray(project?.images)
    ? project.images
      .filter((image) => image?.is_public_preview === true && image?.content_type?.startsWith('image/') && image.content_type !== 'application/pdf')
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    : [];
}

function ShowcaseProjectCard({ project, selected, previewOpen, onSelect, onOpenPreview, buttonRef, eager = false }) {
  const previews = getPublicPreviewImages(project);
  const [failedPreviewIds, setFailedPreviewIds] = useState([]);
  const [retryTokens, setRetryTokens] = useState({});
  const before = previews.find((image) => image.presentation === 'before');
  const after = previews.find((image) => image.presentation === 'after');
  const thumbnail = previews.find((image) => image.presentation === 'thumbnail');
  const featured = thumbnail
    || after
    || previews.find((image) => ['desktop', 'gallery'].includes(image.presentation))
    || previews[0];
  const profileUrl = safeShowcaseUrl(project.public_profile_url);
  const repositoryUrls = (project.public_repository_urls || []).map(safeShowcaseUrl).filter(Boolean);
  const imageProps = (image, imageIsEager = eager) => ({
    image,
    eager: imageIsEager,
    retryToken: retryTokens[image.id] || 0,
    onFailure: () => setFailedPreviewIds((ids) => ids.includes(image.id) ? ids : [...ids, image.id]),
    onImageReady: () => setFailedPreviewIds((ids) => ids.filter((id) => id !== image.id))
  });

  return (
    <article className={`showcase-reference-card ${selected ? 'is-selected' : ''}`} aria-current={selected ? 'true' : undefined}>
      <button ref={buttonRef} className="showcase-reference-card-media" type="button" onClick={onSelect} aria-label={`Preview ${project.title}`} aria-pressed={selected} aria-controls={selected && previewOpen ? 'showcase-project-preview' : undefined}>
        {!thumbnail && before && after ? (
          <span className="showcase-reference-comparison">
            <span><small>BEFORE</small><ShowcaseImage {...imageProps(before)} /></span>
            <span><small>AFTER</small><ShowcaseImage {...imageProps(after)} /></span>
          </span>
        ) : featured ? (
          <ShowcaseImage {...imageProps(featured)} />
        ) : (
          <span className="showcase-reference-unavailable"><strong>No approved preview</strong><span>This project has no public image preview.</span></span>
        )}
        {featured && <span className="showcase-reference-zoom" aria-hidden="true">⌕</span>}
      </button>
      <div className="showcase-reference-card-copy">
        <div className="showcase-reference-card-meta">
          <span className={`showcase-project-type ${project.project_type === 'client_work' ? 'is-client' : 'is-sample'}`}><i aria-hidden="true" />{projectTypeLabel(project.project_type)}</span>
          <span>{categoryLabel(project.service_category)}</span>
        </div>
        <h2>{project.title}</h2>
        {project.short_description && <p>{project.short_description}</p>}
        <div className="showcase-reference-card-actions">
          {failedPreviewIds.length > 0 && <button type="button" className="showcase-preview-retry" onClick={() => { const imageId = failedPreviewIds[0]; setFailedPreviewIds((ids) => ids.filter((id) => id !== imageId)); setRetryTokens((tokens) => ({ ...tokens, [imageId]: (tokens[imageId] || 0) + 1 })); }}>Retry preview</button>}
          {previews.length > 0 && <button type="button" className="showcase-reference-link" onClick={() => onOpenPreview(featured ? Math.max(0, previews.findIndex((image) => image.id === featured.id)) : 0)}>View full preview <span aria-hidden="true">→</span></button>}
          {profileUrl && <a href={profileUrl} target="_blank" rel="noopener noreferrer">View profile ↗</a>}
          {repositoryUrls.map((url) => <a key={url} href={url} target="_blank" rel="noopener noreferrer">{new URL(url).pathname.split('/').filter(Boolean).pop() || 'Repository'} ↗</a>)}
          {safeShowcaseUrl(project.portfolio_url) && <a href={safeShowcaseUrl(project.portfolio_url)} target="_blank" rel="noopener noreferrer">Visit website ↗</a>}
        </div>
      </div>
    </article>
  );
}

function ShowcaseSelectedViewer({ project, images, index, onChange, onOpen, onOpenDocument, onRetryDocumentCheck, documentImage, documentStatus, viewerRef, closeRef, onClose, open, mounted, lightboxOpen, initialPreviewSource }) {
  const image = images[index];
  const [zoom, setZoom] = useState(1);
  const [retryCount, setRetryCount] = useState(0);
  const wasLightboxOpenRef = useRef(false);
  const portfolioUrl = safeShowcaseUrl(project?.portfolio_url);
  const profileUrl = safeShowcaseUrl(project?.public_profile_url);
  const repositoryUrls = (project?.public_repository_urls || []).map(safeShowcaseUrl).filter(Boolean);
  const isDocument = ['cv_demo', 'resume_demo', 'cover_letter_demo'].includes(project?.service_category);
  const isCoverLetter = project?.service_category === 'cover_letter_demo';
  const isPortfolio = project?.service_category === 'portfolio_website_demo';
  const isLinkedIn = project?.service_category === 'linkedin_before_after';
  const isGitHub = project?.service_category === 'github_before_after';
  const showOriginalPdf = isDocument && Boolean(documentImage);
  const isDocumentCheckPending = isDocument && ['idle', 'checking'].includes(documentStatus);
  const showImagePreview = Boolean(image && !showOriginalPdf && !isDocumentCheckPending);
  const categoryClass = isCoverLetter ? 'is-cover-letter' : isDocument ? 'is-document' : isPortfolio ? 'is-portfolio' : isLinkedIn ? 'is-linkedin' : isGitHub ? 'is-github' : '';
  const emptyCopy = isDocument
    ? documentStatus === 'ready'
      ? ['No original PDF is associated with this project.', 'No approved image preview is available.']
      : documentStatus === 'error'
        ? ['The original PDF could not be checked.', 'Use “Retry PDF check” to check again. Private originals remain staff-only.']
        : ['No approved document preview is available.', 'Original documents are available only to authorized staff.']
    : isPortfolio
    ? ['No approved website screenshot is available.', 'The website can still be visited using its approved project link.']
    : isLinkedIn
      ? ['No approved LinkedIn preview is available.', 'No live profile is scraped or represented without approved material.']
      : isGitHub
        ? ['No approved GitHub preview is available.', 'No repository content or metrics are invented for this panel.']
        : ['No approved preview is available.', 'Approved Showcase material will appear here when available.'];
  useEffect(() => {
    setZoom(1);
    setRetryCount(0);
  }, [project?.project_id, index]);

  useEffect(() => {
    if (!mounted) return undefined;
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    const scrollY = window.scrollY;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth) {
      const currentPadding = Number.parseFloat(window.getComputedStyle(document.body).paddingRight) || 0;
      document.body.style.paddingRight = `${currentPadding + scrollbarWidth}px`;
    }
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      const previousScrollBehavior = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo(0, scrollY);
      document.documentElement.style.scrollBehavior = previousScrollBehavior;
    };
  }, [mounted]);

  useEffect(() => {
    if (open && !lightboxOpen && !wasLightboxOpenRef.current) closeRef.current?.focus({ preventScroll: true });
    wasLightboxOpenRef.current = lightboxOpen;
  }, [project?.project_id, open, lightboxOpen, closeRef]);

  useEffect(() => {
    if (!open || lightboxOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        const fullscreenElement = document.fullscreenElement;
        if (fullscreenElement && viewerRef.current?.contains(fullscreenElement)) {
          event.preventDefault();
          event.stopPropagation();
          void document.exitFullscreen?.().catch(() => {});
          return;
        }
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(viewerRef.current?.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])') || [])
        .filter((node) => !node.hasAttribute('hidden') && node.getAttribute('aria-hidden') !== 'true');
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !viewerRef.current.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !viewerRef.current.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, lightboxOpen, onClose, viewerRef]);

  if (!project) {
    return <aside ref={viewerRef} className="showcase-reference-viewer is-empty" aria-label="Selected project preview"><p className="eyebrow">PROJECT PREVIEW</p><strong>Select a published project</strong><span>Choose a project to inspect its approved preview images.</span></aside>;
  }

  return (
    <aside
      ref={viewerRef}
      id="showcase-project-preview"
      className={`showcase-reference-viewer ${categoryClass} ${showOriginalPdf ? 'is-pdf-mode' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="showcase-project-preview-title"
      aria-label={`Selected ${categoryLabel(project.service_category)} preview`}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => { if (showOriginalPdf || isDocument) event.preventDefault(); }}
    >
      {showOriginalPdf ? (
        <ShowcasePdfReader
          key={documentImage.id}
          image={documentImage}
          title={project.title}
          category={`${categoryLabel(project.service_category)} · ${projectTypeLabel(project.project_type)}`}
          authorized
          onClose={onClose}
          closeRef={closeRef}
          viewerRef={viewerRef}
        />
      ) : (
        <>
          <header className="showcase-reference-viewer-head">
            <div className="showcase-reference-viewer-heading">
              <h2 id="showcase-project-preview-title">{project.title}</h2>
              <p>{categoryLabel(project.service_category)} <span aria-hidden="true">·</span> {projectTypeLabel(project.project_type)}</p>
            </div>
            <div className="showcase-reference-viewer-tools" aria-label="Preview actions">
              {isPortfolio && portfolioUrl && <a className="showcase-reference-external-action" href={portfolioUrl} target="_blank" rel="noopener noreferrer">Visit website <span aria-hidden="true">↗</span></a>}
              {isLinkedIn && profileUrl && <a className="showcase-reference-external-action" href={profileUrl} target="_blank" rel="noopener noreferrer">Visit profile <span aria-hidden="true">↗</span></a>}
              {isGitHub && repositoryUrls.map((url) => <a className="showcase-reference-external-action" key={url} href={url} target="_blank" rel="noopener noreferrer">Visit repository <span aria-hidden="true">↗</span></a>)}
              {isDocument && documentStatus === 'error' && <button type="button" className="showcase-reference-external-action" onClick={onRetryDocumentCheck}>Retry PDF check</button>}
              {showImagePreview && (
                <div className="showcase-reference-zoom" role="group" aria-label="Preview zoom controls">
                  <button type="button" onClick={() => setZoom((value) => Math.max(.75, Math.round((value - .25) * 100) / 100))} disabled={zoom <= .75} aria-label="Zoom out">−</button>
                  <span aria-live="polite">{Math.round(zoom * 100)}%</span>
                  <button type="button" onClick={() => setZoom((value) => Math.min(2, Math.round((value + .25) * 100) / 100))} disabled={zoom >= 2} aria-label="Zoom in">+</button>
                </div>
              )}
              {showImagePreview && <button type="button" className="showcase-reference-fullscreen" onClick={onOpen} aria-label="Open full-screen approved preview">⛶</button>}
              <button ref={closeRef} type="button" className="showcase-reference-close" onClick={onClose} aria-label="Close project preview">×</button>
            </div>
          </header>
          <div className={`showcase-reference-viewer-body ${!isDocumentCheckPending && images.length > 1 ? 'has-thumbnails' : ''}`}>
            {!isDocumentCheckPending && images.length > 1 && (
              <nav className="showcase-reference-thumbnails" aria-label="Project preview images">
                {images.map((preview, previewIndex) => (
                  <button
                    type="button"
                    key={preview.id}
                    onClick={() => onChange(previewIndex)}
                    className={previewIndex === index ? 'is-active' : ''}
                    aria-current={previewIndex === index ? 'true' : undefined}
                    aria-label={`Show preview ${previewIndex + 1}: ${preview.alt_text || preview.caption || 'Project image'}`}
                  >
                    <span><ShowcaseImage image={preview} /></span>
                    <small>{previewIndex + 1}</small>
                  </button>
                ))}
              </nav>
            )}
            <div className={`showcase-reference-viewer-canvas ${isPortfolio ? 'is-portfolio-canvas' : ''}`}>
              {isDocumentCheckPending ? (
                <div className="showcase-document-fallback" role="status" aria-live="polite">Checking for this CV’s authorized original PDF…</div>
              ) : image ? isPortfolio ? (
                <figure className="showcase-reference-portfolio-frame">
                  <figcaption><span className="showcase-reference-browser-dots" aria-hidden="true">● ● ●</span><span>{portfolioUrl ? new URL(portfolioUrl).hostname : 'Approved website preview'}</span></figcaption>
                  <div className="showcase-reference-viewer-image" style={{ '--showcase-preview-zoom': zoom }}><ShowcaseImage key={`${image.id}-${retryCount}`} image={image} eager initialSrc={retryCount === 0 && initialPreviewSource?.id === image.id ? initialPreviewSource.src : ''} onRetry={() => setRetryCount((count) => count + 1)} /></div>
                </figure>
              ) : (
                <div className={`showcase-reference-viewer-image ${isDocument ? 'is-document-page' : 'is-profile-preview'}`} style={{ '--showcase-preview-zoom': zoom }}>
                  {isLinkedIn || isGitHub ? <span className="showcase-reference-preview-label">Approved Showcase preview · {isLinkedIn ? 'not a live LinkedIn page' : 'not a live GitHub page'}</span> : null}
                  <ShowcaseImage key={`${image.id}-${retryCount}`} image={image} eager initialSrc={retryCount === 0 && initialPreviewSource?.id === image.id ? initialPreviewSource.src : ''} onRetry={() => setRetryCount((count) => count + 1)} />
                </div>
              ) : <div className={`showcase-reference-viewer-empty ${categoryClass}`} role="status"><strong>{emptyCopy[0]}</strong><span>{emptyCopy[1]}</span></div>}
            </div>
          </div>
          <footer className="showcase-reference-viewer-foot">
            <span aria-live="polite">{image ? `Preview ${index + 1} of ${images.length}` : 'No approved preview'}</span>
            {!isDocumentCheckPending && images.length > 1 && (
              <div className="showcase-reference-page-controls">
                <button type="button" onClick={() => onChange(index - 1)} disabled={index <= 0} aria-label="Previous preview">‹</button>
                <button type="button" onClick={() => onChange(index + 1)} disabled={index >= images.length - 1} aria-label="Next preview">›</button>
              </div>
            )}
            <small>{isDocument ? isDocumentCheckPending ? 'Checking whether an authorized original PDF is associated with this project…' : documentStatus === 'error' ? 'The staff-only PDF association could not be checked. The approved image preview remains available.' : documentStatus === 'ready' ? 'No PDF document record is associated with this project. This image is only an approved preview.' : 'The original PDF is available only to authorized staff. Showing the approved image preview.' : isPortfolio ? 'Approved screenshot preview. External website opens separately.' : isLinkedIn ? 'Approved Showcase material only; no live LinkedIn content is embedded.' : isGitHub ? 'Approved Showcase material only; no repository metrics are inferred.' : 'Approved Showcase preview only.'}</small>
          </footer>
        </>
      )}
    </aside>
  );
}

export default function Showcase() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const requestedFilter = searchParams.get('filter');
  const legacyFilter = LEGACY_TAB_FILTERS[requestedTab];
  const activeFilter = SHOWCASE_FILTERS.find((filter) => filter.id === requestedFilter)
    || SHOWCASE_FILTERS.find((filter) => filter.id === legacyFilter)
    || SHOWCASE_FILTERS[0];
  const [projects, setProjects] = useState([]);
  const [state, setState] = useState('loading');
  const [failureKind, setFailureKind] = useState('unexpected');
  const [retryCount, setRetryCount] = useState(0);
  const [authRevision, setAuthRevision] = useState(0);
  const [documentsByProject, setDocumentsByProject] = useState({});
  const [documentsState, setDocumentsState] = useState('idle');
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [drawerMounted, setDrawerMounted] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [lightboxDocumentImage, setLightboxDocumentImage] = useState(null);
  const [selectedPreviewSource, setSelectedPreviewSource] = useState(null);
  const [lightboxPreviewSource, setLightboxPreviewSource] = useState(null);
  const selectedViewerRef = useRef(null);
  const closeButtonRef = useRef(null);
  const lightboxTriggerRef = useRef(null);
  const cardButtonRefs = useRef(new Map());
  const returnFocusRef = useRef(null);
  const drawerCloseTimerRef = useRef(null);
  const filterRefs = useRef([]);
  const retryPendingRef = useRef(false);
  const requestSequenceRef = useRef(0);

  useEffect(() => {
    if (!supabase?.auth) return undefined;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (['INITIAL_SESSION', 'SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED'].includes(event)) {
        setDocumentsByProject({});
        if (event === 'SIGNED_OUT') setLightboxDocumentImage(null);
        setAuthRevision((revision) => revision + 1);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;
    const requestId = ++requestSequenceRef.current;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), SHOWCASE_REQUEST_TIMEOUT_MS);
    setState('loading');
    if (!supabase) {
      setProjects([]);
      setState('unavailable');
      window.clearTimeout(timeout);
      return () => { active = false; controller.abort(); };
    }
    publishedShowcaseRequest(false, controller.signal)
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) throw queryError;
        setProjects(data || []);
        setState('ready');
      })
      .catch((requestError) => {
        if (!active) return;
        const httpStatus = requestError?.status;
        const failureType = classifyRequestFailure(requestError);
        console.error(`Showcase project request failed (${failureType})${httpStatus ? `, HTTP ${httpStatus}` : ''}.`);
        setFailureKind(failureType);
        setState('error');
      })
      .finally(() => {
        window.clearTimeout(timeout);
        if (requestSequenceRef.current === requestId) retryPendingRef.current = false;
      });
    return () => { active = false; window.clearTimeout(timeout); controller.abort(); };
  }, [retryCount]);

  useEffect(() => {
    let active = true;
    let requestTimedOut = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), SHOWCASE_REQUEST_TIMEOUT_MS);
    const documentProjectIds = projects
      .filter((project) => ['cv_demo', 'resume_demo', 'cover_letter_demo'].includes(project.service_category))
      .map((project) => project.project_id);

    const clearDocuments = (state = 'private') => {
      if (!active || (requestTimedOut && state !== 'error')) return;
      setDocumentsByProject({});
      setDocumentsState(state);
    };
    const loadAuthorizedDocuments = async () => {
      setDocumentsByProject({});
      if (!documentProjectIds.length) return clearDocuments('ready');
      if (!supabase) return clearDocuments('private');
      setDocumentsState('checking');
      const { data: sessionResult, error: sessionError } = await withTimeout(
        supabase.auth.getSession(),
        SHOWCASE_REQUEST_TIMEOUT_MS - 250,
        'The staff session check timed out.',
        () => controller.abort()
      );
      if (sessionError) throw sessionError;
      if (!sessionResult?.session?.access_token) return clearDocuments('private');

      // This RPC uses the same editor roles as the document-delivery function.
      const { data: isEditor, error: roleError } = await supabase.rpc('is_showcase_editor_v1').abortSignal(controller.signal);
      if (roleError) throw roleError;
      if (isEditor !== true) return clearDocuments('private');

      const { data, error } = await supabase
        .from('showcase_project_images')
        .select('id,project_id,presentation,sort_order,content_type,alt_text,caption')
        .in('project_id', documentProjectIds)
        .eq('content_type', 'application/pdf')
        .abortSignal(controller.signal);
      if (error) throw error;

      const preferredDocument = (rows) => rows.slice().sort((a, b) => {
        const priority = (presentation) => presentation === 'document_after' ? 0 : presentation === 'document' ? 1 : presentation === 'document_before' ? 2 : 3;
        return priority(a.presentation) - priority(b.presentation) || (a.sort_order ?? 0) - (b.sort_order ?? 0);
      })[0];
      const next = {};
      for (const row of data || []) {
        (next[row.project_id] ||= []).push(row);
      }
      for (const [projectId, rows] of Object.entries(next)) next[projectId] = preferredDocument(rows);
      if (active && !requestTimedOut && !controller.signal.aborted) {
        setDocumentsByProject(next);
        setDocumentsState('ready');
      }
    };

    withTimeout(
      loadAuthorizedDocuments(),
      SHOWCASE_REQUEST_TIMEOUT_MS,
      'The authorized PDF lookup timed out.',
      () => { requestTimedOut = true; controller.abort(); }
    )
      .catch(() => clearDocuments('error'))
      .finally(() => window.clearTimeout(timeout));
    return () => { active = false; window.clearTimeout(timeout); controller.abort(); };
  }, [projects, authRevision]);

  const visibleProjects = activeFilter.categories
    ? projects.filter((project) => activeFilter.categories.includes(project.service_category))
    : projects;
  const selectedProject = projects.find((project) => project.project_id === selectedProjectId) || null;
  const selectedImages = getPublicPreviewImages(selectedProject);
  const selectedDocument = selectedProject ? documentsByProject[selectedProject.project_id] || null : null;
  const selectedPreviewIndex = Math.min(previewIndex, Math.max(0, selectedImages.length - 1));

  const openDrawer = (project, cardElement, targetIndex = 0) => {
    if (drawerCloseTimerRef.current) window.clearTimeout(drawerCloseTimerRef.current);
    drawerCloseTimerRef.current = null;
    returnFocusRef.current = cardElement || cardButtonRefs.current.get(project.project_id) || document.activeElement;
    setSelectedProjectId(project.project_id);
    const targetImage = getPublicPreviewImages(project)[targetIndex];
    const source = loadedPreviewSource(cardElement, targetImage?.id);
    setSelectedPreviewSource(source ? { id: targetImage.id, src: source } : null);
    setPreviewIndex(targetIndex);
    setDrawerMounted(true);
    window.requestAnimationFrame(() => setDrawerOpen(true));
  };

  const closeDrawer = useCallback((restoreFocus = true) => {
    if (!drawerMounted) return;
    setDrawerOpen(false);
    if (restoreFocus) returnFocusRef.current?.focus?.({ preventScroll: true });
    if (drawerCloseTimerRef.current) window.clearTimeout(drawerCloseTimerRef.current);
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    drawerCloseTimerRef.current = window.setTimeout(() => {
      setDrawerMounted(false);
      setPreviewIndex(0);
      drawerCloseTimerRef.current = null;
    }, reducedMotion ? 0 : 240);
  }, [drawerMounted]);
  const handleCloseDrawer = useCallback(() => closeDrawer(), [closeDrawer]);
  const openDocumentLightbox = (documentImage) => {
    if (!documentImage) return;
    setLightboxIndex(null);
    setLightboxDocumentImage(documentImage);
  };
  const closeLightbox = () => {
    setLightboxIndex(null);
    setLightboxDocumentImage(null);
    setLightboxPreviewSource(null);
  };

  useEffect(() => () => {
    if (drawerCloseTimerRef.current) window.clearTimeout(drawerCloseTimerRef.current);
  }, []);

  const retryProjects = () => {
    if (retryPendingRef.current) return;
    retryPendingRef.current = true;
    setState('loading');
    setRetryCount((count) => count + 1);
  };

  const selectFilter = useCallback((filter, replace = false) => {
    closeDrawer(false);
    if (filter.id === 'all') setSearchParams({}, { replace });
    else setSearchParams({ filter: filter.id }, { replace });
  }, [closeDrawer, setSearchParams]);

  useEffect(() => {
    if (requestedFilter && !SHOWCASE_FILTERS.some((filter) => filter.id === requestedFilter)) {
      if (legacyFilter) setSearchParams({ filter: legacyFilter }, { replace: true });
      else setSearchParams({}, { replace: true });
    } else if (requestedTab && legacyFilter && requestedFilter !== legacyFilter) {
      setSearchParams({ filter: legacyFilter }, { replace: true });
    } else if (requestedTab && !legacyFilter) {
      setSearchParams({}, { replace: true });
    }
  }, [legacyFilter, requestedFilter, requestedTab, setSearchParams]);

  useEffect(() => {
    const revealActiveFilter = () => {
      const activeIndex = SHOWCASE_FILTERS.findIndex((filter) => filter.id === activeFilter.id);
      const activeButton = filterRefs.current[activeIndex];
      const filterList = activeButton?.parentElement;
      if (!activeButton || !filterList) return;
      const buttonLeft = activeButton.offsetLeft;
      const buttonRight = buttonLeft + activeButton.offsetWidth;
      const visibleLeft = filterList.scrollLeft;
      const visibleRight = visibleLeft + filterList.clientWidth;
      if (buttonLeft < visibleLeft) filterList.scrollLeft = buttonLeft;
      else if (buttonRight > visibleRight) filterList.scrollLeft = buttonRight - filterList.clientWidth;
    };
    revealActiveFilter();
    window.addEventListener('resize', revealActiveFilter);
    return () => window.removeEventListener('resize', revealActiveFilter);
  }, [activeFilter.id]);

  const onFilterKeyDown = (event, index) => {
    let nextIndex = null;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % SHOWCASE_FILTERS.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + SHOWCASE_FILTERS.length) % SHOWCASE_FILTERS.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = SHOWCASE_FILTERS.length - 1;
    if (nextIndex == null) return;
    event.preventDefault();
    selectFilter(SHOWCASE_FILTERS[nextIndex]);
    requestAnimationFrame(() => filterRefs.current[nextIndex]?.focus());
  };

  return (
    <>
      <PublicNav />
      <main className="showcase-page showcase-reference-page">
        <header className="showcase-hero showcase-reference-hero">
          <div className="showcase-hero-copy">
            <p className="eyebrow">{activeFilter.id === 'all' ? 'WORK SHOWCASE' : activeFilter.eyebrow}</p>
            <h1>{activeFilter.id === 'all' ? <>Published work.<br /><span>Sample projects.</span></> : activeFilter.heading}</h1>
          </div>
          <div className="showcase-hero-detail">
            <p>{activeFilter.description}</p>
            <div className="showcase-work-legend" aria-label="Project types">
              <span><i className="is-client" aria-hidden="true" />Client Work</span>
              <span><i className="is-sample" aria-hidden="true" />Sample Project</span>
            </div>
          </div>
          <div className="showcase-hero-mark" aria-hidden="true"><i /><i /><i /></div>
        </header>
        <section className="showcase-collection" aria-label="Showcase project collection">
          <div className="showcase-filter-list showcase-reference-filters" role="tablist" aria-label="Showcase categories">{SHOWCASE_FILTERS.map((filter, index) => <button ref={(node) => { filterRefs.current[index] = node; }} role="tab" id={`showcase-filter-${filter.id}`} aria-controls="showcase-projects-panel" aria-selected={activeFilter.id === filter.id} tabIndex={activeFilter.id === filter.id ? 0 : -1} type="button" key={filter.id} onClick={() => selectFilter(filter)} onKeyDown={(event) => onFilterKeyDown(event, index)}>{filter.label}</button>)}</div>
          <div id="showcase-projects-panel" role="tabpanel" aria-labelledby={`showcase-filter-${activeFilter.id}`} className="showcase-projects-panel" tabIndex={0}>
            <div className="showcase-reference-section-heading"><span className="eyebrow">{activeFilter.id === 'all' ? 'SELECTED WORK' : activeFilter.eyebrow}</span><span>{visibleProjects.length} {visibleProjects.length === 1 ? 'project' : 'projects'}</span></div>
            {state === 'loading' ? <div className="showcase-state is-loading"><SkeletonState label="Loading published projects" variant="cards" count={6} /></div>
              : state === 'error' ? <div className="showcase-state is-error"><RequestProblem kind={failureKind} onRetry={retryProjects} /></div>
                : state === 'unavailable' ? <div className="showcase-state"><strong>Showcase is unavailable in this environment.</strong><p>Connect to the Formant project to browse published work.</p></div>
                  : !visibleProjects.length ? <div className="showcase-state is-empty"><strong>{activeFilter.id === 'all' ? 'More work coming soon' : `More ${activeFilter.label} work coming soon`}</strong><p>We’re preparing more examples for this category. Check back soon.</p></div>
                    : <div className="showcase-reference-workspace">
                      <div className="showcase-reference-gallery">{visibleProjects.map((project, index) => <ShowcaseProjectCard key={project.project_id} project={project} eager={index < 3} buttonRef={(node) => { if (node) cardButtonRefs.current.set(project.project_id, node); else cardButtonRefs.current.delete(project.project_id); }} selected={selectedProjectId === project.project_id} previewOpen={drawerOpen && selectedProjectId === project.project_id} onSelect={(event) => openDrawer(project, event.currentTarget)} onOpenPreview={(index) => { const trigger = cardButtonRefs.current.get(project.project_id); lightboxTriggerRef.current = trigger; openDrawer(project, trigger, index); const image = getPublicPreviewImages(project)[index]; const source = loadedPreviewSource(trigger, image?.id); setLightboxPreviewSource(source ? { id: image.id, src: source } : null); setLightboxIndex(index); }} />)}</div>
                      {drawerMounted && <div className={`showcase-reference-drawer-shell ${drawerOpen ? 'is-open' : ''}`} aria-hidden={!drawerOpen} inert={!drawerOpen}>
                        <button type="button" tabIndex={-1} className="showcase-reference-drawer-backdrop" aria-label="Close project preview" onClick={handleCloseDrawer} />
                        <ShowcaseSelectedViewer key={selectedProject?.project_id || 'no-project'} viewerRef={selectedViewerRef} closeRef={closeButtonRef} onClose={handleCloseDrawer} open={drawerOpen} mounted={drawerMounted} lightboxOpen={lightboxIndex != null || Boolean(lightboxDocumentImage)} project={selectedProject} images={selectedImages} documentImage={selectedDocument} documentStatus={documentsState} onRetryDocumentCheck={() => setAuthRevision((revision) => revision + 1)} index={selectedPreviewIndex} onChange={setPreviewIndex} initialPreviewSource={selectedPreviewSource} onOpenDocument={(event) => { lightboxTriggerRef.current = event.currentTarget; openDocumentLightbox(selectedDocument); }} onOpen={(event) => { lightboxTriggerRef.current = event.currentTarget; const image = selectedImages[selectedPreviewIndex]; const source = loadedPreviewSource(selectedViewerRef.current, image?.id) || (selectedPreviewSource?.id === image?.id ? selectedPreviewSource.src : ''); setLightboxPreviewSource(source ? { id: image.id, src: source } : null); if (selectedImages.length) setLightboxIndex(selectedPreviewIndex); }} />
                      </div>}
                    </div>}
          </div>
        </section>
      </main>
      {lightboxDocumentImage && selectedProject && <ShowcaseLightbox images={[]} index={0} documentImage={lightboxDocumentImage} authorized isDocument title={`Original document · ${selectedProject.title}`} project={selectedProject} onClose={closeLightbox} onChange={() => {}} returnFocusElement={lightboxTriggerRef.current} />}
      {lightboxIndex != null && selectedProject && selectedImages.length > 0 && <ShowcaseLightbox images={selectedImages} index={Math.min(lightboxIndex, selectedImages.length - 1)} onClose={closeLightbox} onChange={setLightboxIndex} isDocument title={`Project preview · ${selectedProject.title}`} project={selectedProject} returnFocusElement={lightboxTriggerRef.current} initialSrc={lightboxPreviewSource?.id === selectedImages[Math.min(lightboxIndex, selectedImages.length - 1)]?.id ? lightboxPreviewSource.src : ''} />}
      <Footer />
    </>
  );
}
