'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import {
  Building,
  Plus,
  Loader2,
  TrendingUp,
  Receipt,
  UserCheck,
  Building2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Owner {
  firstName: string;
  lastName: string;
  phone: string | null;
}

interface ResidentRelation {
  resident: {
    firstName: string;
    lastName: string;
  };
  isPrimary: boolean;
}

interface Wallet {
  balance: number;
}

interface Property {
  id: string;
  tower: string;
  unit: string;
  type: string;
  area: number;
  coefficient: number;
  owner: Owner | null;
  wallet: Wallet | null;
  residents: ResidentRelation[];
}

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal de creación
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Formulario
  const [tower, setTower] = useState('');
  const [unit, setUnit] = useState('');
  const [type, setType] = useState('apartamento');
  const [area, setArea] = useState('');
  const [coefficient, setCoefficient] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const loadProperties = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Property[]>('/properties');
      setProperties(data);
    } catch (err: any) {
      setError(err.message || 'Error al cargar inmuebles.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProperties();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tower || !unit || !type || !area || !coefficient) {
      setFormError('Todos los campos son obligatorios.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      await api.post('/properties', {
        tower,
        unit,
        type,
        area: parseFloat(area),
        coefficient: parseFloat(coefficient),
      });

      // Limpiar campos
      setTower('');
      setUnit('');
      setType('apartamento');
      setArea('');
      setCoefficient('');
      setIsCreateOpen(false);

      // Recargar datos
      await loadProperties();
    } catch (err: any) {
      setFormError(err.message || 'Error al crear inmueble.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 flex items-center space-x-2">
            <Building className="h-7 w-7 text-indigo-500" />
            <span>Módulo de Inmuebles</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Visualización y alta de apartamentos, casas, locales u oficinas y sus saldos de cartera.
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
          <span>Agregar Inmueble</span>
        </button>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 text-indigo-500 animate-spin mb-3" />
          <p className="text-xs text-slate-500">Cargando inmuebles...</p>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-200 text-sm">
          {error}
        </div>
      ) : properties.length === 0 ? (
        <div className="p-10 border border-dashed border-slate-800 rounded-2xl text-center">
          <p className="text-sm text-slate-500">No se encontraron inmuebles registrados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((prop) => {
            const primaryResident = prop.residents.find(r => r.isPrimary)?.resident;
            const balance = prop.wallet?.balance ?? 0;
            const hasDebt = balance > 0;

            return (
              <motion.div
                key={prop.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-5 rounded-2xl border border-slate-900 bg-slate-900/20 hover:border-slate-800 transition-all flex flex-col justify-between space-y-5"
              >
                {/* Title & Type */}
                <div className="flex justify-between items-start">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2.5 bg-slate-950/40 rounded-xl border border-slate-800/80">
                      <Building2 className="h-5 w-5 text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-200">{prop.tower} - {prop.unit}</h3>
                      <p className="text-[10px] text-slate-500 capitalize">{prop.type}</p>
                    </div>
                  </div>

                  <span
                    className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full ${
                      hasDebt
                        ? 'text-red-400 bg-red-500/10 border border-red-500/20'
                        : 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                    }`}
                  >
                    {hasDebt ? `Deuda: $${balance.toLocaleString()}` : 'Al Día'}
                  </span>
                </div>

                {/* Info Fields */}
                <div className="grid grid-cols-2 gap-4 text-xs pt-2 border-t border-b border-slate-800/30 py-3">
                  <div>
                    <span className="text-slate-500 block">Área</span>
                    <span className="font-semibold text-slate-300">{prop.area} m²</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Coeficiente</span>
                    <span className="font-semibold text-slate-300">{(prop.coefficient * 100).toFixed(3)}%</span>
                  </div>
                </div>

                {/* Relations */}
                <div className="space-y-2.5 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Copropietario</span>
                    <span className="text-slate-300 font-medium">
                      {prop.owner ? `${prop.owner.firstName} ${prop.owner.lastName}` : 'No asignado'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Residente Principal</span>
                    <span className="text-slate-300 font-medium">
                      {primaryResident ? `${primaryResident.firstName} ${primaryResident.lastName}` : 'No asignado'}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Modal - Agregar Inmueble */}
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
              className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-md shadow-2xl relative z-10"
            >
              <h3 className="text-lg font-bold text-slate-100 mb-2">Agregar Nuevo Inmueble</h3>
              <p className="text-xs text-slate-500 mb-6">
                Cree un inmueble en el conjunto. Se inicializará su saldo de cartera en $0 automáticamente.
              </p>

              {formError && (
                <div className="mb-4 p-3 rounded-lg border border-red-500/20 bg-red-500/10 text-red-200 text-xs">
                  {formError}
                </div>
              )}

              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Torre / Bloque *</label>
                    <input
                      type="text"
                      required
                      value={tower}
                      onChange={(e) => setTower(e.target.value)}
                      placeholder="Ej: Torre 1"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 transition-colors text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Unidad (Apto/Casa) *</label>
                    <input
                      type="text"
                      required
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      placeholder="Ej: Apto 101"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 transition-colors text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Tipo de Unidad *</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 focus:outline-none focus:border-indigo-500/80 transition-colors text-xs"
                  >
                    <option value="apartamento">Apartamento</option>
                    <option value="casa">Casa</option>
                    <option value="local">Local Comercial</option>
                    <option value="oficina">Oficina</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Área (m²) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      placeholder="85.5"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 transition-colors text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Coeficiente Copropiedad *</label>
                    <input
                      type="number"
                      step="0.0001"
                      required
                      value={coefficient}
                      onChange={(e) => setCoefficient(e.target.value)}
                      placeholder="0.0125"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 transition-colors text-xs"
                    />
                  </div>
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
                    <span>Guardar Inmueble</span>
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
