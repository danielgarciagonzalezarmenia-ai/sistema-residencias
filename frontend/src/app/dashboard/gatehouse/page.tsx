'use client';

import React, { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../context/AuthContext';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
  orderBy,
} from 'firebase/firestore';
import {
  Shield,
  Package,
  Users,
  BookOpen,
  Plus,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Truck,
  UserCheck,
  LogIn,
  LogOut,
  Search,
  FileText,
  Building,
  Car,
  Hash,
  ChevronRight,
  Bell,
  Download,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { sendEmail } from '../../../lib/mail';

// ─── TIPOS ─────────────────────────────────────────────────────────────────
interface ResidentOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  properties: { tower: string; unit: string }[];
}

interface PackageRecord {
  id: string;
  carrier: string;
  guideNumber: string;
  residentName: string;
  residentEmail: string;
  unit: string;
  tower: string;
  status: 'PENDING' | 'DELIVERED';
  notes: string;
  createdAt: any;
  deliveredAt: any;
}

interface VisitorRecord {
  id: string;
  name: string;
  document: string;
  plate: string;
  destinationName: string;
  destinationUnit: string;
  destinationTower: string;
  entryTime: any;
  exitTime: any;
  status: 'INSIDE' | 'LEFT';
  registeredBy: string;
}

interface LogRecord {
  id: string;
  body: string;
  author: string;
  createdAt: any;
}

interface Property {
  id: string;
  tower: string;
  unit: string;
  ownerName: string | null;
  ownerId: string | null;
  inhabitantName: string | null;
  inhabitantId: string | null;
  status: string;
}

const TABS = [
  { key: 'packages', label: 'Paquetes', icon: <Package className="h-4 w-4" /> },
  { key: 'visitors', label: 'Visitantes', icon: <Users className="h-4 w-4" /> },
  { key: 'properties', label: 'Inmuebles', icon: <Building className="h-4 w-4" /> },
  { key: 'log',      label: 'Novedades', icon: <BookOpen className="h-4 w-4" /> },
];

const CARRIERS = [
  'Servientrega', 'Coordinadora', 'Interrapidísimo', 'Deprisa', 'TCC',
  'Envia', 'Mensajeros Urbanos', 'Amazon', 'Rappi', 'Otra',
];

