import Elysia, { t, status } from "elysia";
import { authMacro } from "../auth/handlers";
import { roleMacro } from "../roles/macro";
import { QuizService } from "./service";
import { QuizModel } from "./model";
import { QuestionService } from "../question/service";
import { SessionService } from "../session/service";
import { UserService } from "../user/service";

export const quiz = new Elysia({ prefix: "/quizes" })
  .decorate("quizService", new QuizService())
  .decorate("questionService", new QuestionService())
  .decorate("sessionService", new SessionService())
  .decorate("userService", new UserService())
  .model(QuizModel)
  .use(authMacro)
  .use(roleMacro)
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
  .delete(
    "/:id",
    async ({ params: { id }, quizService }) => {
      return await quizService.deleteQuiz(id);
    },
    {
      isTeacher: true,
      params: t.Object({ id: t.String({ format: "uuid" }) }),
    },
  )
  .put(
    "/:id",
    async ({ params: { id }, quizService, body }) => {
      return await quizService.updateQuiz(id, body);
    },
    {
      isTeacher: true,
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      body: "updateQuizBody",
      response: {
        200: "plainQuiz",
        404: t.String(),
      },
    },
  )
  .get(
    "/:id/questions",
    async ({
      params: { id },
      query: { view },
      quizService,
      sessionService,
      userId,
      headers: { "x-active-session": activeSessionId },
      userService,
      set,
    }) => {
      const roles = await userService.getUserRoles(userId);

      if (activeSessionId) {
        const session = await sessionService.getSession(activeSessionId);
        if (session.userId !== userId) {
          throw status(403, "Forbidden");
        }
        return await quizService.getQuestionsByQuizId(
          id,
          activeSessionId,
          userId,
        );
      }

      if (
        Array.isArray(roles) &&
        roles.some((role: any) => role.slug === "teacher") &&
        view === true
      ) {
        return await quizService.getQuestionsByQuizId(id, undefined, userId);
      }

      const { session, questions } =
        await quizService.startQuizSessionAndGetQuestions(userId, id);

      return { questions, sessionId: session.id };
    },
    {
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      query: t.Object({ view: t.Optional(t.Boolean()) }),
      isAuth: true,
      headers: t.Object({
        "x-active-session": t.Optional(t.String({ format: "uuid" })),
      }),
    },
  );
