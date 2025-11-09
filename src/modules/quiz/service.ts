import { eq } from "drizzle-orm";
import { db } from "../../db";
import {
  questions,
  questionsVariants,
  quizes,
  quizesQuestions,
  variants,
} from "../../db/schema";
import { status } from "elysia";
import { SessionService } from "../session/service";

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

  async getQuestionsByQuizId(id: string) {
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

    return questionsQuery.map((qq) => ({
      ...qq.question,
      variants: qq.question.questionsVariants.map((qv) => ({
        id: qv.variant.id,
        text: qv.variant.text,
      })),
      questionsVariants: undefined,
    }));
  }

  async startQuizSessionAndGetQuestions(userId: string, quizId: string) {
    return await db.transaction(async (tx) => {
      const quiz = await tx.query.quizes.findFirst({
        where: eq(quizes.id, quizId),
      });

      if (!quiz) {
        throw status(404, "Quiz not found");
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

      const questions = questionsQuery.map((qq) => ({
        ...qq.question,
        variants: qq.question.questionsVariants.map((qv) => ({
          id: qv.variant.id,
          text: qv.variant.text,
        })),
        questionsVariants: undefined,
      }));

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
