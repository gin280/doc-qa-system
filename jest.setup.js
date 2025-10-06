// jest.setup.js
// Add custom jest matchers from jest-dom
import '@testing-library/jest-dom'

// Load environment variables for testing
require('dotenv').config({ path: '.env.local' })

// Set test environment variables for Supabase (if not already set)
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key'

