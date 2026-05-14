import { beforeEach, describe, expect, it, mock } from "bun:test";

const mockCacheGet = mock();
const mockCacheSet = mock();
const mockCacheDel = mock();

mock.module("../../../db/redis", () => ({
	cache: {
		get: mockCacheGet,
		set: mockCacheSet,
		del: mockCacheDel,
	},
}));

mock.module("ioredis", () => ({
	default: class {
		on = mock();
		get = mock();
		set = mock();
		setex = mock();
		del = mock();
		quit = mock();
	},
}));

const mockDb = {
	query: {
		users: {
			findFirst: mock(),
		},
	},
	update: mock(),
};

mock.module("../../../db", () => ({
	db: mockDb,
}));

mock.module("drizzle-orm", () => ({
	eq: mock((...args: unknown[]) => ({ eq: args })),
}));

import { UserService } from "../service";

describe("UserService", () => {
	let userService: UserService;

	beforeEach(() => {
		userService = new UserService();
		mockDb.query.users.findFirst.mockReset();
		mockDb.update.mockReset();
		mockCacheGet.mockReset();
		mockCacheSet.mockReset();
		mockCacheDel.mockReset();
	});

	// ── getUserById ──────────────────────────────────────────────────────────────

	describe("getUserById", () => {
		it("should return cached user on cache hit", async () => {
			const cachedUser = {
				id: "test-user-id",
				email: "test@example.com",
				date_created: new Date(),
				full_name: "Test User",
				avatar_url: null,
				roles: [],
			};
			mockCacheGet.mockResolvedValue(cachedUser);

			const result = await userService.getUserById("test-user-id");

			expect(result).toEqual(cachedUser);
			expect(mockDb.query.users.findFirst).not.toHaveBeenCalled();
		});

		it("should query db and cache result on cache miss", async () => {
			const userId = "test-user-id";
			const roleDate = new Date();
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
							date_created: roleDate,
						},
					},
				],
			};

			mockCacheGet.mockResolvedValue(null);
			mockDb.query.users.findFirst.mockReturnValue(mockUser);
			mockCacheSet.mockResolvedValue(undefined);

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
						date_created: roleDate,
					},
				],
			});
			expect(mockCacheSet).toHaveBeenCalledWith(
				`user:${userId}:profile`,
				expect.any(Object),
				300,
			);
		});

		it("should throw 404 when user not found", async () => {
			mockCacheGet.mockResolvedValue(null);
			mockDb.query.users.findFirst.mockReturnValue(null);

			try {
				await userService.getUserById("non-existent");
				expect(true).toBe(false);
			} catch (error: any) {
				expect(error.code).toBe(404);
				expect(error.response).toBe("Not Found");
			}
		});
	});

	// ── editUserById ─────────────────────────────────────────────────────────────

	describe("editUserById", () => {
		const makeUpdateChain = (returnedRows: any[]) => ({
			set: mock().mockReturnValue({
				where: mock().mockReturnValue({
					returning: mock().mockReturnValue(returnedRows),
				}),
			}),
		});

		it("should update and return user with full fields", async () => {
			const updated = {
				id: "test-user-id",
				email: "new@example.com",
				full_name: "New Name",
				date_created: new Date(),
				avatar_url: null,
				password: "hashed",
			};
			mockDb.update.mockReturnValue(makeUpdateChain([updated]));
			mockCacheDel.mockResolvedValue(undefined);

			const result = await userService.editUserById(
				"test-user-id",
				"new@example.com",
				"New Name",
			);

			expect(result).toEqual(updated);
			expect(mockCacheDel).toHaveBeenCalledWith("user:test-user-id:profile");
		});

		it("should update with partial fields (email only)", async () => {
			const updated = {
				id: "test-user-id",
				email: "new@example.com",
				full_name: "Old Name",
				date_created: new Date(),
				avatar_url: null,
				password: "hashed",
			};
			mockDb.update.mockReturnValue(makeUpdateChain([updated]));
			mockCacheDel.mockResolvedValue(undefined);

			const result = await userService.editUserById("test-user-id", "new@example.com");

			expect(result).toEqual(updated);
		});

		it("should throw 404 when no rows returned (user not found)", async () => {
			mockDb.update.mockReturnValue(makeUpdateChain([]));

			try {
				await userService.editUserById("non-existent", "x@x.com");
				expect(true).toBe(false);
			} catch (error: any) {
				expect(error.code).toBe(404);
				expect(error.response).toBe("Not Found");
			}
		});
	});

	// ── getUserRoles ─────────────────────────────────────────────────────────────

	describe("getUserRoles", () => {
		it("should return cached roles on cache hit", async () => {
			const cachedRoles = [{ id: 1, title: "Admin", slug: "admin" }];
			mockCacheGet.mockResolvedValue(cachedRoles);

			const result = await userService.getUserRoles("test-user-id");

			expect(result).toEqual(cachedRoles);
			expect(mockDb.query.users.findFirst).not.toHaveBeenCalled();
		});

		it("should query db and cache roles on cache miss", async () => {
			const userId = "test-user-id";
			const role = { id: 1, title: "Admin", slug: "admin", description: null, date_created: null };
			const mockUser = {
				id: userId,
				usersToRoles: [{ role }],
			};

			mockCacheGet.mockResolvedValue(null);
			mockDb.query.users.findFirst.mockReturnValue(mockUser);
			mockCacheSet.mockResolvedValue(undefined);

			const result = await userService.getUserRoles(userId);

			expect(result).toEqual([role]);
			expect(mockCacheSet).toHaveBeenCalledWith(
				`user:${userId}:roles`,
				[role],
				600,
			);
		});

		it("should throw 404 when user not found", async () => {
			mockCacheGet.mockResolvedValue(null);
			mockDb.query.users.findFirst.mockReturnValue(null);

			try {
				await userService.getUserRoles("non-existent");
				expect(true).toBe(false);
			} catch (error: any) {
				expect(error.code).toBe(404);
				expect(error.response).toBe("Not Found");
			}
		});
	});

	// ── invalidateUserCache ──────────────────────────────────────────────────────

	describe("invalidateUserCache", () => {
		it("should delete both profile and roles cache keys", async () => {
			const userId = "test-user-id";
			mockCacheDel.mockResolvedValue(undefined);

			await userService.invalidateUserCache(userId);

			expect(mockCacheDel).toHaveBeenCalledWith(`user:${userId}:profile`);
			expect(mockCacheDel).toHaveBeenCalledWith(`user:${userId}:roles`);
			expect(mockCacheDel).toHaveBeenCalledTimes(2);
		});
	});
});
