import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  UserPlus,
  Trash2,
  Loader2,
  Sparkles,
  Search,
  Check,
  FileCheck2,
  X,
  Phone,
  Calendar,
  AlertTriangle,
  Pill,
} from 'lucide-react';
import { toast } from 'sonner';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Paciente, TipoDocumento } from '@/types/shared';
import {
  extrairNomeDeNomeArquivo,
  extrairTextoDeBufferPdf,
  analisarTextoFicha,
  encontrarPacienteCorrespondente,
  extrairComIa,
  DadosFichaExtraida,
  capitalizarNome,
} from '@/utils/leitorPdfFichaEngine';

interface ItemFichaFila {
  id: string;
  file: File;
  nomeArquivo: string;
  tamanhoFormatado: string;
  nomeDetectado: string;
  dadosExtraidos: Partial<DadosFichaExtraida>;
  pacienteCorrespondente: Paciente | null;
  criarNovoPaciente: boolean;
  status: 'analisando' | 'pronto' | 'processando' | 'sucesso' | 'erro';
  mensagemErro?: string;
}

interface ModalLeitorPdfFichasProps {
  isOpen: boolean;
  onClose: () => void;
  onConcluido?: () => void;
}

const BUCKET = 'documentos-pacientes';

export const ModalLeitorPdfFichas: React.FC<ModalLeitorPdfFichasProps> = ({
  isOpen,
  onClose,
  onConcluido,
}) => {
  const { pacientes, addPaciente, addDocumento, addAnamnese } = useDentalSystem();
  const { configuracoes } = useConfiguracoes();
  const { user } = useAuth();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fila, setFila] = useState<ItemFichaFila[]>([]);
  const [processandoLote, setProcessandoLote] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [criarRegistroAnamnese, setCriarRegistroAnamnese] = useState(true);
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumento>('outro');
  const [filtroPacienteId, setFiltroPacienteId] = useState<{ [itemId: string]: string }>({});

  const formatarTamanho = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Processa a leitura de cada arquivo inserido na fila
  const analisarArquivo = async (file: File): Promise<ItemFichaFila> => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const nomeDeArquivo = extrairNomeDeNomeArquivo(file.name);

    let dados: Partial<DadosFichaExtraida> = {
      nome: nomeDeArquivo,
      fonteDeteccao: 'nome_arquivo',
    };

    // 1. Tenta extrair texto direto do PDF caso seja digitalizado com texto
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      try {
        const buffer = await file.arrayBuffer();
        const textoBruto = extrairTextoDeBufferPdf(buffer);
        if (textoBruto && textoBruto.length > 20) {
          const dadosDoTexto = analisarTextoFicha(textoBruto);
          if (dadosDoTexto.nome) {
            dados = { ...dados, ...dadosDoTexto, fonteDeteccao: 'texto_pdf' };
          } else {
            dados = { ...dados, ...dadosDoTexto };
          }
        }
      } catch (err) {
        console.warn('Erro na extração de texto do PDF:', err);
      }
    }

    // 2. Se não detectou nome sólido e houver chave de IA, tenta o scanner de visão
    const nomeAtual = dados.nome || nomeDeArquivo;
    if (!nomeAtual && (configuracoes?.geminiApiKey || (configuracoes as any)?.openaiApiKey)) {
      try {
        const dadosIa = await extrairComIa(
          file,
          configuracoes?.geminiApiKey,
          (configuracoes as any)?.openaiApiKey
        );
        if (dadosIa?.nome) {
          dados = dadosIa;
        }
      } catch (err) {
        console.warn('Erro ao chamar IA para documento:', err);
      }
    }

    const nomeFinal = dados.nome || nomeDeArquivo || file.name.replace(/\.[^/.]+$/, '');
    const pacienteEncontrado = encontrarPacienteCorrespondente(nomeFinal, dados.cpf, pacientes);

    return {
      id,
      file,
      nomeArquivo: file.name,
      tamanhoFormatado: formatarTamanho(file.size),
      nomeDetectado: nomeFinal,
      dadosExtraidos: dados,
      pacienteCorrespondente: pacienteEncontrado,
      criarNovoPaciente: !pacienteEncontrado,
      status: 'pronto',
    };
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    toast.loading(`Lendo ${files.length} arquivo(s)...`, { id: 'leitura-pdf' });

    const novosItens: ItemFichaFila[] = [];
    for (const file of files) {
      const item = await analisarArquivo(file);
      novosItens.push(item);
    }

    setFila((prev) => [...prev, ...novosItens]);
    toast.dismiss('leitura-pdf');
    toast.success(`${novosItens.length} ficha(s) carregada(s) para conferência!`);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoverItem = (id: string) => {
    setFila((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAlterarNome = (id: string, novoNome: string) => {
    setFila((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const pac = encontrarPacienteCorrespondente(novoNome, item.dadosExtraidos.cpf, pacientes);
        return {
          ...item,
          nomeDetectado: novoNome,
          pacienteCorrespondente: pac,
          criarNovoPaciente: !pac,
        };
      })
    );
  };

  const handleSelecionarPacienteExistente = (id: string, pacienteId: string) => {
    const pac = pacientes.find((p) => p.id === pacienteId) || null;
    setFila((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        return {
          ...item,
          pacienteCorrespondente: pac,
          criarNovoPaciente: !pac,
          nomeDetectado: pac ? pac.nome : item.nomeDetectado,
        };
      })
    );
  };

  const handleAlternarCriarNovo = (id: string, criar: boolean) => {
    setFila((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        return {
          ...item,
          criarNovoPaciente: criar,
          pacienteCorrespondente: criar ? null : item.pacienteCorrespondente,
        };
      })
    );
  };

  // Executa a importação e anexação de todas as fichas na fila
  const handleProcessarTudo = async () => {
    if (fila.length === 0) return;

    setProcessandoLote(true);
    setProgresso(0);

    let criados = 0;
    let anexados = 0;
    let erros = 0;

    for (let i = 0; i < fila.length; i++) {
      const item = fila[i];
      setFila((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, status: 'processando' } : it))
      );

      try {
        let pacienteFinalId = item.pacienteCorrespondente?.id;
        let pacienteFinalNome = item.pacienteCorrespondente?.nome;

        // 1. Caso o paciente não exista, cria uma nova ficha / paciente
        if (item.criarNovoPaciente || !pacienteFinalId) {
          const nomeValido = item.nomeDetectado.trim() || 'Paciente Sem Nome';
          const novoPac = await addPaciente({
            nome: capitalizarNome(nomeValido),
            telefone: item.dadosExtraidos.telefone || '',
            email: '',
            cpf: item.dadosExtraidos.cpf || '',
            idade: 0,
            convenio: 'Particular',
            origemLead: 'outros',
            status: 'Ativo',
            alergias: item.dadosExtraidos.alergias || '',
            medicamentos: item.dadosExtraidos.medicamentos || '',
            historicoMedico: item.dadosExtraidos.historicoMedico || '',
            observacoes: item.dadosExtraidos.observacoes || 'Cadastro gerado via importação de Ficha Manual em PDF',
          });

          pacienteFinalId = novoPac.id;
          pacienteFinalNome = novoPac.nome;
          criados++;
        }

        // 2. Faz o upload do arquivo para o bucket de documentos do paciente
        const userId = user?.id || 'clinica';
        const safeName = item.file.name.replace(/[^\w.\-]/g, '_');
        const storagePath = `${userId}/${pacienteFinalId}/${Date.now()}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, item.file, {
            contentType: item.file.type || 'application/pdf',
            upsert: true,
          });

        if (uploadError) {
          console.warn('Upload aviso:', uploadError);
        }

        // 3. Registra o documento na tabela de documentos do paciente
        await addDocumento({
          pacienteId: pacienteFinalId,
          nome: item.file.name,
          tipo: tipoDocumento,
          arquivo: storagePath,
          tamanho: item.file.size,
          descricao: `Ficha manual digitalizada (${pacienteFinalNome})`,
        });

        // 4. Opcionalmente registra a Anamnese clínica vinculada
        if (criarRegistroAnamnese) {
          try {
            await addAnamnese({
              pacienteId: pacienteFinalId,
              data: new Date().toISOString(),
              queixaPrincipal:
                item.dadosExtraidos.queixaPrincipal ||
                item.dadosExtraidos.observacoes ||
                'Ficha de anamnese manual física anexada aos documentos',
              alergias: item.dadosExtraidos.alergias || '',
              medicamentos: item.dadosExtraidos.medicamentos || '',
              historiaMedica: item.dadosExtraidos.historicoMedico || '',
              observacoes: `Ficha manual original importada em PDF: ${item.file.name}`,
              respostas: {},
            });
          } catch (e) {
            console.warn('Aviso ao registrar anamnese estruturada:', e);
          }
        }

        anexados++;
        setFila((prev) =>
          prev.map((it) => (it.id === item.id ? { ...it, status: 'sucesso' } : it))
        );
      } catch (err: any) {
        console.error('Erro ao processar item:', err);
        erros++;
        setFila((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? { ...it, status: 'erro', mensagemErro: err.message || 'Falha ao salvar' }
              : it
          )
        );
      }

      setProgresso(Math.round(((i + 1) / fila.length) * 100));
    }

    setProcessandoLote(false);

    if (erros === 0) {
      toast.success(
        `Importação 100% concluída! ${anexados} ficha(s) anexada(s)${
          criados > 0 ? ` e ${criados} novo(s) paciente(s) criado(s)` : ''
        }.`
      );
      if (onConcluido) onConcluido();
    } else {
      toast.warning(`${anexados} ficha(s) anexadas, mas ${erros} apresentaram erro.`);
    }
  };

  const handleLimparFila = () => {
    setFila([]);
    setProgresso(0);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-0 flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden border shadow-2xl gap-0 [&>button]:text-white/80 [&>button]:hover:text-white [&>button]:top-2.5 [&>button]:right-3">
        {/* Topo com Gradiente */}
        <div className="bg-gradient-to-r from-teal-700 via-emerald-600 to-teal-800 text-white px-4 py-3 shrink-0 pr-10">
          <DialogTitle className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-200" />
            Leitor e Importador de Fichas (PDF / Imagem)
          </DialogTitle>
          <DialogDescription className="text-teal-100 text-xs mt-0.5 leading-tight">
            Selecione fichas manuais digitalizadas. O sistema detecta o nome do paciente, anexa o PDF ao prontuário ou cria uma nova ficha caso o paciente ainda não exista.
          </DialogDescription>
        </div>

        {/* Corpo com Scroll */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-4">
          {/* Área de Seleção de Arquivos (Dropzone) */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-emerald-500/40 hover:border-emerald-500 rounded-xl p-5 text-center flex flex-col items-center justify-center bg-emerald-50/20 dark:bg-emerald-950/20 hover:bg-emerald-50/40 transition-colors cursor-pointer group"
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="application/pdf,image/*"
              className="hidden"
              onChange={handleFilesSelected}
            />
            <div className="h-10 w-10 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <UploadCloud className="h-5 w-5" />
            </div>
            <p className="text-xs sm:text-sm font-semibold text-foreground">
              Clique aqui ou arraste seus arquivos PDF ou fotos de fichas
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Suporta vários PDFs de uma só vez • O sistema lê o nome e associa ao paciente
            </p>
          </div>

          {/* Opções de Importação */}
          <div className="bg-muted/30 border rounded-lg p-3 space-y-2 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <Checkbox
                  checked={criarRegistroAnamnese}
                  onCheckedChange={(checked) => setCriarRegistroAnamnese(Boolean(checked))}
                />
                <span className="font-medium text-foreground">
                  Criar também registro clínico de Anamnese vinculada
                </span>
              </label>

              <div className="flex items-center gap-1.5 text-muted-foreground">
                <span className="text-[11px]">Categoria:</span>
                <Badge variant="outline" className="text-[11px] bg-background">
                  Ficha Clínica / Anamnese Manual
                </Badge>
              </div>
            </div>
          </div>

          {/* Barra de Progresso no Processamento */}
          {processandoLote && (
            <div className="space-y-1.5 p-3 rounded-lg border bg-emerald-500/10 border-emerald-500/30">
              <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Processando e anexando fichas...
                </span>
                <span>{progresso}%</span>
              </div>
              <Progress value={progresso} className="h-2" />
            </div>
          )}

          {/* Lista de Fichas para Conferência */}
          {fila.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <FileCheck2 className="h-4 w-4 text-emerald-600" />
                  Fichas Identificadas ({fila.length})
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleLimparFila}
                  disabled={processandoLote}
                  className="h-6 text-[11px] text-muted-foreground hover:text-destructive px-2"
                >
                  Limpar lista
                </Button>
              </div>

              <div className="space-y-2.5">
                {fila.map((item, idx) => {
                  const pacExistente = item.pacienteCorrespondente;
                  const isNovo = item.criarNovoPaciente;

                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded-lg border transition-all text-xs space-y-2 ${
                        item.status === 'sucesso'
                          ? 'border-emerald-500/50 bg-emerald-500/5'
                          : item.status === 'erro'
                          ? 'border-destructive/50 bg-destructive/5'
                          : 'bg-card border-border/80 shadow-xs'
                      }`}
                    >
                      {/* Topo do Card de Ficha */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-foreground truncate leading-tight" title={item.nomeArquivo}>
                              {idx + 1}. {item.nomeArquivo}
                            </p>
                            <p className="text-[10px] text-muted-foreground">{item.tamanhoFormatado}</p>
                          </div>
                        </div>

                        {/* Status da Ficha */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {item.status === 'sucesso' ? (
                            <Badge className="bg-emerald-600 text-white text-[10px] gap-1 py-0.5">
                              <CheckCircle2 className="h-3 w-3" /> Anexada
                            </Badge>
                          ) : item.status === 'processando' ? (
                            <Badge variant="outline" className="text-[10px] gap-1 py-0.5">
                              <Loader2 className="h-3 w-3 animate-spin" /> Anexando
                            </Badge>
                          ) : item.status === 'erro' ? (
                            <Badge variant="destructive" className="text-[10px] gap-1 py-0.5">
                              <AlertCircle className="h-3 w-3" /> Falha
                            </Badge>
                          ) : isNovo ? (
                            <Badge className="bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/30 text-[10px] gap-1 py-0.5">
                              <UserPlus className="h-3 w-3" /> Criar Novo Paciente
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border border-emerald-500/30 text-[10px] gap-1 py-0.5">
                              <UserCheck className="h-3 w-3" /> Paciente Encontrado
                            </Badge>
                          )}

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={processandoLote}
                            onClick={() => handleRemoverItem(item.id)}
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                            title="Remover este arquivo"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Campo do Nome Detectado / Associação */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-border/50">
                        <div className="space-y-1">
                          <Label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                            Nome Detectado na Ficha:
                          </Label>
                          <Input
                            value={item.nomeDetectado}
                            disabled={processandoLote}
                            onChange={(e) => handleAlterarNome(item.id, e.target.value)}
                            placeholder="Nome completo do paciente..."
                            className="h-7 text-xs bg-background"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[10px] font-semibold text-muted-foreground flex items-center justify-between">
                            <span>Vínculo do Paciente:</span>
                            <button
                              type="button"
                              onClick={() => handleAlternarCriarNovo(item.id, !isNovo)}
                              className="text-[10px] text-primary hover:underline cursor-pointer"
                            >
                              {isNovo ? 'Vincular a existente' : 'Criar como novo'}
                            </button>
                          </Label>

                          {isNovo ? (
                            <div className="h-7 px-2.5 rounded-md border border-dashed border-amber-500/40 bg-amber-500/5 text-amber-900 dark:text-amber-200 flex items-center text-[11px] font-medium">
                              ✨ Criará ficha nova para &ldquo;{item.nomeDetectado || 'Paciente'}&rdquo;
                            </div>
                          ) : (
                            <select
                              value={pacExistente?.id || ''}
                              disabled={processandoLote}
                              onChange={(e) => handleSelecionarPacienteExistente(item.id, e.target.value)}
                              className="h-7 text-xs rounded-md border border-input bg-background px-2 py-0.5 w-full cursor-pointer"
                            >
                              {pacExistente && (
                                <option value={pacExistente.id}>
                                  ✓ {pacExistente.nome} {pacExistente.cpf ? `(CPF: ${pacExistente.cpf})` : ''}
                                </option>
                              )}
                              <option value="">-- Selecionar outro paciente --</option>
                              {pacientes.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.nome} {p.cpf ? `(${p.cpf})` : ''}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>

                      {/* Informações Clínicas Detectadas (Se houver) */}
                      {(item.dadosExtraidos.cpf ||
                        item.dadosExtraidos.telefone ||
                        item.dadosExtraidos.alergias ||
                        item.dadosExtraidos.queixaPrincipal) && (
                        <div className="flex flex-wrap gap-1.5 pt-1 text-[10px]">
                          {item.dadosExtraidos.cpf && (
                            <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground border">
                              CPF: {item.dadosExtraidos.cpf}
                            </span>
                          )}
                          {item.dadosExtraidos.telefone && (
                            <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground border flex items-center gap-1">
                              <Phone className="h-2.5 w-2.5" /> {item.dadosExtraidos.telefone}
                            </span>
                          )}
                          {item.dadosExtraidos.alergias && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 flex items-center gap-1">
                              <AlertTriangle className="h-2.5 w-2.5" /> Alergia: {item.dadosExtraidos.alergias}
                            </span>
                          )}
                          {item.dadosExtraidos.queixaPrincipal && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 truncate max-w-xs">
                              Queixa: {item.dadosExtraidos.queixaPrincipal}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {fila.length === 0 && (
            <div className="text-center py-6 text-muted-foreground space-y-1">
              <p className="text-xs">Nenhum arquivo na fila ainda.</p>
              <p className="text-[11px]">
                Você pode enviar 1 ficha individual ou dezenas de PDFs de uma só vez para digitalizar o arquivo histórico da clínica.
              </p>
            </div>
          )}
        </div>

        {/* Rodapé Fixo */}
        <div className="shrink-0 px-4 py-3 bg-background border-t flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] text-muted-foreground">
            {fila.length > 0
              ? `${fila.length} arquivo(s) prontos para importar`
              : 'Pronto para receber arquivos'}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={processandoLote}
              className="h-8 text-xs cursor-pointer"
            >
              Fechar
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleProcessarTudo}
              disabled={fila.length === 0 || processandoLote}
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer shadow-xs gap-1.5"
            >
              {processandoLote ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Anexar Todas as Fichas ({fila.length})
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
