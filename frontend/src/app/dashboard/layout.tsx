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

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [loading, isAuthenticated, router]);

  // Escuchar notificaciones en tiempo real
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
        // Filtrar notificaciones para este usuario o generales (ALL)
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

      // Ordenar por fecha decreciente de forma segura
      list.sort((a, b) => {
        const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
        const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });

      setNotifications(list);
      setUnreadCount(list.filter((n) => !n.isRead).length);
    }, (err) => {
      console.error('Error al escuchar notificaciones:', err);
    });

    return () => unsubscribe();
  }, [user]);

  // Cerrar dropdown al hacer clic fuera
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
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100">
        <Loader2 className="h-8 w-8 text-indigo-500 animate-spin mb-4" />
        <p className="text-sm text-slate-400">Verificando sesión...</p>
      </div>
    );
  }

  const menuItems = [
    {
      name: 'Inicio',
      href: '/dashboard',
      icon: <LayoutDashboard className="h-5 w-5" />,
    },
    {
      name: 'Inmuebles',
      href: '/dashboard/properties',
      icon: <Building className="h-5 w-5" />,
    },
    {
      name: 'Residentes',
      href: '/dashboard/residents',
      icon: <Users className="h-5 w-5" />,
    },
    {
      name: 'Comunicados',
      href: '/dashboard/announcements',
      icon: <Megaphone className="h-5 w-5" />,
    },
  ];

  const handleMarkAsRead = async (notifId: string) => {
    try {
      const ref = doc(db, 'notifications', notifId);
      await updateDoc(ref, { isRead: true });
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const batch = writeBatch(db);
      notifications.forEach((n) => {
        if (!n.isRead) {
          const ref = doc(db, 'notifications', n.id);
          batch.update(ref, { isRead: true });
        }
      });
      await batch.commit();
      setShowDropdown(false);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row pb-16 md:pb-0">
      
      {/* 1. SIDEBAR - TABLET & DESKTOP (Hidden on Mobile) */}
      <aside className="hidden md:flex flex-col bg-slate-900 border-r border-slate-800 md:w-20 lg:w-64 shrink-0 transition-all duration-300">
        {/* Brand Header */}
        <div className="h-16 flex items-center px-4 border-b border-slate-800/80 justify-center lg:justify-start space-x-3">
          <Building2 className="h-7 w-7 text-indigo-500 shrink-0" />
          <span className="hidden lg:inline font-bold text-lg tracking-tight bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 bg-clip-text text-transparent">
            Acacias Smart
          </span>
        </div>

        {/* User Card */}
        <div className="p-4 border-b border-slate-800/60 hidden lg:block">
          <div className="flex items-center space-x-3 p-2 bg-slate-950/40 rounded-2xl border border-slate-800/50">
            <div className="h-9 w-9 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center">
              <UserCheck className="h-4 w-4 text-indigo-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-200 truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-[10px] text-slate-500 truncate capitalize">
                {user?.role.toLowerCase()}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-center lg:justify-start space-x-3 px-3.5 py-3 rounded-xl font-medium text-sm transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                }`}
              >
                {item.icon}
                <span className="hidden lg:inline">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Logout Button */}
        <div className="p-3 border-t border-slate-800/60">
          <button
            onClick={logout}
            className="w-full flex items-center justify-center lg:justify-start space-x-3 px-3.5 py-3 rounded-xl font-medium text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span className="hidden lg:inline">Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* 2. MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-3">
            {/* Logo visible only on Mobile */}
            <Building2 className="h-6 w-6 text-indigo-500 md:hidden" />
            <h2 className="text-sm sm:text-base font-bold text-slate-200">
              Club Residencial Las Acacias
            </h2>
            <span className="hidden sm:inline-flex px-2 py-0.5 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              SaaS Activo
            </span>
          </div>

          <div className="flex items-center space-x-4 relative" ref={dropdownRef}>
            {/* Bell Button */}
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="relative p-2 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 h-4 w-4 bg-indigo-600 border border-slate-950 rounded-full text-[9px] font-black flex items-center justify-center text-white">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            <AnimatePresence>
              {showDropdown && (
                <div className="absolute right-0 top-12 w-80 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden backdrop-blur-xl">
                  <div className="p-4 border-b border-slate-850 flex items-center justify-between">
                    <h3 className="font-bold text-xs text-slate-200">Notificaciones Recientes</h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllAsRead}
                        className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center space-x-1"
                      >
                        <Check className="h-3 w-3" />
                        <span>Marcar todo</span>
                      </button>
                    )}
                  </div>

                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-850">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-500">
                        No tienes notificaciones
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif.id}
                          onClick={() => !notif.isRead && handleMarkAsRead(notif.id)}
                          className={`p-3.5 text-left transition-colors cursor-pointer hover:bg-slate-850/50 ${
                            !notif.isRead ? 'bg-indigo-500/5' : ''
                          }`}
                        >
                          <div className="flex justify-between items-start space-x-2">
                            <p className={`text-xs font-bold ${!notif.isRead ? 'text-slate-200' : 'text-slate-400'}`}>
                              {notif.title}
                            </p>
                            {!notif.isRead && (
                              <span className="h-2 w-2 rounded-full bg-indigo-500 shrink-0 mt-1" />
                            )}
                          </div>
                          <p className="text-[11px] text-slate-450 mt-1 leading-relaxed">{notif.body}</p>
                          <span className="text-[9px] text-slate-600 block mt-2">
                            {notif.createdAt?.seconds
                              ? new Date(notif.createdAt.seconds * 1000).toLocaleDateString() +
                                ' ' +
                                new Date(notif.createdAt.seconds * 1000).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : 'Reciente'}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </AnimatePresence>

            <div className="h-8 w-px bg-slate-800 hidden sm:block" />
            {/* Mini User Tag */}
            <div className="items-center space-x-2.5 hidden sm:flex">
              <span className="text-xs font-semibold text-slate-300">
                {user?.firstName}
              </span>
              <div className="h-7 w-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-slate-300 font-sans">
                {user?.firstName[0]}
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>

      {/* 3. BOTTOM NAV BAR - MOBILE ONLY (Hidden on Tablet & Desktop) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-slate-900/90 border-t border-slate-800 backdrop-blur-lg z-40 flex items-center justify-around px-2">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center space-y-1.5 px-3 py-1.5 rounded-xl text-center transition-colors ${
                isActive ? 'text-indigo-400' : 'text-slate-500'
              }`}
            >
              {item.icon}
              <span className="text-[10px] font-medium leading-none">{item.name}</span>
            </Link>
          );
        })}
        <button
          onClick={logout}
          className="flex flex-col items-center justify-center space-y-1.5 px-3 py-1.5 text-slate-500 hover:text-red-400 transition-colors"
        >
          <LogOut className="h-5 w-5" />
          <span className="text-[10px] font-medium leading-none">Salir</span>
        </button>
      </nav>
      
    </div>
  );
}
