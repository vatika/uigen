import { describe, test, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

const mockSign = vi.fn();
const mockSetProtectedHeader = vi.fn(() => ({ setExpirationTime: mockSetExpirationTime }));
const mockSetExpirationTime = vi.fn(() => ({ setIssuedAt: mockSetIssuedAt }));
const mockSetIssuedAt = vi.fn(() => ({ sign: mockSign }));

vi.mock("jose", () => ({
  SignJWT: vi.fn().mockImplementation(() => ({
    setProtectedHeader: mockSetProtectedHeader,
  })),
  jwtVerify: vi.fn(),
}));

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { getSession, createSession, deleteSession, verifySession } from "../auth";

describe("auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSign.mockReset();
    mockSetProtectedHeader.mockClear();
    mockSetExpirationTime.mockClear();
    mockSetIssuedAt.mockClear();
  });

  describe("getSession", () => {
    test("returns null when no auth token cookie exists", async () => {
      const mockCookieStore = {
        get: vi.fn().mockReturnValue(undefined),
      };
      vi.mocked(cookies).mockResolvedValue(mockCookieStore as any);

      const result = await getSession();

      expect(result).toBeNull();
      expect(mockCookieStore.get).toHaveBeenCalledWith("auth-token");
    });

    test("returns null when cookie value is empty", async () => {
      const mockCookieStore = {
        get: vi.fn().mockReturnValue({ value: "" }),
      };
      vi.mocked(cookies).mockResolvedValue(mockCookieStore as any);

      const result = await getSession();

      expect(result).toBeNull();
    });

    test("returns session payload when token is valid", async () => {
      const mockPayload = {
        userId: "user-123",
        email: "test@example.com",
        expiresAt: new Date("2025-01-01"),
      };

      const mockCookieStore = {
        get: vi.fn().mockReturnValue({ value: "valid-jwt-token" }),
      };
      vi.mocked(cookies).mockResolvedValue(mockCookieStore as any);
      vi.mocked(jwtVerify).mockResolvedValue({ payload: mockPayload } as any);

      const result = await getSession();

      expect(result).toEqual(mockPayload);
      expect(jwtVerify).toHaveBeenCalledTimes(1);
      expect(vi.mocked(jwtVerify).mock.calls[0][0]).toBe("valid-jwt-token");
    });

    test("returns null when token verification fails", async () => {
      const mockCookieStore = {
        get: vi.fn().mockReturnValue({ value: "invalid-token" }),
      };
      vi.mocked(cookies).mockResolvedValue(mockCookieStore as any);
      vi.mocked(jwtVerify).mockRejectedValue(new Error("Invalid token"));

      const result = await getSession();

      expect(result).toBeNull();
    });

    test("returns null when token is expired", async () => {
      const mockCookieStore = {
        get: vi.fn().mockReturnValue({ value: "expired-token" }),
      };
      vi.mocked(cookies).mockResolvedValue(mockCookieStore as any);
      vi.mocked(jwtVerify).mockRejectedValue(new Error("Token expired"));

      const result = await getSession();

      expect(result).toBeNull();
    });
  });

  describe("createSession", () => {
    test("creates JWT token and sets cookie", async () => {
      const mockCookieStore = {
        set: vi.fn(),
      };
      vi.mocked(cookies).mockResolvedValue(mockCookieStore as any);
      mockSign.mockResolvedValue("generated-jwt-token");

      await createSession("user-123", "test@example.com");

      expect(SignJWT).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-123",
          email: "test@example.com",
          expiresAt: expect.any(Date),
        })
      );
      expect(mockSetProtectedHeader).toHaveBeenCalledWith({ alg: "HS256" });
      expect(mockSetExpirationTime).toHaveBeenCalledWith("7d");
      expect(mockSetIssuedAt).toHaveBeenCalled();
      expect(mockSign).toHaveBeenCalled();
    });

    test("sets cookie with correct options", async () => {
      const mockCookieStore = {
        set: vi.fn(),
      };
      vi.mocked(cookies).mockResolvedValue(mockCookieStore as any);
      mockSign.mockResolvedValue("jwt-token");

      await createSession("user-123", "test@example.com");

      expect(mockCookieStore.set).toHaveBeenCalledWith(
        "auth-token",
        "jwt-token",
        expect.objectContaining({
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          expires: expect.any(Date),
        })
      );
    });

    test("sets expiration to 7 days from now", async () => {
      const mockCookieStore = {
        set: vi.fn(),
      };
      vi.mocked(cookies).mockResolvedValue(mockCookieStore as any);
      mockSign.mockResolvedValue("jwt-token");

      const beforeCall = Date.now();
      await createSession("user-123", "test@example.com");
      const afterCall = Date.now();

      const setCalls = mockCookieStore.set.mock.calls;
      const options = setCalls[0][2];
      const expiresAt = options.expires.getTime();

      // Check expiration is approximately 7 days from now (within a few seconds tolerance)
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      expect(expiresAt).toBeGreaterThanOrEqual(beforeCall + sevenDaysMs - 1000);
      expect(expiresAt).toBeLessThanOrEqual(afterCall + sevenDaysMs + 1000);
    });
  });

  describe("deleteSession", () => {
    test("deletes auth-token cookie", async () => {
      const mockCookieStore = {
        delete: vi.fn(),
      };
      vi.mocked(cookies).mockResolvedValue(mockCookieStore as any);

      await deleteSession();

      expect(mockCookieStore.delete).toHaveBeenCalledWith("auth-token");
    });
  });

  describe("verifySession", () => {
    test("returns null when no auth token cookie in request", async () => {
      const mockRequest = {
        cookies: {
          get: vi.fn().mockReturnValue(undefined),
        },
      } as unknown as NextRequest;

      const result = await verifySession(mockRequest);

      expect(result).toBeNull();
      expect(mockRequest.cookies.get).toHaveBeenCalledWith("auth-token");
    });

    test("returns null when cookie value is empty", async () => {
      const mockRequest = {
        cookies: {
          get: vi.fn().mockReturnValue({ value: "" }),
        },
      } as unknown as NextRequest;

      const result = await verifySession(mockRequest);

      expect(result).toBeNull();
    });

    test("returns session payload when token is valid", async () => {
      const mockPayload = {
        userId: "user-456",
        email: "user@example.com",
        expiresAt: new Date("2026-01-01"),
      };

      const mockRequest = {
        cookies: {
          get: vi.fn().mockReturnValue({ value: "valid-request-token" }),
        },
      } as unknown as NextRequest;

      vi.mocked(jwtVerify).mockResolvedValue({ payload: mockPayload } as any);

      const result = await verifySession(mockRequest);

      expect(result).toEqual(mockPayload);
      expect(jwtVerify).toHaveBeenCalledTimes(1);
      expect(vi.mocked(jwtVerify).mock.calls[0][0]).toBe("valid-request-token");
    });

    test("returns null when token verification fails", async () => {
      const mockRequest = {
        cookies: {
          get: vi.fn().mockReturnValue({ value: "bad-token" }),
        },
      } as unknown as NextRequest;

      vi.mocked(jwtVerify).mockRejectedValue(new Error("Verification failed"));

      const result = await verifySession(mockRequest);

      expect(result).toBeNull();
    });

    test("returns null when token is tampered", async () => {
      const mockRequest = {
        cookies: {
          get: vi.fn().mockReturnValue({ value: "tampered-token" }),
        },
      } as unknown as NextRequest;

      vi.mocked(jwtVerify).mockRejectedValue(new Error("signature verification failed"));

      const result = await verifySession(mockRequest);

      expect(result).toBeNull();
    });

    test("verifies token with correct secret", async () => {
      const mockRequest = {
        cookies: {
          get: vi.fn().mockReturnValue({ value: "some-token" }),
        },
      } as unknown as NextRequest;

      vi.mocked(jwtVerify).mockResolvedValue({ payload: {} } as any);

      await verifySession(mockRequest);

      // Verify that jwtVerify was called with token and a Uint8Array secret
      expect(jwtVerify).toHaveBeenCalledWith("some-token", expect.any(Uint8Array));
    });
  });

  describe("edge cases", () => {
    test("handles undefined cookie value property", async () => {
      const mockCookieStore = {
        get: vi.fn().mockReturnValue({ value: undefined }),
      };
      vi.mocked(cookies).mockResolvedValue(mockCookieStore as any);

      const result = await getSession();

      expect(result).toBeNull();
    });

    test("handles cookie object without value property", async () => {
      const mockCookieStore = {
        get: vi.fn().mockReturnValue({}),
      };
      vi.mocked(cookies).mockResolvedValue(mockCookieStore as any);

      const result = await getSession();

      expect(result).toBeNull();
    });

    test("createSession handles special characters in email", async () => {
      const mockCookieStore = {
        set: vi.fn(),
      };
      vi.mocked(cookies).mockResolvedValue(mockCookieStore as any);
      mockSign.mockResolvedValue("jwt-token");

      await createSession("user-123", "user+test@example.com");

      expect(SignJWT).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "user+test@example.com",
        })
      );
    });
  });
});
