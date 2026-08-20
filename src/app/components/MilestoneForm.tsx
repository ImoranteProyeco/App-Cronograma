import { useState, useEffect } from 'react';
import { Milestone } from '../App';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';

const COLOR_SWATCHES = [
  '#dc2626', '#ea580c', '#d97706', '#7c3aed',
  '#2563eb', '#0d9488', '#65a30d', '#db2777',
  '#0891b2', '#4f46e5', '#059669', '#475569',
];

interface MilestoneFormProps {
  onSubmit: (milestone: Milestone | Omit<Milestone, 'id'>) => void;
  onCancel: () => void;
  initialMilestone?: Milestone | null;
}

export function MilestoneForm({ onSubmit, onCancel, initialMilestone }: MilestoneFormProps) {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#dc2626');

  useEffect(() => {
    if (initialMilestone) {
      setName(initialMilestone.name);
      setDate(initialMilestone.date.toISOString().split('T')[0]);
      setDescription(initialMilestone.description || '');
      setColor(initialMilestone.color);
    }
  }, [initialMilestone]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const milestone = {
      ...(initialMilestone && { id: initialMilestone.id }),
      name,
      date: new Date(date),
      color,
      textColor: initialMilestone?.textColor ?? '#ffffff',
      fontFamily: initialMilestone?.fontFamily ?? 'inherit',
      ...(description && { description }),
    };
    onSubmit(milestone as any);
    setName(''); setDate(''); setDescription(''); setColor('#dc2626');
  };

  return (
    <Card className="mb-6 border-2 border-red-200 shadow-lg">
      <CardHeader>
        <CardTitle>{initialMilestone ? 'Editar Hito' : 'Nuevo Hito'}</CardTitle>
        <CardDescription>Define un evento puntual en el cronograma</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="milestone-name">Nombre del Hito</Label>
              <Input
                id="milestone-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ej: Firma de contrato"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="milestone-date">Fecha</Label>
              <Input id="milestone-date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="milestone-desc">Descripción (opcional)</Label>
            <Textarea
              id="milestone-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Descripción del hito..."
              rows={2}
            />
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
              {initialMilestone ? 'Actualizar' : 'Agregar Hito'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
