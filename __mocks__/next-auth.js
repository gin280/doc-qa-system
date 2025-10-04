// Mock for next-auth ESM module
module.exports = {
  auth: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
  update: jest.fn(),
}

