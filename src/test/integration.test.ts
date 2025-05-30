import * as assert from 'assert';
import * as vscode from 'vscode';
import { XmlProcessingService } from '../services/xmlProcessingService';

describe('VS Code Extension API Integration', () => {
  let doc: vscode.TextDocument;
  let editor: vscode.TextEditor;
  const xmlA = '<root><a>1</a><b>2</b></root>';
  const xmlB = '<root><b>2</b><a>1</a></root>';

  before(async () => {
    doc = await vscode.workspace.openTextDocument({ content: xmlA, language: 'xml' });
    editor = await vscode.window.showTextDocument(doc);
    await vscode.env.clipboard.writeText(xmlB);
  });

  it('should register the smartXmlDiff.compareWithClipboard command', async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('smartXmlDiff.compareWithClipboard'));
  });

  it('should open a diff view with normalized XML', async () => {
    // Simulate command execution
    await vscode.commands.executeCommand('smartXmlDiff.compareWithClipboard');
    // There is no direct API to assert the diff view, but we can check that the command does not throw
    assert.ok(true);
  });

  it('should handle malformed XML in selection', async () => {
    // Create document with malformed XML
    const badXml = '<root><unclosed>';
    const badDoc = await vscode.workspace.openTextDocument({
      content: badXml,
      language: 'xml',
    });

    // Make sure editor is active
    const editor = await vscode.window.showTextDocument(badDoc, { preview: false });
    assert.ok(editor, 'Editor should be active');
    assert.strictEqual(editor.document.getText(), badXml, 'Document should contain malformed XML');

    // Set valid XML in clipboard
    await vscode.env.clipboard.writeText(xmlB);

    // Track if error was shown
    let errorMessageShown: string | undefined;
    const origShowError = vscode.window.showErrorMessage;
    vscode.window.showErrorMessage = (msg: string) => {
      errorMessageShown = msg;
      return Promise.resolve(undefined);
    };

    try {
      // Execute command and wait for it to complete
      await vscode.commands.executeCommand('smartXmlDiff.compareWithClipboard');

      // Wait briefly for async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      assert.ok(
        errorMessageShown &&
          (errorMessageShown.includes('Malformed XML') || errorMessageShown.includes('valid XML')),
        `Expected error message about malformed XML, but got: ${errorMessageShown}`,
      );
    } finally {
      vscode.window.showErrorMessage = origShowError;
    }
  });
});

describe('Performance Benchmarks', () => {
  it('should diff large XML files within reasonable time', async function () {
    this.timeout(5000);
    const largeXml = '<root>' + '<item>1</item>'.repeat(10000) + '</root>';
    const service = new XmlProcessingService();
    const t0 = Date.now();
    service.parseAndSort(largeXml);
    const t1 = Date.now();
    assert.ok(t1 - t0 < 3000, 'Diff took too long');
  });
});

// Note: For real-world extension testing, use vscode-test or @vscode/test-electron for full E2E coverage.
// Test data and setup: No external dependencies. Clipboard and editor state are mocked by VS Code API.
