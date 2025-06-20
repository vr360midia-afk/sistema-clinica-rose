
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { User, Phone, Calendar, Heart, AlertTriangle } from 'lucide-react';

interface PatientSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: {
    patient: string;
    time: string;
    procedure: string;
    status: string;
    patientData?: {
      phone: string;
      age: number;
      insurance: string;
      lastVisit: string;
      allergies: string;
    };
  } | null;
}

const PatientSummaryModal = ({ isOpen, onClose, appointment }: PatientSummaryModalProps) => {
  if (!appointment) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {appointment.patient}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-600">Horário</label>
              <p className="text-lg font-semibold">{appointment.time}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Status</label>
              <Badge className="mt-1">{appointment.status}</Badge>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-600">Procedimento</label>
            <p className="font-medium">{appointment.procedure}</p>
          </div>

          {appointment.patientData && (
            <>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-500" />
                <span>{appointment.patientData.phone}</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Idade</label>
                  <p>{appointment.patientData.age} anos</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Convênio</label>
                  <p>{appointment.patientData.insurance}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span>Última consulta: {appointment.patientData.lastVisit}</span>
              </div>

              {appointment.patientData.allergies && (
                <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-700">Alergias</p>
                    <p className="text-sm text-red-600">{appointment.patientData.allergies}</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PatientSummaryModal;
