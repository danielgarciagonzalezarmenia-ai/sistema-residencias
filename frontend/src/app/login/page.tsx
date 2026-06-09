'use client';

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { isConfigured } from '../../lib/firebase';
import { Building2, Mail, Lock, Eye, EyeOff, Loader2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Validaciones
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const validate = () => {
    let isValid = true;
    
    // Correo válido
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      setEmailError('El correo electrónico es obligatorio');
      isValid = false;
    } else if (!emailRegex.test(email)) {
      setEmailError('Ingrese un formato de correo válido');
      isValid = false;
    } else {
      setEmailError('');
    }

    // Contraseña obligatoria
    if (!password) {
      setPasswordError('La contraseña es obligatoria');
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError('La contraseña debe tener al menos 6 caracteres');
      isValid = false;
    } else {
      setPasswordError('');
    }

    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setError(null);

    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión. Inténtelo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-slate-950 relative px-4 py-12">
      {/* Decorative Blur Background Circles */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="p-3 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl mb-4">
            <Building2 className="h-10 w-10 text-indigo-400" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 bg-clip-text text-transparent">
            Acacias Smart
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            Ingrese sus credenciales para acceder al portal administrativo.
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/40 border border-slate-800 backdrop-blur-xl p-8 rounded-3xl shadow-2xl relative overflow-hidden">
          {!isConfigured && (
            <div className="mb-6 p-4 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-200 text-xs flex items-start space-x-2.5">
              <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <p className="font-bold mb-1">Firebase no configurado</p>
                <p className="leading-normal text-slate-300">
                  Las claves de conexión no se han detectado. Asegúrate de haber agregado los Secrets en tu repositorio de GitHub y que el build se haya completado.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-200 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Correo */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Correo Electrónico
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  className={`w-full pl-11 pr-4 py-3 bg-slate-950/60 border ${
                    emailError ? 'border-red-500/50' : 'border-slate-800'
                  } rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 transition-colors text-sm`}
                />
              </div>
              {emailError && (
                <p className="mt-1.5 text-xs text-red-400">{emailError}</p>
              )}
            </div>

            {/* Contraseña */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-slate-300">
                  Contraseña
                </label>
                <button
                  type="button"
                  onClick={() => alert('Para restablecer su contraseña, por favor contacte al administrador del conjunto.')}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  ¿Olvidó su contraseña?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full pl-11 pr-11 py-3 bg-slate-950/60 border ${
                    passwordError ? 'border-red-500/50' : 'border-slate-800'
                  } rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 transition-colors text-sm`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-400"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {passwordError && (
                <p className="mt-1.5 text-xs text-red-400">{passwordError}</p>
              )}
            </div>

            {/* Recordar Sesión */}
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4.5 h-4.5 accent-indigo-600 rounded bg-slate-950 border-slate-800"
                />
                <span className="text-xs text-slate-400">Recordar sesión</span>
              </label>

              <span
                onClick={() => alert('La autenticación multifactor (MFA) se habilitará en la versión 2.0.')}
                className="text-[10px] text-slate-500 cursor-pointer hover:underline"
              >
                MFA disponible pronto
              </span>
            </div>

            {/* Botón Ingresar */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-500 disabled:bg-indigo-800/50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center space-x-2 text-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Validando sesión...</span>
                </>
              ) : (
                <span>Ingresar al Portal</span>
              )}
            </button>
          </form>
        </div>

        {/* Sign up link */}
        <p className="mt-6 text-center text-xs text-slate-500">
          ¿No tienes una cuenta?{' '}
          <Link href="/register" className="text-indigo-400 hover:text-indigo-300 font-bold underline transition-colors">
            Regístrate aquí
          </Link>
        </p>

        {/* Demo credentials hint */}
        <div className="mt-6 p-4 border border-slate-800/80 bg-slate-900/20 rounded-2xl text-xs text-slate-400 leading-relaxed">
          <p className="font-bold text-slate-300 mb-1">Cuentas de demostración:</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Administración: <code className="text-indigo-300">admin@acacias.com</code> / <code className="text-indigo-300">password123</code></li>
            <li>Vigilancia (Portería): <code className="text-indigo-300">porteria@acacias.com</code> / <code className="text-indigo-300">password123</code></li>
          </ul>
        </div>
      </motion.div>
    </div>
  );
}
