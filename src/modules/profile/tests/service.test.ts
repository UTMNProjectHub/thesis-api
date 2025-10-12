import { describe, it, expect, beforeEach, mock } from "bun:test";

const mockDb = {
  query: {
    users: {
      findFirst: mock(),
    },
  },
  update: mock(),
};

const mockEq = mock();

mock.module("../../../db", () => ({
  db: mockDb,
}));

mock.module("drizzle-orm", () => ({
  eq: mockEq,
}));

import { ProfileService } from "../service";
import { status } from "elysia";

describe("ProfileService", () => {
  let profileService: ProfileService;

  beforeEach(() => {
    profileService = new ProfileService();
    mockDb.query.users.findFirst.mockReset();
    mockDb.update.mockReset();
    mockEq.mockReset();
  });

  it("should throw 404 when user not found", async () => {
    const userId = "non-existent-user";
    const oldPassword = "old-password";
    const newPassword = "new-password";

    mockEq.mockReturnValue("mock-where-condition");
    mockDb.query.users.findFirst.mockResolvedValue(null);

    try {
      await profileService.changeUserPassword(userId, oldPassword, newPassword);
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.code).toBe(404);
      expect(error.response).toBe("Not Found");
    }
  });

  it("should throw 401 when old password is wrong", async () => {
    const userId = "test-user-id";
    const oldPassword = "wrong-password";
    const newPassword = "new-password";
    const hashedOldPassword = await Bun.password.hash("different-password");

    const mockUser = {
      id: userId,
      email: "test@example.com",
      password: hashedOldPassword,
      date_created: new Date(),
      full_name: "Test User",
      avatar_url: null,
    };

    mockEq.mockReturnValue("mock-where-condition");
    mockDb.query.users.findFirst.mockResolvedValue(mockUser);

    try {
      await profileService.changeUserPassword(userId, oldPassword, newPassword);
      expect(true).toBe(false); 
    } catch (error: any) {
      expect(error.code).toBe(401);
      expect(error.response).toBe("Unauthorized");
    }
  });
});