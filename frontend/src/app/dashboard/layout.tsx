'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { db } from '../../lib/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
  getDoc,
} from 'firebase/firestore';
import {
  LayoutDashboard,
  Users,
  Building,
  LogOut,
  Building2,
  Bell,
  Loader2,
  UserCheck,
  Megaphone,
  Check,
  Home,
  ClipboardList,
  CalendarDays,
  PackageOpen,
  UserCog,
  ChevronRight,
  Shield,
} from 'lucide-react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  tenantId: string;
  receiverId: string;
  createdAt: any;
}

// Definición de items de menú con control de roles
const ALL_MENU_ITEMS = [
  {
    name: 'Inicio',
    href: '/dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
    roles: ['ADMINISTRADOR', 'RESIDENTE', 'PORTERÍA'],
    exact: true,
  },
  {
    name: 'Inmuebles',
    href: '/dashboard/properties',
    icon: <Building className="h-5 w-5" />,
    roles: ['ADMINISTRADOR'],
  },
  {
    name: 'Residentes',
    href: '/dashboard/residents',
    icon: <Users className="h-5 w-5" />,
    roles: ['ADMINISTRADOR'],
  },
  {
    name: 'Comunicados',
    href: '/dashboard/announcements',
    icon: <Megaphone className="h-5 w-5" />,
    roles: ['ADMINISTRADOR', 'RESIDENTE', 'PORTERÍA'],
  },
  {
    name: 'PQRS',
    href: '/dashboard/pqrs',
    icon: <ClipboardList className="h-5 w-5" />,
    roles: ['ADMINISTRADOR', 'RESIDENTE'],
    comingSoon: true,
  },
  {
    name: 'Reservas',
    href: '/dashboard/reservations',
    icon: <CalendarDays className="h-5 w-5" />,
    roles: ['ADMINISTRADOR', 'RESIDENTE'],
    comingSoon: true,
  },
  {
    name: 'Portería',
    href: '/dashboard/gatehouse',
    icon: <Shield className="h-5 w-5" />,
    roles: ['ADMINISTRADOR', 'PORTERÍA'],
    comingSoon: true,
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [tenantName, setTenantName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [loading, isAuthenticated, router]);

  // Cargar nombre del conjunto
  useEffect(() => {
    if (!user?.tenantId) return;
    const fetchTenant = async () => {
      try {
        const tenantDoc = await getDoc(doc(db, 'tenants', user.tenantId));
        if (tenantDoc.exists()) {
          setTenantName(tenantDoc.data().name || '');
        }
      } catch (e) {
        console.error('Error cargando tenant:', e);
      }
    };
    fetchTenant();
  }, [user]);

  // Notificaciones en tiempo real
  useEffect(() => {
    if (!user?.tenantId || !user?.id) return;
    const q = query(
      collection(db, 'notifications'),
      where('tenantId', '==', user.tenantId)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: NotificationItem[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.receiverId === user.id || data.receiverId === 'ALL') {
          list.push({
            id: docSnap.id,
            title: data.title || '',
            body: data.body || '',
            type: data.type || 'general',
            isRead: !!data.isRead,
            tenantId: data.tenantId || '',
            receiverId: data.receiverId || '',
            createdAt: data.createdAt,
          });
        }
      });
      list.sort((a, b) => {
        const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0;
        const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0;
        return timeB - timeA;
      });
      setNotifications(list);
      setUnreadCount(list.filter((n) => !n.isRead).length);
    }, (err) => console.error('Notificaciones error:', err));
    return () => unsubscribe();
  }, [user]);

  // Cerrar dropdown al click fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-100">
        <div className="relative">
          <div className="h-16 w-16 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center mb-6">
            <Building2 className="h-8 w-8 text-violet-400" />
          </div>
          <div className="absolute -bottom-1 -right-1">
            <Loader2 className="h-5 w-5 text-violet-500 animate-spin" />
          </div>
        </div>
        <p className="text-sm text-zinc-400 font-medium">Verificando sesión...</p>
      </div>
    );
  }

  // Filtrar menú según rol
  const menuItems = ALL_MENU_ITEMS.filter((item) =>
    item.roles.includes(user?.role || '')
  );

  const handleMarkAsRead = async (notifId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notifId), { isRead: true });
    } catch (e) { console.error(e); }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const batch = writeBatch(db);
      notifications.forEach((n) => {
        if (!n.isRead) batch.update(doc(db, 'notifications', n.id), { isRead: true });
      });
      await batch.commit();
      setShowDropdown(false);
    } catch (e) { console.error(e); }
  };

  const roleLabel: Record<string, string> = {
    ADMINISTRADOR: 'Administrador',
    RESIDENTE: 'Residente',
    'PORTERÍA': 'Portería',
  };

  const roleColor: Record<string, string> = {
    ADMINISTRADOR: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
    RESIDENTE: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    'PORTERÍA': 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col md:flex-row pb-16 md:pb-0">

      {/* SIDEBAR — Tablet & Desktop */}
      <aside className="hidden md:flex flex-col bg-zinc-900 border-r border-zinc-800/60 md:w-20 lg:w-64 shrink-0 transition-all duration-300">

        {/* Brand */}
        <div className="h-16 flex items-center px-4 border-b border-zinc-800/60 justify-center lg:justify-start space-x-3">
          <div className="h-8 w-8 rounded-xl bg-violet-600 flex items-center justify-center shrink-0 shadow-lg shadow-violet-600/30">
            <Building2 className="h-4.5 w-4.5 text-white" />
          </div>
          <span className="hidden lg:inline font-bold text-base tracking-tight text-zinc-100">
            Residente<span className="text-violet-400">Pro</span>
          </span>
        </div>

        {/* User Card */}
        <div className="p-4 border-b border-zinc-800/40 hidden lg:block">
          <div className="flex items-center space-x-3 p-3 bg-zinc-950/60 rounded-2xl border border-zinc-800/50">
            <div className="h-9 w-9 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center shrink-0 font-bold text-sm text-violet-300">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-zinc-200 truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold border mt-0.5 ${roleColor[user?.role || ''] || 'text-zinc-400 bg-zinc-800 border-zinc-700'}`}>
                {roleLabel[user?.role || ''] || user?.role}
              </span>
            </div>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-2.5 py-4 space-y-0.5 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.comingSoon ? '#' : item.href}
                onClick={item.comingSoon ? (e) => e.preventDefault() : undefined}
                className={`group flex items-center justify-center lg:justify-start space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 relative ${
                  isActive
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20'
                    : item.comingSoon
                    ? 'text-zinc-600 cursor-not-allowed'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
                }`}
              >
                <span className="shrink-0">{item.icon}</span>
                <span className="hidden lg:flex items-center justify-between flex-1">
                  <span>{item.name}</span>
                  {item.comingSoon && (
                    <span className="text-[9px] font-bold text-zinc-600 bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded-full">
                      Pronto
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-2.5 border-t border-zinc-800/60">
          <button
            onClick={logout}
            className="w-full flex items-center justify-center lg:justify-start space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400 transition-all"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span className="hidden lg:inline">Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">

        {/* Header */}
        <header className="h-16 border-b border-zinc-900 bg-zinc-950/90 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center space-x-3">
            {/* Logo mobile */}
            <div className="h-7 w-7 rounded-lg bg-violet-600 flex items-center justify-center md:hidden">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-200 leading-none">
                {tenantName || 'Mi Conjunto Residencial'}
              </h2>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                {roleLabel[user?.role || ''] || 'Portal'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 relative" ref={dropdownRef}>
            {/* Bell */}
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="relative p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-xl transition-all"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 h-4 w-4 bg-violet-600 border-2 border-zinc-950 rounded-full text-[8px] font-black flex items-center justify-center text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Dropdown Notificaciones */}
            <AnimatePresence>
              {showDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-14 w-80 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl z-50 overflow-hidden"
                >
                  <div className="p-4 border-b border-zinc-800/60 flex items-center justify-between">
                    <h3 className="text-xs font-bold text-zinc-200">Notificaciones</h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllAsRead}
                        className="text-[10px] font-bold text-violet-400 hover:text-violet-300 flex items-center space-x-1"
                      >
                        <Check className="h-3 w-3" />
                        <span>Marcar todo</span>
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-zinc-800/40">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center">
                        <Bell className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
                        <p className="text-xs text-zinc-500">Sin notificaciones</p>
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif.id}
                          onClick={() => !notif.isRead && handleMarkAsRead(notif.id)}
                          className={`p-3.5 cursor-pointer hover:bg-zinc-800/40 transition-colors ${!notif.isRead ? 'bg-violet-500/5' : ''}`}
                        >
                          <div className="flex justify-between items-start space-x-2">
                            <p className={`text-xs font-semibold ${!notif.isRead ? 'text-zinc-100' : 'text-zinc-400'}`}>
                              {notif.title}
                            </p>
                            {!notif.isRead && <span className="h-2 w-2 rounded-full bg-violet-500 shrink-0 mt-1" />}
                          </div>
                          <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed line-clamp-2">{notif.body}</p>
                          <span className="text-[9px] text-zinc-600 block mt-1.5">
                            {notif.createdAt?.seconds
                              ? new Date(notif.createdAt.seconds * 1000).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                              : 'Reciente'}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="h-8 w-px bg-zinc-800 hidden sm:block" />
            {/* Avatar */}
            <div className="hidden sm:flex items-center space-x-2.5">
              <div className="h-8 w-8 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center font-bold text-xs text-violet-300">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
              <div className="hidden md:block">
                <p className="text-xs font-semibold text-zinc-300 leading-none">{user?.firstName}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">{roleLabel[user?.role || '']}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>

      {/* BOTTOM NAV — Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-zinc-900/95 border-t border-zinc-800 backdrop-blur-xl z-40 flex items-center justify-around px-1">
        {menuItems.filter(i => !i.comingSoon).map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center px-2 py-1.5 rounded-xl space-y-1 transition-colors ${
                isActive ? 'text-violet-400' : 'text-zinc-500'
              }`}
            >
              {item.icon}
              <span className="text-[9px] font-semibold leading-none">{item.name}</span>
            </Link>
          );
        })}
        <button
          onClick={logout}
          className="flex flex-col items-center justify-center px-2 py-1.5 text-zinc-500 hover:text-rose-400 transition-colors space-y-1"
        >
          <LogOut className="h-5 w-5" />
          <span className="text-[9px] font-semibold leading-none">Salir</span>
        </button>
      </nav>
    </div>
  );
}
