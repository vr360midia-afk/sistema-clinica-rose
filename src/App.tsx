
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DentalSystemProvider } from "@/context/DentalSystemContext";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import Notas from "./pages/Notas";
import Pacientes from "./pages/Pacientes";
import Agenda from "./pages/Agenda";
import Anamnese from "./pages/Anamnese";
import Prontuarios from "./pages/Prontuarios";
import Procedimentos from "./pages/Procedimentos";
import Financeiro from "./pages/Financeiro";
import Comunicacao from "./pages/Comunicacao";
import Estoque from "./pages/Estoque";
import Relatorios from "./pages/Relatorios";
import Configuracoes from "./pages/Configuracoes";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <DentalSystemProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route path="/notas" element={
                <ProtectedRoute>
                  <Notas />
                </ProtectedRoute>
              } />
              <Route path="/pacientes" element={
                <ProtectedRoute>
                  <Pacientes />
                </ProtectedRoute>
              } />
              <Route path="/agenda" element={
                <ProtectedRoute>
                  <Agenda />
                </ProtectedRoute>
              } />
              <Route path="/anamnese" element={
                <ProtectedRoute>
                  <Anamnese />
                </ProtectedRoute>
              } />
              <Route path="/prontuarios" element={
                <ProtectedRoute>
                  <Prontuarios />
                </ProtectedRoute>
              } />
              <Route path="/procedimentos" element={
                <ProtectedRoute>
                  <Procedimentos />
                </ProtectedRoute>
              } />
              <Route path="/financeiro" element={
                <ProtectedRoute>
                  <Financeiro />
                </ProtectedRoute>
              } />
              <Route path="/comunicacao" element={
                <ProtectedRoute>
                  <Comunicacao />
                </ProtectedRoute>
              } />
              <Route path="/estoque" element={
                <ProtectedRoute>
                  <Estoque />
                </ProtectedRoute>
              } />
              <Route path="/relatorios" element={
                <ProtectedRoute>
                  <Relatorios />
                </ProtectedRoute>
              } />
              <Route path="/configuracoes" element={
                <ProtectedRoute>
                  <Configuracoes />
                </ProtectedRoute>
              } />
              <Route path="/admin" element={
                <ProtectedRoute>
                  <Admin />
                </ProtectedRoute>
              } />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </DentalSystemProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
