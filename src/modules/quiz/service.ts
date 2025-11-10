import { and, eq, isNotNull, isNull, inArray } from "drizzle-orm";
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
      questionCount: quiz.quizesQuestions.length
    };
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
          (qv) => qv.matchingConfig !== null,
        );

        if (matchingConfigRecord?.matchingConfig) {
          const config = matchingConfigRecord.matchingConfig as MatchingConfig;
          // Use sessionId as seed, or fallback to userId + quizId
          const seed = sessionId || `${userId || ""}_${id}`;
          const { leftItems, rightItems } = getMatchingQuestionForStudent(
            config,
            seed,
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
            isNotNull(quizSession.timeEnd),
          ),
        });

        if (activeSessions.length >= quiz.maxSessions) {
          throw status(403, "You have reached the maximum number of sessions");
        }
      }

      const session = await this.sessionService.createSessionInTransaction(
        tx,
        userId,
        quizId,
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
            (qv) => qv.matchingConfig !== null,
          );

          if (matchingConfigRecord?.matchingConfig) {
            const config = matchingConfigRecord.matchingConfig as MatchingConfig;
            // Use sessionId as seed
            const seed = session.id;
            const { leftItems, rightItems } = getMatchingQuestionForStudent(
              config,
              seed,
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
}
