import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { Activity, Phase, Milestone } from '../App';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import {
  Edit, Trash2, Calendar, Plus, Palette,
  Diamond, Flag, Download, ZoomIn, ZoomOut, X, Loader2,
} from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────

type ViewMode = 'days' | 'months' | 'years';
const BASE_UNIT: Record<ViewMode, number> = { days: 48, months: 80, years: 60 };
const LABEL_COL_W    = 256;
const MILESTONE_ROW_H = 110;
const PHASE_ROW_H    = 52;
const ACTIVITY_ROW_H = 80;
const HANDLE_W       = 8;
const ZOOM_STEP      = 0.25;
const ZOOM_MIN       = 0.25;
const ZOOM_MAX       = 3.0;

// Milestone label sizing
const MS_LABEL_MIN_W = 50;
const MS_LABEL_MAX_W = 220;
const MS_LABEL_PADDING_X = 12; // px-1.5 left + right approx in px (rounded up for safety)
const MS_LABEL_CHAR_W = 6.2;   // approx px per character at fontSize 10, font-semibold

const BAR_SWATCHES = [
  '#2563eb','#7c3aed','#db2777','#dc2626',
  '#ea580c','#d97706','#65a30d','#059669',
  '#0891b2','#0284c7','#4f46e5','#9333ea',
  '#475569','#64748b','#0d9488','#1e293b',
];
const TEXT_SWATCHES = [
  '#ffffff','#f8fafc','#f1f5f9','#e2e8f0',
  '#0f172a','#1e293b','#334155','#475569',
  '#fef9c3','#fef3c7','#dcfce7','#dbeafe',
  '#ffe4e6','#fae8ff','#ffedd5','#ecfdf5',
];

