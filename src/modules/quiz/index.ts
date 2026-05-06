import Elysia, { status, t } from "elysia";
import { authMacro } from "../auth/handlers";
import { QuestionService } from "../question/service";
import { roleMacro } from "../roles/macro";
import { SessionService } from "../session/service";
import { UserService } from "../user/service";
import { QuizModel } from "./model";
import { QuizService } from "./service";

export const quiz = new Elysia({ prefix: "/quizes" })
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
      hasPermission: "view_questions",
      params: t.Object({ quizId: t.String({ format: "uuid" }) }),
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
      hasPermission: "create_quiz",
      params: t.Object({ quizId: t.String({ format: "uuid" }) }),
    },
  )
  .put(
    "/:quizId",
    async ({ params: { quizId }, quizService, body }) => {
      return await quizService.updateQuiz(quizId, body);
    },
    {
      hasPermission: "create_quiz",
      params: t.Object({ quizId: t.String({ format: "uuid" }) }),
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
    set,
  }) => {
    const permissions = await userService.getUserPermissions(userId);
    const canViewAllQuestions = permissions.includes("view_questions");

    if (canViewAllQuestions && view === true) {
      return await quizService.getQuestionsByQuizId(
        quizId,
        undefined,
        userId,
      );
    }

    if (activeSessionId) {
      const session = await sessionService.getSession(activeSessionId);
      if (session.userId !== userId) {
        throw status(403, "Forbidden");
      }
      return await quizService.getQuestionsByQuizId(
        quizId,
        activeSessionId,
        userId,
      );
    }

    return status(403, "Forbidden");
  },
  {
    params: t.Object({ quizId: t.String({ format: "uuid" }) }),
    query: t.Object({ view: t.Optional(t.Boolean()) }),
    isAuth: true,
    headers: t.Object({
      "x-active-session": t.Optional(t.String({ format: "uuid" })),
    }),
  }
);