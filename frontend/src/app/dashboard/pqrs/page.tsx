'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../context/AuthContext';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  ClipboardList,
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  MessageSquare,
  Search,
  Filter,
  FileText,
  User,
  Home,
  Check,
  TrendingUp,
  Download,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PQRSItem {
  id: string;
  category: 'Petición' | 'Queja' | 'Reclamo' | 'Sugerencia';
  title: string;
  description: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'RESOLVED';
  adminResponse: string;
  userId: string;
  userName: string;
  unitInfo: string;
  createdAt: any;
  updatedAt: any;
}

const CATEGORIES = ['Petición', 'Queja', 'Reclamo', 'Sugerencia'];

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En Proceso',
  RESOLVED: 'Resuelto',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  IN_PROGRESS: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
  RESOLVED: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
};

export default function PqrsPage() {
  const { user } = useAuth();
  const [pqrsList, setPqrsList] = useState<PQRSItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Perfil del residente
  const [residentUnit, setResidentUnit] = useState('Administración');

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modales y formularios
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [category, setCategory] = useState<'Petición' | 'Queja' | 'Reclamo' | 'Sugerencia'>('Petición');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Modal de responder (Admin)
  const [selectedPqrs, setSelectedPqrs] = useState<PQRSItem | null>(null);
  const [adminResponseText, setAdminResponseText] = useState('');
  const [adminStatus, setAdminStatus] = useState<'PENDING' | 'IN_PROGRESS' | 'RESOLVED'>('IN_PROGRESS');
  const [responseSubmitting, setResponseSubmitting] = useState(false);

  // Cargar unidad de residente
  useEffect(() => {
    if (!user?.tenantId || !user?.email) return;
    const fetchResidentProfile = async () => {
      try {
        const snap = await getDocs(query(
          collection(db, 'residents'),
          where('tenantId', '==', user.tenantId),
          where('email', '==', user.email)
        ));
        if (!snap.empty) {
          const resData = snap.docs[0].data();
          const props = resData.properties || [];
          if (props.length > 0) {
            setResidentUnit(`${props[0].tower} - ${props[0].unit}`);
          }
        } else if (user.role === 'PORTERÍA') {
          setResidentUnit('Portería');
        }
      } catch (e) {
        console.error('Error fetching resident profile:', e);
      }
    };
    fetchResidentProfile();
  }, [user]);

  // Cargar PQRS
  const loadPqrs = useCallback(async () => {
    if (!user?.tenantId) return;
    setLoading(true);
    try {
      let q = query(
        collection(db, 'pqrs'),
        where('tenantId', '==', user.tenantId)
      );

      // Si es Residente, solo ve las suyas
      if (user.role === 'RESIDENTE') {
        q = query(
          collection(db, 'pqrs'),
          where('tenantId', '==', user.tenantId),
          where('userId', '==', user.id)
        );
      }

      const snap = await getDocs(q);
      const list: PQRSItem[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          category: data.category || 'Petición',
          title: data.title || '',
          description: data.description || '',
          status: data.status || 'PENDING',
          adminResponse: data.adminResponse || '',
          userId: data.userId || '',
          userName: data.userName || '',
          unitInfo: data.unitInfo || '',
          createdAt: data.createdAt,
          updatedAt: data.updatedAt || null,
        });
      });

      // Ordenar por fecha de creación descendente
      list.sort((a, b) => {
        const ta = a.createdAt?.seconds || 0;
        const tb = b.createdAt?.seconds || 0;
        return tb - ta;
      });

      setPqrsList(list);
    } catch (e) {
      console.error('Error loading PQRS:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadPqrs();
  }, [loadPqrs]);

  // Enviar PQRS (Residente)
  const handleCreatePqrs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.tenantId) return;

    if (!title.trim() || !description.trim()) {
      setFormError('Por favor complete todos los campos.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    setFormSuccess(false);

    try {
      await addDoc(collection(db, 'pqrs'), {
        tenantId: user.tenantId,
        category,
        title: title.trim(),
        description: description.trim(),
        status: 'PENDING',
        adminResponse: '',
        userId: user.id,
        userName: `${user.firstName} ${user.lastName}`,
        unitInfo: residentUnit,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setFormSuccess(true);
      setTitle('');
      setDescription('');
      
      // Crear notificación para Admin
      await addDoc(collection(db, 'notifications'), {
        title: `📝 Nueva PQRS - ${category}`,
        body: `Se ha registrado una nueva ${category.toLowerCase()}: "${title.trim()}" (${residentUnit}).`,
        type: 'general',
        isRead: false,
        tenantId: user.tenantId,
        receiverId: 'ALL', // O rol ADMINISTRADOR
        createdAt: serverTimestamp(),
      });

      await loadPqrs();
      setTimeout(() => {
        setIsCreateOpen(false);
        setFormSuccess(false);
      }, 1500);
    } catch (err: any) {
      setFormError(err.message || 'Error al guardar el ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  // Responder PQRS (Admin)
  const handleRespondPqrs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPqrs) return;

    setResponseSubmitting(true);
    try {
      await updateDoc(doc(db, 'pqrs', selectedPqrs.id), {
        adminResponse: adminResponseText.trim(),
        status: adminStatus,
        updatedAt: serverTimestamp(),
      });

      // Crear notificación para el residente
      await addDoc(collection(db, 'notifications'), {
        title: `💬 Respuesta a tu PQRS - ${selectedPqrs.category}`,
        body: `La administración ha respondido a tu ticket: "${selectedPqrs.title}". Estado: ${STATUS_LABELS[adminStatus]}.`,
        type: 'general',
        isRead: false,
        tenantId: user?.tenantId || '',
        receiverId: selectedPqrs.userId,
        createdAt: serverTimestamp(),
      });

      setSelectedPqrs(null);
      setAdminResponseText('');
      await loadPqrs();
    } catch (e) {
      console.error('Error responding to PQRS:', e);
      alert('Ocurrió un error al guardar la respuesta.');
    } finally {
      setResponseSubmitting(false);
    }
  };

  // Filtrado
  const filteredList = pqrsList.filter((item) => {
    const matchSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.unitInfo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.userName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchCategory = filterCategory ? item.category === filterCategory : true;
    const matchStatus = filterStatus ? item.status === filterStatus : true;

    return matchSearch && matchCategory && matchStatus;
  });

  const formatTime = (ts: any) => {
    if (!ts?.seconds) return 'Reciente';
    return new Date(ts.seconds * 1000).toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleExportPqrsCSV = () => {
    const headers = ['Categoría', 'Título', 'Descripción', 'Estado', 'Residente', 'Unidad/Apartamento', 'Respuesta de Administración', 'Fecha de Registro'];
    const rows = filteredList.map((item) => [
      item.category,
      item.title,
      item.description,
      STATUS_LABELS[item.status] || item.status,
      item.userName,
      item.unitInfo,
      item.adminResponse || 'Sin respuesta',
      item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toLocaleString('es-CO') : '—'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `pqrs_${new Date().toISOString().split('T')[0]}.csv`);
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
  };

  const isPorter = user?.role === 'PORTERÍA';
  const isAdmin = user?.role === 'ADMINISTRADOR';

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center space-x-2.5">
            <ClipboardList className="h-7 w-7 text-violet-400" />
            <span>PQRS (Peticiones, Quejas, Reclamos y Sugerencias)</span>
          </h1>
          <p className="text-xs text-zinc-500 mt-1 font-medium">
            {isAdmin 
              ? 'Atiende las solicitudes de los copropietarios e inquilinos.' 
              : 'Radica tus solicitudes y haz seguimiento al estado de respuesta.'}
          </p>
        </div>
        <div className="flex items-center space-x-3 shrink-0">
          {isAdmin && (
            <button
              onClick={handleExportPqrsCSV}
              className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl transition-colors border border-zinc-750 shadow-md"
              title="Exportar PQRS a Excel"
            >
              <Download className="h-4 w-4" />
              <span>Exportar</span>
            </button>
          )}
          {user?.role === 'RESIDENTE' && (
            <button
              onClick={() => {
                setFormError(null);
                setFormSuccess(false);
                setIsCreateOpen(true);
              }}
              className="inline-flex items-center space-x-1.5 px-4 py-2.5 text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-all shadow-lg shadow-violet-600/20"
            >
              <Plus className="h-4 w-4" />
              <span>Radicar Solicitud</span>
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="p-4 rounded-2xl border border-zinc-900 bg-zinc-900/10 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar por título, unidad..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500/80 transition-colors text-xs"
          />
        </div>
        <div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-350 focus:outline-none focus:border-violet-500/80 transition-colors text-xs"
          >
            <option value="">Todas las Categorías</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-350 focus:outline-none focus:border-violet-500/80 transition-colors text-xs"
          >
            <option value="">Todos los Estados</option>
            <option value="PENDING">Pendientes</option>
            <option value="IN_PROGRESS">En Proceso</option>
            <option value="RESOLVED">Resueltos</option>
          </select>
        </div>
      </div>

      {/* Lista de PQRS */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 text-violet-500 animate-spin mx-auto" />
            <p className="text-xs text-zinc-500">Cargando solicitudes...</p>
          </div>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="py-20 border border-dashed border-zinc-850 rounded-2xl text-center">
          <ClipboardList className="h-10 w-10 text-zinc-800 mx-auto mb-3" />
          <p className="text-sm font-semibold text-zinc-500">No se encontraron solicitudes</p>
          {user?.role === 'RESIDENTE' && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="text-xs text-violet-400 font-semibold underline mt-1.5"
            >
              Radica la primera aquí
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredList.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/10 flex flex-col md:flex-row md:items-start justify-between gap-4"
            >
              <div className="space-y-2.5 max-w-2xl">
                <div className="flex items-center flex-wrap gap-2.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-violet-500/20 text-violet-400 bg-violet-500/5">
                    {item.category}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[item.status]}`}>
                    {STATUS_LABELS[item.status]}
                  </span>
                  <span className="text-[10px] text-zinc-600 font-medium">
                    Radicado: {formatTime(item.createdAt)}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-200">{item.title}</h3>
                  <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{item.description}</p>
                </div>

                <div className="flex flex-wrap gap-4 text-[10px] text-zinc-500 font-semibold pt-1">
                  <span className="flex items-center space-x-1">
                    <Home className="h-3.5 w-3.5 text-zinc-650" />
                    <span>{item.unitInfo}</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <User className="h-3.5 w-3.5 text-zinc-650" />
                    <span>{item.userName}</span>
                  </span>
                </div>

                {/* Respuesta administrativa */}
                {item.adminResponse ? (
                  <div className="p-3.5 bg-zinc-950/60 border border-zinc-800/60 rounded-xl mt-3 space-y-1">
                    <p className="text-[10px] font-bold text-violet-400 uppercase tracking-wider">Respuesta Administración:</p>
                    <p className="text-xs text-zinc-400 leading-relaxed">{item.adminResponse}</p>
                  </div>
                ) : (
                  <p className="text-[10px] text-zinc-600 italic mt-3">Pendiente de respuesta de la administración.</p>
                )}
              </div>

              {/* Botón Responder (Admin) */}
              {(isAdmin || isPorter) && (
                <button
                  onClick={() => {
                    setSelectedPqrs(item);
                    setAdminResponseText(item.adminResponse);
                    setAdminStatus(item.status);
                  }}
                  className="shrink-0 self-start md:self-center inline-flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/80 rounded-xl transition-all"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>{isAdmin ? 'Responder' : 'Ver Detalles'}</span>
                </button>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* MODAL: RADICAR PQRS (Residente) */}
      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !submitting && setIsCreateOpen(false)}
              className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl w-full max-w-md shadow-2xl relative z-10"
            >
              <h3 className="text-sm font-bold text-zinc-100 mb-2">Radicar Solicitud (PQRS)</h3>
              <p className="text-[10px] text-zinc-500 mb-5">Será gestionada por la administración del conjunto.</p>

              {formError && (
                <div className="mb-4 p-3 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-200 text-xs flex items-center space-x-2">
                  <AlertCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="mb-4 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-200 text-xs flex items-start space-x-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">¡Solicitud radicada!</p>
                    <p className="text-zinc-400 text-[10px]">La administración la revisará a la brevedad.</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleCreatePqrs} className="space-y-4">
                <div>
                  <label className="block text-[11px] text-zinc-400 font-medium mb-1.5">Categoría *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    disabled={submitting || formSuccess}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 text-xs focus:outline-none focus:border-violet-500/70"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-zinc-400 font-medium mb-1.5">Título / Asunto *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={submitting || formSuccess}
                    placeholder="Ej: Filtración de agua en parqueadero"
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 placeholder-zinc-650 text-xs focus:outline-none focus:border-violet-500/70"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-zinc-400 font-medium mb-1.5">Descripción de la Solicitud *</label>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={submitting || formSuccess}
                    placeholder="Detalla tu requerimiento de la manera más clara posible..."
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 placeholder-zinc-650 text-xs focus:outline-none focus:border-violet-500/70 resize-none"
                    required
                  />
                </div>

                <div className="flex items-center justify-end space-x-3 pt-2 border-t border-zinc-800">
                  <button
                    type="button"
                    disabled={submitting || formSuccess}
                    onClick={() => setIsCreateOpen(false)}
                    className="px-4 py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || formSuccess}
                    className="px-4 py-2 text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-all flex items-center space-x-1.5"
                  >
                    {submitting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    <span>{submitting ? 'Radicando...' : 'Radicar Solicitud'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: RESPONDER PQRS (Admin/Porter) */}
      <AnimatePresence>
        {selectedPqrs && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !responseSubmitting && setSelectedPqrs(null)}
              className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl w-full max-w-lg shadow-2xl relative z-10"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3.5 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-zinc-100">Detalles de la Solicitud</h3>
                  <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{selectedPqrs.category} · {formatTime(selectedPqrs.createdAt)}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[selectedPqrs.status]}`}>
                  {STATUS_LABELS[selectedPqrs.status]}
                </span>
              </div>

              {/* Contenido */}
              <div className="space-y-4 overflow-y-auto max-h-[60vh] pr-1">
                <div className="p-3 bg-zinc-950/40 border border-zinc-800 rounded-xl">
                  <div className="flex items-center space-x-2 text-[10px] text-zinc-500 font-bold mb-2">
                    <User className="h-3 w-3 text-violet-400" />
                    <span>{selectedPqrs.userName} ({selectedPqrs.unitInfo})</span>
                  </div>
                  <h4 className="text-xs font-bold text-zinc-200">{selectedPqrs.title}</h4>
                  <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">{selectedPqrs.description}</p>
                </div>

                {/* Formulario de respuesta */}
                {isAdmin ? (
                  <form onSubmit={handleRespondPqrs} className="space-y-4 border-t border-zinc-800/80 pt-4">
                    <div>
                      <label className="block text-[11px] text-zinc-400 font-medium mb-1.5">Estado de la Solicitud</label>
                      <div className="grid grid-cols-3 gap-2">
                        {['PENDING', 'IN_PROGRESS', 'RESOLVED'].map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => setAdminStatus(st as any)}
                            className={`p-2 rounded-xl border text-center text-xs font-semibold transition-all ${
                              adminStatus === st
                                ? 'border-violet-500 bg-violet-600/10 text-violet-300'
                                : 'border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:border-zinc-700'
                            }`}
                          >
                            {STATUS_LABELS[st]}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] text-zinc-400 font-medium mb-1.5">Respuesta de la Administración</label>
                      <textarea
                        rows={4}
                        value={adminResponseText}
                        onChange={(e) => setAdminResponseText(e.target.value)}
                        placeholder="Escriba la respuesta o plan de acción que verá el residente..."
                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 placeholder-zinc-650 text-xs focus:outline-none focus:border-violet-500/70 resize-none"
                        required
                      />
                    </div>

                    <div className="flex items-center justify-end space-x-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setSelectedPqrs(null)}
                        className="px-4 py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        Cerrar
                      </button>
                      <button
                        type="submit"
                        disabled={responseSubmitting}
                        className="px-4 py-2 text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-all flex items-center space-x-1.5"
                      >
                        {responseSubmitting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        <span>Guardar Respuesta</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  // Portero solo puede ver
                  <div className="space-y-4 border-t border-zinc-800/80 pt-4">
                    {selectedPqrs.adminResponse ? (
                      <div className="p-3 bg-zinc-950/60 border border-zinc-800 rounded-xl">
                        <p className="text-[10px] font-bold text-violet-400 uppercase tracking-wider">Respuesta:</p>
                        <p className="text-xs text-zinc-400 leading-relaxed mt-1">{selectedPqrs.adminResponse}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500 italic">No hay respuesta registrada por la administración aún.</p>
                    )}
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setSelectedPqrs(null)}
                        className="px-4 py-2 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-all"
                      >
                        Cerrar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
