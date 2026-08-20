/** Exportação completa dos dados da conta em um único arquivo JSON */

export const downloadBackupJSON = (dados: Record<string, unknown>, prefixo = 'backup-dental') => {
  const payload = {
    geradoEm: new Date().toISOString(),
    versao: 1,
    ...dados,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${prefixo}-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
