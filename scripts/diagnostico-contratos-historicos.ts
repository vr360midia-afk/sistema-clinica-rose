import { createClient } from '@supabase/supabase-js';

// Script de diagnóstico não-destrutivo de contratos e integridade documental
// Modo: SOMENTE LEITURA. Não altera, exclui nem insere registros.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'placeholder';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface DiagnosticoResultado {
  totalContratos: number;
  semIdentificador: number;
  comAssinaturaCorrompidaDataIso: number;
  comAssinaturaGraficaValida: number;
  comPdfGerado: number;
  pdfDesvinculadoDocumentosPaciente: number;
  orcamentosAguardandoSincronizacao: number;
  detalhes: Array<{
    id: string;
    identificador?: string;
    pacienteId?: string;
    anomalias: string[];
  }>;
}

export async function executarDiagnostico(): Promise<DiagnosticoResultado> {
  console.log('================================================================');
  console.log('🔍 INICIANDO DIAGNÓSTICO NÃO-DESTRUTIVO DE CONTRATOS HISTÓRICOS');
  console.log('================================================================');

  const resultado: DiagnosticoResultado = {
    totalContratos: 0,
    semIdentificador: 0,
    comAssinaturaCorrompidaDataIso: 0,
    comAssinaturaGraficaValida: 0,
    comPdfGerado: 0,
    pdfDesvinculadoDocumentosPaciente: 0,
    orcamentosAguardandoSincronizacao: 0,
    detalhes: [],
  };

  try {
    // 1. Busca contratos em documentos_clinicos
    const { data: contratos, error: errContratos } = await supabase
      .from('documentos_clinicos')
      .select('*')
      .eq('tipo', 'contrato')
      .order('criado_em', { ascending: false });

    if (errContratos) {
      console.warn('⚠️ Não foi possível consultar documentos_clinicos:', errContratos.message);
      return resultado;
    }

    resultado.totalContratos = contratos?.length || 0;
    console.log(`📋 Total de contratos encontrados: ${resultado.totalContratos}`);

    // 2. Busca documentos_paciente para verificar vinculação de PDFs
    const { data: docsPaciente } = await supabase
      .from('documentos_paciente')
      .select('id, paciente_id, url, nome');

    const urlsDocumentosPaciente = new Set((docsPaciente || []).map((d) => d.url).filter(Boolean));

    // 3. Analisa cada contrato
    for (const c of contratos || []) {
      const anomalias: string[] = [];
      const identificador = c.identificador || c.itens?.contratoId;

      if (!identificador) {
        resultado.semIdentificador++;
        anomalias.push('Ausência de identificador determinístico CTR-');
      }

      // Validação da assinatura gráfica do paciente
      const sigData = c.assinatura_data || c.itens?.assinaturaPaciente?.assinaturaData;
      const isIsoString = typeof sigData === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(sigData);
      const isBase64Img = typeof sigData === 'string' && sigData.startsWith('data:image/');

      if (isIsoString) {
        resultado.comAssinaturaCorrompidaDataIso++;
        anomalias.push('Assinatura gráfica gravada indevidamente como data ISO (corrompida)');
      } else if (isBase64Img) {
        resultado.comAssinaturaGraficaValida++;
      }

      // Validação de vinculação de PDF
      const pdfPath = c.pdf_path || c.itens?.pdfPath;
      if (pdfPath) {
        resultado.comPdfGerado++;
        if (!urlsDocumentosPaciente.has(pdfPath)) {
          resultado.pdfDesvinculadoDocumentosPaciente++;
          anomalias.push(`PDF existente em storage (${pdfPath}) sem registro correspondente em documentos_paciente`);
        }
      }

      if (anomalias.length > 0) {
        resultado.detalhes.push({
          id: c.id,
          identificador,
          pacienteId: c.paciente_id || c.itens?.pacienteId,
          anomalias,
        });
      }
    }

    // 4. Verifica orçamentos descompassados
    const { data: orcamentos } = await supabase
      .from('orcamentos')
      .select('id, status, contrato_id, assinatura_paciente');

    for (const o of orcamentos || []) {
      const snap = (o.assinatura_paciente || {}) as Record<string, any>;
      const temContrato = o.contrato_id || snap.contratoId;
      const statusContrato = snap.contratoStatus || snap.statusContrato;
      if (temContrato && statusContrato !== 'assinaturas_realizadas') {
        resultado.orcamentosAguardandoSincronizacao++;
      }
    }

    console.log('\n📊 RESUMO DO DIAGNÓSTICO:');
    console.log(`- Total de contratos analisados: ${resultado.totalContratos}`);
    console.log(`- Contratos com assinatura corrompida (data ISO): ${resultado.comAssinaturaCorrompidaDataIso}`);
    console.log(`- Contratos com assinatura gráfica válida: ${resultado.comAssinaturaGraficaValida}`);
    console.log(`- PDFs gerados: ${resultado.comPdfGerado}`);
    console.log(`- PDFs sem vínculo em documentos_paciente: ${resultado.pdfDesvinculadoDocumentosPaciente}`);
    console.log(`- Orçamentos com contrato aguardando reconciliação de status: ${resultado.orcamentosAguardandoSincronizacao}`);
    console.log(`- Total de contratos com anomalias identificadas: ${resultado.detalhes.length}`);
    console.log('================================================================\n');

    return resultado;
  } catch (err: any) {
    console.error('❌ Erro durante execução do diagnóstico:', err.message);
    return resultado;
  }
}

// Execução direta via node/tsx
if (process.argv[1]?.endsWith('diagnostico-contratos-historicos.ts')) {
  executarDiagnostico()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
