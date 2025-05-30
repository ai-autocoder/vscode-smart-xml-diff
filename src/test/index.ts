import * as path from 'path';
import { default as Mocha } from 'mocha';
import * as glob from 'glob';

export async function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: 'bdd', // Use BDD interface (describe, it, etc)
    color: true, // Enable colored output
    timeout: 100000, // 100s timeout (VS Code tests can be slow)
  });

  try {
    console.log('VS Code test bootstrapper starting...');
    const testFiles = glob.sync('**/*.test.js', {
      cwd: path.resolve(__dirname),
      absolute: true,
    });
    console.log('Found test files:', testFiles);

    // Add files to the test suite
    testFiles.forEach((f) => mocha.addFile(f));
    console.log('Added files to test suite');

    try {
      // Run the mocha test
      await new Promise<void>((resolve, reject) => {
        mocha.run((failures: number) => {
          if (failures > 0) {
            reject(new Error(`${failures} tests failed.`));
          } else {
            resolve();
          }
        });
      });
    } catch (err) {
      console.error('Test execution failed:', err);
      throw err;
    }

    console.log('All test files completed successfully');
  } catch (err) {
    console.error('Test bootstrapper error:', err);
    throw err;
  }
}
