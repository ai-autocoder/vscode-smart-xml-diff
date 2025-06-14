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

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export function isFileSizeWithinLimit(document: vscode.TextDocument): boolean {
  const text = document.getText();
  const bytes = Buffer.byteLength(text, 'utf8');
  return bytes < MAX_FILE_SIZE; // Strictly less than limit
}
