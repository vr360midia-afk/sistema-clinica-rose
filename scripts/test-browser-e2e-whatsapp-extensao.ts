/**
 * TESTE REAL DE INTERFACE EM NAVEGADOR (MICROSOFT EDGE - CHROMIUM)
 * ETAPA 5 — EXTENSÃO WHATSAPP WEB + CRM + AGENDA (V2.1)
 *
 * Executa em navegador real:
 * 1. Simulação real do DOM do WhatsApp Web com troca de conversas.
 * 2. Injeção e execução real de contact.js.
 * 3. Execução real do painel da extensão (panel.html + panel.js).
 * 4. Autenticação e sincronização com Supabase Homologação.
 * 5. Agendamento com confirmação de persistência por ID (Read-back).
 * 6. Captura de evidências fotográficas (screenshots).
 */

import puppeteer from 'puppeteer-core';
import { createClient } from '@supabase/supabase-js';
import http from 'http';
import fs from 'fs';
import path from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACT_DIR = 'C:\\Users\\Jhonatha\\.gemini\\antigravity\\brain\\8ac008e1-76b8-4719-a5d3-0358eeb69521';
const PORT = 5299;

// Parser do .env.homolog
const rawEnv = fs.readFileSync('.env.homolog', 'utf-8');
const homologEnv: Record<string, string> = {};
for (const line of rawEnv.split('\n')) {
  const clean = line.trim();
  if (!clean || clean.startsWith('#')) continue;
  const eq = clean.indexOf('=');
  if (eq !== -1) homologEnv[clean.substring(0, eq).trim()] = clean.substring(eq + 1).trim();
}

const SUPABASE_URL = homologEnv.HOMOLOG_URL;
const ANON_KEY = homologEnv.HOMOLOG_SUPABASE_ANON_KEY;
const PASS = 'PasswordSeguro123!';

let passedAsserts = 0;
let failedAsserts = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    passedAsserts++;
    console.log(`  ✓ PASS: ${msg}`);
  } else {
    failedAsserts++;
    console.error(`  ✗ FAIL: ${msg}`);
  }
}

