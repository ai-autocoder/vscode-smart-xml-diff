import { XMLParser, XMLBuilder, XMLValidator } from 'fast-xml-parser';

export interface XmlNormalizationOptions {
  /** Ignore/collapse insignificant whitespace between element tags.
   * If `prettyPrintOutput` is true, the builder handles spacing.
   * If `prettyPrintOutput` is false, this controls if `>\s+<` becomes `><`.
   */
  ignoreInsignificantWhitespace: boolean;
  /** Preserve leading/trailing whitespace in text nodes and attribute values. */
  preserveLeadingTrailingWhitespaceInText: boolean;
  /** Collapse multiple spaces/tabs/newlines in text nodes and attribute values to a single space. */
  normalizeWhitespaceInTextNodes: boolean;
  /** Whether to pretty-print the output XML. */
  prettyPrintOutput: boolean;
  /** The string used for indentation when pretty-printing. */
  indentationString: string;
}

export const defaultXmlNormalizationOptions: XmlNormalizationOptions = {
  ignoreInsignificantWhitespace: true,
  preserveLeadingTrailingWhitespaceInText: false,
  normalizeWhitespaceInTextNodes: true,
  prettyPrintOutput: true, // Default to pretty-printed output for diffs
  indentationString: '  ', // Default to two spaces for indentation
};

export class XmlProcessingService {
  private readonly parser: XMLParser;
  private readonly builder: XMLBuilder;
  private readonly options: XmlNormalizationOptions;

  constructor(options?: Partial<XmlNormalizationOptions>) {
    this.options = { ...defaultXmlNormalizationOptions, ...options };

    const parserOptions = {
      allowBooleanAttributes: true,
      ignoreAttributes: false,
      parseAttributeValue: true,
      preserveOrder: false,
      trimValues: !this.options.preserveLeadingTrailingWhitespaceInText,
      unpairedTags: [],
      suppressBooleanAttributes: false,
      suppressEmptyNode: false, // Parser option, influences how empty tags might be represented initially
      parseTrueNumberOnly: true,
      processEntities: false,
      htmlEntities: false,
      ignoreComments: true, // Comments are typically ignored for semantic diff
    };

    const builderOptions = {
      // Inherit relevant options from parser for consistency where applicable
      // but override formatting and entity processing for builder's role.
      allowBooleanAttributes: parserOptions.allowBooleanAttributes,
      ignoreAttributes: parserOptions.ignoreAttributes, // Must be false to build attributes
      suppressBooleanAttributes: parserOptions.suppressBooleanAttributes,
      suppressEmptyNode: false, // Output <tag></tag> for consistency, not <tag/>

      format: this.options.prettyPrintOutput,
      indentBy: this.options.prettyPrintOutput ? this.options.indentationString : '',

      processEntities: true, // Builder should always encode entities (e.g. '&' to '&') in text/attribute values
      // preserveOrder: parserOptions.preserveOrder, // Not directly applicable/needed for builder in this way
    };

    this.parser = new XMLParser(parserOptions);
    this.builder = new XMLBuilder(builderOptions);
  }

