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
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  onSnapshot,
  setDoc,
  getDoc,
} from 'firebase/firestore';
import {
  Vote,
  Users,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Award,
  Trash2,
  HelpCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { sendEmail } from '../../../lib/mail';

interface VoteOption {
  text: string;
  votesWeight: number; // Suma de coeficientes
  votesCount: number; // Conteo de votos individuales
}

interface AssemblyPoll {
  id: string;
  question: string;
  options: string[];
  status: 'ACTIVE' | 'CLOSED';
  votes: Record<string, { optionIndex: number; weight: number }>; // map de "unit_tower" -> { optionIndex, weight }
  createdAt: any;
}

interface CheckedInUnit {
  id: string;
  tower: string;
  unit: string;
  coefficient: number;
  checkedIn: boolean;
}

export default function AssembliesPage() {
  const { user, activeRole } = useAuth();
  const currentRole = activeRole || user?.role || '';
  const isAdmin = currentRole === 'ADMINISTRADOR';

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [polls, setPolls] = useState<AssemblyPoll[]>([]);
  const [myProperties, setMyProperties] = useState<{ tower: string; unit: string; coefficient: number }[]>([]);
  const [quorumUnits, setQuorumUnits] = useState<CheckedInUnit[]>([]);

  // Crear Votación Form
  const [showAddPoll, setShowAddPoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // 1. Escuchar votaciones en tiempo real
  useEffect(() => {
    if (!user?.tenantId) return;
    const q = query(collection(db, 'tenants', user.tenantId, 'polls'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list: AssemblyPoll[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          question: data.question || '',
          options: data.options || [],
          status: data.status || 'ACTIVE',
          votes: data.votes || {},
          createdAt: data.createdAt,
        });
      });
      // Ordenar por fecha de creación desc
      list.sort((a, b) => {
        const ta = a.createdAt?.seconds || 0;
        const tb = b.createdAt?.seconds || 0;
        return tb - ta;
      });
      setPolls(list);
    });
    return () => unsubscribe();
  }, [user]);

  // 2. Escuchar quórum / asistencia en tiempo real
  useEffect(() => {
    if (!user?.tenantId) return;
    const q = query(collection(db, 'tenants', user.tenantId, 'quorum_units'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list: CheckedInUnit[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          tower: data.tower || '',
          unit: data.unit || '',
          coefficient: Number(data.coefficient) || 0.01, // default 1% si no tiene
          checkedIn: !!data.checkedIn,
        });
      });
      setQuorumUnits(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // 3. Cargar las propiedades del residente actual
  useEffect(() => {
    if (!user?.tenantId || isAdmin) return;
    const loadResidentProps = async () => {
      try {
        const resSnap = await getDocs(query(
          collection(db, 'residents'),
          where('email', '==', user.email),
          where('tenantId', '==', user.tenantId)
        ));
        if (!resSnap.empty) {
          const resData = resSnap.docs[0].data();
          const props = resData.properties || [];
          
          // Cargar coeficientes desde coleccion properties
          const list: any[] = [];
          for (const p of props) {
            // Buscar property doc
            const propSnap = await getDocs(query(
              collection(db, 'properties'),
              where('tenantId', '==', user.tenantId),
              where('tower', '==', p.tower),
              where('unit', '==', p.unit)
            ));
            let coef = 0.01; // default 1%
            if (!propSnap.empty) {
              coef = Number(propSnap.docs[0].data().coefficient) || 0.01;
            }
            list.push({ tower: p.tower, unit: p.unit, coefficient: coef });
          }
          setMyProperties(list);
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadResidentProps();
  }, [user, isAdmin]);

  // Sincronizar quórum (solo admin puede regenerar a partir de properties existentes)
  const handleRegenerateQuorumList = async () => {
    if (!user?.tenantId || !isAdmin) return;
    setActionLoading(true);
    try {
      const propSnap = await getDocs(query(collection(db, 'properties'), where('tenantId', '==', user.tenantId)));
      if (propSnap.empty) {
        throw new Error('Debe registrar inmuebles en el sistema antes de iniciar la asamblea.');
      }

      // Escribir la lista inicial a quorum_units
      for (const docSnap of propSnap.docs) {
        const data = docSnap.data();
        const key = `${data.tower}_${data.unit}`.replace(/\s+/g, '_');
        await setDoc(doc(db, 'tenants', user.tenantId, 'quorum_units', key), {
          tower: data.tower,
          unit: data.unit,
          coefficient: Number(data.coefficient) || 0.01,
          checkedIn: false,
        });
      }
      setSuccessMessage('Lista de asistencia de asamblea inicializada con éxito.');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al inicializar lista.');
    } finally {
      setActionLoading(false);
    }
  };

  // Confirmar asistencia (Residente o Admin para una unidad)
  const handleToggleAttendance = async (unitKey: string, checked: boolean) => {
    if (!user?.tenantId) return;
    try {
      await updateDoc(doc(db, 'tenants', user.tenantId, 'quorum_units', unitKey), {
        checkedIn: checked,
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Registrar asistencia propia (Residente)
  const handleSelfCheckIn = async () => {
    if (!user?.tenantId || myProperties.length === 0) return;
    setActionLoading(true);
    try {
      for (const prop of myProperties) {
        const key = `${prop.tower}_${prop.unit}`.replace(/\s+/g, '_');
        await setDoc(doc(db, 'tenants', user.tenantId, 'quorum_units', key), {
          tower: prop.tower,
          unit: prop.unit,
          coefficient: prop.coefficient,
          checkedIn: true,
        }, { merge: true });
      }
      setSuccessMessage('¡Asistencia confirmada exitosamente!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  // Crear votación
  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.tenantId) return;
    setActionLoading(true);
    try {
      const filteredOptions = pollOptions.filter(o => o.trim() !== '');
      if (filteredOptions.length < 2) {
        throw new Error('Debe agregar al menos 2 opciones de votación.');
      }

      await addDoc(collection(db, 'tenants', user.tenantId, 'polls'), {
        question: pollQuestion,
        options: filteredOptions,
        status: 'ACTIVE',
        votes: {},
        createdAt: serverTimestamp(),
      });

      // Enviar correo de notificación a todos los residentes activos
      if (user.tenantId) {
        (async () => {
          try {
            const residentsSnap = await getDocs(query(
              collection(db, 'residents'),
              where('tenantId', '==', user.tenantId),
              where('status', '==', 'ACTIVE')
            ));

            let tenantName = 'Tu Conjunto';
            const tenantSnap = await getDoc(doc(db, 'tenants', user.tenantId));
            if (tenantSnap.exists()) {
              tenantName = tenantSnap.data().name || 'Tu Conjunto';
            }

            const emailSubject = `Nueva Votación Disponible: ${pollQuestion}`;
            const emailMessage = `Estimado(a) residente:\n\nSe ha habilitado una nueva votación en el módulo de Asambleas de tu conjunto residencial:\n\n🗳️ Pregunta: "${pollQuestion}"\n\nPor favor, ingresa a la plataforma ResidentePro para emitir tu voto y participar en la toma de decisiones colectivas de tu copropiedad.\n\nAtentamente,\nLa administración de ${tenantName}`;

            residentsSnap.forEach(async (residentDoc) => {
              const resData = residentDoc.data();
              if (resData.email) {
                try {
                  await sendEmail({
                    toEmail: resData.email,
                    toName: `${resData.firstName || ''} ${resData.lastName || ''}`.trim(),
                    subject: emailSubject,
                    message: emailMessage,
                    fromName: tenantName,
                    tenantId: user.tenantId,
                    type: 'general',
                  });
                } catch (mailErr) {
                  console.error('Error al enviar correo de votación a ' + resData.email, mailErr);
                }
              }
            });
          } catch (mailListErr) {
            console.error('Error al obtener destinatarios para votación:', mailListErr);
          }
        })();
      }

      setSuccessMessage('Votación iniciada con éxito.');
      setPollQuestion('');
      setPollOptions(['', '']);
      setShowAddPoll(false);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al iniciar votación.');
    } finally {
      setActionLoading(false);
    }
  };

  // Votar por una opción (Residente)
  const handleCastVote = async (pollId: string, optionIndex: number, property: { tower: string; unit: string; coefficient: number }) => {
    if (!user?.tenantId) return;
    try {
      const key = `${property.tower}_${property.unit}`.replace(/\s+/g, '_');
      const pollRef = doc(db, 'tenants', user.tenantId, 'polls', pollId);
      
      // Actualizar el mapa de votos de la votación
      await updateDoc(pollRef, {
        [`votes.${key}`]: {
          optionIndex,
          weight: property.coefficient,
        },
      });
    } catch (err) {
      console.error('Error al emitir voto:', err);
    }
  };

  // Cerrar votación (Admin)
  const handleClosePoll = async (pollId: string) => {
    if (!user?.tenantId || !isAdmin) return;
    try {
      await updateDoc(doc(db, 'tenants', user.tenantId, 'polls', pollId), {
        status: 'CLOSED',
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Eliminar votación (Admin)
  const handleDeletePoll = async (pollId: string) => {
    if (!user?.tenantId || !isAdmin) return;
    if (!confirm('¿Está seguro de eliminar esta votación del histórico?')) return;
    try {
      await deleteDoc(doc(db, 'tenants', user.tenantId, 'polls', pollId));
    } catch (err) {
      console.error(err);
    }
  };

  // Agregar opción al formulario
  const handleAddOptionField = () => {
    setPollOptions([...pollOptions, '']);
  };

  // Quórum total y actual
  const totalCoefficients = quorumUnits.reduce((sum, u) => sum + u.coefficient, 0);
  const presentCoefficients = quorumUnits.filter(u => u.checkedIn).reduce((sum, u) => sum + u.coefficient, 0);
  const quorumPercentage = totalCoefficients > 0 ? (presentCoefficients / totalCoefficients) * 100 : 0;

  return (
    <div className="space-y-8 pb-8 font-sans text-zinc-100">

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center space-x-2.5">
          <Vote className="h-7 w-7 text-violet-400" />
          <span>Asambleas & Decisiones Colectivas</span>
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Participe activamente en las asambleas residenciales. El quórum y los votos se ponderan en base al coeficiente copropietario de su inmueble.
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

        {/* COLUMNA IZQUIERDA: Control Quórum y Asistencia */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Tarjeta de Quórum en tiempo real */}
          <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-violet-400">
                <Users className="h-5 w-5" />
                <h3 className="font-bold text-sm">Quórum de Asamblea</h3>
              </div>
              <span className="text-xs font-bold text-violet-300 font-mono">
                {quorumPercentage.toFixed(2)}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-zinc-950 h-2.5 rounded-full overflow-hidden border border-zinc-850">
              <motion.div
                className="bg-violet-600 h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, quorumPercentage)}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>

            <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
              <span>Presente: {presentCoefficients.toFixed(4)} Coef</span>
              <span>Total: {totalCoefficients.toFixed(4)} Coef</span>
            </div>

            {/* Botón asistencia para residente */}
            {!isAdmin && myProperties.length > 0 && (
              <div className="pt-2">
                {myProperties.every(p => {
                  const key = `${p.tower}_${p.unit}`.replace(/\s+/g, '_');
                  return quorumUnits.find(u => u.id === key)?.checkedIn;
                }) ? (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl flex items-center justify-center space-x-1.5 text-emerald-400 text-xs font-bold">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Asistencia Registrada</span>
                  </div>
                ) : (
                  <button
                    onClick={handleSelfCheckIn}
                    disabled={actionLoading}
                    className="w-full bg-violet-600 hover:bg-violet-550 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs shadow-lg transition-all"
                  >
                    Confirmar mi Asistencia
                  </button>
                )}
              </div>
            )}

            {/* Reset / Regenerar Quórum por admin */}
            {isAdmin && (
              <div className="pt-2 space-y-2">
                <button
                  onClick={handleRegenerateQuorumList}
                  disabled={actionLoading}
                  className="w-full bg-zinc-800 hover:bg-zinc-750 text-zinc-300 border border-zinc-700 font-semibold py-2 rounded-xl text-xs transition-all flex items-center justify-center space-x-1.5"
                >
                  {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Inicializar / Sincronizar Inmuebles</span>
                </button>
              </div>
            )}
          </div>

          {/* Listado de Unidades en la Asamblea (Control manual de asistencia) */}
          <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-4">
            <h4 className="font-bold text-xs">Asistencia por Inmueble</h4>
            
            {loading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-8 bg-zinc-900 animate-pulse rounded-lg" />
                ))}
              </div>
            ) : quorumUnits.length === 0 ? (
              <p className="text-[10px] text-zinc-500 italic">Lista de quórum vacía. Presione inicializar.</p>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1 divide-y divide-zinc-800/40">
                {quorumUnits.map((u) => (
                  <div key={u.id} className="flex items-center justify-between text-xs py-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-zinc-350">{u.tower} - {u.unit}</p>
                      <p className="text-[9px] text-zinc-550 font-mono">Coef: {u.coefficient}</p>
                    </div>
                    {isAdmin ? (
                      <input
                        type="checkbox"
                        checked={u.checkedIn}
                        onChange={(e) => handleToggleAttendance(u.id, e.target.checked)}
                        className="h-4 w-4 rounded bg-zinc-950 border-zinc-800 text-violet-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                      />
                    ) : (
                      <span className={`h-2.5 w-2.5 rounded-full ${u.checkedIn ? 'bg-emerald-500 shadow-sm shadow-emerald-500/30' : 'bg-zinc-800'}`} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* COLUMNA DERECHA: Votaciones Activas e Históricas */}
        <div className="lg:col-span-2 space-y-6">

          <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Votaciones de la Asamblea</h3>
                <p className="text-xs text-zinc-550 mt-0.5">Tome decisiones colectivas en tiempo real</p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => setShowAddPoll(true)}
                  className="bg-violet-600 hover:bg-violet-550 text-white font-bold py-2 px-3.5 rounded-xl text-xs flex items-center space-x-1 transition-all shadow"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Iniciar Votación</span>
                </button>
              )}
            </div>

            {/* Modal Iniciar Votación */}
            <AnimatePresence>
              {showAddPoll && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-2xl space-y-4"
                  >
                    <h3 className="font-bold text-zinc-100 text-sm">Nueva Pregunta a Votar</h3>

                    <form onSubmit={handleCreatePoll} className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-555 mb-1">
                          Pregunta
                        </label>
                        <input
                          type="text"
                          value={pollQuestion}
                          onChange={(e) => setPollQuestion(e.target.value)}
                          placeholder="Ej. ¿Aprueba el presupuesto de administración del 2026?"
                          required
                          className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3.5 py-2 text-xs text-zinc-200 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-555">
                          Opciones de Respuesta
                        </label>
                        {pollOptions.map((opt, idx) => (
                          <input
                            key={idx}
                            type="text"
                            value={opt}
                            onChange={(e) => {
                              const updated = [...pollOptions];
                              updated[idx] = e.target.value;
                              setPollOptions(updated);
                            }}
                            placeholder={`Opción ${idx + 1}`}
                            required={idx < 2}
                            className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3.5 py-2 text-xs text-zinc-200 focus:outline-none"
                          />
                        ))}
                        <button
                          type="button"
                          onClick={handleAddOptionField}
                          className="text-[10px] font-bold text-violet-400 hover:text-violet-300 flex items-center space-x-1 pt-1"
                        >
                          <Plus className="h-3 w-3" />
                          <span>Agregar Opción</span>
                        </button>
                      </div>

                      <div className="flex space-x-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowAddPoll(false)}
                          className="flex-1 bg-zinc-850 hover:bg-zinc-800 text-zinc-350 font-bold py-2 rounded-xl text-xs"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="flex-1 bg-violet-600 hover:bg-violet-550 text-white font-bold py-2 rounded-xl text-xs shadow-lg"
                        >
                          Lanzar Votación
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Renderizar Votaciones */}
            {polls.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-zinc-800 rounded-xl space-y-3">
                <HelpCircle className="h-10 w-10 text-zinc-700 mx-auto" />
                <p className="text-xs text-zinc-550">No hay votaciones activas ni registradas en esta asamblea.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {polls.map((poll) => {
                  // Calcular resultados ponderados por coeficiente
                  const results: VoteOption[] = poll.options.map((opt) => ({
                    text: opt,
                    votesWeight: 0,
                    votesCount: 0,
                  }));

                  let totalVotesWeight = 0;
                  Object.values(poll.votes).forEach((v) => {
                    if (v.optionIndex >= 0 && v.optionIndex < results.length) {
                      results[v.optionIndex].votesWeight += v.weight;
                      results[v.optionIndex].votesCount += 1;
                      totalVotesWeight += v.weight;
                    }
                  });

                  return (
                    <div
                      key={poll.id}
                      className={`p-5 rounded-xl border flex flex-col justify-between space-y-4 relative ${poll.status === 'ACTIVE' ? 'bg-zinc-950/80 border-violet-500/20 shadow-md' : 'bg-zinc-950/40 border-zinc-850 opacity-90'}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold ${poll.status === 'ACTIVE' ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20' : 'bg-zinc-800 text-zinc-500 border border-zinc-700'}`}>
                            {poll.status === 'ACTIVE' ? 'Abierta (En Vivo)' : 'Cerrada'}
                          </span>
                          <h4 className="text-sm font-bold text-zinc-200 leading-normal">{poll.question}</h4>
                        </div>
                        
                        {isAdmin && (
                          <div className="flex items-center space-x-2 shrink-0">
                            {poll.status === 'ACTIVE' && (
                              <button
                                onClick={() => handleClosePoll(poll.id)}
                                className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 font-bold border border-zinc-700 rounded-lg text-[10px] transition-all"
                              >
                                Cerrar Votación
                              </button>
                            )}
                            <button
                              onClick={() => handleDeletePoll(poll.id)}
                              className="text-zinc-650 hover:text-rose-455 transition-colors p-1"
                              title="Eliminar votación"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Lista de Opciones e inputs para Residentes */}
                      <div className="space-y-3">
                        {results.map((opt, optIdx) => {
                          const percentage = totalVotesWeight > 0 ? (opt.votesWeight / totalVotesWeight) * 100 : 0;
                          return (
                            <div key={optIdx} className="space-y-1.5">
                              <div className="flex items-center justify-between text-xs font-semibold">
                                <span className="text-zinc-300">{opt.text}</span>
                                <span className="text-zinc-500 font-mono text-[11px]">
                                  {percentage.toFixed(1)}% ({opt.votesCount} votos, {(opt.votesWeight * 100).toFixed(2)}% Coef)
                                </span>
                              </div>

                              {/* Progress bar de opción */}
                              <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden border border-zinc-850/60">
                                <div
                                  className={`h-full rounded-full ${poll.status === 'ACTIVE' ? 'bg-violet-600' : 'bg-zinc-600'}`}
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>

                              {/* Si está activo y no es admin y tiene inmuebles, puede votar */}
                              {poll.status === 'ACTIVE' && !isAdmin && myProperties.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                  {myProperties.map((prop, pIdx) => {
                                    const key = `${prop.tower}_${prop.unit}`.replace(/\s+/g, '_');
                                    const hasVotedForThis = poll.votes[key]?.optionIndex === optIdx;
                                    const hasVotedAny = poll.votes[key] !== undefined;

                                    return (
                                      <button
                                        key={pIdx}
                                        onClick={() => handleCastVote(poll.id, optIdx, prop)}
                                        className={`px-2.5 py-1 rounded-lg text-[9px] font-bold border transition-all ${hasVotedForThis ? 'bg-violet-600 border-violet-500 text-white shadow-sm' : hasVotedAny ? 'bg-zinc-950 border-zinc-850 text-zinc-650 cursor-not-allowed' : 'bg-zinc-900 border-zinc-800 text-zinc-350 hover:bg-zinc-800 hover:text-zinc-100'}`}
                                        disabled={hasVotedAny}
                                      >
                                        Votar Apto {prop.unit} {(prop.coefficient * 100).toFixed(2)}%
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="text-[9px] text-zinc-650 flex justify-between pt-1 font-mono border-t border-zinc-900">
                        <span>Lanzado: {poll.createdAt?.seconds ? new Date(poll.createdAt.seconds * 1000).toLocaleString('es-CO') : 'Reciente'}</span>
                        <span>Total Coeficiente Participante: {(totalVotesWeight * 100).toFixed(2)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
