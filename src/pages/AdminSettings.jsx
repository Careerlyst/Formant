import React, { useEffect, useMemo, useState } from 'react';
import DashboardShell from '../components/DashboardShell';
import { supabase } from '../lib/supabase';
import './admin-settings.css';

const SETTINGS_ID = 'global';
const STAFF_ROLES = ['admin', 'expert', 'support', 'finance'];

const DEFAULT_SETTINGS = {
  general: {
    platformName: 'Formant',
    supportEmail: '',
    supportPhone: '',
    businessAddress: '',
    currency: 'BDT',
    timezone: 'Asia/Dhaka',
    language: 'en',
    maintenanceMode: false,
    maintenanceMessage: 'Formant is temporarily unavailable. Please check back soon.'
  },
  security: {
    requireEmailVerification: true,
    requireAdminMfa: false,
    adminSessionHours: 24,
    securityAlerts: true,
    loginAlerts: true,
    allowRegistrations: true
  },
  payments: {
    mode: 'test',
    domesticEnabled: true,
    internationalEnabled: false,
    defaultCurrency: 'BDT',
    requirePaymentConfirmation: true,
    allowRefunds: true,
    allowCancellations: true,
    generateInvoices: true
  },
  orders: {
    acceptNewOrders: true,
    requireAdminApproval: false,
    defaultStatus: 'pending',
    defaultDeliveryDays: 5,
    defaultRevisions: 2,
    requireClientConfirmation: true,
    autoCompleteDays: 7
  },
  email: {
    enabled: true,
    senderName: 'Formant',
    senderEmail: '',
    replyTo: '',
    orderConfirmation: true,
    paymentConfirmation: true,
    paymentFailed: true,
    projectUpdates: true,
    messageNotifications: true,
    reviewRequests: true
  },
  notifications: {
    newUser: true,
    newOrder: true,
    paymentReceived: true,
    paymentFailed: true,
    newMessage: true,
    projectUpdated: true,
    projectCompleted: true,
    fileUploaded: true,
    reviewSubmitted: true,
    adminAlert: true
  },
  storage: {
    maxUploadMb: 10,
    signedUrlMinutes: 60,
    privateByDefault: true,
    allowPdf: true,
    allowDocuments: true,
    allowImages: true,
    allowZip: true
  }
};

const SECTIONS = [
  ['general', 'General', 'Platform identity and operating defaults.'],
  ['security', 'Security', 'Authentication and admin security controls.'],
  ['staff', 'Staff & Permissions', 'Review staff access and role capabilities.'],
  ['payments', 'Payments', 'Payment behavior and transaction defaults.'],
  ['orders', 'Orders & Services', 'Global rules for orders and delivery.'],
  ['email', 'Email', 'Transactional email behavior.'],
  ['notifications', 'Notifications', 'Global notification event controls.'],
  ['storage', 'Storage & Files', 'Upload and private-file policies.'],
  ['audit', 'Audit Logs', 'Sensitive configuration changes.'],
  ['danger', 'Danger Zone', 'High-impact platform controls.']
];

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}

function mergeSettings(value) {
  const defaults = cloneDefaults();
  if (!value || typeof value !== 'object') return defaults;
  Object.keys(defaults).forEach((section) => {
    if (value[section] && typeof value[section] === 'object') {
      defaults[section] = { ...defaults[section], ...value[section] };
    }
  });
  return defaults;
}

