import { describe, it, expect, beforeEach, mock } from "bun:test";
import { AuthService } from "../service";
import { db } from "../../../db";
import { users } from "../../../db/schema";
import Redis from "ioredis";

// // Mock Redis
// mock(() => import("ioredis"), () => {
//   const RedisMock = require("ioredis-mock");
//   return {
//     default: RedisMock,
//   };
// });

// Mock db
mock.module("../../../db", () => ({
  db: {
    insert: mock(),
    values: mock(),
    returning: mock(),
    select: mock(),
    from: mock(),
    where: mock(),
  },
}));

describe("AuthService", () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
  });

  it("should store a refresh token", async () => {
    const userId = "1";
    const userAgent = "test-agent";
    const jwt = "test-jwt";

    await authService.storeRefreshToken(userId, userAgent, jwt);
    const storedToken = await authService["redisClient"].hget(
      `user:${userId}:refresh`,
      `agent:${userAgent}`,
    );
    expect(storedToken).toBe(jwt);
  });

  it("should check a refresh token", async () => {
    const userId = "1";
    const userAgent = "test-agent";
    const jwt = "test-jwt";

    await authService.storeRefreshToken(userId, userAgent, jwt);
    const result = await authService.checkRefreshToken(userId, userAgent, jwt);
    expect(result).toBe(true);
  });

  it("should throw an error for an invalid refresh token", async () => {
    const userId = "1";
    const userAgent = "test-agent";
    const jwt = "test-jwt";

    await authService.storeRefreshToken(userId, userAgent, "different-jwt");
    try {
      await authService.checkRefreshToken(userId, userAgent, jwt);
    } catch (error: any) {
      console.log(error);
      expect(error.code).toBe(401);
      expect(error.response).toBe("Unauthorized");
    }
  });

  it("should create a user", async () => {
    const email = "test@example.com";
    const password = "password";
    const user = {
      id: "1",
      email,
      date_created: new Date(),
      full_name: null,
      avatar_url: null,
    };

    const mockDb = {
      insert: () => ({
        values: () => ({
          returning: () => [user],
        }),
      }),
    };

    (db.insert as any).mockImplementation(mockDb.insert);

    const result = await authService.createUser(email, password);
    expect(result).toEqual(user);
  });

  it("should throw an error if user creation fails", async () => {
    const email = "test@example.com";
    const password = "password";

    const mockDb = {
      insert: () => ({
        values: () => ({
          returning: () => [],
        }),
      }),
    };

    (db.insert as any).mockImplementation(mockDb.insert);

    try {
      await authService.createUser(email, password);
    } catch (error: any) {
      expect(error.code).toBe(500);
      expect(error.response).toBe("Internal Server Error");
    }
  });

  it("should login a user", async () => {
    const email = "test@example.com";
    const password = "password";
    const hashedPassword = await Bun.password.hash(password);
    const user = {
      id: "1",
      email,
      password: hashedPassword,
      date_created: new Date(),
      full_name: null,
      avatar_url: null,
    };

    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => [user],
        }),
      }),
    };

    (db.select as any).mockImplementation(mockDb.select);

    const result = await authService.loginUser(email, password);
    expect(result).toEqual({
      id: user.id,
      email: user.email,
      date_created: user.date_created,
      full_name: user.full_name,
      avatar_url: user.avatar_url,
    });
  });

  it("should throw an error for a non-existent user", async () => {
    const email = "test@example.com";
    const password = "password";

    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => [],
        }),
      }),
    };

    (db.select as any).mockImplementation(mockDb.select);

    try {
      await authService.loginUser(email, password);
    } catch (error: any) {
      expect(error.code).toBe(404);
      expect(error.response).toBe("Not Found");
    }
  });

  it("should throw an error for a wrong password", async () => {
    const email = "test@example.com";
    const password = "password";
    const hashedPassword = await Bun.password.hash("wrong-password");
    const user = {
      id: "1",
      email,
      password: hashedPassword,
      date_created: new Date(),
      full_name: null,
      avatar_url: null,
    };

    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => [user],
        }),
      }),
    };

    (db.select as any).mockImplementation(mockDb.select);

    try {
      await authService.loginUser(email, password);
    } catch (error: any) {
      expect(error.code).toBe(401);
      expect(error.response).toBe("Wrong password");
    }
  });
});
