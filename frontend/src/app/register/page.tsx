'use client';

import React, { useState } from 'react';
import { auth, db } from '../../lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { Building2, Mail, Lock, User, Sparkles, Loader2, Building, AlertTriangle, CheckCircle2, FileText, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'admin' | 'resident'>('admin');
  
  // Common fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Admin-only fields (Condominio)
  const [condoName, setCondoName] = useState('');
  const [condoNit, setCondoNit] = useState('');
  const [condoAddress, setCondoAddress] = useState('');

  // Status states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !email || !password) {
      setError('Por favor complete todos los campos obligatorios.');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (activeTab === 'admin' && (!condoName || !condoAddress)) {
      setError('Por favor escriba el nombre y la dirección de su conjunto residencial.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      if (activeTab === 'admin') {
        // --- REGISTRO DE ADMINISTRADOR ---
        // 1. Crear documento de Tenant
        const tenantRef = await addDoc(collection(db, 'tenants'), {
          name: condoName,
          nit: condoNit || 'S.N.',
          address: condoAddress,
          createdAt: new Date(),
        });
        const newTenantId = tenantRef.id;

        // 2. Crear usuario en Firebase Auth
        const authResult = await createUserWithEmailAndPassword(auth, email, password);
        const uid = authResult.user.uid;

        // 3. Crear perfil de usuario en Firestore
        await setDoc(doc(db, 'users', uid), {
          firstName,
          lastName,
          email,
          role: 'ADMINISTRADOR',
          tenantId: newTenantId,
          createdAt: new Date(),
        });

        setSuccess(true);
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);

      } else {
        // --- REGISTRO DE RESIDENTE (INQUILINO) ---
        // 1. Verificar si el correo ya está pre-registrado en la colección 'residents'
        const residentsQuery = query(
          collection(db, 'residents'),
          where('email', '==', email.trim())
        );
        const residentsSnap = await getDocs(residentsQuery);

        if (residentsSnap.empty) {
          throw new Error(
            'Tu correo electrónico no ha sido pre-registrado por el administrador del conjunto. ' +
            'Por favor, solicita a tu administración que te registre primero como residente.'
          );
        }

        // Obtener el tenantId del primer registro coincidente
        const residentData = residentsSnap.docs[0].data();
        const matchedTenantId = residentData.tenantId;

        // 2. Crear usuario en Firebase Auth
        const authResult = await createUserWithEmailAndPassword(auth, email, password);
        const uid = authResult.user.uid;

        // 3. Crear perfil de usuario en Firestore
        await setDoc(doc(db, 'users', uid), {
          firstName,
          lastName,
          email,
          role: 'RESIDENTE',
          tenantId: matchedTenantId,
          createdAt: new Date(),
        });

        setSuccess(true);
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
      }
    } catch (err: any) {
      console.error(err);
      let msg = err.message || 'Ocurrió un error en el registro.';
      if (err.code === 'auth/email-already-in-use') {
        msg = 'El correo electrónico ya se encuentra registrado.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-slate-950 relative px-4 py-12">
      {/* Background Blurs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg"
      >
        {/* Back Link */}
        <Link
          href="/login"
          className="inline-flex items-center space-x-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-6 group"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          <span>Volver al Login</span>
        </Link>

        {/* Logo */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="p-3 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl mb-3">
            <Building2 className="h-9 w-9 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 bg-clip-text text-transparent">
            Registro en Acacias Smart
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Cree su cuenta de administración o vincúlese como residente.
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/40 border border-slate-800 backdrop-blur-xl p-6 sm:p-8 rounded-3xl shadow-2xl relative overflow-hidden">
          
          {/* Tab Selector */}
          <div className="flex border-b border-slate-800 mb-6">
            <button
              onClick={() => {
                if (!loading) {
                  setActiveTab('admin');
                  setError(null);
                }
              }}
              className={`flex-1 pb-3 text-xs font-bold transition-colors border-b-2 flex items-center justify-center space-x-1.5 ${
                activeTab === 'admin'
                  ? 'border-indigo-500 text-slate-100'
                  : 'border-transparent text-slate-500 hover:text-slate-400'
              }`}
            >
              <Building className="h-4 w-4" />
              <span>Soy Administrador</span>
            </button>
            <button
              onClick={() => {
                if (!loading) {
                  setActiveTab('resident');
                  setError(null);
                }
              }}
              className={`flex-1 pb-3 text-xs font-bold transition-colors border-b-2 flex items-center justify-center space-x-1.5 ${
                activeTab === 'resident'
                  ? 'border-indigo-500 text-slate-100'
                  : 'border-transparent text-slate-500 hover:text-slate-400'
              }`}
            >
              <User className="h-4 w-4" />
              <span>Soy Residente / Inquilino</span>
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-200 text-xs flex items-start space-x-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-200 text-xs flex items-start space-x-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
              <div>
                <p className="font-bold mb-0.5">¡Registro completado!</p>
                <p className="text-slate-350">Redirigiendo a tu espacio de trabajo...</p>
              </div>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            
            {/* Explicación rápida para residente */}
            {activeTab === 'resident' && (
              <div className="p-3 bg-indigo-500/5 border border-indigo-500/15 rounded-xl text-[11px] text-slate-300 leading-relaxed">
                ℹ️ Para poder registrarte como residente, tu administrador debe haber agregado previamente tu correo en la lista de <strong>Residentes</strong> del conjunto residencial.
              </div>
            )}

            {/* Campos de Nombre */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Nombre *</label>
                <input
                  type="text"
                  required
                  disabled={loading || success}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Juan"
                  className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 transition-colors text-xs disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Apellido *</label>
                <input
                  type="text"
                  required
                  disabled={loading || success}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Pérez"
                  className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 transition-colors text-xs disabled:opacity-50"
                />
              </div>
            </div>

            {/* Correo y Clave */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Correo Electrónico *</label>
                <input
                  type="email"
                  required
                  disabled={loading || success}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 transition-colors text-xs disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Contraseña *</label>
                <input
                  type="password"
                  required
                  disabled={loading || success}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 caracteres"
                  className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 transition-colors text-xs disabled:opacity-50"
                />
              </div>
            </div>

            {/* Campos del Conjunto (Sólo Admin) */}
            <AnimatePresence mode="wait">
              {activeTab === 'admin' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 pt-2 border-t border-slate-800/80 overflow-hidden"
                >
                  <div className="flex items-center space-x-1.5 text-indigo-400 pb-1">
                    <Sparkles className="h-4 w-4" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">Detalles de la Residencia</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">Nombre del Conjunto *</label>
                      <input
                        type="text"
                        required={activeTab === 'admin'}
                        disabled={loading || success}
                        value={condoName}
                        onChange={(e) => setCondoName(e.target.value)}
                        placeholder="Club Residencial Las Acacias"
                        className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 transition-colors text-xs disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">NIT del Conjunto (Opcional)</label>
                      <input
                        type="text"
                        disabled={loading || success}
                        value={condoNit}
                        onChange={(e) => setCondoNit(e.target.value)}
                        placeholder="900.123.456-7"
                        className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 transition-colors text-xs disabled:opacity-50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Dirección del Conjunto *</label>
                    <input
                      type="text"
                      required={activeTab === 'admin'}
                      disabled={loading || success}
                      value={condoAddress}
                      onChange={(e) => setCondoAddress(e.target.value)}
                      placeholder="Calle 100 # 15-30, Bogotá"
                      className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 transition-colors text-xs disabled:opacity-50"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={loading || success}
              className="w-full py-2.5 px-4 font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-500 disabled:bg-indigo-850/50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center space-x-2 text-sm pt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Creando cuenta...</span>
                </>
              ) : (
                <span>Completar Registro</span>
              )}
            </button>
          </form>
        </div>

        {/* Link to login */}
        <p className="mt-6 text-center text-xs text-slate-500">
          ¿Ya tiene una cuenta?{' '}
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-bold underline transition-colors">
            Inicie Sesión aquí
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
