import React from 'react';
import { Lock, CreditCard, DollarSign, Percent, AlertCircle, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { formatMoney } from '@/utils/exportCsv';
import { useMaquinasCartao } from '@/hooks/useMaquinasCartao';
import {
  CondicaoPagamento,
  calcularResumoCartaoCondicao,
  ResumoTaxaCartaoCondicao,
} from '@/utils/orcamentoCondicoes';

interface CardSimulacaoTaxasCartaoProps {
  condicao: Partial<CondicaoPagamento>;
  totalBase: number;
  operadoraIdSelecionada?: string;
  onAlterarOperadora?: (operadoraId: string) => void;
  className?: string;
  mostrarAvisoSeSemCartao?: boolean;
}

export const CardSimulacaoTaxasCartao: React.FC<CardSimulacaoTaxasCartaoProps> = ({
  condicao,
  totalBase,
  operadoraIdSelecionada,
  onAlterarOperadora,
  className = '',
  mostrarAvisoSeSemCartao = false,
}) => {
  const { operadoras, operadoraPadrao } = useMaquinasCartao();

  const condicaoComOp: Partial<CondicaoPagamento> = {
    ...condicao,
    operadoraCartaoId: operadoraIdSelecionada || condicao.operadoraCartaoId,
  };

  const resumo: ResumoTaxaCartaoCondicao = calcularResumoCartaoCondicao(
    condicaoComOp,
    totalBase,
    operadoras,
    operadoraPadrao
  );

  if (!resumo.temCartao) {
    if (!mostrarAvisoSeSemCartao) return null;
    return (
      <div className="p-3 rounded-xl bg-muted/30 border border-border/60 text-xs text-muted-foreground flex items-center gap-2">
        <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
        <span>Esta condição não utiliza cartão de crédito ou débito. Nenhuma taxa de maquininha será aplicada.</span>
      </div>
    );
  }

  const operadorasAtivas = operadoras.filter((op) => op.ativa !== false);
  const operadoraAtualId = resumo.operadoraId;

  return (
    <div
      className={`p-3.5 sm:p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/20 space-y-3 ${className}`}
    >
      {/* Cabeçalho de Confidencialidade */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-500/20 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Lock className="h-4 w-4" />
          </div>
          <div>
            <h5 className="font-bold text-xs text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
              Visão Interna da Clínica — Desconto das Taxas do Cartão
            </h5>
            <p className="text-[10px] text-amber-700/80 dark:text-amber-300/80">
              Simulação confidencial de recebimento líquido no caixa
            </p>
          </div>
        </div>

        <Badge
          variant="outline"
          className="text-[10px] font-bold bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300 gap-1 self-start sm:self-auto shrink-0"
        >
          <ShieldCheck className="h-3 w-3" />
          Somente Interno (O cliente NÃO vê)
        </Badge>
      </div>

      {/* Seletor de Maquininha / Operadora */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-0.5">
        <div className="space-y-1">
          <Label className="text-[11px] font-semibold text-foreground flex items-center gap-1">
            <CreditCard className="h-3.5 w-3.5 text-primary" />
            Maquininha Utilizada:
          </Label>
          <select
            value={operadoraAtualId}
            onChange={(e) => {
              if (onAlterarOperadora) {
                onAlterarOperadora(e.target.value);
              }
            }}
            disabled={!onAlterarOperadora}
            className="w-full h-8 px-2 text-xs font-semibold rounded-md bg-background border border-border text-foreground hover:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {operadorasAtivas.map((op) => (
              <option key={op.id} value={op.id}>
                {op.nome} {op.padrao ? '★ (Padrão)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
            <Percent className="h-3.5 w-3.5 text-muted-foreground" />
            Taxa Total Estimada:
          </Label>
          <div className="h-8 px-2.5 rounded-md bg-background/80 border border-border/80 flex items-center justify-between text-xs">
            <span className="font-semibold text-muted-foreground">{resumo.operadoraNome}</span>
            <span className="font-bold text-amber-600 dark:text-amber-400">
              {resumo.taxaPercentual.toFixed(2)}% (-{formatMoney(resumo.taxaValorTotal)})
            </span>
          </div>
        </div>
      </div>

      {/* Resumo Financeiro Líquido em Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
        <div className="p-2.5 rounded-lg bg-background/90 border border-border/80 space-y-0.5">
          <span className="text-[10px] text-muted-foreground block font-medium">Bruto no Cartão (Cliente):</span>
          <div className="text-sm font-extrabold text-foreground">
            {formatMoney(resumo.valorBrutoCartao)}
          </div>
          <span className="text-[9px] text-muted-foreground">Valor pago pelo paciente</span>
        </div>

        <div className="p-2.5 rounded-lg bg-background/90 border border-rose-500/20 space-y-0.5">
          <span className="text-[10px] text-rose-600 dark:text-rose-400 block font-medium">Desconto das Taxas:</span>
          <div className="text-sm font-extrabold text-rose-600 dark:text-rose-400">
            -{formatMoney(resumo.taxaValorTotal)}
          </div>
          <span className="text-[9px] text-muted-foreground">Retido pela operadora ({resumo.taxaPercentual}%)</span>
        </div>

        <div className="p-2.5 rounded-lg bg-emerald-500/10 dark:bg-emerald-950/30 border border-emerald-500/40 space-y-0.5 shadow-xs">
          <span className="text-[10px] text-emerald-700 dark:text-emerald-300 block font-bold flex items-center gap-1">
            <DollarSign className="h-3 w-3" /> Valor Líquido p/ Clínica:
          </span>
          <div className="text-base font-black text-emerald-600 dark:text-emerald-400">
            {formatMoney(resumo.valorLiquidoTotal)}
          </div>
          {resumo.detalhes ? (
            <span className="text-[9px] text-emerald-700 dark:text-emerald-300 font-semibold block">
              {resumo.detalhes} líquidos
            </span>
          ) : (
            <span className="text-[9px] text-emerald-700 dark:text-emerald-300 font-semibold block">
              Entrada líquida no caixa
            </span>
          )}
        </div>
      </div>

      {/* Nota Explicativa */}
      <div className="text-[10px] text-amber-800/90 dark:text-amber-300/90 flex items-start gap-1.5 pt-0.5 leading-relaxed">
        <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600" />
        <span>
          O paciente visualizará somente o valor comercial acordado ({formatMoney(resumo.valorBrutoCartao)}). O desconto das taxas é visível estritamente para a administração da clínica para conferência de margem e fluxo de caixa.
        </span>
      </div>
    </div>
  );
};

interface BadgeLiquidoInternoCartaoProps {
  condicao: Partial<CondicaoPagamento>;
  totalBase: number;
  className?: string;
}

export const BadgeLiquidoInternoCartao: React.FC<BadgeLiquidoInternoCartaoProps> = ({
  condicao,
  totalBase,
  className = '',
}) => {
  const { operadoras, operadoraPadrao } = useMaquinasCartao();
  const resumo = calcularResumoCartaoCondicao(condicao, totalBase, operadoras, operadoraPadrao);

  if (!resumo.temCartao || resumo.taxaValorTotal <= 0) return null;

  return (
    <div
      className={`px-2 py-1 rounded-md bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/25 text-[10px] text-amber-700 dark:text-amber-300 flex items-center justify-between gap-1.5 ${className}`}
      title={`Cálculo interno confidencial: Valor no cartão ${formatMoney(resumo.valorBrutoCartao)} - taxas (${resumo.taxaPercentual}% via ${resumo.operadoraNome}) = Líquido ${formatMoney(resumo.valorLiquidoTotal)}`}
    >
      <span className="flex items-center gap-1 font-semibold text-amber-800 dark:text-amber-200">
        <Lock className="h-3 w-3 shrink-0" />
        <span>Líquido Clínica:</span>
      </span>
      <span className="font-bold flex items-center gap-1">
        <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">
          {formatMoney(resumo.valorLiquidoTotal)}
        </span>
        <span className="text-[9px] text-muted-foreground font-normal">
          (-{resumo.taxaPercentual}%)
        </span>
      </span>
    </div>
  );
};

export default CardSimulacaoTaxasCartao;
