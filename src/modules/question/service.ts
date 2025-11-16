import { eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import {
  chosenVariants,
  questions,
  questionsVariants,
  variants,
} from "../../db/schema";
import { status } from "elysia";
import { SessionService } from "../session/service";
import type { MatchingConfig } from "./utils";

export class QuestionService {
  private sessionService: SessionService;

  constructor() {
    this.sessionService = new SessionService();
  }
  async getQuestion(id: string) {
    const questionQuery = await db.query.questions.findFirst({
      where: eq(questions.id, id),
    });

    if (!questionQuery) {
      throw status(404, "Not Found");
    }

    return questionQuery;
  }

  async getQuestionVariantsMinimal(questionId: string) {
    const variantsQuery = await db
      .select({
        id: variants.id,
        text: variants.text,
      })
      .from(variants)
      .fullJoin(questionsVariants, eq(variants.id, questionsVariants.variantId))
      .where(eq(questionsVariants.questionId, questionId));

    return variantsQuery;
  }

  async getQuestionVariants(questionId: string) {
    const variantsQuery = await db
      .select({
        id: variants.id,
        text: variants.text,
        explainRight: variants.explainRight,
        explainWrong: variants.explainWrong,
        isRight: questionsVariants.isRight,
        questionId: questionsVariants.questionId,
        variantId: questionsVariants.variantId,
        questionsVariantsId: questionsVariants.id,
      })
      .from(variants)
      .innerJoin(questionsVariants, eq(variants.id, questionsVariants.variantId))
      .where(eq(questionsVariants.questionId, questionId));

    return variantsQuery;
  }

  async getQuestionMatchingConfig(questionId: string) {
    const matchingConfigRecord = await db.query.questionsVariants.findFirst({
      where: eq(questionsVariants.questionId, questionId),
    });

    if (!matchingConfigRecord?.matchingConfig) {
      return null;
    }

    // Преобразуем variantId из БД в id для API
    const dbConfig = matchingConfigRecord.matchingConfig as any;
    const apiConfig: MatchingConfig = {
      leftItems: (dbConfig.leftItems || []).map((item: any) => ({
        id: item.variantId || item.id, // Поддерживаем оба формата
        text: item.text,
      })),
      rightItems: (dbConfig.rightItems || []).map((item: any) => ({
        id: item.variantId || item.id, // Поддерживаем оба формата
        text: item.text,
      })),
      correctPairs: dbConfig.correctPairs || [],
    };

    return apiConfig;
  }

  async submitQuestionVariants(
    userId: string,
    quizId: string,
    questionId: string,
    variantIds: string[],
  ) {
    const questionQuery = await this.getQuestion(questionId);
    const variantsQuery = await this.getQuestionVariants(questionId);

    if (questionQuery.type !== "truefalse" && questionQuery.type !== "multichoice") {
      throw status(
        400,
        "Bad Request: this method only supports truefalse and multichoice questions",
      );
    }

    switch (questionQuery.type) {
      case "truefalse":
        if (variantIds.length !== 1) {
          throw status(
            400,
            "Bad Request: truefalse question requires exactly one answer",
          );
        }
        break;
      case "multichoice":
        if (variantIds.length < 1) {
          throw status(
            400,
            "Bad Request: multichoice question requires at least one answer",
          );
        }
        break;
    }

    const validVariantIds = variantsQuery.map((v) => v.id).filter(Boolean);
    const invalidVariants = variantIds.filter((id) => !validVariantIds.includes(id));
    if (invalidVariants.length > 0) {
      throw status(
        400,
        "Bad Request: some variant IDs do not belong to this question",
      );
    }

    const chosenVariantsArr = variantIds.map((variantId) => {
      const questionVariant = variantsQuery.find((v) => v.id === variantId);
      if (!questionVariant || !questionVariant.questionsVariantsId) {
        throw status(
          400,
          "Bad Request: could not find questionsVariants ID for variant",
        );
      }
      return {
        quizId,
        questionId,
        chosenId: questionVariant.questionsVariantsId,
      };
    });

    const session = await this.sessionService.getActiveSessionOrThrow(userId, quizId);

    const submittedVariants = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(chosenVariants)
        .values(chosenVariantsArr)
        .returning();

      await this.sessionService.addSubmitsToSessionInTransaction(
        tx,
        session.id,
        inserted.map((cv) => cv.id),
      );

      return inserted;
    });

    // Get explanations for chosen variants
    const explanations = variantIds
      .map((variantId) => {
        const variant = variantsQuery.find((v) => v.id === variantId);
        if (!variant) {
          return null;
        }
        return {
          variantId: variant.id,
          variantText: variant.text,
          isRight: variant.isRight,
          explanation: variant.isRight
            ? variant.explainRight
            : variant.explainWrong,
        };
      })
      .filter(
        (item): item is NonNullable<typeof item> => item !== null,
      );

    return {
      question: questionQuery,
      submittedVariants: explanations,
      allVariants: variantsQuery,
    };
  }

  async submitQuestionText(
    userId: string,
    quizId: string,
    questionId: string,
    answerText: string,
  ) {
    const questionQuery = await this.getQuestion(questionId);
    const variantsQuery = await this.getQuestionVariants(questionId);

    // Validate question type
    const textQuestionTypes = ["shortanswer", "essay", "numerical", "matching"];
    if (!textQuestionTypes.includes(questionQuery.type)) {
      throw status(
        400,
        "Bad Request: this method only supports text-based questions",
      );
    }

    let isRight: boolean | null = null;
    let explanation: string | null = null;

    switch (questionQuery.type) {
      case "shortanswer":
        if (!answerText || answerText.trim() === "") {
          throw status(
            400,
            "Bad Request: shortanswer question requires a non-empty answer",
          );
        }
        break;

      case "essay":
        if (!answerText || answerText.trim() === "") {
          throw status(
            400,
            "Bad Request: essay question requires a non-empty answer",
          );
        }
        break;

      case "numerical":
        if (!answerText || answerText.trim() === "") {
          throw status(
            400,
            "Bad Request: numerical question requires a non-empty answer",
          );
        }

        const numericalValue = parseFloat(answerText.trim());
        if (isNaN(numericalValue)) {
          throw status(
            400,
            "Bad Request: numerical question requires a valid number",
          );
        }

        const correctVariant = variantsQuery.find((v) => v.isRight === true);
        if (correctVariant && correctVariant.text) {
          const correctAnswer = parseFloat(correctVariant.text);
          const userAnswer = parseFloat(answerText.trim());
          isRight = Math.abs(correctAnswer - userAnswer) < 0.0001;

          explanation = isRight 
          ? correctVariant.explainRight 
          : correctVariant.explainWrong;
        }


        break;

      case "matching":
        if (!answerText || answerText.trim() === "") {
          throw status(
            400,
            "Bad Request: matching question requires a non-empty answer",
          );
        }

        // Load matching config from questions_variants
        const matchingConfigRecord = await db.query.questionsVariants.findFirst({
          where: eq(questionsVariants.questionId, questionId),
          with: {
            question: true,
          },
        });

        if (!matchingConfigRecord?.matchingConfig) {
          throw status(
            500,
            "Internal Server Error: matching config not found for this question",
          );
        }

        const matchingConfig = matchingConfigRecord.matchingConfig as MatchingConfig;

        // Parse answer: "leftVariantId:rightVariantId;leftVariantId:rightVariantId"
        const answerPairs = answerText
          .trim()
          .split(";")
          .filter((pair) => pair.trim() !== "")
          .map((pair) => {
            const [leftVariantId, rightVariantId] = pair.split(":").map((s) => s.trim());
            return { leftVariantId, rightVariantId };
          })
          .filter((pair) => pair.leftVariantId && pair.rightVariantId);

        if (answerPairs.length === 0) {
          throw status(
            400,
            "Bad Request: matching question answer must be in format 'leftVariantId:rightVariantId;leftVariantId:rightVariantId;'",
          );
        }

        // Check each pair against correctPairs
        const pairsWithStatus = answerPairs.map((answerPair) => {
          // Find matching correct pair
          const correctPair = matchingConfig.correctPairs.find(
            (cp) =>
              cp.leftVariantId === answerPair.leftVariantId &&
              cp.rightVariantId === answerPair.rightVariantId,
          );

          const isPairRight = !!correctPair;

          // Get left and right item texts for response
          const leftItem = matchingConfig.leftItems.find(
            (li) => li.id === answerPair.leftVariantId,
          );
          const rightItem = matchingConfig.rightItems.find(
            (ri) => ri.id === answerPair.rightVariantId,
          );

          // Get explanation from correct pair
          let explanation: string | null = null;
          if (isPairRight && correctPair) {
            explanation = correctPair.explainRight || null;
          } else {
            // Find the correct pair for this left item to show what was wrong
            const correctPairForLeft = matchingConfig.correctPairs.find(
              (cp) => cp.leftVariantId === answerPair.leftVariantId,
            );
            if (correctPairForLeft) {
              explanation = correctPairForLeft.explainWrong || null;
            }
          }

          return {
            key: leftItem?.text || answerPair.leftVariantId,
            value: rightItem?.text || answerPair.rightVariantId,
            isRight: isPairRight,
            explanation,
          };
        });

        // Check if all pairs are correct and all correct pairs are present
        if (answerPairs.length === matchingConfig.correctPairs.length) {
          const allCorrect = pairsWithStatus.every((pair) => pair.isRight);
          const allCorrectPresent = matchingConfig.correctPairs.every((correctPair) => {
            return answerPairs.some(
              (answerPair) =>
                answerPair.leftVariantId === correctPair.leftVariantId &&
                answerPair.rightVariantId === correctPair.rightVariantId,
            );
          });
          isRight = allCorrect && allCorrectPresent;
        } else {
          isRight = false;
        }

        // Store pairs in answer field
        const answerData = {
          pairs: pairsWithStatus.map((p) => ({
            key: p.key,
            value: p.value,
            isRight: p.isRight,
          })),
        };

        const session = await this.sessionService.getActiveSessionOrThrow(userId, quizId);

        const [submitted] = await db.transaction(async (tx) => {
          const [inserted] = await tx
            .insert(chosenVariants)
            .values({
              quizId,
              questionId,
              answer: answerData,
              isRight,
            })
            .returning();

          await this.sessionService.addSubmitsToSessionInTransaction(
            tx,
            session.id,
            [inserted.id],
          );

          return [inserted];
        });

        return {
          question: questionQuery,
          submittedAnswer: submitted,
          isRight,
          pairs: pairsWithStatus,
          variants: variantsQuery,
          explanation: null, 
        };

      default:
        break;
    }

    const session = await this.sessionService.getActiveSessionOrThrow(userId, quizId);

    const [submitted] = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(chosenVariants)
        .values({
          quizId,
          questionId,
          answer: { text: answerText.trim(), explanation: explanation },
          isRight,
        })
        .returning();

      await this.sessionService.addSubmitsToSessionInTransaction(
        tx,
        session.id,
        [inserted.id],
      );

      return [inserted];
    });

    return {
      question: questionQuery,
      submittedAnswer: submitted,
      isRight,
      explanation,
      variants: variantsQuery,
    };
  }

  async updateQuestion(
    id: string,
    data: {
      text?: string;
      type?: string;
      multiAnswer?: boolean | null;
    }
  ) {
    const question = await db.query.questions.findFirst({
      where: eq(questions.id, id),
    });

    if (!question) {
      throw status(404, "Not Found");
    }

    const updateData: {
      text?: string;
      type?: string;
      multiAnswer?: boolean | null;
    } = {};

    if (data.text !== undefined) updateData.text = data.text;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.multiAnswer !== undefined) updateData.multiAnswer = data.multiAnswer;

    const [updated] = await db
      .update(questions)
      .set(updateData)
      .where(eq(questions.id, id))
      .returning();

    return updated;
  }

  async updateQuestionVariants(
    questionId: string,
    variantsData: Array<{
      text: string;
      explainRight: string;
      explainWrong: string;
      isRight: boolean;
    }>
  ) {
    return await db.transaction(async (tx) => {
      // Проверяем существование вопроса
      const question = await tx.query.questions.findFirst({
        where: eq(questions.id, questionId),
      });

      if (!question) {
        throw status(404, "Question not found");
      }

      // Для numerical вопросов должен быть только один правильный вариант
      if (question.type === "numerical") {
        if (variantsData.length !== 1 || !variantsData[0].isRight) {
          throw status(400, "Numerical question must have exactly one correct variant");
        }
      }

      // Получаем все существующие questionsVariants для этого вопроса
      const existingQuestionsVariants = await tx.query.questionsVariants.findMany({
        where: eq(questionsVariants.questionId, questionId),
      });

      // Получаем ID всех связанных variants
      const variantIds = existingQuestionsVariants
        .map((qv) => qv.variantId)
        .filter((id): id is string => id !== null);

      // Проверяем, используются ли эти variants в других вопросах (ПЕРЕД удалением)
      let unusedVariantIds: string[] = [];
      if (variantIds.length > 0) {
        const allQuestionsVariants = await tx
          .select()
          .from(questionsVariants)
          .where(inArray(questionsVariants.variantId, variantIds));

        const usedVariantIds = new Set(
          allQuestionsVariants
            .map((qv) => qv.variantId)
            .filter((id): id is string => id !== null)
        );

        // Удаляем только те variants, которые больше нигде не используются
        unusedVariantIds = variantIds.filter((id) => !usedVariantIds.has(id));
      }

      // Удаляем старые questionsVariants
      if (existingQuestionsVariants.length > 0) {
        await tx
          .delete(questionsVariants)
          .where(eq(questionsVariants.questionId, questionId));
      }

      // Удаляем старые variants (если они больше нигде не используются)
      if (unusedVariantIds.length > 0) {
        await tx.delete(variants).where(inArray(variants.id, unusedVariantIds));
      }

      // Создаем новые variants и questionsVariants
      for (const variantData of variantsData) {
        const [variant] = await tx
          .insert(variants)
          .values({
            text: variantData.text,
            explainRight: variantData.explainRight,
            explainWrong: variantData.explainWrong,
          })
          .returning();

        await tx.insert(questionsVariants).values({
          questionId: questionId,
          variantId: variant.id,
          isRight: variantData.isRight,
        });
      }

      return { success: true };
    });
  }

  async updateQuestionMatchingConfig(
    questionId: string,
    matchingConfig: MatchingConfig
  ) {
    return await db.transaction(async (tx) => {
      // Проверяем существование вопроса
      const question = await tx.query.questions.findFirst({
        where: eq(questions.id, questionId),
      });

      if (!question) {
        throw status(404, "Question not found");
      }

      if (question.type !== "matching") {
        throw status(400, "Question type must be matching");
      }

      // Получаем существующую запись questionsVariants с matchingConfig
      const existingQuestionsVariants = await tx.query.questionsVariants.findMany({
        where: eq(questionsVariants.questionId, questionId),
      });

      // Получаем все variant IDs из старой конфигурации
      const oldVariantIds = new Set<string>();
      for (const qv of existingQuestionsVariants) {
        if (qv.matchingConfig) {
          const oldConfig = qv.matchingConfig as any; // В БД хранится variantId, не id
          oldConfig.leftItems?.forEach((item: any) => {
            // Поддерживаем оба формата: variantId (старый) и id (новый)
            const variantId = item.variantId || item.id;
            if (variantId) oldVariantIds.add(variantId);
          });
          oldConfig.rightItems?.forEach((item: any) => {
            const variantId = item.variantId || item.id;
            if (variantId) oldVariantIds.add(variantId);
          });
        }
        if (qv.variantId) {
          oldVariantIds.add(qv.variantId);
        }
      }

      // Удаляем старые questionsVariants
      if (existingQuestionsVariants.length > 0) {
        await tx
          .delete(questionsVariants)
          .where(eq(questionsVariants.questionId, questionId));
      }

      // Создаем новые variants для leftItems и rightItems
      const leftVariants: Array<{ id: string; text: string }> = [];
      const rightVariants: Array<{ id: string; text: string }> = [];

      for (const leftItem of matchingConfig.leftItems) {
        const [variant] = await tx
          .insert(variants)
          .values({
            text: leftItem.text,
            explainRight: "",
            explainWrong: "",
          })
          .returning();
        leftVariants.push({
          id: variant.id,
          text: variant.text,
        });
      }

      for (const rightItem of matchingConfig.rightItems) {
        const [variant] = await tx
          .insert(variants)
          .values({
            text: rightItem.text,
            explainRight: "",
            explainWrong: "",
          })
          .returning();
        rightVariants.push({
          id: variant.id,
          text: variant.text,
        });
      }

      // Создаем обновленную matching конфигурацию с новыми variant IDs
      // В БД хранится variantId, поэтому используем его
      const updatedMatchingConfig: any = {
        leftItems: leftVariants.map((v) => ({
          variantId: v.id, // В БД используем variantId
          text: v.text,
        })),
        rightItems: rightVariants.map((v) => ({
          variantId: v.id, // В БД используем variantId
          text: v.text,
        })),
        correctPairs: matchingConfig.correctPairs.map((pair) => {
          // Находим новые variant IDs по id из оригинальных массивов
          const leftIndex = matchingConfig.leftItems.findIndex(
            (item) => item.id === pair.leftVariantId
          );
          const rightIndex = matchingConfig.rightItems.findIndex(
            (item) => item.id === pair.rightVariantId
          );
          return {
            leftVariantId: leftVariants[leftIndex]?.id || pair.leftVariantId,
            rightVariantId: rightVariants[rightIndex]?.id || pair.rightVariantId,
            explainRight: pair.explainRight,
            explainWrong: pair.explainWrong,
          };
        }),
      };

      // Вставляем новую запись questionsVariants с обновленной конфигурацией
      await tx.insert(questionsVariants).values({
        questionId: questionId,
        variantId: null,
        isRight: null,
        matchingConfig: updatedMatchingConfig,
      });

      // Удаляем старые variants, если они больше нигде не используются
      if (oldVariantIds.size > 0) {
        const variantIdsArray = Array.from(oldVariantIds).filter((id): id is string => id !== undefined && id !== null);
        
        if (variantIdsArray.length > 0) {
          const allQuestionsVariants = await tx
            .select()
            .from(questionsVariants)
            .where(inArray(questionsVariants.variantId, variantIdsArray));

          const usedVariantIds = new Set(
            allQuestionsVariants
              .map((qv) => qv.variantId)
              .filter((id): id is string => id !== null)
          );

          const unusedVariantIds = variantIdsArray.filter(
            (id) => !usedVariantIds.has(id)
          );

          if (unusedVariantIds.length > 0) {
            await tx.delete(variants).where(inArray(variants.id, unusedVariantIds));
          }
        }
      }

      return { success: true };
    });
  }
}
