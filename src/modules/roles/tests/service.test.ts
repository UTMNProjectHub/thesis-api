import { beforeEach, describe, expect, it, mock } from "bun:test";

const mockDb = {
	query: {
		roles: {
			findMany: mock(),
		},
	},
};

mock.module("../../../db", () => ({
	db: mockDb,
}));

import { RoleService } from "../service";

describe("RoleService", () => {
	let roleService: RoleService;

	beforeEach(() => {
		roleService = new RoleService();
		mockDb.query.roles.findMany.mockReset();
	});

	it("should return all roles", async () => {
		const mockRoles = [
			{ id: 1, title: "Admin", slug: "admin", description: "Administrator" },
			{ id: 2, title: "Teacher", slug: "teacher", description: "Teacher role" },
		];

		mockDb.query.roles.findMany.mockReturnValue(mockRoles);

		const result = await roleService.getAllRoles();

		expect(result).toEqual(mockRoles);
		expect(mockDb.query.roles.findMany).toHaveBeenCalledTimes(1);
	});

	it("should return empty array when no roles exist", async () => {
		mockDb.query.roles.findMany.mockReturnValue([]);

		const result = await roleService.getAllRoles();

		expect(result).toEqual([]);
	});
});
