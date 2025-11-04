import request from 'supertest';
import createApp from '../src/app';

describe('GET /', () => {
  it('returns 200 and message', async () => {
    const app = createApp();
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Hello World' });
  });
});
