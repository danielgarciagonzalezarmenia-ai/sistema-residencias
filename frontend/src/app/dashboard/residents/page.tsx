'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import {
  Users,
  Search,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
  Filter,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PropertyRelation {
  property: {
    id: string;
    tower: string;
    unit: string;
  };
  isPrimary: boolean;
}

interface Resident {
  id: string;
  firstName: string;
  lastName: string;
  document: string;
  email: string;
  phone: string | null;
  status: string;
  createdAt: string;
  properties: PropertyRelation[];
}

interface Property {
  id: string;
  tower: string;
  unit: string;
}

export default function ResidentsPage() {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [filterTower, setFilterTower] = useState('');
  const [filterUnit, setFilterUnit] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Estados de modales
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Formulario de creación
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [document, setDocument] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Cargar datos
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Cargar residentes con filtros
      const queryParams = new URLSearchParams();
      if (filterTower) queryParams.append('tower', filterTower);
      if (filterUnit) queryParams.append('unit', filterUnit);
      if (filterStatus) queryParams.append('status', filterStatus);

      const residentsData = await api.get<Resident[]>(`/residents?${queryParams.toString()}`);
      setResidents(residentsData);

      // Cargar inmuebles para el selector
      const propertiesData = await api.get<Property[]>('/properties');
      setProperties(propertiesData);
    } catch (err: any) {
      setError(err.message || 'Error al cargar residentes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterTower, filterUnit, filterStatus]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !document || !email) {
      setFormError('Los campos Nombre, Apellido, Documento y Correo son obligatorios.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      await api.post('/residents', {
        firstName,
        lastName,
        document,
        email,
        phone: phone || undefined,
        propertyId: selectedPropertyId || undefined,
      });

      // Limpiar campos
      setFirstName('');
      setLastName('');
      setDocument('');
      setEmail('');
      setPhone('');
      setSelectedPropertyId('');
      setIsCreateOpen(false);

      // Recargar datos
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Error al crear residente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await api.put(`/residents/${id}`, { status: nextStatus });
      await loadData();
    } catch (err: any) {
      alert(`Error al cambiar estado: ${err.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar lógicamente a este residente? Su estado cambiará a Inactivo.')) {
      return;
    }
    try {
      await api.delete(`/residents/${id}`);
      await loadData();
    } catch (err: any) {
      alert(`Error al eliminar: ${err.message}`);
    }
  };

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
            Gestión completa de copropietarios e inquilinos registrados en el conjunto.
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

      {/* Filters Panel */}
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

      {/* Main Table Content */}
      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 text-indigo-500 animate-spin mb-3" />
          <p className="text-xs text-slate-500">Cargando residentes...</p>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-200 text-sm">
          {error}
        </div>
      ) : residents.length === 0 ? (
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
                {residents.map((resident) => (
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
                            {p.property.tower} - {p.property.unit}
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
                          title={resident.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}
                          className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(resident.id)}
                          title="Eliminar Lógico"
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

      {/* Modal - Agregar Residente */}
      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreateOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-lg shadow-2xl relative z-10"
            >
              <h3 className="text-lg font-bold text-slate-100 mb-2">Agregar Nuevo Residente</h3>
              <p className="text-xs text-slate-500 mb-6">
                Complete el formulario para dar de alta un residente y asociarlo a un inmueble.
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
