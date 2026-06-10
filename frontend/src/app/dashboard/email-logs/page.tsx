'use client';

import React, { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../context/AuthContext';
import {
  collection,
  query,
  where,
  getDocs,
  limit,
} from 'firebase/firestore';
import {
  Mail,
  Search,
  Filter,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Info,
  Download,
  Building,
  Home,
  X,
  FileText,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface EmailLog {
  id: string;
  tenantId: string;
  toEmail: string;
  toName: string;
  subject: string;
  message: string;
  type: string;
  status: 'SUCCESS' | 'FAILED';
  sentAt: any;
  tower?: string;
  unit?: string;
  errorMessage?: string;
  messageId?: string;
}

const TYPE_LABELS: Record<string, string> = {
  package: 'Correspondencia',
  announcement: 'Comunicado',
  pqrs: 'PQRS',
  payment: 'Finanzas',
  general: 'General',
};

const TYPE_COLORS: Record<string, string> = {
  package: 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5',
  announcement: 'border-violet-500/20 text-violet-400 bg-violet-500/5',
  pqrs: 'border-amber-500/20 text-amber-400 bg-amber-500/5',
  payment: 'border-pink-500/20 text-pink-400 bg-pink-500/5',
  general: 'border-blue-500/20 text-blue-400 bg-blue-500/5',
};

export default function EmailLogsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMINISTRADOR';

  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTower, setFilterTower] = useState('');
  const [filterUnit, setFilterUnit] = useState('');

  // Log seleccionado para modal
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);

  const loadLogs = async () => {
    if (!user?.tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const q = query(
        collection(db, 'emails'),
        where('tenantId', '==', user.tenantId)
      );
      const snap = await getDocs(q);
      const list: EmailLog[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          tenantId: data.tenantId || '',
          toEmail: data.toEmail || '',
          toName: data.toName || '',
          subject: data.subject || '',
          message: data.message || '',
          type: data.type || 'general',
          status: data.status || 'SUCCESS',
          sentAt: data.sentAt,
          tower: data.tower || '',
          unit: data.unit || '',
          errorMessage: data.errorMessage || '',
          messageId: data.messageId || '',
        });
      });

      // Ordenar por fecha descendente
      list.sort((a, b) => {
        const timeA = a.sentAt?.seconds ? a.sentAt.seconds * 1000 : 0;
        const timeB = b.sentAt?.seconds ? b.sentAt.seconds * 1000 : 0;
        return timeB - timeA;
      });

      setLogs(list);
    } catch (err: any) {
      console.error('Error cargando bitácora de correos:', err);
      setError('No se pudo cargar el historial de correos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadLogs();
    }
  }, [user]);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-16 w-16 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center justify-center text-rose-455 mb-4 shadow-lg shadow-rose-900/10 animate-pulse">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-bold text-zinc-200">Acceso Denegado</h3>
        <p className="text-xs text-zinc-500 mt-2 max-w-sm">
          Esta sección es de uso exclusivo para los administradores del conjunto residencial.
        </p>
      </div>
    );
  }

  // Filtrado de logs
  const filteredLogs = logs.filter((log) => {
    const matchSearch =
      log.toEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.toName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.message.toLowerCase().includes(searchQuery.toLowerCase());

    const matchType = filterType ? log.type === filterType : true;
    const matchStatus = filterStatus ? log.status === filterStatus : true;
    const matchTower = filterTower ? log.tower?.toLowerCase().includes(filterTower.toLowerCase()) : true;
    const matchUnit = filterUnit ? log.unit?.toLowerCase().includes(filterUnit.toLowerCase()) : true;

    return matchSearch && matchType && matchStatus && matchTower && matchUnit;
  });

  const handleExportCSV = () => {
    const headers = ['Destinatario', 'Correo', 'Torre', 'Apartamento', 'Asunto', 'Tipo de Correo', 'Estado', 'Error/Mensaje ID', 'Fecha y Hora'];
    const rows = filteredLogs.map((log) => [
      log.toName,
      log.toEmail,
      log.tower || '—',
      log.unit || '—',
      log.subject,
      TYPE_LABELS[log.type] || log.type,
      log.status === 'SUCCESS' ? 'Exitoso' : 'Fallido',
      log.status === 'SUCCESS' ? log.messageId : log.errorMessage,
      log.sentAt?.seconds ? new Date(log.sentAt.seconds * 1000).toLocaleString('es-CO') : '—'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `bitacora_correos_${new Date().toISOString().split('T')[0]}.csv`);
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
  };

  const formatTime = (ts: any) => {
    if (!ts?.seconds) return 'Reciente';
    return new Date(ts.seconds * 1000).toLocaleString('es-CO', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center space-x-2.5">
            <Mail className="h-7 w-7 text-violet-400" />
            <span>Bitácora de Correos Enviados</span>
          </h1>
          <p className="text-xs text-zinc-500 mt-1 font-medium">
            Monitorea el envío de notificaciones automáticas y correspondencia en tiempo real.
          </p>
        </div>
        <div>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl transition-all border border-zinc-750 shadow-md"
            title="Exportar bitácora a Excel"
          >
            <Download className="h-4 w-4" />
            <span>Exportar Bitácora</span>
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="p-4 rounded-2xl border border-zinc-900 bg-zinc-900/10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar destinatario, asunto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500/80 transition-colors text-xs"
          />
        </div>
        <div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-350 focus:outline-none focus:border-violet-500/80 transition-colors text-xs"
          >
            <option value="">Todos los Tipos</option>
            {Object.entries(TYPE_LABELS).map(([key, val]) => (
              <option key={key} value={key}>{val}</option>
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
            <option value="SUCCESS">Exitosos</option>
            <option value="FAILED">Fallidos</option>
          </select>
        </div>
        <div className="relative">
          <Building className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Torre (Ej: 2)"
            value={filterTower}
            onChange={(e) => setFilterTower(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500/80 transition-colors text-xs"
          />
        </div>
        <div className="relative">
          <Home className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Apto (Ej: 402)"
            value={filterUnit}
            onChange={(e) => setFilterUnit(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500/80 transition-colors text-xs"
          />
        </div>
      </div>

      {/* Mensaje de Error global */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-455 px-4 py-3 rounded-xl flex items-center space-x-2 text-xs">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabla de logs */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 text-violet-500 animate-spin mx-auto" />
            <p className="text-xs text-zinc-500 font-medium">Cargando bitácora de correos...</p>
          </div>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="py-20 border border-dashed border-zinc-850 rounded-2xl text-center">
          <Mail className="h-10 w-10 text-zinc-800 mx-auto mb-3" />
          <p className="text-sm font-semibold text-zinc-500">No se encontraron registros de envío</p>
          <p className="text-[10px] text-zinc-650 mt-1">
            Los envíos automáticos y comunicados se irán registrando en este listado.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-900 bg-zinc-900/5">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-850 bg-zinc-900/40 text-zinc-400 font-semibold">
                <th className="p-4">Destinatario</th>
                <th className="p-4">Ubicación</th>
                <th className="p-4">Asunto</th>
                <th className="p-4">Tipo</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Fecha</th>
                <th className="p-4 text-center">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-850/60">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-zinc-900/30 transition-colors">
                  <td className="p-4">
                    <div className="font-semibold text-zinc-200">{log.toName || '—'}</div>
                    <div className="text-[10px] text-zinc-500 font-mono mt-0.5">{log.toEmail}</div>
                  </td>
                  <td className="p-4">
                    {log.tower || log.unit ? (
                      <span className="inline-flex items-center space-x-1 text-zinc-300 font-medium bg-zinc-800/40 px-2 py-0.5 rounded border border-zinc-800">
                        <span>T{log.tower || '—'}</span>
                        <span className="text-zinc-600">•</span>
                        <span>A{log.unit || '—'}</span>
                      </span>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="p-4 max-w-xs truncate font-medium text-zinc-300">
                    {log.subject}
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${TYPE_COLORS[log.type] || TYPE_COLORS.general}`}>
                      {TYPE_LABELS[log.type] || log.type}
                    </span>
                  </td>
                  <td className="p-4">
                    {log.status === 'SUCCESS' ? (
                      <span className="inline-flex items-center space-x-1.5 text-emerald-450 font-bold bg-emerald-500/5 px-2.5 py-0.5 rounded-full border border-emerald-500/10">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Enviado</span>
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center space-x-1.5 text-rose-455 font-bold bg-rose-500/5 px-2.5 py-0.5 rounded-full border border-rose-500/10 cursor-help"
                        title={log.errorMessage || 'Error en el envío'}
                      >
                        <XCircle className="h-3 w-3" />
                        <span>Fallido</span>
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-zinc-500 font-medium">
                    {formatTime(log.sentAt)}
                  </td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors inline-flex"
                      title="Ver contenido del correo"
                    >
                      <Info className="h-4.5 w-4.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL: DETALLES DE CORREO */}
      <AnimatePresence>
        {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center space-x-2.5 text-violet-400">
                  <FileText className="h-5.5 w-5.5" />
                  <h3 className="text-base font-bold text-zinc-100">Contenido de la Notificación</h3>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-xl transition-all"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-zinc-950/50 p-4 rounded-xl border border-zinc-800/40">
                <div className="space-y-1.5">
                  <div className="text-zinc-500 font-medium">Para:</div>
                  <div className="text-zinc-200 font-semibold">{selectedLog.toName}</div>
                  <div className="text-zinc-500 font-mono text-[10px]">{selectedLog.toEmail}</div>
                </div>
                <div className="space-y-1.5">
                  <div className="text-zinc-500 font-medium">Ubicación & Tipo:</div>
                  <div className="text-zinc-200 font-semibold">
                    {selectedLog.tower || selectedLog.unit ? `Torre ${selectedLog.tower || '—'} - Apto ${selectedLog.unit || '—'}` : 'Sin unidad (Admin/Portería)'}
                  </div>
                  <div className="mt-1">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border ${TYPE_COLORS[selectedLog.type] || TYPE_COLORS.general}`}>
                      {TYPE_LABELS[selectedLog.type] || selectedLog.type}
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5 sm:col-span-2 border-t border-zinc-800/60 pt-3">
                  <div className="text-zinc-500 font-medium">Asunto:</div>
                  <div className="text-zinc-200 font-bold text-sm">{selectedLog.subject}</div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-xs text-zinc-500 font-medium">Cuerpo del Mensaje:</div>
                <div className="bg-zinc-950 border border-zinc-850 rounded-xl p-4 max-h-60 overflow-y-auto text-xs text-zinc-300 leading-relaxed font-normal whitespace-pre-line">
                  {selectedLog.message || '(Sin mensaje adicional)'}
                </div>
              </div>

              {/* Estado de Entrega detallado */}
              <div className="text-xs bg-zinc-950/50 p-3.5 rounded-xl border border-zinc-850/60">
                {selectedLog.status === 'SUCCESS' ? (
                  <div className="flex items-start space-x-2 text-emerald-450">
                    <CheckCircle2 className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Enviado con éxito.</span>
                      <div className="text-[10px] text-zinc-500 font-mono mt-1 select-all">Gmail API ID: {selectedLog.messageId || '—'}</div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start space-x-2 text-rose-455">
                    <XCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Error de envío en la cola de Render/Gmail.</span>
                      <div className="text-xs text-rose-350 bg-rose-500/5 p-2 rounded-lg border border-rose-500/10 mt-1.5 font-normal leading-normal whitespace-pre-wrap select-all">
                        {selectedLog.errorMessage || 'Sin mensaje de error reportado.'}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2 border-t border-zinc-800">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold px-4 py-2 rounded-xl text-xs transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
