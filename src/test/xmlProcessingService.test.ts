import * as assert from 'assert';
import { XmlProcessingService } from '../services/xmlProcessingService';

describe('XmlProcessingService', () => {
  describe('Node order independence and canonicalization', () => {
    let service: XmlProcessingService;
    beforeEach(() => {
      service = new XmlProcessingService();
    });

    function assertEquivalent(xml1: string, xml2: string, msg?: string) {
      const norm1 = service.parseNormalizeAll(xml1).replace(/\s+/g, '');
      const norm2 = service.parseNormalizeAll(xml2).replace(/\s+/g, '');
      assert.strictEqual(norm1, norm2, msg || 'Normalized XML should be equivalent');
    }

    it('should treat root-level child node order as irrelevant', () => {
      const xmlA = '<root><a>1</a><b>2</b><c>3</c></root>';
      const xmlB = '<root><c>3</c><a>1</a><b>2</b></root>';
      assertEquivalent(xmlA, xmlB);
    });

    it('should treat nested child node order as irrelevant', () => {
      const xmlA = '<root><parent><x>1</x><y>2</y></parent></root>';
      const xmlB = '<root><parent><y>2</y><x>1</x></parent></root>';
      assertEquivalent(xmlA, xmlB);
    });

    it('should treat deep nested node order as irrelevant', () => {
      const xmlA = '<root><a><b><c1>foo</c1><c2>bar</c2></b></a></root>';
      const xmlB = '<root><a><b><c2>bar</c2><c1>foo</c1></b></a></root>';
      assertEquivalent(xmlA, xmlB);
    });

    it('should treat mixed content order as relevant for text, but not for nodes', () => {
      // Text order matters, but node order does not
      const xmlA = '<root>text1<a>1</a>text2<b>2</b></root>';
      const xmlB = '<root>text1<b>2</b>text2<a>1</a></root>';
      // These are not equivalent due to text order, so this should fail
      let failed = false;
      try {
        assertEquivalent(xmlA, xmlB);
      } catch {
        failed = true;
      }
      assert.ok(failed, 'Mixed content with different text order should not be equivalent');
    });

    it('should treat attribute order as irrelevant', () => {
      const xmlA = '<root><item a="1" b="2" c="3"/></root>';
      const xmlB = '<root><item c="3" a="1" b="2"/></root>';
      assertEquivalent(xmlA, xmlB);
    });

    it('should treat empty elements and self-closing tags as equivalent', () => {
      const xmlA = '<root><empty></empty></root>';
      const xmlB = '<root><empty/></root>';
      assertEquivalent(xmlA, xmlB);
    });

    it('should treat whitespace-only differences as irrelevant', () => {
      const xmlA = '<root>\n  <a>1</a>\n  <b>2</b>\n</root>';
      const xmlB = '<root><a>1</a><b>2</b></root>';
      assertEquivalent(xmlA, xmlB);
    });

    it('should treat complex nested structures with shuffled node positions as equivalent', () => {
      const xmlA = '<root><a><b1>1</b1><b2>2</b2></a><c><d1>3</d1><d2>4</d2></c></root>';
      const xmlB = '<root><c><d2>4</d2><d1>3</d1></c><a><b2>2</b2><b1>1</b1></a></root>';
      assertEquivalent(xmlA, xmlB);
    });
  });
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

    compareNormalized('<root><a>1</a><b>2</b></root>', '<root><b>2</b><a>1</a></root>');
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
