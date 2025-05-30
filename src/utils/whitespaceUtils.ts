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
   * Recursively normalize whitespace in XML object tree.
   * @param node XML node (object)
   * @param options Whitespace options
   */
  static normalizeWhitespace(node: any, options: WhitespaceOptions): any {
    if (typeof node !== 'object' || node === null) return node;
    if (Array.isArray(node)) {
      return node.map(child => WhitespaceUtils.normalizeWhitespace(child, options));
    }
    const normalized: any = {};
    for (const key of Object.keys(node)) {
      if (key === '#text' && typeof node[key] === 'string') {
        let text = node[key];
        if (options.ignoreWhitespace) {
          text = text.replace(/\s+/g, ' ');
        }
        if (!options.preserveLeadingTrailingWhitespace) {
          text = text.trim();
        }
        if (options.normalizeWhitespaceInTextNodes) {
          text = text.replace(/[ \t\r\n]+/g, ' ');
        }
        normalized[key] = text;
      } else {
        normalized[key] = WhitespaceUtils.normalizeWhitespace(node[key], options);
      }
    }
    return normalized;
  }
}
