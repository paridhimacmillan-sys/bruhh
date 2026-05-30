'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Database,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Settings,
  Activity,
  Menu,
  X,
  FileBarChart2,
  History,
} from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';
import NotificationBell from '@/components/ui/NotificationBell';
import { useAccess } from '@/lib/useAccess';

const NAV_ITEMS = [
  { key: 'nav-dashboard', label: 'Production Dashboard', href: '/', icon: LayoutDashboard, badge: null },
  { key: 'nav-masters', label: 'Masters Management', href: '/masters-management', icon: Database, badge: null },
  { key: 'nav-entry', label: 'Production Entry', href: '/production-entry', icon: ClipboardList, badge: 3 },
  { key: 'nav-recent', label: 'Recent Entries', href: '/recent-entries', icon: History, badge: null },
  { key: 'nav-reports', label: 'Production Reports', href: '/reports', icon: FileBarChart2, badge: null },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { access } = useAccess();
  const rejectionMapperUrl = process.env.NEXT_PUBLIC_REJECTION_MAPPER_URL || 'https://attendance.aicreator.co.in';

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className={`flex items-center h-16 px-4 border-b border-border shrink-0 ${collapsed ? 'justify-center' : 'gap-3'}`}>
        <AppLogo size={32} />
        {!collapsed && (
          <div className="flex flex-col leading-tight overflow-hidden">
            <span className="font-semibold text-foreground text-sm tracking-tight truncate">MachineTrack</span>
            <span className="text-xs text-muted-foreground truncate">Production Monitor</span>
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="mx-3 mt-3 px-3 py-2 bg-muted rounded-md flex items-center gap-2">
          <Activity size={14} className="text-primary shrink-0" />
          <div className="overflow-hidden">
            <p className="text-xs font-semibold text-foreground truncate">Shop Floor A</p>
            <p className="text-xs text-muted-foreground truncate">4 machines active</p>
          </div>
        </div>
      )}

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {!collapsed && (
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-2 mb-2">
            Operations
          </p>
        )}
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.key}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`sidebar-nav-item ${active ? 'active' : ''} ${collapsed ? 'justify-center px-2' : ''}`}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
              {!collapsed && item.badge !== null && (
                <span className="ml-auto bg-primary text-primary-foreground text-xs font-semibold rounded-full px-1.5 py-0.5 min-w-[20px] text-center leading-none">
                  {item.badge}
                </span>
              )}
              {collapsed && item.badge !== null && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
              )}
            </Link>
          );
        })}
        {!collapsed && (
          <>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-2 mb-2 mt-4">
              Connectors
            </p>
            <a
              href={rejectionMapperUrl}
              target="_blank"
              rel="noreferrer"
              className="sidebar-nav-item"
            >
              <Database size={18} className="shrink-0" />
              <span className="flex-1 truncate">Rejection Mapper</span>
            </a>
          </>
        )}
      </nav>

      <div className="px-3 pb-3 border-t border-border pt-3 space-y-1">
        <NotificationBell collapsed={collapsed} />

        <Link
          href="/settings"
          className={`sidebar-nav-item ${collapsed ? 'justify-center px-2' : ''}`}
          title={collapsed ? 'Settings' : undefined}
        >
          <Settings size={18} className="shrink-0" />
          {!collapsed && <span className="flex-1 truncate">Settings</span>}
        </Link>

        <div className={`flex items-center gap-2 px-2 py-2 mt-1 rounded-md hover:bg-muted transition-colors cursor-pointer ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-white">{access.email ? access.email.charAt(0).toUpperCase() : 'U'}</span>
          </div>
          {!collapsed && (
            <div className="overflow-hidden flex-1">
              <p className="text-xs font-semibold text-foreground truncate">{access.email ?? 'Not signed in'}</p>
              <p className="text-xs text-muted-foreground truncate">{access.isAdmin ? 'Admin' : 'Employee'}</p>
            </div>
          )}
        </div>
        {!collapsed && (
          <a
            href={access.authenticated ? '/api/auth/signout' : '/api/auth/signin'}
            className="sidebar-nav-item"
          >
            <Settings size={18} className="shrink-0" />
            <span className="flex-1 truncate">{access.authenticated ? 'Sign Out' : 'Sign In (Google)'}</span>
          </a>
        )}
      </div>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="hidden lg:flex items-center justify-center h-8 border-t border-border hover:bg-muted transition-colors"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={14} className="text-muted-foreground" /> : <ChevronLeft size={14} className="text-muted-foreground" />}
      </button>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-card border border-border rounded-md shadow-sm"
        aria-label="Open navigation"
      >
        <Menu size={18} />
      </button>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 modal-backdrop" onClick={() => setMobileOpen(false)} />
      )}

      <div className={`lg:hidden fixed top-0 left-0 z-50 h-full w-64 bg-card border-r border-border shadow-xl transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-4 p-1 hover:bg-muted rounded">
          <X size={16} />
        </button>
        <SidebarContent />
      </div>

      <aside className={`hidden lg:flex flex-col h-screen sticky top-0 bg-card border-r border-border shrink-0 transition-all duration-300 ease-in-out ${collapsed ? 'w-16' : 'w-60'}`}>
        <SidebarContent />
      </aside>
    </>
  );
}

