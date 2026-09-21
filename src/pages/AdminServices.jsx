import React, { useEffect, useMemo, useState } from 'react';
import DashboardShell from '../components/DashboardShell';
import { supabase } from '../lib/supabase';

const STAFF_ROLES = ['admin', 'expert', 'support', 'finance'];

const EMPTY_FORM = {
  id: null,
  slug: '',
  name: '',
  category: 'Career',
  short_description: '',
  description: '',
  starting_price: '',
  discount_price: '',
  currency: 'USD',
  pricing_type: 'fixed',
  delivery_min: '',
  delivery_max: '',
  revisions: '0',
  active: true,
  featured: false,
  show_on_homepage: false,
  show_on_services_page: true,
  accept_orders: true,
  max_active_orders: '',
  image_url: '',
  features: [],
  requirements: [],
  faqs: []
};

const CLOSED_ORDER_STATUSES = new Set([
  'completed',
  'cancelled',
  'canceled',
  'closed',
  'delivered',
  'refunded'
]);

const PAID_PAYMENT_STATUSES = new Set([
  'paid',
  'success',
  'succeeded',
  'completed'
]);

function asList(value) {
  return Array.isArray(value) ? value : [];
}

function money(value, currency = 'USD') {
  if (value === '' || value == null || Number.isNaN(Number(value))) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 2
    }).format(Number(value));
  } catch {
    return `${value} ${currency || 'USD'}`;
  }
}

