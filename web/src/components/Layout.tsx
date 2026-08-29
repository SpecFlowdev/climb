import {
  Coins,
  LayoutDashboard,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  PieChart,
  Repeat,
  Settings as SettingsIcon,
  Sun,
  Tags,
  TrendingUp,
  Wallet,
  Workflow,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useApp } from '../app-context';
import { useI18n, LOCALES, type LocaleCode } from '../i18n';
import { useLocalStorage } from '../hooks';

const NAV = [
  { to: '/', key: 'nav.dashboard', icon: LayoutDashboard, end: true },
  { to: '/portfolio', key: 'nav.portfolio', icon: Coins },
  { to: '/analytics', key: 'nav.analytics', icon: PieChart },
  { to: '/transactions', key: 'nav.transactions', icon: TrendingUp },
  { to: '/wallets', key: 'nav.wallets', icon: Wallet },
  { to: '/categories', key: 'nav.categories', icon: Tags },
  { to: '/rules', key: 'nav.rules', icon: Workflow },
  { to: '/convert', key: 'nav.convert', icon: Repeat },
  { to: '/settings', key: 'nav.settings', icon: SettingsIcon },
] as const;

export function Layout({ children }: { children: ReactNode }) {
  const { t, locale, setLocale } = useI18n();
  const { settings, update } = useApp();
  const [collapsed, setCollapsed] = useLocalStorage('climb.sidebar', false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dark = settings.theme !== 'light';

  return (
    <div className={`app ${collapsed ? 'collapsed' : ''}`}>
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="brand">
          <span className="brand-mark">
            <TrendingUp size={18} />
          </span>
          {!collapsed && <span>{t('app.name')}</span>}
        </div>

        <nav style={{ display: 'grid', gap: 4 }}>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item ? item.end : false}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setMobileOpen(false)}
              title={t(item.key)}
            >
              <item.icon size={18} />
              {!collapsed && <span>{t(item.key)}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            className="nav-link"
            onClick={() => update({ theme: dark ? 'light' : 'dark' })}
            title={t('settings.theme')}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
            {!collapsed && <span>{dark ? t('settings.themeLight') : t('settings.themeDark')}</span>}
          </button>
          <button
            className="nav-link"
            onClick={() => setLocale(locale === 'en' ? 'ru' : ('en' as LocaleCode))}
            title={t('settings.language')}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>{LOCALES[locale].flag}</span>
            {!collapsed && <span>{LOCALES[locale].name}</span>}
          </button>
          <button className="nav-link" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            {!collapsed && <span>{t('nav.collapse')}</span>}
          </button>
        </div>
      </aside>

      <div className="content">
        <button
          className="btn ghost icon"
          style={{ position: 'fixed', top: 14, left: 12, zIndex: 40 }}
          onClick={() => setMobileOpen((open) => !open)}
          aria-label="menu"
          data-mobile-only
        >
          <Menu size={18} />
        </button>
        {children}
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="topbar">
      <div>
        <h1>{title}</h1>
        {subtitle && <div className="sub">{subtitle}</div>}
      </div>
      <div className="topbar-actions">{actions}</div>
    </div>
  );
}
