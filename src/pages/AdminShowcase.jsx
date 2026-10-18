import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardShell from '../components/DashboardShell';
import { supabase } from '../lib/supabase';
import { SHOWCASE_TABS, SHOWCASE_MEDIA_PRESENTATIONS, SHOWCASE_DOCUMENT_PRESENTATIONS, categoryLabel, projectTypeLabel, safeShowcaseUrl, slugify } from '../lib/showcase';
import { ProjectGallery, ShowcaseDocument, ShowcaseImage } from './Showcase';
import './admin-showcase.css';

const EDITOR_ROLES = ['admin', 'expert', 'support'];
const STAFF_ROLES = [...EDITOR_ROLES, 'finance'];
const EMPTY_PROJECT = {
  id: null, title: '', slug: '', project_type: 'sample_project', service_category: 'cv_demo',
  short_description: '', long_description: '', display_order: 0, portfolio_url: '', portfolio_before_url: '',
  public_profile_url: '', public_repository_urls: [], external_link_label: '',
  is_published: false, is_featured: false, featured_order: 0,
  public_content_review_confirmed: false, client_consent_confirmed: false, published_at: null
};
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_PDF_BYTES = 15 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PRIVATE_SOURCE_PATH_PATTERN = /^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.webp$/i;
const PRIVATE_STORAGE_PATH_IN_MESSAGE_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/(?:sources\/)?[^\s,;"')]+/gi;
const PROJECT_SELECT = 'id,title,slug,project_type,service_category,short_description,long_description,display_order,portfolio_url,portfolio_before_url,public_profile_url,public_repository_urls,external_link_label,is_published,is_featured,featured_order,public_content_review_confirmed,client_consent_confirmed,created_at,updated_at,published_at,showcase_project_images(id,project_id,storage_path,presentation,sort_order,content_type,byte_size,alt_text,caption,is_public_preview,created_at)';

function mediaKind(image) {
  if (image?.content_type === 'application/pdf') return 'PDF';
  if (IMAGE_TYPES.includes(image?.content_type)) return 'Image';
  return 'Unsupported media';
}

function relatedPrivateSourcePath(storagePath) {
  const match = String(storagePath || '').match(PRIVATE_SOURCE_PATH_PATTERN);
  return match ? `${match[1]}/sources/${match[2]}.source` : '';
}

function redactPrivateStoragePaths(value) {
  return String(value || '').replace(PRIVATE_STORAGE_PATH_IN_MESSAGE_PATTERN, '[private storage path]');
}

function previewReadiness(project) {
  const media = project?.showcase_project_images || [];
  const hasApprovedImage = media.some((image) => image.content_type !== 'application/pdf' && image.is_public_preview);
  const reviewConfirmed = Boolean(project?.public_content_review_confirmed);
  const consentRequired = project?.project_type === 'client_work';
  const consentConfirmed = Boolean(project?.client_consent_confirmed);

  if (!media.length) return { label: 'No media', tone: 'muted' };
  if (!hasApprovedImage) return { label: 'No approved preview', tone: 'muted' };
  if (!reviewConfirmed) return { label: 'Privacy review needed', tone: 'attention' };
  if (consentRequired && !consentConfirmed) return { label: 'Client permission needed', tone: 'attention' };
  if (!project.is_published) return { label: 'Approved · draft only', tone: 'attention' };
  return { label: 'Public preview eligible', tone: 'ready' };
}

function manualPreviewStatus(project, image) {
  if (!image) return 'Unavailable · no preview image uploaded';
  if (!image.is_public_preview) return 'Uploaded · awaiting review';
  if (!project?.public_content_review_confirmed) return 'Approved image · privacy review required';
  if (project?.project_type === 'client_work' && !project?.client_consent_confirmed) return 'Approved image · client permission required';
  if (!project?.is_published) return 'Approved image · draft is not public';
  return 'Approved and eligible for public delivery';
}

async function hasSupportedFileSignature(file) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (file.type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.type === 'image/png') return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  if (file.type === 'image/webp') return String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if (file.type === 'application/pdf') return String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-';
  return false;
}

async function uploadRequestSignature(projectId, file, metadata = '') {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()));
  const fingerprint = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
  const signatureBytes = new TextEncoder().encode(`${projectId}:${fingerprint}:${metadata}`);
  const signatureDigest = new Uint8Array(await crypto.subtle.digest('SHA-256', signatureBytes));
  return Array.from(signatureDigest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function getOrCreateUploadRequest(ref, signature) {
  if (ref.current?.signature === signature) return ref.current;
  const key = `formant-showcase-upload:${signature}`;
  let id = '';
  try { id = sessionStorage.getItem(key) || ''; } catch { /* Keep retry safety for this page session if storage is unavailable. */ }
  if (!id) {
    id = crypto.randomUUID();
    try { sessionStorage.setItem(key, id); } catch { /* The component ref still preserves retries until unmount. */ }
  }
  ref.current = { signature, id, key };
  return ref.current;
}

function clearUploadRequest(ref) {
  if (ref.current?.key) {
    try { sessionStorage.removeItem(ref.current.key); } catch { /* The upload is already confirmed. */ }
  }
  ref.current = null;
}

async function uploadFileWithProgress(file, path, onProgress, { timeout = 0 } = {}) {
  const base = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  const { data, error } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (error || !base || !apiKey || !token) throw error || new Error('A valid staff session is required to upload Showcase media.');
  return new Promise((resolve, reject) => {
    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    const request = new XMLHttpRequest();
    request.open('POST', `${base}/storage/v1/object/showcase-media/${encodedPath}`);
    request.setRequestHeader('apikey', apiKey);
    request.setRequestHeader('Authorization', `Bearer ${token}`);
    request.setRequestHeader('Content-Type', file.type);
    request.setRequestHeader('x-upsert', 'false');
    request.setRequestHeader('cache-control', '3600');
    if (timeout > 0) request.timeout = timeout;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => request.status >= 200 && request.status < 300
      ? resolve()
      : reject(new Error(`Storage upload failed (${request.status}). ${request.responseText || ''}`.trim()));
    request.onerror = () => reject(new Error('Storage upload failed because the network request could not complete.'));
    request.ontimeout = () => reject(new Error('Storage upload timed out before its result was confirmed. Retry with the same PNG to safely resume this upload.'));
    request.onabort = () => reject(new Error('Storage upload was cancelled.'));
    request.send(file);
  });
}

async function findPrivateObject(path) {
  const [folder, name] = path.split('/');
  const { data, error } = await supabase.storage.from('showcase-media').list(folder, { search: name, limit: 10 });
  if (error) throw error;
  return (data || []).some((object) => object.name === name);
}

async function storedObjectMatchesFile(path, file) {
  const { data, error } = await supabase.storage.from('showcase-media').download(path);
  if (error || !data) throw error || new Error('The existing private image could not be read for retry verification.');
  if (data.size !== file.size) return false;
  const [storedDigest, selectedDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', await data.arrayBuffer()),
    crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  ]);
  const storedBytes = new Uint8Array(storedDigest);
  const selectedBytes = new Uint8Array(selectedDigest);
  return storedBytes.every((byte, index) => byte === selectedBytes[index]);
}

async function uploadPreviewImageWithProgress(file, projectId, altText, caption, replaceMediaId, uploadId, onProgress, presentation = 'thumbnail') {
  const base = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  const { data, error } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (error || !base || !apiKey || !token) throw error || new Error('A valid staff session is required to upload a preview image.');

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', `${base}/functions/v1/showcase-preview-upload`);
    request.timeout = 120000;
    request.setRequestHeader('apikey', apiKey);
    request.setRequestHeader('Authorization', `Bearer ${token}`);
    request.setRequestHeader('Content-Type', file.type);
    request.setRequestHeader('x-showcase-project-id', projectId);
    request.setRequestHeader('x-showcase-alt-text', encodeURIComponent(altText));
    request.setRequestHeader('x-showcase-caption', encodeURIComponent(caption));
    request.setRequestHeader('x-showcase-presentation', presentation);
    request.setRequestHeader('x-showcase-upload-id', uploadId);
    if (replaceMediaId) request.setRequestHeader('x-showcase-replace-media-id', replaceMediaId);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentage = Math.round((event.loaded / event.total) * 100);
        onProgress(percentage);
        if (percentage === 100) console.info('[showcase-preview-upload] request-body-sent');
      }
    };
    console.info('[showcase-preview-upload] request-sent');
    request.onload = () => {
      console.info('[showcase-preview-upload] response-received', { status: request.status });
      let result = {};
      try { result = JSON.parse(request.responseText || '{}'); } catch { /* The status still identifies a failed request. */ }
      if (request.status >= 200 && request.status < 300) resolve(result);
      else {
        const serverMessage = typeof result.error === 'string' ? result.error : '';
        const cleanupWarning = typeof result.cleanupWarning === 'string' ? ` ${result.cleanupWarning}` : '';
        const statusMessage = request.status === 401
          ? 'The upload function rejected the current session. Sign in again, then retry.'
          : request.status === 403
            ? 'The upload function denied access. Verify this account has an Admin, Expert, or Support role.'
            : request.status === 404
              ? 'The upload function was not found in the configured Supabase project. Verify that showcase-preview-upload is deployed there.'
              : request.status === 413
                ? 'The image exceeds the 8 MB upload limit.'
                : request.status === 415
                  ? 'The image bytes do not match the selected JPG, PNG, or WebP format.'
                  : `The upload function returned HTTP ${request.status}.`;
        reject(new Error(`${statusMessage}${serverMessage ? ` ${serverMessage}` : ''}${cleanupWarning}`));
      }
    };
    request.onerror = () => {
      const response = request.status ? `HTTP ${request.status}` : 'no readable HTTP response (status 0)';
      reject(new Error(`The browser received ${response} from the Showcase upload endpoint. This does not distinguish a network/TLS interruption from a blocked CORS preflight. In browser Network, inspect OPTIONS first and confirm it allows every requested header, including x-showcase-presentation; if OPTIONS succeeds, inspect the POST response. No successful upload was confirmed; verify the authorized project media list before retrying.`));
    };
    request.ontimeout = () => {
      console.warn('[showcase-preview-upload] request-timeout');
      reject(new Error('Preview upload timed out before its result was confirmed. Retry with the same selected file; the upload request is safely deduplicated.'));
    };
    request.onabort = () => reject(new Error('Preview upload was cancelled.'));
    request.send(file);
  });
}

