// WhitespaceUtils: Handles whitespace normalization for XML diffing
// Respects user settings for ignoring, preserving, and normalizing whitespace

import * as vscode from 'vscode';

export interface WhitespaceOptions {
  ignoreWhitespace: boolean;
  preserveLeadingTrailingWhitespace: boolean;
  normalizeWhitespaceInTextNodes: boolean;
}

export class WhitespaceUtils {
  static getOptions(): WhitespaceOptions {
    const config = vscode.workspace.getConfiguration('smartXmlDiff');
    return {
      ignoreWhitespace: config.get('ignoreWhitespace', true),
      preserveLeadingTrailingWhitespace: config.get('preserveLeadingTrailingWhitespace', false),
      normalizeWhitespaceInTextNodes: config.get('normalizeWhitespaceInTextNodes', true),
    };
  }

  /**
   * Normalize text content according to whitespace options
   * @param text The text to normalize
   * @param options Whitespace options
   */
  private static normalizeTextContent(text: string, options: WhitespaceOptions): string {
    if (options.ignoreWhitespace) {
      text = text.replace(/\s+/g, ' ');
    }
    if (!options.preserveLeadingTrailingWhitespace) {
      text = text.trim();
    }
    if (options.normalizeWhitespaceInTextNodes) {
      text = text.replace(/[ \t\r\n]+/g, ' ');
    }
    return text;
  }

  /**
   * Recursively normalize whitespace in XML object tree.
   * @param node XML node (object)
   * @param options Whitespace options
   */
  static normalizeWhitespace(node: any, options: WhitespaceOptions): any {
    if (typeof node !== 'object' || node === null) {
      return node;
    }

    if (Array.isArray(node)) {
      return node.map((child) => WhitespaceUtils.normalizeWhitespace(child, options));
    }

    return WhitespaceUtils.normalizeNode(node, options);
  }

  /**
   * Normalize a single node's properties
   * @param node The node to normalize
   * @param options Whitespace options
   */
  private static normalizeNode(node: any, options: WhitespaceOptions): any {
    const normalized: any = {};

    for (const key of Object.keys(node)) {
      if (key === '#text' && typeof node[key] === 'string') {
        normalized[key] = WhitespaceUtils.normalizeTextContent(node[key], options);
      } else {
        normalized[key] = WhitespaceUtils.normalizeWhitespace(node[key], options);
      }
    }

    return normalized;
  }
}
