import React from 'react';
import {
  NavLink,
  Link,
  useNavigate
} from 'react-router-dom';

import Logo from './Logo';
import {
  load,
  logout
} from '../lib/store';

/* =========================================================
   NAVIGATION
========================================================= */

const userNav = [
  {
    to: '/dashboard',
    label: 'Overview',
    icon: 'grid'
  },
  {
    to: '/dashboard/profile',
    label: 'My Profile',
    icon: 'user'
  },
  {
    to: '/dashboard/orders',
    label: 'My Orders',
    icon: 'orders'
  },
  {
    to: '/dashboard/messages',
    label: 'Messages',
    icon: 'message'
  },
  {
    to: '/dashboard/files',
    label: 'Files',
    icon: 'file'
  },
  {
    to: '/dashboard/payments',
    label: 'Payments',
    icon: 'card'
  },
  {
    to: '/dashboard/notifications',
    label: 'Notifications',
    icon: 'bell'
  },
  {
    to: '/dashboard/settings',
    label: 'Settings',
    icon: 'settings'
  }
];

const adminNav = [
  {
    to: '/admin',
    label: 'Overview',
    icon: 'grid'
  },
  {
    to: '/admin/workspace',
    label: 'Workspace',
    icon: 'briefcase'
  },
  {
    to: '/admin/users',
    label: 'Users',
    icon: 'users'
  },
  {
    to: '/admin/orders',
    label: 'Orders',
    icon: 'orders'
  },
  {
    to: '/admin/projects',
    label: 'Projects',
    icon: 'folder'
  },
  {
    to: '/admin/services',
    label: 'Services',
    icon: 'layers'
  },
  {
    to: '/admin/payments',
    label: 'Payments',
    icon: 'card'
  },
  {
    to: '/admin/messages',
    label: 'Messages',
    icon: 'message'
  },
  {
    to: '/admin/files',
    label: 'Files',
    icon: 'file'
  },
  {
    to: '/admin/reviews',
    label: 'Reviews',
    icon: 'star'
  },
  {
    to: '/admin/coupons',
    label: 'Coupons',
    icon: 'tag'
  },
  {
    to: '/admin/notifications',
    label: 'Notifications',
    icon: 'bell'
  },
  {
    to: '/admin/settings',
    label: 'Settings',
    icon: 'settings'
  }
];

/* =========================================================
   ICONS
========================================================= */

