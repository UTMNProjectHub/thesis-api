import { and, eq, isNotNull, isNull, inArray, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  questions,
  questionsVariants,
  quizes,
  quizesQuestions,
  quizSession,
  variants,
  chosenVariants,
  sessionSubmits,
  usersQuizes,
  referencesQuiz,
  users,
} from "../../db/schema";
import { status } from "elysia";
import { SessionService } from "../session/service";
import {
  getMatchingQuestionForStudent,
  type MatchingConfig,
} from "../question/utils";

export class QuizService {
  private sessionService: SessionService;

  constructor() {
    this.sessionService = new SessionService();
  }

  getSessionService(): SessionService {
    return this.sessionService;
  }
  async getQuizById(id: string) {
    const quiz = await db.query.quizes.findFirst({
      where: eq(quizes.id, id),
      with: {
        quizesQuestions: {
          with: {
            question: true,
          },
        },
      },
    });

    if (!quiz) {
      throw status(404, "Not Found");
    }

    return {
      ...quiz,
      quizesQuestions: undefined,
      questionCount: quiz.quizesQuestions.length,
    };
  }

  async updateQuiz(
    id: string,
    data: {
      name?: string;
      description?: string;
      type?: string;
      maxSessions?: number;
      themeId?: number | null;
    }
  ) {
    const quiz = await db.query.quizes.findFirst({
      where: eq(quizes.id, id),
    });

    if (!quiz) {
      throw status(404, "Not Found");
    }

    const updateData: {
      name?: string;
      description?: string;
      type?: string;
      maxSessions?: number;
      themeId?: number | null;
    } = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.maxSessions !== undefined) updateData.maxSessions = data.maxSessions;
    if (data.themeId !== undefined) updateData.themeId = data.themeId;

    const [updated] = await db
      .update(quizes)
      .set(updateData)
      .where(eq(quizes.id, id))
      .returning();

