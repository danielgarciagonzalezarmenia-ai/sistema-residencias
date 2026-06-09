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
} from 'firebase/firestore';
import {
  Car,
  Heart,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Activity,
  Trash2,
  Search,
  ClipboardList,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ParkingSpot {
  id: string;
  spotNumber: string;
  type: 'RESIDENT' | 'VISITOR';
  status: 'FREE' | 'OCCUPIED';
  unit?: string;
  tower?: string;
  plate?: string;
  visitorName?: string;
  occupiedAt?: any;
}

interface Pet {
  id: string;
  name: string;
  type: string;
  breed: string;
  unit: string;
  tower: string;
  ownerName: string;
  vaccinated: boolean;
  notes?: string;
}

export default function ParkingPetsPage() {
  const { user, activeRole } = useAuth();
  const currentRole = activeRole || user?.role || '';
  const isAdmin = currentRole === 'ADMINISTRADOR';
  const isPorter = currentRole === 'PORTERÍA';
  const canWrite = isAdmin || isPorter;

  const [activeTab, setActiveTab] = useState<'parking' | 'pets'>('parking');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);

  // Parking Form
  const [showAddSpot, setShowAddSpot] = useState(false);
  const [spotNumber, setSpotNumber] = useState('');
  const [spotType, setSpotType] = useState<'RESIDENT' | 'VISITOR'>('RESIDENT');
  
  // Assign Parking Form
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null);
  const [assignUnit, setAssignUnit] = useState('');
  const [assignTower, setAssignTower] = useState('');
  const [assignPlate, setAssignPlate] = useState('');
  const [assignVisitorName, setAssignVisitorName] = useState('');

  // Pet Form
  const [showAddPet, setShowAddPet] = useState(false);
  const [petName, setPetName] = useState('');
  const [petType, setPetType] = useState('Perro');
  const [petBreed, setPetBreed] = useState('');
  const [petVaccinated, setPetVaccinated] = useState(true);
  const [petNotes, setPetNotes] = useState('');

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const fetchData = async () => {
    if (!user?.tenantId) return;
    setLoading(true);
    try {
      // 1. Cargar Parqueaderos
      const spotsSnap = await getDocs(collection(db, 'tenants', user.tenantId, 'parking_spots'));
      const spotsList: ParkingSpot[] = [];
      spotsSnap.forEach((d) => {
        const data = d.data();
        spotsList.push({
          id: d.id,
          spotNumber: data.spotNumber || '',
          type: data.type || 'RESIDENT',
          status: data.status || 'FREE',
          unit: data.unit || '',
          tower: data.tower || '',
          plate: data.plate || '',
          visitorName: data.visitorName || '',
          occupiedAt: data.occupiedAt,
        });
      });
      // Ordenar por número de parqueadero numéricamente
      spotsList.sort((a, b) => {
        const numA = parseInt(a.spotNumber.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.spotNumber.replace(/\D/g, '')) || 0;
        return numA - numB;
      });
      setSpots(spotsList);

      // 2. Cargar Mascotas
      const petsSnap = await getDocs(collection(db, 'tenants', user.tenantId, 'pets'));
      const petsList: Pet[] = [];
      petsSnap.forEach((d) => {
        const data = d.data();
        petsList.push({
          id: d.id,
          name: data.name || '',
          type: data.type || '',
          breed: data.breed || '',
          unit: data.unit || '',
          tower: data.tower || '',
          ownerName: data.ownerName || '',
          vaccinated: !!data.vaccinated,
          notes: data.notes || '',
        });
      });
      setPets(petsList);
    } catch (e) {
      console.error('Error cargando parqueaderos y mascotas:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // Crear celda de parqueadero (Admin)
  const handleCreateSpot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.tenantId) return;
    setActionLoading(true);
    setErrorMessage('');
    try {
      // Verificar duplicados
      if (spots.some((s) => s.spotNumber === spotNumber)) {
        throw new Error('El número de parqueadero ya existe.');
      }

      await addDoc(collection(db, 'tenants', user.tenantId, 'parking_spots'), {
        spotNumber,
        type: spotType,
        status: 'FREE',
      });

      setSuccessMessage('Parqueadero registrado correctamente.');
      setSpotNumber('');
      setShowAddSpot(false);
      fetchData();
      setTimeout(() => setSuccessMessage(''), 3050);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al registrar parqueadero.');
    } finally {
      setActionLoading(false);
    }
  };

  // Guardar asignación/cambio de estado en celda
  const handleAssignSpotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.tenantId || !selectedSpot) return;
    setActionLoading(true);
    try {
      const updateData: any = {
        status: 'OCCUPIED',
        plate: assignPlate.toUpperCase(),
        occupiedAt: serverTimestamp(),
      };

      if (selectedSpot.type === 'RESIDENT') {
        updateData.unit = assignUnit;
        updateData.tower = assignTower;
      } else {
        updateData.visitorName = assignVisitorName;
      }

      await updateDoc(doc(db, 'tenants', user.tenantId, 'parking_spots', selectedSpot.id), updateData);
      
      setSuccessMessage('Celda asignada exitosamente.');
      setSelectedSpot(null);
      setAssignUnit('');
      setAssignTower('');
      setAssignPlate('');
      setAssignVisitorName('');
      fetchData();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setErrorMessage('Error al asignar parqueadero.');
    } finally {
      setActionLoading(false);
    }
  };

  // Liberar Celda
  const handleFreeSpot = async (spotId: string) => {
    if (!user?.tenantId) return;
    if (!confirm('¿Está seguro de liberar este parqueadero? El vehículo registrado será removido.')) return;
    setActionLoading(true);
    try {
      await updateDoc(doc(db, 'tenants', user.tenantId, 'parking_spots', spotId), {
        status: 'FREE',
        unit: '',
        tower: '',
        plate: '',
        visitorName: '',
        occupiedAt: null,
      });
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  // Eliminar Celda por Completo (Admin)
  const handleDeleteSpot = async (spotId: string) => {
    if (!user?.tenantId) return;
    if (!confirm('¿Está seguro de eliminar esta celda de la base de datos?')) return;
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, 'tenants', user.tenantId, 'parking_spots', spotId));
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  // Registrar mascota
  const handleCreatePet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.tenantId) return;
    setActionLoading(true);
    try {
      // Buscar torre/apto de residente o usar ingresados
      let resTower = 'N/A';
      let resUnit = 'N/A';
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
      } else {
        resTower = assignTower || 'N/A';
        resUnit = assignUnit || 'N/A';
        resName = assignVisitorName || 'Administrador';
      }

      await addDoc(collection(db, 'tenants', user.tenantId, 'pets'), {
        name: petName,
        type: petType,
        breed: petBreed,
        vaccinated: petVaccinated,
        unit: resUnit,
        tower: resTower,
        ownerName: resName,
        notes: petNotes,
        createdAt: serverTimestamp(),
      });

      setSuccessMessage('Mascota registrada correctamente en el directorio.');
      setPetName('');
      setPetBreed('');
      setPetNotes('');
      setAssignTower('');
      setAssignUnit('');
      setAssignVisitorName('');
      setShowAddPet(false);
      fetchData();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setErrorMessage('Error al registrar mascota.');
    } finally {
      setActionLoading(false);
    }
  };

  // Eliminar mascota (Admin o dueño)
  const handleDeletePet = async (petId: string) => {
    if (!user?.tenantId) return;
    if (!confirm('¿Está seguro de eliminar esta mascota del registro?')) return;
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, 'tenants', user.tenantId, 'pets', petId));
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  // Filtrar conteos
  const totalVisitorSpots = spots.filter(s => s.type === 'VISITOR').length;
  const occupiedVisitorSpots = spots.filter(s => s.type === 'VISITOR' && s.status === 'OCCUPIED').length;
  const freeVisitorSpots = totalVisitorSpots - occupiedVisitorSpots;

  return (
    <div className="space-y-8 pb-8 font-sans text-zinc-100">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center space-x-2.5">
            <Car className="h-7 w-7 text-violet-400" />
            <span>Vehículos, Parqueo & Mascotas</span>
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Gestión y directorio de celdas de parqueaderos, parqueos de visitantes en tiempo real, y mascotas registradas.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex bg-zinc-900 border border-zinc-800 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('parking')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 ${activeTab === 'parking' ? 'bg-violet-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            <Car className="h-4 w-4" />
            <span>Parqueaderos</span>
          </button>
          <button
            onClick={() => setActiveTab('pets')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 ${activeTab === 'pets' ? 'bg-violet-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            <Heart className="h-4 w-4" />
            <span>Mascotas</span>
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

      {/* TAB PARQUEADEROS */}
      {activeTab === 'parking' && (
        <div className="space-y-6">
          
          {/* Stats de Visitantes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl border border-zinc-850 bg-zinc-900/40">
              <p className="text-2xl font-bold text-zinc-150">{freeVisitorSpots}</p>
              <p className="text-xs text-zinc-500 mt-0.5">Celdas Visitantes Libres</p>
            </div>
            <div className="p-5 rounded-2xl border border-zinc-850 bg-zinc-900/40">
              <p className="text-2xl font-bold text-violet-400">{occupiedVisitorSpots}</p>
              <p className="text-xs text-zinc-500 mt-0.5">Celdas Visitantes Ocupadas</p>
            </div>
            <div className="p-5 rounded-2xl border border-zinc-850 bg-zinc-900/40">
              <p className="text-2xl font-bold text-zinc-300">{totalVisitorSpots}</p>
              <p className="text-xs text-zinc-500 mt-0.5">Total Parqueo Visitantes</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Listado de Celdas</h3>
                <p className="text-xs text-zinc-550 mt-0.5">Asignación y estado en vivo de los parqueaderos</p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => setShowAddSpot(true)}
                  className="bg-violet-600 hover:bg-violet-550 text-white font-bold py-2 px-3.5 rounded-xl text-xs flex items-center space-x-1 transition-all shadow"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Crear Celda</span>
                </button>
              )}
            </div>

            {/* Modal Crear Celda */}
            <AnimatePresence>
              {showAddSpot && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-2xl space-y-4"
                  >
                    <h3 className="font-bold text-zinc-100 text-sm">Registrar Nueva Celda</h3>
                    
                    <form onSubmit={handleCreateSpot} className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-550 mb-1">
                          Número de Celda / Parqueadero
                        </label>
                        <input
                          type="text"
                          value={spotNumber}
                          onChange={(e) => setSpotNumber(e.target.value)}
                          placeholder="Ej. P-101, 15, V-02"
                          required
                          className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-violet-550/50"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-550 mb-1">
                          Tipo de Parqueadero
                        </label>
                        <select
                          value={spotType}
                          onChange={(e: any) => setSpotType(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-violet-555/50"
                        >
                          <option value="RESIDENT">Residente Fijo</option>
                          <option value="VISITOR">Visitantes / Temporal</option>
                        </select>
                      </div>

                      <div className="flex space-x-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowAddSpot(false)}
                          className="flex-1 bg-zinc-850 hover:bg-zinc-800 text-zinc-350 font-bold py-2 rounded-xl text-xs"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="flex-1 bg-violet-600 hover:bg-violet-550 text-white font-bold py-2 rounded-xl text-xs shadow-lg"
                        >
                          Guardar
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Modal Asignar Celda */}
            <AnimatePresence>
              {selectedSpot && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-2xl space-y-4"
                  >
                    <h3 className="font-bold text-zinc-100 text-sm">
                      Asignar Celda #{selectedSpot.spotNumber} ({selectedSpot.type === 'RESIDENT' ? 'Residente' : 'Visitante'})
                    </h3>

                    <form onSubmit={handleAssignSpotSubmit} className="space-y-4">
                      {selectedSpot.type === 'RESIDENT' ? (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-550 mb-1">Torre</label>
                            <input
                              type="text"
                              value={assignTower}
                              onChange={(e) => setAssignTower(e.target.value)}
                              placeholder="Ej. Torre A"
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
                      ) : (
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-550 mb-1">Nombre Visitante</label>
                          <input
                            type="text"
                            value={assignVisitorName}
                            onChange={(e) => setAssignVisitorName(e.target.value)}
                            placeholder="Ej. Daniel Garcia"
                            required
                            className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-550 mb-1">
                          Placa del Vehículo
                        </label>
                        <input
                          type="text"
                          value={assignPlate}
                          onChange={(e) => setAssignPlate(e.target.value)}
                          placeholder="Ej. XYZ-456"
                          required
                          className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-violet-500/50 uppercase"
                        />
                      </div>

                      <div className="flex space-x-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setSelectedSpot(null)}
                          className="flex-1 bg-zinc-850 hover:bg-zinc-800 text-zinc-350 font-bold py-2 rounded-xl text-xs"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="flex-1 bg-violet-600 hover:bg-violet-550 text-white font-bold py-2 rounded-xl text-xs shadow-lg"
                        >
                          Asignar
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-24 bg-zinc-900/60 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : spots.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-zinc-800 rounded-xl">
                <Car className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
                <p className="text-xs text-zinc-500">No hay parqueaderos registrados.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {spots.map((spot) => (
                  <div
                    key={spot.id}
                    className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 relative overflow-hidden ${spot.status === 'OCCUPIED' ? 'bg-zinc-950/80 border-violet-500/20' : 'bg-zinc-950/40 border-zinc-850'}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                          {spot.type === 'RESIDENT' ? 'Residente' : 'Visitante'}
                        </span>
                        <p className="text-base font-bold text-zinc-200">#{spot.spotNumber}</p>
                      </div>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold ${spot.status === 'OCCUPIED' ? 'bg-violet-500/10 text-violet-400' : 'bg-zinc-800 text-zinc-500'}`}>
                        {spot.status === 'OCCUPIED' ? 'Ocupado' : 'Libre'}
                      </span>
                    </div>

                    {spot.status === 'OCCUPIED' ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-violet-300 font-mono">{spot.plate}</span>
                          {spot.type === 'RESIDENT' ? (
                            <span className="text-[9px] text-zinc-400 font-bold bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded-full">
                              {spot.tower} - {spot.unit}
                            </span>
                          ) : (
                            <span className="text-[9px] text-zinc-400 font-bold truncate max-w-[80px]">
                              {spot.visitorName}
                            </span>
                          )}
                        </div>
                        {canWrite && (
                          <button
                            onClick={() => handleFreeSpot(spot.id)}
                            className="w-full bg-zinc-900 hover:bg-rose-500/10 text-[9px] font-bold text-zinc-450 hover:text-rose-400 py-1 rounded-lg border border-zinc-800 hover:border-rose-500/20 transition-all"
                          >
                            Liberar Celda
                          </button>
                        )}
                      </div>
                    ) : (
                      <div>
                        {canWrite ? (
                          <button
                            onClick={() => setSelectedSpot(spot)}
                            className="w-full bg-violet-600/10 hover:bg-violet-600/20 border border-violet-500/20 hover:border-violet-500/30 text-violet-300 font-bold py-1.5 rounded-lg text-[10px] transition-all"
                          >
                            Asignar Ingreso
                          </button>
                        ) : (
                          <p className="text-[10px] text-zinc-650 italic">Sin asignar</p>
                        )}
                      </div>
                    )}

                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteSpot(spot.id)}
                        className="absolute bottom-2 right-2 text-zinc-650 hover:text-rose-400 transition-colors hidden group-hover:block"
                        title="Eliminar parqueadero"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB MASCOTAS */}
      {activeTab === 'pets' && (
        <div className="space-y-6">

          <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Directorio de Mascotas</h3>
                <p className="text-xs text-zinc-550 mt-0.5">Censo y registro de mascotas del conjunto residencial</p>
              </div>
              <button
                onClick={() => setShowAddPet(true)}
                className="bg-violet-600 hover:bg-violet-550 text-white font-bold py-2 px-3.5 rounded-xl text-xs flex items-center space-x-1 transition-all shadow"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Registrar Mascota</span>
              </button>
            </div>

            {/* Modal Crear Mascota */}
            <AnimatePresence>
              {showAddPet && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-2xl space-y-4"
                  >
                    <h3 className="font-bold text-zinc-100 text-sm">Registrar Mascota</h3>

                    <form onSubmit={handleCreatePet} className="space-y-3.5">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-550 mb-1">
                            Nombre
                          </label>
                          <input
                            type="text"
                            value={petName}
                            onChange={(e) => setPetName(e.target.value)}
                            placeholder="Ej. Toby"
                            required
                            className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-550 mb-1">
                            Tipo de Mascota
                          </label>
                          <select
                            value={petType}
                            onChange={(e) => setPetType(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none"
                          >
                            <option value="Perro">Perro</option>
                            <option value="Gato">Gato</option>
                            <option value="Otro">Otro</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-550 mb-1">
                            Raza
                          </label>
                          <input
                            type="text"
                            value={petBreed}
                            onChange={(e) => setPetBreed(e.target.value)}
                            placeholder="Ej. Golden Retriever"
                            required
                            className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-550 mb-1">
                            Vacunas al Día
                          </label>
                          <select
                            value={petVaccinated ? 'true' : 'false'}
                            onChange={(e) => setPetVaccinated(e.target.value === 'true')}
                            className="w-full bg-zinc-950 border border-zinc-855 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none"
                          >
                            <option value="true">Sí, Carné al día</option>
                            <option value="false">No / Pendiente</option>
                          </select>
                        </div>
                      </div>

                      {/* Si es Admin, debe decir de qué inmueble es */}
                      {isAdmin && (
                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-1">
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-550 mb-1">Torre</label>
                            <input
                              type="text"
                              value={assignTower}
                              onChange={(e) => setAssignTower(e.target.value)}
                              placeholder="Torre 1"
                              required
                              className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none"
                            />
                          </div>
                          <div className="col-span-1">
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-550 mb-1">Apto</label>
                            <input
                              type="text"
                              value={assignUnit}
                              onChange={(e) => setAssignUnit(e.target.value)}
                              placeholder="101"
                              required
                              className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none"
                            />
                          </div>
                          <div className="col-span-1">
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-550 mb-1">Dueño</label>
                            <input
                              type="text"
                              value={assignVisitorName}
                              onChange={(e) => setAssignVisitorName(e.target.value)}
                              placeholder="Nombre"
                              required
                              className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none"
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-550 mb-1">
                          Observaciones
                        </label>
                        <textarea
                          value={petNotes}
                          onChange={(e) => setPetNotes(e.target.value)}
                          placeholder="Comentarios sobre el cuidado o comportamiento"
                          rows={2}
                          className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none resize-none"
                        />
                      </div>

                      <div className="flex space-x-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowAddPet(false)}
                          className="flex-1 bg-zinc-850 hover:bg-zinc-800 text-zinc-350 font-bold py-2 rounded-xl text-xs"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="flex-1 bg-violet-600 hover:bg-violet-550 text-white font-bold py-2 rounded-xl text-xs shadow-lg"
                        >
                          Guardar Mascota
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
            ) : pets.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-zinc-850 rounded-xl">
                <Heart className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
                <p className="text-xs text-zinc-500">No hay mascotas registradas aún.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pets.map((pet) => (
                  <div
                    key={pet.id}
                    className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/50 hover:border-zinc-700 transition-colors flex flex-col justify-between space-y-3 relative group"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">
                          {pet.type}
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${pet.vaccinated ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-455 border border-rose-500/20'}`}>
                          {pet.vaccinated ? 'Vacunación al Día' : 'Vacunas Pendientes'}
                        </span>
                      </div>

                      <div className="mt-3">
                        <h4 className="text-sm font-bold text-zinc-200">{pet.name}</h4>
                        <p className="text-xs text-zinc-450">{pet.breed}</p>
                      </div>

                      <div className="mt-2.5 pt-2.5 border-t border-zinc-900 flex justify-between items-center text-[10px] text-zinc-500">
                        <span>Dueño: <strong className="text-zinc-400 font-semibold">{pet.ownerName}</strong></span>
                        <span className="font-semibold text-zinc-400">{pet.tower} - {pet.unit}</span>
                      </div>

                      {pet.notes && (
                        <p className="text-[10px] text-zinc-550 mt-2 bg-zinc-900/60 p-2 rounded-lg italic">
                          &ldquo;{pet.notes}&rdquo;
                        </p>
                      )}
                    </div>

                    {(isAdmin || (user && pet.ownerName === `${user.firstName} ${user.lastName}`)) && (
                      <button
                        onClick={() => handleDeletePet(pet.id)}
                        className="w-full bg-zinc-900/50 hover:bg-rose-500/10 text-[9px] font-bold text-zinc-550 hover:text-rose-400 py-1 rounded-lg border border-zinc-900 hover:border-rose-500/20 transition-all mt-2"
                      >
                        Eliminar Registro
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

          </div>

        </div>
      )}

    </div>
  );
}
