'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { sendEmail } from '../../../lib/mail';
import { Mail, Search, Send, CheckCircle2, User, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Resident {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  propertyInfo: string;
}

export default function GmailsPage() {
  const { user } = useAuth();
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    const fetchResidents = async () => {
      if (!user?.tenantId) return;
      try {
        const snap = await getDocs(query(collection(db, 'residents'), where('tenantId', '==', user.tenantId)));
        const list: Resident[] = [];
        snap.forEach((doc) => {
          const data = doc.data();
          let propStr = '';
          if (data.properties && data.properties.length > 0) {
            propStr = `${data.properties[0].tower} - ${data.properties[0].unit}`;
          }
          list.push({
            id: doc.id,
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            email: data.email || '',
            phone: data.phone || '',
            propertyInfo: propStr,
          });
        });
        setResidents(list);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchResidents();
  }, [user]);

  const filteredResidents = residents.filter(r => {
    const term = searchTerm.toLowerCase();
    return (
      r.firstName.toLowerCase().includes(term) ||
      r.lastName.toLowerCase().includes(term) ||
      r.email.toLowerCase().includes(term) ||
      r.propertyInfo.toLowerCase().includes(term)
    );
  });

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResident) return;
    setSending(true);
    setStatusMsg(null);
    try {
      const result = await sendEmail({
        toEmail: selectedResident.email,
        toName: `${selectedResident.firstName} ${selectedResident.lastName}`,
        subject: subject,
        message: message,
      });

      if (result.success) {
        setStatusMsg({
          text: result.mode === 'real' ? 'Correo real enviado exitosamente.' : 'Correo enviado (Modo Demo).',
          type: 'success'
        });
        setSubject('');
        setMessage('');
        setSelectedResident(null);
      } else {
        setStatusMsg({ text: result.message || 'Error al enviar el correo.', type: 'error' });
      }
    } catch (err: any) {
      console.error(err);
      setStatusMsg({ text: err.message || 'Error al enviar el correo', type: 'error' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans text-zinc-100 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center space-x-2">
          <Mail className="h-7 w-7 text-violet-400" />
          <span>Gmails & Comunicaciones</span>
        </h1>
        <p className="text-xs text-zinc-500 mt-1">
          Envíe correos electrónicos reales y personalizados a los residentes o propietarios.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Lado izquierdo: Lista de residentes */}
        <div className="lg:col-span-5 bg-zinc-900/40 border border-zinc-800 rounded-3xl p-5 flex flex-col h-[600px]">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-zinc-200 mb-2">Directorio de Residentes</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Buscar por nombre, correo o unidad..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:border-violet-500 focus:outline-none transition-all"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {loading ? (
              <div className="flex justify-center items-center h-32">
                <Loader2 className="h-6 w-6 text-violet-500 animate-spin" />
              </div>
            ) : filteredResidents.length === 0 ? (
              <div className="text-center py-8">
                <User className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
                <p className="text-xs text-zinc-500">No se encontraron residentes.</p>
              </div>
            ) : (
              filteredResidents.map(res => (
                <div
                  key={res.id}
                  onClick={() => setSelectedResident(res)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedResident?.id === res.id
                      ? 'bg-violet-600/20 border-violet-500/50'
                      : 'bg-zinc-950/50 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <p className="text-xs font-bold text-zinc-200">{res.firstName} {res.lastName}</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">{res.email}</p>
                  {res.propertyInfo && (
                    <span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400 font-semibold">
                      {res.propertyInfo}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Lado derecho: Formulario de correo */}
        <div className="lg:col-span-7 bg-zinc-900/40 border border-zinc-800 rounded-3xl p-5 flex flex-col">
          <h2 className="text-sm font-bold text-zinc-200 mb-4 flex items-center space-x-2">
            <Send className="h-4 w-4 text-violet-400" />
            <span>Redactar Correo</span>
          </h2>

          <AnimatePresence>
            {statusMsg && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`mb-4 px-4 py-3 rounded-xl text-xs font-bold flex items-center space-x-2 ${
                  statusMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                  statusMsg.type === 'error' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                  'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                }`}
              >
                {statusMsg.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                <span>{statusMsg.text}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {!selectedResident ? (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
              <Mail className="h-12 w-12 mb-3 opacity-20" />
              <p className="text-xs">Seleccione un residente del directorio para enviarle un correo.</p>
            </div>
          ) : (
            <form onSubmit={handleSendEmail} className="flex-1 flex flex-col space-y-4">
              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mb-1">Destinatario</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-zinc-200">{selectedResident.firstName} {selectedResident.lastName}</p>
                    <p className="text-xs text-zinc-400">{selectedResident.email}</p>
                  </div>
                  {selectedResident.propertyInfo && (
                    <span className="text-[10px] bg-violet-500/10 text-violet-400 px-2 py-1 rounded font-bold">
                      {selectedResident.propertyInfo}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Asunto del Correo
                </label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Ej. Aviso importante de administración"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-violet-500/50 transition-all"
                />
              </div>

              <div className="flex-1 flex flex-col">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Mensaje
                </label>
                <textarea
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Escriba aquí el cuerpo del correo..."
                  className="w-full flex-1 min-h-[200px] bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-violet-500/50 transition-all resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={sending}
                className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition-all flex items-center justify-center space-x-2 shadow-lg shadow-violet-600/20"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span>{sending ? 'Enviando correo...' : 'Enviar Correo Real'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