    return updated;
  }

  async getQuestionsByQuizId(id: string, sessionId?: string, userId?: string) {
    const questionsQuery = await db.query.quizesQuestions.findMany({
      where: eq(quizesQuestions.quizId, id),
      with: {
        question: {
          with: {
            questionsVariants: {
              with: {
                variant: true,
              },
            },
          },
        },
      },
    });

    return questionsQuery.map((qq) => {
      const question = qq.question;

      // Handle matching questions
      if (question.type === "matching") {
        // Find matching config in questions_variants
        const matchingConfigRecord = question.questionsVariants.find(
          (qv) => qv.matchingConfig !== null
        );

        if (matchingConfigRecord?.matchingConfig) {
          const config = matchingConfigRecord.matchingConfig as MatchingConfig;
          // Use sessionId as seed, or fallback to userId + quizId
          const seed = sessionId || `${userId || ""}_${id}`;
          const { leftItems, rightItems } = getMatchingQuestionForStudent(
            config,
            seed
          );

          return {
            ...question,
            matchingLeftItems: leftItems,
            matchingRightItems: rightItems,
            variants: undefined,
            questionsVariants: undefined,
          };
        }
      }

      // Handle regular questions (multichoice, truefalse, etc.)
      // Filter out matching config records and get variants
      const regularVariants = question.questionsVariants
        .filter((qv) => qv.matchingConfig === null && qv.variantId !== null)
        .map((qv) => ({
          id: qv.variant?.id || "",
          text: qv.variant?.text || "",
        }))
        .filter((v) => v.id && v.text);

      return {
        ...question,
        variants: regularVariants,
        questionsVariants: undefined,
      };
    });
  }

  async startQuizSessionAndGetQuestions(userId: string, quizId: string) {
    return await db.transaction(async (tx) => {
      const quiz = await tx.query.quizes.findFirst({
        where: eq(quizes.id, quizId),
      });

      if (!quiz) {
        throw status(404, "Quiz not found");
      }

      if (quiz.maxSessions > 0) {
        const activeSessions = await tx.query.quizSession.findMany({
          where: and(
            eq(quizSession.userId, userId),
            eq(quizSession.quizId, quizId),
            isNotNull(quizSession.timeEnd)
          ),
        });

        if (activeSessions.length >= quiz.maxSessions) {
          throw status(403, "You have reached the maximum number of sessions");
        }
      }

      const session = await this.sessionService.createSessionInTransaction(
        tx,
        userId,
        quizId
      );

      const questionsQuery = await tx.query.quizesQuestions.findMany({
        where: eq(quizesQuestions.quizId, quizId),
        with: {
          question: {
            with: {
              questionsVariants: {
                with: {
                  variant: true,
                },
              },
            },
          },
        },
      });

      const questions = questionsQuery.map((qq) => {
        const question = qq.question;

        // Handle matching questions
        if (question.type === "matching") {
          // Find matching config in questions_variants
          const matchingConfigRecord = question.questionsVariants.find(
            (qv) => qv.matchingConfig !== null
          );

          if (matchingConfigRecord?.matchingConfig) {
            const config =
              matchingConfigRecord.matchingConfig as MatchingConfig;
            // Use sessionId as seed
            const seed = session.id;
            const { leftItems, rightItems } = getMatchingQuestionForStudent(
              config,
              seed
            );

            return {
              ...question,
              matchingLeftItems: leftItems,
              matchingRightItems: rightItems,
              variants: undefined,
              questionsVariants: undefined,
            };
          }
        }

        // Handle regular questions (multichoice, truefalse, etc.)
        // Filter out matching config records and get variants
        const regularVariants = question.questionsVariants
          .filter((qv) => qv.matchingConfig === null && qv.variantId !== null)
          .map((qv) => ({
            id: qv.variant?.id || "",
            text: qv.variant?.text || "",
          }))
          .filter((v) => v.id && v.text);

        return {
          ...question,
          variants: regularVariants,
          questionsVariants: undefined,
        };
      });

      return {
        session,
        questions,
      };
    });
  }

  async getQuizesByThemeId(themeId: number) {
    const quizesList = await db.query.quizes.findMany({
      where: eq(quizes.themeId, themeId),
      with: {
        quizesQuestions: true,
      },
    });

    return quizesList.map((quiz) => ({
      id: quiz.id,
      type: quiz.type,
      name: quiz.name,
      description: quiz.description,
      themeId: quiz.themeId,
      questionCount: quiz.quizesQuestions.length,
    }));
  }

  async deleteQuiz(id: string) {
    return await db.transaction(async (tx) => {
      // 1. Удаляем session_submits, которые ссылаются на сессии этого квиза
      const sessions = await tx.query.quizSession.findMany({
        where: eq(quizSession.quizId, id),
      });

      const sessionIds = sessions.map((s) => s.id);
      if (sessionIds.length > 0) {
        await tx
          .delete(sessionSubmits)
          .where(inArray(sessionSubmits.sessionId, sessionIds));
      }

      // 2. Удаляем chosen_variants, которые ссылаются на quiz
      await tx.delete(chosenVariants).where(eq(chosenVariants.quizId, id));

      // 3. Удаляем quiz_session, которые ссылаются на quiz
      await tx.delete(quizSession).where(eq(quizSession.quizId, id));

      // 4. Удаляем quizes_questions, которые ссылаются на quiz
      await tx.delete(quizesQuestions).where(eq(quizesQuestions.quizId, id));

      // 5. Удаляем users_quizes, которые ссылаются на quiz
      await tx.delete(usersQuizes).where(eq(usersQuizes.quizId, id));

      // 6. Удаляем references_quiz, которые ссылаются на quiz
      await tx.delete(referencesQuiz).where(eq(referencesQuiz.quizId, id));

      // 7. Наконец удаляем саму викторину
      return await tx.delete(quizes).where(eq(quizes.id, id));
    });
  }

  async getQuizUserSessions(quizId: string) {
    // Сначала получаем количество вопросов в квизе
    const questionCount = await db.query.quizesQuestions.findMany({
      where: eq(quizesQuestions.quizId, quizId),
    });
    const totalQuestions = questionCount.length;

    // Получаем все сессии с их submits и chosenVariants
    const sessionsData = await db
      .select({
        userId: users.id,
        fullName: users.full_name,
        email: users.email,
        sessionId: quizSession.id,
        timeStart: quizSession.timeStart,
        timeEnd: quizSession.timeEnd,
        submitId: sessionSubmits.id,
        isRight: chosenVariants.isRight,
      })
      .from(users)
      .innerJoin(quizSession, eq(users.id, quizSession.userId))
      .leftJoin(sessionSubmits, eq(sessionSubmits.sessionId, quizSession.id))
      .leftJoin(chosenVariants, eq(sessionSubmits.submitId, chosenVariants.id))
      .where(eq(quizSession.quizId, quizId));
    
    // Группируем данные по сессиям и вычисляем статистику
    const sessionsMap = new Map<string, {
      userId: string;
      fullName: string | null;
      email: string;
      sessionId: string;
      timeStart: Date | null;
      timeEnd: Date | null;
      totalSubmits: number;
      rightAnswers: number;
    }>();

    for (const row of sessionsData) {
      const key = row.sessionId;
      if (!sessionsMap.has(key)) {
        sessionsMap.set(key, {
          userId: row.userId,
          fullName: row.fullName,
          email: row.email,
          sessionId: row.sessionId,
          timeStart: row.timeStart,
          timeEnd: row.timeEnd,
          totalSubmits: 0,
          rightAnswers: 0,
        });
      }
      const session = sessionsMap.get(key)!;
      if (row.submitId) {
        session.totalSubmits++;
        if (row.isRight === true) {
          session.rightAnswers++;
        }
      }
    }

    const sessions = Array.from(sessionsMap.values());
    
    const groupedByUser = sessions.reduce((acc, session) => {
      const userId = session.userId;
      if (!acc[userId]) {
        acc[userId] = {
          userId: session.userId,
          fullName: session.fullName,
          email: session.email,
          sessions: [],
        };
      }
      
      // Вычисляем проценты
      const percentSolved = totalQuestions > 0 
        ? Math.round((session.totalSubmits / totalQuestions) * 100 * 100) / 100 
        : 0;
      const percentRight = session.totalSubmits > 0 
        ? Math.round((session.rightAnswers / session.totalSubmits) * 100 * 100) / 100 
        : 0;
      
      acc[userId].sessions.push({
        id: session.sessionId,
        timeStart: session.timeStart,
        timeEnd: session.timeEnd,
        percentSolved,
        percentRight,
      });
      return acc;
    }, {} as Record<string, { 
      userId: string; 
      fullName: string | null; 
      email: string; 
      sessions: Array<{ 
        id: string; 
        timeStart: Date | null; 
        timeEnd: Date | null;
        percentSolved: number;
        percentRight: number;
      }> 
    }>);
    
    return Object.values(groupedByUser);
  }
}
