'use client';

import React, { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../context/AuthContext';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  orderBy,
} from 'firebase/firestore';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ResidentProperty {
  id: string;
  tower: string;
  unit: string;
}

interface Resident {
  id: string;
  firstName: string;
  lastName: string;
  document: string;
  email: string;
  phone: string;
  status: string;
  tenantId: string;
  properties: ResidentProperty[];
  createdAt: any;
}

interface Property {
  id: string;
  tower: string;
  unit: string;
}

export default function ResidentsPage() {
  const { user } = useAuth();
  const [residents, setResidents] = useState<Resident[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [filterTower, setFilterTower] = useState('');
  const [filterUnit, setFilterUnit] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modales
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Formulario
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [document, setDocument] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = async () => {
    if (!user?.tenantId) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Cargar residentes de este Tenant
      const residentsQuery = query(
        collection(db, 'residents'),
        where('tenantId', '==', user.tenantId)
      );
      const residentsSnap = await getDocs(residentsQuery);
      const residentsList: Resident[] = [];
      residentsSnap.forEach((doc) => {
        const data = doc.data();
        residentsList.push({
          id: doc.id,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          document: data.document || '',
          email: data.email || '',
          phone: data.phone || '',
          status: data.status || 'ACTIVE',
          tenantId: data.tenantId || '',
          properties: data.properties || [],
          createdAt: data.createdAt,
        });
      });
      setResidents(residentsList);

      // 2. Cargar inmuebles de este Tenant para el selector
      const propertiesQuery = query(
        collection(db, 'properties'),
        where('tenantId', '==', user.tenantId)
      );
      const propertiesSnap = await getDocs(propertiesQuery);
      const propertiesList: Property[] = [];
      propertiesSnap.forEach((doc) => {
        const data = doc.data();
        propertiesList.push({
          id: doc.id,
          tower: data.tower || '',
          unit: data.unit || '',
        });
      });
      setProperties(propertiesList);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al conectar con Firestore.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !document || !email) {
      setFormError('Los campos Nombre, Apellido, Documento y Correo son obligatorios.');
      return;
    }

    if (!user?.tenantId) return;

    setIsSubmitting(true);
    setFormError(null);

    try {
      let linkedProperties: ResidentProperty[] = [];
      
      if (selectedPropertyId) {
        const prop = properties.find((p) => p.id === selectedPropertyId);
        if (prop) {
          linkedProperties.push({
            id: prop.id,
            tower: prop.tower,
            unit: prop.unit,
          });
        }
      }

      // Crear en Firestore
      await addDoc(collection(db, 'residents'), {
        firstName,
        lastName,
        document,
        email,
        phone,
        status: 'ACTIVE',
        tenantId: user.tenantId,
        properties: linkedProperties,
        createdAt: new Date(),
      });

      // Limpiar formulario
      setFirstName('');
      setLastName('');
      setDocument('');
      setEmail('');
      setPhone('');
      setSelectedPropertyId('');
      setIsCreateOpen(false);

      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Error al guardar el residente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const residentRef = doc(db, 'residents', id);
      await updateDoc(residentRef, { status: nextStatus });
      await loadData();
    } catch (err: any) {
      alert(`Error al actualizar estado: ${err.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar lógicamente a este residente? Su estado cambiará a Inactivo.')) {
      return;
    }
    try {
      const residentRef = doc(db, 'residents', id);
      await updateDoc(residentRef, { status: 'INACTIVE' });
      await loadData();
    } catch (err: any) {
      alert(`Error al desactivar: ${err.message}`);
    }
  };

  // Filtrado local para búsqueda fluida en tiempo real
  const filteredResidents = residents.filter((resident) => {
    const matchStatus = filterStatus ? resident.status === filterStatus : true;
    const matchTower = filterTower
      ? resident.properties.some((p) => p.tower.toLowerCase().includes(filterTower.toLowerCase()))
      : true;
    const matchUnit = filterUnit
      ? resident.properties.some((p) => p.unit.toLowerCase().includes(filterUnit.toLowerCase()))
      : true;

    return matchStatus && matchTower && matchUnit;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 flex items-center space-x-2">
            <Users className="h-7 w-7 text-indigo-500" />
            <span>Módulo de Residentes</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gestión de copropietarios e inquilinos registrados (Base de datos Firestore).
          </p>
        </div>

        <button
          onClick={() => {
            setFormError(null);
            setIsCreateOpen(true);
          }}
          className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-colors shadow-lg shadow-indigo-600/10"
        >
          <Plus className="h-4 w-4" />
          <span>Agregar Residente</span>
        </button>
      </div>

      {/* Filters */}
      <div className="p-4 rounded-2xl border border-slate-900 bg-slate-900/20 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5">Torre</label>
          <input
            type="text"
            placeholder="Ej: Torre 1"
            value={filterTower}
            onChange={(e) => setFilterTower(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 transition-colors text-xs"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5">Apartamento</label>
          <input
            type="text"
            placeholder="Ej: Apto 101"
            value={filterUnit}
            onChange={(e) => setFilterUnit(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 transition-colors text-xs"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5">Estado</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-300 focus:outline-none focus:border-indigo-500/80 transition-colors text-xs"
          >
            <option value="">Todos</option>
            <option value="ACTIVE">Activos</option>
            <option value="INACTIVE">Inactivos</option>
          </select>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 text-indigo-500 animate-spin mb-3" />
          <p className="text-xs text-slate-500">Cargando residentes desde Cloud Firestore...</p>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-200 text-sm">
          {error}
        </div>
      ) : filteredResidents.length === 0 ? (
        <div className="p-10 border border-dashed border-slate-800 rounded-2xl text-center">
          <p className="text-sm text-slate-500">No se encontraron residentes con los filtros especificados.</p>
        </div>
      ) : (
        <div className="border border-slate-900 bg-slate-900/15 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-400">
              <thead className="text-xs text-slate-500 uppercase border-b border-slate-800/60 bg-slate-900/30">
                <tr>
                  <th className="py-3 px-4 font-semibold">Residente</th>
                  <th className="py-3 px-4 font-semibold">Documento</th>
                  <th className="py-3 px-4 font-semibold">Contacto</th>
                  <th className="py-3 px-4 font-semibold">Inmueble</th>
                  <th className="py-3 px-4 font-semibold text-center">Estado</th>
                  <th className="py-3 px-4 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {filteredResidents.map((resident) => (
                  <tr key={resident.id} className="hover:bg-slate-900/10 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-200">
                      {resident.firstName} {resident.lastName}
                    </td>
                    <td className="py-3.5 px-4">{resident.document}</td>
                    <td className="py-3.5 px-4 text-xs">
                      <p className="text-slate-300">{resident.email}</p>
                      <p className="text-slate-500 mt-0.5">{resident.phone || 'Sin teléfono'}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      {resident.properties.length > 0 ? (
                        resident.properties.map((p, pIdx) => (
                          <span
                            key={pIdx}
                            className="inline-flex px-2 py-0.5 text-[10px] font-semibold text-slate-300 bg-slate-800 rounded-full border border-slate-700/60 mr-1"
                          >
                            {p.tower} - {p.unit}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-600 italic">No asignado</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        onClick={() => handleToggleStatus(resident.id, resident.status)}
                        className={`inline-flex items-center space-x-1 px-2 py-0.5 text-[10px] font-bold rounded-full cursor-pointer ${
                          resident.status === 'ACTIVE'
                            ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                            : 'text-slate-400 bg-slate-800 border border-slate-700'
                        }`}
                      >
                        {resident.status === 'ACTIVE' ? (
                          <>
                            <CheckCircle className="h-3 w-3" />
                            <span>Activo</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3 w-3" />
                            <span>Inactivo</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleToggleStatus(resident.id, resident.status)}
                          className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(resident.id)}
                          className="p-1.5 hover:bg-red-500/10 rounded-lg text-slate-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreateOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-lg shadow-2xl relative z-10"
            >
              <h3 className="text-lg font-bold text-slate-100 mb-2">Agregar Nuevo Residente</h3>
              <p className="text-xs text-slate-500 mb-6">
                Llene el formulario para registrar un nuevo habitante directamente en Firestore.
              </p>

              {formError && (
                <div className="mb-4 p-3 rounded-lg border border-red-500/20 bg-red-500/10 text-red-200 text-xs">
                  {formError}
                </div>
              )}

              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Nombre *</label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Juan"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 transition-colors text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Apellido *</label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Pérez"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 transition-colors text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Documento (CC/CE) *</label>
                    <input
                      type="text"
                      required
                      value={document}
                      onChange={(e) => setDocument(e.target.value)}
                      placeholder="1012345678"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 transition-colors text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Teléfono</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="3001234567"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 transition-colors text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Correo Electrónico *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="juan.perez@email.com"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 transition-colors text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Asociar a Inmueble</label>
                  <select
                    value={selectedPropertyId}
                    onChange={(e) => setSelectedPropertyId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 focus:outline-none focus:border-indigo-500/80 transition-colors text-xs"
                  >
                    <option value="">-- No asociar de inmediato --</option>
                    {properties.map((prop) => (
                      <option key={prop.id} value={prop.id}>
                        {prop.tower} - {prop.unit}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-850">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-lg shadow-indigo-600/10 flex items-center space-x-1"
                  >
                    {isSubmitting && <Loader2 className="h-3 w-3 animate-spin" />}
                    <span>Guardar Residente</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
