'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../lib/firebase';
import {
  doc,
  getDoc,
  updateDoc,
  addDoc,
  collection,
  query,
  orderBy,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Loader2,
  CalendarDays,
  ShieldCheck,
  FileText,
  DollarSign,
  ExternalLink,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface BillingInvoice {
  id: string;
  amount: number;
  paymentMethod: string;
  status: string;
  paidAt: any;
  expiresAt: any;
}

export default function SubscriptionPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMINISTRADOR';

  const [loading, setLoading] = useState(true);
  const [payLoading, setPayLoading] = useState(false);
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState<Date | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<'ACTIVE' | 'GRACE' | 'LOCKED'>('ACTIVE');
  const [graceDaysLeft, setGraceDaysLeft] = useState(3);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const fetchSubscriptionDetails = async () => {
    if (!user?.tenantId) return;
    setLoading(true);
    try {
      // 1. Cargar inquilino / suscripción
      const tenantDoc = await getDoc(doc(db, 'tenants', user.tenantId));
      if (tenantDoc.exists()) {
        const data = tenantDoc.data();
        if (data.subscriptionExpiresAt) {
          const expiresAt = data.subscriptionExpiresAt.toDate();
          setSubscriptionExpiresAt(expiresAt);

          const now = new Date();
          if (now <= expiresAt) {
            setSubscriptionStatus('ACTIVE');
          } else {
            const diffTime = now.getTime() - expiresAt.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays < 3) {
              setSubscriptionStatus('GRACE');
              setGraceDaysLeft(3 - diffDays);
            } else {
              setSubscriptionStatus('LOCKED');
            }
          }
        } else {
          // Asignar 30 días de prueba
          const dummyExpires = new Date();
          dummyExpires.setDate(dummyExpires.getDate() + 30);
          await updateDoc(doc(db, 'tenants', user.tenantId), {
            subscriptionExpiresAt: dummyExpires,
          });
          setSubscriptionExpiresAt(dummyExpires);
          setSubscriptionStatus('ACTIVE');
        }
      }

      // 2. Cargar facturas
      const invSnap = await getDocs(
        query(collection(db, 'tenants', user.tenantId, 'invoices'), orderBy('paidAt', 'desc'))
      );
      const list: BillingInvoice[] = [];
      invSnap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          amount: data.amount || 99900,
          paymentMethod: data.paymentMethod || 'PSE',
          status: data.status || 'PAID',
          paidAt: data.paidAt,
          expiresAt: data.expiresAt,
        });
      });
      setInvoices(list);

    } catch (err) {
      console.error('Error al cargar detalles de suscripción:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptionDetails();
  }, [user]);

  // Simular Pago PSE
  const handlePaySubscription = () => {
    window.open('https://mpago.li/1q3xUcA', '_blank');
  };

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-zinc-900 border border-zinc-800 rounded-2xl text-center space-y-4 font-sans text-zinc-100">
        <AlertCircle className="h-10 w-10 text-amber-500 mx-auto" />
        <h3 className="text-base font-bold">Acceso Denegado</h3>
        <p className="text-xs text-zinc-400">
          Esta sección de suscripción y facturación SaaS solo es accesible para cuentas con rol de administrador.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-8 font-sans text-zinc-100">

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center space-x-2.5">
          <CreditCard className="h-7 w-7 text-violet-400" />
          <span>Suscripción ResidentePro SaaS</span>
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Gestione su plan mensual y consulte el histórico de pagos del conjunto residencial.
        </p>
      </div>

      {successMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-3 rounded-2xl text-xs font-semibold">
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-455 px-4 py-3 rounded-2xl text-xs font-semibold">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* COLUMNA IZQUIERDA: Plan actual y botón de pago */}
        <div className="lg:col-span-1 space-y-6">

          <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Plan Mensual
              </span>
              <span className="text-xs font-bold text-zinc-400">Activo</span>
            </div>

            <div>
              <p className="text-3xl font-black text-zinc-100">99.900 COP<span className="text-xs text-zinc-500 font-medium">/mes</span></p>
              <p className="text-xs text-zinc-400 mt-1">Soporte premium, actualizaciones y acceso ilimitado</p>
            </div>

            <div className="space-y-2 pt-3 border-t border-zinc-850">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="flex items-center space-x-1.5">
                  <CalendarDays className="h-4 w-4 text-zinc-500" />
                  <span>Expiración:</span>
                </span>
                <span className="font-semibold text-zinc-300">
                  {loading ? 'Cargando...' : subscriptionExpiresAt ? subscriptionExpiresAt.toLocaleDateString('es-CO') : 'Trial'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Estado actual:</span>
                {subscriptionStatus === 'ACTIVE' ? (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    Suscrito
                  </span>
                ) : subscriptionStatus === 'GRACE' ? (
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full animate-pulse">
                    Mora ({graceDaysLeft}d)
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-rose-455 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
                    Suspendido
                  </span>
                )}
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <button
                onClick={handlePaySubscription}
                className="w-full bg-violet-600 hover:bg-violet-550 text-white font-bold py-3 rounded-xl text-xs shadow-lg shadow-violet-600/20 transition-all flex items-center justify-center space-x-2"
              >
                <ExternalLink className="h-4 w-4" />
                <span>Pagar con Mercado Pago</span>
              </button>
              <p className="text-[9px] text-zinc-550 text-center mt-2 leading-relaxed">
                El pago se realiza de manera segura mediante Mercado Pago. Una vez aprobado, su cuenta se activará automáticamente al regresar.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-3">
            <h4 className="font-bold text-xs">Beneficios de su Plan</h4>
            <div className="space-y-2">
              {[
                'Control de residentes e inmuebles ilimitados',
                'Visualización en vivo de novedades de portería',
                'Cálculo automático de coeficiente de votaciones',
                'Soporte técnico preferente 24/7',
              ].map((b, i) => (
                <div key={i} className="flex items-start space-x-2 text-[11px] text-zinc-400">
                  <ShieldCheck className="h-4 w-4 text-violet-400 shrink-0 mt-0.5" />
                  <span>{b}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* COLUMNA DERECHA: Histórico de Facturas */}
        <div className="lg:col-span-2 space-y-6">

          <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20">
            <h3 className="font-bold text-sm mb-4">Historial de Facturación</h3>

            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-zinc-900 animate-pulse rounded-xl" />
                ))}
              </div>
            ) : invoices.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-zinc-800 rounded-xl space-y-3">
                <FileText className="h-10 w-10 text-zinc-700 mx-auto" />
                <p className="text-xs text-zinc-550">No hay facturas registradas en esta cuenta.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {invoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="p-4 bg-zinc-950/60 rounded-xl border border-zinc-850 flex items-center justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-zinc-200">
                          {inv.amount.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          PSE / Bancolombia
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-500">
                        Período extendido hasta: {inv.expiresAt?.seconds ? new Date(inv.expiresAt.seconds * 1000).toLocaleDateString('es-CO') : 'N/A'}
                      </p>
                    </div>

                    <div className="text-right space-y-1">
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        Pago Exitoso
                      </span>
                      <p className="text-[9px] text-zinc-600 block">
                        {inv.paidAt?.seconds ? new Date(inv.paidAt.seconds * 1000).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Reciente'}
                      </p>
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
