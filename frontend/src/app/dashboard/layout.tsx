'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { auth, db } from '../../lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
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
  UserCog,
  ChevronRight,
  Shield,
  TrendingUp,
  Car,
  Truck,
  Vote,
  CreditCard,
  AlertCircle,
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

interface MenuItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  roles: string[];
  exact?: boolean;
  comingSoon?: boolean;
}

// Definición de items de menú con control de roles
const ALL_MENU_ITEMS: MenuItem[] = [
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
    name: 'Finanzas',
    href: '/dashboard/finance',
    icon: <TrendingUp className="h-5 w-5" />,
    roles: ['ADMINISTRADOR', 'RESIDENTE'],
  },
  {
    name: 'Parqueaderos & Mascotas',
    href: '/dashboard/parking-pets',
    icon: <Car className="h-5 w-5" />,
    roles: ['ADMINISTRADOR', 'RESIDENTE', 'PORTERÍA'],
  },
  {
    name: 'Mudanzas & Reformas',
    href: '/dashboard/moving-works',
    icon: <Truck className="h-5 w-5" />,
    roles: ['ADMINISTRADOR', 'RESIDENTE', 'PORTERÍA'],
  },
  {
    name: 'Asambleas & Votos',
    href: '/dashboard/assemblies',
    icon: <Vote className="h-5 w-5" />,
    roles: ['ADMINISTRADOR', 'RESIDENTE'],
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
    roles: ['ADMINISTRADOR', 'RESIDENTE', 'PORTERÍA'],
  },
  {
    name: 'Reservas',
    href: '/dashboard/reservations',
    icon: <CalendarDays className="h-5 w-5" />,
    roles: ['ADMINISTRADOR', 'RESIDENTE', 'PORTERÍA'],
  },
  {
    name: 'Portería',
    href: '/dashboard/gatehouse',
    icon: <Shield className="h-5 w-5" />,
    roles: ['ADMINISTRADOR', 'PORTERÍA'],
  },
  {
    name: 'Suscripción SaaS',
    href: '/dashboard/subscription',
    icon: <CreditCard className="h-5 w-5" />,
    roles: ['ADMINISTRADOR'],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, activeRole, switchRole, loading, logout, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [tenantName, setTenantName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Estados para conmutación de roles y PIN
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showSetupPinModal, setShowSetupPinModal] = useState(false);
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  
  const [switchPinInput, setSwitchPinInput] = useState('');
  const [setupPinInput, setSetupPinInput] = useState('');
  const [setupEmailPasswordInput, setSetupEmailPasswordInput] = useState('');
  
  const [hasPin, setHasPin] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  // Estados de suscripción
  const [subscriptionStatus, setSubscriptionStatus] = useState<'ACTIVE' | 'GRACE' | 'LOCKED'>('ACTIVE');
  const [graceDaysLeft, setGraceDaysLeft] = useState(3);
  const [payLoading, setPayLoading] = useState(false);

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

  // Verificar si tiene PIN configurado
  useEffect(() => {
    if (!user?.id) return;
    const checkPin = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.id));
        if (userDoc.exists()) {
          setHasPin(!!userDoc.data().adminSwitchPassword);
        }
      } catch (e) {
        console.error('Error al verificar PIN:', e);
      }
    };
    checkPin();
  }, [user, activeRole]);

  // Verificar estado de suscripción (Desactivado temporalmente por solicitud del usuario)
  useEffect(() => {
    setSubscriptionStatus('ACTIVE');
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
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
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

  // Filtrar menú según rol activo
  const currentRole = activeRole || user?.role || '';
  const menuItems = ALL_MENU_ITEMS.filter((item) =>
    item.roles.includes(currentRole)
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

  // Switch handlers
  const handleSwitchToPorter = () => {
    switchRole('PORTERÍA');
    router.push('/dashboard');
  };

  const handleSwitchToAdmin = () => {
    if (!hasPin) {
      setShowSetupPinModal(true);
    } else {
      setShowPinModal(true);
    }
  };

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinLoading(true);
    setPinError('');
    try {
      if (!user?.id) return;
      const userDoc = await getDoc(doc(db, 'users', user.id));
      if (!userDoc.exists()) {
        throw new Error('No se encontró el perfil de usuario.');
      }
      const correctPin = userDoc.data()?.adminSwitchPassword;
      if (!correctPin) {
        throw new Error('No se ha configurado un PIN de seguridad. Por favor, configúrelo primero.');
      }
      if (switchPinInput === correctPin) {
        switchRole('ADMINISTRADOR');
        setShowPinModal(false);
        setSwitchPinInput('');
        router.push('/dashboard');
      } else {
        setPinError('PIN incorrecto. Inténtelo de nuevo.');
      }
    } catch (err: any) {
      setPinError(err.message || 'Error al verificar el PIN');
    } finally {
      setPinLoading(false);
    }
  };

  const handleSetupPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinLoading(true);
    setPinError('');
    try {
      if (!user?.id || !user?.email) return;
      if (!setupPinInput) {
        throw new Error('Por favor, ingrese un PIN de seguridad.');
      }
      if (!setupEmailPasswordInput) {
        throw new Error('Por favor, ingrese la contraseña de su correo para confirmar.');
      }

      // Reautenticar con contraseña de correo
      try {
        await signInWithEmailAndPassword(auth, user.email, setupEmailPasswordInput);
      } catch (authErr) {
        throw new Error('Contraseña de correo incorrecta. Verifique sus credenciales.');
      }

      // Guardar el PIN en Firestore
      await updateDoc(doc(db, 'users', user.id), {
        adminSwitchPassword: setupPinInput,
      });

      setHasPin(true);
      setShowSetupPinModal(false);
      setSetupPinInput('');
      setSetupEmailPasswordInput('');
      
      // Conmutar rol a ADMINISTRADOR automáticamente
      switchRole('ADMINISTRADOR');
      router.push('/dashboard');
    } catch (err: any) {
      setPinError(err.message || 'Error al guardar el PIN');
    } finally {
      setPinLoading(false);
    }
  };

  const handlePaySubscription = async () => {
    if (!user?.tenantId) return;
    setPayLoading(true);
    try {
      const nextExpires = new Date();
      nextExpires.setDate(nextExpires.getDate() + 30);
      await updateDoc(doc(db, 'tenants', user.tenantId), {
        subscriptionExpiresAt: nextExpires,
      });
      setSubscriptionStatus('ACTIVE');
    } catch (err) {
      console.error('Error al pagar suscripción:', err);
    } finally {
      setPayLoading(false);
    }
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

  const isLocked = subscriptionStatus === 'LOCKED' && currentRole === 'ADMINISTRADOR';

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
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold border mt-0.5 ${roleColor[currentRole] || 'text-zinc-400 bg-zinc-800 border-zinc-700'}`}>
                {roleLabel[currentRole] || currentRole}
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
                {roleLabel[currentRole] || 'Portal'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Bell Notifications */}
            <div className="relative" ref={dropdownRef}>
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
                    className="absolute right-0 top-11 w-80 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl z-50 overflow-hidden"
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
            </div>

            <div className="h-8 w-px bg-zinc-850" />

            {/* Avatar clickable dropdown for role conmuting */}
            <div className="relative" ref={profileDropdownRef}>
              <button
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className="flex items-center space-x-2 p-1 hover:bg-zinc-900 rounded-xl transition-all"
              >
                <div className="h-8 w-8 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center font-bold text-xs text-violet-350 shrink-0">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-semibold text-zinc-300 leading-none">{user?.firstName}</p>
                  <p className="text-[9px] text-zinc-550 mt-0.5">{roleLabel[currentRole] || currentRole}</p>
                </div>
              </button>

              <AnimatePresence>
                {showProfileDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-11 w-64 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl z-50 overflow-hidden"
                  >
                    <div className="p-4 border-b border-zinc-800/60">
                      <p className="text-xs font-bold text-zinc-200">{user?.firstName} {user?.lastName}</p>
                      <p className="text-[10px] text-zinc-500 truncate">{user?.email}</p>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold border mt-1.5 ${roleColor[currentRole]}`}>
                        {roleLabel[currentRole]}
                      </span>
                    </div>

                    <div className="p-2 space-y-0.5">
                      {user?.role === 'ADMINISTRADOR' && (
                        <>
                          {currentRole === 'ADMINISTRADOR' ? (
                            <button
                              onClick={() => {
                                setShowProfileDropdown(false);
                                handleSwitchToPorter();
                              }}
                              className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
                            >
                              <Shield className="h-4 w-4 text-amber-400" />
                              <span>Cambiar a Panel Portería</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setShowProfileDropdown(false);
                                handleSwitchToAdmin();
                              }}
                              className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
                            >
                              <UserCheck className="h-4 w-4 text-violet-400" />
                              <span>Cambiar a Panel Admin</span>
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setShowProfileDropdown(false);
                              setShowSetupPinModal(true);
                            }}
                            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-zinc-350 hover:bg-zinc-800 transition-colors border-t border-zinc-800/40"
                          >
                            <UserCog className="h-4 w-4 text-violet-400" />
                            <span>{hasPin ? 'Cambiar PIN de Switch' : 'Crear PIN de Switch'}</span>
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => {
                          setShowProfileDropdown(false);
                          logout();
                        }}
                        className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-450 hover:bg-rose-500/10 transition-colors"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Cerrar Sesión</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {/* Alerta de Período de Gracia SaaS */}
          {subscriptionStatus === 'GRACE' && currentRole === 'ADMINISTRADOR' && (
            <div className="bg-amber-600/20 border border-amber-500/30 text-amber-200 px-4 py-3 rounded-2xl mb-6 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <AlertCircle className="h-5 w-5 text-amber-400 shrink-0" />
                <span className="text-xs font-semibold">
                  ¡Atención! Su suscripción mensual ha vencido. Le quedan {graceDaysLeft} día(s) de período de gracia antes de suspender el acceso.
                </span>
              </div>
              <Link
                href="/dashboard/subscription"
                className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold px-3 py-1.5 rounded-xl text-[10px] transition-all"
              >
                Pagar Ahora
              </Link>
            </div>
          )}

          {/* Si la suscripción está bloqueada, renderizar la pantalla de bloqueo */}
          {isLocked ? (
            <div className="max-w-md mx-auto my-12 p-6 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl space-y-6 text-center">
              <div className="h-16 w-16 mx-auto rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                <AlertCircle className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-zinc-100">Acceso Suspendido</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  El período de gracia de 3 días para el pago de la suscripción mensual de 59.900 COP ha expirado. Por favor, realice el pago para restaurar el acceso.
                </p>
              </div>
              
              <div className="pt-2">
                <button
                  onClick={handlePaySubscription}
                  disabled={payLoading}
                  className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-xs shadow-lg shadow-violet-600/20 transition-all flex items-center justify-center space-x-1.5"
                >
                  {payLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>Pagar Suscripción vía PSE (59.900 COP)</span>
                </button>
              </div>
            </div>
          ) : (
            children
          )}
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

      {/* Modal Verificar PIN */}
      <AnimatePresence>
        {showPinModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center space-x-3 text-amber-400">
                <Shield className="h-6 w-6" />
                <h3 className="text-lg font-bold text-zinc-100">Verificación de Seguridad</h3>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Para regresar al Panel de Administrador, ingrese su PIN o contraseña de conmutación.
              </p>
              
              <form onSubmit={handleVerifyPin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                    PIN / Contraseña
                  </label>
                  <input
                    type="password"
                    value={switchPinInput}
                    onChange={(e) => setSwitchPinInput(e.target.value)}
                    placeholder="Ingrese el PIN"
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-650 focus:outline-none focus:border-violet-500/50 transition-all font-mono tracking-widest text-center"
                  />
                </div>

                {pinError && (
                  <p className="text-xs font-semibold text-rose-450 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-xl">
                    {pinError}
                  </p>
                )}

                <div className="flex space-x-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPinModal(false);
                      setPinError('');
                      setSwitchPinInput('');
                    }}
                    className="flex-1 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 font-semibold py-2.5 rounded-xl text-xs border border-zinc-800 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={pinLoading}
                    className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-xs shadow-lg shadow-violet-600/20 transition-all flex items-center justify-center space-x-1.5"
                  >
                    {pinLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>Confirmar</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Configurar PIN */}
      <AnimatePresence>
        {showSetupPinModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center space-x-3 text-violet-400">
                <UserCog className="h-6 w-6" />
                <h3 className="text-lg font-bold text-zinc-100">Configurar PIN de Seguridad</h3>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Establezca una contraseña o PIN rápido para conmutar roles. Para seguridad, confirme también la contraseña de su correo electrónico.
              </p>
              
              <form onSubmit={handleSetupPin} className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                      Nuevo PIN / Contraseña de Conmutación
                    </label>
                    <input
                      type="password"
                      value={setupPinInput}
                      onChange={(e) => setSetupPinInput(e.target.value)}
                      placeholder="Ej. 1234 o clave secreta"
                      required
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-650 focus:outline-none focus:border-violet-500/50 transition-all text-center"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                      Confirmar Contraseña del Correo ({user?.email})
                    </label>
                    <input
                      type="password"
                      value={setupEmailPasswordInput}
                      onChange={(e) => setSetupEmailPasswordInput(e.target.value)}
                      placeholder="Contraseña del correo actual"
                      required
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-650 focus:outline-none focus:border-violet-500/50 transition-all"
                    />
                  </div>
                </div>

                {pinError && (
                  <p className="text-xs font-semibold text-rose-455 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-xl">
                    {pinError}
                  </p>
                )}

                <div className="flex space-x-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSetupPinModal(false);
                      setPinError('');
                      setSetupPinInput('');
                      setSetupEmailPasswordInput('');
                    }}
                    className="flex-1 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 font-semibold py-2.5 rounded-xl text-xs border border-zinc-800 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={pinLoading}
                    className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-xs shadow-lg shadow-violet-600/20 transition-all flex items-center justify-center space-x-1.5"
                  >
                    {pinLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>Guardar y Cambiar</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
