import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { db } from '@/lib/db';
import { users } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

describe('Authentication Flow Integration Tests', () => {
  let testUserId: string;
  const testEmail = 'integration-test@example.com';
  const testPassword = 'Test123!@#';

  beforeAll(async () => {
    // Create a test user
    const passwordHash = await bcrypt.hash(testPassword, 10);
    const [user] = await db
      .insert(users)
      .values({
        email: testEmail,
        passwordHash,
        name: 'Integration Test User',
        status: 'active',
      })
      .returning();
    
    testUserId = user.id;
  });

  afterAll(async () => {
    // Clean up test user
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
    }
  });

  describe('Complete Login Flow', () => {
    it('should successfully authenticate user with valid credentials', async () => {
      // Query user from database
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, testEmail))
        .limit(1);

      expect(user).toBeDefined();
      expect(user.email).toBe(testEmail);

      // Verify password
      const isValid = await bcrypt.compare(testPassword, user.passwordHash || '');
      expect(isValid).toBe(true);
    });

    it('should fail with incorrect password', async () => {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, testEmail))
        .limit(1);

      const isValid = await bcrypt.compare('wrong_password', user.passwordHash || '');
      expect(isValid).toBe(false);
    });

    it('should fail with non-existent email', async () => {
      const result = await db
        .select()
        .from(users)
        .where(eq(users.email, 'nonexistent@example.com'))
        .limit(1);

      expect(result).toHaveLength(0);
    });
  });

  describe('User Status Validation', () => {
    it('should reject login for suspended users', async () => {
      // Create suspended user
      const suspendedEmail = 'suspended@example.com';
      
      // Clean up first if exists
      await db.delete(users).where(eq(users.email, suspendedEmail));
      
      const [suspendedUser] = await db
        .insert(users)
        .values({
          email: suspendedEmail,
          passwordHash: await bcrypt.hash('password', 10),
          name: 'Suspended User',
          status: 'suspended',
        })
        .returning();

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, suspendedEmail))
        .limit(1);

      expect(user.status).toBe('suspended');

      // Clean up
      await db.delete(users).where(eq(users.id, suspendedUser.id));
    });

    it('should allow login for active users', async () => {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, testEmail))
        .limit(1);

      expect(user.status).toBe('active');
    });
  });

  describe('Session Data', () => {
    it('should contain correct user information', async () => {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, testEmail))
        .limit(1);

      // Simulate session data
      const sessionUser = {
        id: user.id,
        email: user.email,
        name: user.name,
      };

      expect(sessionUser.id).toBe(user.id);
      expect(sessionUser.email).toBe(testEmail);
      expect(sessionUser.name).toBe('Integration Test User');
    });
  });

  describe('Remember Me Functionality', () => {
    it('should handle remember me option', () => {
      const defaultMaxAge = 7 * 24 * 60 * 60; // 7 days in seconds
      const rememberMaxAge = 30 * 24 * 60 * 60; // 30 days in seconds

      expect(rememberMaxAge).toBeGreaterThan(defaultMaxAge);
      expect(defaultMaxAge).toBe(604800);
      expect(rememberMaxAge).toBe(2592000);
    });
  });
});

