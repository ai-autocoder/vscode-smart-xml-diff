import * as vscode from 'vscode';
import { isFileSizeWithinLimit } from './utils/fileUtils'; // Assuming this file exists and is correct
import {
  XmlProcessingService,
  XmlNormalizationOptions,
  defaultXmlNormalizationOptions,
} from './services/xmlProcessingService'; // Ensure correct path
import * as path from 'path';

const SMART_XML_DIFF_SCHEME = 'smartXmlDiff';
let diffCounter = 0; // To ensure unique URIs for each diff operation

// TextDocumentContentProvider for our custom URI scheme
class XmlDiffContentProvider implements vscode.TextDocumentContentProvider {
  private contentMap = new Map<string, string>();

  // emitter and its event
  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  get onDidChange(): vscode.Event<vscode.Uri> {
    return this._onDidChange.event;
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.contentMap.get(uri.toString()) || '';
  }

  setContent(uri: vscode.Uri, content: string): void {
    this.contentMap.set(uri.toString(), content);
    this._onDidChange.fire(uri); // Notify VS Code that content for this URI might have changed (though for diff, it's usually static)
  }

  deleteContent(uri: vscode.Uri): void {
    this.contentMap.delete(uri.toString());
  }

  clearAllContentForScheme(): void {
    // Iterate and delete only if they match our scheme
    // Or, if sure only our URIs are in map, just clear.
    // This is safer if other things somehow used the map.
    const keysToDelete: string[] = [];
    this.contentMap.forEach((_value, key) => {
      if (vscode.Uri.parse(key).scheme === SMART_XML_DIFF_SCHEME) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((key) => this.contentMap.delete(key));
  }
}

// Instantiate the provider globally for the extension's lifetime
const xmlDiffProvider = new XmlDiffContentProvider();

export class XmlDiffHandler implements vscode.Disposable {
  private readonly outputChannel: vscode.OutputChannel;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Smart XML Diff');
  }

  private async getClipboardContent(): Promise<string> {
    try {
      const content = await vscode.env.clipboard.readText();
      if (!content) {
        throw new Error('Clipboard is empty. Please copy XML content to the clipboard.');
      }
      return content;
    } catch (e) {
      this.outputChannel.appendLine(
        `Error accessing clipboard: ${e instanceof Error ? e.message : String(e)}`,
      );
      throw new Error(
        'Failed to access clipboard. Please check your system clipboard permissions and ensure content is copied.',
      );
    }
  }

  private async showDiff(
    normalizedA: string,
    normalizedB: string,
    baseFileName: string,
  ): Promise<void> {
    diffCounter++;
    const leftUri = vscode.Uri.parse(
      `${SMART_XML_DIFF_SCHEME}:/left/${diffCounter}/${baseFileName}.xml`,
    );
    const rightUri = vscode.Uri.parse(
      `${SMART_XML_DIFF_SCHEME}:/right/${diffCounter}/clipboard.xml`,
    );

    xmlDiffProvider.setContent(leftUri, normalizedA);
    xmlDiffProvider.setContent(rightUri, normalizedB);

    const diffTitle = `XML Diff: ${path.basename(baseFileName)} ↔ Clipboard`;

    try {
      await vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, diffTitle, {
        preview: false, // Using `false` often makes it behave more like a standard editor tab, which might be desirable. Test `true` vs `false`.
      });
    } finally {
    }
  }

