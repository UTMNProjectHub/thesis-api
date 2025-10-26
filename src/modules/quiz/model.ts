import { createSelectSchema } from "drizzle-typebox";
import { quizes } from "../../db/schema";

const plainQuiz = createSelectSchema(quizes);

export const QuizModel = {
  plainQuiz: plainQuiz,
};
