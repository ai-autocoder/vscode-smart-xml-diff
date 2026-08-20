import * as vscode from 'vscode';
import { isTextWithinSizeLimit } from './utils/fileUtils';
import {
  XmlProcessingService,
  XmlNormalizationOptions,
  defaultXmlNormalizationOptions,
} from './services/xmlProcessingService'; // Ensure correct path
import * as path from 'path';

const SMART_XML_DIFF_SCHEME = 'smartXmlDiff';
let diffCounter = 0; // To ensure unique URIs for each diff operation
// Part of every URI, so that the URIs of tabs restored after a window reload (when diffCounter
// starts again from 0) never match those of a new comparison.
const SESSION_ID = Date.now().toString(36);

/**
 * Shown for a comparison whose content is no longer held, e.g. a diff tab restored after a window
 * reload or reopened after it was closed.
 */
export const EXPIRED_COMPARISON_TEXT =
  '<!-- This comparison has expired. Run "Smart XML Diff: Compare with Clipboard" again. -->';

/**
 * Spaces per indentation level for the `smartXmlDiff.indentation` setting: rounded down and
 * clamped to 0-16, or 2 when it is not a number.
 */
export function indentationWidth(setting: unknown): number {
  if (typeof setting !== 'number' || Number.isNaN(setting)) {
    return 2;
  }
  return Math.min(16, Math.max(0, Math.floor(setting)));
}

// TextDocumentContentProvider for our custom URI scheme
class XmlDiffContentProvider implements vscode.TextDocumentContentProvider {
  private contentMap = new Map<string, string>();

  // emitter and its event
  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  get onDidChange(): vscode.Event<vscode.Uri> {
    return this._onDidChange.event;
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.contentMap.get(uri.toString()) ?? EXPIRED_COMPARISON_TEXT;
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
      return await vscode.env.clipboard.readText();
    } catch (e) {
      this.outputChannel.appendLine(
        `Error accessing clipboard: ${e instanceof Error ? e.message : String(e)}`,
      );
      throw new Error(
        'Failed to access clipboard. Please check your system clipboard permissions.',
      );
    }
  }

  private async showDiff(
    normalizedA: string,
    normalizedB: string,
    baseFileName: string,
  ): Promise<void> {
    diffCounter++;
    const diffId = `${SESSION_ID}-${diffCounter}`;
    // Built from components, so that a '#' or '?' in the file name stays part of the path instead
    // of starting a fragment or query. The .xml extension gives the left side the XML language.
    const leftFileName = /\.xml$/i.test(baseFileName) ? baseFileName : `${baseFileName}.xml`;
    const leftUri = vscode.Uri.from({
      scheme: SMART_XML_DIFF_SCHEME,
      path: `/left/${diffId}/${leftFileName}`,
    });
    const rightUri = vscode.Uri.from({
      scheme: SMART_XML_DIFF_SCHEME,
      path: `/right/${diffId}/clipboard.xml`,
    });

    xmlDiffProvider.setContent(leftUri, normalizedA);
    xmlDiffProvider.setContent(rightUri, normalizedB);

    const diffTitle = `XML Diff: ${baseFileName} ↔ Clipboard`;

    try {
      await vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, diffTitle, {
        preview: false, // Using `false` often makes it behave more like a standard editor tab, which might be desirable. Test `true` vs `false`.
      });
    } catch (e) {
      // No tab will close these documents, so release them here.
      xmlDiffProvider.deleteContent(leftUri);
      xmlDiffProvider.deleteContent(rightUri);
      throw e;
    }
  }

  async compareWithClipboard(editor: vscode.TextEditor): Promise<void> {
    this.outputChannel.clear();

    this.outputChannel.appendLine('Starting XML comparison with clipboard...');

    // Scoped to the document so that folder-level values of resource-scoped settings apply.
    const config = vscode.workspace.getConfiguration('smartXmlDiff', editor.document.uri);

    const currentNormalizationOptions: Partial<XmlNormalizationOptions> = {
      preserveLeadingTrailingWhitespaceInText: config.get<boolean>(
        'preserveLeadingTrailingWhitespace',
        defaultXmlNormalizationOptions.preserveLeadingTrailingWhitespaceInText,
      ),
      normalizeWhitespaceInTextNodes: config.get<boolean>(
        'normalizeWhitespaceInTextNodes',
        defaultXmlNormalizationOptions.normalizeWhitespaceInTextNodes,
      ),
      prettyPrintOutput: true, // Ensure diffs are pretty-printed
      indentationString: ' '.repeat(indentationWidth(config.get('indentation'))),
    };

    const xmlService = new XmlProcessingService(currentNormalizationOptions);

    const selection = editor.selection;
    const selectedXmlOriginal = !selection.isEmpty
      ? editor.document.getText(selection)
      : editor.document.getText();

    if (!selectedXmlOriginal.trim()) {
      this.outputChannel.appendLine('Error: Selected XML content is empty or whitespace only.');
      throw new Error('Selected XML (from editor/selection) is empty or contains only whitespace.');
    }
    if (!isTextWithinSizeLimit(selectedXmlOriginal)) {
      this.outputChannel.appendLine('Error: Selected XML exceeds the 10MB size limit.');
      throw new Error('Selected XML (from editor/selection) exceeds the 10MB size limit.');
    }

    // Both inputs are checked before either is normalized, which can take a while.
    const clipboardXmlOriginal = await this.getClipboardContent();
    if (!clipboardXmlOriginal.trim()) {
      this.outputChannel.appendLine('Error: Clipboard is empty or whitespace only.');
      throw new Error(
        'Clipboard is empty or contains only whitespace. Please copy XML content to the clipboard.',
      );
    }
    if (!isTextWithinSizeLimit(clipboardXmlOriginal)) {
      this.outputChannel.appendLine('Error: Clipboard XML exceeds the 10MB size limit.');
      throw new Error('Clipboard XML exceeds the 10MB size limit.');
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
  // Release a normalized document once VS Code disposes it (normally when its diff tab is closed;
  // a language-mode change also reports a close, but the open document keeps its text), so that
  // comparisons don't accumulate in memory for the whole session.
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((document) => {
      if (document.uri.scheme === SMART_XML_DIFF_SCHEME) {
        xmlDiffProvider.deleteContent(document.uri);
      }
    }),
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
        // Not awaited: a message without buttons only settles once the user dismisses it.
        void vscode.window.showWarningMessage(
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
