
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { DentalSystemProvider } from '@/context/DentalSystemContext';
import { AuthProvider } from '@/context/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import RoleRoute from '@/components/auth/RoleRoute';
import Index from '@/pages/Index';
import Auth from '@/pages/Auth';
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
import AssinarExtrato from '@/pages/AssinarExtrato';
import NotFound from '@/pages/NotFound';

function App() {
  return (
    <AuthProvider>
      <DentalSystemProvider>
        <Router>
          <div className="App">
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/assinar-anamnese/:id" element={<AssinarAnamnese />} />
              <Route path="/assinar-extrato/:id" element={<AssinarExtrato />} />
              <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/pacientes" element={<ProtectedRoute><Pacientes /></ProtectedRoute>} />
              <Route path="/agenda" element={<ProtectedRoute><Agenda /></ProtectedRoute>} />
              <Route path="/financeiro" element={<ProtectedRoute><RoleRoute allow={['admin']}><Financeiro /></RoleRoute></ProtectedRoute>} />
              <Route path="/prontuarios" element={<ProtectedRoute><Prontuarios /></ProtectedRoute>} />
              <Route path="/relatorios" element={<ProtectedRoute><RoleRoute allow={['admin']}><Relatorios /></RoleRoute></ProtectedRoute>} />
              <Route path="/configuracoes" element={<ProtectedRoute><RoleRoute allow={['admin']}><Configuracoes /></RoleRoute></ProtectedRoute>} />
              <Route path="/estoque" element={<ProtectedRoute><Estoque /></ProtectedRoute>} />
              <Route path="/procedimentos" element={<ProtectedRoute><Procedimentos /></ProtectedRoute>} />
              <Route path="/comunicacao" element={<ProtectedRoute><Comunicacao /></ProtectedRoute>} />
              <Route path="/notas" element={<ProtectedRoute><Notas /></ProtectedRoute>} />
              <Route path="/anamnese" element={<ProtectedRoute><Anamnese /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><RoleRoute allow={['admin']}><Admin /></RoleRoute></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <Toaster />
          </div>
        </Router>
      </DentalSystemProvider>
    </AuthProvider>
  );
}

export default App;
