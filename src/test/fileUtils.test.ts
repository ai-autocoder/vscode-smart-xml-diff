import * as assert from 'assert';
import { isFileSizeWithinLimit } from '../utils/fileUtils';
import { TextDocument } from 'vscode';

describe('FileUtils', () => {
    const createMockDocument = (size: number): TextDocument => ({
        getText: () => 'a'.repeat(size)
    } as TextDocument);

    it('should accept empty file', () => {
        const doc = createMockDocument(0);
        assert.strictEqual(isFileSizeWithinLimit(doc), true);
    });

    it('should accept 1MB file', () => {
        const doc = createMockDocument(1024 * 1024); // 1MB
        assert.strictEqual(isFileSizeWithinLimit(doc), true);
    });

    it('should accept file just under limit', () => {
        const doc = createMockDocument(10 * 1024 * 1024 - 1); // Just under 10MB
        assert.strictEqual(isFileSizeWithinLimit(doc), true);
    });

    it('should reject file at limit', () => {
        const doc = createMockDocument(10 * 1024 * 1024); // 10MB
        assert.strictEqual(isFileSizeWithinLimit(doc), false);
    });

    it('should reject file over limit', () => {
        const doc = createMockDocument(11 * 1024 * 1024); // 11MB
        assert.strictEqual(isFileSizeWithinLimit(doc), false);
    });
});
