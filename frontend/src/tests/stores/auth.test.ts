/**
 * Auth Store Tests
 *
 * Tests for authentication state management using Pinia.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from '@/stores/auth';
import { authApi } from '@/api/auth';

// Mock the auth API
vi.mock('@/api/auth', () => ({
  authApi: {
    register: vi.fn(),
    login: vi.fn(),
    getMe: vi.fn(),
  },
}));

describe('Auth Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    vi.clearAllMocks();
    // Default mock for getMe to prevent unhandled rejections when store auto-fetches
    (authApi.getMe as any).mockResolvedValue({ data: null, error: null });
  });

  describe('initial state', () => {
    test('starts with null user and token', () => {
      const store = useAuthStore();

      expect(store.user).toBeNull();
      expect(store.token).toBeNull();
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
      expect(store.isAuthenticated).toBe(false);
    });

    test('loads token from localStorage if present', () => {
      localStorage.setItem('auth_token', 'stored-token');

      const store = useAuthStore();

      expect(store.token).toBe('stored-token');
    });
  });

  describe('register', () => {
    test('successfully registers user', async () => {
      const mockResponse = {
        data: {
          user: { userId: 1, email: 'test@example.com', username: 'testuser' },
          token: 'new-token',
          expiresAt: new Date(),
        },
        error: null,
      };

      (authApi.register as any).mockResolvedValue(mockResponse);

      const store = useAuthStore();
      const result = await store.register({
        email: 'test@example.com',
        password: 'password123',
        username: 'testuser',
      });

      expect(result).toBe(true);
      expect(store.user).toEqual(mockResponse.data.user);
      expect(store.token).toBe('new-token');
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
      expect(store.isAuthenticated).toBe(true);
      expect(localStorage.getItem('auth_token')).toBe('new-token');
    });

    test('handles registration error', async () => {
      const mockResponse = {
        data: null,
        error: { message: 'Email already exists', code: 'DUPLICATE_EMAIL' },
      };

      (authApi.register as any).mockResolvedValue(mockResponse);

      const store = useAuthStore();
      const result = await store.register({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toBe(false);
      expect(store.user).toBeNull();
      expect(store.token).toBeNull();
      expect(store.loading).toBe(false);
      expect(store.error).toBe('Email already exists');
      expect(store.isAuthenticated).toBe(false);
    });

    test('sets loading state during registration', async () => {
      let loadingDuringCall = false;

      (authApi.register as any).mockImplementation(async () => {
        const store = useAuthStore();
        loadingDuringCall = store.loading;

        return {
          data: {
            user: { userId: 1, email: 'test@example.com' },
            token: 'token',
            expiresAt: new Date(),
          },
          error: null,
        };
      });

      const store = useAuthStore();
      await store.register({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(loadingDuringCall).toBe(true);
      expect(store.loading).toBe(false);
    });
  });

  describe('login', () => {
    test('successfully logs in user', async () => {
      const mockResponse = {
        data: {
          user: { userId: 1, email: 'test@example.com', username: 'testuser' },
          token: 'login-token',
          expiresAt: new Date(),
        },
        error: null,
      };

      (authApi.login as any).mockResolvedValue(mockResponse);

      const store = useAuthStore();
      const result = await store.login({
        identifier: 'test@example.com',
        password: 'password123',
      });

      expect(result).toBe(true);
      expect(store.user).toEqual(mockResponse.data.user);
      expect(store.token).toBe('login-token');
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
      expect(store.isAuthenticated).toBe(true);
      expect(localStorage.getItem('auth_token')).toBe('login-token');
    });

    test('handles login error', async () => {
      const mockResponse = {
        data: null,
        error: { message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' },
      };

      (authApi.login as any).mockResolvedValue(mockResponse);

      const store = useAuthStore();
      const result = await store.login({
        identifier: 'test@example.com',
        password: 'wrongpassword',
      });

      expect(result).toBe(false);
      expect(store.user).toBeNull();
      expect(store.token).toBeNull();
      expect(store.loading).toBe(false);
      expect(store.error).toBe('Invalid credentials');
      expect(store.isAuthenticated).toBe(false);
    });
  });

  describe('fetchUser', () => {
    test('fetches user data when token exists', async () => {
      const mockResponse = {
        data: {
          user: { userId: 1, email: 'test@example.com', username: 'testuser' },
        },
        error: null,
      };

      (authApi.getMe as any).mockResolvedValue(mockResponse);

      const store = useAuthStore();
      store.token = 'existing-token';

      await store.fetchUser();

      expect(store.user).toEqual(mockResponse.data.user);
      expect(authApi.getMe).toHaveBeenCalled();
    });

    test('does nothing when no token exists', async () => {
      const store = useAuthStore();
      store.token = null;

      await store.fetchUser();

      expect(authApi.getMe).not.toHaveBeenCalled();
    });

    test('logs out when fetch fails', async () => {
      const mockResponse = {
        data: null,
        error: { message: 'Unauthorized', code: 'UNAUTHORIZED' },
      };

      (authApi.getMe as any).mockResolvedValue(mockResponse);

      const store = useAuthStore();
      store.token = 'invalid-token';

      await store.fetchUser();

      expect(store.user).toBeNull();
      expect(store.token).toBeNull();
      expect(localStorage.getItem('auth_token')).toBeNull();
    });
  });

  describe('logout', () => {
    test('clears user data and token', () => {
      const store = useAuthStore();
      store.user = { userId: 1, email: 'test@example.com', username: 'testuser' };
      store.token = 'token';
      localStorage.setItem('auth_token', 'token');

      store.logout();

      expect(store.user).toBeNull();
      expect(store.token).toBeNull();
      expect(store.isAuthenticated).toBe(false);
      expect(localStorage.getItem('auth_token')).toBeNull();
    });
  });

  describe('isAuthenticated computed', () => {
    test('returns false when no user or token', () => {
      const store = useAuthStore();

      expect(store.isAuthenticated).toBe(false);
    });

    test('returns false when only token exists', () => {
      const store = useAuthStore();
      store.token = 'token';

      expect(store.isAuthenticated).toBe(false);
    });

    test('returns false when only user exists', () => {
      const store = useAuthStore();
      store.user = { userId: 1, email: 'test@example.com', username: null };

      expect(store.isAuthenticated).toBe(false);
    });

    test('returns true when both user and token exist', () => {
      const store = useAuthStore();
      store.user = { userId: 1, email: 'test@example.com', username: null };
      store.token = 'token';

      expect(store.isAuthenticated).toBe(true);
    });
  });
});