function messageFor(error, fallback, request = 'the requested Showcase operation') {
  const code = String(error?.code || '');
  const status = Number(error?.status);
  const hasStatus = Number.isFinite(status) && status > 0;
  const detail = [
    hasStatus ? `HTTP ${status}` : '',
    code ? `Supabase code ${code}` : '',
    redactPrivateStoragePaths(error?.message)
  ].filter(Boolean).join(' · ');
  const context = `Request: ${request}.`;
  const diagnostic = detail ? ` Details: ${detail}` : '';
  const message = String(error?.message || '');

  if (status === 401) {
    return `Authentication failed while ${request}. Sign in again and retry.${diagnostic}`;
  }
  if (code === '42501' || status === 403) {
    return `Permission denied while ${request}. Check the signed-in staff role and Showcase access policies.${diagnostic}`;
  }
  if (code === '23514' && /showcase_public_content_review_before_publish_v1/i.test(message)) {
    return `The project cannot be published until its public-content privacy review is explicitly confirmed and saved.${diagnostic}`;
  }
  if (code === '23514' && /showcase_client_work_consent_before_publish_v1/i.test(message)) {
    return `Client work cannot be published until publication permission is explicitly confirmed and saved.${diagnostic}`;
  }
  if (status === 0 || /failed to fetch|networkerror|network request failed|connection (?:was )?lost/i.test(message)) {
    return `Network failure while ${request}. Check the connection to the configured Supabase project and try again.${diagnostic}`;
  }
  if (/^(PGRST20[01245]|42P01|42703)$/.test(code) || /schema cache|could not find (the )?(table|column|function|relationship)/i.test(message)) {
    return `A required Showcase table, column, relationship, or RPC is missing from the configured project or its schema cache while ${request}. Verify the target project and approved migrations.${diagnostic}`;
  }
  if (hasStatus && status >= 500) {
    return `The configured Supabase project returned a server error while ${request}.${diagnostic}`;
  }
  return `${fallback || 'Showcase request failed.'} ${context}${diagnostic}`.trim();
}

async function previewInvocationFailure(error) {
  const response = error?.context;
  const status = Number(response?.status || error?.status) || 0;
  let body = null;
  if (response && typeof response.json === 'function') {
    try { body = await response.json(); } catch { /* A non-JSON response still has a useful status. */ }
  }
  const code = String(body?.code || error?.code || '');
  const detail = String(body?.error || body?.message || '').replace(/\s+/g, ' ').slice(0, 320);

  if (error?.name === 'FunctionsFetchError') {
    return 'The browser did not receive a response from the Showcase preview Edge Function. This may be a network or CORS/connectivity failure; renderer receipt is unknown.';
  }
  if (error?.name === 'FunctionsRelayError') {
    return 'Supabase could not relay the request to the Showcase preview Edge Function. Renderer receipt is unknown.';
  }
  if (status === 404 && (code === 'NOT_FOUND' || /requested function was not found/i.test(detail))) {
    return 'The configured Supabase project does not have the showcase-preview-generate Edge Function deployed (HTTP 404). The renderer was not contacted.';
  }
  if (status === 401 || status === 403) {
    return `The Showcase preview Edge Function rejected the request (HTTP ${status}). Check the signed-in session and staff authorization.${detail ? ` ${detail}` : ''}`;
  }
  if (status) {
    return `The Showcase preview Edge Function returned HTTP ${status}.${detail ? ` ${detail}` : ''}`;
  }
  return `The Showcase preview request failed before a response was available (${error?.name || 'unknown invocation error'}).`;
}

