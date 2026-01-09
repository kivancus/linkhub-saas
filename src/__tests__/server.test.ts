import request from 'supertest';
import app from '../server';

describe('Server Setup', () => {
  it('should respond to health check', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      environment: 'test',
    });
    expect(response.body.timestamp).toBeDefined();
    expect(response.body.uptime).toBeDefined();
  });

  it('should return 404 for unknown API routes', async () => {
    const response = await request(app)
      .get('/api/unknown-route')
      .expect(404);

    expect(response.body.error.message).toBe('Route not found');
  });
});