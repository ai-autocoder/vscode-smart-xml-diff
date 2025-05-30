// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { isFileSizeWithinLimit } from './utils/fileUtils';
import { XmlProcessingService } from './services/xmlProcessingService';
import * as path from 'path';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "xml-diff" is now active!');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  const disposable = vscode.commands.registerCommand('xml-diff.helloWorld', () => {
    // The code you place here will be executed every time your command is executed
    // Display a message box to the user
    vscode.window.showInformationMessage('Hello World from XML Diff!');
  });

  context.subscriptions.push(disposable);

  const outputChannel = vscode.window.createOutputChannel('Smart XML Diff');

  const compareWithClipboard = vscode.commands.registerCommand(
    'smartXmlDiff.compareWithClipboard',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor found.');
        return;
      }
      const document = editor.document;
      if (!isFileSizeWithinLimit(document)) {
        vscode.window.showWarningMessage('File exceeds 10MB size limit.');
        return;
      }
      const selection = editor.selection;
      const selectedXml = !selection.isEmpty ? document.getText(selection) : document.getText();
      let clipboardXml: string;
      try {
        clipboardXml = await vscode.env.clipboard.readText();
      } catch (e) {
        outputChannel.appendLine(
          `[ERROR] Clipboard access failure: ${e instanceof Error ? e.message : String(e)}`,
        );
        vscode.window.showErrorMessage(
          'Failed to access clipboard. Please check your system clipboard permissions.',
        );
        return;
      }
      const xmlService = new XmlProcessingService();
      let normalizedA: string | undefined = undefined;
      let normalizedB: string | undefined = undefined;
      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Normalizing and preparing XML for diff...',
            cancellable: false,
          },
          async (progress) => {
            progress.report({ increment: 10, message: 'Parsing selection...' });
            normalizedA = xmlService.parseNormalizeAll(selectedXml);
            progress.report({ increment: 50, message: 'Parsing clipboard...' });
            normalizedB = xmlService.parseNormalizeAll(clipboardXml);
            progress.report({ increment: 100, message: 'Preparing diff view...' });
          },
        );
      } catch (e: any) {
        outputChannel.appendLine(
          `[ERROR] XML processing failure: ${e instanceof Error ? e.message : String(e)}`,
        );
        if (e instanceof RangeError || (e && e.message && e.message.match(/allocation|memory/i))) {
          vscode.window.showErrorMessage(
            'Memory limit exceeded while processing XML. Try a smaller selection or file.',
          );
          return;
        }
        vscode.window.showErrorMessage(
          'Malformed XML in selection or clipboard. Please ensure both are valid XML.',
        );
        return;
      }
      if (!normalizedA || !normalizedB) {
        outputChannel.appendLine(
          '[ERROR] Normalization failed: One or both XML inputs could not be normalized.',
        );
        vscode.window.showErrorMessage(
          'Failed to normalize XML for diff. Please check your input.',
        );
        return;
      }
      // Create untitled documents for diff
      const leftDoc = await vscode.workspace.openTextDocument({
        content: normalizedA,
        language: 'xml',
      });
      const rightDoc = await vscode.workspace.openTextDocument({
        content: normalizedB,
        language: 'xml',
      });
      const leftUri = leftDoc.uri;
      const rightUri = rightDoc.uri;
      const fileName = path.basename(document.fileName);
      const title = `XML Diff: ${fileName} ↔ Clipboard`;
      await vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, title);
    },
  );
  context.subscriptions.push(compareWithClipboard);
}

// This method is called when your extension is deactivated
export function deactivate() {}
