'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
  orderBy,
} from 'firebase/firestore';
import {
  TrendingUp,
  CreditCard,
  DollarSign,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Plus,
  Loader2,
  Settings,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PaymentReport {
  id: string;
  residentName: string;
  residentEmail: string;
  unit: string;
  tower: string;
  amount: number;
  reference: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  notes?: string;
  createdAt: any;
}

export default function FinancePage() {
  const { user, activeRole } = useAuth();
  const currentRole = activeRole || user?.role || '';
  const isAdmin = currentRole === 'ADMINISTRADOR';

  const [pseLink, setPseLink] = useState('');
  const [newPseLink, setNewPseLink] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [payments, setPayments] = useState<PaymentReport[]>([]);

  // Resident Form state
  const [reportAmount, setReportAmount] = useState('');
  const [reportReference, setReportReference] = useState('');
  const [reportNotes, setReportNotes] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Cargar datos
  const fetchData = async () => {
    if (!user?.tenantId) return;
    setLoading(true);
    try {
      // 1. Cargar link de PSE del Conjunto
      const settingsDoc = await getDoc(doc(db, 'tenants', user.tenantId, 'settings', 'finance'));
      if (settingsDoc.exists()) {
        const link = settingsDoc.data().pseLink || '';
        setPseLink(link);
        setNewPseLink(link);
      }

      // 2. Cargar reportes de pagos
      let q;
      if (isAdmin) {
        // El admin ve todos los pagos del conjunto
        q = query(
          collection(db, 'tenants', user.tenantId, 'payments'),
          orderBy('createdAt', 'desc')
        );
      } else {
        // El residente solo ve sus propios pagos
        q = query(
          collection(db, 'tenants', user.tenantId, 'payments'),
          where('residentEmail', '==', user.email),
          orderBy('createdAt', 'desc')
        );
      }

      const snap = await getDocs(q);
      const list: PaymentReport[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          residentName: data.residentName || '',
          residentEmail: data.residentEmail || '',
          unit: data.unit || '',
          tower: data.tower || '',
          amount: Number(data.amount) || 0,
          reference: data.reference || '',
          status: data.status || 'PENDING',
          notes: data.notes || '',
          createdAt: data.createdAt,
        });
      });
      setPayments(list);
    } catch (e) {
      console.error('Error cargando finanzas:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user, currentRole]);

  // Actualizar link de PSE
  const handleSavePse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.tenantId) return;
    setActionLoading(true);
    try {
      await setDoc(doc(db, 'tenants', user.tenantId, 'settings', 'finance'), {
        pseLink: newPseLink,
      }, { merge: true });
      setPseLink(newPseLink);
      setSuccessMessage('Enlace de PSE actualizado exitosamente.');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setErrorMessage('Error al guardar el enlace.');
    } finally {
      setActionLoading(false);
    }
  };

  // Reportar un pago (Resident)
  const handleReportPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.tenantId) return;
    setActionLoading(true);
    setErrorMessage('');
    try {
      // Intentar obtener el inmueble de este residente
      let resTower = 'N/A';
      let resUnit = 'N/A';
      const resSnap = await getDocs(query(collection(db, 'residents'), where('email', '==', user.email), where('tenantId', '==', user.tenantId)));
      if (!resSnap.empty) {
        const resData = resSnap.docs[0].data();
        if (resData.properties && resData.properties.length > 0) {
          resTower = resData.properties[0].tower;
          resUnit = resData.properties[0].unit;
        }
      }

      await addDoc(collection(db, 'tenants', user.tenantId, 'payments'), {
        residentName: `${user.firstName} ${user.lastName}`,
        residentEmail: user.email,
        unit: resUnit,
        tower: resTower,
        amount: Number(reportAmount),
        reference: reportReference,
        status: 'PENDING',
        notes: reportNotes,
        createdAt: serverTimestamp(),
      });

      setSuccessMessage('Pago reportado exitosamente. Esperando aprobación.');
      setReportAmount('');
      setReportReference('');
      setReportNotes('');
      fetchData();
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      console.error(err);
      setErrorMessage('Error al reportar el pago.');
    } finally {
      setActionLoading(false);
    }
  };

  // Aprobación o Rechazo (Admin)
  const handleProcessPayment = async (payId: string, status: 'APPROVED' | 'REJECTED') => {
    if (!user?.tenantId) return;
    setActionLoading(true);
    try {
      await updateDoc(doc(db, 'tenants', user.tenantId, 'payments', payId), {
        status,
      });
      setPayments((prev) =>
        prev.map((p) => (p.id === payId ? { ...p, status } : p))
      );

      // Crear notificación para el residente
      const payObj = payments.find(p => p.id === payId);
      if (payObj) {
        // Encontrar uid del residente
        const userSnap = await getDocs(query(collection(db, 'users'), where('email', '==', payObj.residentEmail)));
        if (!userSnap.empty) {
          const resUid = userSnap.docs[0].id;
          await addDoc(collection(db, 'notifications'), {
            title: status === 'APPROVED' ? 'Pago Aprobado ✅' : 'Pago Rechazado ❌',
            body: `Su reporte de pago por ${payObj.amount.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })} (Ref: ${payObj.reference}) ha sido ${status === 'APPROVED' ? 'aprobado por administración' : 'rechazado. Por favor, verifique los datos o contacte a administración'}.`,
            type: 'finance',
            isRead: false,
            tenantId: user.tenantId,
            receiverId: resUid,
            createdAt: serverTimestamp(),
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-8 font-sans text-zinc-100">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center space-x-2">
          <TrendingUp className="h-7 w-7 text-violet-400" />
          <span>Finanzas & Administración</span>
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          {isAdmin 
            ? 'Gestión de pagos de administración, reconciliaciones y configuración de PSE' 
            : 'Consulte su estado de cuenta, pague sus cuotas y reporte sus comprobantes de pago'}
        </p>
      </div>

      {successMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-3 rounded-2xl text-xs font-semibold">
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-2xl text-xs font-semibold">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* COLUMNA IZQUIERDA: Configuración (Admin) o Estado y Form (Residente) */}
        <div className="lg:col-span-1 space-y-6">

          {/* ADMIN: Configurar PSE */}
          {isAdmin ? (
            <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 space-y-4">
              <div className="flex items-center space-x-2 text-violet-400">
                <Settings className="h-5 w-5" />
                <h3 className="font-bold text-sm">Configuración de Pagos</h3>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Configure el enlace de recaudo personalizado de PSE del conjunto residencial (ej. link de PayCo, Mercadopago o Wompi). Los residentes verán este botón para pagar en línea.
              </p>
              
              <form onSubmit={handleSavePse} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                    Link de PSE / Pasarela
                  </label>
                  <input
                    type="url"
                    value={newPseLink}
                    onChange={(e) => setNewPseLink(e.target.value)}
                    placeholder="https://pse.pagos.com/mi-conjunto"
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-200 focus:outline-none focus:border-violet-500/50 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full bg-violet-600 hover:bg-violet-505 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs shadow-lg shadow-violet-600/20 transition-all flex items-center justify-center space-x-1.5"
                >
                  {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Guardar Configuración</span>
                </button>
              </form>
            </div>
          ) : (
            // RESIDENTE: Estado de cuenta y Pagar
            <>
              <div className="p-5 rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-600/10 to-zinc-950 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                  <CreditCard className="h-20 w-20 text-violet-400" />
                </div>
                <div className="flex items-center space-x-2 text-violet-400 mb-2">
                  <DollarSign className="h-5 w-5" />
                  <span className="text-xs font-bold uppercase tracking-wider">Estado de Cuenta</span>
                </div>
                <p className="text-2xl font-bold text-zinc-150">Al Día</p>
                <p className="text-[10px] text-zinc-500 mt-1.5 leading-relaxed">
                  Próxima cuota de administración sugerida: $250.000 COP.
                </p>

                <div className="mt-5">
                  {pseLink ? (
                    <a
                      href={pseLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-violet-600 hover:bg-violet-550 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center space-x-1.5 shadow-lg shadow-violet-600/20"
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span>Ir a Pagar por PSE</span>
                    </a>
                  ) : (
                    <div className="bg-zinc-950/60 border border-zinc-800 p-3 rounded-xl flex items-start space-x-2">
                      <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <span className="text-[10px] text-zinc-500 leading-normal">
                        La administración aún no ha configurado el botón de pago PSE. Puede reportar su pago por transferencia abajo.
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Formulario Reportar Comprobante */}
              <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 space-y-4">
                <div className="flex items-center space-x-2 text-violet-400">
                  <Plus className="h-5 w-5" />
                  <h3 className="font-bold text-sm">Reportar Transferencia / Pago</h3>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Si realizó una transferencia bancaria o pago PSE manual, registre los datos aquí para su aprobación.
                </p>

                <form onSubmit={handleReportPayment} className="space-y-3.5">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                      Monto Pagado (COP)
                    </label>
                    <input
                      type="number"
                      value={reportAmount}
                      onChange={(e) => setReportAmount(e.target.value)}
                      placeholder="Ej. 250000"
                      required
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-200 focus:outline-none focus:border-violet-500/50 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                      Referencia o Número de Transacción
                    </label>
                    <input
                      type="text"
                      value={reportReference}
                      onChange={(e) => setReportReference(e.target.value)}
                      placeholder="Ej. TRANS-849202"
                      required
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-200 focus:outline-none focus:border-violet-500/50 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                      Notas / Comentarios
                    </label>
                    <textarea
                      value={reportNotes}
                      onChange={(e) => setReportNotes(e.target.value)}
                      placeholder="Ej. Pago correspondiente al mes de Junio"
                      rows={2}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-200 focus:outline-none focus:border-violet-500/50 transition-all resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="w-full bg-violet-600 hover:bg-violet-550 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center space-x-1.5"
                  >
                    {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>Reportar Pago</span>
                  </button>
                </form>
              </div>
            </>
          )}

        </div>

        {/* COLUMNA DERECHA: Listado de Reportes */}
        <div className="lg:col-span-2 space-y-6">

          <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20">
            <h3 className="font-bold text-sm mb-4">
              {isAdmin ? 'Historial e Ingresos Reportados' : 'Mis Pagos Registrados'}
            </h3>

            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-20 bg-zinc-900/60 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : payments.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-zinc-800 rounded-xl space-y-3">
                <FileText className="h-10 w-10 text-zinc-700 mx-auto" />
                <p className="text-xs text-zinc-500 font-medium">No se han registrado reportes de pagos aún.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {payments.map((pay) => (
                  <div
                    key={pay.id}
                    className="p-4 bg-zinc-950/60 rounded-xl border border-zinc-800/60 hover:border-zinc-700/60 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span className="text-xs font-bold text-zinc-100">
                          {pay.amount.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          Ref: {pay.reference}
                        </span>
                        {isAdmin && (
                          <span className="text-[9px] font-bold bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded-full text-zinc-400">
                            {pay.tower} - {pay.unit}
                          </span>
                        )}
                      </div>

                      {isAdmin && (
                        <p className="text-[11px] text-zinc-400 font-medium truncate">
                          Reportado por: {pay.residentName}
                        </p>
                      )}

                      {pay.notes && (
                        <p className="text-[10px] text-zinc-500 italic">
                          &ldquo;{pay.notes}&rdquo;
                        </p>
                      )}

                      <span className="text-[9px] text-zinc-600 block">
                        {pay.createdAt?.seconds
                          ? new Date(pay.createdAt.seconds * 1000).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                          : 'Reciente'}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      {pay.status === 'PENDING' ? (
                        isAdmin ? (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleProcessPayment(pay.id, 'APPROVED')}
                              disabled={actionLoading}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-[10px] transition-all flex items-center space-x-1"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Aprobar</span>
                            </button>
                            <button
                              onClick={() => handleProcessPayment(pay.id, 'REJECTED')}
                              disabled={actionLoading}
                              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-[10px] transition-all flex items-center space-x-1"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              <span>Rechazar</span>
                            </button>
                          </div>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400">
                            <Clock className="h-3 w-3 animate-pulse" />
                            <span>Pendiente</span>
                          </span>
                        )
                      ) : pay.status === 'APPROVED' ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Aprobado</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 border border-rose-500/20 text-rose-455">
                          <XCircle className="h-3 w-3" />
                          <span>Rechazado</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
