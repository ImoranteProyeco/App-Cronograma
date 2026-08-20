import { useState, useEffect } from 'react';
import { ActivityForm } from './components/ActivityForm';
import { PhaseForm } from './components/PhaseForm';
import { MilestoneForm } from './components/MilestoneForm';
import { Timeline } from './components/Timeline';
import type { Activity, Phase, Milestone, SavedCronograma } from './types';
import {
  listCronogramas,
  saveCronograma,
  loadCronograma,
  deleteCronograma,
  retryPendingSync,
  saveCronogramaToFile,
  loadCronogramaFromFile,
} from './lib/storage';

// Re-exportado para no romper los imports existentes en los demás componentes
// (ActivityForm, PhaseForm, MilestoneForm, Timeline importan estos tipos desde aquí).
export type { Activity, Phase, Milestone };

export default function App() {
  const [activities, setActivities] = useState<Activity[]>([
    { id: '1', name: 'Planificación Inicial', description: 'Definición de alcance y objetivos', startDate: new Date(2026, 0, 5),  duration: 6,  color: '#2563eb', textColor: '#ffffff' },
    { id: '2', name: 'Desarrollo',            description: 'Implementación de funcionalidades', startDate: new Date(2026, 0, 12), duration: 14, color: '#2563eb', textColor: '#ffffff' },
    { id: '3', name: 'Pruebas',               description: 'Pruebas y validación',              startDate: new Date(2026, 0, 26), duration: 10, color: '#2563eb', textColor: '#ffffff' },
  ]);

  const [phases, setPhases] = useState<Phase[]>([
    { id: 'p1', name: 'Planificación', startDate: new Date(2026, 0, 1),  endDate: new Date(2026, 0, 31),  color: '#0d9488', textColor: '#ffffff' },
    { id: 'p2', name: 'Ejecución',     startDate: new Date(2026, 1, 1),  endDate: new Date(2026, 2, 31),  color: '#7c3aed', textColor: '#ffffff' },
  ]);

  const [milestones, setMilestones] = useState<Milestone[]>([
    { id: 'm1', name: 'Kick-off',            date: new Date(2026, 0, 5),  color: '#dc2626', textColor: '#ffffff', description: 'Inicio oficial del proyecto' },
    { id: 'm2', name: 'Revisión intermedia', date: new Date(2026, 1, 1),  color: '#d97706', textColor: '#ffffff', description: 'Revisión de avance' },
    { id: 'm3', name: 'Entrega final',       date: new Date(2026, 2, 31), color: '#7c3aed', textColor: '#ffffff' },
  ]);

  const [periodStart, setPeriodStart] = useState(new Date(2026, 0, 1));
  const [periodEnd,   setPeriodEnd]   = useState(new Date(2026, 2, 31));

  const [showActivityForm,  setShowActivityForm]  = useState(false);
  const [showPhaseForm,     setShowPhaseForm]     = useState(false);
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [editingActivity,   setEditingActivity]   = useState<Activity | null>(null);
  const [editingPhase,      setEditingPhase]      = useState<Phase | null>(null);
  const [editingMilestone,  setEditingMilestone]  = useState<Milestone | null>(null);

  const [saveStatus, setSaveStatus]   = useState<string>('');
  const [isSaving,   setIsSaving]     = useState(false);
  const [isLoading,  setIsLoading]    = useState(false);
  const [isDeleting, setIsDeleting]   = useState(false);
  const [savedList,  setSavedList]    = useState<SavedCronograma[]>([]);
  const [selectedId, setSelectedId]   = useState<string>('');
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [storageChoiceDialog, setStorageChoiceDialog] = useState<'save' | 'open' | null>(null);
  const [saveDialogMode, setSaveDialogMode] = useState<'online' | 'file'>('online');
  const [newName, setNewName] = useState('');

  const refreshList = async () => {
    try {
      const list = await listCronogramas();
      setSavedList(list);
    } catch (e) {
      // silencioso
    }
  };

  useEffect(() => {
    refreshList();

    // Al volver la conexión, reintenta subir a la nube lo que se guardó offline.
    const handleOnline = async () => {
      const synced = await retryPendingSync();
      if (synced > 0) {
        setSaveStatus(`${synced} cronograma(s) sincronizados con la nube`);
        setTimeout(() => setSaveStatus(''), 4000);
        refreshList();
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  const handleOpenSaveDialog = () => {
    setStorageChoiceDialog('save');
  };

  const handleChooseSaveDestination = (destination: 'online' | 'file') => {
    setStorageChoiceDialog(null);
    setNewName('');
    setSaveDialogMode(destination);
    setShowNameDialog(true);
  };

  const handleOpenStorageDialog = () => {
    setStorageChoiceDialog('open');
  };

  const handleConfirmSave = async () => {
    if (!newName.trim()) return;

    // Modo "archivo": pide el nombre con este mismo modal, pero delega el
    // guardado real al diálogo nativo de "Guardar como..." de Electron.
    if (saveDialogMode === 'file') {
      setShowNameDialog(false);
      await doExportFile(newName.trim());
      return;
    }

    setIsSaving(true);
    setSaveStatus('Guardando...');
    setShowNameDialog(false);
    try {
      const { syncedToCloud } = await saveCronograma(newName.trim(), {
        activities, phases, milestones, periodStart, periodEnd,
      });
      setSaveStatus(
        syncedToCloud
          ? 'Guardado como "' + newName.trim() + '" (local + nube)'
          : 'Guardado como "' + newName.trim() + '" (solo local, sin conexión)'
      );
      await refreshList();
    } catch (e: any) {
      setSaveStatus('Error al guardar: ' + e.message);
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveStatus(''), 4000);
    }
  };

  const handleLoad = async () => {
    if (!selectedId) {
      setSaveStatus('Elige un cronograma de la lista primero');
      setTimeout(() => setSaveStatus(''), 3000);
      return;
    }
    setIsLoading(true);
    setSaveStatus('Cargando...');
    try {
      const { activities: a, phases: p, milestones: m, periodStart: ps, periodEnd: pe } =
        await loadCronograma(selectedId);
      setActivities(a);
      setPhases(p);
      setMilestones(m);
      setPeriodStart(ps);
      setPeriodEnd(pe);
      setSaveStatus('Cronograma cargado');
    } catch (e: any) {
      setSaveStatus('Error al cargar: ' + e.message);
    } finally {
      setIsLoading(false);
      setTimeout(() => setSaveStatus(''), 4000);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) {
      setSaveStatus('Elige un cronograma de la lista primero');
      setTimeout(() => setSaveStatus(''), 3000);
      return;
    }
    const item = savedList.find(s => s.id === selectedId);
    if (!window.confirm('Eliminar "' + (item?.nombre ?? '') + '"? Esta accion no se puede deshacer.')) return;

    setIsDeleting(true);
    setSaveStatus('Eliminando...');
    try {
      await deleteCronograma(selectedId);
      setSaveStatus('Eliminado correctamente');
      setSelectedId('');
      await refreshList();
    } catch (e: any) {
      setSaveStatus('Error al eliminar: ' + e.message);
    } finally {
      setIsDeleting(false);
      setTimeout(() => setSaveStatus(''), 4000);
    }
  };

  // Guarda una copia como archivo .json donde el usuario elija.
  const doExportFile = async (nombre: string) => {
    setIsSaving(true);
    setSaveStatus('Guardando archivo...');
    try {
      const path = await saveCronogramaToFile(nombre, { activities, phases, milestones, periodStart, periodEnd });
      setSaveStatus(path ? `Guardado en: ${path}` : 'Descarga iniciada');
    } catch (e: any) {
      setSaveStatus('Error al guardar archivo: ' + e.message);
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveStatus(''), 6000);
    }
  };

  // Abre el diálogo nativo "Abrir archivo..." para elegir un .json del ordenador.
  const handleImportFile = async () => {
    setIsLoading(true);
    setSaveStatus('Abriendo archivo...');
    try {
      const result = await loadCronogramaFromFile();
      if (!result) { setSaveStatus(''); return; } // el usuario canceló
      setActivities(result.data.activities);
      setPhases(result.data.phases);
      setMilestones(result.data.milestones);
      setPeriodStart(result.data.periodStart);
      setPeriodEnd(result.data.periodEnd);
      setSaveStatus(`Archivo cargado: ${result.nombre}`);
    } catch (e: any) {
      setSaveStatus('Error al abrir archivo: ' + e.message);
    } finally {
      setIsLoading(false);
      setTimeout(() => setSaveStatus(''), 4000);
    }
  };

  const handleChooseOpenSource = async (source: 'online' | 'file') => {
    setStorageChoiceDialog(null);
    if (source === 'online') {
      await handleLoad();
    } else {
      await handleImportFile();
    }
  };

  const handleAddActivity = (a: Omit<Activity, 'id'>) =>
    setActivities(prev => [...prev, { ...a, color: a.color || '#2563eb', textColor: a.textColor || '#ffffff', fontFamily: a.fontFamily || 'inherit', id: Date.now().toString() }]);

  const handleUpdateActivity = (a: Activity) => {
    setActivities(prev => prev.map(x => x.id === a.id ? a : x));
    setEditingActivity(null); setShowActivityForm(false);
  };
  const handleDeleteActivity = (id: string) => setActivities(prev => prev.filter(a => a.id !== id));
  const handleEditActivity   = (a: Activity) => { setEditingActivity(a); setShowActivityForm(true); };
  const handleActivityColorChange     = (id: string, color: string)     => setActivities(prev => prev.map(a => a.id === id ? { ...a, color }     : a));
  const handleActivityTextColorChange = (id: string, textColor: string) => setActivities(prev => prev.map(a => a.id === id ? { ...a, textColor } : a));
  const handleActivityFontFamilyChange = (id: string, fontFamily: string) => setActivities(prev => prev.map(a => a.id === id ? { ...a, fontFamily } : a));
  const handleActivityDrag = (id: string, startDate: Date, duration: number) =>
    setActivities(prev => prev.map(a => a.id === id ? { ...a, startDate, duration } : a));

  const handleAddPhase = (p: Omit<Phase, 'id'>) =>
    setPhases(prev => [...prev, { ...p, textColor: p.textColor || '#ffffff', fontFamily: p.fontFamily || 'inherit', id: Date.now().toString() }]);

  const handleUpdatePhase = (p: Phase) => {
    setPhases(prev => prev.map(x => x.id === p.id ? p : x));
    setEditingPhase(null); setShowPhaseForm(false);
  };
  const handleDeletePhase = (id: string) => setPhases(prev => prev.filter(p => p.id !== id));
  const handleEditPhase   = (p: Phase)   => { setEditingPhase(p); setShowPhaseForm(true); };
  const handlePhaseDrag           = (id: string, startDate: Date, endDate: Date) =>
    setPhases(prev => prev.map(p => p.id === id ? { ...p, startDate, endDate } : p));
  const handlePhaseColorChange    = (id: string, color: string)     => setPhases(prev => prev.map(p => p.id === id ? { ...p, color }     : p));
  const handlePhaseTextColorChange= (id: string, textColor: string) => setPhases(prev => prev.map(p => p.id === id ? { ...p, textColor } : p));
  const handlePhaseFontFamilyChange = (id: string, fontFamily: string) => setPhases(prev => prev.map(p => p.id === id ? { ...p, fontFamily } : p));

  const handleAddMilestone = (m: Omit<Milestone, 'id'>) =>
    setMilestones(prev => [...prev, { ...m, textColor: m.textColor || '#ffffff', fontFamily: m.fontFamily || 'inherit', id: Date.now().toString() }]);

  const handleUpdateMilestone = (m: Milestone) => {
    setMilestones(prev => prev.map(x => x.id === m.id ? m : x));
    setEditingMilestone(null); setShowMilestoneForm(false);
  };
  const handleDeleteMilestone = (id: string) => setMilestones(prev => prev.filter(m => m.id !== id));
  const handleEditMilestone   = (m: Milestone) => { setEditingMilestone(m); setShowMilestoneForm(true); };
  const handleMilestoneDrag            = (id: string, date: Date)        => setMilestones(prev => prev.map(m => m.id === id ? { ...m, date }      : m));
  const handleMilestoneColorChange     = (id: string, color: string)     => setMilestones(prev => prev.map(m => m.id === id ? { ...m, color }     : m));
  const handleMilestoneTextColorChange = (id: string, textColor: string) => setMilestones(prev => prev.map(m => m.id === id ? { ...m, textColor } : m));
  const handleMilestoneFontFamilyChange = (id: string, fontFamily: string) => setMilestones(prev => prev.map(m => m.id === id ? { ...m, fontFamily } : m));

  const closeAll = () => {
    setShowActivityForm(false); setShowPhaseForm(false); setShowMilestoneForm(false);
    setEditingActivity(null); setEditingPhase(null); setEditingMilestone(null);
  };

  const busy = isSaving || isLoading || isDeleting;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">

        {storageChoiceDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-[520px] max-w-[92vw] p-6">
              <h2 className="text-slate-900 font-semibold mb-1">
                {storageChoiceDialog === 'save' ? 'Guardar cronograma' : 'Abrir cronograma'}
              </h2>
              <p className="text-sm text-slate-500 mb-5">
                {storageChoiceDialog === 'save'
                  ? 'Elige donde quieres guardar este cronograma.'
                  : 'Elige desde donde quieres abrir el cronograma.'}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => storageChoiceDialog === 'save'
                    ? handleChooseSaveDestination('online')
                    : handleChooseOpenSource('online')}
                  disabled={storageChoiceDialog === 'open' && !selectedId}
                  className="text-left p-4 rounded-xl border-2 border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-colors disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:border-slate-200 disabled:hover:bg-white"
                >
                  <div className="flex items-center gap-2 mb-1 text-slate-900 font-medium">
                    <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.5 19H9a7 7 0 110-14c3.3 0 6 2.2 6.8 5.2A4.5 4.5 0 1117.5 19z"/>
                    </svg>
                    En l&iacute;nea
                  </div>
                  <p className="text-xs text-slate-500">
                    {storageChoiceDialog === 'save'
                      ? 'Guardar en la biblioteca de la app y sincronizar con la nube.'
                      : selectedId
                        ? 'Abrir el cronograma seleccionado en la lista.'
                        : 'Selecciona primero un cronograma en la lista superior.'}
                  </p>
                </button>

                <button
                  onClick={() => storageChoiceDialog === 'save'
                    ? handleChooseSaveDestination('file')
                    : handleChooseOpenSource('file')}
                  className="text-left p-4 rounded-xl border-2 border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1 text-slate-900 font-medium">
                    <svg className="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                    </svg>
                    Este ordenador
                  </div>
                  <p className="text-xs text-slate-500">
                    {storageChoiceDialog === 'save'
                      ? 'Guardar un archivo .json en la carpeta que elijas.'
                      : 'Elegir un archivo .json desde los archivos del ordenador.'}
                  </p>
                </button>
              </div>

              <div className="flex justify-end mt-5">
                <button
                  onClick={() => setStorageChoiceDialog(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {showNameDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-[420px] max-w-[90vw] p-6">
              <h2 className="text-slate-900 font-semibold mb-1">
                {saveDialogMode === 'file' ? 'Guardar en el ordenador' : 'Guardar en l\u00ednea'}
              </h2>
              <p className="text-sm text-slate-500 mb-4">
                {saveDialogMode === 'file'
                  ? 'Escribe un nombre. Luego elegirás la carpeta con el explorador de archivos.'
                  : 'Escribe un nombre para identificarlo en la biblioteca de la app.'}
              </p>
              <input
                type="text"
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleConfirmSave()}
                placeholder="Ej: Proyecto Cliente A"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowNameDialog(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmSave}
                  disabled={!newName.trim()}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {saveDialogMode === 'file' ? 'Continuar' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-slate-900">Cronograma de Trabajo</h1>
              <span className="px-2 py-0.5 rounded-full border border-slate-200 bg-white text-[11px] font-medium text-slate-500">v0.1.7</span>
            </div>
            <p className="text-slate-600">Gestiona tus actividades, etapas e hitos</p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {saveStatus && (
              <span className={`text-sm px-3 py-1.5 rounded-lg font-medium ${
                saveStatus.startsWith('Guardado') || saveStatus.startsWith('Cronograma') || saveStatus.startsWith('Eliminado') ? 'bg-green-50 text-green-700 border border-green-200' :
                saveStatus.startsWith('Error') ? 'bg-red-50 text-red-700 border border-red-200' :
                saveStatus.startsWith('Elige') ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                'bg-blue-50 text-blue-700 border border-blue-200'
              }`}>
                {saveStatus}
              </span>
            )}

            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              disabled={busy}
              className="px-3 py-2 rounded-lg border-2 border-slate-300 bg-white text-slate-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 min-w-[180px]"
            >
              <option value="">Elegir cronograma...</option>
              {savedList.map(item => (
                <option key={item.id} value={item.id}>
                  {item.nombre}{item.pendingSync ? ' (pendiente de sincronizar)' : ''}
                </option>
              ))}
            </select>

            <button
              onClick={handleOpenStorageDialog}
              disabled={busy}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-slate-300 bg-white text-slate-700 font-medium text-sm hover:bg-slate-50 hover:border-slate-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {isLoading ? (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                </svg>
              )}
              {isLoading ? 'Abriendo...' : 'Abrir'}
            </button>

            <button
              onClick={handleDelete}
              disabled={busy}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-red-200 bg-white text-red-600 font-medium text-sm hover:bg-red-50 hover:border-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {isDeleting ? (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m5 0V4a2 2 0 012-2h0a2 2 0 012 2v2"/>
                </svg>
              )}
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </button>

            <button
              onClick={handleOpenSaveDialog}
              disabled={busy}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
              </svg>
              Guardar
            </button>

          </div>
        </div>

        {showPhaseForm     && <PhaseForm     onSubmit={editingPhase     ? handleUpdatePhase     : handleAddPhase}     onCancel={closeAll} initialPhase={editingPhase} />}
        {showMilestoneForm && <MilestoneForm onSubmit={editingMilestone ? handleUpdateMilestone : handleAddMilestone} onCancel={closeAll} initialMilestone={editingMilestone} />}
        {showActivityForm  && <ActivityForm  onSubmit={editingActivity  ? handleUpdateActivity  : handleAddActivity}  onCancel={closeAll} initialActivity={editingActivity} />}

        <Timeline
          activities={activities} phases={phases} milestones={milestones}
          periodStart={periodStart} periodEnd={periodEnd}
          onPeriodStartChange={setPeriodStart} onPeriodEndChange={setPeriodEnd}
          onAddActivity={() => { setEditingActivity(null); setShowActivityForm(true); }}
          onEditActivity={handleEditActivity} onDeleteActivity={handleDeleteActivity}
          onActivityColorChange={handleActivityColorChange}
          onActivityTextColorChange={handleActivityTextColorChange}
          onActivityFontFamilyChange={handleActivityFontFamilyChange}
          onActivityDrag={handleActivityDrag}
          onAddPhase={() => { setEditingPhase(null); setShowPhaseForm(true); }}
          onEditPhase={handleEditPhase} onDeletePhase={handleDeletePhase}
          onPhaseDrag={handlePhaseDrag}
          onPhaseColorChange={handlePhaseColorChange}
          onPhaseTextColorChange={handlePhaseTextColorChange}
          onPhaseFontFamilyChange={handlePhaseFontFamilyChange}
          onAddMilestone={() => { setEditingMilestone(null); setShowMilestoneForm(true); }}
          onEditMilestone={handleEditMilestone} onDeleteMilestone={handleDeleteMilestone}
          onMilestoneDrag={handleMilestoneDrag}
          onMilestoneColorChange={handleMilestoneColorChange}
          onMilestoneTextColorChange={handleMilestoneTextColorChange}
          onMilestoneFontFamilyChange={handleMilestoneFontFamilyChange}
        />
      </div>
    </div>
  );
}
