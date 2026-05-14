import { beforeEach, describe, expect, it, mock } from "bun:test";

const mockFindFirstQuizSession = mock();
const mockFindManyQuizSession = mock();
const mockFindManySessionSubmits = mock();
const mockFindFirstSessionSubmits = mock();
const mockInsert = mock();
const mockUpdate = mock();
const mockSelect = mock();

const mockDb = {
	query: {
		quizSession: {
			findFirst: mockFindFirstQuizSession,
			findMany: mockFindManyQuizSession,
		},
		sessionSubmits: {
			findFirst: mockFindFirstSessionSubmits,
			findMany: mockFindManySessionSubmits,
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
	isNull: mock((field: unknown) => ({ isNull: field })),
	count: mock(() => ({ count: true })),
	inArray: mock((...args: unknown[]) => ({ inArray: args })),
}));

import { SessionService } from "../service";

describe("SessionService", () => {
	let sessionService: SessionService;

	beforeEach(() => {
		sessionService = new SessionService();
		mockFindFirstQuizSession.mockReset();
		mockFindManyQuizSession.mockReset();
		mockFindManySessionSubmits.mockReset();
		mockFindFirstSessionSubmits.mockReset();
		mockInsert.mockReset();
		mockUpdate.mockReset();
		mockSelect.mockReset();
		mockDb.transaction.mockReset();
	});

	// ── getSession ──────────────────────────────────────────────────────────────

	describe("getSession", () => {
		it("should return session when found", async () => {
			const mockSession = { id: "session-1", userId: "user-1", quizId: "quiz-1" };
			mockFindFirstQuizSession.mockResolvedValue(mockSession);

			const result = await sessionService.getSession("session-1");

			expect(result).toEqual(mockSession);
		});

		it("should throw 404 when session not found", async () => {
			mockFindFirstQuizSession.mockResolvedValue(null);

			try {
				await sessionService.getSession("missing");
				expect(true).toBe(false);
			} catch (error: any) {
				expect(error.code).toBe(404);
				expect(error.response).toBe("Session not found");
			}
		});
	});

	// ── getSessionSubmits ────────────────────────────────────────────────────────

	describe("getSessionSubmits", () => {
		it("should return submits mapped from sessionSubmits", async () => {
			const submitData = { id: "submit-1", answer: "test" };
			mockFindManySessionSubmits.mockResolvedValue([{ submit: submitData }]);

			const result = await sessionService.getSessionSubmits("session-1");

			expect(result).toEqual([submitData]);
		});
	});

	// ── getActiveSessions ────────────────────────────────────────────────────────

	describe("getActiveSessions", () => {
		it("should return active sessions", async () => {
			const activeSessions = [{ id: "session-1", timeEnd: null }];
			mockFindManyQuizSession.mockResolvedValue(activeSessions);

			const result = await sessionService.getActiveSessions("user-1", "quiz-1");

			expect(result).toEqual(activeSessions);
		});

		it("should return empty array when no active sessions", async () => {
			mockFindManyQuizSession.mockResolvedValue([]);

			const result = await sessionService.getActiveSessions("user-1", "quiz-1");

			expect(result).toEqual([]);
		});
	});

	// ── getActiveSessionOrThrow ──────────────────────────────────────────────────

	describe("getActiveSessionOrThrow", () => {
		it("should return the single active session", async () => {
			const session = { id: "session-1", timeEnd: null };
			mockFindManyQuizSession.mockResolvedValue([session]);

			const result = await sessionService.getActiveSessionOrThrow("user-1", "quiz-1");

			expect(result).toEqual(session);
		});

		it("should throw 404 when no active sessions", async () => {
			mockFindManyQuizSession.mockResolvedValue([]);

			try {
				await sessionService.getActiveSessionOrThrow("user-1", "quiz-1");
				expect(true).toBe(false);
			} catch (error: any) {
				expect(error.code).toBe(404);
				expect(error.response).toBe("Active session not found");
			}
		});

		it("should throw 404 when more than one active session", async () => {
			mockFindManyQuizSession.mockResolvedValue([
				{ id: "s1", timeEnd: null },
				{ id: "s2", timeEnd: null },
			]);

			try {
				await sessionService.getActiveSessionOrThrow("user-1", "quiz-1");
				expect(true).toBe(false);
			} catch (error: any) {
				expect(error.code).toBe(404);
			}
		});
	});

	// ── createSession ────────────────────────────────────────────────────────────

	describe("createSession", () => {
		it("should return existing active session if one exists", async () => {
			const existing = { id: "session-1", timeEnd: null };
			mockFindManyQuizSession.mockResolvedValue([existing]);

			const result = await sessionService.createSession("user-1", "quiz-1");

			expect(result).toEqual(existing);
			expect(mockInsert).not.toHaveBeenCalled();
		});

		it("should create and return a new session when none active", async () => {
			const newSession = { id: "session-new", userId: "user-1", quizId: "quiz-1" };
			mockFindManyQuizSession.mockResolvedValue([]);
			mockInsert.mockReturnValue({
				values: mock().mockReturnValue({
					returning: mock().mockResolvedValue([newSession]),
				}),
			});

			const result = await sessionService.createSession("user-1", "quiz-1");

			expect(result).toEqual(newSession);
		});
	});

	// ── createSessionIfUnderLimit ────────────────────────────────────────────────

	describe("createSessionIfUnderLimit", () => {
		it("should create session when under the limit", async () => {
			const quiz = { id: "quiz-1", maxSessions: 3 };
			const newSession = { id: "session-new" };

			mockDb.transaction.mockImplementation(async (fn: (tx: any) => any) => {
				const tx = {
					select: mock().mockReturnValue({
						from: mock().mockReturnValue({
							where: mock().mockReturnValue({
								for: mock().mockResolvedValue([quiz]),
							}),
						}),
					}),
					insert: mock().mockReturnValue({
						values: mock().mockReturnValue({
							returning: mock().mockResolvedValue([newSession]),
						}),
					}),
				};
				// second select call returns session count
				let selectCallCount = 0;
				tx.select.mockImplementation(() => {
					selectCallCount++;
					if (selectCallCount === 1) {
						return {
							from: mock().mockReturnValue({
								where: mock().mockReturnValue({
									for: mock().mockResolvedValue([quiz]),
								}),
							}),
						};
					}
					return {
						from: mock().mockReturnValue({
							where: mock().mockResolvedValue([{ sessionCount: 1 }]),
						}),
					};
				});
				return await fn(tx);
			});

			const result = await sessionService.createSessionIfUnderLimit("user-1", "quiz-1");
			expect(result).toEqual(newSession);
		});

		it("should throw 409 when at max sessions", async () => {
			mockDb.transaction.mockImplementation(async (fn: (tx: any) => any) => {
				let selectCallCount = 0;
				const tx = {
					select: mock().mockImplementation(() => {
						selectCallCount++;
						if (selectCallCount === 1) {
							return {
								from: mock().mockReturnValue({
									where: mock().mockReturnValue({
										for: mock().mockResolvedValue([{ id: "quiz-1", maxSessions: 2 }]),
									}),
								}),
							};
						}
						return {
							from: mock().mockReturnValue({
								where: mock().mockResolvedValue([{ sessionCount: 2 }]),
							}),
						};
					}),
				};
				return await fn(tx);
			});

			try {
				await sessionService.createSessionIfUnderLimit("user-1", "quiz-1");
				expect(true).toBe(false);
			} catch (error: any) {
				expect(error.code).toBe(409);
			}
		});

		it("should throw 400 when quiz not found", async () => {
			mockDb.transaction.mockImplementation(async (fn: (tx: any) => any) => {
				const tx = {
					select: mock().mockReturnValue({
						from: mock().mockReturnValue({
							where: mock().mockReturnValue({
								for: mock().mockResolvedValue([]),
							}),
						}),
					}),
				};
				return await fn(tx);
			});

			try {
				await sessionService.createSessionIfUnderLimit("user-1", "quiz-1");
				expect(true).toBe(false);
			} catch (error: any) {
				expect(error.code).toBe(400);
			}
		});
	});

	// ── endSession ───────────────────────────────────────────────────────────────

	describe("endSession", () => {
		it("should end the session successfully", async () => {
			const session = { id: "session-1", userId: "user-1", timeEnd: null };
			const updated = { ...session, timeEnd: new Date() };
			mockFindFirstQuizSession.mockResolvedValue(session);
			mockUpdate.mockReturnValue({
				set: mock().mockReturnValue({
					where: mock().mockReturnValue({
						returning: mock().mockResolvedValue([updated]),
					}),
				}),
			});

			const result = await sessionService.endSession("session-1", "user-1");

			expect(result).toEqual(updated);
		});

		it("should throw 404 when session not found", async () => {
			mockFindFirstQuizSession.mockResolvedValue(null);

			try {
				await sessionService.endSession("missing", "user-1");
				expect(true).toBe(false);
			} catch (error: any) {
				expect(error.code).toBe(404);
			}
		});

		it("should throw 403 when userId does not match", async () => {
			mockFindFirstQuizSession.mockResolvedValue({
				id: "session-1",
				userId: "other-user",
				timeEnd: null,
			});

			try {
				await sessionService.endSession("session-1", "user-1");
				expect(true).toBe(false);
			} catch (error: any) {
				expect(error.code).toBe(403);
				expect(error.response).toBe("Forbidden");
			}
		});

		it("should throw 400 when session already ended", async () => {
			mockFindFirstQuizSession.mockResolvedValue({
				id: "session-1",
				userId: "user-1",
				timeEnd: new Date(),
			});

			try {
				await sessionService.endSession("session-1", "user-1");
				expect(true).toBe(false);
			} catch (error: any) {
				expect(error.code).toBe(400);
				expect(error.response).toBe("Session already ended");
			}
		});
	});

	// ── addSubmitToSession ───────────────────────────────────────────────────────

	describe("addSubmitToSession", () => {
		it("should insert and return new submit", async () => {
			const session = { id: "session-1", timeEnd: null };
			const newSubmit = { id: "submit-1", sessionId: "session-1", submitId: "sv-1" };
			mockFindFirstQuizSession.mockResolvedValue(session);
			mockFindFirstSessionSubmits.mockResolvedValue(null);
			mockInsert.mockReturnValue({
				values: mock().mockReturnValue({
					returning: mock().mockResolvedValue([newSubmit]),
				}),
			});

			const result = await sessionService.addSubmitToSession("session-1", "sv-1");

			expect(result).toEqual(newSubmit);
		});

		it("should return existing submit without inserting when duplicate", async () => {
			const session = { id: "session-1", timeEnd: null };
			const existing = { id: "existing-1", sessionId: "session-1", submitId: "sv-1" };
			mockFindFirstQuizSession.mockResolvedValue(session);
			mockFindFirstSessionSubmits.mockResolvedValue(existing);

			const result = await sessionService.addSubmitToSession("session-1", "sv-1");

			expect(result).toEqual(existing);
			expect(mockInsert).not.toHaveBeenCalled();
		});

		it("should throw 404 when session not found", async () => {
			mockFindFirstQuizSession.mockResolvedValue(null);

			try {
				await sessionService.addSubmitToSession("missing", "sv-1");
				expect(true).toBe(false);
			} catch (error: any) {
				expect(error.code).toBe(404);
			}
		});

		it("should throw 400 when session is already ended", async () => {
			mockFindFirstQuizSession.mockResolvedValue({
				id: "session-1",
				timeEnd: new Date(),
			});

			try {
				await sessionService.addSubmitToSession("session-1", "sv-1");
				expect(true).toBe(false);
			} catch (error: any) {
				expect(error.code).toBe(400);
				expect(error.response).toBe("Cannot add submit to ended session");
			}
		});
	});

	// ── getSessionByUserAndQuiz ──────────────────────────────────────────────────

	describe("getSessionByUserAndQuiz", () => {
		it("should return the most recent session for a user+quiz pair", async () => {
			const session = { id: "session-1", userId: "user-1", quizId: "quiz-1" };
			mockFindFirstQuizSession.mockResolvedValue(session);

			const result = await sessionService.getSessionByUserAndQuiz("user-1", "quiz-1");

			expect(result).toEqual(session);
		});

		it("should return undefined when no session exists", async () => {
			mockFindFirstQuizSession.mockResolvedValue(undefined);

			const result = await sessionService.getSessionByUserAndQuiz("user-1", "quiz-1");

			expect(result).toBeUndefined();
		});
	});

	// ── createSessionInTransaction ───────────────────────────────────────────────

	describe("createSessionInTransaction", () => {
		it("should insert and return a session using the provided transaction", async () => {
			const newSession = { id: "session-new", userId: "user-1", quizId: "quiz-1" };
			const tx = {
				insert: mock().mockReturnValue({
					values: mock().mockReturnValue({
						returning: mock().mockResolvedValue([newSession]),
					}),
				}),
			};

			const result = await sessionService.createSessionInTransaction(
				tx as any,
				"user-1",
				"quiz-1",
			);

			expect(result).toEqual(newSession);
			expect(tx.insert).toHaveBeenCalledTimes(1);
		});
	});

	// ── getUserSessions ──────────────────────────────────────────────────────────

	describe("getUserSessions", () => {
		it("should return all sessions for a user+quiz pair", async () => {
			const sessions = [
				{ id: "s1", userId: "user-1", quizId: "quiz-1" },
				{ id: "s2", userId: "user-1", quizId: "quiz-1" },
			];
			mockFindManyQuizSession.mockResolvedValue(sessions);

			const result = await sessionService.getUserSessions("user-1", "quiz-1");

			expect(result).toEqual(sessions);
		});

		it("should return empty array when no sessions found", async () => {
			mockFindManyQuizSession.mockResolvedValue([]);

			const result = await sessionService.getUserSessions("user-1", "quiz-1");

			expect(result).toEqual([]);
		});
	});

	// ── addSubmitsToSessionInTransaction ─────────────────────────────────────────

	describe("addSubmitsToSessionInTransaction", () => {
		it("should bulk insert multiple submits via transaction", async () => {
			const tx = {
				insert: mock().mockReturnValue({
					values: mock().mockResolvedValue(undefined),
				}),
			};

			await sessionService.addSubmitsToSessionInTransaction(
				tx as any,
				"session-1",
				["sv-1", "sv-2"],
			);

			expect(tx.insert).toHaveBeenCalledTimes(1);
		});
	});
});
