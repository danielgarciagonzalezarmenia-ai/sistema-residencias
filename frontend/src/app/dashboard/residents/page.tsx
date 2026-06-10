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
  Mail,
  Link as LinkIcon,
  Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { sendEmail } from '../../../lib/mail';

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
  const [copiedLink, setCopiedLink] = useState(false);

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
  const [propertyRole, setPropertyRole] = useState<'owner' | 'inhabitant'>('owner');
  const [formError, setFormError] = useState<string | null>(null);

  // Estados para envío de correo personalizado
  const [isMailOpen, setIsMailOpen] = useState(false);
  const [mailTargetResident, setMailTargetResident] = useState<Resident | null>(null);
  const [mailSubject, setMailSubject] = useState('');
  const [mailMessage, setMailMessage] = useState('');
  const [mailSubmitting, setMailSubmitting] = useState(false);
  const [mailSuccess, setMailSuccess] = useState<string | null>(null);
  const [mailError, setMailError] = useState<string | null>(null);

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
      const docRef = await addDoc(collection(db, 'residents'), {
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

      // Si se seleccionó inmueble, actualizar el inmueble correspondiente
      if (selectedPropertyId) {
        const name = `${firstName} ${lastName}`;
        const updateData = propertyRole === 'owner'
          ? { ownerId: docRef.id, ownerName: name, status: 'OCCUPIED' }
          : { inhabitantId: docRef.id, inhabitantName: name, status: 'OCCUPIED' };
        
        await updateDoc(doc(db, 'properties', selectedPropertyId), updateData);
      }

      // Limpiar formulario
      setFirstName('');
      setLastName('');
      setDocument('');
      setEmail('');
      setPhone('');
      setSelectedPropertyId('');
      setPropertyRole('owner');
      setIsCreateOpen(false);

      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Error al guardar el residente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    // Si está pendiente o inactivo, pasa a activo. Si está activo, pasa a inactivo.
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

  const handleSendCustomMail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mailTargetResident || !mailSubject || !mailMessage) return;

    setMailSubmitting(true);
    setMailError(null);
    setMailSuccess(null);

    try {
      const result = await sendEmail({
        toEmail: mailTargetResident.email,
        toName: `${mailTargetResident.firstName} ${mailTargetResident.lastName}`,
        subject: mailSubject,
        message: mailMessage,
      });

      setMailSuccess(result.message || 'Correo enviado exitosamente.');
      setMailSubject('');
      setMailMessage('');
      setTimeout(() => {
        setIsMailOpen(false);
        setMailSuccess(null);
        setMailTargetResident(null);
      }, 2000);
    } catch (err: any) {
      console.error(err);
      setMailError(err.message || 'Error al enviar el correo.');
    } finally {
      setMailSubmitting(false);
    }
  };

  // Filtrado local para búsqueda fluida en tiempo real
  const handleCopyInviteLink = () => {
    if (!user?.tenantId) return;
    
    // Obtenemos la URL base (sirve tanto para localhost como para GitHub Pages con subrutas)
    const baseUrl = window.location.href.split('/dashboard')[0];
    const url = `${baseUrl}/register?invite=${user.tenantId}`;
    
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

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
          <h1 className="text-2xl font-extrabold text-zinc-100 flex items-center space-x-2">
            <Users className="h-7 w-7 text-violet-500" />
            <span>Módulo de Residentes</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Gestión de copropietarios e inquilinos registrados (Base de datos Firestore).
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleCopyInviteLink}
            className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl transition-colors shadow-lg shadow-zinc-800/10"
          >
            {copiedLink ? <Check className="h-4 w-4 text-emerald-400" /> : <LinkIcon className="h-4 w-4" />}
            <span>{copiedLink ? '¡Enlace Copiado!' : 'Copiar Enlace'}</span>
          </button>
          
          <button
            onClick={() => {
              setFormError(null);
              setIsCreateOpen(true);
            }}
            className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-medium bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-colors shadow-lg shadow-violet-600/10"
          >
            <Plus className="h-4 w-4" />
            <span>Agregar Residente</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 rounded-2xl border border-zinc-900 bg-zinc-900/20 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1.5">Torre</label>
          <input
            type="text"
            placeholder="Ej: Torre 1"
            value={filterTower}
            onChange={(e) => setFilterTower(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500/80 transition-colors text-xs"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1.5">Apartamento</label>
          <input
            type="text"
            placeholder="Ej: Apto 101"
            value={filterUnit}
            onChange={(e) => setFilterUnit(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500/80 transition-colors text-xs"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1.5">Estado</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-300 focus:outline-none focus:border-violet-500/80 transition-colors text-xs"
          >
            <option value="">Todos</option>
            <option value="ACTIVE">Activos</option>
            <option value="PENDING">Pendientes</option>
            <option value="INACTIVE">Inactivos</option>
          </select>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 text-violet-500 animate-spin mb-3" />
          <p className="text-xs text-zinc-500">Cargando residentes desde Cloud Firestore...</p>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-200 text-sm">
          {error}
        </div>
      ) : filteredResidents.length === 0 ? (
        <div className="p-10 border border-dashed border-zinc-800 rounded-2xl text-center">
          <p className="text-sm text-zinc-500">No se encontraron residentes con los filtros especificados.</p>
        </div>
      ) : (
        <div className="border border-zinc-900 bg-zinc-900/15 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-400">
              <thead className="text-xs text-zinc-500 uppercase border-b border-zinc-800/60 bg-zinc-900/30">
                <tr>
                  <th className="py-3 px-4 font-medium">Residente</th>
                  <th className="py-3 px-4 font-medium">Documento</th>
                  <th className="py-3 px-4 font-medium">Contacto</th>
                  <th className="py-3 px-4 font-medium">Inmueble</th>
                  <th className="py-3 px-4 font-medium text-center">Estado</th>
                  <th className="py-3 px-4 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {filteredResidents.map((resident) => (
                  <tr key={resident.id} className="hover:bg-zinc-900/10 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-zinc-200">
                      {resident.firstName} {resident.lastName}
                    </td>
                    <td className="py-3.5 px-4">{resident.document}</td>
                    <td className="py-3.5 px-4 text-xs">
                      <p className="text-zinc-300">{resident.email}</p>
                      <p className="text-zinc-500 mt-0.5">{resident.phone || 'Sin teléfono'}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      {resident.properties.length > 0 ? (
                        resident.properties.map((p, pIdx) => (
                          <span
                            key={pIdx}
                            className="inline-flex px-2 py-0.5 text-[10px] font-medium text-zinc-300 bg-zinc-800 rounded-full border border-zinc-700/60 mr-1"
                          >
                            {p.tower} - {p.unit}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-zinc-600 italic">No asignado</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        onClick={() => handleToggleStatus(resident.id, resident.status)}
                        className={`inline-flex items-center space-x-1 px-2 py-0.5 text-[10px] font-bold rounded-full cursor-pointer ${
                          resident.status === 'ACTIVE'
                            ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                            : resident.status === 'PENDING'
                            ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                            : 'text-zinc-400 bg-zinc-800 border border-zinc-700'
                        }`}
                        title="Haz clic para cambiar el estado"
                      >
                        {resident.status === 'ACTIVE' ? (
                          <>
                            <CheckCircle className="h-3 w-3" />
                            <span>Activo</span>
                          </>
                        ) : resident.status === 'PENDING' ? (
                          <>
                            <Loader2 className="h-3 w-3" />
                            <span>Pendiente</span>
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
                          onClick={() => {
                            setMailTargetResident(resident);
                            setIsMailOpen(true);
                          }}
                          className="p-1.5 hover:bg-violet-500/10 rounded-lg text-zinc-400 hover:text-violet-400 transition-colors"
                          title="Enviar correo personalizado"
                        >
                          <Mail className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(resident.id, resident.status)}
                          className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(resident.id)}
                          className="p-1.5 hover:bg-rose-500/10 rounded-lg text-zinc-500 hover:text-rose-400 transition-colors"
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
              className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl w-full max-w-lg shadow-2xl relative z-10"
            >
              <h3 className="text-lg font-bold text-zinc-100 mb-2">Agregar Nuevo Residente</h3>
              <p className="text-xs text-zinc-500 mb-6">
                Llene el formulario para registrar un nuevo habitante directamente en Firestore.
              </p>

              {formError && (
                <div className="mb-4 p-3 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-200 text-xs">
                  {formError}
                </div>
              )}

              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">Nombre *</label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Juan"
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500/80 transition-colors text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">Apellido *</label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Pérez"
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500/80 transition-colors text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">Documento (CC/CE) *</label>
                    <input
                      type="text"
                      required
                      value={document}
                      onChange={(e) => setDocument(e.target.value)}
                      placeholder="1012345678"
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500/80 transition-colors text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">Teléfono</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="3001234567"
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500/80 transition-colors text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">Correo Electrónico *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="juan.perez@email.com"
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500/80 transition-colors text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">Asociar a Inmueble</label>
                    <select
                      value={selectedPropertyId}
                      onChange={(e) => setSelectedPropertyId(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-300 focus:outline-none focus:border-violet-500/80 transition-colors text-xs"
                    >
                      <option value="">-- No asociar de inmediato --</option>
                      {properties.map((prop) => (
                        <option key={prop.id} value={prop.id}>
                          {prop.tower} - {prop.unit}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedPropertyId && (
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1.5">Rol en el Inmueble</label>
                      <select
                        value={propertyRole}
                        onChange={(e) => setPropertyRole(e.target.value as any)}
                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-350 focus:outline-none focus:border-violet-500/80 transition-colors text-xs"
                      >
                        <option value="owner">Propietario</option>
                        <option value="inhabitant">Habitante / Arrendatario</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-zinc-850">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 text-xs font-medium text-white bg-violet-600 hover:bg-violet-500 rounded-xl transition-all shadow-lg shadow-violet-600/10 flex items-center space-x-1"
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

      {/* Mail Modal */}
      <AnimatePresence>
        {isMailOpen && mailTargetResident && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsMailOpen(false);
                setMailTargetResident(null);
                setMailError(null);
                setMailSuccess(null);
              }}
              className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl w-full max-w-lg shadow-2xl relative z-10 space-y-4"
            >
              <div>
                <h3 className="text-lg font-bold text-zinc-100 flex items-center space-x-2">
                  <Mail className="h-5 w-5 text-violet-400" />
                  <span>Enviar Correo Personalizado</span>
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Redacte un mensaje personalizado para enviar directamente a este habitante/propietario.
                </p>
              </div>

              {mailSuccess && (
                <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-xs font-semibold">
                  {mailSuccess}
                </div>
              )}

              {mailError && (
                <div className="p-3 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-455 text-xs font-semibold">
                  {mailError}
                </div>
              )}

              <form onSubmit={handleSendCustomMail} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Destinatario</label>
                  <input
                    type="text"
                    readOnly
                    value={`${mailTargetResident.firstName} ${mailTargetResident.lastName} (${mailTargetResident.email})`}
                    className="w-full px-3 py-2 bg-zinc-950/60 border border-zinc-800/80 rounded-xl text-zinc-400 text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Asunto / Título *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Recordatorio importante de administración"
                    value={mailSubject}
                    onChange={(e) => setMailSubject(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500/50 transition-colors text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-550 mb-1.5">Mensaje *</label>
                  <textarea
                    required
                    placeholder="Redacte su mensaje aquí..."
                    rows={5}
                    value={mailMessage}
                    onChange={(e) => setMailMessage(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500/50 transition-colors text-xs resize-none"
                  />
                </div>

                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-zinc-850">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMailOpen(false);
                      setMailTargetResident(null);
                      setMailError(null);
                      setMailSuccess(null);
                    }}
                    className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={mailSubmitting}
                    className="px-4 py-2 text-xs font-medium text-white bg-violet-600 hover:bg-violet-550 rounded-xl transition-all shadow-lg shadow-violet-600/10 flex items-center space-x-1.5"
                  >
                    {mailSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>Enviar Correo</span>
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
