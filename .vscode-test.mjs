import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
	files: 'out/test/**/*.test.js',
	// The suites use describe/it; @vscode/test-cli defaults to the 'tdd' UI.
	mocha: { ui: 'bdd', timeout: 60000 },
});
