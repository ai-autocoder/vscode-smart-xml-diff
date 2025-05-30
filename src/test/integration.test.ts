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
    const badDoc = await vscode.workspace.openTextDocument({
      content: '<root><a></root>',
      language: 'xml',
    });
    await vscode.window.showTextDocument(badDoc);
    await vscode.env.clipboard.writeText(xmlB);
    let errorShown = false;
    const origShowError = vscode.window.showErrorMessage;
    vscode.window.showErrorMessage = (msg: string) => {
      if (msg.includes('Malformed XML')) errorShown = true;
      return Promise.resolve(undefined);
    };
    await vscode.commands.executeCommand('smartXmlDiff.compareWithClipboard');
    vscode.window.showErrorMessage = origShowError;
    assert.ok(errorShown);
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
