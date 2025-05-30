import { XMLParser, XMLBuilder, XMLValidator } from 'fast-xml-parser';

export class XmlProcessingService {
    private readonly parser: XMLParser;
    private readonly builder: XMLBuilder;

    constructor() {
        const parserOptions = {
            allowBooleanAttributes: true,
            ignoreAttributes: false,
            parseAttributeValue: true,
            preserveOrder: false,
            trimValues: false,
            unpairedTags: [],
            suppressBooleanAttributes: false,
            suppressEmptyNode: false,
            parseTrueNumberOnly: true,
            stopNodes: ['**.'],
            processEntities: false,
            htmlEntities: false
        };
        const builderOptions = {
            ...parserOptions,
            format: false, // disables pretty printing
            indentBy: '',
            suppressEmptyNode: false
        };
        this.parser = new XMLParser(parserOptions);
        this.builder = new XMLBuilder(builderOptions);
    }

    private validateXmlBasics(xml: string): void {
        if (!xml || typeof xml !== 'string') {
            throw new Error('Invalid XML input: Input must be a non-empty string');
        }

        const trimmed = xml.trim();
        
        // Basic XML structure validation
        if (!trimmed.startsWith('<')) {
            throw new Error('Malformed XML: Document must start with "<"');
        }
        if (!trimmed.endsWith('>')) {
            throw new Error('Malformed XML: Document must end with ">"');
        }

        // Count angle brackets to detect obvious malformed XML
        const openBrackets = (trimmed.match(/</g) || []).length;
        const closeBrackets = (trimmed.match(/>/g) || []).length;
        
        if (openBrackets !== closeBrackets) {
            throw new Error('Malformed XML: Mismatched angle brackets');
        }

        // Check for invalid XML entities
        // Only allow &lt;, &gt;, &amp;, &apos;, &quot; (predefined XML entities)
        const entityPattern = /&([a-zA-Z0-9]+);/g;
        let match;
        const allowedEntities = new Set(['lt', 'gt', 'amp', 'apos', 'quot']);
        while ((match = entityPattern.exec(trimmed)) !== null) {
            if (!allowedEntities.has(match[1])) {
                throw new Error('Malformed XML: Invalid or unsupported entity');
            }
        }
    }

    private sortNodes(node: any): any {
        if (Array.isArray(node)) {
            return node.map(item => this.sortNodes(item));
        }

        if (node && typeof node === 'object') {
            // Sort child nodes
            const sorted: any = {};
            Object.keys(node)
                .sort((a, b) => a.localeCompare(b))
                .forEach(key => {
                    sorted[key] = this.sortNodes(node[key]);
                });
            return sorted;
        }

        return node;
    }

    parseNormalizeAll(xml: string): string {
        // Initial validation
        this.validateXmlBasics(xml);

        // Use XMLValidator for detailed validation
        const result = XMLValidator.validate(xml, {
            allowBooleanAttributes: true
        });

        if (result !== true) {
            throw new Error(`Malformed XML: ${result.err.msg}`);
        }

        try {
            // Parse XML to object
            const parsed = this.parser.parse(xml.trim());
            if (!parsed || typeof parsed !== 'object') {
                throw new Error('XML parsing failed - empty or invalid result');
            }

            // Sort nodes to normalize structure
            const normalized = this.sortNodes(parsed);

            // Convert back to compact XML string
            let xmlOut = this.builder.build(normalized);
            // Remove redundant whitespace between tags
            xmlOut = xmlOut.replace(/>\s+</g, '><').trim();
            return xmlOut;
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'Unknown XML parsing error';
            throw new Error(`Malformed XML: ${errorMessage}`);
        }
    }
}