  async compareWithClipboard(editor: vscode.TextEditor): Promise<void> {
    this.outputChannel.clear();

    this.outputChannel.appendLine('Starting XML comparison with clipboard...');

    if (!isFileSizeWithinLimit(editor.document)) {
      this.outputChannel.appendLine('Error: File exceeds 10MB size limit.');
      throw new Error('File exceeds 10MB size limit.');
    }

    const config = vscode.workspace.getConfiguration('smartXmlDiff');
    const userIndentationSpaces = config.get<number>('indentation');

    const currentNormalizationOptions: Partial<XmlNormalizationOptions> = {
      ignoreInsignificantWhitespace: config.get<boolean>(
        'ignoreWhitespace',
        defaultXmlNormalizationOptions.ignoreInsignificantWhitespace,
      ),
      preserveLeadingTrailingWhitespaceInText: config.get<boolean>(
        'preserveLeadingTrailingWhitespace',
        defaultXmlNormalizationOptions.preserveLeadingTrailingWhitespaceInText,
      ),
      normalizeWhitespaceInTextNodes: config.get<boolean>(
        'normalizeWhitespaceInTextNodes',
        defaultXmlNormalizationOptions.normalizeWhitespaceInTextNodes,
      ),
      prettyPrintOutput: true, // Ensure diffs are pretty-printed
    };

    if (userIndentationSpaces !== undefined) {
      currentNormalizationOptions.indentationString = ' '.repeat(
        Math.max(0, userIndentationSpaces),
      );
    }

    const xmlService = new XmlProcessingService(currentNormalizationOptions);

    const selection = editor.selection;
    const selectedXmlOriginal = !selection.isEmpty
      ? editor.document.getText(selection)
      : editor.document.getText();

    if (!selectedXmlOriginal.trim()) {
      this.outputChannel.appendLine('Error: Selected XML content is empty or whitespace only.');
      throw new Error('Selected XML (from editor/selection) is empty or contains only whitespace.');
    }

    let normalizedA: string;
    try {
      this.outputChannel.appendLine('Normalizing XML from selection/editor...');
      normalizedA = xmlService.parseNormalizeAll(selectedXmlOriginal);
      this.outputChannel.appendLine('Successfully normalized XML from selection/editor.');
    } catch (e) {
      const errorMsg = `Selected XML (from editor/selection) is invalid: ${e instanceof Error ? e.message : String(e)}`;
      this.outputChannel.appendLine(`Error: ${errorMsg}`);
      throw new Error(errorMsg);
    }

    const clipboardXmlOriginal = await this.getClipboardContent();
    let normalizedB: string;
    try {
      this.outputChannel.appendLine('Normalizing XML from clipboard...');
      normalizedB = xmlService.parseNormalizeAll(clipboardXmlOriginal);
      this.outputChannel.appendLine('Successfully normalized XML from clipboard.');
    } catch (e) {
      const errorMsg = `Clipboard XML is invalid: ${e instanceof Error ? e.message : String(e)}`;
      this.outputChannel.appendLine(`Error: ${errorMsg}`);
      throw new Error(errorMsg);
    }

    this.outputChannel.appendLine('Both XML sources normalized. Showing diff...');
    await this.showDiff(normalizedA, normalizedB, path.basename(editor.document.fileName));
  }

  dispose(): void {
    this.outputChannel.dispose();
    // Clean up any remaining content in the provider when the handler is disposed
    xmlDiffProvider.clearAllContentForScheme();
  }
}

export function activate(context: vscode.ExtensionContext): void {
  // Register the TextDocumentContentProvider for our custom scheme
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(SMART_XML_DIFF_SCHEME, xmlDiffProvider),
  );

  const diffHandler = new XmlDiffHandler();
  context.subscriptions.push(diffHandler); // diffHandler needs to be disposed

  const compareWithClipboardCommand = vscode.commands.registerCommand(
    'smartXmlDiff.compareWithClipboard',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        await vscode.window.showErrorMessage('Smart XML Diff: No active editor found.');
        return;
      }
      if (editor.document.languageId !== 'xml') {
        await vscode.window.showWarningMessage(
          'Smart XML Diff: This command is intended for XML files.',
        );
      }

      try {
        await diffHandler.compareWithClipboard(editor);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        await vscode.window.showErrorMessage(`Smart XML Diff Error: ${message}`);
      }
    },
  );

  context.subscriptions.push(compareWithClipboardCommand);
}

export function deactivate(): void {
  xmlDiffProvider.clearAllContentForScheme();
}
