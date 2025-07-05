import { describe, expect, it } from 'vitest';
import { countFrames } from './logic';

// Helper to create a minimal MP3 frame header for MPEG1 Layer III, 128kbps, 44100Hz, no padding
function createMp3Frame() {
  // Frame sync: 0xFF 0xFB (MPEG1 Layer III)
  // Bitrate index: 9 (128kbps), Sample rate index: 0 (44100Hz), Padding: 0
  // 0xFF 0xFB 0x90 0x00
  return Buffer.from([0xff, 0xfb, 0x90, 0x00]);
}

// Helper to create a full MP3 frame (header + padding to frame size)
function createFullMp3Frame() {
  const header = createMp3Frame();
  const frameSize = 417;
  return Buffer.concat([header, Buffer.alloc(frameSize - header.length)]);
}

// Helper to create a buffer with N valid MP3 frames
function createMp3BufferWithFrames(n: number) {
  const frame = createFullMp3Frame();
  return Buffer.concat(Array(n).fill(frame));
}

describe('countFrames', () => {
  it('returns 0 for an empty buffer', () => {
    expect(countFrames(Buffer.alloc(0))).toBe(0);
  });

  it('returns 0 for a buffer with no valid frames', () => {
    expect(countFrames(Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]))).toBe(0);
  });

  it('counts a single valid MP3 frame', () => {
    const buffer = createMp3BufferWithFrames(1);
    expect(countFrames(buffer)).toBe(1);
  });

  it('counts multiple consecutive valid MP3 frames', () => {
    const buffer = createMp3BufferWithFrames(3);
    expect(countFrames(buffer)).toBe(3);
  });

  it('skips invalid data between frames', () => {
    const frame = createFullMp3Frame();
    // Insert invalid data between valid frames
    const buffer = Buffer.concat([
      frame,
      Buffer.from([0x00, 0x01, 0x02]), // invalid data
      frame,
      Buffer.from([0x00, 0x01, 0x02]), // more invalid data
      frame,
    ]);
    expect(countFrames(buffer)).toBe(3);
  });

  it('stops counting on invalid bitrate/sample rate', () => {
    const frame = createMp3Frame();
    const frameSize = 417;
    // Create a frame with invalid bitrate index (0)
    const invalidFrame = Buffer.from([0xff, 0xfb, 0x00, 0x00]);
    const buffer = Buffer.concat([
      frame,
      Buffer.alloc(frameSize - frame.length),
      invalidFrame,
      frame,
    ]);
    // Should only count the first frame, then stop
    expect(countFrames(buffer)).toBe(1);
  });
});
