import * as path from 'path';
import * as glob from 'glob';
const Mocha = require('mocha');

export async function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: 'bdd',
    timeout: 60000,
    color: true,
  });

  try {
    // Find all test files
    const testsRoot = path.resolve(__dirname);
    const files = glob.sync('**/*.test.js', { cwd: testsRoot });

    console.log('Found test files:', files);

    // Add them to mocha
    files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));

    // Run tests
    return new Promise<void>((resolve, reject) => {
      try {
        mocha.run((failures: number) => {
          if (failures > 0) {
            reject(new Error(`${failures} tests failed.`));
          } else {
            resolve();
          }
        });
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}
