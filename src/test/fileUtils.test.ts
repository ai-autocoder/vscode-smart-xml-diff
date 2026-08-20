import * as assert from 'assert';
import { isTextWithinSizeLimit } from '../utils/fileUtils';

describe('FileUtils', () => {
  const MB = 1024 * 1024;

  it('should accept empty text', () => {
    assert.strictEqual(isTextWithinSizeLimit(''), true);
  });

  it('should accept 1MB of text', () => {
    assert.strictEqual(isTextWithinSizeLimit('a'.repeat(MB)), true);
  });

  it('should accept text just under the limit', () => {
    assert.strictEqual(isTextWithinSizeLimit('a'.repeat(10 * MB - 1)), true);
  });

  it('should reject text at the limit', () => {
    assert.strictEqual(isTextWithinSizeLimit('a'.repeat(10 * MB)), false);
  });

  it('should reject text over the limit', () => {
    assert.strictEqual(isTextWithinSizeLimit('a'.repeat(11 * MB)), false);
  });

  it('should measure UTF-8 bytes, not characters', () => {
    // 'é' is 2 bytes in UTF-8.
    assert.strictEqual(isTextWithinSizeLimit('é'.repeat(5 * MB)), false);
    assert.strictEqual(isTextWithinSizeLimit('é'.repeat(5 * MB - 1)), true);
  });
});
