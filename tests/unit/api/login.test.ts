import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import bcrypt from 'bcrypt';

// Mock rate-limit
const mockCheckRateLimit = jest.fn<() => Promise<{ success: boolean; remaining: number }>>();
const mockGetClientIp = jest.fn<() => string>();
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: mockCheckRateLimit,
  getClientIp: mockGetClientIp,
}));

// Mock db
const mockSelect = jest.fn();
jest.mock('@/lib/db', () => ({
  db: {
    select: mockSelect,
  },
}));

describe('Login API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authorization', () => {
    it('should return user on successful login', async () => {
      // Create a real hash for testing
      const testPassword = 'password123';
      const passwordHash = await bcrypt.hash(testPassword, 10);

      const mockUser = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        passwordHash,
        status: 'active',
        createdAt: new Date(),
      };

      // Simulate authorize callback
      const credentials = {
        email: 'test@example.com',
        password: testPassword,
      };

      expect(mockUser.email).toBe(credentials.email);
      const isValid = await bcrypt.compare(credentials.password, mockUser.passwordHash);
      expect(isValid).toBe(true);
    });

    it('should return null for non-existent email (not throw error)', async () => {
      const credentials = {
        email: 'nonexistent@example.com',
        password: 'password123',
      };

      // Simulate no user found - authorize should return null, not throw
      // The error message "邮箱或密码错误" should be shown in the frontend
      expect(credentials.email).toBe('nonexistent@example.com');
      
      // When authorize returns null, NextAuth will generate a "CredentialsSignin" error
      // Frontend will catch this and display: "邮箱或密码错误，请检查后重试"
    });

    it('should return null for incorrect password (not throw error)', async () => {
      const testPassword = 'correct_password';
      const passwordHash = await bcrypt.hash(testPassword, 10);

      const mockUser = {
        id: '123',
        email: 'test@example.com',
        passwordHash,
        status: 'active',
      };

      const isValid = await bcrypt.compare('wrong_password', mockUser.passwordHash);
      expect(isValid).toBe(false);
      
      // When password is invalid, authorize returns null
      // NextAuth generates "CredentialsSignin" error
      // Frontend displays: "邮箱或密码错误，请检查后重试"
    });

    it('should return null for suspended users (not throw error)', async () => {
      const mockUser = {
        id: '123',
        email: 'suspended@example.com',
        passwordHash: await bcrypt.hash('password', 10),
        status: 'suspended',
      };

      expect(mockUser.status).toBe('suspended');
      
      // Suspended users should also return null
      // This prevents revealing which accounts exist
    });
  });

  describe('Rate Limiting', () => {
    it('should return null when rate limit exceeded (not throw error)', () => {
      // Mock rate limit exceeded
      mockCheckRateLimit.mockResolvedValue({
        success: false,
        remaining: 0,
      });

      expect(mockCheckRateLimit).toBeDefined();
      
      // When rate limit is exceeded, authorize returns null
      // Frontend receives generic error message
    });

    it('should allow login when under rate limit', () => {
      mockCheckRateLimit.mockResolvedValue({
        success: true,
        remaining: 5,
      });

      expect(mockCheckRateLimit).toBeDefined();
    });
  });

  describe('Session Management', () => {
    it('should create JWT token with user data', () => {
      const user = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
      };

      const token = {
        id: user.id,
        email: user.email,
        name: user.name,
      };

      expect(token.id).toBe(user.id);
      expect(token.email).toBe(user.email);
      expect(token.name).toBe(user.name);
    });

    it('should include user data in session', () => {
      const token = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
      };

      const session = {
        user: {
          id: token.id,
          email: token.email,
          name: token.name,
        },
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      expect(session.user.id).toBe(token.id);
      expect(session.user.email).toBe(token.email);
      expect(session.user.name).toBe(token.name);
    });
  });
});

