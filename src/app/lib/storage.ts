import { CronogramaData, SavedCronograma } from '../types';

// ─────────────────────────────────────────────────────────────
// CONFIGURACION SUPABASE (opcional) - reemplaza estos dos valores
// si quieres que el equipo comparta cronogramas por la nube.
// Si dejas esto vacío o sin conexión, la app funciona 100% local.
// ─────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://hujdumahgvlnvitgrmiz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_4k6TsETRrvxgdCToSHNDAg_pYwrLv52';
const TABLE_NAME = 'Cronograma';
// ─────────────────────────────────────────────────────────────

const headers = {
  'Content-Type': 'application/json',
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
};

async function isOnline(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  return true;
}

// ---------- serializacion (Date <-> string, para poder guardar en JSON) ----------
export function serializeData(data: CronogramaData) {
  return {
    activities: data.activities.map(a => ({ ...a, startDate: a.startDate.toISOString() })),
    phases: data.phases.map(p => ({
      ...p,
      startDate: p.startDate.toISOString(),
      endDate: p.endDate.toISOString(),
    })),
    milestones: data.milestones.map(m => ({ ...m, date: m.date.toISOString() })),
    periodStart: data.periodStart.toISOString(),
    periodEnd: data.periodEnd.toISOString(),
  };
}

export function deserializeData(raw: any): CronogramaData {
  return {
    activities: (raw.activities || []).map((a: any) => ({ ...a, textColor: a.textColor || '#ffffff', fontFamily: a.fontFamily || 'inherit', startDate: new Date(a.startDate) })),
    phases: (raw.phases || []).map((p: any) => ({
      ...p,
      textColor: p.textColor || '#ffffff',
      fontFamily: p.fontFamily || 'inherit',
      startDate: new Date(p.startDate),
      endDate: new Date(p.endDate),
    })),
    milestones: (raw.milestones || []).map((m: any) => ({ ...m, textColor: m.textColor || '#ffffff', fontFamily: m.fontFamily || 'inherit', date: new Date(m.date) })),
    periodStart: new Date(raw.periodStart),
    periodEnd: new Date(raw.periodEnd),
  };
}

// ---------- almacenamiento LOCAL ----------
// Electron guarda esto dentro del perfil de la app (en la carpeta de datos
// del usuario: %APPDATA% en Windows, ~/Library/Application Support en Mac),
// así que sobrevive a que cierres y abras el programa. No depende de internet.

async function readIndexLocal(): Promise<SavedCronograma[]> {
  const raw = localStorage.getItem('cronogramas_index');
  return raw ? JSON.parse(raw) : [];
}

async function writeIndexLocal(list: SavedCronograma[]) {
  localStorage.setItem('cronogramas_index', JSON.stringify(list));
}

async function readDataLocal(id: string): Promise<any | null> {
  const raw = localStorage.getItem(`cronograma_${id}`);
  return raw ? JSON.parse(raw) : null;
}

async function writeDataLocal(id: string, payload: any) {
  localStorage.setItem(`cronograma_${id}`, JSON.stringify(payload));
}

async function deleteDataLocal(id: string) {
  localStorage.removeItem(`cronograma_${id}`);
}

// ---------- Supabase (remoto, opcional) ----------

async function listRemote(): Promise<{ id: number; nombre: string }[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE_NAME}?select=id,nombre&order=id.desc`, {
    headers,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function saveRemote(nombre: string, payload: object, remoteId?: number) {
  if (remoteId) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE_NAME}?id=eq.${remoteId}`, {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({ nombre, data: payload }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE_NAME}`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({ nombre, data: payload }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function loadRemote(id: number) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE_NAME}?id=eq.${id}&select=data`, { headers });
  if (!res.ok) throw new Error(await res.text());
  const rows = await res.json();
  if (!rows || rows.length === 0) throw new Error('No se encontró ese cronograma en la nube.');
  return rows[0].data;
}

async function deleteRemote(id: number) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE_NAME}?id=eq.${id}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) throw new Error(await res.text());
}

// ---------- API pública usada por App.tsx ----------

/**
 * Lista los cronogramas guardados. Siempre lee primero de local (funciona
 * sin internet). Si hay conexión, además trae los que existan en Supabase
 * y no estén todavía en este ordenador (ej. los guardó un compañero).
 */
