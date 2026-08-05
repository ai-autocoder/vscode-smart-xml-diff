import { XMLParser, XMLValidator } from 'fast-xml-parser';

export interface XmlNormalizationOptions {
  /**
   * Preserve leading/trailing whitespace in text and attribute values. Whitespace-only text
   * between the children of an element without other text is formatting and always dropped.
   */
  preserveLeadingTrailingWhitespaceInText: boolean;
  /** Collapse multiple spaces/tabs/newlines in text nodes and attribute values to a single space. */
  normalizeWhitespaceInTextNodes: boolean;
  /** Whether to pretty-print the output XML. */
  prettyPrintOutput: boolean;
  /** The string used for indentation when pretty-printing. */
  indentationString: string;
}

export const defaultXmlNormalizationOptions: XmlNormalizationOptions = {
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

// Keys of the parser's `preserveOrder: true` output. Each node is an object with one key naming
// it (TEXT_KEY, `?target` for a processing instruction, or the element name) whose value is the
// text or the child nodes, plus ATTRIBUTES_KEY for attributes (named with ATTRIBUTE_PREFIX).
const TEXT_KEY = '#text';
const ATTRIBUTES_KEY = ':@';
const ATTRIBUTE_PREFIX = '@_';
/** Only XML whitespace: unlike `\s` and trim(), this excludes e.g. the no-break space U+00A0. */
const XML_WHITESPACE_ONLY = /^[ \t\r\n]*$/;
/** The parser renames `__proto__` elements to this, which is not a valid XML name. */
const PROTO_ELEMENT_KEY = '#__proto__';

type ParsedNode = Record<string, unknown>;

/** An attribute value, or `true` for a name without a value (only in processing instructions). */
type Attribute = [name: string, value: string | true];

interface ElementNode {
  kind: 'element';
  name: string;
  attributes: Attribute[];
  children: XmlNode[];
}

type XmlNode =
  | { kind: 'text'; text: string }
  | { kind: 'pi'; target: string; attributes: Attribute[] }
  | ElementNode;

/** Orders names by UTF-16 code units: unlike localeCompare, independent of the host locale. */
function compareNames(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function sortKey(node: XmlNode): string {
  return node.kind === 'element' ? node.name : node.kind === 'pi' ? `?${node.target}` : '';
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&apos;',
  '"': '&quot;',
};

function escapeXml(text: string): string {
  return text.replace(/[&<>'"]/g, (ch) => ESCAPES[ch]);
}

function readAttributes(node: ParsedNode): Attribute[] {
  const attributes = (node[ATTRIBUTES_KEY] ?? {}) as Record<string, string | true>;
  return Object.entries(attributes).map(([name, value]) => [
    name.slice(ATTRIBUTE_PREFIX.length),
    value,
  ]);
}

/** Converts the parser's output into XmlNodes, joining adjacent text and CDATA into one node. */
function readNodes(parsed: ParsedNode[]): XmlNode[] {
  const nodes: XmlNode[] = [];
  for (const node of parsed) {
    const key = Object.keys(node).find((k) => k !== ATTRIBUTES_KEY);
    if (key === undefined) {
      continue;
    }
    const last = nodes[nodes.length - 1];
    // An element named `#text` (malformed input that XMLValidator lets through) has children.
    const value = node[key];
    if (key === TEXT_KEY && typeof value === 'string') {
      if (last?.kind === 'text') {
        last.text += value;
      } else {
        nodes.push({ kind: 'text', text: value });
      }
    } else if (key.startsWith('?')) {
      nodes.push({ kind: 'pi', target: key.slice(1), attributes: readAttributes(node) });
    } else {
      nodes.push({
        kind: 'element',
        name: key === PROTO_ELEMENT_KEY ? '__proto__' : key,
        attributes: readAttributes(node),
        children: readNodes(value as ParsedNode[]),
      });
    }
  }
  return nodes;
}

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
  private readonly options: XmlNormalizationOptions;

  constructor(options?: Partial<XmlNormalizationOptions>) {
    this.options = { ...defaultXmlNormalizationOptions, ...options };

    const parserOptions = {
      // Elements cannot have attributes without a value (XMLValidator rejects them); this lets
      // the parser read the content of processing instructions such as `<?target data?>`.
      allowBooleanAttributes: true,
      ignoreAttributes: false,
      // Keep text and attribute values exactly as written: coercing them to numbers would
      // make e.g. `1.10` equal to `1.1` and rewrite `007` as `7`.
      parseTagValue: false,
      parseAttributeValue: false,
      // Keep the children of each element in document order, with text in between, so that
      // mixed content keeps its order and sorting is done (or not) by normalizeContent.
      preserveOrder: true,
      // Whitespace is handled by normalizeContent: trimming every text node would glue the
      // words of mixed content such as `<p>Hello <b>big</b> world</p>` together.
      trimValues: false,
      processEntities: false,
      htmlEntities: false,
      ignoreComments: true, // Comments are typically ignored for semantic diff
    };

    this.parser = new XMLParser(parserOptions);
    // Reads text and attribute values exactly like `parser`, but keeps CDATA content apart, in
    // the grouped layout that assertSupportedEntityReferences walks.
    this.entityCheckParser = new XMLParser({
      ...parserOptions,
      preserveOrder: false,
      cdataPropName: CDATA_KEY,
    });
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

  /** Collapses internal whitespace and trims, as configured. */
  private normalizeValue(value: string): string {
    let normalized = this.options.normalizeWhitespaceInTextNodes
      ? value.replace(/\s+/g, ' ')
      : value;
    if (!this.options.preserveLeadingTrailingWhitespaceInText) {
      normalized = normalized.trim();
    }
    return normalized;
  }

  /**
   * Normalizes an element's attributes and content in place. Each pass over the tree recurses
   * once per level, without callbacks in between, so that deep nesting fits on the stack.
   */
  private normalizeElement(element: ElementNode): void {
    for (const attribute of element.attributes) {
      if (typeof attribute[1] === 'string') {
        attribute[1] = this.normalizeValue(attribute[1]);
      }
    }
    element.attributes.sort(([a], [b]) => compareNames(a, b));
    for (const child of element.children) {
      if (child.kind === 'element') {
        this.normalizeElement(child);
      }
    }
    element.children = this.normalizeContent(element.children);
  }

  /**
   * Normalizes the whitespace and order of an element's children (whose own content is already
   * normalized). Processing instructions are not attributes or text, so their content is kept as
   * the parser read it.
   */
  private normalizeContent(children: XmlNode[]): XmlNode[] {
    const markup = children.filter((child) => child.kind !== 'text');
    const text = children.filter((child) => child.kind === 'text');

    if (markup.length === 0) {
      // Text only (readNodes joined it into at most one node).
      const value = this.normalizeValue(text.map((child) => child.text).join(''));
      return value === '' ? [] : [{ kind: 'text', text: value }];
    }

    if (text.every((child) => XML_WHITESPACE_ONLY.test(child.text))) {
      // Element content: the whitespace between children is formatting, and their order is
      // not significant except among same-name siblings (Array.prototype.sort is stable).
      return markup.sort((a, b) => compareNames(sortKey(a), sortKey(b)));
    }

    // Mixed content: the text and the elements around it are read in order, so keep it, and
    // keep the whitespace between words and elements (trimming only the ends of the content).
    if (this.options.normalizeWhitespaceInTextNodes) {
      for (const child of text) {
        child.text = child.text.replace(/\s+/g, ' ');
      }
    }
    if (!this.options.preserveLeadingTrailingWhitespaceInText) {
      const first = children[0];
      const last = children[children.length - 1];
      if (first.kind === 'text') {
        first.text = first.text.replace(/^[ \t\r\n]+/, '');
      }
      if (last.kind === 'text') {
        last.text = last.text.replace(/[ \t\r\n]+$/, '');
      }
    }
    return children.filter((child) => child.kind !== 'text' || child.text !== '');
  }

  private formatAttributes(attributes: Attribute[], escape: boolean): string {
    let formatted = '';
    for (const [name, value] of attributes) {
      if (value === true) {
        formatted += ` ${name}`;
      } else if (escape) {
        formatted += ` ${name}="${escapeXml(value)}"`;
      } else {
        // Processing instruction content is not parsed for references, so it is not escaped.
        formatted += value.includes('"') ? ` ${name}='${value}'` : ` ${name}="${value}"`;
      }
    }
    return formatted;
  }

  /** Serializes a node on one line, for mixed content (where whitespace is significant). */
  private serializeInline(node: XmlNode): string {
    if (node.kind === 'text') {
      return escapeXml(node.text);
    }
    if (node.kind === 'pi') {
      return `<?${node.target}${this.formatAttributes(node.attributes, false)}?>`;
    }
    // Always `<tag></tag>`, never `<tag/>`, so that both forms of an empty element match.
    let serialized = `<${node.name}${this.formatAttributes(node.attributes, true)}>`;
    for (const child of node.children) {
      serialized += this.serializeInline(child);
    }
    return `${serialized}</${node.name}>`;
  }

  /** Serializes a node one child element per line, unless its content is text or mixed. */
  private serializePretty(node: XmlNode, depth: number, lines: string[]): void {
    const indent = this.options.indentationString.repeat(depth);
    if (
      node.kind !== 'element' ||
      node.children.length === 0 ||
      node.children.some((child) => child.kind === 'text')
    ) {
      lines.push(indent + this.serializeInline(node));
      return;
    }
    lines.push(`${indent}<${node.name}${this.formatAttributes(node.attributes, true)}>`);
    for (const child of node.children) {
      this.serializePretty(child, depth + 1, lines);
    }
    lines.push(`${indent}</${node.name}>`);
  }

  private serialize(nodes: XmlNode[]): string {
    if (!this.options.prettyPrintOutput) {
      return nodes.map((node) => this.serializeInline(node)).join('');
    }
    const lines: string[] = [];
    for (const node of nodes) {
      this.serializePretty(node, 0, lines);
    }
    return lines.join('\n');
  }

  parseNormalizeAll(xml: string): string {
    // Validate exactly the string that gets parsed, so that e.g. a newline before the XML
    // declaration is accepted. Error positions therefore count from the first non-whitespace
    // character.
    const trimmedXml = this.validateXmlBasics(xml);

    const validationResult = XMLValidator.validate(trimmedXml, {
      allowBooleanAttributes: false,
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
      const parsed: unknown = this.parser.parse(trimmedXml);

      // XMLValidator rejects documents without a root element, so this is not expected.
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('XML parsing failed - result is empty.');
      }

      // The document's top level is kept in order: the XML declaration has to stay first, and
      // there is only one root element. Text there is whitespace between the prolog items.
      const document = readNodes(parsed).filter((node) => node.kind !== 'text');
      for (const node of document) {
        if (node.kind === 'element') {
          this.normalizeElement(node);
        }
      }

      return this.serialize(document);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      if (errorMessage.toLowerCase().startsWith('malformed xml')) {
        throw new Error(errorMessage);
      }
      throw new Error(`XML processing error: ${errorMessage}`);
    }
  }
}
