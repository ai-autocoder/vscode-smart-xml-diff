import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { NodeSorter } from '../utils/nodeSorter';
import { WhitespaceUtils, WhitespaceOptions } from '../utils/whitespaceUtils';
import { NamespaceUtils } from '../utils/namespaceUtils';

export class XmlProcessingService {
  private parser: XMLParser;
  private builder: XMLBuilder;

  constructor() {
    // Enable pretty print with 2-space indentation for diff view
    this.parser = new XMLParser({ ignoreAttributes: false });
    this.builder = new XMLBuilder({
      ignoreAttributes: false,
      format: true,
      indentBy: '  ', // 2 spaces
      suppressEmptyNode: false, // always show <tag></tag> for empty nodes
    });
  }

  parse(xml: string): any {
    try {
      return this.parser.parse(xml);
    } catch (e) {
      // Attach a custom error for malformed XML
      const err = new Error('Malformed XML');
      (err as any).original = e;
      throw err;
    }
  }

  build(obj: any): string {
    return this.builder.build(obj);
  }

  /**
   * Parses and sorts an XML string by tag name using NodeSorter.
   * @param xml XML string
   * @returns Sorted XML string
   */
  parseAndSort(xml: string): string {
    const parsed = this.parse(xml);
    const sorted = NodeSorter.sort(parsed);
    return this.build(sorted);
  }

  /**
   * Parses and sorts an XML string by tag name and normalizes attributes.
   * @param xml XML string
   * @returns Sorted and attribute-normalized XML string
   */
  parseSortAndNormalizeAttributes(xml: string): string {
    const parsed = this.parse(xml);
    const sorted = NodeSorter.sortAndNormalizeAttributes(parsed);
    return this.build(sorted);
  }

  /**
   * Parses, normalizes whitespace, sorts nodes and attributes for XML string.
   * @param xml XML string
   * @param whitespaceOptions Whitespace normalization options
   * @returns XML string with whitespace, node, and attribute normalization
   */
  parseNormalizeWhitespaceSortAndNormalizeAttributes(
    xml: string,
    whitespaceOptions?: WhitespaceOptions,
  ): string {
    const parsed = this.parse(xml);
    const options = whitespaceOptions || WhitespaceUtils.getOptions();
    const whitespaceNormalized = WhitespaceUtils.normalizeWhitespace(parsed, options);
    const sorted = NodeSorter.sortAndNormalizeAttributes(whitespaceNormalized);
    return this.build(sorted);
  }

  /**
   * Parses, normalizes whitespace, sorts nodes and attributes, and normalizes namespaces for XML string.
   * @param xml XML string
   * @param whitespaceOptions Whitespace normalization options
   * @returns XML string with whitespace, node, attribute, and namespace normalization
   */
  parseNormalizeAll(xml: string, whitespaceOptions?: WhitespaceOptions): string {
    const parsed = this.parse(xml);
    const options = whitespaceOptions || WhitespaceUtils.getOptions();
    const whitespaceNormalized = WhitespaceUtils.normalizeWhitespace(parsed, options);
    const sorted = NodeSorter.sortAndNormalizeAttributes(whitespaceNormalized);
    const nsNormalized = NamespaceUtils.normalizeNamespaces(sorted);
    return this.build(nsNormalized);
  }
}