// ─── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────
export default function GatehousePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'packages' | 'visitors' | 'log' | 'properties'>('packages');

  // Datos compartidos
  const [residents, setResidents] = useState<ResidentOption[]>([]);
  const [loadingResidents, setLoadingResidents] = useState(true);

  // Inmuebles (Buscador portería)
  const [properties, setProperties] = useState<Property[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [propSearch, setPropSearch] = useState('');
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [selectedPropVisitors, setSelectedPropVisitors] = useState<VisitorRecord[]>([]);
  const [loadingPropVisitors, setLoadingPropVisitors] = useState(false);

  // Paquetes
  const [packages, setPackages] = useState<PackageRecord[]>([]);
  const [loadingPkg, setLoadingPkg] = useState(false);
  const [isPkgOpen, setIsPkgOpen] = useState(false);
  const [pkgCarrier, setPkgCarrier] = useState('Servientrega');
  const [pkgGuide, setPkgGuide] = useState('');
  const [pkgResidentId, setPkgResidentId] = useState('');
  const [pkgNotes, setPkgNotes] = useState('');
  const [pkgSubmitting, setPkgSubmitting] = useState(false);
  const [pkgError, setPkgError] = useState<string | null>(null);

  // Visitantes
  const [visitors, setVisitors] = useState<VisitorRecord[]>([]);
  const [loadingVis, setLoadingVis] = useState(false);
  const [isVisOpen, setIsVisOpen] = useState(false);
  const [visName, setVisName] = useState('');
  const [visDoc, setVisDoc] = useState('');
  const [visPlate, setVisPlate] = useState('');
  const [visDestId, setVisDestId] = useState('');
  const [visSubmitting, setVisSubmitting] = useState(false);
  const [visError, setVisError] = useState<string | null>(null);

  // Novedades
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [loadingLog, setLoadingLog] = useState(false);
  const [logBody, setLogBody] = useState('');
  const [logSubmitting, setLogSubmitting] = useState(false);

  // ── Cargar residentes ────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.tenantId) return;
    const fetchResidents = async () => {
      setLoadingResidents(true);
      try {
        const snap = await getDocs(query(
          collection(db, 'residents'),
          where('tenantId', '==', user.tenantId),
          where('status', '==', 'ACTIVE')
        ));
        const list: ResidentOption[] = [];
        snap.forEach(d => {
          const data = d.data();
          list.push({
            id: d.id,
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            email: data.email || '',
            properties: data.properties || [],
          });
        });
        setResidents(list);
      } catch (e) { console.error(e); }
      finally { setLoadingResidents(false); }
    };
    fetchResidents();
  }, [user]);

  // ── Cargar Paquetes ──────────────────────────────────────────────────────
  const loadPackages = async () => {
    if (!user?.tenantId) return;
    setLoadingPkg(true);
    try {
      const snap = await getDocs(query(
        collection(db, 'packages'),
        where('tenantId', '==', user.tenantId)
      ));
      const list: PackageRecord[] = [];
      snap.forEach(d => {
        const data = d.data();
        list.push({
          id: d.id,
          carrier: data.carrier || '',
          guideNumber: data.guideNumber || '',
          residentName: data.residentName || '',
          residentEmail: data.residentEmail || '',
          unit: data.unit || '',
          tower: data.tower || '',
          status: data.status || 'PENDING',
          notes: data.notes || '',
          createdAt: data.createdAt,
          deliveredAt: data.deliveredAt || null,
        });
      });
      list.sort((a, b) => {
        const ta = a.createdAt?.seconds ?? 0;
        const tb = b.createdAt?.seconds ?? 0;
        return tb - ta;
      });
      setPackages(list);
    } catch (e) { console.error(e); }
    finally { setLoadingPkg(false); }
  };

  // ── Cargar Visitantes ────────────────────────────────────────────────────
  const loadVisitors = async () => {
    if (!user?.tenantId) return;
    setLoadingVis(true);
    try {
      const snap = await getDocs(query(
        collection(db, 'visitors'),
        where('tenantId', '==', user.tenantId)
      ));
      const list: VisitorRecord[] = [];
      snap.forEach(d => {
        const data = d.data();
        list.push({
          id: d.id,
          name: data.name || '',
          document: data.document || '',
          plate: data.plate || '',
          destinationName: data.destinationName || '',
          destinationUnit: data.destinationUnit || '',
          destinationTower: data.destinationTower || '',
          entryTime: data.entryTime,
          exitTime: data.exitTime || null,
          status: data.status || 'INSIDE',
          registeredBy: data.registeredBy || '',
        });
      });
      list.sort((a, b) => {
        const ta = a.entryTime?.seconds ?? 0;
        const tb = b.entryTime?.seconds ?? 0;
        return tb - ta;
      });
      setVisitors(list);
    } catch (e) { console.error(e); }
    finally { setLoadingVis(false); }
  };

  // ── Cargar Inmuebles ─────────────────────────────────────────────────────
  const loadProperties = async () => {
    if (!user?.tenantId) return;
    setLoadingProperties(true);
    try {
      const snap = await getDocs(query(
        collection(db, 'properties'),
        where('tenantId', '==', user.tenantId)
      ));
      const list: Property[] = [];
      snap.forEach(d => {
        const data = d.data();
        list.push({
          id: d.id,
          tower: data.tower || '',
          unit: data.unit || '',
          ownerName: data.ownerName || null,
          ownerId: data.ownerId || null,
          inhabitantName: data.inhabitantName || null,
          inhabitantId: data.inhabitantId || null,
          status: data.status || 'VACANT',
        });
      });
      list.sort((a, b) => {
        if (a.tower !== b.tower) return a.tower.localeCompare(b.tower);
        return a.unit.localeCompare(b.unit, undefined, { numeric: true });
      });
      setProperties(list);
    } catch (e) { console.error(e); }
    finally { setLoadingProperties(false); }
  };

  const handleSelectProperty = async (prop: Property) => {
    setSelectedProperty(prop);
    setLoadingPropVisitors(true);
    try {
      const snap = await getDocs(query(
        collection(db, 'visitors'),
        where('tenantId', '==', user?.tenantId),
        where('destinationTower', '==', prop.tower),
        where('destinationUnit', '==', prop.unit)
      ));
      const list: VisitorRecord[] = [];
      snap.forEach(d => {
        const data = d.data();
        list.push({
          id: d.id,
          name: data.name || '',
          document: data.document || '',
          plate: data.plate || '',
          destinationName: data.destinationName || '',
          destinationUnit: data.destinationUnit || '',
          destinationTower: data.destinationTower || '',
          entryTime: data.entryTime,
          exitTime: data.exitTime || null,
          status: data.status || 'INSIDE',
          registeredBy: data.registeredBy || '',
        });
      });
      list.sort((a, b) => {
        const ta = a.entryTime?.seconds ?? 0;
        const tb = b.entryTime?.seconds ?? 0;
        return tb - ta;
      });
      setSelectedPropVisitors(list);
    } catch (e) { console.error(e); }
    finally { setLoadingPropVisitors(false); }
  };

  const loadLogs = async () => {
    if (!user?.tenantId) return;
    setLoadingLog(true);
    try {
      const snap = await getDocs(query(
        collection(db, 'gatehouse_logs'),
        where('tenantId', '==', user.tenantId)
      ));
      const list: LogRecord[] = [];
      snap.forEach(d => {
        const data = d.data();
        list.push({ id: d.id, body: data.body || '', author: data.author || '', createdAt: data.createdAt });
      });
      list.sort((a, b) => {
        const ta = a.createdAt?.seconds ?? 0;
        const tb = b.createdAt?.seconds ?? 0;
        return tb - ta;
      });
      setLogs(list);
    } catch (e) { console.error(e); }
    finally { setLoadingLog(false); }
  };

  useEffect(() => {
    if (activeTab === 'packages') loadPackages();
    else if (activeTab === 'visitors') loadVisitors();
    else if (activeTab === 'properties') loadProperties();
    else loadLogs();
  }, [activeTab, user]);

  // ── Registrar Paquete ────────────────────────────────────────────────────
  const handleRegisterPackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pkgResidentId) { setPkgError('Selecciona el residente destinatario.'); return; }
    if (!user?.tenantId) return;

    const resident = residents.find(r => r.id === pkgResidentId);
    if (!resident) return;

    const prop = resident.properties[0] || { tower: 'Sin Torre', unit: 'Sin Unidad' };

    setPkgSubmitting(true);
    setPkgError(null);
    try {
      // 1. Guardar paquete en Firestore
      await addDoc(collection(db, 'packages'), {
        carrier: pkgCarrier,
        guideNumber: pkgGuide,
        residentId: resident.id,
        residentName: `${resident.firstName} ${resident.lastName}`,
        residentEmail: resident.email,
        unit: prop.unit,
        tower: prop.tower,
        status: 'PENDING',
        notes: pkgNotes,
        tenantId: user.tenantId,
        registeredBy: `${user.firstName} ${user.lastName}`,
        createdAt: serverTimestamp(),
        deliveredAt: null,
      });

      // 2. Buscar UID del usuario residente en Firestore para notificación en campana
      let receiverUid = 'ALL';
      if (resident.email) {
        const userSnap = await getDocs(query(
          collection(db, 'users'),
          where('email', '==', resident.email),
          where('tenantId', '==', user.tenantId)
        ));
        if (!userSnap.empty) receiverUid = userSnap.docs[0].id;
      }

      // 3. Crear notificación en tiempo real
      await addDoc(collection(db, 'notifications'), {
        title: `📦 Paquete en Portería - ${pkgCarrier}`,
        body: `Tienes un paquete de ${pkgCarrier} esperándote en portería. ${pkgGuide ? `Guía: ${pkgGuide}.` : ''} ${pkgNotes || ''}`.trim(),
        type: 'package',
        isRead: false,
        tenantId: user.tenantId,
        receiverId: receiverUid,
        createdAt: serverTimestamp(),
      });

      // 4. Enviar correo al residente en segundo plano (asíncrono, sin bloquear la interfaz)
      if (resident.email) {
        sendEmail({
          toEmail: resident.email,
          toName: `${resident.firstName} ${resident.lastName}`,
          subject: `📦 Llegó un paquete de ${pkgCarrier} para ti`,
          message: `Hola ${resident.firstName},\n\nTienes un paquete de ${pkgCarrier} esperándote en portería del conjunto.\n${pkgGuide ? `Número de guía: ${pkgGuide}\n` : ''}${pkgNotes ? `Nota: ${pkgNotes}\n` : ''}\nDiríjete a portería para reclamarlo en el horario habitual.\n\nSaludos,\nAdministración`,
          tenantId: user.tenantId,
          type: 'package',
          metadata: {
            carrier: pkgCarrier,
            guide: pkgGuide || 'Sin número de guía',
            notes: pkgNotes || 'Ninguna',
            date: new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }),
          },
        }).catch((err) => console.error('Error enviando correo de paquete:', err));
      }

      // Reset y cerrar modal de inmediato
      setPkgGuide('');
      setPkgResidentId('');
      setPkgNotes('');
      setPkgCarrier('Servientrega');
      setIsPkgOpen(false);
      await loadPackages();
    } catch (err: any) {
      setPkgError(err.message || 'Error al registrar el paquete.');
    } finally {
      setPkgSubmitting(false);
    }
  };

  // ── Marcar paquete entregado ─────────────────────────────────────────────
  const handleDeliverPackage = async (pkgId: string) => {
    try {
      await updateDoc(doc(db, 'packages', pkgId), {
        status: 'DELIVERED',
        deliveredAt: serverTimestamp(),
      });
      await loadPackages();
    } catch (e) { console.error(e); }
  };

  // ── Registrar Visitante ──────────────────────────────────────────────────
  const handleRegisterVisitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visName) { setVisError('El nombre del visitante es obligatorio.'); return; }
    if (!user?.tenantId) return;

    const resident = visDestId ? residents.find(r => r.id === visDestId) : null;
    const prop = resident?.properties[0] || { tower: '', unit: '' };

    setVisSubmitting(true);
    setVisError(null);
    try {
      await addDoc(collection(db, 'visitors'), {
        name: visName,
        document: visDoc,
        plate: visPlate,
        destinationName: resident ? `${resident.firstName} ${resident.lastName}` : 'No especificado',
        destinationUnit: prop.unit,
        destinationTower: prop.tower,
        entryTime: serverTimestamp(),
        exitTime: null,
        status: 'INSIDE',
        tenantId: user.tenantId,
        registeredBy: `${user.firstName} ${user.lastName}`,
      });

      setVisName(''); setVisDoc(''); setVisPlate(''); setVisDestId('');
      setIsVisOpen(false);
      await loadVisitors();
    } catch (err: any) {
      setVisError(err.message || 'Error al registrar visitante.');
    } finally {
      setVisSubmitting(false);
    }
  };

  // ── Registrar salida visitante ───────────────────────────────────────────
  const handleVisitorExit = async (visId: string) => {
    try {
      await updateDoc(doc(db, 'visitors', visId), {
        status: 'LEFT',
        exitTime: serverTimestamp(),
      });
      await loadVisitors();
    } catch (e) { console.error(e); }
  };

  // ── Guardar novedad ──────────────────────────────────────────────────────
  const handleSaveLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logBody.trim() || !user?.tenantId) return;
    setLogSubmitting(true);
    try {
      await addDoc(collection(db, 'gatehouse_logs'), {
        body: logBody,
        author: `${user.firstName} ${user.lastName}`,
        tenantId: user.tenantId,
        createdAt: serverTimestamp(),
      });
      setLogBody('');
      await loadLogs();
    } catch (e) { console.error(e); }
    finally { setLogSubmitting(false); }
  };

  const formatTime = (ts: any) => {
    if (!ts?.seconds) return '—';
    return new Date(ts.seconds * 1000).toLocaleString('es-CO', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  };

  const pendingPkgs = packages.filter(p => p.status === 'PENDING').length;
  const insideVisitors = visitors.filter(v => v.status === 'INSIDE').length;

  const handleExportPackagesCSV = () => {
    const headers = ['Empresa', 'Número de Guía', 'Destinatario', 'Torre', 'Apartamento', 'Estado', 'Detalles', 'Fecha de Registro', 'Fecha de Entrega'];
    const rows = packages.map((p) => [
      p.carrier,
      p.guideNumber || 'Sin guía',
      p.residentName,
      p.tower,
      p.unit,
      p.status === 'PENDING' ? 'En portería' : 'Entregado',
      p.notes || 'Ninguna',
      p.createdAt?.seconds ? new Date(p.createdAt.seconds * 1000).toLocaleString('es-CO') : '—',
      p.deliveredAt?.seconds ? new Date(p.deliveredAt.seconds * 1000).toLocaleString('es-CO') : '—'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `correspondencia_${new Date().toISOString().split('T')[0]}.csv`);
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
  };

  // ─── RENDER ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-12">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 flex items-center space-x-2.5">
          <Shield className="h-7 w-7 text-violet-400" />
          <span>Panel de Portería</span>
        </h1>
        <p className="text-xs text-zinc-500 mt-1 font-medium">
          Control de ingreso, correspondencia y novedades del turno.
        </p>
      </div>

      {/* Contadores rápidos */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 text-center">
          <p className="text-2xl font-bold text-amber-400">{pendingPkgs}</p>
          <p className="text-[11px] text-zinc-500 font-medium mt-0.5">Paquetes pendientes</p>
        </div>
        <div className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 text-center">
          <p className="text-2xl font-bold text-emerald-400">{insideVisitors}</p>
          <p className="text-[11px] text-zinc-500 font-medium mt-0.5">Visitantes adentro</p>
        </div>
        <div className="p-4 rounded-2xl border border-zinc-700/40 bg-zinc-900/20 text-center">
          <p className="text-2xl font-bold text-zinc-300">{logs.length}</p>
          <p className="text-[11px] text-zinc-500 font-medium mt-0.5">Novedades hoy</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-800">
        <div className="flex space-x-1">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
                activeTab === tab.key
                  ? 'border-violet-500 text-violet-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB: PAQUETES ────────────────────────────────────────────────── */}
      {activeTab === 'packages' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-500 font-medium">{packages.length} paquete(s) registrado(s)</p>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleExportPackagesCSV}
                className="inline-flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl transition-all border border-zinc-750 shadow-md"
                title="Exportar correspondencia a Excel"
              >
                <Download className="h-4 w-4" />
                <span>Exportar</span>
              </button>
              <button
                onClick={() => { setPkgError(null); setIsPkgOpen(true); }}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-all shadow-lg shadow-violet-600/20"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Registrar Paquete</span>
              </button>
            </div>
          </div>

          {loadingPkg ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-7 w-7 text-violet-500 animate-spin" />
            </div>
          ) : packages.length === 0 ? (
            <div className="py-16 border border-dashed border-zinc-800 rounded-2xl text-center">
              <Package className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-zinc-500">No hay paquetes registrados</p>
            </div>
          ) : (
            <div className="space-y-3">
              {packages.map(pkg => (
                <motion.div
                  key={pkg.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${
                    pkg.status === 'PENDING'
                      ? 'border-amber-500/20 bg-amber-500/5'
                      : 'border-zinc-800/40 bg-zinc-900/10 opacity-70'
                  }`}
                >
                  <div className="flex items-start space-x-3.5">
                    <div className={`p-2 rounded-xl shrink-0 ${pkg.status === 'PENDING' ? 'bg-amber-500/10' : 'bg-zinc-800'}`}>
                      <Package className={`h-5 w-5 ${pkg.status === 'PENDING' ? 'text-amber-400' : 'text-zinc-500'}`} />
                    </div>
                    <div>
                      <div className="flex items-center flex-wrap gap-2 mb-1">
                        <span className="text-sm font-semibold text-zinc-200">{pkg.carrier}</span>
                        {pkg.guideNumber && (
                          <span className="text-[10px] text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full border border-zinc-700">
                            #{pkg.guideNumber}
                          </span>
                        )}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          pkg.status === 'PENDING'
                            ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                            : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                        }`}>
                          {pkg.status === 'PENDING' ? 'En portería' : 'Entregado'}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 font-medium">{pkg.residentName}</p>
                      <p className="text-[11px] text-zinc-600">{pkg.tower} · {pkg.unit}</p>
                      {pkg.notes && <p className="text-[11px] text-zinc-500 italic mt-0.5">"{pkg.notes}"</p>}
                      <p className="text-[10px] text-zinc-600 mt-1">Registrado: {formatTime(pkg.createdAt)}</p>
                      {pkg.deliveredAt && <p className="text-[10px] text-emerald-600 mt-0.5">Entregado: {formatTime(pkg.deliveredAt)}</p>}
                    </div>
                  </div>
                  {pkg.status === 'PENDING' && (
                    <button
                      onClick={() => handleDeliverPackage(pkg.id)}
                      className="shrink-0 inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/20 rounded-xl transition-all"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Marcar Entregado</span>
                    </button>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: VISITANTES ──────────────────────────────────────────────── */}
      {activeTab === 'visitors' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-500 font-medium">{insideVisitors} visitante(s) en el conjunto ahora</p>
            <button
              onClick={() => { setVisError(null); setIsVisOpen(true); }}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-all shadow-lg shadow-violet-600/20"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Registrar Entrada</span>
            </button>
          </div>

          {loadingVis ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-7 w-7 text-violet-500 animate-spin" />
            </div>
          ) : visitors.length === 0 ? (
            <div className="py-16 border border-dashed border-zinc-800 rounded-2xl text-center">
              <Users className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-zinc-500">No hay visitantes registrados hoy</p>
            </div>
          ) : (
            <div className="space-y-3">
              {visitors.map(vis => (
                <motion.div
                  key={vis.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${
                    vis.status === 'INSIDE'
                      ? 'border-emerald-500/20 bg-emerald-500/5'
                      : 'border-zinc-800/40 bg-zinc-900/10 opacity-60'
                  }`}
                >
                  <div className="flex items-start space-x-3.5">
                    <div className={`p-2 rounded-xl shrink-0 ${vis.status === 'INSIDE' ? 'bg-emerald-500/10' : 'bg-zinc-800'}`}>
                      <UserCheck className={`h-5 w-5 ${vis.status === 'INSIDE' ? 'text-emerald-400' : 'text-zinc-500'}`} />
                    </div>
                    <div>
                      <div className="flex items-center flex-wrap gap-2 mb-1">
                        <span className="text-sm font-semibold text-zinc-200">{vis.name}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          vis.status === 'INSIDE'
                            ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                            : 'text-zinc-500 bg-zinc-800 border-zinc-700'
                        }`}>
                          {vis.status === 'INSIDE' ? 'Adentro' : 'Salió'}
                        </span>
                      </div>
                      {vis.document && <p className="text-[11px] text-zinc-500">CC/Doc: {vis.document}</p>}
                      {vis.plate && (
                        <p className="text-[11px] text-zinc-500 flex items-center space-x-1">
                          <Car className="h-3 w-3" /><span>Placa: {vis.plate}</span>
                        </p>
                      )}
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Visita a: <span className="font-medium text-zinc-300">{vis.destinationName}</span>
                        {vis.destinationUnit && ` · ${vis.destinationTower} ${vis.destinationUnit}`}
                      </p>
                      <p className="text-[10px] text-zinc-600 mt-1">Entrada: {formatTime(vis.entryTime)}</p>
                      {vis.exitTime && <p className="text-[10px] text-zinc-600">Salida: {formatTime(vis.exitTime)}</p>}
                    </div>
                  </div>
                  {vis.status === 'INSIDE' && (
                    <button
                      onClick={() => handleVisitorExit(vis.id)}
                      className="shrink-0 inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded-xl transition-all"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Registrar Salida</span>
                    </button>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: INMUEBLES ──────────────────────────────────────────────── */}
      {activeTab === 'properties' && (
        <div className="space-y-4">
          <p className="text-xs text-zinc-500 font-medium font-sans">Búsqueda rápida de viviendas, residentes y registro de visitantes.</p>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Lista y Buscador */}
            <div className="lg:col-span-1 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Buscar torre, apto, dueño..."
                  value={propSearch}
                  onChange={e => setPropSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-zinc-950/70 border border-zinc-800 rounded-xl text-zinc-200 placeholder-zinc-600 text-xs focus:outline-none focus:border-violet-500/70"
                />
              </div>

              {loadingProperties ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 text-violet-500 animate-spin" />
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
                  {properties.filter(p => 
                    p.tower.toLowerCase().includes(propSearch.toLowerCase()) ||
                    p.unit.toLowerCase().includes(propSearch.toLowerCase()) ||
                    (p.ownerName || '').toLowerCase().includes(propSearch.toLowerCase()) ||
                    (p.inhabitantName || '').toLowerCase().includes(propSearch.toLowerCase())
                  ).map(prop => {
                    const isSel = selectedProperty?.id === prop.id;
                    return (
                      <div
                        key={prop.id}
                        onClick={() => handleSelectProperty(prop)}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                          isSel
                            ? 'bg-violet-600/15 border-violet-500/40 text-violet-200 shadow-md shadow-violet-600/5'
                            : 'bg-zinc-900/10 border-zinc-800/80 hover:border-zinc-700/60'
                        }`}
                      >
                        <p className="text-xs font-bold text-zinc-200">{prop.tower} - {prop.unit}</p>
                        <p className="text-[10px] text-zinc-500 mt-1 truncate">
                          Dueño: <span className="text-zinc-400 font-medium">{prop.ownerName || 'Sin asignar'}</span>
                        </p>
                        {prop.inhabitantName && (
                          <p className="text-[10px] text-zinc-500 truncate">
                            Inquilino: <span className="text-zinc-400 font-medium">{prop.inhabitantName}</span>
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Detalles de la propiedad y visitantes */}
            <div className="lg:col-span-2">
              {selectedProperty ? (
                <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/15 space-y-5">
                  <div className="pb-3 border-b border-zinc-800/80 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-100">{selectedProperty.tower} - {selectedProperty.unit}</h3>
                      <p className="text-[10px] text-zinc-500 mt-0.5 capitalize">Estado: {selectedProperty.status === 'OCCUPIED' ? 'Ocupado' : 'Vacío'}</p>
                    </div>
                  </div>

                  {/* Propietario & Habitante */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3.5 bg-zinc-950/60 border border-zinc-850 rounded-xl">
                      <p className="text-[10px] font-bold text-violet-400 uppercase tracking-wider mb-2">👤 Propietario Registrado</p>
                      {selectedProperty.ownerName ? (
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-zinc-200">{selectedProperty.ownerName}</p>
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-650 italic">Sin propietario asignado</p>
                      )}
                    </div>

                    <div className="p-3.5 bg-zinc-950/60 border border-zinc-850 rounded-xl">
                      <p className="text-[10px] font-bold text-violet-400 uppercase tracking-wider mb-2">🏠 Habitante / Inquilino</p>
                      {selectedProperty.inhabitantName ? (
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-zinc-200">{selectedProperty.inhabitantName}</p>
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-650 italic">El propietario reside aquí</p>
                      )}
                    </div>
                  </div>

                  {/* Historial de Visitantes */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center space-x-1.5">
                      <span>Historial de Visitantes</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 text-zinc-500 rounded-full">
                        {selectedPropVisitors.length}
                      </span>
                    </h4>

                    {loadingPropVisitors ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 text-violet-500 animate-spin" />
                      </div>
                    ) : selectedPropVisitors.length === 0 ? (
                      <p className="text-xs text-zinc-600 italic py-6 text-center border border-dashed border-zinc-850 rounded-xl">No hay registros de visitantes para esta vivienda.</p>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {selectedPropVisitors.map(vis => (
                          <div key={vis.id} className="p-3 bg-zinc-950/40 border border-zinc-850 rounded-xl flex items-center justify-between text-xs gap-3">
                            <div>
                              <p className="font-bold text-zinc-350">{vis.name}</p>
                              {vis.document && <p className="text-[10px] text-zinc-550">Documento: {vis.document}</p>}
                              {vis.plate && <p className="text-[10px] text-zinc-550">Vehículo: {vis.plate}</p>}
                            </div>
                            <div className="text-right text-[10px] text-zinc-600 space-y-0.5 font-medium">
                              <p>Ingreso: {formatTime(vis.entryTime)}</p>
                              {vis.exitTime ? <p>Salida: {formatTime(vis.exitTime)}</p> : <p className="text-emerald-400 font-semibold">Adentro</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-64 border-2 border-dashed border-zinc-850 rounded-2xl flex flex-col items-center justify-center text-center p-6 text-zinc-500">
                  <Building className="h-8 w-8 text-zinc-800 mb-2" />
                  <p className="text-xs font-semibold">Ninguna vivienda seleccionada</p>
                  <p className="text-[10px] text-zinc-650 mt-1">Selecciona una vivienda de la lista para ver su información y visitantes.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: NOVEDADES ───────────────────────────────────────────────── */}
      {activeTab === 'log' && (
        <div className="space-y-4">
          {/* Formulario de novedad */}
          <form onSubmit={handleSaveLog} className="p-4 rounded-2xl border border-zinc-800/60 bg-zinc-900/20 space-y-3">
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Nueva Novedad del Turno
            </label>
            <textarea
              rows={3}
              value={logBody}
              onChange={e => setLogBody(e.target.value)}
              placeholder="Describe el incidente, observación o novedad del turno..."
              className="w-full px-3 py-2.5 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500/70 transition-colors text-xs resize-none"
              required
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={logSubmitting || !logBody.trim()}
                className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-xl transition-all"
              >
                {logSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                <span>Guardar Novedad</span>
              </button>
            </div>
          </form>

          {/* Historial */}
          {loadingLog ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-7 w-7 text-violet-500 animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 border border-dashed border-zinc-800 rounded-2xl text-center">
              <BookOpen className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-zinc-500">Sin novedades registradas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map(log => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-4 rounded-xl border border-zinc-800/40 bg-zinc-900/10"
                >
                  <p className="text-xs text-zinc-300 leading-relaxed">{log.body}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-zinc-600 font-medium">Por: {log.author}</span>
                    <span className="text-[10px] text-zinc-600">{formatTime(log.createdAt)}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL: REGISTRAR PAQUETE ──────────────────────────────────────── */}
      <AnimatePresence>
        {isPkgOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !pkgSubmitting && setIsPkgOpen(false)}
              className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl w-full max-w-md shadow-2xl relative z-10"
            >
              <div className="flex items-center space-x-2.5 mb-5">
                <div className="p-2 bg-amber-500/10 rounded-xl">
                  <Package className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-100">Registrar Paquete</h3>
                  <p className="text-[11px] text-zinc-500">Se notificará al residente automáticamente</p>
                </div>
              </div>

              {pkgError && (
                <div className="mb-4 p-3 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-200 text-xs flex items-center space-x-2">
                  <AlertCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                  <span>{pkgError}</span>
                </div>
              )}

              <form onSubmit={handleRegisterPackage} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-zinc-400 font-medium mb-1.5">Transportadora *</label>
                    <select
                      value={pkgCarrier}
                      onChange={e => setPkgCarrier(e.target.value)}
                      disabled={pkgSubmitting}
                      className="w-full px-3 py-2 bg-zinc-950/70 border border-zinc-800 rounded-xl text-zinc-200 text-xs focus:outline-none focus:border-violet-500/70 transition-colors"
                    >
                      {CARRIERS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-400 font-medium mb-1.5">Guía (opcional)</label>
                    <input
                      type="text"
                      value={pkgGuide}
                      onChange={e => setPkgGuide(e.target.value)}
                      disabled={pkgSubmitting}
                      placeholder="Ej: 123456789"
                      className="w-full px-3 py-2 bg-zinc-950/70 border border-zinc-800 rounded-xl text-zinc-200 placeholder-zinc-600 text-xs focus:outline-none focus:border-violet-500/70 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-zinc-400 font-medium mb-1.5">Residente destinatario *</label>
                  <select
                    value={pkgResidentId}
                    onChange={e => setPkgResidentId(e.target.value)}
                    disabled={pkgSubmitting || loadingResidents}
                    required
                    className="w-full px-3 py-2 bg-zinc-950/70 border border-zinc-800 rounded-xl text-zinc-200 text-xs focus:outline-none focus:border-violet-500/70 transition-colors"
                  >
                    <option value="">— Seleccionar residente —</option>
                    {residents.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.firstName} {r.lastName} {r.properties[0] ? `· ${r.properties[0].tower} ${r.properties[0].unit}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-zinc-400 font-medium mb-1.5">Nota adicional (opcional)</label>
                  <input
                    type="text"
                    value={pkgNotes}
                    onChange={e => setPkgNotes(e.target.value)}
                    disabled={pkgSubmitting}
                    placeholder="Ej: Caja grande, frágil..."
                    className="w-full px-3 py-2 bg-zinc-950/70 border border-zinc-800 rounded-xl text-zinc-200 placeholder-zinc-600 text-xs focus:outline-none focus:border-violet-500/70 transition-colors"
                  />
                </div>

                <div className="p-3 bg-violet-500/5 border border-violet-500/15 rounded-xl text-[11px] text-zinc-400 flex items-start space-x-2">
                  <Bell className="h-3.5 w-3.5 text-violet-400 shrink-0 mt-0.5" />
                  <span>El residente recibirá una notificación en el portal y un correo electrónico de aviso automáticamente.</span>
                </div>

                <div className="flex items-center justify-end space-x-3 pt-2 border-t border-zinc-800">
                  <button type="button" disabled={pkgSubmitting} onClick={() => setIsPkgOpen(false)} className="px-4 py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                    Cancelar
                  </button>
                  <button type="submit" disabled={pkgSubmitting} className="px-4 py-2 text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-all flex items-center space-x-1.5">
                    {pkgSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Package className="h-3.5 w-3.5" />}
                    <span>{pkgSubmitting ? 'Registrando...' : 'Registrar y Notificar'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL: REGISTRAR VISITANTE ────────────────────────────────────── */}
      <AnimatePresence>
        {isVisOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !visSubmitting && setIsVisOpen(false)}
              className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl w-full max-w-md shadow-2xl relative z-10"
            >
              <div className="flex items-center space-x-2.5 mb-5">
                <div className="p-2 bg-emerald-500/10 rounded-xl">
                  <UserCheck className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-100">Registrar Visitante</h3>
                  <p className="text-[11px] text-zinc-500">Ingreso al conjunto · {new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>

              {visError && (
                <div className="mb-4 p-3 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-200 text-xs flex items-center space-x-2">
                  <AlertCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                  <span>{visError}</span>
                </div>
              )}

              <form onSubmit={handleRegisterVisitor} className="space-y-4">
                <div>
                  <label className="block text-[11px] text-zinc-400 font-medium mb-1.5">Nombre del Visitante *</label>
                  <input
                    type="text"
                    required
                    value={visName}
                    onChange={e => setVisName(e.target.value)}
                    disabled={visSubmitting}
                    placeholder="Ej: Pedro Ramírez"
                    className="w-full px-3 py-2 bg-zinc-950/70 border border-zinc-800 rounded-xl text-zinc-200 placeholder-zinc-600 text-xs focus:outline-none focus:border-violet-500/70 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-zinc-400 font-medium mb-1.5">Documento</label>
                    <input
                      type="text"
                      value={visDoc}
                      onChange={e => setVisDoc(e.target.value)}
                      disabled={visSubmitting}
                      placeholder="Cédula o pasaporte"
                      className="w-full px-3 py-2 bg-zinc-950/70 border border-zinc-800 rounded-xl text-zinc-200 placeholder-zinc-600 text-xs focus:outline-none focus:border-violet-500/70 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-400 font-medium mb-1.5">Placa Vehículo</label>
                    <input
                      type="text"
                      value={visPlate}
                      onChange={e => setVisPlate(e.target.value.toUpperCase())}
                      disabled={visSubmitting}
                      placeholder="Ej: ABC-123"
                      className="w-full px-3 py-2 bg-zinc-950/70 border border-zinc-800 rounded-xl text-zinc-200 placeholder-zinc-600 text-xs focus:outline-none focus:border-violet-500/70 transition-colors uppercase"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-zinc-400 font-medium mb-1.5">Apartamento que visita</label>
                  <select
                    value={visDestId}
                    onChange={e => setVisDestId(e.target.value)}
                    disabled={visSubmitting || loadingResidents}
                    className="w-full px-3 py-2 bg-zinc-950/70 border border-zinc-800 rounded-xl text-zinc-200 text-xs focus:outline-none focus:border-violet-500/70 transition-colors"
                  >
                    <option value="">— No especificado —</option>
                    {residents.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.properties[0] ? `${r.properties[0].tower} ${r.properties[0].unit}` : 'Sin unidad'} — {r.firstName} {r.lastName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-end space-x-3 pt-2 border-t border-zinc-800">
                  <button type="button" disabled={visSubmitting} onClick={() => setIsVisOpen(false)} className="px-4 py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                    Cancelar
                  </button>
                  <button type="submit" disabled={visSubmitting} className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all flex items-center space-x-1.5">
                    {visSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}
                    <span>{visSubmitting ? 'Registrando...' : 'Registrar Entrada'}</span>
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
