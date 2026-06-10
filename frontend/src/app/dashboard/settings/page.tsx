'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Settings, Mail, Eye, EyeOff, CheckCircle2, AlertTriangle, Loader2, Shield, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SettingsPage() {
  const { user } = useAuth();

  // SMTP Config
  const [smtpEmail, setSmtpEmail] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);

  // Test Email
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://notificaciones-residentepro2.onrender.com';

  // Cargar configuración existente
  useEffect(() => {
    if (!user?.tenantId) return;
    const loadConfig = async () => {
      try {
        const tenantDoc = await getDoc(doc(db, 'tenants', user.tenantId));
        if (tenantDoc.exists()) {
          const data = tenantDoc.data();
          if (data.smtpEmail) {
            setSmtpEmail(data.smtpEmail);
            setIsConfigured(true);
          }
          if (data.smtpPassword) {
            setSmtpPassword(data.smtpPassword);
          }
        }
      } catch (e) {
        console.error('Error cargando configuración:', e);
      }
    };
    loadConfig();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.tenantId) return;

    setSaving(true);
    setError('');
    setSaved(false);

    try {
      if (!smtpEmail || !smtpPassword) {
        throw new Error('Ingresa el correo y la contraseña de aplicación.');
      }

      await updateDoc(doc(db, 'tenants', user.tenantId), {
        smtpEmail: smtpEmail.trim(),
        smtpPassword: smtpPassword.trim(),
      });

      setIsConfigured(true);
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
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
          subject: '✅ Prueba de Correo — ResidentePro',
          body: `¡Hola! Este es un correo de prueba enviado desde ResidentePro para verificar que la configuración de correo de tu conjunto residencial está funcionando correctamente.\n\nSi recibes este mensaje, ¡todo está perfecto! Los residentes podrán recibir notificaciones por correo cuando lleguen paquetes, comunicados, y más.`,
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

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
            <Settings className="h-5 w-5 text-violet-400" />
          </div>
          Configuración
        </h1>
        <p className="text-sm text-zinc-500 mt-2">
          Administra la configuración de correo electrónico y demás ajustes de tu conjunto.
        </p>
      </div>

      {/* Sección: Configuración de Correo */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden"
      >
        {/* Card Header */}
        <div className="px-6 py-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Mail className="h-4.5 w-4.5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100">Correo de Notificaciones</h2>
              <p className="text-xs text-zinc-500">Gmail desde donde se enviarán las notificaciones a los residentes</p>
            </div>
          </div>
          {isConfigured && (
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
              <CheckCircle2 className="h-3 w-3" />
              Configurado
            </span>
          )}
        </div>

        {/* Card Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          {/* Info */}
          <div className="bg-violet-500/5 border border-violet-500/10 rounded-xl p-4 flex items-start gap-3">
            <Shield className="h-5 w-5 text-violet-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-violet-300">¿Cómo funciona?</p>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Configura un correo de Gmail y una <strong className="text-zinc-300">Contraseña de Aplicación</strong> de Google.
                Los correos de notificación (paquetes, comunicados, etc.) se enviarán <strong className="text-zinc-300">desde este correo</strong> directamente a tus residentes.
                No se comparten créditos con nadie — es 100% tuyo.
              </p>
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
              Correo Gmail
            </label>
            <input
              type="email"
              value={smtpEmail}
              onChange={(e) => setSmtpEmail(e.target.value)}
              placeholder="administracion@gmail.com"
              required
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-all"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
              Contraseña de Aplicación de Google
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={smtpPassword}
                onChange={(e) => setSmtpPassword(e.target.value)}
                placeholder="xxxx xxxx xxxx xxxx"
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 pr-12 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-all font-mono tracking-wider"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[10px] text-zinc-600 mt-1.5">
              No es tu contraseña normal de Gmail. Es una clave especial de 16 caracteres que generas desde Google.
            </p>
          </div>

          {/* Errores y éxito */}
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
            {saved && (
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

          {/* Save Button */}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm shadow-lg shadow-violet-600/20 transition-all flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {saving ? 'Guardando...' : 'Guardar Configuración'}
          </button>
        </form>
      </motion.div>

      {/* Sección: Probar Correo */}
      {isConfigured && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden"
        >
          <div className="px-6 py-5 border-b border-zinc-800 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Send className="h-4.5 w-4.5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100">Enviar Correo de Prueba</h2>
              <p className="text-xs text-zinc-500">Verifica que todo funcione correctamente antes de usarlo en producción</p>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                Correo de destino para la prueba
              </label>
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="tu-correo-personal@gmail.com"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-all"
              />
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
                      : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                  }`}
                >
                  {testResult.success ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
                  {testResult.message}
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={handleTestEmail}
              disabled={testing || !testEmail}
              className="w-full bg-amber-600/80 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {testing ? 'Enviando prueba...' : 'Enviar Correo de Prueba'}
            </button>
          </div>
        </motion.div>
      )}

      {/* Guía */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-zinc-800">
          <h2 className="text-sm font-bold text-zinc-100">📋 ¿Cómo obtener la Contraseña de Aplicación?</h2>
        </div>
        <div className="p-6">
          <ol className="space-y-4 text-xs text-zinc-400 leading-relaxed">
            <li className="flex gap-3">
              <span className="h-6 w-6 rounded-lg bg-violet-600/20 text-violet-400 flex items-center justify-center text-[10px] font-black shrink-0">1</span>
              <span>Entra a <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 underline">myaccount.google.com/security</a> con la cuenta de Gmail que quieres usar.</span>
            </li>
            <li className="flex gap-3">
              <span className="h-6 w-6 rounded-lg bg-violet-600/20 text-violet-400 flex items-center justify-center text-[10px] font-black shrink-0">2</span>
              <span>Asegúrate de tener activada la <strong className="text-zinc-300">Verificación en 2 pasos</strong> (es obligatorio para poder crear contraseñas de aplicación).</span>
            </li>
            <li className="flex gap-3">
              <span className="h-6 w-6 rounded-lg bg-violet-600/20 text-violet-400 flex items-center justify-center text-[10px] font-black shrink-0">3</span>
              <span>Busca la sección <strong className="text-zinc-300">"Contraseñas de aplicaciones"</strong> o entra directamente a <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 underline">myaccount.google.com/apppasswords</a></span>
            </li>
            <li className="flex gap-3">
              <span className="h-6 w-6 rounded-lg bg-violet-600/20 text-violet-400 flex items-center justify-center text-[10px] font-black shrink-0">4</span>
              <span>Dale un nombre a la aplicación (por ejemplo: <strong className="text-zinc-300">ResidentePro</strong>) y haz clic en <strong className="text-zinc-300">Crear</strong>.</span>
            </li>
            <li className="flex gap-3">
              <span className="h-6 w-6 rounded-lg bg-violet-600/20 text-violet-400 flex items-center justify-center text-[10px] font-black shrink-0">5</span>
              <span>Google te mostrará una contraseña de <strong className="text-zinc-300">16 caracteres</strong> (con espacios). Cópiala y pégala en el campo de arriba. <strong className="text-amber-400">¡Solo la verás una vez!</strong></span>
            </li>
          </ol>
        </div>
      </motion.div>
    </div>
  );
}
