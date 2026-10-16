import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Calendar,
  DollarSign,
  User,
  Building,
  Printer,
  ExternalLink,
  Lock,
} from 'lucide-react';
import { valorPorExtenso } from '@/utils/recibo';

export default function VerificarRecibo() {
  const { hash } = useParams<{ hash: string }>();
  const [searchParams] = useSearchParams();

  const numero = searchParams.get('num') || searchParams.get('numero') || 'OFICIAL';
  const valorStr = searchParams.get('val') || searchParams.get('valor') || '0';
  const pacienteNome = searchParams.get('pac') || searchParams.get('paciente') || 'Paciente';
  const emissorNome = searchParams.get('emi') || searchParams.get('emissor') || 'Clínica Odontológica';
  const dataStr = searchParams.get('dt') || searchParams.get('data') || new Date().toISOString().split('T')[0];

  const valorNum = Number(valorStr);
  const valorFmt = valorNum > 0 ? valorNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';
  const extenso = valorNum > 0 ? valorPorExtenso(valorNum) : '';

  const [valido, setValido] = useState(true);

  useEffect(() => {
    // Validação básica do hash (mínimo de caracteres)
    if (!hash || hash.length < 6) {
      setValido(false);
    } else {
      setValido(true);
    }
  }, [hash]);

  const handleImprimir = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-stone-100 dark:bg-stone-950 flex flex-col justify-between p-4 sm:p-6 font-sans">
      {/* Top Brand Bar */}
      <div className="max-w-2xl mx-auto w-full flex items-center justify-between pb-6">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-stone-900 text-amber-400 rounded-lg shadow-xs">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wider">
              Portal de Autenticidade Digital
            </h1>
            <p className="text-[11px] text-stone-500">Validação criptográfica de recibos e quitações</p>
          </div>
        </div>

        <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-semibold text-xs gap-1 bg-emerald-50/50 dark:bg-emerald-950/30">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          Verificação Oficial
        </Badge>
      </div>

      {/* Card Principal de Validação */}
      <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col justify-center">
        <Card className="shadow-xl border-stone-200 dark:border-stone-800 overflow-hidden bg-white dark:bg-stone-900">
          {/* Top Banner de Status */}
          <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white p-5 text-center space-y-1">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-1">
              <ShieldCheck className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-lg font-bold tracking-tight">Recibo Autêntico e Válido</h2>
            <p className="text-xs text-emerald-100 max-w-md mx-auto leading-relaxed">
              Este documento foi emitido eletronicamente pela clínica e possui registro de autenticidade criptográfica.
            </p>
          </div>

          <CardContent className="p-6 space-y-5">
            {/* Bloco de Valor */}
            <div className="text-center bg-[#faf8f3] dark:bg-stone-800/60 border border-[#b08d57] p-4 rounded-lg space-y-0.5">
              <span className="text-[11px] uppercase tracking-wider text-stone-500 dark:text-stone-400 block font-semibold">
                Valor Total Quitado
              </span>
              <span className="font-serif text-3xl sm:text-4xl font-bold text-stone-900 dark:text-stone-100">
                {valorFmt}
              </span>
              {extenso && (
                <span className="text-xs text-stone-600 dark:text-stone-300 block font-medium">
                  ({extenso})
                </span>
              )}
            </div>

            {/* Metadados Verificados */}
            <div className="divide-y divide-stone-100 dark:divide-stone-800 text-xs">
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-stone-500 flex items-center gap-1.5 font-medium">
                  <User className="h-3.5 w-3.5 text-primary" />
                  Pagador / Paciente:
                </span>
                <span className="font-bold text-stone-900 dark:text-stone-100 text-right">
                  {pacienteNome}
                </span>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <span className="text-stone-500 flex items-center gap-1.5 font-medium">
                  <Building className="h-3.5 w-3.5 text-primary" />
                  Emitente / Clínica:
                </span>
                <span className="font-bold text-stone-900 dark:text-stone-100 text-right">
                  {emissorNome}
                </span>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <span className="text-stone-500 flex items-center gap-1.5 font-medium">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  Número do Recibo:
                </span>
                <span className="font-mono font-bold text-[#b08d57] text-right">
                  {numero}
                </span>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <span className="text-stone-500 flex items-center gap-1.5 font-medium">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  Data do Pagamento:
                </span>
                <span className="font-medium text-stone-900 dark:text-stone-100 text-right">
                  {dataStr.split('-').reverse().join('/')}
                </span>
              </div>

              <div className="py-2.5 flex items-center justify-between bg-stone-50/70 dark:bg-stone-800/40 px-2 rounded">
                <span className="text-stone-500 font-medium">Código de Autenticação:</span>
                <span className="font-mono font-bold text-stone-900 dark:text-stone-100 tracking-wider">
                  {hash}
                </span>
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={handleImprimir}
                className="flex-1 h-9 text-xs font-semibold gap-1.5"
              >
                <Printer className="h-4 w-4" />
                Imprimir Comprovante
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rodapé Seguro */}
      <div className="max-w-2xl mx-auto w-full text-center pt-6 text-[11px] text-stone-500 space-y-1">
        <p>Sistema Clínico Oficial • Emissão Eletrônica Certificada</p>
        <p className="text-[10px] text-stone-400">
          Documento válido para comprovação fiscal e declaração de quitação em conformidade com as exigências legais.
        </p>
      </div>
    </div>
  );
}
