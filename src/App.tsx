
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { DentalSystemProvider } from '@/context/DentalSystemContext';
import { AuthProvider } from '@/context/AuthContext';
import { SecurityProvider } from '@/context/SecurityContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import RoleRoute from '@/components/auth/RoleRoute';
import PermissionRoute from '@/components/auth/PermissionRoute';
import Index from '@/pages/Index';
import Auth from '@/pages/Auth';
import AgendamentoPublico from '@/pages/AgendamentoPublico';
import Dashboard from '@/pages/Dashboard';
import Pacientes from '@/pages/Pacientes';
import CRM from '@/pages/CRM';
import Agenda from '@/pages/Agenda';
import Financeiro from '@/pages/Financeiro';
import FaturamentoParceiros from '@/pages/FaturamentoParceiros';
import Prontuarios from '@/pages/Prontuarios';
import Relatorios from '@/pages/Relatorios';
import Configuracoes from '@/pages/Configuracoes';
import Estoque from '@/pages/Estoque';
import Procedimentos from '@/pages/Procedimentos';
import Comunicacao from '@/pages/Comunicacao';
import Notas from '@/pages/Notas';
import Anamnese from '@/pages/Anamnese';
import Admin from '@/pages/Admin';
import Lixeira from '@/pages/Lixeira';
import AssinarAnamnese from '@/pages/AssinarAnamnese';
import AssinarExtrato from '@/pages/AssinarExtrato';
import NotFound from '@/pages/NotFound';

function App() {
  return (
    <AuthProvider>
      <SecurityProvider>
      <DentalSystemProvider>
        <Router>
          <div className="App">
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/agendar" element={<AgendamentoPublico />} />
              <Route path="/assinar-anamnese/:id" element={<AssinarAnamnese />} />
              <Route path="/assinar-extrato/:id" element={<AssinarExtrato />} />
              <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/crm" element={<ProtectedRoute><CRM /></ProtectedRoute>} />
              <Route path="/pacientes" element={<ProtectedRoute><PermissionRoute modulo="pacientes"><Pacientes /></PermissionRoute></ProtectedRoute>} />
              <Route path="/agenda" element={<ProtectedRoute><PermissionRoute modulo="agenda"><Agenda /></PermissionRoute></ProtectedRoute>} />
              <Route path="/financeiro" element={<ProtectedRoute><PermissionRoute modulo="financeiro"><Financeiro /></PermissionRoute></ProtectedRoute>} />
              <Route path="/faturamento-parceiros" element={<ProtectedRoute><RoleRoute allow={['admin']}><FaturamentoParceiros /></RoleRoute></ProtectedRoute>} />
              <Route path="/prontuarios" element={<ProtectedRoute><PermissionRoute modulo="prontuarios"><Prontuarios /></PermissionRoute></ProtectedRoute>} />
              <Route path="/relatorios" element={<ProtectedRoute><RoleRoute allow={['admin']}><Relatorios /></RoleRoute></ProtectedRoute>} />
              <Route path="/configuracoes" element={<ProtectedRoute><PermissionRoute modulo="configuracoes"><Configuracoes /></PermissionRoute></ProtectedRoute>} />
              <Route path="/estoque" element={<ProtectedRoute><PermissionRoute modulo="estoque"><Estoque /></PermissionRoute></ProtectedRoute>} />
              <Route path="/procedimentos" element={<ProtectedRoute><Procedimentos /></ProtectedRoute>} />
              <Route path="/comunicacao" element={<ProtectedRoute><Comunicacao /></ProtectedRoute>} />
              <Route path="/notas" element={<ProtectedRoute><Notas /></ProtectedRoute>} />
              <Route path="/anamnese" element={<ProtectedRoute><PermissionRoute modulo="prontuarios"><Anamnese /></PermissionRoute></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><RoleRoute allow={['admin']}><Admin /></RoleRoute></ProtectedRoute>} />
              <Route path="/lixeira" element={<ProtectedRoute><RoleRoute allow={['admin']}><Lixeira /></RoleRoute></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <Toaster />
          </div>
        </Router>
      </DentalSystemProvider>
      </SecurityProvider>
    </AuthProvider>
  );
}

export default App;
