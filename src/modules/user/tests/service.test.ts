import { describe, it, expect, beforeEach, mock } from "bun:test";
import { UserService } from "../service";
import { status } from "elysia";

const mockDb = {
  query: {
    users: {
      findFirst: mock(),
    },
  },
  update: mock(),
  set: mock(),
  where: mock(),
  returning: mock(),
};

mock.module("../../../db", () => ({
  db: mockDb,
}));

describe("UserService", () => {
  let userService: UserService;

  beforeEach(() => {
    userService = new UserService();
    mockDb.query.users.findFirst.mockReset();
    mockDb.update.mockReset();
    mockDb.set.mockReset();
    mockDb.where.mockReset();
    mockDb.returning.mockReset();
  });

  it("should get user by id with roles", async () => {
    const userId = "test-user-id";
    const mockUser = {
      id: userId,
      email: "test@example.com",
      date_created: new Date(),
      full_name: "Test User",
      avatar_url: null,
      usersToRoles: [
        {
          role: {
            id: 1,
            title: "Admin",
            slug: "admin",
            description: "Administrator role",
            date_created: new Date(),
          },
        },
      ],
    };

    mockDb.query.users.findFirst.mockReturnValue(mockUser);

    const result = await userService.getUserById(userId);

    expect(result).toEqual({
      id: userId,
      email: "test@example.com",
      date_created: mockUser.date_created,
      full_name: "Test User",
      avatar_url: null,
      roles: [
        {
          id: 1,
          title: "Admin",
          slug: "admin",
          description: "Administrator role",
          date_created: mockUser.usersToRoles[0].role.date_created,
        },
      ],
    });
  });

  it("should throw 404 when user not found", async () => {
    const userId = "non-existent-user";

    mockDb.query.users.findFirst.mockReturnValue(null);

    try {
      await userService.getUserById(userId);
    } catch (error: any) {
      expect(error.code).toBe(404);
      expect(error.response).toBe("Not Found");
    }
  });

  it("should edit user by id successfully", async () => {
    const userId = "test-user-id";
    const newEmail = "newemail@example.com";
    const newFullName = "New Full Name";

    const mockUser = {
      id: userId,
      email: "old@example.com",
      full_name: "Old Name",
      date_created: new Date(),
      avatar_url: null,
      password: "hashed-password",
    };

    const mockUpdatedUser = {
      id: userId,
      email: newEmail,
      full_name: newFullName,
      date_created: mockUser.date_created,
      avatar_url: null,
      password: "hashed-password",
    };

    mockDb.query.users.findFirst.mockReturnValue(mockUser);
    
    const mockUpdateChain = {
      set: mock().mockReturnValue({
        where: mock().mockReturnValue({
          returning: mock().mockReturnValue([mockUpdatedUser]),
        }),
      }),
    };
    mockDb.update.mockReturnValue(mockUpdateChain);

    const result = await userService.editUserById(userId, newEmail, newFullName);

    expect(result).toEqual(mockUpdatedUser);
  });

  it("should edit user by id with partial update", async () => {
    const userId = "test-user-id";
    const newEmail = "newemail@example.com";

    const mockUser = {
      id: userId,
      email: "old@example.com",
      full_name: "Old Name",
      date_created: new Date(),
      avatar_url: null,
      password: "hashed-password",
    };

    const mockUpdatedUser = {
      id: userId,
      email: newEmail,
      full_name: "Old Name",
      date_created: mockUser.date_created,
      avatar_url: null,
      password: "hashed-password",
    };

    mockDb.query.users.findFirst.mockReturnValue(mockUser);
    
    const mockUpdateChain = {
      set: mock().mockReturnValue({
        where: mock().mockReturnValue({
          returning: mock().mockReturnValue([mockUpdatedUser]),
        }),
      }),
    };
    mockDb.update.mockReturnValue(mockUpdateChain);

    const result = await userService.editUserById(userId, newEmail);

    expect(result).toEqual(mockUpdatedUser);
  });

  it("should throw 404 when editing non-existent user", async () => {
    const userId = "non-existent-user";
    const newEmail = "newemail@example.com";

    mockDb.query.users.findFirst.mockReturnValue(null);

    try {
      await userService.editUserById(userId, newEmail);
    } catch (error: any) {
      expect(error.code).toBe(404);
      expect(error.response).toBe("Not Found");
    }
  });

  it("should throw 500 when update fails", async () => {
    const userId = "test-user-id";
    const newEmail = "newemail@example.com";

    const mockUser = {
      id: userId,
      email: "old@example.com",
      full_name: "Old Name",
      date_created: new Date(),
      avatar_url: null,
      password: "hashed-password",
    };

    mockDb.query.users.findFirst.mockReturnValue(mockUser);
    
    const mockUpdateChain = {
      set: mock().mockReturnValue({
        where: mock().mockReturnValue({
          returning: mock().mockReturnValue([]),
        }),
      }),
    };
    mockDb.update.mockReturnValue(mockUpdateChain);

    try {
      await userService.editUserById(userId, newEmail);
    } catch (error: any) {
      expect(error.code).toBe(500);
      expect(error.response).toBe("Internal Server Error");
    }
  });
});