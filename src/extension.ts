// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { isFileSizeWithinLimit } from './utils/fileUtils';
import { XmlProcessingService } from './services/xmlProcessingService';
import * as path from 'path';

export class XmlDiffHandler implements vscode.Disposable {
    private readonly outputChannel: vscode.OutputChannel;
    private readonly xmlService: XmlProcessingService;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Smart XML Diff');
        this.xmlService = new XmlProcessingService();
    }

    private validateXml(xml: string, source: string): void {
        try {
            this.xmlService.parseNormalizeAll(xml);
        } catch (e) {
            throw new Error(`${source} XML validation failed: ${e instanceof Error ? e.message : String(e)}`);
        }
    }

    private async getClipboardContent(): Promise<string> {
        try {
            const content = await vscode.env.clipboard.readText();
            if (!content) {
                throw new Error('Clipboard is empty');
            }
            return content;
        } catch (e) {
            throw new Error('Failed to access clipboard. Please check your system clipboard permissions.');
        }
    }

    private async showDiff(xmlA: string, xmlB: string, fileName: string): Promise<void> {
        const leftDoc = await vscode.workspace.openTextDocument({
            content: xmlA,
            language: 'xml',
        });
        const rightDoc = await vscode.workspace.openTextDocument({
            content: xmlB,
            language: 'xml',
        });

        const title = `XML Diff: ${fileName} ↔ Clipboard`;
        await vscode.commands.executeCommand('vscode.diff', leftDoc.uri, rightDoc.uri, title);
    }

    async compareWithClipboard(editor: vscode.TextEditor): Promise<void> {
        this.outputChannel.clear();
        this.outputChannel.show();

        if (!isFileSizeWithinLimit(editor.document)) {
            throw new Error('File exceeds 10MB size limit.');
        }

        // Get and validate selected XML first
        const selection = editor.selection;
        const selectedXml = !selection.isEmpty ? editor.document.getText(selection) : editor.document.getText();
        this.validateXml(selectedXml, 'Selected');

        // Get and validate clipboard content
        const clipboardXml = await this.getClipboardContent();
        this.validateXml(clipboardXml, 'Clipboard');

        // If we get here, both XMLs are valid, so normalize and show diff
        const normalizedA = this.xmlService.parseNormalizeAll(selectedXml);
        const normalizedB = this.xmlService.parseNormalizeAll(clipboardXml);
        await this.showDiff(normalizedA, normalizedB, path.basename(editor.document.fileName));
    }

    dispose(): void {
        this.outputChannel.dispose();
    }
}

export function activate(context: vscode.ExtensionContext): void {
    const diffHandler = new XmlDiffHandler();

    const compareWithClipboard = vscode.commands.registerCommand(
        'smartXmlDiff.compareWithClipboard',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                await vscode.window.showErrorMessage('No active editor found.');
                return;
            }

            try {
                await diffHandler.compareWithClipboard(editor);
            } catch (e) {
                const message = e instanceof Error ? e.message : String(e);
                await vscode.window.showErrorMessage(message);
            }
        },
    );

    context.subscriptions.push(compareWithClipboard);
    context.subscriptions.push(diffHandler);
}

export function deactivate(): void {
    // Cleanup is handled by VS Code's disposal of subscriptions
}
