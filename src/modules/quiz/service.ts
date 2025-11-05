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

export class QuizService {
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
}
