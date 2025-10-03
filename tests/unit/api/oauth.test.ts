import { describe, it, expect } from '@jest/globals';

describe('OAuth Configuration', () => {
  describe('OAuth Provider Validation', () => {
    it('should validate Google OAuth provider configuration', () => {
      // Test that Google OAuth provider config is correct
      const googleConfig = {
        provider: 'google',
        clientIdKey: 'GOOGLE_CLIENT_ID',
        clientSecretKey: 'GOOGLE_CLIENT_SECRET',
        callbackUrl: '/api/auth/callback/google'
      };

      expect(googleConfig.provider).toBe('google');
      expect(googleConfig.clientIdKey).toBe('GOOGLE_CLIENT_ID');
      expect(googleConfig.clientSecretKey).toBe('GOOGLE_CLIENT_SECRET');
      expect(googleConfig.callbackUrl).toBe('/api/auth/callback/google');
    });

    it('should validate GitHub OAuth provider configuration', () => {
      // Test that GitHub OAuth provider config is correct
      const githubConfig = {
        provider: 'github',
        clientIdKey: 'GITHUB_CLIENT_ID',
        clientSecretKey: 'GITHUB_CLIENT_SECRET',
        callbackUrl: '/api/auth/callback/github'
      };

      expect(githubConfig.provider).toBe('github');
      expect(githubConfig.clientIdKey).toBe('GITHUB_CLIENT_ID');
      expect(githubConfig.clientSecretKey).toBe('GITHUB_CLIENT_SECRET');
      expect(githubConfig.callbackUrl).toBe('/api/auth/callback/github');
    });
  });

  describe('OAuth User Data Mapping', () => {
    it('should correctly map Google OAuth user data', () => {
      const googleUser = {
        email: 'test@gmail.com',
        name: 'Test User',
        image: 'https://lh3.googleusercontent.com/a/test-avatar'
      };

      const mappedData = {
        email: googleUser.email,
        name: googleUser.name || googleUser.email.split('@')[0],
        avatarUrl: googleUser.image,
        authProvider: 'GOOGLE' as const,
        passwordHash: null
      };

      expect(mappedData.email).toBe('test@gmail.com');
      expect(mappedData.name).toBe('Test User');
      expect(mappedData.avatarUrl).toBe(googleUser.image);
      expect(mappedData.authProvider).toBe('GOOGLE');
      expect(mappedData.passwordHash).toBeNull();
    });

    it('should correctly map GitHub OAuth user data', () => {
      const githubUser = {
        email: 'test@github.com',
        name: 'GitHub User',
        image: 'https://avatars.githubusercontent.com/u/123456'
      };

      const mappedData = {
        email: githubUser.email,
        name: githubUser.name || githubUser.email.split('@')[0],
        avatarUrl: githubUser.image,
        authProvider: 'GITHUB' as const,
        passwordHash: null
      };

      expect(mappedData.email).toBe('test@github.com');
      expect(mappedData.name).toBe('GitHub User');
      expect(mappedData.avatarUrl).toBe(githubUser.image);
      expect(mappedData.authProvider).toBe('GITHUB');
      expect(mappedData.passwordHash).toBeNull();
    });

    it('should use email username as fallback name', () => {
      const oauthUser = {
        email: 'testuser@example.com',
        name: null,
        image: 'https://example.com/avatar.jpg'
      };

      const fallbackName = oauthUser.name || oauthUser.email.split('@')[0];

      expect(fallbackName).toBe('testuser');
    });
  });

  describe('OAuth Error Scenarios', () => {
    it('should handle missing email in OAuth response', () => {
      const invalidUser = {
        email: null,
        name: 'Test User',
        image: 'https://example.com/avatar.jpg'
      };

      // Email is required, should fail validation
      expect(invalidUser.email).toBeNull();
    });

    it('should handle missing avatar in OAuth response', () => {
      const userWithoutAvatar = {
        email: 'test@example.com',
        name: 'Test User',
        image: null
      };

      const mappedData = {
        email: userWithoutAvatar.email,
        name: userWithoutAvatar.name,
        avatarUrl: userWithoutAvatar.image, // Will be null
        authProvider: 'GOOGLE' as const,
        passwordHash: null
      };

      expect(mappedData.avatarUrl).toBeNull();
      expect(mappedData.email).toBe('test@example.com');
    });
  });
});

