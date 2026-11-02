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
import { identificarTipoDocumento } from '@/utils/documentoFormat';
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

  // Estados específicos para a configuração administrativa:
  // "Autorizar assinatura automática em contratos aprovados"
  const [isAutorizacaoModalOpen, setIsAutorizacaoModalOpen] = useState(false);
  const [isDetalhesAutorizacaoOpen, setIsDetalhesAutorizacaoOpen] = useState(false);
  const [isRevogarModalOpen, setIsRevogarModalOpen] = useState(false);
  const [processandoAutorizacao, setProcessandoAutorizacao] = useState(false);
  const [modelosSelecionados, setModelosSelecionados] = useState<string[]>(['geral', 'lentes_resina', 'endodontia']);
  const [confirmacaoExpressa, setConfirmacaoExpressa] = useState(false);
  const [motivoRevogacao, setMotivoRevogacao] = useState('Revogação expressa realizada pela profissional no painel administrativo');
  const [rubricaTemp, setRubricaTemp] = useState<string>('');

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
