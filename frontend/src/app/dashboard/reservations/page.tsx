'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../context/AuthContext';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import {
  CalendarDays,
  Clock,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Info,
  MapPin,
  User,
  Home,
  Building2,
  Utensils,
  Trophy,
  Dumbbell,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit2, Save, X } from 'lucide-react';

// --- ESPACIOS COMUNES ---
interface CommonSpace {
  id: string;
  name: string;
  description: string;
  capacity: string;
  icon: React.ReactNode;
}

const SPACES: CommonSpace[] = [
  {
    id: 'salon-social',
    name: 'Salón Social',
    description: 'Espacio cerrado ideal para reuniones, fiestas de cumpleaños y eventos familiares.',
    capacity: '80 personas',
    icon: <Building2 className="h-6 w-6 text-violet-400" />,
  },
  {
    id: 'zona-bbq',
    name: 'Zona BBQ',
    description: 'Área al aire libre equipada con asador, mesas y lavaplatos para tus reuniones.',
    capacity: '20 personas',
    icon: <Utensils className="h-6 w-6 text-violet-400" />,
  },
  {
    id: 'cancha-sintetica',
    name: 'Cancha Sintética',
    description: 'Cancha de fútbol 5 para prácticas deportivas, torneos y recreación familiar.',
    capacity: '12 personas',
    icon: <Trophy className="h-6 w-6 text-violet-400" />,
  },
  {
    id: 'gimnasio',
    name: 'Gimnasio',
    description: 'Equipado con máquinas cardiovasculares y de peso para rutinas de acondicionamiento.',
    capacity: '8 personas',
    icon: <Dumbbell className="h-6 w-6 text-violet-400" />,
  },
];

interface Reservation {
  id: string;
  spaceId: string;
  spaceName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  userId: string;
  userName: string;
  unitInfo: string;
  notes: string;
  createdAt: any;
}

