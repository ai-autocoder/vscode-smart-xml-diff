import * as assert from 'assert';
import * as vscode from 'vscode';
import { XmlProcessingService } from '../services/xmlProcessingService';
import { XmlDiffHandler } from '../extension';

// Mock VS Code API
const mockShowErrorMessage = async (message: string): Promise<string | undefined> => undefined;
const mockShowTextDocument = async (): Promise<vscode.TextEditor> => ({} as any);
const mockExecuteCommand = async <T>(_command: string, ..._args: any[]): Promise<T> => undefined as any;
const mockCreateOutputChannel = (name: string): vscode.OutputChannel => ({
    name,
    append: () => {},
    appendLine: () => {},
    clear: () => {},
    show: () => {},
    hide: () => {},
    dispose: () => {},
    replace: () => {}
});

describe('Basic Test Suite', () => {
  console.log('Running basic test suite...');

  it('should run a simple test', () => {
    assert.strictEqual(1 + 1, 2);
  });
});

describe('Extension Test Suite', () => {
  console.log('Running extension test suite...');

  it('Sample test', () => {
    assert.strictEqual(-1, [1, 2, 3].indexOf(5));
    assert.strictEqual(-1, [1, 2, 3].indexOf(0));
  });
});

describe('Extension Tests', () => {
    describe('XML Processing', () => {
        let service: XmlProcessingService;

        beforeEach(() => {
            service = new XmlProcessingService();
        });

        it('should process valid XML', () => {
            const input = '<root><a>1</a></root>';
            assert.doesNotThrow(() => {
                service.parseNormalizeAll(input);
            });
        });

        it('should detect malformed XML', () => {
            const input = '<root><unclosed>';
            assert.throws(() => {
                service.parseNormalizeAll(input);
            }, /malformed xml/i);
        });

        it('should normalize differently ordered XML to the same output', () => {
            const input1 = '<root><a>1</a><b>2</b></root>';
            const input2 = '<root><b>2</b><a>1</a></root>';
            
            const result1 = service.parseNormalizeAll(input1);
            const result2 = service.parseNormalizeAll(input2);
            
            assert.strictEqual(result1, result2);
        });

        it('should handle empty elements', () => {
            const input = '<root><empty/></root>';
            assert.doesNotThrow(() => {
                service.parseNormalizeAll(input);
            });
        });

        it('should handle XML with attributes', () => {
            const input = '<root id="1"><node attr="value">test</node></root>';
            const result = service.parseNormalizeAll(input);
            assert.ok(result.includes('id="1"'));
            assert.ok(result.includes('attr="value"'));
        });

        it('should reject invalid XML structures', () => {
            const invalidInputs = [
                '',                    // Empty string
                'not xml at all',     // Plain text
                '<>invalid</>',       // Invalid tags
                '<a>1</b>',           // Mismatched tags
                null,                 // Null input
                undefined            // Undefined input
            ];

            invalidInputs.forEach(input => {
                assert.throws(() => {
                    service.parseNormalizeAll(input as any);
                }, /invalid|malformed/i);
            });
        });

        it('should normalize valid XML', () => {
            const input = '<root><a>1</a></root>';
            const result = service.parseNormalizeAll(input);
            assert.ok(result.includes('<root>'));
            assert.ok(result.includes('</root>'));
        });

        it('should handle formatting variations', () => {
            const inputs = [
                '<root><a>1</a></root>',
                '<root>\n  <a>1</a>\n</root>',
                '<root><a>1</a>\r\n</root>'
            ];

            const results = inputs.map(input => service.parseNormalizeAll(input));
            const firstResult = results[0];
            
            results.forEach(result => {
                assert.strictEqual(result, firstResult, 'All format variations should normalize to the same output');
            });
        });

        it('should preserve XML structure', () => {
            const input = `
                <root>
                    <parent id="1">
                        <child>value</child>
                    </parent>
                </root>
            `.trim();
            
            const result = service.parseNormalizeAll(input);
            assert.ok(result.includes('id="1"'));
            assert.ok(result.includes('<child>value</child>'));
        });

        it('should reject severely malformed XML', () => {
            const testFn = () => service.parseNormalizeAll('not xml at all');
            assert.throws(testFn, /malformed xml/i);
        });
    });

    describe('XmlDiffHandler', () => {
        let handler: XmlDiffHandler;

        beforeEach(() => {
            handler = new XmlDiffHandler();
        });

        it('should create output channel', () => {
            assert.ok(handler instanceof XmlDiffHandler);
        });

        it('should properly dispose resources', () => {
            assert.doesNotThrow(() => {
                handler.dispose();
            });
        });
    });

    describe('Command Registration', () => {
        it('should define expected command', async () => {
            const commands = await vscode.commands.getCommands();
            assert.ok(commands.includes('smartXmlDiff.compareWithClipboard'));
        });
    });

    describe('Extension Module', () => {
        it('should export activate and deactivate functions', () => {
            const extension = require('../extension');
            assert.ok(typeof extension.activate === 'function');
            assert.ok(typeof extension.deactivate === 'function');
        });
    });
});
