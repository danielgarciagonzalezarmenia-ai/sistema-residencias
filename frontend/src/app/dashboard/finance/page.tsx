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
  Eye,
  X,
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
  attachmentUrl?: string;
  createdAt: any;
  paymentMonth?: string;
  paymentYear?: string;
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
  const [reportAttachment, setReportAttachment] = useState<string>('');
  const [selectedAttachmentUrl, setSelectedAttachmentUrl] = useState<string | null>(null);
  const [adminFee, setAdminFee] = useState<number>(250000);
  const [newAdminFee, setNewAdminFee] = useState<number>(250000);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [reportMonth, setReportMonth] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [reportYear, setReportYear] = useState('');
  const [filterYear, setFilterYear] = useState('');

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
        const fee = settingsDoc.data().adminFee || 250000;
        setAdminFee(fee);
        setNewAdminFee(fee);
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
          attachmentUrl: data.attachmentUrl || '',
          createdAt: data.createdAt,
          paymentMonth: data.paymentMonth || '',
          paymentYear: data.paymentYear || '',
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
        adminFee: Number(newAdminFee),
      }, { merge: true });
      setPseLink(newPseLink);
      setAdminFee(Number(newAdminFee));
      setSuccessMessage('Enlace de PSE actualizado exitosamente.');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setErrorMessage('Error al guardar el enlace.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        setErrorMessage('El archivo no debe superar los 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setReportAttachment(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setReportAttachment('');
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
        attachmentUrl: reportAttachment,
        paymentMonth: reportMonth,
        paymentYear: reportYear,
        createdAt: serverTimestamp(),
      });

      setSuccessMessage('Pago reportado exitosamente. Esperando aprobación.');
      setReportAttachment('');
      setReportAmount('');
      setReportReference('');
      setReportNotes('');
      setReportMonth('');
      setReportYear('');
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

  const getFallbackMonth = (createdAt: any) => {
    if (!createdAt) return 'Enero';
    const date = createdAt.seconds ? new Date(createdAt.seconds * 1000) : new Date(createdAt);
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return months[date.getMonth()];
  };

  const getFallbackYear = (createdAt: any) => {
    if (!createdAt) return new Date().getFullYear().toString();
    const date = createdAt.seconds ? new Date(createdAt.seconds * 1000) : new Date(createdAt);
    return date.getFullYear().toString();
  };

  const filteredPayments = payments.filter((pay) => {
    const monthMatch = !filterMonth || (pay.paymentMonth || getFallbackMonth(pay.createdAt)) === filterMonth;
    const yearMatch = !filterYear || (pay.paymentYear || getFallbackYear(pay.createdAt)) === filterYear;
    return monthMatch && yearMatch;
  });

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

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                    Valor Cuota Administración (COP)
                  </label>
                  <input
                    type="number"
                    value={newAdminFee}
                    onChange={(e) => setNewAdminFee(Number(e.target.value))}
                    placeholder="Ej. 250000"
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
                  Próxima cuota de administración sugerida: {adminFee.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}.
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

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                        Mes a Pagar *
                      </label>
                      <select
                        value={reportMonth}
                        onChange={(e) => setReportMonth(e.target.value)}
                        required
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-200 focus:outline-none focus:border-violet-500/50 transition-all cursor-pointer"
                      >
                        <option value="" disabled>Seleccione</option>
                        <option value="Enero">Enero</option>
                        <option value="Febrero">Febrero</option>
                        <option value="Marzo">Marzo</option>
                        <option value="Abril">Abril</option>
                        <option value="Mayo">Mayo</option>
                        <option value="Junio">Junio</option>
                        <option value="Julio">Julio</option>
                        <option value="Agosto">Agosto</option>
                        <option value="Septiembre">Septiembre</option>
                        <option value="Octubre">Octubre</option>
                        <option value="Noviembre">Noviembre</option>
                        <option value="Diciembre">Diciembre</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                        Año a Pagar *
                      </label>
                      <select
                        value={reportYear}
                        onChange={(e) => setReportYear(e.target.value)}
                        required
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-200 focus:outline-none focus:border-violet-500/50 transition-all cursor-pointer"
                      >
                        <option value="" disabled>Seleccione</option>
                        {Array.from({ length: 6 }, (_, i) => {
                          const year = (2025 + i).toString();
                          return (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          );
                        })}
                      </select>
                    </div>
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

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                      Comprobante / Captura (Max 2MB)
                    </label>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleFileChange}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-200 focus:outline-none focus:border-violet-500/50 transition-all file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-[10px] file:font-bold file:bg-violet-500/20 file:text-violet-400 hover:file:bg-violet-500/30"
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <h3 className="font-bold text-sm">
                {isAdmin ? 'Historial e Ingresos Reportados' : 'Mis Pagos Registrados'}
              </h3>

              <div className="flex items-center space-x-2 flex-wrap gap-2">
                <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Filtrar:</span>
                <select
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-violet-500/50 transition-all cursor-pointer"
                >
                  <option value="">Todos los Meses</option>
                  <option value="Enero">Enero</option>
                  <option value="Febrero">Febrero</option>
                  <option value="Marzo">Marzo</option>
                  <option value="Abril">Abril</option>
                  <option value="Mayo">Mayo</option>
                  <option value="Junio">Junio</option>
                  <option value="Julio">Julio</option>
                  <option value="Agosto">Agosto</option>
                  <option value="Septiembre">Septiembre</option>
                  <option value="Octubre">Octubre</option>
                  <option value="Noviembre">Noviembre</option>
                  <option value="Diciembre">Diciembre</option>
                </select>

                <select
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-violet-500/50 transition-all cursor-pointer"
                >
                  <option value="">Todos los Años</option>
                  {Array.from({ length: 6 }, (_, i) => {
                    const year = (2025 + i).toString();
                    return (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-20 bg-zinc-900/60 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : filteredPayments.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-zinc-800 rounded-xl space-y-3">
                <FileText className="h-10 w-10 text-zinc-700 mx-auto" />
                <p className="text-xs text-zinc-500 font-medium">No se han registrado reportes de pagos para este mes.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPayments.map((pay) => (
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
                        <span className="text-[9px] font-bold bg-violet-500/10 border border-violet-500/20 px-1.5 py-0.5 rounded-full text-violet-400">
                          Período: {pay.paymentMonth || getFallbackMonth(pay.createdAt)} {pay.paymentYear || getFallbackYear(pay.createdAt)}
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

                      {pay.attachmentUrl && (
                        <button
                          onClick={() => setSelectedAttachmentUrl(pay.attachmentUrl!)}
                          className="text-[10px] text-violet-400 hover:text-violet-300 font-bold flex items-center space-x-1"
                        >
                          <Eye className="h-3 w-3" />
                          <span>Ver Comprobante</span>
                        </button>
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

      {/* Modal para ver captura */}
      <AnimatePresence>
        {selectedAttachmentUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl p-4 w-full max-w-2xl relative shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <button
                onClick={() => setSelectedAttachmentUrl(null)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white bg-zinc-800/50 hover:bg-zinc-700/50 p-2 rounded-full transition-all z-10"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="mb-4 shrink-0">
                <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-violet-400" />
                  <span>Comprobante Adjunto</span>
                </h3>
              </div>
              <div className="flex justify-center bg-zinc-950 rounded-xl overflow-auto flex-1 p-2">
                {selectedAttachmentUrl.startsWith('data:application/pdf') ? (
                  <iframe src={selectedAttachmentUrl} className="w-full h-full min-h-[50vh] rounded-xl" title="Comprobante PDF" />
                ) : (
                  <img src={selectedAttachmentUrl} alt="Comprobante de pago" className="max-w-full h-auto object-contain" />
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
