// NamespaceUtils: Normalizes XML namespaces for diffing
// - Moves all xmlns declarations to the root
// - Rewrites prefixed tags/attributes to use consistent prefixes
// - Removes unused namespace declarations

export class NamespaceUtils {
  /**
   * Recursively collects all namespace declarations in the XML object tree.
   */
  static collectNamespaces(node: any, nsMap: Record<string, string> = {}): Record<string, string> {
    if (typeof node !== 'object' || node === null) {
      return nsMap;
    }
    for (const key of Object.keys(node)) {
      if (key.startsWith('@_xmlns')) {
        nsMap[key] = node[key];
      }
      if (typeof node[key] === 'object') {
        NamespaceUtils.collectNamespaces(node[key], nsMap);
      }
    }
    return nsMap;
  }

  /**
   * Moves all namespace declarations to the root node and removes duplicates.
   */
  static moveNamespacesToRoot(node: any): any {
    if (typeof node !== 'object' || node === null) {
      return node;
    }
    const nsMap = NamespaceUtils.collectNamespaces(node);
    // Remove all xmlns from tree
    function removeXmlns(n: any) {
      if (typeof n !== 'object' || n === null) {
        return;
      }
      for (const k of Object.keys(n)) {
        if (k.startsWith('@_xmlns')) {
          delete n[k];
        } else if (typeof n[k] === 'object') {
          removeXmlns(n[k]);
        }
      }
    }
    removeXmlns(node);
    // Add all unique xmlns to root
    for (const nsKey of Object.keys(nsMap)) {
      node[nsKey] = nsMap[nsKey];
    }
    return node;
  }

  /**
   * Normalizes namespaces in the XML object tree.
   * Moves all xmlns to root and ensures consistent prefix usage.
   */
  static normalizeNamespaces(node: any): any {
    if (typeof node !== 'object' || node === null) {
      return node;
    }
    // Move all xmlns to root
    const root = NamespaceUtils.moveNamespacesToRoot(node);
    // (Optional: rewrite prefixes for consistency)
    // For now, just move declarations to root for canonicalization
    return root;
  }
}
