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

async function captureEvidences() {
  console.log('🚀 Iniciando captura de evidências visuais...');

  // 1. Obter paciente com tratamento em homologação
  const { data: procs } = await supabase
    .from('tratamentos_procedimentos')
    .select('*, paciente:pacientes(*)')
    .order('criado_em', { ascending: false })
    .limit(1);

  const proc = procs?.[0];
  const pacienteId = proc?.paciente_id;
  console.log('Paciente selecionado para screenshot:', pacienteId, proc?.paciente?.nome);

  // 2. Obter token de confirmação
  let token = '';
  if (fs.existsSync('temp-token-visual.txt')) {
    token = fs.readFileSync('temp-token-visual.txt', 'utf-8').trim();
  }
  if (!token) {
    const { data: confs } = await supabase.from('tratamento_confirmacoes').select('token').eq('status', 'pendente').order('criado_em', { ascending: false }).limit(1);
    token = confs?.[0]?.token || '';
  }

  // 3. Fazer login em homologação
  const authClient = createClient(homologEnv.HOMOLOG_URL, homologEnv.HOMOLOG_SUPABASE_ANON_KEY);
  const { data: loginData, error: loginErr } = await authClient.auth.signInWithPassword({
    email: 'admin-rls-1793901419585@clinicarose-teste.com',
    password: 'PasswordSeguro123!'
  });

  if (loginErr || !loginData.session) {
    console.error('Falha no login de homologação:', loginErr);
    return;
  }

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    defaultViewport: { width: 1440, height: 950 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();

    // 4. Capturar Página Pública de Confirmação Digital
    if (token) {
      console.log(`📸 Capturando página pública de confirmação: /confirmar-sessao/${token}`);
      await page.goto(`http://localhost:4173/confirmar-sessao/${token}`, { waitUntil: 'networkidle0', timeout: 30000 });
      await delay(2500);

      const pathConf = path.join(ARTIFACTS_DIR, 'evidencia-confirmacao-sessao-publica.png');
      await page.screenshot({ path: pathConf, fullPage: true });
      console.log(`✅ Evidência da página pública salva: ${pathConf}`);
    }

    // 5. Injetar sessão de autenticação no app e abrir Detalhes do Paciente -> Aba Etapas
    console.log('🔑 Configurando sessão autenticada no navegador...');
    await page.goto('http://localhost:4173/auth', { waitUntil: 'domcontentloaded' });

    const storageKey = `sb-fsroaymkuopapwlnknhl-auth-token`;
    await page.evaluate((key, session, pId) => {
      localStorage.setItem(key, JSON.stringify(session));
      if (pId) {
        sessionStorage.setItem('dental_ultimo_paciente_id', pId);
        sessionStorage.setItem(`dental_tab_${pId}`, 'tratamentos');
      }
    }, storageKey, loginData.session, pacienteId);

    const targetUrl = pacienteId ? `http://localhost:4173/pacientes?id=${pacienteId}` : 'http://localhost:4173/pacientes';
    console.log(`📸 Navegando diretamente para o prontuário do paciente: ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    await delay(3000);

    // Garantir clique na aba "Etapas do Tratamento" caso não esteja aberta
    const tabs = await page.$$('button[role="tab"]');
    for (const tab of tabs) {
      const text = await page.evaluate(el => el.textContent, tab);
      if (text && text.includes('Etapas')) {
        console.log('🎯 Confirmando foco na aba Etapas do Tratamento...');
        await tab.click();
        await delay(2000);
        break;
      }
    }

    const pathAba = path.join(ARTIFACTS_DIR, 'evidencia-etapas-tratamento-aba-paciente.png');
    await page.screenshot({ path: pathAba, fullPage: true });
    console.log(`✅ Evidência da aba de tratamento salva: ${pathAba}`);

  } catch (err: any) {
    console.error('Erro durante captura:', err);
  } finally {
    await browser.close();
  }
}

captureEvidences().catch(console.error);
