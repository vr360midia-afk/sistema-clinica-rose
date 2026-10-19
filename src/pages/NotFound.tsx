import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import AssinarAnamnese from "./AssinarAnamnese";
import AssinarContrato from "./AssinarContrato";
import AssinarExtrato from "./AssinarExtrato";

const NotFound = () => {
  const location = useLocation();
  const path = (location.pathname || '').toLowerCase();

  // Se for um link de anamnese enviado ao paciente
  if (
    path.includes('preencher-anamnese') ||
    path.includes('assinar-anamnese') ||
    path.startsWith('/anamnese-') ||
    path.startsWith('/anamnese')
  ) {
    return <AssinarAnamnese />;
  }

  // Se for um link de contrato
  if (path.includes('assinar-contrato') || path.includes('contrato-')) {
    return <AssinarContrato />;
  }

  // Se for um link de extrato
  if (path.includes('assinar-extrato') || path.includes('extrato-')) {
    return <AssinarExtrato />;
  }

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted p-4">
      <div className="text-center space-y-3">
        <h1 className="text-5xl font-extrabold text-foreground tracking-tight">404</h1>
        <p className="text-lg text-muted-foreground">Página não encontrada / Page not found</p>
        <div>
          <a
            href="/"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            Voltar para o Início
          </a>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
