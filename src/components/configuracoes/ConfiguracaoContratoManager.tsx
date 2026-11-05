import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  FileSignature,
  QrCode,
  Building2,
  ShieldCheck,
  Scale,
  Save,
  RotateCcw,
  CheckCircle2,
  Copy,
  Check,
  Eye,
  Loader2,
  CreditCard,
  Phone,
  Mail,
  MapPin,
  Sparkles,
  PenTool,
  AlertTriangle,
  Lock,
  ScrollText,
  ShieldAlert,
  Clock,
  History,
  UserCheck,
  AlertCircle,
  FileCheck,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { useConfiguracoesContrato, ConfiguracoesContrato, carregarConfiguracoesContratoSync } from '@/hooks/useConfiguracoesContrato';
import { identificarTipoDocumento, formatarDocumento, validarDocumento } from '@/utils/documentoFormat';
import DigitalSignature from '@/components/signature/DigitalSignature';
import { gerarRubricaPadraoDra, validarAutorizacaoAssinatura } from '@/utils/contratoEngine';

export const ConfiguracaoContratoManager: React.FC = () => {
  const {
    configContrato,
    salvarConfiguracoesContrato,
    restaurarPadrao,
    loading,
    salvando,
    autorizacaoAtiva,
    carregandoAutorizacao,
    carregarAutorizacao,
    concederAutorizacao,
    revogarAutorizacao,
  } = useConfiguracoesContrato();

  const [form, setForm] = useState<ConfiguracoesContrato>(() => configContrato || carregarConfiguracoesContratoSync());
  const [copiouChave, setCopiouChave] = useState(false);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);

  // Estados específicos para a autorização de assinatura automática da profissional
  const [isAutorizacaoModalOpen, setIsAutorizacaoModalOpen] = useState(false);
  const [isDetalhesAutorizacaoOpen, setIsDetalhesAutorizacaoOpen] = useState(false);
  const [isRevogarModalOpen, setIsRevogarModalOpen] = useState(false);
  const [processandoAutorizacao, setProcessandoAutorizacao] = useState(false);
  const [modelosSelecionados, setModelosSelecionados] = useState<string[]>(['geral', 'lentes_resina', 'endodontia']);
  const [confirmacaoExpressa, setConfirmacaoExpressa] = useState(false);
  const [motivoRevogacao, setMotivoRevogacao] = useState('Revogação expressa realizada pela profissional no painel administrativo');
  const [rubricaTemp, setRubricaTemp] = useState<string>('');

  useEffect(() => {
    if (configContrato) {
      setForm(configContrato);
    }
  }, [configContrato]);

  const handleChange = (campo: keyof ConfiguracoesContrato, valor: any) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  };

  const handleSalvar = async () => {
    if (!form) return;

    // 1. Validação estrita do CPF ou CNPJ da contratada (bloqueia emails, digitos errados, etc)
    if (form.cnpjClinicaContrato) {
      const valDoc = validarDocumento(form.cnpjClinicaContrato);
      if (!valDoc.valido) {
        toast.error('Documento da clínica/profissional inválido', {
          description: valDoc.erro || 'Informe um CPF ou CNPJ válido com dígitos verificadores corretos.',
        });
        return;
      }
    } else {
      toast.error('Documento obrigatório', {
        description: 'Informe o CPF ou CNPJ da contratada antes de salvar as configurações.',
      });
      return;
    }

    // 2. Validação do Documento do Titular Favorecido PIX (se informado)
    if (form.cnpjCpfFavorecidoPix) {
      const valFav = validarDocumento(form.cnpjCpfFavorecidoPix);
      if (!valFav.valido) {
        toast.error('Documento do favorecido PIX inválido', {
          description: valFav.erro || 'Informe um CPF ou CNPJ válido para o titular da chave PIX.',
        });
        return;
      }
    }

    await salvarConfiguracoesContrato(form);
  };

  const handleCopiarChave = () => {
    if (!form?.chavePix) return;
    navigator.clipboard.writeText(form?.chavePix || '');
    setCopiouChave(true);
    toast.success('Chave PIX copiada para a área de transferência!');
    setTimeout(() => setCopiouChave(false), 2000);
  };

  const isAutorizacaoVigente = Boolean(
    autorizacaoAtiva &&
    autorizacaoAtiva.ativo &&
    !autorizacaoAtiva.revogadoEm &&
    validarAutorizacaoAssinatura(autorizacaoAtiva, 'geral')
  );

  const handleConcederAutorizacao = async () => {
    if (!confirmacaoExpressa) {
      toast.error('É obrigatório assinalar a confirmação expressa de autorização da profissional.');
      return;
    }
    if (modelosSelecionados.length === 0) {
      toast.error('Selecione ao menos um modelo de contrato para autorização.');
      return;
    }

    try {
      setProcessandoAutorizacao(true);
      const textoDeclaracao =
        `Eu, Dra. Rosângela Santos Pereira, inscrita no CRO-AL sob o nº 06267 e CPF sob o nº 032.663.962-43, na qualidade de cirurgiã-dentista e responsável técnica pela clínica, AUTORIZO EXPRESSAMENTE a vinculação e emissão automatizada de minha assinatura eletrônica nos contratos de prestação de serviços odontológicos gerados pelo sistema a partir de orçamentos previamente aprovados pelo paciente. Esta autorização abrange especificamente os seguintes modelos contratuais: ${modelosSelecionados.join(', ')}. Declaro ciência de que cada contrato emitido registrará a versão exata do instrumento, hash de integridade, carimbo de data/hora e trilha de auditoria digital, resguardado o meu direito de revogação desta autorização a qualquer momento para emissões futuras.`;

      const rubricaFinal = rubricaTemp || form.assinaturaPadraoDentista || gerarRubricaPadraoDra(form.dentistaResponsavelContrato, form.croResponsavelContrato);

      const res = await concederAutorizacao({
        profissionalNome: 'Dra. Rosângela Santos Pereira',
        profissionalCro: '06267-AL',
        profissionalDocumento: '032.663.962-43',
        autorizacaoExpressa: textoDeclaracao,
        modelosAutorizados: modelosSelecionados,
        assinaturaGrafica: rubricaFinal,
        evidencias: {
          motivo: 'Autorização administrativa concedida no painel de configurações',
          modelos: modelosSelecionados,
          confirmacaoFéDeGrau: true,
          ipOrigem: '127.0.0.1',
        },
      });

      if (res && res.ok) {
        toast.success('Assinatura automática autorizada com sucesso para a Dra. Rosângela Santos Pereira!');
        setIsAutorizacaoModalOpen(false);
        setConfirmacaoExpressa(false);
        await carregarAutorizacao();
      } else {
        toast.error('Erro ao registrar autorização: ' + (res?.error || 'Tente novamente'));
      }
    } catch (err: any) {
      console.error('Erro ao conceder autorizacao:', err);
      toast.error('Falha ao conceder autorização: ' + (err?.message || 'Erro inesperado'));
    } finally {
      setProcessandoAutorizacao(false);
    }
  };

  const handleRevogarAutorizacao = async () => {
    try {
      setProcessandoAutorizacao(true);
      const res = await revogarAutorizacao(autorizacaoAtiva?.id, motivoRevogacao);
      if (res && res.ok) {
        toast.success('Autorização revogada com sucesso! Emissões futuras exigirão assinatura manual.');
        setIsRevogarModalOpen(false);
        await carregarAutorizacao();
      } else {
        toast.error('Erro ao revogar autorização: ' + (res?.error || 'Tente novamente'));
      }
    } catch (err: any) {
      console.error('Erro ao revogar autorizacao:', err);
      toast.error('Falha ao revogar: ' + (err?.message || 'Erro inesperado'));
    } finally {
      setProcessandoAutorizacao(false);
    }
  };

  if (loading || !form) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&margin=4&data=${encodeURIComponent(
    form?.chavePix || 'pix'
  )}`;

  return (
    <div className="space-y-6">
      {/* Topo com Título e Ação de Salvar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-card rounded-lg border border-border shadow-sm">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 text-foreground">
            <FileSignature className="h-5 w-5 text-primary" />
            Configurações do Contrato Odontológico & Chave PIX
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Padronize os dados da clínica, titular e chave PIX para exibição automática nos contratos, orçamentos e links de assinatura digital.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={restaurarPadrao}
            disabled={salvando}
            className="h-9 gap-1.5 border-border text-foreground hover:bg-muted"
          >
            <RotateCcw className="h-4 w-4" />
            Restaurar Padrão
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleSalvar}
            disabled={salvando}
            className="h-9 gap-1.5 font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
          >
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Configurações
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna 1 & 2: Formulários de Configuração */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: Dados do PIX e Pagamento Oficial */}
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <QrCode className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                  1. Dados Oficiais para Pagamento via PIX (Contrato e QR Code)
                </CardTitle>
                <Badge variant="outline" className="text-xs text-sky-700 bg-sky-50 dark:bg-sky-950/50 dark:text-sky-300 border-sky-300">
                  Cláusula 3ª
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Estas informações aparecem no quadro de destaque do contrato com QR Code gerado automaticamente.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs font-semibold">Tipo de Chave PIX</Label>
                  <Select
                    value={form.tipoChavePix}
                    onValueChange={(val: any) => handleChange('tipoChavePix', val)}
                  >
                    <SelectTrigger className="h-9 text-xs mt-1">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="telefone">Telefone / Celular</SelectItem>
                      <SelectItem value="cnpj">CNPJ</SelectItem>
                      <SelectItem value="cpf">CPF</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="aleatoria">Chave Aleatória (EVP)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="sm:col-span-2">
                  <Label className="text-xs font-semibold">Chave PIX Oficial *</Label>
                  <Input
                    value={form?.chavePix || ''}
                    onChange={(e) => handleChange('chavePix', e.target.value)}
                    placeholder="Ex: 82974002213 ou contato@clinica.com.br"
                    className="h-9 text-xs mt-1 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold">Titular / Favorecido da Conta *</Label>
                  <Input
                    value={form.favorecidoPix}
                    onChange={(e) => handleChange('favorecidoPix', e.target.value)}
                    placeholder="Ex: Dra. Rosangela Santos"
                    className="h-9 text-xs mt-1"
                  />
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Nome da pessoa ou razão social que aparece no comprovante bancário.
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">CNPJ ou CPF do Favorecido</Label>
                    {form.cnpjCpfFavorecidoPix && (() => {
                      const res = validarDocumento(form.cnpjCpfFavorecidoPix);
                      if (!res.valido) {
                        return (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300">
                            Inválido
                          </span>
                        );
                      }
                      return (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          {res.tipoDetectado === 'cpf' ? 'CPF Válido' : 'CNPJ Válido'}
                        </span>
                      );
                    })()}
                  </div>
                  <Input
                    value={form.cnpjCpfFavorecidoPix}
                    onChange={(e) => handleChange('cnpjCpfFavorecidoPix', e.target.value)}
                    onBlur={(e) => {
                      const dig = e.target.value.replace(/\D/g, '');
                      if (dig.length === 11 || dig.length === 14) {
                        handleChange('cnpjCpfFavorecidoPix', formatarDocumento(dig));
                      }
                    }}
                    placeholder="Ex: 032.663.962-43"
                    className="h-9 text-xs mt-1 font-mono"
                  />
                  {form.cnpjCpfFavorecidoPix && !validarDocumento(form.cnpjCpfFavorecidoPix).valido && (
                    <p className="text-[10px] text-red-600 font-medium mt-0.5">
                      {validarDocumento(form.cnpjCpfFavorecidoPix).erro}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold">Instituição Financeira / Banco (Opcional)</Label>
                  <Input
                    value={form.bancoPix}
                    onChange={(e) => handleChange('bancoPix', e.target.value)}
                    placeholder="Ex: Nubank, Banco Cora, Banco do Brasil..."
                    className="h-9 text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Instruções de Baixa do PIX</Label>
                  <Input
                    value={form.instrucoesPix}
                    onChange={(e) => handleChange('instrucoesPix', e.target.value)}
                    placeholder="Texto de orientação exibido abaixo do QR Code..."
                    className="h-9 text-xs mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Dados Cadastrais da Clínica para o Contrato */}
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                2. Identificação da Contratada (Cabeçalho e Preâmbulo)
              </CardTitle>
              <CardDescription className="text-xs">
                Dados cadastrais da clínica inseridos na qualificação das partes do contrato.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold">Razão Social / Nome da Clínica *</Label>
                  <Input
                    value={form.nomeClinicaContrato}
                    onChange={(e) => handleChange('nomeClinicaContrato', e.target.value)}
                    placeholder="Ex: DRA. ROSANGELA SANTOS"
                    className="h-9 text-xs mt-1 font-semibold"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">CPF ou CNPJ da Clínica / Profissional *</Label>
                    {form.cnpjClinicaContrato ? (() => {
                      const res = validarDocumento(form.cnpjClinicaContrato);
                      if (!res.valido) {
                        return (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300">
                            Inválido
                          </span>
                        );
                      }
                      return (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          {res.tipoDetectado === 'cpf' ? 'CPF (Pessoa Física)' : 'CNPJ (Pessoa Jurídica)'}
                        </span>
                      );
                    })() : (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                        Obrigatório
                      </span>
                    )}
                  </div>
                  <Input
                    value={form.cnpjClinicaContrato}
                    onChange={(e) => handleChange('cnpjClinicaContrato', e.target.value)}
                    onBlur={(e) => {
                      const dig = e.target.value.replace(/\D/g, '');
                      if (dig.length === 11 || dig.length === 14) {
                        handleChange('cnpjClinicaContrato', formatarDocumento(dig));
                      }
                    }}
                    placeholder="Ex: 032.663.962-43 ou 69.890.045/0001-85"
                    className="h-9 text-xs mt-1 font-mono"
                  />
                  {form.cnpjClinicaContrato && !validarDocumento(form.cnpjClinicaContrato).valido ? (
                    <p className="text-[10px] text-red-600 font-medium mt-0.5">
                      {validarDocumento(form.cnpjClinicaContrato).erro}
                    </p>
                  ) : (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {identificarTipoDocumento(form.cnpjClinicaContrato) === 'cpf'
                        ? 'Identificado como CPF: no contrato será qualificado(a) como Cirurgião(ã)-Dentista inscrita(o) no CPF/MF.'
                        : 'Identificado como CNPJ: no contrato será qualificada como Pessoa Jurídica de direito privado.'}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold">Endereço Completo do Consultório / Clínica</Label>
                <Input
                  value={form.enderecoContrato}
                  onChange={(e) => handleChange('enderecoContrato', e.target.value)}
                  placeholder="Ex: JTR - Edificio Espanha - R. Comerc. José Pontes de Magalhães, 70 - Sl 405 - Jatiúca, Maceió - AL, 57036-250"
                  className="h-9 text-xs mt-1"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold">Telefone / WhatsApp Oficial do Contrato</Label>
                  <Input
                    value={form.telefoneContrato}
                    onChange={(e) => handleChange('telefoneContrato', e.target.value)}
                    placeholder="Ex: 82974002213"
                    className="h-9 text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">E-mail Oficial do Contrato</Label>
                  <Input
                    value={form.emailContrato}
                    onChange={(e) => handleChange('emailContrato', e.target.value)}
                    placeholder="Ex: drarosesantosexpert@gmail.com"
                    className="h-9 text-xs mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Responsável Técnico, Foro e Regras Legais */}
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                3. Responsável Técnico, Comarca do Foro e Regras de Mora
              </CardTitle>
              <CardDescription className="text-xs">
                Determina o profissional técnico padrão, a comarca de eleição e percentuais de encargos.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs font-semibold">Cirurgião-Dentista Responsável</Label>
                  <Input
                    value={form.dentistaResponsavelContrato}
                    onChange={(e) => handleChange('dentistaResponsavelContrato', e.target.value)}
                    placeholder="Ex: Dra. Rosangela Santos"
                    className="h-9 text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Número do CRO</Label>
                  <Input
                    value={form.croResponsavelContrato}
                    onChange={(e) => handleChange('croResponsavelContrato', e.target.value)}
                    placeholder="Ex: 06267-AL"
                    className="h-9 text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Comarca / Cidade do Foro (Art. 784 CPC)</Label>
                  <Input
                    value={form.cidadeForoContrato}
                    onChange={(e) => handleChange('cidadeForoContrato', e.target.value)}
                    placeholder="Ex: Maceió - AL"
                    className="h-9 text-xs mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold">Multa por Atraso (%) — CDC Art. 52, § 1º</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    max="10"
                    value={form.multaAtrasoPercentual}
                    onChange={(e) => handleChange('multaAtrasoPercentual', parseFloat(e.target.value) || 0)}
                    className="h-9 text-xs mt-1"
                  />
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Padrão legal recomendado: 2% sobre o montante em atraso.
                  </p>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Juros Moratórios Mensais (%) — CC Art. 406</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    max="10"
                    value={form.jurosMoraPercentual}
                    onChange={(e) => handleChange('jurosMoraPercentual', parseFloat(e.target.value) || 0)}
                    className="h-9 text-xs mt-1"
                  />
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Padrão legal recomendado: 1% ao mês calculado pro rata die.
                  </p>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold">Cláusula Especial Padrão Pré-definida (Opcional)</Label>
                <Textarea
                  value={form.clausulaEspecialPadrao}
                  onChange={(e) => handleChange('clausulaEspecialPadrao', e.target.value)}
                  placeholder="Se desejar, insira aqui regras padrão, prazos de garantia ou condições que devem constar em todos os novos contratos..."
                  rows={3}
                  className="text-xs mt-1"
                />
              </div>

              {/* Assinatura Oficial da Dra. Responsável para Pré-assinatura */}
              <div className="pt-3 border-t border-border/70 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                      <PenTool className="h-3.5 w-3.5 text-emerald-600" />
                      Assinatura Oficial da Dra. Responsável (Rubrica Cadastrada)
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Esta rubrica gráfica será vinculada e aplicada nos contratos emitidos sob sua autorização.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 cursor-pointer"
                      onClick={() => setIsSignatureModalOpen(true)}
                    >
                      <PenTool className="h-3 w-3" />
                      {form.assinaturaPadraoDentista ? 'Redesenhar Assinatura' : 'Desenhar / Upload'}
                    </Button>
                    {form.assinaturaPadraoDentista && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                        onClick={() => {
                          handleChange('assinaturaPadraoDentista', '');
                          if (typeof window !== 'undefined' && window.localStorage) {
                            localStorage.removeItem('assinatura_padrao_dentista');
                          }
                          toast.success('Assinatura restaurada para a rubrica caligráfica vetorial padrão');
                        }}
                      >
                        Restaurar Padrão
                      </Button>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-muted/40 rounded-lg border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-14 w-48 sm:w-56 bg-background rounded-md border border-border/80 flex items-center justify-center p-1 overflow-hidden shrink-0 shadow-xs">
                      <img
                        src={form.assinaturaPadraoDentista || gerarRubricaPadraoDra(form.dentistaResponsavelContrato, form.croResponsavelContrato)}
                        alt="Assinatura Dra. Responsável"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <div className="text-xs space-y-0.5 min-w-0">
                      <div className="font-semibold text-foreground flex flex-wrap items-center gap-1.5 truncate">
                        <span>{form.dentistaResponsavelContrato || 'Dra. Rosangela Santos'}</span>
                        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                          {form.assinaturaPadraoDentista ? 'Rubrica Desenhada' : 'Rubrica Caligráfica Oficial'}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono">
                        CRO: {form.croResponsavelContrato || '06267-AL'} • Pré-assinatura nos contratos
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 4: Autorização Prévia da Profissional para Assinatura Automática */}
          <Card className={`border shadow-sm transition-colors ${
            isAutorizacaoVigente ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-amber-500/40 bg-amber-500/5'
          }`}>
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-1">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldAlert className={`h-4 w-4 ${isAutorizacaoVigente ? 'text-emerald-600' : 'text-amber-600'}`} />
                    4. Autorização Prévia para Assinatura Automática de Contratos
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Exigência legal de consentimento expresso da profissional técnica para emissão automatizada após aprovação do orçamento.
                  </CardDescription>
                </div>
                <div>
                  {carregandoAutorizacao ? (
                    <Badge variant="outline" className="text-xs gap-1 border-muted-foreground/30">
                      <Loader2 className="h-3 w-3 animate-spin" /> Verificando...
                    </Badge>
                  ) : isAutorizacaoVigente ? (
                    <Badge variant="outline" className="text-xs gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      Autorização Vigente
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30">
                      <AlertCircle className="h-3 w-3 text-amber-600" />
                      Pendente / Não Configurada
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="text-xs text-muted-foreground space-y-2">
                {isAutorizacaoVigente ? (
                  <div className="p-3 bg-background/80 rounded-lg border border-emerald-500/20 space-y-2">
                    <div className="flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-300">
                      <UserCheck className="h-4 w-4 text-emerald-600" />
                      <span>{autorizacaoAtiva?.profissionalNome || 'Dra. Rosângela Santos Pereira'} — CRO {autorizacaoAtiva?.profissionalCro || '06267-AL'}</span>
                    </div>
                    <p className="text-[11px] text-foreground/80 leading-relaxed">
                      Autorização formal concedida em{' '}
                      <strong>
                        {autorizacaoAtiva?.autorizadoEm
                          ? new Date(autorizacaoAtiva.autorizadoEm).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Recentemente'}
                      </strong>
                      . Os contratos gerados a partir de orçamentos aprovados receberão automaticamente a assinatura da profissional com validade jurídica.
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] font-semibold text-muted-foreground">Modelos abrangidos:</span>
                      {(autorizacaoAtiva?.modelosAutorizados || ['geral']).map((m) => (
                        <Badge key={m} variant="secondary" className="text-[10px] uppercase font-mono">
                          {m}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-background/80 rounded-lg border border-amber-500/20 space-y-2">
                    <p className="text-foreground/90 leading-relaxed">
                      Atualmente <strong>não há autorização ativa</strong> registrada para emissão automática de assinatura. Todos os novos contratos emitidos precisarão ser assinados manualmente pela Dra. Rosângela antes ou após o envio ao paciente.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {!isAutorizacaoVigente ? (
                  <Button
                    type="button"
                    size="sm"
                    className="text-xs gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                    onClick={() => {
                      setConfirmacaoExpressa(false);
                      setIsAutorizacaoModalOpen(true);
                    }}
                  >
                    <Lock className="h-3.5 w-3.5" />
                    Conceder Autorização Expressa
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-xs gap-1.5"
                      onClick={() => setIsDetalhesAutorizacaoOpen(true)}
                    >
                      <ScrollText className="h-3.5 w-3.5 text-primary" />
                      Ver Termo de Declaração
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-xs gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => setIsRevogarModalOpen(true)}
                    >
                      <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                      Revogar Autorização
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Coluna 3: Pré-visualização em Tempo Real do Box de PIX do Contrato */}
        <div className="space-y-4">
          <Card className="border-border shadow-md sticky top-6">
            <CardHeader className="pb-3 border-b border-border bg-muted/40">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-foreground">
                  <Eye className="h-4 w-4 text-sky-600" />
                  Pré-visualização do Box PIX no Contrato
                </span>
                <Badge variant="outline" className="text-[10px] bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-300">
                  Tempo Real
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Exatamente como o seu paciente verá impresso no PDF e no link digital de assinatura:
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {/* O Box Exato idêntico ao contrato */}
              <div
                style={{
                  border: '1px dashed #0284c7',
                  backgroundColor: '#f0f9ff',
                  borderRadius: '8px',
                  padding: '14px',
                  fontFamily: 'Arial, sans-serif',
                  fontSize: '12px',
                  color: '#0369a1',
                }}
                className="shadow-sm"
              >
                <div
                  style={{
                    fontWeight: 'bold',
                    marginBottom: '8px',
                    textTransform: 'uppercase',
                    fontSize: '10px',
                    letterSpacing: '0.5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  ✦ INSTRUÇÕES E QR CODE OFICIAL PARA PAGAMENTO VIA PIX:
                </div>

                <div className="flex items-start gap-3">
                  <div
                    style={{
                      background: '#ffffff',
                      padding: '4px',
                      border: '1px solid #bae6fd',
                      borderRadius: '6px',
                      textAlign: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={qrCodeUrl}
                      alt="QR Code PIX"
                      style={{ width: '84px', height: '84px', display: 'block' }}
                    />
                    <div
                      style={{
                        fontSize: '8px',
                        color: '#0284c7',
                        fontWeight: 'bold',
                        marginTop: '2px',
                      }}
                    >
                      ESCANEAR PIX
                    </div>
                  </div>

                  <div className="flex-1 space-y-1.5 text-left">
                    <div
                      style={{
                        padding: '6px 10px',
                        backgroundColor: '#ffffff',
                        borderRadius: '4px',
                        border: '1px solid #bae6fd',
                        fontSize: '11px',
                        color: '#0c4a6e',
                        lineHeight: '1.4',
                      }}
                    >
                      <div>
                        <strong>Chave PIX:</strong> {form?.chavePix || 'Chave sob consulta'}
                      </div>
                      <div>
                        <strong>Titular / Favorecido:</strong> {form?.favorecidoPix || 'Dra. Rosangela Santos'}
                        {form?.cnpjCpfFavorecidoPix ? ` • CNPJ/CPF: ${form.cnpjCpfFavorecidoPix}` : ''}
                      </div>
                      {form?.bancoPix && (
                        <div>
                          <strong>Instituição / Banco:</strong> {form.bancoPix}
                        </div>
                      )}
                    </div>

                    <div style={{ fontSize: '10px', color: '#0284c7', lineHeight: '1.3' }}>
                      {form?.instrucoesPix ||
                        'O(A) CONTRATANTE poderá utilizar a câmera do smartphone para leitura do QR Code acima ou efetuar a transferência direta para a chave informada, encaminhando o comprovante para confirmação da baixa da parcela.'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Ações Rápidas de Teste */}
              <div className="pt-2 flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full text-xs gap-1.5"
                  onClick={handleCopiarChave}
                  disabled={!form?.chavePix}
                >
                  {copiouChave ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiouChave ? 'Chave Copiada!' : 'Copiar Chave PIX'}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  className="w-full text-xs gap-1.5 font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={handleSalvar}
                  disabled={salvando}
                >
                  {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Salvar Alterações
                </Button>
              </div>

              <div className="p-3 bg-muted/60 rounded-md border border-border text-[11px] text-muted-foreground space-y-1">
                <div className="font-semibold text-foreground flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  Onde esses dados são aplicados?
                </div>
                <p>• Na Cláusula 3ª de todos os novos contratos gerados;</p>
                <p>• Nos resumos enviados aos pacientes no WhatsApp;</p>
                <p>• Na página pública de assinatura digital mobile do paciente;</p>
                <p>• Nos PDFs impressos e baixados do sistema.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* MODAL 1: Assinatura Gráfica / Rubrica */}
      {isSignatureModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-lg bg-background rounded-xl p-4 shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-150">
            <DigitalSignature
              title="Assinatura Oficial da Dra. Responsável"
              signerName={form.dentistaResponsavelContrato || 'Dra. Rosangela Santos'}
              signerRole="dentista"
              documentType="contrato"
              required={true}
              onSignatureComplete={(sig) => {
                handleChange('assinaturaPadraoDentista', sig.signature);
                if (typeof window !== 'undefined' && window.localStorage) {
                  localStorage.setItem('assinatura_padrao_dentista', sig.signature);
                }
                setIsSignatureModalOpen(false);
                toast.success('Assinatura da Dra. Responsável definida como padrão!');
              }}
              onCancel={() => setIsSignatureModalOpen(false)}
            />
          </div>
        </div>
      )}

      {/* MODAL 2: Concessão de Autorização Expressa */}
      <Dialog open={isAutorizacaoModalOpen} onOpenChange={setIsAutorizacaoModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-foreground">
              <Lock className="h-5 w-5 text-emerald-600" />
              Conceder Autorização para Assinatura Automática
            </DialogTitle>
            <DialogDescription className="text-xs">
              Termo formal de autorização com validade jurídica e registro de auditoria digital.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 bg-muted/50 rounded-lg border text-xs space-y-2 leading-relaxed">
              <p className="font-semibold text-foreground">Declaração da Profissional Responsável:</p>
              <p className="text-muted-foreground italic">
                &ldquo;Eu, <strong>Dra. Rosângela Santos Pereira</strong>, inscrita no CRO-AL sob o nº <strong>06267</strong> e CPF sob o nº <strong>032.663.962-43</strong>, na qualidade de cirurgiã-dentista e responsável técnica, AUTORIZO EXPRESSAMENTE a vinculação e emissão automatizada de minha assinatura eletrônica nos contratos de prestação de serviços odontológicos gerados pelo sistema a partir de orçamentos previamente aprovados pelo paciente.&rdquo;
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Modelos Contratuais Abrangidos:</Label>
              <div className="flex flex-col gap-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={modelosSelecionados.includes('geral')}
                    onCheckedChange={(checked) => {
                      setModelosSelecionados((prev) =>
                        checked ? [...prev, 'geral'] : prev.filter((m) => m !== 'geral')
                      );
                    }}
                  />
                  <span>Contrato Geral de Prestação de Serviços Odontológicos</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={modelosSelecionados.includes('lentes_resina')}
                    onCheckedChange={(checked) => {
                      setModelosSelecionados((prev) =>
                        checked ? [...prev, 'lentes_resina'] : prev.filter((m) => m !== 'lentes_resina')
                      );
                    }}
                  />
                  <span>Contrato Específico: Lentes em Resina Composta e Estética</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={modelosSelecionados.includes('endodontia')}
                    onCheckedChange={(checked) => {
                      setModelosSelecionados((prev) =>
                        checked ? [...prev, 'endodontia'] : prev.filter((m) => m !== 'endodontia')
                      );
                    }}
                  />
                  <span>Contrato Específico: Endodontia e Tratamentos Especializados</span>
                </label>
              </div>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <Checkbox
                  checked={confirmacaoExpressa}
                  onCheckedChange={(checked) => setConfirmacaoExpressa(Boolean(checked))}
                  className="mt-0.5"
                />
                <span className="text-xs text-amber-950 dark:text-amber-200 leading-tight">
                  Confirmo que sou a profissional titular (ou devidamente autorizada por ela) e concedo expressamente a autorização para vinculação da rubrica nos contratos emitidos após aprovação do paciente.
                </span>
              </label>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAutorizacaoModalOpen(false)}
              disabled={processandoAutorizacao}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleConcederAutorizacao}
              disabled={processandoAutorizacao || !confirmacaoExpressa}
            >
              {processandoAutorizacao ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Conceder e Ativar Autorização
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: Visualizar Termo de Declaração */}
      <Dialog open={isDetalhesAutorizacaoOpen} onOpenChange={setIsDetalhesAutorizacaoOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ScrollText className="h-5 w-5 text-primary" />
              Termo de Autorização Vigente
            </DialogTitle>
            <DialogDescription className="text-xs">
              Registro histórico da manifestação de vontade da profissional.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-2 p-2.5 bg-muted/50 rounded-lg text-muted-foreground">
              <div>
                <span className="font-semibold text-foreground">Profissional:</span>{' '}
                {autorizacaoAtiva?.profissionalNome}
              </div>
              <div>
                <span className="font-semibold text-foreground">CRO:</span>{' '}
                {autorizacaoAtiva?.profissionalCro}
              </div>
              <div>
                <span className="font-semibold text-foreground">Documento:</span>{' '}
                {autorizacaoAtiva?.profissionalDocumento}
              </div>
              <div>
                <span className="font-semibold text-foreground">Autorizado em:</span>{' '}
                {autorizacaoAtiva?.autorizadoEm
                  ? new Date(autorizacaoAtiva.autorizadoEm).toLocaleString('pt-BR')
                  : 'N/A'}
              </div>
            </div>

            <div className="p-3 bg-muted/30 rounded-lg border space-y-1">
              <span className="font-semibold text-foreground">Declaração Expressa:</span>
              <p className="text-muted-foreground leading-relaxed italic">
                {autorizacaoAtiva?.autorizacaoExpressa}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setIsDetalhesAutorizacaoOpen(false)}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 4: Revogar Autorização */}
      <Dialog open={isRevogarModalOpen} onOpenChange={setIsRevogarModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-destructive">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Revogar Autorização de Assinatura Automática
            </DialogTitle>
            <DialogDescription className="text-xs">
              A partir da revogação, todos os novos contratos exigirão assinatura manual da Dra. Rosângela.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-semibold">Motivo da Revogação *</Label>
              <Textarea
                value={motivoRevogacao}
                onChange={(e) => setMotivoRevogacao(e.target.value)}
                placeholder="Informe o motivo da revogação para a trilha de auditoria..."
                rows={3}
                className="text-xs mt-1"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsRevogarModalOpen(false)}
              disabled={processandoAutorizacao}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="gap-1.5"
              onClick={handleRevogarAutorizacao}
              disabled={processandoAutorizacao || !motivoRevogacao.trim()}
            >
              {processandoAutorizacao ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
              Confirmar Revogação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConfiguracaoContratoManager;