function Icon({ name }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true
  };

  switch (name) {
    case 'grid':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1.2" />
          <rect x="14" y="3" width="7" height="7" rx="1.2" />
          <rect x="3" y="14" width="7" height="7" rx="1.2" />
          <rect x="14" y="14" width="7" height="7" rx="1.2" />
        </svg>
      );

    case 'user':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.4" />
          <path d="M5 20c.8-3.5 3.1-5.2 7-5.2s6.2 1.7 7 5.2" />
        </svg>
      );

    case 'orders':
      return (
        <svg {...common}>
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M8 8h8M8 12h8M8 16h5" />
        </svg>
      );

    case 'message':
      return (
        <svg {...common}>
          <path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.6 8.6 0 0 1-3.4-.7L4 20l1.7-4A7.1 7.1 0 0 1 4.5 12 7.5 7.5 0 0 1 12 4.5a7.5 7.5 0 0 1 8 7Z" />
        </svg>
      );

    case 'file':
      return (
        <svg {...common}>
          <path d="M7 3h7l4 4v14H7z" />
          <path d="M14 3v5h4M10 13h5M10 17h5" />
        </svg>
      );

    case 'card':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 10h18M7 15h4" />
        </svg>
      );

    case 'bell':
      return (
        <svg {...common}>
          <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
          <path d="M10 21h4" />
        </svg>
      );

    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.8 1.8 0 0 0 .3 2l.1.1-1.8 1.8-.1-.1a1.8 1.8 0 0 0-2-.3 1.8 1.8 0 0 0-1.1 1.7V21h-2.6v-.8a1.8 1.8 0 0 0-1.1-1.7 1.8 1.8 0 0 0-2 .3l-.1.1-1.8-1.8.1-.1a1.8 1.8 0 0 0 .3-2 1.8 1.8 0 0 0-1.7-1.1H4v-2.6h.8a1.8 1.8 0 0 0 1.7-1.1 1.8 1.8 0 0 0-.3-2l-.1-.1 1.8-1.8.1.1a1.8 1.8 0 0 0 2 .3A1.8 1.8 0 0 0 11.1 5V4h2.6v1a1.8 1.8 0 0 0 1.1 1.6 1.8 1.8 0 0 0 2-.3l.1-.1 1.8 1.8-.1.1a1.8 1.8 0 0 0-.3 2 1.8 1.8 0 0 0 1.7 1.1h.8v2.6H20a1.8 1.8 0 0 0-1.6 1.2Z" />
        </svg>
      );

    case 'briefcase':
      return (
        <svg {...common}>
          <rect x="4" y="7" width="16" height="13" rx="2" />
          <path d="M9 7V5h6v2M4 12h16M10 12v2h4v-2" />
        </svg>
      );

    case 'users':
      return (
        <svg {...common}>
          <circle cx="9" cy="9" r="3" />
          <circle cx="17" cy="10" r="2.5" />
          <path d="M3.5 19c.7-3 2.5-4.5 5.5-4.5s4.8 1.5 5.5 4.5M14.5 15.2c.9-.8 1.9-1.2 3.2-1.2 1.9 0 3.2.9 3.8 2.7" />
        </svg>
      );

    case 'folder':
      return (
        <svg {...common}>
          <path d="M3 6h7l2 2h9v10H3z" />
        </svg>
      );

    case 'layers':
      return (
        <svg {...common}>
          <path d="m12 3 8 4-8 4-8-4 8-4Z" />
          <path d="m4 12 8 4 8-4M4 17l8 4 8-4" />
        </svg>
      );

    case 'star':
      return (
        <svg {...common}>
          <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
        </svg>
      );

    case 'tag':
      return (
        <svg {...common}>
          <path d="M4 5v6l9 9 6-6-9-9H4Z" />
          <circle cx="8" cy="9" r="1" />
        </svg>
      );

    default:
      return null;
  }
}

/* =========================================================
   DASHBOARD SHELL
========================================================= */

export default function DashboardShell({
  children,
  admin = false
}) {
  const navigate = useNavigate();
  const s = load();

  const items = admin
    ? adminNav
    : userNav;

  const firstLetter =
    s.user?.name?.trim()?.charAt(0)?.toUpperCase() || 'U';

  return (
    <div className="app-shell">

      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <aside className="dashboard-sidebar">

        <div className="sidebar-brand">
          <Logo />
        </div>

        <div className="sidebar-section-title">
          {admin ? 'CONTROL PANEL' : 'CLIENT AREA'}
        </div>

        <nav className="sidebar-nav">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={
                item.to === '/dashboard' ||
                item.to === '/admin'
              }
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''}`
              }
            >
              <span className="sidebar-icon">
                <Icon name={item.icon} />
              </span>

              <span className="sidebar-link-label">
                {item.label}
              </span>
            </NavLink>
          ))}
        </nav>

        {/* ===================================================
            ACCOUNT
        =================================================== */}

        <div className="sidebar-bottom">

          <div className="sidebar-account">

            <div className="sidebar-avatar">
              {firstLetter}
            </div>

            <div className="sidebar-account-copy">
              <strong>
                {s.user?.name || 'Client'}
              </strong>

              <span>
                {admin
                  ? 'Administrator'
                  : s.user?.email || 'Careerlyst member'}
              </span>
            </div>

          </div>

          <button
            type="button"
            className="sidebar-signout"
            onClick={() => {
              logout();
              navigate('/');
            }}
          >
            <span>Sign out</span>
            <span>↗</span>
          </button>

          {!admin && (
            <Link
              to="/admin"
              className="sidebar-admin-link"
            >
              Admin workspace
              <span>↗</span>
            </Link>
          )}

        </div>

      </aside>

      {/* =====================================================
          MAIN
      ===================================================== */}

      <main className="app-main">

        <div className="mobile-top">
          <Logo />
        </div>

        {children}

      </main>

    </div>
  );
}