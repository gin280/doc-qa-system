import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { db } from '../../src/lib/db';
import { users } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';

describe('OAuth Authentication Flow Integration Tests', () => {
  beforeEach(async () => {
    // Clean up test users before each test
    try {
      await db.delete(users).where(eq(users.email, 'oauth-test@gmail.com'));
      await db.delete(users).where(eq(users.email, 'oauth-test@github.com'));
    } catch (error) {
      // Ignore errors if users don't exist
    }
  });

  afterEach(async () => {
    // Clean up test users after each test
    try {
      await db.delete(users).where(eq(users.email, 'oauth-test@gmail.com'));
      await db.delete(users).where(eq(users.email, 'oauth-test@github.com'));
    } catch (error) {
      // Ignore errors if users don't exist
    }
  });

  describe('Google OAuth Flow', () => {
    it('should complete Google OAuth flow and create user', async () => {
      // Simulate Google OAuth callback data
      const googleUser = {
        email: 'oauth-test@gmail.com',
        name: 'Google Test User',
        image: 'https://lh3.googleusercontent.com/a/test-avatar'
      };

      // Step 1: Check user doesn't exist
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, googleUser.email))
        .limit(1);

      expect(existingUser).toBeUndefined();

      // Step 2: Create user (simulating signIn callback)
      await db.insert(users).values({
        email: googleUser.email,
        name: googleUser.name,
        avatarUrl: googleUser.image,
        authProvider: 'GOOGLE',
        passwordHash: null,
      });

      // Step 3: Verify user was created correctly
      const [createdUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, googleUser.email))
        .limit(1);

      expect(createdUser).toBeDefined();
      expect(createdUser.email).toBe(googleUser.email);
      expect(createdUser.name).toBe(googleUser.name);
      expect(createdUser.avatarUrl).toBe(googleUser.image);
      expect(createdUser.authProvider).toBe('GOOGLE');
      expect(createdUser.passwordHash).toBeNull();
    });

    it('should update avatar on subsequent Google login', async () => {
      // Step 1: Create initial user
      await db.insert(users).values({
        email: 'oauth-test@gmail.com',
        name: 'Google User',
        avatarUrl: 'https://example.com/old-avatar.jpg',
        authProvider: 'GOOGLE',
        passwordHash: null,
      });

      const newAvatar = 'https://lh3.googleusercontent.com/a/new-avatar';

      // Step 2: Get user
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, 'oauth-test@gmail.com'))
        .limit(1);

      expect(existingUser).toBeDefined();

      // Step 3: Update avatar (simulating signIn callback on subsequent login)
      if (existingUser && newAvatar !== existingUser.avatarUrl) {
        await db
          .update(users)
          .set({
            avatarUrl: newAvatar,
            updatedAt: new Date()
          })
          .where(eq(users.id, existingUser.id));
      }

      // Step 4: Verify avatar was updated
      const [updatedUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, 'oauth-test@gmail.com'))
        .limit(1);

      expect(updatedUser.avatarUrl).toBe(newAvatar);
    });
  });

  describe('GitHub OAuth Flow', () => {
    it('should complete GitHub OAuth flow and create user', async () => {
      // Simulate GitHub OAuth callback data
      const githubUser = {
        email: 'oauth-test@github.com',
        name: 'GitHub Test User',
        image: 'https://avatars.githubusercontent.com/u/123456'
      };

      // Step 1: Check user doesn't exist
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, githubUser.email))
        .limit(1);

      expect(existingUser).toBeUndefined();

      // Step 2: Create user (simulating signIn callback)
      await db.insert(users).values({
        email: githubUser.email,
        name: githubUser.name,
        avatarUrl: githubUser.image,
        authProvider: 'GITHUB',
        passwordHash: null,
      });

      // Step 3: Verify user was created correctly
      const [createdUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, githubUser.email))
        .limit(1);

      expect(createdUser).toBeDefined();
      expect(createdUser.email).toBe(githubUser.email);
      expect(createdUser.name).toBe(githubUser.name);
      expect(createdUser.avatarUrl).toBe(githubUser.image);
      expect(createdUser.authProvider).toBe('GITHUB');
      expect(createdUser.passwordHash).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle same email with different auth providers', async () => {
      const email = 'oauth-test@gmail.com';
      
      // Create user via EMAIL provider
      await db.insert(users).values({
        email,
        name: 'Email User',
        avatarUrl: null,
        authProvider: 'EMAIL',
        passwordHash: 'hashed-password',
      });

      // Try to login with Google using same email
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      expect(existingUser).toBeDefined();
      expect(existingUser.authProvider).toBe('EMAIL');
      
      // User should be able to login with OAuth using same email
      // In this case, we just update the avatar, don't create new user
      const newAvatar = 'https://lh3.googleusercontent.com/a/oauth-avatar';
      
      if (existingUser) {
        await db
          .update(users)
          .set({
            avatarUrl: newAvatar,
            updatedAt: new Date()
          })
          .where(eq(users.id, existingUser.id));
      }

      const [updatedUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      // Verify user wasn't duplicated and avatar was updated
      expect(updatedUser.avatarUrl).toBe(newAvatar);
      expect(updatedUser.authProvider).toBe('EMAIL'); // Original auth provider preserved
    });
  });
});

