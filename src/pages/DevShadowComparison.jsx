import React, { useState } from 'react';

/**
 * Formant Design System — Shadow Refinement Before/After Comparison
 * Development-only visual comparison tool.
 *
 * All BEFORE values reflect the exact Git history prior to the shadow refactor.
 * All AFTER values reflect the standardized 5-level elevation tokens.
 */

const SHADOW_DATA = {
  light: {
    cards: {
      resting: {
        before: '0 2px 10px rgba(17, 18, 15, 0.025)',
        after: '0 1px 2px rgba(17, 18, 15, 0.035), 0 6px 18px rgba(17, 18, 15, 0.035)',
        token: 'var(--shadow-subtle)',
        notes: 'Legacy: 1-layer diffuse haze without grounding. Refined: 2-layer crisp 1px contact + 18px soft dispersion.'
      },
      hover: {
        before: '0 12px 32px rgba(17, 18, 15, 0.08)',
        after: '0 2px 4px rgba(17, 18, 15, 0.045), 0 10px 24px rgba(17, 18, 15, 0.07)',
        token: 'var(--shadow-raised)',
        notes: 'Legacy: Heavy 32px single blur spread. Refined: Restrained 10px/24px dual falloff for clean tactile hover.'
      }
    },
    dropdowns: {
      account: {
        before: '0 18px 45px rgba(20, 22, 14, 0.14)',
        after: '0 4px 10px rgba(17, 18, 15, 0.075), 0 18px 36px rgba(17, 18, 15, 0.10)',
        token: 'var(--shadow-floating)',
        notes: 'Legacy: 45px dark cloud obscuring background content. Refined: Immediate 4px contact shadow with 36px ambient wash.'
      },
      search: {
        before: '0 22px 55px rgba(20, 22, 14, 0.14)',
        after: '0 4px 10px rgba(17, 18, 15, 0.075), 0 18px 36px rgba(17, 18, 15, 0.10)',
        token: 'var(--shadow-floating)',
        notes: 'Standardized onto Level 3 floating token with 10% outer opacity.'
      }
    },
    modals: {
      dialog: {
        before: '0 24px 70px rgba(17, 18, 15, 0.20)',
        after: '0 8px 18px rgba(17, 18, 15, 0.10), 0 26px 58px rgba(17, 18, 15, 0.16)',
        token: 'var(--shadow-modal)',
        notes: 'Legacy: 70px heavy spread at 20% alpha creating muddy smudges on cream paper. Refined: 2-layer modal elevation.'
      }
    },
    drawers: {
      panel: {
        before: '-20px 0 60px rgba(0, 0, 0, 0.12)',
        after: '-4px 0 16px rgba(17, 18, 15, 0.05), -18px 0 45px rgba(17, 18, 15, 0.12)',
        token: 'Two-tier directional',
        notes: 'Legacy: Blurry single-layer black shadow. Refined: Crisp -4px contact edge prevents harsh seam bleed.'
      }
    },
    toasts: {
      toast: {
        before: '0 14px 40px rgba(17, 18, 15, 0.14)',
        after: '0 4px 10px rgba(17, 18, 15, 0.075), 0 18px 36px rgba(17, 18, 15, 0.10)',
        token: 'var(--shadow-floating)',
        notes: 'Legacy: 40px heavy overlay. Refined: Crisp floating notice sits gracefully over workspace.'
      }
    }
  },
  dark: {
    cards: {
      resting: {
        before: '0 2px 8px rgba(0, 0, 0, 0.3)',
        after: '0 1px 2px rgba(0, 0, 0, 0.16), 0 6px 18px rgba(0, 0, 0, 0.10)',
        token: 'var(--shadow-subtle)',
        notes: 'Legacy: Single 30% alpha layer. Refined: Dual-layer balanced with 1px border contrast.'
      },
      hover: {
        before: '0 12px 28px rgba(0, 0, 0, 0.5)',
        after: '0 2px 5px rgba(0, 0, 0, 0.20), 0 10px 24px rgba(0, 0, 0, 0.16)',
        token: 'var(--shadow-raised)',
        notes: 'Legacy: Opaque 50% black smudge. Refined: Multi-tier 20%/16% dark depth without muddy bleed.'
      }
    },
    dropdowns: {
      account: {
        before: '0 18px 50px rgba(0, 0, 0, 0.28)',
        after: '0 4px 10px rgba(0, 0, 0, 0.23), 0 18px 36px rgba(0, 0, 0, 0.22)',
        token: 'var(--shadow-floating)',
        notes: 'Legacy: High-spread generic drop. Refined: Differentiated floating depth for dark surfaces.'
      },
      search: {
        before: '0 18px 50px rgba(0, 0, 0, 0.28)',
        after: '0 4px 10px rgba(0, 0, 0, 0.23), 0 18px 36px rgba(0, 0, 0, 0.22)',
        token: 'var(--shadow-floating)',
        notes: 'Standardized floating elevation on dark surface.'
      }
    },
    modals: {
      dialog: {
        before: '0 18px 45px rgba(0, 0, 0, 0.40)',
        after: '0 8px 18px rgba(0, 0, 0, 0.26), 0 26px 58px rgba(0, 0, 0, 0.30)',
        token: 'var(--shadow-modal)',
        notes: 'Legacy: Flat heavy 40% blur. Refined: 26% contact + 30% ambient falloff.'
      }
    },
    drawers: {
      panel: {
        before: '-20px 0 60px rgba(0, 0, 0, 0.45)',
        after: '-4px 0 16px rgba(0, 0, 0, 0.20), -18px 0 45px rgba(0, 0, 0, 0.35)',
        token: 'Two-tier directional',
        notes: 'Refined dark drawer seam depth.'
      }
    },
    toasts: {
      toast: {
        before: '0 14px 40px rgba(0, 0, 0, 0.35)',
        after: '0 4px 10px rgba(0, 0, 0, 0.23), 0 18px 36px rgba(0, 0, 0, 0.22)',
        token: 'var(--shadow-floating)',
        notes: 'Refined toast depth for dark mode.'
      }
    }
  }
};

