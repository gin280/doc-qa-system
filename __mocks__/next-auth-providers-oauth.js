// Generic mock for next-auth OAuth providers (Google, GitHub, etc.)
module.exports = {
  __esModule: true,
  default: jest.fn((config) => ({
    id: config?.id || 'oauth',
    name: config?.name || 'OAuth',
    type: 'oauth',
    clientId: config?.clientId || 'mock-client-id',
    clientSecret: config?.clientSecret || 'mock-client-secret',
    authorization: config?.authorization || {},
  })),
}
