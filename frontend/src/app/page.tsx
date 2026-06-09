'use client';

import Link from 'next/link';
import { ArrowRight, Building2, Shield, BrainCircuit, Users, Receipt, MailOpen } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Home() {
  const features = [
    {
      icon: <BrainCircuit className="h-6 w-6 text-indigo-400" />,
      title: 'Resumen IA Diario',
      description: 'Reportes generados por Inteligencia Artificial sobre novedades, PQRS pendientes y finanzas del día.',
    },
    {
      icon: <Receipt className="h-6 w-6 text-emerald-400" />,
      title: 'Control de Cartera',
      description: 'Gestión inteligente de cuotas ordinarias, intereses automáticos, y pasarela de pago PSE.',
    },
    {
      icon: <Users className="h-6 w-6 text-sky-400" />,
      title: 'Portal de Residentes',
      description: 'Registro de copropietarios, autorizaciones de vehículos y reserva de zonas comunes.',
    },
    {
      icon: <MailOpen className="h-6 w-6 text-amber-400" />,
      title: 'Portería Inteligente',
      description: 'Control ágil de correspondencia con notificaciones push y registro de visitantes por QR.',
    },
  ];

  return (
    <div className="flex-1 flex flex-col bg-slate-950 text-slate-100 overflow-x-hidden">
      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Building2 className="h-8 w-8 text-indigo-500" />
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 bg-clip-text text-transparent">
              Acacias Smart
            </span>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/20"
          >
            Ingresar al Portal
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative py-20 lg:py-32 flex flex-col items-center justify-center text-center px-4">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.08),transparent_50%)] pointer-events-none" />
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl mx-auto"
          >
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-xs font-semibold mb-6">
              <Shield className="h-3.5 w-3.5" />
              <span>SaaS Multi-Tenant para Colombia</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight mb-6 leading-tight">
              Administración Inteligente para{' '}
              <span className="bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 bg-clip-text text-transparent">
                Conjuntos Residenciales
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10">
              Moderniza la copropiedad con IA, automatiza la facturación de cartera, gestiona PQRS, correspondencia, reservas y seguridad en una única plataforma móvil.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
              <Link
                href="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 text-base font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/30 group"
              >
                Comenzar ahora
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a
                href="#features"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 text-base font-semibold text-slate-300 border border-slate-800 rounded-xl hover:bg-slate-900/60 transition-colors"
              >
                Conocer más
              </a>
            </div>
          </motion.div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 bg-slate-900/40 border-t border-slate-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Todo lo que tu conjunto necesita</h2>
              <p className="text-slate-400">
                Módulos integrados y diseñados bajo un enfoque Mobile-First para administradores, porteros y residentes.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {features.map((feature, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  className="p-6 rounded-2xl border border-slate-800 bg-slate-950/50 hover:border-indigo-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/5"
                >
                  <div className="p-3 bg-slate-900 rounded-xl inline-block mb-4">
                    {feature.icon}
                  </div>
                  <h3 className="text-lg font-bold mb-2 text-slate-100">{feature.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{feature.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-10 text-center text-sm text-slate-500">
        <p>© 2026 Acacias Smart. Todos los derechos reservados. Diseñado para copropiedades modernas.</p>
      </footer>
    </div>
  );
}
