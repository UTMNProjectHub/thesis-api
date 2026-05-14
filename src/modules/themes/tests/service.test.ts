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

const mockFindFirstTheme = mock();
const mockInsert = mock();
const mockUpdate = mock();
const mockSelect = mock();

const mockDb = {
	query: {
		themes: {
			findFirst: mockFindFirstTheme,
		},
	},
	insert: mockInsert,
	update: mockUpdate,
	select: mockSelect,
	transaction: mock(),
};

mock.module("../../../db", () => ({
	db: mockDb,
}));

mock.module("drizzle-orm", () => ({
	eq: mock((...args: unknown[]) => ({ eq: args })),
}));

mock.module("../../file/service", () => ({
	FileService: class {
		uploadFile = mock();
		deleteFile = mock();
		downloadFile = mock();
	},
}));

import { ThemeService } from "../service";

describe("ThemeService", () => {
	let themeService: ThemeService;

	beforeEach(() => {
		themeService = new ThemeService();
		mockCacheGet.mockReset();
		mockCacheSet.mockReset();
		mockCacheDel.mockReset();
		mockFindFirstTheme.mockReset();
		mockInsert.mockReset();
		mockUpdate.mockReset();
		mockSelect.mockReset();
		mockDb.transaction.mockReset();
	});

	// ── getThemeById ─────────────────────────────────────────────────────────────

	describe("getThemeById", () => {
		it("should return cached theme on cache hit", async () => {
			const cached = { id: 1, name: "Algebra", subjectId: 10 };
			mockCacheGet.mockResolvedValue(cached);

			const result = await themeService.getThemeById(1);

			expect(result).toEqual(cached);
			expect(mockFindFirstTheme).not.toHaveBeenCalled();
		});

		it("should query db, cache result, and return on cache miss", async () => {
			const theme = { id: 1, name: "Algebra", subjectId: 10 };
			mockCacheGet.mockResolvedValue(null);
			mockFindFirstTheme.mockResolvedValue(theme);
			mockCacheSet.mockResolvedValue(undefined);

			const result = await themeService.getThemeById(1);

			expect(result).toEqual(theme);
			expect(mockCacheSet).toHaveBeenCalledWith("theme:1", theme, 600);
		});

		it("should throw 404 when theme not found", async () => {
			mockCacheGet.mockResolvedValue(null);
			mockFindFirstTheme.mockResolvedValue(null);

			try {
				await themeService.getThemeById(99);
				expect(true).toBe(false);
			} catch (error: any) {
				expect(error.code).toBe(404);
				expect(error.response).toBe("Not Found");
			}
		});
	});

	// ── getThemeFiles ─────────────────────────────────────────────────────────────

	describe("getThemeFiles", () => {
		it("should return files associated with theme", async () => {
			const files = [{ id: "f1", name: "notes.pdf", s3Index: "themes/1/notes.pdf", userId: "u1" }];
			mockSelect.mockReturnValue({
				from: mock().mockReturnValue({
					innerJoin: mock().mockReturnValue({
						where: mock().mockResolvedValue(files),
					}),
				}),
			});

			const result = await themeService.getThemeFiles(1);

			expect(result).toEqual(files);
		});
	});

	// ── insertNewTheme ────────────────────────────────────────────────────────────

	describe("insertNewTheme", () => {
		it("should insert theme and invalidate subject themes cache", async () => {
			const insertResult = { id: 1 };
			mockInsert.mockReturnValue({
				values: mock().mockResolvedValue(insertResult),
			});
			mockCacheDel.mockResolvedValue(undefined);

			const result = await themeService.insertNewTheme(10, "Algebra", "Desc");

			expect(result).toEqual(insertResult);
			expect(mockCacheDel).toHaveBeenCalledWith("subject:10:themes");
		});
	});

	// ── updateTheme ──────────────────────────────────────────────────────────────

	describe("updateTheme", () => {
		it("should update theme and invalidate caches", async () => {
			const theme = { id: 1, name: "Old", subjectId: 10 };
			const updated = { ...theme, name: "New" };
			mockFindFirstTheme.mockResolvedValue(theme);
			mockUpdate.mockReturnValue({
				set: mock().mockReturnValue({
					where: mock().mockReturnValue({
						returning: mock().mockResolvedValue([updated]),
					}),
				}),
			});
			mockCacheDel.mockResolvedValue(undefined);

			const result = await themeService.updateTheme(1, { name: "New" });

			expect(result).toEqual(updated);
			expect(mockCacheDel).toHaveBeenCalledWith("theme:1");
			expect(mockCacheDel).toHaveBeenCalledWith("subject:10:themes");
		});

		it("should throw 404 when theme not found", async () => {
			mockFindFirstTheme.mockResolvedValue(null);

			try {
				await themeService.updateTheme(99, { name: "X" });
				expect(true).toBe(false);
			} catch (error: any) {
				expect(error.code).toBe(404);
			}
		});
	});

	// ── deleteTheme ──────────────────────────────────────────────────────────────

	describe("deleteTheme", () => {
		it("should throw 404 when theme not found", async () => {
			mockFindFirstTheme.mockResolvedValue(null);

			try {
				await themeService.deleteTheme(99);
				expect(true).toBe(false);
			} catch (error: any) {
				expect(error.code).toBe(404);
			}
		});

		it("should run cascade delete in transaction and invalidate caches", async () => {
			const theme = { id: 1, name: "Algebra", subjectId: 10 };
			mockFindFirstTheme.mockResolvedValue(theme);
			mockCacheDel.mockResolvedValue(undefined);

			const txWhere = mock().mockResolvedValue(undefined);
			const txSet = mock().mockReturnValue({ where: txWhere });
			const txUpdate = mock().mockReturnValue({ set: txSet });
			const txDelete = mock().mockReturnValue({ where: txWhere });

			mockDb.transaction.mockImplementation(async (fn: (tx: any) => any) => {
				const tx = {
					update: txUpdate,
					delete: txDelete,
				};
				return await fn(tx);
			});

			await themeService.deleteTheme(1);

			expect(mockDb.transaction).toHaveBeenCalledTimes(1);
			expect(mockCacheDel).toHaveBeenCalledWith("theme:1");
			expect(mockCacheDel).toHaveBeenCalledWith("subject:10:themes");
		});
	});

	// ── uploadFileToTheme ─────────────────────────────────────────────────────────

	describe("uploadFileToTheme", () => {
		it("should upload file and create theme reference in a transaction", async () => {
			const fileData = { id: "f1", name: "lecture.pdf", s3Index: "themes/1/lecture.pdf" };
			const txInsert = mock().mockReturnValue({
				values: mock().mockResolvedValue(undefined),
			});

			mockDb.transaction.mockImplementation(async (fn: (tx: any) => any) => {
				const tx = { insert: txInsert };
				// Override fileService on the instance to avoid S3 calls
				(themeService as any).fileService = {
					uploadFile: mock().mockResolvedValue(fileData),
				};
				return await fn(tx);
			});

			const mockFile = new File(["content"], "lecture.pdf");
			const result = await themeService.uploadFileToTheme(1, mockFile, "user-1");

			expect(result).toEqual(fileData);
		});
	});
});
