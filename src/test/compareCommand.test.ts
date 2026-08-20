import * as assert from 'assert';
import * as vscode from 'vscode';
import { EXPIRED_COMPARISON_TEXT } from '../extension';

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

  it('releases the normalized documents once their diff is closed', async () => {
    await openXmlEditor('<r><a>1</a></r>');
    await vscode.env.clipboard.writeText('<r><a>2</a></r>');
    assert.deepStrictEqual(await runCommandCapturingErrors(), []);
    const diff = await waitFor(activeDiffInput);
    assert.ok(diff);
    // Read through the documents the diff editor opened: openTextDocument() would hold them open.
    const isOpen = (uri: vscode.Uri) =>
      vscode.workspace.textDocuments.some((doc) => doc.uri.toString() === uri.toString());
    const original = await waitFor(() =>
      vscode.workspace.textDocuments.find((doc) => doc.uri.toString() === diff.original.toString()),
    );
    assert.strictEqual(original?.getText(), '<r>\n  <a>1</a>\n</r>');

    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    const closed = await waitFor(() => !isOpen(diff.original) && !isOpen(diff.modified), 10000);
    assert.ok(closed, 'VS Code should dispose the documents of the closed diff');

    // Asking for them again, as reopening the closed tab does, no longer finds their content.
    assert.strictEqual(await textOf(diff.original), EXPIRED_COMPARISON_TEXT);
    assert.strictEqual(await textOf(diff.modified), EXPIRED_COMPARISON_TEXT);
  });

  it('names each comparison after the session, so restored tabs never share its documents', async () => {
    // The counter starts again after a window reload; without the session part, the first new
    // comparison would reuse the URIs of the first restored one.
    await openXmlEditor('<r/>');
    await vscode.env.clipboard.writeText('<r/>');
    assert.deepStrictEqual(await runCommandCapturingErrors(), []);
    const diff = await waitFor(activeDiffInput);
    assert.ok(diff);
    const id = /^\/right\/([0-9a-z]+-\d+)\/clipboard\.xml$/.exec(diff.modified.path)?.[1];
    assert.ok(id, `unexpected path ${diff.modified.path}`);
    assert.ok(diff.original.path.startsWith(`/left/${id}/`), diff.original.path);
  });

  it('explains that a comparison it no longer holds has expired', async () => {
    // As for a diff tab restored after a window reload.
    const uri = vscode.Uri.from({ scheme: 'smartXmlDiff', path: '/left/0/restored.xml' });
    assert.strictEqual(await textOf(uri), EXPIRED_COMPARISON_TEXT);
  });

  it('compares a small selection of a document larger than 10MB', async function () {
    this.timeout(60000);
    const editor = await openXmlEditor('<a>1</a>\n<!--' + 'x'.repeat(11 * 1024 * 1024) + '-->');
    editor.selection = new vscode.Selection(0, 0, 0, '<a>1</a>'.length);
    await vscode.env.clipboard.writeText('<a>2</a>');

    assert.deepStrictEqual(await runCommandCapturingErrors(), []);
    const diff = await waitFor(activeDiffInput);
    assert.ok(diff);
    assert.strictEqual(await textOf(diff.original), '<a>1</a>');
  });

  it('reports a whole document of 10MB or more without opening a diff', async function () {
    this.timeout(60000);
    await openXmlEditor('<a>1</a>\n<!--' + 'x'.repeat(11 * 1024 * 1024) + '-->');
    await vscode.env.clipboard.writeText('<a>2</a>');

    assert.deepStrictEqual(await runCommandCapturingErrors(), [
      'Smart XML Diff Error: Selected XML (from editor/selection) exceeds the 10MB size limit.',
    ]);
    assert.strictEqual(activeDiffInput(), undefined);
  });

  it('reports clipboard XML of 10MB or more without opening a diff', async function () {
    this.timeout(60000);
    await openXmlEditor('<r/>');
    await vscode.env.clipboard.writeText('<r>' + 'x'.repeat(10 * 1024 * 1024) + '</r>');
    try {
      const errors = await runCommandCapturingErrors();
      assert.deepStrictEqual(errors, [
        'Smart XML Diff Error: Clipboard XML exceeds the 10MB size limit.',
      ]);
      assert.strictEqual(activeDiffInput(), undefined);
    } finally {
      await vscode.env.clipboard.writeText('');
    }
  });

  it('opens the diff of a non-XML document without waiting for its warning to be dismissed', async () => {
    await openXmlEditor('<r><a>1</a></r>', 'plaintext');
    await vscode.env.clipboard.writeText('<r/>');
    const warnings: string[] = [];
    const original = vscode.window.showWarningMessage;
    // Like a real notification without buttons, it settles only once the user dismisses it.
    (vscode.window as any).showWarningMessage = (message: string) => {
      warnings.push(message);
      return new Promise(() => {});
    };
    try {
      const errors = await Promise.race([
        runCommandCapturingErrors(),
        new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 3000)),
      ]);
      assert.notStrictEqual(errors, 'timeout', 'the command should not wait for the warning');
      assert.deepStrictEqual(errors, []);
      assert.deepStrictEqual(warnings, ['Smart XML Diff: This command is intended for XML files.']);
      const diff = await waitFor(activeDiffInput);
      assert.ok(diff);
      assert.strictEqual(await textOf(diff.original), '<r>\n  <a>1</a>\n</r>');
    } finally {
      (vscode.window as any).showWarningMessage = original;
    }
  });

  it('reports an empty or whitespace-only clipboard as empty', async () => {
    await openXmlEditor('<r/>');
    for (const clipboard of ['', ' \n\t']) {
      await vscode.env.clipboard.writeText(clipboard);
      assert.deepStrictEqual(
        await runCommandCapturingErrors(),
        [
          'Smart XML Diff Error: Clipboard is empty or contains only whitespace. Please copy XML content to the clipboard.',
        ],
        JSON.stringify(clipboard),
      );
      assert.strictEqual(activeDiffInput(), undefined);
    }
  });

  it('keeps a file name containing # and ? in the path of the diff document', async () => {
    const doc = await vscode.workspace.openTextDocument(
      vscode.Uri.from({ scheme: 'untitled', path: '/weird#na?me.xml' }),
    );
    const editor = await vscode.window.showTextDocument(doc, { preview: false });
    await editor.edit((edit) => edit.insert(new vscode.Position(0, 0), '<r><a>1</a></r>'));
    await vscode.env.clipboard.writeText('<r/>');

    assert.deepStrictEqual(await runCommandCapturingErrors(), []);
    const diff = await waitFor(activeDiffInput);
    assert.ok(diff);
    // No second .xml extension, and nothing of the name taken as a query or fragment.
    assert.match(diff.original.path, /^\/left\/[0-9a-z]+-\d+\/weird#na\?me\.xml$/);
    assert.strictEqual(diff.original.query, '');
    assert.strictEqual(diff.original.fragment, '');
    assert.strictEqual(await textOf(diff.original), '<r>\n  <a>1</a>\n</r>');
    const left = await vscode.workspace.openTextDocument(diff.original);
    assert.strictEqual(left.languageId, 'xml');
    const label = vscode.window.tabGroups.activeTabGroup.activeTab?.label;
    assert.strictEqual(label, 'XML Diff: weird#na?me.xml ↔ Clipboard');
  });

  it('reports when there is no active editor', async () => {
    const errors = await runCommandCapturingErrors();
    assert.deepStrictEqual(errors, ['Smart XML Diff: No active editor found.']);
  });
});
