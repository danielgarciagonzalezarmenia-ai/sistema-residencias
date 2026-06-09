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
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import {
  Megaphone,
  Send,
  History,
  User,
  Users,
  Mail,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  Search,
  Calendar,
  MailCheck,
  Tag,
  ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { sendEmail } from '../../../lib/mail';

interface Resident {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  tenantId: string;
  properties: { tower: string; unit: string }[];
}

interface Announcement {
  id: string;
  title: string;
  body: string;
  scope: 'ALL' | 'INDIVIDUAL';
  receiverId: string;
  receiverName: string;
  senderId: string;
  senderName: string;
  emailSent: boolean;
  createdAt: any;
}

interface SendProgressLog {
  email: string;
  name: string;
  status: 'pending' | 'success' | 'error';
  mode?: 'real' | 'demo';
  errorMsg?: string;
}

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMINISTRADOR';

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [scope, setScope] = useState<'ALL' | 'INDIVIDUAL'>('ALL');
  const [selectedResidentId, setSelectedResidentId] = useState('');
  const [sendEmailNotification, setSendEmailNotification] = useState(true);
  
  // Progress states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [progressLogs, setProgressLogs] = useState<SendProgressLog[]>([]);
  const [currentProgressIndex, setCurrentProgressIndex] = useState<number | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterScope, setFilterScope] = useState('');

  const loadData = async () => {
    if (!user?.tenantId) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Cargar Historial de Comunicados
      const annQuery = query(
        collection(db, 'announcements'),
        where('tenantId', '==', user.tenantId)
      );
      const annSnap = await getDocs(annQuery);
      const annList: Announcement[] = [];
      annSnap.forEach((docSnap) => {
        const data = docSnap.data();
        annList.push({
          id: docSnap.id,
          title: data.title || '',
          body: data.body || '',
          scope: data.scope || 'ALL',
          receiverId: data.receiverId || 'ALL',
          receiverName: data.receiverName || 'Todos',
          senderId: data.senderId || '',
          senderName: data.senderName || '',
          emailSent: !!data.emailSent,
          createdAt: data.createdAt,
        });
      });

      // Ordenar localmente por fecha descendente
      annList.sort((a, b) => {
        const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
        const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });
      setAnnouncements(annList);

      // 2. Cargar lista de residentes (para el selector)
      if (isAdmin) {
        const resQuery = query(
          collection(db, 'residents'),
          where('tenantId', '==', user.tenantId),
          where('status', '==', 'ACTIVE')
        );
        const resSnap = await getDocs(resQuery);
        const resList: Resident[] = [];
        resSnap.forEach((docSnap) => {
          const data = docSnap.data();
          resList.push({
            id: docSnap.id,
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            email: data.email || '',
            phone: data.phone || '',
            tenantId: data.tenantId || '',
            properties: data.properties || [],
          });
        });
        setResidents(resList);
      }
    } catch (err: any) {
      console.error('Error al cargar datos:', err);
      setError(err.message || 'Error de conexiÃ³n con Firestore.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setFormError('El tÃ­tulo y el mensaje son obligatorios.');
      return;
    }

    if (scope === 'INDIVIDUAL' && !selectedResidentId) {
      setFormError('Debe seleccionar un residente para el envÃ­o individual.');
      return;
    }

    if (!user?.tenantId) return;

    setIsSubmitting(true);
    setFormError(null);
    setProgressLogs([]);
    setCurrentProgressIndex(0);

    try {
      let targetEmailList: { email: string; name: string; residentId: string }[] = [];
      let receiverName = 'Todos los Residentes';
      let receiverId = 'ALL';

      // 1. Definir destinatarios
      if (scope === 'INDIVIDUAL') {
        const resident = residents.find((r) => r.id === selectedResidentId);
        if (!resident) throw new Error('Residente seleccionado no encontrado.');
        receiverName = `${resident.firstName} ${resident.lastName}`;
        receiverId = resident.id;

        if (resident.email) {
          targetEmailList.push({
            email: resident.email,
            name: `${resident.firstName} ${resident.lastName}`,
            residentId: resident.id,
          });
        }
      } else {
        // Enviar a todos los residentes activos con correo electrÃ³nico
        targetEmailList = residents
          .filter((r) => r.email)
          .map((r) => ({
            email: r.email,
            name: `${r.firstName} ${r.lastName}`,
            residentId: r.id,
          }));
      }

      // 2. Guardar Comunicado en Firestore historial
      const annRef = await addDoc(collection(db, 'announcements'), {
        title,
        body,
        scope,
        receiverId,
        receiverName,
        senderId: user.id,
        senderName: `${user.firstName} ${user.lastName}`,
        tenantId: user.tenantId,
        emailSent: sendEmailNotification && targetEmailList.length > 0,
        createdAt: serverTimestamp(),
      });

      // 3. Crear NotificaciÃ³n en tiempo real (Firestore) para la Campana
      // Si es INDIVIDUAL, buscamos si este residente tiene un ID de usuario en la colecciÃ³n 'users'.
      let receiverUserUid = 'ALL';
      if (scope === 'INDIVIDUAL') {
        const targetResident = residents.find((r) => r.id === selectedResidentId);
        if (targetResident) {
          // Buscamos si existe un usuario registrado en la colecciÃ³n 'users' con este correo
          const userQuery = query(
            collection(db, 'users'),
            where('email', '==', targetResident.email),
            where('tenantId', '==', user.tenantId)
          );
          const userSnap = await getDocs(userQuery);
          if (!userSnap.empty) {
            receiverUserUid = userSnap.docs[0].id; // El UID es el id del documento
          } else {
            // Si no tiene cuenta, usamos el id del residente, aunque en el dashboard solo escuchan cuentas de 'users'
            receiverUserUid = targetResident.id;
          }
        }
      }

      await addDoc(collection(db, 'notifications'), {
        title: `Nuevo Comunicado: ${title}`,
        body: body.length > 120 ? `${body.substring(0, 120)}...` : body,
        type: 'announcement',
        isRead: false,
        tenantId: user.tenantId,
        receiverId: receiverUserUid, // ALL o el UID del usuario
        createdAt: serverTimestamp(),
      });

      // 4. Enviar correos electrÃ³nicos secuencialmente (CampaÃ±a de Notificaciones)
      if (sendEmailNotification && targetEmailList.length > 0) {
        const initialLogs = targetEmailList.map((t) => ({
          email: t.email,
          name: t.name,
          status: 'pending' as const,
        }));
        setProgressLogs(initialLogs);

        for (let i = 0; i < targetEmailList.length; i++) {
          const target = targetEmailList[i];
          setCurrentProgressIndex(i);

          try {
            const emailResult = await sendEmail({
              toEmail: target.email,
              toName: target.name,
              subject: `Comunicado - Club Residencial: ${title}`,
              message: body,
            });

            setProgressLogs((prev) =>
              prev.map((log, idx) =>
                idx === i
                  ? {
                      ...log,
                      status: 'success',
                      mode: emailResult.mode,
                    }
                  : log
              )
            );
          } catch (emailErr: any) {
            console.error(`Error enviando correo a ${target.email}:`, emailErr);
            setProgressLogs((prev) =>
              prev.map((log, idx) =>
                idx === i
                  ? {
                      ...log,
                      status: 'error',
                      errorMsg: emailErr.message || 'Error en el envÃ­o',
                    }
                  : log
              )
            );
          }
          // PequeÃ±o delay artificial para animaciÃ³n visual atractiva
          await new Promise((r) => setTimeout(r, 600));
        }
      }

      // Reiniciar formulario e historial
      setTitle('');
      setBody('');
      setScope('ALL');
      setSelectedResidentId('');
      
      // Delay antes de cerrar modal para que vean el Ã©xito de la campaÃ±a
      await new Promise((r) => setTimeout(r, 1500));
      setIsCreateOpen(false);
      setProgressLogs([]);
      setCurrentProgressIndex(null);
      await loadData();
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Error al lanzar la campaÃ±a de comunicados.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtrado local
  const filteredAnnouncements = announcements.filter((ann) => {
    const matchScope = filterScope ? ann.scope === filterScope : true;
    const matchText = searchQuery
      ? ann.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ann.body.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ann.receiverName.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    return matchScope && matchText;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-100 flex items-center space-x-2">
            <Megaphone className="h-7 w-7 text-violet-500" />
            <span>CampaÃ±as y Comunicados</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            {isAdmin 
              ? 'Lanza campaÃ±as de notificaciones masivas por correo electrÃ³nico y notificaciones push en tiempo real.'
              : 'Historial de comunicados oficiales emitidos por la administraciÃ³n.'}
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => {
              setFormError(null);
              setProgressLogs([]);
              setCurrentProgressIndex(null);
              setIsCreateOpen(true);
            }}
            className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-colors shadow-lg shadow-violet-600/10"
          >
            <Plus className="h-4 w-4" />
            <span>Nueva CampaÃ±a</span>
          </button>
        )}
      </div>

      {/* Filtros e historial */}
      <div className="p-4 rounded-2xl border border-zinc-900 bg-zinc-900/20 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar por tÃ­tulo, contenido o destinatario..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500/80 transition-colors text-xs"
          />
        </div>
        <div className="w-full md:w-48">
          <select
            value={filterScope}
            onChange={(e) => setFilterScope(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-300 focus:outline-none focus:border-violet-500/80 transition-colors text-xs"
          >
            <option value="">Todos los Alcances</option>
            <option value="ALL">Generales (Todos)</option>
            <option value="INDIVIDUAL">Individuales</option>
          </select>
        </div>
      </div>

      {/* Listado de Comunicados */}
      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 text-violet-500 animate-spin mb-3" />
          <p className="text-xs text-zinc-500">Cargando comunicados desde Firestore...</p>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-200 text-sm">
          {error}
        </div>
      ) : filteredAnnouncements.length === 0 ? (
        <div className="p-16 border border-dashed border-zinc-800 rounded-3xl text-center">
          <Megaphone className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">No se registran comunicados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredAnnouncements.map((ann) => (
            <div
              key={ann.id}
              className="p-5 rounded-2xl border border-zinc-900 bg-zinc-950/50 hover:bg-zinc-900/10 transition-all flex flex-col md:flex-row md:items-start justify-between gap-4"
            >
              <div className="space-y-2.5 max-w-3xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      ann.scope === 'ALL'
                        ? 'text-violet-400 bg-violet-500/10 border border-violet-500/20'
                        : 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                    }`}
                  >
                    {ann.scope === 'ALL' ? (
                      <>
                        <Users className="h-3 w-3" />
                        <span>General</span>
                      </>
                    ) : (
                      <>
                        <User className="h-3 w-3" />
                        <span>Individual</span>
                      </>
                    )}
                  </span>

                  {ann.emailSent && (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-emerald-450 bg-emerald-500/10 border border-emerald-500/20">
                      <MailCheck className="h-3 w-3" />
                      <span>Notificado Email</span>
                    </span>
                  )}

                  <span className="text-[10px] text-zinc-500 flex items-center space-x-1">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      {ann.createdAt?.seconds
                        ? new Date(ann.createdAt.seconds * 1000).toLocaleDateString() +
                          ' ' +
                          new Date(ann.createdAt.seconds * 1000).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Reciente'}
                    </span>
                  </span>
                </div>

                <div>
                  <h3 className="font-extrabold text-zinc-200 text-base">{ann.title}</h3>
                  <p className="text-zinc-400 text-xs mt-1.5 leading-relaxed whitespace-pre-wrap">{ann.body}</p>
                </div>
              </div>

              <div className="shrink-0 flex flex-col items-start md:items-end text-xs space-y-1 md:border-l md:border-zinc-800/60 md:pl-6">
                <p className="text-zinc-500 font-bold uppercase text-[9px] tracking-wider">Remitente</p>
                <p className="text-zinc-300 font-semibold">{ann.senderName}</p>
                <p className="text-[10px] text-zinc-500 mt-2">Destinatarios</p>
                <p className="text-violet-400 font-bold">{ann.receiverName}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Nueva CampaÃ±a */}
      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setIsCreateOpen(false)}
              className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl w-full max-w-xl shadow-2xl relative z-10 overflow-hidden"
            >
              <div className="flex items-center space-x-2 text-zinc-100 mb-2">
                <Megaphone className="h-5 w-5 text-violet-500" />
                <h3 className="text-lg font-bold">Lanzar CampaÃ±a de Comunicados</h3>
              </div>
              <p className="text-xs text-zinc-500 mb-5">
                Escribe un anuncio y envÃ­alo en tiempo real a los residentes. Las notificaciones llegarÃ¡n al portal web y a sus correos.
              </p>

              {formError && (
                <div className="mb-4 p-3 rounded-xl border border-red-500/20 bg-red-500/10 text-red-200 text-xs flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 text-red-400" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">TÃ­tulo del Comunicado *</label>
                  <input
                    type="text"
                    required
                    disabled={isSubmitting}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ej: Asamblea Extraordinaria de Propietarios o Mantenimiento de Ascensores"
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500/80 disabled:opacity-50 transition-colors text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">Alcance (Destinatarios)</label>
                    <select
                      value={scope}
                      disabled={isSubmitting}
                      onChange={(e) => setScope(e.target.value as 'ALL' | 'INDIVIDUAL')}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-300 focus:outline-none focus:border-violet-500/80 disabled:opacity-50 transition-colors text-xs"
                    >
                      <option value="ALL">Todos los Residentes (General)</option>
                      <option value="INDIVIDUAL">Un Residente EspecÃ­fico</option>
                    </select>
                  </div>

                  {scope === 'INDIVIDUAL' && (
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1.5">Seleccione Residente *</label>
                      <select
                        required
                        value={selectedResidentId}
                        disabled={isSubmitting}
                        onChange={(e) => setSelectedResidentId(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-300 focus:outline-none focus:border-violet-500/80 disabled:opacity-50 transition-colors text-xs"
                      >
                        <option value="">-- Seleccione --</option>
                        {residents.map((res) => (
                          <option key={res.id} value={res.id}>
                            {res.firstName} {res.lastName} ({res.properties.map(p => `${p.tower}-${p.unit}`).join(', ') || 'Sin inmueble'})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">Mensaje / Contenido *</label>
                  <textarea
                    required
                    rows={5}
                    disabled={isSubmitting}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Escriba los detalles del comunicado aquÃ­..."
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500/80 disabled:opacity-50 transition-colors text-xs resize-none"
                  />
                </div>

                <div className="flex items-center space-x-2.5 py-1">
                  <input
                    type="checkbox"
                    id="sendMail"
                    disabled={isSubmitting}
                    checked={sendEmailNotification}
                    onChange={(e) => setSendEmailNotification(e.target.checked)}
                    className="h-4 w-4 bg-zinc-950 border border-zinc-800 rounded text-violet-600 focus:ring-violet-500"
                  />
                  <label htmlFor="sendMail" className="text-xs text-zinc-300 cursor-pointer select-none">
                    Notificar por Correo ElectrÃ³nico (vÃ­a EmailJS)
                  </label>
                </div>

                {/* Progress Tracking Widget */}
                {isSubmitting && progressLogs.length > 0 && (
                  <div className="mt-4 p-4 border border-zinc-800/80 bg-zinc-950/80 rounded-xl space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-zinc-350">Progreso del EnvÃ­o de Correos</span>
                      <span className="text-violet-400 font-bold">
                        {currentProgressIndex !== null ? currentProgressIndex + 1 : 0} de {progressLogs.length}
                      </span>
                    </div>

                    {/* Simple Progress Bar */}
                    <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-violet-500 transition-all duration-300"
                        style={{
                          width: `${
                            progressLogs.length > 0
                              ? (((currentProgressIndex !== null ? currentProgressIndex + 1 : 0) / progressLogs.length) * 100)
                              : 0
                          }%`,
                        }}
                      />
                    </div>

                    {/* Dynamic Log */}
                    <div className="max-h-24 overflow-y-auto space-y-1.5 text-[10px] font-mono text-zinc-500">
                      {progressLogs.map((log, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <span className="truncate max-w-[180px]">
                            {idx === currentProgressIndex ? 'â–¶ ' : ''}
                            {log.name} ({log.email})
                          </span>
                          <span>
                            {log.status === 'pending' && <span className="text-slate-650">Pendiente...</span>}
                            {log.status === 'success' && (
                              <span className="text-emerald-450 font-semibold">
                                âœ“ Enviado ({log.mode})
                              </span>
                            )}
                            {log.status === 'error' && (
                              <span className="text-red-400 font-semibold">
                                âœ— Error: {log.errorMsg}
                              </span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-zinc-850">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setIsCreateOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-xl transition-all shadow-lg shadow-violet-600/10 flex items-center space-x-1.5"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Enviando...</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" />
                        <span>Enviar Comunicado</span>
                      </>
                    )}
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

