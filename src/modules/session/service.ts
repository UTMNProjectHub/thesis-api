import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "../../db";
import { quizes, quizSession, sessionSubmits } from "../../db/schema";
import { status } from "elysia";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class SessionService {
  async getSession(sessionId: string) {
    const session = await db.query.quizSession.findFirst({
      where: eq(quizSession.id, sessionId),
      with: {
        quiz: true,
        user: true,
        sessionSubmits: {
          with: {
            submit: true,
          },
        },
      },
    });

    if (!session) {
      throw status(404, "Session not found");
    }

    return session;
  }

  async getSessionSubmits(sessionId: string) {
    const submits = await db.query.sessionSubmits.findMany({
      where: eq(sessionSubmits.sessionId, sessionId),
      with: {
        submit: {
          with: {
            chosenVariant: {
              with: {
                variant: true
              },
            },
          },
        },
      },
    });
    return submits.map((submit) => submit.submit);
  }

  async getSessionByUserAndQuiz(userId: string, quizId: string) {
    const session = await db.query.quizSession.findFirst({
      where: and(
        eq(quizSession.userId, userId),
        eq(quizSession.quizId, quizId),
      ),
      with: {
        quiz: true,
        user: true,
        sessionSubmits: {
          with: {
            submit: true,
          },
        },
      },
      orderBy: (quizSession, { desc }) => [desc(quizSession.timeStart)],
    });

    return session;
  }

  async getActiveSessions(userId: string, quizId: string) {
    const sessions = await db.query.quizSession.findMany({
      where: and(
        eq(quizSession.userId, userId),
        eq(quizSession.quizId, quizId),
        isNull(quizSession.timeEnd),
      ),
      with: {
        quiz: true,
        sessionSubmits: {
          with: {
            submit: true,
          },
        },
      },
      orderBy: (quizSession, { desc }) => [desc(quizSession.timeStart)],
    });

    return sessions;
  }

  async getActiveSessionOrThrow(userId: string, quizId: string) {
    const sessions = await this.getActiveSessions(userId, quizId);
    
    if (!sessions || sessions.length !== 1) {
      throw status(404, "Active session not found");
    }

    return sessions[0];
  }

  async createSession(userId: string, quizId: string) {
    const activeSessions = await this.getActiveSessions(userId, quizId);
    if (activeSessions.length > 0) {
      return activeSessions[0];
    }

    const [session] = await db
      .insert(quizSession)
      .values({
        userId,
        quizId,
        timeStart: new Date(),
      })
      .returning();

    return session;
  }

  async createSessionIfUnderLimit(userId: string, quizId: string) {
    return await db.transaction(async (tx) => {
      const [quiz] = await tx
        .select()
        .from(quizes)
        .where(eq(quizes.id, quizId))
        .for("update");

      if (!quiz) {
        throw status(400, "Bad Request");
      }

      const [{ sessionCount }] = await tx
        .select({ sessionCount: count() })
        .from(quizSession)
        .where(
          and(
            eq(quizSession.userId, userId),
            eq(quizSession.quizId, quizId),
          ),
        );

      if (sessionCount >= quiz.maxSessions) {
        throw status(409, "Достигнуто максимальное кол-во активных сессий.");
      }

      const [session] = await tx
        .insert(quizSession)
        .values({
          userId,
          quizId,
          timeStart: new Date(),
        })
        .returning();

      return session;
    });
  }

  async endSession(sessionId: string, userId: string) {
    const session = await db.query.quizSession.findFirst({
      where: eq(quizSession.id, sessionId),
    });

    if (!session) {
      throw status(404, "Session not found");
    }

    if (session.userId !== userId) {
      throw status(403, "Forbidden");
    }

    if (session.timeEnd) {
      throw status(400, "Session already ended");
    }

    const [updatedSession] = await db
      .update(quizSession)
      .set({
        timeEnd: new Date(),
      })
      .where(eq(quizSession.id, sessionId))
      .returning();

    return updatedSession;
  }

  async getUserSessions(userId: string, quizId: string) {
    const sessions = await db.query.quizSession.findMany({
      where: and(
        eq(quizSession.userId, userId),
        eq(quizSession.quizId, quizId),
      ),
      orderBy: (quizSession, { desc }) => [desc(quizSession.timeStart)],
    });

    return sessions;
  }

  async addSubmitToSession(sessionId: string, submitId: string) {
    const session = await db.query.quizSession.findFirst({
      where: eq(quizSession.id, sessionId),
    });

    if (!session) {
      throw status(404, "Session not found");
    }

    if (session.timeEnd) {
      throw status(400, "Cannot add submit to ended session");
    }

    const existingSubmit = await db.query.sessionSubmits.findFirst({
      where: and(
        eq(sessionSubmits.sessionId, sessionId),
        eq(sessionSubmits.submitId, submitId),
      ),
    });

    if (existingSubmit) {
      return existingSubmit;
    }

    const [sessionSubmit] = await db
      .insert(sessionSubmits)
      .values({
        sessionId,
        submitId,
      })
      .returning();

    return sessionSubmit;
  }

  async addSubmitsToSessionInTransaction(
    tx: Transaction,
    sessionId: string,
    submitIds: string[],
  ) {
    await tx.insert(sessionSubmits).values(
      submitIds.map((submitId) => ({
        sessionId,
        submitId,
      })),
    );
  }
}

