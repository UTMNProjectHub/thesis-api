import Elysia, { status, t } from "elysia";
import { authMacro } from "../auth/handlers";
import { roleMacro } from "../roles/macro";
import { SessionService } from "../session/service";
import { UserService } from "../user/service";
import {
	ErrorResponse,
	QuestionModel,
	RegradeBody,
	RegradeResponse,
	SolveQuestionBody,
	SolveQuestionParams,
	SolveQuestionTextResponseUnion,
	SolveQuestionVariantsResponse,
	UpdateQuestionBody,
	UpdateQuestionVariantsBody,
	VariantModel,
} from "./model";
import { QuestionService } from "./service";
import { shuffleWithSeed } from "./utils";

export const question = new Elysia({
	prefix: "/questions",
})
	.use(authMacro)
	.use(roleMacro)
	.decorate("questionService", new QuestionService())
	.decorate("sessionService", new SessionService())
	.decorate("userService", new UserService())
	.get(
		"/:id",
		async ({ params: { id }, questionService }) => {
			const question = await questionService.getQuestion(id);
			const variants = await questionService.getQuestionVariants(id);

			return {
				...question,
				variants,
			};
		},
		{
			isTeacher: true,
			params: SolveQuestionParams,
			response: {
				200: t.Object({
					id: t.String({
						format: "uuid",
					}),
					type: t.String(),
					multiAnswer: t.Nullable(t.Boolean()),
					text: t.String(),
					variants: t.Array(VariantModel),
				}),
				404: ErrorResponse,
			},
		},
	)
	.get(
		"/:id/variants",
		async ({
			params: { id },
			userId,
			userService,
			questionService,
			sessionService,
			headers: { "x-active-session": activeSessionId },
		}) => {
			const roles = await userService.getUserRoles(userId);
			const isTeacher =
				Array.isArray(roles) &&
				roles.some((role: { slug: string }) => role.slug === "teacher");

			if (isTeacher && !activeSessionId) {
				return await questionService.getQuestionVariants(id);
			}

			if (!activeSessionId) {
				throw status(
					400,
					"Active session header required for accessing question variants",
				);
			}

			const question = await questionService.getQuestion(id);
			const allVariants = await questionService.getQuestionVariants(id);

			if (question.type === "matching") {
				const session = await sessionService.getSession(activeSessionId);
				if (session.userId !== userId) {
					throw status(403, "Forbidden");
				}

				const leftItems = allVariants
					.filter((v) => v.leftMatching !== null)
					.map((v) => ({
						id: v.id,
						text: v.leftMatching as string,
					}));

				const rightItems = allVariants
					.filter((v) => v.rightMatching !== null)
					.map((v) => ({
						id: v.id,
						text: v.rightMatching as string,
					}));

				return {
					leftItems,
					rightItems: shuffleWithSeed(rightItems, session.id),
				};
			}

			return allVariants.map((v) => ({
				id: v.id,
				text: v.text,
			}));
		},
		{
			params: SolveQuestionParams,
			isAuth: true,
			headers: t.Object({
				"x-active-session": t.Optional(
					t.String({
						format: "uuid",
					}),
				),
			}),
		},
	)
	.post(
		"/:id/solve",
		async ({
			userId,
			params: { id },
			body: { answerIds, answerText, answerPairs, quizId },
			questionService,
		}) => {
			if (!answerIds && !answerText && !answerPairs) {
				return status(400, "Bad Request");
			}

			if (answerIds) {
				return await questionService.submitQuestionVariants(
					userId,
					quizId,
					id,
					answerIds,
				);
			}

			if (answerText) {
				return await questionService.submitQuestionText(
					userId,
					quizId,
					id,
					answerText,
				);
			}

			if (answerPairs) {
				return await questionService.submitQuestionPairs(
					userId,
					quizId,
					id,
					answerPairs,
				);
			}

			return status(400, "Bad Request");
		},
		{
			isAuth: true,
			params: SolveQuestionParams,
			response: {
				200: t.Union([
					SolveQuestionVariantsResponse,
					SolveQuestionTextResponseUnion,
				]),
				400: ErrorResponse,
			},
			body: SolveQuestionBody,
		},
	)
	.post(
		"/:id/regrade",
		async ({
			params: { id },
			body: { submissionId, isRight, explanation },
			questionService,
		}) => {
			const submission = await questionService.regradeSubmission(
				submissionId,
				isRight,
				explanation,
			);

			if (submission.questionId !== id) {
				throw status(400, "Submission does not belong to this question");
			}

			return submission;
		},
		{
			isTeacher: true,
			params: SolveQuestionParams,
			body: RegradeBody,
			response: {
				200: RegradeResponse,
				400: ErrorResponse,
				404: ErrorResponse,
			},
		},
	)
	.put(
		"/:id",
		async ({ params: { id }, questionService, body }) => {
			return await questionService.updateQuestion(id, body);
		},
		{
			isTeacher: true,
			params: SolveQuestionParams,
			body: UpdateQuestionBody,
			response: {
				200: QuestionModel,
				404: ErrorResponse,
			},
		},
	)
	.put(
		"/:id/variants",
		async ({ params: { id }, questionService, body }) => {
			const variants = body.variants.map((variant) => ({
				...variant,
				leftMatching: null,
				rightMatching: null,
			}));

			return await questionService.updateQuestionVariants(id, variants);
		},
		{
			isTeacher: true,
			params: SolveQuestionParams,
			body: UpdateQuestionVariantsBody,
			response: {
				200: t.Object({
					success: t.Boolean(),
				}),
				404: ErrorResponse,
			},
		},
	);
