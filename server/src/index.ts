import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import { config } from './config.js';
import { migrate, waitForDatabase } from './db.js';
import { assetsRouter } from './routes/assets.js';
import { categoriesRouter } from './routes/categories.js';
import { marketRouter } from './routes/market.js';
import { planningRouter } from './routes/planning.js';
import { rulesRouter } from './routes/rules.js';
import { settingsRouter } from './routes/settings.js';
import { statsRouter } from './routes/stats.js';
import { transactionsRouter } from './routes/transactions.js';
import { walletsRouter } from './routes/wallets.js';
import { seedDemoData } from './services/demo.js';
import { startScheduler } from './services/sync.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));
app.use('/api/wallets', walletsRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/assets', assetsRouter);
app.use('/api/planning', planningRouter);
app.use('/api/rules', rulesRouter);
app.use('/api/stats', statsRouter);
app.use('/api/market', marketRouter);
app.use('/api/settings', settingsRouter);

// Static frontend (built by the web workspace, copied into the image).
const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(here, '../public');
app.use(express.static(publicDir));
app.get(/^\/(?!api).*/, (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'), (error) => {
    if (error) res.status(404).json({ error: 'not_found' });
  });
});

app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[api]', error);
  res.status(500).json({ error: error?.message ?? 'internal_error' });
});

async function main() {
  await waitForDatabase();
  await migrate();
  console.log('[db] schema ready');

  if (config.demoMode) {
    const seeded = await seedDemoData();
    console.log(seeded ? '[demo] sample portfolio created' : '[demo] existing data kept');
  }

  startScheduler();
  app.listen(config.port, () => {
    console.log(`[api] listening on http://0.0.0.0:${config.port}`);
  });
}

main().catch((error) => {
  console.error('fatal:', error);
  process.exit(1);
});
