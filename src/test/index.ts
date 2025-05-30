import * as path from 'path';
import * as glob from 'glob';

module.exports.run = function () {
  console.log('VS Code test bootstrapper: loading test files...');
  glob.sync(path.resolve(__dirname, '*.test.js')).forEach((file) => {
    console.log('Requiring test file:', file);
    require(file);
  });
};
