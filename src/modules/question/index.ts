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
  QuestionModel,
  VariantModel,
} from "./model";

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
        200: t.Union([
          SolveQuestionVariantsResponse,
          SolveQuestionTextResponseUnion,
        ]),
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
  );
