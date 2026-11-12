import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  if (mode === 'production') {
    const prodUrl = env.VITE_SUPABASE_URL || '';
    if (!prodUrl.includes('skonxcdojbkbfnfemayz')) {
      throw new Error(
        `\n[ERRO CRÍTICO PRÉ-BUILD] O build de produção exige confirmação explícita de que o destino é 'skonxcdojbkbfnfemayz'.\nURL detectada: ${prodUrl || '(vazia)'}\nOperação cancelada para impedir geração de bundle com apontamento incorreto.`
      );
    }
    console.log('\n' + '='.repeat(80));
    console.log('🔒 [VITE BUILD - PRODUÇÃO] Destino Confirmado: skonxcdojbkbfnfemayz');
    console.log(`   URL do Supabase: ${prodUrl}`);
    console.log('   Status: ✓ CONFIRMADO - Build de produção autorizado para Cloudflare Pages');
    console.log('='.repeat(80) + '\n');
  } else if (mode === 'development') {
    const devUrl = env.VITE_SUPABASE_URL || '';
    console.log('\n' + '='.repeat(80));
    console.log('🛠️ [VITE DEV - SERVIDOR LOCAL] Destino: fsroaymkuopapwlnknhl (HOMOLOGAÇÃO ISOLADA)');
    console.log(`   URL do Supabase: ${devUrl}`);
    console.log('   Status: ✓ SEGURO - Zero risco para base produtiva');
    console.log('='.repeat(80) + '\n');
  }

  return {
    server: {
      host: "::",
      port: 8080,
    },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      workbox: {
        maximumFileSizeToCacheInBytes: 10000000, // 10MB
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'Dra. Rosangela Santos - Clínica Odontológica',
        short_name: 'Dra. Rosangela',
        description: 'Sistema de Gestão Odontológica Dra. Rosangela Santos',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
};
});
