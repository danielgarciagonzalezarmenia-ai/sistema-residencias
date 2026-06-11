'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { auth, db } from '../../lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, addDoc, getDocs, query, where, getDoc, updateDoc } from 'firebase/firestore';
import { Building2, Mail, Lock, User, Sparkles, Loader2, Building, AlertTriangle, CheckCircle2, FileText, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginWithGooglePopup, reloadUserProfile } = useAuth();
  
  const inviteTenantId = searchParams.get('invite');

  const [activeTab, setActiveTab] = useState<'admin' | 'resident'>('admin');
  
  // Google Auth states
  const [isCompletingGoogleAuth, setIsCompletingGoogleAuth] = useState(false);
  const [googleUserCred, setGoogleUserCred] = useState<any>(null);
  
  // Common fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  
  // Admin-only fields (Condominio)
  const [condoName, setCondoName] = useState('');
  const [condoNit, setCondoNit] = useState('');
  const [condoAddress, setCondoAddress] = useState('');

  // Invitation fields
  const [properties, setProperties] = useState<any[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [propertyRole, setPropertyRole] = useState<'owner' | 'inhabitant'>('owner');

  // Vehicle and Pet states
  const [livesInProperty, setLivesInProperty] = useState(true);
  const [hasVehicle, setHasVehicle] = useState(false);
  const [vehicleType, setVehicleType] = useState('Automóvil');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleBrand, setVehicleBrand] = useState('');

  const [hasPet, setHasPet] = useState(false);
  const [petType, setPetType] = useState('Perro');
  const [petTypeOther, setPetTypeOther] = useState('');
  const [petName, setPetName] = useState('');
  const [petDescription, setPetDescription] = useState('');

  // Status states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (inviteTenantId) {
      setActiveTab('resident');
      const fetchProps = async () => {
        try {
          const q = query(collection(db, 'properties'), where('tenantId', '==', inviteTenantId));
          const snap = await getDocs(q);
          const props: any[] = [];
          snap.forEach(doc => props.push({ id: doc.id, ...doc.data() }));
          props.sort((a, b) => {
            const towerA = String(a.tower || '').trim();
            const towerB = String(b.tower || '').trim();
            const towerCompare = towerA.localeCompare(towerB, undefined, { numeric: true, sensitivity: 'base' });
            if (towerCompare !== 0) return towerCompare;
            const unitA = String(a.unit || '').trim();
            const unitB = String(b.unit || '').trim();
            return unitA.localeCompare(unitB, undefined, { numeric: true, sensitivity: 'base' });
          });
          setProperties(props);
        } catch (err) {
          console.error('Error fetching properties', err);
        }
      };
      fetchProps();
    }
  }, [inviteTenantId]);

  // --- REGISTRO CON CORREO Y CONTRASEÑA ---
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

    if (inviteTenantId && !selectedPropertyId) {
      setError('Por favor seleccione una torre y apartamento.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      if (activeTab === 'admin') {
        // --- REGISTRO DE ADMINISTRADOR ---
        const tenantRef = await addDoc(collection(db, 'tenants'), {
          name: condoName,
          nit: condoNit || 'S.N.',
          address: condoAddress,
          createdAt: new Date(),
        });
        const newTenantId = tenantRef.id;

        const authResult = await createUserWithEmailAndPassword(auth, email, password);
        const uid = authResult.user.uid;

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
        if (inviteTenantId) {
          // Flow de Invitación por Link
          const authResult = await createUserWithEmailAndPassword(auth, email, password);
          const uid = authResult.user.uid;

          // 1. Agregar a la colección users
          await setDoc(doc(db, 'users', uid), {
            firstName,
            lastName,
            email,
            role: 'RESIDENTE',
            tenantId: inviteTenantId,
            createdAt: new Date(),
          });

          // 2. Agregar a la colección residents como PENDING
          const prop = properties.find(p => p.id === selectedPropertyId);
          const livesHere = propertyRole === 'inhabitant' || livesInProperty;
          const residentDocRef = await addDoc(collection(db, 'residents'), {
            firstName,
            lastName,
            document: '', // They can update it later
            email,
            phone,
            status: 'PENDING',
            tenantId: inviteTenantId,
            properties: prop ? [{ id: prop.id, tower: prop.tower, unit: prop.unit }] : [],
            createdAt: new Date(),
            propertyRole,
            livesInProperty: propertyRole === 'inhabitant' ? true : livesInProperty,
            hasVehicle: livesHere ? hasVehicle : false,
            vehicleInfo: (livesHere && hasVehicle) ? {
              type: vehicleType,
              plate: vehiclePlate.trim().toUpperCase(),
              brand: vehicleBrand.trim(),
            } : null,
            hasPet: livesHere ? hasPet : false,
            petInfo: (livesHere && hasPet) ? {
              type: petType === 'Otro' ? petTypeOther.trim() : petType,
              name: petName.trim(),
              description: petDescription.trim(),
            } : null,
          });

          // Vincular de forma automatica en la coleccion properties
          if (selectedPropertyId) {
            const name = `${firstName} ${lastName}`;
            const updateData = propertyRole === 'owner'
              ? { ownerId: residentDocRef.id, ownerName: name, status: 'OCCUPIED' }
              : { inhabitantId: residentDocRef.id, inhabitantName: name, status: 'OCCUPIED' };
            await updateDoc(doc(db, 'properties', selectedPropertyId), updateData);
          }

          setSuccess(true);
          setTimeout(() => router.push('/dashboard'), 1500);

        } else {
          // Flow de pre-registro manual por Admin
          const residentsQuery = query(
            collection(db, 'residents'),
            where('email', '==', email.trim())
          );
          const residentsSnap = await getDocs(residentsQuery);

          if (residentsSnap.empty) {
            throw new Error(
              'Tu correo electrónico no ha sido pre-registrado por el administrador del conjunto. ' +
              'Por favor, solicita a tu administración que te registre primero como residente, o pídele un Enlace de Invitación.'
            );
          }

          const residentData = residentsSnap.docs[0].data();
          const matchedTenantId = residentData.tenantId;

          const authResult = await createUserWithEmailAndPassword(auth, email, password);
          const uid = authResult.user.uid;

          await setDoc(doc(db, 'users', uid), {
            firstName,
            lastName,
            email,
            role: 'RESIDENTE',
            tenantId: matchedTenantId,
            phone,
            createdAt: new Date(),
          });

          setSuccess(true);
          setTimeout(() => {
            router.push('/dashboard');
          }, 1500);
        }
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

  // --- REGISTRO CON GOOGLE ---
  const handleGoogleRegister = async () => {
    setError(null);
    setLoading(true);
    try {
      const userCred = await loginWithGooglePopup();
      const uid = userCred.user.uid;
      const userEmail = userCred.user.email || '';
      
      const userDocRef = doc(db, 'users', uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        router.push('/dashboard');
        return;
      }

      const names = userCred.user.displayName?.split(' ') || [];
      const fName = names[0] || '';
      const lName = names.slice(1).join(' ') || '';

      if (activeTab === 'resident') {
         if (inviteTenantId) {
            // Flow de invitación: Pedir detalles adicionales (Apto y Rol)
            setFirstName(fName);
            setLastName(lName);
            setGoogleUserCred(userCred);
            setIsCompletingGoogleAuth(true);
            setLoading(false);
         } else {
           // Flow pre-registro
           const residentsQuery = query(collection(db, 'residents'), where('email', '==', userEmail));
           const residentsSnap = await getDocs(residentsQuery);
           
           if (residentsSnap.empty) {
              await auth.signOut();
              setError('Tu correo de Google no ha sido pre-registrado por el administrador del conjunto.');
              setLoading(false);
              return;
           }
           
           const matchedTenantId = residentsSnap.docs[0].data().tenantId;
           
           await setDoc(doc(db, 'users', uid), {
             firstName: fName,
             lastName: lName,
             email: userEmail,
             role: 'RESIDENTE',
             tenantId: matchedTenantId,
             phone,
             createdAt: new Date(),
           });
           
           setSuccess(true);
           await reloadUserProfile();
           setTimeout(() => router.push('/dashboard'), 1500);
         }
      } else {
         // Admin
         setFirstName(fName);
         setLastName(lName);
         setGoogleUserCred(userCred);
         setIsCompletingGoogleAuth(true);
         setLoading(false);
      }
    } catch (err: any) {
      if (err.message && !err.message.includes('popup-closed-by-user')) {
        setError(err.message || 'Error al iniciar sesión con Google.');
      }
      setLoading(false);
    }
  };

  const handleCompleteGoogleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'admin' && (!condoName || !condoAddress)) {
      setError('Por favor escriba el nombre y la dirección de su conjunto residencial.');
      return;
    }
    if (activeTab === 'resident' && inviteTenantId && !selectedPropertyId) {
      setError('Por favor seleccione una torre y apartamento.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const uid = googleUserCred.user.uid;
      const userEmail = googleUserCred.user.email;

      if (activeTab === 'admin') {
        const tenantRef = await addDoc(collection(db, 'tenants'), {
          name: condoName,
          nit: condoNit || 'S.N.',
          address: condoAddress,
          createdAt: new Date(),
        });

        await setDoc(doc(db, 'users', uid), {
          firstName,
          lastName,
          email: userEmail,
          role: 'ADMINISTRADOR',
          tenantId: tenantRef.id,
          createdAt: new Date(),
        });
      } else if (activeTab === 'resident' && inviteTenantId) {
        // Guardar residente invitado
        await setDoc(doc(db, 'users', uid), {
          firstName,
          lastName,
          email: userEmail,
          role: 'RESIDENTE',
          tenantId: inviteTenantId,
          phone,
          createdAt: new Date(),
        });

        const prop = properties.find(p => p.id === selectedPropertyId);
        const livesHere = propertyRole === 'inhabitant' || livesInProperty;
        const residentDocRef = await addDoc(collection(db, 'residents'), {
          firstName,
          lastName,
          document: '',
          email: userEmail,
          phone,
          status: 'PENDING',
          tenantId: inviteTenantId,
          properties: prop ? [{ id: prop.id, tower: prop.tower, unit: prop.unit }] : [],
          createdAt: new Date(),
          propertyRole,
          livesInProperty: propertyRole === 'inhabitant' ? true : livesInProperty,
          hasVehicle: livesHere ? hasVehicle : false,
          vehicleInfo: (livesHere && hasVehicle) ? {
            type: vehicleType,
            plate: vehiclePlate.trim().toUpperCase(),
            brand: vehicleBrand.trim(),
          } : null,
          hasPet: livesHere ? hasPet : false,
          petInfo: (livesHere && hasPet) ? {
            type: petType === 'Otro' ? petTypeOther.trim() : petType,
            name: petName.trim(),
            description: petDescription.trim(),
          } : null,
        });

        // Vincular de forma automatica en la coleccion properties
        if (selectedPropertyId) {
          const name = `${firstName} ${lastName}`;
          const updateData = propertyRole === 'owner'
            ? { ownerId: residentDocRef.id, ownerName: name, status: 'OCCUPIED' }
            : { inhabitantId: residentDocRef.id, inhabitantName: name, status: 'OCCUPIED' };
          await updateDoc(doc(db, 'properties', selectedPropertyId), updateData);
        }
      }

      setSuccess(true);
      await reloadUserProfile();
      setTimeout(() => router.push('/dashboard'), 1500);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al completar el registro.');
    } finally {
      setLoading(false);
    }
  };

  const renderVehiclePetFields = () => {
    const showLivingOption = propertyRole === 'owner';
    const livesHere = propertyRole === 'inhabitant' || livesInProperty;

    return (
      <div className="space-y-4 pt-4 border-t border-zinc-800/50 mt-4">
        {showLivingOption && (
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="livesInProperty"
              checked={livesInProperty}
              onChange={(e) => setLivesInProperty(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-850 bg-zinc-950 text-violet-600 focus:ring-violet-500 cursor-pointer"
            />
            <label htmlFor="livesInProperty" className="text-xs text-zinc-350 cursor-pointer select-none">
              ¿Usted habita/vive en este inmueble?
            </label>
          </div>
        )}

        {livesHere && (
          <>
            {/* Vehículos */}
            <div className="space-y-3 p-3 bg-zinc-950/40 rounded-xl border border-zinc-800/40">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="hasVehicle"
                  checked={hasVehicle}
                  onChange={(e) => setHasVehicle(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-850 bg-zinc-950 text-violet-600 focus:ring-violet-500 cursor-pointer"
                />
                <label htmlFor="hasVehicle" className="text-xs font-bold text-zinc-250 flex items-center gap-1.5 cursor-pointer select-none">
                  <span>🚗 ¿Tiene vehículo propio en el conjunto?</span>
                </label>
              </div>

              {hasVehicle && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase font-bold mb-1">Tipo</label>
                    <select
                      value={vehicleType}
                      onChange={(e) => setVehicleType(e.target.value)}
                      className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 text-xs focus:outline-none"
                    >
                      <option value="Automóvil">Automóvil</option>
                      <option value="Motocicleta">Motocicleta</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase font-bold mb-1">Placa *</label>
                    <input
                      type="text"
                      required
                      placeholder="ABC123"
                      value={vehiclePlate}
                      onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                      className="w-full px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 text-xs uppercase focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase font-bold mb-1">Marca/Color</label>
                    <input
                      type="text"
                      placeholder="Ej: Mazda Gris"
                      value={vehicleBrand}
                      onChange={(e) => setVehicleBrand(e.target.value)}
                      className="w-full px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 text-xs focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Mascotas */}
            <div className="space-y-3 p-3 bg-zinc-950/40 rounded-xl border border-zinc-800/40">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="hasPet"
                  checked={hasPet}
                  onChange={(e) => setHasPet(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-850 bg-zinc-950 text-violet-600 focus:ring-violet-500 cursor-pointer"
                />
                <label htmlFor="hasPet" className="text-xs font-bold text-zinc-250 flex items-center gap-1.5 cursor-pointer select-none">
                  <span>🐾 ¿Tiene mascotas en el inmueble?</span>
                </label>
              </div>

              {hasPet && (
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-zinc-500 uppercase font-bold mb-1">Tipo de Mascota</label>
                      <select
                        value={petType}
                        onChange={(e) => setPetType(e.target.value)}
                        className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 text-xs focus:outline-none"
                      >
                        <option value="Perro">Perro</option>
                        <option value="Gato">Gato</option>
                        <option value="Otro">Otro</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-zinc-500 uppercase font-bold mb-1">Nombre *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ej: Toby"
                        value={petName}
                        onChange={(e) => setPetName(e.target.value)}
                        className="w-full px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 text-xs focus:outline-none"
                      />
                    </div>
                  </div>

                  {petType === 'Otro' && (
                    <div>
                      <label className="block text-[10px] text-zinc-500 uppercase font-bold mb-1">Especifique Mascota *</label>
                      <input
                        type="text"
                        required
                        placeholder="Loro, Conejo, Hamster..."
                        value={petTypeOther}
                        onChange={(e) => setPetTypeOther(e.target.value)}
                        className="w-full px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 text-xs focus:outline-none"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase font-bold mb-1">Descripción de Mascota</label>
                    <input
                      type="text"
                      placeholder="Blanco y negro, tamaño mediano, etc."
                      value={petDescription}
                      onChange={(e) => setPetDescription(e.target.value)}
                      className="w-full px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 text-xs focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-zinc-950 relative px-4 py-12 overflow-x-hidden">
      {/* Background Blurs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg z-10"
      >
        {!isCompletingGoogleAuth && !inviteTenantId && (
          <Link
            href="/login"
            className="inline-flex items-center space-x-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors mb-6 group"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            <span>Volver al Login</span>
          </Link>
        )}

        <div className="flex flex-col items-center mb-6 text-center">
          <div className="p-3 bg-violet-600/10 border border-violet-500/20 rounded-2xl mb-3">
            <Building2 className="h-9 w-9 text-violet-400" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-violet-400 via-sky-400 to-emerald-400 bg-clip-text text-transparent">
            {isCompletingGoogleAuth 
              ? 'Complete su Registro' 
              : inviteTenantId 
                ? 'Invitación a Registro' 
                : 'Registro en Acacias Smart'}
          </h1>
          <p className="text-zinc-400 text-xs mt-1">
            {isCompletingGoogleAuth 
              ? 'Necesitamos un par de datos para finalizar su registro.' 
              : inviteTenantId 
                ? 'Usted ha sido invitado a unirse al conjunto. Ingrese sus datos.' 
                : 'Cree su cuenta de administración o vincúlese como residente.'}
          </p>
        </div>

        <div className="bg-zinc-900/40 border border-zinc-800 backdrop-blur-xl p-6 sm:p-8 rounded-3xl shadow-2xl relative overflow-hidden">
          
          {!isCompletingGoogleAuth && !inviteTenantId && (
            <div className="flex border-b border-zinc-800 mb-6">
              <button
                onClick={() => {
                  if (!loading) {
                    setActiveTab('admin');
                    setError(null);
                  }
                }}
                className={`flex-1 pb-3 text-xs font-bold transition-colors border-b-2 flex items-center justify-center space-x-1.5 ${
                  activeTab === 'admin'
                    ? 'border-violet-500 text-zinc-100'
                    : 'border-transparent text-zinc-500 hover:text-zinc-400'
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
                    ? 'border-violet-500 text-zinc-100'
                    : 'border-transparent text-zinc-500 hover:text-zinc-400'
                }`}
              >
                <User className="h-4 w-4" />
                <span>Soy Residente / Inquilino</span>
              </button>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-200 text-xs flex items-start space-x-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-200 text-xs flex items-start space-x-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
              <div>
                <p className="font-bold mb-0.5">¡Registro completado!</p>
                <p className="text-zinc-300">Redirigiendo a tu espacio de trabajo...</p>
              </div>
            </div>
          )}

          {isCompletingGoogleAuth ? (
            <form onSubmit={handleCompleteGoogleAuth} className="space-y-4">
              <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-4 mb-4">
                <p className="text-xs text-zinc-400 mb-2">Información obtenida de Google:</p>
                <p className="text-sm font-semibold text-zinc-200">{firstName} {lastName}</p>
                <p className="text-xs text-zinc-500">{googleUserCred?.user?.email}</p>
              </div>

              {activeTab === 'admin' && (
                <>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">Nombre del Conjunto o Edificio *</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Building2 className="h-4 w-4 text-zinc-500" />
                      </div>
                      <input
                        type="text"
                        required
                        disabled={loading || success}
                        value={condoName}
                        onChange={(e) => setCondoName(e.target.value)}
                        placeholder="Ej. Torres del Parque"
                        className="w-full pl-9 pr-3 py-2 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500/80 transition-colors text-xs disabled:opacity-50"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">NIT del Conjunto (Opcional)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FileText className="h-4 w-4 text-zinc-500" />
                      </div>
                      <input
                        type="text"
                        disabled={loading || success}
                        value={condoNit}
                        onChange={(e) => setCondoNit(e.target.value)}
                        placeholder="Ej. 900.123.456-7"
                        className="w-full pl-9 pr-3 py-2 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500/80 transition-colors text-xs disabled:opacity-50"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">Dirección del Conjunto *</label>
                    <input
                      type="text"
                      required
                      disabled={loading || success}
                      value={condoAddress}
                      onChange={(e) => setCondoAddress(e.target.value)}
                      placeholder="Ej. Calle 123 # 45 - 67"
                      className="w-full px-3 py-2 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500/80 transition-colors text-xs disabled:opacity-50"
                    />
                  </div>
                </>
              )}

              {activeTab === 'resident' && inviteTenantId && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1.5">Seleccione Inmueble *</label>
                      <select
                        required
                        value={selectedPropertyId}
                        onChange={(e) => setSelectedPropertyId(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-violet-500/80 transition-colors text-xs"
                      >
                        <option value="">-- Elija uno --</option>
                        {properties.map(p => (
                          <option key={p.id} value={p.id}>{p.tower} - {p.unit}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1.5">Su Rol *</label>
                      <select
                        required
                        value={propertyRole}
                        onChange={(e) => setPropertyRole(e.target.value as any)}
                        className="w-full px-3 py-2 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-violet-500/80 transition-colors text-xs"
                      >
                        <option value="owner">Propietario</option>
                        <option value="inhabitant">Inquilino</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">Teléfono Celular *</label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Ej. 300 123 4567"
                      className="w-full px-3 py-2 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-violet-500/80 transition-colors text-xs"
                    />
                  </div>
                  {renderVehiclePetFields()}
                </>
              )}

              <button
                type="submit"
                disabled={loading || success}
                className="w-full mt-6 py-3 px-4 font-medium text-white bg-violet-600 rounded-xl hover:bg-violet-500 disabled:bg-violet-800/50 disabled:cursor-not-allowed transition-all shadow-lg shadow-violet-600/20 flex items-center justify-center space-x-2 text-sm"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                <span>{loading ? 'Procesando...' : 'Completar Registro'}</span>
              </button>
            </form>
          ) : (
            <>
              <button
                type="button"
                onClick={handleGoogleRegister}
                disabled={loading}
                className="mb-6 w-full py-3 px-4 font-medium text-zinc-200 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 disabled:opacity-50 transition-all shadow-lg flex items-center justify-center space-x-2 text-sm"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  <path fill="none" d="M1 1h22v22H1z"/>
                </svg>
                <span>Registrarse con Google</span>
              </button>

              <div className="mb-6 flex items-center space-x-4">
                <div className="flex-1 h-px bg-zinc-800"></div>
                <span className="text-xs text-zinc-500 font-medium">O registrarse con correo</span>
                <div className="flex-1 h-px bg-zinc-800"></div>
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
                {activeTab === 'resident' && !inviteTenantId && (
                  <div className="p-3 bg-violet-500/5 border border-violet-500/15 rounded-xl text-[11px] text-zinc-300 leading-relaxed">
                    ℹ️ Para poder registrarte como residente, tu administrador debe haber agregado previamente tu correo en la lista de <strong>Residentes</strong> del conjunto residencial.
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">Nombre *</label>
                    <input
                      type="text"
                      required
                      disabled={loading || success}
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Juan"
                      className="w-full px-3 py-2 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500/80 transition-colors text-xs disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">Apellido *</label>
                    <input
                      type="text"
                      required
                      disabled={loading || success}
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Pérez"
                      className="w-full px-3 py-2 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500/80 transition-colors text-xs disabled:opacity-50"
                    />
                  </div>
                </div>

                {activeTab === 'resident' && (
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">Teléfono Celular *</label>
                    <input
                      type="tel"
                      required
                      disabled={loading || success}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Ej. 300 123 4567"
                      className="w-full px-3 py-2 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500/80 transition-colors text-xs disabled:opacity-50"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">Correo Electrónico *</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-4 w-4 text-zinc-500" />
                    </div>
                    <input
                      type="email"
                      required
                      disabled={loading || success}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ejemplo@correo.com"
                      className="w-full pl-9 pr-3 py-2 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500/80 transition-colors text-xs disabled:opacity-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">Contraseña *</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-zinc-500" />
                    </div>
                    <input
                      type="password"
                      required
                      disabled={loading || success}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-3 py-2 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500/80 transition-colors text-xs disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Campos extra de invitación manual */}
                {activeTab === 'resident' && inviteTenantId && (
                  <>
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-800/50">
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1.5">Seleccione Inmueble *</label>
                        <select
                          required
                          disabled={loading || success}
                          value={selectedPropertyId}
                          onChange={(e) => setSelectedPropertyId(e.target.value)}
                          className="w-full px-3 py-2 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-violet-500/80 transition-colors text-xs"
                        >
                          <option value="">-- Elija uno --</option>
                          {properties.map(p => (
                            <option key={p.id} value={p.id}>{p.tower} - {p.unit}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1.5">Su Rol *</label>
                        <select
                          required
                          disabled={loading || success}
                          value={propertyRole}
                          onChange={(e) => setPropertyRole(e.target.value as any)}
                          className="w-full px-3 py-2 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-violet-500/80 transition-colors text-xs"
                        >
                          <option value="owner">Propietario</option>
                          <option value="inhabitant">Inquilino</option>
                        </select>
                      </div>
                    </div>
                    {renderVehiclePetFields()}
                  </>
                )}

                <AnimatePresence>
                  {activeTab === 'admin' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-4 pt-4 border-t border-zinc-800/50"
                    >
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1.5">Nombre del Conjunto o Edificio *</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Building2 className="h-4 w-4 text-zinc-500" />
                          </div>
                          <input
                            type="text"
                            required
                            disabled={loading || success}
                            value={condoName}
                            onChange={(e) => setCondoName(e.target.value)}
                            placeholder="Ej. Torres del Parque"
                            className="w-full pl-9 pr-3 py-2 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500/80 transition-colors text-xs disabled:opacity-50"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1.5">NIT del Conjunto (Opcional)</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <FileText className="h-4 w-4 text-zinc-500" />
                          </div>
                          <input
                            type="text"
                            disabled={loading || success}
                            value={condoNit}
                            onChange={(e) => setCondoNit(e.target.value)}
                            placeholder="Ej. 900.123.456-7"
                            className="w-full pl-9 pr-3 py-2 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500/80 transition-colors text-xs disabled:opacity-50"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1.5">Dirección del Conjunto *</label>
                        <input
                          type="text"
                          required
                          disabled={loading || success}
                          value={condoAddress}
                          onChange={(e) => setCondoAddress(e.target.value)}
                          placeholder="Ej. Calle 123 # 45 - 67"
                          className="w-full px-3 py-2 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500/80 transition-colors text-xs disabled:opacity-50"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  type="submit"
                  disabled={loading || success}
                  className="w-full mt-6 py-3 px-4 font-medium text-white bg-violet-600 rounded-xl hover:bg-violet-500 disabled:bg-violet-800/50 disabled:cursor-not-allowed transition-all shadow-lg shadow-violet-600/20 flex items-center justify-center space-x-2 text-sm"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  <span>{loading ? 'Procesando...' : (activeTab === 'admin' ? 'Registrar Conjunto' : 'Vincularme como Residente')}</span>
                </button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-violet-500 animate-spin" />
      </div>
    }>
      <RegisterForm />
    </Suspense>
  );
}