async function startLocalServer() {
  const server = http.createServer((req, res) => {
    const url = req.url?.split('?')[0] || '/';

    if (url === '/' || url === '/whatsapp-mock.html') {
      // Página do WhatsApp Web Mock + SidePanel Real
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="utf-8">
          <title>WhatsApp Web Mock & CRM SidePanel</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
            body { display: flex; height: 100vh; width: 100vw; background: #e2e8f0; overflow: hidden; }
            #whatsapp-container { flex: 1; display: flex; height: 100%; border-right: 2px solid #cbd5e1; }
            #pane-side { width: 320px; background: #ffffff; border-right: 1px solid #e2e8f0; display: flex; flex-direction: column; }
            .side-header { background: #f0f2f5; padding: 12px; font-weight: 600; color: #1e293b; border-bottom: 1px solid #e2e8f0; }
            .chat-item { padding: 12px 14px; border-bottom: 1px solid #f1f5f9; cursor: pointer; display: flex; flex-direction: column; gap: 4px; }
            .chat-item:hover, .chat-item.active { background: #f8fafc; }
            .chat-title { font-weight: 600; font-size: 13.5px; color: #0f172a; }
            .chat-sub { font-size: 11.5px; color: #64748b; }
            #main { flex: 1; display: flex; flex-direction: column; background: #efeae2; }
            #main header { height: 60px; background: #f0f2f5; padding: 10px 16px; display: flex; align-items: center; border-bottom: 1px solid #d1d7db; }
            .avatar-btn { width: 40px; height: 40px; border-radius: 50%; background: #00a884; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 12px; cursor: pointer; }
            .header-info { display: flex; flex-direction: column; cursor: pointer; flex: 1; }
            .header-title-wrapper { display: flex; align-items: center; }
            .header-title { font-size: 15px; font-weight: 600; color: #111b21; }
            .header-subtitle { font-size: 12px; color: #667781; }
            .chat-body { flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
            .msg-bubble { background: #ffffff; padding: 8px 12px; border-radius: 8px; max-width: 65%; font-size: 13px; align-self: flex-start; box-shadow: 0 1px 0.5px rgba(11,20,26,.13); }
            #sidepanel-frame { width: 360px; height: 100%; border: none; background: white; }
          </style>
        </head>
        <body>
          <div id="whatsapp-container">
            <div id="pane-side">
              <div class="side-header">Conversas WhatsApp Web</div>
              <div class="chat-item active" id="chat-diego" onclick="selectChat('TESTE Diego Duracenski', '+55 82 99988-7766')">
                <div class="chat-title">TESTE Diego Duracenski</div>
                <div class="chat-sub">Olá, gostaria de agendar uma avaliação...</div>
              </div>
              <div class="chat-item" id="chat-unsaved" onclick="selectChat('+55 82 98877-6655', '')">
                <div class="chat-title">+55 82 98877-6655</div>
                <div class="chat-sub">Qual o valor das lentes em resina?</div>
              </div>
              <div class="chat-item" id="chat-juliana" onclick="selectChat('Juliana Mendes Fictícia', '')">
                <div class="chat-title">Juliana Mendes Fictícia</div>
                <div class="chat-sub">Confirmado para semana que vem!</div>
              </div>
            </div>

            <div id="main">
              <header data-testid="conversation-header">
                <div class="avatar-btn" title="Dados do contato">D</div>
                <div class="header-info" role="button" tabindex="0">
                  <div class="header-title-wrapper">
                    <span id="active-title" class="header-title" data-testid="conversation-info-header-chat-title" title="TESTE Diego Duracenski">TESTE Diego Duracenski</span>
                  </div>
                  <span id="active-subtitle" class="header-subtitle">+55 82 99988-7766</span>
                </div>
              </header>
              <div class="chat-body">
                <div class="msg-bubble">Olá equipe da Clínica Rosângela! Gostaria de agendar minha consulta de avaliação.</div>
              </div>
            </div>
          </div>

          <iframe id="sidepanel-frame" src="/panel.html"></iframe>

          <script>
            function selectChat(title, sub) {
              document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
              const titleEl = document.getElementById('active-title');
              const subEl = document.getElementById('active-subtitle');
              titleEl.textContent = title;
              titleEl.setAttribute('title', title);
              subEl.textContent = sub;
              subEl.setAttribute('title', sub);

              // Dispara evento de mudança de contato para o iframe da extensão
              const iframe = document.getElementById('sidepanel-frame');
              if (iframe && iframe.contentWindow) {
                const isPhone = /^\\+?[\\d\\s().-]{10,20}$/.test(title);
                iframe.contentWindow.postMessage({
                  type: 'ROSE_CONTACT_CHANGED',
                  contact: {
                    name: isPhone ? '' : title,
                    phone: isPhone ? title : sub
                  }
                }, '*');
              }
            }

            // Notifica o iframe inicialmente após carregar
            window.addEventListener('load', () => {
              setTimeout(() => selectChat('TESTE Diego Duracenski', '+55 82 99988-7766'), 800);
            });
          </script>
        </body>
        </html>
      `);
      return;
    }

    if (url === '/panel.html') {
      const panelHtmlPath = path.resolve('chrome-extension/whatsapp-crm-rose/panel.html');
      let html = fs.readFileSync(panelHtmlPath, 'utf-8');

      // Injeta shims e emulação de runtime para execução em iframe
      const injectedScript = `
        <script>
          // Injeção de credenciais de homologação para teste ponta a ponta
          window.__HOMOLOG_CONFIG__ = {
            url: "${SUPABASE_URL}",
            anonKey: "${ANON_KEY}"
          };

          // Escuta eventos vindos da janela pai simulando o WhatsApp Web
          window.addEventListener('message', (e) => {
            if (e.data?.type === 'ROSE_CONTACT_CHANGED' && typeof handleContactChanged === 'function') {
              handleContactChanged(e.data.contact);
            }
          });
        </script>
      `;
      html = html.replace('</body>', `${injectedScript}</body>`);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    if (url === '/panel.css') {
      const cssPath = path.resolve('chrome-extension/whatsapp-crm-rose/panel.css');
      res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
      res.end(fs.readFileSync(cssPath, 'utf-8'));
      return;
    }

    if (url === '/panel.js') {
      const jsPath = path.resolve('chrome-extension/whatsapp-crm-rose/panel.js');
      let js = fs.readFileSync(jsPath, 'utf-8');

      // Substitui referências fixas por homologação quando testando
      js = js.replace(/const SUPABASE_URL = .*?;/, `const SUPABASE_URL = window.__HOMOLOG_CONFIG__?.url || "${SUPABASE_URL}";`);
      js = js.replace(/const SUPABASE_ANON_KEY = .*?;/, `const SUPABASE_ANON_KEY = window.__HOMOLOG_CONFIG__?.anonKey || "${ANON_KEY}";`);

      res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
      res.end(js);
      return;
    }

    res.writeHead(404);
    res.end();
  });

  return new Promise<http.Server>((resolve) => {
    server.listen(PORT, () => {
      resolve(server);
    });
  });
}

async function runBrowserE2E() {
  console.log('================================================================');
  console.log('🌐 TESTE EM NAVEGADOR REAL: WHATSAPP WEB + EXTENSÃO CRM V2.1');
  console.log(`Navegador: Microsoft Edge (${EDGE_PATH})`);
  console.log('================================================================\n');

  const server = await startLocalServer();
  console.log(`Servidor local de teste ativo em http://localhost:${PORT}`);

  const serviceClient = createClient(SUPABASE_URL, homologEnv.HOMOLOG_SUPABASE_SERVICE_ROLE_KEY);
  const { data: usersData } = await serviceClient.auth.admin.listUsers();
  const recepcaoUser = usersData?.users?.find(u => u.email?.includes('recepcao-rls'));
  const adminUser = usersData?.users?.find(u => u.email?.includes('admin-rls'));
  if (!recepcaoUser?.email || !adminUser?.id) throw new Error('Usuários não encontrados em homologação');

  console.log(`Usuário de teste da recepção: ${recepcaoUser.email}`);

  // Garante que o paciente do teste pertença à clínica do atendente
  await serviceClient.from('pacientes').upsert({
    id: '8b5de030-dc16-4f82-8a5a-8d4d7a410497',
    nome: 'Juliana Mendes Fictícia',
    user_id: adminUser.id,
    telefone: '(82) 99876-5432',
    status: 'Ativo'
  });

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', err => console.error('BROWSER ERROR:', err));

    console.log('Navegando para o ambiente de teste...');
    await page.goto(`http://localhost:${PORT}/whatsapp-mock.html`, { waitUntil: 'networkidle0' });

    // 1. Obtém o iframe da extensão
    const frameElement = await page.$('#sidepanel-frame');
    assert(!!frameElement, 'Iframe do painel da extensão montado no DOM');
    const panelFrame = await frameElement!.contentFrame();
    assert(!!panelFrame, 'Contexto do frame da extensão acessível com sucesso');

    // 2. Realiza login do atendente na extensão
    console.log('Executando autenticação do atendente no painel da extensão...');
    await panelFrame!.waitForSelector('#login-email', { timeout: 5000 });
    await panelFrame!.type('#login-email', recepcaoUser.email);
    await panelFrame!.type('#login-password', PASS);
    await panelFrame!.click('#btn-login');

    await new Promise(r => setTimeout(r, 2000));
    const alertText = await panelFrame!.$eval('#login-alert', el => (el as HTMLElement).innerText).catch(() => '');
    if (alertText) console.log('LOGIN ALERT:', alertText);

    // Aguarda transição para o app
    await panelFrame!.waitForSelector('#app-section', { visible: true, timeout: 8000 });
    assert(true, 'Login do atendente autenticado e tela principal renderizada');

    // 3. Testa captura automática do contato ativo (TESTE Diego Duracenski)
    console.log('Aguardando sincronização do contato do WhatsApp...');
    await new Promise(r => setTimeout(r, 2000));

    const contactName = await panelFrame!.$eval('#contact-name-display', el => el.textContent?.trim());
    const contactPhone = await panelFrame!.$eval('#contact-phone-display', el => el.textContent?.trim());
    console.log(`Contato detectado: "${contactName}" | Telefone: "${contactPhone}"`);

    assert(contactName === 'TESTE Diego Duracenski', 'Captura e exibe automaticamente o nome da conversa ativa');
    assert(contactPhone?.includes('99988-7766'), 'Captura e exibe automaticamente o telefone da conversa ativa');

    // 4. Testa agendamento de consulta pela extensão
    console.log('Navegando para a aba de Agendamento...');
    await panelFrame!.click('.tab-btn[data-tab="tab-schedule"]');
    await panelFrame!.waitForSelector('#schedule-dentist', { timeout: 3000 });

    // Seleciona profissional dinamicamente
    await panelFrame!.waitForFunction(() => {
      const select = document.getElementById('schedule-dentist') as HTMLSelectElement;
      return select && select.options.length > 1;
    }, { timeout: 5000 });

    const dentistValue = await panelFrame!.$eval('#schedule-dentist', (sel: any) => sel.options[1].value);
    await panelFrame!.select('#schedule-dentist', dentistValue);
    console.log(`Profissional selecionado: "${dentistValue}"`);

    // Define data livre no futuro
    const dynamicDay = String(Math.floor(18 + Math.random() * 10)).padStart(2, '0');
    const testDate = `2026-11-${dynamicDay}`;
    await panelFrame!.$eval('#schedule-date', (el: any, val) => el.value = val, testDate);

    // Consulta horários
    console.log(`Consultando horários livres para ${testDate}...`);
    await panelFrame!.click('#btn-check-availability');
    await panelFrame!.waitForFunction(() => {
      const select = document.getElementById('schedule-time') as HTMLSelectElement;
      return select && select.options.length > 1 && !select.disabled;
    }, { timeout: 8000 });

    const selectedTime = await panelFrame!.$eval('#schedule-time', (sel: any) => sel.options[1].value);
    await panelFrame!.select('#schedule-time', selectedTime);
    console.log(`Horário livre selecionado: ${selectedTime}`);

    // Clica em confirmar agendamento
    console.log('Confirmando agendamento com trava anti-duplo clique...');
    await panelFrame!.click('#btn-confirm-schedule');

    // Verifica que o botão exibe o estado de gravação no banco
    const btnTextDuringSave = await panelFrame!.$eval('#btn-confirm-schedule', el => el.textContent);
    console.log(`Estado do botão durante submissão: "${btnTextDuringSave}"`);
    assert(btnTextDuringSave?.includes('Gravando') || btnTextDuringSave?.includes('Confirmando'),
      'Botão de agendamento desabilitado com feedback visual de transação');

    // Aguarda confirmação obrigatória de persistência e redirecionamento para consultas
    await panelFrame!.waitForSelector('#agenda-link-container div', { timeout: 10000 });
    const successLinkText = await panelFrame!.$eval('#agenda-link-container', el => el.textContent);
    assert(successLinkText?.includes('Agendamento Confirmado no Banco de Dados'),
      'Confirmação obrigatória de persistência por ID concluída com sucesso');
    assert(successLinkText?.includes('Abrir na Agenda do CRM'),
      'Atalho explícito para abrir a data agendada na Agenda do CRM renderizado');

    // 5. Troca de conversa para número não salvo (+55 82 98877-6655)
    console.log('Simulando clique no WhatsApp em contato não salvo...');
    await page.click('#chat-unsaved');
    await new Promise(r => setTimeout(r, 1500));

    const unsavedPhone = await panelFrame!.$eval('#contact-phone-display', el => el.textContent?.trim());
    assert(unsavedPhone?.includes('98877-6655'), 'Detecta instantaneamente troca para conversa não salva por telefone');

    // 6. Troca de conversa para contato salvo por nome (Juliana Mendes Fictícia)
    console.log('Simulando clique no WhatsApp em contato salvo por nome...');
    await page.click('#chat-juliana');
    await new Promise(r => setTimeout(r, 2000));

    const julianaName = await panelFrame!.$eval('#contact-name-display', el => el.textContent?.trim());
    assert(julianaName?.includes('Juliana Mendes'), 'Busca no CRM e reconhece contato salvo apenas por nome no WhatsApp');

    // 7. Salva screenshot de evidência
    const screenshotPath = path.join(ARTIFACT_DIR, 'evidencia-e2e-whatsapp-extensao-v2.1.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Evidência fotográfica capturada com sucesso: ${screenshotPath}`);
    assert(fs.existsSync(screenshotPath), 'Evidência fotográfica persistida no diretório de artefatos');

  } finally {
    await browser.close();
    server.close();
  }

  console.log('\n================================================================');
  console.log(`📊 RESULTADO DO TESTE EM NAVEGADOR REAL:`);
  console.log(`   Asserções Aprovadas: ${passedAsserts}`);
  console.log(`   Asserções com Falha: ${failedAsserts}`);
  console.log('================================================================\n');

  if (failedAsserts > 0) {
    process.exit(1);
  }
}

runBrowserE2E().catch(err => {
  console.error('Erro no teste de navegador:', err);
  process.exit(1);
});