export default function DevShadowComparison() {
  const [theme, setTheme] = useState('light');
  const [activeTab, setActiveTab] = useState('all');
  const [cardHoverState, setCardHoverState] = useState(false);

  const isDark = theme === 'dark';
  const data = isDark ? SHADOW_DATA.dark : SHADOW_DATA.light;

  // Colors based on theme
  const colors = isDark
    ? {
        bg: '#10110e',
        surface: '#151610',
        paper: '#1a1b14',
        border: 'rgba(255, 255, 255, 0.08)',
        borderStrong: 'rgba(255, 255, 255, 0.16)',
        ink: '#f5f5f0',
        muted: '#8e9188',
        lime: '#c7f72f',
        green: '#a8c936',
        danger: '#e07b78',
        cardBg: '#181912'
      }
    : {
        bg: '#f6f5ee',
        surface: '#fbfaf3',
        paper: '#ffffff',
        border: '#deded5',
        borderStrong: '#11120f',
        ink: '#11120f',
        muted: '#6d7069',
        lime: '#c7f72f',
        green: '#8fb61c',
        danger: '#b94a48',
        cardBg: '#ffffff'
      };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: colors.bg,
        color: colors.ink,
        fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        padding: '32px 24px 80px',
        transition: 'background-color 0.2s ease, color 0.2s ease'
      }}
    >
      {/* Header Container */}
      <div style={{ maxWidth: 1200, margin: '0 auto 36px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 10px', borderRadius: 999, background: isDark ? 'rgba(199,247,47,0.1)' : 'rgba(199,247,47,0.25)', border: `1px solid ${colors.lime}`, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: colors.ink }}></span>
              Development Preview Tool
            </div>
            <h1 style={{ fontFamily: "'Manrope', sans-serif", fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 8px' }}>
              Formant Shadow Refinement Comparison
            </h1>
            <p style={{ margin: 0, color: colors.muted, fontSize: 14, maxWidth: 680, lineHeight: 1.55 }}>
              Side-by-side visual evaluation of exact legacy CSS shadows vs. the standardized 5-level elevation system. Dimensions, borders, backgrounds, and content are 100% identical.
            </p>
          </div>

          {/* Theme & Controls Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: colors.surface, border: `1px solid ${colors.border}`, padding: '6px 12px', borderRadius: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: colors.muted }}>Surface Theme:</span>
            <button
              type="button"
              onClick={() => setTheme('light')}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: 'none',
                background: !isDark ? colors.lime : 'transparent',
                color: '#11120f',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Light (Cream)
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: 'none',
                background: isDark ? colors.lime : 'transparent',
                color: isDark ? '#11120f' : colors.ink,
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Dark (Carbon)
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginTop: 24, paddingBottom: 4 }}>
          {['all', 'cards', 'dropdowns', 'modals', 'drawers', 'toasts'].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '8px 16px',
                borderRadius: 999,
                border: `1px solid ${activeTab === tab ? colors.ink : colors.border}`,
                background: activeTab === tab ? colors.ink : colors.surface,
                color: activeTab === tab ? (isDark ? '#11120f' : '#ffffff') : colors.ink,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all 0.15s ease'
              }}
            >
              {tab === 'all' ? 'All Components (5)' : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Main Comparison Container */}
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 48 }}>

        {/* =========================================================
            1. CARDS COMPARISON
            ========================================================= */}
        {(activeTab === 'all' || activeTab === 'cards') && (
          <SectionContainer title="1. Cards & Interactive Surfaces" description="Contained identity cards, report cards, and interactive package selectors." colors={colors}>
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: colors.muted }}>Simulate Card State:</span>
              <button
                type="button"
                onClick={() => setCardHoverState(!cardHoverState)}
                style={{
                  padding: '4px 12px',
                  borderRadius: 6,
                  border: `1px solid ${colors.border}`,
                  background: cardHoverState ? colors.lime : colors.surface,
                  color: '#11120f',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {cardHoverState ? 'State: Hover (Raised)' : 'State: Resting (Subtle)'}
              </button>
            </div>

            <ComparisonRow
              label="Interactive Service Package Card"
              sublabel={cardHoverState ? 'Simulated Hover State' : 'Default Resting State'}
              colors={colors}
              beforeShadow={cardHoverState ? data.cards.hover.before : data.cards.resting.before}
              afterShadow={cardHoverState ? data.cards.hover.after : data.cards.resting.after}
              beforeLabel="BEFORE (Legacy Shadow)"
              afterLabel="AFTER (Standardized Elevation)"
              beforeNotes={cardHoverState ? data.cards.hover.notes : data.cards.resting.notes}
              afterNotes={cardHoverState ? 'Level 2: --shadow-raised' : 'Level 1: --shadow-subtle'}
              renderComponent={(shadow) => (
                <div
                  style={{
                    width: 360,
                    maxWidth: '100%',
                    padding: 24,
                    borderRadius: 16,
                    background: colors.cardBg,
                    border: `1px solid ${cardHoverState ? colors.borderStrong : colors.border}`,
                    boxShadow: shadow,
                    transform: cardHoverState ? 'translateY(-3px)' : 'none',
                    transition: 'box-shadow 0.2s ease, transform 0.2s ease, border-color 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', padding: '3px 8px', borderRadius: 999, background: isDark ? 'rgba(199,247,47,0.15)' : 'rgba(199,247,47,0.3)', color: colors.ink }}>
                      EXECUTIVE SUITE
                    </span>
                    <span style={{ fontSize: 12, color: colors.muted, fontWeight: 600 }}>Delivery: 5-7 days</span>
                  </div>
                  <h3 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 6px', fontFamily: "'Manrope', sans-serif" }}>
                    CV & Bio Transformation
                  </h3>
                  <p style={{ fontSize: 13, color: colors.muted, lineHeight: 1.5, margin: '0 0 16px' }}>
                    Full structural overhaul, leadership metrics phrasing, ATS optimization, and executive summary.
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, borderTop: `1px solid ${colors.border}` }}>
                    <span style={{ fontSize: 18, fontWeight: 800 }}>$749</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: colors.ink }}>Select Package →</span>
                  </div>
                </div>
              )}
            />
          </SectionContainer>
        )}

        {/* =========================================================
            2. DROPDOWNS & POPOVERS
            ========================================================= */}
        {(activeTab === 'all' || activeTab === 'dropdowns') && (
          <SectionContainer title="2. Dropdowns & Autocomplete Popovers" description="Level 3 Floating elements: Account user menu, filter dropdowns, search role suggestions." colors={colors}>
            <ComparisonRow
              label="Account User Navigation Menu"
              sublabel="Floating dropdown docked beneath user profile button"
              colors={colors}
              beforeShadow={data.dropdowns.account.before}
              afterShadow={data.dropdowns.account.after}
              beforeLabel="BEFORE (Legacy 45px Dark Blur)"
              afterLabel="AFTER (Level 3: --shadow-floating)"
              beforeNotes={data.dropdowns.account.notes}
              afterNotes="4px contact sharpness prevents bottom glare + 36px soft ambient wash."
              renderComponent={(shadow) => (
                <div style={{ position: 'relative', padding: '20px 0' }}>
                  {/* Trigger Button Mock */}
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '6px 14px', borderRadius: 999, border: `1px solid ${colors.borderStrong}`, background: colors.surface, marginBottom: 8 }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: colors.lime, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800, color: '#11120f' }}>
                      AJ
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>Ashik J.</span>
                    <span style={{ fontSize: 10, color: colors.muted }}>▼</span>
                  </div>

                  {/* Dropdown Menu Content */}
                  <div
                    style={{
                      width: 260,
                      borderRadius: 16,
                      background: colors.cardBg,
                      border: `1px solid ${colors.border}`,
                      boxShadow: shadow,
                      overflow: 'hidden',
                      padding: '8px 0'
                    }}
                  >
                    <div style={{ padding: '8px 16px', borderBottom: `1px solid ${colors.border}` }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>ashik@formant.io</div>
                      <div style={{ fontSize: 11, color: colors.muted }}>Client Account</div>
                    </div>
                    {['My Orders & Progress', 'Messages & Feedback', 'Account Settings'].map((item) => (
                      <div key={item} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 500, color: colors.ink }}>
                        {item}
                      </div>
                    ))}
                    <div style={{ borderTop: `1px solid ${colors.border}`, marginTop: 4, paddingTop: 4 }}>
                      <div style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, color: colors.danger }}>
                        Sign Out
                      </div>
                    </div>
                  </div>
                </div>
              )}
            />
          </SectionContainer>
        )}

        {/* =========================================================
            3. MODALS & DIALOGS
            ========================================================= */}
        {(activeTab === 'all' || activeTab === 'modals') && (
          <SectionContainer title="3. Modals & Dialog Windows" description="Level 4 Modal overlays: Checkout confirmation, brief editor, administrative dialogs." colors={colors}>
            <ComparisonRow
              label="Confirmation Dialog Modal"
              sublabel="Centered modal elevated over backdrop overlay"
              colors={colors}
              beforeShadow={data.modals.dialog.before}
              afterShadow={data.modals.dialog.after}
              beforeLabel="BEFORE (Legacy 70px Dark Spread)"
              afterLabel="AFTER (Level 4: --shadow-modal)"
              beforeNotes={data.modals.dialog.notes}
              afterNotes="Tight 8px/18px contact layer + 26px/58px soft atmospheric elevation."
              renderComponent={(shadow) => (
                <div
                  style={{
                    position: 'relative',
                    width: 380,
                    maxWidth: '100%',
                    background: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(17,18,15,0.06)',
                    borderRadius: 18,
                    padding: 20
                  }}
                >
                  <div
                    style={{
                      background: colors.cardBg,
                      borderRadius: 18,
                      border: `1px solid ${colors.border}`,
                      boxShadow: shadow,
                      padding: 24
                    }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', color: colors.muted, textTransform: 'uppercase', marginBottom: 6 }}>
                      CONFIRMATION
                    </div>
                    <h4 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 8px', fontFamily: "'Manrope', sans-serif" }}>
                      Submit Project Brief?
                    </h4>
                    <p style={{ fontSize: 12, color: colors.muted, lineHeight: 1.5, margin: '0 0 20px' }}>
                      Once submitted, our senior editorial team will review your CV targets and initiate the transformation draft within 24 hours.
                    </p>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button type="button" style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${colors.border}`, background: 'transparent', color: colors.ink, fontSize: 12, fontWeight: 600 }}>
                        Cancel
                      </button>
                      <button type="button" style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: colors.ink, color: isDark ? '#11120f' : '#ffffff', fontSize: 12, fontWeight: 700 }}>
                        Submit Brief
                      </button>
                    </div>
                  </div>
                </div>
              )}
            />
          </SectionContainer>
        )}

        {/* =========================================================
            4. SIDE DRAWERS
            ========================================================= */}
        {(activeTab === 'all' || activeTab === 'drawers') && (
          <SectionContainer title="4. Side Drawers (Slide-in Panels)" description="Right-docked sliding drawers: Admin lead inspector, order detail panel, showcase reference viewer." colors={colors}>
            <ComparisonRow
              label="Right Slide-in Inspector Drawer"
              sublabel="Docked flush to the right viewport seam"
              colors={colors}
              beforeShadow={data.drawers.panel.before}
              afterShadow={data.drawers.panel.after}
              beforeLabel="BEFORE (-20px 0 60px Heavy Seam)"
              afterLabel="AFTER (Two-tier -4px / -18px Directional)"
              beforeNotes={data.drawers.panel.notes}
              afterNotes="Prevents blurry black bleed onto left workspace while keeping clear elevation."
              renderComponent={(shadow) => (
                <div
                  style={{
                    position: 'relative',
                    width: 380,
                    maxWidth: '100%',
                    height: 280,
                    background: colors.surface,
                    borderRadius: 14,
                    overflow: 'hidden',
                    border: `1px solid ${colors.border}`,
                    display: 'flex',
                    justifyContent: 'flex-end'
                  }}
                >
                  {/* Left dummy background content */}
                  <div style={{ flex: 1, padding: 16 }}>
                    <div style={{ height: 12, width: '60%', background: colors.border, borderRadius: 4, marginBottom: 10 }}></div>
                    <div style={{ height: 10, width: '80%', background: colors.border, borderRadius: 4, marginBottom: 8, opacity: 0.6 }}></div>
                    <div style={{ height: 10, width: '40%', background: colors.border, borderRadius: 4, opacity: 0.4 }}></div>
                  </div>

                  {/* Drawer Panel */}
                  <div
                    style={{
                      width: 250,
                      height: '100%',
                      background: colors.cardBg,
                      borderLeft: `1px solid ${colors.border}`,
                      boxShadow: shadow,
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <span style={{ fontSize: 11, fontWeight: 800 }}>Lead #4092</span>
                        <span style={{ fontSize: 14, color: colors.muted, cursor: 'pointer' }}>✕</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Dr. Clara Vance</div>
                      <div style={{ fontSize: 11, color: colors.muted, marginBottom: 12 }}>Executive CV + Cover Letter</div>
                      <div style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, background: isDark ? 'rgba(255,255,255,0.06)' : '#f2f1eb', color: colors.ink }}>
                        Status: Pending Consultation
                      </div>
                    </div>
                    <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 10 }}>
                      <button type="button" style={{ width: '100%', padding: '6px', borderRadius: 6, border: 'none', background: colors.ink, color: isDark ? '#11120f' : '#ffffff', fontSize: 11, fontWeight: 700 }}>
                        Assign Lead
                      </button>
                    </div>
                  </div>
                </div>
              )}
            />
          </SectionContainer>
        )}

        {/* =========================================================
            5. TOAST NOTIFICATIONS
            ========================================================= */}
        {(activeTab === 'all' || activeTab === 'toasts') && (
          <SectionContainer title="5. Toast Notifications & Floating Alerts" description="Feedback badges, message toasts, and system notifications." colors={colors}>
            <ComparisonRow
              label="Global System Toast Notice"
              sublabel="Floats above page content to report action results"
              colors={colors}
              beforeShadow={data.toasts.toast.before}
              afterShadow={data.toasts.toast.after}
              beforeLabel="BEFORE (Legacy 0 14px 40px Spread)"
              afterLabel="AFTER (Level 3: --shadow-floating)"
              beforeNotes={data.toasts.toast.notes}
              afterNotes="Lightweight, non-intrusive notification elevation."
              renderComponent={(shadow) => (
                <div
                  style={{
                    width: 360,
                    maxWidth: '100%',
                    padding: '12px 16px',
                    borderRadius: 12,
                    background: colors.cardBg,
                    border: `1px solid ${colors.border}`,
                    boxShadow: shadow,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12
                  }}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: colors.lime, flexShrink: 0 }}></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: colors.ink }}>Order Updated</div>
                    <div style={{ fontSize: 11, color: colors.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      PDF preview generated successfully.
                    </div>
                  </div>
                  <span style={{ fontSize: 14, color: colors.muted, cursor: 'pointer', flexShrink: 0 }}>✕</span>
                </div>
              )}
            />
          </SectionContainer>
        )}

      </div>
    </div>
  );
}

function SectionContainer({ title, description, children, colors }) {
  return (
    <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 20, padding: 28 }}>
      <div style={{ marginBottom: 24, borderBottom: `1px solid ${colors.border}`, paddingBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 6px', fontFamily: "'Manrope', sans-serif" }}>
          {title}
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: colors.muted }}>
          {description}
        </p>
      </div>
      {children}
    </div>
  );
}

function ComparisonRow({
  label,
  sublabel,
  colors,
  beforeShadow,
  afterShadow,
  beforeLabel,
  afterLabel,
  beforeNotes,
  afterNotes,
  renderComponent
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 2px' }}>{label}</h3>
        <span style={{ fontSize: 12, color: colors.muted }}>{sublabel}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
        {/* BEFORE Column */}
        <div style={{ background: colors.bg, border: `1px dashed ${colors.border}`, borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: colors.danger, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {beforeLabel}
            </span>
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 0 24px' }}>
            {renderComponent(beforeShadow)}
          </div>

          <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 12 }}>
            <div style={{ fontSize: 11, fontFamily: 'monospace', background: colors.surface, padding: '6px 10px', borderRadius: 6, color: colors.ink, wordBreak: 'break-all', marginBottom: 6 }}>
              box-shadow: {beforeShadow};
            </div>
            <div style={{ fontSize: 11, color: colors.muted, lineHeight: 1.4 }}>
              {beforeNotes}
            </div>
          </div>
        </div>

        {/* AFTER Column */}
        <div style={{ background: colors.bg, border: `1px solid ${colors.lime}`, borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: colors.green, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {afterLabel}
            </span>
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 0 24px' }}>
            {renderComponent(afterShadow)}
          </div>

          <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 12 }}>
            <div style={{ fontSize: 11, fontFamily: 'monospace', background: colors.surface, padding: '6px 10px', borderRadius: 6, color: colors.ink, wordBreak: 'break-all', marginBottom: 6 }}>
              box-shadow: {afterShadow};
            </div>
            <div style={{ fontSize: 11, color: colors.muted, lineHeight: 1.4 }}>
              {afterNotes}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
