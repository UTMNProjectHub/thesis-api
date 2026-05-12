import { eq, inArray } from "drizzle-orm";
import { status } from "elysia";
import { db } from "../../db";
import {
	chosenVariants,
	quizes,
	quizesQuestions,
	quizSession,
	referencesQuiz,
	sessionSubmits,
	users,
	usersQuizes,
} from "../../db/schema";
import { SessionService } from "../session/service";

export class QuizService {
	private sessionService: SessionService;

	constructor() {
		this.sessionService = new SessionService();
	}

	getSessionService(): SessionService {
		return this.sessionService;
	}

	async getQuizById(id: string) {
		const quiz = await db.query.quizes.findFirst({
			where: eq(quizes.id, id),
			with: {
				quizesQuestions: {
					with: {
						question: true,
					},
				},
			},
		});

		if (!quiz) {
			throw status(404, "Not Found");
		}

		return {
			...quiz,
			quizesQuestions: undefined,
			questionCount: quiz.quizesQuestions.length,
		};
	}

	async updateQuiz(
		id: string,
		data: {
			name?: string;
			description?: string;
			type?: string;
			maxSessions?: number;
			themeId?: number | null;
		},
	) {
		const quiz = await db.query.quizes.findFirst({
			where: eq(quizes.id, id),
		});

		if (!quiz) {
			throw status(404, "Not Found");
		}

		const updateData: {
			name?: string;
			description?: string;
			type?: string;
			maxSessions?: number;
			themeId?: number | null;
		} = {};

		if (data.name !== undefined) updateData.name = data.name;
		if (data.description !== undefined)
			updateData.description = data.description;
		if (data.type !== undefined) updateData.type = data.type;
		if (data.maxSessions !== undefined)
			updateData.maxSessions = data.maxSessions;
		if (data.themeId !== undefined) updateData.themeId = data.themeId;

		const [updated] = await db
			.update(quizes)
			.set(updateData)
			.where(eq(quizes.id, id))
			.returning();

		return updated;
	}

	async getQuestionsByQuizId(id: string) {
		const questionsQuery = await db.query.quizesQuestions.findMany({
			where: eq(quizesQuestions.quizId, id),
			with: {
				question: true,
			},
		});

		return questionsQuery.map((qq) => qq.question);
	}

	async getQuestionsWithVariantsByQuizId(id: string) {
		const questionsQuery = await db.query.quizesQuestions.findMany({
			where: eq(quizesQuestions.quizId, id),
			with: {
				question: {
					with: {
						questionsVariants: {
							with: { variant: true },
						},
					},
				},
			},
		});

		return questionsQuery.map((qq) => {
			const { questionsVariants: qvs, ...question } =
				qq.question as typeof qq.question & {
					questionsVariants: Array<{
						id: string;
						questionId: string;
						variantId: string | null;
						isRight: boolean | null;
						variant: {
							id: string;
							text: string;
							leftMatching: string | null;
							rightMatching: string | null;
							explainRight: string;
							explainWrong: string;
						} | null;
					}>;
				};
			const variants = (qvs ?? []).map((qv) => ({
				id: qv.variant?.id ?? "",
				text: qv.variant?.text ?? "",
				leftMatching: qv.variant?.leftMatching ?? null,
				rightMatching: qv.variant?.rightMatching ?? null,
				explainRight: qv.variant?.explainRight ?? "",
				explainWrong: qv.variant?.explainWrong ?? "",
				isRight: qv.isRight ?? false,
				questionId: qv.questionId,
				variantId: qv.variantId ?? "",
				questionsVariantsId: qv.id,
			}));
			return { ...question, variants };
		});
	}

	async getQuizesByThemeId(themeId: number) {
		const quizesList = await db.query.quizes.findMany({
			where: eq(quizes.themeId, themeId),
			with: {
				quizesQuestions: true,
			},
		});

		return quizesList.map((quiz) => ({
			id: quiz.id,
			type: quiz.type,
			name: quiz.name,
			description: quiz.description,
			themeId: quiz.themeId,
			questionCount: quiz.quizesQuestions.length,
			createdAt: quiz.createdAt,
		}));
	}

