'use client';

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Wallet,
  AlertTriangle,
  TrendingUp,
  FileText,
  Calendar,
  UserCheck,
  Package,
  Sparkles,
  Plus,
  ArrowUpRight,
  TrendingDown,
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function DashboardPage() {
  const { user } = useAuth();
  
  // Modales ficticios / Acciones rápidas
  const handleQuickAction = (actionName: string) => {
    alert(`[Acción Rápida - Demostración v1.0]\nSe ha solicitado la acción: "${actionName}".\nEsta funcionalidad se abrirá en un formulario interactivo.`);
  };

  // Datos de widgets (estáticos alineados con el seed)
  const stats = [
    {
      title: 'Cartera Total',
      value: '$720,000',
      change: '+12.5% vs mes anterior',
      isIncrease: true,
      icon: <Wallet className="h-6 w-6 text-indigo-400" />,
      bg: 'bg-indigo-500/10 border-indigo-500/20',
    },
    {
      title: 'Cartera Vencida',
      value: '$540,000',
      change: '2 copropietarios en mora',
      isIncrease: true,
      icon: <AlertTriangle className="h-6 w-6 text-red-400" />,
      bg: 'bg-red-500/10 border-red-500/20',
    },
    {
      title: 'Recaudo Mensual',
      value: '$180,000',
      change: 'Meta de recaudo al 25%',
      isIncrease: false,
      icon: <TrendingUp className="h-6 w-6 text-emerald-400" />,
      bg: 'bg-emerald-500/10 border-emerald-500/20',
    },
    {
      title: 'PQRS Abiertas',
      value: '2',
      change: '1 nueva por gestionar',
      isIncrease: true,
      icon: <FileText className="h-6 w-6 text-amber-400" />,
      bg: 'bg-amber-500/10 border-amber-500/20',
    },
    {
      title: 'Reservas Activas',
      value: '1',
      change: 'Salón Social / BBQ',
      isIncrease: false,
      icon: <Calendar className="h-6 w-6 text-sky-400" />,
      bg: 'bg-sky-500/10 border-sky-500/20',
    },
    {
      title: 'Visitantes Hoy',
      value: '2',
      change: 'Todos autorizados',
      isIncrease: false,
      icon: <UserCheck className="h-6 w-6 text-teal-400" />,
      bg: 'bg-teal-500/10 border-teal-500/20',
    },
    {
      title: 'Paquetes Pendientes',
      value: '2',
      change: '1 notificado',
      isIncrease: true,
      icon: <Package className="h-6 w-6 text-purple-400" />,
      bg: 'bg-purple-500/10 border-purple-500/20',
    },
  ];

  // Listado de Morosos Críticos
  const debtors = [
    {
      property: 'Torre 2 - Apto 201',
      owner: 'Carlos Restrepo',
      debt: '$540,000',
      months: 3,
      status: 'Crítico',
    },
    {
      property: 'Torre 1 - Apto 102',
      owner: 'María Rodríguez',
      debt: '$180,000',
      months: 1,
      status: 'Preventivo',
    },
  ];

  return (
    <div className="space-y-8 pb-8">
      {/* 1. WELCOME HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100">
            ¡Hola, {user?.firstName}!
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Aquí está el estado actual de la copropiedad para hoy.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => handleQuickAction('Crear Comunicado')}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-colors shadow-lg shadow-indigo-600/10"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Crear Comunicado</span>
          </button>
          <button
            onClick={() => handleQuickAction('Registrar Visitante')}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 rounded-xl transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Registrar Visitante</span>
          </button>
          <button
            onClick={() => handleQuickAction('Registrar Paquete')}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 rounded-xl transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Registrar Paquete</span>
          </button>
        </div>
      </div>

      {/* 2. AI DAILY SUMMARY */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="p-5 rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-slate-950/60 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Sparkles className="h-24 w-24 text-indigo-400" />
        </div>
        
        <div className="flex items-center space-x-2.5 text-indigo-400 mb-3">
          <Sparkles className="h-5 w-5" />
          <h3 className="text-sm font-bold uppercase tracking-wider">Asistente IA - Resumen Diario</h3>
        </div>

        <p className="text-slate-200 text-sm sm:text-base leading-relaxed">
          "Existen <strong className="text-amber-400">2 PQRS pendientes</strong> por clasificar, <strong className="text-red-400">1 pago vencido</strong> de la administración de este mes y <strong className="text-emerald-400">1 reserva aprobada</strong> para uso del área de BBQ hoy en el conjunto."
        </p>
      </motion.div>

      {/* 3. STATS WIDGETS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.05 }}
            className={`p-5 rounded-2xl border ${stat.bg} flex flex-col justify-between hover:scale-[1.02] transition-all`}
          >
            <div className="flex justify-between items-start">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {stat.title}
              </span>
              <div className="p-2 rounded-xl bg-slate-950/40">
                {stat.icon}
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-2xl font-black text-slate-100">{stat.value}</h3>
              <p className="text-xs font-medium text-slate-500 mt-1 flex items-center">
                {stat.change}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* 4. MAIN BODY DETAILS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left/Middle Content: Morosos Críticos */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 rounded-2xl border border-slate-900 bg-slate-900/20">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-200">Morosos Críticos</h3>
                <p className="text-xs text-slate-500 mt-0.5">Apartamentos con mayor retraso en cuotas de administración.</p>
              </div>
              <button 
                onClick={() => handleQuickAction('Ver reporte cartera')}
                className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
              >
                <span>Ver todo</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-400">
                <thead className="text-xs text-slate-500 uppercase border-b border-slate-800/60">
                  <tr>
                    <th className="pb-3 font-semibold">Inmueble</th>
                    <th className="pb-3 font-semibold">Propietario</th>
                    <th className="pb-3 font-semibold">Deuda</th>
                    <th className="pb-3 font-semibold text-center">Meses</th>
                    <th className="pb-3 font-semibold text-right">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {debtors.map((debtor, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/10">
                      <td className="py-3.5 font-bold text-slate-200">{debtor.property}</td>
                      <td className="py-3.5">{debtor.owner}</td>
                      <td className="py-3.5 font-semibold text-slate-200">{debtor.debt}</td>
                      <td className="py-3.5 text-center">{debtor.months}</td>
                      <td className="py-3.5 text-right">
                        <span
                          className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full ${
                            debtor.status === 'Crítico'
                              ? 'text-red-400 bg-red-500/10 border border-red-500/20'
                              : 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                          }`}
                        >
                          {debtor.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Content: Quick Financial Check */}
        <div className="space-y-6">
          <div className="p-6 rounded-2xl border border-slate-900 bg-slate-900/20 flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-200 mb-1">Recaudo y Finanzas</h3>
              <p className="text-xs text-slate-500 mb-6">Monitoreo del mes de Junio 2026.</p>

              {/* Progress bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-400">Recaudo Logrado</span>
                  <span className="text-slate-200">25% ($180,000 / $720,000)</span>
                </div>
                <div className="h-2 bg-slate-850 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: '25%' }} />
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-800/40 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Total Facturado</span>
                <span className="font-bold text-slate-300">$720,000 COP</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Meta Recaudo</span>
                <span className="font-bold text-indigo-400">$720,000 COP</span>
              </div>
              <button
                onClick={() => handleQuickAction('Registrar Pago')}
                className="w-full py-2.5 px-4 font-semibold bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 rounded-xl transition-colors text-xs flex items-center justify-center space-x-1.5"
              >
                <span>Registrar Pago Administración</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
