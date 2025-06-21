
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { DentalSystemProvider } from '@/context/DentalSystemContext';
import Index from '@/pages/Index';
import Dashboard from '@/pages/Dashboard';
import Pacientes from '@/pages/Pacientes';
import Agenda from '@/pages/Agenda';
import Financeiro from '@/pages/Financeiro';
import Prontuarios from '@/pages/Prontuarios';
import Relatorios from '@/pages/Relatorios';
import Configuracoes from '@/pages/Configuracoes';
import Estoque from '@/pages/Estoque';
import Procedimentos from '@/pages/Procedimentos';
import Comunicacao from '@/pages/Comunicacao';
import Notas from '@/pages/Notas';
import Anamnese from '@/pages/Anamnese';
import Admin from '@/pages/Admin';
import AssinarAnamnese from '@/pages/AssinarAnamnese';
import NotFound from '@/pages/NotFound';
import './App.css';

function App() {
  return (
    <DentalSystemProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/pacientes" element={<Pacientes />} />
            <Route path="/agenda" element={<Agenda />} />
            <Route path="/financeiro" element={<Financeiro />} />
            <Route path="/prontuarios" element={<Prontuarios />} />
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
            <Route path="/estoque" element={<Estoque />} />
            <Route path="/procedimentos" element={<Procedimentos />} />
            <Route path="/comunicacao" element={<Comunicacao />} />
            <Route path="/notas" element={<Notas />} />
            <Route path="/anamnese" element={<Anamnese />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/assinar-anamnese/:id" element={<AssinarAnamnese />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Toaster />
        </div>
      </Router>
    </DentalSystemProvider>
  );
}

export default App;
