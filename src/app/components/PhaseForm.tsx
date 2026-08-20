import { useState, useEffect } from 'react';
import { Phase } from '../App';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

const COLOR_SWATCHES = [
  '#0d9488', '#7c3aed', '#2563eb', '#dc2626',
  '#ea580c', '#d97706', '#65a30d', '#0891b2',
  '#db2777', '#4f46e5', '#059669', '#475569',
];

interface PhaseFormProps {
  onSubmit: (phase: Phase | Omit<Phase, 'id'>) => void;
  onCancel: () => void;
  initialPhase?: Phase | null;
}

export function PhaseForm({ onSubmit, onCancel, initialPhase }: PhaseFormProps) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [color, setColor] = useState('#0d9488');

  useEffect(() => {
    if (initialPhase) {
      setName(initialPhase.name);
      setStartDate(initialPhase.startDate.toISOString().split('T')[0]);
      setEndDate(initialPhase.endDate.toISOString().split('T')[0]);
      setColor(initialPhase.color);
    }
  }, [initialPhase]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const phase = {
      ...(initialPhase && { id: initialPhase.id }),
      name,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      color,
      textColor: initialPhase?.textColor ?? '#ffffff',
      fontFamily: initialPhase?.fontFamily ?? 'inherit',
    };
    onSubmit(phase as any);
    setName(''); setStartDate(''); setEndDate(''); setColor('#0d9488');
  };

  return (
    <Card className="mb-6 border-2 border-teal-200 shadow-lg">
      <CardHeader>
        <CardTitle>{initialPhase ? 'Editar Etapa' : 'Nueva Etapa'}</CardTitle>
        <CardDescription>Define una fase o etapa del proyecto</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phase-name">Nombre de la Etapa</Label>
            <Input
              id="phase-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Anteproyecto"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phase-start">Fecha de Inicio</Label>
              <Input id="phase-start" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phase-end">Fecha de Fin</Label>
              <Input id="phase-end" type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2 items-center">
              {COLOR_SWATCHES.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110"
                  style={{ backgroundColor: c, borderColor: c === color ? '#1e293b' : 'transparent' }}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border border-slate-200"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
            <Button type="submit" style={{ backgroundColor: color }}>
              {initialPhase ? 'Actualizar' : 'Agregar Etapa'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
