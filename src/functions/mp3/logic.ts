// Bitrate and sample rate tables for MPEG1 Layer III
// Values are in kbps for bitrates and Hz for sample rates
const bitrates = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const sampleRates = [44100, 48000, 32000, 0];

// Counts the number of MP3 frames in a given buffer.
// The function scans through the buffer, looking for MP3 frame headers.
// For each valid frame header found, it calculates the frame size using the bitrate and sample rate,
// then skips ahead by the frame size to find the next frame. The process continues until the end of the buffer.
//
// Parameters:
//   buffer: A Buffer or Uint8Array containing MP3 data.
//
// Returns:
//   The total number of valid MP3 frames found in the buffer.
export function countFrames(buffer: any) {
  let offset = 0;
  let frameCount = 0;

  while (offset < buffer.length - 4) {
    // Check for frame sync (first 11 bits are set: 0xFFE)
    // MP3 frames start with 0xFF followed by a byte where the top 3 bits are set (0xE0)
    if (buffer[offset] === 0xff && (buffer[offset + 1] & 0xe0) === 0xe0) {
      // Parse header for frame size
      // Bitrate index is the top 4 bits of the 3rd byte
      const bitrateIndex = (buffer[offset + 2] & 0xf0) >> 4;
      // Sample rate index is bits 2 and 3 of the 3rd byte
      const sampleRateIndex = (buffer[offset + 2] & 0x0c) >> 2;
      // Padding bit is bit 1 of the 3rd byte
      const padding = (buffer[offset + 2] & 0x02) >> 1;

      // Lookup bitrate and sample rate from header indices
      const bitrate = bitrates[bitrateIndex] * 1000;
      const sampleRate = sampleRates[sampleRateIndex];

      // If invalid bitrate or sample rate, stop parsing
      if (bitrate === 0 || sampleRate === 0) break;

      // Frame size formula for MPEG1 Layer III:
      // frameSize = floor((144 * bitrate) / sampleRate) + padding
      const frameSize = Math.floor((144 * bitrate) / sampleRate) + padding;

      // Move offset to the start of the next frame
      offset += frameSize;
      frameCount++;
    } else {
      // If not a valid frame header, move to the next byte
      offset++;
    }
  }
  return frameCount;
}
