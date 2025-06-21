
export const clearAllSystemData = () => {
  // Limpar dados do localStorage
  const keysToRemove = [
    'dental_pacientes',
    'dental_consultas', 
    'dental_transacoes',
    'dental_prontuarios',
    'dental_anamneses',
    'dental_documentos'
  ];

  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
  });

  console.log('Todos os dados do sistema foram limpos');
  
  // Recarregar a página para atualizar o estado
  window.location.reload();
};

// Executar limpeza imediatamente
clearAllSystemData();
