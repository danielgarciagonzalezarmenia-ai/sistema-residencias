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
  orderBy,
} from 'firebase/firestore';
import {
  Truck,
  Wrench,
  CalendarDays,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MoveSchedule {
  id: string;
  residentName: string;
  residentEmail: string;
  type: 'IN' | 'OUT'; // Mudanza de Entrada o Salida
  moveDate: string;
  tower: string;
  unit: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  notes?: string;
  createdAt: any;
}

interface Contractor {
  id: string;
  workerName: string;
  workerDocument: string;
  arlProvider: string;
  arlExpiresAt: string; // YYYY-MM-DD
  unit: string;
  tower: string;
  registeredBy: string;
  notes?: string;
  createdAt: any;
}

export default function MovingWorksPage() {
  const { user, activeRole } = useAuth();
  const currentRole = activeRole || user?.role || '';
  const isAdmin = currentRole === 'ADMINISTRADOR';
  const isPorter = currentRole === 'PORTERÍA';
  const canApprove = isAdmin || isPorter;

  const [activeTab, setActiveTab] = useState<'moves' | 'contractors'>('moves');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [moves, setMoves] = useState<MoveSchedule[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);

  // Move Form state
  const [showAddMove, setShowAddMove] = useState(false);
  const [moveType, setMoveType] = useState<'IN' | 'OUT'>('IN');
  const [moveDate, setMoveDate] = useState('');
  const [moveNotes, setMoveNotes] = useState('');

  // Contractor Form state
  const [showAddContractor, setShowAddContractor] = useState(false);
  const [workerName, setWorkerName] = useState('');
  const [workerDocument, setWorkerDocument] = useState('');
  const [arlProvider, setArlProvider] = useState('');
  const [arlExpiresAt, setArlExpiresAt] = useState('');
  const [contractorNotes, setContractorNotes] = useState('');

  // Aux state for units (Admin registers on behalf of someone)
  const [assignTower, setAssignTower] = useState('');
  const [assignUnit, setAssignUnit] = useState('');

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const fetchData = async () => {
    if (!user?.tenantId) return;
    setLoading(true);
    try {
      // 1. Cargar Mudanzas
      let movesQ;
      if (isAdmin || isPorter) {
        movesQ = query(collection(db, 'tenants', user.tenantId, 'moves'), orderBy('moveDate', 'asc'));
      } else {
        movesQ = query(
          collection(db, 'tenants', user.tenantId, 'moves'),
          where('residentEmail', '==', user.email)
        );
      }
      const movesSnap = await getDocs(movesQ);
      const movesList: MoveSchedule[] = [];
      movesSnap.forEach((d) => {
        const data = d.data();
        movesList.push({
          id: d.id,
          residentName: data.residentName || '',
          residentEmail: data.residentEmail || '',
          type: data.type || 'IN',
          moveDate: data.moveDate || '',
          tower: data.tower || '',
          unit: data.unit || '',
          status: data.status || 'PENDING',
          notes: data.notes || '',
          createdAt: data.createdAt,
        });
      });
      // Sort in-memory if query where didn't sort
      if (!isAdmin && !isPorter) {
        movesList.sort((a, b) => a.moveDate.localeCompare(b.moveDate));
      }
      setMoves(movesList);

      // 2. Cargar Contratistas
      const contSnap = await getDocs(
        query(collection(db, 'tenants', user.tenantId, 'contractors'), orderBy('arlExpiresAt', 'asc'))
      );
      const contList: Contractor[] = [];
      contSnap.forEach((d) => {
        const data = d.data();
        contList.push({
          id: d.id,
          workerName: data.workerName || '',
          workerDocument: data.workerDocument || '',
          arlProvider: data.arlProvider || '',
          arlExpiresAt: data.arlExpiresAt || '',
          unit: data.unit || '',
          tower: data.tower || '',
          registeredBy: data.registeredBy || '',
          notes: data.notes || '',
          createdAt: data.createdAt,
        });
      });
      setContractors(contList);
    } catch (e) {
      console.error('Error cargando mudanzas/contratistas:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user, currentRole]);

  // Programar mudanza
  const handleScheduleMove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.tenantId) return;
    setActionLoading(true);
    setErrorMessage('');
    try {
      let resTower = assignTower || 'N/A';
      let resUnit = assignUnit || 'N/A';
      let resName = `${user.firstName} ${user.lastName}`;

      if (!isAdmin && !isPorter) {
        const resSnap = await getDocs(query(collection(db, 'residents'), where('email', '==', user.email), where('tenantId', '==', user.tenantId)));
        if (!resSnap.empty) {
          const resData = resSnap.docs[0].data();
          if (resData.properties && resData.properties.length > 0) {
            resTower = resData.properties[0].tower;
            resUnit = resData.properties[0].unit;
          }
        }
      }

      await addDoc(collection(db, 'tenants', user.tenantId, 'moves'), {
        residentName: resName,
        residentEmail: user.email,
        type: moveType,
        moveDate,
        tower: resTower,
        unit: resUnit,
        status: 'PENDING',
        notes: moveNotes,
        createdAt: serverTimestamp(),
      });

      setSuccessMessage('Mudanza programada correctamente. Esperando aprobación.');
      setMoveDate('');
      setMoveNotes('');
      setAssignTower('');
      setAssignUnit('');
      setShowAddMove(false);
      fetchData();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setErrorMessage('Error al programar mudanza.');
    } finally {
      setActionLoading(false);
    }
  };

  // Procesar mudanza (Aprobar/Rechazar)
  const handleProcessMove = async (moveId: string, status: 'APPROVED' | 'REJECTED') => {
    if (!user?.tenantId) return;
    setActionLoading(true);
    try {
      await updateDoc(doc(db, 'tenants', user.tenantId, 'moves', moveId), {
        status,
      });
      setMoves((prev) =>
        prev.map((m) => (m.id === moveId ? { ...m, status } : m))
      );

      // Enviar notificación al residente
      const moveObj = moves.find(m => m.id === moveId);
      if (moveObj && moveObj.residentEmail) {
        const userSnap = await getDocs(query(collection(db, 'users'), where('email', '==', moveObj.residentEmail)));
        if (!userSnap.empty) {
          const resUid = userSnap.docs[0].id;
          await addDoc(collection(db, 'notifications'), {
            title: status === 'APPROVED' ? 'Mudanza Aprobada 📦' : 'Mudanza Rechazada ❌',
            body: `Su solicitud de mudanza para el día ${moveObj.moveDate} ha sido ${status === 'APPROVED' ? 'aprobada' : 'rechazada por administración'}.`,
            type: 'move',
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

  // Eliminar mudanza
  const handleDeleteMove = async (moveId: string) => {
    if (!user?.tenantId) return;
    if (!confirm('¿Está seguro de eliminar esta solicitud de mudanza?')) return;
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, 'tenants', user.tenantId, 'moves', moveId));
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  // Registrar contratista/obrero
  const handleCreateContractor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.tenantId) return;
    setActionLoading(true);
    try {
      let resTower = assignTower || 'N/A';
      let resUnit = assignUnit || 'N/A';

      if (!isAdmin && !isPorter) {
        const resSnap = await getDocs(query(collection(db, 'residents'), where('email', '==', user.email), where('tenantId', '==', user.tenantId)));
        if (!resSnap.empty) {
          const resData = resSnap.docs[0].data();
          if (resData.properties && resData.properties.length > 0) {
            resTower = resData.properties[0].tower;
            resUnit = resData.properties[0].unit;
          }
        }
      }

      await addDoc(collection(db, 'tenants', user.tenantId, 'contractors'), {
        workerName,
        workerDocument,
        arlProvider,
        arlExpiresAt,
        unit: resUnit,
        tower: resTower,
        registeredBy: `${user.firstName} ${user.lastName}`,
        notes: contractorNotes,
        createdAt: serverTimestamp(),
      });

      setSuccessMessage('Contratista registrado exitosamente.');
      setWorkerName('');
      setWorkerDocument('');
      setArlProvider('');
      setArlExpiresAt('');
      setContractorNotes('');
      setAssignTower('');
      setAssignUnit('');
      setShowAddContractor(false);
      fetchData();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setErrorMessage('Error al registrar contratista.');
    } finally {
      setActionLoading(false);
    }
  };

  // Eliminar Contratista
  const handleDeleteContractor = async (id: string) => {
    if (!user?.tenantId) return;
    if (!confirm('¿Está seguro de remover a este contratista?')) return;
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, 'tenants', user.tenantId, 'contractors', id));
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  // Verificar si la ARL está vencida
  const isArlExpired = (expiryStr: string) => {
    const expiryDate = new Date(expiryStr + 'T23:59:59');
    const now = new Date();
    return now > expiryDate;
  };

  return (
    <div className="space-y-8 pb-8 font-sans text-zinc-100">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center space-x-2.5">
            <Truck className="h-7 w-7 text-violet-400" />
            <span>Mudanzas & Reformas Internas</span>
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Programe sus mudanzas y registre el personal externo de reformas garantizando la seguridad con el control de ARL.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex bg-zinc-900 border border-zinc-800 p-1 rounded-xl w-fit shrink-0">
          <button
            onClick={() => setActiveTab('moves')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 ${activeTab === 'moves' ? 'bg-violet-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            <Truck className="h-4 w-4" />
            <span>Mudanzas</span>
          </button>
          <button
            onClick={() => setActiveTab('contractors')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 ${activeTab === 'contractors' ? 'bg-violet-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            <Wrench className="h-4 w-4" />
            <span>Contratistas / Reformas</span>
          </button>
        </div>
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

      {/* TAB MUDANZAS */}
      {activeTab === 'moves' && (
        <div className="space-y-6">

          <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Cronograma de Mudanzas</h3>
                <p className="text-xs text-zinc-550 mt-0.5">Control de ingresos y salidas masivas del conjunto</p>
              </div>
              <button
                onClick={() => setShowAddMove(true)}
                className="bg-violet-600 hover:bg-violet-550 text-white font-bold py-2 px-3.5 rounded-xl text-xs flex items-center space-x-1 transition-all shadow"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Programar Mudanza</span>
              </button>
            </div>

            {/* Modal Programar Mudanza */}
            <AnimatePresence>
              {showAddMove && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-2xl space-y-4"
                  >
                    <h3 className="font-bold text-zinc-100 text-sm">Programar Mudanza</h3>

                    <form onSubmit={handleScheduleMove} className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-550 mb-1">
                          Tipo de Mudanza
                        </label>
                        <select
                          value={moveType}
                          onChange={(e: any) => setMoveType(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none"
                        >
                          <option value="IN">Entrada (Move-In)</option>
                          <option value="OUT">Salida (Move-Out)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-555 mb-1">
                          Fecha de Mudanza
                        </label>
                        <input
                          type="date"
                          value={moveDate}
                          onChange={(e) => setMoveDate(e.target.value)}
                          required
                          className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none"
                        />
                      </div>

                      {/* Si es Admin, debe decir de qué inmueble es */}
                      {canApprove && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-550 mb-1">Torre</label>
                            <input
                              type="text"
                              value={assignTower}
                              onChange={(e) => setAssignTower(e.target.value)}
                              placeholder="Ej. A"
                              required
                              className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-550 mb-1">Apto / Casa</label>
                            <input
                              type="text"
                              value={assignUnit}
                              onChange={(e) => setAssignUnit(e.target.value)}
                              placeholder="Ej. 101"
                              required
                              className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none"
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-555 mb-1">
                          Observaciones
                        </label>
                        <textarea
                          value={moveNotes}
                          onChange={(e) => setMoveNotes(e.target.value)}
                          placeholder="Detalle de enseres o empresa transportadora"
                          rows={2}
                          className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none resize-none"
                        />
                      </div>

                      <div className="flex space-x-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowAddMove(false)}
                          className="flex-1 bg-zinc-850 hover:bg-zinc-800 text-zinc-350 font-bold py-2 rounded-xl text-xs"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="flex-1 bg-violet-600 hover:bg-violet-550 text-white font-bold py-2 rounded-xl text-xs shadow-lg"
                        >
                          Programar
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-zinc-905 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : moves.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-zinc-800 rounded-xl space-y-3">
                <CalendarDays className="h-10 w-10 text-zinc-700 mx-auto" />
                <p className="text-xs text-zinc-550">No hay mudanzas programadas.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {moves.map((move) => (
                  <div
                    key={move.id}
                    className="p-4 bg-zinc-955/60 rounded-xl border border-zinc-850 hover:border-zinc-750 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${move.type === 'IN' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                          {move.type === 'IN' ? 'Entrada (Move-In)' : 'Salida (Move-Out)'}
                        </span>
                        <span className="text-xs font-bold text-zinc-200">
                          {new Date(move.moveDate + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-bold bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded-full">
                          {move.tower} - {move.unit}
                        </span>
                      </div>

                      <p className="text-xs text-zinc-400 font-medium">Solicitante: {move.residentName}</p>
                      
                      {move.notes && (
                        <p className="text-[10px] text-zinc-550 italic">
                          &ldquo;{move.notes}&rdquo;
                        </p>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      {move.status === 'PENDING' ? (
                        canApprove ? (
                          <div className="flex space-x-1.5">
                            <button
                              onClick={() => handleProcessMove(move.id, 'APPROVED')}
                              disabled={actionLoading}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-[10px] transition-all flex items-center space-x-1 shadow"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Aprobar</span>
                            </button>
                            <button
                              onClick={() => handleProcessMove(move.id, 'REJECTED')}
                              disabled={actionLoading}
                              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-505 text-white font-bold rounded-xl text-[10px] transition-all flex items-center space-x-1 shadow"
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
                      ) : move.status === 'APPROVED' ? (
                        <div className="flex items-center space-x-2">
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Aprobada</span>
                          </span>
                          {!canApprove && (
                            <button
                              onClick={() => handleDeleteMove(move.id)}
                              className="text-zinc-650 hover:text-rose-400 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 border border-rose-500/20 text-rose-455">
                            <XCircle className="h-3 w-3" />
                            <span>Rechazada</span>
                          </span>
                          {!canApprove && (
                            <button
                              onClick={() => handleDeleteMove(move.id)}
                              className="text-zinc-650 hover:text-rose-400 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTRATISTAS */}
      {activeTab === 'contractors' && (
        <div className="space-y-6">

          <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Control de Contratistas & Obreros</h3>
                <p className="text-xs text-zinc-550 mt-0.5">Control de ingresos por reformas y vencimiento de planillas ARL</p>
              </div>
              <button
                onClick={() => setShowAddContractor(true)}
                className="bg-violet-600 hover:bg-violet-550 text-white font-bold py-2 px-3.5 rounded-xl text-xs flex items-center space-x-1 transition-all shadow"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Registrar Obrero</span>
              </button>
            </div>

            {/* Modal Registrar Contratista */}
            <AnimatePresence>
              {showAddContractor && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-2xl space-y-4"
                  >
                    <h3 className="font-bold text-zinc-100 text-sm">Registrar Obrero / Contratista</h3>

                    <form onSubmit={handleCreateContractor} className="space-y-3.5">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-550 mb-1">
                            Nombre Completo
                          </label>
                          <input
                            type="text"
                            value={workerName}
                            onChange={(e) => setWorkerName(e.target.value)}
                            placeholder="Ej. Pedro Pérez"
                            required
                            className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-550 mb-1">
                            Documento / Cédula
                          </label>
                          <input
                            type="text"
                            value={workerDocument}
                            onChange={(e) => setWorkerDocument(e.target.value)}
                            placeholder="Ej. 10293848"
                            required
                            className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-550 mb-1">
                            Aseguradora ARL
                          </label>
                          <input
                            type="text"
                            value={arlProvider}
                            onChange={(e) => setArlProvider(e.target.value)}
                            placeholder="Ej. Positiva, Sura"
                            required
                            className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-550 mb-1">
                            Vencimiento Planilla ARL
                          </label>
                          <input
                            type="date"
                            value={arlExpiresAt}
                            onChange={(e) => setArlExpiresAt(e.target.value)}
                            required
                            className="w-full bg-zinc-950 border border-zinc-855 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Si es Admin, debe decir de qué inmueble es */}
                      {canApprove && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-550 mb-1">Torre</label>
                            <input
                              type="text"
                              value={assignTower}
                              onChange={(e) => setAssignTower(e.target.value)}
                              placeholder="Ej. A"
                              required
                              className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-550 mb-1">Apto / Casa</label>
                            <input
                              type="text"
                              value={assignUnit}
                              onChange={(e) => setAssignUnit(e.target.value)}
                              placeholder="Ej. 101"
                              required
                              className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none"
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-555 mb-1">
                          Notas / Reformas Autorizadas
                        </label>
                        <textarea
                          value={contractorNotes}
                          onChange={(e) => setContractorNotes(e.target.value)}
                          placeholder="Ej. Obra de pintura en el apto. Autorizado ingreso L-V de 8:00 a 17:00"
                          rows={2}
                          className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none resize-none"
                        />
                      </div>

                      <div className="flex space-x-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowAddContractor(false)}
                          className="flex-1 bg-zinc-850 hover:bg-zinc-800 text-zinc-350 font-bold py-2 rounded-xl text-xs"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="flex-1 bg-violet-600 hover:bg-violet-550 text-white font-bold py-2 rounded-xl text-xs shadow-lg"
                        >
                          Registrar
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-zinc-905 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : contractors.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-zinc-850 rounded-xl">
                <Wrench className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
                <p className="text-xs text-zinc-550">No hay obreros o contratistas registrados.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {contractors.map((cont) => {
                  const expired = isArlExpired(cont.arlExpiresAt);
                  return (
                    <div
                      key={cont.id}
                      className={`p-4 rounded-xl border bg-zinc-955/50 hover:border-zinc-700 transition-colors flex flex-col justify-between space-y-3 relative group ${expired ? 'border-rose-500/25 bg-rose-500/5' : 'border-zinc-850'}`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${expired ? 'bg-rose-550/15 text-rose-400 border border-rose-500/20 animate-pulse' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                            {expired ? <ShieldAlert className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                            <span>{expired ? 'ARL VENCIDA' : 'ARL VIGENTE'}</span>
                          </span>
                          <span className="text-[10px] text-zinc-500 font-bold">
                            {cont.tower} - {cont.unit}
                          </span>
                        </div>

                        <div>
                          <h4 className="text-sm font-bold text-zinc-200">{cont.workerName}</h4>
                          <p className="text-[10px] text-zinc-500 font-mono">C.C. {cont.workerDocument}</p>
                        </div>

                        <div className="space-y-1 text-[10px] text-zinc-400">
                          <p>Aseguradora: <span className="font-semibold text-zinc-300">{cont.arlProvider}</span></p>
                          <p>Vence: <span className={`font-semibold ${expired ? 'text-rose-400 font-bold' : 'text-zinc-350'}`}>{cont.arlExpiresAt}</span></p>
                        </div>

                        {cont.notes && (
                          <p className="text-[10px] text-zinc-550 mt-2 bg-zinc-900/60 p-2 rounded-lg italic">
                            &ldquo;{cont.notes}&rdquo;
                          </p>
                        )}
                      </div>

                      {(isAdmin || isPorter) && (
                        <button
                          onClick={() => handleDeleteContractor(cont.id)}
                          className="w-full bg-zinc-900/50 hover:bg-rose-500/10 text-[9px] font-bold text-zinc-550 hover:text-rose-455 py-1.5 rounded-lg border border-zinc-900 hover:border-rose-500/20 transition-all mt-2"
                        >
                          Remover Personal
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
