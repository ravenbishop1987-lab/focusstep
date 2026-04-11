import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_URL || 'https://focus-steps-main-backend.onrender.com';
  const appBase = env.VITE_APP_BASE || '/';

  return {
    base: appBase,
    plugins: [react()],
    server: {
      port: 5173,
      historyApiFallback: true,
      proxy: {
        '/translate': apiTarget,
        '/refine': apiTarget,
        '/help-step': apiTarget,
        '/usage': apiTarget,
        '/pro-status': apiTarget,
        '/create-checkout': apiTarget,
        '/billing-portal': apiTarget,
        '/webhook': apiTarget,
        '/admin/metrics': apiTarget,
        '/admin/users': apiTarget,
        '/admin/revenue': apiTarget,
        '/admin/referrals': apiTarget,
        '/admin/referral-rules': apiTarget,
        '/admin/referral-rewards': apiTarget,
        '/admin/referral-program-settings': apiTarget,
        '/admin/task-shares': apiTarget,
        '/admin/translator-analytics': apiTarget,
        '/admin/audit-log': apiTarget,
        '/referral': apiTarget,
        '/user': apiTarget,
        '/cache-stats': apiTarget,
        '/capture-lead': apiTarget,
      }
    }
  };
});
