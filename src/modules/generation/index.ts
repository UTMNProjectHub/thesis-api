import { Elysia, status, t } from "elysia";
import { authMacro } from "../auth/handlers";
import { roleMacro } from "../roles/macro";
import { GenerationModel } from "./model";
import { amqpClient } from "../../amqp/client";
import { QUEUES } from "../../amqp/queues";
import { QuizService } from "../quiz/service";
import { SummaryService } from "../summary/service";

export const generation = new Elysia({ prefix: "/generation" })
  .use(authMacro)
  .use(roleMacro)
  .decorate("quizService", new QuizService())
  .decorate("summaryService", new SummaryService())
  .model(GenerationModel)
  .post(
    "/quiz",
    async ({ body, set }) => {
      const quizId = Bun.randomUUIDv7();

      try {
        await amqpClient.publishToQueue(QUEUES.QUIZ_GENERATION_REQUEST, {
          ...body,
          quizId: quizId,
        });
        return {
          success: true,
          message: "Quiz generation request sent",
          quizId: quizId,
        };
      } catch (error) {
        console.error("Error publishing quiz generation request:", error);
        set.status = 500;
        return {
          success: false,
          message: "Failed to send quiz generation request",
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      isAuth: true,
      body: "quizGenBody",
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
          quizId: t.String({ format: "uuid" }),
        }),
        500: t.Object({
          success: t.Boolean(),
          message: t.String(),
          error: t.String(),
        }),
      },
    },
  )
  .post(
    "/summary",
    async ({ body, set }) => {
      try {
        const summaryId = Bun.randomUUIDv7();

        await amqpClient.publishToQueue(
          QUEUES.SUMMARY_GENERATION_REQUEST,
          {
            ...body,
            summaryId: summaryId,
          },
        );
        return {
          success: true,
          message: "Summary generation request sent",
          summaryId: summaryId,
        };
      } catch (error) {
        console.error("Error publishing summary generation request:", error);
        set.status = 500;
        return {
          success: false,
          message: "Failed to send summary generation request",
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      isAuth: true,
      body: "summaryGenBody",
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
          summaryId: t.String({ format: "uuid" }),
        }),
        500: t.Object({
          success: t.Boolean(),
          message: t.String(),
          error: t.String(),
        }),
      },
    },
  );

