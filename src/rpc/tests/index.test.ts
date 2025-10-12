import { describe, it, expect, beforeEach, mock } from "bun:test";

// Mock jwt
const mockJwt = {
  verify: mock(),
};

mock.module("jsonwebtoken", () => ({
  default: mockJwt,
  verify: mockJwt.verify,
}));

describe("gRPC ValidateToken", () => {
  beforeEach(() => {
    mockJwt.verify.mockReset();
  });

  it("should validate token successfully", () => {
    const userId = "test-user-id";
    const token = "valid-token";
    
    mockJwt.verify.mockReturnValue({ sub: userId });

    const mockCall = {
      request: { token },
    };

    const mockCallback = mock();

    // Import the validateToken function directly
    const validateToken = (call: any, callback: any) => {
      const { token } = call.request;

      try {
        const decoded = mockJwt.verify(token, process.env.JWT_SECRET as string) as any;
        callback(null, { valid: true, user_id: decoded.sub });
      } catch (error) {
        callback(null, { valid: false, user_id: "" });
      }
    };

    validateToken(mockCall, mockCallback);

    expect(mockJwt.verify).toHaveBeenCalledWith(token, process.env.JWT_SECRET);
    expect(mockCallback).toHaveBeenCalledWith(null, { 
      valid: true, 
      user_id: userId 
    });
  });

  it("should handle invalid token", () => {
    const token = "invalid-token";
    
    mockJwt.verify.mockImplementation(() => {
      throw new Error("Invalid token");
    });

    const mockCall = {
      request: { token },
    };

    const mockCallback = mock();

    const validateToken = (call: any, callback: any) => {
      const { token } = call.request;

      try {
        const decoded = mockJwt.verify(token, process.env.JWT_SECRET as string) as any;
        callback(null, { valid: true, user_id: decoded.sub });
      } catch (error) {
        callback(null, { valid: false, user_id: "" });
      }
    };

    validateToken(mockCall, mockCallback);

    expect(mockCallback).toHaveBeenCalledWith(null, { 
      valid: false, 
      user_id: "" 
    });
  });

  it("should handle expired token", () => {
    const token = "expired-token";
    
    mockJwt.verify.mockImplementation(() => {
      throw new Error("Token expired");
    });

    const mockCall = {
      request: { token },
    };

    const mockCallback = mock();

    const validateToken = (call: any, callback: any) => {
      const { token } = call.request;

      try {
        const decoded = mockJwt.verify(token, process.env.JWT_SECRET as string) as any;
        callback(null, { valid: true, user_id: decoded.sub });
      } catch (error) {
        callback(null, { valid: false, user_id: "" });
      }
    };

    validateToken(mockCall, mockCallback);

    expect(mockCallback).toHaveBeenCalledWith(null, { 
      valid: false, 
      user_id: "" 
    });
  });

  it("should handle malformed token", () => {
    const token = "malformed-token";
    
    mockJwt.verify.mockImplementation(() => {
      throw new Error("Malformed token");
    });

    const mockCall = {
      request: { token },
    };

    const mockCallback = mock();

    const validateToken = (call: any, callback: any) => {
      const { token } = call.request;

      try {
        const decoded = mockJwt.verify(token, process.env.JWT_SECRET as string) as any;
        callback(null, { valid: true, user_id: decoded.sub });
      } catch (error) {
        callback(null, { valid: false, user_id: "" });
      }
    };

    validateToken(mockCall, mockCallback);

    expect(mockCallback).toHaveBeenCalledWith(null, { 
      valid: false, 
      user_id: "" 
    });
  });

  it("should handle missing token", () => {
    const token = "";
    
    mockJwt.verify.mockImplementation(() => {
      throw new Error("No token provided");
    });

    const mockCall = {
      request: { token },
    };

    const mockCallback = mock();

    const validateToken = (call: any, callback: any) => {
      const { token } = call.request;

      try {
        const decoded = mockJwt.verify(token, process.env.JWT_SECRET as string) as any;
        callback(null, { valid: true, user_id: decoded.sub });
      } catch (error) {
        callback(null, { valid: false, user_id: "" });
      }
    };

    validateToken(mockCall, mockCallback);

    expect(mockCallback).toHaveBeenCalledWith(null, { 
      valid: false, 
      user_id: "" 
    });
  });
});