export async function listCronogramas(): Promise<SavedCronograma[]> {
  const local = await readIndexLocal();

  if (await isOnline()) {
    try {
      const remote = await listRemote();
      let changed = false;
      for (const r of remote) {
        const yaExiste = local.some(l => l.remoteId === r.id);
        if (!yaExiste) {
          local.push({
            id: `remote-${r.id}`,
            remoteId: r.id,
            nombre: r.nombre,
            updatedAt: new Date(0).toISOString(),
          });
          changed = true;
        }
      }
      if (changed) await writeIndexLocal(local);
    } catch {
      // No se pudo contactar Supabase: seguimos solo con lo que hay en local.
    }
  }

  return [...local].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

/**
 * Guarda SIEMPRE en local primero (esto nunca falla, no depende de internet).
 * Si hay conexión, intenta también subirlo a Supabase. Si falla o no hay
 * conexión, queda marcado como "pendingSync" para reintentar más tarde.
 */
export async function saveCronograma(
  nombre: string,
  data: CronogramaData
): Promise<{ syncedToCloud: boolean }> {
  const payload = serializeData(data);
  const list = await readIndexLocal();
  const id = crypto.randomUUID();
  const entry: SavedCronograma = { id, nombre, updatedAt: new Date().toISOString() };

  await writeDataLocal(id, payload);

  let syncedToCloud = false;
  if (await isOnline()) {
    try {
      const rows = await saveRemote(nombre, payload);
      entry.remoteId = rows?.[0]?.id;
      syncedToCloud = true;
    } catch {
      entry.pendingSync = true;
    }
  } else {
    entry.pendingSync = true;
  }

  list.unshift(entry);
  await writeIndexLocal(list);
  return { syncedToCloud };
}

/** Carga un cronograma. Prioriza la copia local; si no existe la busca en la nube. */
export async function loadCronograma(id: string): Promise<CronogramaData> {
  const cached = await readDataLocal(id);
  if (cached) return deserializeData(cached);

  const list = await readIndexLocal();
  const entry = list.find(l => l.id === id);
  if (entry?.remoteId && (await isOnline())) {
    const raw = await loadRemote(entry.remoteId);
    await writeDataLocal(id, raw);
    return deserializeData(raw);
  }
  throw new Error('No se encontró ese cronograma en este ordenador y no hay conexión para buscarlo en la nube.');
}

/** Elimina en local, y también en la nube si hay conexión y ya estaba sincronizado. */
export async function deleteCronograma(id: string): Promise<void> {
  const list = await readIndexLocal();
  const entry = list.find(l => l.id === id);

  await deleteDataLocal(id);

  if (entry?.remoteId && (await isOnline())) {
    try {
      await deleteRemote(entry.remoteId);
    } catch {
      // Se elimina igual en local aunque falle la nube.
    }
  }

  await writeIndexLocal(list.filter(l => l.id !== id));
}

/**
 * Reintenta subir a Supabase todo lo que quedó "pendingSync" (guardado
 * mientras no había internet). Útil llamarla cuando vuelve la conexión.
 * Devuelve cuántos cronogramas se sincronizaron.
 */
export async function retryPendingSync(): Promise<number> {
  if (!(await isOnline())) return 0;
  const list = await readIndexLocal();
  let synced = 0;

  for (const entry of list) {
    if (!entry.pendingSync) continue;
    const data = await readDataLocal(entry.id);
    if (!data) continue;
    try {
      const rows = await saveRemote(entry.nombre, data, entry.remoteId);
      entry.remoteId = rows?.[0]?.id ?? entry.remoteId;
      entry.pendingSync = false;
      synced++;
    } catch {
      // Sigue pendiente, se reintentará la próxima vez.
    }
  }

  if (synced > 0) await writeIndexLocal(list);
  return synced;
}

// ---------- Guardar/abrir como archivo .json real (diálogo nativo) ----------
// Esto es independiente de la lista interna de arriba: aquí el usuario elige
// carpeta y nombre con el diálogo nativo del sistema operativo, como en
// cualquier otro programa de escritorio.

declare global {
  interface Window {
    electronAPI?: {
      saveFileDialog: (defaultName: string, content: string) => Promise<string | null>;
      openFileDialog: () => Promise<{ path: string; content: string } | null>;
      resizeWindowForCapture: (size: { width: number; height: number }) => Promise<{ prevWidth: number; prevHeight: number } | null>;
      captureRect: (rect: { x: number; y: number; width: number; height: number }) => Promise<string | null>;
      restoreWindowSize: (size: { width: number; height: number }) => Promise<boolean | null>;
    };
  }
}

function slugify(nombre: string): string {
  return nombre
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita acentos
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'cronograma';
}

/**
 * Guarda el cronograma como archivo .json en la carpeta que el usuario elija,
 * usando el diálogo nativo "Guardar como...". Devuelve la ruta guardada, o
 * null si el usuario canceló el diálogo.
 */
export async function saveCronogramaToFile(nombre: string, data: CronogramaData): Promise<string | null> {
  const content = JSON.stringify({ nombre, ...serializeData(data) }, null, 2);

  if (window.electronAPI) {
    return window.electronAPI.saveFileDialog(`${slugify(nombre)}.json`, content);
  }

  // Respaldo si se abre en un navegador normal (sin Electron): descarga directa.
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slugify(nombre)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return null;
}

/**
 * Abre el diálogo nativo "Abrir archivo..." para que el usuario elija un
 * .json de su ordenador y lo carga. Devuelve null si canceló.
 */
export async function loadCronogramaFromFile(): Promise<{ nombre: string; data: CronogramaData } | null> {
  if (!window.electronAPI) {
    throw new Error('Elegir archivo del ordenador solo está disponible en la app de escritorio.');
  }
  const result = await window.electronAPI.openFileDialog();
  if (!result) return null;

  let raw: any;
  try {
    raw = JSON.parse(result.content);
  } catch {
    throw new Error('El archivo elegido no es un cronograma válido (.json).');
  }
  return { nombre: raw.nombre || 'Cronograma importado', data: deserializeData(raw) };
}

