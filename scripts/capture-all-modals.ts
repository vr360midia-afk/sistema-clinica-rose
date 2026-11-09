import puppeteer from 'puppeteer-core';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACTS_DIR = 'C:\\Users\\Jhonatha\\.gemini\\antigravity\\brain\\8ac008e1-76b8-4719-a5d3-0358eeb69521';

// Carregar credenciais de homologação
const rawEnv = fs.readFileSync('.env.homolog', 'utf-8');
const homologEnv: Record<string, string> = {};
for (const line of rawEnv.split('\n')) {
  const clean = line.trim();
  if (!clean || clean.startsWith('#')) continue;
  const eq = clean.indexOf('=');
  if (eq !== -1) {
    homologEnv[clean.substring(0, eq).trim()] = clean.substring(eq + 1).trim();
  }
}

const supabase = createClient(homologEnv.HOMOLOG_URL, homologEnv.HOMOLOG_SERVICE_ROLE_KEY || homologEnv.HOMOLOG_SUPABASE_SERVICE_ROLE_KEY);
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function captureAllModals() {
  console.log('🚀 Iniciando captura completa de telas e modais...');

  // 1. Obter paciente com procedimento e sessões em homologação
  const { data: procs } = await supabase
    .from('tratamentos_procedimentos')
    .select('*, paciente:pacientes(*)')
    .order('criado_em', { ascending: false })
    .limit(1);

  const proc = procs?.[0];
  const pacienteId = proc?.paciente_id;
  console.log('Paciente alvo:', pacienteId, proc?.paciente?.nome);

  // Garantir que exista ao menos uma sessão agendada para capturar os botões Realizada e Remarcar
  await supabase.from('tratamento_sessoes').insert({
    clinica_id: proc.clinica_id,
    paciente_id: pacienteId,
    tratamento_procedimento_id: proc.id,
    numero_sessao: 5,
    nome_objetivo: 'Sessão 5 — Revisão Periódica e Polimento Complementar',
    data_prevista: new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0],
    profissional_id: proc.profissional_responsavel_id || '537fb718-8c0e-4776-b435-8a6f4315bd0b',
    profissional_nome: 'Dra. Rosângela Santos Pereira',
    status: 'agendada'
  });

  // 2. Obter token de confirmação válido
  let token = '';
  const { data: confs } = await supabase
    .from('tratamento_confirmacoes')
    .select('token')
    .eq('status', 'pendente')
    .order('criado_em', { ascending: false })
    .limit(1);
  token = confs?.[0]?.token || '';

  // 3. Fazer login em homologação
  const authClient = createClient(homologEnv.HOMOLOG_URL, homologEnv.HOMOLOG_SUPABASE_ANON_KEY);
  const { data: loginData, error: loginErr } = await authClient.auth.signInWithPassword({
    email: 'admin-rls-1793901419585@clinicarose-teste.com',
    password: 'PasswordSeguro123!'
  });

  if (loginErr || !loginData.session) {
    throw new Error('Falha no login: ' + loginErr?.message);
  }

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    defaultViewport: { width: 1440, height: 1000 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();

    // -------------------------------------------------------------------------
    // CAPTURA 4: Página Pública de Confirmação Digital
    // -------------------------------------------------------------------------
    if (token) {
      console.log(`📸 1/5 Capturando Confirmação Pública: /confirmar-sessao/${token}`);
      await page.goto(`http://localhost:4173/confirmar-sessao/${token}`, { waitUntil: 'networkidle0', timeout: 30000 });
      await delay(2000);
      const file4 = path.join(ARTIFACTS_DIR, 'evidencia-4-confirmacao-publica.png');
      await page.screenshot({ path: file4, fullPage: true });
      console.log('✅ Salvo:', file4);
    }

    // -------------------------------------------------------------------------
    // CAPTURA 1: Prontuário do Paciente — Aba Etapas do Tratamento
    // -------------------------------------------------------------------------
    console.log('🔑 Autenticando e abrindo prontuário...');
    await page.goto('http://localhost:4173/auth', { waitUntil: 'domcontentloaded' });
    const storageKey = `sb-fsroaymkuopapwlnknhl-auth-token`;
    await page.evaluate((key, session, pId) => {
      localStorage.setItem(key, JSON.stringify(session));
      if (pId) {
        sessionStorage.setItem('dental_ultimo_paciente_id', pId);
        sessionStorage.setItem(`dental_tab_${pId}`, 'tratamentos');
      }
    }, storageKey, loginData.session, pacienteId);

    const targetUrl = `http://localhost:4173/pacientes?id=${pacienteId}`;
    await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    await delay(3000);

    // Garantir foco na aba Etapas
    const tabs = await page.$$('button[role="tab"]');
    for (const tab of tabs) {
      const text = await page.evaluate(el => el.textContent, tab);
      if (text && text.includes('Etapas')) {
        await tab.click();
        await delay(2000);
        break;
      }
    }

    console.log('📸 2/5 Capturando Aba Etapas do Tratamento...');
    const file1 = path.join(ARTIFACTS_DIR, 'evidencia-1-etapas-prontuario.png');
    await page.screenshot({ path: file1, fullPage: true });
    console.log('✅ Salvo:', file1);

    // -------------------------------------------------------------------------
    // CAPTURA 2: Modal Cadastro de Nova Sessão
    // -------------------------------------------------------------------------
    console.log('📸 3/5 Abrindo modal "Adicionar Sessão"...');
    const buttons = await page.$$('button');
    let btnAddSessao = null;
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text && text.trim() === 'Sessão') {
        btnAddSessao = btn;
        break;
      }
    }

    if (btnAddSessao) {
      await btnAddSessao.click();
      await delay(1500);
      const file2 = path.join(ARTIFACTS_DIR, 'evidencia-2-modal-cadastro-sessao.png');
      await page.screenshot({ path: file2, fullPage: false });
      console.log('✅ Salvo:', file2);
    }

    // -------------------------------------------------------------------------
    // CAPTURA 3: Modal Reagendamento de Sessão
    // -------------------------------------------------------------------------
    console.log('📸 4/5 Abrindo modal "Reagendar Sessão"...');
    await page.goto(targetUrl, { waitUntil: 'networkidle0' });
    await delay(2000);

    let btnRemarcar = null;
    const allBtns = await page.$$('button');
    for (const btn of allBtns) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text && text.includes('Remarcar')) {
        btnRemarcar = btn;
        break;
      }
    }

    if (btnRemarcar) {
      await btnRemarcar.click();
      await delay(1500);
      const file3 = path.join(ARTIFACTS_DIR, 'evidencia-3-modal-reagendamento.png');
      await page.screenshot({ path: file3, fullPage: false });
      console.log('✅ Salvo:', file3);
    }

    // -------------------------------------------------------------------------
    // CAPTURA 5: Modal Registrar Atendimento Realizado
    // -------------------------------------------------------------------------
    console.log('📸 5/5 Abrindo modal "Registrar Atendimento Realizado"...');
    await page.goto(targetUrl, { waitUntil: 'networkidle0' });
    await delay(2000);

    let btnRealizada = null;
    const currentBtns = await page.$$('button');
    for (const btn of currentBtns) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text && text.includes('Realizada')) {
        btnRealizada = btn;
        break;
      }
    }

    if (btnRealizada) {
      await btnRealizada.click();
      await delay(1500);
      const file5 = path.join(ARTIFACTS_DIR, 'evidencia-5-modal-marcar-realizada.png');
      await page.screenshot({ path: file5, fullPage: false });
      console.log('✅ Salvo:', file5);
    }

    console.log('\n🎉 Todas as 5 evidências visuais capturadas com sucesso!');

  } catch (err) {
    console.error('Erro na captura:', err);
  } finally {
    await browser.close();
  }
}

captureAllModals().catch(console.error);
