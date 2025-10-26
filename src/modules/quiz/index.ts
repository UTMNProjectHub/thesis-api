import Elysia, { t } from "elysia";
import { authMacro } from "../auth/handlers";
import { QuizService } from "./service";
import { QuizModel } from "./model";
import { QuestionService } from "../question/service";

export const quiz = new Elysia({ prefix: "/quizes" })
  .decorate("quizService", new QuizService())
  .decorate("questionService", new QuestionService())
  .model(QuizModel)
  .use(authMacro)
  .get(
    "/:id",
    async ({ quizService, params: { id } }) => {
      return await quizService.getQuizById(id);
    },
    {
      isAuth: true,
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      response: {
        200: "plainQuiz",
      },
    },
  )
  .get(
    "/:id/questions",
    async ({ params: { id }, quizService }) => {
      return await quizService.getQuestionsByQuizId(id);
    },
    {
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      isAuth: true,
    },
  );
