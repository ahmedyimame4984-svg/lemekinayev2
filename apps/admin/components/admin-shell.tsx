'use client';

import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import { BrandMark } from './brand-mark';
import {
  ActivityIcon,
  CarIcon,
  CloseIcon,
  GridIcon,
  LayersIcon,
  LogoutIcon,
  MenuIcon,
  SearchIcon,
  ShieldIcon,
  StoreIcon,
  UsersIcon,
} from './icons';
import { useAdminPrincipal } from './admin-session';
import { postJson } from '@/lib/client-api';
import { adminWorkspaceSection } from '@/lib/navigation';

type AdminModule = {
  label: string;
  icon: typeof GridIcon;
  href: string;
  ready: boolean;
  permission?: string;
  permissionsAny?: string[];
};

const modules: AdminModule[] = [
  { label: 'Overview', icon: GridIcon, href: '/admin', ready: true },
  { label: 'Search', icon: SearchIcon, href: '/admin/search', ready: true },
  {
    label: 'Autotechdoc sync',
    icon: ActivityIcon,
    href: '/admin/reference-sync',
    ready: true,
    permission: 'catalog.manage',
    permissionsAny: ['vehicle.manage'],
  },
  {
    label: 'Imports / jobs',
    icon: ActivityIcon,
    href: '/admin/imports',
    ready: true,
    permissionsAny: ['catalog.manage', 'vehicle.manage'],
  },
  {
    label: 'Catalog',
    icon: LayersIcon,
    href: '/admin/catalog/product-types',
    ready: true,
  },
  { label: 'Vehicles', icon: CarIcon, href: '/admin/vehicles/configurations', ready: true },
  {
    label: 'Sourcing',
    icon: ActivityIcon,
    href: '/admin/sourcing/suppliers',
    ready: true,
  },
  {
    label: 'Marketplace',
    icon: StoreIcon,
    href: '/admin/marketplace/sellers',
    ready: true,
  },
  { label: 'Admin accounts', icon: UsersIcon, href: '/admin/accounts', ready: true },
  {
    label: 'Audit history',
    icon: ShieldIcon,
    href: '/admin/audit',
    ready: true,
    permission: 'admin.audit.read',
  },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const principal = useAdminPrincipal();
  const workspaceSection = adminWorkspaceSection(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  async function logout() {
    setLoggingOut(true);
    setLogoutError('');
    try {
      await postJson<void>('/api/auth/logout', {});
      router.replace('/login');
      router.refresh();
    } catch {
      setLogoutError('Could not revoke this session. Please try again.');
      setLoggingOut(false);
    }
  }

  return (
    <div className="admin-layout">
      <a className="skip-link" href="#admin-content">
        Skip to main content
      </a>
      {menuOpen ? (
        <button
          className="sidebar-scrim"
          type="button"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}
      <aside
        id="admin-navigation"
        className={`sidebar${menuOpen ? ' sidebar--open' : ''}`}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setMenuOpen(false);
        }}
      >
        <div className="sidebar__header">
          <BrandMark inverse />
          <button
            className="icon-button sidebar__close"
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation"
          >
            <CloseIcon />
          </button>
        </div>
        <nav className="sidebar__nav" aria-label="Admin modules">
          <span className="sidebar__label">Workspace</span>
          {modules.map(
            ({ label, icon: Icon, href, ready, permission, permissionsAny }) => {
              const hidden =
                (permission &&
                  !principal.permissions.includes(permission)) ||
                (permissionsAny &&
                  !permissionsAny.some((item) =>
                    principal.permissions.includes(item),
                  ));
              if (hidden) return null;

              return ready ? (
                <a
                  className={`nav-item${isActiveModule(pathname, href) ? ' nav-item--active' : ''}`}
                  href={href}
                  key={label}
                  onClick={() => setMenuOpen(false)}
                >
                  <Icon /> <span>{label}</span>
                </a>
              ) : (
                <span
                  className="nav-item nav-item--disabled"
                  aria-disabled="true"
                  key={label}
                >
                  <Icon /> <span>{label}</span>
                  <small>Next</small>
                </span>
              );
            },
          )}
        </nav>
        <div className="sidebar__security">
          <ShieldIcon />
          <span>
            <strong>MFA session active</strong>Protected Admin workspace
          </span>
        </div>
        <div className="sidebar__profile">
          <span className="avatar">A</span>
          <span className="sidebar__identity">
            <strong>Administrator</strong>
            <small title={principal.userId}>{shortId(principal.userId)}</small>
          </span>
          <button
            className="icon-button"
            type="button"
            disabled={loggingOut}
            onClick={logout}
            aria-label="Sign out"
          >
            {loggingOut ? <span className="spinner" /> : <LogoutIcon />}
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="topbar">
          <button
            className="icon-button topbar__menu"
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation"
            aria-expanded={menuOpen}
            aria-controls="admin-navigation"
          >
            <MenuIcon />
          </button>
          <div className="topbar__workspace">
            <span className="topbar__eyebrow">Operations workspace</span>
            <strong>{workspaceSection}</strong>
          </div>
          <form className="topbar__global-search" action="/admin/search" method="get">
            <SearchIcon />
            <input
              aria-label="Search the global catalog"
              maxLength={120}
              minLength={2}
              name="q"
              required
              placeholder="MPN, OE, Brand, vehicle, engine…"
              type="search"
            />
            <button type="submit">Search</button>
          </form>
          <span className="status-pill">
            <i />
            Secure session
          </span>
        </header>
        {logoutError ? (
          <div className="top-alert" role="alert">
            {logoutError}
          </div>
        ) : null}
        <main className="admin-content" id="admin-content">
          {children}
        </main>
      </div>
    </div>
  );
}

function isActiveModule(pathname: string, href: string): boolean {
  if (href === '/admin/catalog/product-types') {
    return pathname.startsWith('/admin/catalog');
  }
  if (href === '/admin/vehicles/configurations') {
    return pathname.startsWith('/admin/vehicles');
  }
  if (href === '/admin/sourcing/suppliers') {
    return pathname.startsWith('/admin/sourcing');
  }
  if (href === '/admin/marketplace/sellers') {
    return pathname.startsWith('/admin/marketplace');
  }
  return pathname === href;
}

function shortId(value: string): string {
  return value.length > 12 ? `${value.slice(0, 8)}…` : value;
}
