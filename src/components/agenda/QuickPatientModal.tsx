
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { User, Loader2 } from 'lucide-react';
import { useQuickPatientForm } from '@/hooks/useQuickPatientForm';
import QuickPatientFormFields from './QuickPatientFormFields';

interface QuickPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPatientCreated: (patientId: string) => void;
}

const QuickPatientModal = ({ isOpen, onClose, onPatientCreated }: QuickPatientModalProps) => {
  const { form, onSubmit, isLoading } = useQuickPatientForm(onPatientCreated, onClose);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-[95vw] mx-4 max-h-[95vh] overflow-y-auto">
        <DialogHeader className="pb-6">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 bg-blue-50 rounded-lg">
              <User className="h-6 w-6 text-blue-600" />
            </div>
            Novo Paciente
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <QuickPatientFormFields form={form} />

            <div className="flex flex-col-reverse sm:flex-row gap-4 pt-8 border-t bg-muted -mx-6 px-6 py-6 mt-8">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose} 
                disabled={isLoading}
                className="w-full sm:w-auto sm:min-w-[120px]"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={isLoading} 
                className="w-full sm:w-auto sm:min-w-[140px] bg-blue-600 hover:bg-blue-700"
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLoading ? 'Salvando...' : 'Criar Paciente'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default QuickPatientModal;
