import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../db";
import {
  questions,
  questionsVariants,
  quizes,
  quizesQuestions,
  quizSession,
  variants,
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
            isNull(quizSession.timeEnd),
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

}
