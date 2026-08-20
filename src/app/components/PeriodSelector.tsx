import { Card, CardContent } from './ui/card';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Calendar } from 'lucide-react';

interface PeriodSelectorProps {
  startDate: Date;
  endDate: Date;
  onStartDateChange: (date: Date) => void;
  onEndDateChange: (date: Date) => void;
}

export function PeriodSelector({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange
}: PeriodSelectorProps) {
  const formatDateForInput = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onStartDateChange(new Date(e.target.value));
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onEndDateChange(new Date(e.target.value));
  };

  return (
    <Card className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
      <CardContent className="pt-6">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-slate-700">
            <Calendar className="w-5 h-5 text-blue-600" />
            <span>Período del Cronograma:</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="space-y-1">
              <Label htmlFor="start-date" className="text-slate-600">Fecha de Inicio</Label>
              <Input
                id="start-date"
                type="date"
                value={formatDateForInput(startDate)}
                onChange={handleStartDateChange}
                className="bg-white"
              />
            </div>

            <div className="flex items-center pt-6 text-slate-400">
              hasta
            </div>

            <div className="space-y-1">
              <Label htmlFor="end-date" className="text-slate-600">Fecha de Fin</Label>
              <Input
                id="end-date"
                type="date"
                value={formatDateForInput(endDate)}
                onChange={handleEndDateChange}
                className="bg-white"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
