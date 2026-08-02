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

/**
 * Key under which the entity check parser keeps CDATA content apart from text. It contains a
 * space so that it cannot collide with a tag name (the parser ends tag names at whitespace).
 */
const CDATA_KEY = '#cdata section';
const PREDEFINED_ENTITIES = new Set(['lt', 'gt', 'amp', 'apos', 'quot']);

/**
 * Returns the error for the first entity reference in `text` other than the five predefined ones
 * and numeric character references (DTD-defined entities are not supported), if there is one.
 */
function findUnsupportedEntityReference(text: string): string | undefined {
  for (const [, name] of text.matchAll(/&([a-zA-Z0-9#]+);/g)) {
    if (name.startsWith('#')) {
      if (!/^#(?:[0-9]+|x[0-9a-fA-F]+)$/.test(name)) {
        return `Malformed XML: Invalid numeric entity &${name};`;
      }
    } else if (!PREDEFINED_ENTITIES.has(name)) {
      return `Malformed XML: Invalid or unsupported named entity &${name}; (Note: DTD-defined entities are not processed/supported)`;
    }
  }
  return undefined;
}

export class XmlProcessingService {
  private readonly parser: XMLParser;
  private readonly entityCheckParser: XMLParser;
  private readonly builder: XMLBuilder;
  private readonly options: XmlNormalizationOptions;

  constructor(options?: Partial<XmlNormalizationOptions>) {
    this.options = { ...defaultXmlNormalizationOptions, ...options };

    const parserOptions = {
      allowBooleanAttributes: true,
      ignoreAttributes: false,
      // Keep text and attribute values exactly as written: coercing them to numbers would
      // make e.g. `1.10` equal to `1.1` and rewrite `007` as `7`.
      parseTagValue: false,
      parseAttributeValue: false,
      preserveOrder: false,
      trimValues: !this.options.preserveLeadingTrailingWhitespaceInText,
      unpairedTags: [],
      suppressBooleanAttributes: false,
      suppressEmptyNode: false, // Parser option, influences how empty tags might be represented initially
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
    // Reads text and attribute values exactly like `parser`, but keeps CDATA content apart.
    this.entityCheckParser = new XMLParser({ ...parserOptions, cdataPropName: CDATA_KEY });
    this.builder = new XMLBuilder(builderOptions);
  }

  /** Checks that the input is a non-empty string that looks like XML, and returns it trimmed. */
  private validateXmlBasics(xml: string): string {
    if (!xml || typeof xml !== 'string') {
      throw new Error('Invalid XML input: Input must be a non-empty string');
    }

    // trim() also removes a leading byte order mark.
    const trimmed = xml.trim();
    if (trimmed.length === 0) {
      throw new Error('Invalid XML input: Input is an empty string after trimming');
    }

    if (!trimmed.includes('<') && !trimmed.includes('>')) {
      throw new Error('Malformed XML: Does not appear to be XML, missing < and >.');
    }
    return trimmed;
  }

  /**
   * Rejects unsupported entity references in text and attribute values (see
   * findUnsupportedEntityReference). XMLValidator only checks their syntax, and only in text.
   */
  private validateEntityReferences(xml: string): void {
    // Most documents skip the parse: they contain no unsupported reference anywhere, and no `&`
    // that runs into markup (the parser joins the text around markup, so in malformed input that
    // XMLValidator lets through, `&nb<!---->sp;` reads as `&nbsp;`). Otherwise parse to find out
    // whether a reference ends up in text or an attribute value, rather than in a comment, CDATA
    // section or processing instruction (whose content is not parsed for references).
    if (findUnsupportedEntityReference(xml) !== undefined || /&[a-zA-Z0-9#]*\s*</.test(xml)) {
      this.assertSupportedEntityReferences(this.entityCheckParser.parse(xml));
    }
  }

  private assertSupportedEntityReferences(node: unknown): void {
    if (typeof node === 'string') {
      const error = findUnsupportedEntityReference(node);
      if (error) {
        throw new Error(error);
      }
    } else if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) {
        // Skip CDATA sections and processing instructions (keyed by `?target`). Check names too:
        // in malformed input that XMLValidator lets through, they can contain references.
        if (key !== CDATA_KEY && !key.startsWith('?')) {
          this.assertSupportedEntityReferences(key);
          this.assertSupportedEntityReferences(value);
        }
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
    // Validate exactly the string that gets parsed, so that e.g. a newline before the XML
    // declaration is accepted. Error positions therefore count from the first non-whitespace
    // character.
    const trimmedXml = this.validateXmlBasics(xml);

    const validationResult = XMLValidator.validate(trimmedXml, {
      allowBooleanAttributes: true,
    });

    if (validationResult !== true) {
      throw new Error(
        `Malformed XML (validator): ${validationResult.err.msg} at line ${validationResult.err.line}, column ${validationResult.err.col}`,
      );
    }

    // XMLValidator accepts some truncated input such as `<a/` (the parser then fails with a
    // TypeError). A complete document always ends with `>`: the root end tag, a comment or a
    // processing instruction.
    if (!trimmedXml.endsWith('>')) {
      throw new Error("Malformed XML: Incomplete document, expected it to end with '>'");
    }

    try {
      this.validateEntityReferences(trimmedXml);
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
