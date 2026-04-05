import Elysia, { status, t } from "elysia";
import { authMacro } from "../auth/handlers";
import { QuestionService } from "../question/service";
import { roleMacro } from "../roles/macro";
import { SessionService } from "../session/service";
import { UserService } from "../user/service";
import { QuizModel } from "./model";
import { QuizService } from "./service";

export const quiz = new Elysia({
	prefix: "/quizes",
})
	.decorate("quizService", new QuizService())
	.decorate("questionService", new QuestionService())
	.decorate("sessionService", new SessionService())
	.decorate("userService", new UserService())
	.model(QuizModel)
	.use(authMacro)
	.use(roleMacro)
	.get(
		"/:quizId",
		async ({ quizService, params: { quizId } }) => {
			return await quizService.getQuizById(quizId);
		},
		{
			isAuth: true,
			params: t.Object({
				quizId: t.String({ format: "uuid" }),
			}),
			response: {
				200: "plainQuiz",
			},
		},
	)
	.delete(
		"/:quizId",
		async ({ params: { quizId }, quizService }) => {
			return await quizService.deleteQuiz(quizId);
		},
		{
			isTeacher: true,
			params: t.Object({
				quizId: t.String({ format: "uuid" }),
			}),
		},
	)
	.put(
		"/:quizId",
		async ({ params: { quizId }, quizService, body }) => {
			return await quizService.updateQuiz(quizId, body);
		},
		{
			isTeacher: true,
			params: t.Object({
				quizId: t.String({ format: "uuid" }),
			}),
			body: "updateQuizBody",
			response: {
				200: "plainQuiz",
				404: t.String(),
			},
		},
	)
	.get(
		"/:quizId/questions",
		async ({
			params: { quizId },
			query: { view },
			quizService,
			sessionService,
			userId,
			headers: { "x-active-session": activeSessionId },
			userService,
		}) => {
			const roles = await userService.getUserRoles(userId);
			const isTeacher =
				Array.isArray(roles) &&
				roles.some((role: { slug: string }) => role.slug === "teacher");

			// Teachers with view flag can see questions directly
			if (isTeacher && view === true) {
				return await quizService.getQuestionsByQuizId(quizId);
			}

			// Students need an active session header
			if (activeSessionId) {
				const session = await sessionService.getSession(activeSessionId);

				if (session.userId !== userId) {
					throw status(403, "Forbidden");
				}

				if (session.quizId !== quizId) {
					throw status(403, "Session does not belong to this quiz");
				}

				return await quizService.getQuestionsByQuizId(quizId);
			}

			throw status(403, "Forbidden");
		},
		{
			params: t.Object({
				quizId: t.String({ format: "uuid" }),
			}),
			query: t.Object({
				view: t.Optional(t.Boolean()),
			}),
			isAuth: true,
			headers: t.Object({
				"x-active-session": t.Optional(
					t.String({ format: "uuid" }),
				),
			}),
		},
	);
