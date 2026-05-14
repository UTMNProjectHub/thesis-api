import { beforeEach, describe, expect, it, mock } from "bun:test";

const mockCacheGet = mock();
const mockCacheSet = mock();
const mockCacheDel = mock();
const mockCacheGetOrSet = mock();

mock.module("../../../db/redis", () => ({
	cache: {
		get: mockCacheGet,
		set: mockCacheSet,
		del: mockCacheDel,
		getOrSet: mockCacheGetOrSet,
	},
}));

const mockFindFirstSubject = mock();
const mockFindManySubjects = mock();
const mockInsert = mock();
const mockUpdate = mock();
const mockSelect = mock();

const mockDb = {
	query: {
		subjects: {
			findFirst: mockFindFirstSubject,
			findMany: mockFindManySubjects,
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
	and: mock((...args: unknown[]) => ({ and: args })),
	ilike: mock((...args: unknown[]) => ({ ilike: args })),
	or: mock((...args: unknown[]) => ({ or: args })),
	inArray: mock((...args: unknown[]) => ({ inArray: args })),
}));

// FileService has S3 deps — mock it away
mock.module("../../file/service", () => ({
	FileService: class {
		uploadFile = mock();
		deleteFile = mock();
		downloadFile = mock();
	},
}));

import { SubjectService } from "../service";

