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
    "/quizes/:quizId/sessions/active",
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
    "/quizes/:quizId/sessions",
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
    "/quizes/:quizId/sessions",
    async ({ params: { quizId }, sessionService, userId }) => {
      return await sessionService.createSessionIfUnderLimit(userId, quizId);
    },
    {
      isAuth: true,
      params: t.Object({
        quizId: t.String({ format: "uuid" }),
      }),
    },
  )
  .get(
    "/quizes/:quizId/sessions/users",
    async ({ params: { quizId }, quizService }) => {
      return await quizService.getQuizUserSessions(quizId);
    },
    {
      params: t.Object({ quizId: t.String({ format: "uuid" }) }),
      isTeacher: true,
    },
  )
  .post(
    "/quizes/:quizId/sessions/:sessionId/finish",
    async ({ params: { quizId, sessionId }, sessionService, userId }) => {
      return await sessionService.endSession(sessionId, userId);
    },
    {
      params: t.Object({
        quizId: t.String({ format: "uuid" }),
        sessionId: t.String({ format: "uuid" }),
      }),
      isAuth: true,
    },
  )
  .get(
    "/quizes/:quizId/sessions/:sessionId/submits",
    async ({
      params: { quizId, sessionId },
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
        quizId: t.String({ format: "uuid" }),
        sessionId: t.String({ format: "uuid" }),
      }),
      isAuth: true,
    },
  );
