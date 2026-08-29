import {
  Coins,
  Flag,
  LayoutDashboard,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  PieChart,
  Repeat,
  RotateCw,
  Settings as SettingsIcon,
  Sun,
  Tags,
  TrendingUp,
  Wallet,
  Workflow,
  Target,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useApp } from '../app-context';
import { useI18n, LOCALES, type LocaleCode, type TranslationKey } from '../i18n';
import { useLocalStorage } from '../hooks';

interface NavItem {
  to: string;
  key: TranslationKey;
  icon: typeof LayoutDashboard;
  end?: boolean;
}

/**
 * Grouped so the sidebar reads as three jobs — see where you stand, manage the
 * money, configure the instance — instead of one long undifferentiated list.
 */
const GROUPS: Array<{ label: TranslationKey; items: NavItem[] }> = [
  {
    label: 'nav.group.overview',
    items: [
      { to: '/', key: 'nav.dashboard', icon: LayoutDashboard, end: true },
      { to: '/portfolio', key: 'nav.portfolio', icon: Coins },
      { to: '/analytics', key: 'nav.analytics', icon: PieChart },
    ],
  },
  {
    label: 'nav.group.money',
    items: [
      { to: '/transactions', key: 'nav.transactions', icon: TrendingUp },
      { to: '/budgets', key: 'nav.budgets', icon: Target },
      { to: '/goals', key: 'nav.goals', icon: Flag },
      { to: '/recurring', key: 'nav.recurring', icon: RotateCw },
    ],
  },
  {
    label: 'nav.group.manage',
    items: [
      { to: '/wallets', key: 'nav.wallets', icon: Wallet },
      { to: '/categories', key: 'nav.categories', icon: Tags },
      { to: '/rules', key: 'nav.rules', icon: Workflow },
      { to: '/convert', key: 'nav.convert', icon: Repeat },
      { to: '/settings', key: 'nav.settings', icon: SettingsIcon },
    ],
  },
];

export function Layout({ children }: { children: ReactNode }) {
  const { t, locale, setLocale } = useI18n();
  const { settings, update } = useApp();
  const [collapsed, setCollapsed] = useLocalStorage('climb.sidebar', false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dark = settings.theme !== 'light';

  return (
    <div className={`app ${collapsed ? 'collapsed' : ''}`}>
      <aside className={`sidebar-col ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebar">
          <div className="brand">
            <span className="brand-mark">
              <TrendingUp size={18} />
            </span>
            {!collapsed && <span>{t('app.name')}</span>}
          </div>

          <nav className="nav-groups">
            {GROUPS.map((group) => (
              <div key={group.label} className="nav-group">
                {!collapsed && <div className="nav-group-label">{t(group.label)}</div>}
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end ?? false}
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                    onClick={() => setMobileOpen(false)}
                    title={t(item.key)}
                  >
                    <item.icon size={17} />
                    {!collapsed && <span>{t(item.key)}</span>}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>

          <div className="sidebar-footer">
            <button
              className="nav-link"
              onClick={() => update({ theme: dark ? 'light' : 'dark' })}
              title={t('settings.theme')}
            >
              {dark ? <Sun size={17} /> : <Moon size={17} />}
              {!collapsed && (
                <span>{dark ? t('settings.themeLight') : t('settings.themeDark')}</span>
              )}
            </button>
            <button
              className="nav-link"
              onClick={() => setLocale(locale === 'en' ? 'ru' : ('en' as LocaleCode))}
              title={t('settings.language')}
            >
              <span style={{ fontSize: 15, lineHeight: 1 }}>{LOCALES[locale].flag}</span>
              {!collapsed && <span>{LOCALES[locale].name}</span>}
            </button>
            <button className="nav-link" onClick={() => setCollapsed(!collapsed)}>
              {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
              {!collapsed && <span>{t('nav.collapse')}</span>}
            </button>
          </div>
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
