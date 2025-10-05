// Mock for next-auth ESM module
// NextAuth v5 uses a function that returns handlers and auth methods
const mockAuth = jest.fn()
const mockSignIn = jest.fn()
const mockSignOut = jest.fn()
const mockUpdate = jest.fn()

// Main NextAuth function that returns handlers and methods
const NextAuth = jest.fn(() => ({
  handlers: {
    GET: jest.fn(),
    POST: jest.fn(),
  },
  auth: mockAuth,
  signIn: mockSignIn,
  signOut: mockSignOut,
}))

// Export as default function for NextAuth(config) pattern
module.exports = NextAuth

// Also export named exports for compatibility
module.exports.auth = mockAuth
module.exports.signIn = mockSignIn
module.exports.signOut = mockSignOut
module.exports.update = mockUpdate

