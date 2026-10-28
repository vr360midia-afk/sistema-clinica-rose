import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  FileText,
  ArrowRight,
} from 'lucide-react';
import { NovoLead } from '@/types/novosLeads';
import { normalizarTelefone, formatarTelefoneExibicao, novosLeadsService } from '@/services/novosLeadsService';
import { toast } from 'sonner';

interface ModalImportarCsvProps {
  isOpen: boolean;
  onClose: () => void;
  onImportacaoConcluida: () => void;
}

interface ItemPrevia {
  idTemp: string;
  selecionado: boolean;
  nome: string;
  telefone: string;
  email: string;
  campanha: string;
  origem: string;
  observacoes: string;
  invalido: boolean;
  motivoInvalido?: string;
}

export default function ModalImportarCsv({
  isOpen,
  onClose,
  onImportacaoConcluida,
}: ModalImportarCsvProps) {
  const [etapa, setEtapa] = useState<'upload' | 'previa'>('upload');
  const [itensPrevia, setItensPrevia] = useState<ItemPrevia[]>([]);
  const [importando, setImportando] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetar = () => {
    setEtapa('upload');
    setItensPrevia([]);
    setImportando(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processarArquivoCsv(file);
  };

  const parseCsvLines = (text: string): string[][] => {
    const lines: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          currentCell += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if ((char === ',' || char === ';') && !insideQuotes) {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if ((char === '\r' || char === '\n') && !insideQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        currentRow.push(currentCell.trim());
        if (currentRow.some((c) => c.length > 0)) {
          lines.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }

    if (currentCell.length > 0 || currentRow.length > 0) {
      currentRow.push(currentCell.trim());
      if (currentRow.some((c) => c.length > 0)) {
        lines.push(currentRow);
      }
    }

    return lines;
  };

  const processarArquivoCsv = async (file: File) => {
    try {
      const text = await file.text();
      const rows = parseCsvLines(text);

      if (rows.length < 2) {
        toast.error('O arquivo CSV parece estar vazio ou não contém cabeçalho e dados.');
        return;
      }

      // Mapeia índices do cabeçalho
      const headers = rows[0].map((h) => h.toLowerCase().trim());

      const getColIndex = (keywords: string[]) => {
        return headers.findIndex((h) => keywords.some((k) => h.includes(k)));
      };

      const idxNome = getColIndex(['nome', 'name', 'lead', 'full_name', 'paciente']);
      const idxTelefone = getColIndex(['tel', 'phone', 'cel', 'whatsapp', 'celular', 'fone']);
      const idxEmail = getColIndex(['email', 'e-mail']);
      const idxCampanha = getColIndex(['campanha', 'campaign', 'anúncio', 'anuncio', 'ad_name', 'form']);
      const idxOrigem = getColIndex(['origem', 'source', 'platform', 'plataforma']);
      const idxObs = getColIndex(['obs', 'mensagem', 'message', 'resposta', 'questions', 'comments']);

      const parsed: ItemPrevia[] = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const nomeRaw = idxNome !== -1 ? row[idxNome] || '' : row[0] || '';
        const telRaw = idxTelefone !== -1 ? row[idxTelefone] || '' : row[1] || '';
        const emailRaw = idxEmail !== -1 ? row[idxEmail] || '' : '';
        const campRaw = idxCampanha !== -1 ? row[idxCampanha] || '' : 'Importação CSV';
        const origRaw = idxOrigem !== -1 ? row[idxOrigem] || '' : 'CSV / Meta';
        const obsRaw = idxObs !== -1 ? row[idxObs] || '' : '';

        const telNormalizado = normalizarTelefone(telRaw);
        const invalido = !nomeRaw && !telNormalizado;

        parsed.push({
          idTemp: `csv_${i}_${Date.now()}`,
          selecionado: !invalido,
          nome: nomeRaw || 'Lead sem nome',
          telefone: telNormalizado || telRaw,
          email: emailRaw,
          campanha: campRaw,
          origem: origRaw,
          observacoes: obsRaw,
          invalido,
          motivoInvalido: invalido ? 'Sem nome e telefone válidos' : undefined,
        });
      }

      setItensPrevia(parsed);
      setEtapa('previa');
      toast.info(`${parsed.length} registros extraídos do CSV para conferência.`);
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao ler arquivo CSV: ' + err.message);
    }
  };

  const toggleSelecionarTodos = (checked: boolean) => {
    setItensPrevia((prev) =>
      prev.map((item) => ({
        ...item,
        selecionado: item.invalido ? false : checked,
      }))
    );
  };

  const handleConfirmarImportacao = async () => {
    const selecionados = itensPrevia.filter((it) => it.selecionado && !it.invalido);
    if (selecionados.length === 0) {
      toast.error('Nenhum lead selecionado para importação.');
      return;
    }

    setImportando(true);
    let inseridos = 0;
    let falhas = 0;

    for (const item of selecionados) {
      try {
        await novosLeadsService.salvarLead({
          nome: item.nome,
          telefone: item.telefone,
          email: item.email || null,
          origem: item.origem || 'Importação CSV',
          campanha: item.campanha || null,
          status: 'Pendente',
          prioridade: 'media',
          observacoes: item.observacoes
            ? `Importado via CSV: ${item.observacoes}`
            : 'Importado via CSV',
          revisado: false,
        });
        inseridos++;
      } catch (e) {
        console.warn('Falha ao importar lead:', item, e);
        falhas++;
      }
    }

    setImportando(false);
    toast.success(`🎉 ${inseridos} novos leads importados com sucesso!`, {
      description: falhas > 0 ? `${falhas} registros falharam ou já existiam.` : undefined,
    });
    onImportacaoConcluida();
    onClose();
    resetar();
  };

  const totalSelecionados = itensPrevia.filter((i) => i.selecionado).length;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(aberto) => {
        if (!aberto) resetar();
        onClose();
      }}
    >
      <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2 text-blue-600">
            <div className="p-2 bg-blue-100 dark:bg-blue-950/50 rounded-lg">
              <FileSpreadsheet className="w-5 h-5 text-blue-700 dark:text-blue-400" />
            </div>
            <DialogTitle className="text-xl">Importação de Leads via CSV</DialogTitle>
          </div>
          <DialogDescription>
            Importe listas de contatos de campanhas anteriores ou planilhas do Facebook Ads com prévia de conferência.
          </DialogDescription>
        </DialogHeader>

        {etapa === 'upload' ? (
          <div className="py-6 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-2xl p-8 text-center bg-muted/20 hover:bg-muted/40 transition-colors">
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFileChange}
            />

            <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 mb-3">
              <Upload className="w-7 h-7" />
            </div>

            <h4 className="font-bold text-base text-foreground">
              Selecione ou arraste seu arquivo CSV
            </h4>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">
              Aceita exportações da Central de Cadastros da Meta (Facebook/Instagram Lead Ads) ou planilhas com colunas de Nome e Telefone.
            </p>

            <Button
              className="mt-5 bg-blue-600 hover:bg-blue-700 text-white font-medium"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Procurar Arquivo CSV
            </Button>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col space-y-3">
            <div className="flex items-center justify-between bg-muted/40 p-2.5 rounded-xl border border-border/60">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <Checkbox
                    checked={
                      totalSelecionados === itensPrevia.length &&
                      itensPrevia.length > 0
                    }
                    onCheckedChange={(c) => toggleSelecionarTodos(Boolean(c))}
                  />
                  <span>Selecionar Todos ({itensPrevia.length} leads)</span>
                </label>
              </div>

              <div className="text-xs text-muted-foreground font-medium">
                Prontos para importar:{' '}
                <strong className="text-blue-600 font-bold">
                  {totalSelecionados}
                </strong>
              </div>
            </div>

            {/* Tabela de prévia de conferência */}
            <div className="flex-1 overflow-y-auto border border-border rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/60 sticky top-0 border-b border-border text-muted-foreground font-semibold">
                  <tr>
                    <th className="p-2.5 w-8"></th>
                    <th className="p-2.5">Nome</th>
                    <th className="p-2.5">Telefone</th>
                    <th className="p-2.5">Campanha / Origem</th>
                    <th className="p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {itensPrevia.map((item, idx) => (
                    <tr
                      key={item.idTemp}
                      className={`hover:bg-muted/30 transition-colors ${
                        !item.selecionado ? 'opacity-50' : ''
                      } ${item.invalido ? 'bg-rose-50/50 dark:bg-rose-950/20' : ''}`}
                    >
                      <td className="p-2.5 text-center">
                        <Checkbox
                          checked={item.selecionado}
                          disabled={item.invalido}
                          onCheckedChange={(c) =>
                            setItensPrevia((prev) =>
                              prev.map((it) =>
                                it.idTemp === item.idTemp
                                  ? { ...it, selecionado: Boolean(c) }
                                  : it
                              )
                            )
                          }
                        />
                      </td>
                      <td className="p-2.5 font-medium text-foreground">
                        <Input
                          className="h-7 text-xs"
                          value={item.nome}
                          onChange={(e) =>
                            setItensPrevia((prev) =>
                              prev.map((it) =>
                                it.idTemp === item.idTemp
                                  ? { ...it, nome: e.target.value }
                                  : it
                              )
                            )
                          }
                        />
                      </td>
                      <td className="p-2.5">
                        <Input
                          className="h-7 text-xs font-mono"
                          value={item.telefone}
                          onChange={(e) =>
                            setItensPrevia((prev) =>
                              prev.map((it) =>
                                it.idTemp === item.idTemp
                                  ? { ...it, telefone: e.target.value }
                                  : it
                              )
                            )
                          }
                        />
                      </td>
                      <td className="p-2.5 text-muted-foreground truncate max-w-[150px]">
                        {item.campanha || item.origem}
                      </td>
                      <td className="p-2.5">
                        {item.invalido ? (
                          <Badge variant="destructive" className="text-[10px]">
                            {item.motivoInvalido}
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px]">
                            Válido
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 mt-3">
          <Button
            variant="outline"
            onClick={() => {
              if (etapa === 'previa') setEtapa('upload');
              else onClose();
            }}
            disabled={importando}
          >
            {etapa === 'previa' ? 'Escolher Outro Arquivo' : 'Cancelar'}
          </Button>

          {etapa === 'previa' && (
            <Button
              onClick={handleConfirmarImportacao}
              disabled={importando || totalSelecionados === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              {importando ? (
                'Importando leads...'
              ) : (
                <>
                  Confirmar e Importar ({totalSelecionados})
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
