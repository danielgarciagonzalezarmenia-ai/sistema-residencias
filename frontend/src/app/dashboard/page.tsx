'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from 'firebase/firestore';
import {
  Users,
  Building,
  Megaphone,
  Bell,
  ArrowRight,
  Sparkles,
  Home,
  CheckCircle2,
  Clock,
  AlertCircle,
  CalendarDays,
  Loader2,
  TrendingUp,
  Package,
  ClipboardList,
} from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

interface Announcement {
  id: string;
  title: string;
  body: string;
  senderName: string;
  createdAt: any;
}

interface ResidentInfo {
  properties: { tower: string; unit: string }[];
  status: string;
}

// ─── DASHBOARD ADMINISTRADOR ───────────────────────────────────────────────
function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    residents: 0,
    properties: 0,
    announcements: 0,
    notifications: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentAnnouncements, setRecentAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    if (!user?.tenantId) return;
    const fetchStats = async () => {
      setLoading(true);
      try {
        const tid = user.tenantId;

        // Conteo de residentes activos
        const resSnap = await getDocs(query(collection(db, 'residents'), where('tenantId', '==', tid), where('status', '==', 'ACTIVE')));
        // Conteo de inmuebles
        const propSnap = await getDocs(query(collection(db, 'properties'), where('tenantId', '==', tid)));
        // Conteo de comunicados
        const annSnap = await getDocs(query(collection(db, 'announcements'), where('tenantId', '==', tid)));

        setStats({
          residents: resSnap.size,
          properties: propSnap.size,
          announcements: annSnap.size,
          notifications: 0,
        });

        // Últimos 3 comunicados
        const annList: Announcement[] = [];
        annSnap.forEach((d) => {
          const data = d.data();
          annList.push({
            id: d.id,
            title: data.title || '',
            body: data.body || '',
            senderName: data.senderName || '',
            createdAt: data.createdAt,
          });
        });
        annList.sort((a, b) => {
          const ta = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0;
          const tb = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0;
          return tb - ta;
        });
        setRecentAnnouncements(annList.slice(0, 3));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [user]);

  const statCards = [
    {
      label: 'Residentes Activos',
      value: stats.residents,
      icon: <Users className="h-5 w-5" />,
      color: 'text-violet-400',
      bg: 'bg-violet-500/10 border-violet-500/20',
      link: '/dashboard/residents',
    },
    {
      label: 'Inmuebles',
      value: stats.properties,
      icon: <Building className="h-5 w-5" />,
      color: 'text-sky-400',
      bg: 'bg-sky-500/10 border-sky-500/20',
      link: '/dashboard/properties',
    },
    {
      label: 'Comunicados Enviados',
      value: stats.announcements,
      icon: <Megaphone className="h-5 w-5" />,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      link: '/dashboard/announcements',
    },
    {
      label: 'PQRS Activas',
      value: 0,
      icon: <ClipboardList className="h-5 w-5" />,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
      link: '#',
      comingSoon: true,
    },
  ];

  const quickActions = [
    { label: 'Nuevo Comunicado', href: '/dashboard/announcements', icon: <Megaphone className="h-4 w-4" />, primary: true },
    { label: 'Agregar Residente', href: '/dashboard/residents', icon: <Users className="h-4 w-4" /> },
    { label: 'Registrar Inmueble', href: '/dashboard/properties', icon: <Building className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">
            Bienvenido, {user?.firstName} 👋
          </h1>
          <p className="text-sm text-zinc-500 mt-1 font-medium">
            Panel de administración · {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className={`inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all ${
                action.primary
                  ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/20'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60'
              }`}
            >
              {action.icon}
              <span>{action.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Bienvenida cuando el conjunto está vacío */}
      {!loading && stats.residents === 0 && stats.properties === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-600/10 via-purple-500/5 to-zinc-950 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none select-none">
            <Sparkles className="h-28 w-28 text-violet-400" />
          </div>
          <div className="flex items-center space-x-2 text-violet-400 mb-3">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wider">¡Empieza aquí!</span>
          </div>
          <h2 className="text-lg font-bold text-zinc-100 mb-2">Tu conjunto residencial está listo</h2>
          <p className="text-sm text-zinc-400 leading-relaxed mb-5">
            Aún no hay inmuebles ni residentes registrados. Comienza configurando tu conjunto para empezar a gestionarlo.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/properties"
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-xl transition-all shadow-lg shadow-violet-600/20"
            >
              <Building className="h-3.5 w-3.5" />
              <span>Registrar primer Inmueble</span>
            </Link>
            <Link
              href="/dashboard/residents"
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl transition-all border border-zinc-700/60"
            >
              <Users className="h-3.5 w-3.5" />
              <span>Agregar Residente</span>
            </Link>
          </div>
        </motion.div>
      )}

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-zinc-900/40 border border-zinc-800/40 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <Link
                href={card.comingSoon ? '#' : card.link}
                onClick={card.comingSoon ? (e) => e.preventDefault() : undefined}
                className={`group flex flex-col justify-between p-4 sm:p-5 rounded-2xl border ${card.bg} hover:scale-[1.02] transition-all duration-200 block h-full`}
              >
                <div className="flex justify-between items-start">
                  <span className={`p-2 rounded-xl bg-zinc-950/40 ${card.color}`}>
                    {card.icon}
                  </span>
                  {card.comingSoon && (
                    <span className="text-[8px] font-bold text-zinc-600 bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded-full">
                      Pronto
                    </span>
                  )}
                </div>
                <div className="mt-4">
                  <p className="text-2xl sm:text-3xl font-bold text-zinc-100">{card.value}</p>
                  <p className="text-xs text-zinc-500 font-medium mt-0.5">{card.label}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      {/* Cuerpo: comunicados recientes + próximos módulos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Comunicados Recientes */}
        <div className="lg:col-span-2 p-5 rounded-2xl border border-zinc-800/60 bg-zinc-900/20">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-zinc-200 text-sm">Comunicados Recientes</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Últimos anuncios enviados a tu comunidad</p>
            </div>
            <Link href="/dashboard/announcements" className="text-xs font-semibold text-violet-400 hover:text-violet-300 flex items-center space-x-1">
              <span>Ver todos</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {recentAnnouncements.length === 0 ? (
            <div className="py-10 text-center border border-dashed border-zinc-800 rounded-xl">
              <Megaphone className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
              <p className="text-xs text-zinc-500">Aún no has enviado comunicados</p>
              <Link href="/dashboard/announcements" className="text-xs text-violet-400 font-semibold underline mt-1 inline-block">
                Crear el primero
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentAnnouncements.map((ann) => (
                <div key={ann.id} className="p-4 bg-zinc-950/50 rounded-xl border border-zinc-800/40 hover:border-zinc-700/60 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-zinc-200 truncate">{ann.title}</p>
                      <p className="text-[11px] text-zinc-500 mt-1 line-clamp-2 leading-relaxed">{ann.body}</p>
                    </div>
                    <span className="text-[9px] text-zinc-600 shrink-0 mt-0.5">
                      {ann.createdAt?.seconds
                        ? new Date(ann.createdAt.seconds * 1000).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
                        : 'Reciente'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Módulos Próximos */}
        <div className="space-y-3">
          <div className="p-5 rounded-2xl border border-zinc-800/60 bg-zinc-900/20">
            <h3 className="font-bold text-zinc-200 text-sm mb-4">Próximas Funciones</h3>
            <div className="space-y-2.5">
              {[
                { icon: <ClipboardList className="h-4 w-4 text-amber-400" />, name: 'PQRS', desc: 'Peticiones, quejas y reclamos' },
                { icon: <CalendarDays className="h-4 w-4 text-sky-400" />, name: 'Reservas', desc: 'Áreas comunes y salones' },
                { icon: <Package className="h-4 w-4 text-purple-400" />, name: 'Portería', desc: 'Visitantes y correspondencia' },
                { icon: <TrendingUp className="h-4 w-4 text-emerald-400" />, name: 'Finanzas', desc: 'Cuotas de administración' },
              ].map((mod) => (
                <div key={mod.name} className="flex items-center space-x-3 p-3 rounded-xl bg-zinc-950/40 border border-zinc-800/30">
                  <div className="p-1.5 rounded-lg bg-zinc-900">
                    {mod.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-300">{mod.name}</p>
                    <p className="text-[10px] text-zinc-600">{mod.desc}</p>
                  </div>
                  <span className="ml-auto text-[9px] font-bold text-zinc-600 bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded-full shrink-0">
                    Pronto
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── DASHBOARD RESIDENTE ───────────────────────────────────────────────────
function ResidentDashboard() {
  const { user } = useAuth();
  const [residentInfo, setResidentInfo] = useState<ResidentInfo | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.tenantId || !user?.email) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        // Buscar info del residente por correo
        const resSnap = await getDocs(query(
          collection(db, 'residents'),
          where('email', '==', user.email),
          where('tenantId', '==', user.tenantId)
        ));
        if (!resSnap.empty) {
          const data = resSnap.docs[0].data();
          setResidentInfo({
            properties: data.properties || [],
            status: data.status || 'ACTIVE',
          });
        }

        // Últimos comunicados del conjunto
        const annSnap = await getDocs(query(
          collection(db, 'announcements'),
          where('tenantId', '==', user.tenantId)
        ));
        const annList: Announcement[] = [];
        annSnap.forEach((d) => {
          const data = d.data();
          annList.push({ id: d.id, title: data.title || '', body: data.body || '', senderName: data.senderName || '', createdAt: data.createdAt });
        });
        annList.sort((a, b) => {
          const ta = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0;
          const tb = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0;
          return tb - ta;
        });
        setAnnouncements(annList.slice(0, 4));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  return (
    <div className="space-y-8 pb-8">
      {/* Header personal */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">
          Hola, {user?.firstName} 👋
        </h1>
        <p className="text-sm text-zinc-500 mt-1 font-medium">
          Tu portal de residente · {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 text-violet-500 animate-spin" />
        </div>
      ) : (
        <>
          {/* Tarjeta Mi Apartamento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-600/10 to-zinc-950 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-5 opacity-10 pointer-events-none">
                <Home className="h-20 w-20 text-violet-400" />
              </div>
              <div className="flex items-center space-x-2 text-violet-400 mb-3">
                <Home className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Mi Apartamento</span>
              </div>
              {residentInfo && residentInfo.properties.length > 0 ? (
                <div className="space-y-2">
                  {residentInfo.properties.map((p, i) => (
                    <div key={i}>
                      <p className="text-xl font-bold text-zinc-100">{p.unit}</p>
                      <p className="text-sm text-zinc-400">{p.tower}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500">Sin inmueble asignado aún</p>
              )}
            </motion.div>

            {/* Estado de cuenta */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="p-5 rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-600/10 to-zinc-950 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-5 opacity-10 pointer-events-none">
                <CheckCircle2 className="h-20 w-20 text-emerald-400" />
              </div>
              <div className="flex items-center space-x-2 text-emerald-400 mb-3">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Estado de Cuenta</span>
              </div>
              <p className="text-xl font-bold text-zinc-100">Al Día</p>
              <p className="text-xs text-zinc-500 mt-1">
                El módulo de pagos y cuotas estará disponible pronto.
              </p>
            </motion.div>
          </div>

          {/* Accesos rápidos del residente */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'Comunicados', href: '/dashboard/announcements', icon: <Megaphone className="h-5 w-5" />, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20', available: true },
              { label: 'PQRS', href: '#', icon: <ClipboardList className="h-5 w-5" />, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', available: false },
              { label: 'Reservas', href: '#', icon: <CalendarDays className="h-5 w-5" />, color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/20', available: false },
            ].map((action) => (
              <Link
                key={action.label}
                href={action.href}
                onClick={!action.available ? (e) => e.preventDefault() : undefined}
                className={`p-4 rounded-2xl border ${action.bg} flex flex-col items-center justify-center space-y-2 text-center transition-all ${action.available ? 'hover:scale-[1.02]' : 'opacity-60 cursor-not-allowed'}`}
              >
                <span className={action.color}>{action.icon}</span>
                <p className="text-xs font-semibold text-zinc-300">{action.label}</p>
                {!action.available && (
                  <span className="text-[9px] text-zinc-600 bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded-full font-bold">
                    Pronto
                  </span>
                )}
              </Link>
            ))}
          </div>

          {/* Comunicados recientes de la Admin */}
          <div className="p-5 rounded-2xl border border-zinc-800/60 bg-zinc-900/20">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-zinc-200 text-sm">Comunicados de la Administración</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Últimos anuncios para tu comunidad</p>
              </div>
              <Link href="/dashboard/announcements" className="text-xs font-semibold text-violet-400 hover:text-violet-300 flex items-center space-x-1">
                <span>Ver todos</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {announcements.length === 0 ? (
              <div className="py-10 text-center border border-dashed border-zinc-800 rounded-xl">
                <Megaphone className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
                <p className="text-xs text-zinc-500">No hay comunicados aún</p>
              </div>
            ) : (
              <div className="space-y-3">
                {announcements.map((ann) => (
                  <div key={ann.id} className="p-4 bg-zinc-950/50 rounded-xl border border-zinc-800/40 hover:border-zinc-700/60 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-zinc-200">{ann.title}</p>
                        <p className="text-[11px] text-zinc-500 mt-1 line-clamp-2 leading-relaxed">{ann.body}</p>
                        <p className="text-[10px] text-zinc-600 mt-1.5">Por: {ann.senderName}</p>
                      </div>
                      <span className="text-[9px] text-zinc-600 shrink-0 mt-0.5">
                        {ann.createdAt?.seconds
                          ? new Date(ann.createdAt.seconds * 1000).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
                          : 'Reciente'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── DASHBOARD PORTERÍA ───────────────────────────────────────────────────
function PorterDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    pendingPkgs: 0,
    insideVisitors: 0,
    logsCount: 0,
  });
  const [recentInside, setRecentInside] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.tenantId) return;
    const fetchPorterStats = async () => {
      setLoading(true);
      try {
        const tid = user.tenantId;

        // Query packages pending
        const pkgSnap = await getDocs(query(
          collection(db, 'packages'),
          where('tenantId', '==', tid),
          where('status', '==', 'PENDING')
        ));

        // Query visitors inside
        const visSnap = await getDocs(query(
          collection(db, 'visitors'),
          where('tenantId', '==', tid),
          where('status', '==', 'INSIDE')
        ));

        // Query logs
        const logSnap = await getDocs(query(
          collection(db, 'gatehouse_logs'),
          where('tenantId', '==', tid)
        ));

        setStats({
          pendingPkgs: pkgSnap.size,
          insideVisitors: visSnap.size,
          logsCount: logSnap.size,
        });

        // 3 recent visitors inside
        const insideList: any[] = [];
        visSnap.forEach((d) => {
          const data = d.data();
          insideList.push({
            id: d.id,
            name: data.name || '',
            document: data.document || '',
            plate: data.plate || '',
            destinationName: data.destinationName || '',
            destinationUnit: data.destinationUnit || '',
            destinationTower: data.destinationTower || '',
            entryTime: data.entryTime,
          });
        });
        insideList.sort((a, b) => {
          const ta = a.entryTime?.seconds || 0;
          const tb = b.entryTime?.seconds || 0;
          return tb - ta;
        });
        setRecentInside(insideList.slice(0, 3));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchPorterStats();
  }, [user]);

  const handleQuickExit = async (visId: string) => {
    try {
      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
      await updateDoc(doc(db, 'visitors', visId), {
        status: 'LEFT',
        exitTime: serverTimestamp(),
      });
      // Refresh
      setRecentInside((prev) => prev.filter((v) => v.id !== visId));
      setStats((prev) => ({ ...prev, insideVisitors: Math.max(0, prev.insideVisitors - 1) }));
    } catch (e) {
      console.error(e);
    }
  };

  const formatTime = (ts: any) => {
    if (!ts?.seconds) return '—';
    return new Date(ts.seconds * 1000).toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-8 pb-8 font-sans">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">
          Bienvenido, {user?.firstName} 👋
        </h1>
        <p className="text-sm text-zinc-500 mt-1 font-medium">
          Panel de Vigilancia y Portería · {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-zinc-900/40 border border-zinc-800/40 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 flex flex-col justify-between">
            <span className="p-2 rounded-xl bg-zinc-950/40 text-amber-400 w-fit">
              <Package className="h-5 w-5" />
            </span>
            <div className="mt-4">
              <p className="text-2xl sm:text-3xl font-bold text-zinc-100">{stats.pendingPkgs}</p>
              <p className="text-xs text-zinc-500 font-medium mt-0.5">Paquetes Pendientes</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 flex flex-col justify-between">
            <span className="p-2 rounded-xl bg-zinc-950/40 text-emerald-400 w-fit">
              <Users className="h-5 w-5" />
            </span>
            <div className="mt-4">
              <p className="text-2xl sm:text-3xl font-bold text-zinc-100">{stats.insideVisitors}</p>
              <p className="text-xs text-zinc-500 font-medium mt-0.5">Visitantes Adentro</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-zinc-700/40 bg-zinc-900/20 flex flex-col justify-between">
            <span className="p-2 rounded-xl bg-zinc-950/40 text-zinc-300 w-fit">
              <ClipboardList className="h-5 w-5" />
            </span>
            <div className="mt-4">
              <p className="text-2xl sm:text-3xl font-bold text-zinc-100">{stats.logsCount}</p>
              <p className="text-xs text-zinc-500 font-medium mt-0.5">Novedades Registradas</p>
            </div>
          </div>
        </div>
      )}

      {/* Main grids */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Visitantes Adentro */}
        <div className="lg:col-span-2 p-5 rounded-2xl border border-zinc-800/60 bg-zinc-900/20">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-zinc-200 text-sm">Visitantes en el Conjunto</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Personas registradas actualmente adentro</p>
            </div>
            <Link href="/dashboard/gatehouse" className="text-xs font-semibold text-violet-400 hover:text-violet-300 flex items-center space-x-1">
              <span>Gestionar todos</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-zinc-950/40 border border-zinc-900/50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : recentInside.length === 0 ? (
            <div className="py-10 text-center border border-dashed border-zinc-800 rounded-xl">
              <Users className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
              <p className="text-xs text-zinc-500">No hay visitantes adentro ahora</p>
              <Link href="/dashboard/gatehouse" className="text-xs text-violet-400 font-semibold underline mt-1 inline-block">
                Registrar nuevo ingreso
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentInside.map((vis) => (
                <div key={vis.id} className="p-4 bg-zinc-950/50 rounded-xl border border-zinc-800/40 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-zinc-200">{vis.name}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      Visita a: <span className="font-medium text-zinc-400">{vis.destinationName}</span> ({vis.destinationTower} {vis.destinationUnit})
                    </p>
                    {vis.plate && <p className="text-[10px] text-zinc-500 mt-0.5">Placa: {vis.plate}</p>}
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-[10px] text-zinc-500 font-medium font-mono">Entrada: {formatTime(vis.entryTime)}</span>
                    <button
                      onClick={() => handleQuickExit(vis.id)}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 text-[10px] font-bold bg-zinc-850 hover:bg-zinc-800 text-zinc-350 border border-zinc-800 rounded-xl transition-all"
                    >
                      Registrar Salida
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Accesos Rápidos */}
        <div className="p-5 rounded-2xl border border-zinc-800/60 bg-zinc-900/20 space-y-4">
          <h3 className="font-bold text-zinc-200 text-sm">Accesos Directos</h3>
          <div className="grid grid-cols-1 gap-2.5">
            <Link
              href="/dashboard/gatehouse"
              className="p-4 rounded-xl border border-violet-500/20 bg-violet-600/5 hover:bg-violet-600/10 text-left transition-all flex items-center justify-between group"
            >
              <div>
                <p className="text-xs font-bold text-zinc-200">Panel de Portería</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">Gestionar paquetes, visitas y novedades</p>
              </div>
              <ArrowRight className="h-4 w-4 text-zinc-500 group-hover:text-violet-400 transition-colors" />
            </Link>

            <Link
              href="/dashboard/gatehouse"
              className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/40 hover:border-zinc-700 text-left transition-all flex items-center justify-between group"
            >
              <div>
                <p className="text-xs font-bold text-zinc-200">Buscar Vivienda / Residente</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">Consultar datos de contacto y visitas</p>
              </div>
              <ArrowRight className="h-4 w-4 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PÁGINA PRINCIPAL (SELECTOR DE ROL) ──────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;

  if (user.role === 'RESIDENTE') return <ResidentDashboard />;
  if (user.role === 'PORTERÍA') return <PorterDashboard />;
  return <AdminDashboard />;
}
