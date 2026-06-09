'use client';

import React, { useState } from 'react';
import { auth, db } from '../../lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, addDoc } from 'firebase/firestore';
import { Sparkles, Loader2, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function SeedPage() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const runSeed = async () => {
    setLoading(true);
    setSuccess(false);
    setError(null);
    setLogs([]);
    addLog('Iniciando proceso de inicialización (Seeding) en Firebase...');

    const tenantId = 'tenant-acacias-123';
    const passwords = 'password123';

    try {
      // 1. Crear el Tenant
      addLog('Creando Tenant: Club Residencial Las Acacias...');
      await setDoc(doc(db, 'tenants', tenantId), {
        name: 'Club Residencial Las Acacias',
        nit: '900.123.456-7',
        address: 'Calle 100 # 15-30, Bogotá, Colombia',
        createdAt: new Date(),
      });
      addLog('Tenant creado con éxito.');

      // 2. Registrar los 3 usuarios de prueba
      const usersToCreate = [
        {
          email: 'admin@acacias.com',
          firstName: 'Daniel',
          lastName: 'Administrador',
          role: 'ADMINISTRADOR',
        },
        {
          email: 'porteria@acacias.com',
          firstName: 'Pedro',
          lastName: 'Vigilante',
          role: 'PORTERÍA',
        },
        {
          email: 'residente@acacias.com',
          firstName: 'Juan',
          lastName: 'Pérez',
          role: 'RESIDENTE',
        },
      ];

      for (const userData of usersToCreate) {
        addLog(`Registrando usuario: ${userData.email}...`);
        let uid = '';
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, userData.email, passwords);
          uid = userCredential.user.uid;
          addLog(`Usuario creado en Auth con UID: ${uid}`);
        } catch (authErr: any) {
          if (authErr.code === 'auth/email-already-in-use') {
            addLog(`El correo ${userData.email} ya existe en Auth. Buscando o intentando actualizar Firestore...`);
            // En caso de que ya exista en Auth, usamos un ID genérico o asumimos el flujo.
            // Para el seed, intentaremos registrar en Firestore de todas formas.
            // Nota: El SDK de cliente no permite leer el UID de otro usuario por correo,
            // pero para esta prueba, si ya existe, el usuario puede iniciar sesión directamente.
            continue;
          } else {
            throw authErr;
          }
        }

        if (uid) {
          addLog(`Creando documento de perfil en Firestore para ${userData.email}...`);
          await setDoc(doc(db, 'users', uid), {
            firstName: userData.firstName,
            lastName: userData.lastName,
            role: userData.role,
            tenantId: tenantId,
            email: userData.email,
            createdAt: new Date(),
          });
          addLog(`Perfil creado para ${userData.email}.`);
        }
      }

      // 3. Crear Inmuebles
      addLog('Insertando Inmuebles de prueba...');
      const properties = [
        {
          tower: 'Torre 1',
          unit: 'Apto 101',
          type: 'apartamento',
          area: 85.0,
          coefficient: 0.012,
          tenantId,
          wallet: { balance: 0.0 },
          owner: { firstName: 'Carlos', lastName: 'Restrepo' },
          residents: [{ firstName: 'Juan', lastName: 'Pérez' }],
        },
        {
          tower: 'Torre 1',
          unit: 'Apto 102',
          type: 'apartamento',
          area: 85.0,
          coefficient: 0.012,
          tenantId,
          wallet: { balance: 180000.0 },
          owner: { firstName: 'María', lastName: 'Rodríguez' },
          residents: [{ firstName: 'Lucía', lastName: 'Gómez' }],
        },
        {
          tower: 'Torre 2',
          unit: 'Apto 201',
          type: 'apartamento',
          area: 95.0,
          coefficient: 0.014,
          tenantId,
          wallet: { balance: 540000.0 }, // Moroso crítico
          owner: { firstName: 'Carlos', lastName: 'Restrepo' },
          residents: [],
        },
      ];

      for (const prop of properties) {
        await addDoc(collection(db, 'properties'), prop);
        addLog(`Inmueble creado: ${prop.tower} - ${prop.unit}`);
      }

      // 4. Crear Residentes
      addLog('Insertando Residentes de prueba...');
      const residents = [
        {
          firstName: 'Juan',
          lastName: 'Pérez',
          document: '1012345678',
          email: 'juan.perez@email.com',
          phone: '3001234567',
          status: 'ACTIVE',
          tenantId,
          properties: [{ tower: 'Torre 1', unit: 'Apto 101' }],
        },
        {
          firstName: 'Lucía',
          lastName: 'Gómez',
          document: '1034567890',
          email: 'lucia.gomez@email.com',
          phone: '3112223344',
          status: 'ACTIVE',
          tenantId,
          properties: [{ tower: 'Torre 1', unit: 'Apto 102' }],
        },
      ];

      for (const res of residents) {
        await addDoc(collection(db, 'residents'), res);
        addLog(`Residente creado: ${res.firstName} ${res.lastName}`);
      }

      addLog('Inicialización de base de datos finalizada con éxito.');
      setSuccess(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Ocurrió un error inesperado.');
      addLog('PROCESO CANCELADO POR ERROR.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.06),transparent_50%)] pointer-events-none" />

      <div className="w-full max-w-xl bg-slate-900/40 border border-slate-800 backdrop-blur-xl p-8 rounded-3xl shadow-2xl relative">
        <div className="flex items-center space-x-3 text-indigo-400 mb-4">
          <Sparkles className="h-6 w-6" />
          <h1 className="text-xl font-bold">Inicializador de Datos (Firebase Seed)</h1>
        </div>

        <p className="text-slate-400 text-sm mb-6 leading-relaxed">
          Esta utilidad creará el conjunto residencial de prueba y las 3 cuentas demostrativas en tu proyecto activo de Firebase. Asegúrate de haber copiado las claves del proyecto en el archivo <code className="text-indigo-300">firebase.ts</code> o en las variables de entorno.
        </p>

        {error && (
          <div className="mb-6 p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-200 text-xs flex items-start space-x-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-200 text-xs flex items-start space-x-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
            <div className="space-y-2">
              <p className="font-bold">¡Sembrado completado con éxito!</p>
              <p>Ya puedes iniciar sesión en el portal utilizando las credenciales de prueba.</p>
              <Link
                href="/login"
                className="inline-flex items-center text-indigo-400 hover:text-indigo-300 font-semibold underline"
              >
                Ir a Iniciar Sesión <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={runSeed}
            disabled={loading}
            className="w-full py-3 px-4 font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800/40 rounded-xl transition-all shadow-lg shadow-indigo-600/15 flex items-center justify-center space-x-2 text-sm"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Escribiendo colecciones en Firestore...</span>
              </>
            ) : (
              <span>Inicializar Base de Datos de Prueba</span>
            )}
          </button>

          {/* Logs Terminal */}
          <div className="border border-slate-800/80 bg-slate-950/80 rounded-xl p-4 h-48 overflow-y-auto font-mono text-[10px] text-slate-400 space-y-1">
            <p className="text-slate-500">// Consola de logs en tiempo real</p>
            {logs.map((log, idx) => (
              <p key={idx}>{log}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
