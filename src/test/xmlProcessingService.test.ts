import * as assert from 'assert';
import { XmlProcessingService } from '../services/xmlProcessingService';

describe('XmlProcessingService', () => {
    let service: XmlProcessingService;

    beforeEach(() => {
        service = new XmlProcessingService();
    });

    // Test valid XML handling
    it('should handle basic XML', () => {
        const input = '<root><a>1</a><b>2</b></root>';
        const result = service.parseNormalizeAll(input);
        assert.ok(result.includes('<root>'));
        assert.ok(result.includes('<a>1</a>'));
        assert.ok(result.includes('<b>2</b>'));
    });

    it('should handle XML with attributes', () => {
        const input = '<root id="1"><child name="test">value</child></root>';
        const result = service.parseNormalizeAll(input);
        assert.ok(result.includes('id="1"'));
        assert.ok(result.includes('name="test"'));
    });

    it('should handle empty elements', () => {
        const input = '<root><empty/></root>';
        const result = service.parseNormalizeAll(input);
        assert.ok(result.includes('<empty'));
    });

    it('should normalize differently ordered XML to the same string', () => {
        const compareNormalized = (xml1: string, xml2: string): void => {
            const result1 = service.parseNormalizeAll(xml1);
            const result2 = service.parseNormalizeAll(xml2);
            const withoutWhitespace1 = result1.replace(/\s+/g, '');
            const withoutWhitespace2 = result2.replace(/\s+/g, '');
            assert.strictEqual(withoutWhitespace1, withoutWhitespace2);
        };

        compareNormalized(
            '<root><a>1</a><b>2</b></root>',
            '<root><b>2</b><a>1</a></root>'
        );
    });

    // Test error handling
    it('should reject empty string', () => {
        assert.throws(() => {
            service.parseNormalizeAll('');
        }, /invalid xml input/i);
    });

    it('should reject unclosed tag', () => {
        assert.throws(() => {
            service.parseNormalizeAll('<root><unclosed>');
        }, /malformed xml/i);
    });

    it('should reject mismatched tags', () => {
        assert.throws(() => {
            service.parseNormalizeAll('<root><a>1</b></root>');
        }, /malformed xml/i);
    });

    it('should reject invalid XML entities', () => {
        assert.throws(() => {
            service.parseNormalizeAll('<root>&invalid;</root>');
        }, /malformed xml/i);
    });

    it('should handle whitespace preservation', () => {
        const input = '<root>\n  <text>  preserved  spaces  </text>\n</root>';
        const result = service.parseNormalizeAll(input);
        // Verify content is preserved (whitespace within text nodes)
        assert.ok(result.includes('preserved  spaces'));
    });

    it('should handle complex nested structures', () => {
        const input = `
            <root>
                <level1>
                    <level2 attr="test">
                        <level3>value</level3>
                    </level2>
                </level1>
            </root>
        `.trim();
        const result = service.parseNormalizeAll(input);
        assert.ok(result.includes('attr="test"'));
        assert.ok(result.includes('<level3>value</level3>'));
    });
});
