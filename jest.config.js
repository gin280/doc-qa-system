// jest.config.js
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/drizzle', '<rootDir>/tests'],
  modulePaths: ['<rootDir>'],
  moduleDirectories: ['node_modules', '<rootDir>'],
  moduleNameMapper: {
    // Mock next-auth to avoid ESM issues
    '^next-auth$': '<rootDir>/__mocks__/next-auth.js',
    '^next-auth/providers/credentials$': '<rootDir>/__mocks__/next-auth-providers-credentials.js',
    '^next-auth/providers/google$': '<rootDir>/__mocks__/next-auth-providers-oauth.js',
    '^next-auth/providers/github$': '<rootDir>/__mocks__/next-auth-providers-oauth.js',
    '^next-auth/(.*)$': '<rootDir>/__mocks__/next-auth.js',
    // CRITICAL: More specific patterns MUST come first!
    // Specific drizzle/schema mapping with extension (most specific)
    '^@/drizzle/schema\\.ts$': '<rootDir>/drizzle/schema.ts',
    '^@/drizzle/schema$': '<rootDir>/drizzle/schema.ts',
    // Direct drizzle imports (handles bare imports like 'drizzle/schema')
    '^drizzle/(.*)$': '<rootDir>/drizzle/$1',
    // Map ANY relative drizzle imports (any number of ../ levels)
    // This catches ../../../../drizzle/*, ../../../drizzle/*, etc.
    '^(?:\\.\\./)+drizzle/(.*)$': '<rootDir>/drizzle/$1',
    // Map @/drizzle to drizzle directory (for @/drizzle/schema)
    '^@/drizzle/(.*)$': '<rootDir>/drizzle/$1',
    // Map src imports (but NOT @/drizzle/* which is handled above)
    '^@/(?!drizzle)(.*)$': '<rootDir>/src/$1',
  },
  // Transform TypeScript and JavaScript files
  transform: {
    '^.+\\.(ts|tsx)$': ['@swc/jest', {
      jsc: {
        parser: {
          syntax: 'typescript',
          tsx: true,
        },
        transform: {
          react: {
            runtime: 'automatic',
          },
        },
        // Remove baseUrl and paths - let Jest's moduleNameMapper handle all path resolution
        // This prevents SWC from incorrectly transforming @/drizzle/* to src/drizzle/*
      },
    }],
    '^.+\\.js$': ['@swc/jest', {
      jsc: {
        parser: {
          syntax: 'ecmascript',
        },
      },
    }],
  },
  testMatch: [
    '**/__tests__/**/*.{js,jsx,ts,tsx}',
    '**/?(*.)+(spec|test).{js,jsx,ts,tsx}'
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    'drizzle/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
  ],
  // Resolve modules
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  // Transform ESM modules (exclude these from ignore so they get transformed)
  transformIgnorePatterns: [
    'node_modules/(?!(file-type|next-auth|@auth|nanoid)/)',
  ],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)

