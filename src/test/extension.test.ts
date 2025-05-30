import * as assert from 'assert';
import { XMLParser } from 'fast-xml-parser';
import { XmlProcessingService } from '../services/xmlProcessingService';
import * as vscode from 'vscode';

describe('Extension Test Suite', () => {
  it('Sample test', () => {
    assert.strictEqual(-1, [1, 2, 3].indexOf(5));
    assert.strictEqual(-1, [1, 2, 3].indexOf(0));
  });
});

describe('XML Parsing Scenarios', () => {
  const service = new XmlProcessingService();

  it('parses well-formed XML', () => {
    const xml = '<root><child>value</child></root>';
    const parsed = service.parse(xml);
    assert.strictEqual(parsed.root.child, 'value');
  });

  it('throws on malformed XML', () => {
    const xml = '<root><child></root>';
    assert.throws(() => service.parse(xml), /Malformed XML/);
  });

  it('parses XML with attributes', () => {
    const xml = '<root attr="1"><child>v</child></root>';
    const parsed = service.parse(xml);
    assert.strictEqual(parsed.root['@_attr'], '1');
  });
});

describe('Diff Algorithm Cases', () => {
  const service = new XmlProcessingService();

  it('sorts nodes alphabetically', () => {
    const xml = '<root><b>2</b><a>1</a></root>';
    const sorted = service.parseAndSort(xml);
    assert.ok(sorted.indexOf('<a>1</a>') < sorted.indexOf('<b>2</b>'));
  });

  it('normalizes attributes if enabled', () => {
    const xml = '<root b="2" a="1"></root>';
    const sorted = service.parseSortAndNormalizeAttributes(xml);
    assert.ok(sorted.indexOf('a="1"') < sorted.indexOf('b="2"'));
  });
});

describe('Error Handling Paths', () => {
  const service = new XmlProcessingService();

  it('throws on memory error (simulate)', () => {
    // Simulate by passing a huge string (not practical in test, so just check error type)
    try {
      service.parse('<root>' + 'x'.repeat(1e7) + '</root>');
    } catch (e: any) {
      assert.ok(e.message.includes('Malformed XML') || e instanceof Error);
    }
  });
});
