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
} from 'lucide-react';
import { toast } from 'sonner';
import { useConfiguracoesContrato, ConfiguracoesContrato, carregarConfiguracoesContratoSync } from '@/hooks/useConfiguracoesContrato';
import { identificarTipoDocumento } from '@/utils/documentoFormat';
import DigitalSignature from '@/components/signature/DigitalSignature';
import { gerarRubricaPadraoDra } from '@/utils/contratoEngine';

export const ConfiguracaoContratoManager: React.FC = () => {
  const { configContrato, salvarConfiguracoesContrato, restaurarPadrao, loading, salvando } =
    useConfiguracoesContrato();

  const [form, setForm] = useState<ConfiguracoesContrato>(() => configContrato || carregarConfiguracoesContratoSync());
  const [copiouChave, setCopiouChave] = useState(false);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);

  useEffect(() => {
    if (configContrato) {
      setForm(configContrato);
    }
  }, [configContrato]);

  const handleChange = (campo: keyof ConfiguracoesContrato, valor: any) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  };

  const handleSalvar = async () => {
    if (form) {
      await salvarConfiguracoesContrato(form);
    }
  };

  const handleCopiarChave = () => {
    if (!form?.chavePix) return;
    navigator.clipboard.writeText(form?.chavePix || '');
    setCopiouChave(true);
    toast.success('Chave PIX copiada para a área de transferência!');
    setTimeout(() => setCopiouChave(false), 2000);
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
                    {form.cnpjCpfFavorecidoPix && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        {identificarTipoDocumento(form.cnpjCpfFavorecidoPix) === 'cpf' ? 'CPF' : 'CNPJ'}
                      </span>
                    )}
                  </div>
                  <Input
                    value={form.cnpjCpfFavorecidoPix}
                    onChange={(e) => handleChange('cnpjCpfFavorecidoPix', e.target.value)}
                    placeholder="Ex: 032.663.962-43"
                    className="h-9 text-xs mt-1 font-mono"
                  />
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
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      {identificarTipoDocumento(form.cnpjClinicaContrato) === 'cpf' ? 'CPF (Pessoa Física)' : 'CNPJ (Pessoa Jurídica)'}
                    </span>
                  </div>
                  <Input
                    value={form.cnpjClinicaContrato}
                    onChange={(e) => handleChange('cnpjClinicaContrato', e.target.value)}
                    placeholder="Ex: 032.663.962-43 ou 00.000.000/0001-00"
                    className="h-9 text-xs mt-1 font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {identificarTipoDocumento(form.cnpjClinicaContrato) === 'cpf'
                      ? 'Identificado como CPF: no contrato será qualificado(a) como Cirurgião(ã)-Dentista inscrita(o) no CPF/MF.'
                      : 'Identificado como CNPJ: no contrato será qualificada como Pessoa Jurídica de direito privado.'}
                  </p>
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

              {/* Assinatura Oficial da Dra. Responsável para Pré-assinatura Automática */}
              <div className="pt-3 border-t border-border/70 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                      <PenTool className="h-3.5 w-3.5 text-emerald-600" />
                      Assinatura Oficial da Dra. Responsável (Pré-emitida nos Contratos)
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Todos os novos contratos já são emitidos e disponibilizados com esta assinatura aplicada pela Contratada.
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
                        CRO: {form.croResponsavelContrato || '06267-AL'} • Pré-assinatura ativa na emissão
                      </div>
                    </div>
                  </div>
                </div>
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
    </div>
  );
};

export default ConfiguracaoContratoManager;
