import Elysia, { t, status } from "elysia";
import { authMacro } from "../auth/handlers";
import { QuizService } from "./service";
import { QuizModel } from "./model";
import { QuestionService } from "../question/service";
import { SessionService } from "../session/service";

export const quiz = new Elysia({ prefix: "/quizes" })
  .decorate("quizService", new QuizService())
  .decorate("questionService", new QuestionService())
  .decorate("sessionService", new SessionService())
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
  .delete("/:id", async ({ params: { id }, quizService }) => {
    return await quizService.deleteQuiz(id);
  }, {
    isTeacher: true,
    params: t.Object({ id: t.String({ format: "uuid" }) }),
  })
  .get(
    "/:id/questions",
    async ({ params: { id }, quizService, sessionService, userId, headers: { "x-active-session": activeSessionId } }) => {
      if (activeSessionId) {
        const session = await sessionService.getSession(activeSessionId);
        if (session.userId !== userId) {
          throw status(403, "Forbidden");
        }
        return await quizService.getQuestionsByQuizId(id, activeSessionId, userId);
      }

      const { questions } = await quizService.startQuizSessionAndGetQuestions(userId, id);
      return questions;
    },
    {
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      isAuth: true,
      headers: t.Object({ "x-active-session": t.Optional(t.String({ format: "uuid" })) }),
    },
  )
  .get(
    "/:id/sessions/active",
    async ({ params: { id }, sessionService, userId }) => {
      return await sessionService.getActiveSessions(userId, id);
    },  
    {
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      isAuth: true,
    },
  )
  .get(
    "/:id/sessions/:sessionId/submits",
    async ({ params: { id, sessionId }, sessionService, userId }) => {
      const session = await sessionService.getSession(sessionId);
      if (session.userId !== userId) {
        throw status(403, "Forbidden");
      }
      return await sessionService.getSessionSubmits(sessionId);
    },
    {
      params: t.Object({ id: t.String({ format: "uuid" }), sessionId: t.String({ format: "uuid" }) }),
      isAuth: true,
    },
  )
  .post(
    "/:id/sessions/:sessionId/finish",
    async ({ params: { id, sessionId }, sessionService, userId }) => {
      return await sessionService.endSession(sessionId, userId);
    },
    {
      params: t.Object({ id: t.String({ format: "uuid" }), sessionId: t.String({ format: "uuid" }) }),
      isAuth: true,
    },
  )
  .get(
    "/:id/sessions/all",
    async ({ params: { id }, sessionService, userId }) => {
      return await sessionService.getUserSessions(userId, id);
    },
    {
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      isAuth: true,
    },
  );