import * as assert from 'assert';
import * as vscode from 'vscode';

// End-to-end tests of the smartXmlDiff.compareWithClipboard command as a user triggers it:
// real editor, real clipboard, real diff tab.

const COMMAND = 'smartXmlDiff.compareWithClipboard';

function activeDiffInput(): vscode.TabInputTextDiff | undefined {
  const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
  return input instanceof vscode.TabInputTextDiff ? input : undefined;
}

async function waitFor<T>(probe: () => T | undefined, timeoutMs = 3000): Promise<T | undefined> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = probe();
    if (value || Date.now() > deadline) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

async function openXmlEditor(content: string, language = 'xml'): Promise<vscode.TextEditor> {
  const doc = await vscode.workspace.openTextDocument({ content, language });
  return vscode.window.showTextDocument(doc, { preview: false });
}

/** Runs the command and returns the error messages it showed. */
async function runCommandCapturingErrors(): Promise<string[]> {
  const shown: string[] = [];
  const original = vscode.window.showErrorMessage;
  (vscode.window as any).showErrorMessage = (message: string) => {
    shown.push(message);
    return Promise.resolve(undefined);
  };
  try {
    await vscode.commands.executeCommand(COMMAND);
  } finally {
    (vscode.window as any).showErrorMessage = original;
  }
  return shown;
}

async function textOf(uri: vscode.Uri): Promise<string> {
  return (await vscode.workspace.openTextDocument(uri)).getText();
}

describe('Compare with Clipboard command (end to end)', function () {
  this.timeout(30000);

  beforeEach(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  after(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  it('opens a diff of the normalized editor XML against the normalized clipboard XML', async () => {
    await openXmlEditor('<root><b>2</b><a>1</a></root>');
    await vscode.env.clipboard.writeText('<root>\n  <a>1</a>\n  <b>3</b>\n</root>');

    assert.deepStrictEqual(await runCommandCapturingErrors(), []);

    const diff = await waitFor(activeDiffInput);
    assert.ok(diff, 'a diff tab should be active');
    assert.strictEqual(diff.original.scheme, 'smartXmlDiff');
    assert.strictEqual(await textOf(diff.original), '<root>\n  <a>1</a>\n  <b>2</b>\n</root>');
    assert.strictEqual(await textOf(diff.modified), '<root>\n  <a>1</a>\n  <b>3</b>\n</root>');

    const label = vscode.window.tabGroups.activeTabGroup.activeTab?.label ?? '';
    assert.match(label, /^XML Diff: .+ ↔ Clipboard$/);
    const left = await vscode.workspace.openTextDocument(diff.original);
    assert.strictEqual(left.languageId, 'xml');
  });

  it('compares only the selection when one exists', async () => {
    const content = '<doc><keep><x>1</x></keep><ignored/></doc>';
    const editor = await openXmlEditor(content);
    const start = content.indexOf('<keep>');
    const end = content.indexOf('</keep>') + '</keep>'.length;
    editor.selection = new vscode.Selection(
      editor.document.positionAt(start),
      editor.document.positionAt(end),
    );
    await vscode.env.clipboard.writeText('<keep><x>1</x></keep>');

    assert.deepStrictEqual(await runCommandCapturingErrors(), []);
    const diff = await waitFor(activeDiffInput);
    assert.ok(diff);
    assert.strictEqual(await textOf(diff.original), '<keep>\n  <x>1</x>\n</keep>');
  });

  it('uses the smartXmlDiff.indentation setting', async () => {
    const config = vscode.workspace.getConfiguration('smartXmlDiff');
    await config.update('indentation', 4, vscode.ConfigurationTarget.Global);
    try {
      await openXmlEditor('<r><a>1</a></r>');
      await vscode.env.clipboard.writeText('<r/>');
      assert.deepStrictEqual(await runCommandCapturingErrors(), []);
      const diff = await waitFor(activeDiffInput);
      assert.ok(diff);
      assert.strictEqual(await textOf(diff.original), '<r>\n    <a>1</a>\n</r>');
    } finally {
      await config.update('indentation', undefined, vscode.ConfigurationTarget.Global);
    }
  });

  it('reports invalid clipboard XML without opening a diff', async () => {
    await openXmlEditor('<r/>');
    await vscode.env.clipboard.writeText('<r><unclosed></r>');
    const errors = await runCommandCapturingErrors();
    assert.strictEqual(errors.length, 1);
    assert.match(errors[0], /^Smart XML Diff Error: Clipboard XML is invalid: Malformed XML/);
    assert.strictEqual(activeDiffInput(), undefined);
  });

  it('reports a whitespace-only selection', async () => {
    const editor = await openXmlEditor('<r/>\n   \n');
    editor.selection = new vscode.Selection(1, 0, 1, 3);
    await vscode.env.clipboard.writeText('<r/>');
    const errors = await runCommandCapturingErrors();
    assert.strictEqual(errors.length, 1);
    assert.match(errors[0], /empty or contains only whitespace/);
  });

  it('reports when there is no active editor', async () => {
    const errors = await runCommandCapturingErrors();
    assert.deepStrictEqual(errors, ['Smart XML Diff: No active editor found.']);
  });
});
