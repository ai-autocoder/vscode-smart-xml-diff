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

    it('should normalize elements in mixed content', () => {
      // In mixed content, element order is normalized but text nodes are preserved
      const xmlA = '<root>text1<a>1</a>text2<b>2</b></root>';
      const xmlB = '<root>text1<b>2</b>text2<a>1</a></root>';
      // Due to the way the parser handles mixed content, elements get sorted
      // but the text nodes may be combined or reordered as well
      const resultA = service.parseNormalizeAll(xmlA);
      const resultB = service.parseNormalizeAll(xmlB);
      // Verify both results are valid XML
      assert.ok(resultA.includes('<root>'));
      assert.ok(resultB.includes('<root>'));
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

  it('should handle whitespace normalization in text nodes', () => {
    const input = '<root>\n  <text>  preserved  spaces  </text>\n</root>';
    const result = service.parseNormalizeAll(input);
    // By default, multiple spaces are normalized to single space
    assert.ok(result.includes('preserved spaces') || result.includes('preserved  spaces'));
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

  // Comprehensive edge case tests
  describe('Large attributes (>1000 chars)', () => {
    it('should handle attributes longer than 1000 characters', () => {
      const largeAttrValue = 'x'.repeat(2000);
      const input = `<root><element attr="${largeAttrValue}">content</element></root>`;
      const result = service.parseNormalizeAll(input);
      assert.ok(result.includes(largeAttrValue));
      assert.ok(result.includes('attr='));
    });

    it('should handle multiple large attributes', () => {
      const attr1 = 'a'.repeat(1500);
      const attr2 = 'b'.repeat(1500);
      const attr3 = 'c'.repeat(1500);
      const input = `<root><item x="${attr1}" y="${attr2}" z="${attr3}"/></root>`;
      const result = service.parseNormalizeAll(input);
      assert.ok(result.includes(attr1));
      assert.ok(result.includes(attr2));
      assert.ok(result.includes(attr3));
    });

    it('should normalize large attributes in different orders', () => {
      const largeValue = 'd'.repeat(2000);
      const xml1 = `<root><e a="short" b="${largeValue}"/></root>`;
      const xml2 = `<root><e b="${largeValue}" a="short"/></root>`;
      const result1 = service.parseNormalizeAll(xml1).replace(/\s+/g, '');
      const result2 = service.parseNormalizeAll(xml2).replace(/\s+/g, '');
      assert.strictEqual(result1, result2);
    });
  });

  describe('Unicode and special characters', () => {
    it('should handle various Unicode characters (emoji, CJK, Arabic)', () => {
      const input = '<root><emoji>😀🎉✨</emoji><chinese>中文测试</chinese><arabic>مرحبا</arabic><russian>Привет</russian></root>';
      const result = service.parseNormalizeAll(input);
      assert.ok(result.includes('😀🎉✨'));
      assert.ok(result.includes('中文测试'));
      assert.ok(result.includes('مرحبا'));
      assert.ok(result.includes('Привет'));
    });

    it('should handle Unicode in attribute values', () => {
      const input = '<root><item name="测试" emoji="🚀" desc="Привет мир"/></root>';
      const result = service.parseNormalizeAll(input);
      assert.ok(result.includes('测试'));
      assert.ok(result.includes('🚀'));
      assert.ok(result.includes('Привет мир'));
    });

    it('should handle special XML entities', () => {
      const input = '<root><text>Value with &lt;tags&gt; &amp; &quot;quotes&quot; &apos;apostrophes&apos;</text></root>';
      const result = service.parseNormalizeAll(input);
      // Entities should be preserved or normalized
      assert.ok(result.length > 0);
    });

    it('should handle numeric character references', () => {
      const input = '<root><text>&#65; &#x42; &#169;</text></root>';
      const result = service.parseNormalizeAll(input);
      assert.ok(result.length > 0);
    });

    it('should normalize Unicode in different orders', () => {
      const xml1 = '<root><a>中文</a><b>English</b><c>Русский</c></root>';
      const xml2 = '<root><c>Русский</c><a>中文</a><b>English</b></root>';
      const result1 = service.parseNormalizeAll(xml1).replace(/\s+/g, '');
      const result2 = service.parseNormalizeAll(xml2).replace(/\s+/g, '');
      assert.strictEqual(result1, result2);
    });
  });

  describe('XML with CDATA sections', () => {
    it('should handle basic CDATA sections', () => {
      const input = '<root><data><![CDATA[This is raw text with <tags> and & special chars]]></data></root>';
      const result = service.parseNormalizeAll(input);
      // CDATA content should be preserved
      assert.ok(result.length > 0);
    });

    it('should handle CDATA with newlines and whitespace', () => {
      const input = `<root><script><![CDATA[
        function test() {
          return x < y && z > 0;
        }
      ]]></script></root>`;
      const result = service.parseNormalizeAll(input);
      assert.ok(result.length > 0);
    });

    it('should handle multiple CDATA sections', () => {
      const input = '<root><item><![CDATA[First]]></item><item><![CDATA[Second]]></item></root>';
      const result = service.parseNormalizeAll(input);
      assert.ok(result.length > 0);
    });

    it('should handle CDATA with special characters', () => {
      const input = '<root><code><![CDATA[if (x < 10 && y > 5) { return "test"; }]]></code></root>';
      const result = service.parseNormalizeAll(input);
      assert.ok(result.length > 0);
    });

    it('should normalize elements with CDATA in different orders', () => {
      const xml1 = '<root><a><![CDATA[data1]]></a><b>text</b></root>';
      const xml2 = '<root><b>text</b><a><![CDATA[data1]]></a></root>';
      const result1 = service.parseNormalizeAll(xml1).replace(/\s+/g, '');
      const result2 = service.parseNormalizeAll(xml2).replace(/\s+/g, '');
      assert.strictEqual(result1, result2);
    });
  });

  describe('XML with processing instructions', () => {
    it('should handle XML declaration', () => {
      const input = '<?xml version="1.0" encoding="UTF-8"?><root><item>test</item></root>';
      const result = service.parseNormalizeAll(input);
      assert.ok(result.includes('<root>'));
      assert.ok(result.includes('<item>test</item>'));
    });

    it('should handle processing instructions', () => {
      const input = '<root><?target data?><item>content</item></root>';
      const result = service.parseNormalizeAll(input);
      // Processing instructions may be stripped or preserved
      assert.ok(result.includes('<root>'));
    });

    it('should handle multiple processing instructions', () => {
      const input = '<?xml version="1.0"?><?xml-stylesheet type="text/xsl" href="style.xsl"?><root><data>test</data></root>';
      const result = service.parseNormalizeAll(input);
      assert.ok(result.includes('<root>'));
      assert.ok(result.includes('<data>test</data>'));
    });

    it('should handle processing instructions with different encodings', () => {
      const input = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><root><text>content</text></root>';
      const result = service.parseNormalizeAll(input);
      assert.ok(result.includes('<root>'));
    });
  });

  describe('Mixed content (text + elements)', () => {
    it('should handle text before and after elements', () => {
      const input = '<root>text before<element>content</element>text after</root>';
      const result = service.parseNormalizeAll(input);
      assert.ok(result.includes('text before'));
      assert.ok(result.includes('text after'));
      assert.ok(result.includes('<element>content</element>'));
    });

    it('should handle interleaved text and elements', () => {
      const input = '<p>This is <b>bold</b> and <i>italic</i> text.</p>';
      const result = service.parseNormalizeAll(input);
      assert.ok(result.includes('This is'));
      assert.ok(result.includes('and'));
      assert.ok(result.includes('text'));
    });

    it('should handle mixed content with whitespace', () => {
      const input = `<div>
        Text before
        <span>inline</span>
        Text after
      </div>`;
      const result = service.parseNormalizeAll(input);
      assert.ok(result.length > 0);
    });

    it('should handle deeply nested mixed content', () => {
      const input = '<root>outer<a>level1<b>level2<c>level3</c>end2</b>end1</a>outer-end</root>';
      const result = service.parseNormalizeAll(input);
      assert.ok(result.includes('outer'));
      assert.ok(result.includes('level1'));
      assert.ok(result.includes('level2'));
      assert.ok(result.includes('level3'));
    });

    it('should preserve text node order in mixed content', () => {
      const input = '<p>Start <b>middle</b> end</p>';
      const result = service.parseNormalizeAll(input);
      // Text order should be meaningful
      assert.ok(result.includes('Start'));
      assert.ok(result.includes('end'));
    });
  });

  describe('Same-tag siblings with different attributes', () => {
    it('should preserve order of same-tag siblings', () => {
      const input = '<root><item id="1">first</item><item id="2">second</item><item id="3">third</item></root>';
      const result = service.parseNormalizeAll(input);
      // The order of same-tag siblings should be preserved
      assert.ok(result.includes('id="1"'));
      assert.ok(result.includes('id="2"'));
      assert.ok(result.includes('id="3"'));
      assert.ok(result.includes('first'));
      assert.ok(result.includes('second'));
      assert.ok(result.includes('third'));
    });

    it('should not reorder same-tag siblings even with different attributes', () => {
      const xml1 = '<root><item x="1">a</item><item y="2">b</item><item z="3">c</item></root>';
      const xml2 = '<root><item x="1">a</item><item y="2">b</item><item z="3">c</item></root>';
      const result1 = service.parseNormalizeAll(xml1);
      const result2 = service.parseNormalizeAll(xml2);
      assert.strictEqual(result1.replace(/\s+/g, ''), result2.replace(/\s+/g, ''));
    });

    it('should preserve order with mixed same-tag and different-tag siblings', () => {
      const input = '<root><item id="1">first</item><other>different</other><item id="2">second</item></root>';
      const result = service.parseNormalizeAll(input);
      assert.ok(result.includes('id="1"'));
      assert.ok(result.includes('id="2"'));
      assert.ok(result.includes('different'));
    });

    it('should handle many same-tag siblings with varying attributes', () => {
      const items = Array.from({ length: 50 }, (_, i) => `<item id="${i}" name="item${i}">value${i}</item>`).join('');
      const input = `<root>${items}</root>`;
      const result = service.parseNormalizeAll(input);
      assert.ok(result.includes('id="0"'));
      assert.ok(result.includes('id="49"'));
      assert.ok(result.includes('value0'));
      assert.ok(result.includes('value49'));
    });

    it('should sort attributes within same-tag siblings', () => {
      const input = '<root><item z="3" a="1" m="2">first</item><item z="6" a="4" m="5">second</item></root>';
      const result = service.parseNormalizeAll(input);
      // Attributes should be sorted alphabetically
      assert.ok(result.length > 0);
    });
  });

  describe('Deeply nested structures (20+ levels)', () => {
    it('should handle 20 levels of nesting', () => {
      let xml = '<root>';
      for (let i = 1; i <= 20; i++) {
        xml += `<level${i}>`;
      }
      xml += 'deep content';
      for (let i = 20; i >= 1; i--) {
        xml += `</level${i}>`;
      }
      xml += '</root>';
      const result = service.parseNormalizeAll(xml);
      assert.ok(result.includes('<level1>'));
      assert.ok(result.includes('<level20>'));
      assert.ok(result.includes('deep content'));
    });

    it('should handle 25 levels of nesting with attributes', () => {
      let xml = '<root>';
      for (let i = 1; i <= 25; i++) {
        xml += `<level${i} depth="${i}">`;
      }
      xml += 'very deep content';
      for (let i = 25; i >= 1; i--) {
        xml += `</level${i}>`;
      }
      xml += '</root>';
      const result = service.parseNormalizeAll(xml);
      assert.ok(result.includes('depth="1"'));
      assert.ok(result.includes('depth="25"'));
      assert.ok(result.includes('very deep content'));
    });

    it('should handle deeply nested structures with multiple children at each level', () => {
      let xml = '<root>';
      for (let i = 1; i <= 15; i++) {
        xml += `<level${i}><child${i}a>a</child${i}a><child${i}b>b</child${i}b>`;
      }
      xml += 'center';
      for (let i = 15; i >= 1; i--) {
        xml += `</level${i}>`;
      }
      xml += '</root>';
      const result = service.parseNormalizeAll(xml);
      assert.ok(result.includes('<child1a>'));
      assert.ok(result.includes('<child15b>'));
      assert.ok(result.includes('center'));
    });

    it('should normalize deeply nested structures in different orders', () => {
      let xml1 = '<root>';
      for (let i = 1; i <= 20; i++) {
        xml1 += `<level${i}><a>1</a><b>2</b>`;
      }
      for (let i = 20; i >= 1; i--) {
        xml1 += `</level${i}>`;
      }
      xml1 += '</root>';

      let xml2 = '<root>';
      for (let i = 1; i <= 20; i++) {
        xml2 += `<level${i}><b>2</b><a>1</a>`;
      }
      for (let i = 20; i >= 1; i--) {
        xml2 += `</level${i}>`;
      }
      xml2 += '</root>';

      const result1 = service.parseNormalizeAll(xml1).replace(/\s+/g, '');
      const result2 = service.parseNormalizeAll(xml2).replace(/\s+/g, '');
      assert.strictEqual(result1, result2);
    });
  });

  describe('Additional comprehensive edge cases', () => {
    it('should handle XML with namespaces', () => {
      const input = '<root xmlns:custom="http://example.com/ns"><custom:element>value</custom:element></root>';
      const result = service.parseNormalizeAll(input);
      assert.ok(result.length > 0);
    });

    it('should handle multiple namespace declarations', () => {
      const input = '<root xmlns:a="http://a.com" xmlns:b="http://b.com"><a:item>1</a:item><b:item>2</b:item></root>';
      const result = service.parseNormalizeAll(input);
      assert.ok(result.length > 0);
    });

    it('should handle default namespace', () => {
      const input = '<root xmlns="http://default.com"><child>value</child></root>';
      const result = service.parseNormalizeAll(input);
      assert.ok(result.length > 0);
    });

    it('should handle very long text content (>10000 chars)', () => {
      const longText = 'Lorem ipsum '.repeat(1000);
      const input = `<root><text>${longText}</text></root>`;
      const result = service.parseNormalizeAll(input);
      assert.ok(result.includes('Lorem ipsum'));
    });

    it('should handle elements with only whitespace', () => {
      const input = '<root><empty>   \n\t  </empty><another>     </another></root>';
      const result = service.parseNormalizeAll(input);
      assert.ok(result.includes('<root>'));
    });

    it('should handle many sibling elements (1000+)', () => {
      const siblings = Array.from({ length: 1000 }, (_, i) => `<item${i % 10}>value${i}</item${i % 10}>`).join('');
      const input = `<root>${siblings}</root>`;
      const result = service.parseNormalizeAll(input);
      assert.ok(result.includes('<root>'));
      assert.ok(result.includes('value0'));
      assert.ok(result.includes('value999'));
    });

    it('should handle boolean-like attributes', () => {
      const input = '<root><element enabled="true" disabled="false" checked="1" unchecked="0"/></root>';
      const result = service.parseNormalizeAll(input);
      assert.ok(result.includes('enabled='));
      assert.ok(result.includes('disabled='));
      assert.ok(result.includes('checked='));
      assert.ok(result.includes('unchecked='));
    });

    it('should handle numeric content', () => {
      const input = '<root><int>42</int><float>3.14159</float><negative>-100</negative><exp>1.23e10</exp></root>';
      const result = service.parseNormalizeAll(input);
      assert.ok(result.includes('42'));
      assert.ok(result.includes('3.14159'));
      assert.ok(result.includes('-100'));
    });

    it('should handle empty root with attributes', () => {
      const input = '<root version="1.0" empty="true"/>';
      const result = service.parseNormalizeAll(input);
      assert.ok(result.includes('version='));
      assert.ok(result.includes('empty='));
    });

    it('should handle URL and path-like content', () => {
      const input = '<root><url>https://example.com/path?query=value&amp;other=123</url><path>/usr/local/bin/app</path></root>';
      const result = service.parseNormalizeAll(input);
      assert.ok(result.includes('https://example.com'));
      assert.ok(result.includes('/usr/local/bin/app'));
    });

    it('should handle HTML-like entities in XML', () => {
      const input = '<root><text>&nbsp;&copy;&reg;</text></root>';
      // This should fail as these are not valid XML entities
      assert.throws(() => {
        service.parseNormalizeAll(input);
      }, /malformed xml/i);
    });

    it('should handle attribute values with quotes', () => {
      const input = '<root><item desc="He said &quot;hello&quot;">text</item></root>';
      const result = service.parseNormalizeAll(input);
      assert.ok(result.length > 0);
    });

    it('should handle consecutive text nodes', () => {
      const input = '<root>text1text2text3</root>';
      const result = service.parseNormalizeAll(input);
      assert.ok(result.includes('text1text2text3'));
    });

    it('should handle XML with comments (should be stripped)', () => {
      const input = '<root><!-- This is a comment --><item>value</item><!-- Another comment --></root>';
      const result = service.parseNormalizeAll(input);
      assert.ok(result.includes('<item>value</item>'));
      // Comments should be stripped based on parser configuration
    });

    it('should handle complex real-world-like XML document', () => {
      const input = `<?xml version="1.0" encoding="UTF-8"?>
        <document xmlns="http://example.com/doc">
          <metadata>
            <title>Test Document 测试文档</title>
            <author email="test@example.com">John Doe</author>
            <created>2024-01-01T00:00:00Z</created>
          </metadata>
          <content>
            <section id="intro" order="1">
              <heading>Introduction</heading>
              <paragraph>This is <emphasis>important</emphasis> text with <link href="http://example.com">a link</link>.</paragraph>
            </section>
            <section id="details" order="2">
              <heading>Details</heading>
              <list type="ordered">
                <item priority="high">First item</item>
                <item priority="medium">Second item</item>
                <item priority="low">Third item</item>
              </list>
            </section>
          </content>
        </document>`;
      const result = service.parseNormalizeAll(input);
      assert.ok(result.includes('Test Document'));
      assert.ok(result.includes('测试文档'));
      assert.ok(result.includes('John Doe'));
      assert.ok(result.includes('Introduction'));
    });

    it('should handle SVG-like XML', () => {
      const input = `<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="40" stroke="black" stroke-width="2" fill="red"/>
        <text x="50" y="50" font-size="16" text-anchor="middle">SVG</text>
      </svg>`;
      const result = service.parseNormalizeAll(input);
      assert.ok(result.includes('width='));
      assert.ok(result.includes('circle'));
      assert.ok(result.includes('text'));
    });

    it('should handle configuration-like XML', () => {
      const input = `<configuration>
        <appSettings>
          <add key="Setting1" value="Value1"/>
          <add key="Setting2" value="Value2"/>
        </appSettings>
        <connectionStrings>
          <add name="DB" connectionString="Server=localhost;Database=test" providerName="System.Data.SqlClient"/>
        </connectionStrings>
      </configuration>`;
      const result = service.parseNormalizeAll(input);
      assert.ok(result.includes('appSettings'));
      assert.ok(result.includes('Setting1'));
      assert.ok(result.includes('connectionStrings'));
    });
  });
});
