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
    // CRITICAL: More specific patterns MUST come first!
    // Map relative drizzle imports (for when @/ gets compiled to relative paths)
    '^\\.\\./\\.\\./drizzle/(.*)$': '<rootDir>/drizzle/$1',
    // Map @/drizzle to drizzle directory (for @/drizzle/schema)
    '^@/drizzle/(.*)$': '<rootDir>/drizzle/$1',
    // Map src imports
    '^@/(.*)$': '<rootDir>/src/$1',
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
  // Transform ESM modules
  transformIgnorePatterns: [
    'node_modules/(?!(file-type|next-auth|@auth)/)',
  ],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)