  private validateXmlBasics(xml: string): void {
    if (!xml || typeof xml !== 'string') {
      throw new Error('Invalid XML input: Input must be a non-empty string');
    }

    const trimmed = xml.trim();
    if (trimmed.length === 0) {
      throw new Error('Invalid XML input: Input is an empty string after trimming');
    }

    const openBrackets = (trimmed.match(/</g) || []).length;
    const closeBrackets = (trimmed.match(/>/g) || []).length;

    if (
      openBrackets === 0 &&
      closeBrackets === 0 &&
      !trimmed.startsWith('<') &&
      !trimmed.startsWith('<?xml')
    ) {
      throw new Error('Malformed XML: Does not appear to be XML, missing < and >.');
    }
    if (openBrackets !== closeBrackets) {
      throw new Error('Malformed XML: Mismatched angle brackets');
    }

    const entityPattern = /&([a-zA-Z0-9#]+);/g;
    let match;
    const allowedNamedEntities = new Set(['lt', 'gt', 'amp', 'apos', 'quot']);
    while ((match = entityPattern.exec(trimmed)) !== null) {
      const entityName = match[1];
      if (entityName.startsWith('#')) {
        if (!/^#(?:[0-9]+|x[0-9a-fA-F]+)$/.test(entityName)) {
          throw new Error(`Malformed XML: Invalid numeric entity &${entityName};`);
        }
      } else if (!allowedNamedEntities.has(entityName)) {
        throw new Error(
          `Malformed XML: Invalid or unsupported named entity &${entityName}; (Note: DTD-defined entities are not processed/supported)`,
        );
      }
    }
  }

  private normalizeTextContent(node: any): any {
    if (typeof node === 'string') {
      let processedNode = node;
      // `trimValues` in parser handles leading/trailing based on `preserveLeadingTrailingWhitespaceInText`.
      // This step focuses on internal whitespace normalization.
      if (this.options.normalizeWhitespaceInTextNodes) {
        processedNode = processedNode.replace(/\s+/g, ' ');
        // If after collapsing, the node is just a single space and wasn't originally,
        // and we are trimming, it should become empty.
        // However, `trimValues` in parser handles this better.
        // If `preserveLeadingTrailingWhitespaceInText` is false, `trimValues` is true.
        // If `preserveLeadingTrailingWhitespaceInText` is true, `trimValues` is false.
        // So, if node was "  " and `trimValues` is true, it's already empty before this.
        // If node was "  " and `trimValues` is false, it's "  ", then `\s+` -> " ", then `trim()` would make it empty.
        // But we should only trim if `!preserveLeadingTrailingWhitespaceInText`.
        // The parser's `trimValues` is the main leading/trailing control.
        // This `replace` is for *internal* collapsing. The subsequent `trim()` here is a safeguard.
        if (!this.options.preserveLeadingTrailingWhitespaceInText) {
          processedNode = processedNode.trim();
        }
      }
      return processedNode;
    }

    if (Array.isArray(node)) {
      return node.map((item) => this.normalizeTextContent(item));
    }

    if (node && typeof node === 'object') {
      const normalized: any = {};
      for (const key in node) {
        if (Object.prototype.hasOwnProperty.call(node, key)) {
          // For attributes (prefixed with '@_' by default by fast-xml-parser if not ignoring attributes)
          // their values should also be normalized if they are strings.
          normalized[key] = this.normalizeTextContent(node[key]);
        }
      }
      return normalized;
    }
    return node;
  }

  private sortNodes(node: any): any {
    if (Array.isArray(node)) {
      return node.map((item) => this.sortNodes(item));
    }

    if (node && typeof node === 'object') {
      const sorted: any = {};
      Object.keys(node)
        .sort((a, b) => a.localeCompare(b))
        .forEach((key) => {
          sorted[key] = this.sortNodes(node[key]);
        });
      return sorted;
    }
    return node;
  }

  parseNormalizeAll(xml: string): string {
    this.validateXmlBasics(xml);

    const validationResult = XMLValidator.validate(xml, {
      allowBooleanAttributes: true,
    });

    if (validationResult !== true) {
      throw new Error(
        `Malformed XML (validator): ${validationResult.err.msg} at line ${validationResult.err.line}, column ${validationResult.err.col}`,
      );
    }

    try {
      const trimmedXml = xml.trim();
      let parsed = this.parser.parse(trimmedXml);

      if (!parsed || typeof parsed !== 'object' || Object.keys(parsed).length === 0) {
        if (
          Object.keys(parsed).length === 0 &&
          trimmedXml.length > 0 &&
          !trimmedXml.match(/^<\?xml.*\?>$/) &&
          !trimmedXml.match(/^<!--.*-->$/)
        ) {
          throw new Error(
            'XML parsing failed - result is empty despite non-empty input that is not just a declaration or comment.',
          );
        }
      }

      if (
        this.options.normalizeWhitespaceInTextNodes ||
        !this.options.preserveLeadingTrailingWhitespaceInText
      ) {
        parsed = this.normalizeTextContent(parsed);
      }

      const sortedAndNormalized = this.sortNodes(parsed);

      let xmlOut = this.builder.build(sortedAndNormalized);

      // If pretty printing is disabled and we want to ignore insignificant whitespace,
      // perform an aggressive collapse of space between tags.
      // If pretty printing is enabled, the builder handles formatting.
      if (!this.options.prettyPrintOutput && this.options.ignoreInsignificantWhitespace) {
        xmlOut = xmlOut.replace(/>\s+</g, '><');
      }

      // Always trim the final output string (removes leading/trailing newlines from pretty print or any extra space).
      return xmlOut.trim();
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      if (errorMessage.toLowerCase().startsWith('malformed xml')) {
        throw new Error(errorMessage);
      }
      throw new Error(`XML processing error: ${errorMessage}`);
    }
  }
}
