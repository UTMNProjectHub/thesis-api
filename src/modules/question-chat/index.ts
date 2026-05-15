import Elysia, { t } from "elysia";
import { authMacro } from "../auth/handlers";
import { QuestionService } from "../question/service";
import { db } from "../../db";
import { eq } from "drizzle-orm";
import { questionSubmissions } from "../../db/schema";
import { QuestionChatService } from "./service";

export const questionChatModule = new Elysia({
	prefix: "/questions-chat",
})
	.use(authMacro)
	.decorate("QuestionChatService", new QuestionChatService())
	.get(
		"/",
		async ({ query: { questionId, sessionId }, QuestionChatService, userId }) =>
			QuestionChatService.getMessages(questionId, userId, sessionId),
		{
			query: t.Object({
				questionId: t.String({ format: "uuid" }),
				sessionId: t.String({ format: "uuid" }),
			}),
			isAuth: true,
		},
	)
	.post(
		"/",
		async ({
			body: { questionId, sessionId, text },
			QuestionChatService,
			userId,
		}) => {
			await QuestionChatService.submitMessage(
				questionId,
				userId,
				sessionId,
				text,
			);
		},
		{
			body: t.Object({
				questionId: t.String({
					format: "uuid",
				}),
				sessionId: t.String({
					format: "uuid",
				}),
				text: t.String({
					minLength: 1,
				}),
			}),
			isAuth: true,
		},
	);
