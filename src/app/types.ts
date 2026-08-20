export interface Activity {
  id: string;
  name: string;
  description: string;
  startDate: Date;
  duration: number;
  color: string;
  textColor: string;
  fontFamily?: string;
}

export interface Phase {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  color: string;
  textColor: string;
  fontFamily?: string;
}

export interface Milestone {
  id: string;
  name: string;
  date: Date;
  color: string;
  textColor: string;
  fontFamily?: string;
  description?: string;
}

export interface CronogramaData {
  activities: Activity[];
  phases: Phase[];
  milestones: Milestone[];
  periodStart: Date;
  periodEnd: Date;
}

// Un cronograma guardado en el selector. "id" es SIEMPRE el id local
// (existe incluso sin internet). "remoteId" es el id en Supabase, solo
// existe si ya se sincronizó con la nube en algún momento.
export interface SavedCronograma {
  id: string;
  remoteId?: number;
  nombre: string;
  updatedAt: string;
  pendingSync?: boolean;
}
