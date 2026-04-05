// Jest setup to handle BigInt serialization
expect.addSnapshotSerializer({
  test: val => typeof val === 'bigint',
  print: val => val.toString() + 'n',
});

// Patch global JSON to handle BigInt
const originalStringify = JSON.stringify;
JSON.stringify = function (value, replacer, space) {
  return originalStringify(
    value,
    (key, val) => (typeof val === 'bigint' ? val.toString() : val),
    space
  );
};
