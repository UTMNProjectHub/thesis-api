import { createSelectSchema } from "drizzle-typebox";
import { quizes } from "../../db/schema";
import { t } from "elysia";

const plainQuiz = createSelectSchema(quizes);

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