export default function ReservationsPage() {
  const { user, activeRole } = useAuth();
  const currentRole = activeRole || user?.role || '';
  const isAdmin = currentRole === 'ADMINISTRADOR';

  const [spacesList, setSpacesList] = useState<CommonSpace[]>(SPACES);
  const [selectedSpace, setSelectedSpace] = useState<CommonSpace>(SPACES[0]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  // Perfil de residente (para obtener la unidad)
  const [residentUnit, setResidentUnit] = useState('Administración');

  // Estado del calendario
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState('');

  // Modales y formularios
  const [isBookOpen, setIsBookOpen] = useState(false);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('10:00');
  const [notes, setNotes] = useState('');
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Edit capacity state
  const [isEditingCapacity, setIsEditingCapacity] = useState(false);
  const [newCapacity, setNewCapacity] = useState('');
  const [updatingCapacity, setUpdatingCapacity] = useState(false);

  // Cargar unidad de residente
  useEffect(() => {
    if (!user?.tenantId || !user?.email) return;
    const fetchResidentProfile = async () => {
      try {
        const snap = await getDocs(query(
          collection(db, 'residents'),
          where('tenantId', '==', user.tenantId),
          where('email', '==', user.email)
        ));
        if (!snap.empty) {
          const resData = snap.docs[0].data();
          const props = resData.properties || [];
          if (props.length > 0) {
            setResidentUnit(`${props[0].tower} - ${props[0].unit}`);
          }
        } else if (user.role === 'PORTERÍA') {
          setResidentUnit('Portería');
        }
      } catch (e) {
        console.error('Error fetching resident profile:', e);
      }
    };
    fetchResidentProfile();
  }, [user]);

  // Cargar todas las reservas del Tenant
  const loadReservations = useCallback(async () => {
    if (!user?.tenantId) return;
    setLoading(true);
    try {
      const snap = await getDocs(query(
        collection(db, 'reservations'),
        where('tenantId', '==', user.tenantId)
      ));
      const list: Reservation[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          spaceId: data.spaceId || '',
          spaceName: data.spaceName || '',
          date: data.date || '',
          startTime: data.startTime || '',
          endTime: data.endTime || '',
          userId: data.userId || '',
          userName: data.userName || '',
          unitInfo: data.unitInfo || '',
          notes: data.notes || '',
          createdAt: data.createdAt,
        });
      });
      // Ordenar por hora de inicio
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
      setReservations(list);
    } catch (e) {
      console.error('Error al cargar reservas:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadSettings = useCallback(async () => {
    if (!user?.tenantId) return;
    try {
      const settingsDoc = await getDoc(doc(db, 'tenants', user.tenantId, 'settings', 'reservations'));
      if (settingsDoc.exists()) {
        const capacity = settingsDoc.data().salonCapacity || '80 personas';
        setSpacesList((prev) =>
          prev.map((s) => (s.id === 'salon-social' ? { ...s, capacity } : s))
        );
        setSelectedSpace((prev) => (prev.id === 'salon-social' ? { ...prev, capacity } : prev));
      }
    } catch (e) {
      console.error('Error al cargar config de reservas:', e);
    }
  }, [user]);

  useEffect(() => {
    loadReservations();
    loadSettings();
    // Set default selected date as today
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    setSelectedDateStr(`${y}-${m}-${d}`);
  }, [loadReservations, loadSettings]);

  const handleSaveCapacity = async () => {
    if (!user?.tenantId) return;
    if (!newCapacity.trim()) return;
    setUpdatingCapacity(true);
    try {
      await setDoc(
        doc(db, 'tenants', user.tenantId, 'settings', 'reservations'),
        { salonCapacity: newCapacity },
        { merge: true }
      );
      setSpacesList((prev) =>
        prev.map((s) => (s.id === 'salon-social' ? { ...s, capacity: newCapacity } : s))
      );
      setSelectedSpace((prev) => (prev.id === 'salon-social' ? { ...prev, capacity: newCapacity } : prev));
      setIsEditingCapacity(false);
    } catch (e) {
      console.error(e);
      alert('Error al guardar la capacidad');
    } finally {
      setUpdatingCapacity(false);
    }
  };

  // Cambiar mes del calendario
  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Lógica del Calendario
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Dom, 1 = Lun...
  // Ajustar primer día para que empiece en Lunes (0 = Lun, 1 = Mar... 6 = Dom)
  const adjustedFirstDayIndex = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const daysGrid: (Date | null)[] = [];
  // Rellenar días vacíos antes del primer día del mes
  for (let i = 0; i < adjustedFirstDayIndex; i++) {
    daysGrid.push(null);
  }
  // Rellenar los días del mes
  for (let d = 1; d <= daysInMonth; d++) {
    daysGrid.push(new Date(year, month, d));
  }

  // Filtrar reservas del día seleccionado y espacio seleccionado
  const dayReservations = reservations.filter(
    (r) => r.spaceId === selectedSpace.id && r.date === selectedDateStr
  );

  // Comprobar si hay reservas para un día específico del mes
  const hasReservationOnDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    return reservations.some((r) => r.spaceId === selectedSpace.id && r.date === dateStr);
  };

  // Validar solapamientos de horas
  const checkOverlap = (newStart: string, newEnd: string) => {
    return dayReservations.some((r) => {
      // Comparar rangos de horas
      return (
        (newStart >= r.startTime && newStart < r.endTime) || // El nuevo inicio cae dentro de una reserva existente
        (newEnd > r.startTime && newEnd <= r.endTime) ||     // El nuevo fin cae dentro de una reserva existente
        (newStart <= r.startTime && newEnd >= r.endTime)      // El nuevo rango envuelve una reserva existente completamente
      );
    });
  };

  // Crear Reserva
  const handleCreateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.tenantId) return;

    if (startTime >= endTime) {
      setBookingError('La hora de inicio debe ser anterior a la hora de finalización.');
      return;
    }

    // Comprobar solapamiento
    const isOverlapping = checkOverlap(startTime, endTime);
    if (isOverlapping) {
      setBookingError('El horario solicitado se cruza con una reserva existente. Por favor elija otra hora.');
      return;
    }

    setSubmitting(true);
    setBookingError(null);
    setBookingSuccess(false);

    try {
      await addDoc(collection(db, 'reservations'), {
        tenantId: user.tenantId,
        spaceId: selectedSpace.id,
        spaceName: selectedSpace.name,
        date: selectedDateStr,
        startTime,
        endTime,
        userId: user.id,
        userName: `${user.firstName} ${user.lastName}`,
        unitInfo: residentUnit,
        notes: notes.trim(),
        createdAt: serverTimestamp(),
      });

      setBookingSuccess(true);
      setNotes('');
      // Crear notificación
      await addDoc(collection(db, 'notifications'), {
        title: `Nueva Reserva - ${selectedSpace.name}`,
        body: `Se ha registrado una reserva para el ${selectedDateStr} de ${startTime} a ${endTime} (${residentUnit}).`,
        type: 'general',
        isRead: false,
        tenantId: user.tenantId,
        receiverId: 'ALL', // Visible para todos, o para admin
        createdAt: serverTimestamp(),
      });

      await loadReservations();
      setTimeout(() => {
        setIsBookOpen(false);
        setBookingSuccess(false);
      }, 1500);
    } catch (err: any) {
      setBookingError(err.message || 'Ocurrió un error al procesar tu reserva.');
    } finally {
      setSubmitting(false);
    }
  };

  // Cancelar/Eliminar Reserva
  const handleDeleteReservation = async (resId: string) => {
    if (!confirm('¿Está seguro de que desea eliminar esta reserva?')) return;
    try {
      await deleteDoc(doc(db, 'reservations', resId));
      await loadReservations();
    } catch (e) {
      console.error(e);
      alert('Error al eliminar la reserva.');
    }
  };

  const getDayFormatted = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 flex items-center space-x-2.5">
          <CalendarDays className="h-7 w-7 text-violet-400" />
          <span>Reservas de Zonas Comunes</span>
        </h1>
        <p className="text-xs text-zinc-500 mt-1 font-medium">
          Consulta disponibilidad, agenda salones o áreas deportivas y gestiona tus horarios.
        </p>
      </div>

      {/* Selector de Espacio Común */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {spacesList.map((space) => {
          const isSelected = selectedSpace.id === space.id;
          return (
            <button
              key={space.id}
              onClick={() => setSelectedSpace(space)}
              className={`p-4 rounded-2xl border text-left transition-all ${
                isSelected
                  ? 'bg-violet-600/15 border-violet-500/40 shadow-lg shadow-violet-600/5'
                  : 'bg-zinc-900/40 border-zinc-800/80 hover:border-zinc-700/60'
              }`}
            >
              <span className="text-2xl block mb-2">{space.icon}</span>
              <p className={`text-xs font-bold ${isSelected ? 'text-violet-300' : 'text-zinc-200'}`}>
                {space.name}
              </p>
              <p className="text-[10px] text-zinc-500 mt-1 line-clamp-1">{space.description}</p>
            </button>
          );
        })}
      </div>

      {/* Espacio info y Agenda */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Columna Izquierda: Calendario & Información del espacio */}
        <div className="space-y-5 lg:col-span-2">
          
          {/* Info del Espacio */}
          <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/20 flex items-start space-x-3.5">
            <div className="text-xl p-2 bg-zinc-950 rounded-xl shrink-0">{selectedSpace.icon}</div>
            <div>
              <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">{selectedSpace.name}</h3>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{selectedSpace.description}</p>
              <div className="flex flex-wrap gap-4 mt-2 text-[10px] text-zinc-500 font-semibold items-center">
                <span className="flex items-center space-x-1">
                  <User className="h-3 w-3 text-violet-400" />
                  {isEditingCapacity && selectedSpace.id === 'salon-social' ? (
                    <div className="flex items-center space-x-2">
                      <span>Capacidad:</span>
                      <input
                        type="text"
                        value={newCapacity}
                        onChange={(e) => setNewCapacity(e.target.value)}
                        className="bg-zinc-950 border border-zinc-800 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-violet-500 w-28"
                        placeholder="Ej. 100 personas"
                        autoFocus
                      />
                      <button onClick={handleSaveCapacity} disabled={updatingCapacity} className="text-emerald-400 hover:text-emerald-300">
                        {updatingCapacity ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                      </button>
                      <button onClick={() => setIsEditingCapacity(false)} className="text-zinc-400 hover:text-white">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span>Capacidad: {selectedSpace.capacity}</span>
                      {isAdmin && selectedSpace.id === 'salon-social' && (
                        <button
                          onClick={() => {
                            setNewCapacity(selectedSpace.capacity);
                            setIsEditingCapacity(true);
                          }}
                          className="text-violet-400 hover:text-violet-300 transition-colors"
                          title="Editar Capacidad"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Calendario Personalizado */}
          <div className="bg-zinc-900/30 border border-zinc-800/80 p-5 rounded-3xl">
            {/* Header del Calendario */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-bold text-zinc-200">
                {monthNames[month]} {year}
              </h2>
              <div className="flex space-x-1">
                <button
                  onClick={handlePrevMonth}
                  className="p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={handleNextMonth}
                  className="p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Días de la semana */}
            <div className="grid grid-cols-7 text-center text-[10px] font-bold text-zinc-600 uppercase mb-2">
              <span>Lun</span>
              <span>Mar</span>
              <span>Mié</span>
              <span>Jue</span>
              <span>Vie</span>
              <span>Sáb</span>
              <span>Dom</span>
            </div>

            {/* Cuadrícula de días */}
            <div className="grid grid-cols-7 gap-1.5">
              {daysGrid.map((date, idx) => {
                if (!date) return <div key={`empty-${idx}`} className="aspect-square" />;

                const dateStr = getDayFormatted(date);
                const isSelected = selectedDateStr === dateStr;
                const isCurrent = isToday(date);
                const hasBooking = hasReservationOnDate(date);

                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDateStr(dateStr)}
                    className={`aspect-square rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-between p-1.5 relative border ${
                      isSelected
                        ? 'bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-600/20'
                        : isCurrent
                        ? 'bg-violet-500/10 border-violet-500/30 text-violet-400'
                        : 'bg-zinc-950/40 border-zinc-900/60 text-zinc-400 hover:border-zinc-700/60'
                    }`}
                  >
                    <span>{date.getDate()}</span>
                    {hasBooking && (
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isSelected ? 'bg-white' : 'bg-violet-500'
                        } shrink-0`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Columna Derecha: Agenda del día & Botón Reservar */}
        <div className="space-y-4">
          
          {/* Agenda del día */}
          <div className="p-5 rounded-3xl border border-zinc-800 bg-zinc-900/15 flex flex-col h-full min-h-[350px]">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80 mb-4">
              <div>
                <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Reservas del Día</h3>
                <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{selectedDateStr}</p>
              </div>
              <button
                onClick={() => {
                  setBookingError(null);
                  setBookingSuccess(false);
                  setIsBookOpen(true);
                }}
                className="inline-flex items-center space-x-1 px-3 py-1.5 text-[10px] font-bold bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-all shadow-md shadow-violet-600/10"
              >
                <Plus className="h-3 w-3" />
                <span>Reservar</span>
              </button>
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-6 w-6 text-violet-500 animate-spin" />
              </div>
            ) : dayReservations.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
                <CalendarIcon className="h-8 w-8 text-zinc-800 mb-2" />
                <p className="text-xs font-semibold text-zinc-500">Sin reservas agendadas</p>
                <p className="text-[10px] text-zinc-600 mt-1 max-w-[180px]">
                  Este día está disponible. ¡Haz clic en Reservar para agendarlo!
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {dayReservations.map((res) => {
                  const isOwnBooking = res.userId === user?.id;
                  const canDelete = isOwnBooking;

                  return (
                    <div
                      key={res.id}
                      className="p-3 bg-zinc-950/40 border border-zinc-800/50 rounded-xl flex items-start justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-1.5">
                          <Clock className="h-3.5 w-3.5 text-violet-400" />
                          <span className="text-xs font-bold text-zinc-200">
                            {res.startTime} - {res.endTime}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 font-semibold flex items-center space-x-1">
                          <Home className="h-3 w-3 text-zinc-650" />
                          <span>{res.unitInfo}</span>
                          <span className="text-zinc-600">·</span>
                          <span className="text-zinc-500 truncate max-w-[100px]">{res.userName}</span>
                        </p>
                        {res.notes && (
                          <p className="text-[10px] text-zinc-600 italic">"{res.notes}"</p>
                        )}
                      </div>

                      {canDelete && (
                        <button
                          onClick={() => handleDeleteReservation(res.id)}
                          className="p-1.5 hover:bg-rose-500/10 rounded-lg text-zinc-600 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL: RESERVAR ESPACIO */}
      <AnimatePresence>
        {isBookOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !submitting && setIsBookOpen(false)}
              className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl w-full max-w-md shadow-2xl relative z-10"
            >
              <div className="flex items-center space-x-3 mb-5">
                <span className="text-2xl">{selectedSpace.icon}</span>
                <div>
                  <h3 className="text-sm font-bold text-zinc-100">Agendar {selectedSpace.name}</h3>
                  <p className="text-[10px] text-zinc-500 font-mono">{selectedDateStr}</p>
                </div>
              </div>

              {bookingError && (
                <div className="mb-4 p-3 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-200 text-xs flex items-start space-x-2">
                  <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{bookingError}</span>
                </div>
              )}

              {bookingSuccess && (
                <div className="mb-4 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-200 text-xs flex items-start space-x-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">¡Reserva confirmada!</p>
                    <p className="text-zinc-400 text-[10px]">Tu espacio ha sido agendado con éxito.</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleCreateReservation} className="space-y-4">
                <div className="p-3 bg-zinc-950/60 border border-zinc-800 rounded-xl grid grid-cols-2 gap-3">
                  <div>
                    <span className="block text-[10px] text-zinc-500 font-bold uppercase mb-1">Unidad que reserva</span>
                    <span className="text-xs font-bold text-zinc-200">{residentUnit}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-zinc-500 font-bold uppercase mb-1">Espacio</span>
                    <span className="text-xs font-bold text-violet-400">{selectedSpace.name}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-zinc-400 font-medium mb-1.5">Hora Inicio</label>
                    <select
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      disabled={submitting || bookingSuccess}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 text-xs focus:outline-none focus:border-violet-500/70"
                    >
                      {Array.from({ length: 17 }, (_, i) => {
                        const h = String(i + 6).padStart(2, '0');
                        return <option key={`${h}:00`} value={`${h}:00`}>{h}:00</option>;
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-400 font-medium mb-1.5">Hora Fin</label>
                    <select
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      disabled={submitting || bookingSuccess}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 text-xs focus:outline-none focus:border-violet-500/70"
                    >
                      {Array.from({ length: 17 }, (_, i) => {
                        const h = String(i + 7).padStart(2, '0');
                        return <option key={`${h}:00`} value={`${h}:00`}>{h}:00</option>;
                      })}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-zinc-400 font-medium mb-1.5">Propósito / Nota (opcional)</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={submitting || bookingSuccess}
                    placeholder="Ej: Cumpleaños, Reunión familiar..."
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 placeholder-zinc-600 text-xs focus:outline-none focus:border-violet-500/70"
                  />
                </div>

                <div className="p-3 bg-violet-500/5 border border-violet-500/15 rounded-xl text-[10px] text-zinc-400 flex items-start space-x-2">
                  <Info className="h-4 w-4 text-violet-400 shrink-0 mt-0.5" />
                  <span>Tu reserva se aprueba automáticamente en tiempo real y será visible para todos en el calendario diario.</span>
                </div>

                <div className="flex items-center justify-end space-x-3 pt-2 border-t border-zinc-800">
                  <button
                    type="button"
                    disabled={submitting || bookingSuccess}
                    onClick={() => setIsBookOpen(false)}
                    className="px-4 py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || bookingSuccess}
                    className="px-4 py-2 text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-all flex items-center space-x-1.5"
                  >
                    {submitting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CalendarDays className="h-3.5 w-3.5" />
                    )}
                    <span>{submitting ? 'Reservando...' : 'Confirmar Reserva'}</span>
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