	async deleteQuiz(id: string) {
		return await db.transaction(async (tx) => {
			// no cascade
			const sessions = await tx.query.quizSession.findMany({
				where: eq(quizSession.quizId, id),
			});

			const sessionIds = sessions.map((s) => s.id);
			if (sessionIds.length > 0) {
				await tx
					.delete(sessionSubmits)
					.where(inArray(sessionSubmits.sessionId, sessionIds));
			}

			// no cascade
			await tx.delete(usersQuizes).where(eq(usersQuizes.quizId, id));
			await tx.delete(referencesQuiz).where(eq(referencesQuiz.quizId, id));

			return await tx.delete(quizes).where(eq(quizes.id, id));
		});
	}

	async getQuizUserSessions(quizId: string) {
		const questionCount = await db.query.quizesQuestions.findMany({
			where: eq(quizesQuestions.quizId, quizId),
		});
		const totalQuestions = questionCount.length;

		const sessionsData = await db
			.select({
				userId: users.id,
				fullName: users.full_name,
				email: users.email,
				sessionId: quizSession.id,
				timeStart: quizSession.timeStart,
				timeEnd: quizSession.timeEnd,
				submitId: sessionSubmits.id,
				isRight: chosenVariants.isRight,
			})
			.from(users)
			.innerJoin(quizSession, eq(users.id, quizSession.userId))
			.leftJoin(sessionSubmits, eq(sessionSubmits.sessionId, quizSession.id))
			.leftJoin(chosenVariants, eq(sessionSubmits.submitId, chosenVariants.id))
			.where(eq(quizSession.quizId, quizId));

		const sessionsMap = new Map<
			string,
			{
				userId: string;
				fullName: string | null;
				email: string;
				sessionId: string;
				timeStart: Date | null;
				timeEnd: Date | null;
				totalSubmits: number;
				rightAnswers: number;
			}
		>();

		for (const row of sessionsData) {
			const key = row.sessionId;
			if (!sessionsMap.has(key)) {
				sessionsMap.set(key, {
					userId: row.userId,
					fullName: row.fullName,
					email: row.email,
					sessionId: row.sessionId,
					timeStart: row.timeStart,
					timeEnd: row.timeEnd,
					totalSubmits: 0,
					rightAnswers: 0,
				});
			}
			// biome-ignore lint/style/noNonNullAssertion: key was just set above
			const session = sessionsMap.get(key)!;
			if (row.submitId) {
				session.totalSubmits++;
				if (row.isRight === true) {
					session.rightAnswers++;
				}
			}
		}

		const sessions = Array.from(sessionsMap.values());

		const groupedByUser = sessions.reduce(
			(acc, session) => {
				const userId = session.userId;
				if (!acc[userId]) {
					acc[userId] = {
						userId: session.userId,
						fullName: session.fullName,
						email: session.email,
						sessions: [],
					};
				}

				const percentSolved =
					totalQuestions > 0
						? Math.round((session.totalSubmits / totalQuestions) * 100 * 100) /
							100
						: 0;
				const percentRight =
					session.totalSubmits > 0
						? Math.round(
								(session.rightAnswers / session.totalSubmits) * 100 * 100,
							) / 100
						: 0;

				acc[userId].sessions.push({
					id: session.sessionId,
					timeStart: session.timeStart,
					timeEnd: session.timeEnd,
					percentSolved,
					percentRight,
				});
				return acc;
			},
			{} as Record<
				string,
				{
					userId: string;
					fullName: string | null;
					email: string;
					sessions: Array<{
						id: string;
						timeStart: Date | null;
						timeEnd: Date | null;
						percentSolved: number;
						percentRight: number;
					}>;
				}
			>,
		);

		return Object.values(groupedByUser);
	}
}