function revenueSummary(byCurrency) {
  const entries = Object.entries(byCurrency || {});
  if (!entries.length) return '—';
  return entries.map(([currency, value]) => money(value, currency)).join(' · ');
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function normalizeService(row) {
  return {
    ...EMPTY_FORM,
    ...row,
    features: asList(row?.features),
    requirements: asList(row?.requirements),
    faqs: asList(row?.faqs)
  };
}

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function isOrderActive(order) {
  return !CLOSED_ORDER_STATUSES.has(normalizeStatus(order.status));
}

function isPaymentPaid(order) {
  return PAID_PAYMENT_STATUSES.has(normalizeStatus(order.payment_status));
}

function startOfMonth() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getServiceMetrics(service, orders) {
  const serviceName = String(service.name || '').trim().toLowerCase();
  const matching = orders.filter(
    (order) => String(order.service_name || '').trim().toLowerCase() === serviceName
  );
  const active = matching.filter(isOrderActive);
  const completed = matching.filter((order) => {
    const status = normalizeStatus(order.status);
    return status === 'completed' || status === 'delivered';
  });
  const cancelled = matching.filter((order) => {
    const status = normalizeStatus(order.status);
    return status === 'cancelled' || status === 'canceled';
  });
  const paid = matching.filter(isPaymentPaid);
  const revenue = paid.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
  const monthStart = startOfMonth();
  const monthOrders = matching.filter((order) => {
    if (!order.created_at) return false;
    return new Date(order.created_at) >= monthStart;
  });
  const monthPaid = monthOrders.filter(isPaymentPaid);
  const monthRevenueByCurrency = monthPaid.reduce((map, order) => {
    const currency = String(order.currency || service.currency || 'USD').toUpperCase();
    map[currency] = (map[currency] || 0) + (Number(order.total) || 0);
    return map;
  }, {});

  return {
    total: matching.length,
    active: active.length,
    completed: completed.length,
    cancelled: cancelled.length,
    revenue,
    monthOrders: monthOrders.length,
    monthRevenueByCurrency,
    paidCount: paid.length,
    avgOrderValue: paid.length ? revenue / paid.length : 0
  };
}

const ADMIN_SERVICES_CSS = `
.admin-services-page{display:grid;gap:18px;padding-bottom:40px}
.admin-services-head{align-items:flex-end}
.admin-services-head p{max-width:760px}
.admin-services-alert{border:1px solid var(--line);border-radius:14px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;gap:12px}
.admin-services-alert.error{background:rgba(185,74,72,.08);color:var(--danger)}
.admin-services-alert.success{background:rgba(143,182,28,.10)}
.admin-services-alert button{border:0;background:transparent;font-size:20px;cursor:pointer}
.admin-services-stats{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}
.admin-services-stats .stat{background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:16px;min-width:0}
.admin-services-stats .stat span{display:block;color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.06em}
.admin-services-stats .stat b{display:block;font-size:25px;margin-top:8px}
.admin-services-toolbar{display:grid;grid-template-columns:minmax(220px,1fr) 160px 180px auto;gap:10px;align-items:center}
.admin-services-toolbar input,.admin-services-toolbar select{min-height:44px}
.admin-services-list-panel{overflow:hidden}
.admin-services-list{display:grid;gap:0}
.admin-service-row{display:grid;grid-template-columns:54px minmax(240px,1.6fr) minmax(260px,1fr) auto;gap:18px;align-items:center;padding:16px 0;border-top:1px solid var(--line)}
.admin-service-row:first-child{border-top:0}
.admin-service-thumb{width:54px;height:54px;border-radius:14px;overflow:hidden;background:var(--soft);display:grid;place-items:center;font-weight:800}
.admin-service-thumb img{width:100%;height:100%;object-fit:cover}
.admin-service-main{min-width:0}
.admin-service-title{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.admin-service-title strong{font-size:16px}
.admin-service-main>small{display:block;color:var(--muted);margin-top:5px}
.admin-service-main>p{margin:7px 0 0;color:var(--muted);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.admin-service-status,.admin-service-tag{font-size:11px;border:1px solid var(--line);border-radius:999px;padding:4px 7px;white-space:nowrap}
.admin-service-status.is-active{background:rgba(143,182,28,.12)}
.admin-service-tag{background:var(--soft)}
.admin-service-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.admin-service-metrics span{display:flex;flex-direction:column;gap:3px}
.admin-service-metrics b{font-size:14px}
.admin-service-metrics small{color:var(--muted);font-size:11px}
.admin-service-actions{display:flex;justify-content:flex-end;gap:9px;flex-wrap:wrap}
.text-button{border:0;background:transparent;padding:4px 0;cursor:pointer;color:inherit;font-weight:650}
.text-button.danger{color:var(--danger)}
.admin-services-empty{text-align:center;padding:44px 18px;color:var(--muted)}
.admin-services-empty h3{color:var(--ink);margin-bottom:6px}
.admin-service-editor{display:grid;gap:16px}
.admin-service-section{display:grid;gap:16px}
.admin-service-grid{display:grid;gap:12px}
.admin-service-grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}
.admin-service-grid.four{grid-template-columns:repeat(4,minmax(0,1fr))}
.admin-service-section label{display:grid;gap:7px}
.admin-service-section label>span{font-size:12px;font-weight:700;color:var(--muted)}
.admin-service-help{margin:0;color:var(--muted);font-size:13px}
.admin-service-repeaters,.admin-service-faqs{display:grid;gap:9px}
.admin-service-repeater{display:grid;grid-template-columns:1fr auto;gap:8px}
.admin-service-faq{display:grid;gap:8px;padding:12px;border:1px solid var(--line);border-radius:14px}
.admin-service-repeater button,.admin-service-faq button{border:1px solid var(--line);background:transparent;border-radius:10px;padding:8px 10px;cursor:pointer}
.admin-service-empty-inline{color:var(--muted);margin:0}
.admin-service-switches{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.admin-service-switch{display:grid!important;grid-template-columns:auto 1fr auto;align-items:center;gap:12px;border:1px solid var(--line);border-radius:14px;padding:12px}
.admin-service-switch input{width:18px;height:18px}
.admin-service-switch span{display:grid;gap:3px}
.admin-service-switch small{color:var(--muted)}
.admin-service-switch i{width:34px;height:20px;border-radius:999px;background:var(--soft);border:1px solid var(--line);position:relative}
.admin-service-switch input:checked~i{background:var(--lime)}
.admin-service-switch i:after{content:'';position:absolute;width:14px;height:14px;top:2px;left:2px;border-radius:50%;background:var(--paper);transition:transform .16s ease}
.admin-service-switch input:checked~i:after{transform:translateX(14px)}
.admin-service-editor-actions{display:flex;justify-content:flex-end;gap:10px}
.admin-services-subgrid{display:grid;grid-template-columns:1.4fr 1fr;gap:16px}
.admin-services-card{border:1px solid var(--line);border-radius:16px;padding:16px;background:var(--paper)}
.admin-services-card h3{margin:0 0 10px;font-size:16px}
.admin-services-card p{margin:0;color:var(--muted);font-size:13px}
.admin-services-capacity{display:flex;align-items:center;gap:12px;margin-top:10px}
.admin-services-capacity-bar{height:8px;border-radius:999px;background:var(--soft);overflow:hidden;flex:1}
.admin-services-capacity-bar i{display:block;height:100%;background:var(--lime);border-radius:999px}
.admin-services-capacity-bar i.is-full{background:var(--danger)}
.admin-services-performance{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:12px}
.admin-services-performance div{padding:10px;border:1px solid var(--line);border-radius:12px}
.admin-services-performance b{display:block;font-size:17px}
.admin-services-performance small{display:block;color:var(--muted);margin-top:3px}
.admin-services-bulk{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:12px 14px;border:1px solid var(--line);border-radius:14px;background:var(--soft)}
.admin-services-bulk-actions{display:flex;gap:8px;flex-wrap:wrap}
.admin-services-bulk-actions select{min-height:38px}
.admin-services-check{display:flex!important;align-items:center;gap:8px!important;cursor:pointer}
.admin-services-check input{width:17px!important;height:17px}
.admin-services-category-list{display:grid;gap:8px;margin-top:12px}
.admin-services-category-row{display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;border:1px solid var(--line);border-radius:12px;padding:9px 10px}
.admin-services-category-row small{color:var(--muted)}
.admin-services-category-row input{min-height:36px}
.admin-services-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.42);z-index:1000;display:grid;place-items:center;padding:20px}
.admin-services-modal{width:min(720px,100%);max-height:min(82vh,760px);overflow:auto;background:var(--paper);border:1px solid var(--line);border-radius:18px;padding:18px;box-shadow:0 24px 80px rgba(0,0,0,.25)}
.admin-services-modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px}
.admin-services-modal-head h2{margin:0}
.admin-services-modal-close{border:0;background:transparent;font-size:24px;cursor:pointer}
.admin-services-preview{display:grid;grid-template-columns:160px 1fr;gap:18px;align-items:start}
.admin-services-preview img{width:160px;height:160px;object-fit:cover;border-radius:16px;background:var(--soft)}
.admin-services-preview h3{margin:0 0 6px;font-size:24px}
.admin-services-preview p{color:var(--muted)}
.admin-services-preview-meta{display:flex;gap:7px;flex-wrap:wrap;margin:10px 0}
.admin-services-preview-meta span{border:1px solid var(--line);border-radius:999px;padding:5px 8px;font-size:11px}
@media (max-width:1100px){.admin-services-stats{grid-template-columns:repeat(3,minmax(0,1fr))}.admin-service-row{grid-template-columns:54px 1fr}.admin-service-metrics,.admin-service-actions{grid-column:2}.admin-service-actions{justify-content:flex-start}.admin-services-toolbar{grid-template-columns:1fr 1fr}.admin-services-subgrid{grid-template-columns:1fr}}
@media (max-width:720px){.admin-services-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.admin-service-grid.two,.admin-service-grid.four,.admin-service-switches,.admin-services-performance{grid-template-columns:1fr}.admin-services-toolbar{grid-template-columns:1fr}.admin-service-row{grid-template-columns:44px 1fr;gap:12px}.admin-service-thumb{width:44px;height:44px}.admin-service-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.admin-service-actions{grid-column:1/-1}.admin-services-preview{grid-template-columns:1fr}.admin-services-preview img{width:100%;height:190px}.admin-services-category-row{grid-template-columns:1fr}.admin-service-repeater{grid-template-columns:1fr}.admin-services-editor-actions{flex-direction:column}}
`;

export function AdminServices() {
  const [services, setServices] = useState([]);
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [mode, setMode] = useState('list');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState([]);
  const [categoryDrafts, setCategoryDrafts] = useState({});
  const [categoryPanelOpen, setCategoryPanelOpen] = useState(false);
  const [previewService, setPreviewService] = useState(null);
  const [performanceService, setPerformanceService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function verifyStaff() {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const userId = sessionData?.session?.user?.id;
    if (!userId) throw new Error('Your session could not be verified.');

    const { data: roleRow, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();

    if (roleError) throw roleError;
    if (!STAFF_ROLES.includes(String(roleRow?.role || '').toLowerCase())) {
      throw new Error('This account does not have staff access.');
    }
  }

  async function loadServices() {
    if (!supabase) {
      setError('Supabase is not configured.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      await verifyStaff();

      const [servicesResult, ordersResult] = await Promise.all([
        supabase
          .from('services')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('orders')
          .select('id, service_name, total, currency, status, payment_status, created_at, updated_at')
          .order('created_at', { ascending: false })
      ]);

      if (servicesResult.error) throw servicesResult.error;
      if (ordersResult.error) {
        console.warn('Admin services order analytics unavailable:', ordersResult.error);
      }

      setServices(servicesResult.data || []);
      setOrders(ordersResult.data || []);
      setSelectedIds([]);
    } catch (err) {
      console.error('Admin services load error:', err);
      setError(err?.message || 'Could not load services.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadServices();
  }, []);

  const categories = useMemo(() => {
    return [...new Set(
      services.map((item) => String(item.category || '').trim()).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));
  }, [services]);

  const filteredServices = useMemo(() => {
    const q = search.trim().toLowerCase();

    return services.filter((service) => {
      const searchable = [
        service.name,
        service.slug,
        service.category,
        service.short_description,
        service.description
      ].filter(Boolean).join(' ').toLowerCase();

      const active = Boolean(service.active);
      const statusOk =
        statusFilter === 'all' ||
        (statusFilter === 'active' && active) ||
        (statusFilter === 'inactive' && !active) ||
        (statusFilter === 'featured' && Boolean(service.featured));

      const categoryOk =
        categoryFilter === 'all' ||
        String(service.category || '') === categoryFilter;

      return (!q || searchable.includes(q)) && statusOk && categoryOk;
    });
  }, [services, search, statusFilter, categoryFilter]);

  const overview = useMemo(() => {
    const monthStart = startOfMonth();
    const monthOrders = orders.filter((order) => order.created_at && new Date(order.created_at) >= monthStart);
    const paidMonthOrders = monthOrders.filter(isPaymentPaid);
    const revenueByCurrency = paidMonthOrders.reduce((map, order) => {
      const currency = String(order.currency || 'USD').toUpperCase();
      map[currency] = (map[currency] || 0) + (Number(order.total) || 0);
      return map;
    }, {});
    const activeOrders = orders.filter(isOrderActive);

    return {
      total: services.length,
      active: services.filter((s) => Boolean(s.active)).length,
      inactive: services.filter((s) => !s.active).length,
      featured: services.filter((s) => Boolean(s.featured)).length,
      accepting: services.filter((s) => s.active && s.accept_orders).length,
      monthOrders: monthOrders.length,
      revenueByCurrency,
      activeOrders: activeOrders.length
    };
  }, [services, orders]);

  const selectedCount = selectedIds.length;
  const allFilteredSelected = filteredServices.length > 0 && filteredServices.every((service) => selectedIds.includes(service.id));

  function openCreate() {
    setForm({ ...EMPTY_FORM, features: [], requirements: [], faqs: [] });
    setMode('edit');
    setError('');
    setNotice('');
  }

  function openEdit(service) {
    setForm(normalizeService(service));
    setMode('edit');
    setError('');
    setNotice('');
  }

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateListField(field, index, value) {
    setForm((current) => ({
      ...current,
      [field]: current[field].map((item, itemIndex) => itemIndex === index ? value : item)
    }));
  }

  function addListItem(field, initial = '') {
    setForm((current) => ({ ...current, [field]: [...current[field], initial] }));
  }

  function removeListItem(field, index) {
    setForm((current) => ({
      ...current,
      [field]: current[field].filter((_, itemIndex) => itemIndex !== index)
    }));
  }

  function addFaq() {
    setForm((current) => ({
      ...current,
      faqs: [...current.faqs, { question: '', answer: '' }]
    }));
  }

  function updateFaq(index, key, value) {
    setForm((current) => ({
      ...current,
      faqs: current.faqs.map((faq, faqIndex) => faqIndex === index ? { ...faq, [key]: value } : faq)
    }));
  }

  function removeFaq(index) {
    setForm((current) => ({
      ...current,
      faqs: current.faqs.filter((_, faqIndex) => faqIndex !== index)
    }));
  }

  async function saveService(event) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setError('');
    setNotice('');

    try {
      await verifyStaff();

      const name = form.name.trim();
      if (!name) throw new Error('Service name is required.');

      const slug = form.slug.trim() || slugify(name);
      if (!slug) throw new Error('A valid service slug is required.');

      const startingPrice = form.starting_price === '' ? null : Number(form.starting_price);
      const discountPrice = form.discount_price === '' ? null : Number(form.discount_price);
      const deliveryMin = form.delivery_min === '' ? null : Number(form.delivery_min);
      const deliveryMax = form.delivery_max === '' ? null : Number(form.delivery_max);
      const maxActiveOrders = form.max_active_orders === '' ? null : Number(form.max_active_orders);

      if (startingPrice != null && startingPrice < 0) throw new Error('Base price cannot be negative.');
      if (discountPrice != null && discountPrice < 0) throw new Error('Discount price cannot be negative.');
      if (deliveryMin != null && deliveryMin < 0) throw new Error('Minimum delivery cannot be negative.');
      if (deliveryMax != null && deliveryMax < 0) throw new Error('Maximum delivery cannot be negative.');
      if (deliveryMin != null && deliveryMax != null && deliveryMax < deliveryMin) {
        throw new Error('Maximum delivery must be greater than or equal to minimum delivery.');
      }
      if (maxActiveOrders != null && maxActiveOrders < 0) throw new Error('Max active orders cannot be negative.');

      const payload = {
        slug,
        name,
        category: form.category.trim() || null,
        short_description: form.short_description.trim() || null,
        description: form.description.trim() || null,
        starting_price: startingPrice,
        discount_price: discountPrice,
        currency: form.currency || 'USD',
        pricing_type: form.pricing_type,
        delivery_min: deliveryMin,
        delivery_max: deliveryMax,
        revisions: Math.max(0, Number(form.revisions) || 0),
        active: Boolean(form.active),
        featured: Boolean(form.featured),
        show_on_homepage: Boolean(form.show_on_homepage),
        show_on_services_page: Boolean(form.show_on_services_page),
        accept_orders: Boolean(form.accept_orders),
        max_active_orders: maxActiveOrders,
        image_url: form.image_url.trim() || null,
        features: form.features.filter((item) => String(item).trim()),
        requirements: form.requirements.filter((item) => String(item).trim()),
        faqs: form.faqs.filter((item) => item.question?.trim() || item.answer?.trim())
      };

      if (form.id) {
        const { data, error: updateError } = await supabase
          .from('services')
          .update(payload)
          .eq('id', form.id)
          .select('*')
          .single();

        if (updateError) throw updateError;
        setServices((current) => current.map((service) => service.id === data.id ? data : service));
        setForm(normalizeService(data));
        setNotice('Service updated successfully.');
      } else {
        const { data, error: insertError } = await supabase
          .from('services')
          .insert(payload)
          .select('*')
          .single();

        if (insertError) throw insertError;
        setServices((current) => [data, ...current]);
        setForm(normalizeService(data));
        setNotice('Service created successfully.');
      }
    } catch (err) {
      console.error('Admin service save error:', err);
      setError(err?.message || 'Could not save service.');
    } finally {
      setSaving(false);
    }
  }

  async function updateService(serviceId, patch, successMessage) {
    setSaving(true);
    setError('');
    setNotice('');

    try {
      await verifyStaff();
      const { data, error: updateError } = await supabase
        .from('services')
        .update(patch)
        .eq('id', serviceId)
        .select('*')
        .single();

      if (updateError) throw updateError;
      setServices((current) => current.map((service) => service.id === data.id ? data : service));
      setNotice(successMessage);
    } catch (err) {
      setError(err?.message || 'Could not update service.');
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(service) {
    await updateService(
      service.id,
      { active: !service.active },
      service.active ? 'Service moved to draft/inactive.' : 'Service published and activated.'
    );
  }

  async function deleteService(service) {
    if (!window.confirm(`Delete "${service.name}"? This cannot be undone.`)) return;

    setError('');
    setNotice('');

    try {
      await verifyStaff();
      const { error: deleteError } = await supabase.from('services').delete().eq('id', service.id);
      if (deleteError) throw deleteError;
      setServices((current) => current.filter((item) => item.id !== service.id));
      setSelectedIds((current) => current.filter((id) => id !== service.id));
      setNotice('Service deleted.');
    } catch (err) {
      setError(err?.message || 'Could not delete service.');
    }
  }

  async function duplicateService(service) {
    setSaving(true);
    setError('');
    setNotice('');

    try {
      await verifyStaff();
      const copy = normalizeService(service);
      const baseSlug = slugify(`${copy.slug || copy.name}-copy`);
      const payload = {
        slug: `${baseSlug}-${Date.now().toString().slice(-5)}`,
        name: `${copy.name} Copy`,
        category: copy.category,
        short_description: copy.short_description,
        description: copy.description,
        starting_price: copy.starting_price,
        discount_price: copy.discount_price,
        currency: copy.currency,
        pricing_type: copy.pricing_type,
        delivery_min: copy.delivery_min,
        delivery_max: copy.delivery_max,
        revisions: copy.revisions,
        active: false,
        featured: false,
        show_on_homepage: false,
        show_on_services_page: false,
        accept_orders: false,
        max_active_orders: copy.max_active_orders,
        image_url: copy.image_url,
        features: copy.features,
        requirements: copy.requirements,
        faqs: copy.faqs
      };

      const { data, error: insertError } = await supabase.from('services').insert(payload).select('*').single();
      if (insertError) throw insertError;
      setServices((current) => [data, ...current]);
      setNotice('Service duplicated as an inactive draft copy.');
    } catch (err) {
      setError(err?.message || 'Could not duplicate service.');
    } finally {
      setSaving(false);
    }
  }

  function toggleSelected(id) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleAllFiltered() {
    const ids = filteredServices.map((service) => service.id);
    setSelectedIds((current) => {
      if (ids.every((id) => current.includes(id))) return current.filter((id) => !ids.includes(id));
      return [...new Set([...current, ...ids])];
    });
  }

  async function runBulkAction(action) {
    if (!selectedIds.length || bulkSaving) return;
    const label = action === 'delete' ? 'delete' : action === 'publish' ? 'publish' : action === 'unpublish' ? 'move to draft' : action;
    if (!window.confirm(`${label.charAt(0).toUpperCase() + label.slice(1)} ${selectedIds.length} selected service${selectedIds.length === 1 ? '' : 's'}?`)) return;

    setBulkSaving(true);
    setError('');
    setNotice('');

    try {
      await verifyStaff();

      if (action === 'delete') {
        const { error: deleteError } = await supabase.from('services').delete().in('id', selectedIds);
        if (deleteError) throw deleteError;
        setServices((current) => current.filter((service) => !selectedIds.includes(service.id)));
        setNotice(`${selectedIds.length} service${selectedIds.length === 1 ? '' : 's'} deleted.`);
      } else {
        const patch = {
          ...(action === 'publish' ? { active: true } : {}),
          ...(action === 'unpublish' ? { active: false } : {}),
          ...(action === 'feature' ? { featured: true } : {}),
          ...(action === 'unfeature' ? { featured: false } : {}),
          ...(action === 'homepage' ? { show_on_homepage: true } : {}),
          ...(action === 'remove_homepage' ? { show_on_homepage: false } : {}),
          ...(action === 'accept_orders' ? { accept_orders: true } : {}),
          ...(action === 'stop_orders' ? { accept_orders: false } : {})
        };

        const { data, error: updateError } = await supabase
          .from('services')
          .update(patch)
          .in('id', selectedIds)
          .select('*');

        if (updateError) throw updateError;
        const updatedMap = new Map((data || []).map((service) => [service.id, service]));
        setServices((current) => current.map((service) => updatedMap.get(service.id) || service));
        setNotice(`${selectedIds.length} service${selectedIds.length === 1 ? '' : 's'} updated.`);
      }

      setSelectedIds([]);
    } catch (err) {
      setError(err?.message || 'Bulk action failed.');
    } finally {
      setBulkSaving(false);
    }
  }

  async function renameCategory(category) {
    const nextCategory = String(categoryDrafts[category] || '').trim();
    if (!nextCategory || nextCategory === category) return;

    setBulkSaving(true);
    setError('');
    setNotice('');

    try {
      await verifyStaff();
      const ids = services.filter((service) => String(service.category || '') === category).map((service) => service.id);
      if (!ids.length) return;

      const { data, error: updateError } = await supabase
        .from('services')
        .update({ category: nextCategory })
        .in('id', ids)
        .select('*');

      if (updateError) throw updateError;
      const updatedMap = new Map((data || []).map((service) => [service.id, service]));
      setServices((current) => current.map((service) => updatedMap.get(service.id) || service));
      setCategoryDrafts((current) => ({ ...current, [category]: '' }));
      setNotice(`Category renamed from "${category}" to "${nextCategory}".`);
    } catch (err) {
      setError(err?.message || 'Could not rename category.');
    } finally {
      setBulkSaving(false);
    }
  }

  function formatDelivery(service) {
    if (service.delivery_min == null && service.delivery_max == null) return 'Not set';
    if (service.delivery_min != null && service.delivery_max != null) return `${service.delivery_min}–${service.delivery_max} days`;
    return `${service.delivery_min ?? service.delivery_max} days`;
  }

  function getCapacity(service) {
    const metrics = getServiceMetrics(service, orders);
    const limit = service.max_active_orders == null ? null : Number(service.max_active_orders);
    const percent = limit && limit > 0 ? Math.min(100, (metrics.active / limit) * 100) : 0;
    return { ...metrics, limit, percent, full: Boolean(limit && metrics.active >= limit) };
  }

  function openPreview(service) {
    setPreviewService(service);
  }

  function navigateToPublicService(service) {
    window.open(`/services/${service.id}`, '_blank', 'noopener,noreferrer');
  }

  if (mode === 'edit') {
    return (
      <DashboardShell admin>
        <style>{ADMIN_SERVICES_CSS}</style>
        <main className="admin-services-page">
          <div className="dash-head admin-services-head">
            <div>
              <p className="eyebrow">ADMIN · SERVICES</p>
              <h1>{form.id ? 'Edit service.' : 'Add service.'}</h1>
              <p>Control pricing, delivery, features, requirements and visibility from one place.</p>
            </div>
            <button className="btn light" type="button" onClick={() => setMode('list')}>← All services</button>
          </div>

          {error && <div className="admin-services-alert error">{error}<button type="button" onClick={() => setError('')}>×</button></div>}
          {notice && <div className="admin-services-alert success">{notice}</div>}

          <form className="admin-service-editor" onSubmit={saveService}>
            <section className="panel admin-service-section">
              <div className="panel-head"><div><p className="eyebrow">01 · BASIC</p><h2>Service information</h2></div></div>
              <div className="admin-service-grid two">
                <label><span>Service name</span><input value={form.name} onChange={(e) => updateField('name', e.target.value)} placeholder="CV Optimization" required /></label>
                <label><span>Slug</span><input value={form.slug} onChange={(e) => updateField('slug', slugify(e.target.value))} placeholder="cv-optimization" /></label>
                <label><span>Category</span><input value={form.category} onChange={(e) => updateField('category', e.target.value)} placeholder="Career" /></label>
                <label><span>Image URL</span><input value={form.image_url} onChange={(e) => updateField('image_url', e.target.value)} placeholder="https://..." /></label>
              </div>
              <label><span>Short description</span><input value={form.short_description} onChange={(e) => updateField('short_description', e.target.value)} placeholder="A concise client-facing description" /></label>
              <label><span>Full description</span><textarea rows="6" value={form.description} onChange={(e) => updateField('description', e.target.value)} placeholder="Describe exactly what the client receives." /></label>
            </section>

            <section className="panel admin-service-section">
              <div className="panel-head"><div><p className="eyebrow">02 · PRICING</p><h2>Pricing control</h2></div></div>
              <div className="admin-service-grid four">
                <label><span>Base price</span><input type="number" min="0" step="0.01" value={form.starting_price} onChange={(e) => updateField('starting_price', e.target.value)} placeholder="49" /></label>
                <label><span>Discount price</span><input type="number" min="0" step="0.01" value={form.discount_price} onChange={(e) => updateField('discount_price', e.target.value)} placeholder="39" /></label>
                <label><span>Currency</span><select value={form.currency} onChange={(e) => updateField('currency', e.target.value)}><option>USD</option><option>EUR</option><option>GBP</option><option>BDT</option></select></label>
                <label><span>Pricing type</span><select value={form.pricing_type} onChange={(e) => updateField('pricing_type', e.target.value)}><option value="fixed">Fixed price</option><option value="starting_from">Starting from</option></select></label>
              </div>
              <p className="admin-service-help">The configured price is stored in Supabase and can be consumed by the public service page and new-order flow.</p>
            </section>

            <section className="panel admin-service-section">
              <div className="panel-head"><div><p className="eyebrow">03 · DELIVERY</p><h2>Delivery & order settings</h2></div></div>
              <div className="admin-service-grid four">
                <label><span>Delivery min (days)</span><input type="number" min="0" value={form.delivery_min} onChange={(e) => updateField('delivery_min', e.target.value)} /></label>
                <label><span>Delivery max (days)</span><input type="number" min="0" value={form.delivery_max} onChange={(e) => updateField('delivery_max', e.target.value)} /></label>
                <label><span>Revisions</span><input type="number" min="0" value={form.revisions} onChange={(e) => updateField('revisions', e.target.value)} /></label>
                <label><span>Max active orders</span><input type="number" min="0" value={form.max_active_orders} onChange={(e) => updateField('max_active_orders', e.target.value)} placeholder="10" /></label>
              </div>
            </section>

            <section className="panel admin-service-section">
              <div className="panel-head"><div><p className="eyebrow">04 · FEATURES</p><h2>What's included</h2></div><button type="button" className="btn light" onClick={() => addListItem('features')}>+ Add feature</button></div>
              <div className="admin-service-repeaters">
                {form.features.map((item, index) => <div className="admin-service-repeater" key={`feature-${index}`}><input value={item} onChange={(e) => updateListField('features', index, e.target.value)} placeholder="ATS optimization" /><button type="button" onClick={() => removeListItem('features', index)}>Remove</button></div>)}
                {!form.features.length && <p className="admin-service-empty-inline">No features added yet.</p>}
              </div>
            </section>

            <section className="panel admin-service-section">
              <div className="panel-head"><div><p className="eyebrow">05 · REQUIREMENTS</p><h2>Client requirements</h2></div><button type="button" className="btn light" onClick={() => addListItem('requirements')}>+ Add requirement</button></div>
              <div className="admin-service-repeaters">
                {form.requirements.map((item, index) => <div className="admin-service-repeater" key={`requirement-${index}`}><input value={item} onChange={(e) => updateListField('requirements', index, e.target.value)} placeholder="Current CV" /><button type="button" onClick={() => removeListItem('requirements', index)}>Remove</button></div>)}
                {!form.requirements.length && <p className="admin-service-empty-inline">No requirements added yet.</p>}
              </div>
            </section>

            <section className="panel admin-service-section">
              <div className="panel-head"><div><p className="eyebrow">06 · FAQ</p><h2>Service FAQ</h2></div><button type="button" className="btn light" onClick={addFaq}>+ Add FAQ</button></div>
              <div className="admin-service-faqs">
                {form.faqs.map((faq, index) => (
                  <div className="admin-service-faq" key={`faq-${index}`}>
                    <input value={faq.question || ''} onChange={(e) => updateFaq(index, 'question', e.target.value)} placeholder="Question" />
                    <textarea rows="3" value={faq.answer || ''} onChange={(e) => updateFaq(index, 'answer', e.target.value)} placeholder="Answer" />
                    <button type="button" onClick={() => removeFaq(index)}>Remove FAQ</button>
                  </div>
                ))}
                {!form.faqs.length && <p className="admin-service-empty-inline">No FAQs added yet.</p>}
              </div>
            </section>

            <section className="panel admin-service-section">
              <div className="panel-head"><div><p className="eyebrow">07 · VISIBILITY</p><h2>Feature & availability controls</h2></div></div>
              <div className="admin-service-switches">
                {[
                  ['active', 'Published / Active', 'Inactive services are treated as drafts in the admin workflow.'],
                  ['accept_orders', 'Accept new orders', 'Allow checkout/order creation.'],
                  ['featured', 'Featured service', 'Mark this service as featured.'],
                  ['show_on_homepage', 'Show on homepage', 'Allow homepage service sections to show it.'],
                  ['show_on_services_page', 'Show on services page', 'Allow the public services directory to show it.']
                ].map(([key, title, help]) => (
                  <label className="admin-service-switch" key={key}>
                    <input type="checkbox" checked={Boolean(form[key])} onChange={(e) => updateField(key, e.target.checked)} />
                    <span><strong>{title}</strong><small>{help}</small></span>
                    <i aria-hidden="true" />
                  </label>
                ))}
              </div>
            </section>

            <div className="admin-service-editor-actions">
              <button className="btn light" type="button" onClick={() => setMode('list')} disabled={saving}>Cancel</button>
              <button className="btn dark" type="submit" disabled={saving}>{saving ? 'Saving…' : form.id ? 'Save changes ↗' : 'Create service ↗'}</button>
            </div>
          </form>
        </main>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell admin>
      <style>{ADMIN_SERVICES_CSS}</style>
      <main className="admin-services-page">
        <div className="dash-head admin-services-head">
          <div>
            <p className="eyebrow">ADMIN · SERVICES</p>
            <h1>Services.</h1>
            <p>Manage the catalog, publishing, capacity, performance, categories and client-facing visibility.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn light" type="button" onClick={() => setCategoryPanelOpen(true)}>Manage categories</button>
            <button className="btn dark" type="button" onClick={openCreate}>+ Add service</button>
          </div>
        </div>

        {error && <div className="admin-services-alert error">{error}<button type="button" onClick={() => setError('')}>×</button></div>}
        {notice && <div className="admin-services-alert success">{notice}</div>}

        <section className="admin-services-stats">
          <div className="stat"><span>Total services</span><b>{loading ? '—' : overview.total}</b></div>
          <div className="stat"><span>Active / Published</span><b>{loading ? '—' : overview.active}</b></div>
          <div className="stat"><span>Draft / Inactive</span><b>{loading ? '—' : overview.inactive}</b></div>
          <div className="stat"><span>Featured</span><b>{loading ? '—' : overview.featured}</b></div>
          <div className="stat"><span>Orders this month</span><b>{loading ? '—' : overview.monthOrders}</b></div>
          <div className="stat"><span>Revenue this month</span><b>{loading ? '—' : revenueSummary(overview.revenueByCurrency)}</b></div>
        </section>

        <section className="admin-services-subgrid">
          <div className="admin-services-card">
            <h3>Order capacity</h3>
            <p>{overview.activeOrders} active orders are currently tracked across the catalog.</p>
            <div className="admin-services-capacity">
              <strong>{overview.activeOrders}</strong>
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>across all services</span>
            </div>
          </div>
          <div className="admin-services-card">
            <h3>Publishing workflow</h3>
            <p>Active = published. Inactive = draft. “Publish” and “Move to draft” can be applied per service or in bulk.</p>
          </div>
        </section>

        <section className="panel admin-services-toolbar">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search services…" aria-label="Search services" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter services">
            <option value="all">All statuses</option>
            <option value="active">Published</option>
            <option value="inactive">Draft / Inactive</option>
            <option value="featured">Featured</option>
          </select>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} aria-label="Filter category">
            <option value="all">All categories</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <button className="btn light" type="button" onClick={loadServices} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh ↻'}</button>
        </section>

        {selectedCount > 0 && (
          <section className="admin-services-bulk">
            <strong>{selectedCount} selected</strong>
            <div className="admin-services-bulk-actions">
              <button className="btn light" type="button" onClick={() => runBulkAction('publish')} disabled={bulkSaving}>Publish</button>
              <button className="btn light" type="button" onClick={() => runBulkAction('unpublish')} disabled={bulkSaving}>Move to draft</button>
              <button className="btn light" type="button" onClick={() => runBulkAction('feature')} disabled={bulkSaving}>Feature</button>
              <button className="btn light" type="button" onClick={() => runBulkAction('unfeature')} disabled={bulkSaving}>Unfeature</button>
              <button className="btn light" type="button" onClick={() => runBulkAction('homepage')} disabled={bulkSaving}>Show on homepage</button>
              <button className="btn light" type="button" onClick={() => runBulkAction('remove_homepage')} disabled={bulkSaving}>Remove homepage</button>
              <button className="btn light" type="button" onClick={() => runBulkAction('accept_orders')} disabled={bulkSaving}>Accept orders</button>
              <button className="btn light" type="button" onClick={() => runBulkAction('stop_orders')} disabled={bulkSaving}>Stop orders</button>
              <button className="btn light" type="button" onClick={() => runBulkAction('delete')} disabled={bulkSaving}>Delete</button>
            </div>
          </section>
        )}

        <section className="panel admin-services-list-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">SERVICE CATALOG</p>
              <h2>{loading ? 'Loading…' : `${filteredServices.length} service${filteredServices.length === 1 ? '' : 's'}`}</h2>
            </div>
            {!loading && filteredServices.length > 0 && (
              <label className="admin-services-check">
                <input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} />
                Select filtered
              </label>
            )}
          </div>

          {loading ? (
            <div className="admin-services-empty"><h3>Loading services…</h3><p>Fetching the catalog and order analytics from Supabase.</p></div>
          ) : !filteredServices.length ? (
            <div className="admin-services-empty"><h3>No services found.</h3><p>Create your first service or change the filters.</p></div>
          ) : (
            <div className="admin-services-list">
              {filteredServices.map((service) => {
                const metrics = getCapacity(service);
                const checked = selectedIds.includes(service.id);
                const displayPrice = service.discount_price ?? service.starting_price;

                return (
                  <article className="admin-service-row" key={service.id}>
                    <div className="admin-service-thumb">
                      {service.image_url ? <img src={service.image_url} alt="" /> : <span>{String(service.name || 'S').slice(0, 1).toUpperCase()}</span>}
                    </div>

                    <div className="admin-service-main">
                      <div className="admin-service-title">
                        <label className="admin-services-check" title="Select service">
                          <input type="checkbox" checked={checked} onChange={() => toggleSelected(service.id)} />
                        </label>
                        <strong>{service.name}</strong>
                        <span className={`admin-service-status ${service.active ? 'is-active' : ''}`}>{service.active ? 'Published' : 'Draft'}</span>
                        {service.featured && <span className="admin-service-tag">Featured</span>}
                        {!service.accept_orders && <span className="admin-service-tag">Orders off</span>}
                      </div>
                      <small>{service.category || 'Uncategorized'} · {service.pricing_type === 'starting_from' ? 'Starting from' : 'Fixed price'} · {service.show_on_services_page ? 'Public listing' : 'Hidden from listing'}</small>
                      <p>{service.short_description || service.description || 'No description yet.'}</p>
                    </div>

                    <div className="admin-service-metrics">
                      <span><b>{money(displayPrice, service.currency)}</b>{service.discount_price != null && service.starting_price != null && <small>was {money(service.starting_price, service.currency)}</small>}</span>
                      <span><b>{formatDelivery(service)}</b><small>delivery</small></span>
                      <span><b>{metrics.active}{metrics.limit != null ? ` / ${metrics.limit}` : ''}</b><small>active orders</small></span>
                      <span><b>{metrics.monthOrders}</b><small>orders this month</small></span>
                      <span><b>{revenueSummary(metrics.monthRevenueByCurrency)}</b><small>paid this month</small></span>
                      <span><b>{service.revisions ?? 0}</b><small>revisions</small></span>
                    </div>

                    {metrics.limit != null && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <div className="admin-services-capacity">
                          <span style={{ minWidth: 92, fontSize: 12 }}>{metrics.full ? 'Capacity full' : 'Order capacity'}</span>
                          <div className="admin-services-capacity-bar"><i className={metrics.full ? 'is-full' : ''} style={{ width: `${metrics.percent}%` }} /></div>
                          <small>{metrics.active} / {metrics.limit}</small>
                        </div>
                      </div>
                    )}

                    <div className="admin-service-actions">
                      <button className="text-button" type="button" onClick={() => openPreview(service)}>Preview</button>
                      <button className="text-button" type="button" onClick={() => setPerformanceService(service)}>Performance</button>
                      <button className="text-button" type="button" onClick={() => navigateToPublicService(service)}>Public page ↗</button>
                      <button className="text-button" type="button" onClick={() => togglePublish(service)} disabled={saving}>{service.active ? 'Move to draft' : 'Publish'} →</button>
                      <button className="text-button" type="button" onClick={() => openEdit(service)}>Edit →</button>
                      <button className="text-button" type="button" onClick={() => duplicateService(service)} disabled={saving}>Duplicate</button>
                      <button className="text-button danger" type="button" onClick={() => deleteService(service)}>Delete</button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {categoryPanelOpen && (
          <div className="admin-services-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setCategoryPanelOpen(false); }}>
            <section className="admin-services-modal" role="dialog" aria-modal="true" aria-labelledby="category-title">
              <div className="admin-services-modal-head">
                <div><p className="eyebrow">SERVICE TAXONOMY</p><h2 id="category-title">Manage categories</h2></div>
                <button className="admin-services-modal-close" type="button" onClick={() => setCategoryPanelOpen(false)}>×</button>
              </div>
              <p style={{ color: 'var(--muted)', marginTop: 0 }}>Categories are stored directly on each service in the current schema. Rename updates every service using that category.</p>
              <div className="admin-services-category-list">
                {categories.map((category) => {
                  const count = services.filter((service) => String(service.category || '') === category).length;
                  return (
                    <div className="admin-services-category-row" key={category}>
                      <div><strong>{category}</strong><small> · {count} service{count === 1 ? '' : 's'}</small></div>
                      <input value={categoryDrafts[category] ?? ''} onChange={(e) => setCategoryDrafts((current) => ({ ...current, [category]: e.target.value }))} placeholder="New name" />
                      <button className="btn light" type="button" onClick={() => renameCategory(category)} disabled={bulkSaving || !String(categoryDrafts[category] || '').trim()}>Rename</button>
                    </div>
                  );
                })}
                {!categories.length && <p className="admin-services-empty-inline">No categories yet. Create a service and add a category.</p>}
              </div>
            </section>
          </div>
        )}

        {previewService && (
          <div className="admin-services-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setPreviewService(null); }}>
            <section className="admin-services-modal" role="dialog" aria-modal="true" aria-labelledby="preview-title">
              <div className="admin-services-modal-head">
                <div><p className="eyebrow">PUBLIC PREVIEW</p><h2 id="preview-title">{previewService.name}</h2></div>
                <button className="admin-services-modal-close" type="button" onClick={() => setPreviewService(null)}>×</button>
              </div>
              <div className="admin-services-preview">
                {previewService.image_url ? <img src={previewService.image_url} alt="" /> : <div style={{ minHeight: 160, borderRadius: 16, background: 'var(--soft)', display: 'grid', placeItems: 'center', fontSize: 42, fontWeight: 800 }}>{String(previewService.name || 'S').slice(0, 1).toUpperCase()}</div>}
                <div>
                  <h3>{previewService.name}</h3>
                  <div className="admin-services-preview-meta">
                    <span>{previewService.category || 'Uncategorized'}</span>
                    <span>{money(previewService.discount_price ?? previewService.starting_price, previewService.currency)}</span>
                    <span>{formatDelivery(previewService)}</span>
                    <span>{previewService.revisions ?? 0} revisions</span>
                    <span>{previewService.active ? 'Published' : 'Draft'}</span>
                  </div>
                  <p>{previewService.short_description || previewService.description || 'No description yet.'}</p>
                  <p><strong>Included:</strong> {asList(previewService.features).length ? asList(previewService.features).join(' · ') : 'Not specified'}</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                    <button className="btn dark" type="button" onClick={() => navigateToPublicService(previewService)}>Open public page ↗</button>
                    <button className="btn light" type="button" onClick={() => { setPreviewService(null); openEdit(previewService); }}>Edit service</button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {performanceService && (() => {
          const metrics = getServiceMetrics(performanceService, orders);
          return (
            <div className="admin-services-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setPerformanceService(null); }}>
              <section className="admin-services-modal" role="dialog" aria-modal="true" aria-labelledby="performance-title">
                <div className="admin-services-modal-head">
                  <div><p className="eyebrow">SERVICE PERFORMANCE</p><h2 id="performance-title">{performanceService.name}</h2></div>
                  <button className="admin-services-modal-close" type="button" onClick={() => setPerformanceService(null)}>×</button>
                </div>
                <div className="admin-services-performance">
                  <div><b>{metrics.total}</b><small>Total orders</small></div>
                  <div><b>{metrics.active}</b><small>Active orders</small></div>
                  <div><b>{metrics.completed}</b><small>Completed</small></div>
                  <div><b>{metrics.cancelled}</b><small>Cancelled</small></div>
                  <div><b>{metrics.monthOrders}</b><small>This month</small></div>
                  <div><b>{revenueSummary(metrics.monthRevenueByCurrency)}</b><small>Paid this month</small></div>
                  <div><b>{money(metrics.revenue, performanceService.currency)}</b><small>Paid revenue tracked</small></div>
                  <div><b>{metrics.avgOrderValue ? money(metrics.avgOrderValue, performanceService.currency) : '—'}</b><small>Average paid order</small></div>
                </div>
                <p style={{ color: 'var(--muted)', marginBottom: 0, marginTop: 14 }}>Analytics are derived from the existing <code>orders.service_name</code>, payment status, amount and status fields. Reviews/ratings are not fabricated when no review source exists in the current data model.</p>
              </section>
            </div>
          );
        })()}
      </main>
    </DashboardShell>
  );
}

export default AdminServices;
