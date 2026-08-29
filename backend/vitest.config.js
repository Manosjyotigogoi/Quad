export default {
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    // Tests can be slow when starting the in-memory mongo for the first
    // time (it downloads mongod on first run).
    testTimeout: 30000,
    hookTimeout: 60000
  }
};
