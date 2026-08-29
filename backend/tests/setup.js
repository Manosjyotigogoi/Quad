import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

// Vitest global setup — spins up an in-memory MongoDB (mongodb-memory-server)
// before the test suite runs and tears it down afterward. Each test file
// can `mongoose.connect(globalThis.__MONGO_URI__)` or rely on the shared
// connection we set up here. We also clear all collections between test
// files so test isolation holds without the overhead of a fresh server
// per file.

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  globalThis.__MONGO_URI__ = uri;
  process.env.MONGO_URI = uri;
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-not-for-prod';
  process.env.COLLEGE_EMAIL_DOMAIN = 'example.edu';
  // Connect the default mongoose connection so model-level queries work.
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }
});

afterEach(async () => {
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key of Object.keys(collections)) {
      await collections[key].deleteMany({});
    }
  }
});

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});
