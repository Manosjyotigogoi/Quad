import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { notFound, errorHandler } from '../middleware/errorHandler.js';

// Minimal app that mounts the error handlers + a single throwing route.
function buildApp() {
  const app = express();
  app.use(express.json());

  app.get('/throw', (req, res, next) => {
    res.status(400);
    next(new Error('Boom'));
  });

  app.get('/dup', (req, res, next) => {
    const err = new Error('dup');
    err.code = 11000;
    err.keyValue = { email: 'a@b.com' };
    next(err);
  });

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

describe('errorHandler middleware', () => {
  it('returns 404 for unknown routes with a JSON body', async () => {
    const res = await request(buildApp()).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('message');
  });

  it('preserves the explicit status code and message on thrown errors', async () => {
    const res = await request(buildApp()).get('/throw');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Boom');
  });

  it('normalizes Mongoose duplicate-key errors to 409 with a generic message', async () => {
    const res = await request(buildApp()).get('/dup');
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('An account with those details already exists.');
  });
});
