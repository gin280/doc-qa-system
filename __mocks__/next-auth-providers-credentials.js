// Mock for next-auth/providers/credentials
module.exports = {
  __esModule: true,
  default: jest.fn((config) => ({
    id: 'credentials',
    name: config?.name || 'Credentials',
    type: 'credentials',
    credentials: config?.credentials || {},
    authorize: config?.authorize || jest.fn(),
  })),
}
