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
