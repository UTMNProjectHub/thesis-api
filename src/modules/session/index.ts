import Elysia, { status, t } from "elysia";
import { authMacro } from "../auth/handlers";
import { roleMacro } from "../roles/macro";
import { SessionService } from "./service";
import { QuizService } from "../quiz/service";

export const quizSession = new Elysia()
  .use(authMacro)
  .use(roleMacro)
  .decorate("sessionService", new SessionService())
  .decorate("quizService", new QuizService())
  .get(
    "/quiz/:quizId/sessions/active",
    async ({ params: { quizId }, sessionService, userId }) => {
      return await sessionService.getActiveSessions(userId, quizId);
    },
    {
      isAuth: true,
      params: t.Object({
        quizId: t.String({ format: "uuid" }),
      }),
    },
  )
  .get(
    "/quiz/:quizId/sessions",
    async ({ userId, sessionService, params: { quizId } }) => {
      return await sessionService.getUserSessions(userId, quizId);
    },
    {
      isAuth: true,
      params: t.Object({
        quizId: t.String({
          format: "uuid",
        }),
      }),
    },
  )
  .post(
    "/quiz/:quizId/sessions",
    async ({ params: { quizId }, sessionService, quizService, userId }) => {
      const quiz = await quizService.getQuizById(quizId);

      if (!quiz) {
        return status(400, "Bad Request");
      }

      const activeSessions = await sessionService.getActiveSessions(
        userId,
        quizId,
      );

      if (activeSessions.length >= quiz.maxSessions) {
        return status(409, "Достигнуто максимальное кол-во активных сессий.");
      }

      return await sessionService.createSession(userId, quizId);
    },
    {
      isAuth: true,
      params: t.Object({
        quizId: t.String({ format: "uuid" }),
      }),
    },
  )
  .get(
    "/quiz/:quizId/sessions/users",
    async ({ params: { id }, quizService }) => {
      return await quizService.getQuizUserSessions(id);
    },
    {
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      isTeacher: true,
    },
  )
  .post(
    "/quiz/:quizId/sessions/:sessionId/finish",
    async ({ params: { id, sessionId }, sessionService, userId }) => {
      return await sessionService.endSession(sessionId, userId);
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
        sessionId: t.String({ format: "uuid" }),
      }),
      isAuth: true,
    },
  )
  .get(
    "/:id/sessions/:sessionId/submits",
    async ({
      params: { id, sessionId },
      sessionService,
      userService,
      userId,
    }) => {
      const session = await sessionService.getSession(sessionId);
      const userRoles = await userService.getUserRoles(userId);
      const isTeacher =
        Array.isArray(userRoles) &&
        userRoles.some((role: any) => role.slug === "teacher");
      if (session.userId !== userId && !isTeacher) {
        throw status(403, "Forbidden");
      }
      return await sessionService.getSessionSubmits(sessionId);
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
        sessionId: t.String({ format: "uuid" }),
      }),
      isAuth: true,
    },
  );
