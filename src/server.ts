import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { AuditorEngine } from './engine.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const engine = new AuditorEngine();

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'TinyFish SEO Page Auditor',
    checks: 17
  });
});

// Run Live Audit
app.post('/api/audit', async (req, res) => {
  const { url, targetQuery } = req.body;
  if (!url || typeof url !== 'string' || url.trim().length === 0) {
    return res.status(400).json({ error: 'Valid URL is required' });
  }

  try {
    const report = await engine.runAudit(url, targetQuery);
    return res.json(report);
  } catch (err: any) {
    console.error('Audit execution error:', err);
    return res.status(500).json({
      error: 'Failed to complete audit',
      details: err.message
    });
  }
});

// Explicit AI and Crawler Context Routes
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').sendFile(path.join(__dirname, '../public/robots.txt'));
});

app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml').sendFile(path.join(__dirname, '../public/sitemap.xml'));
});

app.get('/llms.txt', (req, res) => {
  res.type('text/plain; charset=utf-8').sendFile(path.join(__dirname, '../public/llms.txt'));
});

app.get('/llms-full.txt', (req, res) => {
  res.type('text/plain; charset=utf-8').sendFile(path.join(__dirname, '../public/llms-full.txt'));
});

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 TinyFish SEO Page Auditor is running!`);
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`🔍 11 Checks • Prioritized Fixes • Live Evidence`);
  console.log(`======================================================\n`);
});
