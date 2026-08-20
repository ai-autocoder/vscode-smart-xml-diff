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

const MAX_INPUT_SIZE = 10 * 1024 * 1024; // 10MB
/** Whether an input to compare (selection, document or clipboard text) is under 10MB in UTF-8. */
export function isTextWithinSizeLimit(text: string): boolean {
  return Buffer.byteLength(text, 'utf8') < MAX_INPUT_SIZE; // Strictly less than limit
}
