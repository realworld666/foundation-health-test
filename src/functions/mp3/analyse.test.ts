import { describe, expect, it, vi } from 'vitest';
import { handler } from './analyse';
import { countFrames } from './logic';

vi.mock('./logic', () => ({
  countFrames: vi.fn().mockReturnValue(1),
}));

describe('analyse.handler', () => {
  const buffer = Buffer.from(`test-data`);
  it('returns 400 if no body is provided', async () => {
    const event = { body: undefined } as any;
    const result = await handler(event);
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toHaveProperty('error');
  });

  it('returns 400 if body is an mp3 in the correct format', async () => {
    vi.mocked(countFrames).mockReturnValueOnce(0);
    const event = { body: 'test-data', isBase64Encoded: false } as any;
    const result = await handler(event);
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toHaveProperty('error');
  });

  it('returns frame count for valid base64 MP3 data', async () => {
    const event = {
      body: buffer.toString('base64'),
      isBase64Encoded: true,
    } as any;
    const result = await handler(event);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ frameCount: 1 });
  });

  it('returns 500 and error details if countFrames throws', async () => {
    vi.mocked(countFrames).mockImplementation(() => {
      throw new Error('fail');
    });
    const event = {
      body: buffer.toString('base64'),
      isBase64Encoded: true,
    } as any;
    const result = await handler(event);
    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('Error uploading file to S3');
    expect(body.details).toBe('fail');
  });
});