describe("SubjectService", () => {
	let subjectService: SubjectService;

	beforeEach(() => {
		subjectService = new SubjectService();
		mockCacheGet.mockReset();
		mockCacheSet.mockReset();
		mockCacheDel.mockReset();
		mockCacheGetOrSet.mockReset();
		mockFindFirstSubject.mockReset();
		mockFindManySubjects.mockReset();
		mockInsert.mockReset();
		mockUpdate.mockReset();
		mockSelect.mockReset();
		mockDb.transaction.mockReset();
	});

	// ── getSubjectById ───────────────────────────────────────────────────────────

	describe("getSubjectById", () => {
		it("should return cached subject on cache hit", async () => {
			const cached = { id: 1, name: "Math" };
			mockCacheGet.mockResolvedValue(cached);

			const result = await subjectService.getSubjectById(1);

			expect(result).toEqual(cached);
			expect(mockFindFirstSubject).not.toHaveBeenCalled();
		});

		it("should query db and cache result on cache miss", async () => {
			const subject = { id: 1, name: "Math" };
			mockCacheGet.mockResolvedValue(null);
			mockFindFirstSubject.mockResolvedValue(subject);
			mockCacheSet.mockResolvedValue(undefined);

			const result = await subjectService.getSubjectById(1);

			expect(result).toEqual(subject);
			expect(mockCacheSet).toHaveBeenCalled();
		});

		it("should throw 404 when subject not found", async () => {
			mockCacheGet.mockResolvedValue(null);
			mockFindFirstSubject.mockResolvedValue(undefined);

			try {
				await subjectService.getSubjectById(99);
				expect(true).toBe(false);
			} catch (error: any) {
				expect(error.code).toBe(404);
				expect(error.response).toBe("Not Found");
			}
		});
	});

	// ── getAllSubjects ────────────────────────────────────────────────────────────

	describe("getAllSubjects", () => {
		it("should call cache.getOrSet with correct key", async () => {
			const subjects = [{ id: 1, name: "Math" }];
			mockCacheGetOrSet.mockResolvedValue(subjects);

			const result = await subjectService.getAllSubjects();

			expect(mockCacheGetOrSet).toHaveBeenCalledWith(
				"subjects:all",
				expect.any(Function),
				600,
			);
			expect(result).toEqual(subjects);
		});

		it("should pass search query in cache key when provided", async () => {
			mockCacheGetOrSet.mockResolvedValue([]);

			await subjectService.getAllSubjects("math");

			expect(mockCacheGetOrSet).toHaveBeenCalledWith(
				"subjects:all:math",
				expect.any(Function),
				600,
			);
		});
	});

	// ── createNewSubject ─────────────────────────────────────────────────────────

	describe("createNewSubject", () => {
		it("should insert subject and invalidate all subjects cache", async () => {
			const insertResult = { id: 1 };
			mockInsert.mockReturnValue({
				values: mock().mockResolvedValue(insertResult),
			});
			mockCacheDel.mockResolvedValue(undefined);

			const result = await subjectService.createNewSubject(
				"Math",
				"MTH",
				2024,
				2025,
			);

			expect(result).toEqual(insertResult);
			expect(mockInsert).toHaveBeenCalledTimes(1);
			expect(mockCacheDel).toHaveBeenCalled();
		});
	});

	// ── getSubjectThemes ─────────────────────────────────────────────────────────

	describe("getSubjectThemes", () => {
		it("should return themes via cache.getOrSet", async () => {
			const themes = [{ id: 1, name: "Algebra" }];
			mockCacheGetOrSet.mockResolvedValue(themes);

			const result = await subjectService.getSubjectThemes(1);

			expect(mockCacheGetOrSet).toHaveBeenCalledWith(
				"subject:1:themes",
				expect.any(Function),
				600,
			);
			expect(result).toEqual(themes);
		});

		it("should include query in cache key when provided", async () => {
			mockCacheGetOrSet.mockResolvedValue([]);

			await subjectService.getSubjectThemes(1, "algebra");

			expect(mockCacheGetOrSet).toHaveBeenCalledWith(
				"subject:1:themes:algebra",
				expect.any(Function),
				600,
			);
		});
	});

	// ── updateSubject ────────────────────────────────────────────────────────────

	describe("updateSubject", () => {
		it("should update subject and invalidate cache", async () => {
			const subject = { id: 1, name: "Old", shortName: "O", yearStart: 2023, yearEnd: 2024, description: null };
			const updated = { ...subject, name: "New" };
			mockFindFirstSubject.mockResolvedValue(subject);
			mockUpdate.mockReturnValue({
				set: mock().mockReturnValue({
					where: mock().mockReturnValue({
						returning: mock().mockResolvedValue([updated]),
					}),
				}),
			});
			mockCacheDel.mockResolvedValue(undefined);

			const result = await subjectService.updateSubject(1, { name: "New" });

			expect(result).toEqual(updated);
			expect(mockCacheDel).toHaveBeenCalled();
		});

		it("should throw 404 when subject not found", async () => {
			mockFindFirstSubject.mockResolvedValue(null);

			try {
				await subjectService.updateSubject(99, { name: "X" });
				expect(true).toBe(false);
			} catch (error: any) {
				expect(error.code).toBe(404);
			}
		});
	});

	// ── deleteSubject ────────────────────────────────────────────────────────────

	describe("deleteSubject", () => {
		it("should throw 404 when subject not found", async () => {
			mockFindFirstSubject.mockResolvedValue(null);

			try {
				await subjectService.deleteSubject(99);
				expect(true).toBe(false);
			} catch (error: any) {
				expect(error.code).toBe(404);
			}
		});

		it("should run cascade delete in transaction and invalidate cache", async () => {
			const subject = { id: 1, name: "Math" };
			mockFindFirstSubject.mockResolvedValue(subject);
			mockCacheDel.mockResolvedValue(undefined);

			const txUpdate = mock().mockReturnValue({ set: mock().mockReturnValue({ where: mock().mockResolvedValue(undefined) }) });
			const txDelete = mock().mockReturnValue({ where: mock().mockResolvedValue(undefined) });

			mockDb.transaction.mockImplementation(async (fn: (tx: any) => any) => {
				const tx = {
					select: mock().mockReturnValue({
						from: mock().mockReturnValue({
							where: mock().mockResolvedValue([{ id: 10 }, { id: 11 }]),
						}),
					}),
					update: txUpdate,
					delete: txDelete,
				};
				return await fn(tx);
			});

			await subjectService.deleteSubject(1);

			expect(mockDb.transaction).toHaveBeenCalledTimes(1);
			expect(mockCacheDel).toHaveBeenCalled();
		});

		it("should skip theme cascade when subject has no themes", async () => {
			const subject = { id: 1, name: "Math" };
			mockFindFirstSubject.mockResolvedValue(subject);
			mockCacheDel.mockResolvedValue(undefined);

			const txDelete = mock().mockReturnValue({ where: mock().mockResolvedValue(undefined) });

			mockDb.transaction.mockImplementation(async (fn: (tx: any) => any) => {
				const tx = {
					select: mock().mockReturnValue({
						from: mock().mockReturnValue({
							where: mock().mockResolvedValue([]),
						}),
					}),
					update: mock(),
					delete: txDelete,
				};
				return await fn(tx);
			});

			await subjectService.deleteSubject(1);

			expect(mockDb.transaction).toHaveBeenCalledTimes(1);
		});
	});

	// ── getAllSubjects (fetch callback) ───────────────────────────────────────────

	describe("getAllSubjects (fetch callback)", () => {
		it("should execute the fetch function and return subjects from db", async () => {
			const subjects = [{ id: 1, name: "Math" }];
			// Let getOrSet actually call through to the fetch function
			mockCacheGetOrSet.mockImplementation(
				async (_key: string, fn: () => Promise<any>) => fn(),
			);
			mockFindManySubjects.mockResolvedValue(subjects);

			const result = await subjectService.getAllSubjects();

			expect(result).toEqual(subjects);
			expect(mockFindManySubjects).toHaveBeenCalledTimes(1);
		});

		it("should pass query to db when search term provided", async () => {
			mockCacheGetOrSet.mockImplementation(
				async (_key: string, fn: () => Promise<any>) => fn(),
			);
			mockFindManySubjects.mockResolvedValue([]);

			await subjectService.getAllSubjects("math");

			expect(mockFindManySubjects).toHaveBeenCalledTimes(1);
		});
	});

	// ── getSubjectThemes (fetch callback) ────────────────────────────────────────

	describe("getSubjectThemes (fetch callback)", () => {
		it("should execute the fetch function and return themes from db", async () => {
			const themes = [{ id: 10, name: "Algebra" }];
			mockCacheGetOrSet.mockImplementation(
				async (_key: string, fn: () => Promise<any>) => fn(),
			);
			mockSelect.mockReturnValue({
				from: mock().mockReturnValue({
					where: mock().mockResolvedValue(themes),
				}),
			});

			const result = await subjectService.getSubjectThemes(1);

			expect(result).toEqual(themes);
		});
	});

	// ── getSubjectFiles ──────────────────────────────────────────────────────────

	describe("getSubjectFiles", () => {
		it("should return files associated with subject", async () => {
			const files = [{ id: "f1", name: "notes.pdf", s3Index: "subjects/1/notes.pdf", userId: "u1" }];
			mockSelect.mockReturnValue({
				from: mock().mockReturnValue({
					innerJoin: mock().mockReturnValue({
						where: mock().mockResolvedValue(files),
					}),
				}),
			});

			const result = await subjectService.getSubjectFiles(1);

			expect(result).toEqual(files);
		});
	});

	// ── uploadFileToSubject ──────────────────────────────────────────────────────

	describe("uploadFileToSubject", () => {
		it("should upload file and create subject reference in a transaction", async () => {
			const fileData = { id: "f1", name: "notes.pdf", s3Index: "subjects/1/notes.pdf" };
			const txInsert = mock().mockReturnValue({
				values: mock().mockResolvedValue(undefined),
			});

			mockDb.transaction.mockImplementation(async (fn: (tx: any) => any) => {
				const tx = { insert: txInsert };
				// mock fileService.uploadFile on the instance
				(subjectService as any).fileService = {
					uploadFile: mock().mockResolvedValue(fileData),
				};
				return await fn(tx);
			});

			const mockFile = new File(["content"], "notes.pdf");
			const result = await subjectService.uploadFileToSubject(1, mockFile, "user-1");

			expect(result).toEqual(fileData);
		});
	});
});
