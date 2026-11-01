import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
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
  HelpCircle,
} from 'lucide-react';
import { RespostaFormulario } from '@/types/novosLeads';
import {
  normalizarTelefone,
  formatarTelefoneExibicao,
  novosLeadsService,
  parseRawMetaAdsString,
} from '@/services/novosLeadsService';
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
  respostas: RespostaFormulario[];
  data_criacao?: string;
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
    processarArquivoPlanilha(file);
  };

  const processarArquivoPlanilha = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      // Lê qualquer planilha Excel (.xlsx, .xls) ou texto (.csv, .tsv) com SheetJS
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        toast.error('Nenhuma planilha encontrada no arquivo.');
        return;
      }

      const worksheet = workbook.Sheets[sheetName];
      const rows: unknown[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });

      if (rows.length < 1) {
        toast.error('O arquivo parece estar vazio.');
        return;
      }

      const headers = (rows[0] || []).map((h: unknown) => String(h || '').trim());
      const lowerHeaders = headers.map((h) => h.toLowerCase());

      const getColIndex = (keywords: string[]) => {
        return lowerHeaders.findIndex((h) => keywords.some((k) => h === k || h.includes(k)));
      };

      const idxNome = getColIndex(['full_name', 'nome_completo', 'nome', 'name', 'first_name', 'lead_name', 'paciente']);
      const idxTelefone = getColIndex(['phone_number', 'telefone', 'número_de_telefone', 'numero_de_telefone', 'phone', 'celular', 'whatsapp', 'fone']);
      const idxEmail = getColIndex(['email', 'e-mail']);
      const idxCampanha = getColIndex(['campaign_name', 'campanha', 'campaign', 'anúncio', 'anuncio', 'ad_name']);
      const idxOrigem = getColIndex(['platform', 'plataforma', 'origem', 'source']);
      const idxData = getColIndex(['created_time', 'data_criacao', 'data', 'date']);
      const idxObs = getColIndex(['observacoes', 'obs', 'mensagem', 'message', 'comments']);

      // Identifica colunas de perguntas personalizadas do formulário Meta Ads
      const SYSTEM_COLUMNS = [
        'id', 'created_time', 'ad_id', 'ad_name', 'adset_id', 'adset_name', 'campaign_id',
        'campaign_name', 'form_id', 'form_name', 'is_organic', 'platform', 'status', 'is_lead',
        'date_created', 'lead_id', 'full_name', 'first_name', 'last_name', 'phone_number',
        'email', 'telefone', 'nome', 'celular', 'whatsapp'
      ];

      const questionColIndices: { index: number; pergunta: string }[] = [];
      lowerHeaders.forEach((h, colIdx) => {
        if (!h) return;
        const isSystem = SYSTEM_COLUMNS.some((sc) => h === sc || h.startsWith('id_') || h.endsWith('_id'));
        if (!isSystem && colIdx !== idxNome && colIdx !== idxTelefone && colIdx !== idxEmail) {
          let perguntaFormatada = headers[colIdx] || `Pergunta ${questionColIndices.length + 1}`;
          perguntaFormatada = perguntaFormatada.replace(/_/g, ' ').trim();
          perguntaFormatada = perguntaFormatada.charAt(0).toUpperCase() + perguntaFormatada.slice(1);
          questionColIndices.push({ index: colIdx, pergunta: perguntaFormatada });
        }
      });

      const parsed: ItemPrevia[] = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0 || row.every((c: unknown) => !c)) continue;

        // Caso especial: linha contendo dump bruto do Meta Ads (ex: "l:300287529... p:82988054849")
        const firstCell = String(row[0] || '');
        if (row.length === 1 || (firstCell.includes('l:') && firstCell.includes('p:'))) {
          const rawParsed = parseRawMetaAdsString(firstCell);
          if (rawParsed.isMetaRaw) {
            parsed.push({
              idTemp: `meta_${i}_${Date.now()}`,
              selecionado: Boolean(rawParsed.nome && rawParsed.telefone),
              nome: rawParsed.nome || 'Lead Meta Ads',
              telefone: rawParsed.telefone,
              email: '',
              campanha: rawParsed.campanha || 'Meta Ads Leads',
              origem: rawParsed.origem || 'Meta Ads (Instagram)',
              observacoes: rawParsed.formNome ? `Formulário: ${rawParsed.formNome}` : '',
              respostas: rawParsed.respostas,
              data_criacao: rawParsed.data_criacao,
              invalido: !rawParsed.nome && !rawParsed.telefone,
              motivoInvalido: (!rawParsed.nome && !rawParsed.telefone) ? 'Sem nome e telefone válidos' : undefined,
            });
            continue;
          }
        }

        // Caso normal: colunas separadas
        const nomeRaw = idxNome !== -1 ? String(row[idxNome] || '').trim() : '';
        let telRaw = idxTelefone !== -1 ? String(row[idxTelefone] || '').trim() : '';
        const emailRaw = idxEmail !== -1 ? String(row[idxEmail] || '').trim() : '';
        const campRaw = idxCampanha !== -1 ? String(row[idxCampanha] || '').trim() : 'Meta Ads';
        let origRaw = idxOrigem !== -1 ? String(row[idxOrigem] || '').trim() : 'Meta Ads (Exportação)';
        if (origRaw.toLowerCase() === 'ig') origRaw = 'Meta Ads (Instagram)';
        if (origRaw.toLowerCase() === 'fb') origRaw = 'Meta Ads (Facebook)';

        const dataRaw = idxData !== -1 ? String(row[idxData] || '').trim() : undefined;
        const obsRaw = idxObs !== -1 ? String(row[idxObs] || '').trim() : '';

        // Limpa o prefixo p: ou p:+ do telefone gerado pelo Meta Ads
        if (telRaw.toLowerCase().startsWith('p:')) {
          telRaw = telRaw.slice(2).trim();
        }

        const telNormalizado = normalizarTelefone(telRaw);

        // Extrai respostas das perguntas personalizadas
        const respostas: RespostaFormulario[] = [];
        questionColIndices.forEach((q, qIdx) => {
          const val = row[q.index];
          if (val !== undefined && val !== null && String(val).trim().length > 0) {
            let respTexto = String(val).replace(/_/g, ' ').trim();
            respTexto = respTexto.replace(/r\$\s*/gi, 'R$ ');
            respTexto = respTexto.charAt(0).toUpperCase() + respTexto.slice(1);
            respostas.push({
              campo: `pergunta_${qIdx + 1}`,
              pergunta: q.pergunta,
              resposta: respTexto,
            });
          }
        });

        const invalido = !nomeRaw && !telNormalizado;

        parsed.push({
          idTemp: `row_${i}_${Date.now()}`,
          selecionado: !invalido,
          nome: nomeRaw || 'Lead Meta Ads',
          telefone: telNormalizado || telRaw,
          email: emailRaw,
          campanha: campRaw,
          origem: origRaw,
          observacoes: obsRaw,
          respostas,
          data_criacao: dataRaw,
          invalido,
          motivoInvalido: invalido ? 'Sem nome e telefone válidos' : undefined,
        });
      }

      setItensPrevia(parsed);
      setEtapa('previa');
      toast.info(`🎉 ${parsed.length} leads do Meta Ads extraídos para conferência.`);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(err);
      toast.error('Erro ao ler planilha: ' + (errMsg || 'Arquivo inválido'));
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
          origem: item.origem || 'Meta Lead Ads',
          campanha: item.campanha || null,
          status: 'Pendente',
          prioridade: 'media',
          respostas: item.respostas || [],
          data_criacao: item.data_criacao || new Date().toISOString(),
          observacoes: item.observacoes
            ? `Importado via Meta Ads: ${item.observacoes}`
            : 'Importado via Meta Ads',
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
            <div>
              <DialogTitle className="text-lg">
                Importar Planilha do Meta Ads (Excel / CSV)
              </DialogTitle>
              <DialogDescription className="text-xs">
                Importe leads de formulários instantâneos do Instagram e Facebook Ads (.xlsx, .csv).
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {etapa === 'upload' ? (
          <div className="p-6 space-y-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border hover:border-blue-500 rounded-2xl p-8 text-center cursor-pointer transition-colors bg-muted/20 hover:bg-muted/40 space-y-3"
            >
              <div className="w-14 h-14 bg-blue-50 dark:bg-blue-950/60 text-blue-600 rounded-full flex items-center justify-center mx-auto shadow-xs">
                <Upload className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-foreground">
                  Clique ou arraste sua exportação do Meta Ads aqui
                </p>
                <p className="text-xs text-muted-foreground">
                  Compatível com <strong>Excel (.xlsx, .xls)</strong> e <strong>CSV</strong> exportados do Gerenciador de Anúncios.
                </p>
              </div>
              <div className="pt-2">
                <Badge variant="outline" className="text-[11px] text-muted-foreground">
                  Identifica perguntas, respostas, nome e telefone com DDD automaticamente
                </Badge>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.tsv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 space-y-3 p-1">
            {/* Barra de resumo da prévia */}
            <div className="flex items-center justify-between bg-muted/40 p-2.5 rounded-xl border border-border">
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
                    <th className="p-2.5">Perguntas & Respostas</th>
                    <th className="p-2.5">Campanha / Origem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {itensPrevia.map((item) => (
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
                      <td className="p-2.5 font-mono">
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
                      <td className="p-2.5">
                        {item.respostas && item.respostas.length > 0 ? (
                          <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200">
                            {item.respostas.length} respostas extraídas
                          </Badge>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">Sem perguntas</span>
                        )}
                      </td>
                      <td className="p-2.5 text-muted-foreground truncate max-w-[150px]">
                        {item.campanha || item.origem}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DialogFooter className="pt-3 border-t flex items-center justify-between">
          {etapa === 'previa' ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEtapa('upload')}
                disabled={importando}
                className="text-xs"
              >
                Voltar e escolher outro arquivo
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmarImportacao}
                disabled={importando || totalSelecionados === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs gap-1.5"
              >
                {importando ? (
                  'Importando...'
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Confirmar Importação de {totalSelecionados} Leads
                  </>
                )}
              </Button>
            </>
          ) : (
            <div className="flex justify-end w-full">
              <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
                Cancelar
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
