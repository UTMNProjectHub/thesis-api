import { eq } from "drizzle-orm";
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
            (li) => li.variantId === answerPair.leftVariantId,
          );
          const rightItem = matchingConfig.rightItems.find(
            (ri) => ri.variantId === answerPair.rightVariantId,
          );

          // Get explanation from correct pair or from items
          let explanation: string | null = null;
          if (isPairRight && correctPair) {
            explanation = correctPair.explainRight || leftItem?.explainRight || rightItem?.explainRight || null;
          } else {
            // Find the correct pair for this left item to show what was wrong
            const correctPairForLeft = matchingConfig.correctPairs.find(
              (cp) => cp.leftVariantId === answerPair.leftVariantId,
            );
            if (correctPairForLeft) {
              explanation = correctPairForLeft.explainWrong || leftItem?.explainWrong || rightItem?.explainWrong || null;
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
          answer: { text: answerText.trim() },
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
}