const FONT_OPTIONS = [
  { value: 'inherit', label: 'Predeterminada', css: 'inherit' },
  { value: 'system', label: 'Sistema', css: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  { value: 'Arial', label: 'Arial', css: 'Arial, Helvetica, sans-serif' },
  { value: 'Verdana', label: 'Verdana', css: 'Verdana, Geneva, sans-serif' },
  { value: 'Trebuchet MS', label: 'Trebuchet MS', css: '"Trebuchet MS", Arial, sans-serif' },
  { value: 'Georgia', label: 'Georgia', css: 'Georgia, "Times New Roman", serif' },
  { value: 'Times New Roman', label: 'Times New Roman', css: '"Times New Roman", Times, serif' },
  { value: 'Courier New', label: 'Courier New', css: '"Courier New", Courier, monospace' },
] as const;

function fontCss(value?: string): string {
  return FONT_OPTIONS.find(f => f.value === value)?.css ?? value ?? 'inherit';
}

function excelFontName(value?: string): string | undefined {
  if (!value || value === 'inherit' || value === 'system') return undefined;
  return value;
}

const PAPER_SIZES: Record<string, [number, number]> = {
  A4:     [210, 297],
  A3:     [297, 420],
  A2:     [420, 594],
  A1:     [594, 841],
  Letter: [216, 279],
  Legal:  [216, 356],
};

// ── Helper: estimate label width from text length ───────────────────────────
function estimateMilestoneWidth(text: string): number {
  const raw = text.length * MS_LABEL_CHAR_W + MS_LABEL_PADDING_X;
  return Math.min(MS_LABEL_MAX_W, Math.max(MS_LABEL_MIN_W, Math.round(raw)));
}

// ── Dual Color Picker (bar bg + text) ─────────────────────────────────────────

interface DualColorPickerProps {
  bgColor: string;
  textColor: string;
  fontFamily: string;
  anchorRect: DOMRect;
  onSelectBg:   (c: string) => void;
  onSelectText: (c: string) => void;
  onSelectFont: (font: string) => void;
  onClose: () => void;
}
function DualColorPicker({ bgColor, textColor, fontFamily, anchorRect, onSelectBg, onSelectText, onSelectFont, onClose }: DualColorPickerProps) {
  const [tab, setTab] = useState<'bg' | 'text' | 'font'>('bg');
  const ref = useRef<HTMLDivElement>(null);
  const [panelPosition, setPanelPosition] = useState({
    top: Math.max(12, anchorRect.bottom + 8),
    left: Math.max(12, Math.min(anchorRect.left, window.innerWidth - 268)),
    maxHeight: Math.max(120, window.innerHeight - 24),
    ready: false,
  });

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  // Mantiene el panel siempre dentro del viewport. Si no hay espacio debajo
  // de la barra seleccionada, se abre automáticamente por encima. En ventanas
  // muy pequeñas el propio panel se hace desplazable en lugar de quedar cortado.
  const updatePanelPosition = useCallback(() => {
    const panel = ref.current;
    if (!panel) return;

    const margin = 12;
    const gap = 8;
    const panelWidth = 256; // w-64
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const naturalHeight = Math.max(panel.scrollHeight, panel.getBoundingClientRect().height);
    const viewportMaxHeight = Math.max(96, viewportHeight - margin * 2);
    const desiredHeight = Math.min(naturalHeight, viewportMaxHeight);

    const spaceBelow = Math.max(0, viewportHeight - anchorRect.bottom - gap - margin);
    const spaceAbove = Math.max(0, anchorRect.top - gap - margin);
    const placeAbove = spaceBelow < desiredHeight && spaceAbove > spaceBelow;
    const availableSpace = placeAbove ? spaceAbove : spaceBelow;
    const panelHeight = Math.min(desiredHeight, Math.max(96, availableSpace));

    const left = Math.max(
      margin,
      Math.min(anchorRect.left, viewportWidth - panelWidth - margin),
    );

    const top = placeAbove
      ? Math.max(margin, anchorRect.top - gap - panelHeight)
      : Math.min(anchorRect.bottom + gap, viewportHeight - margin - panelHeight);

    setPanelPosition({
      top: Math.max(margin, top),
      left,
      maxHeight: panelHeight,
      ready: true,
    });
  }, [anchorRect]);

  useLayoutEffect(() => {
    updatePanelPosition();
    const frame = window.requestAnimationFrame(updatePanelPosition);
    window.addEventListener('resize', updatePanelPosition);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updatePanelPosition);
    };
  }, [updatePanelPosition, tab]);

  const swatches = tab === 'bg' ? BAR_SWATCHES : TEXT_SWATCHES;
  const current = tab === 'bg' ? bgColor : textColor;
  const onSelect = tab === 'bg' ? onSelectBg : onSelectText;

  return (
    <div ref={ref}
      style={{
        position: 'fixed',
        top: panelPosition.top,
        left: panelPosition.left,
        maxHeight: panelPosition.maxHeight,
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        visibility: panelPosition.ready ? 'visible' : 'hidden',
        zIndex: 9999,
      }}
      className="bg-white border border-slate-200 rounded-xl shadow-xl p-3 w-64">

      <div className="flex rounded-lg border border-slate-200 overflow-hidden mb-3">
        {(['bg','text','font'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-1 text-xs font-medium transition-colors ${tab === t ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
            {t === 'bg' ? 'Barra' : t === 'text' ? 'Texto' : 'Fuente'}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-3 px-1">
        <div className="w-14 h-7 rounded text-xs flex items-center justify-center font-medium"
          style={{ backgroundColor: bgColor, color: textColor, fontFamily: fontCss(fontFamily) }}>Aa</div>
        <span className="text-xs text-slate-400">Vista previa</span>
      </div>

      {tab === 'font' ? (
        <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
          {FONT_OPTIONS.map(option => (
            <button
              key={option.value}
              onClick={() => onSelectFont(option.value)}
              className={`w-full px-3 py-2 rounded-lg border text-left text-sm transition-colors ${fontFamily === option.value ? 'border-blue-400 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
              style={{ fontFamily: option.css }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {swatches.map(c => (
              <button key={c} onClick={() => onSelect(c)}
                className="w-9 h-9 rounded-lg border-2 transition-transform hover:scale-110"
                style={{
                  backgroundColor: c,
                  borderColor: c === current ? '#6366f1' : 'transparent',
                  boxShadow: c === '#ffffff' || c === '#f8fafc' ? 'inset 0 0 0 1px #e2e8f0' : undefined,
                }} />
            ))}
          </div>

          <div className="flex items-center gap-2 border-t border-slate-100 pt-2">
            <span className="text-xs text-slate-500 shrink-0">
              {tab === 'bg' ? 'Barra:' : 'Texto:'}
            </span>
            <input type="color" value={current} onChange={e => onSelect(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border border-slate-200" />
            <span className="text-xs text-slate-400 font-mono truncate">{current}</span>
          </div>
        </>
      )}
    </div>
  );
}

// Global font color picker

interface FontColorPickerProps {
  color: string;
  fontFamily: string;
  onChange: (c: string) => void;
  onFontChange: (font: string) => void;
}
function FontColorPicker({ color, fontFamily, onChange, onFontChange }: FontColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'color' | 'font'>('color');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const palette = [
    '#0f172a','#1e293b','#334155','#475569','#64748b','#94a3b8','#cbd5e1','#ffffff',
    '#1d4ed8','#7c3aed','#be185d','#b91c1c','#c2410c','#b45309','#15803d','#0f766e',
  ];

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-sm text-slate-600 transition-colors">
        <span className="text-xs" style={{ fontFamily: fontCss(fontFamily) }}>Fuente</span>
        <span className="w-4 h-4 rounded-full border border-slate-300 inline-block" style={{ backgroundColor: color }} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 right-0 bg-white border border-slate-200 rounded-xl shadow-xl p-3 w-60 z-50">
          <div className="flex rounded-lg border border-slate-200 overflow-hidden mb-3">
            <button onClick={() => setTab('color')}
              className={`flex-1 py-1 text-xs font-medium ${tab === 'color' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
              Color
            </button>
            <button onClick={() => setTab('font')}
              className={`flex-1 py-1 text-xs font-medium ${tab === 'font' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
              Tipograf&iacute;a
            </button>
          </div>

          {tab === 'color' ? (
            <>
              <p className="text-xs text-slate-500 mb-2 font-medium">Color de fuente global</p>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {palette.map(c => (
                  <button key={c} onClick={() => onChange(c)}
                    className="w-9 h-9 rounded-lg border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c,
                      borderColor: c === color ? '#6366f1' : 'transparent',
                      boxShadow: c === '#ffffff' ? 'inset 0 0 0 1px #e2e8f0' : undefined,
                    }} />
                ))}
              </div>
              <div className="flex items-center gap-2 border-t border-slate-100 pt-2">
                <span className="text-xs text-slate-500 shrink-0">Personalizado:</span>
                <input type="color" value={color} onChange={e => onChange(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border border-slate-200" />
              </div>
            </>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
              {FONT_OPTIONS.map(option => (
                <button
                  key={option.value}
                  onClick={() => onFontChange(option.value)}
                  className={`w-full px-3 py-2 rounded-lg border text-left text-sm transition-colors ${fontFamily === option.value ? 'border-blue-400 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                  style={{ fontFamily: option.css }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Export modal

interface ExportConfig { paper: string; orientation: 'landscape' | 'portrait'; fileType: 'pdf' | 'png' | 'jpg' | 'xlsx' }
interface ExportModalProps { onClose: () => void; onExport: (cfg: ExportConfig) => void; exporting: boolean; error?: string }

function ExportModal({ onClose, onExport, exporting, error }: ExportModalProps) {
  const [cfg, setCfg] = useState<ExportConfig>({ paper: 'A4', orientation: 'landscape', fileType: 'pdf' });
  const [pw, ph] = PAPER_SIZES[cfg.paper];
  const isLand   = cfg.orientation === 'landscape';
  const prevW    = isLand ? ph : pw;
  const prevH    = isLand ? pw : ph;
  const scale    = 80 / Math.max(prevW, prevH);
  // El tamaño de papel y la orientación solo aplican a PDF (imagen/Excel no paginan)
  const needsPaperOptions = cfg.fileType === 'pdf';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[480px] max-w-[95vw] p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-slate-900 font-semibold">Exportar cronograma</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
        </div>

        <div className="flex gap-6">
          <div className="flex-1 space-y-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Formato</p>
              <div className="grid grid-cols-4 gap-2">
                {(['pdf','png','jpg','xlsx'] as const).map(t => (
                  <button key={t} onClick={() => setCfg(c => ({ ...c, fileType: t }))}
                    className={`py-2 rounded-lg border-2 text-sm font-medium transition-colors ${cfg.fileType === t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                    {t === 'xlsx' ? 'Excel' : t.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {needsPaperOptions && (
              <>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Tamaño de papel</p>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.keys(PAPER_SIZES).map(p => (
                      <button key={p} onClick={() => setCfg(c => ({ ...c, paper: p }))}
                        className={`py-2 rounded-lg border-2 text-sm font-medium transition-colors ${cfg.paper === p ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Orientación</p>
                  <div className="flex gap-2">
                    {([['landscape','Horizontal'],['portrait','Vertical']] as const).map(([val, label]) => (
                      <button key={val} onClick={() => setCfg(c => ({ ...c, orientation: val }))}
                        className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${cfg.orientation === val ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-slate-400">{isLand ? `${ph} × ${pw}` : `${pw} × ${ph}`} mm</p>
              </>
            )}

            {cfg.fileType === 'xlsx' && (
              <p className="text-xs text-slate-400">Genera una tabla con actividades, fases e hitos (nombre, fechas, duración).</p>
            )}
            {cfg.fileType === 'jpg' && (
              <p className="text-xs text-slate-400">Captura del cronograma en formato JPG (fondo blanco).</p>
            )}
          </div>

          <div className="flex flex-col items-center justify-start pt-6 gap-2">
            {needsPaperOptions ? (
              <>
                <div className="border-2 border-slate-300 rounded-sm bg-slate-50 flex items-center justify-center"
                  style={{ width: prevW * scale, height: prevH * scale }}>
                  <span className="text-slate-400" style={{ fontSize: 9 }}>{cfg.paper}</span>
                </div>
                <span className="text-xs text-slate-400">{isLand ? 'Horizontal' : 'Vertical'}</span>
              </>
            ) : (
              <div className="w-20 h-20 rounded-lg bg-slate-50 border-2 border-slate-200 flex items-center justify-center">
                <Download className="w-6 h-6 text-slate-300" />
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            Error al exportar: {error}
          </div>
        )}

        <div className="flex gap-3 mt-6 justify-end">
          <Button variant="outline" onClick={onClose} disabled={exporting}>Cancelar</Button>
          <Button onClick={() => onExport(cfg)} disabled={exporting} className="gap-2">
            {exporting ? <><Loader2 className="w-4 h-4 animate-spin" />Generando...</> : <><Download className="w-4 h-4" />Descargar</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Drag types ────────────────────────────────────────────────────────────────

type PickerTarget = { id: string; kind: 'activity' | 'phase' | 'milestone'; rect: DOMRect };

type DragKind =
  | { type: 'phase-left';     id: string; origStart: Date; origEnd: Date }
  | { type: 'phase-right';    id: string; origStart: Date; origEnd: Date }
  | { type: 'phase-move';     id: string; origStart: Date; origEnd: Date }
  | { type: 'activity-left';  id: string; origStart: Date; origEnd: Date }
  | { type: 'activity-right'; id: string; origStart: Date; origEnd: Date }
  | { type: 'milestone';      id: string; origDate: Date }
  | { type: 'milestone-resize-left';  id: string; origWidth: number }
  | { type: 'milestone-resize-right'; id: string; origWidth: number }
  | { type: 'period-end'; origEnd: Date; minEnd: Date };

interface DragState { kind: DragKind; startX: number }

// ── Props ─────────────────────────────────────────────────────────────────────

interface TimelineProps {
  activities: Activity[]; phases: Phase[]; milestones: Milestone[];
  periodStart: Date; periodEnd: Date;
  onPeriodStartChange: (d: Date) => void; onPeriodEndChange: (d: Date) => void;
  onAddActivity: () => void; onEditActivity: (a: Activity) => void;
  onDeleteActivity: (id: string) => void;
  onActivityColorChange:     (id: string, c: string) => void;
  onActivityTextColorChange: (id: string, c: string) => void;
  onActivityFontFamilyChange: (id: string, font: string) => void;
  onActivityDrag: (id: string, start: Date, duration: number) => void;
  onAddPhase: () => void; onEditPhase: (p: Phase) => void;
  onDeletePhase: (id: string) => void; onPhaseDrag: (id: string, s: Date, e: Date) => void;
  onPhaseColorChange:     (id: string, c: string) => void;
  onPhaseTextColorChange: (id: string, c: string) => void;
  onPhaseFontFamilyChange: (id: string, font: string) => void;
  onAddMilestone: () => void; onEditMilestone: (m: Milestone) => void;
  onDeleteMilestone: (id: string) => void; onMilestoneDrag: (id: string, d: Date) => void;
  onMilestoneColorChange:     (id: string, c: string) => void;
  onMilestoneTextColorChange: (id: string, c: string) => void;
  onMilestoneFontFamilyChange: (id: string, font: string) => void;
}

// ── Timeline ──────────────────────────────────────────────────────────────────

export function Timeline({
  activities, phases, milestones, periodStart, periodEnd,
  onPeriodStartChange, onPeriodEndChange,
  onAddActivity, onEditActivity, onDeleteActivity,
  onActivityColorChange, onActivityTextColorChange, onActivityFontFamilyChange, onActivityDrag,
  onAddPhase, onEditPhase, onDeletePhase, onPhaseDrag,
  onPhaseColorChange, onPhaseTextColorChange, onPhaseFontFamilyChange,
  onAddMilestone, onEditMilestone, onDeleteMilestone, onMilestoneDrag,
  onMilestoneColorChange, onMilestoneTextColorChange, onMilestoneFontFamilyChange,
}: TimelineProps) {
  const [viewMode,   setViewMode]   = useState<ViewMode>('days');
  const [zoom,       setZoom]       = useState(1.0);
  const [zoomInput,  setZoomInput]  = useState('100');
  const [fontColor,  setFontColor]  = useState('#1e293b');
  const [globalFontFamily, setGlobalFontFamily] = useState('inherit');
  const [picker,     setPicker]     = useState<PickerTarget | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [exporting,  setExporting]  = useState(false);
  const [exportError, setExportError] = useState<string>('');
  const dragRef = useRef<DragState | null>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const scrollWrapperRef = useRef<HTMLDivElement>(null);

  // ── Milestone label widths (id -> px) ─────────────────────────────────────
  const [msWidths, setMsWidths] = useState<Record<string, number>>({});

  // Auto-calcula el ancho la primera vez que aparece un hito (o si cambia su nombre y no fue ajustado a mano)
  useEffect(() => {
    setMsWidths(prev => {
      const next = { ...prev };
      let changed = false;
      milestones.forEach(m => {
        if (next[m.id] === undefined) {
          next[m.id] = estimateMilestoneWidth(m.name);
          changed = true;
        }
      });
      // limpia anchos de hitos que ya no existen
      Object.keys(next).forEach(id => {
        if (!milestones.find(m => m.id === id)) { delete next[id]; changed = true; }
      });
      return changed ? next : prev;
    });
  }, [milestones]);

  const getMsWidth = (id: string, fallbackName: string) => msWidths[id] ?? estimateMilestoneWidth(fallbackName);

  // Keep zoomInput in sync when zoom changes via +/- buttons
  useEffect(() => { setZoomInput(String(Math.round(zoom * 100))); }, [zoom]);

  const applyZoomInput = () => {
    const val = parseInt(zoomInput, 10);
    if (!isNaN(val) && val >= Math.round(ZOOM_MIN * 100) && val <= Math.round(ZOOM_MAX * 100)) {
      setZoom(val / 100);
    } else {
      setZoomInput(String(Math.round(zoom * 100)));
    }
  };

  const minDate = new Date(periodStart);
  const maxDate = new Date(periodEnd);
  const unitW   = BASE_UNIT[viewMode] * zoom;
  const fc      = fontColor;

  // ── Date ↔ Pixel ───────────────────────────────────────────────────────────

  const daysBetween = (a: Date, b: Date) => Math.ceil((b.getTime() - a.getTime()) / 86400000);

  const dateToPixel = useCallback((date: Date): number => {
    const uW = BASE_UNIT[viewMode] * zoom;
    if (viewMode === 'days') return daysBetween(minDate, date) * uW;
    if (viewMode === 'months') {
      const mIdx = (date.getFullYear() - minDate.getFullYear()) * 12 + (date.getMonth() - minDate.getMonth());
      const dim  = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      return (mIdx + (date.getDate() - 1) / dim) * uW;
    }
    const yIdx = date.getFullYear() - minDate.getFullYear();
    const ys   = new Date(date.getFullYear(), 0, 1);
    const ye   = new Date(date.getFullYear() + 1, 0, 1);
    return (yIdx + (date.getTime() - ys.getTime()) / (ye.getTime() - ys.getTime())) * uW;
  }, [viewMode, zoom, minDate]); // eslint-disable-line

  const pixelToDate = useCallback((px: number): Date => {
    const uW = BASE_UNIT[viewMode] * zoom;
    const d  = new Date(minDate);
    if (viewMode === 'days') {
      d.setDate(d.getDate() + Math.round(px / uW));
    } else if (viewMode === 'months') {
      const tot = px / uW; const mI = Math.floor(tot); const mF = tot - mI;
      d.setMonth(d.getMonth() + mI);
      const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(1 + Math.round(mF * (dim - 1)));
    } else {
      const tot = px / uW; const yI = Math.floor(tot); const yF = tot - yI;
      d.setFullYear(d.getFullYear() + yI);
      d.setDate(d.getDate() + Math.round(yF * 365));
    }
    return d;
  }, [viewMode, zoom, minDate]); // eslint-disable-line

  // ── Drag ───────────────────────────────────────────────────────────────────

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const ds = dragRef.current;
    if (!ds) return;
    const dx  = e.clientX - ds.startX;
    const { kind } = ds;

    if (kind.type === 'milestone') {
      onMilestoneDrag(kind.id, pixelToDate(Math.max(0, dateToPixel(kind.origDate) + dx)));
      return;
    }
    if (kind.type === 'milestone-resize-left') {
      // Estirar hacia la izquierda incrementa el ancho (el centro se mantiene en la fecha)
      const newWidth = Math.min(MS_LABEL_MAX_W, Math.max(MS_LABEL_MIN_W, kind.origWidth - dx * 2));
      setMsWidths(prev => ({ ...prev, [kind.id]: newWidth }));
      return;
    }
    if (kind.type === 'milestone-resize-right') {
      const newWidth = Math.min(MS_LABEL_MAX_W, Math.max(MS_LABEL_MIN_W, kind.origWidth + dx * 2));
      setMsWidths(prev => ({ ...prev, [kind.id]: newWidth }));
      return;
    }
    if (kind.type === 'phase-left') {
      const ns = pixelToDate(Math.max(0, dateToPixel(kind.origStart) + dx));
      if (ns < kind.origEnd) onPhaseDrag(kind.id, ns, kind.origEnd);
      return;
    }
    if (kind.type === 'phase-right') {
      const ne = pixelToDate(dateToPixel(kind.origEnd) + dx);
      if (ne > kind.origStart) onPhaseDrag(kind.id, kind.origStart, ne);
      return;
    }
    if (kind.type === 'phase-move') {
      onPhaseDrag(kind.id,
        pixelToDate(Math.max(0, dateToPixel(kind.origStart) + dx)),
        pixelToDate(dateToPixel(kind.origEnd) + dx));
      return;
    }
    if (kind.type === 'activity-left') {
      const ns  = pixelToDate(Math.max(0, dateToPixel(kind.origStart) + dx));
      const dur = daysBetween(ns, kind.origEnd) + 1;
      if (dur >= 1) onActivityDrag(kind.id, ns, dur);
      return;
    }
    if (kind.type === 'activity-right') {
      const ne  = pixelToDate(dateToPixel(kind.origEnd) + dx);
      const dur = daysBetween(kind.origStart, ne) + 1;
      if (dur >= 1) onActivityDrag(kind.id, kind.origStart, dur);
      return;
    }
    if (kind.type === 'period-end') {
      // El tirador del borde derecho modifica el rango temporal, no el zoom.
      // En cada vista avanzamos por su unidad natural para que el gesto sea
      // predecible: días completos, meses completos o años completos.
      const deltaUnits = Math.round(dx / (BASE_UNIT[viewMode] * zoom));
      let nextEnd = new Date(kind.origEnd);

      if (deltaUnits !== 0) {
        if (viewMode === 'days') {
          nextEnd.setDate(nextEnd.getDate() + deltaUnits);
        } else if (viewMode === 'months') {
          nextEnd = new Date(
            kind.origEnd.getFullYear(),
            kind.origEnd.getMonth() + deltaUnits + 1,
            0,
          );
        } else {
          nextEnd = new Date(kind.origEnd.getFullYear() + deltaUnits, 11, 31);
        }
      }

      if (nextEnd < kind.minEnd) nextEnd = new Date(kind.minEnd);
      onPeriodEndChange(nextEnd);
    }
  }, [dateToPixel, pixelToDate, onPhaseDrag, onMilestoneDrag, onActivityDrag, onPeriodEndChange, viewMode, zoom]);

  const handleMouseUp = useCallback(() => { dragRef.current = null; }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup',   handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup',   handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const startDrag = (e: React.MouseEvent, kind: DragKind) => {
    e.preventDefault(); e.stopPropagation();
    dragRef.current = { kind, startX: e.clientX };
  };

  // ── Grid headers ──────────────────────────────────────────────────────────

  const dayHeaders: Date[] = (() => {
    const total = daysBetween(minDate, maxDate);
    return Array.from({ length: total + 1 }, (_, i) => {
      const d = new Date(minDate); d.setDate(d.getDate() + i); return d;
    });
  })();

  const monthHeaders = (() => {
    const out: { label: string }[] = [];
    const c   = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    const end = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
    while (c <= end) {
      out.push({ label: c.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }) });
      c.setMonth(c.getMonth() + 1);
    }
    return out;
  })();

  const yearHeaders = (() => {
    const out: number[] = [];
    for (let y = minDate.getFullYear(); y <= maxDate.getFullYear(); y++) out.push(y);
    return out;
  })();

  const gridCount = viewMode === 'days' ? dayHeaders.length : viewMode === 'months' ? monthHeaders.length : yearHeaders.length;
  const gridWidth = gridCount * unitW;
  const getDayOfWeek = (d: Date) => ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][d.getDay()];

  // ── Bar geometry ──────────────────────────────────────────────────────────

  const barLeft = (s: Date) => Math.max(0, dateToPixel(s));

  const barWidth = (s: Date, e: Date) => {
    const l = barLeft(s);
    let r: number;
    if (viewMode === 'days') {
      r = dateToPixel(e) + unitW;
    } else if (viewMode === 'months') {
      const dim = new Date(e.getFullYear(), e.getMonth() + 1, 0).getDate();
      const eI  = (e.getFullYear() - minDate.getFullYear()) * 12 + (e.getMonth() - minDate.getMonth());
      r = (eI + e.getDate() / dim) * unitW;
    } else {
      const ye = new Date(e.getFullYear() + 1, 0, 1), ys = new Date(e.getFullYear(), 0, 1);
      r = ((e.getFullYear() - minDate.getFullYear()) + (e.getTime() - ys.getTime()) / (ye.getTime() - ys.getTime())) * unitW;
    }
    return Math.max(r - l, 6);
  };

  const actEndDate = (a: Activity) => {
    const e = new Date(a.startDate); e.setDate(e.getDate() + a.duration - 1); return e;
  };
  const actBarLeft  = (a: Activity) => barLeft(a.startDate);
  const actBarWidth = (a: Activity) => barWidth(a.startDate, actEndDate(a));

  // Fecha mínima hasta la que se puede acortar el período con el tirador.
  // Así nunca dejamos fuera del rango un elemento que ya existe.
  const latestContentDate = (() => {
    let latest = new Date(periodStart);
    phases.forEach(p => { if (p.endDate > latest) latest = new Date(p.endDate); });
    milestones.forEach(m => { if (m.date > latest) latest = new Date(m.date); });
    activities.forEach(a => {
      const end = actEndDate(a);
      if (end > latest) latest = end;
    });
    return latest;
  })();

  // ── Color picker helpers ──────────────────────────────────────────────────

  const openPicker = (e: React.MouseEvent, id: string, kind: PickerTarget['kind']) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPicker(prev => prev?.id === id ? null : { id, kind, rect });
  };

  const pickerItem = () => {
    if (!picker) return null;
    if (picker.kind === 'activity') return activities.find(a => a.id === picker.id) ?? null;
    if (picker.kind === 'phase')    return phases.find(p => p.id === picker.id)     ?? null;
    return milestones.find(m => m.id === picker.id) ?? null;
  };

  const pickerBgColor   = () => pickerItem()?.color     ?? '#2563eb';
  const pickerTextColor = () => pickerItem()?.textColor  ?? '#ffffff';
  const pickerFontFamily = () => pickerItem()?.fontFamily ?? 'inherit';

  const handleSelectBg   = (color: string) => {
    if (!picker) return;
    if (picker.kind === 'activity') onActivityColorChange(picker.id, color);
    else if (picker.kind === 'phase') onPhaseColorChange(picker.id, color);
    else onMilestoneColorChange(picker.id, color);
  };
  const handleSelectText = (textColor: string) => {
    if (!picker) return;
    if (picker.kind === 'activity') onActivityTextColorChange(picker.id, textColor);
    else if (picker.kind === 'phase') onPhaseTextColorChange(picker.id, textColor);
    else onMilestoneTextColorChange(picker.id, textColor);
  };
  const handleSelectFont = (fontFamily: string) => {
    if (!picker) return;
    if (picker.kind === 'activity') onActivityFontFamilyChange(picker.id, fontFamily);
    else if (picker.kind === 'phase') onPhaseFontFamilyChange(picker.id, fontFamily);
    else onMilestoneFontFamilyChange(picker.id, fontFamily);
  };

  // ── Export ────────────────────────────────────────────────────────────────

  // html2canvas no entiende oklch()/oklab()/lch()/lab()/color-mix() (usados por
  // Tailwind v4 en TODO: texto, fondos, bordes, y también dentro de valores
  // compuestos como box-shadow/ring, que llevan varios "0 1px 2px oklch(...)").
  // El navegador SÍ los entiende al pintar, así que leemos el valor YA
  // RESUELTO (getComputedStyle) y reemplazamos SOLO la parte de color dentro
  // de cada función oklch(...)/etc. por su equivalente en rgb, dejando offsets,
  // blur, gradientes, etc. intactos.
  const COLOR_PROPS = [
    'color', 'backgroundColor', 'backgroundImage', 'borderColor',
    'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor',
    'outlineColor', 'textDecorationColor', 'caretColor', 'columnRuleColor',
    'boxShadow', 'textShadow', 'fill', 'stroke', 'stopColor', 'floodColor', 'lightingColor',
  ] as const;

  // Encuentra oklch(...)/oklab(...)/lch(...)/lab(...)/color(...)/color-mix(...)
  // dentro de cualquier string, tolerando un nivel de paréntesis anidados
  // (necesario para "color-mix(in oklch, ...)").
  const COLOR_FN_REGEX = /(?:color-mix|oklch|oklab|lch|lab|color)\([^()]*(?:\([^()]*\)[^()]*)*\)/g;

  // Convierte cualquier color CSS (incluido oklch(), lab(), color-mix(), etc.)
  // a su equivalente #rrggbb/rgba(...) apoyándose en el propio motor de color
  // del navegador: un contexto 2D de canvas siempre serializa fillStyle en
  // sRGB, sin importar en qué espacio de color se especificó originalmente.
  const oklchToRgbCache = new Map<string, string>();
  const toRgb = (value: string): string => {
    if (oklchToRgbCache.has(value)) return oklchToRgbCache.get(value)!;
    let result = value;
    try {
      const ctx = document.createElement('canvas').getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#000';
        ctx.fillStyle = value;
        result = ctx.fillStyle;
      }
    } catch {
      // si algo falla, dejamos el valor original
    }
    oklchToRgbCache.set(value, result);
    return result;
  };

  // IMPORTANTE: esto se ejecuta SOLO dentro del callback "onclone" de
  // html2canvas, es decir, sobre una copia desechable del DOM que la librería
  // genera para renderizar la captura. Nunca tocamos la página real, así que
  // no hace falta "restaurar" nada ni hay riesgo de romper la interfaz.
  const convertOklchInClone = (liveRoot: HTMLElement, clonedRoot: HTMLElement) => {
    const liveAll   = [liveRoot, ...Array.from(liveRoot.querySelectorAll<HTMLElement>('*'))];
    const clonedAll = [clonedRoot, ...Array.from(clonedRoot.querySelectorAll<HTMLElement>('*'))];
    liveAll.forEach((liveEl, i) => {
      const clonedEl = clonedAll[i];
      if (!clonedEl) return;
      const computed = getComputedStyle(liveEl);
      COLOR_PROPS.forEach(prop => {
        let value: string;
        try { value = (computed as any)[prop]; } catch { return; }
        if (typeof value !== 'string' || value.indexOf('(') === -1) return;
        const replaced = value.replace(COLOR_FN_REGEX, m => toRgb(m));
        if (replaced !== value) (clonedEl.style as any)[prop] = replaced;
      });
    });
  };

  // html2canvas no solo mira los estilos calculados (arriba): también lee el
  // TEXTO crudo de las hojas <style> del documento para resolver cosas como
  // box-shadow, anillos de foco, gradientes, etc. Tailwind v4 define esas
  // variables con oklch()/etc. literal en el CSS, así que aunque convirtamos
  // los elementos, el texto de la hoja de estilos sigue mencionando esas
  // funciones y html2canvas truena al parsearlo. Aquí reescribimos ese texto
  // SOLO en la copia desechable del documento (nunca en la hoja real).
  const rewriteOklchInClonedStylesheets = (clonedDoc: Document) => {
    clonedDoc.querySelectorAll('style').forEach(styleEl => {
      const css = styleEl.textContent;
      if (!css || css.indexOf('(') === -1) return;
      const replaced = css.replace(COLOR_FN_REGEX, match => toRgb(match));
      if (replaced !== css) styleEl.textContent = replaced;
    });
  };

  // Descarga compatible con Edge/Chrome/Firefox: convertimos a Blob y usamos una
  // URL de objeto en vez de un data URL gigante directo en el atributo href,
  // que algunos navegadores (Edge en particular) bloquean o ignoran.
  const downloadCanvasAsImage = (canvas: HTMLCanvasElement, filename: string, mime: 'image/png' | 'image/jpeg') => {
    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, mime, mime === 'image/jpeg' ? 0.92 : undefined);
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const waitForPaint = () => new Promise<void>(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

  const fmtExcelDate = (d: Date) => d.toISOString().split('T')[0];

  // exceljs pide los colores en formato ARGB ("FFrrggbb"), no en hex normal.
  const hexToArgb = (hex: string): string => {
    const clean = (hex || '#94a3b8').replace('#', '');
    const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
    return 'FF' + full.padEnd(6, '0').slice(0, 6).toUpperCase();
  };

  const MONTH_NAMES = ['ene','feb','mar','abr','may','jun','jul','ago','sept','oct','nov','dic'];

  const exportToExcel = async () => {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Generador de Cronogramas';
    wb.created = new Date();

    // ── Hoja 1: Cronograma — un Gantt real con los mismos colores que en pantalla ──
    const totalDays = Math.max(1, daysBetween(periodStart, periodEnd) + 1);
    const LABEL_COL = 1; // columna A = nombres
    const ws = wb.addWorksheet('Cronograma', { views: [{ state: 'frozen', xSplit: 1, ySplit: 2 }] });
    ws.getColumn(LABEL_COL).width = 30;
    for (let d = 0; d < totalDays; d++) ws.getColumn(LABEL_COL + 1 + d).width = 2.6;

    // Fila 1: nombre del mes (celdas fusionadas) · Fila 2: número de día
    const monthRow = ws.getRow(1);
    const dayRow = ws.getRow(2);
    monthRow.height = 18;
    dayRow.height = 15;

    let col = LABEL_COL + 1;
    let d = 0;
    while (d < totalDays) {
      const date = new Date(periodStart); date.setDate(date.getDate() + d);
      const month = date.getMonth(), year = date.getFullYear();
      let span = 0;
      while (d < totalDays) {
        const dt = new Date(periodStart); dt.setDate(dt.getDate() + d);
        if (dt.getMonth() !== month || dt.getFullYear() !== year) break;
        const dc = dayRow.getCell(col + span);
        dc.value = dt.getDate();
        dc.alignment = { horizontal: 'center' };
        dc.font = { size: 8, color: { argb: 'FF64748B' } };
        span++; d++;
      }
      if (span > 0) {
        ws.mergeCells(1, col, 1, col + span - 1);
        const mc = monthRow.getCell(col);
        mc.value = `${MONTH_NAMES[month]} ${year}`;
        mc.alignment = { horizontal: 'center' };
        mc.font = { bold: true, size: 9, color: { argb: 'FF334155' } };
        mc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      }
      col += span;
    }

    let rowIdx = 3;
    const addSectionHeader = (title: string) => {
      const row = ws.getRow(rowIdx);
      const cell = row.getCell(LABEL_COL);
      cell.value = title;
      cell.font = { bold: true, size: 10, color: { argb: 'FF334155' } };
      rowIdx++;
    };
    const addBarRow = (name: string, startOffset: number, span: number, color: string, textColor: string, fontFamily?: string) => {
      const row = ws.getRow(rowIdx);
      const labelCell = row.getCell(LABEL_COL);
      labelCell.value = name;
      labelCell.font = { size: 9 };
      labelCell.alignment = { vertical: 'middle', wrapText: false };

      const from = LABEL_COL + 1 + Math.max(0, startOffset);
      const to   = LABEL_COL + Math.min(totalDays, Math.max(1, startOffset + span));
      if (to >= from) {
        if (to > from) ws.mergeCells(rowIdx, from, rowIdx, to);
        const barCell = row.getCell(from);
        barCell.value = name;
        barCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(color) } };
        barCell.font = { size: 8, bold: true, color: { argb: hexToArgb(textColor) }, name: excelFontName(fontFamily) };
        barCell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
      row.height = 16;
      rowIdx++;
    };

    if (phases.length) {
      addSectionHeader('ETAPAS');
      phases.forEach(p => addBarRow(p.name, daysBetween(periodStart, p.startDate), daysBetween(p.startDate, p.endDate) + 1, p.color, p.textColor, p.fontFamily));
    }
    if (activities.length) {
      addSectionHeader('ACTIVIDADES');
      activities.forEach(a => addBarRow(a.name, daysBetween(periodStart, a.startDate), a.duration, a.color, a.textColor, a.fontFamily));
    }
    if (milestones.length) {
      addSectionHeader('HITOS');
      milestones.forEach(m => addBarRow('◆ ' + m.name, daysBetween(periodStart, m.date), 1, m.color, m.textColor, m.fontFamily));
    }

    // ── Hoja 2: Datos — la misma información en tabla simple, por si prefieren editarla ──
    const wsData = wb.addWorksheet('Datos');
    wsData.columns = [
      { header: 'Tipo', key: 'tipo', width: 14 },
      { header: 'Nombre', key: 'nombre', width: 30 },
      { header: 'Descripción', key: 'desc', width: 36 },
      { header: 'Fecha inicio', key: 'inicio', width: 14 },
      { header: 'Fecha fin', key: 'fin', width: 14 },
      { header: 'Duración (días)', key: 'dur', width: 16 },
    ];
    wsData.getRow(1).font = { bold: true };
    wsData.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    phases.forEach(p => wsData.addRow({
      tipo: 'Etapa', nombre: p.name, desc: '',
      inicio: fmtExcelDate(p.startDate), fin: fmtExcelDate(p.endDate),
      dur: daysBetween(p.startDate, p.endDate) + 1,
    }));
    activities.forEach(a => wsData.addRow({
      tipo: 'Actividad', nombre: a.name, desc: a.description,
      inicio: fmtExcelDate(a.startDate),
      fin: fmtExcelDate(new Date(a.startDate.getTime() + (a.duration - 1) * 86400000)),
      dur: a.duration,
    }));
    milestones.forEach(m => wsData.addRow({
      tipo: 'Hito', nombre: m.name, desc: m.description || '',
      inicio: fmtExcelDate(m.date), fin: fmtExcelDate(m.date), dur: 1,
    }));

    const buffer = await wb.xlsx.writeBuffer();
    downloadBlob(
      new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      'cronograma.xlsx'
    );
  };

  // ── Captura nativa vía Electron (método principal) ────────────────────────
  // Le pide al proceso principal que tome una captura real de los píxeles ya
  // renderizados por Chromium. Como es una captura de pantalla de verdad (no
  // una reconstrucción de la librería html2canvas), no le importa qué función
  // de color use el CSS por dentro: oklch, color-mix, lo que sea. Devuelve
  // null si no estamos dentro de Electron (ej. probando en un navegador
  // normal), para que el llamador use el respaldo con html2canvas.
  const captureNative = async (): Promise<HTMLCanvasElement | null> => {
    if (!window.electronAPI?.captureRect || !innerRef.current) return null;

    const source = innerRef.current;
    const captureWidth  = Math.max(1, Math.ceil(source.scrollWidth));
    const captureHeight = Math.max(1, Math.ceil(source.scrollHeight));
    const prevScrollX = window.scrollX;
    const prevScrollY = window.scrollY;
    let resized: { prevWidth: number; prevHeight: number } | null = null;

    // En lugar de fotografiar la interfaz que el usuario está viendo, creamos
    // una copia temporal del cronograma y la colocamos en (0,0), por encima de
    // cualquier modal o control. De esta forma capturePage solo puede ver el
    // cronograma dentro del rectángulo solicitado.
    const exportClone = source.cloneNode(true) as HTMLElement;
    exportClone.querySelectorAll('[data-export-ignore="true"]').forEach(el => el.remove());
    exportClone.setAttribute('aria-hidden', 'true');
    exportClone.setAttribute('data-native-export-clone', 'true');
    Object.assign(exportClone.style, {
      position: 'fixed',
      left: '0px',
      top: '0px',
      width: `${captureWidth}px`,
      minWidth: `${captureWidth}px`,
      height: `${captureHeight}px`,
      margin: '0',
      zIndex: '2147483647',
      background: '#ffffff',
      overflow: 'visible',
      transform: 'none',
      boxShadow: 'none',
    });

    try {
      // Hacemos coincidir coordenadas de documento y viewport para evitar que
      // el scroll vertical/horizontal desplace el recorte nativo.
      window.scrollTo(0, 0);
      document.body.appendChild(exportClone);
      await waitForPaint();

      // Asegura que Chromium tenga suficientes píxeles visibles para la copia.
      // Para cronogramas normales esto no cambia el tamaño de la ventana; solo
      // la amplía temporalmente cuando el contenido lo requiere.
      resized = await window.electronAPI.resizeWindowForCapture({
        width: Math.max(window.innerWidth, captureWidth + 4),
        height: Math.max(window.innerHeight, captureHeight + 4),
      });
      await new Promise(r => setTimeout(r, 140));
      await waitForPaint();

      const dataUrl = await window.electronAPI.captureRect({
        x: 0,
        y: 0,
        width: captureWidth,
        height: captureHeight,
      });
      if (!dataUrl) return null;

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('No se pudo procesar la captura del cronograma.'));
        img.src = dataUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No se pudo crear el lienzo de exportación.');
      ctx.drawImage(img, 0, 0);
      return canvas;
    } finally {
      exportClone.remove();
      if (resized) {
        try {
          await window.electronAPI.restoreWindowSize({ width: resized.prevWidth, height: resized.prevHeight });
        } catch {
          // Si Electron no puede restaurar por alguna razón, la exportación ya
          // se habrá completado; no bloqueamos al usuario por este detalle.
        }
      }
      window.scrollTo(prevScrollX, prevScrollY);
    }
  };

  const handleExport = async (cfg: ExportConfig) => {
    if (!innerRef.current) return;
    setExporting(true);
    setExportError('');

    // Desmontamos el modal antes de cualquier exportación. En PNG/JPG/PDF es
    // esencial porque la captura nativa fotografía píxeles reales; desmontarlo
    // (en vez de solo hacerlo transparente) evita que quede un frame antiguo
    // del modal en la imagen.
    setShowExport(false);
    await waitForPaint();
    await new Promise(r => setTimeout(r, 60));

    // El Excel es una tabla/gantt de datos: no necesita capturar pantalla.
    if (cfg.fileType === 'xlsx') {
      try {
        await exportToExcel();
      } catch (err: any) {
        console.error(err);
        setExportError(err?.message || 'Error desconocido al exportar.');
        setShowExport(true);
      } finally {
        setExporting(false);
      }
      return;
    }

    try {
      // 1) Dentro de Electron usamos la captura nativa sobre una copia temporal
      //    que contiene exclusivamente el cronograma.
      let canvas = await captureNative();

      // 2) Si estamos probando con "pnpm dev" en un navegador normal, usamos
      //    html2canvas como respaldo sobre el mismo nodo de cronograma.
      if (!canvas) {
        const html2canvas = (await import('html2canvas')).default;
        canvas = await html2canvas(innerRef.current, {
          useCORS: true, allowTaint: true, backgroundColor: '#ffffff', scale: 2,
          width:        innerRef.current.scrollWidth,
          height:       innerRef.current.scrollHeight,
          windowWidth:  innerRef.current.scrollWidth,
          windowHeight: innerRef.current.scrollHeight,
          onclone: (_clonedDoc, clonedEl) => {
            const wrapper = clonedEl.parentElement as HTMLElement | null;
            if (wrapper) {
              wrapper.style.overflow = 'visible';
              wrapper.style.overflowX = 'visible';
              wrapper.style.width = 'max-content';
            }
            clonedEl.querySelectorAll('[data-export-ignore="true"]').forEach(el => el.remove());
            convertOklchInClone(innerRef.current!, clonedEl as HTMLElement);
            rewriteOklchInClonedStylesheets(_clonedDoc);
          },
        });
      }

      if (cfg.fileType === 'png') {
        downloadCanvasAsImage(canvas, 'cronograma.png', 'image/png');
      } else if (cfg.fileType === 'jpg') {
        downloadCanvasAsImage(canvas, 'cronograma.jpg', 'image/jpeg');
      } else {
        const { jsPDF } = await import('jspdf');
        const pdf = new jsPDF({ orientation: cfg.orientation, unit: 'mm', format: cfg.paper.toLowerCase() });
        const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
        const ratio = canvas.height / canvas.width;
        let iw = pw, ih = pw * ratio;
        if (ih > ph) { ih = ph; iw = ph / ratio; }
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', (pw - iw) / 2, (ph - ih) / 2, iw, ih);
        pdf.save('cronograma.pdf');
      }
    } catch (err: any) {
      console.error(err);
      setExportError(err?.message || 'Error desconocido al exportar.');
      setShowExport(true);
    } finally {
      setExporting(false);
    }
  };

  // ── Grid background cells ─────────────────────────────────────────────────

  const GridCells = ({ height }: { height: number }) => (
    <>
      {viewMode === 'days' && dayHeaders.map((d, i) => (
        <div key={i} className={`absolute top-0 border-r border-slate-100 ${d.getDay() === 0 || d.getDay() === 6 ? 'bg-slate-50/60' : ''}`}
          style={{ left: i * unitW, width: unitW, height }} />
      ))}
      {viewMode === 'months' && monthHeaders.map((_, i) => (
        <div key={i} className="absolute top-0 border-r border-slate-100" style={{ left: i * unitW, width: unitW, height }} />
      ))}
      {viewMode === 'years' && yearHeaders.map((_, i) => (
        <div key={i} className="absolute top-0 border-r border-slate-100" style={{ left: i * unitW, width: unitW, height }} />
      ))}
    </>
  );

  const sortedMilestones = [...milestones].sort((a, b) => a.date.getTime() - b.date.getTime());
  const fmtInput = (d: Date) => d.toISOString().split('T')[0];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {showExport && (
        <ExportModal onClose={() => { setShowExport(false); setExportError(''); }} onExport={handleExport} exporting={exporting} error={exportError} />
      )}

      <Card className="overflow-hidden">
        {/* ── HEADER ── */}
        <CardHeader className="border-b bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2" style={{ color: fc }}>
              <Calendar className="w-5 h-5" />
              Visualización del Cronograma
            </CardTitle>

            <div className="flex flex-wrap items-center gap-2">
              {/* Global font color */}
              <FontColorPicker color={fontColor} fontFamily={globalFontFamily} onChange={setFontColor} onFontChange={setGlobalFontFamily} />

              {/* Zoom controls with editable input */}
              <div className="flex items-center rounded-md border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setZoom(z => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)))}
                  className="px-2 py-1.5 bg-white hover:bg-slate-50 text-slate-600 border-r border-slate-200 transition-colors"
                  title="Reducir zoom">
                  <ZoomOut className="w-4 h-4" />
                </button>
                <input
                  type="text"
                  value={zoomInput}
                  onChange={e => setZoomInput(e.target.value.replace(/[^0-9]/g, ''))}
                  onBlur={applyZoomInput}
                  onKeyDown={e => e.key === 'Enter' && applyZoomInput()}
                  className="bg-white border-0 outline-none text-sm text-center"
                  style={{ width: 52, color: fc }}
                  title="Escribe el porcentaje de zoom (25–300)"
                />
                <span className="text-sm pr-1" style={{ color: fc }}>%</span>
                <button
                  onClick={() => setZoom(z => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)))}
                  className="px-2 py-1.5 bg-white hover:bg-slate-50 text-slate-600 border-l border-slate-200 transition-colors"
                  title="Ampliar zoom">
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>

              {/* Export */}
              <Button onClick={() => setShowExport(true)} size="sm"
                className="h-8 gap-1.5 bg-slate-800 text-white hover:bg-slate-700 border-0 shadow-none text-sm">
                <Download className="w-4 h-4" />Exportar
              </Button>

              {/* View mode */}
              <div className="flex rounded-md border border-slate-200 overflow-hidden">
                {(['days','months','years'] as const).map(key => (
                  <button key={key} onClick={() => setViewMode(key)}
                    className={`px-3 py-1.5 text-sm transition-colors ${viewMode === key ? 'bg-blue-600 text-white' : 'bg-white hover:bg-slate-50'}`}
                    style={{ color: viewMode === key ? '#fff' : fc }}>
                    {key === 'days' ? 'Días' : key === 'months' ? 'Meses' : 'Años'}
                  </button>
                ))}
              </div>

              {/* Period */}
              <span className="text-sm" style={{ color: fc }}>Período:</span>
              <input type="date" value={fmtInput(periodStart)} onChange={e => onPeriodStartChange(new Date(e.target.value))}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ color: fc }} />
              <span className="text-slate-400">—</span>
              <input type="date" value={fmtInput(periodEnd)} onChange={e => onPeriodEndChange(new Date(e.target.value))}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ color: fc }} />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto" ref={scrollWrapperRef}>
            <div
              ref={innerRef}
              style={{
                width: LABEL_COL_W + gridWidth,
                minWidth: LABEL_COL_W + gridWidth,
                fontFamily: fontCss(globalFontFamily),
              }}
              className="relative inline-block overflow-hidden rounded-xl border border-slate-200 bg-white"
            >

              {/* Tirador del borde derecho: invisible en reposo y sutil al pasar el ratón.
                  La zona interactiva sigue siendo amplia para que resulte fácil de agarrar,
                  pero visualmente no compite con el contenido del cronograma. */}
              <div
                data-export-ignore="true"
                onMouseDown={e => startDrag(e, {
                  type: 'period-end',
                  origEnd: new Date(periodEnd),
                  minEnd: new Date(latestContentDate),
                })}
                className="group absolute right-0 top-0 bottom-0 z-40 w-5 cursor-col-resize select-none"
                style={{ touchAction: 'none' }}
                title="Arrastra el borde para ampliar o acortar el período"
              >
                {/* Indicador casi invisible: solo aparece cuando el usuario encuentra el borde. */}
                <div className="pointer-events-none absolute right-0 top-2 bottom-2 w-px bg-slate-400 opacity-0 transition-opacity duration-150 group-hover:opacity-50" />
                <div className="pointer-events-none absolute right-0 top-1/2 h-8 w-0.5 -translate-y-1/2 rounded-full bg-slate-500 opacity-0 transition-opacity duration-150 group-hover:opacity-60" />
              </div>

              {/* ── DATE SCALE ── */}
              <div className="flex border-b bg-slate-50 sticky top-0 z-20">
                <div className="flex-shrink-0 border-r bg-slate-50" style={{ width: LABEL_COL_W }} />
                <div className="flex" style={{ width: gridWidth, flexShrink: 0 }}>
                  {viewMode === 'days' && dayHeaders.map((d, i) => {
                    const isWe = d.getDay() === 0 || d.getDay() === 6;
                    return (
                      <div key={i} className={`flex-shrink-0 border-r border-slate-200 p-1.5 text-center ${isWe ? 'bg-slate-100' : ''}`} style={{ width: unitW }}>
                        <div className="text-xs font-medium" style={{ color: fc }}>{d.getDate()}</div>
                        <div className="text-xs" style={{ color: fc, opacity: 0.5 }}>{getDayOfWeek(d)}</div>
                      </div>
                    );
                  })}
                  {viewMode === 'months' && monthHeaders.map((m, i) => (
                    <div key={i} className="flex-shrink-0 border-r border-slate-200 p-1.5 text-center" style={{ width: unitW }}>
                      <div className="text-xs font-medium capitalize" style={{ color: fc }}>{m.label}</div>
                    </div>
                  ))}
                  {viewMode === 'years' && yearHeaders.map((y, i) => (
                    <div key={i} className="flex-shrink-0 border-r border-slate-200 p-1.5 text-center" style={{ width: unitW }}>
                      <div className="text-xs font-medium" style={{ color: fc }}>{y}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── MILESTONES ROW ── */}
              <div className="flex border-b border-slate-200 bg-white">
                <div className="flex-shrink-0 border-r border-slate-200 p-3 flex items-center justify-between bg-white" style={{ width: LABEL_COL_W }}>
                  <div className="flex items-center gap-1.5">
                    <Diamond className="w-3.5 h-3.5 text-rose-500" />
                    <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: fc }}>Hitos</span>
                  </div>
                  <Button onClick={onAddMilestone} size="sm"
                    className="h-7 gap-1 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 border-0 shadow-none text-xs">
                    <Plus className="w-3 h-3" />Nueva
                  </Button>
                </div>
                <div className="relative flex-shrink-0" style={{ width: gridWidth, height: MILESTONE_ROW_H }}>
                  <GridCells height={MILESTONE_ROW_H} />
                  {sortedMilestones.map((m, idx) => {
                    const cx       = dateToPixel(m.date) + unitW / 2;
                    const stagger  = idx % 2 === 0 ? 4 : 38;
                    const lineTop  = stagger + 26;
                    const diamondY = MILESTONE_ROW_H - 20;
                    const labelW   = getMsWidth(m.id, m.name);
                    return (
                      <div key={m.id}>
                        <div className="absolute" style={{ left: cx - 0.5, top: lineTop, width: 1, height: diamondY - lineTop, backgroundColor: m.color, opacity: 0.55 }} />
                        <div onMouseDown={e => startDrag(e, { type: 'milestone', id: m.id, origDate: m.date })}
                          className="absolute flex items-center justify-center cursor-grab active:cursor-grabbing group/ms"
                          style={{ left: cx - 8, top: diamondY, width: 16, height: 16 }} title={m.description}>
                          <div className="w-3 h-3 rotate-45 border-2 transition-transform group-hover/ms:scale-125"
                            style={{ backgroundColor: m.color, borderColor: m.color }} />
                        </div>
                        <div className="absolute group/msl" style={{ left: cx - labelW / 2, top: stagger, width: labelW }}>
                          <div
                            className="relative rounded px-1.5 py-0.5 text-center leading-tight shadow-sm select-none"
                            style={{ backgroundColor: m.color, fontSize: 10 }}
                          >
                            {/* Left resize handle */}
                            <div
                              onMouseDown={e => startDrag(e, { type: 'milestone-resize-left', id: m.id, origWidth: labelW })}
                              className="absolute left-0 top-0 bottom-0 cursor-col-resize z-10 hover:bg-black/10 rounded-l"
                              style={{ width: 6 }}
                            />
                            <div
                              className="font-semibold whitespace-nowrap overflow-hidden cursor-pointer px-1"
                              style={{ color: m.textColor, fontFamily: fontCss(m.fontFamily) }}
                              onClick={e => openPicker(e, m.id, 'milestone')}
                              title={m.name}
                            >
                              {m.name}
                            </div>
                            {/* Right resize handle */}
                            <div
                              onMouseDown={e => startDrag(e, { type: 'milestone-resize-right', id: m.id, origWidth: labelW })}
                              className="absolute right-0 top-0 bottom-0 cursor-col-resize z-10 hover:bg-black/10 rounded-r"
                              style={{ width: 6 }}
                            />
                          </div>
                          <div className="absolute -top-5 left-0 flex gap-0.5 opacity-0 group-hover/msl:opacity-100 transition-opacity z-10">
                            <button onClick={() => onEditMilestone(m)} className="w-4 h-4 rounded bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50">
                              <Edit className="w-2.5 h-2.5 text-slate-500" />
                            </button>
                            <button onClick={() => onDeleteMilestone(m.id)} className="w-4 h-4 rounded bg-white border border-slate-200 flex items-center justify-center hover:bg-red-50">
                              <Trash2 className="w-2.5 h-2.5 text-red-500" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── PHASES ROW ── */}
              <div className="flex border-b border-slate-300 bg-white">
                <div className="flex-shrink-0 border-r border-slate-200 p-3 flex items-center justify-between bg-white" style={{ width: LABEL_COL_W }}>
                  <div className="flex items-center gap-1.5">
                    <Flag className="w-3.5 h-3.5 text-violet-500" />
                    <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: fc }}>Etapas</span>
                  </div>
                  <Button onClick={onAddPhase} size="sm"
                    className="h-7 gap-1 bg-violet-50 text-violet-600 hover:bg-violet-100 hover:text-violet-700 border-0 shadow-none text-xs">
                    <Plus className="w-3 h-3" />Nueva
                  </Button>
                </div>
                <div className="relative flex-shrink-0" style={{ width: gridWidth, height: PHASE_ROW_H }}>
                  <GridCells height={PHASE_ROW_H} />
                  {phases.map(phase => {
                    const left  = barLeft(phase.startDate);
                    const width = barWidth(phase.startDate, phase.endDate);
                    return (
                      <div key={phase.id} className="absolute group/phase" style={{ left, top: 8, height: PHASE_ROW_H - 16, width }}>
                        <div onClick={e => openPicker(e, phase.id, 'phase')}
                          onMouseDown={e => startDrag(e, { type: 'phase-move', id: phase.id, origStart: phase.startDate, origEnd: phase.endDate })}
                          className="absolute inset-0 rounded flex items-center overflow-hidden cursor-grab active:cursor-grabbing"
                          style={{ backgroundColor: phase.color }}>
                          <div onMouseDown={e => startDrag(e, { type: 'phase-left', id: phase.id, origStart: phase.startDate, origEnd: phase.endDate })}
                            className="absolute left-0 top-0 bottom-0 cursor-col-resize z-10 hover:bg-black/10 rounded-l"
                            style={{ width: HANDLE_W }} onClick={e => e.stopPropagation()} />
                          <span className="flex-1 px-3 text-xs font-bold uppercase tracking-wide truncate select-none pointer-events-none"
                            style={{ color: phase.textColor, fontFamily: fontCss(phase.fontFamily) }}>
                            {phase.name}
                          </span>
                          <div onMouseDown={e => startDrag(e, { type: 'phase-right', id: phase.id, origStart: phase.startDate, origEnd: phase.endDate })}
                            className="absolute right-0 top-0 bottom-0 cursor-col-resize z-10 hover:bg-black/10 rounded-r"
                            style={{ width: HANDLE_W }} onClick={e => e.stopPropagation()} />
                        </div>
                        <div className="absolute -top-6 right-0 flex gap-0.5 opacity-0 group-hover/phase:opacity-100 transition-opacity z-20">
                          <button onClick={() => onEditPhase(phase)} className="w-5 h-5 rounded bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 shadow-sm">
                            <Edit className="w-3 h-3 text-slate-500" />
                          </button>
                          <button onClick={() => onDeletePhase(phase.id)} className="w-5 h-5 rounded bg-white border border-slate-200 flex items-center justify-center hover:bg-red-50 shadow-sm">
                            <Trash2 className="w-3 h-3 text-red-500" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── ACTIVITY ROWS ── */}
              {activities.length === 0 ? (
                <div className="flex border-b border-slate-100">
                  <div className="flex-shrink-0 border-r border-slate-200 p-4 flex items-center justify-between" style={{ width: LABEL_COL_W }}>
                    <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: fc, opacity: 0.5 }}>Actividades</span>
                    <Button onClick={onAddActivity} size="sm"
                      className="h-7 gap-1 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 border-0 shadow-none text-xs">
                      <Plus className="w-3 h-3" />Nueva
                    </Button>
                  </div>
                  <div className="flex-1 py-8 text-center text-sm" style={{ color: fc, opacity: 0.4 }}>
                    No hay actividades. Haz clic en "Nueva" para comenzar.
                  </div>
                </div>
              ) : (
                activities.map((activity, aIdx) => (
                  <div key={activity.id} className="flex border-b border-slate-100 hover:bg-slate-50/40 group">
                    <div className="flex-shrink-0 border-r border-slate-200 p-4" style={{ width: LABEL_COL_W }}>
                      {aIdx === 0 && (
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: fc, opacity: 0.5 }}>Actividades</span>
                          <Button onClick={onAddActivity} size="sm"
                            className="h-6 gap-0.5 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 border-0 shadow-none text-xs">
                            <Plus className="w-3 h-3" />Nueva
                          </Button>
                        </div>
                      )}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate" style={{ color: fc }}>{activity.name}</div>
                          <div className="text-xs truncate" style={{ color: fc, opacity: 0.6 }}>{activity.description}</div>
                          <div className="text-xs mt-0.5" style={{ color: fc, opacity: 0.4 }}>
                            {activity.duration} {activity.duration === 1 ? 'día' : 'días'}
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="sm" onClick={() => onEditActivity(activity)} className="h-6 w-6 p-0">
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => onDeleteActivity(activity.id)}
                            className="h-6 w-6 p-0 text-red-600 hover:text-red-700">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Gantt row with resizable bar */}
                    <div className="relative flex-shrink-0" style={{ width: gridWidth, height: ACTIVITY_ROW_H }}>
                      <GridCells height={ACTIVITY_ROW_H} />
                      <div
                        className="absolute top-1/2 -translate-y-1/2 h-9 rounded flex items-center overflow-hidden group/bar"
                        style={{
                          left: actBarLeft(activity),
                          width: actBarWidth(activity),
                          minWidth: 6,
                          backgroundColor: activity.color,
                        }}
                      >
                        {/* Left resize handle */}
                        <div
                          onMouseDown={e => startDrag(e, { type: 'activity-left', id: activity.id, origStart: activity.startDate, origEnd: actEndDate(activity) })}
                          className="absolute left-0 top-0 bottom-0 cursor-col-resize z-10 hover:bg-black/20"
                          style={{ width: HANDLE_W }}
                        />
                        {/* Bar label + palette icon */}
                        <span
                          onClick={e => openPicker(e, activity.id, 'activity')}
                          className="flex-1 flex items-center px-3 cursor-pointer select-none"
                        >
                          <span className="truncate text-sm" style={{ color: activity.textColor, fontFamily: fontCss(activity.fontFamily) }}>{activity.name}</span>
                          <Palette className="w-3 h-3 ml-1 opacity-0 group-hover/bar:opacity-70 transition-opacity shrink-0" style={{ color: activity.textColor }} />
                        </span>
                        {/* Right resize handle */}
                        <div
                          onMouseDown={e => startDrag(e, { type: 'activity-right', id: activity.id, origStart: activity.startDate, origEnd: actEndDate(activity) })}
                          className="absolute right-0 top-0 bottom-0 cursor-col-resize z-10 hover:bg-black/20"
                          style={{ width: HANDLE_W }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}

            </div>
          </div>
        </CardContent>

        {picker && (
          <DualColorPicker
            bgColor={pickerBgColor()}
            textColor={pickerTextColor()}
            fontFamily={pickerFontFamily()}
            anchorRect={picker.rect}
            onSelectBg={handleSelectBg}
            onSelectText={handleSelectText}
            onSelectFont={handleSelectFont}
            onClose={() => setPicker(null)}
          />
        )}
      </Card>
    </>
  );
}
