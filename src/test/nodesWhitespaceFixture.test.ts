import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { XmlProcessingService } from '../services/xmlProcessingService';

describe('XML Whitespace Node Comparison (xml-fixtures/nodes-whitespace)', () => {
  const fixtureDir = path.resolve(__dirname, '../../xml-fixtures/nodes-whitespace');
  const fileV1 = path.join(fixtureDir, 'catalog_v1.xml');
  const fileV2 = path.join(fixtureDir, 'catalog_v2.xml');
  let xml1: string;
  let xml2: string;
  let service: XmlProcessingService;

  before(() => {
    xml1 = fs.readFileSync(fileV1, 'utf8');
    xml2 = fs.readFileSync(fileV2, 'utf8');
    service = new XmlProcessingService();
  });

  it('should only differ in whitespace in <Spec name="RefreshRate">', () => {
    // Find the relevant node in both files
    assert.ok(xml1.includes('<Spec name="RefreshRate">60Hz</Spec>'));
    assert.ok(xml2.includes('<Spec name="RefreshRate">60 Hz</Spec>'));
  });

  it('should treat the two XML files as different due to whitespace in node value', () => {
    const norm1 = service.parseNormalizeAll(xml1);
    const norm2 = service.parseNormalizeAll(xml2);
    // They should not be strictly equal after normalization, because the whitespace is semantically different
    assert.notStrictEqual(
      norm1,
      norm2,
      'XMLs with different text node whitespace should not be equal',
    );
  });

  it('should match except for the whitespace in RefreshRate node', () => {
    // Extract the RefreshRate node values
    const match1 = xml1.match(/<Spec name="RefreshRate">(.*?)<\/Spec>/);
    const match2 = xml2.match(/<Spec name="RefreshRate">(.*?)<\/Spec>/);
    assert.ok(match1 && match2);
    assert.strictEqual(match1[1], '60Hz');
    assert.strictEqual(match2[1], '60 Hz');
  });

  it('should treat the XMLs as equal if whitespace in text nodes is ignored', () => {
    // Simulate normalization that ignores whitespace differences in text nodes
    const ignoreWhitespace = (xml: string) =>
      xml.replace(
        /<Spec name="RefreshRate">\s*60\s*Hz\s*<\/Spec>/g,
        '<Spec name="RefreshRate">60Hz</Spec>',
      );
    const norm1 = ignoreWhitespace(service.parseNormalizeAll(xml1));
    const norm2 = ignoreWhitespace(service.parseNormalizeAll(xml2));
    assert.strictEqual(norm1, norm2, 'XMLs should be equal if whitespace in text nodes is ignored');
  });
});
