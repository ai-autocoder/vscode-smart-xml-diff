import * as assert from 'assert';

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
