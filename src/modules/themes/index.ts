import Elysia, { t } from "elysia";
import { FaqService } from "../faq/service";
import { QuizService } from "../quiz/service";
import { roleMacro } from "../roles/macro";
import { SummaryService } from "../summary/service";
import { ThemeModel } from "./model";
import { ThemeService } from "./service";

export const theme = new Elysia({
	prefix: "/theme",
})
	.use(roleMacro)
	.use(ThemeModel)
	.decorate("themeService", new ThemeService())
	.decorate("quizService", new QuizService())
	.decorate("summaryService", new SummaryService())
	.decorate("faqService", new FaqService())
	.put(
		"/:id",
		({ params: { id }, themeService, body }) => {
			return themeService.updateTheme(id, body);
		},
		{
			isTeacher: true,
			params: t.Object({
				id: t.Number(),
			}),
			body: "updateThemeBody",
			response: {
				200: "plainThemeModel",
				404: t.String(),
			},
		},
	)
	.delete(
		"/:id",
		({ params: { id }, themeService }) => {
			return themeService.deleteTheme(id);
		},
		{
			isTeacher: true,
			params: t.Object({
				id: t.Number(),
			}),
			response: {
				404: t.String(),
			},
		},
	)
	.get(
		"/:id",
		({ params: { id }, themeService }) => {
			return themeService.getThemeById(id);
		},
		{
			isTeacher: true,
			params: t.Object({
				id: t.Number(),
			}),
		},
	)
	.get(
		"/:id/files",
		({ params: { id }, themeService }) => {
			return themeService.getThemeFiles(id);
		},
		{
			isTeacher: true,
			params: t.Object({
				id: t.Number(),
			}),
		},
	)
	.post(
		"/:id/files",
		async ({ params: { id }, themeService, body, userId }) => {
			const file = await body.file;
			return themeService.uploadFileToTheme(id, file, userId);
		},
		{
			isTeacher: true,
			params: t.Object({
				id: t.Number(),
			}),
			body: t.Object({
				file: t.File(),
			}),
		},
	)
	.get(
		"/:id/quizes",
		({ params: { id }, quizService }) => {
			return quizService.getQuizesByThemeId(id);
		},
		{
			isTeacher: true,
			params: t.Object({
				id: t.Number(),
			}),
		},
	)
	.get(
		"/:id/summaries",
		({ params: { id }, summaryService }) => {
			return summaryService.getSummariesByThemeId(id);
		},
		{
			isTeacher: true,
			params: t.Object({
				id: t.Number(),
			}),
		},
	)
	.get(
		"/:id/faqs",
		({ params: { id }, faqService }) => {
			return faqService.getFaqsByThemeId(id);
		},
		{
			isTeacher: true,
			params: t.Object({
				id: t.Number(),
			}),
		},
	);
