const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

function createApp(disco, { apiKey, corsOrigin }) {
  const app = express();

  app.use(cors({ origin: corsOrigin }));
  app.use(express.json());

  app.get('/health', (req, res) => res.json({ ok: true }));

  // Reads are public so the B12 landing page can fetch data straight from the browser.
  app.get('/api/:table', async (req, res, next) => {
    try {
      res.json(await disco.listRecords(req.params.table));
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/:table/:key', async (req, res, next) => {
    try {
      const record = await disco.getRecord(req.params.table, req.params.key);
      if (!record) return res.status(404).json({ error: 'not found' });
      res.json(record);
    } catch (err) {
      next(err);
    }
  });

  function requireApiKey(req, res, next) {
    if (!apiKey || req.get('x-api-key') === apiKey) return next();
    res.status(401).json({ error: 'invalid or missing x-api-key header' });
  }

  app.post('/api/:table', requireApiKey, async (req, res, next) => {
    try {
      const { key, data } = req.body || {};
      if (data === undefined) return res.status(400).json({ error: '"data" is required' });
      const record = await disco.setRecord(req.params.table, key || crypto.randomUUID(), data);
      res.status(201).json(record);
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/:table/:key', requireApiKey, async (req, res, next) => {
    try {
      const existing = await disco.getRecord(req.params.table, req.params.key);
      if (!existing) return res.status(404).json({ error: 'not found' });
      const merged = { ...existing.data, ...(req.body?.data || {}) };
      const record = await disco.setRecord(req.params.table, req.params.key, merged);
      res.json(record);
    } catch (err) {
      next(err);
    }
  });

  app.put('/api/:table/:key', requireApiKey, async (req, res, next) => {
    try {
      const { data } = req.body || {};
      if (data === undefined) return res.status(400).json({ error: '"data" is required' });
      const record = await disco.setRecord(req.params.table, req.params.key, data);
      res.json(record);
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/:table/:key', requireApiKey, async (req, res, next) => {
    try {
      const deleted = await disco.deleteRecord(req.params.table, req.params.key);
      if (!deleted) return res.status(404).json({ error: 'not found' });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: err.message || 'internal error' });
  });

  return app;
}

function attachRealtime(io, disco) {
  io.on('connection', (socket) => {
    socket.on('subscribe', (table) => {
      if (typeof table === 'string') socket.join(`table:${table}`);
    });
    socket.on('unsubscribe', (table) => {
      if (typeof table === 'string') socket.leave(`table:${table}`);
    });
  });

  disco.on('change', ({ table, key, action, record }) => {
    io.to(`table:${table}`).emit('change', { table, key, action, record });
  });
}

module.exports = { createApp, attachRealtime };
