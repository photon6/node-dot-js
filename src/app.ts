import express from 'express';

export function createApp() {
  const app = express();

  app.get('/', (_req, res) => {
    res.json({ message: 'Hello World' });
  });

  return app;
}

export default createApp;
