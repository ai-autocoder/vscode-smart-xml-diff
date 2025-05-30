// NodeSorter: Sorts XML nodes alphabetically by tag name (case-sensitive)
// Handles nested elements recursively, preserves attributes, values, namespaces, and structure
// Usage: NodeSorter.sort(xmlNode)

export class NodeSorter {
    /**
     * Recursively sorts the children of the given XML node by tag name.
     * @param node The XML node (object) to sort
     * @returns A new node with sorted children
     */
    static sort(node: any): any {
        if (typeof node !== 'object' || node === null) return node;
        if (Array.isArray(node)) {
            // Sort each node in the array
            return node.map(child => NodeSorter.sort(child));
        }
        // Separate attributes and children
        const sortedNode: any = {};
        // Copy attributes (keys starting with '@_' in fast-xml-parser)
        for (const key of Object.keys(node)) {
            if (key.startsWith('@_')) {
                sortedNode[key] = node[key];
            }
        }
        // Sort child elements by tag name
        const childKeys = Object.keys(node).filter(k => !k.startsWith('@_') && k !== '#text');
        childKeys.sort(); // Case-sensitive alphabetical order
        for (const key of childKeys) {
            const value = node[key];
            if (Array.isArray(value)) {
                // Sort each child in the array
                sortedNode[key] = value.map(child => NodeSorter.sort(child));
            } else {
                sortedNode[key] = NodeSorter.sort(value);
            }
        }
        // Preserve text nodes and other special keys
        if (node['#text'] !== undefined) {
            sortedNode['#text'] = node['#text'];
        }
        return sortedNode;
    }

    /**
     * Recursively sorts the children of the given XML node by tag name and normalizes attributes.
     * Attributes are sorted alphabetically by name.
     * @param node The XML node (object) to sort and normalize
     * @returns A new node with sorted children and normalized attributes
     */
    static sortAndNormalizeAttributes(node: any): any {
        if (typeof node !== 'object' || node === null) {
            return node;
        }
        if (Array.isArray(node)) {
            return node.map(child => NodeSorter.sortAndNormalizeAttributes(child));
        }
        const sortedNode: any = {};
        // Collect and sort attributes (keys starting with '@_')
        const attrKeys = Object.keys(node).filter(k => k.startsWith('@_'));
        attrKeys.sort();
        for (const key of attrKeys) {
            sortedNode[key] = node[key];
        }
        // Sort child elements by tag name
        const childKeys = Object.keys(node).filter(k => !k.startsWith('@_') && k !== '#text');
        childKeys.sort();
        for (const key of childKeys) {
            const value = node[key];
            if (Array.isArray(value)) {
                sortedNode[key] = value.map(child => NodeSorter.sortAndNormalizeAttributes(child));
            } else {
                sortedNode[key] = NodeSorter.sortAndNormalizeAttributes(value);
            }
        }
        // Preserve text nodes and other special keys
        if (node['#text'] !== undefined) {
            sortedNode['#text'] = node['#text'];
        }
        return sortedNode;
    }
}
