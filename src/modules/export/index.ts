import Elysia, { t } from "elysia";
import { authMacro } from "../auth/handlers";
import { roleMacro } from "../roles/macro";
import { ExportService } from "./service";

export const exportQuiz = new Elysia({
	prefix: "/export",
})
	.decorate("exportService", new ExportService())
	.use(authMacro)
	.use(roleMacro)
	.get(
		"/:quizId/moodlexml",
		async ({ exportService, params: { quizId }, set }) => {
			const xml = await exportService.exportQuizToMoodleXml(quizId);
			set.headers["Content-Type"] = "application/xml; charset=utf-8";
			set.headers["Content-Disposition"] = `attachment; filename="quiz-${quizId}.xml"`;
			return xml;
		},
		{
			isTeacher: true,
			params: t.Object({
				quizId: t.String({ format: "uuid" }),
			}),
		},
	);
