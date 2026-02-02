/**
 * Security Test Suite
 *
 * Tests for:
 * - Security headers middleware
 * - Password strength validation
 * - HTTPS redirect middleware
 * - Environment-specific CORS
 */

import { describe, test, expect, beforeAll, mock } from "bun:test";
import { getConnection } from "@quailcomp/data";
import type { Sql } from "@quailcomp/data";

import { securityHeaders } from "@/middleware/security-headers";
import { httpsRedirect } from "@/middleware/https-redirect";
import { validatePasswordStrength, validatePassword } from "@/auth/password-validator";
import { createContext, type RequestContext } from "@/context";
import type { Handler } from "@/middleware/types";

// Test database setup
let sql: Sql;

beforeAll(async () => {
  sql = getConnection();
});

// Test helper: create a mock handler
function createMockHandler(responseText: string = "success"): Handler {
  return async (ctx: RequestContext, req: Request) => {
    return new Response(responseText);
  };
}

// =============================================================================
// Security Headers Tests
// =============================================================================

describe("securityHeaders middleware", () => {
  test("adds security headers to response", async () => {
    const request = new Request("http://localhost/test");
    const ctx = createContext(request, sql);
    const handler = createMockHandler();
    const middleware = securityHeaders(handler);

    const response = await middleware(ctx, request);

    expect(response.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-XSS-Protection")).toBe("1; mode=block");
    expect(response.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(response.headers.get("Permissions-Policy")).toContain("geolocation=()");
  });

  test("adds Content-Security-Policy header", async () => {
    const request = new Request("http://localhost/test");
    const ctx = createContext(request, sql);
    const handler = createMockHandler();
    const middleware = securityHeaders(handler);

    const response = await middleware(ctx, request);

    const csp = response.headers.get("Content-Security-Policy");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  test("does not modify response body", async () => {
    const request = new Request("http://localhost/test");
    const ctx = createContext(request, sql);
    const handler = createMockHandler("test-body");
    const middleware = securityHeaders(handler);

    const response = await middleware(ctx, request);

    expect(await response.text()).toBe("test-body");
  });

  test("preserves existing response headers", async () => {
    const request = new Request("http://localhost/test");
    const ctx = createContext(request, sql);
    const handler = async () => {
      return new Response("test", {
        headers: {
          "Content-Type": "text/plain",
          "X-Custom-Header": "custom-value",
        },
      });
    };
    const middleware = securityHeaders(handler);

    const response = await middleware(ctx, request);

    expect(response.headers.get("Content-Type")).toBe("text/plain");
    expect(response.headers.get("X-Custom-Header")).toBe("custom-value");
    expect(response.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
  });
});

// =============================================================================
// Password Validation Tests
// =============================================================================

describe("validatePasswordStrength", () => {
  test("rejects password shorter than minimum length", () => {
    const result = validatePasswordStrength("Short1!");

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Password must be at least 12 characters");
  });

  test("rejects password without lowercase letter", () => {
    const result = validatePasswordStrength("UPPERCASE123!");

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("lowercase"))).toBe(true);
  });

  test("rejects password without uppercase letter", () => {
    const result = validatePasswordStrength("lowercase123!");

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("uppercase"))).toBe(true);
  });

  test("rejects password without number", () => {
    const result = validatePasswordStrength("NoNumbersHere!");

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("number"))).toBe(true);
  });

  test("rejects password without special character", () => {
    const result = validatePasswordStrength("NoSpecialChar123");

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("special character"))).toBe(true);
  });

  test("rejects common passwords", () => {
    const result = validatePasswordStrength("Password123!");

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("too common"))).toBe(true);
  });

  test("accepts strong password", () => {
    const result = validatePasswordStrength("MySecureP@ssw0rd123");

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("calculates entropy for passwords", () => {
    const weakResult = validatePasswordStrength("aaaaaaaaaaaa");
    const strongResult = validatePasswordStrength("MySecureP@ssw0rd123");

    expect(strongResult.entropy).toBeGreaterThan(weakResult.entropy);
  });

  test("rates password strength correctly", () => {
    const password1 = validatePasswordStrength("Abcd1234!@#$");  // 12 chars, all types
    const password2 = validatePasswordStrength("Abc123!@#abc");
    const strong = validatePasswordStrength("MyV3ry$tr0ng&C0mpl3xP@ssw0rd!");

    // Entropy-based strength rating
    // 12+ chars with all character types typically rates as strong or medium
    expect(["medium", "strong"]).toContain(password1.strength);
    expect(["medium", "strong"]).toContain(password2.strength);
    expect(strong.strength).toBe("strong");
  });

  test("returns multiple errors for multiple violations", () => {
    const result = validatePasswordStrength("short");

    expect(result.errors.length).toBeGreaterThan(1);
    expect(result.valid).toBe(false);
  });
});

describe("validatePassword", () => {
  test("returns null for valid password", () => {
    const error = validatePassword("MySecureP@ssw0rd123");

    expect(error).toBeNull();
  });

  test("returns first error message for invalid password", () => {
    const error = validatePassword("weak");

    expect(error).not.toBeNull();
    expect(typeof error).toBe("string");
  });
});

// =============================================================================
// HTTPS Redirect Tests
// =============================================================================

describe("httpsRedirect middleware", () => {
  test("does not redirect in development", async () => {
    // In test environment (not production), should not redirect
    const request = new Request("http://localhost/test");
    const ctx = createContext(request, sql);
    const handler = createMockHandler("ok");
    const middleware = httpsRedirect(handler);

    const response = await middleware(ctx, request);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok");
  });

  test("passes through HTTPS requests in development", async () => {
    const request = new Request("https://localhost/test");
    const ctx = createContext(request, sql);
    const handler = createMockHandler("secure");
    const middleware = httpsRedirect(handler);

    const response = await middleware(ctx, request);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("secure");
  });

  test("respects X-Forwarded-Proto header", async () => {
    const request = new Request("http://localhost/test", {
      headers: {
        "X-Forwarded-Proto": "https",
      },
    });
    const ctx = createContext(request, sql);
    const handler = createMockHandler("ok");
    const middleware = httpsRedirect(handler);

    const response = await middleware(ctx, request);

    // Should not redirect since X-Forwarded-Proto indicates HTTPS
    expect(response.status).toBe(200);
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe("Security integration", () => {
  test("security headers work with other middleware", async () => {
    const request = new Request("http://localhost/test");
    const ctx = createContext(request, sql);

    // Simulate middleware chain
    const baseHandler = createMockHandler("result");
    const withSecurity = securityHeaders(baseHandler);

    const response = await withSecurity(ctx, request);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("result");
    expect(response.headers.get("X-Frame-Options")).toBeTruthy();
  });

  test("password validation integrates with password requirements", () => {
    // Test that validation follows configured requirements
    const tooShort = validatePassword("Short1!");
    const noComplexity = validatePassword("alllowercase123");
    const valid = validatePassword("ValidP@ssw0rd123");

    expect(tooShort).not.toBeNull();
    expect(noComplexity).not.toBeNull();
    expect(valid).toBeNull();
  });
});
