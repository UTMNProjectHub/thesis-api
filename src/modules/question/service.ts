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

        // "key:value;key:value"
        const answerPairs = answerText
          .trim()
          .split(";")
          .filter((pair) => pair.trim() !== "")
          .map((pair) => {
            const [key, value] = pair.split(":").map((s) => s.trim());
            return { key, value };
          })
          .filter((pair) => pair.key && pair.value);

        if (answerPairs.length === 0) {
          throw status(
            400,
            "Bad Request: matching question answer must be in format 'key:value;key:value;'",
          );
        }

        // Get all correct pairs from variants (format: "left;right")
        const correctPairs = variantsQuery
          .filter((v) => v.isRight === true && v.text)
          .map((v) => {
            const [left, right] = v.text!.split(";").map((s) => s.trim());
            return { left, right, variant: v };
          })
          .filter((p) => p.left && p.right);

        // Create pairs with isRight status and find corresponding variant for explanation
        const pairsWithStatus = answerPairs.map((answerPair) => {
          // Check if this pair matches any correct pair
          const matchingCorrectPair = correctPairs.find(
            (correctPair) =>
              correctPair.left === answerPair.key &&
              correctPair.right === answerPair.value,
          );

          const isPairRight = !!matchingCorrectPair;
          let variant = matchingCorrectPair?.variant;

          // If pair is wrong, try to find variant with the same key (left) for explanation
          if (!isPairRight && !variant) {
            const variantWithSameKey = variantsQuery.find(
              (v) => v.text && v.text.split(";")[0]?.trim() === answerPair.key,
            );
            variant = variantWithSameKey || undefined;
          }

          return {
            key: answerPair.key,
            value: answerPair.value,
            isRight: isPairRight,
            explanation: variant
              ? isPairRight
                ? variant.explainRight
                : variant.explainWrong
              : null,
          };
        });

        // Check if all pairs are correct and all correct pairs are present
        if (answerPairs.length === correctPairs.length) {
          const allCorrect = pairsWithStatus.every((pair) => pair.isRight);
          const allCorrectPresent = correctPairs.every((correctPair) => {
            return answerPairs.some(
              (answerPair) =>
                answerPair.key === correctPair.left &&
                answerPair.value === correctPair.right,
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
