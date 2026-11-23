import { defineConfig, loadEnv } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env };
  if (mode !== 'test' && (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANAHTAR)) {
    throw new Error('VITE_SUPABASE_URL ve VITE_SUPABASE_ANAHTAR tanımlı değil. .env.example dosyasına bak.');
  }
  if (String(env.VITE_SUPABASE_ANAHTAR).startsWith('sb_secret_') || /service_role/.test(String(env.VITE_SUPABASE_ANAHTAR))) {
    throw new Error('Gizli (service role) anahtar tarayıcı koduna konamaz; yayınlanabilir anahtarı kullan.');
  }
  return {
  plugins: [preact()],
  build: { target: 'es2020', sourcemap: false },
  test: { include: ['src/**/*.test.ts'] },
  } as any;
});
