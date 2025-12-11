import Elysia, { status, t } from "elysia";
import { authMacro } from "../auth/handlers";
import { roleMacro } from "../roles/macro";
import { QuestionService } from "./service";
import {
  SolveQuestionParams,
  SolveQuestionBody,
  SolveQuestionVariantsResponse,
  SolveQuestionTextResponseUnion,
  ErrorResponse,
  UpdateQuestionBody,
  UpdateQuestionVariantsBody,
  UpdateQuestionMatchingConfigBody,
  QuestionModel,
  VariantModel,
  MatchingConfigModel,
} from "./model";
import type { MatchingConfig } from "./utils";

export const question = new Elysia({ prefix: "/questions" })
  .use(authMacro)
  .use(roleMacro)
  .decorate("questionService", new QuestionService())
  .get(
    "/:id",
    async ({ params: { id }, questionService }) => {
      const question = await questionService.getQuestion(id);
      const variants = await questionService.getQuestionVariants(id);
      const filteredVariants = variants
        .filter((v) => v.variantId !== null && v.isRight !== null)
        .map((v) => ({
          id: v.id,
          text: v.text,
          explainRight: v.explainRight,
          explainWrong: v.explainWrong,
          isRight: v.isRight as boolean,
          questionId: v.questionId,
          variantId: v.variantId as string,
          questionsVariantsId: v.questionsVariantsId,
        }));


      if (question.type === "matching") {
        const matchingConfig = await questionService.getQuestionMatchingConfig(id);
        if (matchingConfig) {
          const apiMatchingConfig = {
            leftItems: matchingConfig.leftItems.map((item) => ({
              id: item.id,
              text: item.text,
            })),
            rightItems: matchingConfig.rightItems.map((item) => ({
              id: item.id,
              text: item.text,
            })),
            correctPairs: matchingConfig.correctPairs,
          };
          return {
            ...question,
            variants: filteredVariants,
            matchingConfig: apiMatchingConfig,
          };
        }
        return {
          ...question,
          variants: filteredVariants,
        };
      }

      // Для numerical вопросов возвращаем единственный правильный вариант
      if (question.type === "numerical") {
        const numericalVariant = filteredVariants.find((v) => v.isRight === true);
        return {
          ...question,
          variants: numericalVariant ? [numericalVariant] : [],
        };
      }

      return {
        ...question,
        variants: filteredVariants,
      };
    },
    {
      isTeacher: true,
      params: SolveQuestionParams,
      response: {
        200: t.Object({
          id: t.String({ format: "uuid" }),
          type: t.String(),
          multiAnswer: t.Nullable(t.Boolean()),
          text: t.String(),
          variants: t.Array(VariantModel),
          matchingConfig: t.Optional(MatchingConfigModel),
        }),
        404: ErrorResponse,
      },
    }
  )
  .post(
    "/:id/solve",
    async ({
      userId,
      params: { id },
      body: { answerIds, answerText, quizId },
      questionService,
    }) => {
      if (!answerIds && !answerText) {
        return status(400, "Bad Request");
      }

      if (answerIds) {
        return await questionService.submitQuestionVariants(
          userId!,
          quizId,
          id,
          answerIds,
        );
      }

      if (answerText) {
        return await questionService.submitQuestionText(
          userId!,
          quizId,
          id,
          answerText,
        );
      }

      return status(400, "Bad Request");
    },
    {
      isAuth: true,
      params: SolveQuestionParams,
      response: {
        400: ErrorResponse,
      },
      body: SolveQuestionBody,
    },
  )
  .put(
    "/:id",
    async ({ params: { id }, questionService, body }) => {
      return await questionService.updateQuestion(id, body);
    },
    {
      isTeacher: true,
      params: SolveQuestionParams,
      body: UpdateQuestionBody,
      response: {
        200: QuestionModel,
        404: ErrorResponse,
      },
    }
  )
  .put(
    "/:id/variants",
    async ({ params: { id }, questionService, body }) => {
      return await questionService.updateQuestionVariants(id, body.variants);
    },
    {
      isTeacher: true,
      params: SolveQuestionParams,
      body: UpdateQuestionVariantsBody,
      response: {
        200: t.Object({ success: t.Boolean() }),
        404: ErrorResponse,
      },
    }
  )
  .put(
    "/:id/matching-config",
    async ({ params: { id }, questionService, body }) => {
      // Преобразуем id в variantId для внутреннего использования
      const internalMatchingConfig: MatchingConfig = {
        leftItems: body.matchingConfig.leftItems.map((item) => ({
          id: item.id,
          text: item.text,
        })),
        rightItems: body.matchingConfig.rightItems.map((item) => ({
          id: item.id,
          text: item.text,
        })),
        correctPairs: body.matchingConfig.correctPairs.map((pair) => ({
          leftVariantId: pair.leftVariantId,
          rightVariantId: pair.rightVariantId,
          explainRight: pair.explainRight,
          explainWrong: pair.explainWrong,
        })),
      };
      return await questionService.updateQuestionMatchingConfig(id, internalMatchingConfig);
    },
    {
      isTeacher: true,
      params: SolveQuestionParams,
      body: UpdateQuestionMatchingConfigBody,
      response: {
        200: t.Object({ success: t.Boolean() }),
        404: ErrorResponse,
      },
    }
  );