function AdminPreview({ project, images, onClose }) {
  useEffect(() => {
    const previous = document.activeElement;
    document.body.classList.add('admin-showcase-preview-open');
    const keydown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('keydown', keydown);
      document.body.classList.remove('admin-showcase-preview-open');
      previous?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="admin-showcase-preview-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="admin-showcase-preview" role="dialog" aria-modal="true" aria-labelledby="admin-showcase-preview-title">
        <header><div><p className="eyebrow">DRAFT PREVIEW · STAFF ONLY</p><h2 id="admin-showcase-preview-title">{project.title || 'Untitled project'}</h2></div><button type="button" onClick={onClose} aria-label="Close draft preview">×</button></header>
        <p>{project.short_description}</p>
        <div className="admin-showcase-preview-meta"><span>{projectTypeLabel(project.project_type)}</span><span>{categoryLabel(project.service_category)}</span></div>
        {project.long_description && <p>{project.long_description}</p>}
        {!images.length ? <div className="admin-showcase-image-empty">No media added to this draft yet.</div> : <ProjectGallery project={{ ...project, project_id: project.id, images }} authorized />}
        <footer><button className="btn dark" type="button" onClick={onClose}>Back to editor</button></footer>
      </section>
    </div>
  );
}

export default function AdminShowcase() {
  const [access, setAccess] = useState('checking');
  const [role, setRole] = useState('');
  const [userId, setUserId] = useState('');
  const [projects, setProjects] = useState([]);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [featuredFilter, setFeaturedFilter] = useState('all');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewImageFile, setPreviewImageFile] = useState(null);
  const [previewImageUrl, setPreviewImageUrl] = useState('');
  const [previewImageError, setPreviewImageError] = useState('');
  const [previewImageProgress, setPreviewImageProgress] = useState(0);
  const [previewImageUploading, setPreviewImageUploading] = useState(false);
  const [previewImageSaving, setPreviewImageSaving] = useState(false);
  const [previewImageAlt, setPreviewImageAlt] = useState('');
  const [previewImageCaption, setPreviewImageCaption] = useState('');
  const [previewImageTargetId, setPreviewImageTargetId] = useState('');
  const [previewImageDragging, setPreviewImageDragging] = useState(false);
  const [uploadPresentation, setUploadPresentation] = useState('gallery');
  const [uploadAlt, setUploadAlt] = useState('');
  const [uploadCaption, setUploadCaption] = useState('');
  const [imageEdits, setImageEdits] = useState({});
  const [preview, setPreview] = useState(null);
  const [previewGeneration, setPreviewGeneration] = useState(null);
  const [previewRequestActive, setPreviewRequestActive] = useState(false);
  const previewRequestLock = useRef(false);
  const previewImageUploadRequest = useRef(null);
  const projectImageUploadRequest = useRef(null);
  const projectBaseline = useRef(null);
  const currentEditorProjectId = useRef(null);
  currentEditorProjectId.current = project?.id || null;

  const loadProjects = useCallback(async () => {
    if (!supabase) {
      setAccess('unavailable');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    let failedRequest = 'checking the signed-in account';
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user) {
        setAccess('denied');
        setLoading(false);
        return;
      }
      const currentUser = authData.user;
      failedRequest = 'checking the current user role with public.user_roles';
      const { data: roleRow, error: roleError } = await supabase.from('user_roles').select('role').eq('user_id', currentUser.id).maybeSingle();
      if (roleError) throw roleError;
      const currentRole = String(roleRow?.role || '').trim().toLowerCase();
      setRole(currentRole);
      setUserId(currentUser.id);
      if (!STAFF_ROLES.includes(currentRole)) {
        setAccess('denied');
        setLoading(false);
        return;
      }
      setAccess(EDITOR_ROLES.includes(currentRole) ? 'editor' : 'readonly');
      failedRequest = 'loading Showcase projects from public.showcase_projects with related public.showcase_project_images';
      const { data, error: listError } = await supabase.from('showcase_projects')
        .select(PROJECT_SELECT)
        .order('is_featured', { ascending: false })
        .order('updated_at', { ascending: false });
      if (listError) throw listError;
      setProjects((data || []).map((row) => ({ ...row, showcase_project_images: [...(row.showcase_project_images || [])].sort((a, b) => a.sort_order - b.sort_order) })).sort((a, b) => Number(b.is_featured) - Number(a.is_featured) || Number(a.is_featured ? a.featured_order : a.display_order) - Number(b.is_featured ? b.featured_order : b.display_order) || new Date(b.updated_at) - new Date(a.updated_at)));
    } catch (loadError) {
      setAccess('error');
      setError(messageFor(loadError, 'Showcase access could not be checked.', failedRequest));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadProjects(); }, [loadProjects]);

  const visibleProjects = useMemo(() => projects.filter((row) => {
    if (filter === 'draft' && row.is_published) return false;
    if (filter === 'published' && !row.is_published) return false;
    if (categoryFilter !== 'all' && row.service_category !== categoryFilter) return false;
    if (typeFilter !== 'all' && row.project_type !== typeFilter) return false;
    if (featuredFilter === 'featured' && !row.is_featured) return false;
    if (featuredFilter === 'not-featured' && row.is_featured) return false;
    return !search || `${row.title} ${row.slug} ${categoryLabel(row.service_category)}`.toLowerCase().includes(search.toLowerCase());
  }), [projects, filter, categoryFilter, typeFilter, featuredFilter, search]);

  const canEdit = access === 'editor';
  const currentPreviewReadiness = project ? previewReadiness(project) : null;
  const hasUnsavedChanges = Boolean(project && projectBaseline.current && (
    JSON.stringify(project) !== JSON.stringify(projectBaseline.current)
    || (project.showcase_project_images || []).some((image) => {
      const edit = imageEdits[image.id];
      return edit && (edit.alt_text !== image.alt_text || edit.caption !== image.caption || Boolean(edit.is_public_preview) !== Boolean(image.is_public_preview));
    })
  ));
  const presentationOptions = (SHOWCASE_MEDIA_PRESENTATIONS[project?.service_category] || SHOWCASE_MEDIA_PRESENTATIONS.cv_demo)
    .filter((option) => option.value !== 'thumbnail');
  const uploadIsDocument = SHOWCASE_DOCUMENT_PRESENTATIONS.includes(uploadPresentation);
  const previewImageRows = (project?.showcase_project_images || []).filter((image) => image.presentation === 'thumbnail' && IMAGE_TYPES.includes(image.content_type));
  const otherMediaRows = (project?.showcase_project_images || []).filter((image) => !(image.presentation === 'thumbnail' && IMAGE_TYPES.includes(image.content_type)));
  const originalPdfExists = (project?.showcase_project_images || []).some((image) => image.content_type === 'application/pdf');
  const projectPubliclyEligible = Boolean(project?.is_published && project?.public_content_review_confirmed
    && (project?.project_type !== 'client_work' || project?.client_consent_confirmed));
  const hasEligiblePublicPreview = projectPubliclyEligible && (project?.showcase_project_images || []).some((image) => IMAGE_TYPES.includes(image.content_type) && image.is_public_preview);

  useEffect(() => {
    if (!previewImageFile) {
      setPreviewImageUrl('');
      return undefined;
    }
    const objectUrl = URL.createObjectURL(previewImageFile);
    setPreviewImageUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [previewImageFile]);

  async function refreshProject(projectId) {
    const { data, error } = await supabase.from('showcase_projects').select(PROJECT_SELECT).eq('id', projectId).single();
    if (error) throw error;
    const refreshed = { ...data, showcase_project_images: [...(data.showcase_project_images || [])].sort((a, b) => a.sort_order - b.sort_order) };
    projectBaseline.current = refreshed;
    setProject(refreshed);
    return refreshed;
  }

  function beginNew() {
    if (hasUnsavedChanges && !window.confirm('Discard unsaved Showcase changes and start a new project?')) return;
    const nextProject = { ...EMPTY_PROJECT };
    projectBaseline.current = nextProject;
    setProject(nextProject);
    setPreviewGeneration(null);
    setUploadPresentation(SHOWCASE_MEDIA_PRESENTATIONS.cv_demo[0].value);
    setImageEdits({});
    setPreviewImageFile(null);
    setPreviewImageError('');
    setPreviewImageTargetId('');
    setPreviewImageAlt('');
    setPreviewImageCaption('');
    setError('');
    setNotice('');
  }

  function beginEdit(row) {
    if (hasUnsavedChanges && !window.confirm('Discard unsaved Showcase changes and switch projects?')) return;
    projectBaseline.current = { ...row };
    setProject({ ...row });
    setPreviewGeneration(null);
    setUploadPresentation(SHOWCASE_MEDIA_PRESENTATIONS[row.service_category]?.[0]?.value || 'gallery');
    setImageEdits(Object.fromEntries((row.showcase_project_images || []).map((image) => [image.id, { alt_text: image.alt_text, caption: image.caption, is_public_preview: image.is_public_preview }])));
    setPreviewImageFile(null);
    setPreviewImageError('');
    setPreviewImageTargetId('');
    setPreviewImageAlt('');
    setPreviewImageCaption('');
    setError('');
    setNotice('');
  }

  function updateProject(key, value) {
    setProject((current) => ({ ...current, [key]: value }));
    setError('');
    setNotice('');
  }

  async function selectPreviewImage(file) {
    const targetProjectId = currentEditorProjectId.current;
    setPreviewImageFile(null);
    setPreviewImageError('');
    if (!file) return;
    if (file.type !== 'image/png') {
      setPreviewImageError('Choose a PNG preview image.');
      return;
    }
    if (file.size < 1 || file.size > MAX_IMAGE_BYTES) {
      setPreviewImageError('Preview images must be no larger than 8 MB.');
      return;
    }
    try {
      if (!(await hasSupportedFileSignature(file))) {
        setPreviewImageError('The file contents do not match the selected PNG type.');
        return;
      }
    } catch {
      setPreviewImageError('The selected image could not be inspected. Choose it again and retry.');
      return;
    }
    if (currentEditorProjectId.current !== targetProjectId) return;
    setPreviewImageFile(file);
  }

  async function uploadManualPreviewImage(event) {
    event.preventDefault();
    if (!project?.id) {
      setPreviewImageError('Save the project as a draft before adding a preview image.');
      return;
    }
    if (!previewImageFile) {
      setPreviewImageError('Choose a PNG image first.');
      return;
    }
    if (!previewImageAlt.trim()) {
      setPreviewImageError('Add descriptive alt text before uploading this preview.');
      return;
    }
    setPreviewImageUploading(true);
    setPreviewImageProgress(0);
    setPreviewImageSaving(false);
    setPreviewImageError('');
    setError('');
    try {
      const requestSignature = await uploadRequestSignature(project.id, previewImageFile, JSON.stringify([
        previewImageAlt.trim(), previewImageCaption.trim(), previewImageTargetId, 'thumbnail'
      ]));
      const uploadRequest = getOrCreateUploadRequest(previewImageUploadRequest, requestSignature);
      const storagePath = `${project.id}/${uploadRequest.id}.png`;
      const { data: priorMedia, error: priorMediaError } = await supabase.from('showcase_project_images')
        .select('id,project_id,storage_path,presentation,sort_order,content_type,byte_size,alt_text,caption,created_by,is_public_preview')
        .eq('storage_path', storagePath)
        .maybeSingle();
      if (priorMediaError) throw priorMediaError;

      let savedMedia = priorMedia;
      if (savedMedia && (savedMedia.project_id !== project.id || savedMedia.presentation !== 'thumbnail'
        || savedMedia.is_public_preview || savedMedia.content_type !== 'image/png'
        || savedMedia.byte_size !== previewImageFile.size || savedMedia.alt_text !== previewImageAlt.trim()
        || savedMedia.caption !== previewImageCaption.trim() || savedMedia.created_by !== userId)) {
        throw new Error('A different preview record already uses this upload request. No file was overwritten; contact an administrator before retrying.');
      }

      if (!savedMedia) {
        let objectExists = await findPrivateObject(storagePath);
        if (objectExists && !(await storedObjectMatchesFile(storagePath, previewImageFile))) {
          throw new Error('A different file already occupies this private upload location. No file was overwritten; contact an administrator before retrying.');
        }
        if (!objectExists) {
          try {
            await uploadFileWithProgress(previewImageFile, storagePath, setPreviewImageProgress, { timeout: 120000 });
          } catch (storageError) {
            // A timed-out response can leave a completed object behind. Reconcile
            // by the stable request path and exact bytes before allowing retry.
            objectExists = await findPrivateObject(storagePath);
            if (!objectExists || !(await storedObjectMatchesFile(storagePath, previewImageFile))) throw storageError;
          }
        }

        setPreviewImageSaving(true);
        const existingPreview = previewImageTargetId
          ? project.showcase_project_images?.find((image) => image.id === previewImageTargetId && image.presentation === 'thumbnail')
          : null;
        if (previewImageTargetId && !existingPreview) throw new Error('The preview selected for replacement is no longer available. Refresh the project and choose it again.');
        const sortOrder = existingPreview?.sort_order ?? Math.max(-1, ...(project.showcase_project_images || []).map((image) => image.sort_order || 0)) + 1;
        const { data: insertedMedia, error: insertError } = await supabase.from('showcase_project_images').insert({
          project_id: project.id,
          storage_path: storagePath,
          presentation: 'thumbnail',
          sort_order: sortOrder,
          content_type: 'image/png',
          byte_size: previewImageFile.size,
          alt_text: previewImageAlt.trim(),
          caption: previewImageCaption.trim(),
          created_by: userId,
          is_public_preview: false
        }).select('id,project_id,storage_path,presentation,sort_order,content_type,byte_size,alt_text,caption,created_by,is_public_preview').single();
        if (insertError) {
          // Another tab may have completed the same stable upload request.
          const { data: reconciledMedia, error: reconcileError } = await supabase.from('showcase_project_images')
            .select('id,project_id,storage_path,presentation,sort_order,content_type,byte_size,alt_text,caption,created_by,is_public_preview')
            .eq('storage_path', storagePath)
            .maybeSingle();
          if (reconcileError) throw new Error(`${insertError.message} The private upload was retained because the metadata result could not be verified. Check the project media list before retrying.`);
          if (!reconciledMedia) {
            const { error: cleanupError } = await supabase.storage.from('showcase-media').remove([storagePath]);
            if (cleanupError) throw new Error(`${insertError.message} The metadata row was not found, but private Storage cleanup failed. Contact an administrator before retrying.`);
            throw insertError;
          }
          if (reconciledMedia.project_id !== project.id || reconciledMedia.presentation !== 'thumbnail'
            || reconciledMedia.is_public_preview || reconciledMedia.content_type !== 'image/png'
            || reconciledMedia.byte_size !== previewImageFile.size || reconciledMedia.alt_text !== previewImageAlt.trim()
            || reconciledMedia.caption !== previewImageCaption.trim() || reconciledMedia.created_by !== userId) throw insertError;
          savedMedia = reconciledMedia;
        } else {
          savedMedia = insertedMedia;
        }
      }

      setPreviewImageProgress(100);
      setPreviewImageSaving(true);
      if (previewImageTargetId) {
        const { data: retiredMedia, error: retireError } = await supabase.from('showcase_project_images')
          .update({ presentation: 'gallery', is_public_preview: false })
          .eq('id', previewImageTargetId)
          .eq('project_id', project.id)
          .select('id')
          .maybeSingle();
        if (retireError) throw retireError;
        if (!retiredMedia) throw new Error('The new PNG is saved privately and remains unapproved, but the previous preview could not be moved to the private gallery. Retry this same upload to finish replacement.');
      }

      clearUploadRequest(previewImageUploadRequest);
      setPreviewImageFile(null);
      setPreviewImageAlt('');
      setPreviewImageCaption('');
      setPreviewImageTargetId('');
      setNotice('PNG uploaded unchanged to private storage and left unapproved. Review it before marking it for public preview.');
      // A completed upload is terminal for the button state. Refreshes are
      // secondary and bounded so a slow list query cannot leave it disabled.
      setPreviewImageUploading(false);
      const projectId = project.id;
      try {
        await Promise.race([
          (async () => {
            await loadProjects();
            const refreshed = await refreshProject(projectId);
            const uploadVerified = savedMedia?.id && refreshed.showcase_project_images?.some((image) => image.id === savedMedia.id);
            if (!uploadVerified) throw new Error('The saved preview was not found in the authorized media list.');
            setImageEdits(Object.fromEntries((refreshed.showcase_project_images || []).map((image) => [image.id, { alt_text: image.alt_text, caption: image.caption, is_public_preview: image.is_public_preview }])));
          })(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Project refresh timed out.')), 15000))
        ]);
      } catch {
        console.warn('[showcase-preview-image] upload-confirmed-refresh-incomplete');
        setNotice('Preview image upload succeeded and remains private/unapproved. The project list did not refresh; refresh the project before attempting another upload.');
      }
    } catch (uploadError) {
      setPreviewImageError(messageFor(uploadError, 'PNG preview upload failed.'));
    } finally {
      setPreviewImageSaving(false);
      setPreviewImageUploading(false);
    }
  }

  async function persistProject({ forceDraft = false } = {}) {
    if (!supabase || !project || !canEdit || saving) return null;
    if (forceDraft && project.is_published && !window.confirm('Save these changes as a draft? This will unpublish the project and stop public preview delivery.')) return null;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const title = String(project.title || '').trim();
      const slug = String(project.slug || slugify(title)).trim().toLowerCase();
      if (!title || !slug) throw new Error('Add a title and a URL-friendly slug before saving.');
      const isPortfolio = project.service_category === 'portfolio_website_demo';
      const isProfile = ['linkedin_before_after', 'github_before_after'].includes(project.service_category);
      const isGithub = project.service_category === 'github_before_after';
      for (const [label, value] of [['Website URL', isPortfolio ? project.portfolio_url : ''], ['Before website URL', isPortfolio ? project.portfolio_before_url : ''], ['Profile URL', isProfile ? project.public_profile_url : '']]) {
        if (String(value || '').trim() && !safeShowcaseUrl(value)) throw new Error(`${label} must start with http:// or https://.`);
      }
      const repositoryUrls = isGithub ? (Array.isArray(project.public_repository_urls) ? project.public_repository_urls : String(project.public_repository_urls || '').split('\n')).map((value) => String(value || '').trim()).filter(Boolean) : [];
      if (repositoryUrls.some((value) => !safeShowcaseUrl(value))) throw new Error('Every repository URL must start with http:// or https://.');
      const payload = {
        title,
        slug,
        project_type: project.project_type,
        service_category: project.service_category,
        short_description: String(project.short_description || '').trim(),
        long_description: String(project.long_description || '').trim(),
        display_order: Math.max(0, Math.floor(Number(project.display_order) || 0)),
        portfolio_url: isPortfolio ? safeShowcaseUrl(project.portfolio_url) || null : null,
        portfolio_before_url: isPortfolio ? safeShowcaseUrl(project.portfolio_before_url) || null : null,
        public_profile_url: isProfile ? safeShowcaseUrl(project.public_profile_url) || null : null,
        public_repository_urls: repositoryUrls.map(safeShowcaseUrl).filter(Boolean),
        external_link_label: isPortfolio ? String(project.external_link_label || '').trim() || null : null,
        is_published: forceDraft ? false : Boolean(project.is_published),
        is_featured: Boolean(project.is_featured),
        featured_order: Math.max(0, Math.floor(Number(project.featured_order) || 0)),
        public_content_review_confirmed: Boolean(project.public_content_review_confirmed),
        client_consent_confirmed: Boolean(project.client_consent_confirmed),
        updated_by: userId,
        published_at: project.is_published && !forceDraft ? (project.published_at || new Date().toISOString()) : (forceDraft ? null : project.published_at)
      };
      let result;
      if (project.id) {
        result = await supabase.from('showcase_projects').update(payload).eq('id', project.id).select('id,is_published,published_at,public_content_review_confirmed,client_consent_confirmed').single();
      } else {
        result = await supabase.from('showcase_projects').insert({ ...payload, created_by: userId }).select('id,is_published,published_at,public_content_review_confirmed,client_consent_confirmed').single();
      }
      if (result.error) throw result.error;
      const wasPublished = Boolean(project.is_published);
      const approvalWasCleared = (project.public_content_review_confirmed && !result.data.public_content_review_confirmed)
        || (project.client_consent_confirmed && !result.data.client_consent_confirmed);
      const nextProject = {
        ...project,
        ...payload,
        id: result.data.id,
        is_published: result.data.is_published,
        published_at: result.data.published_at,
        public_content_review_confirmed: result.data.public_content_review_confirmed,
        client_consent_confirmed: result.data.client_consent_confirmed
      };
      projectBaseline.current = nextProject;
      setProject(nextProject);
      await loadProjects();
      setNotice(forceDraft ? 'Draft saved. It is not available to public visitors.' : (wasPublished && !result.data.is_published) || approvalWasCleared ? 'Public content changed. Publication approval was cleared; review and confirm it again before publishing.' : 'Project changes saved.');
      return nextProject;
    } catch (saveError) {
      setError(messageFor(saveError, 'Project could not be saved.'));
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish() {
    if (!project?.id || !canEdit || !supabase || saving) return;
    const nextPublished = !project.is_published;
    if (!window.confirm(nextPublished
      ? 'Publish this Showcase project? Approved public previews will become visible to visitors.'
      : 'Unpublish this Showcase project? Public preview delivery will stop.')) return;
    if (nextPublished && !project.public_content_review_confirmed) {
      setError('Confirm the public-content privacy review before publishing.');
      return;
    }
    if (nextPublished && project.project_type === 'client_work' && !project.client_consent_confirmed) {
      setError('Confirm that permission to publish this client work has been obtained before publishing.');
      return;
    }

    // Persist the explicit review and consent confirmations before setting
    // is_published. The database constraint checks stored values, not the
    // current checkbox state in React. Re-read the saved flags because the
    // publication invalidation trigger may clear them when content changed.
    if (nextPublished) {
      const savedProject = await persistProject();
      if (!savedProject) return;
      if (!savedProject.public_content_review_confirmed) {
        setError('The privacy review was not saved. Review the current public content and confirm it again before publishing.');
        return;
      }
      if (savedProject.project_type === 'client_work' && !savedProject.client_consent_confirmed) {
        setError('Client publication permission was not saved. Confirm the permission again before publishing.');
        return;
      }
    }

    setSaving(true);
    setError('');
    try {
      const { error: publishError } = await supabase.from('showcase_projects').update({
        is_published: nextPublished,
        published_at: nextPublished ? (project.published_at || new Date().toISOString()) : null,
        updated_by: userId
      }).eq('id', project.id);
      if (publishError) throw publishError;
      setProject((current) => ({ ...current, is_published: nextPublished, published_at: nextPublished ? (current.published_at || new Date().toISOString()) : null }));
      projectBaseline.current = { ...project, is_published: nextPublished, published_at: nextPublished ? (project.published_at || new Date().toISOString()) : null };
      setNotice(nextPublished ? 'Project published.' : 'Project unpublished. Public image delivery is now blocked.');
      await loadProjects();
    } catch (publishError) {
      setError(messageFor(publishError, 'Publication status could not be changed.'));
    } finally {
      setSaving(false);
    }
  }

  async function uploadImage(event) {
    event.preventDefault();
    if (uploading) return;
    const uploadForm = event.currentTarget;
    const file = uploadForm.elements.namedItem('showcase-file')?.files?.[0];
    if (!project?.id) {
      setError('Save the project as a draft before adding images.');
      return;
    }
    if (!file) return;
    if (uploadPresentation === 'thumbnail') {
      setError('Use the dedicated finished PNG preview uploader for project covers.');
      return;
    }
    const isDocument = SHOWCASE_DOCUMENT_PRESENTATIONS.includes(uploadPresentation);
    const validType = isDocument ? file.type === 'application/pdf' : IMAGE_TYPES.includes(file.type);
    const maxBytes = isDocument ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
    if (!validType || file.size > maxBytes) {
      setError(isDocument ? 'Choose a PDF document up to 15 MB.' : 'Choose a JPEG, PNG or WebP image up to 8 MB.');
      return;
    }
    try {
      if (!(await hasSupportedFileSignature(file))) {
        setError('The file contents do not match the selected PDF or image type. Choose a valid PDF, JPEG, PNG or WebP file.');
        return;
      }
    } catch {
      setError('The selected file could not be inspected. Choose it again and retry.');
      return;
    }
    if (!String(uploadAlt || '').trim()) {
      setError('Add descriptive alt text before uploading this image.');
      return;
    }
    const extension = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
    const path = `${project.id}/${crypto.randomUUID()}.${extension}`;
    setUploading(true);
    setUploadProgress(0);
    setError('');
    try {
      const needsFreshReview = Boolean(project.is_published || project.public_content_review_confirmed || project.client_consent_confirmed);
      const order = project.showcase_project_images?.length || 0;
      if (isDocument) {
        await uploadFileWithProgress(file, path, setUploadProgress);
        const { error: rowError } = await supabase.from('showcase_project_images').insert({
          project_id: project.id, storage_path: path, presentation: uploadPresentation,
          sort_order: order, content_type: file.type, byte_size: file.size,
          alt_text: uploadAlt.trim(), caption: uploadCaption.trim(), created_by: userId,
          is_public_preview: false
        });
        if (rowError) {
          const { error: cleanupError } = await supabase.storage.from('showcase-media').remove([path]);
          if (cleanupError) throw new Error(`${rowError.message} Uploaded object cleanup also failed; a private orphan may remain at ${path}. ${cleanupError.message}`);
          throw rowError;
        }
      } else {
        const requestSignature = await uploadRequestSignature(project.id, file, JSON.stringify([
          uploadAlt.trim(), uploadCaption.trim(), uploadPresentation
        ]));
        const uploadRequest = getOrCreateUploadRequest(projectImageUploadRequest, requestSignature);
        await uploadPreviewImageWithProgress(
          file, project.id, uploadAlt.trim(), uploadCaption.trim(), '', uploadRequest.id, setUploadProgress, uploadPresentation
        );
        clearUploadRequest(projectImageUploadRequest);
      }
      uploadForm.reset();
      setUploadAlt('');
      setUploadCaption('');
      setNotice(isDocument
        ? (needsFreshReview ? 'PDF uploaded privately. Publication approval was cleared; review the updated public content before publishing again.' : 'PDF uploaded to private Showcase storage.')
        : (needsFreshReview ? 'Image resized and logo-watermarked by the private renderer, then stored privately and left unapproved. Publication review was cleared.' : 'Image resized and logo-watermarked by the private renderer, then stored privately and left unapproved. Review it before marking it as a public preview.'));
      setUploading(false);
      const uploadedProjectId = project.id;
      try {
        await Promise.race([
          (async () => {
            await loadProjects();
            await refreshProject(uploadedProjectId);
          })(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Project refresh timed out.')), 15000))
        ]);
      } catch {
        console.warn('[showcase-preview-upload] upload-confirmed-refresh-incomplete');
        setNotice('Upload succeeded. The project list did not refresh; refresh the project before attempting another upload.');
      }
    } catch (uploadError) {
      setError(messageFor(uploadError, 'Image upload failed.'));
    } finally {
      setUploading(false);
    }
  }

  async function generatePreview(kind, sourceMedia = null) {
    if (!canEdit || !project?.id || (kind === 'pdf' && sourceMedia?.content_type !== 'application/pdf')) return;
    if (previewRequestLock.current) return;
    previewRequestLock.current = true;
    setPreviewRequestActive(true);
    setError('');
    setPreviewGeneration({ projectId: project.id, sourceMediaId: sourceMedia?.id || null, status: 'processing', message: kind === 'pdf' ? 'Rendering private PDF pages…' : 'Capturing the saved public website URL…' });
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('showcase-preview-generate', {
        body: { kind, projectId: project.id, ...(sourceMedia ? { sourceMediaId: sourceMedia.id } : {}) },
      });
      if (invokeError) {
        const invocationError = new Error(await previewInvocationFailure(invokeError));
        invocationError.name = 'PreviewInvocationError';
        throw invocationError;
      }
      if (data?.status !== 'succeeded') {
        const responseError = new Error(`The preview Edge Function responded but generation failed.${data?.error ? ` ${String(data.error).slice(0, 500)}` : ''}`);
        responseError.name = 'PreviewGenerationError';
        throw responseError;
      }
      setPreviewGeneration({
        projectId: project.id,
        sourceMediaId: sourceMedia?.id || null,
        status: 'succeeded',
        message: `${data.previewCount} private preview${data.previewCount === 1 ? '' : 's'} generated. Each remains unapproved until staff review.`,
        overview: data.overview,
      });
      await loadProjects();
      await refreshProject(project.id);
    } catch (generationError) {
      const failure = ['PreviewInvocationError', 'PreviewGenerationError'].includes(generationError?.name)
        ? generationError.message
        : messageFor(generationError, 'Preview generation failed.', 'generating a private Showcase preview');
      setPreviewGeneration({ projectId: project.id, sourceMediaId: sourceMedia?.id || null, status: 'failed', message: failure });
      setError(failure);
    } finally {
      previewRequestLock.current = false;
      setPreviewRequestActive(false);
    }
  }

  async function saveImageMetadata(image) {
    const edit = imageEdits[image.id] || image;
    if (!String(edit.alt_text || '').trim()) {
      setError('Every public image needs descriptive alt text.');
      return;
    }
    setError('');
    setNotice('');
    const projectId = project.id;
    const desiredPreviewFlag = image.content_type !== 'application/pdf' && Boolean(edit.is_public_preview);
    const { data: savedImage, error: updateError } = await supabase.from('showcase_project_images').update({
      alt_text: edit.alt_text.trim(),
      caption: String(edit.caption || '').trim(),
      is_public_preview: desiredPreviewFlag
    }).eq('id', image.id).eq('project_id', projectId)
      .select('id,project_id,alt_text,caption,is_public_preview').single();
    if (updateError) setError(messageFor(updateError, 'Image details could not be saved.'));
    else if (!savedImage || savedImage.id !== image.id || savedImage.project_id !== projectId
      || savedImage.alt_text !== edit.alt_text.trim()
      || savedImage.caption !== String(edit.caption || '').trim()
      || savedImage.is_public_preview !== desiredPreviewFlag) {
      setError('The saved preview details could not be confirmed. Refresh the project and check its saved media status before continuing.');
    }
    else {
      await loadProjects();
      try {
        const refreshed = await refreshProject(projectId);
        const refreshedImage = (refreshed.showcase_project_images || []).find((row) => row.id === image.id);
        setImageEdits(Object.fromEntries((refreshed.showcase_project_images || []).map((row) => [row.id, {
          alt_text: row.alt_text,
          caption: row.caption,
          is_public_preview: row.is_public_preview
        }])));
        if (!refreshedImage || refreshedImage.is_public_preview !== desiredPreviewFlag
          || refreshedImage.alt_text !== savedImage.alt_text || refreshedImage.caption !== savedImage.caption) {
          setError('The preview update response succeeded, but the refreshed project does not match it. Check the saved media row before continuing.');
          return;
        }
        const projectPubliclyEligible = refreshed.is_published && refreshed.public_content_review_confirmed
          && (refreshed.project_type !== 'client_work' || refreshed.client_consent_confirmed);
        if (desiredPreviewFlag && !projectPubliclyEligible) {
          setNotice('Preview approval saved. This project is not currently eligible for public delivery; complete the required privacy review, client permission if applicable, and publication steps.');
        } else if (desiredPreviewFlag) {
          setNotice('Preview approval saved and the project is currently eligible for public delivery.');
        } else {
          setNotice('Media details saved. This image remains private and is not included in public previews.');
        }
      } catch (error) {
        setError(messageFor(error, 'Updated project could not be reloaded.'));
        return;
      }
    }
  }

  async function moveImage(image, direction) {
    const rows = [...(project.showcase_project_images || [])].sort((a, b) => a.sort_order - b.sort_order);
    const index = rows.findIndex((row) => row.id === image.id);
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const first = rows[index];
    const second = rows[target];
    const { error: firstError } = await supabase.from('showcase_project_images').update({ sort_order: second.sort_order }).eq('id', first.id);
    if (firstError) { setError(messageFor(firstError, 'Image order could not be changed.')); return; }
    const { error: secondError } = await supabase.from('showcase_project_images').update({ sort_order: first.sort_order }).eq('id', second.id);
    if (secondError) {
      setError(messageFor(secondError, 'Image order could not be changed.'));
      try { await refreshProject(project.id); } catch (error) { setError(`${messageFor(secondError, 'Image order could not be changed.')} ${messageFor(error, 'Updated project could not be reloaded.')}`); }
      return;
    }
    await loadProjects();
    try { await refreshProject(project.id); } catch (error) { setError(messageFor(error, 'Updated project could not be reloaded.')); }
  }

  async function removeImage(image) {
    if (!window.confirm(`Remove this ${image.presentation} image from the project?`)) return;
    setError('');
    const { error: rowError } = await supabase.from('showcase_project_images').delete().eq('id', image.id);
    if (rowError) { setError(messageFor(rowError, 'Image details could not be removed. The Storage object was left untouched.')); return; }

    // Remove metadata first so the approval invalidation trigger runs before
    // touching Storage. If Storage cleanup fails, the unreferenced object is
    // still private and can be safely removed later without restoring bytes.
    const sourcePath = relatedPrivateSourcePath(image.storage_path);
    const cleanupPaths = [image.storage_path, ...(sourcePath ? [sourcePath] : [])];
    const { error: storageError } = await supabase.storage.from('showcase-media').remove(cleanupPaths);
    const cleanupNotice = storageError
      ? 'Image removed from the project, but private Storage cleanup could not be confirmed. Ask an administrator to review the cleanup operation.'
      : 'Image removed.';
    await loadProjects();
    try {
      await refreshProject(project.id);
      const reviewNotice = project.is_published || project.public_content_review_confirmed || project.client_consent_confirmed
        ? ' Publication approval was cleared and must be renewed.'
        : '';
      setNotice(`${cleanupNotice}${reviewNotice}`);
    } catch (error) { setError(messageFor(error, 'Updated project could not be reloaded.')); }
  }

  async function deleteProject(row) {
    if (!window.confirm(`Delete “${row.title}” and its Showcase images? This action cannot be undone.`)) return;
    setError('');
    const images = row.showcase_project_images || [];
    const { error: deleteError } = await supabase.from('showcase_projects').delete().eq('id', row.id);
    if (deleteError) { setError(messageFor(deleteError, 'Project could not be deleted. Its Storage objects were left untouched.')); return; }

    // Database deletion is atomic and cascades image metadata. Only after it
    // succeeds do we clean up private Storage objects. Failed cleanup leaves
    // private, unreferenced paths; no overwrite-based rollback is needed.
    const paths = images.flatMap((image) => {
      const sourcePath = relatedPrivateSourcePath(image.storage_path);
      return [image.storage_path, ...(sourcePath ? [sourcePath] : [])];
    });
    const { error: storageError } = paths.length
      ? await supabase.storage.from('showcase-media').remove(paths)
      : { error: null };
    setNotice(storageError
      ? 'Project and metadata were deleted, but private Storage cleanup could not be confirmed. Ask an administrator to review the cleanup operation.'
      : 'Project and associated images deleted.');
    if (project?.id === row.id) setProject(null);
    await loadProjects();
  }

  async function openPreview() {
    if (!project?.id) return;
    setPreview({ project, images: project.showcase_project_images || [] });
  }

  async function moveProject(row, direction) {
    if (!canEdit) return;
    const ordered = [...projects].filter((item) => item.is_featured === row.is_featured).sort((a, b) => {
      const key = row.is_featured ? 'featured_order' : 'display_order';
      return Number(a[key] || 0) - Number(b[key] || 0) || new Date(b.updated_at) - new Date(a.updated_at);
    });
    const index = ordered.findIndex((item) => item.id === row.id);
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    const key = row.is_featured ? 'featured_order' : 'display_order';
    const [moved] = ordered.splice(index, 1);
    ordered.splice(target, 0, moved);
    for (const [nextOrder, item] of ordered.entries()) {
      const { error: orderError } = await supabase.from('showcase_projects').update({ [key]: nextOrder, updated_by: userId }).eq('id', item.id);
      if (orderError) { setError(messageFor(orderError, 'Project order could not be changed.')); await loadProjects(); return; }
    }
    setNotice(row.is_featured ? 'Featured project order updated.' : 'Project display order updated.');
    await loadProjects();
  }

  function projectMoveDisabled(row, direction) {
    const key = row.is_featured ? 'featured_order' : 'display_order';
    const ordered = projects.filter((item) => item.is_featured === row.is_featured).sort((a, b) => Number(a[key] || 0) - Number(b[key] || 0) || new Date(b.updated_at) - new Date(a.updated_at));
    const index = ordered.findIndex((item) => item.id === row.id);
    return index + direction < 0 || index + direction >= ordered.length;
  }

  function clearEditor() {
    if (hasUnsavedChanges && !window.confirm('Discard unsaved Showcase changes?')) return;
    projectBaseline.current = null;
    setProject(null);
    setPreviewGeneration(null);
    setError('');
    setNotice('');
  }

  if (access === 'unavailable') return <DashboardShell admin><main className="admin-showcase-page"><div className="admin-showcase-state"><h1>Showcase management</h1><p>Supabase must be configured before Showcase content can be managed.</p></div></main></DashboardShell>;
  if (access === 'checking' && loading) return <DashboardShell admin><main className="admin-showcase-page"><div className="admin-showcase-state" role="status">Checking staff access…</div></main></DashboardShell>;
  if (access === 'denied') return <DashboardShell admin><main className="admin-showcase-page"><div className="admin-showcase-state" role="alert"><h1>Staff access required</h1><p>Your account cannot manage Showcase content.</p></div></main></DashboardShell>;
  if (access === 'error') return <DashboardShell admin><main className="admin-showcase-page"><div className="admin-showcase-state" role="alert"><h1>Showcase access could not be checked</h1><p>{error || 'A connection error occurred.'}</p><button type="button" className="btn light" onClick={() => void loadProjects()}>Try again</button></div></main></DashboardShell>;

  return (
    <DashboardShell admin>
      <main className="admin-showcase-page">
        <header className="admin-showcase-header"><div><p className="eyebrow">ADMIN · CONTENT</p><h1>Showcase management</h1><p>Manage approved work shown to public visitors. Draft media remains in private storage.</p></div><div className="admin-showcase-header-actions"><Link className="btn light" to="/showcase" target="_blank" rel="noreferrer">View public Showcase ↗</Link>{canEdit && <button className="btn lime" type="button" onClick={beginNew}>New project +</button>}</div></header>
        {error && <div className="admin-showcase-alert is-error" role="alert">{error}</div>}
        {notice && <div className="admin-showcase-alert" role="status">{notice}</div>}
        {!canEdit && access === 'readonly' && <div className="admin-showcase-alert">Finance role has read-only access to Showcase content.</div>}
        <section className="admin-showcase-stats" aria-label="Showcase project totals">
          {[['Total projects', projects.length], ['Published', projects.filter((row) => row.is_published).length], ['Drafts', projects.filter((row) => !row.is_published).length], ['Featured', projects.filter((row) => row.is_featured).length]].map(([label, count]) => <article key={label}><span>{label}</span><strong>{count}</strong></article>)}
        </section>
        <div className="admin-showcase-layout">
          <section className="admin-showcase-list-panel" aria-label="Showcase projects">
            <header className="admin-showcase-list-heading"><div><p className="eyebrow">STEP 1 · SELECT PROJECT</p><h2>Projects</h2></div><span>{visibleProjects.length} shown</span></header>
            <div className="admin-showcase-list-tools">
              <label className="span-two"><span className="sr-only">Search Showcase projects</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search projects" /></label>
              <label><span className="sr-only">Filter by publication</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All statuses</option><option value="draft">Drafts</option><option value="published">Published</option></select></label>
              <label><span className="sr-only">Filter by category</span><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">All categories</option>{SHOWCASE_TABS.map((tab) => <option key={tab.category} value={tab.category}>{tab.label}</option>)}</select></label>
              <label><span className="sr-only">Filter by project type</span><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">All project types</option><option value="client_work">Client Work</option><option value="sample_project">Sample Project</option></select></label>
              <label><span className="sr-only">Filter by featured state</span><select value={featuredFilter} onChange={(event) => setFeaturedFilter(event.target.value)}><option value="all">Featured and unfeatured</option><option value="featured">Featured</option><option value="not-featured">Not featured</option></select></label>
            </div>
            {loading ? <div className="admin-showcase-state" role="status">Loading projects…</div> : !visibleProjects.length ? <div className="admin-showcase-state"><strong>No projects found.</strong><p>Create a draft when verified work or approved sample assets are ready.</p></div> : <div className="admin-showcase-list">{visibleProjects.map((row) => { const images = row.showcase_project_images || []; const thumb = images.find((image) => image.presentation === 'thumbnail' && IMAGE_TYPES.includes(image.content_type)) || images.find((image) => IMAGE_TYPES.includes(image.content_type)); const readiness = previewReadiness(row); return <article className={`admin-showcase-list-item${project?.id === row.id ? ' is-selected' : ''}`} key={row.id}><div className="admin-showcase-list-thumb">{thumb ? <ShowcaseImage image={thumb} authorized /> : <span aria-hidden="true">◌</span>}</div><div className="admin-showcase-list-copy"><div className="admin-showcase-item-meta"><span className={`admin-showcase-status${row.is_published ? ' is-published' : ''}`}>{row.is_published ? 'Published' : 'Draft'}</span><span>{projectTypeLabel(row.project_type)}</span></div><h2>{row.title}</h2><p>{categoryLabel(row.service_category)} · {row.showcase_project_images?.length || 0} media{row.is_featured ? ` · Featured #${row.featured_order + 1}` : ''}</p><span className={`admin-showcase-preview-status is-${readiness.tone}`}>{readiness.label}</span></div><div className="admin-showcase-item-actions"><button type="button" onClick={() => beginEdit(row)} aria-pressed={project?.id === row.id}>{project?.id === row.id ? 'Selected' : 'Edit'}</button><button type="button" onClick={() => void moveProject(row, -1)} disabled={!canEdit || projectMoveDisabled(row, -1)} aria-label={`Move ${row.title} earlier`}>↑</button><button type="button" onClick={() => void moveProject(row, 1)} disabled={!canEdit || projectMoveDisabled(row, 1)} aria-label={`Move ${row.title} later`}>↓</button><button type="button" onClick={() => deleteProject(row)} disabled={!canEdit}>Delete</button></div></article>; })}</div>}
          </section>

          <section className="admin-showcase-editor" aria-label="Showcase project editor">
            {!project ? <div className="admin-showcase-state"><span className="showcase-empty-mark" aria-hidden="true">✳</span><strong>Select a project to edit</strong><p>Or create a new draft when the project material and approval are ready.</p></div> : <div>
              <div className="admin-showcase-editor-head"><div><p className="eyebrow">{project.id ? (project.is_published ? 'PUBLISHED PROJECT' : 'DRAFT PROJECT') : 'NEW PROJECT'}{hasUnsavedChanges ? ' · UNSAVED CHANGES' : ''}</p><h2>{project.title || 'New Showcase project'}</h2></div><button type="button" className="admin-showcase-close" onClick={clearEditor} aria-label="Close editor">×</button></div>
              <div className="admin-showcase-readiness" aria-label="Project media and publication readiness"><div><span>Media</span><strong>{project.showcase_project_images?.length || 0} item{project.showcase_project_images?.length === 1 ? '' : 's'}</strong></div><div><span>Preview</span><strong className={`is-${currentPreviewReadiness.tone}`}>{currentPreviewReadiness.label}</strong></div><div><span>Privacy review</span><strong>{project.public_content_review_confirmed ? 'Confirmed' : 'Required before publishing'}</strong></div>{project.project_type === 'client_work' && <div><span>Client permission</span><strong>{project.client_consent_confirmed ? 'Confirmed' : 'Required before publishing'}</strong></div>}</div>
              <fieldset className="admin-showcase-fields" disabled={!canEdit}><div className="admin-showcase-form-grid">
                <h3 className="admin-showcase-section-label span-two">Overview</h3>
                <label className="span-two">Project title<input required maxLength={120} value={project.title} onChange={(event) => { updateProject('title', event.target.value); if (!project.id && !project.slug) updateProject('slug', slugify(event.target.value)); }} /></label>
                <label className="span-two">Stable URL slug<input required maxLength={140} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={project.slug || slugify(project.title)} onChange={(event) => updateProject('slug', slugify(event.target.value))} /></label>
                <label>Project type<select value={project.project_type} onChange={(event) => updateProject('project_type', event.target.value)}><option value="sample_project">Sample Project</option><option value="client_work">Client Work</option></select></label>
        <label>Service category<select value={project.service_category} onChange={(event) => { const nextCategory = event.target.value; updateProject('service_category', nextCategory); setUploadPresentation((SHOWCASE_MEDIA_PRESENTATIONS[nextCategory] || SHOWCASE_MEDIA_PRESENTATIONS.cv_demo).find((option) => option.value !== 'thumbnail')?.value || 'gallery'); }}>{SHOWCASE_TABS.map((tab) => <option key={tab.category} value={tab.category}>{tab.label}</option>)}</select></label>
                <h3 className="admin-showcase-section-label span-two">Content</h3>
                <label className="span-two">Short description<textarea rows={3} maxLength={500} value={project.short_description} onChange={(event) => updateProject('short_description', event.target.value)} /></label>
                <label className="span-two">Long description<textarea rows={4} maxLength={2000} value={project.long_description || ''} onChange={(event) => updateProject('long_description', event.target.value)} /></label>
                {project.service_category === 'portfolio_website_demo' && <>
                  <label>Website URL<input type="url" placeholder="https://example.com" value={project.portfolio_url || ''} onChange={(event) => updateProject('portfolio_url', event.target.value)} /></label>
                  <label>Before website URL<input type="url" placeholder="https://example.com/before" value={project.portfolio_before_url || ''} onChange={(event) => updateProject('portfolio_before_url', event.target.value)} /></label>
                  <label>External link label<input maxLength={60} value={project.external_link_label || ''} placeholder="Visit Website" onChange={(event) => updateProject('external_link_label', event.target.value)} /></label>
                </>}
                {['linkedin_before_after', 'github_before_after'].includes(project.service_category) && <label>Public profile URL<input type="url" placeholder="https://…" value={project.public_profile_url || ''} onChange={(event) => updateProject('public_profile_url', event.target.value)} /></label>}
                {project.service_category === 'github_before_after' && <label className="span-two">Public repository URLs<textarea rows={3} placeholder="One https:// URL per line" value={Array.isArray(project.public_repository_urls) ? project.public_repository_urls.join('\n') : project.public_repository_urls || ''} onChange={(event) => updateProject('public_repository_urls', event.target.value)} /></label>}
              </div>
              {project.id && <section className="admin-showcase-images"><header><div><h3>Original documents and finished previews</h3><p>Original PDFs stay editor-only. Manually uploaded PNG previews are stored unchanged and remain unapproved until a staff member reviews them. Only approved previews on a reviewed, published project are public.</p></div></header>
                <h4 className="admin-showcase-step-title">Step 2 · Inspect original PDFs and supporting media</h4>
                {!otherMediaRows.length ? <div className="admin-showcase-image-empty">No original documents or additional media uploaded yet.</div> : <div className="admin-showcase-image-list">{otherMediaRows.map((image) => { const mediaIndex = project.showcase_project_images.findIndex((row) => row.id === image.id); const isPdf = image.content_type === 'application/pdf'; return <article className={`admin-showcase-image-row${isPdf ? ' is-document' : ''}`} key={image.id}><div className={`admin-showcase-thumb${isPdf ? ' is-document' : ''}`}>{isPdf ? <ShowcaseDocument image={image} authorized /> : <ShowcaseImage image={image} authorized />}</div><div className="admin-showcase-image-fields"><strong>{image.presentation.replaceAll('_', ' ')} · {mediaKind(image)}</strong><label>Alt text<input value={imageEdits[image.id]?.alt_text ?? image.alt_text} maxLength={240} onChange={(event) => setImageEdits((current) => ({ ...current, [image.id]: { ...image, ...current[image.id], alt_text: event.target.value } }))} /></label><label>Caption<input value={imageEdits[image.id]?.caption ?? image.caption} maxLength={240} onChange={(event) => setImageEdits((current) => ({ ...current, [image.id]: { ...image, ...current[image.id], caption: event.target.value } }))} /></label>{!isPdf && <label className="admin-showcase-consent"><input type="checkbox" checked={Boolean(imageEdits[image.id]?.is_public_preview ?? image.is_public_preview)} onChange={(event) => setImageEdits((current) => ({ ...current, [image.id]: { ...image, ...current[image.id], is_public_preview: event.target.checked } }))} /><span><strong>Use as public preview</strong><small>Review the image with its official Formant symbol mark first. Saving approval clears project review and publication so the content can be reviewed again.</small></span></label>}<div className="admin-showcase-image-actions"><button type="button" onClick={() => void moveImage(image, -1)} disabled={!canEdit || mediaIndex === 0}>Move up</button><button type="button" onClick={() => void moveImage(image, 1)} disabled={!canEdit || mediaIndex === project.showcase_project_images.length - 1}>Move down</button><button type="button" onClick={() => void saveImageMetadata(image)} disabled={!canEdit}>Save media details</button>{isPdf && <button type="button" onClick={() => void generatePreview('pdf', image)} disabled={!canEdit || previewRequestActive}>{previewGeneration?.projectId === project.id && previewGeneration.status === 'processing' ? 'Generating…' : 'Generate private page previews'}</button>}<button type="button" className="is-danger" onClick={() => void removeImage(image)} disabled={!canEdit}>Remove</button></div></div>{previewGeneration?.sourceMediaId === image.id && previewGeneration.status !== 'processing' && <div className={`admin-showcase-generation-status is-${previewGeneration.status}`} role={previewGeneration.status === 'failed' ? 'alert' : 'status'}><strong>{previewGeneration.message}</strong>{previewGeneration.overview?.title && <span>Page title: {previewGeneration.overview.title}</span>}{previewGeneration.overview?.description && <span>Page overview: {previewGeneration.overview.description}</span>}</div>}</article>; })}</div>}
                {canEdit && <form className="admin-showcase-upload" onSubmit={uploadImage}><h4>Upload original PDF or supporting media</h4><p className="admin-showcase-upload-guidance">Original PDFs are stored privately and can be inspected above. Other supporting images continue through the existing private renderer and remain unapproved. Use the finished PNG workflow below for an unchanged cover image; it cannot assign or approve that cover.</p><div className="admin-showcase-form-grid"><label>File<input name="showcase-file" type="file" accept={uploadIsDocument ? 'application/pdf' : 'image/jpeg,image/png,image/webp'} required /></label><label>Presentation<select value={uploadPresentation} onChange={(event) => setUploadPresentation(event.target.value)}>{presentationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label className="span-two">Descriptive alt text<input required maxLength={240} value={uploadAlt} onChange={(event) => setUploadAlt(event.target.value)} /></label><label className="span-two">Optional caption<input maxLength={240} value={uploadCaption} onChange={(event) => setUploadCaption(event.target.value)} /></label></div>{uploading && <div className="admin-showcase-upload-progress" role="status">{uploadIsDocument ? uploadProgress >= 100 ? 'PDF stored; saving private media record…' : `Uploading PDF ${uploadProgress}%` : uploadProgress >= 100 ? 'Image sent; waiting for private renderer…' : `Sending image to private renderer ${uploadProgress}%`}<progress max="100" value={uploadProgress} /></div>}<button className="btn dark" type="submit" disabled={uploading}>{uploading ? uploadProgress >= 100 ? 'Waiting for server…' : `Uploading ${uploadProgress}%…` : `Upload ${uploadIsDocument ? 'PDF' : 'supporting image'}`}</button></form>}
                <section className="admin-showcase-manual-preview" aria-labelledby="admin-showcase-preview-image-title">
                  <header><div><h4 id="admin-showcase-preview-image-title">Step 3 · Finished PNG preview</h4><p>Upload a finished PNG. Its original bytes are stored privately and displayed as uploaded; it remains unapproved until a human review.</p></div><span className={`admin-showcase-preview-status is-${previewImageRows.some((image) => image.is_public_preview) ? (hasEligiblePublicPreview ? 'ready' : 'attention') : 'muted'}`}>{previewImageRows.length ? manualPreviewStatus(project, previewImageRows.find((image) => image.is_public_preview) || previewImageRows[0]) : manualPreviewStatus(project, null)}</span></header>
                  {originalPdfExists && !hasEligiblePublicPreview && <p className="admin-showcase-preview-warning" role="status">An original PDF is present, but no eligible public preview is available. The PDF remains private; upload and review a separate preview image.</p>}
                  {previewImageRows.length > 0 && <div className="admin-showcase-manual-preview-list">{previewImageRows.map((image) => <article className="admin-showcase-manual-preview-row" key={image.id}>
                    <div className="admin-showcase-manual-preview-thumb"><ShowcaseImage image={image} authorized /></div>
                    <div className="admin-showcase-manual-preview-fields"><strong>{manualPreviewStatus(project, image)}</strong><span>{image.content_type} · {(image.byte_size / 1024 / 1024).toFixed(2)} MB</span>
                      <label>Alt text<input value={imageEdits[image.id]?.alt_text ?? image.alt_text} maxLength={240} onChange={(event) => setImageEdits((current) => ({ ...current, [image.id]: { ...image, ...current[image.id], alt_text: event.target.value } }))} /></label>
                      <label>Caption<input value={imageEdits[image.id]?.caption ?? image.caption} maxLength={240} onChange={(event) => setImageEdits((current) => ({ ...current, [image.id]: { ...image, ...current[image.id], caption: event.target.value } }))} /></label>
                      <label className="admin-showcase-consent"><input type="checkbox" checked={Boolean(imageEdits[image.id]?.is_public_preview ?? image.is_public_preview)} onChange={(event) => setImageEdits((current) => ({ ...current, [image.id]: { ...image, ...current[image.id], is_public_preview: event.target.checked } }))} /><span><strong>Use as public preview</strong><small>Only after a human privacy review. Saving this approval clears project review and publication; review and publish again when ready.</small></span></label>
                      <div className="admin-showcase-image-actions"><button type="button" onClick={() => { setPreviewImageTargetId(image.id); setPreviewImageFile(null); setPreviewImageError(''); }}>Replace image</button><button type="button" onClick={() => void saveImageMetadata(image)} disabled={!canEdit}>Save preview details</button><button type="button" className="is-danger" onClick={() => void removeImage(image)} disabled={!canEdit}>Remove preview</button></div>
                    </div>
                  </article>)}</div>}
                  {canEdit && <form className="admin-showcase-preview-upload" onSubmit={uploadManualPreviewImage}>
                    <div className={`admin-showcase-preview-dropzone${previewImageDragging ? ' is-dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setPreviewImageDragging(true); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPreviewImageDragging(false); }} onDrop={(event) => { event.preventDefault(); setPreviewImageDragging(false); void selectPreviewImage(event.dataTransfer.files?.[0]); }}>
                      {previewImageUrl && <img className="admin-showcase-preview-selected-image" src={previewImageUrl} alt="Selected preview image before upload" />}
                      <div><strong>{previewImageFile ? previewImageFile.name : 'Choose or drop a PNG image'}</strong><span>Maximum 8 MB. The PNG is uploaded unchanged to private Showcase storage.</span><label className="admin-showcase-preview-file-label">Browse image<input type="file" accept="image/png,.png" onChange={(event) => { void selectPreviewImage(event.target.files?.[0]); event.target.value = ''; }} /></label></div>
                    </div>
                    {previewImageTargetId && <div className="admin-showcase-preview-replacing" role="status">Replacing the selected preview. The previous image will be kept as private gallery media and unapproved. <button type="button" onClick={() => setPreviewImageTargetId('')}>Cancel replacement</button></div>}
                    <div className="admin-showcase-preview-upload-fields"><label>Descriptive alt text<input required maxLength={240} value={previewImageAlt} onChange={(event) => setPreviewImageAlt(event.target.value)} /></label><label>Optional caption<input maxLength={240} value={previewImageCaption} onChange={(event) => setPreviewImageCaption(event.target.value)} /></label></div>
                    {previewImageError && <p className="admin-showcase-preview-upload-error" role="alert">{previewImageError}</p>}
                    {previewImageUploading && <div className="admin-showcase-upload-progress" role="status">{previewImageSaving ? 'Saving private preview details…' : previewImageProgress >= 100 ? 'PNG transfer complete; waiting for server confirmation…' : `Uploading PNG ${previewImageProgress}%`}<progress max="100" value={previewImageProgress} /></div>}
                    <button className="btn dark" type="submit" disabled={previewImageUploading || !previewImageFile || !project.id}>{previewImageUploading ? (previewImageSaving ? 'Saving preview…' : previewImageProgress >= 100 ? 'Waiting for confirmation…' : `Uploading PNG ${previewImageProgress}%…`) : previewImageTargetId ? 'Upload replacement preview' : 'Upload finished PNG preview'}</button>
                  </form>}
                </section>
                {project.service_category === 'portfolio_website_demo' && <div className="admin-showcase-generation"><p>Generate a screenshot and extract the page title and description from the saved HTTPS website URL. The capture service blocks private networks and unsafe redirects.</p><button type="button" className="btn light" disabled={!canEdit || !safeShowcaseUrl(project.portfolio_url)?.startsWith('https://') || previewRequestActive} onClick={() => void generatePreview('website')}>{previewGeneration?.projectId === project.id && previewGeneration.status === 'processing' ? 'Generating website preview…' : 'Generate website screenshot'}</button>{previewGeneration?.projectId === project.id && <div className={`admin-showcase-generation-status is-${previewGeneration.status}`} role={previewGeneration.status === 'failed' ? 'alert' : 'status'}><strong>{previewGeneration.message}</strong>{previewGeneration.overview?.title && <span>Page title: {previewGeneration.overview.title}</span>}{previewGeneration.overview?.description && <span>Page overview: {previewGeneration.overview.description}</span>}</div>}</div>}
              </section>}
              <section className="admin-showcase-publishing" aria-labelledby="admin-showcase-publishing-title">
                <header className="admin-showcase-step-heading"><span>STEP 4</span><div><h3 id="admin-showcase-publishing-title">Human review and publication</h3><p>Review preview eligibility, public-content privacy, client permission, and featuring separately. Saving an image preview does not publish the project.</p></div></header>
                <div className="admin-showcase-form-grid">
                <label className="admin-showcase-consent span-two"><input type="checkbox" checked={project.public_content_review_confirmed} onChange={(event) => updateProject('public_content_review_confirmed', event.target.checked)} /><span><strong>Public-content privacy review complete</strong><small>Review every public title, description, URL, document, screenshot and caption. Anonymize names and remove contact details, account identifiers, QR codes and internal notes before publishing.</small></span></label>
                {project.project_type === 'client_work' && <label className="admin-showcase-consent span-two"><input type="checkbox" checked={project.client_consent_confirmed} onChange={(event) => updateProject('client_consent_confirmed', event.target.checked)} /><span><strong>Publication permission confirmed</strong><small>Confirm that permission to publish this specific client work has been obtained. No repository consent policy was found; this confirmation is an internal publication gate, not a substitute for recorded consent.</small></span></label>}
                <label className="admin-showcase-check"><input type="checkbox" checked={project.is_featured} onChange={(event) => updateProject('is_featured', event.target.checked)} /><span>Feature on homepage</span></label>
                <label>Featured order<input type="number" min="0" step="1" value={project.featured_order} onChange={(event) => updateProject('featured_order', event.target.value)} /></label>
                <label>Display order<input type="number" min="0" step="1" value={project.display_order ?? 0} onChange={(event) => updateProject('display_order', event.target.value)} /></label>
                {['cv_demo', 'resume_demo', 'cover_letter_demo'].includes(project.service_category) && <p className="admin-showcase-private-note span-two">Original PDFs remain private and can be viewed only by authorized staff. Public PDF delivery is disabled.</p>}
                </div>
              </section>
              </fieldset>
              <footer className="admin-showcase-editor-actions">{canEdit && <><button className="btn light" type="button" disabled={saving} title="Save current fields and keep the project unpublished." onClick={() => void persistProject({ forceDraft: true })}>Save as draft</button><button className="btn dark" type="button" disabled={saving} title="Save current fields while preserving the publication state; content changes can clear approval." onClick={() => void persistProject()}>{saving ? 'Saving…' : 'Save changes'}</button>{project.id && <><button className="btn light" type="button" onClick={() => void openPreview()}>Preview draft</button><button className={`btn ${project.is_published ? 'light' : 'lime'}`} type="button" disabled={saving} onClick={() => void togglePublish()}>{project.is_published ? 'Unpublish' : 'Publish'}</button></>}</>}</footer>
            </div>}
          </section>
        </div>
        {preview && <AdminPreview project={preview.project} images={preview.images} onClose={() => setPreview(null)} />}
        <p className="admin-showcase-role-note">Current role: <strong>{role}</strong>. Content writes are checked by database row-level security.</p>
      </main>
    </DashboardShell>
  );
}
