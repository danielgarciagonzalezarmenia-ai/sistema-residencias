'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Settings, Mail, Eye, EyeOff, CheckCircle2, AlertTriangle, AlertCircle, Loader2, Shield, Send, Building, MapPin, Phone, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMINISTRADOR';

  // Configuración del Conjunto
  const [condoName, setCondoName] = useState('');
  const [condoNit, setCondoNit] = useState('');
  const [condoAddress, setCondoAddress] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [condoPhone, setCondoPhone] = useState('');

  // PIN de Seguridad de Portería
  const [pinCode, setPinCode] = useState('');
  const [showPin, setShowPin] = useState(false);

  // Estados de carga y feedback
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Enviar Correo de Prueba
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://notificaciones-residentepro2.onrender.com';

  // Cargar configuración existente
  useEffect(() => {
    if (!user?.tenantId || !user?.id) return;
    const loadConfig = async () => {
      try {
        const [tenantSnap, userSnap] = await Promise.all([
          getDoc(doc(db, 'tenants', user.tenantId)),
          getDoc(doc(db, 'users', user.id))
        ]);

        if (tenantSnap.exists()) {
          const tData = tenantSnap.data();
          setCondoName(tData.name || '');
          setCondoNit(tData.nit || '');
          setCondoAddress(tData.address || '');
          setContactEmail(tData.smtpEmail || ''); // Almacenado como smtpEmail para compatibilidad con Reply-To del backend
          setCondoPhone(tData.phone || '');
        }

        if (userSnap.exists()) {
          const uData = userSnap.data();
          setPinCode(uData.adminSwitchPassword || '');
        }
      } catch (e) {
        console.error('Error cargando configuración:', e);
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.tenantId || !user?.id) return;

    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      if (!condoName.trim() || !condoAddress.trim()) {
        throw new Error('El nombre y la dirección de su conjunto son obligatorios.');
      }

      if (pinCode && !/^\d{4}$/.test(pinCode)) {
        throw new Error('El PIN de seguridad para conmutación de paneles debe ser exactamente de 4 dígitos numéricos.');
      }

      // 1. Actualizar datos de Copropiedad en Colección Tenants
      await updateDoc(doc(db, 'tenants', user.tenantId), {
        name: condoName.trim(),
        nit: condoNit.trim() || 'S.N.',
        address: condoAddress.trim(),
        smtpEmail: contactEmail.trim(), // Almacenado en smtpEmail
        phone: condoPhone.trim(),
      });

      // 2. Actualizar PIN de Seguridad en Colección Users
      await updateDoc(doc(db, 'users', user.id), {
        adminSwitchPassword: pinCode ? pinCode.trim() : null,
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err: any) {
      setError(err.message || 'Error al guardar la configuración.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail || !user?.tenantId) return;
    setTesting(true);
    setTestResult(null);

    try {
      const response = await fetch(`${BACKEND_URL}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: user.tenantId,
          recipientEmail: testEmail.trim(),
          subject: '✅ Prueba de Notificaciones — ResidentePro',
          body: `¡Hola!\n\nEste es un correo de prueba enviado desde ResidentePro para verificar que el sistema centralizado de notificaciones de tu copropiedad está funcionando correctamente.\n\nSi los residentes responden a este mensaje, la respuesta se enviará al correo de contacto configurado: ${contactEmail || 'No asignado'}.\n\nAtentamente,\nSoporte ResidentePro`,
          type: 'general',
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setTestResult({ success: true, message: `¡Correo enviado exitosamente a ${testEmail}! Revisa la bandeja de entrada.` });
      } else {
        setTestResult({ success: false, message: data.error || 'Error al enviar el correo de prueba.' });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: 'No se pudo conectar con el servidor. Intenta más tarde.' });
    } finally {
      setTesting(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-zinc-900 border border-zinc-800 rounded-2xl text-center space-y-4 font-sans text-zinc-100">
        <AlertCircle className="h-10 w-10 text-amber-500 mx-auto" />
        <h3 className="text-base font-bold">Acceso Denegado</h3>
        <p className="text-xs text-zinc-400">
          Esta sección de configuración solo es accesible para cuentas con rol de administrador.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-64 flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 text-violet-500 animate-spin mb-3" />
        <p className="text-xs text-zinc-500">Cargando configuración...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 font-sans text-zinc-100">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
            <Settings className="h-5 w-5 text-violet-400" />
          </div>
          Configuración General
        </h1>
        <p className="text-sm text-zinc-500 mt-2">
          Administre la información pública de la copropiedad y los parámetros de acceso y seguridad.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* SECCIÓN 1: Datos del Conjunto */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl"
        >
          <div className="px-6 py-5 border-b border-zinc-800 flex items-center gap-3 bg-zinc-950/20">
            <div className="h-9 w-9 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <Building className="h-4.5 w-4.5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100">Datos de la Copropiedad</h2>
              <p className="text-xs text-zinc-550">Información del conjunto residencial o edificio</p>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-450 mb-1.5 flex items-center gap-1.5">
                  <Building className="h-3.5 w-3.5 text-zinc-500" />
                  Nombre del Conjunto *
                </label>
                <input
                  type="text"
                  value={condoName}
                  onChange={(e) => setCondoName(e.target.value)}
                  placeholder="Ej. Torres del Parque"
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4.5 py-2.5 text-xs text-zinc-200 placeholder-zinc-650 focus:outline-none focus:border-violet-500/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-450 mb-1.5 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-zinc-500" />
                  NIT de la Copropiedad
                </label>
                <input
                  type="text"
                  value={condoNit}
                  onChange={(e) => setCondoNit(e.target.value)}
                  placeholder="Ej. 900.123.456-7"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4.5 py-2.5 text-xs text-zinc-200 placeholder-zinc-650 focus:outline-none focus:border-violet-500/50 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-450 mb-1.5 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-zinc-500" />
                Dirección Física *
              </label>
              <input
                type="text"
                value={condoAddress}
                onChange={(e) => setCondoAddress(e.target.value)}
                placeholder="Ej. Calle 123 # 45 - 67"
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4.5 py-2.5 text-xs text-zinc-200 placeholder-zinc-655 focus:outline-none focus:border-violet-500/50 transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-455 mb-1.5 flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-zinc-500" />
                  Correo de Contacto (Para Respuestas)
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="administracion@correo.com"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4.5 py-2.5 text-xs text-zinc-200 placeholder-zinc-650 focus:outline-none focus:border-violet-500/50 transition-all"
                />
                <p className="text-[9px] text-zinc-600 mt-1">
                  Dirección donde llegarán las respuestas de los residentes a los correos automáticos.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-455 mb-1.5 flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-zinc-500" />
                  Teléfono de Administración
                </label>
                <input
                  type="tel"
                  value={condoPhone}
                  onChange={(e) => setCondoPhone(e.target.value)}
                  placeholder="Ej. +57 300 123 4567"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4.5 py-2.5 text-xs text-zinc-200 placeholder-zinc-650 focus:outline-none focus:border-violet-500/50 transition-all"
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* SECCIÓN 2: Seguridad y PIN de Portería */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl"
        >
          <div className="px-6 py-5 border-b border-zinc-800 flex items-center gap-3 bg-zinc-950/20">
            <div className="h-9 w-9 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <Shield className="h-4.5 w-4.5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100">Seguridad & PIN de Portero</h2>
              <p className="text-xs text-zinc-550">Contraseña rápida para alternar entre paneles administrativos</p>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div className="bg-violet-500/5 border border-violet-500/10 rounded-xl p-4 flex items-start gap-3">
              <Shield className="h-5 w-5 text-violet-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-violet-300">¿Para qué sirve el PIN?</p>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Para alternar del panel de Administrador al panel de Portería sin cerrar sesión, o para desbloquear funciones protegidas. 
                  Debe constar de exactamente <strong className="text-zinc-300">4 dígitos numéricos</strong> (Ej. 1234).
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-450 mb-1.5">
                PIN de Seguridad de 4 dígitos
              </label>
              <div className="relative max-w-xs">
                <input
                  type={showPin ? 'text' : 'password'}
                  maxLength={4}
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="0000"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 pr-12 text-sm text-zinc-200 placeholder-zinc-650 focus:outline-none focus:border-violet-500/50 transition-all font-mono tracking-widest text-center"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-550 hover:text-zinc-350 transition-colors"
                >
                  {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Notificaciones de Éxito / Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-2.5 rounded-xl text-xs font-semibold"
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </motion.div>
          )}
          {success && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-2.5 rounded-xl text-xs font-semibold"
            >
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              ¡Configuración guardada exitosamente!
            </motion.div>
          )}
        </AnimatePresence>

        {/* Botón de Guardado */}
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-violet-600 hover:bg-violet-550 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-xs shadow-lg shadow-violet-600/20 transition-all flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          <span>{saving ? 'Guardando Ajustes...' : 'Guardar Todos los Ajustes'}</span>
        </button>
      </form>

      {/* SECCIÓN 3: Herramienta de Prueba de Correo */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl"
      >
        <div className="px-6 py-5 border-b border-zinc-800 flex items-center gap-3 bg-zinc-950/20">
          <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Send className="h-4.5 w-4.5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-100">Prueba de Entrega de Notificaciones</h2>
            <p className="text-xs text-zinc-550">Verifique el funcionamiento del servidor de correos con su conjunto</p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-450 mb-1.5">
              Correo de destino para la prueba
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="tu-correo-personal@gmail.com"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 placeholder-zinc-650 focus:outline-none focus:border-violet-500/50 transition-all"
              />
              <button
                onClick={handleTestEmail}
                disabled={testing || !testEmail.trim()}
                className="sm:w-56 bg-amber-600 hover:bg-amber-550 disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2"
              >
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span>{testing ? 'Enviando...' : 'Enviar Correo'}</span>
              </button>
            </div>
          </div>

          <AnimatePresence>
            {testResult && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold ${
                  testResult.success
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                    : 'bg-rose-500/10 border border-rose-500/20 text-rose-455'
                }`}
              >
                {testResult.success ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
                <span>{testResult.message}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
