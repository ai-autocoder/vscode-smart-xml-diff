import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { XmlProcessingService } from '../services/xmlProcessingService';

// Behavioural tests for XmlProcessingService.parseNormalizeAll: the output is what the user
// reads in the diff view, so these assert exact text, and whether two inputs normalize to
// the same text (= "no diff shown") or not.

const fixtures = path.resolve(__dirname, '../../xml-fixtures');
const readFixture = (rel: string) => fs.readFileSync(path.join(fixtures, rel), 'utf8');

/** Options exactly as the extension builds them from default settings (extension.ts:116-136). */
const extensionDefaults = { prettyPrintOutput: true, indentationString: '  ' };

function normalize(xml: string, options = {}): string {
  return new XmlProcessingService({ ...extensionDefaults, ...options }).parseNormalizeAll(xml);
}

function differingLines(a: string, b: string): Array<[string | undefined, string | undefined]> {
  const left = a.split('\n');
  const right = b.split('\n');
  const out: Array<[string | undefined, string | undefined]> = [];
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    if (left[i] !== right[i]) {
      out.push([left[i], right[i]]);
    }
  }
  return out;
}

describe('Normalization semantics (exact output)', () => {
  describe('core contract', () => {
    it('sorts distinct sibling tags and attributes, pretty-prints with 2 spaces', () => {
      assert.strictEqual(
        normalize('<root><b x="2" a="1">t</b><a/></root>'),
        '<root>\n  <a></a>\n  <b a="1" x="2">t</b>\n</root>',
      );
    });

    it('keeps the relative order of same-tag siblings, even when interleaved with other tags', () => {
      assert.strictEqual(
        normalize('<r><i id="3"/><x/><i id="1"/><i id="2"/></r>'),
        '<r>\n  <i id="3"></i>\n  <i id="1"></i>\n  <i id="2"></i>\n  <x></x>\n</r>',
      );
    });

    it('shows a reordering of same-tag siblings as a difference', () => {
      assert.notStrictEqual(
        normalize('<r><i>1</i><i>2</i></r>'),
        normalize('<r><i>2</i><i>1</i></r>'),
      );
    });

    it('shows real text and attribute changes as differences', () => {
      assert.notStrictEqual(normalize('<a>x</a>'), normalize('<a>y</a>'));
      assert.notStrictEqual(normalize('<a v="x"/>'), normalize('<a v="y"/>'));
    });

    it('drops comments', () => {
      assert.strictEqual(normalize('<r><!-- note --><a/></r>'), normalize('<r><a/></r>'));
    });

    it('honours a custom indentation string', () => {
      assert.strictEqual(
        normalize('<root><b><c>1</c></b></root>', { indentationString: '    ' }),
        '<root>\n    <b>\n        <c>1</c>\n    </b>\n</root>',
      );
    });

    it('accepts leading whitespace when there is no XML declaration', () => {
      assert.strictEqual(normalize('\n  <r/>'), '<r></r>');
    });

    it('accepts whitespace and a byte order mark before the XML declaration', () => {
      const expected = '<?xml version="1.0"?>\n<r></r>';
      assert.strictEqual(normalize('\n<?xml version="1.0"?><r/>'), expected);
      assert.strictEqual(normalize('\uFEFF\r\n  <?xml version="1.0"?><r/>'), expected);
    });
  });

  describe('validation accepts well-formed XML but not undeclared entities', () => {
    it('accepts > in text and attribute values', () => {
      assert.strictEqual(normalize('<a v="a>b">x > y</a>'), '<a v="a&gt;b">x &gt; y</a>');
    });

    it('does not check the content of CDATA sections, comments and processing instructions', () => {
      assert.strictEqual(
        normalize('<r><c><![CDATA[x => a < b &nbsp;]]></c><!-- a -> b &copy; --></r>'),
        '<r>\n  <c>x =&gt; a &lt; b &amp;nbsp;</c>\n</r>',
      );
      assert.strictEqual(
        normalize('<r><?php echo "&nbsp;"; ?><?pi a="&copy;"?></r>'),
        '<r>\n  <?php echo "&nbsp;";?>\n  <?pi a="&copy;"?>\n</r>',
      );
      // Only acceptance is asserted: the DOCTYPE is not yet reproduced in the output.
      assert.doesNotThrow(() =>
        normalize("<!DOCTYPE r [ <!-- it's a note --> ]><r><![CDATA[&nbsp;]]>don't</r>"),
      );
    });

    it('rejects undeclared entities in text and attribute values, next to any markup', () => {
      for (const xml of [
        '<a>&nbsp;</a>',
        '<a v="&copy;"/>',
        '<!-- <![CDATA[ --><a>&nbsp;</a><!-- ]]> -->',
        '<a v="<!--">&nbsp;<b v="-->"/></a>',
        `<!DOCTYPE r [ <!-- it's --> ]><r><a v="'>" w="<!--"/>&nbsp;<b w="-->"/></r>`,
        // Malformed constructs that the parser ends earlier than the XML spec would must not
        // hide the text that follows them.
        '<r><?>&nbsp;</r>',
        '<r><?>&nbsp;?></r>',
        '<!DOCTYPE r [<!-->]><r>&nbsp;</r>',
        '<!DOCTYPE r [<!-->]><r>&nbsp;</r><!-- -->',
        '<!DOCTYPE r [<?-->]><r a="&copy;"/><?x?>',
        // ... nor a reference split by markup, which the parser joins back together.
        '<?><r>&nb<!---->sp;</r><?x?><r/>',
        // Malformed names that the parser still reads as elements or attributes.
        '<?><r><#cdata>&nbsp;</#cdata></r><?x?><r/>',
        '<r><!x &nbsp;></r>',
      ]) {
        assert.throws(
          () => normalize(xml),
          /Malformed XML: Invalid or unsupported named entity/,
          xml,
        );
      }
    });

    it('rejects malformed numeric references that XMLValidator lets through', () => {
      for (const xml of ['<a>&#x;</a>', '<a v="&#;"/>', '<a v="&#xZZ;"/>']) {
        assert.throws(() => normalize(xml), /Malformed XML: Invalid numeric entity/, xml);
      }
    });

    it('rejects truncated input as malformed', () => {
      for (const xml of ['<item id="5"/', '<a/>\n<b/', '<a/>x']) {
        assert.throws(() => normalize(xml), /Malformed XML: Incomplete document/, xml);
      }
    });
  });

  describe('values are shown exactly as written (no number coercion)', () => {
    it('keeps number-like text values verbatim', () => {
      assert.strictEqual(
        normalize(
          '<r><a>1.10</a><b>01234</b><c>+441234567890</c><d>0x1F</d><e>1e3</e><f>.5</f></r>',
        ),
        '<r>\n  <a>1.10</a>\n  <b>01234</b>\n  <c>+441234567890</c>\n  <d>0x1F</d>\n  <e>1e3</e>\n  <f>.5</f>\n</r>',
      );
    });

    it('keeps number-like attribute values and the XML declaration verbatim', () => {
      assert.strictEqual(
        normalize('<?xml version="1.0"?><r v="007" w="1.0" x="0x10"/>'),
        '<?xml version="1.0"?>\n<r v="007" w="1.0" x="0x10"></r>',
      );
    });

    it('keeps number-like values verbatim in CDATA and when preserving surrounding whitespace', () => {
      assert.strictEqual(normalize('<r><a><![CDATA[007]]></a></r>'), '<r>\n  <a>007</a>\n</r>');
      assert.strictEqual(
        normalize('<r v=" 007 "><a>1.10</a></r>', {
          preserveLeadingTrailingWhitespaceInText: true,
        }),
        '<r v=" 007 ">\n  <a>1.10</a>\n</r>',
      );
    });

    it('shows numerically equal but differently written values as differences', () => {
      assert.notStrictEqual(normalize('<a>1.10</a>'), normalize('<a>1.1</a>'));
      assert.notStrictEqual(normalize('<a v="007"/>'), normalize('<a v="7"/>'));
    });
  });

  describe('mixed content (text next to elements) keeps its order', () => {
    it('keeps text in place and the spaces between words and elements', () => {
      assert.strictEqual(
        normalize('<r><p>Hello <b>big</b> world</p></r>'),
        '<r>\n  <p>Hello <b>big</b> world</p>\n</r>',
      );
      assert.strictEqual(
        normalize('<root>text1<b>2</b>text2<a>1</a></root>'),
        '<root>text1<b>2</b>text2<a>1</a></root>',
      );
    });

    it('shows text moved around an element as a difference', () => {
      assert.notStrictEqual(
        normalize('<p>Hello world <b>big</b></p>'),
        normalize('<p><b>big</b>Hello world</p>'),
      );
    });

    it('collapses whitespace, trims only the ends, and still sorts element-only descendants', () => {
      assert.strictEqual(
        normalize('<div>\n  Text before\n  <span><z/><y>1</y></span>\n  Text after\n</div>'),
        '<div>Text before <span><y>1</y><z></z></span> Text after</div>',
      );
      assert.strictEqual(
        normalize('<p>\n  a  <b>x</b>\n  c\n</p>', { normalizeWhitespaceInTextNodes: false }),
        '<p>a  <b>x</b>\n  c</p>',
      );
    });

    it('keeps the whitespace at the ends when preserving leading/trailing whitespace', () => {
      assert.strictEqual(
        normalize('<p> x <b> y </b> z </p>', { preserveLeadingTrailingWhitespaceInText: true }),
        '<p> x <b> y </b> z </p>',
      );
    });

    it('treats CDATA as text and keeps processing instructions in place', () => {
      assert.strictEqual(normalize('<p><![CDATA[x]]><b/></p>'), '<p>x<b></b></p>');
      assert.strictEqual(normalize('<r>text<?pi x?><a/></r>'), '<r>text<?pi x?><a></a></r>');
    });

    it('treats a no-break space between elements as text, not formatting', () => {
      const options = { normalizeWhitespaceInTextNodes: false };
      assert.strictEqual(
        normalize('<p><b>x</b>\u00a0<a>y</a></p>', options),
        '<p><b>x</b>\u00a0<a>y</a></p>',
      );
      assert.notStrictEqual(
        normalize('<p><b>x</b>\u00a0<a>y</a></p>'),
        normalize('<p><a>y</a>\u00a0<b>x</b></p>'),
      );
    });

    it('keeps the space between elements when not pretty-printing', () => {
      assert.strictEqual(
        normalize('<p> a <b>x</b> <i>y</i> </p>', { prettyPrintOutput: false }),
        '<p>a <b>x</b> <i>y</i></p>',
      );
    });
  });

  describe('element content', () => {
    it('drops the whitespace between elements, also when preserving leading/trailing whitespace', () => {
      const options = { preserveLeadingTrailingWhitespaceInText: true };
      assert.strictEqual(
        normalize('<root>\n  <a> x </a>\n  <b>1</b>\n</root>', options),
        '<root>\n  <a> x </a>\n  <b>1</b>\n</root>',
      );
      assert.strictEqual(
        normalize('<root>\n  <a>1</a>\n</root>', {
          ...options,
          normalizeWhitespaceInTextNodes: false,
        }),
        normalize('<root><a>1</a></root>', options),
      );
    });

    it('sorts names by code unit, independent of locale and of the input order', () => {
      assert.strictEqual(
        normalize('<r><b/><B/><a/></r>'),
        '<r>\n  <B></B>\n  <a></a>\n  <b></b>\n</r>',
      );
      // `cafe` with an acute accent, written precomposed (NFC) and decomposed (NFD) are different names.
      const nfc = '<caf\u00e9>1</caf\u00e9>';
      const nfd = '<cafe\u0301>2</cafe\u0301>';
      const expected = '<r>\n  <cafe\u0301>2</cafe\u0301>\n  <caf\u00e9>1</caf\u00e9>\n</r>';
      assert.strictEqual(normalize(`<r>${nfc}${nfd}</r>`), expected);
      assert.strictEqual(normalize(`<r>${nfd}${nfc}</r>`), expected);
    });

    it('handles deep nesting', () => {
      const depth = 3000;
      const lines = normalize('<a>'.repeat(depth) + 'x' + '</a>'.repeat(depth)).split('\n');
      assert.strictEqual(lines.length, 2 * depth - 1);
      assert.strictEqual(lines[depth - 1], `${'  '.repeat(depth - 1)}<a>x</a>`);
      assert.strictEqual(lines[lines.length - 1], '</a>');
    });
  });

  describe('constructs other than elements and attributes', () => {
    it('keeps processing instructions and the order of the XML declaration', () => {
      assert.strictEqual(
        normalize(
          `<?xml version="1.0" encoding="UTF-8"?><?xml-stylesheet type="text/xsl" href='a"b.xsl'?><r><?target data?><item/></r>`,
        ),
        `<?xml version="1.0" encoding="UTF-8"?>\n<?xml-stylesheet type="text/xsl" href='a"b.xsl'?>\n<r>\n  <?target data?>\n  <item></item>\n</r>`,
      );
      assert.notStrictEqual(normalize('<r><?target a?></r>'), normalize('<r><?target b?></r>'));
    });

    it('keeps the top level in document order', () => {
      assert.strictEqual(
        normalize('<?xml version="1.0"?><?a b?><r/>'),
        '<?xml version="1.0"?>\n<?a b?>\n<r></r>',
      );
    });

    it('keeps __proto__ as an element name', () => {
      assert.strictEqual(
        normalize('<r><__proto__ __proto__="x">t</__proto__></r>'),
        '<r>\n  <__proto__ __proto__="x">t</__proto__>\n</r>',
      );
    });

    it('rejects attributes without a value', () => {
      assert.throws(
        () => normalize('<a disabled/>'),
        /Malformed XML \(validator\): boolean attribute 'disabled' is not allowed/,
      );
    });
  });

  describe('fixtures: the diff shows only the real change', () => {
    it('nodes-position: heavy child reordering reduces to the single Stock change', () => {
      const diff = differingLines(
        normalize(readFixture('nodes-position/catalog_v1.xml')),
        normalize(readFixture('nodes-position/catalog_v2.xml')),
      );
      assert.deepStrictEqual(diff, [['      <Stock>120</Stock>', '      <Stock>NA</Stock>']]);
    });

    it('nodes-whitespace: whitespace inside a tag is ignored, whitespace inside a value is not', () => {
      const diff = differingLines(
        normalize(readFixture('nodes-whitespace/catalog_v1.xml')),
        normalize(readFixture('nodes-whitespace/catalog_v2.xml')),
      );
      assert.deepStrictEqual(diff, [
        [
          '        <Spec name="RefreshRate">60Hz</Spec>',
          '        <Spec name="RefreshRate">60 Hz</Spec>',
        ],
      ]);
    });
  });
});
