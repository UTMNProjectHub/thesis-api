import { beforeEach, describe, expect, it, mock } from "bun:test";

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

const mockCacheDel = mock();

mock.module("../../../db/redis", () => ({
	cache: {
		del: mockCacheDel,
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

const mockEq = mock();

mock.module("../../../db", () => ({
	db: mockDb,
}));

mock.module("drizzle-orm", () => ({
	eq: mockEq,
}));

import { ProfileService } from "../service";

describe("ProfileService", () => {
	let profileService: ProfileService;

	beforeEach(() => {
		profileService = new ProfileService();
		mockDb.query.users.findFirst.mockReset();
		mockDb.update.mockReset();
		mockEq.mockReset();
		mockCacheDel.mockReset();
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

	it("should update password and invalidate cache on success", async () => {
		const userId = "test-user-id";
		const oldPassword = "correct-password";
		const newPassword = "new-password";
		const hashedOldPassword = await Bun.password.hash(oldPassword);

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
		mockCacheDel.mockResolvedValue(undefined);

		const mockUpdateChain = {
			set: mock().mockReturnValue({
				where: mock().mockResolvedValue(undefined),
			}),
		};
		mockDb.update.mockReturnValue(mockUpdateChain);

		await profileService.changeUserPassword(userId, oldPassword, newPassword);

		expect(mockDb.update).toHaveBeenCalled();
		expect(mockCacheDel).toHaveBeenCalledWith(`user:${userId}:profile`);
		expect(mockCacheDel).toHaveBeenCalledWith(`user:${userId}:roles`);
	});

	it("should call cache.del for both user and roles keys on invalidateUserCache", async () => {
		const userId = "test-user-id";
		mockCacheDel.mockResolvedValue(undefined);

		await profileService.invalidateUserCache(userId);

		expect(mockCacheDel).toHaveBeenCalledWith(`user:${userId}:profile`);
		expect(mockCacheDel).toHaveBeenCalledWith(`user:${userId}:roles`);
		expect(mockCacheDel).toHaveBeenCalledTimes(2);
	});
});
