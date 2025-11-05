import Elysia, { status, t } from "elysia";
import { authMacro } from "../auth/handlers";
import { QuestionService } from "./service";
import {
  SolveQuestionParams,
  SolveQuestionBody,
  SolveQuestionVariantsResponse,
  SolveQuestionTextResponseUnion,
  ErrorResponse,
} from "./model";

export const question = new Elysia({ prefix: "/questions" })
  .use(authMacro)
  .decorate("questionService", new QuestionService())
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
  );
