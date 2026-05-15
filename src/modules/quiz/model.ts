import { createSelectSchema } from "drizzle-typebox";
import { t } from "elysia";
import { quizes } from "../../db/schema";

const quizSelectSchema = createSelectSchema(quizes);

const plainQuiz = t.Intersect([
	quizSelectSchema,
	t.Object({
		questionCount: t.Optional(t.Number()),
	}),
]);

export const UpdateQuizBody = t.Object({
	name: t.Optional(t.String()),
	description: t.Optional(t.String()),
	type: t.Optional(t.String()),
	maxSessions: t.Optional(t.Number()),
	themeId: t.Optional(t.Number()),
});

export const QuizModel = {
	plainQuiz: plainQuiz,
	updateQuizBody: UpdateQuizBody,
};
