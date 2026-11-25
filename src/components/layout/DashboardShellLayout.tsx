import { useState, type ReactNode } from 'react';
import {
  Menu,
  X,
  LogOut,
  ArrowLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Bell,
  Check,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { BrandMark } from './BrandMark';
import { Button } from '@/src/components/ui/button';
import { ThemeToggle } from '@/src/components/theme/ThemeToggle';
import { SiteAttributionBar } from './SiteAttributionBar';
import { cn } from '@/src/lib/utils';

export interface SidebarNavItem {
  id: string;
  label: string;
  icon: ReactNode;
  group?: string;
  disabled?: boolean;
}

export interface TopbarSearchResult {
  id: string;
  title: string;
  subtitle: string;
  onSelect: () => void;
}

export interface TopbarNotificationItem {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  onRead?: () => void;
}

interface DashboardShellLayoutProps {
  spaceTitle: string;
  tenantName: string;
  tenantSubtitle: string;
  userDisplayName: string;
  userRoleLabel: string;
  navItems: SidebarNavItem[];
  activeItemId: string;
  onSelectNav: (id: string) => void;
  isPreviewMode?: boolean;
  onSignOut?: () => void;
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchResults?: TopbarSearchResult[];
  notifications?: TopbarNotificationItem[];
  children: ReactNode;
}

export function DashboardShellLayout({
  spaceTitle,
  tenantName,
  tenantSubtitle,
  userDisplayName,
  userRoleLabel,
  navItems,
  activeItemId,
  onSelectNav,
  isPreviewMode = false,
  onSignOut,
  searchQuery = '',
  onSearchChange,
  searchPlaceholder = 'Rechercher...',
  searchResults = [],
  notifications = [],
  children,
}: DashboardShellLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const userInitials = userDisplayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'RC';

  const renderSidebar = (collapsed: boolean) => (
    <div className="flex min-h-full flex-col justify-between bg-[var(--rc-sidebar)] text-[var(--rc-fg)]">
      <div>
        <div
          className={cn(
            'flex items-center border-b border-[var(--rc-sidebar-border)] h-16',
            collapsed ? 'justify-center px-2' : 'justify-between px-4'
          )}
        >
          <Link
            to="/"
            title="Accueil RestoConnect"
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rc-gold)] rounded"
          >
            <BrandMark compact={collapsed} />
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden rounded-md p-1.5 text-[var(--rc-muted)] hover:bg-[var(--rc-card-elevated)] hover:text-[var(--rc-fg)]"
            aria-label="Fermer le menu latéral"
          >
            <X className="h-5 w-5" />
          </button>
          {!collapsed && (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(true)}
              className="hidden lg:inline-flex rounded-md p-1.5 text-[var(--rc-muted)] hover:bg-[var(--rc-card-elevated)] hover:text-[var(--rc-fg)] cursor-pointer"
              aria-label="Réduire la barre latérale"
              title="Réduire la barre latérale"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>

        {collapsed ? (
          <div className="flex justify-center py-3 border-b border-[var(--rc-sidebar-border)]">
            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              className="rounded-md p-2 text-[var(--rc-muted)] hover:bg-[var(--rc-card-elevated)] hover:text-[var(--rc-fg)] cursor-pointer"
              aria-label="Déployer la barre latérale"
              title="Déployer la barre latérale"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="px-4 py-3.5 border-b border-[var(--rc-sidebar-border)]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--rc-gold-text)]">
              {spaceTitle}
            </p>
            <p className="mt-1 font-display text-sm font-semibold text-[var(--rc-fg)] truncate">
              {tenantName}
            </p>
            <p className="mt-0.5 text-xs text-[var(--rc-muted)] truncate">{tenantSubtitle}</p>
          </div>
        )}

        <nav
          aria-label="Navigation principale de l'espace"
          className={cn('py-3 space-y-1', collapsed ? 'px-2' : 'px-3')}
        >
          {navItems.map((item, index) => {
            const isActive = item.id === activeItemId;
            const prevGroup = index > 0 ? navItems[index - 1].group : undefined;
            const showGroupHeader = !collapsed && item.group && item.group !== prevGroup;
            return (
              <div key={item.id}>
                {showGroupHeader && (
                  <p className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--rc-muted)]">
                    {item.group}
                  </p>
                )}
                <button
                  type="button"
                  disabled={item.disabled}
                  title={collapsed ? item.label : undefined}
                  onClick={() => {
                    onSelectNav(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={cn(
                    'relative w-full flex items-center rounded-lg text-left text-sm font-medium transition-colors whitespace-nowrap cursor-pointer',
                    collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2',
                    isActive
                      ? 'bg-[var(--rc-gold-tint)] text-[var(--rc-fg)] font-semibold'
                      : 'text-[var(--rc-muted)] hover:bg-[var(--rc-card-elevated)] hover:text-[var(--rc-fg)]',
                    item.disabled && 'opacity-40 cursor-not-allowed hover:bg-transparent'
                  )}
                >
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-[var(--rc-gold)]"
                    />
                  )}
                  <span
                    className={cn(
                      'shrink-0',
                      isActive ? 'text-[var(--rc-gold)]' : 'opacity-85'
                    )}
                  >
                    {item.icon}
                  </span>
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </button>
              </div>
            );
          })}
        </nav>
      </div>

      <div className={cn('border-t border-[var(--rc-sidebar-border)] space-y-3 bg-[var(--rc-sidebar)]', collapsed ? 'p-2.5' : 'p-4')}>
        {!collapsed && (
          <div className="flex items-center gap-2.5 px-1">
            <span className="h-8 w-8 rounded-lg bg-[var(--rc-gold)] text-[#0B0B0B] font-display text-xs font-bold flex items-center justify-center shrink-0">
              {userInitials}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[var(--rc-fg)] truncate">{userDisplayName}</p>
              <p className="text-[11px] text-[var(--rc-muted)] truncate">{userRoleLabel}</p>
            </div>
          </div>
        )}
        {isPreviewMode ? (
          <Button
            asChild
            variant="outline"
            size="sm"
            className={cn('w-full', collapsed ? 'px-0 justify-center' : 'justify-start')}
            title="Retour à la connexion"
          >
            <Link to="/login">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {!collapsed && <span>Retour à la connexion</span>}
            </Link>
          </Button>
        ) : (
          onSignOut && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onSignOut}
              className={cn('w-full', collapsed ? 'px-0 justify-center' : 'justify-start')}
              title="Déconnexion"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              {!collapsed && <span>Déconnexion</span>}
            </Button>
          )
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--rc-bg)] text-[var(--rc-fg)] flex">
      {/* Sidebar desktop */}
      <aside
        className={cn(
          'hidden lg:block shrink-0 border-r border-[var(--rc-sidebar-border)] bg-[var(--rc-sidebar)] transition-[width] duration-200',
          sidebarCollapsed ? 'w-[72px]' : 'w-64'
        )}
      >
        <div className="sticky top-0 h-screen overflow-y-auto bg-[var(--rc-sidebar)]">
          {renderSidebar(sidebarCollapsed)}
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-[1px]"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-72 max-w-[85vw] h-full overflow-y-auto bg-[var(--rc-sidebar)] border-r border-[var(--rc-sidebar-border)] shadow-xl">
            {renderSidebar(false)}
          </aside>
        </div>
      )}

      {/* Main viewport */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-16 border-b border-[var(--rc-border)] bg-[var(--rc-header)] backdrop-blur-md px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden rounded-md p-2 text-[var(--rc-fg)] hover:bg-[var(--rc-surface-muted)] shrink-0 cursor-pointer"
              aria-label="Ouvrir le menu latéral"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden xl:flex items-center gap-2 text-sm text-[var(--rc-muted)] min-w-0">
              <span className="font-medium text-[var(--rc-fg)] truncate">{spaceTitle}</span>
              <span aria-hidden="true">/</span>
              <span className="truncate">
                {navItems.find((n) => n.id === activeItemId)?.label ?? 'Vue générale'}
              </span>
            </div>
            <span className="xl:hidden text-sm font-medium text-[var(--rc-fg)] truncate">
              {navItems.find((n) => n.id === activeItemId)?.label ?? 'Vue générale'}
            </span>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {onSearchChange && (
              <div className="relative hidden md:block w-56 lg:w-64">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--rc-muted)]"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  aria-label={searchPlaceholder}
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setTimeout(() => setSearchFocused(false), 160)}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="h-9 w-full rounded-lg border border-[var(--rc-border-strong)] bg-[var(--rc-card)] pl-8 pr-3 text-xs text-[var(--rc-fg)] placeholder:text-[var(--rc-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rc-gold)]"
                />
                {searchFocused && searchQuery.trim().length > 0 && (
                  <div className="absolute left-0 right-0 top-11 z-40 rounded-lg border border-[var(--rc-border)] bg-[var(--rc-card)] shadow-lg overflow-hidden">
                    {searchResults.length === 0 ? (
                      <p className="px-3 py-2.5 text-xs text-[var(--rc-muted)]">
                        Aucun résultat pour « {searchQuery} »
                      </p>
                    ) : (
                      <div className="divide-y divide-[var(--rc-border)] max-h-64 overflow-y-auto">
                        {searchResults.slice(0, 6).map((res) => (
                          <button
                            key={res.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              res.onSelect();
                              setSearchFocused(false);
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-[var(--rc-card-elevated)] cursor-pointer"
                          >
                            <p className="text-xs font-semibold text-[var(--rc-fg)] truncate">{res.title}</p>
                            <p className="text-[11px] text-[var(--rc-muted)] truncate">{res.subtitle}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {notifications.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotifOpen((prev) => !prev)}
                  aria-label="Afficher les notifications"
                  aria-expanded={notifOpen}
                  className="relative h-9 w-9 rounded-lg border border-[var(--rc-border)] bg-[var(--rc-card)] text-[var(--rc-fg)] hover:bg-[var(--rc-card-elevated)] flex items-center justify-center cursor-pointer"
                >
                  <Bell className="h-4 w-4" aria-hidden="true" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-[var(--rc-gold)] text-[#0B0B0B] font-mono text-[10px] font-bold flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </button>
                {notifOpen && (
                  <div className="absolute right-0 top-11 z-40 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-[var(--rc-border)] bg-[var(--rc-card)] shadow-xl overflow-hidden">
                    <div className="px-3.5 py-2.5 border-b border-[var(--rc-border)] flex items-center justify-between">
                      <span className="text-xs font-semibold text-[var(--rc-fg)]">
                        Notifications ({unreadCount} non lue(s))
                      </span>
                      <button
                        type="button"
                        onClick={() => setNotifOpen(false)}
                        className="text-[11px] text-[var(--rc-muted)] hover:text-[var(--rc-fg)] cursor-pointer"
                      >
                        Fermer
                      </button>
                    </div>
                    <div className="divide-y divide-[var(--rc-border)] max-h-72 overflow-y-auto">
                      {notifications.slice(0, 6).map((n) => (
                        <div key={n.id} className="p-3 text-xs space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold text-[var(--rc-fg)]">{n.title}</p>
                            {!n.isRead && n.onRead && (
                              <button
                                type="button"
                                onClick={n.onRead}
                                className="inline-flex items-center gap-0.5 text-[11px] text-[var(--rc-gold-text)] hover:underline shrink-0 cursor-pointer"
                              >
                                <Check className="h-3 w-3" />
                                Lu
                              </button>
                            )}
                          </div>
                          <p className="text-[var(--rc-muted)] leading-snug">{n.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <ThemeToggle variant="compact" />

            <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
              <Link to="/">Portail public</Link>
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1320px] w-full mx-auto">
          {children}
        </main>
        <SiteAttributionBar />
      </div>
    </div>
  );
}
