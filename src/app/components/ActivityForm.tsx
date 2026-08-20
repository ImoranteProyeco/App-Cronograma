import { useState, useEffect } from 'react';
import { Activity } from '../App';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';

interface ActivityFormProps {
  onSubmit: (activity: Activity | Omit<Activity, 'id'>) => void;
  onCancel: () => void;
  initialActivity?: Activity | null;
}

export function ActivityForm({ onSubmit, onCancel, initialActivity }: ActivityFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [duration, setDuration] = useState('');

  useEffect(() => {
    if (initialActivity) {
      setName(initialActivity.name);
      setDescription(initialActivity.description);
      const start = initialActivity.startDate.toISOString().split('T')[0];
      setStartDate(start);
      setDuration(initialActivity.duration.toString());
      
      // Calcular data fim baseado na data início e duração
      const end = new Date(initialActivity.startDate);
      end.setDate(end.getDate() + initialActivity.duration - 1);
      setEndDate(end.toISOString().split('T')[0]);
    }
  }, [initialActivity]);

  // Atualizar duração quando as datas mudarem
  useEffect(() => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      
      if (diffDays > 0) {
        setDuration(diffDays.toString());
      }
    }
  }, [startDate, endDate]);

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStartDate(e.target.value);
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEndDate(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const activity = {
      ...(initialActivity && { id: initialActivity.id }),
      name,
      description,
      startDate: new Date(startDate),
      duration: parseInt(duration),
      color: initialActivity?.color ?? '#2563eb',
      textColor: initialActivity?.textColor ?? '#ffffff',
      fontFamily: initialActivity?.fontFamily ?? 'inherit',
    };

    onSubmit(activity as any);
    
    // Limpar formulário
    setName('');
    setDescription('');
    setStartDate('');
    setEndDate('');
    setDuration('');
  };

  return (
    <Card className="mb-8 border-2 border-blue-200 shadow-lg">
      <CardHeader>
        <CardTitle>{initialActivity ? 'Editar Actividad' : 'Nueva Actividad'}</CardTitle>
        <CardDescription>Completa los detalles de la actividad</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre de la Actividad</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Planificación"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Fecha de Inicio</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={handleStartDateChange}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="endDate">Fecha de Fin</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={handleEndDateChange}
                min={startDate}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duración (días corridos)</Label>
              <Input
                id="duration"
                type="number"
                min="1"
                value={duration}
                readOnly
                className="bg-slate-50"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe la actividad..."
              rows={3}
              required
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit">
              {initialActivity ? 'Actualizar' : 'Agregar'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}