function formatDate(value) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function Toggle({ checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      className={`admin-settings-toggle ${checked ? 'is-on' : ''}`}
      aria-pressed={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

function SettingRow({ title, description, children }) {
  return (
    <div className="admin-settings-row">
      <div className="admin-settings-row-copy">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      <div className="admin-settings-row-control">{children}</div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', disabled = false, placeholder = '' }) {
  return (
    <label className="admin-settings-field">
      <span>{label}</span>
      <input
        type={type}
        value={value ?? ''}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(type === 'number' ? Number(event.target.value) : event.target.value)}
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options, disabled = false }) {
  return (
    <label className="admin-settings-field">
      <span>{label}</span>
      <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}
      </select>
    </label>
  );
}

export default function AdminSettings() {
  const [section, setSection] = useState('general');
  const [settings, setSettings] = useState(cloneDefaults);
  const [staff, setStaff] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [role, setRole] = useState('');
  const [staffUser, setStaffUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');
  const [dangerBusy, setDangerBusy] = useState(false);

  const canEdit = role === 'admin';

  const currentSection = useMemo(
    () => SECTIONS.find(([key]) => key === section) || SECTIONS[0],
    [section]
  );

  function update(sectionName, key, value) {
    setSettings((current) => ({
      ...current,
      [sectionName]: {
        ...current[sectionName],
        [key]: value
      }
    }));
    setNotice('');
  }

  async function loadSettings() {
    setLoading(true);
    setError('');
    try {
      if (!supabase) throw new Error('Supabase is not configured.');

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const user = sessionData?.session?.user;
      if (!user) throw new Error('Your staff session could not be verified.');

      const { data: roleRows, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      if (roleError) throw roleError;

      const foundRole = (roleRows || [])
        .map((row) => String(row.role || '').toLowerCase())
        .find((value) => STAFF_ROLES.includes(value));
      if (!foundRole) throw new Error('You do not have permission to access admin settings.');

      setRole(foundRole);
      setStaffUser(user);

      const { data: row, error: settingsError } = await supabase
        .from('platform_settings')
        .select('settings, updated_at, updated_by')
        .eq('id', SETTINGS_ID)
        .maybeSingle();

      if (settingsError) {
        if (settingsError.code === '42P01') {
          throw new Error('The platform_settings table is missing. Run the provided SQL migration before using Admin Settings.');
        }
        throw settingsError;
      }

      setSettings(mergeSettings(row?.settings));
      setUpdatedAt(row?.updated_at || '');

      const { data: roleRowsAll, error: staffError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .order('role');
      if (!staffError) setStaff(roleRowsAll || []);

      const { data: logs, error: logsError } = await supabase
        .from('admin_audit_logs')
        .select('id, actor_id, action, resource, created_at, details')
        .order('created_at', { ascending: false })
        .limit(50);
      if (!logsError) setAuditLogs(logs || []);
    } catch (err) {
      setError(err?.message || 'Unable to load admin settings.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  async function writeAudit(action, resource, details = {}) {
    if (!supabase || !staffUser?.id) return;
    const { error: auditError } = await supabase.from('admin_audit_logs').insert({
      actor_id: staffUser.id,
      action,
      resource,
      details
    });
    if (auditError && auditError.code !== '42P01') throw auditError;
  }

  async function saveSettings() {
    if (!canEdit) {
      setError('Only admin staff can change platform settings.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const { data, error: saveError } = await supabase
        .from('platform_settings')
        .upsert({
          id: SETTINGS_ID,
          settings,
          updated_by: staffUser.id,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' })
        .select('updated_at')
        .single();
      if (saveError) throw saveError;

      await writeAudit('settings.updated', `platform.${section}`, {
        section,
        updated_keys: Object.keys(settings[section] || {})
      });

      setUpdatedAt(data?.updated_at || new Date().toISOString());
      setNotice(`${currentSection[1]} settings saved successfully.`);
      const { data: logs } = await supabase
        .from('admin_audit_logs')
        .select('id, actor_id, action, resource, created_at, details')
        .order('created_at', { ascending: false })
        .limit(50);
      setAuditLogs(logs || []);
    } catch (err) {
      setError(err?.message || 'Unable to save settings.');
    } finally {
      setSaving(false);
    }
  }

  async function runDangerAction(action) {
    if (!canEdit) return;
    const messages = {
      disableRegistrations: 'Disable new user registrations?',
      disableOrders: 'Disable new orders?',
      maintenance: 'Turn maintenance mode on?'
    };
    if (!window.confirm(messages[action])) return;

    setDangerBusy(true);
    setError('');
    try {
      if (action === 'disableRegistrations') update('security', 'allowRegistrations', false);
      if (action === 'disableOrders') update('orders', 'acceptNewOrders', false);
      if (action === 'maintenance') update('general', 'maintenanceMode', true);
      await writeAudit(`danger.${action}`, 'platform', { action });
      setNotice('The change is ready. Click Save Changes to persist it.');
    } catch (err) {
      setError(err?.message || 'Unable to record the action.');
    } finally {
      setDangerBusy(false);
    }
  }

  if (loading) {
    return (
      <DashboardShell admin>
        <div className="admin-settings-page">
          <section className="admin-settings-loading">Loading admin settings…</section>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell admin>
      <div className="admin-settings-page">
        <header className="admin-settings-header">
          <div>
            <p className="eyebrow">ADMIN / SETTINGS</p>
            <h1>Platform settings</h1>
            <p>Control Formant's global behavior, staff access, payments, orders, notifications and security from one place.</p>
          </div>
          <div className="admin-settings-header-meta">
            <span className={`admin-settings-role ${canEdit ? 'admin' : 'readonly'}`}>
              {canEdit ? 'Admin · editable' : `${role || 'Staff'} · read only`}
            </span>
            <small>Last saved: {formatDate(updatedAt)}</small>
          </div>
        </header>

        {error && <div className="admin-settings-alert error">{error}</div>}
        {notice && <div className="admin-settings-alert success">{notice}</div>}

        <div className="admin-settings-layout">
          <aside className="admin-settings-sidebar" aria-label="Settings sections">
            {SECTIONS.map(([key, label, description]) => (
              <button
                type="button"
                key={key}
                className={`admin-settings-nav ${section === key ? 'active' : ''} ${key === 'danger' ? 'danger' : ''}`}
                onClick={() => { setSection(key); setError(''); setNotice(''); }}
              >
                <strong>{label}</strong>
                <span>{description}</span>
              </button>
            ))}
          </aside>

          <main className="admin-settings-content">
            <div className="admin-settings-content-head">
              <div>
                <p className="admin-settings-kicker">{currentSection[0].toUpperCase()}</p>
                <h2>{currentSection[1]}</h2>
                <p>{currentSection[2]}</p>
              </div>
              {canEdit && section !== 'audit' && <button className="admin-settings-save" type="button" onClick={saveSettings} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>}
            </div>

            {section === 'general' && (
              <section className="admin-settings-card">
                <div className="admin-settings-grid">
                  <Field label="Platform name" value={settings.general.platformName} onChange={(v) => update('general', 'platformName', v)} disabled={!canEdit} />
                  <Field label="Support email" type="email" value={settings.general.supportEmail} onChange={(v) => update('general', 'supportEmail', v)} disabled={!canEdit} placeholder="support@careerlyst.com" />
                  <Field label="Support phone" value={settings.general.supportPhone} onChange={(v) => update('general', 'supportPhone', v)} disabled={!canEdit} />
                  <SelectField label="Currency" value={settings.general.currency} onChange={(v) => update('general', 'currency', v)} disabled={!canEdit} options={[['BDT', 'BDT — Bangladeshi Taka'], ['USD', 'USD — US Dollar'], ['EUR', 'EUR — Euro'], ['GBP', 'GBP — British Pound']]} />
                  <SelectField label="Timezone" value={settings.general.timezone} onChange={(v) => update('general', 'timezone', v)} disabled={!canEdit} options={[['Asia/Dhaka', 'Asia/Dhaka'], ['UTC', 'UTC'], ['Asia/Kolkata', 'Asia/Kolkata'], ['Europe/London', 'Europe/London']]} />
                  <SelectField label="Language" value={settings.general.language} onChange={(v) => update('general', 'language', v)} disabled={!canEdit} options={[['en', 'English'], ['bn', 'Bangla']]} />
                </div>
                <Field label="Business address" value={settings.general.businessAddress} onChange={(v) => update('general', 'businessAddress', v)} disabled={!canEdit} />
                <SettingRow title="Maintenance mode" description="Temporarily disable normal public platform access while you work on the system.">
                  <Toggle checked={settings.general.maintenanceMode} onChange={(v) => update('general', 'maintenanceMode', v)} disabled={!canEdit} />
                </SettingRow>
                <Field label="Maintenance message" value={settings.general.maintenanceMessage} onChange={(v) => update('general', 'maintenanceMessage', v)} disabled={!canEdit} />
              </section>
            )}

            {section === 'security' && (
              <section className="admin-settings-card">
                <SettingRow title="Require email verification" description="Require users to verify their email before using the account."><Toggle checked={settings.security.requireEmailVerification} onChange={(v) => update('security', 'requireEmailVerification', v)} disabled={!canEdit} /></SettingRow>
                <SettingRow title="Require MFA for admins" description="Mark multi-factor authentication as required for admin staff. Enforcement must also exist in the auth layer."><Toggle checked={settings.security.requireAdminMfa} onChange={(v) => update('security', 'requireAdminMfa', v)} disabled={!canEdit} /></SettingRow>
                <SettingRow title="Security alerts" description="Enable security-related admin alerts."><Toggle checked={settings.security.securityAlerts} onChange={(v) => update('security', 'securityAlerts', v)} disabled={!canEdit} /></SettingRow>
                <SettingRow title="Login alerts" description="Notify staff when a security-sensitive login event occurs."><Toggle checked={settings.security.loginAlerts} onChange={(v) => update('security', 'loginAlerts', v)} disabled={!canEdit} /></SettingRow>
                <SettingRow title="Allow new registrations" description="Controls whether new public accounts can be created."><Toggle checked={settings.security.allowRegistrations} onChange={(v) => update('security', 'allowRegistrations', v)} disabled={!canEdit} /></SettingRow>
                <div className="admin-settings-grid single-mobile">
                  <Field label="Admin session duration (hours)" type="number" value={settings.security.adminSessionHours} onChange={(v) => update('security', 'adminSessionHours', Math.max(1, v || 1))} disabled={!canEdit} />
                </div>
              </section>
            )}

            {section === 'staff' && (
              <section className="admin-settings-card">
                <div className="admin-settings-info-box"><strong>Current permission model</strong><span>Only the <b>admin</b> role can edit platform settings. Expert, support and finance staff can review settings but cannot change them.</span></div>
                <div className="admin-settings-staff-list">
                  {staff.length ? staff.map((member, index) => <div className="admin-settings-staff-row" key={`${member.user_id}-${index}`}><span>{member.user_id}</span><b>{member.role}</b></div>) : <div className="admin-settings-empty">No staff role records found.</div>}
                </div>
                <div className="admin-settings-permission-grid">
                  {['Users', 'Projects', 'Services', 'Payments', 'Messages', 'Files', 'Notifications', 'Settings'].map((name) => <div key={name}><strong>{name}</strong><span>Admin ✓</span><span>Expert {['Projects', 'Services', 'Messages', 'Files'].includes(name) ? '✓' : 'View'}</span><span>Support {['Messages', 'Files'].includes(name) ? '✓' : 'View'}</span><span>Finance {name === 'Payments' ? '✓' : 'View'}</span></div>)}
                </div>
              </section>
            )}

            {section === 'payments' && (
              <section className="admin-settings-card">
                <div className="admin-settings-grid">
                  <SelectField label="Payment mode" value={settings.payments.mode} onChange={(v) => update('payments', 'mode', v)} disabled={!canEdit} options={[['test', 'Test / Sandbox'], ['live', 'Live / Production']]} />
                  <SelectField label="Default currency" value={settings.payments.defaultCurrency} onChange={(v) => update('payments', 'defaultCurrency', v)} disabled={!canEdit} options={[['BDT', 'BDT'], ['USD', 'USD'], ['EUR', 'EUR'], ['GBP', 'GBP']]} />
                </div>
                <SettingRow title="Domestic payments" description="Allow the configured local payment gateway to accept transactions."><Toggle checked={settings.payments.domesticEnabled} onChange={(v) => update('payments', 'domesticEnabled', v)} disabled={!canEdit} /></SettingRow>
                <SettingRow title="International payments" description="Enable international payment rails after provider eligibility and webhook verification are complete."><Toggle checked={settings.payments.internationalEnabled} onChange={(v) => update('payments', 'internationalEnabled', v)} disabled={!canEdit} /></SettingRow>
                <SettingRow title="Require payment confirmation" description="Keep an order unpaid until server-side payment verification succeeds."><Toggle checked={settings.payments.requirePaymentConfirmation} onChange={(v) => update('payments', 'requirePaymentConfirmation', v)} disabled={!canEdit} /></SettingRow>
                <SettingRow title="Allow refunds" description="Expose refund workflow to authorized finance/admin staff."><Toggle checked={settings.payments.allowRefunds} onChange={(v) => update('payments', 'allowRefunds', v)} disabled={!canEdit} /></SettingRow>
                <SettingRow title="Allow cancellations" description="Allow the order workflow to process cancellations according to policy."><Toggle checked={settings.payments.allowCancellations} onChange={(v) => update('payments', 'allowCancellations', v)} disabled={!canEdit} /></SettingRow>
                <SettingRow title="Generate invoices" description="Enable invoice generation after successful payment confirmation."><Toggle checked={settings.payments.generateInvoices} onChange={(v) => update('payments', 'generateInvoices', v)} disabled={!canEdit} /></SettingRow>
                <div className="admin-settings-warning">Payment provider API keys, webhook secrets and other credentials must remain server-side. Do not put them in this client-readable settings record.</div>
              </section>
            )}

            {section === 'orders' && (
              <section className="admin-settings-card">
                <SettingRow title="Accept new orders" description="Global switch for accepting new Formant service orders."><Toggle checked={settings.orders.acceptNewOrders} onChange={(v) => update('orders', 'acceptNewOrders', v)} disabled={!canEdit} /></SettingRow>
                <SettingRow title="Require admin approval" description="Hold newly created orders until staff approves them."><Toggle checked={settings.orders.requireAdminApproval} onChange={(v) => update('orders', 'requireAdminApproval', v)} disabled={!canEdit} /></SettingRow>
                <SettingRow title="Require client confirmation" description="Require client confirmation before an order is considered fully completed."><Toggle checked={settings.orders.requireClientConfirmation} onChange={(v) => update('orders', 'requireClientConfirmation', v)} disabled={!canEdit} /></SettingRow>
                <div className="admin-settings-grid">
                  <SelectField label="Default order status" value={settings.orders.defaultStatus} onChange={(v) => update('orders', 'defaultStatus', v)} disabled={!canEdit} options={[['pending', 'Pending'], ['queued', 'Queued'], ['information_required', 'Information required']]} />
                  <Field label="Default delivery days" type="number" value={settings.orders.defaultDeliveryDays} onChange={(v) => update('orders', 'defaultDeliveryDays', Math.max(1, v || 1))} disabled={!canEdit} />
                  <Field label="Default revisions" type="number" value={settings.orders.defaultRevisions} onChange={(v) => update('orders', 'defaultRevisions', Math.max(0, v || 0))} disabled={!canEdit} />
                  <Field label="Auto-complete after (days)" type="number" value={settings.orders.autoCompleteDays} onChange={(v) => update('orders', 'autoCompleteDays', Math.max(0, v || 0))} disabled={!canEdit} />
                </div>
              </section>
            )}

            {section === 'email' && (
              <section className="admin-settings-card">
                <div className="admin-settings-grid">
                  <Field label="Sender name" value={settings.email.senderName} onChange={(v) => update('email', 'senderName', v)} disabled={!canEdit} />
                  <Field label="Sender email" type="email" value={settings.email.senderEmail} onChange={(v) => update('email', 'senderEmail', v)} disabled={!canEdit} />
                  <Field label="Reply-to email" type="email" value={settings.email.replyTo} onChange={(v) => update('email', 'replyTo', v)} disabled={!canEdit} />
                </div>
                <SettingRow title="Transactional email" description="Enable the platform's transactional email workflows."><Toggle checked={settings.email.enabled} onChange={(v) => update('email', 'enabled', v)} disabled={!canEdit} /></SettingRow>
                {[['orderConfirmation', 'Order confirmation'], ['paymentConfirmation', 'Payment confirmation'], ['paymentFailed', 'Payment failed'], ['projectUpdates', 'Project updates'], ['messageNotifications', 'Message notifications'], ['reviewRequests', 'Review requests']].map(([key, label]) => <SettingRow key={key} title={label} description={`Send ${label.toLowerCase()} emails.`}><Toggle checked={settings.email[key]} onChange={(v) => update('email', key, v)} disabled={!canEdit} /></SettingRow>)}
                <button type="button" className="admin-settings-secondary" disabled={!canEdit}>Send Test Email</button>
              </section>
            )}

            {section === 'notifications' && (
              <section className="admin-settings-card">
                {[['newUser', 'New user'], ['newOrder', 'New order'], ['paymentReceived', 'Payment received'], ['paymentFailed', 'Payment failed'], ['newMessage', 'New message'], ['projectUpdated', 'Project updated'], ['projectCompleted', 'Project completed'], ['fileUploaded', 'File uploaded'], ['reviewSubmitted', 'Review submitted'], ['adminAlert', 'Admin alert']].map(([key, label]) => <SettingRow key={key} title={label} description={`Enable the global in-app notification for ${label.toLowerCase()}.`}><Toggle checked={settings.notifications[key]} onChange={(v) => update('notifications', key, v)} disabled={!canEdit} /></SettingRow>)}
              </section>
            )}

            {section === 'storage' && (
              <section className="admin-settings-card">
                <div className="admin-settings-grid">
                  <Field label="Maximum upload size (MB)" type="number" value={settings.storage.maxUploadMb} onChange={(v) => update('storage', 'maxUploadMb', Math.max(1, v || 1))} disabled={!canEdit} />
                  <Field label="Signed URL lifetime (minutes)" type="number" value={settings.storage.signedUrlMinutes} onChange={(v) => update('storage', 'signedUrlMinutes', Math.max(5, v || 5))} disabled={!canEdit} />
                </div>
                <SettingRow title="Private by default" description="New client documents should be treated as private files by default."><Toggle checked={settings.storage.privateByDefault} onChange={(v) => update('storage', 'privateByDefault', v)} disabled={!canEdit} /></SettingRow>
                <SettingRow title="PDF files" description="Allow PDF uploads in the Files workflow."><Toggle checked={settings.storage.allowPdf} onChange={(v) => update('storage', 'allowPdf', v)} disabled={!canEdit} /></SettingRow>
                <SettingRow title="Documents" description="Allow DOC, DOCX, XLS, XLSX, PPT and PPTX files."><Toggle checked={settings.storage.allowDocuments} onChange={(v) => update('storage', 'allowDocuments', v)} disabled={!canEdit} /></SettingRow>
                <SettingRow title="Images" description="Allow JPG, PNG and WEBP uploads."><Toggle checked={settings.storage.allowImages} onChange={(v) => update('storage', 'allowImages', v)} disabled={!canEdit} /></SettingRow>
                <SettingRow title="ZIP files" description="Allow ZIP uploads where required by the workflow."><Toggle checked={settings.storage.allowZip} onChange={(v) => update('storage', 'allowZip', v)} disabled={!canEdit} /></SettingRow>
              </section>
            )}

            {section === 'audit' && (
              <section className="admin-settings-card">
                <div className="admin-settings-info-box"><strong>Recent sensitive actions</strong><span>Configuration changes are recorded here when the audit table is available.</span></div>
                <div className="admin-settings-audit-list">
                  {auditLogs.length ? auditLogs.map((log) => <div className="admin-settings-audit-row" key={log.id}><div><strong>{log.action}</strong><span>{log.resource}</span></div><div><span>{log.actor_id || 'Unknown actor'}</span><small>{formatDate(log.created_at)}</small></div></div>) : <div className="admin-settings-empty">No audit records available yet.</div>}
                </div>
              </section>
            )}

            {section === 'danger' && (
              <section className="admin-settings-card admin-settings-danger-card">
                <div className="admin-settings-danger-title">High-impact controls</div>
                <p>These controls affect platform availability. Changes still need to be saved to become persistent.</p>
                <div className="admin-settings-danger-actions">
                  <button type="button" disabled={!canEdit || dangerBusy} onClick={() => runDangerAction('disableRegistrations')}>Disable new registrations</button>
                  <button type="button" disabled={!canEdit || dangerBusy} onClick={() => runDangerAction('disableOrders')}>Disable new orders</button>
                  <button type="button" disabled={!canEdit || dangerBusy} onClick={() => runDangerAction('maintenance')}>Enable maintenance mode</button>
                </div>
                <div className="admin-settings-warning">There is intentionally no destructive database-reset button here. Database deletion, credential rotation and irreversible data operations should be handled through protected infrastructure tooling.</div>
              </section>
            )}
          </main>
        </div>
      </div>
    </DashboardShell>
  );
}
