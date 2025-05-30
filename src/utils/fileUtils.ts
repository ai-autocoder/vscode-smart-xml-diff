import * as vscode from 'vscode';

export async function getSelectedXmlOrDocument(
  editor: vscode.TextEditor,
): Promise<string | undefined> {
  const selection = editor.selection;
  if (!selection.isEmpty) {
    return editor.document.getText(selection);
  }
  return editor.document.getText();
}

export function isUtf8(document: vscode.TextDocument): boolean {
  // VS Code always loads text documents as UTF-8 internally
  return document.encoding === undefined || document.encoding === 'utf8';
}

export function isFileSizeWithinLimit(
  document: vscode.TextDocument,
  maxBytes = 10 * 1024 * 1024,
): boolean {
  // VS Code TextDocument provides line count and text length, but not raw file size
  // Approximate by Buffer.byteLength
  const text = document.getText();
  return Buffer.byteLength(text, 'utf8') <= maxBytes;
}

export interface XmlDiffConfig {
  indentation: 'spaces' | 'tabs';
  sortAttributes: boolean;
}

export function getXmlDiffConfig(): XmlDiffConfig {
  const config = vscode.workspace.getConfiguration('smartXmlDiff');
  let indentation = config.get<string>('indentation', 'spaces');
  if (indentation !== 'spaces' && indentation !== 'tabs') {
    indentation = 'spaces';
  }
  const sortAttributes = config.get<boolean>('sortAttributes', false);
  return { indentation: indentation as 'spaces' | 'tabs', sortAttributes };
}
